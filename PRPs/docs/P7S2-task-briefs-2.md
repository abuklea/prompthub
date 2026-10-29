# PromptHub
## P7S2 Task Briefs, Part 2

| `Title` | `Created` | `Last modified` |
|---------|-----------|-----------------|
| P7S2 Task Briefs, Part 2 | 29/10/2026 17:54 GMT+10 | 29/10/2026 17:54 GMT+10 |

## Table of Contents
- [Purpose](#purpose)
- [Red to Green Map](#red-to-green-map)
- [Briefs](#briefs)
  - [P7S2T8 Move the editor, profile, workspace and dashboard actions onto the seam](#p7s2t8-move-the-editor-profile-workspace-and-dashboard-actions-onto-the-seam)
  - [P7S2T9 Purge client state on sign-out and delete the sign-out route](#p7s2t9-purge-client-state-on-sign-out-and-delete-the-sign-out-route)
  - [P7S2T10 Isolation coverage rule](#p7s2t10-isolation-coverage-rule)
  - [P7S2T11 Independent security review](#p7s2t11-independent-security-review)
  - [P7S2T12 Sweep the documentation](#p7s2t12-sweep-the-documentation)
  - [P7S2T13 Add composite tenant keys](#p7s2t13-add-composite-tenant-keys)
  - [P7S2T14 Ask before signing out with unsaved work](#p7s2t14-ask-before-signing-out-with-unsaved-work)
  - [P7S2T15 Correct the agent definitions](#p7s2t15-correct-the-agent-definitions)
  - [P7S2T16 Developer checks](#p7s2t16-developer-checks)

## Purpose

Tasks 8 to 16 of [the PRP](../P7S2-server-side-security-hardening.md); Tasks 1 to 7 and the rules that apply to every
task (headers, the database, `[P]` worktrees, one commit per backend-then-frontend task) are in
[the first briefs file](P7S2-task-briefs.md#purpose). Interfaces are in [the action contracts](P7S2-action-contracts.md)
and the per-area rules in [the domain contracts](P7S2-domain-contracts.md).

## Red to Green Map

| Task | New tests | First red run fails because |
|---|---|---|
| T8 | `editor/handlers.test.ts`, `profile/handlers.test.ts`, `workspace/handlers.test.ts`, `dashboard/handlers.test.ts`, isolation files | stub handlers; the autosave and save limit tests fail on a missing limiter |
| T9 | `workspace/cache.test.ts`, `auth/client-purge.test.ts` | the viewer functions and `purgeClientState` do not exist or do nothing |
| T10 | `src/test/action-coverage.test.ts`, `action-coverage.check.test.ts` | the pure checker is a stub that reports nothing, so the fixture cases fail |
| T13 | `src/test/composite-fk.test.ts` | inserting a folder under another user's parent, or a prompt into another user's folder, succeeds: no composite key exists yet |
| T14 | `src/features/auth/client-purge.unsaved.test.ts` | `hasUnsavedClientWork` is a stub that returns false |

## Briefs

### P7S2T8 Move the editor, profile, workspace and dashboard actions onto the seam

Agents `senior-backend-engineer` (steps 1 to 4), `senior-frontend-engineer` (step 5), 3.5 hours, after T3, `[P]`.
Decisions Q3, Q4, D4.

Files: CREATE `src/features/editor/handlers.ts`, `handlers.test.ts`, `handlers.isolation.test.ts`; MODIFY
`src/features/editor/actions.ts`; CREATE `src/features/profile/schemas.ts`, `handlers.ts`, `handlers.test.ts`,
`handlers.isolation.test.ts`; MODIFY `src/features/profile/actions.ts`; CREATE `src/features/workspace/handlers.ts` and
the two tests; MODIFY `src/features/workspace/actions.ts`; CREATE `src/features/dashboard/handlers.ts` and the two
tests; MODIFY `src/features/dashboard/actions.ts`; MODIFY `src/app/(app)/profile/page.tsx`,
`src/app/(app)/dashboard/page.tsx` and `src/components/layout/WorkspacePreloader.tsx` (callers).

Steps. Tests first. Editor: `saveNewVersion` and `autoSavePrompt` by B on A's prompt return the not-found text and
change nothing; `autoSavePrompt` is allowed 240 times by one user while `saveNewVersion` is refused on the 31st, and
the two limits are independent; the existing title validation of `saveNewVersion` is kept as the first statement of
`run`. Profile: `updateDisplayName` by B changes only B's profile; a name over 100 characters is refused; a blank name
stores null; `getProfileDetails` creates the profile for a user that has none and returns only that user's data.
Workspace: B's snapshot contains none of A's folders or prompts. Dashboard: B's counts and recent list exclude A's
rows, including A's versions. Then implement; `getDashboardMetrics` returns `ActionResult<DashboardMetrics>` (strict Q4)
and the dashboard page renders zeros when the result is a failure. Step 5: `profile/page.tsx` and `WorkspacePreloader`
branch on `success` (the preloader keeps its `try/finally` and its `mounted` guard; the dashboard page is a Server
Component and is edited here too; `WorkspacePreloader` also receives the `userId` prop in Task 9, so do not add it
here).

Done when no `editor`, `profile`, `workspace` or `dashboard` action imports `@/lib/db` or `createClient` outside
`action-runtime.ts`.

### P7S2T9 Purge client state on sign-out and delete the sign-out route

Agent `senior-frontend-engineer`, 4 hours, after T4, T5 and T8. Issue #44; decisions Q6, Q7, D5, D8; findings F-7, F-8;
drift rows DR-16, DR-25.

Files: MODIFY `src/features/workspace/cache.ts`; CREATE `src/features/workspace/cache.test.ts`; CREATE
`src/features/auth/client-purge.ts` and `client-purge.test.ts`; MODIFY `src/stores/use-tab-store.ts` and
`src/features/tabs/types.ts` (`resetTabs`); MODIFY `src/stores/use-ui-store.ts` (`resetSession`); MODIFY
`src/components/layout/Header.tsx`, `src/components/layout/WorkspacePreloader.tsx` and `src/app/(app)/layout.tsx`
(pass `userId={data.user.id}`); DELETE `src/app/auth/sign-out/route.ts` and the empty directories; MODIFY
`src/features/auth/actions.ts` (the stale comment at the top of `signOut`).

Steps. Tests first. `cache.test.ts` (node): the semantics of
[the contract](P7S2-domain-contracts.md#sign-out-purge-and-the-workspace-cache): hydrate for `user-1`, then
`bindWorkspaceCacheViewer("user-2")` makes every getter return empty and `hasWorkspaceSnapshot()` false; a snapshot for
another user is ignored once a viewer is bound; `clearWorkspaceCache` empties everything and unbinds; a hydrate with no
viewer bound adopts the snapshot's user (the `useActiveTabFolderSync.test.tsx` suite relies on this and is not edited).
`client-purge.test.ts` (`// @vitest-environment jsdom`, the real `window.localStorage`): seed `prompt-v1-a`,
`prompt-v1-a:conflict`, `prompt-b`, a persisted `prompthub-tabs-state` with two titled tabs and the settings key
`prompthub:user-settings:v1`; fill the document cache and the workspace cache; after `purgeClientState()` no key starts
with `prompt-`, the settings key remains, the persisted tab state is `{"state":{"tabs":[],"activeTabId":null},...}`
(Zustand's envelope), the in-memory tabs are empty, both caches are empty and the UI store selection is reset; a
storage whose `key` throws still clears the memory state. Implement. `Header.handleSignOut` calls `purgeClientState()`
then `await signOut()` (replacing the lone `clearDocumentCache()`, and its comment, DR-16; Task 14 puts the question in
front). `WorkspacePreloader` binds the viewer in its first effect, unconditionally and before it reads
`preloadWorkspaceOnLaunch` (the effect order is not unit-testable; the browser list covers it with the preload turned
off). `resetSession` clears the fields listed in the contract, and `resetTabs` also resets `layout` and drops pinned
tabs. Delete the route and confirm `npm run build` no longer lists `/auth/sign-out`.

Done when a search of `src` for `auth/sign-out` finds nothing, `Header.tsx` imports `purgeClientState`, and the files
edited that lacked a header have one. The sign-out flow in a browser is not unit-testable (Next navigation, Radix,
persisted stores in a real page) and belongs to Task 16.

### P7S2T10 Isolation coverage rule

Agent `qa-test-automation-engineer`, 2.5 hours, after T4 to T8. Issue #45; drift row DR-22.

Files: CREATE `src/test/action-coverage.ts` (a pure checker), `src/test/action-coverage.check.test.ts` (fixture cases)
and `src/test/action-coverage.test.ts` (the real tree); MODIFY `docs/rules/testing.md`; MODIFY the comment in
`.github/workflows/ci.yml` only if it still says which suites connect.

Steps. The checker is a function of `{ path, text }[]` so it can be tested red without editing the real tree. It
returns the names of the actions that lack an isolation test, found as: every file under `src` whose first statement is
the `"use server"` directive, each `export async function <name>` in it, and a match for `<name>:` preceded by any
quote character (`"`, `'` or a backtick) in a file named `*.isolation.test.ts`. The exceptions are `signIn` and
`signUp`, whose tests are `auth/handlers.test.ts` titled `"signIn: ..."` and `"signUp: ..."` (the rule Task 4 states;
the checker looks for that title there instead), and `signOut` (no tenant data, a redirect, no handler); 
`getDashboardMetrics` is not an exception. It also reports a `"use server"` file that exports anything but an
`async function` or a type, and `src/lib/ensure-profile.ts` if it has the directive or lacks `import "server-only"`.
Write the fixture cases first (a covered action, an uncovered one, an excepted one, a bad export, each quote style),
show them failing against the stub, implement, then add the real-tree test and watch it pass because Tasks 4 to 8
delivered the tests. Edit `docs/rules/testing.md#rules` to require an isolation test for every new action and to state
how it is named and found, with the header `Last modified`.

Done when `npm test` without a database still runs the coverage rule (it reads files only) and the isolation suites are
reported skipped, not absent. The CI run of the Postgres-backed suites cannot happen before a pull request exists
(`ci.yml` triggers on `push` to `master` and on `pull_request`): report it as not run.

### P7S2T11 Independent security review

Agent `security-analyst`, 1.5 hours, after T9, T10, T13 and T14. Read-only; the report goes to the main session. It
also reviews the composite-key migration and the sign-out confirmation.

Review the final tree for: a Prisma call in a handler or service that is not scoped by `user_id` (reading the statement,
not trusting a search); a `"use server"` file exporting anything beyond the 25 actions; a handler that reads a user id
from its input; a raw query that is not a tagged template; a message that echoes Supabase or an exception; a mutation
without a limit class; a path by which `ensureProfileExists` or a service is reachable from a client import. Report
findings by severity, each with a traced path from the entry point, and list what was not reviewed. The main session
fixes what the review finds, or files an issue, before Task 12.

### P7S2T12 Sweep the documentation

Agent `documentation-manager`, 2.5 hours, after T11. Drift register `wip/P7S2-research-drift.md`; issue #45.

Fix every row still open when it starts, by correcting or deleting, and add a changelog line where a document keeps
one. The rows and where each lands:

| Rows | Fix |
|---|---|
| DR-1, DR-2, DR-3 | `docs/rules/project.md` (delete "Some actions do not comply yet"), `README.md` lines on isolation and "Known gaps ... #41": state what is now true |
| DR-4, DR-5, DR-21 | fixed first, in Task 15; confirm the text still matches the code (the handler and `runAction` order of checks, every mutation limited, no mocked repository modules) |
| DR-6, DR-7 | confirm after Task 1 (the helper keeps its name and file); `project.md` Layout lists `lib/` contents |
| DR-8 to DR-15 | `docs/project/PromptHub_05_TECH_01.md` and `PromptHub_01_MVP_01.md`: triggers, RLS, folder and prompt signatures, Zod, `revalidatePath`, auth actions, middleware |
| DR-16, DR-17, DR-18, DR-19, DR-20 | confirm they were fixed in Tasks 5, 6, 7 and 9 |
| DR-22 | README Testing section: the Postgres-backed suites now include the isolation suites; the `ci.yml` comment |
| DR-24 | drop the moved line numbers in the P7S1 working documents, or file a `type: docs` issue |
| DR-25 | `docs/rules/project.md` Stack row (no route handler) and `.serena/memories/project_overview.md:23`, which the register missed |
| DR-23 | the developer's, in #46; leave it |
| DR-26 | outside the area: file a `type: docs` issue |

Also confirm every new file has its header and that `CLAUDE.md`'s and `project.md`'s statements about tenancy, rate
limits, the composite keys and the `server-only` package are true. Record a closing note against each register row, as
P7S1 did. Search the repository for the old terms (`ensureProfileExists(userId`, `removeFolderFromCache`,
`searchPrompts`, `auth/sign-out`) before reporting.

### P7S2T13 Add composite tenant keys

Agent `senior-backend-engineer`, 3.5 hours, after T5 and T6. Developer decision of 29/10/2026 (Q8); finding F-2. The
application checks of Tasks 5 and 6 stay: they give the friendly message, and the keys are the second layer.

Files: MODIFY `prisma/schema.prisma`; CREATE `prisma/migrations/<timestamp>_composite_tenant_keys/migration.sql`
(generated, never hand-written); CREATE `src/test/composite-fk.test.ts`.

Steps. First, run the three audit queries of [the contract](P7S2-domain-contracts.md#composite-tenant-keys) against the
disposable test database (they are read-only) and report their output; on a database the suites filled they return no
rows. Second, write `composite-fk.test.ts` (`describeDb`) and show it failing: a folder whose `parent_id` is another
user's folder, and a prompt whose `folder_id` is another user's folder, are rejected and leave no row; a root folder, an
unfiled prompt, a child folder under its owner's parent and a prompt in its owner's folder are accepted; deleting a
parent still cascades to child folders and prompts, and deleting a profile still cascades. The two rejection cases are
the red: today the inserts succeed. Third, change the schema as in the contract and run `prisma validate`. Fourth,
generate the migration with `prisma migrate dev --create-only --name composite_tenant_keys` against the test database on
the local Docker Postgres (host port 54322), with `DATABASE_URL` and `DIRECT_URL` set to `TEST_DATABASE_URL`; Prisma
creates and drops its own shadow database there, and the agent creates no role or database itself. Never run it against
Supabase. Compare the generated SQL with the script in the contract. Fifth, apply every migration from scratch to that
disposable database (`npx prisma migrate reset --force`, with the same variables; it erases the test database) and run
`npx prisma generate` and the whole suite. Sixth, write the rollback as a forward migration text in the report (drop the
two constraints and the unique index, re-add the two single-column keys; regenerate it with `prisma migrate diff` in
the opposite direction) without applying or committing it.

Done when the composite-key test, the folder and prompt handler suites and `tsc` pass after `prisma generate`. If the
generated Prisma Client rejects creating a root folder or an unfiled prompt (partly null composite relation:
unverified), stop and report it; the schema was only validated, not generated, during planning.

### P7S2T14 Ask before signing out with unsaved work

Agent `senior-frontend-engineer`, 1.5 hours, after T9. Developer decision of 29/10/2026 (D10).

Files: MODIFY `src/features/auth/client-purge.ts` (add `hasUnsavedClientWork`); CREATE
`src/features/auth/client-purge.unsaved.test.ts` (jsdom, real `localStorage`, real tab store); MODIFY
`src/components/layout/Header.tsx`.

Steps. Test first: false with no dirty tab and no `prompt-` key (the settings and `prompthub-tabs-state` keys do not
count); true with a tab whose `isDirty` is true; true with `prompt-v1-<id>`, with `prompt-v1-<id>:conflict` and with the
legacy `prompt-<id>`; false when storage throws (the app could not have written a draft either). Then the Header: the
form's submit handler prevents the default, and when `hasUnsavedClientWork()` is true it opens an `AlertDialog`
(`src/components/ui/alert-dialog.tsx`) titled "Sign out and discard unsaved work?" with Cancel and Sign out; Sign out
calls `purgeClientState()` then `await signOut()`, Cancel changes nothing, and with no unsaved work it signs out at once.
Keep hover, press and focus feedback on both buttons. Limitation to state in the report: another open browser tab is
not asked and keeps its in-memory state
([the contract](P7S2-domain-contracts.md#sign-out-purge-and-the-workspace-cache)). The dialog itself is checked in the
browser (Task 16).

### P7S2T15 Correct the agent definitions

Agent `documentation-manager`, 0.5 hours, runs before Task 1 (the INITIAL stage), so that executing agents do not read
stale instructions. Drift rows DR-4, DR-5, DR-21.

Files: `.claude/agents/senior-backend-engineer.md` and `qa-test-automation-engineer.md`, and the same two under
`.gemini/agents/`. Replace "Some actions still miss the `user_id` scope (tracked under P7S2)" with an instruction true
before and after the PRP: scope every query by `user_id` in every action you touch, and follow the PRP for the handler
conversion. State `createPrompt`'s order as parse, authenticate, rate-limit, ensure the profile, then queries, without
naming `runAction`, which does not exist yet. In the QA agent replace "Prisma and Supabase mocked" and "the boundary
mocked" with "inject seams and run against a disposable Postgres; never mock a module of this repository"
(`docs/rules/testing.md#rules`). Agent files carry no header block (`docs/rules/project.md#files-and-documents`).

### P7S2T16 Developer checks

Developer (`type: dev-review`), no agent, 1.5 hours, after T12. Issue #46 and a new issue filed at INITIAL for the
browser list.

First, #46: confirm that each credential removed by the 08/07/2026 review (the Archon login and the test user) was
rotated or is dead, and update the F3 row of `docs/review/platform-technical-review-20260708.md` (DR-23). Second, the
browser checks, on the Docker stack (`docker compose up --build -d`, then sign up two throwaway users; the stack serves
the production build, so rebuild after every change): sign up and sign in with a wrong password (the message is the
fixed one); create a folder, a subfolder and a document; rename and delete each; delete a folder whose sub-folder holds
an open document and confirm that tab closes; create 31 folders quickly and see "Too many requests"; assign a tag; open
History and restore; edit the profile name; sign out as user A and sign in as user B in the same tab and confirm that
no folder name of A appears, that `localStorage` holds no `prompt-` key and that `prompthub-tabs-state` holds no tab;
with unsaved edits in a tab (and with a conflict draft), press Sign Out and confirm the question appears, that Cancel
keeps the session and the edits, and that confirming signs out and purges; confirm `POST /auth/sign-out` returns 404;
turn the workspace preload off in Settings, sign out, sign in as the other user and confirm none of the first user's
folder names appears; run `npm run build` and count the action ids
([Level 3](../P7S2-server-side-security-hardening.md#level-3-build-and-browser)). Third, the composite keys (Task 13):
run the three audit queries of [the contract](P7S2-domain-contracts.md#composite-tenant-keys) against the Supabase
database first (read-only, in the SQL editor or with `psql`). If queries 1 or 2 return rows, the migration would fail
when it adds the constraints and change nothing; clean or reassign those rows, then re-run the audit. Only then apply
the migration to Supabase, by the developer's usual route (`supabase link --project-ref`, then the CLI; never an
agent), and re-run the audit afterwards. Query 3 (tag links) is information for a follow-up issue. Fourth, file the
follow-up issues the PRP lists. Note the limitation of the sign-out check: other open tabs of the same browser are not
asked.
