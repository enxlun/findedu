// TaskMind AI documents: teacher-given exams and homework, each student's
// progress on them, and the latest Begin result. In the erxes plugin these
// become the hugjuulai_tasks, hugjuulai_task_progress and hugjuulai_begin_plans
// Mongoose schemas (see docs/erxes-integration.md).

import type { AiSource, Lang } from "../../../../types.ts";

export type TaskType = "homework" | "exam";
export type TaskStatus = "todo" | "in_progress" | "done";

/** A learning task. Only teachers create these. */
export interface Task {
  _id: string;
  type: TaskType;
  title: string;
  description: string;
  subject: string;
  dueDate: string; // ISO
  estimatedMinutes: number;
  weight: number; // importance 1..5
  dependsOn: string[]; // tasks that should be finished first
  createdBy: string; // teacher id
  classId: string;
  createdAt: string;
}

export interface GuideStep {
  title: string;
  detail: string;
  minutes: number;
}

export interface Guide {
  overview: string;
  steps: GuideStep[];
  tips: string[];
  checkUnderstanding: string[];
  source: AiSource;
  model: string;
  lang: Lang;
  createdAt: string;
}

export interface ChatTurn {
  q: string;
  a: string;
  at: string;
  source: AiSource;
}

/** One student's progress on one task. */
export interface Progress {
  _id: string;
  taskId: string;
  userId: string;
  status: TaskStatus;
  difficulty: number; // self-rated 1..5
  seenAt?: string; // inbox read state
  stepsDone: number[];
  chat: ChatTurn[];
  guide?: Guide;
  updatedAt: string;
  completedAt?: string;
}

/** What Begin sees for one task. */
export interface BeginInput {
  task: Task;
  status: TaskStatus;
  difficulty: number;
}

export interface QueueItem {
  taskId: string;
  reason: string;
}

export interface BlockedItem {
  taskId: string;
  waitingFor: string[];
}

/** One task in the AI priority order (0–100, higher = do it sooner). */
export interface RankItem {
  taskId: string;
  score: number;
  reason: string;
}

/** Result of Begin: the next task to do, why, and what comes after. */
export interface BeginPlan {
  userId: string;
  nextTaskId: string | null;
  reason: string;
  firstStep: string;
  queue: QueueItem[];
  blocked: BlockedItem[];
  summary: string;
  /** Every open task with an AI priority score, highest first. */
  ranking: RankItem[];
  source: AiSource;
  /** "digitalocean" | "gemini" | "openai" | "rule" */
  provider: string;
  model: string;
  error?: string;
  lang: Lang;
  createdAt: string;
}
