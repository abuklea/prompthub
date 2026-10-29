# PromptHub
## P7S2 - Server-side Security Hardening - COMPLETION REPORT

| `Title` | `Created` | `Last modified` |
|---------|-----------|-----------------|
| P7S2 - Server-side Security Hardening - COMPLETION REPORT | 29/10/2026 22:35 GMT+10 | 30/10/2026 01:12 GMT+10 |

## Table of Contents
- [Overview](#overview)
- [Implementation Summary](#implementation-summary)
  - [The action seam](#the-action-seam)
  - [Actions and handlers](#actions-and-handlers)
  - [Database](#database)
  - [Client](#client)
  - [Test harness and the coverage rule](#test-harness-and-the-coverage-rule)
  - [Documentation](#documentation)
- [Process](#process)
- [Commits](#commits)
- [Verification Results](#verification-results)
  - [Gates](#gates)
  - [Coverage](#coverage)
  - [Red runs](#red-runs)
  - [Feature verification](#feature-verification)
  - [Security review](#security-review)
  - [Not verified](#not-verified)
- [Files Changed](#files-changed)
- [Notes](#notes)
  - [Deviations from the PRP](#deviations-from-the-prp)
  - [Limitations and accepted behaviour](#limitations-and-accepted-behaviour)
  - [Behaviour changes callers will see](#behaviour-changes-callers-will-see)
  - [Issues](#issues)
  - [For the developer](#for-the-developer)

## Overview

[The PRP](../complete/P7S2-server-side-security-hardening.md) set out to bring every server action under one pattern, in sixteen
tasks (P7S2T1 to P7S2T16, issues #108 to #123) under epic #39. Fifteen tasks are built, gated and committed on branch
`feature/P7S2-server-side-security-hardening`; the sixteenth, T16 (#123), is the developer's browser, Supabase and
credential checks, and none of them has run. The code is complete and every CI gate that can run on this machine
passes. No browser flow has been run, the composite-key migration has not been applied to Supabase, and the CI run of
the Postgres service container belongs to the pull request that is opened after this report is committed; its result is
not recorded here. The PRP Status in the footer is `COMPLETE` and the PRP is archived in `PRPs/complete/`, at the
developer's instruction on 30/10/2026; the rules tie `COMPLETE` to a closed epic, and epic #39 stays open at
`status: in-review` until T16 passes.

Delivered, by part:

1. `ensureProfileExists(db, userId)` is a `server-only` helper that writes with `createMany` and `skipDuplicates`, no
   longer a public action that creates a Profile for any id; `server-only` is the one new dependency (T1).
2. The action seam: `runAction` fixes the order parse, authenticate, rate-limit, ensure the profile, run and catch;
   saves and autosave have rate-limit buckets of their own; the test factories, the fake `getUser` and a race seam let
   a suite call a handler against a real Postgres (T2, T3).
3. Every action but `signOut` is a one-line wrapper over a handler `(deps, data: unknown)` with a Zod schema and an
   `ActionResult` result: 25 actions in nine wrapper files, `signIn` and `signUp` passing Supabase only
   `{ email, password }` and returning fixed messages, the folder actions checking owners and `deleteFolder` returning
   the whole tree it removes, the prompt, tag, history, editor, profile, workspace and dashboard actions scoped by
   `user_id`, and `prompts/actions.ts` split from 675 lines to 112 (T4 to T8).
4. A client purge on sign-out that clears both caches, the `prompt-` drafts, the tabs on disk and in memory and the UI
   selection, a workspace cache bound to one viewer, the deleted sign-out route, and a question before the purge when
   work is unsaved (T9, T14).
5. An isolation test for each of the 22 tenant actions against a real Postgres, and a rule in `docs/rules/testing.md`
   with a checker that fails `npm test` when a new action lacks one (T10).
6. Composite foreign keys, so the database refuses a folder under another user's folder and a prompt in another user's
   folder (T13).
7. An independent security review with one fix (T11), a documentation sweep that closed the drift register (T12), and
   corrected agent definitions that ran first (T15).

The figures below were measured on 29/10/2026 on commit `4371fab`, before the first version of this report was
committed, and the gates were measured again on 30/10/2026 on `4e644b6`, after the change that the developer chose for
review finding S-4.

## Implementation Summary

### The action seam

`src/lib/action-runner.ts` holds `runAction(deps, spec, data)`, the types `ActionDeps` (`getUser` and `db`), `AuthDeps`,
`ActionSpec` and `LimitClass`, and `noInputSchema`. It is a plain module that imports `server-only` and nothing from
`next/*`. A spec names the schema, the two fixed messages (`invalid` and `failure`), the limit class (`mutation`,
`save`, `autosave` or `none`), whether to ensure the profile, and a `run({ db, user, input })` body. The order is fixed:
parse, `getUser`, limit by `user.id`, `ensureProfileExists`, `run`; any error with a string `digest` (a Next redirect,
not-found or dynamic-usage error) is rethrown and every other error is logged under the action's name and becomes
`spec.failure`. The user comes only from `deps.getUser` and the input carries no user id, so a handler cannot scope a
query by a value the client chose.

`src/lib/action-runtime.ts` builds the real `actionDeps` and `authDeps` (the Prisma client, the Supabase user, the
client IP and the Supabase auth client), calling `createClient()` and `headers()` inside the functions. It is the only
module that imports `@/lib/db` for actions, and no test imports it. `src/lib/prisma-errors.ts` holds `isNotFoundError`
for Prisma `P2025`. `src/lib/rate-limit.ts` gained `checkSaveRateLimit` (30 a minute) and `checkAutosaveRateLimit` (240
a minute), each in its own store. `src/lib/bounded-array.ts` (the fix for review finding S-1) refuses an over-long
list before it parses any element.

### Actions and handlers

Each feature has a `handlers.ts` of `server-only` functions and an `actions.ts` of one-line `"use server"` wrappers
that pass `actionDeps` to them. The prompts feature has more files because of the split: `handlers.ts`,
`search-handlers.ts` (the full-text search, no longer an action), `tag-handlers.ts` with `tag-actions.ts`, and
`history-handlers.ts` with `history-actions.ts`.

Auth. `signUp` and `signIn` parse with the existing schemas, limit per client IP, call Supabase with exactly
`{ email, password }`, create the profile of the returned user (a failure is logged and ignored) and answer with the
fixed texts of the contract, chosen by `AuthError.code` for `email_not_confirmed` and `weak_password`. `signOut` keeps
its body.

Folders. `createFolder` checks that the parent belongs to the user in the transaction that creates the folder.
`renameFolder` is one `update` where `{ id, user_id }`, and `P2025` maps to the not-found text. `deleteFolder` reads the
tree with a recursive query before the cascade and returns `{ folderIds, promptIds }`, every folder and prompt it
removes. A foreign folder gets the answer a missing one gets, and `getFolderChildren` of a foreign parent is an empty
list.

Prompts. `createPrompt` checks the folder in the same transaction as the insert, which closes finding F-2 for
prompts; `getPromptDetails` no longer returns an empty `tags` field; `renamePrompt` refuses a placeholder title;
`validatePrompts` refuses more than 200 ids. `assignTagsToPrompt` reads and writes in one transaction and writes with
`update` where `{ id, user_id }`. `restorePromptVersion` uses the `save` bucket.

Editor, profile, workspace and dashboard. `saveNewVersion` uses the `save` limit and `autoSavePrompt` the `autosave`
limit; `updateDisplayName` takes `{ displayName }` capped at 100; `getWorkspaceSnapshot` and `getDashboardMetrics`
return `ActionResult` and no longer throw. None of these actions imports the database or the Supabase client.

### Database

Migration `20261029114511_composite_tenant_keys` is the five statements `prisma migrate diff --script` printed: it
drops `Folder_parent_id_fkey` and `Prompt_folder_id_fkey`, adds `Folder_id_user_id_key`, and adds
`Folder_parent_id_user_id_fkey` and `Prompt_folder_id_user_id_fkey`, so a folder's parent and a prompt's folder must
belong to the same user. Both new keys are `ON DELETE CASCADE ON UPDATE RESTRICT`: a deleted folder still takes its
sub-folders and prompts with it, and a changed `user_id` is refused while a sub-folder or a prompt references the
folder, where the first version of the migration (`ON UPDATE CASCADE`, Prisma's default) would have moved the whole
subtree to the new owner (review finding S-4). On 30/10/2026 the developer chose `onUpdate: Restrict` and the migration
was regenerated in place, with the same folder name, before any shared database had it. A root folder and an unfiled
prompt stay valid, because Postgres skips a composite key with a null column. The schema carries a comment on each
relation against Prisma `disconnect`, which would null the shared `user_id`. The migration touches neither
`Tag_name_user_id_ci_key` nor `content_tsv`. Tags are not covered (follow-up #107). Nothing else in the schema changed.

### Client

`src/features/auth/client-purge.ts` holds `purgeClientState` and `hasUnsavedClientWork`. The purge clears the document
cache and the workspace cache, removes every storage key that starts with `prompt-`, resets the tab store (the
persisted envelope becomes `{"state":{"tabs":[],"activeTabId":null},"version":0}`) and the UI session state, and each
step runs even when another fails. `src/features/workspace/cache.ts` binds the cache to one viewer: binding another
user empties it, `clearWorkspaceCache` empties and unbinds, and a late snapshot of another user is ignored. The Header
asks "Sign out and discard unsaved work?" when a tab is dirty or a `prompt-` key exists, and signs out at once
otherwise; `WorkspacePreloader` receives `userId` from the app layout and binds the viewer first, whatever the preload
setting. `src/app/auth/sign-out/route.ts` is deleted.

The callers changed with their actions: the three folder components, `PromptList`, `DocumentToolbar`, `DocumentTab`,
`use-tab-cleanup`, the profile and dashboard pages and `WorkspacePreloader` use the object arguments and branch on
`result.success`, show the server's text in the toast they already use, and keep their rollbacks; `EditorPane` only
imports the history actions from their new file. A deleted folder closes the tab of every returned prompt id and drops
the whole tree from the workspace cache (`removeFolderTreeFromCache`).

### Test harness and the coverage rule

`src/test/db.ts` gained `createTestFolder`, `createTestTag`, `deleteTestUser`, a `folderId` field and
`withConnectionLimit`, which caps each suite's pool at five connections. `src/test/action-deps.ts` has `testDeps` and
`signedOutDeps`; `src/test/racing-db.ts` has `withRowDeletedBeforeUpdate`, which deletes a row just before its first
update so the real database raises the real `P2025`. `src/test/action-coverage.ts` is a pure checker that reports an
action with no `"<action>: user B ..."` title in a `*.isolation.test.ts` file, a wrapper that does not call
`handlers.<action>(actionDeps`, any export of a `"use server"` file other than an async function or a type, and an
`ensure-profile.ts` that is not server-only. Its real-tree test reads files only, so it runs when the Postgres suites are
skipped. The rule is stated in `docs/rules/testing.md#rules`.

### Documentation

The sweep (T12) corrected `docs/rules/project.md`, `README.md`, the two specs under `docs/project/`, the backend and QA
agent definitions in `.claude/agents` and `.gemini/agents`, three `.serena/memories` files and the moved line numbers in
three P7S1 working documents, and closed every row of the drift register (`wip/P7S2-research-drift.md`).

## Process

Everything ran in one local session on a branch created from `plan/P7S2-prp`, which holds the plan commits. The main
session dispatched each task to the agent the PRP names, reviewed the diff, ran every gate itself on the merged tree
and took counts from the tools, committed with `Refs #NN`, and moved each issue to `status: in-progress` before the
dispatch and to `status: in-review` after it, with a comment that states the gates and what is unverified. No agent
committed to the branch, pushed or edited an issue. The developer's word to start dependants whose blockers sit at
`status: in-review` was taken from the instruction to execute the PRP; the dependants therefore still carry
`flag: blocked`, and it clears when the developer closes the blockers.

T1 to T3 ran one after another in the shared checkout. T4, T5, T6 and T8 ran as four parallel agents in git worktrees,
each task with a frontend step as two dispatches: the backend agent committed in its worktree, and the frontend agent
fast-forwarded a new worktree to that commit before it changed the callers. The main session squashed each finished
branch into one commit, so every commit on the branch is a working state and the agents' intermediate commits are not in
the history. T9 ran in a worktree beside T7 in the shared checkout, and T14 in a worktree beside T10, because the files
and the dependencies are disjoint; the PRP's sequence is linear and this order keeps every dependency. T13 ran alone on
its own databases, and the main session then applied its migration to the shared `prompthub_test`.

Every task was test first: the red runs are in [Red runs](#red-runs). No existing test file was edited; the tests that
a task wrote are new files, and `git diff --name-status` between `b2d8409` and `4e644b6` shows no modified file that
matches `*.test.*`.

Things that went differently from the plan. The T11 agent hit its 50-turn limit before it wrote a file and was resumed
to write the report. The T12 agent overwrote `.claude/agents/senior-backend-engineer.md` with a placeholder by mistake
and rewrote it; the main session compared the file with `HEAD` and the diff holds only the intended changes.
`npm run lint` cannot run in a worktree nested under the main checkout (ESLint also reads the main checkout's
`.eslintrc.json` and stops on a plugin conflict), so worktree agents ran ESLint directly with the same config and the
main session ran `npm run lint` after every merge. Prisma 6 refuses `migrate reset` when an AI agent runs it unless the
user gives consent, so the from-scratch check of T13 ran `migrate deploy` on an empty database the main session had
created, with the same result. One full database run by the T14 agent hit four 5-second timeouts in suites it had not
touched while another agent used the same database; the three files passed alone and the full re-run was green, so I
treat it as load, not a defect. A stale `.next/types/app/auth/sign-out/route.ts` made one `tsc` run fail after the route
was deleted, until the next build regenerated `.next/types`; a fresh checkout has no `.next`.

On 30/10/2026 the developer took three decisions after the first version of this report: `onUpdate: Restrict` for the
composite keys (finding S-4), the PRP set to `COMPLETE` and archived, and a pull request so that CI runs. The key change
was one more backend task in the shared checkout, run with the same discipline as T13: the new test first, red against
the old keys (2 of 3 failed), then the schema, then the migration regenerated in place with `prisma migrate diff`, then
the seeded cross-user folder on a throwaway database that had the first eight migrations (the deploy failed with
`P3018` and applied nothing; `migrate resolve --rolled-back`, a clean-up and a second deploy applied it), then a
from-scratch apply on an empty database and the whole suite. The main session dropped and rebuilt the shared test
database `prompthub_test` with the regenerated migration and re-ran every gate. The archive moved the PRP to
`PRPs/complete/` and corrected the relative links to it, from it and in the plan documents, the INITIAL report and this
report, as the P7S1 archive did.

## Commits

`git log --oneline b2d8409..4e644b6` lists 19 commits since the commit that corrected the agent definitions (T15). The
commit that archives the PRP and revises this report, and the commits after it, are not in the list.

| Hash | Task | Message |
|---|---|---|
| `d5ffd46` | T1 | fix: ensureProfileExists is server-only and race-free (P7S2T1) |
| `f6d2319` | T1 | plan: P7S2 brief T1 notes the ts-expect-error the alias test needs |
| `ee1987e` | T2 | feat: add the action seam and the save and autosave limits (P7S2T2) |
| `2c564ad` | T3 | test: add the test factories, fake deps and race seam for the action suites (P7S2T3) |
| `21490d8` | T4 | feat: validate and sanitise signIn and signUp (P7S2T4) |
| `eb85ca9` | T5 | feat: harden the folder actions and close the tabs of a deleted tree (P7S2T5) |
| `57f8e81` | T6 | feat: harden the prompt CRUD and listing actions (P7S2T6) |
| `62d0f48` | T8 | feat: move the editor, profile, workspace and dashboard actions onto the seam (P7S2T8) |
| `735e2d0` | T8 | refactor: one noInputSchema for the actions that take no argument (P7S2T8) |
| `f4c2e44` | T7 | feat: harden the tag and history actions and finish the split of prompts/actions.ts (P7S2T7) |
| `bb55451` | T9 | feat: purge client state on sign-out and delete the sign-out route (P7S2T9) |
| `92f1dc1` | T10 | test: require an isolation test for every server action (P7S2T10) |
| `e572ef5` | T14 | feat: ask before signing out with unsaved work (P7S2T14) |
| `f42b8cd` | T13 | feat: add composite tenant keys so the database refuses cross-user folders (P7S2T13) |
| `940ca43` | T11 | docs: add the P7S2 security review report and a lock timeout to the Supabase runbook (P7S2T11) |
| `069a03d` | T11 | fix: refuse an over-long list before parsing its elements (P7S2T11 finding S-1) |
| `4371fab` | T12 | docs: bring the documents true after P7S2 and close the drift register (P7S2T12) |
| `09c24b2` | report | docs: P7S2 completion report and the PRP footer after execution |
| `4e644b6` | T13, S-4 | fix: the composite tenant keys refuse an owner change instead of cascading it (P7S2T13, review finding S-4) |

## Verification Results

### Gates

The baseline column was measured on 29/10/2026 before any change; the final column on `4e644b6` (30/10/2026), the
commit of the last code change, after the shared test database was rebuilt from scratch with the regenerated
migration. The documents committed since then change no code.

| Gate | Baseline | Final |
|---|---|---|
| `npx prisma validate` | valid | valid |
| `npm run lint` | 15 warnings, 0 errors | 14 warnings, 0 errors (the `Header` function warning went with the sign-out extraction) |
| `npx tsc --noEmit` | exit 0 | exit 0 |
| `npm test`, no database | 30 files passed and 2 skipped; 340 tests passed and 29 skipped | 43 files passed and 21 skipped; 512 tests passed and 185 skipped |
| `npm test`, with `TEST_DATABASE_URL` | 32 files, 369 tests passed | 64 files, 697 tests passed |
| `scripts/audit-code-size.sh --summary` | source GREEN 99, YELLOW 2, RED 1; test GREEN 38, YELLOW 2, RED 0; PASS | source GREEN 118, YELLOW 2, RED 0; test GREEN 71, YELLOW 4, RED 0; PASS, no register row |
| `npm run build` | passes; 26 action ids (the PRP's count from the 22/10/2026 build; not re-measured before T1) | passes; 25 action ids; no `/auth/sign-out` route |
| gitleaks | not run (CI only) | not run (CI only) |

The Postgres suites ran against the disposable local database `prompthub_test` on the Docker stack (host port 54322);
the final run left no rows. The four YELLOW test files include `action-coverage.check.test.ts` (390 lines, one fixture
suite). The grep checks of the Final Validation Checklist: `grep -rln 'from "@/lib/db"' src` lists
`src/lib/action-runtime.ts` and nothing else; `grep -rln 'from "@/lib/ensure-profile"' src` lists `action-runner.ts`,
`auth/handlers.ts` and the helper's own test; every `handlers.ts` and `*-handlers.ts` imports `server-only`; no file
under `src` contains `auth/sign-out`; `prompts/actions.ts` has 112 lines; the code-size register has no source row.

### Coverage

Measured on `4371fab` with `npx vitest run --coverage` against the database, over the 42 files in the scope of
`vitest.config.ts`: 99.61% of lines and statements (2049 of 2057), 96.76% of branches (778 of 804), 100% of functions
(193 of 193). Every file reaches 80% on every measure. The change of 30/10/2026 adds a test file and a schema line and no
file to the scope, so the figures stand. The files this PRP created or changed in scope:

| File | Lines | Functions | Branches |
|---|---|---|---|
| `src/lib/action-runner.ts`, `prisma-errors.ts`, `rate-limit.ts`, `ensure-profile.ts`, `bounded-array.ts` | 100% | 100% | 100% |
| `src/features/auth/handlers.ts`, `editor/handlers.ts`, `profile/handlers.ts` and `schemas.ts`, `workspace/handlers.ts`, `dashboard/handlers.ts`, `folders/schemas.ts`, `prompts/history-handlers.ts`, `prompts/schemas.ts` | 100% | 100% | 100% |
| `src/features/folders/handlers.ts` | 98.13% | 100% | 92.59% |
| `src/features/prompts/handlers.ts` | 100% | 100% | 97.14% |
| `src/features/prompts/search-handlers.ts` | 100% | 100% | 87.5% |
| `src/features/prompts/tag-handlers.ts` | 97.67% | 100% | 96.77% |
| `src/features/workspace/cache.ts` | 100% | 100% | 82.69% |
| `src/features/auth/client-purge.ts` | 95.65% | 100% | 92.3% |
| `src/test/db.ts` | 97.95% | 100% | 91.11% |
| `src/test/action-coverage.ts` | 100% | 100% | 98.66% |

Exempt, and said so in each task: the nine `"use server"` wrappers and `action-runtime.ts` (they need a request scope),
and the test helpers `action-deps.ts` and `racing-db.ts` (like `failing-db.ts`, they are tested through
`db.helpers.test.ts`).

### Red runs

Each task's first run failed for the stated reason, with the output pasted in the agent's report and summarised in the
completion comment on the task's issue. The runs in which some tests passed against the stub are marked, because a test
that cannot fail against a stub is a guard and not evidence.

| Task | New tests | First red run |
|---|---|---|
| T1 | `server-only-alias.test.ts`, `ensure-profile.test.ts` | the package's own throw; 49 of 50 concurrent calls raised `P2002` against find-then-create |
| T2 | `action-runner.test.ts`, `prisma-errors.test.ts`, `rate-limit.autosave.test.ts` | 19 of 19 runner cases failed on the stub's empty error; 10 of 16 limiter and `isNotFoundError` cases failed, the six "is false" cases passed |
| T3 | `db.helpers.test.ts` | 20 of 22 failed against stubs, then 6 of 22 with only the race seam and the deps still stubs |
| T4 | `auth/handlers.test.ts` | 25 of 26 failed: the stub leaked `confirmPassword` and `options` and returned Supabase's text |
| T5 | `folders/handlers*.test.ts`, `workspace/cache.tree.test.ts` | 11 of 22 failed (the foreign-id isolation cases passed against the stubs by construction); the cache test failed 6 of 6 |
| T6 | `prompts/handlers*.test.ts` | 7 of 30 failed: a prompt created in another user's folder (F-2), the empty `tags` field, B listing A's folder |
| T8 | editor, profile, workspace and dashboard handler tests | 46 of 46 failed against stubs; with the editor wired but unlimited, 6 of 19 failed on the missing limiters and the title check |
| T7 | tag and history handler tests | 23 of 23 failed against stubs |
| T9 | `workspace/cache.test.ts`, `client-purge.test.ts` | 11 of 14 failed against do-nothing stubs |
| T10 | `action-coverage.check.test.ts` | 41 of 59 fixture cases failed against a stub that reports nothing |
| T13 | `composite-fk.test.ts` | 2 of 6 failed: the database accepted a cross-user folder and a cross-user prompt |
| T14 | `client-purge.unsaved.test.ts` | 6 of 8 failed against a stub that returns false |
| S-1 | `bounded-array.test.ts` | 5 of 17 failed: 100,000 invalid elements produced 100,001 issues |
| S-4 | `composite-fk.update.test.ts` | 2 of 3 failed against `ON UPDATE CASCADE`: the database accepted the owner change and the sub-folder and its prompt moved to the new owner; the delete-cascade guard passed |

### Feature verification

| Success criterion of the PRP | Status |
|---|---|
| `ensure-profile.ts` has no `"use server"`, imports `server-only`, 50 concurrent first calls succeed and leave one row | COMPLETE (3 tests with a database; the coverage rule checks the file) |
| 24 of the 25 actions are wrappers over handlers; each handler module imports `server-only` and no handler imports the database, `action-runtime.ts` or the Supabase client | COMPLETE (checker, greps, manifest of 25) |
| A wrong input shape returns a fixed message without reaching the database; every action but `signOut` returns `ActionResult`; the dashboard page renders zeros when its metrics fail | COMPLETE for the handlers; the dashboard fallback is code only, no test and no browser run |
| User B calling any of the 22 tenant actions with A's ids gets what a missing id gets and A's rows are unchanged | COMPLETE (22 isolation tests, enforced by `action-coverage.test.ts`) |
| `createPrompt` and `createFolder` refuse a foreign folder or parent and write nothing; the database rejects the same rows; `assignTagsToPrompt` writes with `update` where `{ id, user_id }` | COMPLETE locally (handler tests, `composite-fk.test.ts`); not on Supabase |
| `signIn` and `signUp` pass exactly `{ email, password }` and return only fixed messages | COMPLETE (26 tests); the cloud GoTrue error codes are unverified |
| Deleting X with descendants returns all folder and prompt ids; the callers close every tab and drop every workspace-cache entry | server and cache COMPLETE (tests); the component wiring is checked by `tsc` and the build only |
| The 31st `saveNewVersion` or `restorePromptVersion` in a minute is refused independently of the 31st other mutation; autosave allows 240 | COMPLETE (runner, editor and history tests) |
| Sign Out asks first with unsaved work and Cancel changes nothing; confirmed, it leaves no `prompt-` key, empty caches, no tabs and a reset selection; the settings key survives; the workspace cache returns nothing once another user is bound | purge, check and cache COMPLETE (jsdom tests with the real `localStorage` and stores); the dialog and the flow are not run in a browser |
| `src/app/auth/sign-out/route.ts` is gone; `prompts/actions.ts` is under 300 lines with no register row | COMPLETE (build route table; 112 lines; empty register) |
| `docs/rules/testing.md` requires an isolation test per new action and `action-coverage.test.ts` enforces it | COMPLETE |
| Every CI gate passes, no lint warning is added, each new file in scope reaches 80%, every drift-register row is fixed or filed | COMPLETE locally; CI has not run; gitleaks has not run |

### Security review

The independent review (`wip/P7S2T11-security-review.md`, tree `f42b8cd`) found no cross-tenant read or write: every
Prisma statement is scoped by the signed-in user's id, directly or through a row already read under that scope. It
raised one Medium finding, S-1, fixed in `069a03d`: Zod 3.25.76 parses every element of an over-long array before it
reports the length and `runAction` parses before it authenticates, so a body of about a million elements cost about 200
ms of blocked CPU; `boundedArray` refuses it in constant time (200,000 invalid elements: 200,001 issues in 70 to 115 ms
before, one issue in 0.2 ms after). The Low and Info findings went to issues or notes: S-2 to #124, S-3 and S-8 to #48
and #105, S-5 into the Supabase runbook, S-6 to #107, S-9 and the body size limit to #47 and S-7 to D10 and #106. S-4,
the one the developer had to decide, was fixed on 30/10/2026 in `4e644b6`: the keys are `ON UPDATE RESTRICT` (see
[Database](#database)). The agent did not reach every item; its report lists what it did not review.

### Not verified

Every browser flow: the sign-out question and purge, signing in as a second user in the same tab, the deleted-folder tab
closing, the folder, prompt, tag, history, profile and dashboard callers, and the effect order in `WorkspacePreloader`
with the preload setting off. The CI run of the Postgres service container: it runs on the pull request, after this
report. The audit and the composite-key migration on Supabase, and the `ON UPDATE RESTRICT` rule there: it is tested on
the local Docker Postgres only, through the test client, because no application code changes a folder's owner. Whether
the cloud GoTrue sends `AuthError.code` for `email_not_confirmed` and `weak_password`, and whether the cloud project has
email confirmation on. The credential rotation of #46. The HTTP path and the memory cost of finding S-1. The wrappers and
`action-runtime.ts` at run time (the build type-checks them and the coverage rule checks their shape, nothing calls
them). Diagram rendering (the project has no render step).

## Files Changed

113 files changed between `b2d8409` and `4e644b6`: 58 added, 54 modified and 1 deleted. NEW is added, UPDATE is
modified and DELETE is deleted. The archive commit that follows also moves the PRP to `PRPs/complete/`.

```text
Seam and server helpers
NEW     src/lib/action-runner.ts, action-runner.test.ts
NEW     src/lib/action-runtime.ts
NEW     src/lib/prisma-errors.ts, prisma-errors.test.ts
NEW     src/lib/bounded-array.ts, bounded-array.test.ts
UPDATE  src/lib/ensure-profile.ts
NEW     src/lib/ensure-profile.test.ts, server-only-alias.test.ts
UPDATE  src/lib/rate-limit.ts
NEW     src/lib/rate-limit.autosave.test.ts

Actions and handlers
UPDATE  src/features/auth/actions.ts
NEW     src/features/auth/handlers.ts, handlers.test.ts
UPDATE  src/features/dashboard/actions.ts
NEW     src/features/dashboard/handlers.ts, handlers.test.ts, handlers.isolation.test.ts
UPDATE  src/features/editor/actions.ts, service.ts
NEW     src/features/editor/handlers.ts, handlers.test.ts, handlers.isolation.test.ts
UPDATE  src/features/folders/actions.ts
NEW     src/features/folders/schemas.ts, handlers.ts, handlers.test.ts, handlers.isolation.test.ts
UPDATE  src/features/profile/actions.ts
NEW     src/features/profile/schemas.ts, handlers.ts, handlers.test.ts, handlers.isolation.test.ts
UPDATE  src/features/prompts/actions.ts, schemas.ts
NEW     src/features/prompts/handlers.ts, handlers.test.ts, handlers.isolation.test.ts, search-handlers.ts
NEW     src/features/prompts/tag-actions.ts, tag-handlers.ts, tag-handlers.test.ts, tag-handlers.isolation.test.ts
NEW     src/features/prompts/history-actions.ts, history-handlers.ts, history-handlers.test.ts,
        history-handlers.isolation.test.ts
UPDATE  src/features/workspace/actions.ts
NEW     src/features/workspace/handlers.ts, handlers.test.ts, handlers.isolation.test.ts

Database
UPDATE  prisma/schema.prisma
NEW     prisma/migrations/20261029114511_composite_tenant_keys/migration.sql

Client
NEW     src/features/auth/client-purge.ts, client-purge.test.ts, client-purge.unsaved.test.ts
UPDATE  src/features/workspace/cache.ts
NEW     src/features/workspace/cache.test.ts, cache.tree.test.ts
UPDATE  src/stores/use-tab-store.ts, src/stores/use-ui-store.ts, src/features/tabs/types.ts
UPDATE  src/components/layout/Header.tsx, WorkspacePreloader.tsx, src/hooks/use-tab-cleanup.ts
UPDATE  src/features/folders/components/FolderItem.tsx, FolderTree.tsx, FolderToolbar.tsx
UPDATE  src/features/prompts/components/DocumentToolbar.tsx, PromptList.tsx
UPDATE  src/features/tabs/components/DocumentTab.tsx, src/features/editor/components/EditorPane.tsx
UPDATE  src/app/(app)/dashboard/page.tsx, layout.tsx, profile/page.tsx
DELETE  src/app/auth/sign-out/route.ts

Test harness, rule and configuration
UPDATE  src/test/db.ts
NEW     src/test/action-deps.ts, racing-db.ts, db.helpers.test.ts
NEW     src/test/action-coverage.ts, action-coverage.check.test.ts, action-coverage.test.ts
NEW     src/test/composite-fk.test.ts, composite-fk.update.test.ts
UPDATE  package.json, package-lock.json, vitest.config.ts

Documents
UPDATE  docs/rules/project.md, testing.md, code-size-register.md
UPDATE  README.md, docs/project/PromptHub_01_MVP_01.md, docs/project/PromptHub_05_TECH_01.md
UPDATE  .claude/agents/senior-backend-engineer.md, qa-test-automation-engineer.md (and the .gemini/agents copies)
UPDATE  .serena/memories/code_style_conventions.md, codebase_structure.md, project_overview.md
UPDATE  PRPs/docs/P7S1-editor-persistence-contracts.md, P7S1-task-briefs-client.md, P7S1-task-context.md
UPDATE  PRPs/docs/P7S2-action-contracts.md, P7S2-task-briefs.md, P7S2-task-briefs-2.md
UPDATE  wip/P7S2-research-drift.md
NEW     wip/P7S2T11-security-review.md, wip/P7S2T12-sweep-log.md
```

## Notes

### Deviations from the PRP

1. T1. The alias test carries `// @ts-expect-error` with a `Reason:`: the brief's plain `await import("server-only")`
   fails `tsc` with TS7016 because the package ships no types. The brief now says so.
2. T8. `noInputSchema` moved from `folders/schemas.ts` to `src/lib/action-runner.ts`: tasks 5 and 8 ran in parallel and
   each had written its own `z.undefined()`. The action contracts say where it lives.
3. T9. The same change corrects the statements about the deleted route in `docs/rules/project.md` and
   `.serena/memories/project_overview.md`, because the documentation rule requires it in the change that deletes a
   file; the PRP left DR-25 to T12.
4. T13. The from-scratch check ran `migrate deploy` on an empty database, not `migrate reset --force`, because Prisma
   refuses a reset run by an AI agent without the user's consent. The result is the same and nothing was destroyed.
5. T14. The sign-out button and its dialog are a `SignOutControl` function inside `Header.tsx`, which also removed the
   `Header` function's length warning.
6. T11. `boundedArray` and its test are new files the PRP did not plan; they fix review finding S-1.
7. Order. T9 ran beside T7 and T14 beside T10 (see [Process](#process)); the dependencies of the PRP hold.
8. Branch and commits. The PRP names no branch; `feature/P7S2-server-side-security-hardening` was created from
   `plan/P7S2-prp`. A task with a frontend step is one squashed commit, not the `--no-ff` merges of the dispatch plan,
   and no commit carries a session trailer, because `docs/rules/git.md` forbids signature lines.
9. Folder input types. `CreateFolderInput` and its three siblings are exported from `folders/schemas.ts`; the contract's
   wrapper example imports `CreateFolderInput` but never defined it.
10. T13, 30/10/2026. The two composite keys are `ON UPDATE RESTRICT`, where the contract planned Prisma's default
    `ON UPDATE CASCADE`: the developer's decision on review finding S-4. The migration was regenerated in place under the
    same folder name, because no shared database had it, and the contract says so.
11. Closing. The PRP is `COMPLETE` and archived while epic #39 stays open for #123, at the developer's instruction on
    30/10/2026, as P7S1 was; nothing on the tracker was closed.

### Limitations and accepted behaviour

The wrappers and `action-runtime.ts` have no unit test: they need a request scope and a GoTrue. The build, the manifest
count, the checker of T10 and the browser list cover them. The rate limiter is in memory and per instance, keyed for
sign-in and sign-up on the first `x-forwarded-for` value, which a client can choose behind the Docker gateway, and it
never evicts an entry (#48); the sign-in limit is not a brute-force control. Reads have no limit class, so
`getWorkspaceSnapshot` is as expensive as the user's rows (#105). `runAction` still parses a body of up to Next's 1 MB
default before it authenticates, with the array cost now bounded; `serverActions.bodySizeLimit` could be lowered (#47).

The composite keys cover folders and prompts only. A prompt that another session of the same user files into a
descendant folder between the two statements of `deleteFolder` is cascade-deleted without being in `promptIds`, so a tab
for it would stay open. The duplicate-title check of `createPrompt` is not atomic with the insert and no unique index
backs it. An optimistic folder with a `temp-` id fails Zod ("Invalid folder ID") instead of failing at the database, and
the callers' rollback handles it. The sign-out question and purge see only this browser tab's memory and the shared
`localStorage`: another open tab keeps its state, and a session that ends without the button purges nothing (#106). A
failing `getTags` shows a toast on every refresh. A failed `getDashboardMetrics` renders zeros without a message. The
project's buttons have no press (`active:`) state; the dialog buttons carry one by hand, and the shared fix belongs in
`src/components/ui/button.tsx`.

### Behaviour changes callers will see

`renamePrompt` refuses a placeholder title and `deletePrompt` is rate-limited; an empty-string tag id now fails the whole
`getPromptsByFolder` call; `restorePromptVersion` is limited to 30 a minute, and `createTag` and `assignTagsToPrompt` to
the mutation limit; `saveNewVersion` now checks the title after authentication and the limit, so an unauthenticated
caller with a placeholder title gets the unauthorised text; `getTags`, `getProfileDetails`, `updateDisplayName`,
`getWorkspaceSnapshot`, `getDashboardMetrics` and the five folder actions return `ActionResult` instead of throwing or
returning a bare value; sign-in and sign-up errors are fixed texts and no longer Supabase's message; the folder actions
and the prompt actions that changed take one object argument.

### Issues

| Issue | Role | End state |
|---|---|---|
| #39 | epic | `status: in-review` |
| #108 | T15, agent definitions | closed by the developer |
| #109 to #122 | T1 to T14 | `status: in-review`, `flag: blocked` until the developer closes their blockers |
| #123 | T16, `type: dev-review` | `status: backlog`, `flag: blocked`; the developer's checks and the Supabase runbook |
| #40, #42, #43, #44, #45, #51 | delivered issues | `status: in-review`; the pull request carries `Closes #51` and `Refs` for the rest, because #43 and #44 need the browser checks |
| #41 | folders, prompts, tags and the database keys | `status: in-review`; `Refs` |
| #48 | rate limits | open, `status: ready`: the in-memory limits are delivered, the shared store is not; `Refs #48` |
| #46 | credential rotation, `type: dev-review` | open, the developer's |
| #105, #106, #107 | follow-ups filed at INITIAL | `status: backlog` |
| #124, #125, #126 | follow-ups from the review and the sweep (profile for a stand-in user; the GEMINI.md references; the TDD guide) | `status: backlog` |

### For the developer

1. Run T16 (#123): the browser checks on the Docker stack, the composite-key audit and migration on Supabase (with the
   lock timeout of the runbook; the migration now carries `ON UPDATE RESTRICT`), the credential check of #46, and a look
   at #105 to #107 and #124 to #126.
2. Read the CI run of the pull request that follows this report. It carries `Closes #51` and `Refs #48`, and only
   `Refs` for the rest: for #40 to #45 the rule is `Closes` when merging finishes the work and `Refs` when a human check
   remains, and #41 to #44 each have a browser flow in T16. Merging closes #51 by itself; the other issues stay open
   until you close them.
3. The isolation rule sits in `docs/rules/testing.md`, which `documentation.md` calls identical across projects; it may
   belong in `project.md` with a pointer from `testing.md`.
4. The wip files of this PRP stay until the epic closes, because the archived PRP, the briefs and the issues link to
   them: `wip/P7S2-research-notes.md`, `wip/P7S2-research-drift.md`, `wip/P7S2T11-security-review.md` and
   `wip/P7S2T12-sweep-log.md`. Delete them with the closing commit and cite its hash here.
5. The bodies of the task issues cite the PRP as `PRPs/P7S2-server-side-security-hardening.md`; the file now lives in
   `PRPs/complete/`. The filename is stable and the issues were not edited.

----
**Report Status**: FINAL
**PRP Status**: COMPLETE
**PRP ID**: P7S2
**GitHub Issues**: #39 (PRP epic, in review); tasks #108-#122 (P7S2T15, P7S2T1-P7S2T6, P7S2T8, P7S2T7, P7S2T9, P7S2T10, P7S2T13, P7S2T14, P7S2T11, P7S2T12, in that order; #108 closed, the rest in review); dev-review #123 (P7S2T16, open, blocked) and #46 (open); delivered #40-#45 and #51 (in review); #48 (part delivered, open); follow-ups #105-#107 and #124-#126 (backlog)
**PRP Document**: P7S2-server-side-security-hardening
**Tasks**: 15 of 16 complete (P7S2T1 - P7S2T16); T16 is the developer's
**Phase**: Phase 7 - Hardening (Server-side security)
**Dependencies**: P7S1 (Complete)
**Implementation Status**: COMPLETE (P7S2)
**Testing Status**: COMPLETE (697/697 tests passed with a database; 512 passed and 185 skipped without; no browser run; the CI run of the pull request is not recorded here)
**Next PRP**: P7S3 - Production readiness
**Notes**:
- Code, tests and documents are complete for T1-T15; every browser flow, the CI run, the Supabase audit and migration and the credential rotation are unverified and belong to #123, #46 and the pull request
- PRP Status is COMPLETE and the PRP is archived in PRPs/complete/ at the developer's instruction on 30/10/2026, although epic #39 stays open at status: in-review for dev-review #123; the rules tie COMPLETE to a closed epic, and nothing on the tracker was closed
- Lint 14 warnings (baseline 15, none added); size audit PASS with no RED file and no register row; build passes with 25 action ids
- Per-file coverage at least 82.69% on every measure for all 42 files in scope; totals 99.61% of lines, 96.76% of branches
- The independent review found no cross-tenant read or write; its Medium finding (S-1) and S-4 (the keys are ON UPDATE RESTRICT, the developer's choice) are fixed
- No existing test was edited; the wip files are kept until the epic closes
**Completed**: 30/10/2026 01:12 GMT+10
