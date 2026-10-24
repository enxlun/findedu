# Hugjuulai · Сургалтын үйл ажиллагааны систем

A school operations system for erxes with three modules, powered by **Gemma 4** on the **Gemini API** and on **DigitalOcean** serverless inference:

| Module | Flow |
| --- | --- |
| **TaskMind AI**: learning tasks from teachers | Teacher → exam / homework → **TaskMind** → **Begin** (DigitalOcean) → student does it |
| **ProblemHunt**: school problem reports | Student → reports a problem → **ProblemHunt** → the relevant people see it |
| **Багшийн үнэлгээ** (TeacherRate): teacher ratings | Student → rates a teacher anonymously → Gemma 4 checks the tone → classmates read it, Gemma 4 sums it up |

> **MN**
>
> **TaskMind AI** — багшийн өгсөн сургалтын ажлууд:
> - Зөвхөн багш шалгалт, гэрийн даалгавар оруулна.
> - Сурагч өөрт хамаарах ажлуудаа Inbox болон графаар харна.
> - `Begin` хугацаа, ач холбогдол, хамаарлыг тооцож дараагийн ажлыг санал болгоно.
> - AI ажлыг хийх жижиг алхмууд, тайлбар, суралцах тусламж өгнө.
>
> **ProblemHunt** — асуудал мэдээлэх хэсэг:
> - Сурагч сургуулийн асуудлыг мэдээлнэ.
> - Мэдээллийг холбогдох багш, ажилтан, захиргаа харна.
> - AI ангилж, ижил мэдээллийг бүлэглэнэ.
> - Асуудлаас task, төсөл үүсгэхгүй.
>
> **Багшийн үнэлгээ** — сурагч багшаа нэрээ нууцлан үнэлнэ:
> - Од (1–5), хичээл, «тийм / үгүй» асуултууд: ирц авдаг уу, тэмдэглэл шалгадаг уу, дүнгээ шударга, цагт нь гаргадаг уу, ойлгомжтой заадаг уу, даалгавар их өгдөг үү, нэмэлт оноо, багийн ажил, хөгжилтэй эсэх.
> - Бусад сурагч багшийн хуудсаас ордог хичээл, хариултын график, саналуудыг харна. Gemma 4 дүгнэлт гаргана.
> - Илгээхээс өмнө Gemma 4 доромжилсон үгийг шалгаж, эелдэг хувилбар санал болгоно.
> - Багш зөвхөн өөрийн хуудсыг харна (хэн бичсэн нь харагдахгүй). Захиргаа бүгдийг, бичсэн сурагчийн нэртэй харна.
>
> **AI эрэмбэ** — TaskMind Inbox-ыг DigitalOcean дээрх Gemma 4-ийн тооцсон ач холбогдлоор (AI эрэмбэ) эсвэл хугацаагаар эрэмбэлнэ.

Built at **Hacktoberfest Hack Day Ulaanbaatar × erxes Hub** (24 Oct 2026). This folder is the runnable demo. The production target is the `hugjuulai` erxes plugin next to it ([docs/ERXES_INTEGRATION.md](docs/ERXES_INTEGRATION.md)).

---

## Quick start (3 minutes)

Requires **Node.js 22.18+**. TypeScript runs natively, so there's no build step.

```sh
cd demo
npm install
cp .env.example .env    # then open .env and paste the two keys:
#   AI_API_KEY=...   Gemini API key            → https://aistudio.google.com/apikey
#   DO_API_KEY=...   DigitalOcean model access key → control panel › Serverless inference › Model access keys
npm start               # → http://localhost:3000  (use `npm run dev` to restart on file changes)
```

| Key | Gemma 4 model | Used for |
| --- | --- | --- |
| `AI_API_KEY` (Gemini API) | `gemma-4-26b-a4b-it` | small steps, learning help, ProblemHunt, teacher-rating summaries and tone checks |
| `DO_API_KEY` (DigitalOcean) | `gemma-4-31B-it` | prioritization: Begin and the AI-sorted Inbox |

The header shows two dots, "Gemma 4" and "DigitalOcean", green when the key works (on wide screens; hover for the exact error). With only one key, that provider does everything. If a provider fails, the other one is tried, then a rule-based fallback, and the screens say which one answered.

**Troubleshooting**

- **401:** Google AI Studio now issues `AQ.…` auth keys, and some accounts get `401 ACCESS_TOKEN_TYPE_UNSUPPORTED` with them. Create a new key, or a key in another project.
- **429:** the free-tier rate limit. Wait a minute.
- **Bad `.env` line:** it must read `AI_API_KEY=<key>` / `DO_API_KEY=<key>`. A bare key on its own line isn't read.
- **DigitalOcean 401/403:** use a *model access key* from Serverless inference, not a personal access token for the API.
- **"Cannot query field …" in the browser:** the server is older than the page. Stop it (Ctrl+C) and run `npm start` again.

Switch roles from the avatar menu (top right):

| User | Role | Try |
| --- | --- | --- |
| Болд, Сараа, Тэмүүлэн | Student (10А) | TaskMind → **Begin** → **Start**; AI / due-date sort; Graph tab; ProblemHunt → report; Багшийн үнэлгээ → rate a teacher |
| Б. Оюунчимэг, Д. Анар, Г. Батбаяр, Ж. Цэцэгмаа, С. Ганболд, Б. Эрдэнэ | Teacher | TaskMind → **Add exam / homework** (with dependencies); ProblemHunt reports for their rooms; **Миний үнэлгээ** |
| Д. Энхтөр, Г. Мөнхзул, Б. Ганбаатар, О. Дорж | Staff | ProblemHunt reports routed to their specialty |
| Ц. Нарантуяа | Administration | All ProblemHunt reports, grouped; every teacher's ratings with the authors' names |

## How Gemma 4 is used

All calls go through [`server/ai/llm.ts`](server/ai/llm.ts):

- **Gemini API** (`models/gemma-4-26b-a4b-it:generateContent`) with a `systemInstruction`, a `thinkingConfig` (`AI_THINKING=minimal|high`) and, for photos, `inlineData` image parts.
- **DigitalOcean Gradient AI serverless inference** (`POST https://inference.do-ai.run/v1/chat/completions`, `Authorization: Bearer <model access key>`, model `gemma-4-31B-it`, `max_completion_tokens`).

Each job has a provider chain: prioritization tries DigitalOcean first, everything else the Gemini API first; the other provider is the backup, then a rule-based fallback. Every answer is validated.

| Feature | Gemma 4 gets → returns | Guardrails |
| --- | --- | --- |
| **Begin + AI sort** ([begin.ts](server/ai/begin.ts)) · DigitalOcean | Open tasks with hours left, weight, type (exam/homework), difficulty, status, `dependsOn`, `blocked`, `unlocks` → `{next{id, reason, firstStep}, queue[], ranking[{id, score 0–100, why}], summary}` | It may **never** pick a blocked task, and a task never outranks its unfinished prerequisites. The Begin pick is always #1. Prerequisites inherit the deadlines of what they unlock. Tasks the model skipped keep a heuristic score. |
| **Small steps** ([guide.ts](server/ai/guide.ts)) | Task (homework or exam) → `{overview, steps[], tips[], checkUnderstanding[]}` | Exams get a study plan. Students get coaching, not answers. Steps are validated and clamped. |
| **Learning help** | "Explain the idea" / "Similar example" / "Quiz me" or a free question → text | Refuses to hand over answers to graded work. |
| **ProblemHunt** ([problemhunt.ts](server/ai/problemhunt.ts)) | Report (+ photo → Gemma 4 vision), open groups and the staff/teacher directory → `{category, priority, audience[], duplicateOf, reason}` | The administration is always included. Unknown people and groups are dropped. Duplicates join an existing group, which shares one audience and status. **Never creates tasks or projects.** |
| **Tone check** ([teacherrate.ts](server/ai/teacherrate.ts)) | One review → `{ok, issue, note, suggestion}` | Criticism of teaching or grading is never flagged; insults, personal remarks and threats are. The student can post the polite rewrite, edit, or post anyway (the administration then sees an "AI warned" tag). |
| **Teacher summary** | Yes/no counts, stars and up to 25 reviews (no author names) → `{overview, pros[], cons[], tips[]}` | Based only on the reviews; cached until a review is added or removed. Fallback is built from the yes/no percentages. |

Other ways to run Gemma 4: `AI_PROVIDER=openai` with Ollama (`gemma4:e4b`) or vLLM on a DigitalOcean GPU Droplet. See `.env.example`.

## Features

**TaskMind AI**

- Only teachers create work: an **exam** or **homework** item with due date, minutes, importance, class and **dependencies**. Students can't add tasks.
- **Inbox**: unread dots, filters (new / exams / homework / done), a lock on tasks waiting for a prerequisite, and an unread badge in the nav.
- **Graph**: a 7-day load chart (exam days highlighted) and a dependency graph (subject lanes × stages, arrows mean "do this first", the Begin pick glows). Click a node to open it.
- **Begin**: one tap. Gemma 4 picks the next task and gives the reason and a first 5–10 minute step. It also shows the queue after it and what is waiting on what. **Start** opens the task and sets it to "doing".
- **AI help** in the task panel: small steps you can tick off (progress is saved), tips, self-check questions, three learning-help shortcuts and a hint chat.
- **Teacher view**: class progress per task, plus a "needs attention" list (rated hard, asked AI for help, prerequisite not done).
- **Sort**: **AI priority** (the ranking from the last Begin run on DigitalOcean, with #, score and a one-line reason per task) or **by due date**. The note above the list says which provider and model ranked it and when, and warns when new tasks arrived since.

**ProblemHunt**

- Students report a problem: title, building and room, optional category (default "let AI decide"), urgency, an optional photo, and "hide my name" (only the administration sees it).
- **AI sorts and routes** it: category and priority, then **who sees it** (staff by specialty, the teacher who owns the room, always the administration). It **groups duplicates**: three students reporting the cold corridor become one group.
- The result is shown to the student right away: category, who it went to, and whether it was grouped.
- **Teachers, staff and administration** see grouped cards. They can mark them "In review" or "Resolved" (applies to the whole group) and reply to the reporters. Students see the status and replies on their own reports.

**Багшийн үнэлгээ (TeacherRate)**

- **Directory**: every teacher with average stars, number of reviews, top "yes" answers and the classes they teach; search by teacher or class.
- **Teacher page**: stars, yes/no bars (takes attendance, checks notebooks, grades fairly, posts grades on time, explains clearly, lots of homework, extra credit, group work, fun), star distribution, classes taught, **Gemma 4 summary** (strengths, heads-up, how to do well), and the reviews (sort newest / most liked / highest / lowest, like with a heart, share link).
- **Write a review** (students): class, 1–5 stars, yes/no answers, comment. **Gemma 4 checks the tone first** and offers a polite version of an insulting review. One review per student, teacher and class; writing again replaces it.
- **Who sees what**: students see all teachers, anonymously. A teacher sees only their own page, anonymously. The administration sees everything, with the authors' names. Staff don't see ratings.

## Deploy

```sh
# any Docker host, e.g. a DigitalOcean Droplet (no GPU needed with the Gemini API)
AI_API_KEY=<gemini key> DO_API_KEY=<do model access key> docker compose up -d --build   # → http://<host>
```

The `Dockerfile` also works on DigitalOcean App Platform (port 8080); set `AI_API_KEY` and `DO_API_KEY` as env vars there. To run Gemma 4 yourself on a GPU Droplet:

```sh
docker compose --profile local-gemma up -d --build
docker compose exec ollama ollama pull gemma4:e4b
```

Then set `AI_PROVIDER=openai` and `AI_BASE_URL=http://ollama:11434/v1`.

## GraphQL API (erxes-style)

`POST /graphql` (health check: `GET /health`)

| Operation | Who | Purpose |
| --- | --- | --- |
| `hugjuulaiInbox(userId)` | student | Tasks with seen / blocked / unlocks, plus the latest Begin result (with `ranking`) |
| `hugjuulaiBegin(userId, lang)` | student | **Gemma 4 on DigitalOcean**: next-task pick + priority score for every task |
| `hugjuulaiTaskGuide`, `hugjuulaiTaskAsk` | student | **AI small steps, learning help** |
| `hugjuulaiProgressUpdate(…status, difficulty, stepsDone, seen)` | student | Progress and read state |
| `hugjuulaiTaskAdd(userId, doc{type, …, dependsOn})`, `hugjuulaiTaskRemove` | **teacher only** | Give exams and homework |
| `hugjuulaiClassProgress(teacherId)` | teacher | Class progress |
| `hugjuulaiProblemReport(userId, doc, lang)` | **student only** | Report → **Gemma 4 sorts, routes, groups** |
| `hugjuulaiProblems(userId)` | all | Students: their own reports. Teachers and staff: reports sent to them. Administration: everything. |
| `hugjuulaiProblemStatus`, `hugjuulaiProblemNote` | the people a report was sent to | Seen / resolved, and replies (applied to the whole group) |
| `hugjuulaiTeachers(userId)`, `hugjuulaiTeacher(userId, teacherId)` | students, admin; a teacher only themselves | Directory; teacher page with yes/no stats and reviews (author name for admin only) |
| `hugjuulaiReviewSubmit(userId, doc, lang, force)` | **student only** | **Gemma 4 tone check**, then post (or return the suggestion) |
| `hugjuulaiReviewLike`, `hugjuulaiReviewDelete` | student / author or admin | Like toggle; delete |
| `hugjuulaiTeacherSummary(userId, teacherId, lang, regenerate)` | same as the page | **Gemma 4 summary**, cached until reviews change |
| `hugjuulaiAiStatus`, `hugjuulaiDemoReset` | all | Model health (help + prioritization provider); restore demo data |

## Project structure

```
demo/
├── server/
│   ├── main.ts           HTTP: static UI, /vendor (GSAP, fonts), /graphql
│   ├── schema.ts         TaskMind API
│   ├── problems.ts       ProblemHunt API
│   ├── teachers.ts       TeacherRate API
│   ├── store.ts, seed.ts JSON store with demo data (→ Mongoose in the plugin)
│   ├── types.ts
│   └── ai/
│       ├── llm.ts        Gemma 4 client: Gemini API, DigitalOcean, OpenAI-compatible; provider chains
│       ├── begin.ts      Begin + AI ranking: dependency analysis, prompt, validation, fallback
│       ├── guide.ts      small steps + learning help
│       ├── problemhunt.ts  classify, route, group duplicates (+ vision)
│       ├── teacherrate.ts  tone check, teacher summary
│       └── json.ts
├── public/               UI (Hackum design language, GSAP motion, MN/EN)
├── test/                 unit tests, Gemini request-format test, mock Gemma server
└── docs/ERXES_INTEGRATION.md
```

## Tests and rehearsal

```sh
npm test         # Begin + ranking, guides, ProblemHunt, TeacherRate, Gemini & DigitalOcean request formats
npm run check    # strict TypeScript
npm run mock     # stand-in Gemma 4 (answers are marked "(mock)")
AI_API_KEY=mock AI_BASE_URL=http://localhost:11500/v1beta DO_API_KEY=mock DO_BASE_URL=http://localhost:11500/v1 npm start
```

## Demo script (≈3 min)

1. **Teacher** (Б. Оюунчимэг) → TaskMind → **Add exam**, "depends on" both math homeworks → it appears in the class's Inbox.
2. **Student** (Болд) → TaskMind: the new exam is waiting in the Inbox, unread. Press **Begin**. Gemma 4 on DigitalOcean picks the next task (usually the overdue vocabulary task, because it unlocks the essay and the quiz), gives a first step and ranks the whole Inbox (**AI priority**, #1–#9 with reasons). Switch to **By due date** to compare. Press **Start** → small steps, then "Explain the idea".
3. **Graph** tab: the week's load (exam days in yellow) and the dependency graph, with the Begin pick glowing.
4. **ProblemHunt** → report "the corridor radiator is cold" with a photo. Gemma 4 sets heating / urgent, sends it to the plumber and the administration, and groups it with the two earlier reports (#1041).
5. **Staff** (Д. Энхтөр) sees one group of 4 reports, marks it "In review" and replies. **Administration** (Ц. Нарантуяа) sees every group.
6. **Student** → **Багшийн үнэлгээ** → С. Ганболд: yes/no bars, Gemma 4 summary, reviews. **Санал өгөх** with "Энэ багш тэнэг…": Gemma 4 suggests a polite version → post it. **Administration** opens the same page and sees who wrote what; **teacher** С. Ганболд sees only their own page, anonymously.
7. Tech: erxes-style GraphQL, Gemma 4 on two providers (Gemini API with system instruction, thinking and vision; DigitalOcean serverless inference for prioritization), provider fallback chains, rule-based fallbacks, and the plugin port plan.

## License

MIT. See [../LICENSE](../LICENSE). 3D icons: CC0 ([3dicons.co](https://3dicons.co)). GSAP: free under its standard license. Fonts: SIL OFL.
