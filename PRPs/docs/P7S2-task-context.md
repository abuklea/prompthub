# PromptHub
## P7S2 Task Context

| `Title` | `Created` | `Last modified` |
|---------|-----------|-----------------|
| P7S2 Task Context | 29/10/2026 16:57 GMT+10 | 30/10/2026 01:13 GMT+10 |

## Table of Contents
- [Purpose](#purpose)
- [References and Gotchas](#references-and-gotchas)
- [File Plan by Task](#file-plan-by-task)
- [Current and Desired Trees](#current-and-desired-trees)
- [Callers of the Actions](#callers-of-the-actions)

## Purpose

The references and gotchas an executing agent reads first, the files each task touches, the file layout before and
after [the PRP](../complete/P7S2-server-side-security-hardening.md), and the call sites that change when an action's result or
arguments change. Every path was read on 29/10/2026 against `master` at `bff5fa6`. The validation commands are in the
PRP itself; the interfaces are in [the contracts](P7S2-action-contracts.md).

## References and Gotchas

Moved here from the PRP's All Needed Context so that the PRP stays inside its size band. Read your task's section of
[the briefs](P7S2-task-briefs.md#briefs), then this list, then the source the brief cites.

```yaml
# MUST READ
- url: https://nextjs.org/docs/14/app/building-your-application/rendering/composition-patterns
  why: "Keeping Server-only Code out of the Client Environment": npm install server-only, import it in the module
  critical: Opened 29/10/2026. A Client Component importing such a module is a build error; a type-only import is erased

- file: src/features/editor/service.ts
  why: The pattern to mirror - (db, userId, input), no "use server", one NOT_FOUND text, scoped updateMany as the check
  critical: Task 1 adds import "server-only" to it; src/features/editor/actions.ts shows the order the runner keeps

- file: src/test/db.ts
  why: describeDb, useTestDatabase, createTestUser, createTestPrompt, and the guard against a non-disposable URL
  critical: Tag has no relation to Profile, so deleting a profile leaves its tags; the guard rejects only host,
    hostaddr, port, and requires a database name that contains a lower-case "test"

- file: src/features/prompts/actions.ts
  why: 12 actions to split; line 588 unscoped write; 143-150 unchecked folder; 398 raw query
  critical: Task 6 deletes the eslint-disable max-lines comment and the register row (reportUnusedDisableDirectives
    is on)

- file: src/features/folders/actions.ts
  why: Five throwing actions with no schema; lines 79-103 the shallow prompt-id read
  critical: The three folder components rely on thrown errors; src/features/auth/actions.ts keeps signOut's body

- file: src/features/workspace/cache.ts
  why: The stored userId is never checked; removeFolderFromCache leaves descendants
  critical: useActiveTabFolderSync.test.tsx hydrates it for user-1 with nothing bound and must pass unedited

- file: prisma/schema.prisma
  why: Folder.parent (line 26) and Prompt.folder (line 45) reference Folder.id alone; Tag.user_id is a plain string
  critical: A scratch copy with the composite keys validated on 29/10/2026; the SQL is in the domain contracts

- docfile: wip/P7S2-research-drift.md
  why: 26 rows; Task 15 fixes DR-4, DR-5, DR-21 first, Task 12 the rest; docs/rules/testing.md line 43 bans module
    mocks
```

```text
# CRITICAL gotchas (verified in the code or by the 26/10/2026 research unless marked)
# - A "use server" file may export only async functions (types are erased). A non-async export fails the build, an
#   async one is a public endpoint. Helpers, deps, constants and the digest check live in plain modules.
# - Importing ANY export of an action module from a Server Component registers EVERY export of it
#   (src/app/(app)/dashboard/page.tsx imports getDashboardMetrics this way).
# - cookies() throws outside a request and Next 14.2 has no test utility for it: only action-runtime.ts calls
#   createClient(), inside getUser, never at module load. await getUser(): the Supabase server client hides cookies
#   behind synchronous-looking signatures.
# - Next control-flow errors (redirect, notFound, dynamic usage) carry a string digest (NEXT_REDIRECT;...,
#   NEXT_NOT_FOUND, DYNAMIC_SERVER_USAGE; read in node_modules/next/dist/client/components). The runner rethrows them.
# - Zod 3.25.76: .trim() BEFORE .min()/.max(); .uuid() accepts any version and upper case; a nullable parentId needs
#   .nullable(); a schema with .default() needs the three-argument ZodType for its input type.
# - server-only: Next aliases the bare import at build time, tsc does not resolve it, and under Vitest its default
#   export throws. Alias to node_modules/server-only/empty.js (named under the "react-server" export condition, from
#   npm view; the file is UNVERIFIED until installed). A global react-server condition would break the jsdom suites.
# - Prisma 6.19.0 upsert({ update: {} }) fell back to SELECT then INSERT and raced (seen 26/10/2026, undocumented), so
#   ensureProfileExists uses createMany with skipDuplicates. updateMany cannot set a relation; the scoped form is
#   update({ where: { id, user_id } }), which raises P2025 for no match.
# - Composite keys: Postgres skips a composite FK with a NULL column, so root folders and unfiled prompts stay valid
#   (verified on a local Postgres 29/10/2026). How the generated Prisma Client handles the partly nullable relation is
#   UNVERIFIED (no client was generated). Never disconnect these relations: it would null the shared user_id.
# - The migration folder prisma/migrations/20260717000001_add_case_insensitive_tag_index holds a hand-written
#   expression index, Tag_name_user_id_ci_key, that schema.prisma cannot express. createTag's P2002 recovery depends
#   on it: never commit a migration that drops it.
# - Folder.parent and Prompt.folder cascade, so deleteFolder reads the tree BEFORE the delete (domain contracts).
# - Never edit an existing test to make a change pass (testing.md). New suites go in new files.
# - Parallel worktrees share one TEST_DATABASE_URL: every suite makes its own users; the pool is capped (Task 3).
```

## File Plan by Task

Moved here from the PRP's Tasks section. The briefs hold the exact file lists; this is the overview. The order, agents
and dependencies are in [the PRP's Task List](../complete/P7S2-server-side-security-hardening.md#task-list).

```yaml
Task 15 (documentation-manager): correct the agent definitions - runs FIRST        # DR-4, DR-5, DR-21
MODIFY .claude/agents/{senior-backend-engineer,qa-test-automation-engineer}.md and the .gemini/agents copies

Task 1 (senior-backend-engineer): server-only and ensureProfileExists              # #40, Q5
MODIFY package.json, package-lock.json: npm install server-only (the only dependency change)
MODIFY vitest.config.ts: alias for server-only; coverage patterns for every later file
MODIFY src/lib/ensure-profile.ts (no directive, server-only, (db, userId), createMany)
       and src/features/editor/service.ts
MODIFY the four action files: the call sites take (db, id)
CREATE server-only-alias.test.ts, ensure-profile.test.ts

Task 2 (senior-backend-engineer): the seam and the limits                           # Q1, #48 part
CREATE src/lib/action-runner.ts, action-runtime.ts, prisma-errors.ts and their tests
MODIFY src/lib/rate-limit.ts: checkSaveRateLimit, checkAutosaveRateLimit; CREATE rate-limit.autosave.test.ts

Task 3 (qa-test-automation-engineer): test factories, fake deps, pool cap           # #45
MODIFY src/test/db.ts: createTestFolder (parentId), createTestTag, deleteTestUser, createTestPrompt (folderId),
       pool cap
CREATE src/test/action-deps.ts, racing-db.ts, db.helpers.test.ts

Task 4 [P] (senior-backend-engineer): signIn and signUp                             # #42, F-4
CREATE src/features/auth/handlers.ts, handlers.test.ts; MODIFY actions.ts (wrappers)

Task 5 [P] (backend, then senior-frontend-engineer): folders                        # #41, #43, F-2, F-6
CREATE folders/schemas.ts, handlers.ts, handlers.test.ts, handlers.isolation.test.ts; MODIFY actions.ts
MODIFY FolderItem, FolderTree, FolderToolbar; workspace/cache.ts (removeFolderTreeFromCache) + cache.tree.test.ts

Task 6 [P] (backend, then frontend): prompt CRUD and listing                        # #41, F-2, DR-18, DR-19
MODIFY prompts/schemas.ts, actions.ts; CREATE handlers.ts, search-handlers.ts and tests
DELETE the max-lines eslint-disable and the code-size register row
MODIFY PromptList, DocumentToolbar, DocumentTab, use-tab-cleanup

Task 7 (backend, then frontend): tags, history and the rest of the split            # #41, #51, DR-20; after Tasks 6, 8
CREATE tag-handlers.ts, tag-actions.ts, history-handlers.ts, history-actions.ts and four test files
MODIFY prompts/actions.ts (delete moved code); callers DocumentToolbar (tags), EditorPane (history imports)

Task 8 [P] (backend, then frontend): editor, profile, workspace, dashboard          # Q3, Q4
CREATE handlers.ts and both test files in each feature; profile/schemas.ts; MODIFY the four actions.ts
MODIFY profile/page.tsx, dashboard/page.tsx, WorkspacePreloader.tsx

Task 9 (senior-frontend-engineer): sign-out purge and the route                     # #44, Q6, Q7, F-7, F-8
MODIFY workspace/cache.ts (bindWorkspaceCacheViewer, clearWorkspaceCache); CREATE cache.test.ts
CREATE auth/client-purge.ts and client-purge.test.ts (jsdom, real localStorage)
MODIFY use-tab-store.ts (resetTabs), tabs/types.ts, use-ui-store.ts (resetSession), Header.tsx, WorkspacePreloader.tsx,
       src/app/(app)/layout.tsx (userId prop); DELETE src/app/auth/sign-out/route.ts

Task 10 (qa-test-automation-engineer): isolation coverage rule                      # #45
CREATE src/test/action-coverage.ts (pure checker) and two test files; MODIFY docs/rules/testing.md

Task 11 (security-analyst): read-only review of the final tree; findings to the main session
Task 12 (documentation-manager): the remaining drift rows, headers, register, README, rules
Task 13 (senior-backend-engineer): composite tenant keys                            # Q8
MODIFY prisma/schema.prisma; CREATE the generated migration and src/test/composite-fk.test.ts
Runs alone, on its own disposable database prompthub_test_t13, never the shared prompthub_test
Task 14 (senior-frontend-engineer): ask before signing out with unsaved work        # D10
MODIFY auth/client-purge.ts, Header.tsx; CREATE client-purge.unsaved.test.ts
Task 16 (developer, type: dev-review): #46 rotation; audit and apply the migration on Supabase; browser checks
```

## Current and Desired Trees

```text
CURRENT (relevant parts)
src/lib/            ensure-profile.ts ("use server", takes userId)  db.ts  supabase/
                    rate-limit.ts (auth + mutation limiters)
src/features/
  auth/             actions.ts  schemas.ts  components/AuthForm.tsx
  folders/          actions.ts  components/{FolderItem,FolderTree,FolderToolbar,FolderDialogs}.tsx
  prompts/          actions.ts (674 lines, RED, 12 actions)  schemas.ts  types.ts  utils.ts  components/
  editor/           actions.ts  service.ts  schemas.ts  document-cache.ts  draft.ts  hooks/  components/
  profile/          actions.ts
  workspace/        actions.ts  cache.ts
  dashboard/        actions.ts
src/app/auth/sign-out/route.ts
src/test/           db.ts  failing-db.ts  storage-fake.ts  ...
```

```text
DESIRED (+ added, - removed)
src/lib/            ensure-profile.ts (server-only, takes (db, userId))
                  + action-runner.ts   ActionDeps, ActionSpec, runAction (plain module, no next/* import)
                  + action-runtime.ts  server-only; the real getUser, db, clientIp and auth; no test imports it
                  + prisma-errors.ts   isNotFoundError (P2025)
                    rate-limit.ts      + checkSaveRateLimit, checkAutosaveRateLimit
src/features/
  auth/             actions.ts (three wrappers)  + handlers.ts  + client-purge.ts
  folders/          actions.ts (five wrappers)  + handlers.ts  + schemas.ts
  prompts/          actions.ts (six wrappers, under 300 lines)  + handlers.ts  + search-handlers.ts
                  + tag-actions.ts  + tag-handlers.ts  + history-actions.ts  + history-handlers.ts
  editor/           actions.ts (two wrappers)  + handlers.ts  service.ts (server-only added)
  profile/          actions.ts  + handlers.ts  + schemas.ts
  workspace/        actions.ts  + handlers.ts  cache.ts (+ bindWorkspaceCacheViewer, clearWorkspaceCache,
                                                         removeFolderTreeFromCache)
  dashboard/        actions.ts  + handlers.ts
- src/app/auth/sign-out/route.ts
prisma/             schema.prisma (composite keys on Folder.parent and Prompt.folder)
                  + migrations/<timestamp>_composite_tenant_keys/migration.sql  (generated, Task 13)
src/test/           db.ts (+ createTestFolder, createTestTag, deleteTestUser, withConnectionLimit)
                  + racing-db.ts  + composite-fk.test.ts
                  + action-deps.ts  + action-coverage.ts  + action-coverage.test.ts  + action-coverage.check.test.ts
                  + db.helpers.test.ts
                    beside each handlers.ts: handlers.test.ts and handlers.isolation.test.ts
```

The desired tree names no file for `searchPrompts` as an action: it moves to `search-handlers.ts` and stops being
exported from a `"use server"` module (decision D3).

## Callers of the Actions

Found by search on 29/10/2026. A row changes in the task named in the last column, in the same commit as the action.

| Caller | Actions it imports | Task |
|---|---|---|
| `src/features/auth/components/AuthForm.tsx` | `signIn`, `signUp` | T4 (expected unchanged; `tsc` decides) |
| `src/components/layout/Header.tsx` | `signOut` | T9, T14 |
| `src/hooks/use-tab-cleanup.ts` | `validatePrompts` | T6 |
| `src/features/folders/components/FolderItem.tsx` | `getFolderChildren`, `renameFolder`, `deleteFolder`, `createFolder` | T5 |
| `src/features/folders/components/FolderTree.tsx` | `getRootFolders`, `createFolder` | T5 |
| `src/features/folders/components/FolderToolbar.tsx` | `createFolder`, `renameFolder`, `deleteFolder` | T5 |
| `src/features/prompts/components/PromptList.tsx` | `getPromptsByFolder`, `createPrompt` | T6 |
| `src/features/prompts/components/DocumentToolbar.tsx` | `createPrompt`, `renamePrompt`, `deletePrompt`; `getTags`, `createTag`, `assignTagsToPrompt` | T6, T7 |
| `src/features/tabs/components/DocumentTab.tsx` | `deletePrompt` (line 137) | T6 |
| `src/features/tabs/hooks/useMigration.ts` | `getPromptDetails` | none expected (input unchanged) |
| `src/features/editor/components/EditorPane.tsx` | `getPromptDetails`, `getPromptVersionHistory`, `restorePromptVersion`; `saveNewVersion`, `autoSavePrompt` | T7 (import paths) |
| `src/app/(app)/profile/page.tsx` | `getProfileDetails`, `updateDisplayName` | T8 |
| `src/components/layout/WorkspacePreloader.tsx` | `getWorkspaceSnapshot` | T8, T9 |
| `src/app/(app)/dashboard/page.tsx` | `getDashboardMetrics` (a Server Component) | T8 (renders zeros on a failed result) |

`src/features/editor/document-actions.ts` and `src/test/editor-env.ts` name the editor actions through an injected
interface (`DocumentActions`), and `document-actions.test.ts` drives it with fakes; none of the three imports an
`actions.ts` file, and the three are not edited. The input of `getPromptDetails`, `createPrompt`, `getTags`,
`createTag`, `assignTagsToPrompt`, `getPromptVersionHistory`, `restorePromptVersion`, `saveNewVersion` and
`autoSavePrompt` stays `data: unknown`, so only their result handling can change.
