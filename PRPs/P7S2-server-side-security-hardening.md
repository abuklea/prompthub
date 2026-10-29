# PromptHub
## P7S2 - Server-side Security Hardening

| `Title` | `Created` | `Last modified` |
|---------|-----------|-----------------|
| P7S2 - Server-side Security Hardening | 29/10/2026 16:55 GMT+10 | 29/10/2026 17:01 GMT+10 |

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
row it reads, writes or references in the statement or transaction that touches it, returns `ActionResult`, and is
rate-limited when it mutates. Each of the 22 actions that touch tenant data has a cross-user isolation test that runs
against a real Postgres in CI, a rule requires one for every new action, and no server-only helper is callable as an
action. Sign-out clears every client-side trace of the previous user, and deleting a folder closes the tab of every
document it removes, in sub-folders too.

## Why

Epic #39 states the outcome. Application code is the enforced tenant boundary, because Prisma connects with a role that
bypasses row-level security (`docs/rules/project.md#database-auth-and-tenancy`), so one missed check is a cross-tenant
defect. Research on 26/10/2026 and 27/10/2026 ([notes](../wip/P7S2-research-notes.md),
[drift register](../wip/P7S2-research-drift.md)) measured `481aae9`; the counts below were re-checked on `bff5fa6` on
29/10/2026. Eight modules carry `"use server"` and export 27 functions, 23 of which touch tenant data. Thirteen skip
Zod, eleven do not return `ActionResult`, and four are rate-limited (`signIn`, `signUp`, `createPrompt`,
`saveNewVersion`).
`assignTagsToPrompt` checks ownership and then updates by `id` alone (`src/features/prompts/actions.ts:588`).
`createPrompt` and `createFolder` write a `folderId` and a `parentId` nobody checked; the foreign keys reference
`Folder.id` alone, so a prompt can be attached to another user's folder, which needs that user's UUID (finding F-2).
`ensureProfileExists(userId)` is a `"use server"` module: it was absent from the 22/10/2026 action manifest (26 ids),
but the research showed that importing any action module from a Server Component registers every export of it, and one
added import made it a public endpoint that creates a `Profile` for any id (F-3). `signIn` and `signUp` pass the raw
client object to Supabase and return its message verbatim (F-4).

No test imports an action. The only isolation tests sit below the action layer, in the P7S1 editor service suites
(`src/features/editor/service.save.test.ts:169`). Issue #45 proposed stubbing auth "at `createClient`", which
`docs/rules/testing.md#rules` forbids. The developer chose an injected seam instead (Q1): each action body becomes a
plain-module function of `(deps, input)`, the `"use server"` export a one-line wrapper, and a test drives the body with
the real test database and a fake `getUser`. That rewrites every action, so the PRP also takes the split of
`src/features/prompts/actions.ts` (#51, the one RED file here, 674 lines) and the rate limit on every mutation (the part
of #48 that needs no shared store): all three touch the same code.

What it does not do. The wrappers, `src/lib/action-runtime.ts` and the Supabase cookie wiring have no unit test; the
build, an action-id count and the browser list check them, and none of that has been run. The limiter stays in memory
and per instance, and never evicts (#48 keeps the shared store; the auth limit keys on a rotatable `x-forwarded-for`
behind the Docker gateway, F-5). A signed-in user can still grow the database with many folders at the new length caps
(F-1): per-user count and byte caps are filed under #47. Composite foreign keys (Q8) are not added. A session that
expires without the sign-out button leaves drafts and tab titles on disk. Whether the cloud GoTrue sends an
`AuthError.code` for the two auth cases the messages distinguish is not verified.

## What

| Defect | Today | After | Issue |
|---|---|---|---|
| A helper is an action | `ensure-profile.ts` is `"use server"`, takes any `userId`, reads then creates | A `server-only` module taking `(db, userId)`; one race-free upsert; a 50-call concurrency test | #40 |
| Inputs unchecked | 13 actions parse nothing or only as a type; unbounded `validatePrompts`; no name caps | Every action parses with Zod, returns a fixed message, caps names and lists | #41, #42 |
| Foreign rows referenced | `createPrompt`, `createFolder` write an unchecked `folderId` or `parentId` | Owner checked in the writing transaction (F-2) | #41 |
| Unscoped write | `assignTagsToPrompt` updates by `id` after a separate check | One transaction; `update` where `{ id, user_id }` | #41 |
| Auth input passes through | Raw object to Supabase; its message returned | Only `{ email, password }` reaches Supabase; fixed messages | #42 |
| Folder actions throw | Callers rely on `catch` | `ActionResult`; callers branch on `success` | #41 |
| Tabs left open | `deleteFolder` returns the prompts directly in the folder | Returns every folder and prompt id of the tree; tabs and caches close | #43 |
| Sign-out leaves state | Only the document cache is cleared | One purge of caches, `prompt-` drafts, tabs and selection | #44 |
| Dead route | `POST /auth/sign-out` has no caller | Deleted | Q6 |
| Mutations unlimited | 4 of 27 limited | Every mutation limited; autosave has its own limit | #48 (part) |
| One RED file | `prompts/actions.ts`, 674 lines, eleven `NEXT_REDIRECT` rethrows | Four action files over handlers; one rethrow | #51 |
| No action tests | None import an action | An isolation test per tenant action, in CI, enforced by a rule | #45 |

### Success Criteria
- [ ] `ensure-profile.ts` has no `"use server"`, imports `server-only`, and 50 concurrent first calls for one id succeed
  and leave one row
- [ ] Each of the 25 remaining actions is a wrapper over a handler of `(deps, input)`; no handler imports `@/lib/db`,
  `action-runtime.ts` or the Supabase client
- [ ] A wrong input shape returns a fixed message without reaching the database
- [ ] User B calling any of the 22 tenant actions with A's ids gets what a missing id gets, A's rows are unchanged, and
  the test is titled `"<action>: user B ..."`
- [ ] `createPrompt` and `createFolder` refuse a folder or parent the user does not own and write nothing;
  `assignTagsToPrompt` writes with `update` where `{ id, user_id }` and refuses a foreign tag id
- [ ] `signIn` and `signUp` pass exactly `{ email, password }` to Supabase and return only fixed messages
- [ ] Deleting X with descendants Y and Z returns all folder and prompt ids; the callers close every tab and drop every
  cache entry
- [ ] The 31st mutation in a minute is refused, autosave allows 240, and the two limits are independent
- [ ] Sign-out leaves no `prompt-` key, empty caches, no tabs (on disk too) and a reset selection; the settings key
  survives; the workspace cache returns nothing once another user is bound
- [ ] `src/app/auth/sign-out/route.ts` is gone; `prompts/actions.ts` is under 300 lines with no register row
- [ ] `docs/rules/testing.md` requires an isolation test per new action and `action-coverage.test.ts` enforces it
- [ ] Every CI gate passes, no lint warning is added, each new file in the coverage scope reaches 80% on every measure,
  and every drift-register row is fixed or filed

## Decisions

The developer took Q1 to Q7 on 27/10/2026. Q8 was not put to him; its recommendation stands as the default until this
PRP is reviewed. D1 to D9 were made while planning and are cheap to reverse before Task 2. Reasons and code are in
[the contracts](docs/P7S2-action-contracts.md).

| Decision | What it fixes | Status |
|---|---|---|
| Q1 Injected seam | Handler `(deps, input)` with deps `getUser` and `db`; wrapper one line; tests use `src/test/db.ts` and a fake `getUser` | developer |
| Q2 #51 pulled in | The `prompts/actions.ts` split and one `NEXT_REDIRECT` rethrow | developer |
| Q3 Rate limits now | Every mutation uses the in-memory limiter; #48 keeps the shared store | developer |
| Q4 Every action | Zod and `ActionResult` for every action | developer |
| Q5 `server-only` | The package is added, with a Vitest alias | developer |
| Q6 Delete the route | `src/app/auth/sign-out/route.ts` removed | developer |
| Q7 Tabs purged | The purge also clears the tab store | developer |
| Q8 Application check only | Composite foreign keys filed for P7S3, not built | default, pending confirmation |
| D1 `runAction` | One runner: parse, authenticate, limit, profile, run, catch, and the one rethrow; modules named `handlers.ts` | planner |
| D2 "Every action" | The eleven without `ActionResult` get it; `signOut` and `getDashboardMetrics` keep their shapes; arguments become one object | planner |
| D3 `searchPrompts` | Only `getPromptsByFolder` calls it (searched 29/10/2026): it stops being an action, leaving 25 | planner |
| D4 Limits | Mutations share the existing 30 a minute per user; autosave gets 240 | planner |
| D5 Workspace cache | A bound viewer, not a user parameter on each getter, so `useActiveTabFolderSync.test.tsx` stays unedited | planner |
| D6 Caps | Folder and display names 100, rename title 200, `validatePrompts` 200 ids | planner |
| D7 Auth messages | Fixed text; two cases keyed by `AuthError.code` | planner |
| D8 UI store reset | The purge also resets the UI selection and prompt list, beyond #44's text | planner |
| D9 Upsert form | `update: { id: userId }`; `createMany` with `skipDuplicates` if the concurrency test fails | planner |

D4 has a cost: one bucket means quick renames, deletes and saves can lock a user out for a minute. D5 reads #44's
"getters return nothing for a different user id" as "binding another user empties the cache": the intent, not the
letter. D2 changes every call site's argument shape, so the type checker finds each caller.

## All Needed Context

Per-task detail is in [the briefs](docs/P7S2-task-briefs.md#briefs), interfaces and per-action rules in
[the contracts](docs/P7S2-action-contracts.md), the trees and the call sites in
[the context](docs/P7S2-task-context.md).
Read your task's section and the source it cites, and check each cited path against the code first.

```yaml
# MUST READ
- url: https://nextjs.org/docs/14/app/building-your-application/rendering/composition-patterns
  why: "Keeping Server-only Code out of the Client Environment": npm install server-only, import it in the module
  critical: Opened 29/10/2026. A Client Component importing such a module is a build error; a type-only import is erased

- url: https://www.prisma.io/docs/orm/reference/prisma-client-reference#database-upserts
  why: Native upsert criteria (one unique field in where, equal in create, no nested writes)
  critical: Opened 29/10/2026 (first 100,000 characters). The fallback seen for an empty update is not documented

- file: src/features/editor/service.ts
  why: The pattern to mirror - (db, userId, input), no "use server", one NOT_FOUND text, scoped updateMany as the check
  critical: Task 1 adds import "server-only" to it

- file: src/features/editor/actions.ts
  why: The thin shell P7S1 left; its order (parse, authenticate, limit, delegate) is the order runAction keeps

- file: src/features/editor/service.save.test.ts
  why: The cross-user test shape at line 169 - B gets the not-found result, row and history unchanged
  critical: Uses describeDb, useTestDatabase, createTestUser; never imports an action or @/lib/db

- file: src/test/db.ts
  why: describeDb, useTestDatabase, createTestUser, createTestPrompt, and the guard against a non-disposable URL
  critical: Tag has no relation to Profile, so deleting a profile leaves its tags (add deleteTestUser)

- file: src/lib/rate-limit.ts
  why: createRateLimiter, checkAuthRateLimit (5 a minute), checkMutationRateLimit (30 a minute)
  critical: In memory, per process, never evicts (F-5, #48)

- file: src/features/prompts/actions.ts
  why: 12 actions to split; line 588 unscoped write; 143-150 unchecked folder; 398 raw query
  critical: Delete the eslint-disable max-lines comment and the register row together

- file: src/features/folders/actions.ts
  why: Five throwing actions with no schema; lines 79-103 the shallow prompt-id read
  critical: FolderItem, FolderTree, FolderToolbar rely on thrown errors

- file: src/features/auth/actions.ts
  why: Raw object to Supabase (lines 32, 60); error.message returned (35, 63, 46, 74)
  critical: signOut calls redirect() outside any try; a handler must not

- file: src/features/workspace/cache.ts
  why: The stored userId is never checked; removeFolderFromCache leaves descendants
  critical: useActiveTabFolderSync.test.tsx hydrates it for user-1 with nothing bound and must pass unedited

- file: src/features/editor/draft.ts
  why: Draft keys at lines 53-57 - prompt-v1-<id>, legacy prompt-<id>, prompt-v1-<id>:conflict
  critical: The purge prefix is "prompt-"; prompthub-tabs-state and prompthub:user-settings:v1 also start with "prompt"

- file: docs/rules/testing.md
  why: Line 43, never mock a module of this repository; Task 10 adds the isolation rule here

- docfile: wip/P7S2-research-drift.md
  why: 26 rows; Task 12 fixes the open ones and writes a closing note against each
```

```text
# CRITICAL gotchas (verified in the code or by the 26/10/2026 research unless marked)
# - A "use server" file may export only async functions (types are erased). A non-async export fails the build, an
#   async one is a public endpoint. Helpers, deps, constants and the NEXT_REDIRECT check live in plain modules.
# - Importing ANY export of an action module from a Server Component registers EVERY export of it
#   (src/app/(app)/dashboard/page.tsx imports getDashboardMetrics this way).
# - cookies() throws outside a request and Next 14.2 has no test utility for it: only action-runtime.ts calls
#   createClient(), inside getUser, never at module load. await getUser(): the Supabase server client hides cookies
#   behind synchronous-looking signatures.
# - Zod 3.25.76: .trim() BEFORE .min()/.max(); .uuid() accepts any version and upper case; a nullable parentId needs
#   .nullable(); a schema with .default() needs the three-argument ZodType for its input type.
# - server-only: Next aliases the bare import at build time, tsc does not resolve it, and under Vitest its default
#   export throws. Alias to node_modules/server-only/empty.js (named under the "react-server" export condition, from
#   npm view; the file is UNVERIFIED until installed). A global react-server condition would break the jsdom suites.
# - Prisma 6.19.0 upsert({ update: {} }) fell back to SELECT then INSERT and raced (seen 26/10/2026, undocumented);
#   update: { id } emitted INSERT ... ON CONFLICT and passed 240 of 240. updateMany cannot set a relation; the scoped
#   form is update({ where: { id, user_id } }), which raises P2025 for no match.
# - Folder.parent and Prompt.folder cascade on delete, so deleteFolder must read the tree BEFORE the delete.
# - Purge: collect keys before removing (removal shifts key(index)).
# - signUp with email confirmation on returns a user and no session: ensureProfileExists keeps taking the id from its
#   caller. Whether the cloud project confirms by email is unverified; the Docker stack does not.
# - Only signOut calls redirect(), outside any try; the runner's single NEXT_REDIRECT rethrow is for #51.
# - Never edit an existing test to make a change pass (testing.md). New suites go in new files, including the autosave
#   limiter test and the DB helper test.
# - Parallel worktrees share one TEST_DATABASE_URL: every suite makes its own users with createTestUser (random ids).
```

## Implementation Blueprint

### Data models and structure

No schema change and no migration. The new types are the seam and the schemas, in full in
[the contracts](docs/P7S2-action-contracts.md#the-seam). In brief: `ActionDeps` is `{ getUser, db }`; a handler calls
`runAction(deps, spec, data)`, where the spec holds the schema, the two messages, the limit class and the `run` body,
and the runner fixes the order parse, authenticate, limit, profile, run, catch.

```mermaid
flowchart LR
  C["Client component"] -- "action(data)" --> W["actions.ts wrapper (use server)"]
  W -- "actionDeps" --> H["handlers.ts: runAction(deps, spec, data)"]
  H --> S["safeParse"] --> U["deps.getUser"] --> L["limit by user id"] --> R["run({ db, userId, input })"]
  R --> P[("Postgres, every statement scoped by user_id")]
  T["handlers.isolation.test.ts"] -- "testDeps(db, userB)" --> H
  X["action-runtime.ts (server-only)"] -- "real getUser and db" --> W
```

Not rendered (no render step). The tests enter at `H`; nothing automated covers `W` and `X`.

### Tasks

```yaml
Task 1 (senior-backend-engineer): server-only and ensureProfileExists              # #40, Q5
MODIFY package.json, package-lock.json: npm install server-only (the only dependency change)
MODIFY vitest.config.ts: alias for server-only; coverage patterns for every later file
MODIFY src/lib/ensure-profile.ts: no directive; import "server-only"; (db, userId); upsert; header
MODIFY the four action files: the call sites take (db, id)
CREATE src/lib/server-only-alias.test.ts, src/lib/ensure-profile.test.ts

Task 2 (senior-backend-engineer): the seam and the autosave limit                   # Q1, #48 part
CREATE src/lib/action-runner.ts, action-runtime.ts, prisma-errors.ts and their tests
MODIFY src/lib/rate-limit.ts: checkAutosaveRateLimit; CREATE rate-limit.autosave.test.ts

Task 3 (qa-test-automation-engineer): test factories and fake deps                  # #45
MODIFY src/test/db.ts: createTestFolder, createTestTag, deleteTestUser
CREATE src/test/action-deps.ts, src/test/db.helpers.test.ts

Task 4 [P] (senior-backend-engineer): signIn and signUp                             # #42, F-4
CREATE src/features/auth/handlers.ts, handlers.test.ts; MODIFY actions.ts (wrappers)

Task 5 [P] (backend, then senior-frontend-engineer): folders                        # #41, #43, F-2, F-6
CREATE folders/schemas.ts, handlers.ts, handlers.test.ts, handlers.isolation.test.ts; MODIFY actions.ts
MODIFY FolderItem, FolderTree, FolderToolbar; workspace/cache.ts (removeFolderTreeFromCache) + cache.tree.test.ts

Task 6 [P] (backend, then frontend): prompt CRUD and listing                        # #41, F-2, DR-18, DR-19
MODIFY prompts/schemas.ts, actions.ts; CREATE handlers.ts, search-handlers.ts and tests
MODIFY PromptList, DocumentToolbar, DocumentTab, use-tab-cleanup

Task 7 (backend, then frontend): tags, history and the rest of the split            # #41, #51, DR-20; after Task 6
CREATE tag-handlers.ts, tag-actions.ts, history-handlers.ts, history-actions.ts and four test files
MODIFY prompts/actions.ts (delete moved code and the eslint-disable); docs/rules/code-size-register.md (remove the row)

Task 8 [P] (backend, then frontend): editor, profile, workspace, dashboard          # Q3, Q4
CREATE handlers.ts and both test files in each feature; profile/schemas.ts; MODIFY the four actions.ts
MODIFY profile/page.tsx, WorkspacePreloader.tsx

Task 9 (senior-frontend-engineer): sign-out purge and the route                     # #44, Q6, Q7, F-7, F-8
MODIFY workspace/cache.ts (bindWorkspaceCacheViewer, clearWorkspaceCache); CREATE cache.test.ts
CREATE auth/client-purge.ts and client-purge.test.ts (jsdom, real localStorage)
MODIFY use-tab-store.ts (resetTabs), tabs/types.ts, use-ui-store.ts (resetSession), Header.tsx, WorkspacePreloader.tsx,
       src/app/(app)/layout.tsx (userId prop); DELETE src/app/auth/sign-out/route.ts

Task 10 (qa-test-automation-engineer): isolation coverage rule                      # #45
CREATE src/test/action-coverage.ts (pure checker) and two test files; MODIFY docs/rules/testing.md

Task 11 (security-analyst): read-only review of the final tree; findings to the main session
Task 12 (documentation-manager): drift rows, headers, register, README, rules, agents (.claude and .gemini)
Task 13 (developer, type: dev-review): #46 rotation; browser checks on the Docker stack; decide Q8 and follow-ups
```

The red tests, files and done-when conditions of each task are in [the briefs](docs/P7S2-task-briefs.md#briefs).

### Task List

Twelve agent tasks of 1.5 to 4 hours, each ending with every gate green, so every commit is a working state. A task with
a frontend step is one commit: the backend step leaves `tsc` failing until the callers are updated, so both run in one
worktree. `[P]` tasks touch disjoint files and run in separate worktrees once Task 3 is merged. Task 7 follows Task 6
(both edit `prompts/actions.ts`); Task 9 follows Tasks 5 and 8 (all edit `cache.ts` or `WorkspacePreloader.tsx`). The
hours are this document's estimate.

| Task | Title | Agent | Hours | After | [P] | Issues |
|---|---|---|---|---|---|---|
| P7S2T1 | Add server-only and fix ensureProfileExists | `senior-backend-engineer` | 3 | none | | #40 |
| P7S2T2 | Add the action seam and the autosave limit | `senior-backend-engineer` | 3 | T1 | | #48 (part), #45 |
| P7S2T3 | Add the test factories and the fake deps | `qa-test-automation-engineer` | 1.5 | T2 | | #45 |
| P7S2T4 | Validate and sanitise signIn and signUp | `senior-backend-engineer` | 3 | T3 | with T5, T6, T8 | #42 |
| P7S2T5 | Harden the folder actions and close the tabs of a deleted tree | `senior-backend-engineer`, `senior-frontend-engineer` | 4 | T3 | with T4, T6, T8 | #41, #43 |
| P7S2T6 | Harden the prompt CRUD and listing actions | `senior-backend-engineer`, `senior-frontend-engineer` | 4 | T3 | with T4, T5, T8 | #41 |
| P7S2T7 | Split the rest of prompts/actions.ts and harden tags and history | `senior-backend-engineer`, `senior-frontend-engineer` | 4 | T6 | | #41, #51 |
| P7S2T8 | Move the editor, profile, workspace and dashboard actions onto the seam | `senior-backend-engineer`, `senior-frontend-engineer` | 3.5 | T3 | with T4, T5, T6 | #48 (part) |
| P7S2T9 | Purge client state on sign-out and delete the sign-out route | `senior-frontend-engineer` | 4 | T5, T8 | | #44 |
| P7S2T10 | Isolation coverage rule | `qa-test-automation-engineer` | 2.5 | T4 to T8 | | #45 |
| P7S2T11 | Independent security review | `security-analyst` | 1.5 | T9, T10 | | #39 |
| P7S2T12 | Sweep the documentation | `documentation-manager` | 3 | T11 | | #39, #45 |
| P7S2T13 | Developer checks (`type: dev-review`) | developer | 1 | T12 | | #46, new |

The main session provisions the test database before it dispatches T1 to T10, and alone edits issues. The INITIAL report
files the epic's task issues and the dev-review issue, comments on #40 to #45, #48 and #51 (the rate-limit part of #48
only; its shared store stays open), and files the follow-ups: count and byte caps (F-1, under #47), composite foreign
keys (Q8, P7S3) and a purge on session expiry.

### Integration Points

```yaml
DATABASE: no migration; the local Docker Postgres is used for tests only
CONFIG:   package.json (server-only), vitest.config.ts (alias, coverage scope); no new environment variable
ROUTES:   delete src/app/auth/sign-out/route.ts (Task 9)
CI:       no new step: npm test already runs with TEST_DATABASE_URL; only the ci.yml comment changes (Task 10)
```

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
# Expected: no errors; at most 15 lint warnings (use-tab-store.ts already carries one); after Task 7 RED 0, no register row
```

### Level 2: unit and Postgres-backed tests

```bash
npm test   # without TEST_DATABASE_URL the Postgres suites are skipped; the action-coverage rule still runs

# docker-compose.yml's db service publishes Postgres on host port 54322. Set PGUSER and PGPASSWORD to that service's
# POSTGRES_USER and POSTGRES_PASSWORD. The main session runs these; an agent creates no role or database. The database
# name must contain "test" and the host be loopback, or src/test/db.ts refuses the URL. Local Docker only, never Supabase.
docker compose up -d --wait db
docker compose exec db createdb -U "$PGUSER" prompthub_test
export TEST_DATABASE_URL="postgresql://$PGUSER:$PGPASSWORD@localhost:54322/prompthub_test"
DATABASE_URL="$TEST_DATABASE_URL" DIRECT_URL="$TEST_DATABASE_URL" npx prisma migrate deploy
npm test
npx vitest run src/features/folders   # one area while working
npx vitest run --coverage --coverage.include=src/features/folders/handlers.ts --coverage.reporter=json-summary
```

Read `coverage/coverage-summary.json`, not the text table. A cloud session without Docker follows
[the P7S1 database recipe](docs/P7S1-task-context.md#environment-for-database-tests). CI runs `postgres:17-alpine`
with the migrations applied and fails when `TEST_DATABASE_URL` is missing, so the isolation suites run there; no pull
request exists yet, so that run has not happened.

### Level 3: build and browser

```bash
DATABASE_URL=postgresql://user:pass@localhost:5432/db DIRECT_URL=postgresql://user:pass@localhost:5432/db NEXT_PUBLIC_SUPABASE_URL=https://placeholder.supabase.co NEXT_PUBLIC_SUPABASE_ANON_KEY=placeholder-anon-key npm run build
node -e "const m=JSON.parse(require('fs').readFileSync('.next/server/server-reference-manifest.json','utf8')); console.log(Object.keys(m.node).length)"
# Expected: 25 (the 22/10/2026 build held 26). The ids are hashes, so a count is an indirect check; print the count only,
# because the file also holds an encryption key.
```

The browser checks are Task 13; no agent has run them. They use the Docker stack (`docker compose up --build -d`, then
`http://localhost:3010`; it serves the production build and auto-confirms sign-ups) through chrome-devtools or the
developer's browser, and are reported as not run where Chrome cannot start. No write action against a non-local target
(`.claude/AGENT-CONTRACT.md#browser-checks`).

## Final Validation Checklist
- [ ] `npm test` passes; the Postgres suites pass with `TEST_DATABASE_URL` and show as skipped without it
- [ ] Each defect has a test that failed first, its failing output pasted in the REPORT
- [ ] `npx prisma validate`, `npm run lint`, `npx tsc --noEmit`, the size audit and `npm run build` pass; no new
  lint warning
- [ ] `grep -rn "ensureProfileExists" src` finds the helper, its test, `action-runner.ts` and the auth handlers only;
  `grep -rln "@/lib/db" src` lists `src/lib/action-runtime.ts` and nothing else
- [ ] Task 11 confirms every Prisma statement in a handler or service is scoped by `user_id`
- [ ] The manifest count is 25 and `npm run build` lists no `/auth/sign-out`
- [ ] The register row and the `eslint-disable max-lines` comment for `prompts/actions.ts` are gone
- [ ] Per-file coverage at least 80% on every measure for each new file in scope; exemptions recorded (the wrappers and
  `action-runtime.ts` need a request scope)
- [ ] Every drift-register row is fixed or filed, including `.serena/memories/project_overview.md:23`; every edited file
  with a header has a changelog line; the ten headerless files got one when edited
- [ ] No existing test was edited; if one had to be, the REPORT names it with the developer's approval
- [ ] Browser checks, the CI run and the credential rotation are listed as not run, for Task 13 and the first PR

## Anti-Patterns to Avoid
- Do not mock a module of this repository, import `@/lib/db`, `action-runtime.ts` or Supabase code in a test, or edit an
  existing test to make a change pass
- Do not export anything but `async function`s from a `"use server"` file, or a function that takes a `userId`
- Do not read a user id from an action's input, or scope a query by a value the client chose
- Do not check ownership in one statement and write by `id` alone in another; scope the write or share a transaction
- Do not return Supabase's, Zod's or an exception's message, and do not tell a missing row from a foreign one
- Do not leave a mutation without a limit, and do not widen the autosave limit to a mutation
- Do not call `createClient()` or `cookies()` at module load, or purge by `startsWith("prompt")`
- Do not keep the old and the new pattern side by side: a converted action loses its old signature, and every caller
  changes
- Do not widen into #48's shared store, count caps, composite foreign keys or the expiry purge; file them

## Confidence

One-pass confidence that an agent given a brief, the contracts and the code produces gated code for its task: 7 of 10.
The seam, the SQL and the test conventions are specified against code that was read, and the main risk (reaching the
bodies without Next internals) is removed by design. Nothing here was run: `update: { id }`, the `P2025` mapping, the
recursive CTE, the `server-only` alias file and the auth error codes come from reading and the 26/10/2026 probe, each
with a test that will show the truth. The caller edits of Tasks 5 to 8 have no unit test and rely on `tsc` and the
browser list, and the limit sizes are judgements.

----
**Plan Status**: READY
**PRP Status**: TODO
**PRP ID**: P7S2
**PRP Document**: P7S2-server-side-security-hardening
**Tasks**: 13 tasks (P7S2T1 - P7S2T13)
**Phase**: Phase 7 - Hardening (Server-side security)
**Dependencies**: P7S1 (Complete)
**Next PRP**: P7S3 - Production readiness
**Recommendations**:
Agents:
- `senior-backend-engineer` (Tasks 1-2, and the backend steps of Tasks 4-8)
- `qa-test-automation-engineer` (Tasks 3, 10)
- `senior-frontend-engineer` (the caller steps of Tasks 5-8, Task 9)
- `security-analyst` (Task 11)
- `documentation-manager` (Task 12)
Notes:
- Q1-Q7 were taken by the developer on 27/10/2026; Q8 stands as the default until review; D1-D9 were not put to him
- Tasks 5-8 are one commit each (backend step, then caller step); Task 13 is the developer's
- Out of scope: the shared rate-limit store, count caps, composite foreign keys, the purge on session expiry
- Nothing was run: the browser checks, the CI service container and the credential rotation wait for Task 13 and a PR
**Estimated Implementation Time (FTE)**: 33-40 hours (5 days)
