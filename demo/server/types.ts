// Domain types for Hugjuulai: TaskMind AI (teacher-given exams and homework),
// ProblemHunt (school problem reports) and TeacherRate (students rate teachers).
// Framework-free so server/ai/* copies into the erxes plugin unchanged.

export type Role = "student" | "teacher" | "staff" | "admin";
export type Lang = "mn" | "en";
export type AiSource = "ai" | "fallback";

export interface User {
  _id: string;
  name: string;
  role: Role;
  subject?: string; // teachers
  classId?: string; // students: their class; teachers: homeroom class
  title?: string; // staff / admin job title
  specialties?: ProblemCategory[]; // staff: what they handle
  rooms?: string[]; // teachers: rooms they are responsible for (e.g. "305")
  courses?: string[]; // teachers: the classes they teach (shown on their TeacherRate page)
}

export interface ClassRoom {
  _id: string;
  name: string;
}

// ------------------------------------------------------------------ TaskMind

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

// ------------------------------------------------------------------ ProblemHunt

export type ProblemCategory =
  | "electric"
  | "plumbing"
  | "heating"
  | "furniture"
  | "it"
  | "cleaning"
  | "safety"
  | "other";
export type ProblemPriority = "low" | "medium" | "high" | "urgent";
export type ProblemStatus = "new" | "seen" | "resolved";

export interface ProblemEvent {
  at: string;
  by: string;
  action: "reported" | "grouped" | "status" | "note";
  status?: ProblemStatus;
  note?: string;
}

export interface Classification {
  category: ProblemCategory;
  priority: ProblemPriority;
  audience: string[]; // user ids who should see it
  duplicateOf: string | null; // group id of a similar existing report
  reason: string;
  source: AiSource;
  model: string;
}

/** A problem a student reported. Reports that describe the same thing share a groupId. */
export interface Problem {
  _id: string;
  number: number;
  title: string;
  description: string;
  location: string;
  category: ProblemCategory;
  priority: ProblemPriority;
  urgency: ProblemPriority; // what the student selected
  status: ProblemStatus;
  anonymous: boolean;
  photo?: string; // small data URL (demo)
  reportedBy: string;
  audience: string[];
  groupId: string;
  ai: { reason: string; source: AiSource; model: string; error?: string };
  history: ProblemEvent[];
  createdAt: string;
  updatedAt: string;
}

// ------------------------------------------------------------------ TeacherRate

export const TRAITS = ["attendance", "notes", "fairGrades", "gradesOnTime", "clear", "homework", "extraCredit", "teamwork", "fun"] as const;
export type TraitKey = (typeof TRAITS)[number];

/** Gemma 4's tone check of a review before it is posted. */
export interface ToneCheck {
  ok: boolean;
  issue: "none" | "insult" | "personal" | "threat" | "offtopic";
  note: string;
  suggestion: string;
  source: AiSource;
  model: string;
}

/** A student's anonymous review of a teacher. Only the administration sees the author. */
export interface Review {
  _id: string;
  teacherId: string;
  authorId: string;
  authorName: string; // snapshot for the administration
  subject: string; // which class it is about
  rating: number; // 1..5
  traits: Partial<Record<TraitKey, boolean>>; // yes / no answers
  text: string;
  likes: string[]; // user ids
  flagged: boolean; // posted although Gemma 4 suggested a calmer wording
  createdAt: string;
}

/** Gemma 4's summary of everything students said about one teacher. */
export interface TeacherSummary {
  teacherId: string;
  lang: Lang;
  hash: string; // which reviews it was made from
  overview: string;
  pros: string[];
  cons: string[];
  tips: string[];
  source: AiSource;
  provider: string;
  model: string;
  reviewCount: number;
  createdAt: string;
}
