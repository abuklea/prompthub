# PromptHub
## P7S2 Task Briefs

| `Title` | `Created` | `Last modified` |
|---------|-----------|-----------------|
| P7S2 Task Briefs | 29/10/2026 16:53 GMT+10 | 29/10/2026 20:16 GMT+10 |

## Table of Contents
- [Purpose](#purpose)
- [Red to Green Map](#red-to-green-map)
- [Briefs](#briefs)
  - [P7S2T1 Add server-only and fix ensureProfileExists](#p7s2t1-add-server-only-and-fix-ensureprofileexists)
  - [P7S2T2 Add the action seam and the autosave limit](#p7s2t2-add-the-action-seam-and-the-autosave-limit)
  - [P7S2T3 Add the test factories and the fake deps](#p7s2t3-add-the-test-factories-and-the-fake-deps)
  - [P7S2T4 Validate and sanitise signIn and signUp](#p7s2t4-validate-and-sanitise-signin-and-signup)
  - [P7S2T5 Harden the folder actions and close the tabs of a deleted tree](#p7s2t5-harden-the-folder-actions-and-close-the-tabs-of-a-deleted-tree)
  - [P7S2T6 Harden the prompt CRUD and listing actions](#p7s2t6-harden-the-prompt-crud-and-listing-actions)
  - [P7S2T7 Split the rest of prompts/actions.ts and harden tags and history](#p7s2t7-split-the-rest-of-promptsactionsts-and-harden-tags-and-history)

## Purpose

The per-task detail for [the PRP](../P7S2-server-side-security-hardening.md), Tasks 1 to 7. Tasks 8 to 16 are in
[the second briefs file](P7S2-task-briefs-2.md#briefs). Interfaces, the action matrix and the schemas are in
[the action contracts](P7S2-action-contracts.md), the per-area rules and test conventions in
[the domain contracts](P7S2-domain-contracts.md), the references, gotchas, file plan, trees and call sites in
[the context](P7S2-task-context.md#references-and-gotchas), and the database environment in
[the PRP's validation loop](../P7S2-server-side-security-hardening.md#level-2-unit-and-postgres-backed-tests). An agent given one
task reads its brief, the contracts section it names and the source it cites, and checks every cited path against the
code first. Agents never commit, push, branch or touch issues
([Never](../../.claude/AGENT-CONTRACT.md#never)): the main session reviews each diff, runs every gate and commits with
`Refs #NN`. A step that names a red test is finished only when that test has been run and shown failing for the stated
reason, and the agent pastes the failing output. A task is finished when all six
[validation gates](../../.claude/AGENT-CONTRACT.md#validation-gates) pass, or each one that cannot run is reported as
not run with the reason.

Three rules apply to every task. A new source file carries the header block of
`docs/rules/documentation.md#source-file-headers` (this includes the new test files), and an edited file with a header
gets a changelog line and a new `Last modified`; every edited file without a header (the ten of finding F-9) gets one.
A task that needs the database is dispatched with `TEST_DATABASE_URL`; an agent without it writes its failing tests,
reports "red not shown: no database" and stops, and creates no role or database. Tasks marked `[P]` in the PRP run in
separate worktrees, so that no agent sees another's intentionally failing tests; the main session merges them.

Several tasks end with a frontend step that updates the callers of an action whose result changed. The two steps belong
to one commit: the backend step leaves the tree failing `tsc` until the frontend step is done, so the dispatcher runs
both in the same worktree before it commits, and the gates run once at the end. Task 15 (the agent definitions) runs
before Task 1.

## Red to Green Map

| Task | New tests | First red run fails because |
|---|---|---|
| T1 | `src/lib/server-only-alias.test.ts`, `src/lib/ensure-profile.test.ts` | `import "server-only"` throws under Vitest before the alias; the 50-call concurrency case rejects with Prisma `P2002` against a find-then-create body in the new signature |
| T2 | `src/lib/action-runner.test.ts`, `prisma-errors.test.ts`, `rate-limit.autosave.test.ts` | the stub `runAction` and the limiter functions return nothing useful, so each assertion on the result fails |
| T3 | `src/test/db.helpers.test.ts` | the factories are stubs that throw or return empty rows |
| T4 | `src/features/auth/handlers.test.ts` | the handler stubs forward the whole object and return Supabase's message |
| T5 | `folders/handlers.test.ts`, `handlers.isolation.test.ts`, `workspace/cache.tree.test.ts` | stub handlers return `NOT_FOUND` for everything or the shallow prompt ids; the descendant case fails on the missing ids |
| T6 | `prompts/handlers.test.ts`, `handlers.isolation.test.ts` | `createPrompt` with a foreign folder succeeds (finding F-2) |
| T7 | `prompts/tag-handlers.test.ts`, `history-handlers.test.ts`, `*.isolation.test.ts` | the unscoped `update` still writes; the stubs for the moved handlers fail on their assertions |

The red runs of T8 to T14 are in [the second file](P7S2-task-briefs-2.md#red-to-green-map).

## Briefs

### P7S2T1 Add server-only and fix ensureProfileExists

Agent `senior-backend-engineer`, 3 hours, after T15. Issue #40; decisions Q5, D9.

Files: MODIFY `package.json` and `package-lock.json` (one dependency, `npm install server-only`; the lock diff must
show only that package, and `git diff` of both files is part of the report); MODIFY `vitest.config.ts`; MODIFY
`src/lib/ensure-profile.ts`; MODIFY `src/features/editor/service.ts` (add `import "server-only"` and a changelog line;
its existing suites must still pass under the alias); the four callers `src/features/auth/actions.ts`,
`folders/actions.ts`, `profile/actions.ts` and `prompts/actions.ts` (each call becomes `ensureProfileExists(db, id)`;
`auth/actions.ts` gains `import db from "@/lib/db"` until Task 4 rewrites it); CREATE
`src/lib/server-only-alias.test.ts` and `src/lib/ensure-profile.test.ts`.

Steps. First, install the package and confirm that `node_modules/server-only/empty.js` exists, because the alias points
at it (the package's `exports` map names `./empty.js` under the `react-server` condition, from `npm view server-only`
on 29/10/2026; the file's presence is unverified until the install). Second, write
`src/lib/server-only-alias.test.ts`, which does `await import("server-only")` and expects it not to throw, and watch it
fail with the package's own throw (the import line carries `// @ts-expect-error` with a `Reason:`, because the package
ships no type declarations and `tsc` covers test files; found while executing, 29/10/2026). Third, add the alias to `vitest.config.ts` as a regular expression
`/^server-only$/` mapped to the absolute path of `node_modules/server-only/empty.js` (a global `react-server`
condition would break the jsdom suites), and watch the test pass. Fourth, add to the same edit the coverage `include`
patterns for every file the later tasks create or measure, so no later task edits the list: `src/lib/action-runner.ts`,
`src/lib/prisma-errors.ts`, `src/lib/ensure-profile.ts`, `src/lib/rate-limit.ts`, `src/features/*/handlers.ts`,
`src/features/prompts/*-handlers.ts`, `src/features/folders/schemas.ts`, `src/features/profile/schemas.ts`,
`src/features/auth/client-purge.ts`, `src/features/workspace/cache.ts` and `src/test/action-coverage.ts`. Exempt, as
`src/test/failing-db.ts` already is: the test helpers `src/test/action-deps.ts` and `src/test/racing-db.ts`, and
`action-runtime.ts` and the wrappers (they need a request scope); the report says so. Fifth,
write `src/lib/ensure-profile.test.ts` (`describeDb`) with: creates the profile when absent; a second call changes
nothing and leaves an existing `display_name` untouched; and 50 concurrent calls for a new id all resolve and leave
one row. Create the module in the new signature `(db, userId)` with the old find-then-create body first and show the
concurrency case failing with `P2002`; then replace the body with the `createMany` with `skipDuplicates` of
[the contract](P7S2-domain-contracts.md#ensureprofileexists). Sixth, remove `"use server"`, add `import "server-only"`
and the file header (DR-6), and run the gates.

Done when `grep -rn "ensureProfileExists" src` shows the helper, its test and its four callers only; the build no
longer treats the module as an action; the concurrency test passes against the `createMany` form (the developer chose
it on 29/10/2026 over the `upsert` wording of #40); `src/features/editor/service.ts` imports `server-only`; and no
dependency other than `server-only` changed.

### P7S2T2 Add the action seam and the autosave limit

Agent `senior-backend-engineer`, 3 hours, after T1. Decisions Q1, D1, D4; the rate-limit part of #48.

Files: CREATE `src/lib/action-runner.ts`, `src/lib/action-runtime.ts`, `src/lib/prisma-errors.ts`; MODIFY
`src/lib/rate-limit.ts`; CREATE `src/lib/action-runner.test.ts`, `src/lib/prisma-errors.test.ts` and
`src/lib/rate-limit.autosave.test.ts` (a new file: the existing `rate-limit.test.ts` is not edited).

Steps. Write the stubs of `runAction`, `isNotFoundError`, `checkSaveRateLimit` and `checkAutosaveRateLimit`, then the
tests, and show them failing. `action-runner.test.ts` covers, one case each: a parse failure returns `spec.invalid` and
neither `getUser` nor `run` is called; a null user returns "Unauthorized. Please sign in."; the 31st call of a fresh
user in a `mutation` spec returns "Too many requests. Please slow down." while a `save` spec and an `autosave` spec for
the same user are still allowed (and the 31st `save` call is refused); a `none` spec is never limited; `run` receives
the `user` (id and email) from `getUser` and the parsed input; a thrown error returns `spec.failure`; an object with a
string `digest` (`NEXT_REDIRECT;replace;/x;307;`, `NEXT_NOT_FOUND`, `DYNAMIC_SERVER_USAGE`) is rethrown while a plain
`Error` and a Prisma error are not; a `getUser` that rejects returns `spec.failure`; and `ensureProfile: true` leaves a
profile row (`describeDb`). DB-free cases pass a `db` that throws when touched, which proves the runner does not use
it. `prisma-errors.test.ts` checks `isNotFoundError` for a real `P2025` raised by `db.folder.update` on a missing row
(`describeDb`) and false for other errors. `rate-limit.autosave.test.ts` checks 240 allowed and the 241st refused for
one identifier, `checkSaveRateLimit` 30 and the 31st, and independence of the `mutation`, `save` and `autosave` stores
from one another. Then implement [the contract](P7S2-action-contracts.md#the-seam); `action-runtime.ts` builds
`actionDeps` (`getUser` maps `{ id, email: user.email ?? null }`) and `authDeps` (`clientIp` from `headers()`, `auth`
from `createClient().auth`, both lazily) and carries `import "server-only"`.

Done when `action-runner.ts` and `prisma-errors.ts` have no `next/*` import, `action-runtime.ts` is imported by no test,
the new modules have headers, and per-file coverage of `action-runner.ts`, `prisma-errors.ts` and `rate-limit.ts` is at
least 80% on every measure (`action-runtime.ts` is exempt: it needs a request scope). Baseline measured on 29/10/2026:
`rate-limit.ts` has 91.11% lines but 60% functions, because `checkAuthRateLimit` and `checkMutationRateLimit` (lines
79-84) have no test; the new tests cover them and the save limiter.

### P7S2T3 Add the test factories and the fake deps

Agent `qa-test-automation-engineer`, 2.5 hours, after T2. Issue #45 (harness).

Files: MODIFY `src/test/db.ts` (add `createTestFolder` with a `parentId` field, `createTestTag`, `deleteTestUser`, a
`folderId` field on `createTestPrompt`, and the pool cap in `useTestDatabase`); CREATE `src/test/action-deps.ts`,
`src/test/racing-db.ts` and `src/test/db.helpers.test.ts`. The existing `src/test/db.test.ts` is not edited.

Steps. Write the helper test first (`describeDb`): `createTestFolder` makes a root folder and a child linked by
`parent_id`; `createTestTag` makes a tag for a user; `deleteTestUser` removes a user's tags, prompts, versions, folders
and profile and leaves another user's rows (the tags need an explicit delete: `Tag` has no relation to `Profile`).
Show it failing against stubs, then implement. `action-deps.ts` exports `testDeps(db, userId)` and `signedOutDeps(db)`
of [the conventions](P7S2-domain-contracts.md#test-conventions); `testDeps` returns a user with an id and an email.
Also test: `createTestPrompt` with `folderId` files the prompt in that folder; a pure `withConnectionLimit(url)`
(exported from `db.ts`) adds `connection_limit=5` only when the URL has none and leaves the rest of the URL intact, and
`useTestDatabase` uses it (the guard allows the parameter). `racing-db.ts` exports
`withRowDeletedBeforeUpdate(db, model, id): PrismaClient` of
[the conventions](P7S2-domain-contracts.md#test-conventions) (mirror `src/test/failing-db.ts`). Test both paths it
intercepts: a top-level `folder.update` of the named row raises `P2025` from the real database, and so does a
`tx.prompt.update` inside `$transaction(async (tx) => ...)`; a second `update`, another id and another model are not
intercepted, and the outer delete leaves other rows alone.

Done when `src/test/db.ts` coverage stays at or above its P7S1 figures (97.18% lines, 87.87% branches) and the helpers
are used by the first isolation suite of Task 4 or 5.

### P7S2T4 Validate and sanitise signIn and signUp

Agent `senior-backend-engineer`, 3 hours, after T3, `[P]`. Issue #42; finding F-4; decision D7.

Files: CREATE `src/features/auth/handlers.ts` and `src/features/auth/handlers.test.ts`; MODIFY
`src/features/auth/actions.ts` (it gains a header block, finding F-9); `AuthForm.tsx` is not expected to change,
because the wrapper parameters stay assignable from its typed values; verify with `tsc`.

Steps. Write the tests first with a fake `auth` that records its arguments and returns a configured `{ data, error }`.
Title each test `"signIn: ..."` or `"signUp: ..."`: Task 10's coverage rule finds them by that title. Cases: valid input
reaches `signInWithPassword` and `signUp` with exactly `{ email, password }`, also when the input carries
`confirmPassword` and an `options` object; an invalid email, a short password and a `SignUpSchema` mismatch return
"Check your email and password and try again." and never call `auth`; a rejection with `code: "email_not_confirmed"`,
one with another code and one with no code give the messages of
[the table](P7S2-domain-contracts.md#auth); a thrown error returns "Something went wrong. Please try again." with no
part of the original message; the sixth attempt from one IP within a minute is refused, a different IP is not; a
profile failure after a successful sign-in still succeeds (`describeDb` for the profile row, with a `db` whose
`profile.createMany` rejects for the failure case). Show them failing, implement, then make `actions.ts` three thin
wrappers: `signUp` and `signIn` call the handlers and call `revalidatePath("/", "layout")` on success; `signOut` keeps
its body.

Done when `grep -n "error.message" src/features/auth` finds nothing returned to a client, and the tests above pass.
`signIn` and `signUp` are not tenant actions, so they need these tests and no isolation test.

### P7S2T5 Harden the folder actions and close the tabs of a deleted tree

Agents `senior-backend-engineer` (steps 1 to 4), `senior-frontend-engineer` (step 5), 4 hours, after T3, `[P]`.
Issues #41 (folders), #43; findings F-2, F-6.

Files: CREATE `src/features/folders/schemas.ts`, `handlers.ts`, `handlers.test.ts`, `handlers.isolation.test.ts`; MODIFY
`src/features/folders/actions.ts`; MODIFY `src/features/folders/components/FolderItem.tsx`, `FolderTree.tsx`,
`FolderToolbar.tsx`; MODIFY `src/features/workspace/cache.ts`; CREATE `src/features/workspace/cache.tree.test.ts`.

Steps. Write the schemas of [the contract](P7S2-action-contracts.md#schemas). Write the tests first. Behaviour
(`handlers.test.ts`): a name is trimmed and capped at 100; a blank name is refused; a child folder is created under an
owned parent; rename returns the updated folder, and a folder that vanishes between the handler's read and write
(`withRowDeletedBeforeUpdate(db, "folder", id)`, which intercepts the direct `db.folder.update`) gives NOT_FOUND through
`P2025`. Isolation (`handlers.isolation.test.ts`), one test per action, each
titled `"<action>: user B ..."`: `createFolder` with A's folder as parent returns NOT_FOUND and creates no row;
`renameFolder` and `deleteFolder` of A's folder return NOT_FOUND and A's tree is intact; `getFolderChildren` of A's
folder returns an empty list; `getRootFolders` returns none of A's. The nested case: A has folder X, child Y, grandchild
Z, with a prompt in each; `deleteFolder(X)` returns all three folder ids and all three prompt ids, and the database has
none of those rows; a second user's tree is untouched. The cache test: `removeFolderTreeFromCache` removes the given
folders from every parent list and key, their prompt lists, and the prompt entries, and leaves siblings. Show red, then
implement the handlers and the CTE of [the contract](P7S2-domain-contracts.md#folders) and the wrappers. Step 5 changes
the callers: each branches on `result.success`, shows `result.error` in the existing toast on failure, keeps its
optimistic rollback, replaces the thrown-error paths, closes a tab for every returned prompt id, and calls
`removeFolderTreeFromCache` with both id lists (replacing `removeFolderFromCache`). Optimistic folders with `temp-` ids
are not guarded (the contract says why). The three components carry a header block after this step (F-9).

Done when no caller relies on a thrown error from a folder action. The components have no unit test today and the PRP
adds none; the callers are checked by `tsc` and by the browser list of Task 16, and the report says so.

### P7S2T6 Harden the prompt CRUD and listing actions

Agents `senior-backend-engineer` (steps 1 to 4), `senior-frontend-engineer` (step 5), 4 hours, after T3, `[P]`.
Issue #41 (prompts); finding F-2; drift rows DR-18, DR-19.

Files: MODIFY `src/features/prompts/schemas.ts`; CREATE `src/features/prompts/handlers.ts`, `handlers.test.ts`,
`handlers.isolation.test.ts`, `search-handlers.ts`; MODIFY `src/features/prompts/actions.ts` (the six CRUD and listing
actions become wrappers; the tag and history functions move in Task 7). With search and the CRUD actions gone the file
is about 300 lines and leaves RED here, so Task 6 deletes the `eslint-disable max-lines` comment and the register row
in `docs/rules/code-size-register.md` (`reportUnusedDisableDirectives` is on in `.eslintrc.json`, so a stale directive
would be a new warning, and the audit reports a stale row); MODIFY the callers `PromptList.tsx`,
`DocumentToolbar.tsx`, `src/features/tabs/components/DocumentTab.tsx` and `src/hooks/use-tab-cleanup.ts`.

Steps. Add the schemas of the contract. Tests first. `createPrompt` with a folder owned by another user returns
"Folder not found or access denied" and creates no row (the red that matters: it succeeds today); with an owned folder
it still creates, still rejects a duplicate title case-insensitively and still stores a null title. `renamePrompt`
refuses an empty, a 201-character and a placeholder title, trims, and refuses a duplicate in the folder; `deletePrompt`
and `renamePrompt` of A's prompt by B return the existing not-found text and change nothing; `validatePrompts` returns
only the caller's ids from a list that includes A's, and refuses 201 ids; `getPromptDetails` of A's prompt returns the
text a missing id returns and carries no `tags` field; `getPromptsByFolder` for A's folder returns an empty list, and
with a `query` delegates to the search function, which stays scoped by `user_id` (move `searchPrompts` into
`search-handlers.ts` unchanged apart from the signature, which becomes `(db, userId, input)`; decision D3 removes it as
an action). Keep `searchPromptsSchema` in `schemas.ts`: the search function still parses its input with it, and
`prompts/schemas.test.ts` covers it. Implement; update the
header description of `actions.ts` and the `@returns` text of `createPrompt` (DR-18) and the "enforce RLS" comment
(DR-19). Step 5: callers use the object arguments (`renamePrompt({ promptId, newTitle })`, `deletePrompt({ promptId })`,
`validatePrompts({ promptIds })`, `getPromptsByFolder({ folderId, query, tagIds })`) and branch on `success` for
`getPromptsByFolder`; `PromptList`, its only caller, shows the error in a toast and keeps its previous list.

Done when the six actions are wrappers, `searchPrompts` is no longer exported, and the isolation test of each action
exists and passes.

### P7S2T7 Split the rest of prompts/actions.ts and harden tags and history

Agents `senior-backend-engineer` (steps 1 to 4), `senior-frontend-engineer` (step 5), 4 hours, after T6 and T8.
Issues #41 (`assignTagsToPrompt`), #51; drift row DR-20.

Files: CREATE `src/features/prompts/tag-handlers.ts`, `tag-actions.ts`, `history-handlers.ts`, `history-actions.ts` and
the tests `tag-handlers.test.ts`, `tag-handlers.isolation.test.ts`, `history-handlers.test.ts`,
`history-handlers.isolation.test.ts`; MODIFY `src/features/prompts/actions.ts` (delete the moved functions); MODIFY the
importers `DocumentToolbar.tsx` (tags), `src/features/editor/components/EditorPane.tsx` (`getPromptVersionHistory`,
`restorePromptVersion`).

Steps. Tests first. Tags: `getTags` returns only the caller's, and `getTags({ folderId })` by B with A's folder id
returns `[]` (titled `"getTags: user B ..."`); `createTag` returns the existing tag for a case-insensitive duplicate of
the caller's own tag, B creating a tag with the name of A's tag gets a new id and A's tag keeps its id and name (titled
`"createTag: user B ..."`), and it survives the concurrent-create `P2002` path (keep the existing recovery, with a test
that calls it twice in parallel); `assignTagsToPrompt` by B on A's prompt returns "Prompt not found or access denied"
and A's tags are unchanged; B assigning A's tag id to B's own prompt returns "One or more tags are invalid" and assigns
nothing; the write is `update({ where: { id, user_id } })` inside one transaction with the reads, and a prompt that is
deleted between the reads and the write (`withRowDeletedBeforeUpdate(db, "prompt", id)`, which intercepts the
`tx.prompt.update` inside the handler's `$transaction`) maps `P2025` to the same not-found text. History:
`getPromptVersionHistory` and `restorePromptVersion` by B on A's prompt return "Prompt not found or access denied" and
A's row and versions are unchanged (the lower-layer cases already exist in `service.*.test.ts`; these test the handler
path and the limit; `restorePromptVersion` uses the `save` bucket). Implement the handlers and wrappers per
[the contract](P7S2-domain-contracts.md#prompts-tags-and-history) and move the functions out of `actions.ts` with their
doc comments. Confirm that Task 6 already removed the `eslint-disable` and the register row, and that
`bash scripts/audit-code-size.sh --summary` reports no RED file. The `document-actions.test.ts` suite and
`editor-env.ts` name the actions through an injected interface and are not edited.

Done when `src/features/prompts/actions.ts` is under 300 lines, `grep -rn "eslint-disable max-lines" src` finds no
registered-RED comment, and every moved action has an isolation test.
