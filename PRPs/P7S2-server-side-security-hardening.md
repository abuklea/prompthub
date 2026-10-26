# PromptHub
## P7S2 - Server-Side Security Hardening

| `Title` | `Created` | `Last modified` |
|---------|-----------|-----------------|
| P7S2 - Server-Side Security Hardening | 27/10/2026 00:45 GMT+10 | 27/10/2026 00:45 GMT+10 |

## Table of Contents
- [Goal](#goal)
- [Why](#why)
- [What](#what)
  - [Success Criteria](#success-criteria)
- [Decisions](#decisions)
- [All Needed Context](#all-needed-context)
  - [Documentation and References](#documentation-and-references)
  - [Current and Desired Trees](#current-and-desired-trees)
  - [Known Gotchas](#known-gotchas)
- [Implementation Blueprint](#implementation-blueprint)
- [Task List](#task-list)
- [Validation Loop](#validation-loop)
  - [Level 1: syntax and style](#level-1-syntax-and-style)
  - [Level 2: unit and Postgres-backed tests](#level-2-unit-and-postgres-backed-tests)
  - [Level 3: build and browser](#level-3-build-and-browser)
- [Final Validation Checklist](#final-validation-checklist)
- [Anti-Patterns to Avoid](#anti-patterns-to-avoid)

## Goal

Make the application-layer tenant boundary complete and tested. After this PRP every server action parses its input
with Zod, authenticates the caller, is rate-limited if it writes, scopes every statement by `user_id`, checks the
ownership of every row it references, returns `ActionResult`, and has a cross-user isolation test that runs against a
real Postgres in CI. No helper is callable as an action, and a test fails the build when a new action lacks the shape or
the test. On the client, signing out leaves none of the previous user's documents, drafts, folders or tabs in memory or
in localStorage, and deleting a folder closes the tabs of every document beneath it.

## Why

Prisma connects with a database role, so Postgres RLS does not constrain it and application code is the only enforced
boundary (`docs/rules/project.md#database-auth-and-tenancy`). One missed check is a cross-tenant defect. Epic #39 states
the outcome; its children #40 to #45 were checked against the code during research and every claim holds, with stale
line numbers recorded in [the drift register](../wip/P7S2-research-drift.md#stale-citations-in-the-issue-bodies).
Research found more of the same class ([findings](../wip/P7S2-research-notes.md#findings)): any signed-in user can grow
the database without bound through `createFolder`, which has no cap or limit (F-1); a prompt or folder can point at
another user's folder, which B's own reads then display and whose existence B can probe (F-2); a two-build experiment
showed that importing any action module from a Server Component registers it as an endpoint, so `ensureProfileExists`
is one import away from an unauthenticated profile-creating endpoint (F-3); `signIn` and `signUp` echo Supabase's error
text (F-4); `deleteFolder` reads and deletes in two statements and leaves descendants in the client cache (F-6); an
unused POST route signs a user out with no client purge (F-7); and the persisted tab store keeps the previous user's
document titles on disk after sign-out (F-8).

No test calls an action today: isolation is tested only for the editor service behind four of them
(`src/features/editor/service.save.test.ts`, `service.restore.test.ts`). Of the 27 exports of the eight `"use server"`
modules, 13 parse no input, 11 do not return `ActionResult`, and only 4 are rate-limited. The fixes share one shape,
which is why this is one PRP: a single runner that every action goes through, and a test seam that lets a test call
the real action body as another user without mocking a module of this repository (`docs/rules/testing.md#rules`).

Out of scope, with the issue that owns it: the shared rate-limit store, limiter eviction and the forgeable
`x-forwarded-for` key behind the Docker gateway (#48, F-5); per-user count or byte caps on rows and versions (F-1,
filed at INITIAL under #47); composite foreign keys that make a cross-tenant folder reference impossible in the database
(Q8, filed under #47); `serverActions.bodySizeLimit` (default 1 MB, against a 500,000-character content cap); the
credential rotation of #46, which only the developer can confirm; and a server-side folder depth limit (the client caps
it at 5, `FolderItem.tsx:32`).

## What

| Defect | Today | After | Issue |
|---|---|---|---|
| A helper is one import from being an endpoint | `src/lib/ensure-profile.ts` is `"use server"` and creates a profile for any id; find-then-create races | A `server-only` module taking `(db, userId)`; one upsert that holds under 50 concurrent first calls | #40 |
| Unvalidated input | 13 actions take raw arguments; `signIn` and `signUp` send the raw object to Supabase and echo its errors | Every action parses with Zod through one runner; auth passes only `{ email, password }` and returns fixed messages | #41, #42 |
| Foreign references | `createFolder` and `createPrompt` attach to any folder id; `assignTagsToPrompt` updates by `id` | Ownership checked in the same transaction as the write; every writing statement carries `user_id` | #41 |
| Nested folder delete | Returns only direct prompts, in a separate statement; descendants stay in tabs and the cache | One transaction returns every descendant folder and prompt; every tab and cache entry goes | #43 |
| Sign-out residue | Only the document cache is cleared | Document cache, workspace cache, `prompt-*` drafts and the tab store are purged; the workspace cache serves only the session user | #44 |
| Untested boundary | No action has an isolation test | One per tenant action, Postgres-backed in CI; an inventory test enforces the rule | #45 |
| Mutations unlimited | 4 actions limited | Every mutation limited; autosave has its own higher bucket | #48 (part) |
| A 674-line action file | 9 copies of the redirect rethrow, one RED file | Split at CRUD, search, tag and history seams; one redirect helper | #51 |
| Unused sign-out route | `POST /auth/sign-out` with no caller | Deleted | F-7 |

### Success Criteria
- [ ] No file under `src/lib` has a `"use server"` directive; every `"use server"` file is a `src/features/<f>/actions.ts`
  whose exports are one-line wrappers over handlers (the inventory test passes)
- [ ] 50 concurrent `ensureProfileExists` calls for a new id all succeed and leave one row
- [ ] Each of the 22 tenant actions has an isolation test in which user B, given user A's ids, gets the not-found
  message or an empty result and A's rows read back unchanged; each foreign-reference case writes nothing
- [ ] `signIn` and `signUp` hand Supabase exactly `{ email, password }` and never return Supabase's or an exception's
  message
- [ ] Deleting folder A with descendants A/B and A/B/C returns all three folder ids and every prompt id in them, in
  one transaction; the components close every one of those tabs and drop the folders from the cache
- [ ] After sign-out no `prompt-` key and no `prompthub-tabs-state` key remains in localStorage, both module caches are
  empty, the tab store has no tabs, and `prompthub:user-settings:v1` is kept
- [ ] After `bindWorkspaceCacheUser(B)` no workspace cache getter returns A's data
- [ ] Every mutation returns `Too many requests. Please slow down.` past its limit; autosave is charged to its own bucket
- [ ] No `NEXT_REDIRECT` string remains in `src` outside `src/lib/action-runner.ts`; `src/features/prompts/actions.ts`
  is GREEN and its register row is gone; `src/app/auth/sign-out/route.ts` is gone
- [ ] Every CI gate passes, no file is RED, no lint warning is added (baseline 15 on 27/10/2026), and each file in
  [the coverage scope](docs/P7S2-action-contract.md#coverage-scope) reaches 80% on all four measures

## Decisions

The developer answered Q1 to Q7 on 27/10/2026, accepting each recommendation in
[the research notes](../wip/P7S2-research-notes.md#open-questions). Q8 was not put and its recommendation stands. D9
to D13 were made while writing this PRP, to leave no task guessing; the Stage 3 review should test them.

| ID | Decision | Status |
|---|---|---|
| Q1 | Tests call the real action body through an injected seam: a handler taking `(deps, input)`, with `getUser`, `db`, the limiter and revalidation as deps with real defaults | developer, 27/10/2026 |
| Q2 | #51 (split `prompts/actions.ts`, one redirect helper, the `tags: []` field) is done here | developer |
| Q3 | Every mutation uses the in-memory limiter now; autosave gets its own higher bucket; #48 keeps the shared store | developer |
| Q4 | Every action gets validation and `ActionResult`, including the reads #41 does not list | developer |
| Q5 | Add the `server-only` package, aliased to its `empty.js` under Vitest | developer |
| Q6 | Delete `src/app/auth/sign-out/route.ts` | developer |
| Q7 | The sign-out purge clears the persisted tab store too | developer |
| Q8 | No composite foreign keys here; the application check is the boundary, the keys are filed under #47 | default |
| D9 | `searchPrompts` stops being an action: no client calls it (`grep` finds only `prompts/actions.ts:57`), so it becomes a service function | made here |
| D10 | One `defineAction` runner in `src/lib/action-runner.ts` validates, authenticates, limits, revalidates, catches and rethrows Next's redirect, so the rules live in one place | made here |
| D11 | Buckets: `mutation` 30 per minute per user, shared by every mutation but autosave; `autosave` 120 per minute per user | made here |
| D12 | Caps: folder name 100, display name 50, renamed title 200 (as saves already cap it); all trimmed | made here |
| D13 | The workspace cache is bound to the session user by the `(app)` layout through `WorkspacePreloader`; binding another user empties it, and upserts of another user's rows are ignored | made here |

## All Needed Context

### Documentation and References

```yaml
- docfile: PRPs/docs/P7S2-action-contract.md
  why: The interfaces, the action table (input, result, limit, callers of all 25 actions), messages, module budgets,
    the isolation-test naming and the coverage scope. Wins over this PRP on interfaces.
- docfile: PRPs/docs/P7S2-task-briefs.md
  why: Red and green steps for each task. Read your task's brief before its source.
- docfile: wip/P7S2-research-notes.md
  why: The inventory of 27 actions, findings F-1 to F-9, verified gotchas, the developer's answers.
- docfile: wip/P7S2-research-drift.md
  why: DR-1 to DR-26, each naming the task that fixes it.
- file: src/features/editor/service.ts
  why: The service convention to mirror; scoped updateMany as the ownership check; a row lock in $transaction.
  critical: No "use server" here; its header (lines 15-16) says why. T1 adds import "server-only" to it.
- file: src/features/editor/service.save.test.ts
  why: The cross-user test shape (around line 169): B gets the not-found message and A's row and history are equal.
- file: src/test/db.ts
  why: describeDb, useTestDatabase, the URL guard, the factories. Tests never import @/lib/db.
- file: src/test/failing-db.ts
  why: How to inject a failure into a real client without a module mock.
- file: src/features/prompts/actions.ts
  why: The file T6 and T7 split; createTag's P2002 handling (476-546) moves unchanged; the raw search query
    (398-417) moves unchanged.
- file: src/features/editor/draft.ts
  why: The three draft keys (53, 55, 57), all under the prompt- prefix the purge removes.
- file: src/features/workspace/cache.ts
  why: The module cache T5 and T9 change; it stores userId (line 33) and never reads it.
- file: src/stores/use-tab-store.ts
  why: persist under prompthub-tabs-state (24, 205); T9 adds resetTabs.
- url: https://nextjs.org/docs/14/app/building-your-application/rendering/composition-patterns#keeping-server-only-code-out-of-the-client-environment
  why: The server-only package and why it is installed rather than relied on through Next's alias.
- url: https://www.prisma.io/docs/orm/reference/prisma-client-reference#database-upserts
  why: When Prisma emits INSERT ... ON CONFLICT. An empty update is not one of them in 6.19 (verified, not documented).
- url: https://www.postgresql.org/docs/17/queries-with.html#QUERIES-WITH-RECURSIVE
  why: The recursive CTE of deleteFolder.
- url: https://supabase.com/docs/guides/auth/debugging/error-codes
  why: The auth error codes the fixed-message map reads (email_not_confirmed, weak_password, over_request_rate_limit).
```

### Current and Desired Trees

```text
src/lib/        ensure-profile.ts ("use server", find then create)   -> server-only, (db, userId), upsert
                rate-limit.ts                                         -> + autosave limiter
                + action-runner.ts  defineAction, messages, rethrowIfRedirect
                + action-deps.ts    actionDeps(), authDeps(): the real request dependencies
src/test/       db.ts                                                 -> + createTestFolder, createTestTag
                + action-deps.ts    testDeps(db, user, { allow })
                + action-inventory.test.ts
src/features/
  auth/         actions.ts -> wrappers + signOut; + handlers.ts; + sign-out-purge.ts (client)
  folders/      actions.ts -> wrappers; + schemas.ts, service.ts, handlers.ts
  prompts/      actions.ts (674) -> wrappers; + service.ts, search-service.ts, tag-service.ts, handlers.ts
  editor/       actions.ts -> wrappers; + handlers.ts
  profile/, workspace/, dashboard/   actions.ts -> wrappers; + service.ts, handlers.ts (+ profile/schemas.ts,
                dashboard/types.ts)
  workspace/    cache.ts -> + bindWorkspaceCacheUser, clearWorkspaceCache, removeFolderTreeFromCache
src/app/auth/sign-out/route.ts                                        -> deleted
```

Each feature also gains `handlers.isolation.test.ts` (prompts also `tags.isolation.test.ts`); budgets per file are in
[the module map](docs/P7S2-action-contract.md#module-map).

### Known Gotchas

```typescript
// Next 14.2.35: every export of a "use server" file must be an async function and becomes a public endpoint, whether or
// not a client imports it. Handlers, seams, constants and types live in plain modules.
// cookies() throws outside a request, and revalidatePath needs a static-generation store: neither may run in a handler
// under test. Both live behind ActionDeps (getUser, revalidate); actionDeps() is called inside each wrapper, never at
// module load.
// server-only 0.0.1: its default entry throws. Vitest needs resolve.alias 'server-only' -> node_modules/server-only/empty.js.
// Never a global react-server condition: the jsdom suites would break.
// Prisma 6.19.0: upsert({ create: { id }, update: {} }) is SELECT then INSERT and raced in 205-210 of 240 concurrent
// calls; update: { id } emits ON CONFLICT DO UPDATE and passed 240 of 240.
// Prisma: update() with a non-unique field in where (id + user_id) is allowed and throws P2025 when nothing matches;
// updateMany returns count 0 instead. Use the form the contract names for each function.
// Zod 3.25.76: .trim() before .min()/.max(); z.string().min(1).trim() accepts "  ". .uuid() accepts the nil UUID and
// upper case, which only ever fail the ownership check.
// The purge prefix is "prompt-" with the hyphen: "prompthub-tabs-state" and "prompthub:user-settings:v1" also start with
// "prompt". Collect localStorage keys before removing any: removeItem shifts key(i).
// zustand persist rewrites its key on the next set(): resetTabs() first, then useTabStore.persist.clearStorage().
// signUp with email confirmation on returns a user and no session, so ensureProfileExists keeps taking the id from its
// caller rather than reading getUser().
// The folder components treat a thrown error as failure (FolderItem.tsx:69,97,133; FolderTree.tsx:62;
// FolderToolbar.tsx:24,36,49). An ActionResult failure does not throw: every caller must branch on success.
// useActiveTabFolderSync.test.tsx hydrates the workspace cache and never binds a user: it must pass unedited.
// Database suites skip without TEST_DATABASE_URL and throw in GitHub Actions without it; CI supplies it.
```

## Implementation Blueprint

The runner, its dependency interfaces, the auth handler shape, the per-action table, the service rules and the CTE
are fixed in [the action contract](docs/P7S2-action-contract.md); this section gives the order and the reasoning.

Data model: no schema change and no migration. `Folder.parent_id` and `Prompt.folder_id` reference `Folder.id` alone
(`prisma/schema.prisma:26,45`), which is why ownership is checked in application code (Q8). Both cascade on delete,
which is why `deleteFolder` must collect descendants before it deletes.

```text
wrapper  (actions.ts, "use server")   return handlers.createFolder(actionDeps(), input)
handler  (handlers.ts, server-only)   defineAction({ name, schema, limit, failure, revalidate, run })
runner   (action-runner.ts)           safeParse -> getUser -> allow(limit, user.id) -> run -> revalidate; catch:
                                      rethrowIfRedirect, console.error, fixed failure
service  (service.ts, server-only)    (db, userId, input): every statement where user_id; ownership of referenced
                                      rows in the same $transaction as the write
```

Integration points: one new dependency (`server-only` 0.0.1) and its Vitest alias; no environment variable; no CI
change (the isolation suites use the existing `TEST_DATABASE_URL` service); one route deleted; the `(app)` layout
passes the user id to `WorkspacePreloader`.

Error handling: services return `ActionResult` for expected outcomes (not found, duplicate title, invalid tags) and let
database errors throw, so a transaction rolls back; the runner turns any throw into the action's fixed failure message
and logs it. A missing row and another user's row produce the same message. Client callers branch on `success`, roll
back optimistic changes and show `result.error`. The sign-out purge never throws, so a blocked storage cannot stop a
sign-out.

## Task List

Eleven tasks, each 1.5 to 4 hours, 32.5 hours in all. One agent per task writes its tests first and shows them failing
for the stated reason. Each task ends with every gate green except T4, whose action signature change breaks the folder
components until T5: they run back to back in one checkout and are gated together. Parallel tasks run in separate
worktrees, because agents sharing a checkout see one another's intentionally failing tests.

| Task | Title | Agent | Hours | After | [P] |
|---|---|---|---|---|---|
| P7S2T1 | Add the action runner, its dependencies and the test seam | `senior-backend-engineer` | 3 | none | |
| P7S2T2 | Make ensureProfileExists a race-free server-only helper | `senior-backend-engineer` | 1.5 | T1 | |
| P7S2T3 | Validate the auth actions and delete the sign-out route | `senior-backend-engineer` | 2.5 | T2 | with T4, T6, T8 |
| P7S2T4 | Move the folder actions onto the runner with ownership checks | `senior-backend-engineer` | 4 | T2 | with T3, T6, T8 |
| P7S2T5 | Update the folder components for ActionResult and nested deletes | `senior-frontend-engineer` | 3 | T4 | with T6, T7 |
| P7S2T6 | Split the prompt actions and harden prompt CRUD and search | `senior-backend-engineer` | 4 | T2 | with T3, T4, T8 |
| P7S2T7 | Move tags, history and the editor actions onto the runner | `senior-backend-engineer` | 3.5 | T6 | with T5 |
| P7S2T8 | Move the profile, workspace and dashboard actions onto the runner | `senior-backend-engineer` | 3 | T2 | with T3, T4, T6 |
| P7S2T9 | Purge client state on sign-out and bind the workspace cache | `senior-frontend-engineer` | 3 | T5, T8 | |
| P7S2T10 | Enforce the isolation rule with an inventory test | `qa-test-automation-engineer` | 2 | T3 to T9 | |
| P7S2T11 | Sweep the documentation and reconcile the wip files | `documentation-manager` | 3 | T10 | |

The main session provisions the test database before T1 (a disposable local Postgres 17, migrated with
`npx prisma migrate deploy`, behind `TEST_DATABASE_URL`), dispatches `security-analyst` to review the diff of T3, T4,
T6 and T7 before each commit, and alone edits issues. At INITIAL it files the task issues under #39, a `type: dev-review`
issue for the browser flows below, and the F-1 caps, Q8 composite keys and DR-26 issues; it comments on #48 and #51
with the parts this PRP delivers.

## Validation Loop

Run from the repository root. The Prisma and build steps need the placeholder values CI sets.

### Level 1: syntax and style

```bash
export DATABASE_URL=postgresql://user:pass@localhost:5432/db DIRECT_URL=postgresql://user:pass@localhost:5432/db
npx prisma generate && npx prisma validate
npm run lint                                  # baseline 27/10/2026: 0 errors, 15 warnings; none added
npx tsc --noEmit
bash scripts/audit-code-size.sh --summary     # after T7: no RED source file
grep -rln '"use server"' src                  # after T7: only src/features/*/actions.ts
grep -rn 'NEXT_REDIRECT' src                  # after T7: only src/lib/action-runner.ts
```

### Level 2: unit and Postgres-backed tests

```bash
npm test
# Baseline 27/10/2026 without a database: 32 files, 340 passed, 29 skipped. The isolation suites skip without one.

export TEST_DATABASE_URL="postgresql://$PGUSER:$PGPASSWORD@localhost:5432/prompthub_test"
DATABASE_URL=$TEST_DATABASE_URL DIRECT_URL=$TEST_DATABASE_URL npx prisma migrate deploy
npm test                                      # nothing skipped

# Per-file coverage for each file in the scope (read coverage/coverage-summary.json):
npx vitest run --coverage --coverage.include=src/features/folders/service.ts --coverage.reporter=json-summary
```

### Level 3: build and browser

```bash
NEXT_PUBLIC_SUPABASE_URL=https://placeholder.supabase.co NEXT_PUBLIC_SUPABASE_ANON_KEY=placeholder-anon-key npm run build
# The route list has no /auth/sign-out.
```

There is no end-to-end runner, so these browser flows go to the dev-review issue and are reported as not run by agents:
sign in with a wrong password and with an unconfirmed email (fixed messages); create, rename and delete a folder, and
delete a folder whose sub-folder holds a document open in a tab (the tab closes); force a failure (stop the database)
and see the error toast with the optimistic change rolled back; sign out as A and sign in as B in the same tab (no A
folder names, no A tabs, no `prompt-` keys in DevTools storage); update the display name; open the dashboard.

## Final Validation Checklist
- [ ] `npm test` passes with `TEST_DATABASE_URL` set (nothing skipped) and without it (the database suites skipped)
- [ ] Each red step's failing output is recorded in the REPORT
- [ ] `npx prisma validate`, `npm run lint`, `npx tsc --noEmit`, the size audit and `npm run build` pass
- [ ] The inventory test passes; the register has no `src/features/prompts/actions.ts` row
- [ ] Coverage of at least 80% on every file in the scope, each exemption recorded with its reason
- [ ] `docs/rules/testing.md` states the isolation rule; `docs/rules/project.md` names the handler layer and has no
  route handler and no "Some actions do not comply yet" sentence
- [ ] Every drift row fixed or filed; every edited source file has a header with a changelog line
- [ ] Browser flows listed as not run and handed to the dev-review issue; #46 untouched

## Anti-Patterns to Avoid
- Do not mock a module of this repository (`vi.mock("@/...")`), import `@/lib/db`, `@/lib/action-deps` or Supabase
  code in a test, or edit an existing test to make a change pass
- Do not export anything but a one-line async wrapper from a `"use server"` file, and never a function taking `userId`
- Do not read `getUser()`, `cookies()`, `headers()` or `revalidatePath` inside a handler or service: take them from deps
- Do not check ownership in one statement and write by `id` alone in another; put `user_id` in the writing statement and
  the reference check in the same transaction
- Do not return a different message for another user's row than for a missing one, or echo a Supabase or exception
  message to the client
- Do not add a Zod `.min()` or `.max()` before `.trim()`
- Do not upsert with an empty `update`
- Do not delete `prompthub:user-settings:v1` or any key outside the `prompt-` prefix and the tab store
- Do not widen into #48's shared store, #46, the F-1 caps or a schema migration; file what you find

----
**PRP Status**: TODO
**PRP ID**: P7S2
**PRP Document**: P7S2-server-side-security-hardening
**Tasks**: 11 tasks (P7S2T1 - P7S2T11)
**Phase**: Phase 7 - Hardening (Server-side security)
**Dependencies**: P7S1 (Complete)
**Next PRP**: P7S3 - Production readiness
**Recommendations**:
Agents:
- `senior-backend-engineer` (Tasks 1-4, 6-8)
- `senior-frontend-engineer` (Tasks 5, 9)
- `qa-test-automation-engineer` (Task 10)
- `documentation-manager` (Task 11)
- `security-analyst` (review of Tasks 3, 4, 6 and 7 before each commit)
Notes:
- Q1 to Q7 confirmed by the developer on 27/10/2026; Q8 stands as the default; D9 to D13 made here and open to review
- A new auth and security surface: the Stage 3 review loop is not skipped
- T4 and T5 are gated together; parallel tasks run in separate worktrees
- Browser flows go to a dev-review issue filed at INITIAL; #46 stays with the developer
**Estimated Implementation Time (FTE)**: 30-36 hours (4-5 days)
