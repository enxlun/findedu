import { test } from "node:test";
import assert from "node:assert/strict";
import { extractJson } from "../src/ai/json.ts";
import { analyzeDeps, begin, buildBeginMessages, heuristicBegin, mergeBegin } from "../src/modules/taskmind/ai/begin.ts";
import { fallbackGuide, generateGuide, parseGuide } from "../src/modules/taskmind/ai/guide.ts";
import type { BeginInput, Task } from "../src/modules/taskmind/db/definitions/taskmind.ts";
import { classifyProblem, fallbackClassify, guessCategory, routeAudience, similarity } from "../src/modules/problemhunt/ai/problemhunt.ts";
import type { User } from "../src/types.ts";

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
const opts = { lang: "en" as const, now };

// lab (due 60h) → report (due 46h, depends on lab) → exam (due 100h, depends on report); essay due 30h
const inputs: BeginInput[] = [
  { task: task("lab", 60), status: "todo", difficulty: 3 },
  { task: task("report", 46, { dependsOn: ["lab"], estimatedMinutes: 60, weight: 4 }), status: "todo", difficulty: 4 },
  { task: task("exam", 100, { type: "exam", dependsOn: ["report"], weight: 5 }), status: "todo", difficulty: 3 },
  { task: task("essay", 30, { weight: 2 }), status: "todo", difficulty: 2 },
  { task: task("old", -10, { weight: 1 }), status: "done", difficulty: 2 },
];

test("extractJson handles fences, prose and trailing commas", () => {
  assert.deepEqual(extractJson('```json\n{"a":1}\n```'), { a: 1 });
  assert.deepEqual(extractJson('Sure: {"a":{"b":"}"},} ok'), { a: { b: "}" } });
  assert.throws(() => extractJson("no json"));
});

test("analyzeDeps: blocked tasks, unlocks and inherited deadlines", () => {
  const d = analyzeDeps(inputs, now);
  assert.deepEqual(d.get("report")!.blockedBy, ["lab"]);
  assert.deepEqual(d.get("exam")!.blockedBy, ["report"]);
  assert.deepEqual(d.get("lab")!.unlocks, ["report"]);
  // lab must finish an hour before the report is due (46h - 60min)
  assert.equal(Math.round(d.get("lab")!.effectiveHours), 45);
});

test("heuristic Begin never picks a blocked task and prefers what unlocks urgent work", () => {
  const plan = heuristicBegin(inputs, opts);
  assert.equal(plan.nextTaskId, "lab");
  assert.ok(!plan.queue.some((q) => q.taskId === "report" || q.taskId === "exam"));
  assert.deepEqual(plan.blocked.map((b) => b.taskId).sort(), ["exam", "report"]);
  assert.match(plan.reason, /Task report/);
});

test("mergeBegin rejects a blocked pick and maps short ids", () => {
  const { idMap } = buildBeginMessages(inputs, opts);
  const short = [...idMap].find(([, v]) => v === "report")![0];
  assert.throws(() => mergeBegin({ next: { id: short } }, idMap, inputs, opts, "m"));
  const essay = [...idMap].find(([, v]) => v === "essay")![0];
  const plan = mergeBegin({ next: { id: essay, reason: "r", firstStep: "f" }, queue: [{ id: short }] }, idMap, inputs, opts, "m");
  assert.equal(plan.nextTaskId, "essay");
  assert.equal(plan.source, "ai");
  assert.ok(plan.queue.some((q) => q.taskId === "lab")); // heuristic top is kept in the queue
  assert.ok(!plan.queue.some((q) => q.taskId === "report"));
});

test("begin falls back when the model fails or picks a blocked task", async () => {
  const a = await begin(inputs, opts, async () => {
    throw new Error("boom");
  });
  assert.equal(a.source, "fallback");
  assert.equal(a.error, "boom");
  const b = await begin(inputs, opts, async () => JSON.stringify({ next: { id: "T3" } })); // T3 = exam (blocked)
  assert.equal(b.source, "fallback");
});

test("guides: validation and exam-aware fallback", async () => {
  const t = task("g", 20, { estimatedMinutes: 40 });
  const g = parseGuide({ overview: "O", steps: [{ title: "S1", detail: "D", minutes: 500 }, { detail: "x" }], tips: ["x", 3] }, t, "en", "m");
  assert.equal(g.steps.length, 1);
  assert.equal(g.steps[0].minutes, 240);
  const fb = await generateGuide(t, "student", "mn", async () => "not json");
  assert.equal(fb.source, "fallback");
  assert.equal(fallbackGuide(task("e", 20, { type: "exam" }), "student", "en").steps[0].title, "List the topics");
});

const people: User[] = [
  { _id: "admin", name: "Admin", role: "admin" },
  { _id: "it", name: "IT", role: "staff", specialties: ["it"] },
  { _id: "fix", name: "Fixer", role: "staff", specialties: ["furniture", "other"] },
  { _id: "heat", name: "Heat", role: "staff", specialties: ["plumbing", "heating"] },
  { _id: "phys", name: "Physics", role: "teacher", rooms: ["305"] },
  { _id: "kid", name: "Kid", role: "student" },
];

test("ProblemHunt fallback: category, routing and grouping", () => {
  assert.equal(guessCategory("305 тоотын проектор асахгүй"), "it");
  assert.equal(guessCategory("Радиатор халахгүй, хүйтэн"), "heating");
  assert.deepEqual(routeAudience("it", "2-р байр · 305 тоот", people).sort(), ["admin", "it", "phys"]);
  assert.deepEqual(routeAudience("cleaning", "Гуанз", people).sort(), ["admin", "fix"]);
  assert.ok(similarity("Коридорын радиатор халахгүй", "1-р давхрын коридорын радиатор халахгүй байна") > 0.3);
  const c = fallbackClassify(
    { title: "Коридорын халаалт ажиллахгүй", description: "", location: "1-р байр · коридор", urgency: "medium" },
    [{ id: "g1", title: "1-р давхрын коридорын радиатор халахгүй байна", category: "heating", location: "1-р байр · 1 давхар · коридор", reports: 2 }],
    people,
    "en",
  );
  assert.equal(c.category, "heating");
  assert.equal(c.priority, "high");
  assert.equal(c.duplicateOf, "g1");
  assert.ok(c.audience.includes("heat") && c.audience.includes("admin"));
});

test("ProblemHunt AI output is validated: admins always included, unknown ids dropped", async () => {
  let sentImages = 0;
  const c = await classifyProblem(
    { title: "Проектор", description: "", location: "305 тоот", urgency: "low", photo: "data:image/jpeg;base64,AAAA" },
    [],
    people,
    "en",
    async (messages) => {
      sentImages = messages[1].images?.length ?? 0;
      return JSON.stringify({ category: "it", priority: "nonsense", audience: ["it", "ghost", "kid"], duplicateOf: "nope", reason: "r" });
    },
  );
  assert.equal(sentImages, 1); // the photo goes to Gemma 4 vision
  assert.equal(c.source, "ai");
  assert.equal(c.priority, "low"); // invalid -> fallback
  assert.deepEqual(c.audience.sort(), ["admin", "it"]);
  assert.equal(c.duplicateOf, null);
});
