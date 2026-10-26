# PromptHub
## P7S2 Research Notes

| `Title` | `Created` | `Last modified` |
|---------|-----------|-----------------|
| P7S2 Research Notes | 27/10/2026 00:18 GMT+10 | 27/10/2026 00:22 GMT+10 |

## Table of Contents
- [Purpose and sources](#purpose-and-sources)
- [Scope from the tracker](#scope-from-the-tracker)
- [Action inventory](#action-inventory)
- [Findings](#findings)
- [Patterns to mirror](#patterns-to-mirror)
- [Gotchas](#gotchas)
- [Validation commands](#validation-commands)
- [Candidate task breakdown](#candidate-task-breakdown)
- [Open questions](#open-questions)

## Purpose and sources

This is the Stage 1 research dossier for P7S2, server-side security hardening (epic #39). The PRP will be
`PRPs/P7S2-server-side-security-hardening.md`, the ID the epic reserved. The drift register is
[P7S2-research-drift.md](P7S2-research-drift.md). Research ran on 26/10/2026 and 27/10/2026 against `master` at
`481aae9`, and covered four things:

- a first-hand reading of the action modules, the editor service, the test harness and the client caches;
- an independent inventory of every Server Action by a security-analyst agent;
- external research on Next.js 14.2.35, Prisma 6.19.0, `@supabase/ssr` 0.3.0 and Zod 3.25.76. It included two
  `next build` runs and a concurrency probe against a throwaway Postgres 16, all in a scratch copy outside the
  repository;
- a documentation drift sweep.

Serena was unreachable, so code search used Grep, Glob and Read.

## Scope from the tracker

Epic #39's outcome is that every server action validates its input, enforces ownership of every row it touches, and
is covered by a cross-user isolation test, and that no server-only helper is callable as an action. Its children are:

| Issue | Type | What it asks |
|---|---|---|
| #40 | bug | `src/lib/ensure-profile.ts`: remove `"use server"`, add a server-only guard, replace findUnique-then-create with an upsert |
| #41 | bug | Folder create and rename schemas, a prompt rename schema, parent-folder and target-folder ownership, every write scoped by `user_id`, folder actions returning `ActionResult` with their callers updated. The restore part was fixed by P7S1T3 (comment on #41) |
| #42 | bug | `signIn` and `signUp` parse with their schemas and pass only email and password, with a generic error and unit tests |
| #43 | bug | `deleteFolder` returns the prompt ids of every descendant folder, so every affected tab closes; a nested-delete test |
| #44 | bug | Sign-out clears the workspace cache, the document cache and the `prompt-*` drafts; the workspace cache getters return nothing for another user id |
| #45 | test | One cross-user isolation test per action, run in CI; `docs/rules/testing.md` requires one for every new action |
| #46 | dev-review | The developer confirms that the credentials exposed in git history were rotated. Not agent work |

Two issues outside the epic overlap it. #51 (P7S3) splits `src/features/prompts/actions.ts`, the one RED file in the
area at 674 lines, and centralises the `NEXT_REDIRECT` rethrow. #48 (P7S3) moves the rate limiter to a shared store
and applies it to every mutation. Today only `signIn`, `signUp`, `createPrompt` and `saveNewVersion` are limited.

## Action inventory

Eight modules carry a module-level `"use server"` directive, and no function carries an inline one. The modules are
`src/features/{auth,dashboard,editor,folders,profile,prompts,workspace}/actions.ts` and `src/lib/ensure-profile.ts`.
`src/features/editor/document-actions.ts` and `markdown-actions.ts` are client modules, despite their names.

Together the eight modules export 27 functions:

- 23 touch tenant data, so a one-test-per-action rule covers them:
  - prompts (12): `getPromptsByFolder`, `createPrompt`, `getPromptDetails`, `renamePrompt`, `deletePrompt`,
    `validatePrompts`, `searchPrompts`, `getTags`, `createTag`, `assignTagsToPrompt`, `getPromptVersionHistory`,
    `restorePromptVersion`;
  - editor (2): `saveNewVersion`, `autoSavePrompt`;
  - folders (5): `getRootFolders`, `createFolder`, `renameFolder`, `deleteFolder`, `getFolderChildren`;
  - profile (2): `getProfileDetails`, `updateDisplayName`;
  - one each from workspace (`getWorkspaceSnapshot`) and dashboard (`getDashboardMetrics`).
- `signUp`, `signIn` and `signOut` hold no tenant data.
- `ensureProfileExists` is a helper that should not be an action at all.

No test imports an action today. Isolation is tested only below the action layer:
`src/features/editor/service.save.test.ts:169` and `service.restore.test.ts:206` test the services behind four of
the actions.

How the 27 measure against the boundary (`docs/rules/project.md#database-auth-and-tenancy`):

| Property | Actions that fail it |
|---|---|
| Zod on the input | 13: the five folder actions, `getPromptsByFolder`, `renamePrompt`, `deletePrompt`, `validatePrompts` (an unbounded `in` list), `updateDisplayName`, `signIn`, `signUp` (schemas imported as types only), and `ensureProfileExists` |
| `user_id` in the writing statement | `assignTagsToPrompt` (`src/features/prompts/actions.ts:588`: checks ownership at `:561`, then updates by `id`) |
| Ownership of a referenced row | `createPrompt` (`folderId`, `:143-150`) and `createFolder` (`parentId`, `src/features/folders/actions.ts:37-43`) |
| Returns `ActionResult` | 11 do not: `getPromptsByFolder`, `searchPrompts`, `getTags`, the five folder actions, both profile actions, `getWorkspaceSnapshot`. `getDashboardMetrics` and `signOut` have their own shapes by design |
| Rate limit | All but `createPrompt`, `saveNewVersion`, `signIn` and `signUp` |

Two things are sound. Missing ids and foreign ids return the same error everywhere except the foreign-key path in
finding F-2. Both raw SQL calls (`prompts/actions.ts:398`, `src/features/editor/service.ts:154`) are tagged
templates, so they are parameterised and scoped.

## Findings

These are defects found during research. Findings F-1 and F-2 are not in any issue yet.

| ID | Severity | Finding | Evidence | Proposed disposition |
|---|---|---|---|---|
| F-1 | Medium | Any signed-in user can grow the database without bound. `createFolder` has no length cap, no rate limit and no count cap, so a loop of large names inserts rows indefinitely; `saveNewVersion` allows 30 versions of 500,000 characters a minute; `next.config.mjs` sets no `serverActions.bodySizeLimit` (default 1 MB) | `folders/actions.ts:27-47`; `src/features/editor/schemas.ts:23,28`; `src/lib/rate-limit.ts` | Length caps in P7S2's schemas; rate limits per Q3; per-user count or byte caps filed as a new issue under #47 |
| F-2 | Low | A prompt or folder can point at another user's folder. The foreign key references `Folder.id` alone, so `createPrompt({ folderId: <A's folder> })` succeeds. B's own reads then return A's folder name (`getPromptDetails` `prompts/actions.ts:193-198`, `getWorkspaceSnapshot`, `getDashboardMetrics`), and success or failure tells B whether a folder id exists. It needs A's UUIDv4 | `prisma/schema.prisma:26,45` | Ownership check in the same transaction as the write (#41). Composite foreign keys would make it impossible at the database (Q8) |
| F-3 | Low, latent | `ensureProfileExists(userId)` is not in the action manifest today. Two `next build` runs show that importing any action module from a Server Component registers it as an unauthenticated endpoint that creates a `Profile` row for any id | `.next/server/server-reference-manifest.json`: 26 ids, 27 after a one-line import in `dashboard/page.tsx` | #40 |
| F-4 | Low | `signIn` and `signUp` send the raw client object to Supabase (including `confirmPassword`, and any `options` a direct POST adds) and return Supabase's `error.message` and any exception message verbatim | `src/features/auth/actions.ts:32,35,46,60,63,74` | #42; map errors to fixed messages |
| F-5 | Low | The auth rate limit keys on the first `x-forwarded-for` value. The Docker gateway appends to the header (`docker/gateway/nginx.conf:23,35`), so a client can rotate it; Vercel overwrites it. The limiter map is never evicted | `auth/actions.ts:25,53`; `rate-limit.ts:29-64` | #48 (P7S3); recorded here so P7S2 does not claim it |
| F-6 | Low | `deleteFolder` reads the prompt ids and deletes the folder in two statements, not in one transaction. On the client, `removeFolderFromCache` leaves descendant folders and prompts in the workspace cache | `folders/actions.ts:81-98`; `src/features/workspace/cache.ts:87-91` | #43, extended to the cache |
| F-7 | Low | `src/app/auth/sign-out/route.ts` (POST) has no caller in `src`, clears no client state, and can be triggered cross-site to sign a user out | `grep -rn "auth/sign-out" src` finds nothing | Q6 |
| F-8 | Low | On sign-out the persisted tab store (`prompthub-tabs-state`) keeps the previous user's document titles in localStorage. `useTabCleanup` closes them for the next user on mount, but the titles stay on disk until then | `src/stores/use-tab-store.ts:24,205`; `src/hooks/use-tab-cleanup.ts` | Q7 |
| F-9 | Info | Ten files in the area have no source header: `ensure-profile.ts`, the folders, auth, workspace, profile and dashboard actions, `workspace/cache.ts`, `FolderItem.tsx`, `FolderTree.tsx` and `FolderToolbar.tsx` | `docs/rules/documentation.md#source-file-headers` | Each task adds the header to the files it edits |

## Patterns to mirror

| File | Why |
|---|---|
| `src/features/editor/service.ts` | The service convention from P7S1: functions taking `(db, userId, input)`, no `"use server"` directive (header `:15-16` says why), a narrowed client type (`EditorDb`, `:36`), one `NOT_FOUND` message, scoped `updateMany` as the ownership check, and `$transaction` with a row lock where a read and a write must agree |
| `src/features/editor/actions.ts` | The thin action shell: `safeParse`, `getUser`, rate limit, delegate, catch with a generic message |
| `src/features/editor/service.save.test.ts:169` | The cross-user test shape: user B gets "Prompt not found or access denied" and the row is unchanged |
| `src/test/db.ts` | `describeDb`, `useTestDatabase`, `createTestUser`, `createTestPrompt`, and the guard that refuses a non-disposable database. A `createTestFolder` factory is the natural addition |
| `src/features/prompts/schemas.ts` | Schema style: `z.string().uuid('Invalid folder ID')`, `createTagSchema`'s `z.string().trim().min(1).max(50)`, `titleValidationSchema` for document titles |
| `src/features/prompts/actions.ts:476-546` | `createTag`'s handling of a P2002 race, for comparison with the upsert below |
| `src/features/editor/draft.ts:53,57` and `src/features/editor/document-cache.ts:95` | The draft keys (`prompt-v1-<id>`, `prompt-v1-<id>:conflict`, legacy `prompt-<id>`) and `clearDocumentCache`, which the sign-out purge reuses |
| `src/test/storage-fake.ts` | The storage fake for a jsdom test of the purge |

## Gotchas

- An exported non-async function in a `"use server"` file fails the build, and an exported async one becomes a public
  action. Helpers, seams, factories and a `NEXT_REDIRECT` helper must live in plain modules.
- Prisma 6.19.0 `upsert({ where: { id }, create: { id }, update: {} })` falls back to SELECT then INSERT and raced in
  205 to 210 of 240 concurrent first calls (P2002). `update: { id }` produces `INSERT ... ON CONFLICT ("id") DO
  UPDATE` and passed all 240, as did `createMany({ data: [{ id }], skipDuplicates: true })`. The empty-`update`
  fallback was observed and is not in the Prisma docs; the documented criteria are in the
  [upsert reference](https://www.prisma.io/docs/orm/reference/prisma-client-reference#database-upserts).
- `server-only` is not installed. Next 14.2 aliases a bare `server-only` import at build time
  (`node_modules/next/dist/build/create-compiler-aliases.js`), but `tsc` does not resolve it. Under Vitest the
  package's default export throws, so a suite importing a guarded module needs a `resolve.alias` to the package's
  own `empty.js`, which is the file Next itself selects on server layers. A global `react-server` condition would
  break the jsdom suites. The docs say to install the package:
  [Keeping server-only code out of the client](https://nextjs.org/docs/14/app/building-your-application/rendering/composition-patterns#keeping-server-only-code-out-of-the-client-environment).
- `cookies()` throws outside a request scope, and Next 14.2 has no supported test utility for it. A fake GoTrue
  server can authenticate a real action only through Next internals, as a plain-Node probe showed: the request
  async storage, the cookies adapter, a static-generation store for `revalidatePath`, and a global
  `AsyncLocalStorage`. It would also have to point `@/lib/db` at the test database, which bypasses the
  `src/test/db.ts` guard. CI runs no GoTrue.
- `@supabase/ssr` 0.3.0 reads `sb-<first host label>-auth-token` as plain JSON (no `base64-` prefix), chunked past
  3,180 characters. This matters only for the fake-GoTrue option.
- In Zod 3.25.76, `.trim()` must come before `.min()` and `.max()`: `z.string().min(1).max(5).trim()` accepts
  `"  "` and returns `""`. `.uuid()` accepts any version, the nil UUID and upper case. A nullable `parentId` needs
  `.nullable()`.
- The purge prefix is `prompt-` with the hyphen. `prompthub-tabs-state` and `prompthub:user-settings:v1` also start
  with `prompt`.
- The folder components rely on thrown errors (`FolderItem.tsx:69,97,133`, `FolderTree.tsx:62`,
  `FolderToolbar.tsx:24,36,49`). Once the actions return `ActionResult`, each caller must branch on `success` and
  show the message.
- When email confirmation is on, `signUp` returns a user and no session (`auth/actions.ts:39-41`). A profile helper
  that read the user from `getUser()` would find nobody, so `ensureProfileExists` keeps taking the id from its
  caller. Whether the cloud project confirms by email is not verified; the Docker stack auto-confirms.
- `deleteFolder` must collect the prompts of every descendant folder before the cascade. That needs a recursive CTE
  scoped by `user_id` (a tagged `$queryRaw`, the existing pattern at `prompts/actions.ts:398`), or a breadth-first
  walk, inside the same transaction as the delete.
- `redirect()` is called only in `signOut`, outside any try. The eleven `NEXT_REDIRECT` rethrow blocks (nine in
  `prompts/actions.ts`, two in `editor/actions.ts`) guard bodies that never redirect.

## Validation commands

These are the CI gates in `.github/workflows/ci.yml`, in order:

```bash
npx prisma validate
npm run lint
npx tsc --noEmit
npm test
bash scripts/audit-code-size.sh --summary
npm run build
```

The database suites need `TEST_DATABASE_URL` pointing at a migrated disposable Postgres (`npx prisma migrate deploy`
against it). They skip without it and throw in GitHub Actions without it. This cloud session had no such database
set up for the suite, so the 29 database-backed tests skipped here; CI runs them on `postgres:17-alpine`.

## Candidate task breakdown

The order assumes Q1 is answered with the injected seam. `[P]` marks tasks that can run in parallel once the harness
task is in.

| Task | Covers | Agent | Depends on |
|---|---|---|---|
| T1 Harness | The action-test seam (Q1), `createTestFolder` and the `server-only` alias if Q5 adds the package | senior-backend-engineer | none |
| T2 `[P]` ensure-profile | #40: plain server-only module, a race-free upsert, a concurrency test | senior-backend-engineer | T1 |
| T3 `[P]` auth actions | #42 and F-4: `safeParse`, only email and password reach Supabase, fixed error messages; the route handler per Q6 | senior-backend-engineer | T1 |
| T4 `[P]` folders | #41 (folder part), #43, F-6: a folders service and schemas, parent ownership, `ActionResult`, descendant prompt ids in one transaction, callers updated, isolation tests | senior-backend-engineer, then senior-frontend-engineer for the callers | T1 |
| T5 `[P]` prompts | #41 (prompt part), F-2: folder ownership in `createPrompt`, a rename schema, `assignTagsToPrompt` scoped, schemas for the unvalidated inputs per Q4, isolation tests; the #51 split if Q2 pulls it in | senior-backend-engineer | T1 |
| T6 `[P]` profile, workspace, dashboard | Q4 scope: schemas and `ActionResult` where missing, isolation tests | senior-backend-engineer | T1 |
| T7 `[P]` sign-out purge | #44 and F-8: one client purge of the workspace cache, document cache, `prompt-` drafts (and tabs per Q7), cache getters check the user id, jsdom tests | senior-frontend-engineer | none |
| T8 Rule and CI | #45: the rule in `docs/rules/testing.md`, a check that every exported action has an isolation test, CI confirmation | qa-test-automation-engineer | T2 to T6 |
| T9 Docs sweep | The drift register, headers (F-9), the code-size register row, `wip/` reconciliation | documentation-manager | all |

#46 stays with the developer and does not block the PRP's code.

## Open questions

The developer answered Q1 to Q7 on 27/10/2026 and accepted each recommendation below. The decisions are:

- Q1: the injected seam.
- Q2: #51 is pulled into P7S2.
- Q3: every mutation is rate-limited now, and #48 keeps the shared store.
- Q4: every action gets validation and `ActionResult`.
- Q5: the `server-only` package is added.
- Q6: the `/auth/sign-out` route is deleted.
- Q7: the sign-out purge clears the tab store too.

Q8 was not put to the developer, so its recommendation stands as the default until the PRP review.

| ID | Question | Recommendation |
|---|---|---|
| Q1 | How does an isolation test authenticate when it calls an action? #45 says "auth stubbed at `createClient`", which `docs/rules/testing.md#rules` forbids | An injected seam. Each action's body becomes a plain-module function taking `(deps, input)`, where the deps are `getUser` and `db` with their real defaults; the `"use server"` export is a one-line wrapper. Tests drive it with the `src/test/db.ts` client and a fake `getUser`. This extends the P7S1 service convention, needs no Next internals and no GoTrue in CI, and leaves only the uniform `cookies()` wiring untested |
| Q2 | Pull #51 (split `prompts/actions.ts`, centralise the `NEXT_REDIRECT` rethrow) into P7S2? | Yes. T5 rewrites most of that file into a service and shells anyway, so the split costs little here and avoids touching the same code twice |
| Q3 | Apply the existing in-memory limiter to every mutation now (part of #48), leaving the shared store to #48? | Yes, with a separate higher limit for autosave. It closes most of F-1 cheaply; #48 keeps the shared store |
| Q4 | Validation and `ActionResult` scope: the issues' list only, or every action as #39's outcome states? | Every action. Otherwise DR-12 stays open with nothing recording the gap once DR-1's caveat is deleted |
| Q5 | Add the `server-only` package (a new dependency) to guard `ensure-profile.ts` and the service modules? | Yes, as the Next docs direct, with the Vitest alias. Removing the directive alone fixes #40; the package adds a build-time error if a client component ever imports the module |
| Q6 | Delete the unused `/auth/sign-out` route handler? | Yes. It has no caller and bypasses the client purge; `docs/rules/project.md:76` changes with it |
| Q7 | Should the sign-out purge also clear the persisted tab store? | Yes. The tabs belong to the user who opened them, and `useTabCleanup` would close them anyway |
| Q8 | Enforce folder ownership with composite foreign keys (a migration) as well as in application code? | No, not in P7S2. Do the application check, which the rules name as the boundary, and file the composite keys as a P7S3 issue |
