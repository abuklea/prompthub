# PromptHub
## P7S1 Task Briefs

| `Title` | `Created` | `Last modified` |
|---------|-----------|-----------------|
| P7S1 Task Briefs | 20/10/2026 12:38 GMT+10 | 20/10/2026 15:45 GMT+10 |

## Table of Contents
- [Purpose](#purpose)
- [Server Contract](#server-contract)
  - [Server Shells](#server-shells)
  - [Server Pseudocode](#server-pseudocode)
- [Red to Green Map](#red-to-green-map)
- [Briefs](#briefs)
  - [P7S1T1 Add the Postgres and DOM test harness and CI service](#p7s1t1-add-the-postgres-and-dom-test-harness-and-ci-service)
  - [P7S1T2 Move save and autosave into a tested service with commit-style versions](#p7s1t2-move-save-and-autosave-into-a-tested-service-with-commit-style-versions)
  - [P7S1T3 Move restore and history into the service](#p7s1t3-move-restore-and-history-into-the-service)
  - [P7S1T9 Sweep the documentation and the wip files](#p7s1t9-sweep-the-documentation-and-the-wip-files)

## Purpose

The per-task detail for [the PRP](../P7S1-editor-data-integrity.md). Interfaces, the protocols and the budgets are in
[the contract](P7S1-editor-persistence-contracts.md), and the references, trees, gotchas and database environment that
every task shares are in [the task context](P7S1-task-context.md); neither is repeated. This file holds the server
contract, the red-to-green map and the briefs of T1, T2, T3 and T9; the client briefs T4 to T8 are in
[P7S1-task-briefs-client.md](P7S1-task-briefs-client.md#briefs). An agent given one task reads its brief, the context,
the contract, the spike it names, and the source the brief cites; it checks every cited path and line against the code
first. Agents never commit, push, branch or touch issues ([Never](../../.claude/AGENT-CONTRACT.md#never)); the main
session reviews each diff, runs every gate, and commits with `Refs #NN`. A brief's steps are in order: a step that
names a red test is finished only when that test has been run and shown failing for the stated reason, and the agent
reports the failing output. A task is finished when all six
[validation gates](../../.claude/AGENT-CONTRACT.md#validation-gates) pass, or each one that cannot run in the
environment is reported as not run with the reason.

## Server Contract

The server half of the contract, used by T2 and T3. The client half is in
[the contract](P7S1-editor-persistence-contracts.md).

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
A save that changes nothing returns the id of the newest version, and the client toast still reads "Version saved
successfully"; that is accepted, because the document is saved either way. No timestamp is returned: nothing depends on
one (the draft base is a content hash, and writes complete in call order, see
[Write Ordering and Pausing](P7S1-editor-persistence-contracts.md#write-ordering-and-pausing)). `service.ts` orders
versions by `id desc` alone: ids are assigned in write order under the prompt row lock, while `created_at` is stamped by
each app instance's clock. The shells are verified by `npx tsc --noEmit` and review only; how every action is tested is
issue #45's decision, and the REPORT says so.

### Server Pseudocode

```typescript
// T2 saveVersion. CRITICAL: the scoped update comes first; it is the ownership check and the row lock.
return db.$transaction(async (tx) => {
  const written = await tx.prompt.updateMany({
    where: { id: promptId, user_id: userId },
    data: { title, content, updated_at: new Date() },
  })
  if (written.count === 0) return fail("Prompt not found or access denied")
  const newest = await tx.promptVersion.findFirst({ where: { prompt_id: promptId }, orderBy: { id: "desc" } })
  if (newest && newest.title_snapshot === title && newest.content_snapshot === content) {
    return ok({ versionId: newest.id })
  }
  const created = await tx.promptVersion.create({
    data: { prompt_id: promptId, title_snapshot: title, content_snapshot: content },
  })
  return ok({ versionId: created.id })
})

// Helpers for T3 (module-private in service.ts). A State is the pair a version or a row holds.
type State = { title: string | null; content: string }
const stateOf = (v: { title_snapshot: string | null; content_snapshot: string }): State =>
  ({ title: v.title_snapshot, content: v.content_snapshot })
// null is not "" (Prisma filters null as IS NULL)
const same = (a: State, b: State) => a.title === b.title && a.content === b.content
const snapshotOf = (promptId: string, s: State) =>
  ({ prompt_id: promptId, title_snapshot: s.title, content_snapshot: s.content })
const findNewest = (tx: Tx, promptId: string) =>
  tx.promptVersion.findFirst({ where: { prompt_id: promptId }, orderBy: { id: "desc" } })

// T3 restoreVersion. GOTCHA: FOR UPDATE is the first statement; the working copy is read from its result.
const rows = await tx.$queryRaw<State[]>`
  SELECT title, content FROM "Prompt" WHERE id = ${promptId} AND user_id = ${userId} FOR UPDATE`
if (rows.length === 0) return fail("Prompt not found or access denied")
const version = await tx.promptVersion.findFirst({ where: { id: versionId, prompt_id: promptId } })
if (!version) return fail("Version not found")
let newest = await findNewest(tx, promptId)
if (!newest || !same(stateOf(newest), rows[0])) {
  newest = await tx.promptVersion.create({ data: snapshotOf(promptId, rows[0]) })
}
await tx.prompt.updateMany({
  where: { id: promptId, user_id: userId },
  data: { title: version.title_snapshot, content: version.content_snapshot, updated_at: new Date() },
})
if (!same(stateOf(newest), stateOf(version))) {
  await tx.promptVersion.create({ data: snapshotOf(promptId, stateOf(version)) })
}
return ok({ title: version.title_snapshot, content: version.content_snapshot })

// T3 listVersions. The ownership read is the existing one: the prompt must belong to userId
// before its versions are read.
const owned = await db.prompt.findFirst({ where: { id: promptId, user_id: userId }, select: { id: true } })
if (!owned) return fail("Prompt not found or access denied")
return ok(await db.promptVersion.findMany({
  where: { prompt_id: promptId },
  select: { id: true, created_at: true, title_snapshot: true, content_snapshot: true },
  orderBy: { id: "desc" },
  take: 50,
}))
```

`PromptVersion.diff` has a default (`""`), so a create omits it. `PromptVersion` has no `user_id` column, so the order
is the safeguard: no `promptVersion` read or write precedes the statement that proves ownership of the prompt (the
scoped `updateMany`, the locked `SELECT`, or the ownership read). The client half has no pseudocode: the spikes are its
reference implementation.

## Red to Green Map

Each defect has a test that fails first, against the stated code, for the stated reason. A test that passes on arrival
is recorded as a regression test, not as a red.

| Defect | Red shown in | Against | The test asserts |
|---|---|---|---|
| Loader race (F-1) | T5 Step 2 | the behaviour-preserving `io` refactor of the current loader | a fresh mount ends with the server's title and content, `loading` is true while the identity is pending and on the first render (the probes' scenarios A, B and D fail today); the cases for the new API (`ready`, `synced`, `markSynced`, `applyServerState`, the identity timeout, a rejected fetch) fail because the API is absent |
| #33 history | T2 Step 2 | the unchanged extraction of the current save | save A, autosave B, save C lists C then A, never B; an identical save adds no row |
| #32 server | T3 Step 2 | the unchanged extraction of the current restore (Step 1) | the result carries `{ title, content }`; the working copy is snapshotted before the restored state; versions are ordered by id (seed `created_at` values that contradict the id order, so ordering by `created_at` fails) |
| #34 stale draft | T6 Step 1 | T5's loader, which applies any differing raw draft | a v1 draft whose base differs from the server content hash is not applied, its text is stashed and a warning is shown; an empty draft is applied; a legacy draft that differs from a saved document is not applied |
| #34 clear after autosave | T6 Step 1 | a compiling stub of `useDraftSync` | after the baseline catches up, `storage.getItem(draftKey(id))` is null (asserted on the storage, not through `readDraft`) |
| #35 | T6 Step 1 | the current `useAutoSave` | no write on mount, none after an edit reverted to the baseline, none for another document's baseline |
| #36 and the busy flags | T7 Step 2 | the Step 1 extraction, which keeps the stale closure and has no `finally` | one title confirmation saves once with the confirmed title and sets the working title; a rejected save or autosave resets its flag; a second Ctrl+S is ignored; autosave is paused during a save; a save that completes after a switch does not force the other tab's dirty flag |
| #32 client | T8 Step 2 | the Step 1 `handleRestore`, which calls the action and updates nothing | after `handleRestore` the loader shows the restored row, `synced` equals it, the draft is gone and the cache entry is replaced; unsaved edits are saved first and the restore is aborted if that fails; a blank title with unsaved edits is refused; a restore that completes after a switch or an unmount is safe |
| History list never loads (new bug) | T8 Step 2 | the Step 1 dialog, which still reads the list inside `onOpenChange` | the list loads when the parent sets `open` (the control case with a bare Radix dialog shows why it did not); a late result is dropped; a failed read says so; every Restore button is disabled while a restore runs; Escape and Close are ignored meanwhile |

Regression tests (green on arrival, written in the step named): ownership in T2 Step 2 and in T3 Step 2 (the current
code already scopes by user). T7 Step 2: S-1 through the real handlers, the tab and cache metadata, Strict Mode. T8 Step
2: a failed or rejected restore keeps the working copy and resets its flag.

## Briefs

### P7S1T1 Add the Postgres and DOM test harness and CI service

Agent `qa-test-automation-engineer`, 3 hours, no predecessor. Needs `TEST_DATABASE_URL` for the smoke test. This brief
authorises what the agent's definition otherwise forbids: adding the three devDependencies and editing
`vitest.config.ts`, `.env.example` and `.github/workflows/ci.yml`.

Step 1, red: CREATE `src/test/db.ts` as a stub that fails on assertions, not by throwing: `assertSafeTestDatabaseUrl`
returns its argument, `getTestDatabaseUrl` returns null, `describeDb` is `describe`, and the other exports throw "not
implemented" (a stub that threw everywhere would pass every rejection case without exercising a rule). Then CREATE
`src/test/db.test.ts` with the guard cases (always run) and a smoke test under `describeDb`. Each rule has its own word
in its message and each rejection case asserts it, as in `toThrow(/loopback/)`: `scheme` (not postgres or postgresql),
`parse` (a URL that does not parse; a second host in the authority, `a:1,b:2`, is one), `loopback` (a remote host,
`.supabase.co`), `database name` (no lower-case "test"), `query parameter` (below) and `GITHUB_ACTIONS` (unset in
Actions). The guard accepts `localhost`, `127.0.0.1` and `[::1]` (the `hostname` of a parsed IPv6 URL keeps its
brackets), compared case-sensitively, because the parser does not lower-case the host of a non-special scheme and an
upper-case host is rejected. It rejects a `host`, `hostaddr` or `port` query parameter, found as a key of
`new URL(url).searchParams.keys()` lower-cased and never by a pattern on the raw string: a probe on 20/10/2026 showed
Prisma 6.19.0 connecting to the host in `?host=` and in `?%68ost=` instead of the authority's, and ignoring `HOST`,
`Host`, `port` and `hostaddr`; those are rejected too, so that a version which reads them cannot bypass the guard. The
cases include `%68ost=`. An empty value is unset.

Step 2: implement `src/test/db.ts`. `getTestDatabaseUrl(env = process.env)` returns null when `TEST_DATABASE_URL` is
unset or empty, and throws when it is unset or empty and `GITHUB_ACTIONS` equals "true".
`assertSafeTestDatabaseUrl(url)` applies the rules above and returns the URL. `describeDb` is `describe` when a URL
exists and `describe.skip` otherwise. `useTestDatabase()` returns an accessor, `() => PrismaClient`, valid inside tests:
T2 and T3 call it in their describe bodies. It builds the `PrismaClient` with `datasourceUrl` inside `beforeAll`, never
in the describe body, because Vitest runs a `describe.skip` factory at collection and a client built there would exist
without a guard; asserts in `beforeAll` that `SELECT to_regclass('"Prompt"')::text` and the same for `"PromptVersion"`
find a table (the `::text` cast is required: Prisma cannot deserialize `regclass`; the failure message says to run
`npx prisma migrate deploy`); and disconnects in `afterAll`. `createTestUser(db)` and
`createTestPrompt(db, userId, fields)` use unique ids, and a user is removed with `db.profile.delete` (cascade).

MODIFY `package.json` and `package-lock.json` with
`npm install -D jsdom@^26.1.0 @testing-library/react@^16.3.0 @testing-library/dom@^10.4.0`; nothing else changes
version. MODIFY `vitest.config.ts` (it has no header block: add the source header, with `Created` taken from
`git log --diff-filter=A`): `include: ['src/**/*.test.{ts,tsx}']`; `esbuild: { jsx: 'automatic' }` (tsconfig sets
`"jsx": "preserve"`, so a JSX test fails with `ReferenceError: React is not defined`; the dialog suite of T8 uses JSX);
`coverage.include` keeps its four existing entries, drops the absent `src/lib/diff-utils.ts` and adds the files of
[the coverage scope](P7S1-editor-persistence-contracts.md#budgets-and-coverage-scope) (a pattern for a file that does
not exist yet matches nothing, so later tasks never edit this file; the `src/test/` fakes are not in it). MODIFY
`.env.example`: a `# Tests` group with `TEST_DATABASE_URL=""`. MODIFY `.github/workflows/ci.yml`: add three pieces to
the `verify` job, and rewrite the comment at lines 13-14 that says CI never connects to a database. `ci.yml`,
`.env.example` and `README.md` carry no header block today and get none from this PRP. Use the placeholder pair the
job's `env` block already uses (`user` and `pass`) for the throwaway service, so no new credential-looking value enters
the file, and the same pair in the three places below.

```yaml
# Fragment 1: under the verify job
services:
  postgres:
    image: postgres:17-alpine
    env:
      POSTGRES_USER: user
      POSTGRES_PASSWORD: pass
      POSTGRES_DB: prompthub_test
    ports:
      - 5432:5432
    options: >-
      --health-cmd "pg_isready -U user -d prompthub_test"
      --health-interval 5s
      --health-timeout 5s
      --health-retries 10
```

The `env` block of the job keeps its placeholders and gains one entry:

```yaml
# Fragment 2: added to the job's env block
env:
  TEST_DATABASE_URL: postgresql://user:pass@localhost:5432/prompthub_test
```

A new step goes after "Validate Prisma schema" and before "Unit tests":

```yaml
# Fragment 3: a new step
- name: Apply migrations to the test database
  run: npx prisma migrate deploy
  env:
    DATABASE_URL: postgresql://user:pass@localhost:5432/prompthub_test
    DIRECT_URL: postgresql://user:pass@localhost:5432/prompthub_test
```

Acceptance: `npm test` shows the 29 existing tests plus the new ones with the DB suites skipped, and with
`TEST_DATABASE_URL` set the smoke test passes. The workflow still parses
(`python3 -c "import sys,yaml; yaml.safe_load(open(sys.argv[1]))" .github/workflows/ci.yml`). The service container is
reported as not run: the workflow triggers only on `push` to `master` and on `pull_request`, so nothing can run it
before a pull request exists (see
[Environment for Database Tests](P7S1-task-context.md#environment-for-database-tests)). The main session provides the
database; the agent creates no role or database, and reports a command that is denied instead of working around it.
Documentation sync after this task (main session, `documentation-manager`): drift rows DR-7, DR-8, DR-9, DR-11, DR-20
and the rules half of DR-15; this task itself fixes DR-10, DR-14 and the `.env.example` half of DR-15.

### P7S1T2 Move save and autosave into a tested service with commit-style versions

Agent `senior-backend-engineer`, 3 hours, after T1. Needs `TEST_DATABASE_URL`. READ `prisma/schema.prisma` first. Step
1: CREATE `src/features/editor/service.ts` by extracting the logic of `saveNewVersion` and `autoSavePrompt` with
unchanged behaviour into `saveVersion` and `autoSaveDocument` (`(db, userId, input)`, `ActionResult` results,
`EditorDb = Pick<PrismaClient, "prompt" | "promptVersion" | "$transaction">`); the two actions in
`src/features/editor/actions.ts` call it and keep their shells; the file's header and the JSDoc of `saveNewVersion`
describe the old order (a version first, then the prompt update), so rewrite both and add the changelog line (DR-22).
Step 2, red: CREATE `service.save.test.ts` (`describeDb`). The ownership cases and the case of a save after an autosave
moved the row to the same content pass on arrival and are regression tests; the other commit-style cases fail against
the extraction. Step 3: change `saveVersion` to the semantics of the server pseudocode and confirm step 2 goes green.
Cases: save A, autosave B, save C lists C then A, both restorable by id | an identical save twice adds one row | two
parallel identical saves add one row | a save after autosave moved the row to the same content adds one row equal to the
saved state (regression) | autosave adds no version | user B cannot save or autosave user A's prompt and nothing
changes | an unknown prompt returns not found | a failure inside the transaction leaves the row and the history
unchanged (pass `saveVersion` a `db` whose `$transaction` hands the callback a `tx` wrapped in a `Proxy` whose
`promptVersion.create` throws: an injected seam over the real client, not a module mock). `saveNewVersion` returns
`{ versionId }`. Documentation sync after T3 covers this task's behaviour change.

### P7S1T3 Move restore and history into the service

Agent `senior-backend-engineer`, 3 hours, after T2. Needs `TEST_DATABASE_URL`. READ `prisma/schema.prisma` first. Step
1: extract `restorePromptVersion` and `getPromptVersionHistory` with unchanged behaviour into `restoreVersion` and
`listVersions` in `service.ts`; the two actions in `src/features/prompts/actions.ts` call them and keep their shells.
That file has no header block: add the source header (`Created` from `git log --diff-filter=A`) above `"use server"`.
Step 2, red: CREATE `service.restore.test.ts` against that extraction. The ownership cases and the `Promise.all` case
pass on arrival (or cannot be made deterministically red) and are regression tests; the others fail. Step 3: implement
`restoreVersion` and `listVersions` per the server pseudocode; `restorePromptVersion` returns `{ title, content }`.
Report the file's new line count. The file is RED, registered in `docs/rules/code-size-register.md`, and carries an
ESLint `max-lines` disable; it is expected to stay above 600 lines (about 630 to 640 with the header), so the disable
stays and the register row gets the new count. If it falls to 600 or fewer, remove the register row and the disable
comment together. Cases: the working copy not in history is snapshotted, then the
restored state, in that id order, and history lists the restored state first | the working copy equal to the newest
version adds no snapshot | restoring the newest version when the working copy equals it adds no duplicate, and when the
working copy differs it adds the working copy snapshot and a row for the restored state | restore then autosave an edit
leaves the restored text plus the edit and history unchanged by the autosave | autosave then restore keeps the autosaved
text in history | restore and autosave started together with `Promise.all` leave the autosaved text either as the row
content or in history | user B cannot restore or list user A's history | a version of another prompt returns not found |
a failure of the last write inside the transaction leaves the row and the history unchanged (the `Proxy` seam of T2,
failing the second `promptVersion.create`) | the list orders by `id` descending and caps at 50, with `created_at` values
seeded to contradict the id order, so ordering by `created_at` fails. Documentation sync after this task (main
session): DR-4, DR-6, DR-12, DR-18 and DR-21 (`README.md` says each save snapshots the previous version).

### P7S1T9 Sweep the documentation and the wip files

Agent `documentation-manager`, 2 hours, after T8. Verify, and fix any row whose fix is document-only and was missed by
an earlier sync; report the rest (an agent files no issue). The prompt names the commit before T1 as the base of "every
changed file" and supplies `TEST_DATABASE_URL`, which the README's database-backed command needs: the agent runs
`npm test` with it and does not run any command that writes to a database, so that command is reported as unverified if
it cannot be run. Check that every row of the drift register is fixed or reported; every changed file that has a header
block has a changelog line (`vitest.config.ts` and `src/features/prompts/actions.ts` gained one in T1 and T3; `ci.yml`,
`.env.example` and `README.md` have none); ADD a Testing section to `README.md` (`npm test`, the database-backed
variant, the DOM environment: DR-13); confirm the code-size register row for `src/features/prompts/actions.ts` has the
new count; and reconcile `wip/P7S1-research-drift.md` with a closing line per row. Search for stale references to the
removed names (`useLocalStorage`, `resetLoadedRef`, `hydrateDocumentCache`, `isTransitioning`, `contentPromptIdRef`,
`titlePromptIdRef`) in `src/` outside the changelog lines of file headers, and in the documents in scope of
[the drift review](../../docs/rules/documentation.md#drift-review), including `.serena/memories/` (DR-19: the three
memory files that describe the removed ref-flag protocol, the `localStorage` draft protocol and the P0 ref fixes).
Records are not drift and stay as they are: the PRPs and reports of earlier steps, `wip/P5S*`, `wip/P5S4bT1-*` and
`wip/MONACO-*`. Also search for the draft key `prompt-<id>`.

This agent is documentation-only and deletes nothing ([Never](../../.claude/AGENT-CONTRACT.md#never)). It lists the wip
files of this PRP for removal, and the main session removes them with `git rm` once the REPORT is written, because their
reference implementations are production code with tests by then: `wip/P7S1-loader-race-diagnostic.test.tsx`,
`wip/P7S1-autosave-timers-probe.test.tsx`, `wip/P7S1-draft-spike.ts`, `wip/P7S1-draft-spike.test.tsx`,
`wip/P7S1-loader-spike.ts`, `wip/P7S1-loader-spike.test.tsx`, `wip/P7S1-persistence-spike.ts`,
`wip/P7S1-persistence-spike.test.tsx`, `wip/P7S1-dialog-spike.tsx`, `wip/P7S1-dialog-spike.test.tsx`,
`wip/P7S1-test-fakes.ts`, `wip/P7S1-mutation-check.py` and `wip/P7S1-vitest.diag.config.ts`. The main session, not this
agent, amends dev-review #38 (it already lists "repeat across two tabs"; the new flows are a cold open, an open after
visiting Settings, the conflict toast's "Restore my text", the History list and Escape during a restore) and comments on
#37, #41, #44 (drafts now live under `prompt-v1-<id>`, `prompt-v1-<id>:conflict` and, until migrated, `prompt-<id>`; a
`prompt-` prefix purge covers all), #45 and #53.
