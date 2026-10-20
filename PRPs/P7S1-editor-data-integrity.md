# PromptHub
## P7S1 - Editor Data Integrity

| `Title` | `Created` | `Last modified` |
|---------|-----------|-----------------|
| P7S1 - Editor Data Integrity | 20/10/2026 11:52 GMT+10 | 20/10/2026 12:02 GMT+10 |

## Table of Contents
- [Goal](#goal)
- [Why](#why)
- [What](#what)
- [Decisions](#decisions)
- [All Needed Context](#all-needed-context)
- [Implementation Blueprint](#implementation-blueprint)
- [Task List](#task-list)
- [Validation Loop](#validation-loop)
- [Final Validation Checklist](#final-validation-checklist)
- [Anti-Patterns to Avoid](#anti-patterns-to-avoid)

## Goal

Make every path by which the editor reads or writes a document trustworthy. After this PRP a document opens with the
content the server holds, an edit reaches the server once and only when it differs from what the server already has,
the version history lists the states the user saved, restoring a version replaces what the editor shows, and a browser
draft can restore only edits that are newer than the last confirmed server copy. The server paths are covered by tests
that run against a real Postgres, and the client paths by hook tests whose server and storage seams are injected.

## Why

Epic #31 states the outcome: saving, autosaving, restoring and browsing history never loses, resurrects or misreports a
user's content. Its five code-review findings (#32 to #36) were checked against the code during this research and every
cited line is accurate. Research found one more defect of the same class that no issue describes: on a fresh mount of
`EditorPane`, `useDocumentLoader` can end with an empty editor, or wipe a document it has just loaded, depending on
whether the browser user-id lookup or the document fetch finishes first. A probe that drives the real hook with
controllable promises reproduces it in both orders and under React Strict Mode, and a control that switches documents
on a mounted instance loads correctly (`wip/P7S1-loader-race-diagnostic.test.tsx`). By reading `useAutoSave` and
`autoSavePrompt`, typing a title into that empty editor would make autosave write the empty content over the real
document, so this is a data-loss path and not a display glitch; the persistence tests of T6 assert that it no longer
happens. The defect is reproduced at hook level only. The browser behaviour is unverified and belongs in dev-review
#38. It fits the existing note that the first tab opened from zero tabs shows an empty editor until another tab is
opened (`wip/MONACO-FIRST-TAB-EMPTY-BUG.md`), which that note attributes to Monaco.

The fixes interlock, which is why this is one PRP. A draft is only safe to restore if the editor knows what the server
holds (the autosave baseline of #35). Restore (#32) is only safe if version history records the right states (#33).
The loader fix and the draft fix rewrite the same load path, and the tests for all of them need the same Postgres and
hook-test harness (#37). The editor persistence paths have no automated coverage today: the suite is 29 tests in five
files, all of them schemas and pure helpers. The bug history in `PRPs/P5S5-*` shows what happens when these paths
change without tests: content bled between documents through a hook that kept its own state.

Out of scope, with the issue that owns it: server-side tenancy and input hardening (P7S2, #39), except that moving
`restorePromptVersion` into a user-scoped service removes its unscoped `update` listed in #41; version-history payload
size and retention (#53, which builds on the model chosen here); rate limiting of autosave (#48); clearing drafts on
sign-out (#44, which still finds its drafts under the `prompt-<id>` key); conflicts between two tabs or devices, which
stay last-writer-wins (only staleness at load time is handled); the footer showing "Unsaved" for a freshly loaded
document and the absence of any retry or message when an autosave fails (follow-up issues are filed in the REPORT).

## What

| Defect | Today | After | Issue |
|---|---|---|---|
| Empty or wiped editor on a fresh mount | The load effect starts with an empty user id, is aborted when the id resolves, and `loadedRef` stops the reload | Loading waits for the user id; a re-run for an already-loaded document changes nothing; an aborted load leaves no "loaded" mark | new, filed at Stage 5 |
| Restore does not reload the editor | `handleVersionRestored` resets a ref that no effect watches; the next keystroke autosaves the old content over the restore | `restorePromptVersion` returns the restored row and the editor applies it, replacing the cache entry and clearing the draft | #32 |
| History records the wrong state | The snapshot is the row as read at save time, which autosave has already overwritten | A version is the saved state; an unchanged save adds nothing; restore keeps the working copy recoverable | #33 |
| Stale draft wins | Any non-empty draft that differs from the server wins; empty content is never stored; nothing clears it after an autosave | A draft exists only while the working copy differs from the last confirmed server state, carries its base, and is ignored when the server has moved on | #34 |
| Autosave writes without an edit | Every input change to the hook schedules a write | A write is scheduled only when title or content differ from the last loaded, saved, restored or autosaved values | #35 |
| Set-title dialog reopens | `setTimeout(() => handleSave())` runs a closure that still holds the blank title | The confirmed title is passed to the save as an argument | #36 |
| No tests for any of this | 29 pure tests | Postgres-backed tests in CI and hook tests; each defect has a test that failed before its fix | #37 |

### Success Criteria
- [ ] On a fresh mount the document shows the server's title and content whichever of the user-id lookup and the
  fetch finishes first, under React Strict Mode too, and a later identity change never wipes a loaded document
- [ ] Opening a document, switching to its tab, or reloading performs no write: `updated_at` is unchanged
- [ ] An edit is autosaved once, 500 ms after the last change, and afterwards no draft remains unless newer edits exist
- [ ] Clearing a document, waiting for autosave and reloading yields an empty document and no restore toast
- [ ] A draft whose `base` differs from the server's `updated_at` is ignored and removed
- [ ] Save A, autosave B, save C leaves C and A listed newest first and restorable; saving unchanged content adds no row
- [ ] Restore shows the restored title and content at once, replaces the cache entry, clears the draft, and a following
  edit autosaves on top of the restored content; the working copy it replaced is still in history
- [ ] Saving an untitled document needs one confirmation of the title
- [ ] `npm test` runs the Postgres-backed tests in CI against a service container, and reports them as skipped when
  `TEST_DATABASE_URL` is unset outside CI
- [ ] Every CI gate passes, no file enters the RED band, no new lint warning, and each created or changed source file
  reaches 80% line, function, branch and statement coverage by the per-file command in the Validation Loop

## Decisions

Three of these need the developer's confirmation before merge and are marked. They are made here so the executing
agents do not guess; the review at Stage 3 and the INITIAL report carry them forward.

D1, version model (confirm: issue #33 delegates this choice to the PRP). A version is the saved state. `saveVersion`
updates the prompt row and records the new title and content as the snapshot in one transaction, skipping the snapshot
when it equals the newest version. `restoreVersion` locks the row, records the working copy first when the newest
version differs from it (so a restore never destroys autosaved work), writes the restored state, and records it as a
new version unless it equals the newest one, which matches the stories document ("save it as a new version, preserving
the full history", `docs/project/PromptHub_02_STORIES_01.md:85`). History orders by `created_at desc, id desc`. No
schema change; existing rows stay restorable snapshots. Rejected: separate draft columns on `Prompt`, which need a
migration and leave every reader of `Prompt.content` (workspace snapshot, dashboard, search through `content_tsv`)
showing a different text from the editor; and keeping snapshot-of-previous, which is the defect. Plan Step 3b already
amended the original spec to "auto-save updates current content, manual save creates versions"
(`docs/project/PromptHub_06_PLAN_01.md:214`), which this model implements.

D2, one baseline and one draft writer. The client tracks `synced`, the last title and content known to be on the
server with that row's `updated_at` (an ISO string that always comes from a server response, never from the client
clock). `synced` is state in the loader and a field of the document-cache entry, so a remount starts from it. The
browser draft is `{ v: 1, base, title, content }` under the existing key `prompt-<id>`, where `base` is
`synced.updatedAt`. One effect owns the draft: it writes while the working copy differs from `synced` and clears it when
they are equal, so a successful autosave removes the draft by changing `synced`. At load a draft is applied only when
its `base` equals the server's `updated_at` and it differs from the server copy. Values stored by the old hook are raw
strings, fail validation and are removed on first read.

D3, the autosave decision is a pure function. `needsAutoSave(working, synced)` is false without a baseline, without a
non-blank title, or when nothing differs. `useAutoSave` receives the baseline and depends on it, so a baseline change
re-evaluates the pending write. `synced` never moves backwards: a response whose `updatedAt` is not newer is ignored,
because the Next.js documentation does not promise that two actions complete in call order.

D4, restore applies the returned row (confirm: the UI document says "prompt the user to save it as a new version",
`docs/project/PromptHub_04_UI_01.md:142`, the stories say save it; this PRP follows the stories and the current
button, which already restores in one click). `restorePromptVersion` returns `{ title, content, updatedAt }` and
`VersionHistoryDialog` passes it to `onRestored`. `useDocumentLoader.applyServerState` replaces title, content,
`promptData`, `synced` and `lastSaved`; `resetLoadedRef` and the use of `triggerPromptRefetch` as an editor refresh are
removed (`triggerPromptRefetch` keeps refreshing the document list).

D5, test seams (confirm: adds three devDependencies and departs from the wording of #37 and #45). The rule in
`docs/rules/testing.md#rules` forbids mocking a module of this repository, so the issues' "auth stubbed at the
`createClient` boundary" is not followed. Server logic moves to `src/features/editor/service.ts`, which takes
`(db, userId, input)`; the actions stay thin shells (validate, authenticate, rate-limit, call the service). The tests
call the service against a real Postgres and never import an action. The auth shell is not covered by this PRP; #45 owns
how every action is tested (one option is a fake Auth HTTP server behind `SUPABASE_URL`). The service has no
`"use server"` directive because every export of such a file is a public endpoint and these functions take a `userId`
(issue #40 is the same mistake in `ensure-profile.ts`). Hook tests need a DOM: `jsdom@^26.1.0`,
`@testing-library/react@^16.3.0` and `@testing-library/dom@^10.4.0` as devDependencies, which #37 anticipates ("needs
`*.test.tsx` in the Vitest `include`"). jsdom 26 supports Node 18 and later; jsdom 30 requires Node 22.22.2. Hooks take
their IO as parameters (`useDocumentLoader` gets `io`, `useDocumentPersistence` gets `actions` and `storage`);
`EditorPane` supplies the real functions, so no test imports a server action or Supabase. The database helper refuses a
`TEST_DATABASE_URL` that is not on a loopback host or whose database name lacks "test", because these tests delete rows.

D6, the loader identity gate. The load effect returns until the user id is known, checks for an already-loaded
document before wiping state, keys the loaded mark by `userId:promptId`, and on abort touches neither `loading` nor
`isTransitioning` (the run that aborted it owns them) and clears its own loaded mark.

## All Needed Context

### Documentation & References

```yaml
- file: src/features/editor/components/EditorPane.tsx
  why: the component being decomposed. Lines 93-96 useLocalStorage; 98-119 autosave; 121-129 draft effect; 131-162
    cache and tab effect; 164-208 handleSave; 210-217 handleSetTitle (stale closure, #36); 219-222
    handleVersionRestored (#32); 56-57 re-export and a false comment about WorkspacePreloader.
  critical: 329 lines (YELLOW); it must not grow. Its component function already trips max-lines-per-function.

- file: src/features/editor/hooks/useDocumentLoader.ts
  why: 137-242 the load effect (D6); 154-161 wipe before the loadedRef check; 165-184 cache branch; 186 loadedRef set
    before the fetch; 198-202 abort branch; 218-228 draft restore (#34); 256-258 resetLoadedRef (#32).
  critical: 279 lines. loadPrompt already warns at 82 lines and the arrow at 89; the rewrite must not add warnings.

- file: src/features/editor/hooks/useAutoSave.ts
  why: 62-82 the effect with no comparison to saved values (#35).

- file: src/features/editor/actions.ts
  why: saveNewVersion 39-123 (snapshot of currentPrompt at 86-96) and autoSavePrompt 135-183. Mirror its shell:
    validate, titleValidationSchema, getUser, checkMutationRateLimit, NEXT_REDIRECT rethrow.

- file: src/features/prompts/actions.ts
  why: getPromptVersionHistory 584-629 and restorePromptVersion 631-699 (writes by id only at 681). The file is RED
    (699 lines, split, #51, ESLint max-lines disabled in the file).

- file: src/features/editor/components/VersionHistoryDialog.tsx
  why: 54-69 handleRestore calls onRestored() with no data.

- file: src/features/tabs/components/TabContent.tsx
  why: 53-55 only the active tab's EditorPane renders, so every switch to a non-cached document runs the loader.

- file: prisma/schema.prisma
  why: Prompt (updated_at @updatedAt, no version counter) and PromptVersion (created_at default now(), index on
    prompt_id). Read it with the Read tool before editing any actions.ts: .claude/hooks/dependencies.json requires it.

- file: .github/workflows/ci.yml
  why: the verify job. Its comment at lines 13-14 says CI never connects to a database; that becomes false in T1.

- file: docker-compose.yml
  why: db is postgres:17-alpine on host port 54322, POSTGRES_DB postgres. CI uses the same image.

- doc: docs/rules/testing.md#rules
  critical: never mock a module of this repository; inject seams; never edit an existing test to make a change pass.

- docfile: docs/project/PromptHub_06_PLAN_01.md
  why: Step 3b line 214 defines autosave as updating current content; the tech spec 3.3 predates it (drift register).

- docfile: wip/P7S1-loader-race-diagnostic.test.tsx
  why: the probe behind D6; T5 turns its four scenarios into the committed loader tests.

- docfile: wip/P7S1-research-drift.md
  why: the drift register for this feature area; T8 fixes it.

- url: https://nextjs.org/docs/14/app/building-your-application/data-fetching/server-actions-and-mutations
  why: a "use server" file marks all its exports as Server Actions; treat them as public-facing API endpoints; values
    must be serializable. The page does not say whether concurrent actions are queued.

- url: https://www.prisma.io/docs/v6/orm/prisma-client/queries/transactions
  why: interactive transactions: maxWait 2 s and timeout 5 s by default, rollback when the callback throws. The
    unversioned page documents a later major version.

- url: https://www.prisma.io/docs/v6/orm/prisma-client/using-raw-sql/raw-queries
  why: $queryRaw as a tagged template is parameterized. Used once, for FOR UPDATE.

- url: https://www.postgresql.org/docs/16/explicit-locking.html
  why: SELECT ... FOR UPDATE blocks other writers of the row until the transaction ends.

- url: https://www.postgresql.org/docs/16/functions-datetime.html
  why: CURRENT_TIMESTAMP is the start of the transaction and does not change inside it.

- url: https://v2.vitest.dev/guide/environment.html
  why: the // @vitest-environment control comment. The installed 2.1.9 reads it with a regex over the whole file
    (node_modules/vitest/dist/chunks/resolveConfig.rBxzbVsl.js:6559).

- url: https://testing-library.com/docs/react-testing-library/api/
  why: renderHook (result.current, rerender, unmount, initialProps, wrapper) and act.
```

### Current Codebase tree (editor feature and its neighbours)

```text
src/features/editor/
  actions.ts                 saveNewVersion, autoSavePrompt ("use server")
  schemas.ts, schemas.test.ts
  components/EditorPane.tsx (329), Editor.tsx, VersionHistoryDialog.tsx, EditorSkeleton.tsx
  hooks/useAutoSave.ts, useDocumentLoader.ts (279), useLocalStorage.ts, index.ts
src/features/prompts/actions.ts (699, RED, split in #51): getPromptDetails, history and restore actions
src/stores/use-tab-store.ts, use-ui-store.ts     real zustand stores; used unmocked in hook tests
vitest.config.ts           include src/**/*.test.ts; coverage scope lists src/lib/diff-utils.ts, which does not exist
```

### Desired Codebase tree

```text
src/test/db.ts                                   CREATE test-database helpers (T1)
src/test/db.test.ts                              CREATE guard unit tests and a smoke test (T1)
src/features/editor/service.ts                   CREATE saveVersion, autoSaveDocument (T2); restoreVersion, listVersions (T3)
src/features/editor/service.test.ts              CREATE Postgres-backed (T2, extended in T3)
src/features/editor/sync.ts, sync.test.ts        CREATE DocFields, SyncedState, sameFields, needsAutoSave, isNewer (T4)
src/features/editor/draft.ts, draft.test.ts      CREATE storage seam, read/write/clear, resolveDraft (T4)
src/features/editor/hooks/useAutoSave.ts         MODIFY baseline parameter (T4); useAutoSave.test.tsx CREATE
src/features/editor/hooks/useDocumentLoader.ts   MODIFY io seam, identity gate, synced, draft, applyServerState (T5)
src/features/editor/hooks/useDocumentLoader.test.tsx          CREATE (T5)
src/features/editor/hooks/useDocumentPersistence.ts           CREATE save, autosave, draft, cache, tab, restore (T6, T7)
src/features/editor/hooks/useDocumentPersistence.test.tsx     CREATE (T6, extended in T7)
src/features/editor/hooks/useLocalStorage.ts     DELETE (T7), and its lines in hooks/index.ts
src/features/editor/components/EditorPane.tsx    MODIFY io (T5), compose the hooks (T6), final cleanup (T7); must end shorter
```

### Known Gotchas of our codebase and the library versions it pins

Pinned and installed: Next 14.2.35, React 18.3.1, Prisma and `@prisma/client` 6.19.0, Vitest 2.1.9, `@monaco-editor/react`
4.6.0.

```typescript
// VERIFIED 20/10/2026 on Postgres 16.15 with Prisma 6.19:
// - A Date written to Prompt.updated_at reads back with identical milliseconds, so the ISO string of a server
//   response is a safe base token. Capture ONE `new Date()` per write; write it and return its toISOString().
// - tx.$queryRaw`... FOR UPDATE` works inside prisma.$transaction(async (tx) => ...) and a concurrent updateMany on
//   the row waits for the commit (the blocked writer finished 1 ms after the lock holder committed).
// - Two promptVersion.create calls 30 ms apart in one interactive transaction got different created_at, because
//   Prisma stamps now() itself. A raw INSERT that relies on the column default gets the transaction start time for
//   every row. created_at has millisecond precision, so two creates can still land in one millisecond: order by
//   { created_at: "desc" }, { id: "desc" } everywhere, including the "newest version" lookup.
// - Prisma filters title_snapshot: null as IS NULL. Compare titles with === on stored values (null is not "").
// - The eight migrations apply from scratch to an empty Postgres 16 (prisma migrate deploy).

// CRITICAL: every export of a "use server" file is a public endpoint. service.ts takes userId: no directive, and no
// import from a client module. Actions pass user.id from supabase.auth.getUser(), never an id from the request.

// CRITICAL: React 18 Strict Mode (the App Router dev default) re-runs effects once on mount and keeps refs. A guard
// that is set before an await and never cleared on abort turns the second run into a silent no-op (D6).

// CRITICAL: the Monaco wrapper applies a changed `value` with executeEdits and does not call onChange for it (read in
// node_modules/@monaco-editor/react/dist/index.js). Restore needs no extra editor call, and Ctrl+Z after a restore is
// an ordinary user edit.

// Gotcha: the Stop hook runs `npm test` at every turn end and refuses a green run produced by editing tests after a
// red stop. Finish each task with the suite green; DB-backed suites must skip, not fail, without TEST_DATABASE_URL.

// Gotcha: write files only with Write and Edit; never cd in Bash (the logging hook writes logs/ into the cwd); never
// put .env, process.env or printenv in a Bash or Grep command (the secrets hook blocks it).

// Gotcha: .test.tsx files run under node unless they carry `// @vitest-environment jsdom` after the header block.
// esbuild's JSX setting is not configured for tests: write hook tests without JSX (use createElement for wrappers).
// With fake timers, drive time with `await act(async () => { await vi.advanceTimersByTimeAsync(500) })`; do not
// combine fake timers with waitFor. Reset the zustand stores, jsdom localStorage and the document cache in beforeEach.

// Gotcha: useLocalStorage is the P5S5 contamination source (a hook with its own state wrote one document's content to
// another document's key). Every draft write names its promptId explicitly and is guarded by the loader's ownership
// refs plus synced.promptId === promptId.
```

## Implementation Blueprint

### Data models and structure

No Prisma change and no migration. New TypeScript shapes, defined before their consumers:

```typescript
// src/features/editor/sync.ts (pure, client-safe)
export interface DocFields { title: string | null; content: string }
export interface SyncedState extends DocFields {
  promptId: string      // the document this baseline belongs to; guards against cross-document use
  updatedAt: string     // ISO-8601 from the server row (timestamp(3): lexicographic order is chronological)
}
export function sameFields(a: DocFields, b: DocFields): boolean        // compares (title ?? "") and content
export function needsAutoSave(working: DocFields, synced: SyncedState | null): boolean
export function isNewer(candidate: string, current: string): boolean

// src/features/editor/draft.ts (pure; the storage is a seam)
export interface DraftStorage {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
  removeItem(key: string): void
}
export interface Draft extends DocFields { base: string }              // base = SyncedState.updatedAt at write time
export const draftKey = (promptId: string) => `prompt-${promptId}`
export function getBrowserStorage(): DraftStorage | null               // window.localStorage, or null (SSR, blocked)
export function readDraft(storage: DraftStorage | null, promptId: string): Draft | null
export function writeDraft(storage: DraftStorage | null, promptId: string, draft: Draft): void
export function clearDraft(storage: DraftStorage | null, promptId: string): void
export function resolveDraft(server: SyncedState, draft: Draft | null): DocFields | null

// src/features/editor/service.ts (server only, no "use server"); every updatedAt is an ISO string
export type EditorDb = Pick<PrismaClient, "prompt" | "promptVersion" | "$transaction">
export const NEWEST_FIRST = [{ created_at: "desc" }, { id: "desc" }] as const
saveVersion(db, userId, { promptId, title, content })      -> ActionResult<{ versionId: number; updatedAt: string }>
autoSaveDocument(db, userId, { promptId, title, content }) -> ActionResult<{ updatedAt: string }>
restoreVersion(db, userId, { promptId, versionId })        -> ActionResult<{ title: string | null; content: string; updatedAt: string }>
listVersions(db, userId, promptId)                         -> ActionResult<PromptVersionHistoryItem[]>
```

The stored draft is JSON validated with Zod: `{ v: 1, base: string (non-empty), title: string | null, content: string }`.
`readDraft` returns null and removes the key for a missing, unparsable or invalid value, and it never throws when the
storage throws; `writeDraft` swallows quota errors.

```mermaid
flowchart LR
  W["Working copy (title, content)"] -- "differs from synced" --> D["Draft in localStorage, base = synced.updatedAt"]
  W -- "500 ms debounce, only if differs" --> S[("Server row")]
  S -- "response updatedAt" --> B["synced baseline"]
  B -- "equals working copy" --> X["draft removed"]
  S -- "load" --> B
  D -- "load: base equals server updated_at" --> W
  S -- "restore returns the row" --> W
```

The diagram is not rendered (the project has no render step).

### Task List

Order: T1; then T2 and T3 (same files, in sequence) in parallel with T4 (disjoint files); then T5, T6, T7; T8 last.
Every task writes its tests first and watches them fail for the stated reason before implementing. Agents never commit,
push or touch issues (`.claude/AGENT-CONTRACT.md#never`); the main session reviews each diff, runs every gate, and
commits with `Refs #NN`.

| Task | Agent | Hours | After | [P] |
|---|---|---|---|---|
| P7S1T1 Test harness: Postgres, DOM, CI service | `qa-test-automation-engineer` | 3 | none | |
| P7S1T2 Service: save and autosave, commit-style | `senior-backend-engineer` | 3 | T1 | with T4 |
| P7S1T3 Service: restore and history | `senior-backend-engineer` | 3 | T2 | with T4 |
| P7S1T4 Sync helpers, draft store, autosave baseline | `senior-frontend-engineer` | 4 | T1 | with T2, T3 |
| P7S1T5 Document loader | `senior-frontend-engineer` | 4 | T4 | |
| P7S1T6 Persistence hook and EditorPane | `senior-frontend-engineer` | 4 | T2, T5 | |
| P7S1T7 Restore wiring and cleanup | `senior-frontend-engineer` | 2.5 | T3, T6 | |
| P7S1T8 Documentation: drift fixes and rules | `documentation-manager` | 3 | T7 | |

```yaml
Task 1 (P7S1T1) - Test harness: Postgres and DOM tests, CI service
CREATE src/test/db.ts:
  - getTestDatabaseUrl(): reads TEST_DATABASE_URL; returns null when unset; THROWS when unset and CI equals "true"
    (GitHub Actions sets it), so a misconfigured workflow fails instead of silently skipping the suites
  - assertSafeTestDatabaseUrl(url): postgres/postgresql scheme, loopback host only (localhost, 127.0.0.1, ::1), and a
    database name containing "test"; throws otherwise (these tests delete rows; never reach Supabase or a dev database)
  - describeDb: describe when a URL exists, describe.skip otherwise
  - useTestDatabase(): returns a PrismaClient built with datasourceUrl; beforeAll asserts the schema exists
    (to_regclass on "Prompt" and "PromptVersion") with a message naming `npx prisma migrate deploy`; afterAll disconnects
  - createTestUser(db), createTestPrompt(db, userId, fields): unique ids; a user is removed with db.profile.delete
    (cascade), so tests need no truncation and files can run in parallel
CREATE src/test/db.test.ts: guard unit tests (always run) and a smoke test under describeDb (create, cascade delete)
MODIFY package.json and package-lock.json: npm install -D jsdom@^26.1.0 @testing-library/react@^16.3.0
  @testing-library/dom@^10.4.0; nothing else changes version
MODIFY vitest.config.ts: include src/**/*.test.{ts,tsx}; coverage.include drops src/lib/diff-utils.ts (absent) and
  gains the files this PRP creates; environment stays node
MODIFY .env.example: a "# Tests" group with TEST_DATABASE_URL="" (no value)
MODIFY .github/workflows/ci.yml: services.postgres (postgres:17-alpine, POSTGRES_DB prompthub_test, health check),
  job env TEST_DATABASE_URL, a step `npx prisma migrate deploy` with DATABASE_URL and DIRECT_URL set to the service
  for that step only, placed before the unit tests; rewrite the comment that says CI never connects to a database
RED first: db.test.ts guard cases fail because the module does not exist; the smoke test fails until the DB is up

Task 2 (P7S1T2) - Service: save and autosave, commit-style
READ prisma/schema.prisma first (dependency guard)
CREATE src/features/editor/service.ts holding saveVersion and autoSaveDocument as an extraction of the current logic
  with unchanged behaviour (snapshot of the previous row), then CREATE src/features/editor/service.test.ts with the
  cases below. The new-model cases fail against the extraction for the right reason (history holds B, not A); only
  then change the semantics.
MODIFY src/features/editor/actions.ts: saveNewVersion and autoSavePrompt delegate to the service and return
  { versionId, updatedAt } and { updatedAt }; keep validation, title validation, auth, rate limit, redirect rethrow
Cases (describeDb): save A, autosave B, save C -> [C, A], B absent, both restorable by id | identical save twice -> one
  row | two parallel identical saves -> one row | a save after autosave moved the row to the same content -> one row
  equal to the saved state | autosave creates no version | returned updatedAt equals the row's updated_at read back
  | user B cannot save or autosave user A's prompt and nothing changes | unknown prompt -> not found

Task 3 (P7S1T3) - Service: restore and history
CREATE restoreVersion and listVersions in src/features/editor/service.ts and extend service.test.ts
MODIFY src/features/prompts/actions.ts: getPromptVersionHistory and restorePromptVersion delegate to listVersions and
  restoreVersion; restorePromptVersion returns { title, content, updatedAt }; report the file's new line count
Cases (describeDb): restore with the working copy not in history -> working copy snapshotted, then the restored state,
  in that id order, history lists the restored state first | restore when the working copy equals the newest version
  -> no extra snapshot | restore of the newest version -> no duplicate | restore then autosave an edit -> the row is
  the restored text plus the edit and history is unchanged by the autosave | a parallel autosave waits for the restore
  lock and its work is not silently lost | user B cannot restore or list user A's history | a version of another prompt
  -> not found | list orders by created_at then id and caps at 50
RED first: against the old restore (returns nothing, one snapshot, unscoped update) the return-shape and ordering cases fail

Task 4 (P7S1T4) - Sync helpers, draft store, autosave baseline
CREATE src/features/editor/sync.test.ts then sync.ts; CREATE src/features/editor/draft.test.ts then draft.ts (an
  in-memory storage fake; cases: empty content round-trips, legacy raw string removed, wrong version removed, storage
  that throws, quota error swallowed, resolveDraft base mismatch -> null, equal to server -> null, newer edits -> fields)
MODIFY src/features/editor/hooks/useAutoSave.ts: add `baseline: SyncedState | null`; the effect returns unless
  needsAutoSave(...) and baseline.promptId === promptId; dependencies include baseline
CREATE src/features/editor/hooks/useAutoSave.test.tsx (jsdom, fake timers): no write on mount; a write 500 ms after an
  edit; one write for a burst; no write when the edit is reverted to the baseline; no write for a blank or null title;
  no write without a baseline; a baseline change cancels the pending write; no write for another document's baseline

Task 5 (P7S1T5) - Document loader: io seam, identity gate, synced, draft
Step 1, behaviour-preserving: add the `io` parameter ({ fetchPrompt, getUserId, storage }) and move the imports of
  getPromptDetails and the Supabase client out of the hook; EditorPane gets a module-level `loaderIo` (minimal edit)
Step 2, red: CREATE useDocumentLoader.test.tsx with the four probe scenarios (user id first, fetch first, Strict Mode,
  control), asserting a loaded document; A, B and D fail exactly as the probe shows
Step 3, green and extend: the D6 gate; loadedRef check before the wipe, keyed userId:promptId; abort touches nothing
  shared and clears its own mark; `synced` state and CacheEntry.synced; draft resolution through readDraft and
  resolveDraft; markSynced (ignores another document's response, never moves backwards, also records in the cache so
  it works after unmount); applyServerState; remove the dead hydrateDocumentCache and the no-op clear(); keep
  resetLoadedRef until T7
More cases: rapid switch A -> B ignores A's late response and keeps loading true until B arrives | cache hit restores
  synced | a draft is applied only when base matches and fields differ | a stale draft is ignored | empty draft content is
  respected | a load failure sets error and leaves synced null | an identity change after load does not wipe |
  markSynced for another document leaves state alone

Task 6 (P7S1T6) - Persistence hook and EditorPane
Step 1, behaviour-preserving: CREATE useDocumentPersistence.ts by moving handleAutoSave, handleSave, handleSetTitle,
  the draft effect and the cache/tab effect out of EditorPane (actions and storage injected), passing `synced` to
  useAutoSave. `ready` is the guard the old effects use: promptId === promptIdRef.current, contentPromptIdRef and
  titlePromptIdRef equal promptId, and not isTransitioning. EditorPane composes the loader and the hook.
Step 2, red: CREATE useDocumentPersistence.test.tsx with a harness that renders the loader and the hook together over
  injected fakes: set-title (one confirmation calls saveNewVersion once with the confirmed title and leaves the dialog
  closed; red against the moved stale closure), autosave then no draft, clear and reload, typing during a save, a
  blank open followed by typing a title writes nothing
Step 3, green: apply D2, D3 and the #36 fix (saveVersion(titleToSave) shared by Ctrl+S, the button and the dialog);
  the draft effect becomes the only draft writer; useLocalStorage is no longer used
Cases also: autosave completing after unmount records synced in the cache | a save that finishes while the user typed
  keeps the newer edits and their draft | a placeholder title opens the dialog and writes nothing | the tab title and
  dirty flag follow a save

Task 7 (P7S1T7) - Restore wiring and cleanup
CREATE restore cases in useDocumentPersistence.test.tsx first: restore applies title, content, promptData, synced and
  lastSaved | the cache entry is replaced and the draft cleared | a following edit autosaves on top of the restored
  content | a late autosave response older than the restore is ignored | the tab title and dirty flag follow
MODIFY VersionHistoryDialog.tsx: onRestored receives restorePromptVersion's data
MODIFY useDocumentPersistence.ts: handleVersionRestored calls applyServerState, updates the tab and the list title,
  and calls triggerPromptRefetch for the list only
MODIFY useDocumentLoader.ts: remove resetLoadedRef
DELETE src/features/editor/hooks/useLocalStorage.ts and its lines in hooks/index.ts; fix the comment and the
  hydrateDocumentCache re-export in EditorPane.tsx; confirm EditorPane.tsx is shorter than 329 lines

Task 8 (P7S1T8) - Documentation: drift register fixes and rule updates
Fix every item of wip/P7S1-research-drift.md that is open when this task starts, update the header changelog of every file
the PRP changed, add a Testing section to README.md, and reconcile or delete the PRP's wip files. Rules files: the
Tests row and the environment-variable table in docs/rules/project.md, the test layers in docs/rules/testing.md
(Postgres-backed layer, TEST_DATABASE_URL, hook tests with injected seams), the `service.ts` convention in project.md's
file table, the line count of src/features/prompts/actions.ts in docs/rules/code-size-register.md, the QA and frontend
agent definitions, and the AGENT-CONTRACT note that a check needing a database is reported as not run when
TEST_DATABASE_URL is unset. Amend dev-review #38 with the cold-open and two-tab flows.
```

### Pseudocode for the non-obvious logic

```typescript
// T2 saveVersion. PATTERN: shell in src/features/editor/actions.ts. CRITICAL: the scoped update comes first.
const now = new Date(); const updatedAt = now.toISOString()
return db.$transaction(async (tx) => {
  // The update is the ownership check and the row lock: a concurrent save of the same prompt waits here, then its
  // lookup below sees this transaction's version, so identical saves cannot both insert.
  const written = await tx.prompt.updateMany({ where: { id: promptId, user_id: userId }, data: { title, content, updated_at: now } })
  if (written.count === 0) return fail("Prompt not found or access denied")
  const newest = await tx.promptVersion.findFirst({ where: { prompt_id: promptId }, orderBy: [...NEWEST_FIRST] })
  if (newest && newest.title_snapshot === title && newest.content_snapshot === content) return ok({ versionId: newest.id, updatedAt })
  const created = await tx.promptVersion.create({ data: { prompt_id: promptId, title_snapshot: title, content_snapshot: content } })
  return ok({ versionId: created.id, updatedAt })
})

// T3 restoreVersion. GOTCHA: FOR UPDATE must be the first statement; the working copy is read from its result.
const rows = await tx.$queryRaw<{ title: string | null; content: string }[]>`
  SELECT title, content FROM "Prompt" WHERE id = ${promptId} AND user_id = ${userId} FOR UPDATE`
if (rows.length === 0) return fail("Prompt not found or access denied")
const version = await tx.promptVersion.findFirst({ where: { id: versionId, prompt_id: promptId } })
if (!version) return fail("Version not found")
let newest = await findNewest(tx, promptId)
if (!newest || !same(newest, rows[0])) newest = await tx.promptVersion.create({ data: snapshotOf(promptId, rows[0]) })
await tx.prompt.updateMany({ where: { id: promptId, user_id: userId }, data: { title: version.title_snapshot, content: version.content_snapshot, updated_at: now } })
if (!same(newest, version)) await tx.promptVersion.create({ data: snapshotOf(promptId, version) })
return ok({ title: version.title_snapshot, content: version.content_snapshot, updatedAt })

// T4 needsAutoSave and resolveDraft. GOTCHA: null?.trim() is undefined, so test with Boolean(...), not `!== ""`.
needsAutoSave = (working, synced) => synced !== null && Boolean(working.title?.trim()) && !sameFields(working, synced)
resolveDraft = (server, draft) => draft && draft.base === server.updatedAt && !sameFields(draft, server) ? { title: draft.title, content: draft.content } : null

// T5 load effect. CRITICAL ordering: identity, then already-loaded check, then wipe, then cache, then fetch.
if (!promptId) { resetAll(); return }
if (!currentUserId) return                                       // D6: wait for identity
const key = `${currentUserId}:${promptId}`
if (loadedRef.current === key) return                            // before the wipe: a same-document re-run changes nothing
wipeStateForNewDocument(); isTransitioning.current = true
cache hit -> apply entry including entry.synced; loadedRef.current = key; return
loadedRef.current = key; setLoading(true)
const result = await io.fetchPrompt(promptId)
if (controller.signal.aborted) { if (loadedRef.current === key) loadedRef.current = null; return }   // owns nothing else
apply: synced = { promptId, title: data.title, content: data.content, updatedAt: toIso(data.updated_at) }   // toIso accepts Date | string
const restored = resolveDraft(synced, readDraft(io.storage(), promptId))   // stale or equal drafts are removed by the draft effect
setTitle(restored?.title ?? data.title); setContent(restored?.content ?? data.content); if (restored) toast.info(...)

// T6 draft effect, the only draft writer. PATTERN: the guards of the effect it replaces (EditorPane.tsx:122-129).
if (!ready || synced?.promptId !== promptId) return
if (sameFields({ title, content }, synced)) clearDraft(storage, promptId)
else writeDraft(storage, promptId, { base: synced.updatedAt, title, content })

// T6 saveVersion(titleToSave). The Ctrl+S handler and the button call saveVersion(title); the dialog calls saveVersion(newTitle).
const sent = content                                              // what is being saved, not what the editor holds later
const result = await actions.saveNewVersion({ promptId, newTitle: titleToSave, newContent: sent })
if (result.success) { markSynced({ promptId, title: titleToSave, content: sent, updatedAt: result.data.updatedAt })
  setPromptData(prev => ({ ...prev, title: titleToSave, content: sent, updated_at: new Date(result.data.updatedAt) }))
  /* working title/content untouched: edits typed during the request stay and keep their draft */ }
```

### Integration Points

```yaml
DATABASE:
  - none: no schema change, no migration. Existing PromptVersion rows keep their meaning as restorable snapshots.
CONFIG:
  - TEST_DATABASE_URL: optional locally, required in CI. Loopback host and a database name containing "test" only.
  - package.json devDependencies: jsdom, @testing-library/react, @testing-library/dom (T1).
CI:
  - .github/workflows/ci.yml verify job: postgres service, migrate deploy step, TEST_DATABASE_URL (T1).
```

### Error handling strategy

Actions keep returning `ActionResult` and the `NEXT_REDIRECT` rethrow. Services return `ActionResult` for expected
outcomes (not found) and let unexpected database errors throw, so the transaction rolls back and the action reports
"Failed to ...". The draft store never throws into React: invalid, unreadable or oversized values are treated as no
draft. The loader reports a failed fetch through `error` and a toast and leaves `synced` null, which keeps autosave
off (no baseline, no write). Fail safe throughout: when the client does not know what the server holds, it does not
write. An autosave response for a document that is no longer mounted updates only the document cache.

## Validation Loop

Run from the repository root (never after a `cd`). The Prisma and build steps need the placeholder values CI sets.

### Level 1: syntax and style

```bash
DATABASE_URL=postgresql://user:pass@localhost:5432/db DIRECT_URL=postgresql://user:pass@localhost:5432/db npx prisma validate
npm run lint
npx tsc --noEmit
bash scripts/audit-code-size.sh --summary
# Expected: no errors; lint shows only the pre-existing max-lines-per-function warnings (the loader's two must not grow)
```

### Level 2: unit and Postgres-backed tests

```bash
npm test
# Without TEST_DATABASE_URL the DB-backed suites are reported as skipped. Baseline before this PRP: 5 files, 29 tests.

# With a database (Docker stack: `docker compose up -d db`, then create a database whose name contains "test"):
docker compose exec db createdb -U postgres prompthub_test
DATABASE_URL=postgresql://postgres:postgres@localhost:54322/prompthub_test DIRECT_URL=postgresql://postgres:postgres@localhost:54322/prompthub_test npx prisma migrate deploy
TEST_DATABASE_URL=postgresql://postgres:postgres@localhost:54322/prompthub_test npm test

# Per-file coverage for a changed file (read coverage/coverage-summary.json, not the text table):
npx vitest run --coverage --coverage.include=src/features/editor/service.ts --coverage.reporter=json-summary
# Expected: lines, functions, branches and statements each at least 80% for every file this PRP creates or changes
```

### Level 3: build and browser

```bash
DATABASE_URL=postgresql://user:pass@localhost:5432/db DIRECT_URL=postgresql://user:pass@localhost:5432/db NEXT_PUBLIC_SUPABASE_URL=https://placeholder.supabase.co NEXT_PUBLIC_SUPABASE_ANON_KEY=placeholder-anon-key npm run build
```

There is no end-to-end runner and cloud sessions have no browser tooling, so the browser checks are reported as not run
and belong to dev-review #38, whose list gains two flows (T8 amends it): open a document from a cold start and after
visiting Settings, and the same edit in two tabs. The checks, owner the developer, on `npm run dev` port 3010 or the
Docker stack: untitled save through the dialog; edit and autosave; version save; restore an older version and edit;
clear and reload; open documents without editing and confirm "Recently updated" is unchanged; cold open; two tabs.

## Final Validation Checklist
- [ ] `npm test` passes; the DB-backed suites pass with `TEST_DATABASE_URL` set and show as skipped without it
- [ ] Each defect has a test that failed before its fix, recorded in the REPORT with the failing output
- [ ] `npx tsc --noEmit`, `npm run lint` (no new warning), `npx prisma validate`, the size audit and `npm run build` pass
- [ ] No file entered the RED band; `EditorPane.tsx` is shorter than 329 lines; the register row for
  `src/features/prompts/actions.ts` has its new line count
- [ ] Per-file coverage at least 80% on every created or changed source file
- [ ] `service.ts` has no `"use server"` directive and no client module imports it
- [ ] `useLocalStorage.ts`, `resetLoadedRef` and `hydrateDocumentCache` are gone, with no remaining reference
- [ ] Every drift-register item is fixed or filed; every changed file has a header changelog line; README has a Testing section
- [ ] Browser checks are listed as not run and handed to #38

## Anti-Patterns to Avoid
- Do not mock a module of this repository (`vi.mock("@/...")`), and do not edit an existing test to make a change pass
- Do not export a function that takes `userId` from a `"use server"` file
- Do not take `base` or `updatedAt` from the client clock; they come from a server response
- Do not add a second draft writer, and do not reintroduce a hook that holds localStorage state
- Do not apply a response for document A to the state of document B; check `promptId` on every async completion
- Do not let a client write when it has no baseline, and do not catch and ignore a failed autosave without keeping the draft
- Do not widen into P7S2, #44, #48 or #53; file what you find
- Do not raise a timeout to make a test pass, and do not skip a test to get green
- Do not run `cd` in Bash, write files from Bash, or name env files in Bash or Grep calls

----
**PRP Status**: TODO
**PRP ID**: P7S1
**PRP Document**: P7S1-editor-data-integrity
**Tasks**: 8 tasks (P7S1T1 - P7S1T8)
**Phase**: Phase 7 - Hardening (Editor data integrity)
**Dependencies**: None
**Next PRP**: P7S2 - Server-side security hardening
**Recommendations**:
Agents:
- `qa-test-automation-engineer` (Task 1)
- `senior-backend-engineer` (Tasks 2-3)
- `senior-frontend-engineer` (Tasks 4-7)
- `documentation-manager` (Task 8)
Notes:
- Decisions D1, D4 and D5 need the developer's confirmation before merge
- Task 6 is the largest; if it exhausts an agent's turn budget, split the persistence hook from the EditorPane edit
- Browser verification is #38 and cannot be run by an agent
- Accepted: two tabs or devices stay last-writer-wins, and an autosave already in flight when a restore is confirmed can overwrite the restore
**Estimated Implementation Time (FTE)**: 24-30 hours (3-4 days)
