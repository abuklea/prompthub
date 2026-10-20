# PromptHub
## P7S1 - Editor Data Integrity - INITIAL REPORT

| `Title` | `Created` | `Last modified` |
|---------|-----------|-----------------|
| P7S1 - Editor Data Integrity - INITIAL REPORT | 20/10/2026 16:25 GMT+10 | 20/10/2026 16:25 GMT+10 |

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

REVIEWED, numeric score not recorded. The commit history shows three independent review rounds of the PRP and a final
review pass (`65de4fa`, `89634df`, `43ca30b`, `c08a8bc`), each followed by a revision of the PRP, the contract, the
briefs and the register. No commit or document records a score, so none is claimed here. The decisions D1, D2, D4 and
D5 are still the developer's to confirm; the PRP says work proceeds on them as written and a change redoes the tasks
that build on them (D1 redoes T2 and T3, D2 redoes T4 and T6, D4 redoes T8, D5 redoes T1 and the seams of every later
test). Nothing records a confirmation yet, which is why the dispatch plan below asks for one before T2.

## Overview

[The PRP](../P7S1-editor-data-integrity.md) makes every path by which the editor reads or writes a document
trustworthy, in nine tasks.

1. A Postgres-backed and DOM test harness with a CI service container (T1).
2. A server service where a version is the saved state, a restore snapshots the row it replaces and returns the
   restored row, and history orders by `id desc` (T2, T3).
3. Pure client modules: the sync helpers, a content-hash draft store, a user-checked document cache and a 30-second
   request limit (T4).
4. A loader that waits for the user id and reaches `ready` in one reducer action, so a fresh mount never ends empty
   (T5).
5. A draft hook that keeps a draft only while the working content differs from the server's, stashes a stale one
   instead of applying it, and an autosave that writes only after an edit (T6).
6. Persistence hooks that apply each completion by the id it started with, reset busy flags in `finally`, and fix the
   set-title save (T7).
7. A restore that replaces what the editor shows, a history dialog that loads its list when it opens, and the removal
   of the superseded code (T8).
8. A documentation and wip sweep (T9).

## Research Summary

The research is in the PRP and its four companion documents; this section lists what the execution depends on.

| Finding | Where it matters | Source |
|---|---|---|
| The suite is 29 tests in five files, all schemas and pure helpers; no persistence path has coverage | T1 builds the harness; every task adds tests first | `PRPs/P7S1-editor-data-integrity.md#why` |
| Five review findings (#32 to #36) were checked against the code and are accurate | The tasks fix them | `PRPs/P7S1-editor-data-integrity.md#why` |
| Six more defects of the same class were found, none reproduced end to end: the fresh-mount loader race (F-1, reproduced at hook level by a probe), the stale footer (F-2), a completion applied to the wrong document or a stuck flag (F-7), the history list never loading (F-8), and the tab-close Discard (F-9) | #72, #73 and the tasks fix F-1, F-2, F-7 and F-8; F-9 is #74, outside this PRP | `wip/P7S1-research-drift.md#findings-that-are-defects-not-drift` |
| `loadedRef` and the aborted load effect cause the empty editor | T5 replaces the protocol (D6) | `wip/P7S1-loader-race-diagnostic.test.tsx` |
| `VersionHistoryDialog` reads its list in `onOpenChange`, which Radix does not call when the parent sets `open` | T8 | `wip/P7S1-dialog-spike.test.tsx` |
| Server actions in one tab run one at a time, and a navigation orphans the queued ones, so every request runs under a 30-second limit | T4 adds `withTimeout`, T5 and T7 use it | `PRPs/docs/P7S1-task-context.md#known-gotchas` |
| `src/features/prompts/actions.ts` is RED (699 lines, registered, `max-lines` disabled) and is expected to stay above 600 | T3 reports the new count | `PRPs/docs/P7S1-task-briefs.md#p7s1t3-move-restore-and-history-into-the-service` |
| The client half is specified by four working reference implementations in `wip/` with 204 passing tests over shared typed fakes, and a mutation check that applies 83 deliberate defects | T4 to T8 adapt them | `PRPs/docs/P7S1-editor-persistence-contracts.md#purpose` |

Existing files built upon: `src/features/editor/actions.ts`, `src/features/prompts/actions.ts`,
`src/features/editor/hooks/useDocumentLoader.ts` and `useAutoSave.ts`,
`src/features/editor/components/EditorPane.tsx` (329 lines, YELLOW) and `VersionHistoryDialog.tsx`,
`src/features/editor/components/Editor.tsx`, `src/components/layout/Header.tsx`, `vitest.config.ts` and
`.github/workflows/ci.yml`. There is no schema change and no migration.

## Task Breakdown

The state of each task is on its issue; this table is a write-time snapshot.

| Task | Issue | Description | Assignee | [P] | After |
|---|---|---|---|---|---|
| P7S1T1 | #75 | Add the Postgres and DOM test harness and CI service | `qa-test-automation-engineer` | with T4 | none |
| P7S1T2 | #76 | Move save and autosave into a tested service with commit-style versions | `senior-backend-engineer` | with T4 | T1 |
| P7S1T3 | #77 | Move restore and history into the service | `senior-backend-engineer` | with T4 | T2 |
| P7S1T4 | #78 | Add the sync helpers, the draft store, the cache module and the request timeout | `senior-frontend-engineer` | with T1 to T3 | none |
| P7S1T5 | #79 | Rewrite the document loader protocol | `senior-frontend-engineer` | | T1, T4 |
| P7S1T6 | #80 | Replace the draft hook and add the autosave baseline | `senior-frontend-engineer` | | T5 |
| P7S1T7 | #81 | Extract the persistence hooks and fix the set-title save | `senior-frontend-engineer` | | T2, T3, T5, T6 |
| P7S1T8 | #82 | Restore into the editor, fix the history dialog and remove the superseded code | `senior-frontend-engineer` | | T3, T7 |
| P7S1T9 | #83 | Sweep the documentation and the wip files | `documentation-manager` | | T8 |

The `documentation-manager` also runs after T1, T3, T5 and T6, dispatched by the main session with the changed-file list
and the drift rows that the register assigns to that task. Those runs belong to the tasks they follow and have no issue
of their own. Every issue is a sub-issue of epic #31, carries `Blocked by` as its own sentence and a native blocked-by
relationship that matches the After column, and the milestone `Data integrity`.

## Issues Created and Edited

| Issue | What | State at creation |
|---|---|---|
| #72 | Bug: a fresh mount of the editor can end empty or wipe the loaded document (F-1), child of #31 | `status: ready` |
| #73 | Bug: the version history dialog never loads its list (F-8), child of #31 | `status: ready` |
| #74 | Bug: closing the tab of an autosaved, never-saved document offers Discard, which deletes it (F-9); not a child of #31 because it is a tab-close path outside this PRP | `status: backlog`, `flag: review` |
| #75 to #83 | The nine tasks, children of #31 | T1 and T4 `status: ready`; the others `status: backlog` with `flag: blocked` until their blockers close |
| #31 | Edited: the Background points at the PRP and this report, the child list gains #72 and #73, a `## Tasks` list holds the nine tasks in execution order | |
| #38 | Edited: the flows gain a cold open, an open after visiting Settings, the conflict toast and "Restore my text" (also while the editor is starting), the History list, Escape during a restore and the Discard prompt of #74; blocked also by #72 and #73 | |

Comments on #37, #41, #44, #45 and #53 are not made yet: the register assigns them to the main session when the work
they describe lands (drafts under `prompt-v1-<id>` for #44, the dropped "auth stubbed at `createClient`" wording for
#37 and #45, the removed unscoped `update` for #41, the unchanged payload size for #53). Follow-up issues for the
failed-autosave logging (F-3), the list rename that does not reach the open editor (F-4), whether untitled documents
should autosave (F-5) and the nullable `folder_id` (F-6) are filed after the REPORT.

No issue is at `status: in-progress` yet. The project board is not synced: GraphQL is blocked in cloud sessions
(`docs/rules/github-issues.md#sync-and-commands`), so the developer runs `.github/scripts/board-sync.sh` from a local
login. The blocked-by relationships and the sub-issue links were written through the REST API and the GitHub tools.

## Drift Register

The register is `wip/P7S1-research-drift.md`. It holds 22 open rows (DR-1 to DR-22) and the findings F-1 to F-9. It was
current when written on 20/10/2026 and nothing has changed in the repository since (`git status` is clean at
`caa4842`). Its fixes are scheduled: T1, T2, T3, T5, T6 and the documentation syncs after T1, T3, T5 and T6 fix rows as
the behaviour changes, and T9 (#83) verifies that nothing is left. DR-17 and the findings F-3 to F-6 and F-9 are handled
by the main session.

## Parallelization Strategy

| Phase | Work | Why |
|---|---|---|
| A | T1, and T4 in a worktree, in parallel | Disjoint files; T4 is node-only and needs neither the database nor the DOM environment |
| B | T2, then T3 | Both edit `service.ts`; T3 extends what T2 creates |
| C | T5 (Step 1 first) | Needs the DOM environment (T1) and the cache module (T4); the draft and persistence work builds on the loader |
| D | T6 | Rewrites the same load path as T5 |
| E | T7 (Step 1 first) | Needs the real action types from T2 and T3 and the draft hook from T6 |
| F | T8 (Step 1 first), then T9 | Needs `restorePromptVersion` returning `{ title, content }` and the persistence hooks |

T4 can run in parallel with phase B as well; the PRP allows T4 alongside any of T1 to T3. The chain T5, T6, T7, T8 is
strictly sequential because each rewrites `EditorPane.tsx` or the files it composes.

## Stage 6 Dispatch Plan

Stage 6 has not started. This section is the plan the main session follows, with what has to be true before each
dispatch. An agent never commits, pushes, branches or edits an issue
(`.claude/AGENT-CONTRACT.md#never`); the main session reviews each diff, runs every gate on the merged tree, commits
with `Refs #NN`, and moves each issue to `status: in-progress` before dispatch and `status: in-review` after, with a
comment that states the gates run and what is unverified.

Before any dispatch:

1. The developer confirms or changes D1, D2, D4 and D5, or says to proceed on them as written. The PRP states that work
   proceeds on them as written; the cost of a later change is the redo listed in [Review Status](#review-status).
2. The main session provisions the test database and passes `TEST_DATABASE_URL` in the prompt of T1, T2 and T3. The
   cloud session has `psql`, `pg_createcluster` and `docker` on the path; which of them works here is not yet checked.
   The recipes are in `PRPs/docs/P7S1-task-context.md#environment-for-database-tests`. An agent dispatched without the
   URL writes its failing tests, reports "red not shown: no database" and stops.
3. The work is committed before a worktree agent is dispatched. `.claude/settings.json` sets `worktree.baseRef` to
   `head`, so a worktree starts at the dispatcher's `HEAD`; each brief names that commit and tells the agent to reset to
   it if the worktree starts elsewhere.
4. Each agent's prompt carries the PRP path, the task and issue number, the files it may touch, the brief and contract
   anchors, the validation commands, the commit to start from, and what its report must contain. T5, T7 and T8 are
   dispatched in two halves.

| Dispatch | Agent | Isolation | Needs in the prompt | Main session does afterwards |
|---|---|---|---|---|
| T1 | `qa-test-automation-engineer` | shared checkout | `TEST_DATABASE_URL`, authorisation for the three devDependencies, `vitest.config.ts`, `.env.example` and `ci.yml` (the brief grants it) | Reviews, runs all gates with and without the URL, commits, then the documentation sync (DR-7, DR-8, DR-9, DR-11, DR-20, rules half of DR-15) |
| T4 | `senior-frontend-engineer` | worktree | the starting commit | Merges `--no-ff`, re-runs every gate on the merged tree |
| T2 | `senior-backend-engineer` | shared checkout | `TEST_DATABASE_URL`; read `prisma/schema.prisma` first | Reviews, gates, commits |
| T3 | `senior-backend-engineer` | shared checkout | `TEST_DATABASE_URL`; read `prisma/schema.prisma` first | Gates, commits, documentation sync (DR-4, DR-6, DR-12, DR-18, DR-21), records the new line count of `src/features/prompts/actions.ts` |
| T5, T7, T8 Step 1 | `senior-frontend-engineer` | shared checkout | Step 1 only | Gates, commits Step 1 (green) |
| T5, T7, T8 Steps 2 and 3 | `senior-frontend-engineer` | shared checkout | Steps 2 and 3, the Step 1 commit | Gates, commits; documentation sync after T5 (DR-19, cache half of DR-16) |
| T6 | `senior-frontend-engineer` | shared checkout | the T5 commit | Gates, commits, documentation sync (DR-5, rest of DR-16) |
| T9 | `documentation-manager` | shared checkout | the commit before T1 as the base of "every changed file", `TEST_DATABASE_URL` | Removes the 13 wip files with `git rm`, writes the REPORT, files the follow-ups, comments on #37, #41, #44, #45 and #53 |

After each merge the main session re-runs `npx prisma validate`, `npm run lint`, `npx tsc --noEmit`, `npm test`,
`bash scripts/audit-code-size.sh --summary` and `npm run build`, takes test counts and changed files from the tools and
not from an agent's report, and checks that no lint warning was added (baseline: 18 `max-lines-per-function`
warnings, the three in `useDocumentLoader.ts` go). An agent that stops without a report has hit its turn limit
(`maxTurns` is 100 for the frontend, backend and QA agents): the main session inspects its worktree, reverts any
experiment it left applied, and re-dispatches a narrower task.

Not part of Stage 6 and never run by an agent: the browser checks (dev-review #38) and the CI run of the Postgres
service container, which cannot run before a pull request exists because `ci.yml` triggers only on pushes to `master`
and on pull requests. No pull request is opened unless the developer asks for one.

## Dependencies

| Item | Status |
|---|---|
| `jsdom@^26.1.0`, `@testing-library/react@^16.3.0`, `@testing-library/dom@^10.4.0` | Not installed as devDependencies; T1 adds them (D5). Untracked copies from the research exist in `node_modules` and `npm ci` removes them |
| Postgres 17 service container in CI | Added by T1; not runnable before a pull request |
| A local Postgres with a database whose name contains "test" and the eight migrations applied | Provisioned by the main session before T1, T2 and T3 |
| `zod`, `zustand`, `sonner`, Radix, Prisma 6.19.0, Vitest 2.1.9 | Already installed; no version changes |
| Prerequisite PRPs | None. P7S2 (#39) follows; P7S1 moves `restorePromptVersion` into a user-scoped service, which removes the unscoped `update` listed in #41 |

## Risk Assessment

| Risk | Mitigation |
|---|---|
| T5 and T7 are the largest rewrites and could exhaust an agent's turn budget mid-red | Both are dispatched in two halves; Step 1 is committed green before Steps 2 and 3 |
| A decision among D1, D2, D4 and D5 changes after work has built on it | The cost is stated per decision in the PRP; confirm before T2 is dispatched |
| The database tests touch a real database | The helper refuses a non-loopback host, a name without "test", a `host`, `hostaddr` or `port` query parameter, and a missing URL in Actions; the suites skip outside CI when the URL is unset |
| Agents sharing a checkout see each other's intentionally failing tests | T4 runs in a worktree; T1 to T3 touch disjoint files; the Stop hook needs the suite green at every turn end |
| The reference implementations are `// @ts-nocheck` and looser than the project rules | The briefs list the adaptations: rewrap at 120 columns, TSDoc, `async`/`await`; the final search for removed names catches stale comments |
| The cloud session may have no usable Postgres | If neither Docker nor a cluster works, T1 to T3 cannot show a red; the tasks stay blocked and the developer is told |
| Browser behaviour is unverified: no agent can run a browser | Every browser flow is on #38; each task's report lists what it did not verify |
| A false draft conflict after a lost autosave response | Accepted in D2: the text is offered, not lost |
| The CI Postgres service is untested until a pull request exists | T1 reports it as not run; the local run is the acceptance, the CI run becomes the final proof |

## Success Criteria

- [ ] On a fresh mount the document shows the server's title and content whichever of the user-id lookup and the fetch
  finishes first, under Strict Mode, with "Loading prompt..." until then
- [ ] The editor never mounts with another document's text; a failed load shows its error
- [ ] Opening a document, switching to its tab or reloading performs no write
- [ ] An edit is autosaved once, 500 ms after the last change, and afterwards no draft remains unless newer edits exist
- [ ] Clearing a document, waiting for autosave and reloading yields an empty document and no restore toast
- [ ] A draft whose base hash differs from the server content is not applied: a warning toast offers "Restore my text";
  the legacy draft is applied only to a document never saved
- [ ] Save A, autosave B, save C lists C then A; saving unchanged content adds no row
- [ ] Restore shows the restored title and content at once, replaces the cache entry, clears the draft and pauses
  autosave; unsaved edits of a titled document are saved first
- [ ] A completion after a switch or unmount leaves the open document unchanged; a rejected or never-settling action
  resets its busy flag within 30 seconds
- [ ] The History button lists the saved versions newest first; every Restore button is disabled while a restore runs
- [ ] The footer reads "Unsaved changes" while the working copy differs from the server
- [ ] Saving an untitled document needs one confirmation of the title
- [ ] `npm test` runs the Postgres-backed tests in CI and reports them as skipped when `TEST_DATABASE_URL` is unset
  outside CI
- [ ] Every CI gate passes, no file enters the RED band, no lint warning is added, and each file in the contract's
  coverage scope reaches 80% on lines, functions, branches and statements
- [ ] Each defect has a test that failed before its fix, with the failing output recorded in the REPORT
- [ ] Every drift-register row is fixed or filed; the 13 wip files are removed after T9
- [ ] Browser checks are listed as not run and handed to #38

## Estimated Timeline

| Phase | Tasks | Hours |
|---|---|---|
| A | T1 (3), T4 (3, in parallel) | 3 |
| B | T2 (3), T3 (3) | 6 |
| C | T5 | 4 |
| D | T6 | 4 |
| E | T7 | 4 |
| F | T8 (4), T9 (2) | 6 |

The task hours add up to 30. With T4 in parallel with phase B the critical path is about 27 hours, in line with the PRP
estimate of 27 to 33 hours, before the main session's review, gating and documentation syncs after each task.

----
**Plan Status**: ACTIVE
**PRP Status**: TODO
**PRP ID**: P7S1
**GitHub Issues**: #31 (PRP epic); tasks #75-#83 (P7S1T1-P7S1T9); bugs #72, #73 (children of #31), #74 (outside the epic); dev-review #38
**PRP Document**: P7S1-editor-data-integrity
**Tasks**: 9 tasks (P7S1T1 - P7S1T9)
**Phase**: Phase 7 - Hardening (Editor data integrity)
**Dependencies**: None
**Implementation Status**: NOT YET STARTED (P7S1)
**Testing Status**: NOT YET TESTED
**Next PRP**: P7S2 - Server-side security hardening
**Documentation**:
- PRPs/docs/P7S1-decisions.md
- PRPs/docs/P7S1-editor-persistence-contracts.md
- PRPs/docs/P7S1-task-briefs.md
- PRPs/docs/P7S1-task-briefs-client.md
- PRPs/docs/P7S1-task-context.md
- wip/P7S1-research-drift.md
**Recommendations**:
Agents:
- `qa-test-automation-engineer` (Task 1)
- `senior-backend-engineer` (Tasks 2-3)
- `senior-frontend-engineer` (Tasks 4-8)
- `documentation-manager` (Task 9, plus the syncs after Tasks 1, 3, 5 and 6)
Notes:
- Decisions D1, D2, D4 and D5 are the developer's to confirm; work proceeds on them as written and a change redoes the tasks that build on them
- The reference implementations in wip/ (204 tests, 83 mutations each killed by a test) specify Tasks 4 to 8; the main session deletes them after Task 9
- Tasks 5, 7 and 8 are dispatched in two halves; Tasks 5 and 7 are the riskiest
- Browser verification is #38 and cannot be run by an agent
- The board is not synced from this cloud session; run .github/scripts/board-sync.sh from a local login
**Estimated Implementation Time (FTE)**: 27-33 hours (4 days)
