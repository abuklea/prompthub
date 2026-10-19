# PROJECT: PromptHub

<brief>
PromptHub is a centralized repository where users store, organize and manage their AI prompts, with a themeable,
responsive frontend: nested folders, a Monaco editor, version history, tags and full-text search.
</brief>

## Project Variables

Rules files use these `{{VARIABLES}}`: resolve them here, never guess one. This file overrides the other rules
files where they conflict. `[TODO: …]` marks a decision not made yet: ask, or leave it; never invent it.

| Variable | Value |
|---|---|
| `{{PROJECT_NAME}}` | PromptHub |
| `{{AUTHOR}}` | Allan James |
| `{{TIMEZONE}}` | Australia/Brisbane (GMT+10) |
| `{{REPO}}` | abuklea/prompthub |
| `{{WORKSPACE_FOLDER}}` | /home/allan/projects/PromptHub |
| `{{INSTALL_CMD}}` | npm ci |
| `{{TEST_CMD}}` | npm test |
| `{{TYPECHECK_CMD}}` | npx tsc --noEmit |
| `{{LINT_CMD}}` | npm run lint |
| `{{E2E_CMD}}` | none |
| `{{ARCHON_PROJECT_NAME}}` | PromptHub |
| `{{ARCHON_PROJECT_ID}}` | d449f266-1f36-47ad-bd2d-30f1a0f5e999 |
| `{{SUPABASE_PROJECT_ID}}` | xmuysganwxygcsxwteil |
| `{{SUPABASE_PROJECT_URL}}` | https://xmuysganwxygcsxwteil.supabase.co |

- `{{WORKSPACE_FOLDER}}` is the maintainer's local checkout path; other environments differ. Run commands from the
  repository root.
- `{{ARCHON_*}}` serve the Archon import only (#29); Archon is legacy and read-only.
- `{{E2E_CMD}}` is `none`: no e2e runner is configured. Browser flows are verified by hand
  (`status: awaiting-verification`, `type: dev-review`).
- Gates, as `.github/workflows/ci.yml` runs them: `npx prisma validate`, `{{LINT_CMD}}`, `{{TYPECHECK_CMD}}`,
  `{{TEST_CMD}}`, `npm run build`, plus a gitleaks secret scan.
- Design of record: `docs/project/` (MVP `PromptHub_01_MVP_01.md`, tech `PromptHub_05_TECH_01.md`, plan
  `PromptHub_06_PLAN_01.md`). Where this file and the spec disagree, the spec wins and this file is fixed.

### Layout

```text
src/            app/ routes, components/ (ui/ and layout/), features/<name>/ (actions, schemas, components, hooks),
                lib/ (db, supabase clients, rate-limit, ensure-profile), stores/ (Zustand), hooks/, types/, styles/,
                middleware.ts
prisma/         schema.prisma and migrations/
docs/           rules/ (agent rules), guides/, project/ (specs), review/, plans/
PRPs/           PRP specs, templates/, reports/ (INITIAL and REPORT), docs/, complete/
wip/            scratch, test and debug documents (`P#S#T#-…`)
docker/         nginx gateway and Postgres init for the local Docker stack (see docker-compose.yml)
scripts/        copy-monaco.js (postinstall), audit-code-size.sh
supabase/       Supabase CLI link state (.temp/)
.github/        workflows/ci.yml, issue forms, labels.json, board scripts
public/         static assets; public/monaco-editor is copied at install and gitignored
```

## Stack

| Layer | Choice |
|---|---|
| Frontend | Next.js 14 (App Router), React 18, TypeScript (strict), Tailwind CSS, Shadcn/UI (new-york), Framer Motion |
| Backend | Supabase Auth + PostgreSQL accessed through Prisma; Next.js Server Actions; one route handler (`src/app/auth/sign-out`) |
| State | Zustand (global), React Hook Form + Zod (forms), local React state |
| Tests | Vitest (`src/**/*.test.ts`, node environment); coverage scope in `vitest.config.ts` |
| Build | `npm run build` (`prisma generate && next build`); Vercel hosting |
| Local | `npm run dev` on port 3010; `docker-compose.yml` runs Postgres, GoTrue, an nginx gateway and the app |

- Pinned versions: `package.json` and `package-lock.json`. Never upgrade a dependency as a side effect of another task.

## Working Rules

- Use subagents for complex tasks, and parallelize independent work.
- ALWAYS use forward slashes in paths. NEVER put a template variable into a command: substitute its value.
- End every text file with a newline.
- NEVER use mock, dummy or placeholder data outside test suites; no temporary workarounds or bypassed features.
- NEVER keep backwards compatibility: remove the superseded pattern when upgrading.
- NEVER assume a path, module name or API: verify it, and ask when uncertain.
- Design: KISS, YAGNI, DRY (one source of truth), SOLID. Fail fast: check errors early.
- Write the test first (`docs/rules/testing.md`); target 80%+ coverage on the code you change.
- Prefer async/await. Cookie handling in the Supabase server client sits behind synchronous-looking signatures:
  check each call for a missing or misplaced `await`.
- Debounce user-input handlers.
- Done means: goal met, gates pass, docs updated, completion comment on the issue, issue at `status: in-review`.

### Servers

- HMR is active: do not start another dev server. Stop a running server before starting or restarting one.

### Files and documents

| Purpose | Location | Naming |
|---|---|---|
| PRP specs | `PRPs/` | `P#S#-feature-name.md` |
| PRP start and completion reports | `PRPs/reports/` | `*-INITIAL.md`, `*-REPORT.md` (both mandatory per PRP) |
| PRP guides and working documents | `PRPs/docs/` | |
| Scratch, test and debug files | `wip/` | task-code prefix, lower hyphen case: `T417-T420-validation-testing-guide.md` |

| Code type | Convention | Example |
|---|---|---|
| Components | PascalCase.tsx | `ResizablePanelsLayout.tsx` |
| Hooks, stores | `use-*.ts` or `useX.ts`, matching the neighbouring files | `use-tab-store.ts` |
| Server actions | `actions.ts` per feature | `features/auth/actions.ts` |
| Schemas, types | `schemas.ts`, `types.ts` per feature | `features/editor/schemas.ts` |

- Use `// Reason:` comments for non-obvious logic. Source headers follow `docs/rules/documentation.md`.

## Database, Auth and Tenancy

- Administer the remote database with the `supabase` CLI: `supabase link --project-ref {{SUPABASE_PROJECT_ID}}`. The
  developer logs in manually when the CLI is not authenticated.
- NEVER run `supabase start` or create a local Supabase instance; Supabase is cloud-only. The Docker stack under
  `docker/` is the local-development exception.
- ALWAYS test migration up/down cycles before database commits.
- **Auth**: Supabase JWT, validated server-side with `supabase.auth.getUser()`.
- **Tenant isolation (authoritative)**: application code. Every server action authenticates the user and scopes
  every Prisma query with `where: { user_id: user.id }`. Prisma connects with a database role over `DATABASE_URL`,
  so Postgres RLS does not constrain Prisma queries: the application filter is the enforced boundary.
- **RLS (optional defence-in-depth)**: policies live in `wip/P3S1-rls-policies.sql`, outside `prisma migrate`, and
  apply only to connections that carry the end-user JWT (the Supabase client). Treat them as a secondary layer.
- NEVER create triggers on `auth.users` (not permitted on Supabase Cloud). Create `Profile` rows in application code
  with `ensureProfileExists()` (`src/lib/ensure-profile.ts`).
- Rate-limit server actions with `src/lib/rate-limit.ts` (in-memory, single instance; a multi-instance deploy needs a
  shared store).
- Validate every user input with Zod; use Prisma's parameterized queries only.
- Validate required environment variables on startup and fail fast when one is missing.
- NEVER commit secrets or env values.

### Environment variables

Names and purposes (template: `.env.example`; CI supplies placeholders):

| Variable | Purpose |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase client configuration |
| `SUPABASE_SERVICE_ROLE_KEY` | Privileged Supabase access, server only |
| `DATABASE_URL`, `DIRECT_URL` | Prisma pooled and direct connections (`prisma/schema.prisma`) |

## Architecture Constraints

- Server Components by default; Client Components only for interactivity and hooks. Server Actions for mutations.
- NEVER handle a Promise in a Client Component: await it in a Server Component wrapper and pass the resolved values.
- UI colors: CSS variables from the Shadcn theme (`src/styles/globals.css`), NEVER hardcoded colors.
- Every interactive element gives visible hover, press and focus feedback.
- Layouts are modular and responsive, with separate mobile (touch) and desktop (mouse) designs; collapsible sections
  persist their state in localStorage.
- Background work uses interval management with an exit condition: NEVER poll continuously.
- File size follows `docs/rules/code-size.md`: a RED file needs a `split` or `accept` row in the register. Run
  `scripts/audit-code-size.sh` before committing source changes.
- Performance targets: initial load < 2 s, time to interactive < 3 s, Lighthouse > 90.

```typescript
// Isolation pattern: authenticate, then scope EVERY query by user_id.
const { data: { user } } = await supabase.auth.getUser();
if (!user) throw new Error("Unauthorized");

const prompts = await db.prompt.findMany({
  where: { user_id: user.id }, // application-enforced tenant boundary
});
```

## Pre-commit

1. `{{LINT_CMD}}`, `{{TYPECHECK_CMD}}`, `{{TEST_CMD}}`, `npm run build`: all pass.
2. `scripts/audit-code-size.sh` passes.
3. Docs updated; commit with a prefix from `docs/rules/git.md`, or `test:` for test-only changes.
