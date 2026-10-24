// TeacherRate GraphQL API: students rate their teachers anonymously (stars,
// yes/no answers about attendance, notebook checks, grading and teaching style,
// and a short text). Other students read the reviews; Gemma 4 checks the tone
// before posting and writes a summary of each teacher's page.
//
// Visibility: students see every teacher; a teacher sees only their own page;
// the administration sees everything, including who wrote each review.

import { averageRating, checkTone, reviewsHash, summarizeTeacher, traitStats } from "./ai/teacherrate.ts";
import { findUser, getDb, newId, save } from "./store.ts";
import { TRAITS, type Lang, type Review, type TeacherSummary, type TraitKey, type User } from "./types.ts";

export const teacherTypeDefs = /* GraphQL */ `
  type HugjuulaiTraitStat {
    key: String!
    yes: Int!
    no: Int!
  }

  type HugjuulaiTraitAnswer {
    key: String!
    value: Boolean!
  }

  type HugjuulaiTeacherCard {
    _id: String!
    name: String!
    subject: String
    courses: [String!]!
    rating: Float
    reviewCount: Int!
    topTraits: [String!]!
  }

  type HugjuulaiReview {
    _id: String!
    teacherId: String!
    subject: String!
    rating: Int!
    traits: [HugjuulaiTraitAnswer!]!
    text: String!
    likes: Int!
    liked: Boolean!
    mine: Boolean!
    authorName: String
    flagged: Boolean!
    createdAt: String!
  }

  type HugjuulaiTeacherSummary {
    overview: String!
    pros: [String!]!
    cons: [String!]!
    tips: [String!]!
    source: String!
    provider: String
    model: String
    reviewCount: Int!
    lang: String
    createdAt: String
    error: String
  }

  type HugjuulaiTeacherProfile {
    teacher: HugjuulaiTeacherCard!
    traits: [HugjuulaiTraitStat!]!
    ratingCounts: [Int!]!
    reviews: [HugjuulaiReview!]!
    canReview: Boolean!
  }

  type HugjuulaiToneCheck {
    ok: Boolean!
    issue: String!
    note: String
    suggestion: String
    source: String!
    model: String
    error: String
  }

  type HugjuulaiReviewResult {
    posted: Boolean!
    review: HugjuulaiReview
    check: HugjuulaiToneCheck!
  }

  input HugjuulaiTraitInput {
    key: String!
    value: Boolean!
  }

  input HugjuulaiReviewInput {
    teacherId: String!
    subject: String!
    rating: Int!
    traits: [HugjuulaiTraitInput!]
    text: String
  }

  extend type Query {
    hugjuulaiTeachers(userId: String!): [HugjuulaiTeacherCard!]!
    hugjuulaiTeacher(userId: String!, teacherId: String!): HugjuulaiTeacherProfile!
  }

  extend type Mutation {
    hugjuulaiReviewSubmit(userId: String!, doc: HugjuulaiReviewInput!, lang: String, force: Boolean): HugjuulaiReviewResult!
    hugjuulaiReviewLike(userId: String!, reviewId: String!): HugjuulaiReview!
    hugjuulaiReviewDelete(userId: String!, reviewId: String!): Boolean!
    hugjuulaiTeacherSummary(userId: String!, teacherId: String!, lang: String, regenerate: Boolean): HugjuulaiTeacherSummary!
  }
`;

type Args = Record<string, unknown>;
const toLang = (v: unknown): Lang => (v === "en" ? "en" : "mn");

const teachers = (): User[] => getDb().users.filter((u) => u.role === "teacher");
const reviewsOf = (teacherId: string): Review[] => getDb().reviews.filter((r) => r.teacherId === teacherId);

const canSee = (user: User, teacherId: string): boolean =>
  user.role === "student" || user.role === "admin" || (user.role === "teacher" && user._id === teacherId);

const findTeacher = (user: User, teacherId: string): User => {
  const t = teachers().find((x) => x._id === teacherId);
  if (!t) throw new Error(`Unknown teacher: ${teacherId}`);
  if (!canSee(user, teacherId)) throw new Error("You can't see this teacher's ratings");
  return t;
};

const cardOut = (t: User) => {
  const reviews = reviewsOf(t._id);
  const top = traitStats(reviews)
    .filter((s) => s.yes + s.no >= 2 && s.yes / (s.yes + s.no) >= 0.6)
    .sort((a, b) => b.yes / (b.yes + b.no) - a.yes / (a.yes + a.no) || b.yes - a.yes)
    .slice(0, 3)
    .map((s) => s.key);
  return {
    _id: t._id,
    name: t.name,
    subject: t.subject ?? null,
    courses: t.courses ?? (t.subject ? [t.subject] : []),
    rating: averageRating(reviews),
    reviewCount: reviews.length,
    topTraits: top,
  };
};

const reviewOut = (r: Review, viewer: User) => ({
  _id: r._id,
  teacherId: r.teacherId,
  subject: r.subject,
  rating: r.rating,
  traits: TRAITS.filter((k) => typeof r.traits[k] === "boolean").map((k) => ({ key: k, value: r.traits[k] })),
  text: r.text,
  likes: r.likes.length,
  liked: r.likes.includes(viewer._id),
  mine: r.authorId === viewer._id,
  // Anonymous to everyone except the administration.
  authorName: viewer.role === "admin" ? r.authorName : null,
  flagged: viewer.role === "admin" ? r.flagged : false,
  createdAt: r.createdAt,
});

const summaryOut = (s: Omit<TeacherSummary, "createdAt"> & { createdAt?: string; error?: string }) => ({
  ...s,
  createdAt: s.createdAt ?? new Date().toISOString(),
  error: s.error ?? null,
});

export const teacherResolvers = {
  Query: {
    hugjuulaiTeachers: (_: unknown, { userId }: Args) => {
      const user = findUser(String(userId));
      if (user.role === "staff") throw new Error("Teacher ratings are for students, teachers and the administration");
      return teachers()
        .filter((t) => canSee(user, t._id))
        .map(cardOut)
        .sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0) || b.reviewCount - a.reviewCount);
    },

    hugjuulaiTeacher: (_: unknown, { userId, teacherId }: Args) => {
      const user = findUser(String(userId));
      const t = findTeacher(user, String(teacherId));
      const reviews = reviewsOf(t._id).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
      return {
        teacher: cardOut(t),
        traits: traitStats(reviews),
        ratingCounts: [1, 2, 3, 4, 5].map((n) => reviews.filter((r) => r.rating === n).length),
        reviews: reviews.map((r) => reviewOut(r, user)),
        canReview: user.role === "student",
      };
    },
  },

  Mutation: {
    /** Gemma 4 checks the tone first; a flagged review is only posted with force. */
    hugjuulaiReviewSubmit: async (_: unknown, args: Args) => {
      const user = findUser(String(args.userId));
      if (user.role !== "student") throw new Error("Only students can rate teachers");
      const doc = (args.doc ?? {}) as Record<string, unknown>;
      const t = findTeacher(user, String(doc.teacherId ?? ""));
      const courses = t.courses ?? (t.subject ? [t.subject] : []);
      const subject = String(doc.subject ?? "").trim();
      if (!courses.includes(subject)) throw new Error("Pick one of the teacher's classes");
      const rating = Math.round(Number(doc.rating));
      if (!(rating >= 1 && rating <= 5)) throw new Error("Give 1 to 5 stars");
      const text = String(doc.text ?? "").trim().slice(0, 1500);
      const traits: Review["traits"] = {};
      for (const a of Array.isArray(doc.traits) ? doc.traits : []) {
        const e = a as { key?: unknown; value?: unknown };
        if (TRAITS.includes(e.key as TraitKey) && typeof e.value === "boolean") traits[e.key as TraitKey] = e.value;
      }

      const { error, ...check } = await checkTone({ text, subject, rating }, t.name, toLang(args.lang));
      const checkOut = { ...check, error: error ?? null };
      if (!check.ok && !args.force) return { posted: false, review: null, check: checkOut };

      const db = getDb();
      const className = db.classes.find((c) => c._id === user.classId)?.name;
      // One review per student, teacher and class: writing again replaces it.
      const existing = db.reviews.find((r) => r.teacherId === t._id && r.authorId === user._id && r.subject === subject);
      const review: Review = {
        _id: existing?._id ?? newId("rv"),
        teacherId: t._id,
        authorId: user._id,
        authorName: className ? `${user.name} · ${className}` : user.name,
        subject,
        rating,
        traits,
        text,
        likes: existing?.likes ?? [],
        flagged: !check.ok,
        createdAt: new Date().toISOString(),
      };
      db.reviews = [review, ...db.reviews.filter((r) => r._id !== review._id)];
      save();
      return { posted: true, review: reviewOut(review, user), check: checkOut };
    },

    hugjuulaiReviewLike: (_: unknown, { userId, reviewId }: Args) => {
      const user = findUser(String(userId));
      if (user.role !== "student") throw new Error("Only students can like reviews");
      const r = getDb().reviews.find((x) => x._id === String(reviewId));
      if (!r) throw new Error("Unknown review");
      r.likes = r.likes.includes(user._id) ? r.likes.filter((x) => x !== user._id) : [...r.likes, user._id];
      save();
      return reviewOut(r, user);
    },

    hugjuulaiReviewDelete: (_: unknown, { userId, reviewId }: Args) => {
      const user = findUser(String(userId));
      const db = getDb();
      const r = db.reviews.find((x) => x._id === String(reviewId));
      if (!r) throw new Error("Unknown review");
      if (r.authorId !== user._id && user.role !== "admin") throw new Error("Only the author or the administration can delete a review");
      db.reviews = db.reviews.filter((x) => x._id !== r._id);
      save();
      return true;
    },

    /** Gemma 4 summary of a teacher's reviews, cached until the reviews change. */
    hugjuulaiTeacherSummary: async (_: unknown, args: Args) => {
      const user = findUser(String(args.userId));
      const t = findTeacher(user, String(args.teacherId));
      const lang = toLang(args.lang);
      const reviews = reviewsOf(t._id);
      const hash = reviewsHash(reviews);
      const db = getDb();
      const cached = db.summaries.find((s) => s.teacherId === t._id && s.lang === lang);
      if (cached && cached.hash === hash && cached.source === "ai" && !args.regenerate) return summaryOut(cached);
      const { error, ...made } = await summarizeTeacher(t, reviews, lang);
      const summary: TeacherSummary = { ...made, createdAt: new Date().toISOString() };
      if (summary.source === "ai") {
        db.summaries = [summary, ...db.summaries.filter((s) => !(s.teacherId === t._id && s.lang === lang))];
        save();
      }
      return summaryOut({ ...summary, error });
    },
  },
};
