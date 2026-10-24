// TeacherRate: tone check and teacher summaries (Gemma 4 with rule-based fallbacks).
import { test } from "node:test";
import assert from "node:assert/strict";
import { averageRating, checkTone, fallbackSummary, fallbackTone, reviewsHash, summarizeTeacher, traitStats } from "../server/ai/teacherrate.ts";
import type { Review } from "../server/types.ts";

const review = (id: string, rating: number, traits: Review["traits"], text = "", likes = 0): Review => ({
  _id: id,
  teacherId: "t",
  authorId: `s-${id}`,
  authorName: `S ${id}`,
  subject: "Math",
  rating,
  traits,
  text,
  likes: [...Array(likes)].map((_, i) => `u${i}`),
  flagged: false,
  createdAt: `2026-10-${10 + rating}T00:00:00Z`,
});
const reviews = [
  review("a", 5, { attendance: true, notes: true, clear: true, homework: true }, "Explains step by step.", 4),
  review("b", 4, { attendance: true, notes: true, clear: true, fairGrades: true }, "Strict about attendance."),
  review("c", 3, { attendance: true, clear: false, homework: true, gradesOnTime: false }, "Too fast sometimes."),
];

test("trait stats, average and hash", () => {
  const stats = traitStats(reviews);
  assert.deepEqual(stats.find((s) => s.key === "attendance"), { key: "attendance", yes: 3, no: 0 });
  assert.deepEqual(stats.find((s) => s.key === "clear"), { key: "clear", yes: 2, no: 1 });
  assert.equal(averageRating(reviews), 4);
  assert.equal(averageRating([]), null);
  assert.notEqual(reviewsHash(reviews), reviewsHash(reviews.slice(1)));
  assert.equal(reviewsHash(reviews), reviewsHash([...reviews].reverse()));
});

test("fallback tone check flags insults and threats, never plain criticism", () => {
  assert.equal(fallbackTone("Тайлбар нь ойлгомжгүй, дүнгээ хоцроодог. Хамгийн муу хичээл.", "mn").ok, true);
  assert.equal(fallbackTone("Энэ багш тэнэг.", "mn").issue, "insult");
  assert.equal(fallbackTone("He is an idiot", "en").ok, false);
  assert.equal(fallbackTone("I will beat him", "en").issue, "threat");
});

test("Gemma 4 tone check: validated, suggestion kept, and falls back offline", async () => {
  const flagged = await checkTone({ text: "stupid teacher, explains too fast", subject: "Math", rating: 1 }, "T", "en", async () =>
    JSON.stringify({ ok: false, issue: "insult", note: "Please drop the insult.", suggestion: "Explains too fast for me." }),
  );
  assert.equal(flagged.ok, false);
  assert.equal(flagged.issue, "insult");
  assert.equal(flagged.suggestion, "Explains too fast for me.");
  assert.equal(flagged.source, "ai");

  const weird = await checkTone({ text: "fine class", subject: "Math", rating: 4 }, "T", "en", async () => '{"ok":true,"issue":"banana"}');
  assert.equal(weird.ok, true);
  assert.equal(weird.issue, "none");

  const offline = await checkTone({ text: "Энэ багш тэнэг", subject: "Math", rating: 1 }, "T", "mn", async () => {
    throw new Error("offline");
  });
  assert.equal(offline.ok, false);
  assert.equal(offline.source, "fallback");
  assert.equal(offline.error, "offline");
});

test("teacher summary: fallback from yes/no answers, AI output validated", async () => {
  const fb = fallbackSummary("t", "T", reviews, "en");
  assert.equal(fb.reviewCount, 3);
  assert.ok(fb.tips.some((x) => /attendance/i.test(x)));
  assert.ok(fb.tips.some((x) => /notes/i.test(x)));
  assert.ok(fb.cons.some((x) => /homework/i.test(x)));

  let prompt = "";
  const ai = await summarizeTeacher({ _id: "t", name: "T", subject: "Math" }, reviews, "mn", async (m) => {
    prompt = m.map((x) => x.content).join("\n");
    return JSON.stringify({ overview: "Тайлбар сайтай.", pros: ["a", "b", "c", "d"], cons: [], tips: ["x"] });
  });
  assert.equal(ai.source, "ai");
  assert.equal(ai.pros.length, 3);
  assert.match(prompt, /Mongolian/);
  assert.match(prompt, /ирц авдаг/); // trait questions in the student's language
  assert.doesNotMatch(prompt, /S a/); // author names never reach the model

  const empty = await summarizeTeacher({ _id: "t", name: "T" }, reviews, "en", async () => '{"overview":""}');
  assert.equal(empty.source, "fallback");
});
