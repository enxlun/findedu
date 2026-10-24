// Begin — TaskMind AI's "what should I do next?" engine.
// Gemma 4 (on DigitalOcean serverless inference by default) weighs deadlines,
// importance and dependencies, picks the next task, explains why, gives a concrete
// first step, and scores every open task for the AI-sorted Inbox. A
// dependency-aware heuristic is the fallback and also validates the model
// (it may never pick a blocked task, and a task never outranks its prerequisites).

import { asArray, asNumber, asString, clamp, extractJson } from "../../../ai/json.ts";
import { priorityChat, runChat, type ChatFn, type ChatMessage } from "../../../ai/llm.ts";
import type { Lang } from "../../../types.ts";
import type { BeginInput, BeginPlan, BlockedItem, QueueItem, RankItem } from "../db/definitions/taskmind.ts";

export type BeginResult = Omit<BeginPlan, "userId" | "createdAt">;

export interface BeginOptions {
  lang: Lang;
  now?: Date;
}

const HOUR = 3600 * 1000;
const hoursLeft = (iso: string, now: Date): number => (new Date(iso).getTime() - now.getTime()) / HOUR;

// ---------------------------------------------------------------- dependency analysis

export interface DepInfo {
  blockedBy: string[]; // unfinished prerequisites
  unlocks: string[]; // open tasks that depend on this one
  effectiveHours: number; // own deadline, pulled earlier by dependents' deadlines
}

/** Work out which tasks are blocked, what each unlocks, and inherited deadlines. */
export const analyzeDeps = (inputs: BeginInput[], now: Date = new Date()): Map<string, DepInfo> => {
  const byId = new Map(inputs.map((i) => [i.task._id, i]));
  const done = (id: string) => byId.get(id)?.status === "done";
  const info = new Map<string, DepInfo>();
  for (const i of inputs) {
    info.set(i.task._id, {
      blockedBy: i.task.dependsOn.filter((d) => byId.has(d) && !done(d)),
      unlocks: [],
      effectiveHours: hoursLeft(i.task.dueDate, now),
    });
  }
  for (const i of inputs) {
    if (i.status === "done") continue;
    for (const dep of i.task.dependsOn) info.get(dep)?.unlocks.push(i.task._id);
  }
  // A prerequisite must be finished early enough to leave time for what it unlocks.
  for (let pass = 0; pass < 4; pass++) {
    for (const i of inputs) {
      const me = info.get(i.task._id)!;
      for (const d of me.unlocks) {
        const dep = byId.get(d)!;
        const need = info.get(d)!.effectiveHours - dep.task.estimatedMinutes / 60;
        if (need < me.effectiveHours) me.effectiveHours = need;
      }
    }
  }
  return info;
};

const urgency = (h: number): number => {
  if (h < 0) return 100;
  if (h < 24) return 92;
  if (h < 48) return 72;
  if (h < 72) return 56;
  if (h < 168) return 36;
  return 16;
};

export const beginScore = (i: BeginInput, d: DepInfo): number => {
  const importance = (i.task.type === "exam" ? Math.max(i.task.weight, 4) : i.task.weight) * 20;
  const unlockBonus = Math.min(3, d.unlocks.length) * 33;
  const momentum = i.status === "in_progress" ? 6 : 0;
  return Math.round(
    clamp(0.55 * urgency(d.effectiveHours) + 0.22 * importance + 0.1 * clamp(i.difficulty || 3, 1, 5) * 20 + 0.13 * unlockBonus + momentum, 0, 100),
  );
};

// ---------------------------------------------------------------- heuristic

const titleOf = (inputs: BeginInput[], id: string) => inputs.find((i) => i.task._id === id)?.task.title ?? "";

export const heuristicReason = (i: BeginInput, d: DepInfo, inputs: BeginInput[], lang: Lang, now: Date): string => {
  const mn = lang === "mn";
  const h = hoursLeft(i.task.dueDate, now);
  const parts: string[] = [];
  if (h < 0) parts.push(mn ? "хугацаа хэтэрсэн тул эхэлж дуусга" : "it's overdue, so finish it first");
  else if (h < 24) parts.push(mn ? "24 цаг хүрэхгүй хугацаа үлдсэн" : "due in less than 24 hours");
  if (d.unlocks.length) {
    const t = titleOf(inputs, d.unlocks[0]);
    parts.push(mn ? `«${t}»-ийн өмнө хийх ёстой` : `you need it before “${t}”`);
  }
  if (i.task.type === "exam") parts.push(mn ? "шалгалт тул ач холбогдол өндөр" : "it's an exam, so it matters a lot");
  else if (i.task.weight >= 4) parts.push(mn ? "дүнд их нөлөөтэй" : "it counts a lot toward your grade");
  if (i.difficulty >= 4) parts.push(mn ? "хэцүү тул эрт эхэл" : "it's hard, so start early");
  if (i.status === "in_progress") parts.push(mn ? "аль хэдийн эхэлсэн" : "you've already started");
  if (!parts.length) parts.push(mn ? `${Math.max(1, Math.round(h / 24))} хоногийн дараа дуусна` : `due in ${Math.max(1, Math.round(h / 24))} days`);
  const s = parts.join(", ");
  return s.charAt(0).toUpperCase() + s.slice(1);
};

const heuristicFirstStep = (i: BeginInput, lang: Lang): string => {
  const mn = lang === "mn";
  if (i.task.type === "exam") {
    return mn
      ? "Шалгалтын сэдвүүдийг жагсааж, хамгийн сул 2 сэдвээ тэмдэглэ (10 мин)."
      : "List the exam topics and mark your two weakest ones (10 min).";
  }
  return mn
    ? "Даалгаврыг уншаад юу хүлээлгэж өгөхийг нэг өгүүлбэрт бич (5 мин)."
    : "Read the task and write in one sentence what you must hand in (5 min).";
};

/**
 * Final priority order: a task never outranks its unfinished prerequisites, and the
 * Begin pick is on top. Ties go to the earlier (inherited) deadline.
 */
export const orderRanking = (items: RankItem[], deps: Map<string, DepInfo>, nextId: string | null): RankItem[] => {
  const byId = new Map(items.map((r) => [r.taskId, { ...r, score: Math.round(clamp(r.score, 0, 100)) }]));
  for (let pass = 0; pass < 4; pass++) {
    for (const r of byId.values()) {
      for (const pre of deps.get(r.taskId)?.blockedBy ?? []) {
        const p = byId.get(pre);
        if (p && r.score >= p.score) r.score = Math.max(0, p.score - 1);
      }
    }
  }
  const next = nextId ? byId.get(nextId) : undefined;
  if (next) next.score = Math.max(next.score, ...[...byId.values()].map((r) => r.score));
  const eff = (id: string) => deps.get(id)?.effectiveHours ?? 0;
  return [...byId.values()].sort(
    (a, b) => b.score - a.score || Number(b.taskId === nextId) - Number(a.taskId === nextId) || eff(a.taskId) - eff(b.taskId),
  );
};

const heuristicRanking = (inputs: BeginInput[], deps: Map<string, DepInfo>, lang: Lang, now: Date): RankItem[] =>
  inputs
    .filter((i) => i.status !== "done")
    .map((i) => {
      const d = deps.get(i.task._id)!;
      const blocked = d.blockedBy.length > 0;
      return {
        taskId: i.task._id,
        score: beginScore(i, d),
        reason: blocked
          ? lang === "mn"
            ? `Эхлээд: ${d.blockedBy.map((x) => `«${titleOf(inputs, x)}»`).join(", ")}`
            : `First: ${d.blockedBy.map((x) => `“${titleOf(inputs, x)}”`).join(", ")}`
          : heuristicReason(i, d, inputs, lang, now),
      };
    });

export const heuristicBegin = (inputs: BeginInput[], opts: BeginOptions): BeginResult => {
  const now = opts.now ?? new Date();
  const deps = analyzeDeps(inputs, now);
  const open = inputs.filter((i) => i.status !== "done");
  const ready = open
    .filter((i) => deps.get(i.task._id)!.blockedBy.length === 0)
    .map((i) => ({ i, score: beginScore(i, deps.get(i.task._id)!) }))
    .sort((a, b) => b.score - a.score || new Date(a.i.task.dueDate).getTime() - new Date(b.i.task.dueDate).getTime());
  const blocked: BlockedItem[] = open
    .filter((i) => deps.get(i.task._id)!.blockedBy.length > 0)
    .map((i) => ({ taskId: i.task._id, waitingFor: deps.get(i.task._id)!.blockedBy }));

  const next = ready[0]?.i;
  const mn = opts.lang === "mn";
  const queue: QueueItem[] = ready.slice(1, 4).map(({ i }) => ({
    taskId: i.task._id,
    reason: heuristicReason(i, deps.get(i.task._id)!, inputs, opts.lang, now),
  }));
  return {
    nextTaskId: next?.task._id ?? null,
    reason: next ? heuristicReason(next, deps.get(next.task._id)!, inputs, opts.lang, now) : "",
    firstStep: next ? heuristicFirstStep(next, opts.lang) : "",
    queue,
    blocked,
    ranking: orderRanking(heuristicRanking(inputs, deps, opts.lang, now), deps, next?.task._id ?? null),
    summary: next
      ? mn
        ? `Одоо «${next.task.title}»-г эхлүүл.${queue.length ? ` Дараа нь: ${queue.map((q) => `«${titleOf(inputs, q.taskId)}»`).join(", ")}.` : ""}`
        : `Start “${next.task.title}” now.${queue.length ? ` Then: ${queue.map((q) => `“${titleOf(inputs, q.taskId)}”`).join(", ")}.` : ""}`
      : mn
        ? "Бүх даалгавар дууссан. Сайн байна!"
        : "Everything is done. Nice work!",
    source: "fallback",
    provider: "rule",
    model: "rule-based",
    lang: opts.lang,
  };
};

// ---------------------------------------------------------------- Gemma 4

export const buildBeginMessages = (
  inputs: BeginInput[],
  opts: BeginOptions,
): { messages: ChatMessage[]; idMap: Map<string, string> } => {
  const now = opts.now ?? new Date();
  const deps = analyzeDeps(inputs, now);
  const open = inputs.filter((i) => i.status !== "done");
  const shortId = new Map<string, string>();
  open.forEach((i, idx) => shortId.set(i.task._id, `T${idx + 1}`));
  const idMap = new Map([...shortId].map(([k, v]) => [v, k]));
  const sid = (id: string) => shortId.get(id);

  const tasks = open.map((i) => {
    const d = deps.get(i.task._id)!;
    return {
      id: sid(i.task._id),
      type: i.task.type,
      title: i.task.title,
      subject: i.task.subject,
      description: i.task.description.slice(0, 200),
      hoursLeft: Math.round(hoursLeft(i.task.dueDate, now)),
      estimatedMinutes: i.task.estimatedMinutes,
      weight: i.task.weight,
      difficulty: i.difficulty,
      status: i.status,
      dependsOn: i.task.dependsOn.map((x) => sid(x) ?? "done"),
      blocked: d.blockedBy.length > 0,
      unlocks: d.unlocks.map((x) => sid(x)).filter(Boolean),
    };
  });

  const system = [
    'You are "Begin", the planning engine of TaskMind AI, a school system built on erxes.',
    "A high-school student must decide which teacher-given task (homework or exam) to work on next.",
    "Rules:",
    "- A task with blocked=true still has unfinished prerequisites. NEVER choose it as next.",
    "- Prerequisites of urgent or important tasks inherit that urgency (look at unlocks).",
    "- Prefer overdue or soon-due work, exams and high weight (1-5), tasks that unlock others, and tasks already in progress.",
    "- Hard tasks (difficulty 4-5) should be started early.",
    `Write all text in ${opts.lang === "mn" ? "Mongolian (Cyrillic script)" : "English"}. Speak to the student as "you", warm and concrete.`,
    "Return ONLY JSON:",
    '{"next":{"id":"T1","reason":"<why this one now, max 25 words>","firstStep":"<one concrete 5-10 minute first action>"},',
    ' "queue":[{"id":"T2","reason":"<max 15 words>"}],',
    ' "ranking":[{"id":"T1","score":95,"why":"<max 12 words>"}],',
    ' "summary":"<one sentence plan>"}',
    '"queue" holds up to 3 other unblocked tasks in the order to do them.',
    '"ranking" scores EVERY task (blocked ones too) from 0 to 100: how important it is to work on it now. A blocked task scores lower than its prerequisites.',
  ].join("\n");

  return {
    messages: [
      { role: "system", content: system },
      { role: "user", content: JSON.stringify({ now: now.toISOString(), tasks }) },
    ],
    idMap,
  };
};

export const mergeBegin = (
  raw: unknown,
  idMap: Map<string, string>,
  inputs: BeginInput[],
  opts: BeginOptions,
  model: string,
  provider = "ai",
): BeginResult => {
  const fallback = heuristicBegin(inputs, opts);
  const deps = analyzeDeps(inputs, opts.now ?? new Date());
  const ready = new Set(
    inputs.filter((i) => i.status !== "done" && deps.get(i.task._id)!.blockedBy.length === 0).map((i) => i.task._id),
  );
  const resolve = (v: unknown): string | undefined => {
    const s = asString(v, 40);
    const id = idMap.get(s) ?? idMap.get(s.toUpperCase()) ?? s;
    return ready.has(id) ? id : undefined;
  };
  const obj = (raw ?? {}) as Record<string, unknown>;
  const nextObj = (obj.next ?? {}) as Record<string, unknown>;
  const nextId = resolve(nextObj.id);
  if (!nextId) throw new Error("AI picked no valid (unblocked) next task");

  const seen = new Set([nextId]);
  const queue: QueueItem[] = [];
  for (const q of asArray(obj.queue)) {
    const e = (q ?? {}) as Record<string, unknown>;
    const id = resolve(e.id);
    if (!id || seen.has(id) || queue.length >= 3) continue;
    seen.add(id);
    queue.push({ taskId: id, reason: asString(e.reason, 200) || fallback.queue.find((x) => x.taskId === id)?.reason || "" });
  }
  for (const q of fallback.queue) {
    if (queue.length >= 3) break;
    if (!seen.has(q.taskId)) {
      seen.add(q.taskId);
      queue.push(q);
    }
  }
  if (fallback.nextTaskId && !seen.has(fallback.nextTaskId) && queue.length < 3) {
    queue.push({ taskId: fallback.nextTaskId, reason: fallback.reason });
  }

  // AI scores for every open task; anything it skipped keeps the heuristic score.
  const open = new Set(fallback.ranking.map((r) => r.taskId));
  const aiRank = new Map<string, RankItem>();
  for (const r of asArray(obj.ranking)) {
    const e = (r ?? {}) as Record<string, unknown>;
    const s = asString(e.id, 40);
    const id = idMap.get(s) ?? idMap.get(s.toUpperCase()) ?? s;
    if (!open.has(id) || aiRank.has(id)) continue;
    const score = asNumber(e.score, NaN);
    if (!Number.isFinite(score)) continue;
    aiRank.set(id, { taskId: id, score, reason: asString(e.why ?? e.reason, 200) || fallback.ranking.find((x) => x.taskId === id)!.reason });
  }
  const ranking = orderRanking(fallback.ranking.map((r) => aiRank.get(r.taskId) ?? r), deps, nextId);

  return {
    nextTaskId: nextId,
    reason: asString(nextObj.reason, 300) || fallback.reason,
    firstStep: asString(nextObj.firstStep, 300) || fallback.firstStep,
    queue,
    blocked: fallback.blocked,
    ranking,
    summary: asString(obj.summary, 300) || fallback.summary,
    source: "ai",
    provider,
    model,
    lang: opts.lang,
  };
};

export const begin = async (inputs: BeginInput[], opts: BeginOptions, chatFn: ChatFn = priorityChat): Promise<BeginResult> => {
  const open = inputs.filter((i) => i.status !== "done");
  if (open.length === 0) return heuristicBegin(inputs, opts);
  try {
    const { messages, idMap } = buildBeginMessages(inputs, opts);
    const c = await runChat(chatFn, messages, { json: true, temperature: 0.2, maxTokens: 2000 }, "priority");
    const plan = mergeBegin(extractJson(c.text), idMap, inputs, opts, c.model, c.provider);
    return c.fallbackFrom ? { ...plan, error: c.fallbackFrom } : plan;
  } catch (e) {
    return { ...heuristicBegin(inputs, opts), error: (e as Error).message };
  }
};
