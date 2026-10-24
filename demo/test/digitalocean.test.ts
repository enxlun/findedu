// DigitalOcean serverless inference (prioritization) and the provider chain.
import { test } from "node:test";
import assert from "node:assert/strict";
import { createServer, type IncomingMessage } from "node:http";
import type { AddressInfo } from "node:net";
import { chainFor, chat, complete, getDoConfig } from "../server/ai/llm.ts";
import { analyzeDeps, begin, buildBeginMessages, mergeBegin } from "../server/ai/begin.ts";
import type { BeginInput, Task } from "../server/types.ts";

const readJson = async (req: IncomingMessage) => {
  let body = "";
  for await (const c of req) body += c;
  return JSON.parse(body);
};

const withEnv = async (vars: Record<string, string | undefined>, fn: () => Promise<void>) => {
  const old = Object.fromEntries(Object.keys(vars).map((k) => [k, process.env[k]]));
  for (const [k, v] of Object.entries(vars)) v === undefined ? delete process.env[k] : (process.env[k] = v);
  try {
    await fn();
  } finally {
    for (const [k, v] of Object.entries(old)) v === undefined ? delete process.env[k] : (process.env[k] = v);
  }
};

test("DigitalOcean: Bearer model access key, gemma-4-31B-it, max_completion_tokens", async () => {
  const seen: { url?: string; auth?: string; body: any }[] = [];
  const server = createServer(async (req, res) => {
    seen.push({ url: req.url, auth: req.headers.authorization, body: await readJson(req) });
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ choices: [{ message: { content: '{"ok":true}' } }] }));
  });
  await new Promise<void>((r) => server.listen(0, r));
  const port = (server.address() as AddressInfo).port;
  await withEnv({ DO_API_KEY: "do-key", DO_BASE_URL: `http://127.0.0.1:${port}/v1`, DO_MODEL: undefined }, async () => {
    const cfg = getDoConfig()!;
    assert.equal(cfg.model, "gemma-4-31B-it");
    const out = await chat([{ role: "system", content: "S" }, { role: "user", content: "hi" }], { json: true, maxTokens: 321 }, cfg);
    assert.equal(out, '{"ok":true}');
  });
  server.close();
  assert.equal(seen[0].url, "/v1/chat/completions");
  assert.equal(seen[0].auth, "Bearer do-key");
  assert.equal(seen[0].body.model, "gemma-4-31B-it");
  assert.equal(seen[0].body.max_completion_tokens, 321);
  assert.equal(seen[0].body.max_tokens, undefined);
  assert.deepEqual(seen[0].body.response_format, { type: "json_object" });
});

test("provider chain: prioritization prefers DigitalOcean, help prefers the Gemini API", async () => {
  await withEnv({ AI_PROVIDER: "gemini", AI_API_KEY: "g", DO_API_KEY: "d", DO_BASE_URL: undefined }, async () => {
    assert.deepEqual(chainFor("priority").map((c) => c.provider), ["digitalocean", "gemini"]);
    assert.deepEqual(chainFor("help").map((c) => c.provider), ["gemini", "digitalocean"]);
  });
  await withEnv({ AI_PROVIDER: "gemini", AI_API_KEY: "g", DO_API_KEY: undefined, DIGITALOCEAN_MODEL_ACCESS_KEY: undefined, MODEL_ACCESS_KEY: undefined }, async () => {
    assert.deepEqual(chainFor("priority").map((c) => c.provider), ["gemini"]);
  });
});

test("provider chain: when DigitalOcean fails, the Gemini API answers and the error is kept", async () => {
  const server = createServer(async (req, res) => {
    await readJson(req);
    if (req.url?.startsWith("/do/")) {
      res.writeHead(401, { "Content-Type": "application/json" });
      res.end('{"error":"bad key"}');
      return;
    }
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ candidates: [{ content: { parts: [{ text: "from gemini" }] } }] }));
  });
  await new Promise<void>((r) => server.listen(0, r));
  const port = (server.address() as AddressInfo).port;
  await withEnv(
    {
      AI_PROVIDER: "gemini",
      AI_API_KEY: "g",
      AI_BASE_URL: `http://127.0.0.1:${port}/v1beta`,
      AI_MODEL: "gemma-4-26b-a4b-it",
      DO_API_KEY: "wrong",
      DO_BASE_URL: `http://127.0.0.1:${port}/do/v1`,
    },
    async () => {
      const c = await complete([{ role: "user", content: "x" }], {}, "priority");
      assert.equal(c.text, "from gemini");
      assert.equal(c.provider, "gemini");
      assert.match(c.fallbackFrom ?? "", /DigitalOcean: DigitalOcean returned 401/);
    },
  );
  server.close();
});

// ------------------------------------------------------------------ AI ranking

const now = new Date("2026-10-24T04:00:00Z");
const task = (id: string, dueInHours: number, opts: Partial<Task> = {}): Task => ({
  _id: id,
  type: "homework",
  title: `Task ${id}`,
  description: "",
  subject: "Math",
  dueDate: new Date(now.getTime() + dueInHours * 3600e3).toISOString(),
  estimatedMinutes: 30,
  weight: 3,
  dependsOn: [],
  createdBy: "t",
  classId: "c",
  createdAt: now.toISOString(),
  ...opts,
});
const inputs: BeginInput[] = [
  { task: task("lab", 60), status: "todo", difficulty: 3 },
  { task: task("report", 46, { dependsOn: ["lab"], weight: 4 }), status: "todo", difficulty: 4 },
  { task: task("essay", 30, { weight: 2 }), status: "todo", difficulty: 2 },
  { task: task("old", -10), status: "done", difficulty: 2 },
];
const opts = { lang: "en" as const, now };

test("AI ranking: every open task scored, prerequisites above dependents, Begin pick on top", () => {
  const { idMap } = buildBeginMessages(inputs, opts);
  const short = new Map([...idMap].map(([s, id]) => [id, s]));
  const raw = {
    next: { id: short.get("essay"), reason: "r", firstStep: "f" },
    // the model wrongly puts the blocked report above its prerequisite
    ranking: [
      { id: short.get("report"), score: 97, why: "big" },
      { id: short.get("lab"), score: 60, why: "lab" },
      { id: short.get("essay"), score: 80, why: "soon" },
    ],
  };
  const plan = mergeBegin(raw, idMap, inputs, opts, "gemma-4-31B-it", "digitalocean");
  assert.equal(plan.provider, "digitalocean");
  assert.deepEqual(plan.ranking.map((r) => r.taskId), ["essay", "lab", "report"]);
  const score = (id: string) => plan.ranking.find((r) => r.taskId === id)!.score;
  assert.ok(score("report") < score("lab"));
  assert.ok(!plan.ranking.some((r) => r.taskId === "old"));
  assert.equal(plan.ranking.find((r) => r.taskId === "lab")!.reason, "lab");
  assert.ok(analyzeDeps(inputs, now).get("report")!.blockedBy.includes("lab"));
});

test("Begin runs on the prioritization chain and falls back to the heuristic ranking", async () => {
  const plan = await begin(inputs, opts, async () => {
    throw new Error("DigitalOcean down");
  });
  assert.equal(plan.source, "fallback");
  assert.equal(plan.provider, "rule");
  assert.equal(plan.ranking.length, 3);
  assert.equal(plan.ranking[0].taskId, plan.nextTaskId);
  assert.match(plan.error ?? "", /DigitalOcean down/);
});
