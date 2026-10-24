// Checks the Gemini API (Gemma 4) request format against a local fake server.
import { test } from "node:test";
import assert from "node:assert/strict";
import { createServer, type IncomingMessage } from "node:http";
import type { AddressInfo } from "node:net";
import { chat, getLlmConfig } from "../server/ai/llm.ts";

const readJson = async (req: IncomingMessage) => {
  let body = "";
  for await (const c of req) body += c;
  return JSON.parse(body);
};

test("Gemini API: systemInstruction, thinking, image parts, JSON retry, thought parts skipped", async () => {
  const seen: Record<string, unknown>[] = [];
  const server = createServer(async (req, res) => {
    const body = await readJson(req);
    seen.push({ url: req.url, key: req.headers["x-goog-api-key"], body });
    // First call: pretend structured output is unsupported for this model.
    if (seen.length === 1) {
      res.writeHead(400, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: { message: "JSON mode (response_mime_type) is not enabled for this model" } }));
      return;
    }
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ candidates: [{ content: { parts: [{ text: "thinking…", thought: true }, { text: '{"ok":true}' }] } }] }));
  });
  await new Promise<void>((r) => server.listen(0, r));
  const port = (server.address() as AddressInfo).port;
  const cfg = { ...getLlmConfig(), provider: "gemini" as const, baseUrl: `http://127.0.0.1:${port}/v1beta`, apiKey: "k", model: "gemma-4-26b-a4b-it" };

  const out = await chat(
    [
      { role: "system", content: "SYS" },
      { role: "user", content: "hi", images: ["data:image/png;base64,QUJD"] },
    ],
    { json: true },
    cfg,
  );
  server.close();

  assert.equal(out, '{"ok":true}');
  assert.equal(seen.length, 2);
  const first = seen[0] as { url: string; key: string; body: any };
  const second = seen[1] as { body: any };
  assert.equal(first.url, "/v1beta/models/gemma-4-26b-a4b-it:generateContent");
  assert.equal(first.key, "k");
  assert.equal(first.body.systemInstruction.parts[0].text, "SYS");
  assert.deepEqual(first.body.contents[0].parts[0], { inlineData: { mimeType: "image/png", data: "QUJD" } });
  assert.equal(first.body.contents[0].parts[1].text, "hi");
  assert.equal(first.body.generationConfig.responseMimeType, "application/json");
  assert.equal(first.body.generationConfig.thinkingConfig.thinkingLevel, "minimal");
  assert.equal(second.body.generationConfig.responseMimeType, undefined); // retried without JSON mode
});

test("Gemini API without a key fails fast (features then use their fallback)", async () => {
  const cfg = { ...getLlmConfig(), provider: "gemini" as const, apiKey: "" };
  await assert.rejects(() => chat([{ role: "user", content: "x" }], {}, cfg), /AI_API_KEY/);
});

test("Gemini API: a generic 400 drops JSON mode, then thinking, then succeeds", async () => {
  const bodies: any[] = [];
  const server = createServer(async (req, res) => {
    const body = await readJson(req);
    bodies.push(body);
    const gc = body.generationConfig;
    if (gc.responseMimeType || gc.thinkingConfig) {
      res.writeHead(400, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: { message: "Request contains an invalid argument." } }));
      return;
    }
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ candidates: [{ content: { parts: [{ text: "ok" }] } }] }));
  });
  await new Promise<void>((r) => server.listen(0, r));
  const port = (server.address() as AddressInfo).port;
  const cfg = { ...getLlmConfig(), provider: "gemini" as const, baseUrl: `http://127.0.0.1:${port}/v1beta`, apiKey: "k", model: "gemma-test-model" };
  const out = await chat([{ role: "user", content: "x" }], { json: true }, cfg);
  const again = await chat([{ role: "user", content: "y" }], { json: true }, cfg);
  server.close();
  assert.equal(out, "ok");
  assert.equal(again, "ok");
  assert.equal(bodies.length, 4); // 3 tries the first time, then it remembers
});
