# PromptHub
## P5S4b - Fix Critical Bugs, Subheader Design, and Tooltip System - INITIAL REPORT

| `Title` | `Created` | `Last modified` |
|---------|-----------|-----------------|
| P5S4b - Fix Critical Bugs, Subheader Design, and Tooltip System - INITIAL REPORT | 07/11/2025 21:42 GMT+10 | 07/11/2025 21:42 GMT+10 |

## Table of Contents
- [Executive Summary](#executive-summary)
- [Task Breakdown](#task-breakdown)
- [Implementation Approach](#implementation-approach)
- [Risk Assessment](#risk-assessment)
- [Success Criteria](#success-criteria)

## Executive Summary

This initial report outlines the implementation plan for P5S4b, which addresses four critical issues affecting the PromptHub application:

1. **P0 CRITICAL BUG**: EditorPane displays wrong document content when switching between documents
2. **UI Update Bug**: CRUD operations on folders/documents don't reflect immediately (require page reload)
3. **Design Inconsistency**: Folder and document panel subheaders use different button styles
4. **Missing UX Feature**: No tooltip system for interactive controls

**Total Tasks**: 11 tasks (P5S4bT1-P5S4bT11)
**Priority**: P0 (Critical bug blocking core functionality)
**Estimated Time**: 4-6 hours

## Task Breakdown

### P5S4bT1: Fix EditorPane Content Sync Bug (CRITICAL - P0)
**Priority**: P0
**Time**: 30 minutes
**Assignee**: `senior-frontend-engineer`
**Description**: Add cleanup effect to reset content when selectedPrompt changes, preventing stale localStorage from showing wrong document content.
**Files**: `src/features/editor/components/EditorPane.tsx`

### P5S4bT2: Add Refetch Triggers to Zustand Store
**Priority**: P1
**Time**: 20 minutes
**Assignee**: `senior-frontend-engineer`
**Description**: Add folderRefetchTrigger and promptRefetchTrigger counters with increment actions to enable UI updates after CRUD operations.
**Files**: `src/stores/use-ui-store.ts`

### P5S4bT3: Update FolderTree to Use Refetch Trigger
**Priority**: P1
**Time**: 30 minutes
**Assignee**: `senior-frontend-engineer`
**Description**: Add folderRefetchTrigger dependency to loadFolders useEffect to enable automatic refetch when trigger increments.
**Files**: `src/features/folders/components/FolderTree.tsx`

### P5S4bT4: Update FolderToolbar to Trigger Refetch
**Priority**: P1
**Time**: 20 minutes
**Assignee**: `senior-frontend-engineer`
**Description**: Replace router.refresh() calls with triggerFolderRefetch() after create/rename/delete operations.
**Files**: `src/features/folders/components/FolderToolbar.tsx`

### P5S4bT5: Update PromptList to Use Refetch Trigger
**Priority**: P1
**Time**: 20 minutes
**Assignee**: `senior-frontend-engineer`
**Description**: Add promptRefetchTrigger dependency to loadPrompts useEffect for automatic refetch.
**Files**: `src/features/prompts/components/PromptList.tsx`

### P5S4bT6: Update DocumentToolbar to Trigger Refetch
**Priority**: P1
**Time**: 15 minutes
**Assignee**: `senior-frontend-engineer`
**Description**: Call triggerPromptRefetch() after successful document creation.
**Files**: `src/features/prompts/components/DocumentToolbar.tsx`

### P5S4bT7: Install Shadcn Tooltip Component
**Priority**: P1
**Time**: 10 minutes
**Assignee**: `senior-frontend-engineer`
**Description**: Install shadcn/ui tooltip component via CLI.
**Command**: `npx shadcn-ui@latest add tooltip`

### P5S4bT8: Add TooltipProvider to Root Layout
**Priority**: P1
**Time**: 10 minutes
**Assignee**: `senior-frontend-engineer`
**Description**: Wrap app content with TooltipProvider configured with 700ms delay.
**Files**: `src/app/(app)/layout.tsx`

### P5S4bT9: Update FolderToolbar with Tooltips
**Priority**: P2
**Time**: 30 minutes
**Assignee**: `senior-frontend-engineer`
**Description**: Wrap icon buttons with Tooltip components, providing descriptive hover text for all controls.
**Files**: `src/features/folders/components/FolderToolbar.tsx`

### P5S4bT10: Update DocumentToolbar with Icons and Tooltips
**Priority**: P2
**Time**: 45 minutes
**Assignee**: `senior-frontend-engineer`
**Description**: Replace text buttons with icon buttons matching FolderToolbar design, add tooltips to all controls.
**Files**: `src/features/prompts/components/DocumentToolbar.tsx`

### P5S4bT11: Update Implementation Plan Document
**Priority**: P2
**Time**: 15 minutes
**Assignee**: `senior-frontend-engineer`
**Description**: Add P5S4b step to implementation plan document.
**Files**: `docs/project/PromptHub_06_PLAN_01.md`

## Implementation Approach

### Phase 1: Critical Bug Fix (T1)
Immediate priority - fixes P0 bug blocking core functionality. Must be tested thoroughly before proceeding.

### Phase 2: Refetch System (T2-T6)
Implements Zustand-based refetch trigger system. Tasks should be done together as they form a cohesive feature. Order matters:
1. T2: Add store infrastructure
2. T3-T5: Update list components to listen
3. T4, T6: Update toolbars to trigger

### Phase 3: Tooltip System (T7-T10)
Can be parallelized after Phase 2 complete:
- T7-T8: Install and setup tooltip infrastructure
- T9-T10: Apply tooltips to toolbars (can be done in parallel)

### Phase 4: Documentation (T11)
Update plan document after all implementation complete.

## Risk Assessment

### High Risk Items
1. **EditorPane Fix (T1)**: Potential for introducing new race conditions
   - **Mitigation**: Thorough testing with multiple documents and rapid switching
   - **Fallback**: Revert to investigating useLocalStorage hook internals

2. **Refetch System (T2-T6)**: Potential for infinite loops or performance issues
   - **Mitigation**: Use Zustand devtools to monitor state changes
   - **Fallback**: Add debouncing to refetch triggers if needed

### Medium Risk Items
1. **Tooltip Provider (T8)**: Might conflict with existing UI providers
   - **Mitigation**: Check existing layout structure before wrapping
   - **Fallback**: Create separate provider for editor section only

### Low Risk Items
1. **Icon Changes (T10)**: Visual changes only, no logic impact
2. **Documentation Update (T11)**: No code risk

## Success Criteria

### Functional Requirements
- ✅ Switching documents shows correct content immediately (no wrong content)
- ✅ Creating folder/document appears in list without page reload
- ✅ Renaming folder/document updates in list without page reload
- ✅ Deleting folder/document removes from list without page reload
- ✅ Both subheaders use consistent icon-only button design
- ✅ All interactive controls show tooltips after 700ms hover
- ✅ Tooltip text is descriptive and context-aware (disabled states)

### Technical Requirements
- ✅ No TypeScript errors
- ✅ No ESLint errors
- ✅ Build completes successfully
- ✅ No performance regressions
- ✅ No infinite render loops
- ✅ Zustand state updates are immutable

### Testing Requirements
- ✅ Manual testing checklist complete (see PRP document)
- ✅ Rapid document switching shows correct content
- ✅ All CRUD operations update UI immediately
- ✅ Tooltips work with mouse and keyboard
- ✅ No regressions in existing functionality

## Dependencies

**Prerequisites**: P5S4 (Complete)
**Blocks**: P5S5 - Version History UI

**External Dependencies**:
- shadcn/ui CLI tool (already available)
- @radix-ui/react-tooltip (installed via shadcn)

**Internal Dependencies**:
- Zustand store infrastructure (existing)
- useLocalStorage hook (existing)
- Existing server actions for CRUD operations (existing)

---

**Plan Status**: READY
**PRP Status**: TODO
**PRP ID**: P5S4b
**Archon Project**: PromptHub (d449f266-1f36-47ad-bd2d-30f1a0f5e999)
**PRP Document**: PRPs/P5S4b-fix-subheader-tooltips-design.md
**Tasks**: 11 tasks (P5S4bT1-P5S4bT11)
**Phase**: Phase 5 - Prompt Editor & Version Control
**Dependencies**: P5S4 (Complete)
**Implementation Status**: NOT YET STARTED (P5S4b)
**Testing Status**: NOT YET TESTED
**Next PRP**: P5S5 - Version History UI
**Documentation**: PRPs/P5S4b-fix-subheader-tooltips-design.md
**Recommendations:**
Agents:
- `senior-frontend-engineer` (Tasks 1-11)
Notes:
- T1 is CRITICAL priority - fix immediately and test before proceeding
- T2-T6 form cohesive refetch system - implement together
- T7-T10 can be parallelized after T6 complete
- Use Zustand devtools to monitor state changes during implementation
**Estimated Implementation Time (FTE)**: 4-6 hours
