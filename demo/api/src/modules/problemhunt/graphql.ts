// ProblemHunt GraphQL API: students report problems around the school, Gemma 4
// classifies and routes each report and groups duplicates, and the relevant
// teachers, staff and administration see it, mark it seen/resolved and reply.
// Reports never turn into tasks or projects.

import { findUser, getDb, newId, save } from "../../store.ts";
import type { Lang, User } from "../../types.ts";
import { CATEGORIES, classifyProblem, PRIORITIES, type GroupCandidate } from "./ai/problemhunt.ts";
import type { Problem, ProblemCategory, ProblemPriority, ProblemStatus } from "./db/definitions/problemhunt.ts";

export const problemhuntTypeDefs = /* GraphQL */ `
  type HugjuulaiPerson {
    _id: String!
    name: String!
    role: String!
    title: String
  }

  type HugjuulaiProblemEvent {
    at: String!
    by: String!
    byName: String
    byRole: String
    action: String!
    status: String
    note: String
  }

  type HugjuulaiProblemAi {
    reason: String!
    source: String!
    model: String
    error: String
  }

  type HugjuulaiProblem {
    _id: String!
    number: Int!
    title: String!
    description: String
    location: String!
    category: String!
    priority: String!
    urgency: String!
    status: String!
    anonymous: Boolean!
    photo: String
    reporterName: String
    mine: Boolean!
    groupId: String!
    groupSize: Int!
    audience: [HugjuulaiPerson!]!
    ai: HugjuulaiProblemAi!
    history: [HugjuulaiProblemEvent!]!
    createdAt: String!
    updatedAt: String!
  }

  type HugjuulaiReportResult {
    problem: HugjuulaiProblem!
    grouped: Boolean!
    groupNumber: Int
    groupSize: Int!
  }

  input HugjuulaiProblemInput {
    title: String!
    description: String
    location: String!
    urgency: String
    category: String
    anonymous: Boolean
    photo: String
  }

  extend type Query {
    hugjuulaiProblems(userId: String!): [HugjuulaiProblem!]!
  }

  extend type Mutation {
    hugjuulaiProblemReport(userId: String!, doc: HugjuulaiProblemInput!, lang: String): HugjuulaiReportResult!
    hugjuulaiProblemStatus(userId: String!, problemId: String!, status: String!, note: String): [HugjuulaiProblem!]!
    hugjuulaiProblemNote(userId: String!, problemId: String!, note: String!): [HugjuulaiProblem!]!
  }
`;

type Args = Record<string, unknown>;
const STATUSES: ProblemStatus[] = ["new", "seen", "resolved"];
const toLang = (v: unknown): Lang => (v === "en" ? "en" : "mn");

const findProblem = (id: string): Problem => {
  const p = getDb().problems.find((x) => x._id === id);
  if (!p) throw new Error(`Unknown report: ${id}`);
  return p;
};
const groupOf = (groupId: string): Problem[] => getDb().problems.filter((p) => p.groupId === groupId);

/** Students see their own reports; staff and teachers see what was routed to them; the administration sees everything. */
const canSee = (viewer: User, p: Problem): boolean =>
  viewer.role === "admin" || p.reportedBy === viewer._id || (viewer.role !== "student" && p.audience.includes(viewer._id));
const canAct = (viewer: User, p: Problem): boolean =>
  viewer.role === "admin" || (viewer.role !== "student" && p.audience.includes(viewer._id));

const person = (id: string) => {
  const u = getDb().users.find((x) => x._id === id);
  return u ? { _id: u._id, name: u.name, role: u.role, title: u.title ?? u.subject ?? null } : null;
};

const problemOut = (p: Problem, viewer: User) => {
  const showReporter = !p.anonymous || viewer.role === "admin" || viewer._id === p.reportedBy;
  return {
    ...p,
    reporterName: showReporter ? (person(p.reportedBy)?.name ?? null) : null,
    mine: p.reportedBy === viewer._id,
    groupSize: groupOf(p.groupId).length,
    audience: p.audience.map(person).filter((x) => x !== null),
    ai: { ...p.ai, error: p.ai.error ?? null },
    history: p.history.map((h) => {
      const hidden = (h.action === "reported" || h.action === "grouped") && h.by === p.reportedBy && !showReporter;
      const who = person(h.by);
      return { ...h, byName: hidden ? null : (who?.name ?? null), byRole: who?.role ?? null };
    }),
  };
};

const candidatesFor = (): GroupCandidate[] =>
  getDb()
    .problems.filter((p) => p._id === p.groupId && p.status !== "resolved")
    .map((p) => ({ id: p._id, title: p.title, category: p.category, location: p.location, reports: groupOf(p._id).length }));

export const problemhuntResolvers = {
  Query: {
    hugjuulaiProblems: (_: unknown, { userId }: Args) => {
      const viewer = findUser(String(userId));
      return getDb()
        .problems.filter((p) => canSee(viewer, p))
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        .map((p) => problemOut(p, viewer));
    },
  },

  Mutation: {
    hugjuulaiProblemReport: async (_: unknown, { userId, doc, lang }: Args) => {
      const user = findUser(String(userId));
      if (user.role !== "student") throw new Error("ProblemHunt reports come from students");
      const input = (doc ?? {}) as Record<string, unknown>;
      const title = String(input.title ?? "").trim().slice(0, 160);
      const location = String(input.location ?? "").trim().slice(0, 120);
      if (!title) throw new Error("Title is required");
      if (!location) throw new Error("Location is required");
      const description = String(input.description ?? "").trim().slice(0, 1500);
      const urgency = PRIORITIES.includes(input.urgency as ProblemPriority) ? (input.urgency as ProblemPriority) : "medium";
      const categoryHint = CATEGORIES.includes(input.category as ProblemCategory) ? (input.category as ProblemCategory) : undefined;
      const photo =
        typeof input.photo === "string" && input.photo.startsWith("data:image/") && input.photo.length < 700_000 ? input.photo : undefined;

      const db = getDb();
      const { error, ...c } = await classifyProblem(
        { title, description, location, urgency, categoryHint, photo },
        candidatesFor(),
        db.users,
        toLang(lang),
      );

      const now = new Date().toISOString();
      const _id = newId("ph");
      const root = c.duplicateOf ? db.problems.find((p) => p._id === c.duplicateOf) : undefined;
      const problem: Problem = {
        _id,
        number: Math.max(1039, ...db.problems.map((p) => p.number)) + 1,
        title,
        description,
        location,
        category: root?.category ?? c.category,
        priority: root ? (PRIORITIES.indexOf(c.priority) > PRIORITIES.indexOf(root.priority) ? c.priority : root.priority) : c.priority,
        urgency,
        status: root && root.status !== "resolved" ? root.status : "new",
        anonymous: Boolean(input.anonymous),
        photo,
        reportedBy: user._id,
        audience: c.audience,
        groupId: root?._id ?? _id,
        ai: { reason: c.reason, source: c.source, model: c.model, ...(error ? { error } : {}) },
        history: [{ at: now, by: user._id, action: "reported" }, ...(root ? [{ at: now, by: user._id, action: "grouped" as const }] : [])],
        createdAt: now,
        updatedAt: now,
      };
      db.problems.push(problem);
      if (root) {
        // Everyone in the group shares one audience and the highest priority.
        const members = groupOf(root._id);
        const audience = [...new Set(members.flatMap((m) => m.audience))];
        const top = members.reduce((acc, m) => (PRIORITIES.indexOf(m.priority) > PRIORITIES.indexOf(acc) ? m.priority : acc), "low" as ProblemPriority);
        members.forEach((m) => {
          m.audience = audience;
          m.priority = top;
        });
      }
      save();
      const size = groupOf(problem.groupId).length;
      return { problem: problemOut(problem, user), grouped: Boolean(root), groupNumber: root?.number ?? null, groupSize: size };
    },

    /** Mark a report (and its whole group) seen or resolved, optionally with a reply. */
    hugjuulaiProblemStatus: (_: unknown, args: Args) => {
      const user = findUser(String(args.userId));
      const p = findProblem(String(args.problemId));
      if (!canAct(user, p)) throw new Error("Only the people this report was sent to can update it");
      const status = args.status as ProblemStatus;
      if (!STATUSES.includes(status)) throw new Error("Invalid status");
      const note = typeof args.note === "string" ? args.note.trim().slice(0, 400) : "";
      const at = new Date().toISOString();
      const members = groupOf(p.groupId);
      members.forEach((m) => {
        m.status = status;
        m.history.push({ at, by: user._id, action: "status", status, ...(note ? { note } : {}) });
        m.updatedAt = at;
      });
      save();
      return members.map((m) => problemOut(m, user));
    },

    /** Reply to the reporters without changing the status. */
    hugjuulaiProblemNote: (_: unknown, args: Args) => {
      const user = findUser(String(args.userId));
      const p = findProblem(String(args.problemId));
      if (!canAct(user, p)) throw new Error("Only the people this report was sent to can reply");
      const note = String(args.note ?? "").trim().slice(0, 400);
      if (!note) throw new Error("Reply is empty");
      const at = new Date().toISOString();
      const members = groupOf(p.groupId);
      members.forEach((m) => {
        m.history.push({ at, by: user._id, action: "note", note });
        m.updatedAt = at;
      });
      save();
      return members.map((m) => problemOut(m, user));
    },
  },
};
