# PromptHub
## P7S2 - Server-side Security Hardening

| `Title` | `Created` | `Last modified` |
|---------|-----------|-----------------|
| P7S2 - Server-side Security Hardening | 29/10/2026 16:55 GMT+10 | 29/10/2026 17:58 GMT+10 |

## Table of Contents
- [Goal](#goal)
- [Why](#why)
- [What](#what)
  - [Success Criteria](#success-criteria)
- [Decisions](#decisions)
- [All Needed Context](#all-needed-context)
- [Implementation Blueprint](#implementation-blueprint)
  - [Data models and structure](#data-models-and-structure)
  - [Tasks](#tasks)
  - [Task List](#task-list)
  - [Integration Points](#integration-points)
- [Validation Loop](#validation-loop)
  - [Level 1: syntax and style](#level-1-syntax-and-style)
  - [Level 2: unit and Postgres-backed tests](#level-2-unit-and-postgres-backed-tests)
  - [Level 3: build and browser](#level-3-build-and-browser)
- [Final Validation Checklist](#final-validation-checklist)
- [Anti-Patterns to Avoid](#anti-patterns-to-avoid)
- [Confidence](#confidence)

## Goal

After this PRP every server action validates its input with Zod, authenticates the caller, enforces ownership of every
row it reads, writes or references in the statement or transaction that touches it, returns `ActionResult` (except
`signOut`, which redirects), and is rate-limited when it mutates. The database refuses a folder under another user's
folder and a prompt in another user's folder. Each of the 22 actions that touch tenant data has a cross-user isolation
test that runs against a real Postgres in CI, a rule requires one for every new action, and no server-only helper is
callable as an action. Sign-out asks before it discards unsaved work, then clears every client-side trace of the
previous user, and deleting a folder closes the tab of every document it removes, in sub-folders too.

## Why

Epic #39 states the outcome. Application code is the enforced tenant boundary, because Prisma connects with a role that
bypasses row-level security (`docs/rules/project.md#database-auth-and-tenancy`), so one missed check is a cross-tenant
defect. Research on 26/10/2026 and 27/10/2026 ([notes](../wip/P7S2-research-notes.md),
[drift register](../wip/P7S2-research-drift.md)) measured `481aae9`; the counts below were re-checked on `bff5fa6` on
29/10/2026. Eight modules carry `"use server"` and export 27 functions, 23 of which touch tenant data. Thirteen skip
Zod, eleven do not return `ActionResult`, and four are rate-limited (`signIn`, `signUp`, `createPrompt`,
`saveNewVersion`). `assignTagsToPrompt` checks ownership and then updates by `id` alone
(`src/features/prompts/actions.ts:588`). `createPrompt` and `createFolder` write a `folderId` and a `parentId` nobody
checked; the foreign keys reference `Folder.id` alone, so a prompt can be attached to another user's folder, which needs
that user's UUID (finding F-2). `ensureProfileExists(userId)` is a `"use server"` module: it was absent from the
22/10/2026 action manifest (26 ids), but the research showed that importing any action module from a Server Component
registers every export of it, and one added import made it a public endpoint that creates a `Profile` for any id (F-3).
`signIn` and `signUp` pass the raw client object to Supabase and return its message verbatim (F-4).

No test imports an action. The only isolation tests sit below the action layer, in the P7S1 editor service suites
(`src/features/editor/service.save.test.ts:169`). Issue #45 proposed stubbing auth "at `createClient`", which
`docs/rules/testing.md#rules` forbids. The developer chose an injected seam instead (Q1): each action body becomes a
plain-module function of `(deps, input)`, the `"use server"` export a one-line wrapper, and a test drives the body with
the real test database and a fake `getUser`. That rewrites every action, so the PRP also takes the split of
`src/features/prompts/actions.ts` (#51, the one RED file here, 674 lines) and the rate limit on every mutation (the part
of #48 that needs no shared store): all three touch the same code. On 29/10/2026 the developer also chose to add
composite foreign keys now (the database refuses what the application checks), to ask before a sign-out discards unsaved
work, and to give saves their own rate-limit bucket.

Not done, and not verified. The wrappers, `action-runtime.ts` and the cookie wiring have no unit test, and none of the
build, manifest and browser checks has been run. The limiter stays in memory, per instance (#48 keeps the shared
store). Count and byte caps (F-1) are filed under #47. The composite keys cover folders and prompts only; tags stay
application-checked, and applying the migration to Supabase is the developer's step. A session that expires without
the sign-out button leaves drafts on disk, and the sign-out check covers the current browser tab only. Whether the
cloud GoTrue sends the `AuthError.code` values the auth messages use is unverified.

## What

| Defect | Today | After | Issue |
|---|---|---|---|
| A helper is an action | `ensure-profile.ts` is `"use server"`, takes any `userId`, reads then creates | A `server-only` module taking `(db, userId)`; one `createMany` with `skipDuplicates`; a 50-call concurrency test | #40 |
| Inputs unchecked | 13 actions parse nothing or only as a type; unbounded `validatePrompts`; no name caps | Every action parses with Zod, returns a fixed message, caps names and lists | #41, #42 |
| Foreign rows referenced | `createPrompt`, `createFolder` write an unchecked `folderId` or `parentId` | Owner checked in the writing transaction, and composite foreign keys refuse it in the database (F-2) | #41 |
| Unscoped write | `assignTagsToPrompt` updates by `id` after a separate check | One transaction; `update` where `{ id, user_id }` | #41 |
| Auth input passes through | Raw object to Supabase; its message returned | Only `{ email, password }` reaches Supabase; fixed messages | #42 |
| Folder actions throw | Callers rely on `catch` | `ActionResult`; callers branch on `success` | #41 |
| Tabs left open | `deleteFolder` returns the prompts directly in the folder | Returns every folder and prompt id of the tree; tabs and workspace caches close | #43 |
| Sign-out leaves state | Only the document cache is cleared | Confirm if work is unsaved, then one purge of caches, `prompt-` drafts, tabs and selection | #44 |
| Dead route | `POST /auth/sign-out` has no caller | Deleted | Q6 |
| Mutations unlimited | 4 of 27 limited | Every mutation limited: saves their own bucket, autosave 240 a minute, the rest 30 | #48 (part) |
| One RED file | `prompts/actions.ts`, 674 lines, nine `NEXT_REDIRECT` rethrows (eleven with `editor/actions.ts`) | Four action files over handlers; one rethrow | #51 |
| No action tests | None import an action | An isolation test per tenant action, in CI, enforced by a rule | #45 |

### Success Criteria
- [ ] `ensure-profile.ts` has no `"use server"`, imports `server-only`, and 50 concurrent first calls for one id succeed
  and leave one row
- [ ] 24 of the 25 remaining actions are wrappers over handlers of `(deps, input)` (`signOut` keeps its body); each
  handler module imports `server-only`; no handler imports `@/lib/db`, `action-runtime.ts` or the Supabase client
- [ ] A wrong input shape returns a fixed message without reaching the database; every action but `signOut` returns
  `ActionResult`, and the dashboard page renders zeros when `getDashboardMetrics` fails
- [ ] User B calling any of the 22 tenant actions with A's ids gets what a missing id gets, A's rows are unchanged, and
  the test is titled `"<action>: user B ..."`
- [ ] `createPrompt` and `createFolder` refuse a folder or parent the user does not own and write nothing, and the
  database rejects the same rows if written directly; `assignTagsToPrompt` writes with `update` where `{ id, user_id }`
- [ ] `signIn` and `signUp` pass exactly `{ email, password }` to Supabase and return only fixed messages
- [ ] Deleting X with descendants Y and Z returns all folder and prompt ids; the callers close every tab and drop every
  workspace-cache entry
- [ ] The 31st `saveNewVersion` or `restorePromptVersion` in a minute is refused independently of the 31st other
  mutation; autosave allows 240
- [ ] With unsaved work (a dirty tab or a `prompt-` key) Sign Out asks first and Cancel changes nothing; confirmed, or
  with nothing unsaved, it leaves no `prompt-` key, empty caches, no tabs (on disk too) and a reset selection; the
  settings key survives; the workspace cache returns nothing once another user is bound
- [ ] `src/app/auth/sign-out/route.ts` is gone; `prompts/actions.ts` is under 300 lines with no register row
- [ ] `docs/rules/testing.md` requires an isolation test per new action and `action-coverage.test.ts` enforces it
- [ ] Every CI gate passes, no lint warning is added, each new file in the coverage scope reaches 80% on every measure,
  and every drift-register row is fixed or filed

## Decisions

The developer took Q1 to Q7 on 27/10/2026 and the decisions marked 29/10/2026 on that date; those replace the planner's
earlier D4, D5, D9 and Q8 default. The planner's other decisions were not put to him. Reasons and code: the contracts.

| Decision | What it fixes | Status |
|---|---|---|
| Q1 Injected seam | Handler `(deps, input)` with deps `getUser` and `db`; wrapper one line; tests use `src/test/db.ts` and a fake `getUser` | developer, 27/10/2026 |
| Q2 #51 pulled in | The `prompts/actions.ts` split and one `NEXT_REDIRECT` rethrow | developer, 27/10/2026 |
| Q3 Rate limits now | Every mutation is limited in memory; #48 keeps the shared store | developer, 27/10/2026 |
| Q4 Every action | Zod and `ActionResult` for every action; strict on 29/10/2026: `getDashboardMetrics` too, only `signOut` excepted | developer, 27/10 and 29/10/2026 |
| Q5 `server-only` | The package is added, with a Vitest alias | developer, 27/10/2026 |
| Q6 Delete the route | `src/app/auth/sign-out/route.ts` removed | developer, 27/10/2026 |
| Q7 Tabs purged | The purge also clears the tab store | developer, 27/10/2026 |
| Q8 Database keys now | Unique `(id, user_id)` on `Folder` and composite keys on `parent_id` and `folder_id` (Task 13), after a read-only audit; auditing and migrating Supabase is the developer's (Task 16); violating rows make the migration fail until cleaned | developer, 29/10/2026 |
| D1 `runAction` | One runner: parse, authenticate, limit, profile, run, catch; it rethrows any error with a string `digest`; modules named `handlers.ts` | planner |
| D2 Arguments | Positional arguments become one object; `signOut` keeps its own shape and body | planner |
| D3 `searchPrompts` | Only `getPromptsByFolder` calls it (searched 29/10/2026): it stops being an action, leaving 25 | planner |
| D4 Limits | `saveNewVersion` and `restorePromptVersion` share their own 30-a-minute bucket via `createRateLimiter`; other mutations share the existing 30; autosave 240 | developer, 29/10/2026 |
| D5 Workspace cache | #44 accepted as "bind the cache to one viewer", not a user parameter on each getter | developer, 29/10/2026 |
| D6-D8 Caps, auth text, UI reset | Name caps 100, title 200, 200 ids (server-side only); fixed auth messages; the purge also resets the UI selection (beyond #44's text) | planner |
| D9 Profile insert | `createMany` with `skipDuplicates`, not the `update: { id }` upsert of #40's wording | developer, 29/10/2026 |
| D10 Sign-out asks first | If any tab is dirty or any `prompt-` key exists, confirm before purging; other browser tabs are not covered | developer, 29/10/2026 |

## All Needed Context

Per-task detail is in [the briefs](docs/P7S2-task-briefs.md#briefs), interfaces and per-action rules in
[the action contracts](docs/P7S2-action-contracts.md) and [the domain contracts](docs/P7S2-domain-contracts.md), the
trees and the call sites in [the context](docs/P7S2-task-context.md); Tasks 8 to 16 are in
[the second briefs file](docs/P7S2-task-briefs-2.md#briefs). Read your task's section and the source it cites, and
check each cited path against the code first.

```yaml
# MUST READ
- url: https://nextjs.org/docs/14/app/building-your-application/rendering/composition-patterns
  why: "Keeping Server-only Code out of the Client Environment": npm install server-only, import it in the module
  critical: Opened 29/10/2026. A Client Component importing such a module is a build error; a type-only import is erased

- file: src/features/editor/service.ts
  why: The pattern to mirror - (db, userId, input), no "use server", one NOT_FOUND text, scoped updateMany as the check
  critical: Task 1 adds import "server-only" to it; src/features/editor/actions.ts shows the order the runner keeps

- file: src/test/db.ts
  why: describeDb, useTestDatabase, createTestUser, createTestPrompt, and the guard against a non-disposable URL
  critical: Tag has no relation to Profile, so deleting a profile leaves its tags; the guard rejects only host, hostaddr, port

- file: src/features/prompts/actions.ts
  why: 12 actions to split; line 588 unscoped write; 143-150 unchecked folder; 398 raw query
  critical: Task 6 deletes the eslint-disable max-lines comment and the register row (reportUnusedDisableDirectives is on)

- file: src/features/folders/actions.ts
  why: Five throwing actions with no schema; lines 79-103 the shallow prompt-id read
  critical: The three folder components rely on thrown errors; src/features/auth/actions.ts keeps signOut's body

- file: src/features/workspace/cache.ts
  why: The stored userId is never checked; removeFolderFromCache leaves descendants
  critical: useActiveTabFolderSync.test.tsx hydrates it for user-1 with nothing bound and must pass unedited

- file: prisma/schema.prisma
  why: Folder.parent (line 26) and Prompt.folder (line 45) reference Folder.id alone; Tag.user_id is a plain string
  critical: A scratch copy with the composite keys validated on 29/10/2026; the SQL is in the domain contracts

- docfile: wip/P7S2-research-drift.md
  why: 26 rows; Task 15 fixes DR-4, DR-5, DR-21 first, Task 12 the rest; docs/rules/testing.md line 43 bans module mocks
```

```text
# CRITICAL gotchas (verified in the code or by the 26/10/2026 research unless marked)
# - A "use server" file may export only async functions (types are erased). A non-async export fails the build, an
#   async one is a public endpoint. Helpers, deps, constants and the digest check live in plain modules.
# - Importing ANY export of an action module from a Server Component registers EVERY export of it
#   (src/app/(app)/dashboard/page.tsx imports getDashboardMetrics this way).
# - cookies() throws outside a request and Next 14.2 has no test utility for it: only action-runtime.ts calls
#   createClient(), inside getUser, never at module load. await getUser(): the Supabase server client hides cookies
#   behind synchronous-looking signatures.
# - Next control-flow errors (redirect, notFound, dynamic usage) carry a string digest (NEXT_REDIRECT;...,
#   NEXT_NOT_FOUND, DYNAMIC_SERVER_USAGE; read in node_modules/next/dist/client/components). The runner rethrows them.
# - Zod 3.25.76: .trim() BEFORE .min()/.max(); .uuid() accepts any version and upper case; a nullable parentId needs
#   .nullable(); a schema with .default() needs the three-argument ZodType for its input type.
# - server-only: Next aliases the bare import at build time, tsc does not resolve it, and under Vitest its default
#   export throws. Alias to node_modules/server-only/empty.js (named under the "react-server" export condition, from
#   npm view; the file is UNVERIFIED until installed). A global react-server condition would break the jsdom suites.
# - Prisma 6.19.0 upsert({ update: {} }) fell back to SELECT then INSERT and raced (seen 26/10/2026, undocumented), so
#   ensureProfileExists uses createMany with skipDuplicates. updateMany cannot set a relation; the scoped form is
#   update({ where: { id, user_id } }), which raises P2025 for no match.
# - Composite keys: Postgres skips a composite FK with a NULL column, so root folders and unfiled prompts stay valid.
#   How the generated Prisma Client handles the partly nullable relation is UNVERIFIED (no client was generated).
# - Folder.parent and Prompt.folder cascade, so deleteFolder reads the tree BEFORE the delete (domain contracts).
# - Never edit an existing test to make a change pass (testing.md). New suites go in new files.
# - Parallel worktrees share one TEST_DATABASE_URL: every suite makes its own users; the pool is capped (Task 3).
```

## Implementation Blueprint

### Data models and structure

The Prisma schema changes only in Task 13 (composite keys); the seam and the schemas are new types, in full in
[the contracts](docs/P7S2-action-contracts.md#the-seam), with the flow diagram. In brief: `ActionDeps` is `{ getUser, db }`
and `getUser` yields `{ id, email }`; a handler calls `runAction(deps, spec, data)`, where the spec holds the schema, the
two messages, the limit class (`mutation`, `save`, `autosave`, `none`) and a `run({ db, user, input })` body; the runner
fixes the order parse, authenticate, limit, profile, run, catch.

### Tasks

```yaml
Task 15 (documentation-manager): correct the agent definitions - runs FIRST        # DR-4, DR-5, DR-21
MODIFY .claude/agents/{senior-backend-engineer,qa-test-automation-engineer}.md and the .gemini/agents copies

Task 1 (senior-backend-engineer): server-only and ensureProfileExists              # #40, Q5
MODIFY package.json, package-lock.json: npm install server-only (the only dependency change)
MODIFY vitest.config.ts: alias for server-only; coverage patterns for every later file
MODIFY src/lib/ensure-profile.ts (no directive, server-only, (db, userId), createMany) and src/features/editor/service.ts
MODIFY the four action files: the call sites take (db, id); CREATE server-only-alias.test.ts, ensure-profile.test.ts

Task 2 (senior-backend-engineer): the seam and the limits                           # Q1, #48 part
CREATE src/lib/action-runner.ts, action-runtime.ts, prisma-errors.ts and their tests
MODIFY src/lib/rate-limit.ts: checkSaveRateLimit, checkAutosaveRateLimit; CREATE rate-limit.autosave.test.ts

Task 3 (qa-test-automation-engineer): test factories, fake deps, pool cap           # #45
MODIFY src/test/db.ts: createTestFolder (parentId), createTestTag, deleteTestUser, createTestPrompt (folderId), pool cap
CREATE src/test/action-deps.ts, racing-db.ts, db.helpers.test.ts

Task 4 [P] (senior-backend-engineer): signIn and signUp                             # #42, F-4
CREATE src/features/auth/handlers.ts, handlers.test.ts; MODIFY actions.ts (wrappers)

Task 5 [P] (backend, then senior-frontend-engineer): folders                        # #41, #43, F-2, F-6
CREATE folders/schemas.ts, handlers.ts, handlers.test.ts, handlers.isolation.test.ts; MODIFY actions.ts
MODIFY FolderItem, FolderTree, FolderToolbar; workspace/cache.ts (removeFolderTreeFromCache) + cache.tree.test.ts

Task 6 [P] (backend, then frontend): prompt CRUD and listing                        # #41, F-2, DR-18, DR-19
MODIFY prompts/schemas.ts, actions.ts; CREATE handlers.ts, search-handlers.ts and tests
DELETE the max-lines eslint-disable and the code-size register row; MODIFY PromptList, DocumentToolbar, DocumentTab, use-tab-cleanup

Task 7 (backend, then frontend): tags, history and the rest of the split            # #41, #51, DR-20; after Task 6
CREATE tag-handlers.ts, tag-actions.ts, history-handlers.ts, history-actions.ts and four test files
MODIFY prompts/actions.ts (delete moved code); callers DocumentToolbar (tags), EditorPane (history imports)

Task 8 [P] (backend, then frontend): editor, profile, workspace, dashboard          # Q3, Q4
CREATE handlers.ts and both test files in each feature; profile/schemas.ts; MODIFY the four actions.ts
MODIFY profile/page.tsx, dashboard/page.tsx, WorkspacePreloader.tsx

Task 9 (senior-frontend-engineer): sign-out purge and the route                     # #44, Q6, Q7, F-7, F-8
MODIFY workspace/cache.ts (bindWorkspaceCacheViewer, clearWorkspaceCache); CREATE cache.test.ts
CREATE auth/client-purge.ts and client-purge.test.ts (jsdom, real localStorage)
MODIFY use-tab-store.ts (resetTabs), tabs/types.ts, use-ui-store.ts (resetSession), Header.tsx, WorkspacePreloader.tsx,
       src/app/(app)/layout.tsx (userId prop); DELETE src/app/auth/sign-out/route.ts

Task 10 (qa-test-automation-engineer): isolation coverage rule                      # #45
CREATE src/test/action-coverage.ts (pure checker) and two test files; MODIFY docs/rules/testing.md

Task 11 (security-analyst): read-only review of the final tree; findings to the main session
Task 12 (documentation-manager): the remaining drift rows, headers, register, README, rules
Task 13 (senior-backend-engineer): composite tenant keys                            # Q8
MODIFY prisma/schema.prisma; CREATE the generated migration and src/test/composite-fk.test.ts
Task 14 (senior-frontend-engineer): ask before signing out with unsaved work        # D10
MODIFY auth/client-purge.ts, Header.tsx; CREATE client-purge.unsaved.test.ts
Task 16 (developer, type: dev-review): #46 rotation; audit and apply the migration on Supabase; browser checks
```

The red tests, files and done-when conditions of each task are in [the briefs](docs/P7S2-task-briefs.md#briefs).

### Task List

Fifteen agent tasks of 0.5 to 4 hours, each ending with every gate green, so every commit is a working state. Task 15
runs first (at INITIAL). A task with a frontend step is one commit:
the backend step leaves `tsc` failing until the callers are updated, so both run in one worktree. `[P]` tasks touch
disjoint files and run in separate worktrees once Task 3 is merged. Task 7 follows Task 6 (both edit
`prompts/actions.ts`); Task 9 follows Tasks 4, 5 and 8 (all edit `auth/actions.ts`, `cache.ts` or
`WorkspacePreloader.tsx`). Hours are estimates.

| Task | Title | Agent | Hours | After | [P] | Issues |
|---|---|---|---|---|---|---|
| P7S2T1 | Add server-only and fix ensureProfileExists | `senior-backend-engineer` | 3 | T15 | | #40 |
| P7S2T2 | Add the action seam and the autosave limit | `senior-backend-engineer` | 3 | T1 | | #48 (part), #45 |
| P7S2T3 | Add the test factories and the fake deps | `qa-test-automation-engineer` | 2.5 | T2 | | #45 |
| P7S2T4 | Validate and sanitise signIn and signUp | `senior-backend-engineer` | 3 | T3 | with T5, T6, T8 | #42 |
| P7S2T5 | Harden the folder actions and close the tabs of a deleted tree | `senior-backend-engineer`, `senior-frontend-engineer` | 4 | T3 | with T4, T6, T8 | #41, #43 |
| P7S2T6 | Harden the prompt CRUD and listing actions | `senior-backend-engineer`, `senior-frontend-engineer` | 4 | T3 | with T4, T5, T8 | #41 |
| P7S2T7 | Split the rest of prompts/actions.ts and harden tags and history | `senior-backend-engineer`, `senior-frontend-engineer` | 4 | T6 | | #41, #51 |
| P7S2T8 | Move the editor, profile, workspace and dashboard actions onto the seam | `senior-backend-engineer`, `senior-frontend-engineer` | 3.5 | T3 | with T4, T5, T6 | #48 (part) |
| P7S2T9 | Purge client state on sign-out and delete the sign-out route | `senior-frontend-engineer` | 4 | T4, T5, T8 | | #44 |
| P7S2T10 | Isolation coverage rule | `qa-test-automation-engineer` | 2.5 | T4 to T8 | | #45 |
| P7S2T11 | Independent security review | `security-analyst` | 1.5 | T9, T10, T13, T14 | | #39 |
| P7S2T12 | Sweep the documentation | `documentation-manager` | 2.5 | T11 | | #39, #45 |
| P7S2T13 | Add composite tenant keys | `senior-backend-engineer` | 3.5 | T5, T6 | | #41 |
| P7S2T14 | Ask before signing out with unsaved work | `senior-frontend-engineer` | 1.5 | T9 | | #44 |
| P7S2T15 | Correct the agent definitions | `documentation-manager` | 0.5 | none (first) | | #39 |
| P7S2T16 | Developer checks (`type: dev-review`) | developer | 1.5 | T12 | | #46, new |

The main session provisions the test database before it dispatches T1 to T10 and T13, and alone edits issues. The INITIAL
report files the epic's task issues and the dev-review issue, comments on #40 to #45, #48 and #51 (the rate-limit part of
#48 only; its shared store stays open), and files the follow-ups: count and byte caps (F-1, under #47), a purge on
session expiry, and tag ownership in the database (an explicit join model).

### Integration Points

Task 13 adds one migration (applied locally from scratch; Supabase is the developer's, Task 16). `package.json` gains
`server-only`; `vitest.config.ts` gains the alias and the coverage scope; no environment variable, no CI step (only the
`ci.yml` comment changes); the sign-out route is deleted in Task 9.

## Validation Loop

Run from the repository root, never after a `cd`. The Prisma and build steps need the placeholder values CI sets.
Measured on 29/10/2026 at `bff5fa6`, before any change: `npm test` printed `Test Files  30 passed | 2 skipped (32)` and
`Tests  340 passed | 29 skipped (369)` without a database; `tsc` exited 0; `npm run lint` printed 15
`max-lines-per-function` warnings; the audit printed source GREEN 99, YELLOW 2, RED 1, test GREEN 38, YELLOW 2, RED 0,
PASS.

### Level 1: syntax and style

```bash
DATABASE_URL=postgresql://user:pass@localhost:5432/db DIRECT_URL=postgresql://user:pass@localhost:5432/db npx prisma generate
DATABASE_URL=postgresql://user:pass@localhost:5432/db DIRECT_URL=postgresql://user:pass@localhost:5432/db npx prisma validate
npm run lint
npx tsc --noEmit
bash scripts/audit-code-size.sh --summary
# Expected: no errors; at most 15 lint warnings; from Task 6 on, RED 0 and no register row
```

### Level 2: unit and Postgres-backed tests

```bash
npm test   # without TEST_DATABASE_URL the Postgres suites are skipped; the action-coverage rule still runs

# The db service of docker-compose.yml publishes Postgres on host port 54322; set PGUSER and PGPASSWORD to its
# POSTGRES_USER and POSTGRES_PASSWORD. The main session runs these; an agent creates no role or database. The name must
# contain "test" and the host be loopback (src/test/db.ts refuses otherwise). Local Docker only, never Supabase.
docker compose up -d --wait db
docker compose exec db createdb -U "$PGUSER" prompthub_test || true   # "already exists" is fine
export TEST_DATABASE_URL="postgresql://$PGUSER:$PGPASSWORD@localhost:54322/prompthub_test"
DATABASE_URL="$TEST_DATABASE_URL" DIRECT_URL="$TEST_DATABASE_URL" npx prisma migrate deploy
npm test
npx vitest run src/features/folders   # one area while working
npx vitest run --coverage --coverage.include=src/features/folders/handlers.ts --coverage.reporter=json-summary
```

Read `coverage/coverage-summary.json`, not the text table. A cloud session without Docker follows
[the P7S1 database recipe](docs/P7S1-task-context.md#environment-for-database-tests). CI runs the suites on
`postgres:17-alpine`; no pull request exists yet, so that run has not happened.

### Level 3: build and browser

```bash
DATABASE_URL=postgresql://user:pass@localhost:5432/db DIRECT_URL=postgresql://user:pass@localhost:5432/db NEXT_PUBLIC_SUPABASE_URL=https://placeholder.supabase.co NEXT_PUBLIC_SUPABASE_ANON_KEY=placeholder-anon-key npm run build
node -e "const m=JSON.parse(require('fs').readFileSync('.next/server/server-reference-manifest.json','utf8')); console.log(Object.keys(m.node).length)"
# Expected: 25 (the 22/10/2026 build held 26). An indirect check (the ids are hashes); print the count only: the file
# also holds an encryption key.
```

The browser checks are Task 16; no agent has run them. They use the Docker stack (`docker compose up --build -d`, then
`http://localhost:3010`; it serves the production build and auto-confirms sign-ups), and are reported as not run where
Chrome cannot start. No write action against a non-local target (`.claude/AGENT-CONTRACT.md#browser-checks`).

## Final Validation Checklist
- [ ] `npm test` passes; the Postgres suites pass with `TEST_DATABASE_URL` and show as skipped without it
- [ ] Each defect has a test that failed first, its failing output pasted in the REPORT
- [ ] `npx prisma validate`, `npm run lint`, `npx tsc --noEmit`, the size audit and `npm run build` pass; no new
  lint warning
- [ ] `grep -rln 'from "@/lib/db"' src` lists `src/lib/action-runtime.ts` and nothing else;
  `grep -rln 'from "@/lib/ensure-profile"' src` lists `action-runner.ts`, `auth/handlers.ts` and the helper's test
- [ ] Task 11 confirms every Prisma statement is scoped; the manifest count is 25; the build lists no `/auth/sign-out`
- [ ] The register row and the `eslint-disable max-lines` comment for `prompts/actions.ts` are gone (Task 6)
- [ ] Per-file coverage at least 80% on every measure for each new file in scope; exemptions recorded (the wrappers and
  `action-runtime.ts` need a request scope)
- [ ] The composite-key migration applies from scratch on the local Docker Postgres; the audit ran on Supabase before it
- [ ] Every drift-register row is fixed or filed, including `.serena/memories/project_overview.md:23`; every edited file
  with a header has a changelog line; every edited file without a header (the ten of finding F-9) got one
- [ ] No existing test was edited; if one had to be, the REPORT names it with the developer's approval
- [ ] Browser checks, the CI run, the Supabase audit and migration and the credential rotation are listed as not run,
  for Task 16 and the first PR

## Anti-Patterns to Avoid
- Do not mock a module of this repository, import `@/lib/db`, `action-runtime.ts` or Supabase code in a test, or edit an
  existing test to make a change pass
- Do not export anything but `async function`s from a `"use server"` file, or a function that takes a `userId`
- Do not read a user id from an action's input, or scope a query by a value the client chose
- Do not check ownership in one statement and write by `id` alone in another; scope the write or share a transaction
- Do not return Supabase's, Zod's or an exception's message, and do not tell a missing row from a foreign one
- Do not leave a mutation without a limit, or put saves back in the shared bucket
- Do not call `createClient()` or `cookies()` at module load, or purge by `startsWith("prompt")`
- Do not run `prisma migrate dev` or `deploy` against Supabase, or hand-write a migration
- Do not keep the old pattern beside the new: a converted action loses its old signature
- Do not widen into #48's shared store, count caps, the expiry purge or database tag keys; file them

## Confidence

Confidence that an agent given a brief, the contracts and the code produces gated code for its task: 6.5 of 10. Nothing
was run, so the `createMany` race, the `P2025` mapping, the CTE, the `server-only` alias file, the auth error codes and
the Prisma Client's handling of the nullable composite relation are unverified, each with a test that will show the
truth; the caller edits rely on `tsc` and the browser list.

----
**Plan Status**: READY
**PRP Status**: TODO
**PRP ID**: P7S2
**PRP Document**: P7S2-server-side-security-hardening
**Tasks**: 16 tasks (P7S2T1 - P7S2T16)
**Phase**: Phase 7 - Hardening (Server-side security)
**Dependencies**: P7S1 (Complete)
**Next PRP**: P7S3 - Production readiness
**Recommendations**:
Agents:
- `senior-backend-engineer` (Tasks 1-2, 13, and the backend steps of Tasks 4-8)
- `qa-test-automation-engineer` (Tasks 3, 10)
- `senior-frontend-engineer` (the caller steps of Tasks 5-8, Tasks 9, 14)
- `security-analyst` (Task 11)
- `documentation-manager` (Tasks 12, 15)
Notes:
- Q1-Q7 were taken by the developer on 27/10/2026; Q8, D4, D5, D9, D10 and the strict Q4 on 29/10/2026
- Plan Status READY follows the CLAUDE.md override of documentation-prp.md for PRP footers; Task 15 runs before Task 1
- Tasks 5-8 are one commit each (backend step, then caller step); Task 16 is the developer's
- Out of scope: the shared limiter store, count caps, the expiry purge, database tag keys
- Nothing was run: browser checks, CI, the Supabase audit and migration and the rotation wait for Task 16 and a PR
**Estimated Implementation Time (FTE)**: 42-50 hours (6 days)
