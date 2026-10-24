// AI guides: a step-by-step plan for one task, plus a "stuck? ask" hint chat.
// Students get coaching (method + hints, never the final answer).
// Teachers get practical steps and may get drafted content.

import type { ChatTurn, Guide, GuideStep, Lang, Role, Task } from "../types.ts";
import { asArray, asNumber, asString, clamp, extractJson } from "./json.ts";
import { helpChat, runChat, type ChatFn, type ChatMessage } from "./llm.ts";

const languageName = (lang: Lang): string =>
  lang === "mn" ? "Mongolian (Cyrillic script)" : "English";

const taskBlock = (task: Task): string =>
  JSON.stringify({
    type: task.type,
    title: task.title,
    subject: task.subject,
    description: task.description,
    due: task.dueDate,
    estimatedMinutes: task.estimatedMinutes,
  });

const roleRules = (role: Role): string =>
  role === "student"
    ? [
        "The user is a high-school student doing this task.",
        "Coach, do not do the work: explain the method, give hints, and you may show a worked example on a DIFFERENT, similar problem.",
        "Never give final answers to graded questions and never write the essay or report for them.",
      ].join("\n")
    : [
        role === "teacher" ? "The user is a teacher doing this task." : "The user is school staff doing this task.",
        "Give practical, time-saving steps. You may draft short templates, wording or checklists they can reuse.",
      ].join("\n");

// ---------------------------------------------------------------- fallback

export const fallbackGuide = (task: Task, role: Role, lang: Lang): Guide => {
  const mn = lang === "mn";
  const total = Math.max(15, task.estimatedMinutes);
  const part = (share: number): number => Math.max(5, Math.round((total * share) / 5) * 5);

  const examSteps: GuideStep[] = [
    {
      title: mn ? "Сэдвээ жагсаа" : "List the topics",
      detail: mn ? "Шалгалтад орох сэдвүүдийг бичээд, өөрийгөө 1–5 оноогоор үнэл." : "Write down the exam topics and rate yourself 1–5 on each.",
      minutes: part(0.15),
    },
    {
      title: mn ? "Сул сэдвээ давт" : "Review weak topics",
      detail: mn ? "Хамгийн бага оноотой 2 сэдвийн тэмдэглэл, жишээг дахин үз." : "Go over notes and examples for your two weakest topics.",
      minutes: part(0.35),
    },
    {
      title: mn ? "Дасгал ажилла" : "Practise",
      detail: mn ? "Сэдэв бүрээс 3–4 бодлого бодож, алдаагаа тэмдэглэ." : "Solve 3–4 problems per topic and note your mistakes.",
      minutes: part(0.35),
    },
    {
      title: mn ? "Өөрийгөө шалга" : "Self-test",
      detail: mn ? "Цаг хэмжин жижиг сорил хийж, алдсан хэсгээ дахин үз." : "Do a short timed quiz and revisit what you missed.",
      minutes: part(0.15),
    },
  ];
  const steps: GuideStep[] =
    role === "student" && task.type === "exam"
      ? examSteps
      : role === "student"
      ? [
          {
            title: mn ? "Даалгавраа ойлго" : "Understand the task",
            detail: mn
              ? "Даалгаврыг анхааралтай уншиж, юу хийх ёстойг өөрийн үгээр нэг өгүүлбэрт бич."
              : "Read the task carefully and write in one sentence what you must produce.",
            minutes: part(0.1),
          },
          {
            title: mn ? "Тэмдэглэлээ давт" : "Review your notes",
            detail: mn
              ? "Хичээлийн тэмдэглэл, сурах бичгийн жишээг харж, хэрэгтэй томьёо, дүрмийг тэмдэглэ."
              : "Look at class notes and textbook examples; jot down the rules or formulas you need.",
            minutes: part(0.2),
          },
          {
            title: mn ? "Хийж эхэл" : "Do the main work",
            detail: mn
              ? "Хамгийн хялбар хэсгээс эхэлж, гацвал алгасаад дараа нь эргэж ир."
              : "Start with the easiest part; if you get stuck, skip and come back.",
            minutes: part(0.5),
          },
          {
            title: mn ? "Шалгаж засварла" : "Check and fix",
            detail: mn
              ? "Хариу, бичвэрээ дахин уншиж, алдаа, дутуу хэсгийг засна."
              : "Re-read your work and fix mistakes or missing parts.",
            minutes: part(0.2),
          },
        ]
      : [
          {
            title: mn ? "Хүрээгээ тодорхойл" : "Define the scope",
            detail: mn
              ? "Эцсийн үр дүн ямар байхыг, хэнд зориулагдсаныг тодорхойл."
              : "Decide what the finished result looks like and who it is for.",
            minutes: part(0.15),
          },
          {
            title: mn ? "Материалаа цуглуул" : "Gather materials",
            detail: mn
              ? "Хэрэгтэй өгөгдөл, загвар, өмнөх ажлаа нэг дор цуглуул."
              : "Collect the data, templates and past work you need in one place.",
            minutes: part(0.25),
          },
          {
            title: mn ? "Гүйцэтгэ" : "Do the work",
            detail: mn
              ? "Загвар ашиглан хурдан ноорог гаргаад дараа нь сайжруул."
              : "Use a template to produce a quick draft, then improve it.",
            minutes: part(0.45),
          },
          {
            title: mn ? "Хянаад илгээ" : "Review and send",
            detail: mn
              ? "Нэг удаа хянаж, холбогдох хүмүүст хүргэ."
              : "Review once and deliver it to the right people.",
            minutes: part(0.15),
          },
        ];

  return {
    overview: mn
      ? `«${task.title}»-г ${steps.length} алхамд хуваан хийх ерөнхий төлөвлөгөө. (AI холбогдоогүй үед гарах загвар)`
      : `A general ${steps.length}-step plan for “${task.title}”. (Template shown while AI is offline.)`,
    steps,
    tips: mn
      ? ["25 минут ажиллаад 5 минут амар.", "Утсаа өөр өрөөнд тавь."]
      : ["Work 25 minutes, rest 5.", "Put your phone in another room."],
    checkUnderstanding: mn
      ? ["Би даалгаврын бүх шаардлагыг биелүүлсэн үү?"]
      : ["Did I meet every requirement of the task?"],
    source: "fallback",
    model: "rule-based",
    lang,
    createdAt: new Date().toISOString(),
  };
};

// ---------------------------------------------------------------- guide

export const buildGuideMessages = (task: Task, role: Role, lang: Lang): ChatMessage[] => {
  const system = [
    'You are the learning coach of TaskMind AI, a school system built on erxes.',
    roleRules(role),
    "",
    "Create a step-by-step guide for the task below.",
    '- If type is "exam", make it a study plan: review the topics, practise typical problems, then self-test.',
    "- 3 to 7 steps, in the order they should be done.",
    "- Each step: a short imperative title, 1-3 sentences of concrete detail, and minutes.",
    "- Step minutes should add up to roughly estimatedMinutes.",
    "- 2 to 4 practical tips, and 2 to 3 self-check questions.",
    `Write every human-readable string in ${languageName(lang)}.`,
    "Return ONLY a JSON object, no markdown, in this shape:",
    '{"overview":"<1-2 sentences>","steps":[{"title":"","detail":"","minutes":10}],"tips":[""],"checkUnderstanding":[""]}',
  ].join("\n");

  return [
    { role: "system", content: system },
    { role: "user", content: `Task: ${taskBlock(task)}` },
  ];
};

export const parseGuide = (raw: unknown, task: Task, lang: Lang, model: string): Guide => {
  const obj = (raw ?? {}) as Record<string, unknown>;

  const steps: GuideStep[] = asArray(obj.steps)
    .map((s) => {
      const e = (s ?? {}) as Record<string, unknown>;
      return {
        title: asString(e.title, 120),
        detail: asString(e.detail, 600),
        minutes: Math.round(clamp(asNumber(e.minutes, 10), 1, 240)),
      };
    })
    .filter((s) => s.title)
    .slice(0, 8);

  if (steps.length === 0) throw new Error("AI guide has no steps");

  const strings = (v: unknown, max: number): string[] =>
    asArray(v)
      .map((x) => asString(x, 300))
      .filter(Boolean)
      .slice(0, max);

  return {
    overview: asString(obj.overview, 500) || task.title,
    steps,
    tips: strings(obj.tips, 5),
    checkUnderstanding: strings(obj.checkUnderstanding, 4),
    source: "ai",
    model,
    lang,
    createdAt: new Date().toISOString(),
  };
};

export const generateGuide = async (
  task: Task,
  role: Role,
  lang: Lang,
  chatFn: ChatFn = helpChat,
): Promise<Guide & { error?: string }> => {
  try {
    const c = await runChat(chatFn, buildGuideMessages(task, role, lang), { json: true, temperature: 0.4, maxTokens: 1800 }, "help");
    return parseGuide(extractJson(c.text), task, lang, c.model);
  } catch (e) {
    return { ...fallbackGuide(task, role, lang), error: (e as Error).message };
  }
};

// ---------------------------------------------------------------- hint chat

export const buildAskMessages = (
  task: Task,
  role: Role,
  lang: Lang,
  question: string,
  guide: Guide | undefined,
  history: ChatTurn[],
): ChatMessage[] => {
  const system = [
    'You are the learning coach of TaskMind AI, a school system built on erxes.',
    roleRules(role),
    role === "student"
      ? "Give one hint or explanation that moves the student one step forward. If they ask for the answer, kindly refuse and give a hint instead."
      : "Answer practically. Drafts and templates are welcome.",
    `Reply in ${languageName(lang)}, plain text, at most 120 words.`,
    "",
    `Task: ${taskBlock(task)}`,
    guide ? `Guide steps: ${guide.steps.map((s, i) => `${i + 1}. ${s.title}`).join("; ")}` : "",
  ]
    .filter(Boolean)
    .join("\n");

  const messages: ChatMessage[] = [{ role: "system", content: system }];
  for (const turn of history.slice(-4)) {
    messages.push({ role: "user", content: turn.q });
    messages.push({ role: "assistant", content: turn.a });
  }
  messages.push({ role: "user", content: question });
  return messages;
};

export const askHint = async (
  task: Task,
  role: Role,
  lang: Lang,
  question: string,
  guide: Guide | undefined,
  history: ChatTurn[],
  chatFn: ChatFn = helpChat,
): Promise<ChatTurn & { error?: string }> => {
  const at = new Date().toISOString();
  try {
    const c = await runChat(chatFn, buildAskMessages(task, role, lang, question, guide, history), { temperature: 0.5, maxTokens: 600 }, "help");
    return { q: question, a: c.text.trim().slice(0, 2000), at, source: "ai" };
  } catch (e) {
    const firstStep = guide?.steps[0]?.title;
    const a =
      lang === "mn"
        ? `AI одоогоор холбогдоогүй байна. ${firstStep ? `«${firstStep}» алхмаас дахин эхэлж үз. ` : ""}Тэмдэглэл, сурах бичгийн жишээгээ харж, асуултаа багшдаа илгээгээрэй.`
        : `The AI is offline right now. ${firstStep ? `Try restarting from the step “${firstStep}”. ` : ""}Check your notes and textbook examples, or send the question to your teacher.`;
    return { q: question, a, at, source: "fallback", error: (e as Error).message };
  }
};
