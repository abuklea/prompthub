# PromptHub
## P7S2T11 Independent Security Review

| `Title` | `Created` | `Last modified` |
|---------|-----------|-----------------|
| P7S2T11 Independent Security Review | 29/10/2026 22:05 GMT+10 | 29/10/2026 22:05 GMT+10 |

## Table of Contents
- [Scope and Method](#scope-and-method)
- [Summary](#summary)
- [Findings](#findings)
  - [S-1 Array caps do not bound parse cost, and parsing precedes authentication](#s-1-array-caps-do-not-bound-parse-cost-and-parsing-precedes-authentication)
  - [S-2 signUp creates an orphan Profile for an existing email when confirmation is on](#s-2-signup-creates-an-orphan-profile-for-an-existing-email-when-confirmation-is-on)
  - [S-3 The auth limiter is keyed on a client-chosen header and never evicts](#s-3-the-auth-limiter-is-keyed-on-a-client-chosen-header-and-never-evicts)
  - [S-4 ON UPDATE CASCADE on the composite keys moves a subtree instead of refusing](#s-4-on-update-cascade-on-the-composite-keys-moves-a-subtree-instead-of-refusing)
  - [S-5 Migration locks on Supabase](#s-5-migration-locks-on-supabase)
  - [S-6 Tag names are included without a tag owner filter](#s-6-tag-names-are-included-without-a-tag-owner-filter)
  - [S-7 Sign-out purge: what survives, the race and other tabs](#s-7-sign-out-purge-what-survives-the-race-and-other-tabs)
  - [S-8 Unbounded reads](#s-8-unbounded-reads)
  - [S-9 Dependency advisories](#s-9-dependency-advisories)
  - [S-10 User enumeration through the auth answers](#s-10-user-enumeration-through-the-auth-answers)
- [Areas Cleared](#areas-cleared)
- [Final Validation Checklist Answers](#final-validation-checklist-answers)
- [Commands Run](#commands-run)
- [Not Reviewed](#not-reviewed)

## Scope and Method

Read-only review of the tree at `f42b8cd` on `feature/P7S2-server-side-security-hardening`, against the tenancy rule
in `docs/rules/project.md#database-auth-and-tenancy`, the PRP's Goal, What and Anti-Patterns, the action matrix and the
domain contracts. Every Prisma statement in the nine wrapper files, the eleven handler modules, `editor/service.ts`,
`ensure-profile.ts` and `action-runner.ts` was read statement by statement and traced from its `"use server"` wrapper
through `runAction`. Searches were used as maps only. Severities are for this deployment (Vercel, Supabase Cloud, a
single-instance Docker stack locally).

## Summary

No cross-tenant read or write was found: every Prisma statement is scoped by the authenticated `user.id`, directly or
through a row read under that scope earlier in the same request. The `"use server"` surface is exactly the 25 actions,
none takes a user id, and no handler, service or helper is reachable from a Client Component. One Medium finding
(S-1) is a resource-exhaustion path that the new array caps were meant to close and do not. The rest are Low or Info.

| Severity | ID | Location | Summary |
|---|---|---|---|
| Medium | S-1 | `src/lib/action-runner.ts:119`, `src/features/prompts/schemas.ts:73,79,99` | `.max()` on a Zod 3 array still parses every element; ~1 MB body costs ~150 MiB heap and ~200 ms CPU, before authentication |
| Low | S-2 | `src/features/auth/handlers.ts:116` | With email confirmation on, signUp for an existing email creates a `Profile` for GoTrue's random stand-in id |
| Low | S-3 | `src/lib/action-runtime.ts:42`, `src/lib/rate-limit.ts:32,48-56` | Auth limiter keyed on the first `x-forwarded-for` value; maps never evicted (known F-5, #48) |
| Low | S-4 | `prisma/migrations/20261029114511_composite_tenant_keys/migration.sql:11,14` | `ON UPDATE CASCADE` on keys that include `user_id` would move a subtree to another owner rather than refuse |
| Info | S-5 | same migration | `ACCESS EXCLUSIVE` on `Folder` and `Prompt` for the whole migration transaction; no `lock_timeout` in the runbook |
| Info | S-6 | `src/features/prompts/handlers.ts:72`, `src/features/prompts/search-handlers.ts:77` | `include: { tags }` has no tag `user_id` filter; legacy cross-tenant links would show another user's tag name (#107) |
| Info | S-7 | `src/features/auth/client-purge.ts`, `src/components/layout/Header.tsx:42-51` | Purge is sound for this tab; other tabs and session expiry remain (D10, #106) |
| Info | S-8 | `src/features/workspace/handlers.ts:37,41` | Unlimited, unpaged whole-workspace read (#105, #48) |
| Info | S-9 | `package-lock.json` | `npm audit`: 43 advisories in the unchanged tree, including `next`, `@supabase/auth-js`, `zod` |
| Info | S-10 | `src/features/auth/handlers.ts:68-76` | Enumeration only where GoTrue itself enumerates (autoconfirm on) |

## Findings

### S-1 Array caps do not bound parse cost, and parsing precedes authentication

Severity Medium. Locations: `src/lib/action-runner.ts:119` (parse is step 1, before `getUser` at `:122` and the limiter
at `:125`); `src/features/prompts/schemas.ts:73` (`validatePromptsSchema`, `.max(200)`), `:79` (`getPromptsByFolder`
`tagIds`, `.max(20)`), `:99` (`assignPromptTagsSchema` `tagIds`, `.max(20)`).

Traced path. `validatePrompts` wrapper (`src/features/prompts/actions.ts`, `handlers.validatePrompts(actionDeps, data)`)
-> `handlers.validatePrompts` -> `runAction` -> `spec.schema.safeParse(data)` at `action-runner.ts:119`. In Zod
3.25.76, `ZodArray._parse` (`node_modules/zod/v3/types.js:1747` onward) adds a `too_big` issue for the length, marks
the status dirty and then parses every element anyway, collecting one issue per failing element. The same holds for
`getPromptsByFolder` (a read, no limit) and `assignTagsToPrompt` (the `mutation` limiter runs after the parse, so it
does not help). Next 14.2.35 accepts an action body up to 1 MB by default (`action-handler.js:422`, and
`next.config.mjs` sets no `serverActions`).

Measured (scratch script against the project's own Zod, `node --expose-gc`):

```text
promptIds of 0 (invalid type): body 977 KiB, success=false, issues=500001, 207 ms, heap +151.7 MiB
promptIds of "" (too short): body 967 KiB, success=false, issues=330001, 157 ms, heap +134.4 MiB
tagIds of 0 (invalid type): body 977 KiB, success=false, issues=500001, 182 ms, heap +152.4 MiB
promptIds of 200 valid: body 1 KiB, success=true, issues=0, 0 ms, heap +0.1 MiB
```

Attacker and impact. Anyone holding the action id: ids are stable per build and ship in the client chunks, which any
self-registered user receives (sign-up is open). No session is needed per request, because the parse runs before
`getUser`, and reads have no limiter. Each request blocks the event loop for about 200 ms and allocates about 150 MiB.
A handful of concurrent requests can exhaust the single Node process of the Docker stack; on Vercel it costs function
time and can hit the function memory limit. Before P7S2 `validatePrompts` had no schema at all, so this is not a
regression, but the PRP's "caps lists" claim holds for the database query only, not for the work done before it.

Proven: the Zod cost, by measurement. Inferred, not reproduced: the HTTP request (no build or server was run; the
main session owns the build), which needs the action id and a hand-encoded body.

Fix (tested in isolation with the same scratch harness): refuse an over-long array in constant time before the element
schema runs, for every array schema reachable from an action:

```typescript
const boundedArray = <T extends z.ZodTypeAny>(element: T, max: number) =>
  z.unknown()
    .refine((value) => !Array.isArray(value) || value.length <= max, `At most ${max} items`)
    .pipe(z.array(element).max(max))
```

Results: 500,000 invalid elements 1 ms and 0.2 MiB; 200 valid accepted; 201, a wrong element, a too-long element and a
non-array refused with one issue each. (A plain `z.array(z.unknown()).max(n).pipe(...)` still copied every element:
65 ms and 32 MiB.) Optionally also lower `serverActions.bodySizeLimit`, noting that `MAX_CONTENT_LENGTH` is 500,000
characters, which can exceed 1 MB in UTF-8 already.

### S-2 signUp creates an orphan Profile for an existing email when confirmation is on

Severity Low. Location: `src/features/auth/handlers.ts:116`
(`if (reply.user) await ensureProfileLogged(deps.db, reply.user.id)`).

Traced path. `signUp` wrapper (`src/features/auth/actions.ts`) -> `handlers.signUp(authDeps, values)` -> `authenticate`
-> `flow.call(deps.auth(), { email, password })` -> `@supabase/auth-js` 2.64.2 `GoTrueClient.signUp`
(`node_modules/@supabase/auth-js/src/GoTrueClient.ts:415`), which returns `data.user` exactly as the server sent it
(`_sessionResponse`, `src/lib/fetch.ts:203-215`). Supabase Auth's `internal/api/signup.go` (read on 29/10/2026 from
`supabase/auth` master): for an existing confirmed user with autoconfirm off it answers 200 with `sanitizeUser(user)`,
which sets `u.ID = uuid.Must(uuid.NewV4())`; with autoconfirm on it answers 422 `user_already_exists`. So with email
confirmation on, `reply.user.id` is a fresh random UUID, `error` is null, and the handler inserts a `Profile` row for
it, one per attempt.

Impact. Unbounded orphan `Profile` rows, limited only by the per-IP auth limiter (5 a minute per `x-forwarded-for`
value, which S-3 shows a client can rotate on the Docker gateway). No access follows: nobody can authenticate as a
random id. A new, never-confirmed sign-up also gets a profile (pre-existing behaviour). Whether the cloud project has
confirmation on is unverified.

Proven by reading both sides; not reproduced (the Docker stack auto-confirms, so it cannot show the confirmation-on
path). Fix, in #42's scope: create the profile on sign-up only when the reply carries a session
(`if (reply.user && reply.session)`; add `session` to `AuthReply`); a confirmed user's first sign-in, and `runAction`'s
`ensureProfile` on `createFolder`, `createPrompt` and both profile actions, already create it.

### S-3 The auth limiter is keyed on a client-chosen header and never evicts

Severity Low. Locations: `src/lib/action-runtime.ts:42` (first `x-forwarded-for` value), `src/lib/rate-limit.ts:32`
and `:48-56` (an entry per identifier, never deleted). Confirmed as recorded in F-5: on the Docker gateway the first
value is the client's own claim, so each attempt can pick a new bucket, and every distinct value adds a map entry for
the life of the process (slow memory growth). On Vercel the platform sets the header; not verified here. The limiter
is not the real brute-force control in any case: the Supabase URL and anon key are public, so GoTrue's own rate limits
apply to anyone calling it directly. Inferred, not reproduced. Tracked by #48 (shared store); fix there: key on the
platform's client address (on Vercel `x-real-ip` or the last trusted hop), and evict empty entries.

### S-4 ON UPDATE CASCADE on the composite keys moves a subtree instead of refusing

Severity Low (latent). Locations: `prisma/migrations/20261029114511_composite_tenant_keys/migration.sql:11` and `:14`;
`prisma/schema.prisma:28` and `:49` (no `onUpdate`, so Prisma's default `Cascade`).

The keys `("parent_id","user_id")` and `("folder_id","user_id")` reference `Folder("id","user_id")` with
`ON UPDATE CASCADE`. If any code ever updated a folder's `user_id` (none does today: no statement under `src` writes
`user_id`, `parent_id` or `folder_id` after create, and no Prisma `disconnect` exists), Postgres would rewrite the
`user_id` of every child folder and every prompt in it, transferring the whole subtree to the new owner, and the
prompts' `_PromptToTag` links would then point at the old owner's tags. A refusal is the safer failure for a tenant
key. `ON DELETE CASCADE` is correct and is what `deleteFolder` relies on. Inferred from Postgres semantics; not
reproduced. Fix (Task 13's scope): `onUpdate: Restrict` (or `NoAction`) on `Folder.parent` and `Prompt.folder`,
regenerated with `prisma migrate diff`, before the migration first reaches Supabase; or record the decision to keep it.

What the keys enforce: a folder's parent and a prompt's folder belong to the same user, in the database. What they do
not: tags (`_PromptToTag` has no `user_id`, `Tag.user_id` has no foreign key to `Profile`, #107), and `MATCH SIMPLE`
skips rows whose `parent_id` or `folder_id` is NULL, which is intended. The `disconnect` hazard in the schema comments
is real but has no caller.

### S-5 Migration locks on Supabase

Severity Info. PostgreSQL 17 documentation (`sql-altertable.html`): `ALTER TABLE` takes `ACCESS EXCLUSIVE` unless noted;
`DROP CONSTRAINT` has no exception noted, so the two drops take `ACCESS EXCLUSIVE` on `Folder` and on `Prompt`;
`ADD FOREIGN KEY` takes `SHARE ROW EXCLUSIVE` on the altered and the referenced table and scans to validate;
`CREATE UNIQUE INDEX` without `CONCURRENTLY` takes `SHARE` on `Folder`. The migration runs as one transaction (verified
all-or-nothing in the domain contract), so the `ACCESS EXCLUSIVE` locks are held until commit: every read and write of
`Folder` and `Prompt` waits for the index build and both validation scans. At this data size that is expected to be
short (not measured on Supabase). The real risk is the lock queue: if any open transaction holds a lock on either table,
the first `DROP CONSTRAINT` waits and every later query queues behind it. Fix for the Task 16 runbook: run the deploy
with a lock timeout (for example `PGOPTIONS='-c lock_timeout=5s'` in the shell that runs `prisma migrate deploy`) in a
quiet period, and retry on timeout. Whether dropping the foreign key also takes `ACCESS EXCLUSIVE` on the referenced
table is not stated in the documentation and was not verified.

### S-6 Tag names are included without a tag owner filter

Severity Info. Locations: `src/features/prompts/handlers.ts:72` (`include: { tags: { select: { id, name } } }` in
`getPromptsByFolder`) and the same include in `searchPrompts` (`src/features/prompts/search-handlers.ts:77` onward).
The prompts are scoped by `user_id`, but the included tags are whatever `_PromptToTag` links, with no `Tag.user_id`
filter. `assignTagsToPrompt` now refuses foreign tags and its `set` drops any old link, so no new cross-tenant link can
be made; a legacy one (audit query 3) would show another user's tag name and id to the prompt's owner. Inferred; not
reproduced. Fix: `include: { tags: { where: { user_id: user.id }, select: ... } }` in both places (cheap
defence-in-depth), and the database fix under #107.

### S-7 Sign-out purge: what survives, the race and other tabs

Severity Info. Enumerated client stores: `localStorage` keys `prompt-v1-<id>`, `prompt-v1-<id>:conflict`,
`prompt-<id>` (removed), `prompthub-tabs-state` (rewritten empty by `resetTabs`), `prompthub:user-settings:v1`
(preferences, survives by design), `react-resizable-panels` layout keys from `autoSaveId` (sizes only, survive);
in memory, the document cache, the workspace cache, the tab store and the UI store (all reset) and the limiter maps
(server). No `sessionStorage`, IndexedDB or other persisted Zustand store exists. `signOut` calls
`revalidatePath("/", "layout")`, which also invalidates the client router cache.

The race: the purge runs before `await signOut()` (`Header.tsx:44-46`). A late `getWorkspaceSnapshot` answer can only
re-adopt the previous user as viewer, and the next user's `bindWorkspaceCacheViewer` empties it, so that path is safe.
A draft is rewritten only on a content or baseline change of a mounted editor (`useDraftSync.ts`), and `resetTabs()`
unmounts the editor in the same purge, so the window is a keystroke between the purge and the unmount. An in-flight
`getPromptsByFolder` answer could refill the UI store's `prompts` in memory after `resetSession` (inferred, not
reproduced). Other open tabs keep their memory and, on any tab-store change, rewrite `prompthub-tabs-state` with the
previous user's titles; a session that expires without the button purges nothing. Both are stated limitations (D10,
#106). Browser verification is Task 16.

### S-8 Unbounded reads

Severity Info. `getWorkspaceSnapshot` (`src/features/workspace/handlers.ts:37`, `:41`) reads every folder and prompt
listing of the caller with no `take`, and reads have no limiter (decision Q3). The cost is bounded by the caller's own
rows, which are bounded only by the mutation limiter (30 creations a minute) until #105's caps. `getProfileDetails`
writes (`INSERT ... ON CONFLICT DO NOTHING`) on every unlimited read; cheap. The full-text search is capped at 100
rows. Tracked by #105 and #48.

### S-9 Dependency advisories

Severity Info, out of scope (no dependency changes in this PRP apart from `server-only`). `npm audit`: 43
vulnerabilities (5 low, 9 moderate, 25 high, 4 critical), all in packages this PRP did not change. Of direct relevance:
`next` 14.2.35 (range `9.3.4-canary.0 - 16.3.0-preview.10`, critical), `@supabase/auth-js` 2.64.2 (`<=2.69.1`),
`zod` 3.25.76 (`<4.6.6`, GHSA-mrhx-c7xc-m3w5; the advisory text names Zod 4's `$ZodArray` and does not confirm 3.x,
but S-1 shows the same behaviour class in 3.25.76). Reachability of each advisory was not assessed: a dependency
upgrade task (#47) should. `server-only@0.0.1`: lock integrity
`sha512-qepMx2JxAa5jjfzxG79yPPq+8BuFToHd1hm7kI+Z4zAq1ftQiP7HcxMhDDItrbtwVeLg/cY2JnKnrcFkmiswNA==` equals the registry's
`dist.integrity`; tarball `registry.npmjs.org`; the installed package is `index.js` (throws) and `empty.js`, with the
`react-server` export mapping to `empty.js`.

### S-10 User enumeration through the auth answers

Severity Info. With confirmation on, sign-up answers success for a new and an existing email alike (S-2 aside). With
autoconfirm on (the Docker stack), an existing email gets "Could not create the account." and a new one succeeds, but
GoTrue answers the same to a direct call with the public anon key, so the action adds nothing. "Confirm your email
address before signing in." is returned only after a correct password (GoTrue `token.go`, `ResourceOwnerPasswordGrant`
checks the password before `IsConfirmed`). Timing was not measured.

## Areas Cleared

- Item 1, scoping: every statement in the folder, prompt, tag, history, editor, profile, workspace and dashboard
  handlers, `search-handlers.ts`, `editor/service.ts`, `ensure-profile.ts` and `action-runner.ts` is scoped by
  `user.id`; `listVersions` and `restoreVersion` read versions only after a `{ id, user_id }` prompt read (the latter
  `FOR UPDATE` in the same transaction), and prompts never change owner; `deleteFolder`'s CTE scopes both the anchor
  and the recursive step and the prompt list by `user_id`, and the delete is `deleteMany({ id, user_id })` in the same
  transaction; `renamePrompt`'s two reads and `updateMany` are scoped; `createPrompt` and `createFolder` check the
  folder or parent in the writing transaction; `assignTagsToPrompt` reads, counts and writes in one transaction with
  `update({ id, user_id })`; `getTags({ folderId })` filters `prompts.some` by `user_id`; the dashboard's version count
  scopes through `prompt.user_id`.
- Item 2, the action surface: nine `"use server"` files export 25 async functions (auth 3, folders 5, prompts 6,
  tags 3, history 2, editor 2, profile 2, workspace 1, dashboard 1), none taking a user id; the no-argument wrappers
  pass `undefined`, ignoring client arguments; `auth/handlers.ts:17` contains "use server" only inside its header
  comment; no Client Component imports a handler, service, runner, runtime or `ensure-profile`; Client Components reach
  only the wrapper files; `@prisma/client` imports in client files are types only (`FolderItem.tsx`, `FolderTree.tsx`
  import `Folder` without `type`, which the compiler elides).
- Item 3: every action schema is a `z.object` (unknown keys stripped) with no user or tenant field.
- Item 4: three raw queries, all tagged templates with parameters: `folders/handlers.ts:55`,
  `prompts/search-handlers.ts:52`, `editor/service.ts:157`. No `Prisma.sql`, `Prisma.raw`, `$executeRaw` or `Unsafe`
  call exists.
- Item 5: `runAction` returns only `spec.invalid`, `spec.failure` and fixed texts; the auth handlers only fixed texts;
  no `error.message` or `String(error)` reaches a client. Missing and foreign rows give the same answer in every action
  (the isolation suites assert it). Titles echoed in duplicate messages are the caller's own input.
- Item 6: every mutation has a class (`mutation`: 9, `save`: 2, `autosave`: 1); reads are `none` (S-1, S-8 for cost).
- Item 10: `actionDeps.getUser` calls `createClient().auth.getUser()` inside the function; `headers()` is read inside
  `clientIp`; the only `getSession()` (`auth/actions.ts:67`) decides whether to call `auth.signOut()`, not access.
- Item 11: no secret in `git diff bff5fa6..HEAD` (only loopback placeholders and a test fixture with fake
  credentials); `.github/workflows/ci.yml` is not in the diff; the Vitest alias maps only the bare `server-only`
  import to `empty.js`.

## Final Validation Checklist Answers

- "Task 11 confirms every Prisma statement is scoped": confirmed for the tree at `f42b8cd`. Every statement is scoped by
  the authenticated `user.id`, directly or through a row read under that scope earlier in the same request (version
  queries through the owned prompt). The tag `include` of S-6 returns rows linked to the user's own prompts; it is not
  an unscoped statement, but it does not filter the tag's owner.
- "The manifest count is 25 / the build lists no `/auth/sign-out`": nothing in the code contradicts the main session's
  measurement. The nine `"use server"` files export exactly 25 async functions and nothing else, and
  `src/app/auth/sign-out/route.ts` is deleted with no other route handler under `src/app/auth`. I did not run the build.

## Commands Run

```text
git log --oneline -1                      -> f42b8cd feat: add composite tenant keys ... (P7S2T13)
npx tsc --noEmit                          -> exit 0
TEST_DATABASE_URL=...localhost:54322/prompthub_test npx vitest run <18 files: the isolation suites, prompts,
  composite-fk, action-coverage, action-runner, ensure-profile, auth handlers>
                                          -> Test Files  18 passed (18); Tests  137 passed (137)
npm view server-only@0.0.1 dist.integrity -> matches package-lock.json
npm audit                                 -> 43 vulnerabilities (5 low, 9 moderate, 25 high, 4 critical)
node --expose-gc <scratchpad>/zod-array-cost.mjs, zod-array-fix.mjs  -> S-1 measurements
```

## Not Reviewed

- The S-1 HTTP request end to end (no server or build run by this review; the build is the main session's).
- The browser checks of the purge and the confirmation dialog (Task 16), and whether the cloud GoTrue sends
  `AuthError.code` values or has email confirmation on.
- The migration on Supabase, its duration, and the lock taken on the referenced table by `DROP CONSTRAINT`.
- Per-advisory reachability of the 43 `npm audit` entries.
- Next.js's origin check on server actions (CSRF) was not re-verified; it is unchanged by this PRP.
- The quality of the test suites beyond running them, and the frontend caller edits beyond their imports and the
  purge path.
- Full `npm test`, lint, the size audit and `npx prisma validate` (not needed for a read-only review; the main session
  runs the gates).
