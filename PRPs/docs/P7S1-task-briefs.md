# PromptHub
## P7S1 Task Briefs

| `Title` | `Created` | `Last modified` |
|---------|-----------|-----------------|
| P7S1 Task Briefs | 20/10/2026 12:38 GMT+10 | 20/10/2026 13:31 GMT+10 |

## Table of Contents
- [Purpose](#purpose)
- [References](#references)
- [Current and Desired Trees](#current-and-desired-trees)
- [Known Gotchas](#known-gotchas)
- [Environment for Database Tests](#environment-for-database-tests)
- [Server Contract](#server-contract)
- [Red to Green Map](#red-to-green-map)
- [Briefs](#briefs)

## Purpose

The per-task detail for [the PRP](../P7S1-editor-data-integrity.md). Interfaces, the protocols and the budgets are in
[the contract](P7S1-editor-persistence-contracts.md) and are not repeated. This file holds what every task shares and the
briefs of T1, T2, T3 and T9; the client briefs T4 to T8 are in [P7S1-task-briefs-client.md](P7S1-task-briefs-client.md#briefs).
An agent given one task reads its brief, the contract, the spike it names, and the source the brief cites; it checks every
cited path and line against the code first. Agents never commit, push, branch or touch issues
([Never](../../.claude/AGENT-CONTRACT.md#never)); the main session reviews each diff, runs every gate, and commits with
`Refs #NN`. A brief's steps are in order: a step that names a red test is finished only when that test has been run and
shown failing for the stated reason, and the agent reports the failing output.

## References

```yaml
- file: src/features/editor/components/EditorPane.tsx
  why: the component being decomposed. 93-96 useLocalStorage; 98-119 autosave; 121-129 draft effect; 131-162 cache and
    tab effect; 164-208 handleSave; 210-217 handleSetTitle (stale closure, #36); 219-222 handleVersionRestored (#32);
    56-57 the re-export and a false comment about WorkspacePreloader; 244 the loading check; 281-285 the Monaco guard.
  critical: 329 lines (YELLOW). It must end shorter. Its component function already warns at 234 lines.

- file: src/features/editor/hooks/useDocumentLoader.ts
  why: 137-242 the load effect; 154-161 wipe before the loadedRef check; 165-184 cache branch; 186 the mark set before
    the fetch; 198-202 the abort branch; 218-228 the draft restore (#34); 244-250 the transition effect; 256-258
    resetLoadedRef; 49-62 and 68-78 exports with no caller.
  critical: three lint warnings today (112, 137, 140). The rewrite ends with none.

- file: src/features/editor/components/Editor.tsx
  why: 137-142 handleMount applies the `value` of the render that created it, so the editor must mount only for a
    ready document (see Editor View in the contract).

- file: src/features/editor/hooks/useAutoSave.ts
  why: 62-82 the effect that compares nothing to the saved values (#35). Its only caller is EditorPane.tsx:113.

- file: src/features/editor/actions.ts
  why: saveNewVersion 39-123 (snapshot of the previous row at 86-96) and autoSavePrompt 135-183. Mirror the shell.

- file: src/features/prompts/actions.ts
  why: getPromptVersionHistory 584-629 and restorePromptVersion 631-699 (the unscoped update at 681). RED, 699 lines,
    split in #51, ESLint max-lines disabled in the file.

- file: src/features/editor/components/VersionHistoryDialog.tsx
  why: 54-69 handleRestore calls the action and then onRestored() with no data; 72 onOpenChange closes at any time.

- file: src/features/tabs/components/TabContent.tsx
  why: 58-60 EditorPane has no key, so switching between two document tabs re-renders one instance with new props, and
    a switch to a settings tab unmounts it.

- file: src/components/layout/Header.tsx
  why: 23 and 39 import and call clearDocumentCache through EditorPane's re-export (T5 repoints it).

- file: src/features/prompts/components/DocumentToolbar.tsx
  why: 158-172 a rename from the list updates only the list store; the open editor keeps the old title (follow-up F-4).

- file: prisma/schema.prisma
  why: Prompt (updated_at @updatedAt; folder_id and folder nullable) and PromptVersion (created_at default now(), index
    on prompt_id). Read it with the Read tool before editing any actions.ts: .claude/hooks/dependencies.json requires it.

- file: .github/workflows/ci.yml
  why: the verify job. Lines 13-14 say CI never connects to a database; that becomes false in T1.

- file: docker-compose.yml
  why: db is postgres:17-alpine on host port 54322, POSTGRES_DB postgres.

- file: wip/P7S1-draft-spike.ts, wip/P7S1-loader-spike.ts, wip/P7S1-persistence-spike.ts and their .test.tsx files
  why: the reference implementations of T4 to T8, 153 tests. See Purpose of the contract for how to adapt them.

- file: wip/P7S1-loader-race-diagnostic.test.tsx and wip/P7S1-autosave-timers-probe.test.tsx
  why: probes against the CURRENT loader and the CURRENT useAutoSave; their failing assertions are the T5 and T6 red.

- file: wip/P7S1-vitest.diag.config.ts
  why: runs the wip suites; delete with them in T9.

- docfile: wip/P7S1-research-drift.md
  why: the drift register; its rows name the task that fixes each.

- doc: docs/rules/testing.md#rules
  critical: never mock a module of this repository (sonner is not one); inject seams; never edit an existing test to make
    a change pass.

- docfile: docs/project/PromptHub_06_PLAN_01.md
  why: line 214 (Step 3b) defines autosave as updating the current content and manual save as creating versions.

- url: https://nextjs.org/docs/14/app/building-your-application/data-fetching/server-actions-and-mutations
  why: a "use server" file marks all its exports as Server Actions; treat them as public-facing API endpoints.

- url: https://www.prisma.io/docs/v6/orm/prisma-client/queries/transactions
  why: interactive transactions: maxWait 2 s and timeout 5 s by default, rollback when the callback throws.

- url: https://www.prisma.io/docs/v6/orm/prisma-client/using-raw-sql/raw-queries
  why: $queryRaw as a tagged template is parameterized. Used once, for FOR UPDATE.

- url: https://www.postgresql.org/docs/17/explicit-locking.html
  why: SELECT ... FOR UPDATE blocks other writers of the row until the transaction ends (same text in the 16 docs).

- url: https://www.postgresql.org/docs/17/functions-datetime.html
  why: CURRENT_TIMESTAMP is the start of the transaction and does not change inside it.

- url: https://v2.vitest.dev/guide/environment.html
  why: the // @vitest-environment control comment. The installed 2.1.9 reads it with a regex over the whole file
    (node_modules/vitest/dist/chunks/resolveConfig.rBxzbVsl.js:6559).

- url: https://testing-library.com/docs/react-testing-library/api/
  why: renderHook (result.current, rerender, unmount, initialProps, wrapper) and act.
```

## Current and Desired Trees

```text
CURRENT                                            DESIRED (task)
src/features/editor/                               src/test/db.ts, db.test.ts, storage-fake.ts              (T1, T4)
  actions.ts                                       src/hooks/use-latest.ts + test                          (T5)
  schemas.ts, schemas.test.ts                      src/features/editor/service.ts                          (T2, T3)
  components/EditorPane.tsx (329)                  src/features/editor/service.save.test.ts                (T2)
  components/VersionHistoryDialog.tsx              src/features/editor/service.restore.test.ts             (T3)
  hooks/useAutoSave.ts                             src/features/editor/sync.ts, draft.ts, document-cache.ts (T4)
  hooks/useDocumentLoader.ts (279)                   and a .test.ts for each                               (T4)
  hooks/useLocalStorage.ts                         loader-state.ts, loader-protocol.ts                     (T5, T6)
  hooks/index.ts                                   hooks/useDocumentLoader.ts (rewritten) + tests          (T5)
src/features/prompts/actions.ts (699, RED)         hooks/useAutoSave.ts, useDraftSync.ts + tests           (T6)
src/components/layout/Header.tsx                   hooks/useDocumentCacheSync.ts, useVersionSave.ts,
vitest.config.ts (include *.test.ts)                 useServerAutoSave.ts, useDocumentPersistence.ts       (T7)
                                                   hooks/useVersionRestore.ts                              (T8)
                                                   hooks/useLocalStorage.ts DELETED                        (T6)
```

## Known Gotchas

```typescript
// VERIFIED 20/10/2026 on Postgres 16.15 with Prisma 6.19.0. CI and Docker run Postgres 17; the behaviours used (row
// locks, transaction-stable CURRENT_TIMESTAMP, timestamp(3)) are documented identically for 16 and 17.
// - tx.$queryRaw`... FOR UPDATE` works inside prisma.$transaction(async (tx) => ...) and a concurrent updateMany on the
//   row waits for the commit (the blocked writer finished 1 ms after the lock holder committed).
// - Prisma stamps created_at with now() itself, per create, in the app instance: two instances with different clocks
//   can stamp a later write earlier. Under the prompt row lock the autoincrement id is monotonic per prompt, so the
//   service orders versions by { id: "desc" } alone, including the "newest version" lookup.
// - Prisma filters title_snapshot: null as IS NULL. Compare stored titles with === (null is not "").
// - The eight migrations apply from scratch to an empty Postgres 16 (prisma migrate deploy).

// VERIFIED: server actions in one tab run one at a time in call order (next/dist/shared/lib/router/action-queue.js:112-143).
// A router navigation discards a pending action's state update (121-135); the editor never navigates.

// VERIFIED: the Monaco wrapper applies a changed `value` with executeEdits and suppresses onChange for it
// (node_modules/@monaco-editor/react/dist/index.js). Restore needs no extra editor call; Ctrl+Z afterwards is a user edit.
// Editor.tsx handleMount applies the `value` of its first render, which is why the editor mounts only when ready.

// VERIFIED: renamePrompt (prompts/actions.ts:248-257) sets updated_at, which is why updated_at is not a draft base.
// VERIFIED: createPrompt stores title null and content "" for a new document (prompts/actions.ts:96-127).

// CRITICAL: every export of a "use server" file is a public endpoint. service.ts takes userId: no directive, and no
// import from a client module. Actions pass user.id from supabase.auth.getUser(), never an id from the request.

// CRITICAL: React 18 Strict Mode (the App Router dev default) re-runs effects once on mount and keeps refs.

// Gotcha: the Stop hook runs `npm test` at every turn end and refuses a green run produced by editing tests after a
// red stop. Finish every task with the suite green; DB-backed suites must skip, not fail, without TEST_DATABASE_URL.

// Gotcha: write files only with Write and Edit; never cd in Bash (the logging hook writes logs/ into the cwd); never
// put .env, process.env or printenv in a Bash or Grep command (the secrets hook blocks it). Delete with git, not rm -rf.

// Gotcha: .test.tsx files run under node unless they carry `// @vitest-environment jsdom` after the header block.
// esbuild's JSX setting is not configured for tests: write hook tests without JSX (use createElement for wrappers).
// vitest.config.ts sets no `globals`, so Testing Library's automatic cleanup is never registered: every DOM test file
// calls afterEach(cleanup) and afterEach(() => vi.useRealTimers()), and resets the zustand stores, jsdom localStorage
// and the document cache in beforeEach. With fake timers drive time with
// `await act(async () => { await vi.advanceTimersByTimeAsync(500) })` and do not combine them with waitFor.
// vi.mock("sonner") is allowed (it is not a module of this repository); the zustand stores are used for real.

// Gotcha: `npm install --no-save` copies of jsdom and Testing Library exist in node_modules from the research; `npm ci`
// removes them. T1 installs them properly.

// Gotcha: Prompt.folder_id is nullable but PromptWithFolder.folder is not, so useDocumentCacheSync's promptData.folder.id
// would throw for an unfiled prompt. Pre-existing and out of scope: follow-up F-6.
```

## Environment for Database Tests

T2, T3 and the smoke test of T1 need a Postgres reachable on a loopback host, with a database whose name contains
"test" and the project migrations applied. The helper refuses anything else.

| Where | How |
|---|---|
| Developer machine | `docker compose up -d db`, then `docker compose exec db createdb -U postgres prompthub_test`, then `DATABASE_URL=... DIRECT_URL=... npx prisma migrate deploy` against `postgresql://postgres:postgres@localhost:54322/prompthub_test`, then `TEST_DATABASE_URL=` the same URL |
| Cloud session without Docker | the main session creates a throwaway cluster (`pg_createcluster 16 <name> --port <port>`, `pg_ctlcluster 16 <name> start`, set the `postgres` password, `createdb prompthub_test`, `prisma migrate deploy`) and passes `TEST_DATABASE_URL` in the dispatch prompt |
| CI | the `postgres:17-alpine` service container of T1 |

The main session provisions the database before it dispatches T1, T2 or T3 and puts `TEST_DATABASE_URL` in the prompt. An
agent that is dispatched without it writes its failing tests, reports "red not shown: no database" and stops; the task is
not finished. The main session then provides the database and resumes the same agent with `SendMessage`, so the
implementation is written only after the red was shown. The CI run is the final proof for the database-backed suites.

## Server Contract

The server half of the contract, used by T2 and T3. The client half is in [the contract](P7S1-editor-persistence-contracts.md).

### Server Shells

Each action keeps its shell and gains only the call into the service. Nothing is added or removed, so rate limits and
validation do not move; issue #48 owns changing them.

| Action | File | Shell after the change |
|---|---|---|
| `saveNewVersion` | `src/features/editor/actions.ts` | parse `saveNewVersionSchema`, `titleValidationSchema`, authenticate, rate limit, `saveVersion` |
| `autoSavePrompt` | `src/features/editor/actions.ts` | parse `autoSaveSchema`, authenticate, `autoSaveDocument` (no rate limit, no title validation) |
| `getPromptVersionHistory` | `src/features/prompts/actions.ts` | parse, authenticate, `listVersions` (no rate limit) |
| `restorePromptVersion` | `src/features/prompts/actions.ts` | parse, authenticate, `restoreVersion` (no rate limit) |

Every shell keeps the `NEXT_REDIRECT` rethrow and a catch that returns a generic failure. Results: `saveNewVersion`
returns `{ versionId }`, `autoSavePrompt` returns nothing as today, `restorePromptVersion` returns `{ title, content }`.
No timestamp is returned: nothing depends on one (the draft base is a content hash, and writes complete in call order, see
[Write Ordering and Pausing](P7S1-editor-persistence-contracts.md#write-ordering-and-pausing)). `service.ts` orders
versions by `id desc` alone: ids are assigned in write order under the prompt row lock, while `created_at` is stamped by
each app instance's clock.

### Server Pseudocode

```typescript
// T2 saveVersion. CRITICAL: the scoped update comes first; it is the ownership check and the row lock.
return db.$transaction(async (tx) => {
  const written = await tx.prompt.updateMany({ where: { id: promptId, user_id: userId }, data: { title, content, updated_at: new Date() } })
  if (written.count === 0) return fail("Prompt not found or access denied")
  const newest = await tx.promptVersion.findFirst({ where: { prompt_id: promptId }, orderBy: { id: "desc" } })
  if (newest && newest.title_snapshot === title && newest.content_snapshot === content) return ok({ versionId: newest.id })
  const created = await tx.promptVersion.create({ data: { prompt_id: promptId, title_snapshot: title, content_snapshot: content } })
  return ok({ versionId: created.id })
})

// T3 restoreVersion. GOTCHA: FOR UPDATE is the first statement; the working copy is read from its result.
const rows = await tx.$queryRaw<{ title: string | null; content: string }[]>`
  SELECT title, content FROM "Prompt" WHERE id = ${promptId} AND user_id = ${userId} FOR UPDATE`
if (rows.length === 0) return fail("Prompt not found or access denied")
const version = await tx.promptVersion.findFirst({ where: { id: versionId, prompt_id: promptId } })
if (!version) return fail("Version not found")
let newest = await findNewest(tx, promptId)                      // orderBy { id: "desc" }
if (!newest || !same(newest, rows[0])) newest = await tx.promptVersion.create({ data: snapshotOf(promptId, rows[0]) })
await tx.prompt.updateMany({
  where: { id: promptId, user_id: userId },
  data: { title: version.title_snapshot, content: version.content_snapshot, updated_at: new Date() },
})
if (!same(newest, version)) await tx.promptVersion.create({ data: snapshotOf(promptId, version) })
return ok({ title: version.title_snapshot, content: version.content_snapshot })
```

`listVersions` orders by `id desc` and takes 50. The client half has no pseudocode: the spikes are its reference implementation.

## Red to Green Map

Each defect has a test that fails first, against the stated code, for the stated reason. A test that passes on arrival is
recorded as a regression test, not as a red.

| Defect | Red shown in | Against | The test asserts |
|---|---|---|---|
| Loader race (F-1) | T5 Step 2 | the behaviour-preserving `io` refactor of the current loader | a fresh mount ends with the server's title and content, `loading` is true while the identity is pending and on the first render (the probes' scenarios A, B and D fail today); the cases for the new API (`ready`, `synced`, `markSynced`, `applyServerState`, the identity timeout, a rejected fetch) fail because the API is absent |
| #33 history | T2 Step 2 | the unchanged extraction of the current save | save A, autosave B, save C lists C then A, never B; an identical save adds no row |
| #32 server | T3 Step 1 | the unchanged extraction of the current restore | the result carries `{ title, content }`; the working copy is snapshotted before the restored state; versions are ordered by id; another user's prompt is not touched |
| #34 stale draft | T6 Step 1 | T5's loader, which applies any differing raw draft | a v1 draft whose base differs from the server content hash is not applied, its text is stashed and a warning is shown; an empty draft is applied; a legacy draft that differs from a saved document is not applied |
| #34 clear after autosave | T6 Step 1 | a compiling stub of `useDraftSync` | after the baseline catches up, `storage.getItem(draftKey(id))` is null (asserted on the storage, not through `readDraft`) |
| #35 | T6 Step 1 | the current `useAutoSave` | no write on mount, none after an edit reverted to the baseline, none for another document's baseline |
| #36 and the busy flags | T7 Step 2 | the Step 1 extraction, which keeps the stale closure and has no `finally` | one title confirmation saves once with the confirmed title and sets the working title; a rejected save or autosave resets its flag; a second Ctrl+S is ignored; autosave is paused during a save; a save that completes after a switch does not force the other tab's dirty flag |
| #32 client | T8 Step 2 | the Step 1 `handleRestore`, which calls the action and updates nothing | after `handleRestore` the loader shows the restored row, `synced` equals it, the draft is gone and the cache entry is replaced; unsaved edits are saved first and the restore is aborted if that fails; a restore that completes after a switch or an unmount is safe |

Regression tests (green on arrival, written in the step named): T7 Step 2: S-1 through the real handlers, the tab and cache
metadata, Strict Mode. T8 Step 2: a failed or rejected restore keeps the working copy and resets its flag.

## Briefs

### P7S1T1 Add the Postgres and DOM test harness and CI service

Agent `qa-test-automation-engineer`, 3 hours, no predecessor. This brief authorises what the agent's definition
otherwise forbids: adding the three devDependencies and editing `vitest.config.ts`, `.env.example` and
`.github/workflows/ci.yml`.

Step 1, red: CREATE `src/test/db.test.ts` with the guard cases (always run, including a remote host, `.supabase.co`, a name
without "test", and the CI throw) and a smoke test under `describeDb`; they fail because `src/test/db.ts` does not exist
(create it as a stub whose functions throw). Step 2: CREATE `src/test/db.ts`: `getTestDatabaseUrl(env = process.env)` returns
null when `TEST_DATABASE_URL` is unset and throws when it is unset and `GITHUB_ACTIONS` equals "true";
`assertSafeTestDatabaseUrl(url)` requires the postgres or postgresql scheme, a host of `localhost`, `127.0.0.1` or `::1`,
and a database name containing "test", and throws otherwise; `describeDb` is `describe` when a URL exists and
`describe.skip` otherwise; `useTestDatabase()` returns a `PrismaClient` built with `datasourceUrl`, asserts in `beforeAll`
that `to_regclass` finds `"Prompt"` and `"PromptVersion"` (message: run `npx prisma migrate deploy`), and disconnects in
`afterAll`; `createTestUser(db)` and `createTestPrompt(db, userId, fields)` use unique ids, and a user is removed with
`db.profile.delete` (cascade).

MODIFY `package.json` and `package-lock.json` with `npm install -D jsdom@^26.1.0 @testing-library/react@^16.3.0
@testing-library/dom@^10.4.0`; nothing else changes version. MODIFY `vitest.config.ts`: `include:
['src/**/*.test.{ts,tsx}']`; `coverage.include` lists every source file the contract's module map names (a pattern for a
file that does not exist yet matches nothing, so later tasks never edit this file), without the absent
`src/lib/diff-utils.ts`. MODIFY `.env.example`: a `# Tests` group with `TEST_DATABASE_URL=""`. MODIFY
`.github/workflows/ci.yml`: add three pieces to the `verify` job, and rewrite the comment at lines 13-14 that says CI never
connects to a database.

```yaml
services:
  postgres:
    image: postgres:17-alpine
    env:
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
      POSTGRES_DB: prompthub_test
    ports:
      - 5432:5432
    options: >-
      --health-cmd "pg_isready -U postgres -d prompthub_test"
      --health-interval 5s
      --health-timeout 5s
      --health-retries 10
```

The `env` block of the job keeps its placeholders and gains one entry:

```yaml
env:
  TEST_DATABASE_URL: postgresql://postgres:postgres@localhost:5432/prompthub_test
```

A new step goes after "Validate Prisma schema" and before "Unit tests":

```yaml
- name: Apply migrations to the test database
  run: npx prisma migrate deploy
  env:
    DATABASE_URL: postgresql://postgres:postgres@localhost:5432/prompthub_test
    DIRECT_URL: postgresql://postgres:postgres@localhost:5432/prompthub_test
```

Acceptance: `npm test` shows the 29 existing tests plus the new ones with the DB suites skipped, and with
`TEST_DATABASE_URL` set the smoke test passes. Documentation sync after this task (main session, `documentation-manager`):
drift rows DR-7, DR-8, DR-9, DR-11 and the rules half of DR-15; this task itself fixes DR-10, DR-14 and the `.env.example`
half of DR-15.

### P7S1T2 Move save and autosave into a tested service with commit-style versions

Agent `senior-backend-engineer`, 3 hours, after T1. Needs `TEST_DATABASE_URL`. READ `prisma/schema.prisma` first.
Step 1: CREATE `src/features/editor/service.ts` by extracting the logic of `saveNewVersion`, `autoSavePrompt`,
`getPromptVersionHistory` and `restorePromptVersion` with unchanged behaviour into `saveVersion`, `autoSaveDocument`,
`listVersions` and `restoreVersion` (`(db, userId, input)`, `ActionResult` results, `EditorDb = Pick<PrismaClient,
"prompt" | "promptVersion" | "$transaction">`); the four actions call it and keep their shells. Step 2, red: CREATE
`service.save.test.ts` (`describeDb`). The ownership cases pass on arrival and are regression tests; the commit-style cases
fail against the extraction. Step 3: change `saveVersion` to the semantics of the server pseudocode and confirm
step 2 goes green. Cases: save A, autosave B, save C lists C then A, both restorable by id | an identical save twice adds
one row | two parallel identical saves add one row | a save after autosave moved the row to the same content adds one row
equal to the saved state | autosave adds no version | user B cannot save or autosave user A's prompt and nothing changes | an
unknown prompt returns not found. `saveNewVersion` returns `{ versionId }`. Documentation sync after T3 covers this task's
behaviour change.

### P7S1T3 Move restore and history into the service

Agent `senior-backend-engineer`, 3 hours, after T2. Needs `TEST_DATABASE_URL`. Step 1, red: CREATE `service.restore.test.ts`
against the T2 extraction of restore. Step 2: implement `restoreVersion` and `listVersions` per the server pseudocode; the two actions in `src/features/prompts/actions.ts` delegate and `restorePromptVersion` returns `{ title,
content }`. Report the file's new line count. Cases: the working copy not in history is snapshotted, then the restored
state, in that id order, and history lists the restored state first | the working copy equal to the newest version adds no
snapshot | restoring the newest version when the working copy equals it adds no duplicate, and when the working copy differs
it adds the working copy snapshot and a row for the restored state | restore then autosave an edit leaves the restored text
plus the edit and history unchanged by the autosave | autosave then restore keeps the autosaved text in history | restore and
autosave started together with `Promise.all` leave the autosaved text either as the row content or in history | user B
cannot restore or list user A's history | a version of another prompt returns not found | the list orders by `id` descending
and caps at 50. Documentation sync after this task (main session): DR-4, DR-6, DR-12 and DR-18.

### P7S1T9 Sweep the documentation and the wip files

Agent `documentation-manager`, 2 hours, after T8. Verify, do not duplicate the earlier syncs: every row of the drift
register is fixed or filed; every changed file's header changelog has a line; ADD a Testing section to `README.md`
(`npm test`, the database-backed variant, the DOM environment: DR-13); confirm the code-size register row for
`src/features/prompts/actions.ts` has the new count; delete the PRP's wip files, whose reference implementations are now
production code with tests (`wip/P7S1-loader-race-diagnostic.test.tsx`, `wip/P7S1-autosave-timers-probe.test.tsx`,
`wip/P7S1-draft-spike.ts`, `wip/P7S1-draft-spike.test.tsx`, `wip/P7S1-loader-spike.ts`, `wip/P7S1-loader-spike.test.tsx`,
`wip/P7S1-persistence-spike.ts`, `wip/P7S1-persistence-spike.test.tsx`, `wip/P7S1-vitest.diag.config.ts`), and reconcile
`wip/P7S1-research-drift.md` with a closing line per row; search the repository for stale references to the removed names
(`useLocalStorage`, `resetLoadedRef`, `hydrateDocumentCache`, `isTransitioning`, `contentPromptIdRef`, `titlePromptIdRef`)
and for the draft key `prompt-<id>`. The main session, not this agent, amends dev-review #38 (it already lists "repeat across
two tabs"; the new flows are a cold open, an open after visiting Settings, and the conflict toast's "Restore my text") and
comments on #37, #41, #44 (drafts now live under `prompt-v1-<id>`, `prompt-v1-<id>:conflict` and, until migrated,
`prompt-<id>`; a `prompt-` prefix purge covers all), #45 and #53.
