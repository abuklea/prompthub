# PromptHub
## P7S2 - Server-side Security Hardening - INITIAL REPORT

| `Title` | `Created` | `Last modified` |
|---------|-----------|-----------------|
| P7S2 - Server-side Security Hardening - INITIAL REPORT | 29/10/2026 19:34 GMT+10 | 29/10/2026 19:56 GMT+10 |

## Table of Contents
- [Review Status](#review-status)
- [Overview](#overview)
- [Research Summary](#research-summary)
- [Task Breakdown](#task-breakdown)
- [Issues Created and Edited](#issues-created-and-edited)
- [Drift Register](#drift-register)
- [Parallelization Strategy](#parallelization-strategy)
- [Stage 6 Dispatch Plan](#stage-6-dispatch-plan)
- [Dependencies](#dependencies)
- [Risk Assessment](#risk-assessment)
- [Success Criteria](#success-criteria)
- [Estimated Timeline](#estimated-timeline)

## Review Status

REVIEWED (score 8/10). The commit history holds three review rounds of the PRP. Commit `14c9110` records an independent
review that scored the first draft 6/10. Commits `290771d` and `cd5a88a` are the revisions after the first and the
second review; the score of the second round is not recorded. Commit `4f37bbd` (29/10/2026 18:28) records that round 3
scored 8/10 with no blockers and applies its fixes. No review document holds the rubric, so the score rests on those
commit messages. The PRP's own confidence that an agent given a brief, the contracts and the code produces gated code
for its task is 6.5 of 10, because nothing was run: the `createMany` race, the `P2025` mapping, the recursive query,
the `server-only` alias file, the auth error codes and the Prisma Client's handling of the nullable composite relation
are unverified, each with a test that will show the truth. The developer took Q1 to Q7 on 27/10/2026 and Q8, D4, D5,
D9, D10 and the strict Q4 on 29/10/2026. The planner's other decisions (D1 to D3 and D6 to D8) were not put to the
developer and stand as written.

## Overview

[The PRP](../P7S2-server-side-security-hardening.md) brings every server action under one pattern, in sixteen tasks.

1. The package `server-only`, and `ensureProfileExists(db, userId)` as a server-only module that is no longer an action
   (T1).
2. The action seam: a runner that fixes the order parse, authenticate, rate-limit, ensure the profile, run and catch, a
   Prisma not-found helper, and separate rate-limit buckets for saves (30 a minute) and autosave (240 a minute) (T2),
   with the test factories and fake deps that every isolation suite uses (T3).
3. Every action as a one-line wrapper over a handler of `(deps, input)` with a Zod schema and an `ActionResult` result:
   `signIn` and `signUp` pass only `{ email, password }` and return fixed messages (T4); the folder actions check owners
   and `deleteFolder` returns the whole tree (T5); the prompt CRUD and listing actions (T6); the tag and history actions
   write with a scoped `update` and finish the split of `prompts/actions.ts` (T7); the editor, profile, workspace and
   dashboard actions (T8). 24 of the 25 remaining actions are wrappers and `signOut` keeps its body.
4. A client purge on sign-out that clears both caches, the `prompt-` drafts, the tabs and the UI selection, a workspace
   cache bound to one viewer, and the deletion of the unused sign-out route (T9), with a question first when work is
   unsaved (T14).
5. One isolation test for each of the 22 tenant actions, and a pure checker and a rule in `docs/rules/testing.md` that
   require one for every new action (T10).
6. Composite foreign keys, so that the database refuses a folder under another user's folder and a prompt in another
   user's folder (T13).
7. An independent security review (T11), a documentation sweep (T12), corrected agent definitions that run first (T15),
   and the developer checks (T16).

## Research Summary

The research is in [the PRP](../P7S2-server-side-security-hardening.md), its five companion documents and
[the research notes](../../wip/P7S2-research-notes.md). This section lists what the execution depends on.

| Finding | Where it matters | Source |
|---|---|---|
| Eight modules carry `"use server"` and export 27 functions (counted again at `4f37bbd`: 3, 1, 2, 5, 2, 12, 1 and 1); 22 touch tenant data and get a cross-user test, `searchPrompts` and `ensureProfileExists` stop being actions, 25 remain | T1, T6, T10 | [PRP, Why](../P7S2-server-side-security-hardening.md#why) |
| No test imports an action; the only isolation tests sit below the action layer (`src/features/editor/service.save.test.ts:169`) | T2 to T8, T10 | [PRP, Why](../P7S2-server-side-security-hardening.md#why) |
| Issue #45 proposed stubbing auth at `createClient`, which `docs/rules/testing.md#rules` forbids; the developer chose an injected seam (Q1) | T2, T3 | [Action contracts, The Seam](../docs/P7S2-action-contracts.md#the-seam) |
| `assignTagsToPrompt` updates by `id` alone after a separate check (`src/features/prompts/actions.ts:588-595`); `createPrompt` and `createFolder` write an unchecked `folderId` or `parentId` (F-2) | T5, T6, T7, T13 | [Research notes, Findings](../../wip/P7S2-research-notes.md#findings) |
| Importing any export of an action module registers all of them; one added import made `ensureProfileExists` a public endpoint that creates a `Profile` for any id (F-3) | T1, T10, T16 | [Research notes, Findings](../../wip/P7S2-research-notes.md#findings) |
| Prisma 6.19.0 `upsert` with an empty `update` raced in 205 to 210 of 240 concurrent first calls; `createMany` with `skipDuplicates` passed all 240 (probe, 26/10/2026) | T1 | [Domain contracts, ensureProfileExists](../docs/P7S2-domain-contracts.md#ensureprofileexists) |
| A composite key skips a row with a NULL column, so root folders and unfiled prompts stay valid; on a throwaway local Postgres the migration applied all or nothing, failed with `P3018` on a seeded violation and the recovery worked (29/10/2026); nothing ran against Supabase | T13, T16 | [Domain contracts, Composite Tenant Keys](../docs/P7S2-domain-contracts.md#composite-tenant-keys) |
| Sign-out clears only the document cache, the workspace cache never checks its user id, the tab store keeps the previous user's titles on disk and `POST /auth/sign-out` has no caller (F-6, F-7, F-8) | T5, T9, T14 | [Research notes, Findings](../../wip/P7S2-research-notes.md#findings) |
| `src/features/prompts/actions.ts` is the one RED source file (674 lines, nine `NEXT_REDIRECT` rethrows) | T6, T7 | [Code size register](../../docs/rules/code-size-register.md) |
| The baseline measured again at `4f37bbd` on 29/10/2026 equals the PRP's figures: 340 tests passed and 29 skipped (30 files passed, 2 skipped), `tsc` exit 0, 15 `max-lines-per-function` warnings, size audit source GREEN 99, YELLOW 2, RED 1, test GREEN 38, YELLOW 2, RED 0, PASS | every task | [PRP, Validation Loop](../P7S2-server-side-security-hardening.md#validation-loop) |

Existing files built upon: the seven `actions.ts` files under
`src/features/{auth,dashboard,editor,folders,profile,prompts,workspace}`, `src/lib/ensure-profile.ts`,
`src/lib/rate-limit.ts`, `src/features/editor/service.ts` (the pattern to mirror), `src/features/workspace/cache.ts`,
`src/test/db.ts`, `src/components/layout/Header.tsx`, `src/components/layout/WorkspacePreloader.tsx`,
`prisma/schema.prisma` and `vitest.config.ts`. The one schema change is the migration of T13; `package.json` gains
`server-only`; no environment variable and no CI step changes.

## Task Breakdown

The state of each task is on its issue; this table is a write-time snapshot. The issue numbers follow the creation
order, which is the execution order, so T15 is #108 and T7 (#116) comes after T8 (#115).

| Task | Issue | Description | Assignee | [P] | After | Hours |
|---|---|---|---|---|---|---|
| P7S2T1 | #109 | Add server-only and fix ensureProfileExists | `senior-backend-engineer` | | T15 | 3 |
| P7S2T2 | #110 | Add the action seam and the autosave limit | `senior-backend-engineer` | | T1 | 3 |
| P7S2T3 | #111 | Add the test factories and the fake deps | `qa-test-automation-engineer` | | T2 | 2.5 |
| P7S2T4 | #112 | Validate and sanitise signIn and signUp | `senior-backend-engineer` | with T5, T6, T8 | T3 | 3 |
| P7S2T5 | #113 | Harden the folder actions and close the tabs of a deleted tree | `senior-backend-engineer`, `senior-frontend-engineer` | with T4, T6, T8 | T3 | 4 |
| P7S2T6 | #114 | Harden the prompt CRUD and listing actions | `senior-backend-engineer`, `senior-frontend-engineer` | with T4, T5, T8 | T3 | 4 |
| P7S2T7 | #116 | Split the rest of prompts/actions.ts and harden tags and history | `senior-backend-engineer`, `senior-frontend-engineer` | | T6, T8 | 4 |
| P7S2T8 | #115 | Move the editor, profile, workspace and dashboard actions onto the seam | `senior-backend-engineer`, `senior-frontend-engineer` | with T4, T5, T6 | T3 | 3.5 |
| P7S2T9 | #117 | Purge client state on sign-out and delete the sign-out route | `senior-frontend-engineer` | | T4, T5, T8 | 4 |
| P7S2T10 | #118 | Add the isolation coverage rule | `qa-test-automation-engineer` | | T4 to T8 | 2.5 |
| P7S2T11 | #121 | Run the independent security review | `security-analyst` | | T9, T10, T13, T14 | 1.5 |
| P7S2T12 | #122 | Sweep the documentation | `documentation-manager` | | T11 | 2.5 |
| P7S2T13 | #119 | Add composite tenant keys | `senior-backend-engineer` | | T5, T6, T8 | 3.5 |
| P7S2T14 | #120 | Ask before signing out with unsaved work | `senior-frontend-engineer` | | T9 | 1.5 |
| P7S2T15 | #108 | Correct the agent definitions | `documentation-manager` | | none (first) | 0.5 |
| P7S2T16 | #123 | Run the developer checks (`type: dev-review`) | developer | | T12 | 1.5 |

## Issues Created and Edited

| Issue | What | State at creation |
|---|---|---|
| #108 to #123 | The sixteen tasks, sub-issues of epic #39, each with the milestone `Data integrity`; #123 is the `type: dev-review` issue for the browser checks, the composite keys on Supabase and the follow-ups | T15 `status: ready`; the others `status: backlog` with `flag: blocked` until their blockers close |
| #105 | Follow-up F-1: per-user row and byte caps, a child of #47 | `status: backlog`, `flag: review` |
| #106 | Follow-up: a session that ends without the sign-out button leaves drafts and tab titles on disk; in no epic | `status: backlog`, `flag: review` |
| #107 | Follow-up: tag ownership in the database through an explicit join model; in no epic | `status: backlog`, `flag: review` |
| #39 | Edited: the PRP line, a Background that points at the PRP and this report, #51 in the child list, a `## Tasks` list of the sixteen tasks in execution order, and the exit criteria | |
| #47 | Edited: #51 removed from its child list and #105 added, with the move stated in its Background | |
| #51 | Re-parented from #47 to #39 through the REST API, and its milestone changed to `Data integrity` | |
| #40 to #45, #48, #51 | Comment: which task delivers the issue, the wording changes the developer decided, and the current line citations for #41 and #44 | |

Every task issue carries `Blocked by` as its own sentence and a native blocked-by relationship that matches the After
column (27 relationships). `.github/scripts/board-sync.sh` ran from the developer's login after the last issue was
created: it linked the sixteen tasks under #39 and #105 under #47, wrote the relationships, and corrected the board
fields of 20 cards (two of them, #102 and #103, were not mine). The card of #108 was in Backlog and was moved to Ready
with `sync-label-to-board.sh`, because the sweep treats the column as the truth. #46 stays its own `type: dev-review`
issue for the credential check. T15 ran after this report was written, as the PRP says. The developer reviewed it and
closed #108 on 29/10/2026, #109 (T1) is at `status: ready`, and the epic #39 is at `status: in-progress`. Priorities
and sizes are not in the PRP. A code or test task takes the
priority of the issue it delivers (T2, T3, T10 and T16 are high, T9 and T14 low, the rest medium), T11 takes the
epic's high priority, and the documentation tasks T12 and T15 are medium. A size follows the hours (XS under an hour, S
under four, M for the four four-hour tasks T5, T6, T7 and T9).

Four points differ from the text of the PRP, each small. The Task List says the INITIAL step files the follow-ups and
the brief of T16 told the developer to file them; they are filed here and the brief now says to check them and file any
further ones. The issue of T15 adds one sentence of the same paragraph to its scope, "Most other actions skip the rate
limit", which the PRP makes false in the same way as the sentence the brief names. The milestone of #51 follows its new
parent, because [the issue rules](../../docs/rules/github-issues.md#board-and-milestones) say that a scheduled issue
carries its epic's milestone. Priority and size labels were chosen as stated above.

## Drift Register

The register is [wip/P7S2-research-drift.md](../../wip/P7S2-research-drift.md): 26 rows, DR-1 to DR-26. Every code
citation was read at `481aae9` on 26/10/2026 and 27/10/2026, and `git diff --name-only 481aae9..HEAD` lists no file
outside `PRPs/` and `wip/` (HEAD is `4f37bbd`), so the code and rules citations are current; the P7S1 documents that
DR-24 cites are unchanged too. Its fixes are scheduled. T15 fixes DR-4, DR-5 and DR-21 first; T5 fixes DR-17, T6 fixes
DR-18 and DR-19, T7 fixes DR-20 (T6 deletes the row of `prompts/actions.ts` in the code-size register), and T9 fixes
DR-16 and DR-25. T12 fixes the rest and confirms the others against the final code. DR-23 is the developer's, in #46
and T16, and DR-26 gets a `type: docs` issue from T12.

One further item was found and fixed while writing this report, so it has no register row. The Open questions section
of [the research notes](../../wip/P7S2-research-notes.md) said that Q8 "was not put to the developer, so its
recommendation stands as the default until the PRP review", and its table recommended no composite keys. The developer
decided Q8 the other way on 29/10/2026 (the PRP's Decisions table, Task 13). The PRP is the right side: the sentence now
states the decision, and the table row still shows the recommendation as it was made. The stale citations in the issue
bodies (the register's second table: #41, #44, #45) are answered by the comments on those issues.

## Parallelization Strategy

```text
T15 → T1 → T2 → T3 → { T4 | T5 | T6 | T8 } → T7 → T9 → T10 → T13 → T14 → T11 → T12 → T16
```

| Phase | Work | Why |
|---|---|---|
| A | T15 | The agent definitions must be true before any executing agent reads them; nothing precedes it |
| B | T1, then T2, then T3 | T1 adds `server-only`, the alias and the coverage scope; T2 builds the seam on it; T3 adds the factories and fake deps that every isolation suite needs |
| C | T4, T5, T6 and T8 in parallel, one worktree each | Disjoint files: auth; folders with `workspace/cache.ts`; the prompt CRUD actions; the editor, profile, workspace and dashboard actions |
| D | T7 | Edits `prompts/actions.ts` after T6; waits for T8 so that it starts from a tree in which every suite of phase C passes |
| E | T9 | Edits `auth/actions.ts` (T4), `cache.ts` (T5) and `WorkspacePreloader.tsx` (T8) |
| F | T10 | Needs the isolation tests that T4 to T8 deliver |
| G | T13 | Changes the schema and regenerates the Prisma Client, so it runs alone, on its own database |
| H | T14 | Builds on `client-purge.ts` and `Header.tsx` from T9 |
| I | T11 | Reviews the final tree, including the migration and the confirmation |
| J | T12 | Sweeps the documents after the main session has fixed what T11 found |
| K | T16 | The developer's checks, after the sweep |

The main session merges, reviews and gates the whole of phase C before it starts phase D. Each task that has a frontend
step is one commit: the backend step leaves `tsc` failing until the callers change, so both steps run in the same
worktree before the commit. The order above is the PRP's Task List. T7, T9 and T13 also wait for T8, so that each starts
from a tree in which every suite of phase C passes.

## Stage 6 Dispatch Plan

Stage 6 has not started. T15, the one task that the PRP runs at INITIAL, is done: the developer reviewed it and closed
#108 on 29/10/2026. This section is the plan the main session follows from T1. An agent never commits, pushes, branches
or edits an issue ([the agent contract](../../.claude/AGENT-CONTRACT.md#never)). The main session reviews each diff, runs every gate on
the merged tree, commits with `Refs #NN`, moves each issue to `status: in-progress` before the dispatch and to
`status: in-review` after it, with a comment that states the gates run and what is unverified. Closing is the
developer's call ([the issue rules](../../docs/rules/github-issues.md#work-cycle)): a dependant keeps `flag: blocked`
until its blocker closes, so the main session starts a dispatch whose blockers sit at `status: in-review` only on the
developer's word.

Before the first dispatch of the parallel batch:

1. The main session provisions the test database: the shared `prompthub_test` for T1 to T10 and `prompthub_test_t13` for
   T13, with every migration applied. The commands are in
   [the PRP's validation loop](../P7S2-server-side-security-hardening.md#level-2-unit-and-postgres-backed-tests).
   Docker 29.8.2 and Compose 5.6.0 are installed here and the daemon answers; `TEST_DATABASE_URL` is unset,
   `node_modules` is present and `server-only` is not installed. The URL goes in the prompt of every task that needs the
   database (T1 to T8 and T13); an agent without it writes its failing tests, reports "red not shown: no database" and
   stops, and creates no role or database.
2. The work is committed before a worktree agent is dispatched. `.claude/settings.json` sets `worktree.baseRef` to
   `head`, so a worktree starts at the dispatcher's `HEAD` and cannot see uncommitted files. This report, the two small
   corrections to the research notes and to the brief of T16, and the edits of T15 were committed on branch
   `plan/P7S2-prp` at the developer's word on 29/10/2026; T1 to T3 are committed before T4, T5, T6 and T8 start.
3. Each prompt carries the PRP path, the task and issue number, the files it may touch, the brief and contract anchors,
   the validation commands, the starting commit and what the report must contain. A task with a backend and a frontend
   agent is two dispatches into the same worktree: steps 1 to 4 first, then step 5. Tasks that edit an `actions.ts`
   file, `ensure-profile.ts` or a migration need `prisma/schema.prisma` read first (the dependency guard).

| Dispatch | Agent | Isolation | Main session does afterwards |
|---|---|---|---|
| T15 | `documentation-manager` | shared checkout | Reviews the diff, moves #108 to `status: in-review` with a comment |
| T1 | `senior-backend-engineer` | shared checkout | Reads the lock diff (only `server-only` may change), runs the gates with and without the URL, commits |
| T2, T3 | `senior-backend-engineer`, `qa-test-automation-engineer` | shared checkout | Gates, commits; T3 is the last commit before the worktrees |
| T4, T5, T6, T8 | `senior-backend-engineer`, then `senior-frontend-engineer` for T5, T6 and T8 | one worktree each | Merges with `--no-ff`, one at a time, then runs every gate once on the merged batch |
| T7 | `senior-backend-engineer`, then `senior-frontend-engineer` | shared checkout | Gates, commits |
| T9, T14 | `senior-frontend-engineer` | shared checkout | Gates, commits; the browser flows are T16 |
| T10 | `qa-test-automation-engineer` | shared checkout | Gates, commits; the rule reads files, so it runs without a database |
| T13 | `senior-backend-engineer` | shared checkout, alone, with no other agent active | Runs `npx prisma migrate deploy` on the shared `prompthub_test` before the next gate run, then `npx prisma generate` |
| T11 | `security-analyst` | shared checkout, read-only | Fixes each finding or files an issue before T12 starts |
| T12 | `documentation-manager` | shared checkout | Gates, commits, then the REPORT |

After each merge the main session runs `npx prisma validate`, `npm run lint`, `npx tsc --noEmit`, `npm test`,
`bash scripts/audit-code-size.sh --summary` and `npm run build`, takes counts and changed files from the tools and not
from an agent's report, and checks that no lint warning was added (baseline 15). The size audit reports no RED file from
T6 on. The `maxTurns` of the agents are 100 for the backend, frontend and QA agents, 80 for `documentation-manager`
and 50 for `security-analyst`. An agent that stops without a report has hit its limit: the main session inspects its
worktree, reverts any experiment it left applied, and dispatches a narrower task.

Not part of Stage 6 and never run by an agent: the browser checks (#123), the CI run of the Postgres service container,
which cannot happen before a pull request exists because `ci.yml` triggers only on pushes to `master` and on pull
requests, the audit and the migration on Supabase (#123), and the credential check (#46). No pull request is opened
unless the developer asks for one. When one is, it carries `Closes #51` and `Refs #48`, and only `Refs` for #46 and
#123, which are `type: dev-review` issues. For #40 to #45 the rule is `Closes` when merging finishes the work and `Refs`
when a human check outside CI remains; the flows that only the browser checks of T16 cover (#43 and #44, and the caller
edits of #41) need `Refs`.

## Dependencies

| Item | Status |
|---|---|
| `server-only` | Not installed; T1 adds it (Q5) and it is the only dependency change. Next 14.2.35 aliases it at build time, `tsc` does not resolve it and under Vitest it throws, hence the alias to `node_modules/server-only/empty.js`, which is unverified until T1 installs the package |
| `zod ^3.25.76`, `@prisma/client` and `prisma ^6.19.0`, `next 14.2.35`, `vitest ^2.1.9`, `@supabase/ssr ^0.3.0`, `zustand ^4.5.2` | Already installed; no version changes |
| A local Postgres with `prompthub_test` and `prompthub_test_t13`, every migration applied | Provisioned by the main session before T1; Docker is available here |
| The `postgres:17-alpine` service in `ci.yml` | Exists since P7S1; not runnable before a pull request |
| Prerequisite PRPs | P7S1 (Complete, archived as `PRPs/complete/P7S1-editor-data-integrity.md`). P7S3 (#47) follows |

## Risk Assessment

| Risk | Mitigation |
|---|---|
| Nothing in the plan was run, and six behaviours are unverified (the `createMany` race, the `P2025` mapping, the recursive query, the alias file, the auth error codes, the Prisma Client with the partly null composite relation) | Each has a test written first that shows the truth; T13 stops and reports if the client rejects a root folder or an unfiled prompt; the auth messages fall back to the generic text when a code is missing |
| T13 changes the schema, regenerates the Prisma Client, and `migrate reset --force` erases the database it points at | It runs alone, on `prompthub_test_t13`, never on `prompthub_test` and never on Supabase; the migration SQL is printed by Prisma and checked against five statements; a `DROP INDEX "Tag_name_user_id_ci_key"` stops the task |
| The migration fails on Supabase when a violating row exists, and the failed run blocks every later deploy | The audit queries run first; the recovery (`migrate resolve --rolled-back`, clean, deploy) was verified locally; the runbook is in T16 and no agent runs it |
| Every action is rewritten, and a half-converted tree fails `tsc` | A task with a frontend step is one commit in one worktree; the gates run on the merged batch before the next phase |
| Parallel worktrees share one database and one set of test helpers | Every suite makes its own users; T3 caps the pool at five connections; T13 has its own database |
| Importing one export of an action module registers all of them | T10's checker requires `async function` exports only and reports the state of `ensure-profile.ts`; T16 counts the manifest ids (25); T11 reviews |
| The wrappers, `action-runtime.ts` and the cookie wiring have no unit test | The build, the manifest count, the wrapper check of T10 and the browser list of T16 cover them; the REPORT says so |
| T5, T6, T7 and T8 are the largest tasks (3.5 to 4 hours, two agents each) and could exhaust a turn budget | Each is two dispatches, backend steps then the frontend step; a stopped agent is re-dispatched with a narrower task |
| Existing tests must not change: `useActiveTabFolderSync.test.tsx` hydrates the workspace cache with no viewer bound, and `document-actions.test.ts` names the editor actions through an injected interface | The briefs design around both: a hydrate with no viewer adopts the snapshot's user, and no `actions.ts` file is imported by a test |
| The sign-out check covers the current browser tab only, and a session that ends without the button purges nothing | Stated in T14 and T16; the second gap is filed as #106 |

## Success Criteria

- [ ] `ensure-profile.ts` has no `"use server"`, imports `server-only`, and 50 concurrent first calls for one id
  succeed and leave one row
- [ ] 24 of the 25 remaining actions are wrappers over handlers of `(deps, input)` (`signOut` keeps its body); each
  handler module imports `server-only`; no handler imports `@/lib/db`, `action-runtime.ts` or the Supabase client
- [ ] A wrong input shape returns a fixed message without reaching the database; every action but `signOut` returns
  `ActionResult`, and the dashboard page renders zeros when `getDashboardMetrics` fails
- [ ] User B calling any of the 22 tenant actions with A's ids gets what a missing id gets, A's rows are unchanged, and
  the test is titled `"<action>: user B ..."`
- [ ] `createPrompt` and `createFolder` refuse a folder or parent the user does not own and write nothing, and the
  database rejects the same rows if written directly; `assignTagsToPrompt` writes with `update` where `{ id, user_id }`
- [ ] `signIn` and `signUp` pass exactly `{ email, password }` to Supabase and return only fixed messages
- [ ] Deleting X with descendants Y and Z returns all folder and prompt ids; the callers close every tab and drop every
  workspace-cache entry
- [ ] The 31st `saveNewVersion` or `restorePromptVersion` in a minute is refused independently of the 31st other
  mutation; autosave allows 240
- [ ] With unsaved work Sign Out asks first and Cancel changes nothing; confirmed, or with nothing unsaved, it leaves no
  `prompt-` key, empty caches, no tabs (on disk too) and a reset selection; the settings key survives; the workspace
  cache returns nothing once another user is bound
- [ ] `src/app/auth/sign-out/route.ts` is gone; `prompts/actions.ts` is under 300 lines with no register row
- [ ] `docs/rules/testing.md` requires an isolation test per new action and `action-coverage.test.ts` enforces it
- [ ] Every CI gate passes, no lint warning is added, each new file in the coverage scope reaches 80% on every measure,
  and every drift-register row is fixed or filed
- [ ] Each defect has a test that failed first, with the failing output pasted in the REPORT; no existing test was
  edited
- [ ] The browser checks, the CI run, the Supabase audit and migration and the credential rotation are listed as not
  run, and handed to #123, #46 and the first pull request

## Estimated Timeline

| Phase | Tasks | Hours |
|---|---|---|
| A | T15 (0.5) | 0.5 |
| B | T1 (3), T2 (3), T3 (2.5) | 8.5 |
| C | T4 (3), T5 (4), T6 (4), T8 (3.5), in parallel | 4 on the clock, 14.5 of work |
| D | T7 | 4 |
| E | T9 | 4 |
| F | T10 | 2.5 |
| G | T13 | 3.5 |
| H | T14 | 1.5 |
| I | T11 | 1.5 |
| J | T12 | 2.5 |
| K | T16, the developer | 1.5 |

The task hours add up to 44.5, inside the PRP's estimate of 42 to 50 hours (6 days). With phase C in parallel the
critical path of the agent work is 34 hours, before the main session's review, merging and gating after every phase. The
milestone `Data integrity`, which holds the epic and its tasks, was due 02/11/2026, four days after this report. On
29/10/2026 the developer chose to move the date, and the main session set it to 13/11/2026: six working days from
30/10/2026 end on 06/11/2026, and the date adds one week for review and the Supabase step.

----
**Plan Status**: ACTIVE
**PRP Status**: IN PROGRESS
**PRP ID**: P7S2
**GitHub Issues**: #39 (PRP); tasks #108-#122 (P7S2T15, P7S2T1-P7S2T6, P7S2T8, P7S2T7, P7S2T9, P7S2T10, P7S2T13, P7S2T14, P7S2T11, P7S2T12, in that order); dev-review #123 (P7S2T16) and #46; follow-ups #105, #106, #107
**PRP Document**: P7S2-server-side-security-hardening
**Tasks**: 16 tasks (P7S2T1 - P7S2T16)
**Phase**: Phase 7 - Hardening (Server-side security)
**Dependencies**: P7S1 (Complete)
**Implementation Status**: NOT YET STARTED (P7S2)
**Testing Status**: NOT YET TESTED
**Next PRP**: P7S3 - Production readiness
**Documentation**:
- PRPs/docs/P7S2-action-contracts.md
- PRPs/docs/P7S2-domain-contracts.md
- PRPs/docs/P7S2-task-briefs.md
- PRPs/docs/P7S2-task-briefs-2.md
- PRPs/docs/P7S2-task-context.md
- wip/P7S2-research-drift.md
- wip/P7S2-research-notes.md
**Recommendations**:
Agents:
- `senior-backend-engineer` (Tasks 1-2, 13, and the backend steps of Tasks 4-8)
- `qa-test-automation-engineer` (Tasks 3, 10)
- `senior-frontend-engineer` (the caller steps of Tasks 5-8, Tasks 9, 14)
- `security-analyst` (Task 11)
- `documentation-manager` (Tasks 12, 15)
Notes:
- The PRP scored 8/10 in its last review; its own confidence is 6.5/10 because nothing was run
- Task 15 ran at INITIAL, as the PRP says, and the developer closed #108 after review; Stage 6 has not started
- Tasks 5-8 are one commit each (backend step, then caller step); Task 13 runs alone on its own database; Task 16 is the developer's
- The pull request carries `Closes #51` and `Refs #48`; #46 and #123 only ever get `Refs`
- The board was synced from the developer's login; the milestone `Data integrity` moved from 02/11/2026 to 13/11/2026
**Estimated Implementation Time (FTE)**: 42-50 hours (6 days)
