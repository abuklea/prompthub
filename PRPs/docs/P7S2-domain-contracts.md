# PromptHub
## P7S2 Domain Contracts

| `Title` | `Created` | `Last modified` |
|---------|-----------|-----------------|
| P7S2 Domain Contracts | 29/10/2026 17:53 GMT+10 | 29/10/2026 18:27 GMT+10 |

## Table of Contents
- [Purpose](#purpose)
- [Folders](#folders)
- [ensureProfileExists](#ensureprofileexists)
- [Auth](#auth)
- [Prompts, Tags and History](#prompts-tags-and-history)
- [Sign-out Purge and the Workspace Cache](#sign-out-purge-and-the-workspace-cache)
- [Composite Tenant Keys](#composite-tenant-keys)
- [Test Conventions](#test-conventions)

## Purpose

The per-area rules for [the PRP](../P7S2-server-side-security-hardening.md), second half. The seam, the action matrix,
the messages and the schemas are in [the action contracts](P7S2-action-contracts.md). Sketches write `userId` for the
handler's `user.id`. Every path was read on 29/10/2026 against `master` at `bff5fa6`.

## Folders

`src/features/folders/handlers.ts` holds `getRootFolders`, `createFolder`, `renameFolder`, `deleteFolder` and
`getFolderChildren`, each `runAction(deps, spec, data)` with the messages of
[the matrix](P7S2-action-contracts.md#action-matrix) and the not-found text "Folder not found or access denied" for a
missing and a foreign id alike.

`createFolder` verifies the parent inside the transaction that creates the folder. The check is sufficient without a
lock because `user_id` of a folder is never updated by any action, so ownership cannot change between the read and the
insert; a parent deleted in between raises a foreign-key error, which the runner turns into the generic failure.

```text
createFolder.run: db.$transaction(tx =>
  if parentId !== null:
    parent = tx.folder.findFirst({ where: { id: parentId, user_id: userId }, select: { id } })
    if !parent: return NOT_FOUND                       // nothing written
  folder = tx.folder.create({ data: { name, user_id: userId, parent_id: parentId } })
  return { success: true, data: folder })
```

`renameFolder` is one `db.folder.update({ where: { id: folderId, user_id: userId }, data: { name } })`; Prisma raises
`P2025` when no row matches, and the handler maps that code to NOT_FOUND (the test is whether the error is a
`Prisma.PrismaClientKnownRequestError` with `code === "P2025"`; a helper in `src/lib/prisma-errors.ts` serves the
folder and tag handlers). The existing code already uses the `{ id, user_id }` unique-where form for `update`.

`deleteFolder` returns every folder id and every prompt id the cascade removes, which is what issue #43 asks for and
what the client needs to purge its caches (finding F-6). Both statements run in one transaction:

```sql
-- tagged $queryRaw, parameterised; table names are Prisma's (no @@map), as in the existing search query
WITH RECURSIVE tree AS (
  SELECT id FROM "Folder" WHERE id = ${folderId} AND user_id = ${userId}
  UNION   -- not UNION ALL: it terminates even if corrupt data holds a cycle
  SELECT f.id FROM "Folder" f JOIN tree t ON f.parent_id = t.id WHERE f.user_id = ${userId}
)
SELECT 'folder' AS kind, id FROM tree
UNION ALL
SELECT 'prompt' AS kind, p.id FROM "Prompt" p WHERE p.folder_id IN (SELECT id FROM tree) AND p.user_id = ${userId}
```

```text
deleteFolder.run: db.$transaction(tx =>
  rows = tx.$queryRaw(above)
  if rows has no 'folder' row: return NOT_FOUND         // missing or foreign: indistinguishable
  deleted = tx.folder.deleteMany({ where: { id: folderId, user_id: userId } })   // cascades to children and prompts
  if deleted.count === 0: return NOT_FOUND
  return { success: true, data: { folderIds, promptIds } })
```

Limitations, stated rather than hidden. A prompt another session of the same user creates in a descendant folder
between the two statements is cascade-deleted without being in `promptIds`, so a tab for it would stay open; only a
second session of the same user can cause it, and no lock is taken. The depth of a folder tree is unbounded on the
server (the tree UI stops at depth 5, `FolderItem.tsx` `MAX_DEPTH`); the recursion is bounded by the user's own rows.
A per-user folder count cap is not in this PRP (finding F-1, filed separately).

`getFolderChildren` for a parent the user does not own returns `{ success: true, data: [] }`, the same as an owned
parent with no children, so the action is not an oracle for folder ids.

The optimistic folders the UI creates carry ids such as `temp-<timestamp>`. An action on one before the server answers
now fails Zod ("Invalid folder ID") instead of failing at the database. The PRP accepts that and adds no guard: the
callers' existing rollback and error toast handle it. After a delete the callers clear exactly the workspace cache
(`foldersByParent`, `rootFolders`, `promptsByFolder`, `promptsById`) for the returned ids and close the tabs of the
returned prompt ids. They leave the document cache alone (its entries for deleted prompts are unreachable and are
emptied at sign-out) and `expandedFolders` (a stale id is harmless).

## ensureProfileExists

`src/lib/ensure-profile.ts` loses `"use server"` and gains `import "server-only"`. It takes the client as an argument,
like the editor service, so a test can run it against the disposable database:

```typescript
export type ProfileDb = Pick<PrismaClient, "profile">

export async function ensureProfileExists(db: ProfileDb, userId: string): Promise<void> {
  // Reason: createMany with skipDuplicates sends INSERT ... ON CONFLICT DO NOTHING: it cannot raise P2002 and writes
  // nothing for an existing profile. upsert({ update: {} }) fell back to SELECT then INSERT and raced in 205 to 210 of
  // 240 concurrent first calls (observed 26/10/2026, not in the Prisma documentation); createMany passed all 240.
  await db.profile.createMany({ data: [{ id: userId }], skipDuplicates: true })
}
```

The function keeps taking the id from its caller. When email confirmation is on, `signUp` returns a user and no session,
so a helper that read the user from `getUser()` would find nobody (`src/features/auth/actions.ts:39-41`). Callers after
the PRP: `runAction` (`ensureProfile: true`) and the auth handlers. Issue #40's acceptance says `upsert`; the developer
chose `createMany` with `skipDuplicates` on 29/10/2026 because the `upsert` form rests on undocumented Prisma behaviour,
and the completion comment on #40 states the deviation. `createMany` returns a count and no row, which is all the
callers need.

## Auth

`src/features/auth/handlers.ts` holds `signUp` and `signIn`. They cannot use `runAction` (there is no user yet), so
they have their own deps. The `AuthDeps` interface lives in `src/lib/action-runner.ts` beside `ActionDeps`, because a
handler never imports `action-runtime.ts`; the real value is exported from `action-runtime.ts` as `authDeps` beside
`actionDeps`:

```typescript
export interface AuthDeps {
  db: PrismaClient
  /** The first x-forwarded-for value or "unknown". Real: headers().get(...) in action-runtime.ts. */
  clientIp: () => string
  /** Built per call, because createClient() reads the request's cookies. */
  auth: () => Pick<SupabaseClient["auth"], "signInWithPassword" | "signUp">
}
```

`clientIp` takes the first `x-forwarded-for` value, as `signUp` and `signIn` do today
(`src/features/auth/actions.ts:25,53`). On the Docker stack `docker/gateway/nginx.conf` sets the header with
`$proxy_add_x_forwarded_for`, which appends the real address to whatever the client sent, so the first value is the
client's own claim and a client can pick its limiter bucket there. How the production host sets the header is
unverified here. This is out of scope for P7S2 and is tracked under #48, with the shared limiter store.

Flow: parse with `SignInSchema` or `SignUpSchema` (a failure returns the fixed text "Check your email and password and
try again."), limit by IP with `checkAuthRateLimit`, call Supabase with exactly `{ email, password }` (never the parsed
object or the raw input, so `confirmPassword` and any `options` a direct POST adds never reach Supabase), then
`ensureProfileExists` for the returned user, logged and ignored on failure as today. Supabase's `error.message` and any
thrown message are no longer returned. The fixed messages:

| Case | Message |
|---|---|
| Invalid input | "Check your email and password and try again." |
| Over the IP limit | "Too many attempts. Please try again later." (unchanged) |
| `signIn` rejected, `error.code` of `email_not_confirmed` | "Confirm your email address before signing in." |
| `signIn` rejected, any other error | "Invalid email or password." |
| `signUp` rejected, `error.code` of `weak_password` | "Choose a stronger password." |
| `signUp` rejected, any other error | "Could not create the account." |
| Any thrown error | "Something went wrong. Please try again." |

`AuthError.code` is typed `ErrorCode | string | undefined` in the installed `@supabase/auth-js` 2.64.2 and its
`ErrorCode` union contains `email_not_confirmed`, `weak_password`, `user_already_exists` and `email_exists`. Whether the
cloud project's GoTrue sends a `code` for these cases is not verified: with no code, every rejection takes the generic
message, which is safe and less helpful. The Docker stack check in the browser list confirms the two special cases.
`signOut` stays in the wrapper file (it calls `redirect`, and a handler must not): it reads the session, signs out,
revalidates and redirects, as now.

## Prompts, Tags and History

`src/features/prompts/handlers.ts` (create, details, rename, delete, validate, list by folder),
`search-handlers.ts` (the full-text query, not an action), `tag-handlers.ts`, and `history-handlers.ts` (thin: parse,
authenticate, delegate to `listVersions` and `restoreVersion` of `@/features/editor/service`). The editor's actions get
`src/features/editor/handlers.ts` (`saveNewVersion` and `autoSavePrompt` delegating to `saveVersion` and
`autoSaveDocument`). The wrapper files are the split of issue #51: `actions.ts` (the six CRUD and listing actions),
`tag-actions.ts`, `history-actions.ts`, and the editor's own.

`createPrompt` checks the folder in the same transaction as the create, closing finding F-2 for prompts. The existing
duplicate-title check moves into the transaction unchanged (it is not atomic with the insert and there is no unique
index; that is out of scope):

```text
createPrompt.run: db.$transaction(tx =>
  folder = tx.folder.findFirst({ where: { id: folderId, user_id: userId }, select: { id } })
  if !folder: return { success: false, error: "Folder not found or access denied" }
  if title: duplicate check as today -> the existing "already exists" message
  prompt = tx.prompt.create({ data: { user_id: userId, folder_id: folderId, title: title ?? null, content: "" } })
  return { success: true, data: { ...prompt, tags: [] } })   // tags: [] stays: the list item type has it
```

`renamePrompt` keeps its two reads and the single scoped `updateMany`; only the input is now parsed. `deletePrompt` and
`validatePrompts` change only by the schema. `getPromptDetails` drops the `tags: []` field: nothing reads it
(`EditorPane` and `useMigration` use the row and its folder; searched on 29/10/2026), and issue #51 allows dropping it.

`assignTagsToPrompt` keeps the ownership reads (prompt, then `count` of the user's tags equals the unique ids) and
replaces the unscoped write at `src/features/prompts/actions.ts:588` with
`tx.prompt.update({ where: { id: promptId, user_id: userId }, data: { tags: { set } } })`, with the reads and the write
in one transaction. `updateMany` cannot be used because it does not accept a relation `set`; the `{ id, user_id }`
unique-where form of `update` scopes the write and raises `P2025` for a row that stopped being the user's, mapped to
"Prompt not found or access denied".

`getPromptsByFolder` calls the search handler's function when `query` is non-blank and otherwise lists with the same
`user_id` and `folder_id` filter as today. A foreign or unknown folder gives `[]`. The raw query in `search-handlers.ts`
is already a tagged template scoped by `user_id`; it moves unchanged.

## Sign-out Purge and the Workspace Cache

Sign-out today calls `clearDocumentCache()` only (`src/components/layout/Header.tsx:38-42`). The purge is one client
function, `purgeClientState` in `src/features/auth/client-purge.ts`, called by `handleSignOut` before `signOut()`:

```typescript
export interface PurgeStorage {
  readonly length: number
  key(index: number): string | null
  removeItem(key: string): void
}
// With the hyphen: prompthub-tabs-state and prompthub:user-settings:v1 also start with "prompt".
export const DRAFT_KEY_PREFIX = "prompt-"
export function purgeClientState(storage: PurgeStorage | null = browserStorage()): void
```

It does five things, each independent of the others failing: `clearDocumentCache()`; `clearWorkspaceCache()`; remove
every storage key that starts with `prompt-` (the draft `prompt-v1-<id>`, its stash `prompt-v1-<id>:conflict` and the
legacy `prompt-<id>`; collect the keys first, then remove, because removal shifts `key(index)`); `resetTabs()` on the
tab store (Q7); and `resetSession()` on the UI store. A blocked or throwing storage skips only the key removal. The tab
store persists `tabs` and `activeTabId` under `prompthub-tabs-state`, so `resetTabs()` leaves Zustand's envelope
`{"state":{"tabs":[],"activeTabId":null},"version":0}` on disk (it also resets `layout` and drops pinned tabs), which
removes the previous user's document titles. Two new store actions are needed: `resetTabs` on
`src/stores/use-tab-store.ts` (and `TabState` in `src/features/tabs/types.ts`) and `resetSession` on
`src/stores/use-ui-store.ts`. `resetSession` is a judgement beyond the issue text (D8): the UI store holds the previous
user's selection and `prompts` (with content) in memory, and `router.replace` does not reload the page. It sets
`expandedFolders` to an empty set, `selectedFolder` and `selectedPrompt` to null, `prompts` to `[]`, `folderFilter` and
`docFilter` to `""`, `selectedTagIds` to `[]` and `workspaceLoadedAt` to null; sort orders and refetch counters stay.

The workspace cache (`src/features/workspace/cache.ts`) stores the snapshot's `userId` and never checks it. Issue #44
asks that its getters return nothing for a different user id. Decision D5 (developer, 29/10/2026) does that with a
bound viewer rather than a parameter on every getter, because the getters have five call sites and a test
(`useActiveTabFolderSync.test.tsx`) that the PRP must not edit:

```text
viewer = ""                                   // module state; "" means no user bound yet
clearWorkspaceCache():            empty every map; viewer = ""
bindWorkspaceCacheViewer(userId): if viewer !== userId: empty every map; viewer = userId
hydrateWorkspaceCache(snapshot):  if viewer === "": viewer = snapshot.userId   // fresh module or after a purge: empty
                                  if snapshot.userId !== viewer: return         // a late snapshot of another user
                                  otherwise as today
```

Every getter and writer then reads and writes only what belongs to the bound viewer, because binding another viewer
empties the maps first. `WorkspacePreloader` receives `userId` from `src/app/(app)/layout.tsx` (a Server Component that
already holds `data.user`) and binds in its first effect, unconditionally and before it reads the preload setting
(`preloadWorkspaceOnLaunch` in `prompthub:user-settings:v1` can turn the preload off, and the bind must not depend on
it). It is rendered before the panels, so its effect runs before theirs (effects run in tree order, an earlier
sibling's subtree first); if that order ever changed, the failure is a brief display of the previous user's folder
names until the fetch replaces them, not a lasting leak. This path matters when a session expires and the next user
signs in without the purge having run (`router.replace` keeps module state). Drafts are not purged on that path (the
draft keys carry prompt ids, which another user never opens), and neither is the tab store: a stated limitation and a
candidate follow-up, not part of this PRP.

`removeFolderFromCache(folderId, parentId)` becomes `removeFolderTreeFromCache({ folderIds, promptIds })`, driven by the
ids `deleteFolder` returns (finding F-6): it deletes each folder id from every `foldersByParent` list and map key, each
folder id from `promptsByFolder`, each prompt id from `promptsById`, and refreshes `rootFolders`.

Ask first (developer, 29/10/2026, D10). Purging discards work, so `handleSignOut` confirms before it purges when unsaved
work exists. `hasUnsavedClientWork(storage)` in `client-purge.ts` is true when any tab has `isDirty` or the storage
holds any key starting with `prompt-`: a `prompt-v1-<id>` draft exists only while the working text differs from the
server's, and the `:conflict` stash and the legacy `prompt-<id>` are kept text by design. The Header shows an
`AlertDialog` (`src/components/ui/alert-dialog.tsx`: "Sign out and discard unsaved work?", Cancel and Sign out); Cancel
changes nothing, Sign out purges and calls `signOut()`. With no unsaved work it signs out at once. Limitation, stated:
the check and the purge see only this browser tab's memory and the shared `localStorage`. Another open tab of the same
browser keeps its caches and tab state in memory, is not asked, and may rewrite a draft after the purge; once the
cookies are cleared its server calls return the unauthorised text. The PRP does not coordinate tabs (no `storage`
event, no `BroadcastChannel`).

## Composite Tenant Keys

Developer decision, 29/10/2026 (Q8): the database enforces what the application checks. The change, validated with
`prisma validate` and previewed with `prisma migrate diff` on 29/10/2026 against a scratch copy of the schema (no
database, no client generated):

```prisma
model Folder {
  // Reason: never use disconnect on parent or folder. Both relations include user_id, which is also the owner
  // column, so a disconnect would null it. No code under src uses a Prisma disconnect today (searched 29/10/2026).
  parent  Folder? @relation("NestedFolders", fields: [parent_id, user_id], references: [id, user_id], onDelete: Cascade)
  // ... unchanged fields ...
  @@unique([id, user_id])
}
model Prompt {
  // Reason: same as Folder.parent: no disconnect, because it would null user_id.
  folder  Folder? @relation(fields: [folder_id, user_id], references: [id, user_id], onDelete: Cascade)
}
```

```sql
-- the five statements `prisma migrate diff` printed
ALTER TABLE "Folder" DROP CONSTRAINT "Folder_parent_id_fkey";
ALTER TABLE "Prompt" DROP CONSTRAINT "Prompt_folder_id_fkey";
CREATE UNIQUE INDEX "Folder_id_user_id_key" ON "Folder"("id", "user_id");
ALTER TABLE "Folder" ADD CONSTRAINT "Folder_parent_id_user_id_fkey" FOREIGN KEY ("parent_id", "user_id")
  REFERENCES "Folder"("id", "user_id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Prompt" ADD CONSTRAINT "Prompt_folder_id_user_id_fkey" FOREIGN KEY ("folder_id", "user_id")
  REFERENCES "Folder"("id", "user_id") ON DELETE CASCADE ON UPDATE CASCADE;
```

Postgres skips a composite foreign key whose referencing columns include a NULL (the default `MATCH SIMPLE`), so a root
folder (`parent_id` NULL) and an unfiled prompt (`folder_id` NULL) stay valid. Not verified: how the generated Prisma
Client types and runs these relations (no client was generated, because that would overwrite the project's); the
Postgres-backed test of Task 13 is the check. Tags are not covered, and cannot be by this change: `Prompt.tags` is an
implicit many-to-many whose join table `_PromptToTag` has no `user_id`, `Tag.user_id` is a plain string with no foreign
key to `Profile`, and an explicit join model would change every query that reads `tags`. `assignTagsToPrompt` keeps its
application check, and audit query 3 reports existing cross-tenant links for a follow-up issue.

The audit is read-only and runs before the migration, locally and, by the developer, against Supabase:

```sql
-- 1: folders whose parent belongs to another user
SELECT c.id, c.user_id AS folder_user, c.parent_id, p.user_id AS parent_user
FROM "Folder" c JOIN "Folder" p ON p.id = c.parent_id WHERE c.user_id <> p.user_id;
-- 2: prompts whose folder belongs to another user
SELECT pr.id, pr.user_id AS prompt_user, pr.folder_id, f.user_id AS folder_user
FROM "Prompt" pr JOIN "Folder" f ON f.id = pr.folder_id WHERE pr.user_id <> f.user_id;
-- 3 (information only, not fixed here): prompts linked to another user's tag
SELECT pt."A" AS prompt_id, pt."B" AS tag_id
FROM "_PromptToTag" pt JOIN "Prompt" p ON p.id = pt."A" JOIN "Tag" t ON t.id = pt."B" WHERE p.user_id <> t.user_id;
```

If queries 1 or 2 return rows, the migration fails with `P3018` on the constraint it was adding (Postgres refuses a
foreign key that existing rows violate) and applies nothing. Verified on 29/10/2026 on a throwaway database on the local
Docker Postgres (Prisma 6.19, since dropped): with the eight existing migrations applied, a folder of user B under a
folder of user A, and the script above added as a ninth migration, `prisma migrate deploy` failed on
`Folder_parent_id_user_id_fkey`. Afterwards `Folder_parent_id_fkey` and `Prompt_folder_id_fkey` still existed and
`Folder_id_user_id_key` did not, so the migration is all-or-nothing and needs no hand-written `BEGIN` and `COMMIT`.
`_prisma_migrations` recorded it as failed (not finished, not rolled back), which blocks every later `deploy`. The
recovery that worked: `prisma migrate resolve --rolled-back <migration_name>`, clean the violating rows (move the
folder or prompt to its owner's tree, or delete it), then `prisma migrate deploy` again; the foreign keys on the two
tables were then `Folder_parent_id_user_id_fkey`, `Folder_user_id_fkey`, `Prompt_folder_id_user_id_fkey` and
`Prompt_user_id_fkey`. After the migration, inserting a child folder of user B under user A's folder was refused
(`violates foreign key constraint "Folder_parent_id_user_id_fkey"`), while a root folder and an unfiled prompt inserted
fine. None of this was run against Supabase; the runbook for the developer is
[Task 16](P7S2-task-briefs-2.md#p7s2t16-developer-checks).

The migration SQL is generated with `prisma migrate diff --script` (Task 13 step 4) and applied from scratch on Task
13's own database. Its SQL must be exactly the five statements above. Migration
`20260717000001_add_case_insensitive_tag_index` created the expression index `Tag_name_user_id_ci_key` and
`content_tsv` is an `Unsupported` column, and the schema expresses neither, so a generated migration may touch them: on
any further statement, stop and report, and never commit a `DROP INDEX "Tag_name_user_id_ci_key"`, on which
`createTag`'s `P2002` recovery depends. The alternative, which printed exactly the five statements on 29/10/2026, is
`prisma migrate diff --from-schema-datamodel <the schema at HEAD, copied
to a scratch file> --to-schema-datamodel prisma/schema.prisma --script`, with the printed script written unedited into a
new `prisma/migrations/<timestamp>_composite_tenant_keys/migration.sql`.

Prisma Migrate has no down migrations, so a rollback is a new forward migration that reverses the script above (drop
the two new constraints and the unique index, then re-add `Folder_parent_id_fkey` and `Prompt_folder_id_fkey` on the
single columns with `ON DELETE CASCADE ON UPDATE CASCADE`; the agent regenerates it with `prisma migrate diff` in the
opposite direction and does not apply it).

## Test Conventions

Each area has `handlers.test.ts` for behaviour and `handlers.isolation.test.ts` for the tenant boundary, both inside
`describeDb` from `src/test/db.ts` where they need rows. The tests import the handler module, never an `actions.ts`
file and never `@/lib/db`, `action-runtime.ts` or Supabase code. A fake `ActionDeps` comes from
`src/test/action-deps.ts` (Task 3): `testDeps(db, userId)` returns a `getUser` that resolves
`{ id: userId, email: "<userId>@example.test" }`, and `signedOutDeps(db)` returns a `getUser` that resolves null. The
auth tests pass a fake `auth` object that records its arguments and are titled `"signIn: ..."` and `"signUp: ..."` so
the coverage rule finds them; that fake is an injected seam with a real default, not a mock of a repository module.

An isolation test is named `"<actionName>: user B ..."` so that the coverage rule can find it
([Task 10](P7S2-task-briefs-2.md#p7s2t10-isolation-coverage-rule)). It creates user A's rows with the factories, calls
the handler as user B with A's ids, and asserts two things: the result equals what a missing id returns (so the response
cannot tell the two apart), and A's rows are unchanged, read back with the test client. A read action asserts that B's
result contains none of A's data. The suites generate their ids with `randomUUID` through `createTestUser`, so parallel
runs against one database do not collide, and they delete what they created in `afterAll` through `deleteTestUser`.
`Tag` has no relation to `Profile` in `prisma/schema.prisma`, so deleting a profile does not delete its tags:
`deleteTestUser` removes them first.

The mutation limiter is keyed by user id and keeps 30 per minute per process. A suite that needs a limit to fire uses a
fresh user and calls the action 31 times; a suite that does not should stay well under 30 mutations per user.

Each worker's Prisma client opens its default pool (2 x CPUs + 1 connections), and a dozen parallel suites against one
default Postgres (`max_connections` is 100 by default; unverified here) can exhaust it, so `useTestDatabase` appends
`connection_limit=5` to the URL unless it already has one. `assertSafeTestDatabaseUrl` rejects only the `host`,
`hostaddr` and `port` query parameters (read in `src/test/db.ts`), so the parameter passes the guard. A test that needs
a row to vanish between a handler's read and its write (the `P2025` path of `renameFolder` and `assignTagsToPrompt`)
uses `src/test/racing-db.ts`, which mirrors `src/test/failing-db.ts`:

```typescript
/**
 * A client whose first `update` on `model` with `where.id === id` is preceded by deleting that row, so the real
 * database raises the real P2025. Later calls, other models and other ids pass through.
 */
export function withRowDeletedBeforeUpdate(db: PrismaClient, model: "folder" | "prompt", id: string): PrismaClient
```

It returns a Proxy over `db` that intercepts `update` on the `model` delegate in two places: the top-level client, and
the `tx` that `$transaction(async (tx) => ...)` passes to its callback (wrapped as `withFailingVersionCreate` wraps
it; the array form of `$transaction` passes through). The delete is sent through the outer, unwrapped `db`, so it
commits on its own connection before the intercepted `update` runs. For `renameFolder` the intercepted call is the
direct `db.folder.update`; for `assignTagsToPrompt` it is `tx.prompt.update` inside the handler's `$transaction`, and
the reads before it are not intercepted. Not verified: that the outer delete is never blocked by the open transaction
(that transaction has only read the row); the Task 3 test shows it.
