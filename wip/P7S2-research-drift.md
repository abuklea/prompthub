# PromptHub
## P7S2 Research Drift Register

| `Title` | `Created` | `Last modified` |
|---------|-----------|-----------------|
| P7S2 Research Drift Register | 27/10/2026 00:18 GMT+10 | 29/10/2026 16:45 GMT+10 |

## Table of Contents
- [Purpose](#purpose)
- [Register](#register)
- [Stale citations in the issue bodies](#stale-citations-in-the-issue-bodies)
- [Not drift](#not-drift)

## Purpose

This is the drift register `docs/rules/documentation.md#drift-review` requires for the feature area of P7S2,
server-side security hardening (epic #39). Each row cites both sides, names the side that is right, says whether the
statement is false now or becomes false when P7S2 lands, and names where the fix belongs. The PRP's documentation task
fixes every row still open when it starts; the REPORT confirms each is fixed or filed. Every citation was read at
`481aae9` on 26/10/2026 and 27/10/2026. Defects in code are not drift: they are in
[the research notes](P7S2-research-notes.md#findings).

## Register

| ID | Statement that is or will be false | The other side | Right side | False | Fix belongs |
|---|---|---|---|---|---|
| DR-1 | `docs/rules/project.md:160-161` "Some actions do not comply yet; they are tracked under #39 (P7S2)." | P7S2 brings every action into line | The code after P7S2 | When P7S2 lands | Docs task: delete the sentence, unless an action stays out of scope (DR-12) |
| DR-2 | `README.md:97-98` every server action "scopes every Prisma query by `user_id`", with no caveat | `src/features/prompts/actions.ts:588` updates by `id` only; `createPrompt` (`:143-150`) and `createFolder` (`src/features/folders/actions.ts:37-43`) write a foreign key nobody checked | The code | Now; true once P7S2 lands | Docs task: confirm the line is true then |
| DR-3 | `README.md:12` "Known gaps in input validation and ownership checks are tracked in #41" | #41 closes with P7S2 | The code after P7S2 | When P7S2 lands | Docs task |
| DR-4 | `.claude/agents/senior-backend-engineer.md:20` and `.gemini/agents/senior-backend-engineer.md:20` "Some actions still miss the `user_id` scope (tracked under P7S2)." | Same as DR-1 | The code after P7S2 | When P7S2 lands | Docs task, both copies |
| DR-5 | `.claude/agents/senior-backend-engineer.md:19` (and the `.gemini` copy) give `createPrompt`'s order as auth, rate limit, `ensureProfileExists`, queries | `createPrompt` parses with Zod first (`prompts/actions.ts:99`); P7S2 adds a folder-ownership check and may move the body to a service | The code | Partly now; fully when P7S2 lands | Docs task, both copies |
| DR-6 | `src/lib/ensure-profile.ts:5-8` "Ensures the authenticated user's Profile record exists" | `:9` takes any `userId` and authenticates nothing; `:1` is `"use server"`. The file has no source header | The code | Now | The ensure-profile task rewrites the file with a header |
| DR-7 | `docs/rules/project.md:164-165` and `README.md:99-100` name `ensureProfileExists()` in `src/lib/ensure-profile.ts`; `project.md:57` lists `ensure-profile` under `lib/` | Stays true unless P7S2 renames the function or the file | The code after P7S2 | Only on a rename | The ensure-profile task, in the same change as any rename |
| DR-8 | `docs/project/PromptHub_05_TECH_01.md:168` "Create a trigger in Supabase to automatically create a `Profiles` entry upon user sign-up." | `docs/rules/project.md:164-165` forbids triggers on `auth.users`; profiles are created in application code (`src/features/auth/actions.ts:40,68`). `project.md:50-51` says the spec wins a disagreement, so this line is a hazard | `project.md` and the code | Now | Docs task: the spec is fixed to the code |
| DR-9 | `PromptHub_05_TECH_01.md:8`, `:29`, `:84`, `:90`, `:371` and `docs/project/PromptHub_01_MVP_01.md:189` name RLS as the isolation mechanism | `project.md:158-163` and `README.md:97-109`: application code is the boundary, RLS does not constrain Prisma | `project.md` | Now | Docs task |
| DR-10 | `PromptHub_05_TECH_01.md:204` `createFolder(name, parentId): Promise<Folder>`; `:347-349` `createFolder(data)`, `updateFolderName`, `deleteFolder(...): Promise<{ success: boolean }>` | `folders/actions.ts:27,49,71`: `(name, parentId)` returning a Folder, `renameFolder`, a `string[]` of prompt ids. P7S2 changes every one to `ActionResult` | The code after P7S2 | `:347-349` now; `:204` when P7S2 lands | Docs task |
| DR-11 | `PromptHub_05_TECH_01.md:352-353` `createPrompt(data: { title, folderId \| null }): Promise<Prompt>` and `updatePrompt` | `prompts/actions.ts:96` returns `ActionResult<PromptListItem>`; `schemas.ts:21-24` requires a uuid `folderId`; there is no `updatePrompt` (`renamePrompt` is at `:224`) | The code | Now | Docs task |
| DR-12 | `PromptHub_05_TECH_01.md:9`, `:96`, `:185`, `PromptHub_01_MVP_01.md:16,190`, `project.md:168` "Validate every user input with Zod", and #39's outcome | No Zod on `folders/actions.ts:27,49,71,106`, `auth/actions.ts:32,60` (schemas used as types only), `prompts/actions.ts:45,224,302,342`, `profile/actions.ts:33` | The rules, as intent | Now. Stays false for any action P7S2 leaves out | Q4 is decided (27/10/2026): every action gets validation, so no action is left out; DR-1 and DR-12 are then fully fixed by the code |
| DR-13 | `PromptHub_05_TECH_01.md:97` "calls `revalidateTag('folders')`"; `:117` a `moveFolder` action and a `store.ts` | `folders/actions.ts:45` calls `revalidatePath("/")`; there is no `moveFolder` and no `src/features/folders/store.ts` | The code | Now (low) | Docs task |
| DR-14 | `PromptHub_05_TECH_01.md:173-178,183` `signUp(formData)`, `signIn(formData)`, `sendPasswordReset`, `updateProfile` | `auth/actions.ts:23,51` take typed objects; no `sendPasswordReset`; `profile/actions.ts:33` is `updateDisplayName` | The code | Now (low) | Docs task |
| DR-15 | `PromptHub_05_TECH_01.md:177`, `:370` middleware protects the `(app)` routes and refreshes sessions | `src/middleware.ts:20` matches `/login` only; `src/app/(app)/layout.tsx:19-23` gates routes | The code | Now (low) | Docs task |
| DR-16 | `src/components/layout/Header.tsx:37` "Clear document cache before logout"; `src/features/auth/actions.ts:80` "Client-side cache clearing handled by Header component before form submission" | `Header.tsx:38-42` prevents the submit and calls the action; P7S2's purge also clears the workspace cache and the drafts | The code after P7S2 | When P7S2 lands (`:80` is loose now) | The sign-out task |
| DR-17 | `folders/actions.ts:79-80,102`; `src/features/folders/components/FolderItem.tsx:96,99` and `FolderToolbar.tsx:48,51` say the returned ids are the prompts "in this folder" | P7S2 returns the prompts of every descendant folder (#43) inside an `ActionResult` | The code after P7S2 | When P7S2 lands | The folders task |
| DR-18 | `prompts/actions.ts:94` "@returns ActionResult with promptId on success" | `:154` returns the whole prompt with `tags: []` | The code | Now | The prompts task |
| DR-19 | `prompts/actions.ts:186` "Fetch prompt with user_id filter to enforce RLS" | `project.md:159-161`: this is the application filter; RLS does not apply to Prisma | `project.md` | Now (low) | The prompts task |
| DR-20 | `docs/rules/code-size-register.md:23` records 674 lines for `src/features/prompts/actions.ts` | P7S2 edits the file; `docs/rules/code-size.md` requires the count, the note and the decision to be revisited (split, #51) | The file after P7S2 | When P7S2 lands | The prompts task (count); Q2 is decided (the #51 split is pulled in), so the register row for the file changes or goes |
| DR-21 | `.claude/agents/qa-test-automation-engineer.md:3` "server-action logic with Prisma and Supabase mocked" and `:31` "Test data-access and server logic with the boundary mocked" (same in the `.gemini` copy) | `docs/rules/testing.md:43` "Never mock a module of this repository"; `project.md:136` services are tested against a real Postgres; `PRPs/docs/P7S1-decisions.md:99-108` (D5) | The rules | Now | Docs task, both copies |
| DR-22 | `README.md:138` names the editor service suites as the ones that run against Postgres; `.github/workflows/ci.yml:27-29` says only the database-backed tests connect, through `TEST_DATABASE_URL` | P7S2 adds Postgres-backed isolation suites for every action | The tests after P7S2 | When P7S2 lands (the CI comment only if the seam needs another variable) | The isolation-test task |
| DR-23 | `docs/review/platform-technical-review-20260708.md:58` F3 "Fixed (rotate pending)" | #46's definition of done updates this row once the credentials are rotated or confirmed dead | The outcome of #46 | When #46 closes | The developer, in #46 |
| DR-24 | `PRPs/docs/P7S1-task-context.md:212,219-220`, `PRPs/docs/P7S1-task-briefs-client.md:154`, `PRPs/docs/P7S1-editor-persistence-contracts.md:388` cite lines in `prompts/actions.ts` and `Header.tsx` that have moved | The current lines: `renamePrompt`'s write at `:271-280`, `createPrompt` at `:96-163`, `Header.tsx:23-24` imports, links at `:48,:56` | The code | Now (low; working documents of a completed PRP) | Docs task: drop the line numbers, or file a `type: docs` issue |
| DR-25 | `docs/rules/project.md:76` "one route handler (`src/app/auth/sign-out`)" | The route has no caller in `src` (`grep "auth/sign-out" src` finds none) | The code | When P7S2 lands: the developer decided Q6 on 27/10/2026, so the route is deleted and `project.md:76` must drop it | The sign-out task, with the deletion |
| DR-26 | `.gemini/AGENT-CONTRACT.md:23,32`, `.gemini/agents/technical-writer.md:15`, `.gemini/agents/serena-worker.md:14` cite `GEMINI.md` | No `GEMINI.md` exists | The filesystem | Now | Outside P7S2's area: a `type: docs` issue |

## Stale citations in the issue bodies

These are GitHub text, not repository documents, but the executing agent works from them. The PRP cites current
lines, and the completion comments on each issue give them.

| Issue | Citation | Now |
|---|---|---|
| #41 | `prompts/actions.ts:118-125` (createPrompt) | The create is `:143-150`; `:122-140` is the duplicate-title check |
| #41 | `:199` (renamePrompt) | `renamePrompt` is `:224`, its write `:271-280` |
| #41 | `:563` (assignTagsToPrompt update) | `:588-595`; the 21/10 comment on #41 says so |
| #41 | `:679` (restorePromptVersion) | Fixed by P7S1T3; acknowledged in the comment on #41 |
| #44 | `Header.tsx:30-34` | `handleSignOut` is `:38-42` |
| #45 | "auth stubbed at `createClient`" | Contradicts `docs/rules/testing.md:43` and P7S1 decision D5; the issue body was not edited |

## Not drift

Historical records are not edited. They include `PRPs/complete/P7S1-editor-data-integrity.md`, the P7S1 INITIAL and
REPORT, `PRPs/docs/P7S1-decisions.md` (D5 defers the action-test seam to #45), the 08/07/2026 platform review apart
from the F3 row (DR-23), the 08/03/2026 reviews under `docs/review/` (including the "redundant sign-out paths" note),
the earlier steps of `docs/project/PromptHub_06_PLAN_01.md`, and the dated `wip/` reports from P1 to P5. Forward
references that P7S2 makes true are not drift either: `PRPs/docs/P7S1-editor-persistence-contracts.md:280` and
`PRPs/docs/P7S1-decisions.md:55` ("#44's purge removes"), and `src/features/editor/document-cache.ts:11-12` (the
document cache checks the user per entry and remembers no user id), which stays true unless P7S2 changes that cache.
`docs/rules/documentation-prp.md:63,101` use #41 to #48 as example numbers for an invented P2S8; that is not drift,
though the numbers collide with the real P7S2 issues. `docs/project/PromptHub_06_PLAN_01.md` has no Phase 7, and
that is correct: `docs/rules/github-issues.md#titles-commits-and-pull-requests` defines Phase 7 as post-plan work.
