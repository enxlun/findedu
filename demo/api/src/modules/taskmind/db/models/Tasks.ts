// TaskMind reads and writes on the JSON store: tasks, per-student progress and
// the latest Begin plan. In the erxes plugin these become model statics
// (loadXClass(models)) on the hugjuulai_tasks / _task_progress / _begin_plans models.

import { getDb, newId, save } from "../../../../store.ts";
import type { User } from "../../../../types.ts";
import type { BeginPlan, Progress, Task } from "../definitions/taskmind.ts";

export const findTask = (taskId: string): Task => {
  const task = getDb().tasks.find((t) => t._id === taskId);
  if (!task) throw new Error(`Unknown task: ${taskId}`);
  return task;
};

/** A student's TaskMind inbox: every task their teachers gave their class. */
export const tasksForStudent = (user: User): Task[] =>
  getDb().tasks.filter((t) => user.role === "student" && t.classId === user.classId);

export const tasksByTeacher = (teacherId: string): Task[] => getDb().tasks.filter((t) => t.createdBy === teacherId);

export const findProgress = (taskId: string, userId: string): Progress | undefined =>
  getDb().progress.find((p) => p.taskId === taskId && p.userId === userId);

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
  getDb().progress.push(created);
  return created;
};

export const latestPlan = (userId: string): BeginPlan | undefined => getDb().plans.find((p) => p.userId === userId);

export const savePlan = (plan: BeginPlan): void => {
  const d = getDb();
  d.plans = [plan, ...d.plans.filter((p) => p.userId !== plan.userId)];
  save();
};
