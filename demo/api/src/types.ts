// Shared types for Hugjuulai: people, classes and the tags every module's AI
// results carry. Module documents live in modules/<module>/db/definitions/.
// Framework-free, like ai/ and the modules' ai/ folders, so they copy into the
// erxes plugin unchanged.

import type { ProblemCategory } from "./modules/problemhunt/db/definitions/problemhunt.ts";

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
