// Tiny JSON-file store for the demo. In the erxes plugin these collections
// become tenant-scoped Mongoose models (see docs/ERXES_INTEGRATION.md).

import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";
import { buildSeed, SEED_VERSION, type Db } from "./seed.ts";
import type { BeginPlan, Progress, Task, User } from "./types.ts";

const DB_PATH = process.env.DB_PATH ?? fileURLToPath(new URL("../data/db.json", import.meta.url));

let db: Db | undefined;

const load = (): Db => {
  if (db) return db;
  const stored = existsSync(DB_PATH) ? (JSON.parse(readFileSync(DB_PATH, "utf8")) as Partial<Db>) : undefined;
  if (stored && stored.version === SEED_VERSION) {
    db = stored as Db;
  } else {
    db = buildSeed();
    save();
  }
  return db;
};

export const save = (): void => {
  if (!db) return;
  mkdirSync(dirname(DB_PATH), { recursive: true });
  const tmp = `${DB_PATH}.tmp`;
  writeFileSync(tmp, JSON.stringify(db, null, 2));
  renameSync(tmp, DB_PATH);
};

export const resetDb = (): void => {
  db = buildSeed();
  save();
};

export const newId = (prefix: string): string => `${prefix}-${randomUUID().slice(0, 8)}`;
export const getDb = (): Db => load();

export const findUser = (userId: string): User => {
  const user = load().users.find((u) => u._id === userId);
  if (!user) throw new Error(`Unknown user: ${userId}`);
  return user;
};

export const findTask = (taskId: string): Task => {
  const task = load().tasks.find((t) => t._id === taskId);
  if (!task) throw new Error(`Unknown task: ${taskId}`);
  return task;
};

/** A student's TaskMind inbox: every task their teachers gave their class. */
export const tasksForStudent = (user: User): Task[] =>
  load().tasks.filter((t) => user.role === "student" && t.classId === user.classId);

export const tasksByTeacher = (teacherId: string): Task[] => load().tasks.filter((t) => t.createdBy === teacherId);

export const findProgress = (taskId: string, userId: string): Progress | undefined =>
  load().progress.find((p) => p.taskId === taskId && p.userId === userId);

export const getOrCreateProgress = (taskId: string, userId: string): Progress => {
  const existing = findProgress(taskId, userId);
  if (existing) return existing;
  const created: Progress = {
    _id: newId("pr"),
    taskId,
    userId,
    status: "todo",
    difficulty: 3,
    stepsDone: [],
    chat: [],
    updatedAt: new Date().toISOString(),
  };
  load().progress.push(created);
  return created;
};

export const latestPlan = (userId: string): BeginPlan | undefined => load().plans.find((p) => p.userId === userId);

export const savePlan = (plan: BeginPlan): void => {
  const d = load();
  d.plans = [plan, ...d.plans.filter((p) => p.userId !== plan.userId)];
  save();
};
