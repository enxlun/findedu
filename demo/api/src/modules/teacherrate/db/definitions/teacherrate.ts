// TeacherRate documents: students' anonymous teacher reviews and Gemma 4's
// cached summary per teacher. In the erxes plugin these become the
// hugjuulai_teacher_reviews and hugjuulai_teacher_summaries schemas.

import type { AiSource, Lang } from "../../../../types.ts";

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
