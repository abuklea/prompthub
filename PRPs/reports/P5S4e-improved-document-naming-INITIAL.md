# PromptHub
## P5S4e - Improved Document Naming and Save Workflow - INITIAL PLAN

| `Title` | `Created` | `Last modified` |
|---------|-----------|-----------------|
| P5S4e - Improved Document Naming and Save Workflow - INITIAL PLAN | 08/11/2025 17:13 GMT+10 | 08/11/2025 17:13 GMT+10 |

## Table of Contents
- [Executive Summary](#executive-summary)
- [Implementation Strategy](#implementation-strategy)
- [Task Breakdown](#task-breakdown)
- [Dependencies](#dependencies)
- [Risk Assessment](#risk-assessment)
- [Timeline](#timeline)

---

## Executive Summary

This PRP transforms the document creation and save workflow to enforce proper title validation, preventing placeholder titles like "[Untitled Doc]" from being persisted to the database. The implementation follows a clean separation: new documents are created with `title = NULL` in the database but display "[Untitled Doc]" in the UI, and users must provide a valid title before the first save.

**Key Changes:**
- Database schema allows NULL titles
- Title validation rejects empty and placeholder patterns
- SetTitleDialog prompts for title on save without valid title
- UnsavedChangesDialog confirms before closing unsaved documents
- Auto-save preserves content without requiring title (draft protection)
- Manual save requires valid title

**Confidence Level:** 9/10 - Comprehensive plan with clear patterns and validation strategy.

---

## Implementation Strategy

### Phase 1: Foundation (Tasks 1-2)
**Database and Validation Layer**
- Make title field nullable in Prisma schema
- Run migration to allow NULL values
- Create validation schemas with placeholder detection
- Create display helper utilities

**Rationale:** Database changes must happen first as they're blocking dependencies for all other tasks. Validation schemas are shared across multiple components.

### Phase 2: Backend Actions (Tasks 3-5)
**Server-Side Updates**
- Update createPrompt to set `title: null` instead of generating placeholders
- Add title validation to saveNewVersion
- Allow autoSavePrompt to accept null titles (draft protection)

**Rationale:** Backend changes are independent and can be done in parallel after Phase 1. These establish the business logic before UI integration.

### Phase 3: UI Components (Tasks 6-7)
**Dialog Components**
- Create SetTitleDialog for title entry
- Create UnsavedChangesDialog for close confirmation

**Rationale:** Build reusable dialog components before integrating them into the workflow. Can be developed in parallel with Phase 2.

### Phase 4: Integration (Tasks 8-14)
**Workflow Integration**
- Update types and state management
- Integrate dialogs into save and close flows
- Update display components to show placeholders
- Wire up all confirmation and validation logic

**Rationale:** Final integration phase connects all pieces. Sequential execution required as tasks depend on previous components.

---

## Task Breakdown

### T1: Database Schema Migration [Backend]
**Assignee:** senior-backend-engineer
**Effort:** 30 minutes
**Parallelizable:** No (blocking dependency)

**Actions:**
- Modify `prisma/schema.prisma`: `title String` → `title String?`
- Run: `npx prisma migrate dev --name allow_null_document_title`
- Verify migration success
- Verify existing documents retain titles

**Success Criteria:**
- Migration file created
- Database updated successfully
- No data loss on existing documents
- New documents can have NULL title

---

### T2: Validation Schemas and Helpers [Backend]
**Assignee:** senior-backend-engineer
**Effort:** 45 minutes
**Parallelizable:** No (depends on T1)

**Actions:**
- Create/modify `src/features/prompts/schemas.ts`:
  - `isPlaceholderTitle(title: string)` function
  - `titleValidationSchema` using Zod with refine
- Create `src/features/prompts/utils.ts`:
  - `getDisplayTitle(title: string | null)` helper

**Success Criteria:**
- Functions exported and typed
- Validation rejects empty, null, and placeholder patterns
- Display helper handles all edge cases

---

### T3: Update createPrompt Server Action [Backend]
**Assignee:** senior-backend-engineer
**Effort:** 30 minutes
**Parallelizable:** Yes (after T1-T2)

**Actions:**
- Modify `src/features/prompts/actions.ts`
- Remove "[Untitled Doc]" generation logic
- Create documents with `title: null`
- Preserve duplicate validation for non-null titles

**Success Criteria:**
- New documents created with NULL title
- No placeholder title generation
- TypeScript compilation passes

---

### T4: Update saveNewVersion with Title Validation [Backend]
**Assignee:** senior-backend-engineer
**Effort:** 30 minutes
**Parallelizable:** Yes (after T1-T2)

**Actions:**
- Modify `src/features/prompts/actions.ts`
- Add title validation before diff calculation
- Return error if validation fails
- Preserve all transaction logic

**Success Criteria:**
- Validation blocks saves with invalid titles
- Error messages returned correctly
- Valid titles proceed to save

---

### T5: Update autoSavePrompt to Handle Null Titles [Backend]
**Assignee:** senior-backend-engineer
**Effort:** 15 minutes
**Parallelizable:** Yes (after T1-T2)

**Actions:**
- Modify `src/features/editor/actions.ts`
- Change type signature: `title: string | null`
- Skip title validation in auto-save
- Preserve auto-save logic

**Success Criteria:**
- Auto-save accepts null titles
- Draft content saved without title requirement
- No breaking changes to auto-save behavior

---

### T6: Create SetTitleDialog Component [Frontend]
**Assignee:** senior-frontend-engineer
**Effort:** 1.5 hours
**Parallelizable:** Yes (after T2, parallel with T3-T5)

**Actions:**
- Create `src/features/prompts/components/SetTitleDialog.tsx`
- Mirror RenameDocumentDialog pattern
- Integrate Zod validation
- Add prominent "Title Required" messaging

**Success Criteria:**
- Dialog renders correctly
- Form validation works
- Error messages display
- Cancel and submit handlers work

---

### T7: Create UnsavedChangesDialog Component [Frontend]
**Assignee:** senior-frontend-engineer
**Effort:** 1 hour
**Parallelizable:** Yes (parallel with T6)

**Actions:**
- Create `src/features/tabs/components/UnsavedChangesDialog.tsx`
- Use AlertDialog for warning context
- Three actions: Save / Discard / Cancel
- Handle async save callback

**Success Criteria:**
- Dialog renders with correct buttons
- All three actions work correctly
- Async callbacks handled properly

---

### T8: Update TabData Types [Frontend]
**Assignee:** senior-frontend-engineer
**Effort:** 10 minutes
**Parallelizable:** Yes (after T1-T7)

**Actions:**
- Modify `src/features/tabs/types.ts`
- Add `isNewDocument?: boolean` to TabData

**Success Criteria:**
- Type updated
- No TypeScript errors
- Zustand persist handles new field

---

### T9: Update Tab Store with Close Confirmation [Frontend]
**Assignee:** senior-frontend-engineer
**Effort:** 45 minutes
**Parallelizable:** No (depends on T8)

**Actions:**
- Modify `src/stores/use-tab-store.ts`
- Add `shouldConfirmClose(tabId)` method
- Add `closeTabDirectly(tabId)` method
- Preserve all existing close logic

**Success Criteria:**
- Methods exported and working
- Confirmation check works correctly
- Direct close maintains original behavior

---

### T10: Update EditorPane with Save Validation [Frontend]
**Assignee:** senior-frontend-engineer
**Effort:** 2 hours
**Parallelizable:** No (depends on T6, T9)

**Actions:**
- Modify `src/features/editor/components/EditorPane.tsx`
- Add SetTitleDialog state and integration
- Validate title before save attempt
- Update tab `isNewDocument` flag after save
- Add handleSetTitle callback

**Success Criteria:**
- Save validates title first
- SetTitleDialog opens on invalid title
- Successful save updates tab flag
- Title update flows correctly

---

### T11: Update PromptList Display [Frontend]
**Assignee:** senior-frontend-engineer
**Effort:** 20 minutes
**Parallelizable:** Yes (after T2, parallel with T10)

**Actions:**
- Modify `src/features/prompts/components/PromptList.tsx`
- Import and use `getDisplayTitle` helper
- Replace `prompt.title` with helper call

**Success Criteria:**
- Null titles display as "[Untitled Doc]"
- Actual titles display correctly
- No visual regressions

---

### T12: Update DocumentTab Display [Frontend]
**Assignee:** senior-frontend-engineer
**Effort:** 20 minutes
**Parallelizable:** Yes (after T2, parallel with T10-T11)

**Actions:**
- Modify `src/features/tabs/components/DocumentTab.tsx`
- Import and use `getDisplayTitle` helper
- Replace `tab.title` with helper call
- Preserve preview italic styling

**Success Criteria:**
- Tab titles show placeholders correctly
- Preview tabs maintain italic style
- Close button works

---

### T13: Integrate UnsavedChangesDialog in Tab Close Flow [Frontend]
**Assignee:** senior-frontend-engineer
**Effort:** 2 hours
**Parallelizable:** No (depends on T7, T9, T10)

**Actions:**
- Modify `src/features/tabs/components/DocumentTab.tsx`
- Add UnsavedChangesDialog state
- Modify close button handler
- Implement save, discard, cancel handlers
- Handle document deletion on discard

**Success Criteria:**
- Close checks `shouldConfirmClose`
- Dialog shows for unsaved documents
- Save flows to SetTitleDialog if needed
- Discard deletes document from database
- Cancel keeps tab open

---

### T14: Update DocumentToolbar New Doc Creation [Frontend]
**Assignee:** senior-frontend-engineer
**Effort:** 30 minutes
**Parallelizable:** No (depends on T8)

**Actions:**
- Modify `src/features/prompts/components/DocumentToolbar.tsx`
- Update `handleNewDoc` to set `isNewDocument: true`
- Open tab with empty title string

**Success Criteria:**
- New documents open with `isNewDocument` flag
- Tab displays placeholder
- Flag persists in tab state

---

## Dependencies

### Critical Path
```
T1 (DB Migration)
  ↓
T2 (Validation Schemas)
  ↓
T3, T4, T5 (Backend Actions - parallel)
T6, T7 (Dialog Components - parallel)
  ↓
T8 (Types)
  ↓
T9 (Tab Store)
  ↓
T10, T11, T12 (Display Integration - parallel)
  ↓
T13 (Close Flow)
  ↓
T14 (Toolbar)
```

### External Dependencies
- Prisma CLI for migrations
- Shadcn Dialog and AlertDialog components
- Zod for validation
- Zustand persist middleware

---

## Risk Assessment

### High Risk
**Database Migration (T1)**
- Risk: Migration fails or breaks existing queries
- Mitigation: Test migration on dev database first, verify all existing documents preserved
- Rollback: Prisma migration rollback available

**Dialog Cascade (T10, T13)**
- Risk: SetTitleDialog and UnsavedChangesDialog state conflicts when cascading
- Mitigation: Use controlled state with proper cleanup, test cascade flow thoroughly
- Fallback: Sequential dialogs with explicit state management

### Medium Risk
**Tab State Persistence (T8, T9)**
- Risk: `isNewDocument` flag persists incorrectly after reload
- Mitigation: Reset flag to false after successful save, test reload scenarios
- Fallback: Don't persist `isNewDocument` flag across reloads

**Auto-save vs Manual Save (T5, T10)**
- Risk: Auto-save might interfere with title validation
- Mitigation: Keep auto-save separate from manual save, no title validation in auto-save
- Verification: Test auto-save with null titles extensively

### Low Risk
**Display Helpers (T2, T11, T12)**
- Risk: Edge cases with null/empty/whitespace titles
- Mitigation: Comprehensive unit tests for display helper
- Fallback: Default to placeholder for any falsy value

---

## Timeline

### Estimated Total Time: 8-12 hours (1-1.5 days FTE)

**Day 1 Morning (4 hours):**
- T1: Database Migration (0.5h)
- T2: Validation Schemas (0.75h)
- T3-T5: Backend Actions in parallel (1h)
- T6-T7: Dialog Components in parallel (2.5h)

**Day 1 Afternoon (4 hours):**
- T8: Types (0.17h)
- T9: Tab Store (0.75h)
- T10: EditorPane Integration (2h)
- T11-T12: Display Updates in parallel (0.67h)

**Day 2 Morning (2-4 hours):**
- T13: Close Flow Integration (2h)
- T14: Toolbar Update (0.5h)
- Testing and validation (1-2h)

### Milestones
- **M1:** Database and validation ready (T1-T2) - 1.25 hours
- **M2:** Backend complete (T3-T5) - 2.25 hours
- **M3:** UI components ready (T6-T7) - 4.75 hours
- **M4:** Integration complete (T8-T14) - 8-10 hours
- **M5:** All tests passing - 10-12 hours

---

**Plan Status**: ACTIVE
**PRP Status**: TODO
**PRP ID**: P5S4e
**Archon Project**: PromptHub (d449f266-1f36-47ad-bd2d-30f1a0f5e999)
**PRP Document**: PRPs/P5S4e-improved-document-naming.md
**Tasks**: 14 tasks (P5S4eT1 - P5S4eT14)
**Phase**: Phase 5 - Prompt Editor & Version Control
**Dependencies**: P5S4c (Complete)
**Implementation Status**: NOT YET STARTED (P5S4e)
**Testing Status**: NOT YET TESTED
**Next PRP**: P5S5 - Version History UI
**Recommendations:**
Agents:
- `senior-frontend-engineer` (Tasks 6, 7, 10, 11, 12, 13, 14)
- `senior-backend-engineer` (Tasks 1, 2, 3, 4, 5)
- `ux-ui-designer` (Review dialog UX for T6-T7)
- `qa-test-automation-engineer` (Write tests in parallel)
Notes:**
- T1 must complete first (blocking)
- T2 must complete before T3-T7 (shared dependency)
- T3-T5 can run in parallel (backend actions)
- T6-T7 can run in parallel (dialog components)
- T10-T12 can run partially in parallel (display updates)
- T13 depends on multiple previous tasks (critical integration)
- Full test suite required before completion
**Estimated Implementation Time (FTE):** 8-12 hours (1-1.5 days)
