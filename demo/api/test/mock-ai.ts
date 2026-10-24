// A stand-in for Gemma 4 so you can rehearse the demo without an API key or GPU.
// Speaks both protocols the app supports:
//   Gemini API:        AI_PROVIDER=gemini AI_BASE_URL=http://localhost:11500/v1beta AI_API_KEY=mock
//   OpenAI-compatible: AI_PROVIDER=openai AI_BASE_URL=http://localhost:11500/v1
//   DigitalOcean:      DO_API_KEY=mock DO_BASE_URL=http://localhost:11500/v1
// Answers are marked "(mock)" so they are never mistaken for the real model.

import { createServer } from "node:http";

const PORT = Number(process.env.MOCK_PORT ?? 11500);

interface Msg {
  role: string;
  content: string;
}

const isMn = (system: string) => system.includes("Mongolian");

const beginAnswer = (system: string, user: string): string => {
  const mn = isMn(system);
  const { tasks } = JSON.parse(user) as {
    tasks: { id: string; title: string; type: string; hoursLeft: number; weight: number; blocked: boolean; unlocks: string[] }[];
  };
  const ready = tasks
    .filter((t) => !t.blocked)
    .sort((a, b) => a.hoursLeft - b.hoursLeft - (b.unlocks.length - a.unlocks.length) * 12 || b.weight - a.weight);
  const [next, ...rest] = ready;
  if (!next) return JSON.stringify({ next: { id: "" }, queue: [], summary: "" });
  const ranking = tasks.map((t) => ({
    id: t.id,
    score: Math.max(5, Math.min(99, Math.round(95 - Math.max(0, t.hoursLeft) / 3 + t.unlocks.length * 8 + (t.type === "exam" ? 6 : 0) - (t.blocked ? 30 : 0)))),
    why: t.blocked
      ? (mn ? "Өмнөх ажлаа дуусгасны дараа (mock)" : "After its prerequisite (mock)")
      : t.hoursLeft < 24
        ? (mn ? "Хугацаа ойрхон (mock)" : "Due soon (mock)")
        : (mn ? `${Math.max(1, Math.round(t.hoursLeft / 24))} хоног үлдсэн (mock)` : `${Math.max(1, Math.round(t.hoursLeft / 24))} days left (mock)`),
  }));
  const unlocked = next.unlocks.length ? tasks.find((t) => t.id === next.unlocks[0])?.title : null;
  return JSON.stringify({
    next: {
      id: next.id,
      reason: mn
        ? `${next.hoursLeft < 24 ? "Хугацаа ойрхон" : "Эрт эхлэх нь зөв"}${unlocked ? `, «${unlocked}»-ийн өмнө хийх ёстой` : ""}. (mock)`
        : `${next.hoursLeft < 24 ? "It's due soon" : "Starting early pays off"}${unlocked ? `, and you need it before “${unlocked}”` : ""}. (mock)`,
      firstStep: mn ? "Даалгаврыг нээгээд эхний 2 бодлогыг 10 минутад бод. (mock)" : "Open the task and do the first two parts in 10 minutes. (mock)",
    },
    queue: rest.slice(0, 3).map((t) => ({ id: t.id, reason: mn ? `${Math.max(1, Math.round(t.hoursLeft / 24))} хоногийн дараа дуусна (mock)` : `Due in ${Math.max(1, Math.round(t.hoursLeft / 24))} days (mock)` })),
    ranking,
    summary: mn ? `Одоо «${next.title}», дараа нь бусдыг нь дарааллаар. (mock)` : `Do “${next.title}” now, then the rest in order. (mock)`,
  });
};

const toneAnswer = (system: string, user: string): string => {
  const mn = isMn(system);
  const { review } = JSON.parse(user) as { review: string };
  const rude = /тэнэг|новш|золиг|муусай|stupid|idiot|ugly/i.test(review);
  return JSON.stringify(
    rude
      ? {
          ok: false,
          issue: "insult",
          note: mn ? "Шүүмжлэл зөв, гэхдээ доромжилсон үгийг хасъя. (mock)" : "Your criticism is fair; let's drop the insult. (mock)",
          suggestion: mn
            ? `${review.replace(/[^.!?]*(тэнэг|новш|золиг|муусай)[^.!?]*[.!?]?/gi, "").trim()} Хичээлийн тайлбар надад ойлгомжгүй санагдсан. (mock)`.trim()
            : `${review.replace(/[^.!?]*(stupid|idiot|ugly)[^.!?]*[.!?]?/gi, "").trim()} The explanations were hard for me to follow. (mock)`.trim(),
        }
      : { ok: true, issue: "none", note: "", suggestion: "" },
  );
};

const summaryAnswer = (system: string, user: string): string => {
  const mn = isMn(system);
  const { teacher, averageStars, yesNo } = JSON.parse(user) as { teacher: string; averageStars: number; yesNo: { question: string; yes: number; no: number }[] };
  const top = yesNo.filter((q) => q.yes > q.no).map((q) => q.question).slice(0, 3);
  const low = yesNo.filter((q) => q.no > q.yes).map((q) => q.question).slice(0, 2);
  return JSON.stringify({
    overview: mn
      ? `${teacher} багшийг сурагчид дунджаар ${averageStars}/5 гэж үнэлсэн. Ихэнх нь хичээлийг нь тогтмол хийвэл ойлгомжтой гэж бичжээ. (mock)`
      : `Students give ${teacher} ${averageStars}/5 on average. Most say the class works well if you keep up. (mock)`,
    pros: top.map((q) => (mn ? `Ихэнх нь: ${q} (mock)` : `Most say: ${q} (mock)`)),
    cons: low.map((q) => (mn ? `Цөөхөн нь: ${q} (mock)` : `Few say: ${q} (mock)`)),
    tips: mn ? ["Тэмдэглэлээ өдөр бүр хөтөл. (mock)", "Ойлгоогүй бол хичээлийн дараа асуу. (mock)"] : ["Keep notes every day. (mock)", "Ask after class if you're lost. (mock)"],
  });
};

const guideAnswer = (system: string, user: string): string => {
  const mn = isMn(system);
  const task = JSON.parse(user.replace(/^Task:\s*/, "")) as { title: string; type: string; estimatedMinutes: number };
  const per = Math.max(5, Math.round(task.estimatedMinutes / 4));
  const exam = task.type === "exam";
  return JSON.stringify({
    overview: mn ? `«${task.title}»-г 4 алхамд хуваая. (mock)` : `Let's split “${task.title}” into 4 steps. (mock)`,
    steps: (exam
      ? [["Сэдвээ жагсаа", "List the topics"], ["Сул сэдвээ давт", "Review weak topics"], ["Дасгал ажилла", "Practise"], ["Өөрийгөө шалга", "Self-test"]]
      : [["Шаардлагаа задал", "Break it down"], ["Жишээ хар", "Study an example"], ["Өөрөө гүйцэтгэ", "Do it yourself"], ["Шалга", "Check"]]
    ).map(([m, e], i) => ({
      title: mn ? m : e,
      detail: mn ? "Энэ алхмыг тайван, нэг нэгээр нь хий. (mock)" : "Do this step calmly, one part at a time. (mock)",
      minutes: i === 2 ? per * 2 : per,
    })),
    tips: mn ? ["25 минут ажиллаад 5 минут амар.", "Гацвал доор асуу."] : ["Work 25 minutes, rest 5.", "Stuck? Ask below."],
    checkUnderstanding: mn ? ["Би юуг хамгийн сайн ойлгосон бэ?"] : ["What did I understand best?"],
  });
};

const classifyAnswer = (system: string, user: string): string => {
  const mn = isMn(system);
  const { report, existingGroups, people } = JSON.parse(user) as {
    report: { title: string; description: string; location: string; studentUrgency: string };
    existingGroups: { id: string; title: string; category: string; location: string }[];
    people: { id: string; name: string; role: string; specialties: string[]; rooms: string[] }[];
  };
  const text = `${report.title} ${report.description}`.toLowerCase();
  const category = /проектор|wi-?fi|компьютер|дэлгэц/.test(text) ? "it"
    : /радиатор|хүйтэн|халаалт/.test(text) ? "heating"
    : /ширээ|сандал|цонх|хаалга/.test(text) ? "furniture"
    : /гэрэл|залгуур/.test(text) ? "electric"
    : /цорго|ус|жорлон/.test(text) ? "plumbing"
    : /хог|бохир/.test(text) ? "cleaning" : "other";
  const room = /(\d{3})/.exec(report.location)?.[1];
  const audience = people
    .filter((p) => p.role === "admin" || p.specialties.includes(category) || (room && p.rooms.includes(room)))
    .map((p) => p.id);
  const dup = existingGroups.find((g) => g.category === category && (room ? g.location.includes(room) : g.location.split("·")[0] === report.location.split("·")[0]));
  const names = people.filter((p) => audience.includes(p.id) && p.role !== "admin").map((p) => p.name).join(", ");
  return JSON.stringify({
    category,
    priority: category === "heating" ? "high" : report.studentUrgency,
    audience,
    duplicateOf: dup?.id ?? null,
    reason: mn
      ? `${names || "Захиргаа"}${names ? " болон захиргаа" : ""} харна.${dup ? " Ижил мэдээлэлтэй бүлэглэв." : ""} (mock)`
      : `${names || "The administration"}${names ? " and the administration" : ""} will see it.${dup ? " Grouped with a similar report." : ""} (mock)`,
  });
};

const hintAnswer = (system: string): string =>
  isMn(system)
    ? "Сайн асуулт! Эхлээд даалгавар яг юу асууж байгааг өөрийн үгээр бич. Дараа нь хичээл дээрх төстэй жишээтэй харьцуул. Аль алхам дээр гацаж байна? (mock)"
    : "Good question! First restate what the task asks in your own words, then compare it with a similar example from class. Which step are you stuck on? (mock)";

const answer = (system: string, user: string): string => {
  if (system.includes('"Begin"')) return beginAnswer(system, user);
  if (system.includes("review assistant")) return toneAnswer(system, user);
  if (system.includes("teacher-feedback assistant")) return summaryAnswer(system, user);
  if (system.includes("ProblemHunt")) return classifyAnswer(system, user);
  if (system.includes("step-by-step guide")) return guideAnswer(system, user);
  return hintAnswer(system);
};

createServer(async (req, res) => {
  const url = req.url ?? "";
  const json = (status: number, body: unknown) => {
    res.writeHead(status, { "Content-Type": "application/json" });
    res.end(JSON.stringify(body));
  };
  let raw = "";
  for await (const c of req) raw += c;
  await new Promise((r) => setTimeout(r, 350));

  // Gemini API
  if (url.startsWith("/v1beta/models/")) {
    if (req.method === "GET") return json(200, { name: url.split("/").pop() });
    const body = JSON.parse(raw) as {
      systemInstruction?: { parts: { text: string }[] };
      contents: { role: string; parts: { text?: string }[] }[];
    };
    const system = body.systemInstruction?.parts.map((p) => p.text).join("\n") ?? "";
    const user = body.contents.at(-1)?.parts.map((p) => p.text ?? "").join("") ?? "";
    return json(200, { candidates: [{ content: { parts: [{ text: answer(system, user) }] } }] });
  }
  // OpenAI-compatible
  if (url.endsWith("/models")) return json(200, { data: [process.env.MOCK_MODEL ?? "gemma4:e4b", "gemma-4-31B-it"].map((id) => ({ id })) });
  if (url.endsWith("/chat/completions")) {
    const { messages } = JSON.parse(raw) as { messages: Msg[] };
    const system = messages.find((m) => m.role === "system")?.content ?? "";
    const last = messages.at(-1)!.content;
    const user = typeof last === "string" ? last : (last as unknown as { text?: string }[]).map((p) => p.text ?? "").join("");
    return json(200, { choices: [{ message: { role: "assistant", content: answer(system, user) } }] });
  }
  json(404, {});
}).listen(PORT, () => console.log(`Mock Gemma 4 on http://localhost:${PORT} (Gemini: /v1beta, OpenAI: /v1)`));
