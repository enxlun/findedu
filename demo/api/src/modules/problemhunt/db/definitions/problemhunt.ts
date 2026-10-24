// ProblemHunt documents: school problem reports, grouped when they describe the
// same thing. In the erxes plugin this becomes the hugjuulai_problems schema.

import type { AiSource } from "../../../../types.ts";

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
