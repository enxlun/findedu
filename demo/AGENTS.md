# hugjuulai demo

School operations system for erxes (TaskMind AI, ProblemHunt, TeacherRate),
powered by Gemma 4

The runnable stand-in for the `hugjuulai` erxes plugin in `../hugjuulai`, laid
out the same way: `api/` (Node.js 22.18+ running TypeScript directly, graphql-js,
a JSON-file store) and `ui/` (vanilla JS + GSAP, served by the API).
`erxes.json` is the single source of the plugin's identity and API port.

## Commands

- `pnpm install`
- `pnpm start` / `pnpm run dev:api` (http://localhost:3000, UI included)
- `pnpm run check`, `pnpm test`
- `pnpm run mock` (stand-in Gemma 4), `pnpm run reset` (restore demo data)
- `docker compose up -d --build`

Run `check` and `test` before calling a change done.

## Layout

- `api/src/main.ts` serves `/graphql` and `/health` (paths from `erxes.json`)
  and the UI: `ui/public` at `/`, `ui/src` at `/src/`, and GSAP and fonts from
  `ui/node_modules` at `/vendor/`.
- `api/src/graphql/schema.ts` holds the shared types (users, classes, AI
  status, demo reset) and merges every module's `typeDefs` and `resolvers`.
- One folder per module under `api/src/modules/` (`taskmind`, `problemhunt`,
  `teacherrate`): `graphql.ts` (typeDefs + resolvers), `ai/` (prompts,
  validation, rule-based fallbacks) and `db/definitions/` (document types);
  TaskMind's store reads are in `db/models/Tasks.ts`.
- `api/src/ai/llm.ts` is the only Gemma 4 client (Gemini API, DigitalOcean,
  OpenAI-compatible) with per-job provider chains; `ai/json.ts` parses replies.
- `api/src/store.ts` + `seed.ts` are the JSON store (`data/db.json`, gitignored).
  Bump `SEED_VERSION` when the seed's shape changes.
- `ui/src/main.js` renders every view; `ui/src/graphql.js` holds the GraphQL
  documents; strings are in `ui/src/i18n.js` (MN and EN).

## Contracts

- Prefix every GraphQL type with `Hugjuulai` and every root field with
  `hugjuulai`, as the erxes supergraph requires. Modules add fields with
  `extend type Query` / `extend type Mutation`.
- Resolvers take erxes-style `(parent, args, context)`; `main.ts` adapts them
  for graphql-js. The caller passes `userId`; in the plugin it becomes
  `context.user._id`.
- `types.ts`, `ai/` and the modules' `ai/` and `db/definitions/` stay
  framework-free (relative `.ts` imports, `fetch`, no store access) so they
  copy into the plugin unchanged. See `docs/erxes-integration.md`.

## Rules

- No `any` in `api/src`; named exports.
- Keep the visibility rules in the resolvers: anonymous reporters and review
  authors stay hidden from everyone except the administration; only teachers
  create tasks; a teacher opens only their own TeacherRate page.
- Every Gemma 4 answer is validated, and every AI feature has a rule-based
  fallback; the UI says which provider answered.
- Add new UI strings to both languages in `ui/src/i18n.js`.
