# Moving the demo into the `hugjuulai` erxes plugin

The plugin scaffold in `../hugjuulai` (erxes 3.3.2 baseline) runs as an external
plugin: `api/` uses `erxes-api-shared` `startPlugin` with tenant-scoped Mongoose
models, and `ui/` is a React 18 Module Federation remote. The demo already uses
the same layout (`erxes.json`, a pnpm workspace with `api/` and `ui/`,
`api/src/graphql/schema.ts`, `api/src/modules/<module>/…`), so the port is
mostly copying files and swapping the data layer.

## What maps to what

| Demo | Plugin |
| --- | --- |
| `api/src/ai/*.ts`, `api/src/modules/*/ai/*.ts` | same paths (copy unchanged; relative `.ts` imports and `fetch` only) |
| `api/src/types.ts`, `api/src/modules/*/db/definitions/*.ts` | same files, plus a Mongoose schema per collection wrapped with `schemaWrapper(...)` |
| `api/src/store.ts` (JSON), `api/src/modules/taskmind/db/models/Tasks.ts` | Mongoose models in `api/src/modules/*/db/models/`, registered in `connectionResolvers.ts` |
| `api/src/graphql/schema.ts` + `api/src/modules/*/graphql.ts` | same; types are already prefixed `Hugjuulai` |
| `api/src/main.ts` (node:http + graphql-js) | `startPlugin` in `api/src/main.ts` |
| `api/src/config.ts` | `api/src/config.ts` (zod-validated env) |
| `userId` argument | `context.user._id` |
| role checks in resolvers | `await checkPermission(...)` + actions in `permissions.ts` |
| `AI_*`, `DO_*` env vars | the plugin's `.env` (API process): `AI_API_KEY` + `AI_MODEL=gemma-4-26b-a4b-it` (Gemini API), `DO_API_KEY` + `DO_MODEL=gemma-4-31B-it` (DigitalOcean, prioritization) |
| `ui/src/main.js` views | React components in `ui/src/modules/…` and `ui/src/pages/…` with `erxes-ui` and the `hugjuulai:` Tailwind prefix |
| `ui/src/graphql.js` documents | `gql()` documents from `~/gql` (codegen) |

## Collections

- `hugjuulai_tasks`: type (`homework` | `exam`), title, description, subject, dueDate, estimatedMinutes, weight, **dependsOn[]**, createdBy, classId.
- `hugjuulai_task_progress`: taskId, userId, status, difficulty, **seenAt**, stepsDone[], chat[], guide. Unique index on `{ taskId, userId }`.
- `hugjuulai_begin_plans`: the latest Begin result per student, including `ranking[{taskId, score, reason}]` and `provider`.
- `hugjuulai_problems`: number, title, description, location, category, priority, urgency, status (`new` | `seen` | `resolved`), anonymous, photo (use erxes file upload), reportedBy, **audience[]**, **groupId**, ai{reason, source, model}, history[]. Index `{ groupId: 1 }` and `{ audience: 1, status: 1 }`.

- `hugjuulai_teacher_reviews`: teacherId, authorId, subject, rating, traits{attendance, notes, fairGrades, gradesOnTime, clear, homework, extraCredit, teamwork, fun}, text, likes[], flagged. Unique index on `{ teacherId, authorId, subject }`.
- `hugjuulai_teacher_summaries`: teacherId, lang, hash of the reviews it was made from, overview, pros[], cons[], tips[], model.

Wrap each schema with `schemaWrapper(...)` and add the models to `IModels` / `loadClasses`.

## Permissions

| Action | Who |
| --- | --- |
| `hugjuulaiTasksManage` | teachers: add or remove exams and homework (only teachers create tasks) |
| `hugjuulaiTasksStudy` | students: inbox, Begin, guides, progress |
| `hugjuulaiProblemsReport` | students: report a problem |
| `hugjuulaiProblemsHandle` | teachers and staff: see the reports routed to them, change status, reply |
| `hugjuulaiProblemsAll` | administration: see every report |
| `hugjuulaiTeachersRate` | students: rate teachers, like reviews |
| `hugjuulaiTeachersOwn` | teachers: see their own ratings (anonymous) |
| `hugjuulaiTeachersAll` | administration: all ratings with authors, delete reviews |

Keep the visibility rules in the resolvers: anonymous reporters and review authors stay hidden from everyone except the administration, and a teacher can only open their own TeacherRate page.

## Students and people

Teachers, staff and the administration are erxes team members. Store a staff
member's `specialties` and a teacher's `rooms` and `courses` as team-member custom fields;
ProblemHunt routing reads them. Students can be erxes Contacts (customers) with a
`classId` custom field, reaching TaskMind and ProblemHunt through the erxes Client
Portal. Until then, the standalone demo UI serves as the student view.

## What ProblemHunt deliberately does not do

Following the product decision, reports are never turned into tasks, projects or
volunteer teams. The only actions are: route to the right people, group duplicates,
mark seen or resolved, and reply to the reporters.
