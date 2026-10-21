# PromptHub
## P7S1 Research Drift Register

| `Title` | `Created` | `Last modified` |
|---------|-----------|-----------------|
| P7S1 Research Drift Register | 20/10/2026 11:58 GMT+10 | 22/10/2026 07:53 GMT+10 |

## Table of Contents
- [Purpose](#purpose)
- [Register](#register)
- [Not drift](#not-drift)
- [Findings that are defects, not drift](#findings-that-are-defects-not-drift)

## Purpose

This is the drift register [the documentation rules](../docs/rules/documentation.md#drift-review) require for the
feature area of [the PRP](../PRPs/P7S1-editor-data-integrity.md). Each row cites both sides, names the side that is
right, and names the task or documentation sync that fixes it, so a document is corrected with the behaviour that made
it false. The syncs are run by the `documentation-manager` after T1, T3, T5 and T6, and T9 verifies that nothing is
left. The REPORT confirms each row fixed or filed. Every citation was opened during research on 20/10/2026; a markdown
document is cited by its heading anchor, a source file by line.

## Register

| ID | Statement that is or will be false | The other side | Right side | Fix belongs |
|---|---|---|---|---|
| DR-1 | `src/features/editor/components/EditorPane.tsx:56` says the re-exported cache utilities are "used by WorkspacePreloader and logout" | `WorkspacePreloader.tsx` calls `hydrateWorkspaceCache` only; `src/components/layout/Header.tsx:23,39` calls `clearDocumentCache`; nothing calls `hydrateDocumentCache` | The code | T5 (comment and re-export, in the task that removes the export) |
| DR-2 | `useDocumentLoader.ts:49-62` exports `hydrateDocumentCache` and `:68-78` exports `updateDocumentCacheEntry` as live API | A search of `src` finds no caller of either | The code: dead exports | T5 removes the first and uses the second |
| DR-3 | `useDocumentLoader.ts:40` calls `documentCache.clear()` at module load | The map was created on the line before | The code: a no-op | T5 |
| DR-4 | The technical spec describes autosave to localStorage only under `draft-prompt-${promptId}`, `saveNewVersion(promptId, newContent)` computing a `diff-match-patch` diff and `revertToVersion` ([3.3](../docs/project/PromptHub_05_TECH_01.md#33-prompt-editor--version-control)), `saveNewVersion` and `getPromptVersions` ([5.1](../docs/project/PromptHub_05_TECH_01.md#51-internal-apis)), and `PromptVersion.diff` as "the patch from diff-match-patch" ([4.1](../docs/project/PromptHub_05_TECH_01.md#41-data-models)) | Plan Step 3b ([Phase 5](../docs/project/PromptHub_06_PLAN_01.md#phase-5-prompt-editor--version-control): "auto-save updates current content, manual save creates versions"); code: server autosave, snapshot storage (F10), `restorePromptVersion`, `getPromptVersionHistory`, key `prompt-<id>` | The plan and the code, as P7S1 refines them | Documentation sync after T3 rewrites section 3.3 and the section 4.1 model |
| DR-5 | The stories say autosave saves to the browser's local storage with a "Draft saved" message ([Prompt Editor](../docs/project/PromptHub_02_STORIES_01.md#prompt-editor)); the UI document says "Draft saved locally." ([Screen 3 - State 2](../docs/project/PromptHub_04_UI_01.md#screen-3---state-2-editing--auto-saving)) | The editor footer shows "Saving..." and "Saved <time>" for the server autosave (`EditorPane.tsx:296-300`) | The code and Plan Step 3b | Documentation sync after T6 |
| DR-6 | The UI document says a restore populates the editor "and prompt the user to save it as a new version" ([Screen 3 - State 4](../docs/project/PromptHub_04_UI_01.md#screen-3---state-4-diff-view)) | The stories say a restore saves it as a new version ([Prompt Editor](../docs/project/PromptHub_02_STORIES_01.md#prompt-editor)); the dialog restores in one click; decision D4, confirmed on 22/10/2026, has Restore ask "Restore this version?" and then write the restore | The stories and D4: the UI document's sentence is the stale one | Documentation sync after T3 rewrites the sentence |
| DR-7 | [Stack](../docs/rules/project.md#stack) says tests are Vitest `src/**/*.test.ts` in the node environment | After T1: `src/**/*.test.{ts,tsx}`, jsdom per file by control comment, Postgres-backed suites behind `TEST_DATABASE_URL` | The new setup | Documentation sync after T1 |
| DR-8 | The `description` in the frontmatter of `.claude/agents/qa-test-automation-engineer.md`, and its [Rules of engagement](../.claude/agents/qa-test-automation-engineer.md#rules-of-engagement), say only `.test.ts` files run, in the node environment | Same as DR-7 | The new setup | Documentation sync after T1 |
| DR-9 | [Test Layers](../docs/rules/testing.md#test-layers) has no layer for tests against a real database or for hook tests | [Rules](../docs/rules/testing.md#rules) already forbids mocking repository modules, and the [Method](../.claude/agents/qa-test-automation-engineer.md#method) of the QA agent allows integration tests against a disposable database | The rules, once the layer is added | Documentation sync after T1 |
| DR-10 | `.github/workflows/ci.yml:13-14` says CI never connects to a database | T1 adds a Postgres service container to the job | The new job | T1, in the same change as the service |
| DR-11 | [Worktrees](../.claude/AGENT-CONTRACT.md#worktrees) tells agents to report a check needing a real database as not run | Still right; it does not name `TEST_DATABASE_URL` or the loopback rule | Both: extend, do not replace | Documentation sync after T1 |
| DR-12 | The code-size register row for `src/features/prompts/actions.ts` ([register](../docs/rules/code-size-register.md)) says 699 lines | T3 moves the history and restore logic out; the count changes | The file | T3 reports the new count, documentation sync after T3 edits the row |
| DR-13 | `README.md` has no instructions for running tests | `npm test`, the Postgres-backed variant and the DOM environment exist after T1 | Gap in the README | T9 adds a Testing section |
| DR-14 | `vitest.config.ts` coverage scope lists `src/lib/diff-utils.ts` | The file does not exist (F10 removed the diff computation) | The filesystem | T1 |
| DR-15 | `.env.example` lists no test variables; [Environment variables](../docs/rules/project.md#environment-variables) does not list `TEST_DATABASE_URL` | T1 introduces `TEST_DATABASE_URL` | Both must gain it | T1 for `.env.example`, documentation sync after T1 for the rules table |
| DR-16 | [Where this codebase breaks](../.claude/agents/senior-frontend-engineer.md#where-this-codebase-breaks) names `useLocalStorage` among the causes of the P5S5 bleed, says `useDocumentLoader.ts` keeps the document cache, and points at the editor hooks as fragile | The cache moves to `document-cache.ts` in T5; `useLocalStorage.ts` is deleted in T6; the draft store and the persistence hooks become the fragile files | The agent file should name the new files and say the hook was removed | Documentation sync after T5 for the cache sentence and after T6 for the rest |
| DR-17 | Issues #37 and #45 say "auth stubbed at `createClient`" | [Rules](../docs/rules/testing.md#rules) forbids mocking a repository module; decision D5 | The rule | The main session comments on #37 and #45; the developer edits #45's acceptance |
| DR-18 | [Files and documents](../docs/rules/project.md#files-and-documents) lists `actions.ts`, `schemas.ts` and `types.ts` per feature and no module for server logic that takes a database | T2 adds `service.ts` per feature | The new convention, if confirmed in D5 | Documentation sync after T3 |
| DR-19 | `.serena/memories/code_style_conventions.md` prescribes the ref-flag protocol as the required pattern ([2. Race Prevention with Refs](../.serena/memories/code_style_conventions.md#2-race-prevention-with-refs-pattern): `loadedRef`, `contentPromptIdRef`, `isTransitioning` and their ordering rules; [3](../.serena/memories/code_style_conventions.md#3-transition-lock-guard-pattern-p0t3) and [4](../.serena/memories/code_style_conventions.md#4-auto-save-with-transition-guards-p1t4)), and `project_overview.md` lists those fixes as current ([Critical Cache Contamination](../.serena/memories/project_overview.md#critical-cache-contamination--race-condition-fixes), and `:44-46`, `:69` for the localStorage auto-save); `codebase_structure.md:20,75,169` lists `useLocalStorage.ts` and the four refs, and `task_completion_workflow.md:536` lists the localStorage guard as a pattern (`:251-273` is a worked example: a record unless the sync finds it presented as current) | T5 removes the three flags and the transition effect and consumes `ready`; `promptIdRef` stays inside the loader; T6 deletes `useLocalStorage.ts` and the localStorage draft | The code | Documentation sync after T5 for the flags and after T6 for `useLocalStorage`; T9 verifies |
| DR-20 | [Layout](../docs/rules/project.md#layout) lists the subfolders of `src/` and has no `src/test/` | T1 adds `src/test/` (the database helper), T4, T5 and T7 add the shared fakes | The new folder | Documentation sync after T1 |
| DR-21 | `README.md:10` says each save stores a snapshot (title and content) of the previous version | After T2 a version is the saved state (decision D1) and a restore snapshots the row it replaces | The code | Documentation sync after T3; T9 verifies |
| DR-22 | The JSDoc of `saveNewVersion` (`src/features/editor/actions.ts:30-34`) describes a version created first and the prompt updated second | After T2 the update comes first, then the version, in `service.ts`, which the action calls | The code | T2, in the same change |

## Not drift

Historical records are not edited: the PRPs and reports under `PRPs/` (for example the P5S5 documents that name
`useLocalStorage`), the `wip/P5S*`, `wip/P5S4bT1-*` and `wip/MONACO-*` notes, the
[remediation status](../docs/review/platform-technical-review-20260708.md#remediation-status-08072026) of the
08/07/2026 review, and the earlier steps of `docs/project/PromptHub_06_PLAN_01.md` (Steps 3, 3b and 5 describe what was
planned at the time). Issue #44 says drafts live under `prompt-<id>` and its acceptance names `prompt-*` drafts; after
P7S1 they live under `prompt-v1-<id>` and `prompt-v1-<id>:conflict` (the legacy `prompt-<id>` is read once and
removed), and a `prompt-` prefix purge covers all three, so the main session comments on #44 and nothing is edited.

## Findings that are defects, not drift

| ID | Finding | Evidence | Disposition |
|---|---|---|---|
| F-1 | A fresh mount of `EditorPane` can end with an empty editor, or wipe a loaded document, depending on whether the user-id lookup or the fetch finishes first | `wip/P7S1-loader-race-diagnostic.test.tsx`: user id first, fetch first and Strict Mode all end empty; switching documents on a mounted instance loads | #72, filed with the INITIAL report; fixed by T5, T6 and T7 |
| F-2 | The footer shows "Unsaved" for a freshly loaded, unmodified document because the database load path never sets `lastSaved` | `useDocumentLoader.ts:212-233` | Fixed in T5 (`lastSaved` from `updated_at`, and the footer derived from the baseline so a restored draft reads "Unsaved changes") |
| F-3 | A failed autosave is logged to the console only; there is no retry and the footer keeps showing the last success | `EditorPane.tsx:106` | Follow-up issue, medium, after the REPORT |
| F-4 | A rename from the document list updates only the list store, so the open editor keeps the old title and its next autosave writes it back | `DocumentToolbar.tsx:158-172`; `useDocumentLoader.ts` holds the title in state | Follow-up issue, medium, after the REPORT |
| F-5 | Untitled documents are never autosaved, so their text lives only in the browser draft and the cache until the first manual save | `useAutoSave.ts:64` | Product question for the developer; follow-up issue |
| F-6 | `Prompt.folder_id` and `folder` are nullable, but `PromptWithFolder` has a non-null `folder` and the cache effect reads `promptData.folder.id`, which throws for an unfiled prompt | `prisma/schema.prisma:44-45`; `EditorPane.tsx:154` | Pre-existing and out of scope; follow-up issue |
| F-7 | A save or autosave that completes after a switch to another document is applied to the open one, a rejected action leaves its busy flag set, and a navigation orphans the queued server actions, so a busy flag can stay set for good | `EditorPane.tsx:103`, `190` (unconditional state updates), `98-109`, `173-204` (no `finally`); `node_modules/next/dist/shared/lib/router/action-queue.js:121-135` (a navigation marks the pending action discarded) and `:60-71` (`handleResult` then returns before `runRemainingActions`) | Found by review, reproduced by reading only; fixed by T4 (`withTimeout`), T5 (the fetch), T7 and T8 with the tests in `wip/P7S1-persistence-spike.test.tsx` as reference |
| F-8 | The history dialog never loads its list: `VersionHistoryDialog` reads it inside the dialog's `onOpenChange`, which Radix calls only for a change the dialog makes itself, and `EditorPane` sets `open` from its History button | `VersionHistoryDialog.tsx:39-52` and `:72`; `EditorPane.tsx:303`; the first case of `wip/P7S1-dialog-spike.test.tsx` (a controlled Radix dialog reports nothing when the parent sets `open`). The browser behaviour is unverified | #73, filed with the INITIAL report; fixed by T8 |
| F-9 | Closing the tab of a titled document that autosave persisted but that was never saved by hand offers "Discard", which deletes the document | `DocumentToolbar.tsx:95` sets `isNewDocument`; `EditorPane.tsx:199` clears it only in a manual save; `use-tab-store.ts:139-142` (`shouldConfirmClose`); `DocumentTab.tsx:111-112` (the close prompt) and `:133-137` (the Discard handler calls `deletePrompt`). Read from the code, not reproduced | #74, filed with the INITIAL report; outside P7S1 (a tab-close path), added to dev-review #38 |

----
**PRP Status**: TODO
**PRP ID**: P7S1
**PRP Document**: P7S1-editor-data-integrity
**Tasks**: 9 tasks (P7S1T1 - P7S1T9)
**Phase**: Phase 7 - Hardening (Editor data integrity)
**Implementation Status**: RESEARCH COMPLETE - 22 drift rows open, fixed by T1-T3, T5, T6 and their syncs; T9 verifies
**Testing Status**: NOT YET TESTED - the probes and the four spike suites (211 tests) run under the diag config only
**Notes**:
- Rows DR-17 and findings F-3 to F-6 and F-9 are handled by the main session, not by a task
- The probe and spike files (four spikes, their tests, the typed fakes, the mutation check, two probes and the diag
  config) are removed by the main session with `git rm` after T9
