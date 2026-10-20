# PromptHub
## P7S1 Research Drift Register

| `Title` | `Created` | `Last modified` |
|---------|-----------|-----------------|
| P7S1 Research Drift Register | 20/10/2026 11:58 GMT+10 | 20/10/2026 12:40 GMT+10 |

## Table of Contents
- [Purpose](#purpose)
- [Register](#register)
- [Not drift](#not-drift)
- [Findings that are defects, not drift](#findings-that-are-defects-not-drift)

## Purpose

This is the drift register `docs/rules/documentation.md#drift-review` requires for the feature area of
`PRPs/P7S1-editor-data-integrity.md`. Each row cites both sides, names the side that is right, and names the task or
documentation sync that fixes it, so a document is corrected in the same commit as the behaviour that made it false.
The syncs are run by the `documentation-manager` after T1, T3 and T6, and T9 verifies that nothing is left. The REPORT
confirms each row fixed or filed. Every citation was opened at its line during research on 20/10/2026.

## Register

| ID | Statement that is or will be false | The other side | Right side | Fix belongs |
|---|---|---|---|---|
| DR-1 | `src/features/editor/components/EditorPane.tsx:56` says the re-exported cache utilities are "used by WorkspacePreloader and logout" | `WorkspacePreloader.tsx` calls `hydrateWorkspaceCache` only; `src/components/layout/Header.tsx:23,39` calls `clearDocumentCache`; nothing calls `hydrateDocumentCache` | The code | T5 (comment and re-export, in the task that removes the export) |
| DR-2 | `useDocumentLoader.ts:49-62` exports `hydrateDocumentCache` and `:68-78` exports `updateDocumentCacheEntry` as live API | A search of `src` finds no caller of either | The code: dead exports | T5 removes the first and uses the second |
| DR-3 | `useDocumentLoader.ts:40` calls `documentCache.clear()` at module load | The map was created on the line before | The code: a no-op | T5 |
| DR-4 | `docs/project/PromptHub_05_TECH_01.md:217-233` and `:351-352` describe autosave to localStorage only under `draft-prompt-${promptId}`, `saveNewVersion(promptId, newContent)` computing a `diff-match-patch` diff, `revertToVersion` and `getPromptVersions`; `:302-304` shows `PromptVersion.diff` as "the patch from diff-match-patch" | `docs/project/PromptHub_06_PLAN_01.md:214` (Step 3b: "auto-save updates current content, manual save creates versions"); code: server autosave, snapshot storage (F10), `restorePromptVersion`, `getPromptVersionHistory`, key `prompt-<id>` | The plan and the code, as P7S1 refines them | Documentation sync after T3 rewrites section 3.3 and the section 4.1 model |
| DR-5 | `docs/project/PromptHub_02_STORIES_01.md:79` and `docs/project/PromptHub_04_UI_01.md:119-124` say autosave writes only to local storage and shows "Draft saved locally" | The editor footer shows "Saving..." and "Saved <time>" for the server autosave (`EditorPane.tsx:296-300`) | The code and Plan Step 3b | Documentation sync after T6 |
| DR-6 | `docs/project/PromptHub_04_UI_01.md:142` says restore populates the editor "and prompt the user to save it as a new version" | `PromptHub_02_STORIES_01.md:85` says restore saves it as a new version; the dialog restores in one click | The stories, and decision D4 (needs developer confirmation) | Documentation sync after T3 |
| DR-7 | `docs/rules/project.md:78` says tests are Vitest `src/**/*.test.ts` in the node environment | After T1: `src/**/*.test.{ts,tsx}`, jsdom per file by control comment, Postgres-backed suites behind `TEST_DATABASE_URL` | The new setup | Documentation sync after T1 |
| DR-8 | `.claude/agents/qa-test-automation-engineer.md:3` and `:19` say only `.test.ts` files run, in the node environment | Same as DR-7 | The new setup | Documentation sync after T1 |
| DR-9 | `docs/rules/testing.md#test-layers` has no layer for tests against a real database or for hook tests | `docs/rules/testing.md#rules` already forbids mocking repository modules and `.claude/agents/qa-test-automation-engineer.md:31` allows integration tests against a disposable database | The rules, once the layer is added | Documentation sync after T1 |
| DR-10 | `.github/workflows/ci.yml:13-14` says CI never connects to a database | T1 adds a Postgres service container to the job | The new job | T1, in the same change as the service |
| DR-11 | `.claude/AGENT-CONTRACT.md:84-85` tells agents to report a check needing a real database as not run | Still right; it does not name `TEST_DATABASE_URL` or the loopback rule | Both: extend, do not replace | Documentation sync after T1 |
| DR-12 | `docs/rules/code-size-register.md` row for `src/features/prompts/actions.ts` says 699 lines | T3 moves the history and restore logic out; the count changes | The file | T3 reports the new count, documentation sync after T3 edits the row |
| DR-13 | `README.md` has no instructions for running tests | `npm test`, the Postgres-backed variant and the DOM environment exist after T1 | Gap in the README | T9 adds a Testing section |
| DR-14 | `vitest.config.ts` coverage scope lists `src/lib/diff-utils.ts` | The file does not exist (F10 removed the diff computation) | The filesystem | T1 |
| DR-15 | `.env.example` lists no test variables; `docs/rules/project.md#environment-variables` does not list `TEST_DATABASE_URL` | T1 introduces `TEST_DATABASE_URL` | Both must gain it | T1 for `.env.example`, documentation sync after T1 for the rules table |
| DR-16 | `.claude/agents/senior-frontend-engineer.md:43` names `useLocalStorage` among causes of the P5S5 bleed, says `useDocumentLoader.ts` keeps the document cache, and points at the editor hooks as fragile | `useLocalStorage.ts` is deleted in T6; the cache moves to `document-cache.ts`; the draft store and persistence hooks become the fragile files | The agent file should name the new files and say the hook was removed | Documentation sync after T6 |
| DR-17 | Issues #37 and #45 say "auth stubbed at `createClient`" | `docs/rules/testing.md#rules` forbids mocking a repository module; decision D5 | The rule | The main session comments on #37 and #45; the developer edits #45's acceptance |
| DR-18 | `docs/rules/project.md#files-and-documents` lists `actions.ts`, `schemas.ts` and `types.ts` per feature and no module for server logic that takes a database | T2 adds `service.ts` per feature | The new convention, if confirmed in D5 | Documentation sync after T3 |

## Not drift

Historical records are not edited: the PRPs and reports under `PRPs/` (for example the P5S5 documents that name
`useLocalStorage`), `docs/review/platform-technical-review-20260708.md:63`, and the earlier steps of
`docs/project/PromptHub_06_PLAN_01.md` (Steps 3, 3b and 5 describe what was planned at the time). Issue #44 says
drafts live under `prompt-<id>`; that stays true because the key is unchanged and only the stored value changes.

## Findings that are defects, not drift

| ID | Finding | Evidence | Disposition |
|---|---|---|---|
| F-1 | A fresh mount of `EditorPane` can end with an empty editor, or wipe a loaded document, depending on whether the user-id lookup or the fetch finishes first | `wip/P7S1-loader-race-diagnostic.test.tsx`: user id first, fetch first and Strict Mode all end empty; switching documents on a mounted instance loads | New bug issue under #31 filed with the INITIAL report; fixed by T5, T6 and T7 |
| F-2 | The footer showed "Unsaved" for a freshly loaded, unmodified document because the database load path never set `lastSaved` | `useDocumentLoader.ts:212-233` | Fixed in T5 (`lastSaved` from `updated_at`) |
| F-3 | A failed autosave is logged to the console only; there is no retry and the footer keeps showing the last success | `EditorPane.tsx:106` | Follow-up issue, medium, after the REPORT |
| F-4 | A rename from the document list updates only the list store, so the open editor keeps the old title and its next autosave writes it back | `DocumentToolbar.tsx:158-172`; `useDocumentLoader.ts` holds the title in state | Follow-up issue, medium, after the REPORT |
| F-5 | Untitled documents are never autosaved, so their text lives only in the browser draft and the cache until the first manual save | `useAutoSave.ts:64` | Product question for the developer; follow-up issue |

----
**PRP Status**: TODO
**PRP ID**: P7S1
**PRP Document**: P7S1-editor-data-integrity
**Tasks**: 9 tasks (P7S1T1 - P7S1T9)
**Phase**: Phase 7 - Hardening (Editor data integrity)
**Implementation Status**: RESEARCH COMPLETE - 18 drift rows open, fixed by T1, T3, T5 and T6 and their documentation syncs, and verified by T9
**Testing Status**: NOT YET TESTED - the probes and the loader spike in wip/P7S1-*.test.tsx run under wip/P7S1-vitest.diag.config.ts only
**Notes**:
- Rows DR-17 and F-3 to F-5 are handled by the main session, not by a task
- The probe and spike files are reconciled or deleted by T9
