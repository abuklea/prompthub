# PromptHub
## P7S2 Task Briefs

| `Title` | `Created` | `Last modified` |
|---------|-----------|-----------------|
| P7S2 Task Briefs | 29/10/2026 16:53 GMT+10 | 29/10/2026 17:01 GMT+10 |

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
  - [P7S2T8 Move the editor, profile, workspace and dashboard actions onto the seam](#p7s2t8-move-the-editor-profile-workspace-and-dashboard-actions-onto-the-seam)
  - [P7S2T9 Purge client state on sign-out and delete the sign-out route](#p7s2t9-purge-client-state-on-sign-out-and-delete-the-sign-out-route)
  - [P7S2T10 Isolation coverage rule](#p7s2t10-isolation-coverage-rule)
  - [P7S2T11 Independent security review](#p7s2t11-independent-security-review)
  - [P7S2T12 Sweep the documentation](#p7s2t12-sweep-the-documentation)
  - [P7S2T13 Developer checks](#p7s2t13-developer-checks)

## Purpose

The per-task detail for [the PRP](../P7S2-server-side-security-hardening.md). Interfaces, the action matrix, the
schemas and the test conventions are in [the contracts](P7S2-action-contracts.md); the trees and call sites are in
[the context](P7S2-task-context.md); the references, gotchas and the database environment are in
[the PRP](../P7S2-server-side-security-hardening.md#all-needed-context) and its
[validation loop](../P7S2-server-side-security-hardening.md#level-2-unit-and-postgres-backed-tests). An agent given one
task reads its brief, the contracts section it names and the source it cites, and checks every cited path against the
code first. Agents never commit, push, branch or touch issues
([Never](../../.claude/AGENT-CONTRACT.md#never)): the main session reviews each diff, runs every gate and commits with
`Refs #NN`. A step that names a red test is finished only when that test has been run and shown failing for the stated
reason, and the agent pastes the failing output. A task is finished when all six
[validation gates](../../.claude/AGENT-CONTRACT.md#validation-gates) pass, or each one that cannot run is reported as
not run with the reason.

Three rules apply to every task. A new source file carries the header block of
`docs/rules/documentation.md#source-file-headers` (this includes the new test files), and an edited file with a header
gets a changelog line and a new `Last modified`; the ten files without a header (finding F-9) get one when a task
edits them. A task that needs the database is dispatched with `TEST_DATABASE_URL`; an agent without it writes its
failing tests, reports "red not shown: no database" and stops, and creates no role or database. Tasks marked `[P]`
in the PRP run in separate worktrees, so that no agent sees another's intentionally failing tests; the main session merges them.

Several tasks end with a frontend step that updates the callers of an action whose result changed. The two steps belong
to one commit: the backend step leaves the tree failing `tsc` until the frontend step is done, so the dispatcher runs
both in the same worktree before it commits, and the gates run once at the end.

## Red to Green Map

| Task | New tests | First red run fails because |
|---|---|---|
| T1 | `src/lib/server-only-alias.test.ts`, `src/lib/ensure-profile.test.ts` | `import "server-only"` throws under Vitest before the alias; the 50-call concurrency case rejects with Prisma `P2002` against a find-then-create body in the new signature |
| T2 | `src/lib/action-runner.test.ts`, `prisma-errors.test.ts`, `rate-limit.autosave.test.ts` | the stub `runAction` and `checkAutosaveRateLimit` return nothing useful, so each assertion on the result fails |
| T3 | `src/test/db.helpers.test.ts` | the factories are stubs that throw or return empty rows |
| T4 | `src/features/auth/handlers.test.ts` | the handler stubs forward the whole object and return Supabase's message |
| T5 | `folders/handlers.test.ts`, `handlers.isolation.test.ts`, `workspace/cache.tree.test.ts` | stub handlers return `NOT_FOUND` for everything or the shallow prompt ids; the descendant case fails on the missing ids |
| T6 | `prompts/handlers.test.ts`, `handlers.isolation.test.ts` | `createPrompt` with a foreign folder succeeds (finding F-2) |
| T7 | `prompts/tag-handlers.test.ts`, `history-handlers.test.ts`, `*.isolation.test.ts` | the unscoped `update` still writes; the stubs for the moved handlers fail on their assertions |
| T8 | `editor/handlers.test.ts`, `profile/handlers.test.ts`, `workspace/handlers.test.ts`, `dashboard/handlers.test.ts`, isolation files | stub handlers; the autosave limit test fails on a missing limiter |
| T9 | `workspace/cache.test.ts`, `auth/client-purge.test.ts` | the viewer functions and `purgeClientState` do not exist or do nothing |
| T10 | `src/test/action-coverage.test.ts`, `action-coverage.check.test.ts` | the pure checker is a stub that reports nothing, so the fixture cases fail |

## Briefs

### P7S2T1 Add server-only and fix ensureProfileExists

Agent `senior-backend-engineer`, 3 hours, after none. Issue #40; decision Q5.

Files: MODIFY `package.json` and `package-lock.json` (one dependency, `npm install server-only`; the lock diff must show
only that package, and `git diff` of both files is part of the report); MODIFY `vitest.config.ts`; MODIFY
`src/lib/ensure-profile.ts`; the four callers `src/features/auth/actions.ts`, `folders/actions.ts`, `profile/actions.ts`
and `prompts/actions.ts` (each call becomes `ensureProfileExists(db, id)`; `auth/actions.ts` gains `import db from
"@/lib/db"` until Task 4 rewrites it); CREATE `src/lib/server-only-alias.test.ts` and `src/lib/ensure-profile.test.ts`.

Steps. First, install the package and confirm that `node_modules/server-only/empty.js` exists, because the alias points
at it (the package's `exports` map names `./empty.js` under the `react-server` condition, from `npm view server-only`
on 29/10/2026; the file's presence is unverified until the install). Second, write
`src/lib/server-only-alias.test.ts`, which does `await import("server-only")` and expects it not to throw, and watch it
fail with the package's own throw. Third, add the alias to `vitest.config.ts` as a regular expression
`/^server-only$/` mapped to the absolute path of `node_modules/server-only/empty.js` (a global `react-server`
condition would break the jsdom suites), and watch the test pass. Fourth, add to the same edit the coverage `include`
patterns for every file the later tasks create, so no later task edits the list: `src/lib/action-runner.ts`,
`src/lib/prisma-errors.ts`, `src/lib/ensure-profile.ts`, `src/features/*/handlers.ts`,
`src/features/prompts/*-handlers.ts`, `src/features/auth/client-purge.ts` and `src/features/workspace/cache.ts`. Fifth,
write `src/lib/ensure-profile.test.ts` (`describeDb`) with: creates the profile when absent; a second call changes
nothing and leaves an existing `display_name` untouched; and 50 concurrent calls for a new id all resolve and leave
one row. Create the module in the new signature `(db, userId)` with the old find-then-create body first and show the
concurrency case failing with `P2002`; then replace the body with the upsert of
[the contract](P7S2-action-contracts.md#ensureprofileexists). Sixth, remove `"use server"`, add `import "server-only"`
and the file header (DR-6), and run the gates.

Done when `grep -rn "ensureProfileExists" src` shows the helper, its test and its four callers only; the build no longer
treats the module as an action; the concurrency test passes against the upsert form (or the report states the deviation
to `createMany`); and no dependency other than `server-only` changed.

### P7S2T2 Add the action seam and the autosave limit

Agent `senior-backend-engineer`, 3 hours, after T1. Decision Q1; the rate-limit part of #48.

Files: CREATE `src/lib/action-runner.ts`, `src/lib/action-runtime.ts`, `src/lib/prisma-errors.ts`; MODIFY
`src/lib/rate-limit.ts`; CREATE `src/lib/action-runner.test.ts`, `src/lib/prisma-errors.test.ts` and
`src/lib/rate-limit.autosave.test.ts` (a new file: the existing `rate-limit.test.ts` is not edited).

Steps. Write the stubs of `runAction`, `isNotFoundError` and `checkAutosaveRateLimit`, then the tests, and show them
failing. `action-runner.test.ts` covers, one case each: a parse failure returns `spec.invalid` and neither `getUser` nor
`run` is called; a null user returns "Unauthorized. Please sign in."; the 31st call of a fresh user in a `mutation` spec
returns "Too many requests. Please slow down." while an `autosave` spec for the same user is still allowed; a
`none` spec is never limited; `run` receives the `userId` from `getUser` and the parsed input; a thrown error returns
`spec.failure`; an `Error("NEXT_REDIRECT")` is rethrown; a `getUser` that rejects returns `spec.failure`; and
`ensureProfile: true` leaves a profile row (`describeDb`). DB-free cases pass a `db` that throws when touched, which
proves the runner does not use it. `prisma-errors.test.ts` checks `isNotFoundError` for a real `P2025` raised by
`db.folder.update` on a missing row (`describeDb`) and false for other errors. `rate-limit.autosave.test.ts` checks
240 allowed and the 241st refused for one identifier, and independence from the `mutation` store. Then implement
[the contract](P7S2-action-contracts.md#the-seam); `action-runtime.ts` builds `actionDeps` and the auth deps
(`clientIp` from `headers()`, `auth` from `createClient().auth`, both lazily) and carries `import "server-only"`.

Done when `action-runner.ts` and `prisma-errors.ts` have no `next/*` import, `action-runtime.ts` is imported by no test,
the new modules have headers, and per-file coverage of `action-runner.ts` and `prisma-errors.ts` is at least 80% on
every measure (`action-runtime.ts` is exempt: it needs a request scope).

### P7S2T3 Add the test factories and the fake deps

Agent `qa-test-automation-engineer`, 1.5 hours, after T2. Issue #45 (harness).

Files: MODIFY `src/test/db.ts` (add `createTestFolder`, `createTestTag`, `deleteTestUser`); CREATE
`src/test/action-deps.ts` and `src/test/db.helpers.test.ts`. The existing `src/test/db.test.ts` is not edited.

Steps. Write the helper test first (`describeDb`): `createTestFolder` makes a root folder and a child linked by
`parent_id`; `createTestTag` makes a tag for a user; `deleteTestUser` removes a user's tags, prompts, versions, folders
and profile and leaves another user's rows (the tags need an explicit delete: `Tag` has no relation to `Profile`).
Show it failing against stubs, then implement. `action-deps.ts` exports `testDeps(db, userId)` and
`signedOutDeps(db)` of [the conventions](P7S2-action-contracts.md#test-conventions).

Done when `src/test/db.ts` coverage stays at or above its P7S1 figures (97.18% lines, 87.87% branches) and the helpers
are used by the first isolation suite of Task 4 or 5.

### P7S2T4 Validate and sanitise signIn and signUp

Agent `senior-backend-engineer`, 3 hours, after T3, `[P]`. Issue #42; finding F-4.

Files: CREATE `src/features/auth/handlers.ts` and `src/features/auth/handlers.test.ts`; MODIFY
`src/features/auth/actions.ts` (it gains a header block, finding F-9); `AuthForm.tsx` is not expected to change,
because the wrapper parameters stay assignable from its typed values; verify with `tsc`.

Steps. Write the tests first with a fake `auth` that records its arguments and returns a configured `{ data, error }`.
Cases: valid input reaches `signInWithPassword` and `signUp` with exactly `{ email, password }`, also when the input
carries `confirmPassword` and an `options` object; an invalid email, a short password and a `SignUpSchema` mismatch
return "Check your email and password and try again." and never call `auth`; a rejection with
`code: "email_not_confirmed"`, one with another code and one with no code give the messages of
[the table](P7S2-action-contracts.md#auth); a thrown error returns "Something went wrong. Please try again." with
no part of the original message; the sixth attempt from one IP within a minute is refused, a different IP is not; a profile
failure after a successful sign-in still succeeds (`describeDb` for the profile row, with a `db` whose `profile.upsert`
rejects for the failure case). Show them failing, implement, then make `actions.ts` three thin wrappers: `signUp` and
`signIn` call the handlers and call `revalidatePath("/", "layout")` on success; `signOut` keeps its body.

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
owned parent; rename returns the updated folder. Isolation (`handlers.isolation.test.ts`), one test per action, each
titled `"<action>: user B ..."`: `createFolder` with A's folder as parent returns NOT_FOUND and creates no row;
`renameFolder` and `deleteFolder` of A's folder return NOT_FOUND and A's tree is intact; `getFolderChildren` of A's
folder returns an empty list; `getRootFolders` returns none of A's. The nested case: A has folder X, child Y, grandchild
Z, with a prompt in each; `deleteFolder(X)` returns all three folder ids and all three prompt ids, and the database has
none of those rows; a second user's tree is untouched. The cache test: `removeFolderTreeFromCache` removes the given
folders from every parent list and key, their prompt lists, and the prompt entries, and leaves siblings. Show red, then
implement the handlers and the CTE of [the contract](P7S2-action-contracts.md#folders) and the wrappers. Step 5 changes
the callers: each branches on `result.success`, shows `result.error` in the existing toast on failure, keeps its
optimistic rollback, replaces the thrown-error paths, closes a tab for every returned prompt id, and calls
`removeFolderTreeFromCache` with both id lists (replacing `removeFolderFromCache`). The three components carry a header
block after this step (F-9).

Done when no caller relies on a thrown error from a folder action. The components have no unit test today and the PRP
adds none; the callers are checked by `tsc` and by the browser list of Task 13, and the report says so.

### P7S2T6 Harden the prompt CRUD and listing actions

Agents `senior-backend-engineer` (steps 1 to 4), `senior-frontend-engineer` (step 5), 4 hours, after T3, `[P]`.
Issue #41 (prompts); finding F-2; drift rows DR-18, DR-19.

Files: MODIFY `src/features/prompts/schemas.ts`; CREATE `src/features/prompts/handlers.ts`, `handlers.test.ts`,
`handlers.isolation.test.ts`, `search-handlers.ts`; MODIFY `src/features/prompts/actions.ts` (the six CRUD and listing
actions become wrappers; the tag and history functions stay untouched until Task 7, and the file stays RED with its
`eslint-disable` comment until then); MODIFY the callers `PromptList.tsx`, `DocumentToolbar.tsx`,
`src/features/tabs/components/DocumentTab.tsx` and `src/hooks/use-tab-cleanup.ts`.

Steps. Add the schemas of the contract. Tests first. `createPrompt` with a folder owned by another user returns
"Folder not found or access denied" and creates no row (the red that matters: it succeeds today); with an owned folder
it still creates, still rejects a duplicate title case-insensitively and still stores a null title. `renamePrompt`
refuses an empty, a 201-character and a placeholder title, trims, and refuses a duplicate in the folder; `deletePrompt`
and `renamePrompt` of A's prompt by B return the existing not-found text and change nothing; `validatePrompts` returns
only the caller's ids from a list that includes A's, and refuses 201 ids; `getPromptDetails` of A's prompt returns the
text a missing id returns and carries no `tags` field; `getPromptsByFolder` for A's folder returns an empty list, and
with a `query` delegates to the search function, which stays scoped by `user_id` (move `searchPrompts` into
`search-handlers.ts` unchanged apart from the signature; decision D3 removes it as an action). Implement; update the
header description of `actions.ts` and the `@returns` text of `createPrompt` (DR-18) and the "enforce RLS" comment
(DR-19). Step 5: callers use the object arguments (`renamePrompt({ promptId, newTitle })`, `deletePrompt({ promptId })`,
`validatePrompts({ promptIds })`, `getPromptsByFolder({ folderId, query, tagIds })`) and branch on `success` for
`getPromptsByFolder`; `PromptList` and `DocumentToolbar` show the error in a toast and keep their previous list.

Done when the six actions are wrappers, `searchPrompts` is no longer exported, and the isolation test of each action
exists and passes.

### P7S2T7 Split the rest of prompts/actions.ts and harden tags and history

Agents `senior-backend-engineer` (steps 1 to 4), `senior-frontend-engineer` (step 5), 4 hours, after T6. Issues #41
(`assignTagsToPrompt`), #51; drift row DR-20.

Files: CREATE `src/features/prompts/tag-handlers.ts`, `tag-actions.ts`, `history-handlers.ts`, `history-actions.ts` and
the tests `tag-handlers.test.ts`, `tag-handlers.isolation.test.ts`, `history-handlers.test.ts`,
`history-handlers.isolation.test.ts`; MODIFY `src/features/prompts/actions.ts` (delete the moved functions and the
`eslint-disable max-lines` comment); MODIFY `docs/rules/code-size-register.md` (remove the row for the file); MODIFY the
importers `DocumentToolbar.tsx` (tags), `src/features/editor/components/EditorPane.tsx` (`getPromptVersionHistory`,
`restorePromptVersion`).

Steps. Tests first. Tags: `getTags` returns only the caller's; `createTag` returns the existing tag for a
case-insensitive duplicate and survives the concurrent-create `P2002` path (keep the existing recovery, with a test that
calls it twice in parallel); `assignTagsToPrompt` by B on A's prompt returns "Prompt not found or access denied" and A's
tags are unchanged; B assigning A's tag id to B's own prompt returns "One or more tags are invalid" and assigns
nothing; the write is `update({ where: { id, user_id } })` inside one transaction with the reads, and a prompt that is
deleted or reassigned between the reads and the write maps `P2025` to the same not-found text. History:
`getPromptVersionHistory` and `restorePromptVersion` by B on A's prompt return "Prompt not found or access denied" and
A's row and versions are unchanged (the lower-layer cases already exist in `service.*.test.ts`; these test the handler
path and the limit). Implement the handlers and wrappers per
[the contract](P7S2-action-contracts.md#prompts-tags-and-history), move the functions out of `actions.ts` with their doc comments, delete the `eslint-disable` and the register row, and
confirm `bash scripts/audit-code-size.sh --summary` reports no RED file. The `document-actions.test.ts` suite and
`editor-env.ts` name the actions through an injected interface and are not edited.

Done when `src/features/prompts/actions.ts` is under 300 lines, `grep -rn "eslint-disable max-lines" src` finds no
registered-RED comment, and every moved action has an isolation test.

### P7S2T8 Move the editor, profile, workspace and dashboard actions onto the seam

Agents `senior-backend-engineer` (steps 1 to 4), `senior-frontend-engineer` (step 5), 3.5 hours, after T3, `[P]`.
Decisions Q3, Q4.

Files: CREATE `src/features/editor/handlers.ts`, `handlers.test.ts`, `handlers.isolation.test.ts`; MODIFY
`src/features/editor/actions.ts`; CREATE `src/features/profile/schemas.ts`, `handlers.ts`, `handlers.test.ts`,
`handlers.isolation.test.ts`; MODIFY `src/features/profile/actions.ts`; CREATE `src/features/workspace/handlers.ts` and
the two tests; MODIFY `src/features/workspace/actions.ts`; CREATE `src/features/dashboard/handlers.ts` and the two
tests; MODIFY `src/features/dashboard/actions.ts`; MODIFY `src/app/(app)/profile/page.tsx` and
`src/components/layout/WorkspacePreloader.tsx` (callers).

Steps. Tests first. Editor: `saveNewVersion` and `autoSavePrompt` by B on A's prompt return the not-found text and
change nothing; `autoSavePrompt` is allowed 240 times by one user while `saveNewVersion` is refused on the 31st, and
the two limits are independent; the existing title validation of `saveNewVersion` is kept. Profile:
`updateDisplayName` by B changes only B's profile; a name over 100 characters is refused; a blank name stores null;
`getProfileDetails` creates the profile for a user that has none and returns only that user's data. Workspace: B's
snapshot contains none of A's folders or prompts. Dashboard: B's counts and recent list exclude A's rows, including
A's versions. Then implement; `getDashboardMetrics` keeps its shape and its zero result for a missing user. Step 5:
`profile/page.tsx` and `WorkspacePreloader` branch on `success` (the preloader keeps its `try/finally` and its
`mounted` guard; `WorkspacePreloader` also receives the `userId` prop in Task 9, so do not add it here).

Done when no `editor`, `profile`, `workspace` or `dashboard` action imports `@/lib/db` or `createClient` outside
`action-runtime.ts`.

### P7S2T9 Purge client state on sign-out and delete the sign-out route

Agent `senior-frontend-engineer`, 4 hours, after T5 and T8. Issue #44; decisions Q6, Q7, D5; findings F-7, F-8; drift
rows DR-16, DR-25.

Files: MODIFY `src/features/workspace/cache.ts`; CREATE `src/features/workspace/cache.test.ts`; CREATE
`src/features/auth/client-purge.ts` and `client-purge.test.ts`; MODIFY `src/stores/use-tab-store.ts` and
`src/features/tabs/types.ts` (`resetTabs`); MODIFY `src/stores/use-ui-store.ts` (`resetSession`); MODIFY
`src/components/layout/Header.tsx`, `src/components/layout/WorkspacePreloader.tsx` and `src/app/(app)/layout.tsx`
(pass `userId={data.user.id}`); DELETE `src/app/auth/sign-out/route.ts` and the empty directories; MODIFY
`src/features/auth/actions.ts` (the stale comment at the top of `signOut`).

Steps. Tests first. `cache.test.ts` (node): the semantics of
[the contract](P7S2-action-contracts.md#sign-out-purge-and-the-workspace-cache): hydrate for `user-1`, then
`bindWorkspaceCacheViewer("user-2")` makes every getter return empty and `hasWorkspaceSnapshot()` false; a snapshot for
another user is ignored once a viewer is bound; `clearWorkspaceCache` empties everything and unbinds; a hydrate with no
viewer bound adopts the snapshot's user (the `useActiveTabFolderSync.test.tsx` suite relies on this and is not edited).
`client-purge.test.ts` (`// @vitest-environment jsdom`, the real `window.localStorage`): seed `prompt-v1-a`,
`prompt-v1-a:conflict`, `prompt-b`, a persisted `prompthub-tabs-state` with two titled tabs and the settings key
`prompthub:user-settings:v1`; fill the document cache and the workspace cache; after `purgeClientState()` no key starts
with `prompt-`, the settings key remains, the persisted tab state has `tabs: []`, the in-memory tabs are empty, both
caches are empty and the UI store selection is reset; a storage whose `key` throws still clears the memory state.
Implement. `Header.handleSignOut` calls `purgeClientState()` then `await signOut()` (replacing the lone
`clearDocumentCache()`, and its comment, DR-16). `WorkspacePreloader` binds the viewer in its first effect. Delete the
route and confirm `npm run build` no longer lists `/auth/sign-out`.

Done when a search of `src` for `auth/sign-out` finds nothing, `Header.tsx` imports `purgeClientState`, and the files
edited that lacked a header have one. The sign-out flow in a browser is not unit-testable (Next navigation, Radix,
persisted stores in a real page) and belongs to Task 13.

### P7S2T10 Isolation coverage rule

Agent `qa-test-automation-engineer`, 2.5 hours, after T4 to T8. Issue #45; drift row DR-22.

Files: CREATE `src/test/action-coverage.ts` (a pure checker), `src/test/action-coverage.check.test.ts` (fixture cases)
and `src/test/action-coverage.test.ts` (the real tree); MODIFY `docs/rules/testing.md`; MODIFY the comment in
`.github/workflows/ci.yml` only if it still says which suites connect.

Steps. The checker is a function of `{ path, text }[]` so it can be tested red without editing the real tree. It
returns the names of the actions that lack an isolation test, found as: every file under `src` whose first statement is
the `"use server"` directive, each `export async function <name>` in it, and a match for `"<name>:` in a file named
`*.isolation.test.ts`. The allowlist is `signIn` and `signUp` (covered by `auth/handlers.test.ts`, checked by title) and
`signOut` (no tenant data, a redirect); `getDashboardMetrics` is not allowlisted. It also reports a `"use server"`
file that exports anything but an `async function` or a type, and `src/lib/ensure-profile.ts` if it has the directive
or lacks `import "server-only"`. Write the fixture cases first (a covered action, an uncovered one, an allowlisted
one, a bad export), show them failing against the stub, implement, then add the real-tree test and watch it pass
because Tasks 4 to 8 delivered the isolation tests. Edit `docs/rules/testing.md#rules` to require an isolation test for
every new action and to state how it is named and found, with the header `Last modified`.

Done when `npm test` without a database still runs the coverage rule (it reads files only) and the isolation suites are
reported skipped, not absent. The CI run of the Postgres-backed suites cannot happen before a pull request exists
(`ci.yml` triggers on `push` to `master` and on `pull_request`): report it as not run.

### P7S2T11 Independent security review

Agent `security-analyst`, 1.5 hours, after T9 and T10. Read-only; the report goes to the main session.

Review the final tree for: a Prisma call in a handler or service that is not scoped by `user_id` (reading the statement,
not trusting a search); a `"use server"` file exporting anything beyond the 25 actions; a handler that reads a user id
from its input; a raw query that is not a tagged template; a message that echoes Supabase or an exception; a mutation
without a limit class; a path by which `ensureProfileExists` or a service is reachable from a client import. Report
findings by severity, each with a traced path from the entry point, and list what was not reviewed. The main session
fixes what the review finds, or files an issue, before Task 12.

### P7S2T12 Sweep the documentation

Agent `documentation-manager`, 3 hours, after T11. Drift register `wip/P7S2-research-drift.md`; issue #45.

Fix every row still open when it starts, by correcting or deleting, and add a changelog line where a document keeps
one. The rows and where each lands:

| Rows | Fix |
|---|---|
| DR-1, DR-2, DR-3 | `docs/rules/project.md` (delete "Some actions do not comply yet"), `README.md` lines on isolation and "Known gaps ... #41": state what is now true |
| DR-4, DR-5, DR-21 | `.claude/agents/senior-backend-engineer.md` and `qa-test-automation-engineer.md`, and the `.gemini/agents` copies: the handler and `runAction` order of checks, every mutation limited, no mocked repository modules |
| DR-6, DR-7 | confirm after Task 1 (the helper keeps its name and file); `project.md` Layout lists `lib/` contents |
| DR-8 to DR-15 | `docs/project/PromptHub_05_TECH_01.md` and `PromptHub_01_MVP_01.md`: triggers, RLS, folder and prompt signatures, Zod, `revalidatePath`, auth actions, middleware |
| DR-16, DR-17, DR-18, DR-19, DR-20 | confirm they were fixed in Tasks 5, 6, 7 and 9 |
| DR-22 | README Testing section: the Postgres-backed suites now include the isolation suites; the `ci.yml` comment |
| DR-24 | drop the moved line numbers in the P7S1 working documents, or file a `type: docs` issue |
| DR-25 | `docs/rules/project.md` Stack row (no route handler) and `.serena/memories/project_overview.md:23`, which the register missed |
| DR-23 | the developer's, in #46; leave it |
| DR-26 | outside the area: file a `type: docs` issue |

Also confirm every new file has its header and that `CLAUDE.md`'s and `project.md`'s statements about tenancy, rate
limits and the `server-only` package are true. Record a closing note against each register row, as P7S1 did. Search the
repository for the old terms (`ensureProfileExists(userId`, `removeFolderFromCache`, `searchPrompts`, `auth/sign-out`)
before reporting.

### P7S2T13 Developer checks

Developer (`type: dev-review`), no agent. Issue #46 and a new issue filed at INITIAL for the browser list.

First, #46: confirm that each credential removed by the 08/07/2026 review (the Archon login and the test user) was
rotated or is dead, and update the F3 row of `docs/review/platform-technical-review-20260708.md` (DR-23). Second, the
browser checks, on the Docker stack (`docker compose up --build -d`, then sign up two throwaway users; the stack serves
the production build, so rebuild after every change): sign up and sign in with a wrong password (the message is the
fixed one); create a folder, a subfolder and a document; rename and delete each; delete a folder whose sub-folder holds
an open document and confirm that tab closes; create 31 folders quickly and see "Too many requests"; assign a tag; open
History and restore; edit the profile name; sign out as user A and sign in as user B in the same tab and confirm that
no folder name of A appears, that `localStorage` holds no `prompt-` key and that `prompthub-tabs-state` holds no tab;
confirm `POST /auth/sign-out` returns 404; run `npm run build` and count the action ids
([Level 3](../P7S2-server-side-security-hardening.md#level-3-build-and-browser)). Third, decide Q8 (composite foreign
keys) and the follow-up issues the PRP lists.
