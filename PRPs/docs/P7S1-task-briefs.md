# PromptHub
## P7S1 Task Briefs

| `Title` | `Created` | `Last modified` |
|---------|-----------|-----------------|
| P7S1 Task Briefs | 20/10/2026 12:38 GMT+10 | 20/10/2026 12:38 GMT+10 |

## Table of Contents
- [Purpose](#purpose)
- [References](#references)
- [Current and Desired Trees](#current-and-desired-trees)
- [Known Gotchas](#known-gotchas)
- [Environment for Database Tests](#environment-for-database-tests)
- [Red to Green Map](#red-to-green-map)
- [Briefs](#briefs)

## Purpose

The per-task detail for `PRPs/P7S1-editor-data-integrity.md`. Interfaces, the loader and draft protocols, pseudocode and
the budgets are in `P7S1-editor-persistence-contracts.md` and are not repeated. An agent given one task reads its brief
here, the contract, and the source the brief cites; it checks every cited path and line against the code first.
Agents never commit, push, branch or touch issues (`.claude/AGENT-CONTRACT.md#never`); the main session reviews each
diff, runs every gate, and commits with `Refs #NN`.

## References

```yaml
- file: src/features/editor/components/EditorPane.tsx
  why: the component being decomposed. 93-96 useLocalStorage; 98-119 autosave; 121-129 draft effect; 131-162 cache and
    tab effect; 164-208 handleSave; 210-217 handleSetTitle (stale closure, #36); 219-222 handleVersionRestored (#32);
    56-57 the re-export and a false comment about WorkspacePreloader; 281-285 the Monaco onChange guard.
  critical: 329 lines (YELLOW). It must end shorter. Its component function already warns at 234 lines.

- file: src/features/editor/hooks/useDocumentLoader.ts
  why: 137-242 the load effect; 154-161 wipe before the loadedRef check; 165-184 cache branch; 186 the mark set before
    the fetch; 198-202 the abort branch; 218-228 the draft restore (#34); 244-250 the transition effect; 256-258
    resetLoadedRef; 49-62 and 68-78 exports with no caller.
  critical: three lint warnings today (112, 137, 140). The rewrite ends with none.

- file: src/features/editor/hooks/useAutoSave.ts
  why: 62-82 the effect that compares nothing to the saved values (#35). Its only caller is EditorPane.tsx:113.

- file: src/features/editor/actions.ts
  why: saveNewVersion 39-123 (snapshot of the previous row at 86-96) and autoSavePrompt 135-183. Mirror the shell.

- file: src/features/prompts/actions.ts
  why: getPromptVersionHistory 584-629 and restorePromptVersion 631-699 (the unscoped update at 681). RED, 699 lines,
    split in #51, ESLint max-lines disabled in the file.

- file: src/features/editor/components/VersionHistoryDialog.tsx
  why: 54-69 handleRestore calls the action and then onRestored() with no data.

- file: src/features/tabs/components/TabContent.tsx
  why: 58-60 only the active tab's EditorPane renders, so a switch to a non-document tab and back remounts it.

- file: src/features/prompts/components/DocumentToolbar.tsx
  why: 158-172 a rename from the list updates only the list store; the open editor keeps the old title (follow-up F-4).

- file: prisma/schema.prisma
  why: Prompt (updated_at @updatedAt) and PromptVersion (created_at default now(), index on prompt_id). Read it with the
    Read tool before editing any actions.ts: .claude/hooks/dependencies.json requires it.

- file: .github/workflows/ci.yml
  why: the verify job. Lines 13-14 say CI never connects to a database; that becomes false in T1.

- file: docker-compose.yml
  why: db is postgres:17-alpine on host port 54322, POSTGRES_DB postgres.

- file: wip/P7S1-loader-spike.ts and wip/P7S1-loader-spike.test.tsx
  why: the working reference for the loader protocol, 12 tests, mutation-checked. T5 adapts it.

- file: wip/P7S1-loader-race-diagnostic.test.tsx and wip/P7S1-autosave-timers-probe.test.tsx
  why: the probes against the CURRENT loader and the CURRENT useAutoSave; their failing assertions are the T5 and T6 red.

- file: wip/P7S1-vitest.diag.config.ts
  why: runs the wip probes; reconcile or delete with them in T9.

- docfile: wip/P7S1-research-drift.md
  why: the drift register; its rows name the task that fixes each.

- doc: docs/rules/testing.md#rules
  critical: never mock a module of this repository; inject seams; never edit an existing test to make a change pass.

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
src/features/editor/                               src/test/db.ts, db.test.ts                              (T1)
  actions.ts                                       src/features/editor/service.ts                          (T2, T3)
  schemas.ts, schemas.test.ts                      src/features/editor/service.save.test.ts                (T2)
  components/EditorPane.tsx (329)                  src/features/editor/service.restore.test.ts             (T3)
  components/VersionHistoryDialog.tsx              src/features/editor/sync.ts, sync.test.ts               (T4)
  hooks/useAutoSave.ts                             src/features/editor/draft.ts, draft.test.ts             (T4)
  hooks/useDocumentLoader.ts (279)                 src/features/editor/document-cache.ts, .test.ts         (T4)
  hooks/useLocalStorage.ts                         hooks/useDocumentLoader.ts (rewritten) + .test.tsx      (T5)
  hooks/index.ts                                   hooks/useAutoSave.ts + .test.tsx                        (T6)
src/features/prompts/actions.ts (699, RED)         hooks/useDraftSync.ts + .test.tsx                       (T6)
vitest.config.ts (include *.test.ts)               hooks/useDocumentCacheSync.ts                           (T7)
                                                   hooks/useVersionSave.ts, useServerAutoSave.ts           (T7)
                                                   hooks/useDocumentPersistence.ts + .test.tsx             (T7, T8)
                                                   hooks/useVersionRestore.ts                              (T8)
                                                   hooks/useLocalStorage.ts DELETED                        (T6)
```

## Known Gotchas

```typescript
// VERIFIED 20/10/2026 on Postgres 16.15 with Prisma 6.19.0. CI and Docker run Postgres 17; the behaviours used (row
// locks, transaction-stable CURRENT_TIMESTAMP, timestamp(3)) are documented identically for 16 and 17.
// - tx.$queryRaw`... FOR UPDATE` works inside prisma.$transaction(async (tx) => ...) and a concurrent updateMany on the
//   row waits for the commit (the blocked writer finished 1 ms after the lock holder committed).
// - Two promptVersion.create calls 30 ms apart in one interactive transaction got different created_at, because
//   Prisma stamps now() itself. A raw INSERT that relies on the column default gets the transaction start time for
//   every row. created_at has millisecond precision, so two creates can still share one millisecond: order by
//   { created_at: "desc" }, { id: "desc" } everywhere, including the "newest version" lookup.
// - Prisma filters title_snapshot: null as IS NULL. Compare stored titles with === (null is not "").
// - The eight migrations apply from scratch to an empty Postgres 16 (prisma migrate deploy).

// VERIFIED: server actions in one tab run one at a time in call order (next/dist/shared/lib/router/action-queue.js:112-143).

// VERIFIED: the Monaco wrapper applies a changed `value` with executeEdits and suppresses onChange for it
// (node_modules/@monaco-editor/react/dist/index.js). Restore needs no extra editor call; Ctrl+Z afterwards is a user edit.

// VERIFIED: renamePrompt (prompts/actions.ts:248-257) sets updated_at, which is why updated_at is not a draft base.

// CRITICAL: every export of a "use server" file is a public endpoint. service.ts takes userId: no directive, and no
// import from a client module. Actions pass user.id from supabase.auth.getUser(), never an id from the request.

// CRITICAL: React 18 Strict Mode (the App Router dev default) re-runs effects once on mount and keeps refs.

// Gotcha: the Stop hook runs `npm test` at every turn end and refuses a green run produced by editing tests after a
// red stop. Finish every task with the suite green; DB-backed suites must skip, not fail, without TEST_DATABASE_URL.

// Gotcha: write files only with Write and Edit; never cd in Bash (the logging hook writes logs/ into the cwd); never
// put .env, process.env or printenv in a Bash or Grep command (the secrets hook blocks it). Delete with git, not rm -rf.

// Gotcha: .test.tsx files run under node unless they carry `// @vitest-environment jsdom` after the header block.
// esbuild's JSX setting is not configured for tests: write hook tests without JSX (use createElement for wrappers).
// With fake timers drive time with `await act(async () => { await vi.advanceTimersByTimeAsync(500) })` and do not
// combine them with waitFor. Reset the zustand stores, jsdom localStorage and the document cache in beforeEach.

// Gotcha: `npm install --no-save` copies of jsdom and Testing Library exist in node_modules from the research; `npm ci`
// removes them. T1 installs them properly.
```

## Environment for Database Tests

T2, T3 and the smoke test of T1 need a Postgres reachable on a loopback host, with a database whose name contains
"test" and the project migrations applied. The helper refuses anything else.

| Where | How |
|---|---|
| Developer machine | `docker compose up -d db`, then `docker compose exec db createdb -U postgres prompthub_test`, then `DATABASE_URL=... DIRECT_URL=... npx prisma migrate deploy` against `postgresql://postgres:postgres@localhost:54322/prompthub_test`, then `TEST_DATABASE_URL=` the same URL |
| Cloud session without Docker | the main session creates a throwaway cluster (`pg_createcluster 16 <name> --port <port>`, `pg_ctlcluster 16 <name> start`, set the `postgres` password, `createdb prompthub_test`, `prisma migrate deploy`) and passes `TEST_DATABASE_URL` in the dispatch prompt |
| CI | the `postgres:17-alpine` service container of T1 |

An agent dispatched without `TEST_DATABASE_URL` writes its failing tests, reports "red not shown: no database", and does
not write the implementation; the main session runs them. The CI run is the final proof for the database-backed suites.

## Red to Green Map

Each defect has a test that fails first, against the stated code, for the stated reason.

| Defect | Task and step | Red against | The test asserts |
|---|---|---|---|
| Loader race (F-1) | T5 step 2 | the behaviour-preserving `io` refactor of the current loader | a fresh mount ends with the server's title and content, and `loading` is true while the identity is pending (the probes' scenarios A and D fail today) |
| #33 history | T2 step 3 | the unchanged extraction of the current save | save A, autosave B, save C lists C then A, never B |
| #32 server | T3 step 2 | the unchanged extraction of the current restore | the result carries `{ title, content }`; the working copy is snapshotted before the restored state; the order is by id |
| #32 client | T8 step 2 | the extracted restore handler that resets a ref | after `handleRestore` the loader shows the restored title and content, `synced` equals them, the draft is gone, and autosave was paused during the request |
| #34 stale draft | T6 step 2 | T5's loader, which still applies any differing raw draft | a v1 draft whose base differs from the server content hash is not applied; an empty draft is applied |
| #34 clear after autosave | T7 step 2 | the extracted handlers without the draft effect | after an autosave completes, `storage.getItem("prompt-<id>")` is null (asserted on the storage, not through `readDraft`, which returns null for any invalid value) |
| #35 | T6 step 2 | the current `useAutoSave` | no write on mount, none after an edit reverted to the baseline |
| #36 | T7 step 2 | the extracted handlers that still use the stale closure | one title confirmation calls `saveNewVersion` once with the confirmed title and leaves the dialog closed |

## Briefs

### P7S1T1 Test harness: Postgres, DOM, CI service

Agent `qa-test-automation-engineer`, 3 hours, no predecessor. This brief authorises what the agent's definition
otherwise forbids: adding the three devDependencies and editing `vitest.config.ts`, `.env.example` and
`.github/workflows/ci.yml`.

CREATE `src/test/db.ts`: `getTestDatabaseUrl(env = process.env)` returns null when `TEST_DATABASE_URL` is unset and
throws when it is unset and `GITHUB_ACTIONS` equals "true"; `assertSafeTestDatabaseUrl(url)` requires the postgres or
postgresql scheme, a host of `localhost`, `127.0.0.1` or `::1`, and a database name containing "test", and throws
otherwise; `describeDb` is `describe` when a URL exists and `describe.skip` otherwise; `useTestDatabase()` returns a
`PrismaClient` built with `datasourceUrl`, asserts in `beforeAll` that `to_regclass` finds `"Prompt"` and
`"PromptVersion"` (message: run `npx prisma migrate deploy`), and disconnects in `afterAll`; `createTestUser(db)` and
`createTestPrompt(db, userId, fields)` use unique ids, and a user is removed with `db.profile.delete` (cascade).
CREATE `src/test/db.test.ts`: the guard cases (always run, including a remote host, `.supabase.co`, a name without
"test", the CI throw) and a smoke test under `describeDb`.
MODIFY `package.json` and `package-lock.json` with `npm install -D jsdom@^26.1.0 @testing-library/react@^16.3.0
@testing-library/dom@^10.4.0`; nothing else changes version.
MODIFY `vitest.config.ts`: `include: ['src/**/*.test.{ts,tsx}']`; `coverage.include` lists every source file the
contract's module map names (a pattern for a file that does not exist yet matches nothing, so later tasks never edit this
file), without the absent `src/lib/diff-utils.ts`.
MODIFY `.env.example`: a `# Tests` group with `TEST_DATABASE_URL=""`.
MODIFY `.github/workflows/ci.yml`:

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
    env:   # the existing placeholders stay, plus:
      TEST_DATABASE_URL: postgresql://postgres:postgres@localhost:5432/prompthub_test
    # a new step after "Validate Prisma schema" and before "Unit tests":
      - name: Apply migrations to the test database
        run: npx prisma migrate deploy
        env:
          DATABASE_URL: postgresql://postgres:postgres@localhost:5432/prompthub_test
          DIRECT_URL: postgresql://postgres:postgres@localhost:5432/prompthub_test
```

Rewrite the comment at lines 13-14 that says CI never connects to a database. Red first: the guard tests fail because the
module is missing. Acceptance: `npm test` shows the 29 existing tests plus the new ones with the DB suites skipped, and
with `TEST_DATABASE_URL` set the smoke test passes. Documentation sync after this task (main session, `documentation-manager`):
drift rows DR-7, DR-8, DR-9, DR-11, DR-14 and DR-15.

### P7S1T2 Service: save and autosave

Agent `senior-backend-engineer`, 3 hours, after T1. Needs `TEST_DATABASE_URL`. READ `prisma/schema.prisma` first.
Step 1: CREATE `src/features/editor/service.ts` by extracting the logic of `saveNewVersion`, `autoSavePrompt`,
`getPromptVersionHistory` and `restorePromptVersion` with unchanged behaviour into `saveVersion`, `autoSaveDocument`,
`listVersions` and `restoreVersion` (`(db, userId, input)`, `ActionResult` results, `EditorDb = Pick<PrismaClient,
"prompt" | "promptVersion" | "$transaction">`); the four actions call it and keep their shells. Step 2: CREATE
`service.save.test.ts` (describeDb). Step 3: change `saveVersion` to the commit-style semantics of the contract's
pseudocode and confirm step 2 goes green. Cases: save A, autosave B, save C lists C then A, both restorable by id | an
identical save twice adds one row | two parallel identical saves add one row | a save after autosave moved the row to
the same content adds one row equal to the saved state | autosave adds no version | user B cannot save or autosave
user A's prompt and nothing changes | an unknown prompt returns not found. `saveNewVersion` returns `{ versionId }`.
Documentation sync after T3 covers this task's behaviour change.

### P7S1T3 Service: restore and history

Agent `senior-backend-engineer`, 3 hours, after T2. Needs `TEST_DATABASE_URL`. CREATE `service.restore.test.ts` first,
red against the extracted restore, then implement `restoreVersion` and `listVersions` per the contract; the two actions in
`src/features/prompts/actions.ts` delegate and `restorePromptVersion` returns `{ title, content }`. Report the file's new
line count. Cases: the working copy not in history is snapshotted, then the restored state, in that id order, and history
lists the restored state first | the working copy equal to the newest version adds no snapshot | restoring the newest
version when the working copy equals it adds no duplicate, and when the working copy differs it adds the working copy
snapshot and a row for the restored state | restore then autosave an edit leaves the restored text plus the edit and
history unchanged by the autosave | autosave then restore keeps the autosaved text in history | restore and autosave started
together with `Promise.all` leave the autosaved text either as the row content or in history | user B cannot restore or
list user A's history | a version of another prompt returns not found | the list orders by `created_at` then `id` and caps
at 50. Documentation sync after this task (main session): DR-4, DR-6 and DR-12.

### P7S1T4 Sync helpers, draft store, cache module

Agent `senior-frontend-engineer`, 3 hours, after T1, in parallel with T2 and T3 (disjoint files). Node-environment tests
only. CREATE `sync.test.ts` then `sync.ts`; `draft.test.ts` then `draft.ts`; `document-cache.test.ts` then
`document-cache.ts`, per the contract. Cases: `sameFields` treats null and "" titles as equal; `needsAutoSave` truth table
including a null title, a whitespace title, no baseline, a baseline for another document, an equal pair; `hashContent`
is deterministic, differs for one changed character, differs for different lengths, and has no collision across 10,000
random strings; `parseDraft` for null, "", v1, a wrong version, malformed JSON, valid non-draft JSON and a plain string;
`resolveDraft` for every row of its table; `readDraft`, `writeDraft` and `clearDraft` over an in-memory storage fake
and a storage that throws, including a quota error and compare-and-delete leaving another value alone; the cache module's
user check, merge-only-if-present update, and clear. No consumer is changed in this task.

### P7S1T5 Document loader protocol

Agent `senior-frontend-engineer`, 4 hours, after T4. Step 1, behaviour-preserving: add the `io` parameter
(`fetchPrompt`, `getUserId`) and remove the loader's imports of `getPromptDetails` and the Supabase client; EditorPane
defines a module-level `loaderIo` (`getUserId` wraps `createClient().auth.getUser()` in a try and returns "anonymous"
on no session or an error). Step 2, red: CREATE `useDocumentLoader.test.tsx` from the spike's tests and the two
probes' scenarios. Step 3: implement the protocol (adapt `wip/P7S1-loader-spike.ts`): adopt `document-cache.ts`, add
`ready`, `synced`, `markSynced`, `applyServerState`, remove `isTransitioning`, `contentPromptIdRef`, `titlePromptIdRef`,
the transition effect, `hydrateDocumentCache` and the no-op `clear()`, keep `resetLoadedRef`, set `lastSaved` from
`updated_at`. EditorPane gets the minimum to compile and behave: its effects use `loader.ready` where they used the
removed flags, its cache writes pass `synced`, and the re-export line and its false comment (DR-1, DR-2, DR-3) are
corrected. Decompose so no function in the loader exceeds 80 lines. Cases: all 12 spike tests, the probe scenarios,
`getUserId` returning "anonymous", the every-render invariant.

### P7S1T6 Drafts and autosave baseline

Agent `senior-frontend-engineer`, 4 hours, after T5. Step 1, red tests: loader draft cases (S-2, S-4, S-5, S-7, S-8, S-9
of the contract), `useAutoSave` cases against the current hook (no write on mount; one write for a burst; no write for
an edit reverted to the baseline; none for a blank or null title; none without a baseline; none for another
document's baseline; a baseline change cancels a pending write), and `useDraftSync` cases using a fake storage and a
simulated `markSynced` or `applyServerState` call (S-1, S-3, S-11, S-12, S-13). Step 2: the loader's P5 applies
`resolveDraft` with the two toasts and `io.getStorage`; `useAutoSave` takes `baseline`; CREATE `useDraftSync.ts`; in
EditorPane remove `useLocalStorage`, call `useDraftSync`, pass `baseline: loader.synced` and `promptId: loader.ready ?
promptId : null` to `useAutoSave`, and call `loader.markSynced` after a successful autosave; DELETE `useLocalStorage.ts`
and its barrel lines. Documentation sync after this task (main session): DR-5 and DR-16.

### P7S1T7 Persistence hooks and EditorPane

Agent `senior-frontend-engineer`, 4 hours, after T2, T5 and T6. Step 1, behaviour-preserving: move the cache and tab
effect to `useDocumentCacheSync`, the manual save with the title dialog state and the Ctrl+S listener to
`useVersionSave`, and the autosave handler and the `useAutoSave` call to `useServerAutoSave` (which pauses while saving
or restoring), composed by `useDocumentPersistence` with actions and storage injected; EditorPane composes the loader and
this hook. The old `handleVersionRestored` stays until T8. Step 2, red: CREATE `useDocumentPersistence.test.tsx` with a
harness that renders the loader and the hook together over fakes. Step 3, green: `saveVersion(titleToSave)` shared by
Ctrl+S, the button and the dialog (the #36 fix). Cases: one title confirmation calls `saveNewVersion` once with the
confirmed title and leaves the dialog closed | a placeholder title opens the dialog and writes nothing | edits typed
during a save stay and keep their draft | an autosave completing after unmount records `synced` in the cache | S-1 through
the real handler, asserted on the storage | a blank open followed by typing a title writes nothing | the tab title and dirty
flag follow a save | a failed autosave keeps the draft and sets no baseline | the Ctrl+S handler uses the latest handler.

### P7S1T8 Restore wiring and cleanup

Agent `senior-frontend-engineer`, 3 hours, after T3 and T7. Step 1, red: restore cases in the persistence test file:
`handleRestore` applies title, content, `promptData`, `synced` and `lastSaved`; the draft is cleared and the cache entry
replaced; a following edit autosaves on top of the restored content; autosave is paused for the duration of the request
and a pending timer does not fire during it; a failed restore keeps the working copy and resumes autosave; the tab title
and the list title follow. Step 2: CREATE `useVersionRestore.ts`, compose it, change `VersionHistoryDialog` to take
`onRestore(versionId): Promise<boolean>` (it keeps the history fetch and closes itself on `true`), remove
`resetLoadedRef` and EditorPane's old handler. Acceptance: a search finds no remaining `resetLoadedRef`,
`useLocalStorage`, `hydrateDocumentCache`, `isTransitioning`, `contentPromptIdRef` or `titlePromptIdRef`.

### P7S1T9 Documentation sweep

Agent `documentation-manager`, 2 hours, after T8. Verify, do not duplicate the earlier syncs: every row of the drift
register is fixed or filed; every changed file's header changelog has a line; ADD a Testing section to `README.md`
(`npm test`, the database-backed variant, the DOM environment); confirm the code-size register row for
`src/features/prompts/actions.ts` has the new count; reconcile or delete the PRP's wip files
(`wip/P7S1-loader-race-diagnostic.test.tsx`, `wip/P7S1-autosave-timers-probe.test.tsx`, `wip/P7S1-loader-spike.ts`,
`wip/P7S1-loader-spike.test.tsx`, `wip/P7S1-vitest.diag.config.ts`, `wip/P7S1-research-drift.md`); search the repository
for stale references to the removed names. The main session, not this agent, amends dev-review #38 (it already lists
"repeat across two tabs"; the new flows are a cold open and an open after visiting Settings) and comments on #37, #41, #44,
#45 and #53.
