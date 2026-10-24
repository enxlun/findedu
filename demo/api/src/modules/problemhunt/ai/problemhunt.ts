// ProblemHunt AI: when a student reports a problem around the school, Gemma 4
// (with the photo, if any) decides the category and priority, who should see it
// (matching staff, the teacher responsible for the room, and the administration),
// and whether it duplicates an existing report so the two are grouped.
// It never creates tasks or projects. Keyword rules are the fallback.

import { asArray, asString, extractJson } from "../../../ai/json.ts";
import { helpChat, runChat, type ChatFn } from "../../../ai/llm.ts";
import type { Lang, User } from "../../../types.ts";
import type { Classification, ProblemCategory, ProblemPriority } from "../db/definitions/problemhunt.ts";


export const CATEGORIES: ProblemCategory[] = ["electric", "plumbing", "heating", "furniture", "it", "cleaning", "safety", "other"];
export const PRIORITIES: ProblemPriority[] = ["low", "medium", "high", "urgent"];

export interface ReportInput {
  title: string;
  description: string;
  location: string;
  urgency: ProblemPriority;
  categoryHint?: ProblemCategory;
  photo?: string;
}

export interface GroupCandidate {
  id: string;
  title: string;
  category: ProblemCategory;
  location: string;
  reports: number;
}

const KEYWORDS: Record<ProblemCategory, RegExp> = {
  electric: /гэрэл|цахилгаан|залгуур|розетк|унтраалга|чийдэн|light|power|socket|electric/i,
  plumbing: /усн|(^|\s)ус(\s|$)|цорго|гоож|жорлон|ариун цэвр|угаалтуур|water|leak|toilet|sink|pipe/i,
  heating: /халаалт|радиатор|хүйтэн|дулаан|heating|radiator|cold/i,
  furniture: /ширээ|сандал|самбар|хаалга|цонх|шүүгээ|desk|chair|door|window|board/i,
  it: /проектор|компьютер|интернэт|wi-?fi|принтер|дэлгэц|projector|computer|internet|printer|screen/i,
  cleaning: /хог|бохир|цэвэрл|үнэр|trash|dirty|clean|smell/i,
  safety: /гал|аюул|осол|шат|гэмтэ|дээрэлх|fire|danger|safety|injur|stairs|bully/i,
  other: /$^/,
};

export const guessCategory = (text: string): ProblemCategory => CATEGORIES.find((c) => KEYWORDS[c].test(text)) ?? "other";

const STOP = new Set(["байна", "байгаа", "болсон", "маш", "дээр", "доор", "the", "and", "is", "not", "тоот", "давхар", "байр"]);
export const tokens = (text: string): Set<string> =>
  new Set(
    text
      .toLowerCase()
      .split(/[^\p{L}\p{N}]+/u)
      .filter((w) => w.length >= 3 && !STOP.has(w))
      .map((w) => w.slice(0, 4)), // crude stemming: Mongolian adds long suffixes
  );
export const similarity = (a: string, b: string): number => {
  const A = tokens(a);
  const B = tokens(b);
  if (!A.size || !B.size) return 0;
  let inter = 0;
  for (const w of A) if (B.has(w)) inter++;
  return inter / (A.size + B.size - inter);
};
const rooms = (text: string): string[] => [...text.matchAll(/\b(\d{3})\b/g)].map((m) => m[1]);

/** Who should see a report: matching staff, the room's teacher, and the administration. */
export const routeAudience = (category: ProblemCategory, location: string, people: User[]): string[] => {
  const ids = new Set<string>();
  people.filter((p) => p.role === "admin").forEach((p) => ids.add(p._id));
  const staff = people.filter((p) => p.role === "staff");
  const matching = staff.filter((p) => p.specialties?.includes(category));
  (matching.length ? matching : staff.filter((p) => p.specialties?.includes("other"))).forEach((p) => ids.add(p._id));
  const locRooms = rooms(location);
  const lower = location.toLowerCase();
  people
    .filter((p) => p.role === "teacher" && p.rooms?.some((r) => locRooms.includes(r) || lower.includes(r.toLowerCase())))
    .forEach((p) => ids.add(p._id));
  return [...ids];
};

const findDuplicate = (input: ReportInput, category: ProblemCategory, candidates: GroupCandidate[]): string | null => {
  const text = `${input.title} ${input.description} ${input.location}`;
  const myRooms = rooms(input.location);
  let best: { id: string; score: number } | null = null;
  for (const c of candidates) {
    if (c.category !== category) continue;
    const sameRoom = myRooms.length > 0 && rooms(c.location).some((r) => myRooms.includes(r));
    const sameArea = similarity(input.location, c.location) >= 0.5;
    const score = similarity(text, `${c.title} ${c.location}`) + (sameRoom ? 0.3 : 0) + (sameArea ? 0.15 : 0);
    if (score >= 0.35 && (!best || score > best.score)) best = { id: c.id, score };
  }
  return best?.id ?? null;
};

const bump = (p: ProblemPriority, to: ProblemPriority): ProblemPriority =>
  PRIORITIES.indexOf(to) > PRIORITIES.indexOf(p) ? to : p;

const namesOf = (ids: string[], people: User[]) =>
  ids
    .map((id) => people.find((p) => p._id === id))
    .filter((p) => p && p.role !== "admin")
    .map((p) => p!.name);

export const fallbackClassify = (
  input: ReportInput,
  candidates: GroupCandidate[],
  people: User[],
  lang: Lang,
): Classification => {
  const category = input.categoryHint ?? guessCategory(`${input.title} ${input.description}`);
  let priority = input.urgency;
  if (category === "safety") priority = "urgent";
  if (category === "heating") priority = bump(priority, "high");
  const audience = routeAudience(category, input.location, people);
  const duplicateOf = findDuplicate(input, category, candidates);
  const names = namesOf(audience, people).join(", ");
  const mn = lang === "mn";
  return {
    category,
    priority,
    audience,
    duplicateOf,
    reason: mn
      ? `${names ? `${names} болон ` : ""}захиргаанд илгээв.${duplicateOf ? " Ижил асуудалтай бүлэглэв." : ""}`
      : `Sent to ${names ? `${names} and ` : ""}the administration.${duplicateOf ? " Grouped with a similar report." : ""}`,
    source: "fallback",
    model: "rule-based",
  };
};

export const classifyProblem = async (
  input: ReportInput,
  candidates: GroupCandidate[],
  people: User[],
  lang: Lang,
  chatFn: ChatFn = helpChat,
): Promise<Classification & { error?: string }> => {
  const fallback = fallbackClassify(input, candidates, people, lang);
  const directory = people.filter((p) => p.role !== "student");
  const system = [
    "You are ProblemHunt, the intake assistant of a school system built on erxes.",
    "A student reported a problem around the school (a photo may be attached). Decide:",
    `1. category: one of ${CATEGORIES.join(", ")}.`,
    "2. priority: low | medium | high | urgent. urgent = safety risk or it stops classes; high = many students affected or no heating. Consider the student's urgency but use judgement.",
    "3. audience: ids of who should see it — staff whose specialties match, the teacher responsible for that room (see rooms), and ALWAYS everyone with role admin.",
    "4. duplicateOf: the id of an existing group that clearly describes the same problem in the same place, otherwise null.",
    `5. reason: one short sentence in ${lang === "mn" ? "Mongolian (Cyrillic script)" : "English"} saying the category, who will see it and whether it was grouped.`,
    "Never create tasks or projects. Return ONLY JSON:",
    '{"category":"","priority":"","audience":["id"],"duplicateOf":null,"reason":""}',
  ].join("\n");
  const user = JSON.stringify({
    report: { title: input.title, description: input.description, location: input.location, studentUrgency: input.urgency, studentCategory: input.categoryHint ?? null, hasPhoto: Boolean(input.photo) },
    existingGroups: candidates.slice(0, 15),
    people: directory.map((p) => ({ id: p._id, name: p.name, role: p.role, title: p.title ?? p.subject, specialties: p.specialties ?? [], rooms: p.rooms ?? [] })),
  });

  try {
    const c = await runChat(
      chatFn,
      [
        { role: "system", content: system },
        { role: "user", content: user, ...(input.photo ? { images: [input.photo] } : {}) },
      ],
      { json: true, temperature: 0.1, maxTokens: 600, timeoutMs: 30000 },
      "help",
    );
    const obj = (extractJson(c.text) ?? {}) as Record<string, unknown>;
    const category = CATEGORIES.includes(obj.category as ProblemCategory) ? (obj.category as ProblemCategory) : fallback.category;
    const priority = PRIORITIES.includes(obj.priority as ProblemPriority) ? (obj.priority as ProblemPriority) : fallback.priority;
    const valid = new Set(directory.map((p) => p._id));
    const audience = new Set(asArray(obj.audience).map((x) => asString(x, 40)).filter((id) => valid.has(id)));
    directory.filter((p) => p.role === "admin").forEach((p) => audience.add(p._id));
    if (audience.size <= directory.filter((p) => p.role === "admin").length) {
      routeAudience(category, input.location, people).forEach((id) => audience.add(id));
    }
    const dup = asString(obj.duplicateOf, 40);
    const duplicateOf = candidates.some((c) => c.id === dup) ? dup : null;
    return {
      category,
      priority,
      audience: [...audience],
      duplicateOf,
      reason: asString(obj.reason, 300) || fallback.reason,
      source: "ai",
      model: c.model,
    };
  } catch (e) {
    return { ...fallback, error: (e as Error).message };
  }
};
