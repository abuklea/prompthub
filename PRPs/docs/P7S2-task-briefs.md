# PromptHub
## P7S2 Task Briefs

| `Title` | `Created` | `Last modified` |
|---------|-----------|-----------------|
| P7S2 Task Briefs | 27/10/2026 00:40 GMT+10 | 27/10/2026 00:40 GMT+10 |

## Table of Contents
- [Purpose](#purpose)
- [Briefs](#briefs)
  - [P7S2T1 Add the action runner, its dependencies and the test seam](#p7s2t1-add-the-action-runner-its-dependencies-and-the-test-seam)
  - [P7S2T2 Make ensureProfileExists a race-free server-only helper](#p7s2t2-make-ensureprofileexists-a-race-free-server-only-helper)
  - [P7S2T3 Validate the auth actions and delete the sign-out route](#p7s2t3-validate-the-auth-actions-and-delete-the-sign-out-route)
  - [P7S2T4 Move the folder actions onto the runner with ownership checks](#p7s2t4-move-the-folder-actions-onto-the-runner-with-ownership-checks)
  - [P7S2T5 Update the folder components for ActionResult and nested deletes](#p7s2t5-update-the-folder-components-for-actionresult-and-nested-deletes)
  - [P7S2T6 Split the prompt actions and harden prompt CRUD and search](#p7s2t6-split-the-prompt-actions-and-harden-prompt-crud-and-search)
  - [P7S2T7 Move tags, history and the editor actions onto the runner](#p7s2t7-move-tags-history-and-the-editor-actions-onto-the-runner)
  - [P7S2T8 Move the profile, workspace and dashboard actions onto the runner](#p7s2t8-move-the-profile-workspace-and-dashboard-actions-onto-the-runner)
  - [P7S2T9 Purge client state on sign-out and bind the workspace cache](#p7s2t9-purge-client-state-on-sign-out-and-bind-the-workspace-cache)
  - [P7S2T10 Enforce the isolation rule with an inventory test](#p7s2t10-enforce-the-isolation-rule-with-an-inventory-test)
  - [P7S2T11 Sweep the documentation and reconcile the wip files](#p7s2t11-sweep-the-documentation-and-reconcile-the-wip-files)

## Purpose

The per-task detail for [the PRP](../P7S2-server-side-security-hardening.md). Interfaces, the action table, messages and
budgets are in [the action contract](P7S2-action-contract.md) and are not repeated. The findings (F-1 to F-9) and
gotchas are in [the research notes](../../wip/P7S2-research-notes.md#findings), and the drift rows (DR-1 to DR-26) in
[the drift register](../../wip/P7S2-research-drift.md#register). An agent given one task reads its brief, the contract,
and the source the brief cites, and checks every cited path and line against the code first. Agents never commit,
push, branch or touch issues ([Never](../../.claude/AGENT-CONTRACT.md#never)); the main session reviews each diff, runs
every gate and commits with `Refs #NN`. A step that names a red test is finished only when that test has been run and
shown failing for the stated reason. Every file a task edits gains a source header if it has none (F-9), and a
changelog line if it has one.

## Briefs

### P7S2T1 Add the action runner, its dependencies and the test seam

Agent `senior-backend-engineer`, 3 hours, after nothing. Covers Q1 and Q5.

1. Add `server-only` (0.0.1, the version on npm on 27/10/2026) as a dependency with `npm install server-only@0.0.1`,
   and in `vitest.config.ts` add the alias `'server-only'` to `./node_modules/server-only/empty.js`, the file Next
   selects on server layers (`node_modules/next/dist/build/create-compiler-aliases.js:135`). Never set a global
   `react-server` condition: the jsdom suites would break.
2. Red: `src/lib/action-runner.test.ts` (node, no database) covering each step of
   [the runner](P7S2-action-contract.md#the-runner): invalid input returns `invalid` or `INVALID_INPUT` and never calls
   `getUser`; no user returns `UNAUTHORIZED` and never calls `run`; a refused limit returns `RATE_LIMITED` and never
   calls `run`; a read with no `limit` never calls `allow`; success revalidates only when declared and only on success;
   a thrown error returns `failure`; a redirect error (`redirect("/x")` from `next/navigation`, caught) and a not-found
   error are rethrown. The `db` passed to `run` is an opaque object the test checks by identity. It fails because the
   module does not exist.
3. Green: `src/lib/action-runner.ts`, `src/lib/action-deps.ts`, the autosave limiter in `src/lib/rate-limit.ts` (with a
   test in `src/lib/rate-limit.test.ts` that the autosave bucket allows 120 and refuses the 121st within a window,
   added before the code), `src/test/action-deps.ts`, and the `createTestFolder` and `createTestTag` factories and
   table checks in `src/test/db.ts` with tests in `src/test/db.test.ts` (database-backed, so they skip without
   `TEST_DATABASE_URL`).
4. Add `import "server-only"` to `src/features/editor/service.ts` and run `npm run build` with the placeholder
   environment: it must pass, which proves a guarded module imported by an action that a client component imports does
   not reach the client bundle. Then append the coverage scope ([Coverage Scope](P7S2-action-contract.md#coverage-scope)).

Done when every gate passes and the runner reaches 80% on all four coverage measures.

### P7S2T2 Make ensureProfileExists a race-free server-only helper

Agent `senior-backend-engineer`, 1.5 hours, after T1. Covers #40 and F-3; fixes DR-6.

1. Red: `src/lib/ensure-profile.test.ts` (database-backed): one call creates the row; a second call changes nothing
   (`created_at` and `display_name` read back equal); 50 concurrent calls for one new id all resolve and leave one
   row. Against the current code the concurrent case raises `P2002` (research: 205 to 210 of 240 calls failed).
2. Green: rewrite `src/lib/ensure-profile.ts` without `"use server"`, with `import "server-only"`, a header, and
   `ensureProfileExists(db, userId)` doing `db.profile.upsert({ where: { id }, create: { id }, update: { id } })`. The
   `update: { id }` is required: Prisma 6.19 turns an empty `update` into SELECT then INSERT, which races. Say so in a
   `Reason:` comment.
3. Update the four call sites to pass `db` (`src/features/auth/actions.ts:15`, `folders/actions.ts:35`,
   `profile/actions.ts:15,41`, `prompts/actions.ts:116`). Later tasks move them into services.

Done when the test passes, `grep -rn '"use server"' src/lib` finds nothing, and every gate passes.

### P7S2T3 Validate the auth actions and delete the sign-out route

Agent `senior-backend-engineer`, 2.5 hours, after T2. Covers #42, F-4, Q6; fixes DR-25 and the `signOut` half of DR-16.

1. Red: `src/features/auth/handlers.test.ts` (node, no database) drives `signIn` and `signUp` from
   [Auth Handlers](P7S2-action-contract.md#auth-handlers) with a recording fake `auth` and a real limiter from
   `createRateLimiter`. Cases: extra fields (`options`, `confirmPassword`, `data`) never reach the fake, which receives
   exactly `{ email, password }`; an invalid email or a short password returns the fixed message and calls nothing;
   each Supabase error maps to its fixed message and never echoes `error.message`; a thrown error returns the
   unexpected message; the sixth call from one IP within a minute is refused before the fake is called;
   `ensureProfile` runs with the returned id and its failure does not fail the sign-in; success revalidates `/` as a
   layout and returns `{ redirectTo: "/dashboard" }`.
2. Green: `src/features/auth/handlers.ts`, `authDeps()` in `src/lib/action-deps.ts`, and `src/features/auth/actions.ts`
   reduced to the two wrappers and `signOut`, whose comment at `:80` is corrected (the Header purges first; T9).
   `AuthForm.tsx` is unchanged.
3. Delete `src/app/auth/sign-out/route.ts` (`grep -rn "auth/sign-out" src` finds no caller) and change
   `docs/rules/project.md:76` to say there is no route handler.

Done when the tests pass and every gate passes; the build output lists no `/auth/sign-out` route.

### P7S2T4 Move the folder actions onto the runner with ownership checks

Agent `senior-backend-engineer`, 4 hours, after T2. Covers #41 (folder part), #43, F-6 (server half) and F-2 for
folders; fixes DR-17 in the action file.

1. Red: `src/features/folders/handlers.isolation.test.ts`, by [the convention](P7S2-action-contract.md#isolation-test-convention).
   For each of the five actions: user B with A's ids gets `FOLDER_NOT_FOUND` or an empty list, and A's folders read
   back unchanged; `createFolder: user B cannot create under user A's folder` writes no row. Plus the behaviour cases:
   a nested delete (A, A/B, A/B/C, with prompts in A and C) returns every folder id and both prompt ids and leaves none
   of them; deleting a missing folder returns `FOLDER_NOT_FOUND`; `"   "`, a 101-character name and a non-uuid
   `parentId` are rejected and write nothing; a name is stored trimmed; create, rename and delete each record one
   `revalidate("/")`. They fail because the handlers do not exist.
2. Green: `src/features/folders/{schemas,service,handlers}.ts` and `actions.ts` as five wrappers, per
   [the action table](P7S2-action-contract.md#action-table) and the service rules beneath it. `deleteFolder` runs the
   recursive CTE and the delete in one transaction. The components are not touched here: the action signatures change,
   so `npx tsc --noEmit` fails until T5. Run T4 and T5 back to back in one checkout, or T5 in the same worktree, and
   gate them together.

Done when the suite passes against Postgres, and, with T5, every gate passes.

### P7S2T5 Update the folder components for ActionResult and nested deletes

Agent `senior-frontend-engineer`, 3 hours, after T4. Covers #41 (callers), #43 (tabs) and F-6 (cache); fixes DR-17 in
the components.

1. Red: in a new `src/features/workspace/cache.test.ts` (node), `removeFolderTreeFromCache(folderIds, parentId)`
   removes the folder from its parent's list and drops every listed folder's children list and prompts, from both the
   per-folder and the by-id maps. It fails because the function does not exist.
2. Green: add the function to `src/features/workspace/cache.ts`. Then change each caller in the
   [action table](P7S2-action-contract.md#action-table) row of the folder actions to pass an object, branch on
   `result.success`, roll back its optimistic change and show `result.error` in the error toast on failure, and use
   `result.data`. On delete, close the tabs of every `promptIds` entry and call `removeFolderTreeFromCache` with
   `folderIds`. The comments at `FolderItem.tsx:96,99` and `FolderToolbar.tsx:48,51` describe every descendant.

Done when every gate passes. The browser flows (create, rename, delete a nested folder with a tab open from its
sub-folder, and a forced failure) are listed in the INITIAL report's dev-review issue; agents report them as not run.

### P7S2T6 Split the prompt actions and harden prompt CRUD and search

Agent `senior-backend-engineer`, 4 hours, after T2. Covers #41 (prompt part), #51 (split, CRUD and search seams, the
`tags: []` field) and F-2 for prompts; fixes DR-18, DR-19.

1. Red: `src/features/prompts/handlers.isolation.test.ts` for `getPromptsByFolder` (with and without a query: B gets an
   empty list for A's folder), `createPrompt` (B into A's folder: `FOLDER_NOT_FOUND`, no row), `getPromptDetails`,
   `renamePrompt`, `deletePrompt` (B: not found, A's row unchanged) and `validatePrompts` (B's call with A's ids returns
   no ids). Behaviour cases: a rename to `"[Untitled Doc 2]"`, to `"  "` and to 201 characters is refused; a
   `validatePrompts` call with 201 ids is refused; `getPromptDetails` returns no `tags` key; a search for a word in A's
   content returns A's prompt to A only; a mutation over the limit returns `RATE_LIMITED` (one test, with
   `testDeps(..., { allow: () => false })`).
2. Green: `src/features/prompts/service.ts`, `search-service.ts` (the raw query moves unchanged), the CRUD specs in a
   new `handlers.ts`, and the six wrappers in `actions.ts`. `searchPrompts` is no longer exported. The tag and history
   actions stay as they are in `actions.ts` until T7. Update the callers in the action table (`PromptList.tsx:77`,
   `DocumentToolbar.tsx:164,188`, `DocumentTab.tsx:137`, `use-tab-cleanup.ts:60`).

Done when the suite passes against Postgres, every gate passes, and `actions.ts` is under 600 lines.

### P7S2T7 Move tags, history and the editor actions onto the runner

Agent `senior-backend-engineer`, 3.5 hours, after T6. Covers #41 (the `assignTagsToPrompt` write), #51 (tags and
history seams, the one redirect helper), Q3 for the remaining mutations; fixes DR-20.

1. Red: `src/features/prompts/tags.isolation.test.ts` for `getTags` (B sees none of A's tags, with and without A's
   `folderId`), `createTag` (B creating A's tag name gets B's own tag, A's untouched), `assignTagsToPrompt` (B on A's
   prompt: not found and A's tags unchanged; A assigning one of B's tags: `One or more tags are invalid`),
   `getPromptVersionHistory` and `restorePromptVersion`; and `src/features/editor/handlers.isolation.test.ts` for
   `saveNewVersion` and `autoSavePrompt`. Plus: `autoSavePrompt` charges `autosave`, never `mutation` (an `allow` that
   refuses only `mutation` lets it through), and `saveNewVersion` with a placeholder title returns
   `Please provide a valid title for your document`.
2. Green: `src/features/prompts/tag-service.ts`, the remaining specs in `prompts/handlers.ts`,
   `src/features/editor/handlers.ts`, and both `actions.ts` files reduced to wrappers. No `NEXT_REDIRECT` string is
   left in `src` outside `src/lib/action-runner.ts`. Delete the `eslint-disable max-lines` line and the
   `src/features/prompts/actions.ts` row of `docs/rules/code-size-register.md`.

Done when the suites pass against Postgres, every gate passes, and the size audit shows no RED source file.

### P7S2T8 Move the profile, workspace and dashboard actions onto the runner

Agent `senior-backend-engineer`, 3 hours, after T2. Covers Q4 for the remaining actions; fixes DR-12 for them.

1. Red: `handlers.isolation.test.ts` in `src/features/profile`, `workspace` and `dashboard`. B's
   `getProfileDetails` and `updateDisplayName` read and write only B's profile; B's `getWorkspaceSnapshot` holds none of
   A's folders or prompts and `userId` is B's; B's `getDashboardMetrics` counts none of A's rows. Plus: a 51-character
   display name is refused; `"  "` is stored as null.
2. Green: services, handlers and wrappers per the action table; `DashboardMetrics` moves to
   `src/features/dashboard/types.ts`. Update `profile/page.tsx:22,41` (show `result.error` in the toast),
   `WorkspacePreloader.tsx:27` (hydrate only on success) and `dashboard/page.tsx:22` (on failure render a short
   "Could not load the dashboard" message instead of the cards).

Done when the suites pass against Postgres and every gate passes.

### P7S2T9 Purge client state on sign-out and bind the workspace cache

Agent `senior-frontend-engineer`, 3 hours, after T5 and T8 (both edit files this task touches). Covers #44, F-8, Q7;
fixes the rest of DR-16.

1. Red, in `src/features/workspace/cache.test.ts`: after `hydrateWorkspaceCache` for A, `bindWorkspaceCacheUser(B)`
   makes every getter return an empty list or undefined and `hasWorkspaceSnapshot()` false; binding A again does not
   clear A's data; an upsert of a folder or prompt whose `user_id` is not the bound user is ignored;
   `clearWorkspaceCache()` empties everything including the user. In a new jsdom
   `src/features/auth/sign-out-purge.test.ts`: `purgeClientState(window.localStorage)` removes every key starting
   `prompt-` (`prompt-<id>`, `prompt-v1-<id>`, `prompt-v1-<id>:conflict`) and `prompthub-tabs-state`, keeps
   `prompthub:user-settings:v1` and unrelated keys, empties the document and workspace caches, leaves the tab store with
   no tabs; a storage whose every call throws does not make it throw.
2. Green: `bindWorkspaceCacheUser`, `clearWorkspaceCache` and the upsert checks in `cache.ts`; `resetTabs()` in
   `src/stores/use-tab-store.ts` (sets the initial `tabs`, `activeTabId` and `layout`); `sign-out-purge.ts`, which
   collects the keys first and then removes them (removal shifts `key(i)`), then calls `resetTabs()` and
   `useTabStore.persist.clearStorage()`. The `(app)` layout passes `userId={data.user.id}` to `WorkspacePreloader`,
   which binds before it preloads; `Header.handleSignOut` calls `purgeClientState` before `signOut()` and its comment
   at `:37` says what is purged.

The existing `useActiveTabFolderSync.test.tsx` must pass unedited: it hydrates and never binds, so a bound user of ""
must not hide hydrated data. Done when every gate passes; the sign-out flow between two users joins the dev-review
issue.

### P7S2T10 Enforce the isolation rule with an inventory test

Agent `qa-test-automation-engineer`, 2 hours, after T3 to T9. Covers #45.

1. Write `src/test/action-inventory.test.ts` per [the convention](P7S2-action-contract.md#isolation-test-convention).
   Show it red first by running it on a scratch copy with one isolation test renamed, and record the output; restore.
2. Add the rule to `docs/rules/testing.md#rules`: every server action is a wrapper over a handler, and every tenant
   action has a cross-user test in its feature's `*.isolation.test.ts`, which the inventory test enforces. Add the
   handler layer and the runner to `docs/rules/project.md#files-and-documents`.
3. Confirm `.github/workflows/ci.yml` needs no change (the isolation suites use `TEST_DATABASE_URL`, already set), and
   record per-file coverage for the scope with the database set.

Done when the inventory test passes, every gate passes, and coverage is recorded.

### P7S2T11 Sweep the documentation and reconcile the wip files

Agent `documentation-manager`, 3 hours, after T10. Fixes every open row of the drift register.

Fix DR-1 to DR-5, DR-7 to DR-15, DR-21, DR-22 and DR-24 as the register says (both copies of each agent file under
`.claude/agents/` and `.gemini/agents/`), and confirm that DR-6, DR-16 to DR-20 and DR-25 were fixed by their tasks.
DR-23 belongs to #46 and DR-26 becomes a `type: docs` issue filed by the main session. The README gains the handler
layer and the isolation suites in its Testing section. Mark both `wip/P7S2-*` files reconciled in their footers; the
main session deletes them with the REPORT.
