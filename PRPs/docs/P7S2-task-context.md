# PromptHub
## P7S2 Task Context

| `Title` | `Created` | `Last modified` |
|---------|-----------|-----------------|
| P7S2 Task Context | 29/10/2026 16:57 GMT+10 | 29/10/2026 17:01 GMT+10 |

## Table of Contents
- [Purpose](#purpose)
- [Current and Desired Trees](#current-and-desired-trees)
- [Callers of the Actions](#callers-of-the-actions)

## Purpose

The file layout before and after [the PRP](../P7S2-server-side-security-hardening.md), and the call sites that change
when an action's result or arguments change. Every path was read on 29/10/2026 against `master` at `bff5fa6`. The
references, gotchas and validation commands are in the PRP itself; the interfaces are in
[the contracts](P7S2-action-contracts.md).

## Current and Desired Trees

```text
CURRENT (relevant parts)
src/lib/            ensure-profile.ts ("use server", takes userId)  rate-limit.ts (auth + mutation limiters)  db.ts  supabase/
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
                    rate-limit.ts      + checkAutosaveRateLimit
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
src/test/           db.ts (+ createTestFolder, createTestTag, deleteTestUser)
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
| `src/components/layout/Header.tsx` | `signOut` | T9 |
| `src/hooks/use-tab-cleanup.ts` | `validatePrompts` | T6 |
| `src/features/folders/components/FolderItem.tsx` | `getFolderChildren`, `renameFolder`, `deleteFolder`, `createFolder` | T5 |
| `src/features/folders/components/FolderTree.tsx` | `getRootFolders`, `createFolder` | T5 |
| `src/features/folders/components/FolderToolbar.tsx` | `createFolder`, `renameFolder`, `deleteFolder` | T5 |
| `src/features/prompts/components/PromptList.tsx` | `getPromptsByFolder`, `createPrompt` | T6 |
| `src/features/prompts/components/DocumentToolbar.tsx` | `createPrompt`, `renamePrompt`, `deletePrompt`; `getTags`, `createTag`, `assignTagsToPrompt` | T6, T7 |
| `src/features/tabs/components/DocumentTab.tsx` | `deletePrompt` (line 137) | T6 |
| `src/features/tabs/hooks/useMigration.ts` | `getPromptDetails` | none expected (input unchanged) |
| `src/features/editor/components/EditorPane.tsx` | `getPromptDetails`, `getPromptVersionHistory`, `restorePromptVersion`; `saveNewVersion`, `autoSavePrompt` | T7 (import paths), T8 |
| `src/app/(app)/profile/page.tsx` | `getProfileDetails`, `updateDisplayName` | T8 |
| `src/components/layout/WorkspacePreloader.tsx` | `getWorkspaceSnapshot` | T8, T9 |
| `src/app/(app)/dashboard/page.tsx` | `getDashboardMetrics` (a Server Component) | none (shape kept) |

`src/features/editor/document-actions.ts` and `src/test/editor-env.ts` name the editor actions through an injected
interface (`DocumentActions`), and `document-actions.test.ts` drives it with fakes; none of the three imports an
`actions.ts` file, and the three are not edited. The input of `getPromptDetails`, `createPrompt`, `getTags`,
`createTag`, `assignTagsToPrompt`, `getPromptVersionHistory`, `restorePromptVersion`, `saveNewVersion` and `autoSavePrompt` stays
`data: unknown`, so only their result handling can change.
