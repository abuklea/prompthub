# PromptHub
## P7S1 Task Context

| `Title` | `Created` | `Last modified` |
|---------|-----------|-----------------|
| P7S1 Task Context | 20/10/2026 14:41 GMT+10 | 20/10/2026 14:41 GMT+10 |

## Table of Contents
- [Purpose](#purpose)
- [References](#references)
- [Current and Desired Trees](#current-and-desired-trees)
- [Known Gotchas](#known-gotchas)
- [Environment for Database Tests](#environment-for-database-tests)

## Purpose

What every task of [the PRP](../P7S1-editor-data-integrity.md) shares: the sources to read and why, the current and
desired file trees, the verified gotchas and the database environment. The per-task briefs are in
[P7S1-task-briefs.md](P7S1-task-briefs.md#briefs) (T1, T2, T3 and T9) and
[P7S1-task-briefs-client.md](P7S1-task-briefs-client.md#briefs) (T4 to T8); every interface and protocol is in
[the contract](P7S1-editor-persistence-contracts.md). It was split from the task briefs to keep each document inside
its size band. An agent reads this file, its brief, the contract and the spike its brief names, and checks every cited
path and line against the code before using it.

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
  why: 39-52 handleOpen reads the history inside Dialog's onOpenChange, which Radix does not call when the parent sets
    `open` (EditorPane.tsx:303 does), so the list never loads; 54-69 handleRestore calls the action and then
    onRestored() with no data; 72 onOpenChange closes at any time; 90 only the clicked row is disabled in a restore.

- file: src/features/tabs/components/TabContent.tsx
  why: 58-60 EditorPane has no key, so switching between two document tabs re-renders one instance with new props, and
    a switch to a settings tab unmounts it.

- file: src/components/layout/Header.tsx
  why: 23 and 39 import and call clearDocumentCache through EditorPane's re-export (T5 repoints it).

- file: src/features/prompts/components/DocumentToolbar.tsx
  why: 158-172 a rename from the list updates only the list store; the open editor keeps the old title (follow-up F-4).

- file: prisma/schema.prisma
  why: Prompt (updated_at @updatedAt; folder_id and folder nullable) and PromptVersion (created_at default now(), index
    on prompt_id). Read it with the Read tool before editing any actions.ts: .claude/hooks/dependencies.json needs it.

- file: .github/workflows/ci.yml
  why: the verify job. Lines 13-14 say CI never connects to a database; that becomes false in T1.

- file: docker-compose.yml
  why: db is postgres:17-alpine on host port 54322, POSTGRES_DB postgres.

- file: wip/P7S1-draft-spike.ts, wip/P7S1-loader-spike.ts, wip/P7S1-persistence-spike.ts, wip/P7S1-dialog-spike.tsx,
    their .test.tsx files and wip/P7S1-test-fakes.ts
  why: the reference implementations of T4 to T8 and the typed fakes they share, 195 tests. See Purpose of the contract
    for how to adapt them. The mutation check wip/P7S1-mutation-check.py proves the tests notice 77 deliberate defects;
    the main session runs it, an agent does not need to.

- file: wip/P7S1-loader-race-diagnostic.test.tsx and wip/P7S1-autosave-timers-probe.test.tsx
  why: probes against the CURRENT loader and the CURRENT useAutoSave; their failing assertions are the T5 and T6 red.

- file: wip/P7S1-vitest.diag.config.ts
  why: runs the wip suites, with esbuild.jsx "automatic" (tsconfig sets "jsx": "preserve", which Vitest cannot run);
    the main session deletes it with them after T9.

- docfile: wip/P7S1-research-drift.md
  why: the drift register; its rows name the task that fixes each.

- doc: docs/rules/testing.md#rules
  critical: never mock a module of this repository (sonner is not one); inject seams; never edit an existing test to
    make a change pass.

- docfile: docs/project/PromptHub_06_PLAN_01.md#phase-5-prompt-editor--version-control
  why: Step 3b defines autosave as updating the current content and manual save as creating versions.

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
  actions.ts                                       src/test/storage-fake.ts                                (T4)
  schemas.ts, schemas.test.ts                      src/test/loader-world.ts, src/hooks/use-latest.ts + test (T5)
  components/EditorPane.tsx (329)                  src/test/editor-env.ts                                  (T7)
  components/VersionHistoryDialog.tsx              src/features/editor/service.ts                          (T2, T3)
  hooks/useAutoSave.ts                             service.save.test.ts (T2), service.restore.test.ts (T3)
  hooks/useDocumentLoader.ts (279)                 sync.ts, request-timeout.ts, draft.ts, document-cache.ts (T4)
  hooks/useLocalStorage.ts                           and a .test.ts for each                               (T4)
  hooks/index.ts                                   loader-state.ts, loader-protocol.ts                     (T5, T6)
src/features/prompts/actions.ts (699, RED)         hooks/useDocumentLoader.ts (rewritten) + tests          (T5)
src/components/layout/Header.tsx                   hooks/useAutoSave.ts, useDraftSync.ts + tests           (T6)
vitest.config.ts (include *.test.ts)               document-actions.ts, hooks/useDocumentCacheSync.ts,
                                                     useVersionSave.ts, useServerAutoSave.ts,
                                                     useDocumentPersistence.ts                             (T7)
                                                   hooks/useVersionRestore.ts, components/VersionHistoryDialog.tsx
                                                     (rewritten) + dialog tests                            (T8)
                                                   hooks/useLocalStorage.ts DELETED                        (T6)
                                                   vitest.config.ts: *.test.{ts,tsx}, esbuild.jsx automatic (T1)
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

// VERIFIED: server actions in one tab run one at a time in call order
// (next/dist/shared/lib/router/action-queue.js:112-143). A router navigation discards the pending action's state
// update and orphans the queued ones: handleResult returns before runRemainingActions (121-135), so their promises
// never settle. Header renders <Link>s (Header.tsx:47, 55), so navigation happens while the editor is mounted: every
// action and the document fetch runs under withTimeout (30 s).

// VERIFIED: the Monaco wrapper applies a changed `value` with executeEdits and suppresses onChange for it
// (node_modules/@monaco-editor/react/dist/index.js). Restore needs no extra editor call; Ctrl+Z afterwards is a user
// edit. Editor.tsx handleMount applies the `value` of its first render, which is why the editor mounts only when ready.

// VERIFIED: renamePrompt (prompts/actions.ts:248-257) sets updated_at, which is why updated_at is not a draft base.
// VERIFIED: createPrompt stores title null and content "" for a new document (prompts/actions.ts:96-127).

// CRITICAL: every export of a "use server" file is a public endpoint. service.ts takes userId: no directive, and no
// import from a client module. Actions pass user.id from supabase.auth.getUser(), never an id from the request.

// CRITICAL: React 18 Strict Mode (the App Router dev default) re-runs effects once on mount and keeps refs.

// Gotcha: the Stop hook runs `npm test` at every turn end and refuses a green run produced by editing tests after a
// red stop. Finish every task with the suite green; DB-backed suites must skip, not fail, without TEST_DATABASE_URL.

// Gotcha: write files only with Write and Edit; never cd in Bash (the logging hook writes logs/ into the cwd); never
// put .env, process.env or printenv in a Bash or Grep command (the secrets hook blocks it). A dispatched agent deletes
// nothing and never commits: the main session removes files with git rm (rm -rf is blocked).

// Gotcha: .test.tsx files run under node unless they carry `// @vitest-environment jsdom` (the spikes use line 1).
// tsconfig.json sets "jsx": "preserve", which leaves JSX in the output that Vitest cannot run: T1 adds
// `esbuild: { jsx: "automatic" }` to vitest.config.ts, after which a test may use JSX (the dialog suite does).
// vitest.config.ts sets no `globals`, so Testing Library's automatic cleanup is never registered: every DOM test file
// calls afterEach(cleanup) and afterEach(() => vi.useRealTimers()), and resets the zustand stores, jsdom localStorage
// and the document cache in beforeEach. With fake timers drive time with
// `await act(async () => { await vi.advanceTimersByTimeAsync(500) })` and do not combine them with waitFor.
// vi.mock("sonner") is allowed (it is not a module of this repository); the zustand stores are used for real.

// Gotcha: `npm install --no-save` copies of jsdom and Testing Library exist in node_modules from the research; `npm ci`
// removes them. T1 installs them properly. Until then the wip tests carry `// @ts-nocheck` (tsconfig includes every
// .tsx file and CI installs from package.json); they are type-clean with the packages installed, and a test adapted
// into src/ drops the directive and stays clean.

// Gotcha: Prompt.folder_id is nullable but PromptWithFolder.folder is not, so useDocumentCacheSync's
// promptData.folder.id would throw for an unfiled prompt. Pre-existing and out of scope: follow-up F-6.
```

## Environment for Database Tests

T2, T3 and the smoke test of T1 need a Postgres reachable on a loopback host, with a database whose name contains
"test" and the project migrations applied. The helper refuses anything else.

| Where | How |
|---|---|
| Developer machine | `docker compose up -d db`, then `docker compose exec db createdb -U <user> prompthub_test`, then `npx prisma migrate deploy` with `DATABASE_URL` and `DIRECT_URL` set to `postgresql://<user>:<password>@localhost:54322/prompthub_test`, then `TEST_DATABASE_URL=` the same URL (`<user>` and `<password>` are the values `docker-compose.yml` sets for `db`) |
| Cloud session without Docker | the main session creates a throwaway cluster (`pg_createcluster 16 <name> --port <port>`, `pg_ctlcluster 16 <name> start`, set the `postgres` password, `createdb prompthub_test`, `prisma migrate deploy`) and passes `TEST_DATABASE_URL` in the dispatch prompt |
| CI | the `postgres:17-alpine` service container of T1 |

The main session provisions the database before it dispatches T1, T2 or T3 and puts `TEST_DATABASE_URL` in the prompt.
An agent that is dispatched without it writes its failing tests, reports "red not shown: no database" and stops; the
task is not finished. The main session then provides the database and resumes the same agent with `SendMessage`; if that
agent is no longer reachable, it dispatches a fresh agent with the tests already on disk, which runs them to show the
red before it writes the implementation. The CI service container cannot be run before a pull request exists:
`.github/workflows/ci.yml` triggers only on `push` to `master` and on `pull_request`. T1 reports the service as not run,
and the local run against the real database is the acceptance until the first pull request; the CI run then becomes the
final proof for the database-backed suites.
