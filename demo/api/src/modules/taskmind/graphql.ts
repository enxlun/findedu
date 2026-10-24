// TaskMind AI GraphQL API, written the erxes way: a typeDefs string plus a
// resolvers map, merged with the other modules in graphql/schema.ts. Types are
// prefixed `Hugjuulai` and root fields `hugjuulai`, as the erxes supergraph
// requires. In the demo the caller passes `userId`; inside erxes it comes from
// `context.user`.
//
// Flow: teacher → exam / homework → TaskMind inbox → Begin → student does it.
// Begin and the AI-sorted Inbox run on Gemma 4 via DigitalOcean serverless inference.

import { findUser, getDb, newId, save } from "../../store.ts";
import type { Lang, User } from "../../types.ts";
import { analyzeDeps, begin } from "./ai/begin.ts";
import { askHint, generateGuide } from "./ai/guide.ts";
import type { BeginInput, BeginPlan, Task, TaskStatus, TaskType } from "./db/definitions/taskmind.ts";
import {
  findProgress,
  findTask,
  getOrCreateProgress,
  latestPlan,
  savePlan,
  tasksByTeacher,
  tasksForStudent,
} from "./db/models/Tasks.ts";

export const taskmindTypeDefs = /* GraphQL */ `
  type HugjuulaiTask {
    _id: String!
    type: String!
    title: String!
    description: String
    subject: String
    dueDate: String!
    estimatedMinutes: Int!
    weight: Int!
    dependsOn: [String!]!
    createdBy: String
    createdByName: String
    classId: String
    createdAt: String
  }

  type HugjuulaiGuideStep {
    title: String!
    detail: String!
    minutes: Int!
  }

  type HugjuulaiGuide {
    overview: String!
    steps: [HugjuulaiGuideStep!]!
    tips: [String!]!
    checkUnderstanding: [String!]!
    source: String!
    model: String
    lang: String
    createdAt: String
    error: String
  }

  type HugjuulaiChatTurn {
    q: String!
    a: String!
    at: String!
    source: String!
    error: String
  }

  type HugjuulaiInboxItem {
    task: HugjuulaiTask!
    status: String!
    difficulty: Int!
    seen: Boolean!
    stepsDone: [Int!]!
    chat: [HugjuulaiChatTurn!]!
    guide: HugjuulaiGuide
    blockedBy: [String!]!
    unlocks: [String!]!
    overdue: Boolean!
  }

  type HugjuulaiQueueItem {
    taskId: String!
    title: String!
    reason: String!
  }

  type HugjuulaiRankItem {
    taskId: String!
    title: String!
    score: Int!
    reason: String!
  }

  type HugjuulaiBlockedItem {
    taskId: String!
    title: String!
    waitingFor: [String!]!
    waitingForTitles: [String!]!
  }

  type HugjuulaiBegin {
    nextTaskId: String
    nextTitle: String
    reason: String!
    firstStep: String!
    queue: [HugjuulaiQueueItem!]!
    blocked: [HugjuulaiBlockedItem!]!
    ranking: [HugjuulaiRankItem!]!
    summary: String!
    source: String!
    provider: String
    model: String
    error: String
    lang: String
    createdAt: String
  }

  type HugjuulaiInbox {
    items: [HugjuulaiInboxItem!]!
    unread: Int!
    begin: HugjuulaiBegin
  }

  type HugjuulaiStudentProgress {
    userId: String!
    name: String!
    status: String!
    difficulty: Int!
    helpRequests: Int!
    blocked: Boolean!
  }

  type HugjuulaiClassProgress {
    task: HugjuulaiTask!
    className: String
    total: Int!
    done: Int!
    inProgress: Int!
    todo: Int!
    avgDifficulty: Float
    helpRequests: Int!
    students: [HugjuulaiStudentProgress!]!
  }

  input HugjuulaiTaskInput {
    type: String!
    title: String!
    description: String
    subject: String
    dueDate: String!
    estimatedMinutes: Int
    weight: Int
    classId: String
    dependsOn: [String!]
  }

  extend type Query {
    hugjuulaiInbox(userId: String!): HugjuulaiInbox!
    hugjuulaiClassProgress(teacherId: String!): [HugjuulaiClassProgress!]!
  }

  extend type Mutation {
    hugjuulaiTaskAdd(userId: String!, doc: HugjuulaiTaskInput!): HugjuulaiTask!
    hugjuulaiTaskRemove(userId: String!, taskId: String!): Boolean!
    hugjuulaiProgressUpdate(
      userId: String!
      taskId: String!
      status: String
      difficulty: Int
      stepsDone: [Int!]
      seen: Boolean
    ): HugjuulaiInboxItem!
    hugjuulaiBegin(userId: String!, lang: String): HugjuulaiBegin!
    hugjuulaiTaskGuide(userId: String!, taskId: String!, lang: String, regenerate: Boolean): HugjuulaiGuide!
    hugjuulaiTaskAsk(userId: String!, taskId: String!, question: String!, lang: String): HugjuulaiChatTurn!
  }
`;

// ------------------------------------------------------------------ helpers

type Args = Record<string, unknown>;
const toLang = (lang?: unknown): Lang => (lang === "en" ? "en" : "mn");
const STATUSES: TaskStatus[] = ["todo", "in_progress", "done"];
const TYPES: TaskType[] = ["homework", "exam"];

const taskOut = (task: Task) => ({
  ...task,
  createdByName: getDb().users.find((u) => u._id === task.createdBy)?.name ?? null,
});

const inputsFor = (user: User): BeginInput[] =>
  tasksForStudent(user).map((task) => {
    const p = findProgress(task._id, user._id);
    return { task, status: p?.status ?? "todo", difficulty: p?.difficulty ?? 3 };
  });

const inboxItem = (task: Task, user: User, deps = analyzeDeps(inputsFor(user))) => {
  const p = findProgress(task._id, user._id);
  const status = p?.status ?? "todo";
  const d = deps.get(task._id);
  return {
    task: taskOut(task),
    status,
    difficulty: p?.difficulty ?? 3,
    seen: Boolean(p?.seenAt),
    stepsDone: p?.stepsDone ?? [],
    chat: p?.chat ?? [],
    guide: p?.guide ?? null,
    blockedBy: status === "done" ? [] : (d?.blockedBy ?? []),
    unlocks: d?.unlocks ?? [],
    overdue: status !== "done" && new Date(task.dueDate).getTime() < Date.now(),
  };
};

const beginOut = (plan: BeginPlan) => {
  const title = (id: string) => getDb().tasks.find((t) => t._id === id)?.title ?? "";
  return {
    ...plan,
    nextTitle: plan.nextTaskId ? title(plan.nextTaskId) : null,
    queue: plan.queue.map((q) => ({ ...q, title: title(q.taskId) })).filter((q) => q.title),
    blocked: plan.blocked.map((b) => ({ ...b, title: title(b.taskId), waitingForTitles: b.waitingFor.map(title) })).filter((b) => b.title),
    ranking: (plan.ranking ?? []).map((r) => ({ ...r, title: title(r.taskId) })).filter((r) => r.title),
    provider: plan.provider ?? (plan.source === "ai" ? "gemini" : "rule"),
    error: plan.error ?? null,
  };
};

const requireStudent = (user: User): void => {
  if (user.role !== "student") throw new Error("Only students have a TaskMind inbox");
};
const assertStudentTask = (user: User, task: Task): void => {
  requireStudent(user);
  if (task.classId !== user.classId) throw new Error("This task is not for your class");
};
const due = (t: Task) => new Date(t.dueDate).getTime();

// ------------------------------------------------------------------ resolvers

export const taskmindResolvers = {
  Query: {
    hugjuulaiInbox: (_: unknown, { userId }: Args) => {
      const user = findUser(String(userId));
      requireStudent(user);
      const deps = analyzeDeps(inputsFor(user));
      const items = tasksForStudent(user)
        .map((t) => inboxItem(t, user, deps))
        .sort((a, b) => Number(a.status === "done") - Number(b.status === "done") || due(a.task) - due(b.task));
      const plan = latestPlan(user._id);
      return { items, unread: items.filter((i) => !i.seen).length, begin: plan ? beginOut(plan) : null };
    },

    hugjuulaiClassProgress: (_: unknown, { teacherId }: Args) => {
      const teacher = findUser(String(teacherId));
      if (teacher.role !== "teacher") throw new Error("Only teachers can view class progress");
      const { users, classes } = getDb();
      return tasksByTeacher(teacher._id)
        .sort((a, b) => due(a) - due(b))
        .map((task) => {
          const students = users.filter((u) => u.role === "student" && u.classId === task.classId);
          const rows = students.map((s) => {
            const p = findProgress(task._id, s._id);
            const blocked = task.dependsOn.some((d) => findProgress(d, s._id)?.status !== "done");
            return {
              userId: s._id,
              name: s.name,
              status: p?.status ?? "todo",
              difficulty: p?.difficulty ?? 3,
              helpRequests: p?.chat.length ?? 0,
              blocked: (p?.status ?? "todo") !== "done" && blocked,
            };
          });
          const rated = students.map((s) => findProgress(task._id, s._id)).filter((p) => p !== undefined);
          return {
            task: taskOut(task),
            className: classes.find((c) => c._id === task.classId)?.name ?? null,
            total: rows.length,
            done: rows.filter((r) => r.status === "done").length,
            inProgress: rows.filter((r) => r.status === "in_progress").length,
            todo: rows.filter((r) => r.status === "todo").length,
            avgDifficulty: rated.length ? Math.round((rated.reduce((s, p) => s + p.difficulty, 0) / rated.length) * 10) / 10 : null,
            helpRequests: rows.reduce((s, r) => s + r.helpRequests, 0),
            students: rows,
          };
        });
    },
  },

  Mutation: {
    /** Only teachers create exams and homework. */
    hugjuulaiTaskAdd: (_: unknown, { userId, doc }: Args) => {
      const user = findUser(String(userId));
      if (user.role !== "teacher") throw new Error("Only teachers can add exams or homework");
      const input = (doc ?? {}) as Record<string, unknown>;
      const type = TYPES.includes(input.type as TaskType) ? (input.type as TaskType) : "homework";
      const title = String(input.title ?? "").trim();
      if (!title) throw new Error("Title is required");
      const dueDate = new Date(String(input.dueDate ?? ""));
      if (Number.isNaN(dueDate.getTime())) throw new Error("A valid due date is required");
      const classId = String(input.classId ?? user.classId ?? "");
      const minutes = Number(input.estimatedMinutes ?? (type === "exam" ? 45 : 30));
      const weight = Number(input.weight ?? (type === "exam" ? 5 : 3));
      const deps = Array.isArray(input.dependsOn) ? input.dependsOn.map(String) : [];
      const valid = new Set(getDb().tasks.filter((t) => t.classId === classId).map((t) => t._id));

      const task: Task = {
        _id: newId(type === "exam" ? "x" : "h"),
        type,
        title: title.slice(0, 200),
        description: String(input.description ?? "").slice(0, 2000),
        subject: String(input.subject ?? user.subject ?? "").slice(0, 60),
        dueDate: dueDate.toISOString(),
        estimatedMinutes: Math.min(600, Math.max(5, Number.isFinite(minutes) ? minutes : 30)),
        weight: Math.min(5, Math.max(1, Number.isFinite(weight) ? Math.round(weight) : 3)),
        dependsOn: [...new Set(deps.filter((d) => valid.has(d)))],
        createdBy: user._id,
        classId,
        createdAt: new Date().toISOString(),
      };
      getDb().tasks.push(task);
      save();
      return taskOut(task);
    },

    hugjuulaiTaskRemove: (_: unknown, { userId, taskId }: Args) => {
      const user = findUser(String(userId));
      const task = findTask(String(taskId));
      if (task.createdBy !== user._id) throw new Error("Only the teacher who created it can delete it");
      const db = getDb();
      db.tasks = db.tasks.filter((t) => t._id !== task._id);
      db.tasks.forEach((t) => {
        t.dependsOn = t.dependsOn.filter((d) => d !== task._id);
      });
      db.progress = db.progress.filter((p) => p.taskId !== task._id);
      save();
      return true;
    },

    hugjuulaiProgressUpdate: (_: unknown, args: Args) => {
      const user = findUser(String(args.userId));
      const task = findTask(String(args.taskId));
      assertStudentTask(user, task);
      const p = getOrCreateProgress(task._id, user._id);
      if (typeof args.status === "string") {
        if (!STATUSES.includes(args.status as TaskStatus)) throw new Error("Invalid status");
        p.status = args.status as TaskStatus;
        p.completedAt = p.status === "done" ? new Date().toISOString() : undefined;
      }
      if (typeof args.difficulty === "number") p.difficulty = Math.min(5, Math.max(1, Math.round(args.difficulty)));
      if (Array.isArray(args.stepsDone)) {
        p.stepsDone = [...new Set(args.stepsDone.map(Number))].filter(Number.isInteger);
        if (p.status === "todo" && p.stepsDone.length > 0) p.status = "in_progress";
      }
      if (args.seen === true && !p.seenAt) p.seenAt = new Date().toISOString();
      p.updatedAt = new Date().toISOString();
      save();
      return inboxItem(task, user);
    },

    /** Begin: pick the next task from deadlines, importance and dependencies. */
    hugjuulaiBegin: async (_: unknown, args: Args) => {
      const user = findUser(String(args.userId));
      requireStudent(user);
      const result = await begin(inputsFor(user), { lang: toLang(args.lang) });
      const plan: BeginPlan = { ...result, userId: user._id, createdAt: new Date().toISOString() };
      savePlan(plan);
      return beginOut(plan);
    },

    hugjuulaiTaskGuide: async (_: unknown, args: Args) => {
      const user = findUser(String(args.userId));
      const task = findTask(String(args.taskId));
      assertStudentTask(user, task);
      const lang = toLang(args.lang);
      const p = getOrCreateProgress(task._id, user._id);
      if (!p.seenAt) p.seenAt = new Date().toISOString();
      const cached = p.guide;
      if (cached && !args.regenerate && cached.lang === lang && cached.source === "ai") return { ...cached, error: null };
      const { error, ...guide } = await generateGuide(task, user.role, lang);
      p.guide = guide;
      p.stepsDone = [];
      p.updatedAt = new Date().toISOString();
      save();
      return { ...guide, error: error ?? null };
    },

    hugjuulaiTaskAsk: async (_: unknown, args: Args) => {
      const user = findUser(String(args.userId));
      const task = findTask(String(args.taskId));
      assertStudentTask(user, task);
      const question = String(args.question ?? "").trim().slice(0, 500);
      if (!question) throw new Error("Question is empty");
      const p = getOrCreateProgress(task._id, user._id);
      const { error, ...turn } = await askHint(task, user.role, toLang(args.lang), question, p.guide, p.chat);
      p.chat.push(turn);
      p.updatedAt = new Date().toISOString();
      save();
      return { ...turn, error: error ?? null };
    },
  },
};
