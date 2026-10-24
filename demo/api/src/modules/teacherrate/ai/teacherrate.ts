// TeacherRate AI: Gemma 4 checks the tone of a review before it is posted and
// summarises what students said about a teacher (how they teach, attendance,
// notes, grading) for classmates. Rule-based fallbacks keep both working offline.

import { asArray, asString, extractJson } from "../../../ai/json.ts";
import { helpChat, runChat, type ChatFn } from "../../../ai/llm.ts";
import type { Lang } from "../../../types.ts";
import { TRAITS, type Review, type TeacherSummary, type ToneCheck, type TraitKey } from "../db/definitions/teacherrate.ts";

const languageName = (lang: Lang): string => (lang === "mn" ? "Mongolian (Cyrillic script)" : "English");

// Labels the model sees (the UI has its own translations).
const TRAIT_EN: Record<TraitKey, string> = {
  attendance: "takes attendance",
  notes: "makes students keep notes and checks them",
  fairGrades: "grades fairly",
  gradesOnTime: "posts grades on time",
  clear: "explains clearly",
  homework: "gives a lot of homework",
  extraCredit: "gives extra credit",
  teamwork: "uses group work",
  fun: "lessons are fun",
};
const TRAIT_MN: Record<TraitKey, string> = {
  attendance: "ирц авдаг",
  notes: "тэмдэглэл хөтлүүлж шалгадаг",
  fairGrades: "дүнгээ шударга тавьдаг",
  gradesOnTime: "дүнгээ цагт нь гаргадаг",
  clear: "ойлгомжтой заадаг",
  homework: "гэрийн даалгавар их өгдөг",
  extraCredit: "нэмэлт оноо өгдөг",
  teamwork: "багийн ажил хийлгэдэг",
  fun: "хичээл нь хөгжилтэй",
};

export interface TraitStat {
  key: TraitKey;
  yes: number;
  no: number;
}

export const traitStats = (reviews: Review[]): TraitStat[] =>
  TRAITS.map((key) => ({
    key,
    yes: reviews.filter((r) => r.traits[key] === true).length,
    no: reviews.filter((r) => r.traits[key] === false).length,
  }));

export const averageRating = (reviews: Review[]): number | null =>
  reviews.length ? Math.round((reviews.reduce((s, r) => s + r.rating, 0) / reviews.length) * 10) / 10 : null;

/** Which reviews a summary was made from: changes whenever one is added, edited or deleted. */
export const reviewsHash = (reviews: Review[]): string => {
  let h = 5381;
  for (const ch of reviews.map((r) => `${r._id}@${r.createdAt}`).sort().join("|")) h = ((h << 5) + h + ch.charCodeAt(0)) | 0;
  return `${reviews.length}-${(h >>> 0).toString(36)}`;
};

// ---------------------------------------------------------------- tone check

const INSULTS = [
  /тэнэг/i, /новш/i, /золиг/i, /муусай/i, /гахай/i, /өлөгчин/i, /\bидиот/i, /солиот/i, /галзуу/i,
  /\bstupid\b/i, /\bidiot\b/i, /\bdumb\b/i, /\bhate (him|her)\b/i, /\bugly\b/i, /\bfat\b/i, /\bloser\b/i,
];
const THREATS = [/зодно/i, /алн[аы]/i, /\bkill\b/i, /\bbeat (him|her)\b/i];
const PERSONAL = [/утасны дугаар/i, /гэр нь/i, /нөхөр нь/i, /эхнэр нь/i, /\bher husband\b/i, /\bhis wife\b/i, /\bphone number\b/i];

export const fallbackTone = (text: string, lang: Lang): ToneCheck => {
  const mn = lang === "mn";
  const hit = THREATS.some((r) => r.test(text)) ? "threat" : INSULTS.some((r) => r.test(text)) ? "insult" : PERSONAL.some((r) => r.test(text)) ? "personal" : "none";
  return {
    ok: hit === "none",
    issue: hit,
    note:
      hit === "none"
        ? ""
        : mn
          ? "Шүүмжлэл болно, харин доромжилсон эсвэл хувийн үг хэрэглэхгүй байя. Хичээл, заах арга, дүнгийн тухай бичээрэй."
          : "Criticism is welcome, but please leave out insults and personal remarks. Write about the lessons, teaching and grading.",
    suggestion: "",
    source: "fallback",
    model: "rule-based",
  };
};

export const checkTone = async (
  review: { text: string; subject: string; rating: number },
  teacherName: string,
  lang: Lang,
  chatFn: ChatFn = helpChat,
): Promise<ToneCheck & { error?: string }> => {
  const text = review.text.trim();
  if (!text) return { ok: true, issue: "none", note: "", suggestion: "", source: "fallback", model: "rule-based" };
  const system = [
    'You are the review assistant of "TeacherRate", the teacher-feedback section of a school system built on erxes.',
    "Students rate their teachers anonymously and other students read the reviews.",
    "Check ONE review before it is posted:",
    "- Honest criticism of teaching, explanations, workload, attendance rules, note checks or grading is fine. Never flag it just for being negative.",
    "- Flag insults and name-calling (insult), remarks about the teacher's looks, private life, family or contact details (personal), threats (threat), or text that is not about the class at all (offtopic).",
    `- If flagged: "note" kindly tells the student why in one sentence, and "suggestion" rewrites the whole review politely in ${languageName(lang)}, keeping every concrete point about the class.`,
    `Write "note" in ${languageName(lang)}.`,
    'Return ONLY JSON: {"ok":true,"issue":"none|insult|personal|threat|offtopic","note":"","suggestion":""}',
  ].join("\n");
  try {
    const c = await runChat(
      chatFn,
      [
        { role: "system", content: system },
        { role: "user", content: JSON.stringify({ teacher: teacherName, subject: review.subject, stars: review.rating, review: text.slice(0, 1500) }) },
      ],
      { json: true, temperature: 0.1, maxTokens: 700, timeoutMs: 30000 },
      "help",
    );
    const obj = (extractJson(c.text) ?? {}) as Record<string, unknown>;
    const issues: ToneCheck["issue"][] = ["none", "insult", "personal", "threat", "offtopic"];
    const issue = issues.includes(obj.issue as ToneCheck["issue"]) ? (obj.issue as ToneCheck["issue"]) : "none";
    const ok = obj.ok === false ? false : issue === "none";
    return {
      ok,
      issue: ok ? "none" : issue === "none" ? "insult" : issue,
      note: ok ? "" : asString(obj.note, 300) || fallbackTone("тэнэг", lang).note,
      suggestion: ok ? "" : asString(obj.suggestion, 1500),
      source: "ai",
      model: c.model,
    };
  } catch (e) {
    return { ...fallbackTone(text, lang), error: (e as Error).message };
  }
};

// ---------------------------------------------------------------- summary

const share = (s: TraitStat): number => (s.yes + s.no ? s.yes / (s.yes + s.no) : 0);

export const fallbackSummary = (teacherId: string, name: string, reviews: Review[], lang: Lang): Omit<TeacherSummary, "createdAt"> => {
  const mn = lang === "mn";
  const label = mn ? TRAIT_MN : TRAIT_EN;
  const stats = traitStats(reviews).filter((s) => s.yes + s.no >= 2);
  const avg = averageRating(reviews);
  const yes = (k: TraitKey) => stats.find((s) => s.key === k && share(s) >= 0.6);
  const no = (k: TraitKey) => stats.find((s) => s.key === k && share(s) <= 0.4);
  const good: TraitKey[] = ["clear", "fairGrades", "gradesOnTime", "fun", "extraCredit", "teamwork"];
  const pct = (s: TraitStat) => `${Math.round(share(s) * 100)}%`;
  const pros = good.filter((k) => yes(k)).slice(0, 3).map((k) => (mn ? `${pct(yes(k)!)} нь «${label[k]}» гэсэн` : `${pct(yes(k)!)} say “${label[k]}”`));
  const cons = [
    ...good.filter((k) => no(k)).map((k) => (mn ? `${pct(no(k)!)} нь л «${label[k]}» гэсэн` : `only ${pct(no(k)!)} say “${label[k]}”`)),
    ...(yes("homework") ? [mn ? "Гэрийн даалгавар их гэсэн санал олон" : "Many say there is a lot of homework"] : []),
  ].slice(0, 3);
  const tips = [
    ...(yes("attendance") ? [mn ? "Ирц авдаг тул хичээлээ бүү тасал." : "Attendance is taken, so don't skip class."] : []),
    ...(yes("notes") ? [mn ? "Тэмдэглэлээ өдөр бүр цэвэр хөтөл, шалгадаг." : "Keep your notes tidy every day — they get checked."] : []),
    ...(yes("homework") ? [mn ? "Даалгавраа хоцроолгүй, тухай бүр нь хий." : "Do homework right away so it doesn't pile up."] : []),
    ...(yes("extraCredit") ? [mn ? "Нэмэлт онооны даалгаврыг алгасах хэрэггүй." : "Don't skip the extra-credit work."] : []),
    ...(yes("teamwork") ? [mn ? "Багийн ажилд идэвхтэй оролц." : "Take part actively in group work."] : []),
  ].slice(0, 3);
  return {
    teacherId,
    lang,
    hash: reviewsHash(reviews),
    overview: reviews.length
      ? mn
        ? `${name} багшийг ${reviews.length} сурагч үнэлсэн, дундаж ${avg}/5. Доорх нь сурагчдын «тийм / үгүй» хариултаас гаргасан товч дүгнэлт.`
        : `${reviews.length} students rated ${name}, average ${avg}/5. This is a short summary of their yes / no answers.`
      : mn
        ? "Одоогоор үнэлгээ алга."
        : "No reviews yet.",
    pros,
    cons,
    tips,
    source: "fallback",
    provider: "rule",
    model: "rule-based",
    reviewCount: reviews.length,
  };
};

export const summarizeTeacher = async (
  teacher: { _id: string; name: string; subject?: string; courses?: string[] },
  reviews: Review[],
  lang: Lang,
  chatFn: ChatFn = helpChat,
): Promise<Omit<TeacherSummary, "createdAt"> & { error?: string }> => {
  const fallback = fallbackSummary(teacher._id, teacher.name, reviews, lang);
  if (reviews.length === 0) return fallback;
  const system = [
    'You are "TeacherRate", the teacher-feedback assistant of a school system built on erxes.',
    "Summarise what students said about ONE teacher, for classmates who will take their class.",
    "Use only the reviews and the yes/no counts you are given. Do not invent facts. Never guess who wrote a review.",
    "Cover how the teacher teaches, attendance, notebook checks and grading when the reviews mention them. Be fair and calm; no insults.",
    `Write in ${languageName(lang)}.`,
    'Return ONLY JSON: {"overview":"<2 sentences>","pros":["<max 12 words>"],"cons":["<max 12 words>"],"tips":["<how to do well in this class, max 14 words>"]}',
    "Up to 3 items in each list.",
  ].join("\n");
  const user = JSON.stringify({
    teacher: teacher.name,
    subject: teacher.subject,
    classes: teacher.courses ?? [],
    averageStars: averageRating(reviews),
    yesNo: traitStats(reviews).map((s) => ({ question: (lang === "mn" ? TRAIT_MN : TRAIT_EN)[s.key], yes: s.yes, no: s.no })),
    reviews: reviews
      .slice()
      .sort((a, b) => b.likes.length - a.likes.length)
      .slice(0, 25)
      .map((r) => ({ class: r.subject, stars: r.rating, likes: r.likes.length, text: r.text.slice(0, 600) })),
  });
  try {
    const c = await runChat(
      chatFn,
      [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      { json: true, temperature: 0.3, maxTokens: 900 },
      "help",
    );
    const obj = (extractJson(c.text) ?? {}) as Record<string, unknown>;
    const list = (v: unknown) =>
      asArray(v)
        .map((x) => asString(x, 200))
        .filter(Boolean)
        .slice(0, 3);
    const overview = asString(obj.overview, 600);
    if (!overview) throw new Error("AI summary is empty");
    return {
      ...fallback,
      overview,
      pros: list(obj.pros),
      cons: list(obj.cons),
      tips: list(obj.tips),
      source: "ai",
      provider: c.provider,
      model: c.model,
    };
  } catch (e) {
    return { ...fallback, error: (e as Error).message };
  }
};
