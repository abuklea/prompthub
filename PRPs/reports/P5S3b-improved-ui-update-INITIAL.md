# PromptHub
## P5S3b - Improved UI Update: INITIAL Planning Report

| `Title` | `Created` | `Last modified` |
|---------|-----------|-----------------|
| P5S3b - Improved UI Update: INITIAL Planning Report | 07/11/2025 16:02 GMT+10 | 07/11/2025 16:02 GMT+10 |

## Table of Contents
- [Executive Summary](#executive-summary)
- [Task Breakdown](#task-breakdown)
- [Implementation Strategy](#implementation-strategy)
- [Risk Assessment](#risk-assessment)
- [Dependencies and Prerequisites](#dependencies-and-prerequisites)
- [Validation Plan](#validation-plan)

## Executive Summary

This PRP enhances the PromptHub UI from a basic 3-panel layout to a professional, feature-rich application. The implementation focuses on:

1. **Full-height Monaco editor** with proper scrolling and toolbar access
2. **Duplicate title prevention** for data integrity
3. **Subfolder creation** for hierarchical organization
4. **Panel subheaders** with context-aware toolbars
5. **Sort/filter systems** for folders and documents
6. **Auto-save with manual versioning** for data safety
7. **Placeholder UI** for future features

## Task Breakdown

### GROUP A: Layout Foundation (Sequential - Critical Path)

**P5S3bT1: Create PanelSubheader Component**
- Priority: CRITICAL
- Files: CREATE `src/components/layout/PanelSubheader.tsx`
- Description: Reusable subheader component between main header and panels
- Estimated Time: 30 minutes
- Success Criteria: Component renders with title and children slot

**P5S3bT2: Update Layout with Subheader Row**
- Priority: CRITICAL
- Files: MODIFY `src/app/(app)/layout.tsx`
- Description: Add subheader row with 3 aligned subheaders
- Estimated Time: 45 minutes
- Success Criteria: Three subheaders visible and aligned with panels

**P5S3bT3: Fix EditorPane Layout for Full-Height Monaco**
- Priority: CRITICAL
- Files: MODIFY `src/features/editor/components/EditorPane.tsx`
- Description: Restructure to flex layout for proper Monaco height
- Estimated Time: 1 hour
- Success Criteria: Monaco editor extends from title to footer, scrolls properly

### GROUP B: Folder Panel (Parallel after GROUP A)

**P5S3bT4: Add Subfolder Support to FolderItem [P]**
- Priority: HIGH
- Files: MODIFY `src/features/folders/components/FolderItem.tsx`
- Description: Enable recursive folder rendering with 5-level depth limit
- Estimated Time: 1.5 hours
- Success Criteria: Can create subfolders up to 5 levels, visual indentation works

**P5S3bT5: Add Folder Toolbar Component [P]**
- Priority: MEDIUM
- Files: CREATE `src/features/folders/components/FolderToolbar.tsx`
- Description: Toolbar with New/Rename/Delete/Sort/Filter controls
- Estimated Time: 1 hour
- Success Criteria: All buttons visible, context-aware enable/disable

**P5S3bT6: Integrate Folder Toolbar [P]**
- Priority: MEDIUM
- Files: MODIFY `src/features/folders/components/FolderTree.tsx`, `src/app/(app)/layout.tsx`
- Description: Move toolbar to subheader, apply sort/filter logic
- Estimated Time: 45 minutes
- Success Criteria: Toolbar in subheader, sort/filter working

### GROUP C: Documents Panel (Parallel after GROUP A)

**P5S3bT7: Rename "Prompts" to "Documents" [P]**
- Priority: LOW
- Files: MODIFY `src/features/prompts/components/PromptList.tsx`, `src/app/(app)/layout.tsx`
- Description: Update all user-facing text
- Estimated Time: 15 minutes
- Success Criteria: All UI shows "Documents" not "Prompts"

**P5S3bT8: Add Duplicate Title Validation [P]**
- Priority: HIGH
- Files: MODIFY `src/features/prompts/actions.ts`
- Description: Case-insensitive duplicate check before creation
- Estimated Time: 45 minutes
- Success Criteria: Cannot create duplicate titles, user-friendly error

**P5S3bT9: Add Document Toolbar Component [P]**
- Priority: MEDIUM
- Files: CREATE `src/features/prompts/components/DocumentToolbar.tsx`
- Description: Toolbar with New/Rename/Delete/Sort/Filter controls
- Estimated Time: 1 hour
- Success Criteria: All buttons visible, context-aware enable/disable

**P5S3bT10: Integrate Document Toolbar [P]**
- Priority: MEDIUM
- Files: MODIFY `src/features/prompts/components/PromptList.tsx`, `src/app/(app)/layout.tsx`
- Description: Move toolbar to subheader, apply sort/filter logic
- Estimated Time: 45 minutes
- Success Criteria: Toolbar in subheader, sort/filter working

### GROUP D: Editor Features (Parallel after GROUP A)

**P5S3bT11: Create Auto-Save Hook [P]**
- Priority: HIGH
- Files: CREATE `src/features/editor/hooks/useAutoSave.ts`
- Description: Custom hook with 500ms debounced auto-save
- Estimated Time: 1 hour
- Success Criteria: Auto-save triggers after 500ms, debouncing works

**P5S3bT12: Create localStorage Hook [P]**
- Priority: MEDIUM
- Files: CREATE `src/features/editor/hooks/useLocalStorage.ts`
- Description: Persist unsaved changes in localStorage
- Estimated Time: 45 minutes
- Success Criteria: Content persists across refreshes

**P5S3bT13: Add Auto-Save Action [P]**
- Priority: HIGH
- Files: MODIFY `src/features/editor/actions.ts`, CREATE `src/features/editor/schemas.ts`
- Description: Server action for auto-save (no version creation)
- Estimated Time: 1 hour
- Success Criteria: Auto-save updates content without creating version

**P5S3bT14: Integrate Auto-Save into EditorPane [P]**
- Priority: HIGH
- Files: MODIFY `src/features/editor/components/EditorPane.tsx`
- Description: Use hooks, show status, Ctrl+S for manual save
- Estimated Time: 1.5 hours
- Success Criteria: Auto-save works, Ctrl+S creates version, localStorage cleared

**P5S3bT15: Enable Monaco Full Features [P]**
- Priority: LOW
- Files: MODIFY `src/features/editor/components/Editor.tsx`
- Description: Enable context menu, find/replace, etc.
- Estimated Time: 15 minutes
- Success Criteria: Right-click and Ctrl+F work

### GROUP E: Placeholder UI (Parallel, anytime)

**P5S3bT16: Add Version History Button Placeholder [P]**
- Priority: LOW
- Files: MODIFY `src/app/(app)/layout.tsx`
- Description: Add "Version History" button showing "Coming Soon"
- Estimated Time: 15 minutes
- Success Criteria: Button visible, shows toast when clicked

**P5S3bT17: Create Dashboard Page Placeholder [P]**
- Priority: LOW
- Files: CREATE `src/app/(app)/dashboard/page.tsx`
- Description: Dashboard with placeholder stats cards
- Estimated Time: 30 minutes
- Success Criteria: Dashboard renders with 3 placeholder cards

**P5S3bT18: Add Settings Page Placeholders [P]**
- Priority: LOW
- Files: MODIFY `src/app/(app)/settings/page.tsx`
- Description: Add placeholder sections for future settings
- Estimated Time: 30 minutes
- Success Criteria: Settings page renders with disabled controls

### Additional Supporting Tasks

**P5S3bT19: Update UI Store with Sort/Filter State**
- Priority: HIGH
- Files: MODIFY `src/stores/use-ui-store.ts`
- Description: Add sort/filter state for folders and documents
- Estimated Time: 30 minutes
- Success Criteria: State management working, immutable updates

**P5S3bT20: Add Debounce Utility**
- Priority: MEDIUM
- Files: MODIFY `src/lib/utils.ts`
- Description: Add debounce helper function
- Estimated Time: 15 minutes
- Success Criteria: Debounce function working correctly

## Implementation Strategy

### Phase 1: Foundation (Sequential)
1. Execute GROUP A tasks (T1-T3) sequentially
2. Validate Monaco editor height immediately after T3
3. This establishes the layout foundation for all other work

### Phase 2: Parallel Implementation
1. Spawn multiple subagents for parallel execution:
   - `senior-frontend-engineer` for GROUP B (Folder Panel)
   - `senior-frontend-engineer` for GROUP C (Documents Panel)
   - `senior-frontend-engineer` for GROUP D (Editor Features)
   - `ux-ui-designer` for GROUP E (Placeholder UI)

2. Execute supporting tasks (T19-T20) early in Phase 2

### Phase 3: Integration & Testing
1. Validate all features working together
2. Run full validation loop (TypeScript, ESLint, Browser testing)
3. Test responsive behavior
4. Final checklist verification

## Risk Assessment

### High Risk Areas

**1. Monaco Editor Full Height**
- Risk: CSS layout issues preventing proper height
- Mitigation: Clear pseudocode provided, test immediately after T3
- Fallback: Stack Overflow pattern already documented

**2. Auto-Save Performance**
- Risk: Database hammering, race conditions
- Mitigation: 500ms debounce, proper cleanup on unmount
- Fallback: Increase debounce delay if needed

**3. Subfolder Recursion**
- Risk: Infinite loops or UI overflow
- Mitigation: Hard depth limit of 5 levels
- Fallback: Reduce depth limit if performance issues

### Medium Risk Areas

**4. localStorage Timing**
- Risk: Edge cases with auto-save and manual save
- Mitigation: Clear localStorage on manual save
- Fallback: Add more explicit state management

**5. Duplicate Validation**
- Risk: Case sensitivity issues
- Mitigation: Use Prisma's `mode: 'insensitive'`
- Fallback: Manual toLowerCase comparison

### Low Risk Areas

**6. UI Polish**
- Risk: Visual inconsistencies
- Mitigation: Follow existing patterns, use Shadcn components
- Fallback: Iterate based on visual testing

## Dependencies and Prerequisites

### Technical Dependencies
- Monaco Editor already integrated (P5S2 complete)
- Diff utils already implemented (P5S3 complete)
- Server actions pattern established
- Zustand store exists

### External Dependencies
- None - all features use existing infrastructure

### Blocking Dependencies
- GROUP A must complete before B, C, D can start
- T19 (UI Store) should complete early for other tasks to use

## Validation Plan

### Level 1: Type Safety
```bash
npm run build
# Expected: Success with no type errors
```

### Level 2: Linting
```bash
npm run lint
# Expected: No errors, warnings acceptable
```

### Level 3: Visual Testing
```bash
npm run dev
# Manual tests for all 13 success criteria from PRP
```

### Level 4: Responsive Testing
- Test on different screen sizes (1920x1080, 1366x768)
- Test different monitor heights for Monaco scrolling
- Verify layout adapts without breaking

### Success Metrics
- All 13 success criteria from PRP met
- Build passes without errors
- No console errors in browser
- Auto-save works smoothly
- Monaco editor usable on all screen sizes

## Timeline Estimate

| Phase | Duration | Tasks |
|-------|----------|-------|
| Phase 1: Foundation | 2-3 hours | T1-T3 (sequential) |
| Phase 2: Parallel Implementation | 6-8 hours | T4-T18 (parallel) |
| Phase 3: Integration & Testing | 2-3 hours | Validation loop |
| **Total** | **12-16 hours** | **20 tasks** |

Estimated completion: 1.5-2 days for single developer

With parallel subagents: Can compress to 8-10 hours total elapsed time

----
**Plan Status**: READY
**PRP Status**: TODO
**PRP ID**: P5S3b
**Archon Project**: PromptHub (d449f266-1f36-47ad-bd2d-30f1a0f5e999)
**PRP Document**: PRPs/P5S3b-improved-ui-update.md
**Tasks**: 20 tasks (P5S3bT1 - P5S3bT20)
**Phase**: Phase 5 - Prompt Editor & Version Control (Enhancement)
**Dependencies**: P5S3 (Complete) - Prompt Saving and Versioning Logic
**Implementation Status**: NOT YET STARTED (P5S3b)
**Testing Status**: NOT YET TESTED
**Next PRP**: P5S4 - Editor UI with Manual Save
**Documentation**:
PRPs/P5S3b-improved-ui-update.md
**Recommendations**:
Agents:
- `senior-frontend-engineer` (Tasks 1-15, 19-20)
- `ux-ui-designer` (Tasks 16-18)
Notes:
- GROUP A (T1-T3) MUST complete first - foundation for all other work
- GROUPS B, C, D can run in parallel after GROUP A
- GROUP E (placeholders) can run anytime
- T19 (UI Store) should complete early for other tasks to use
- Validate Monaco height immediately after T3
- Validate auto-save thoroughly in T14
**Estimated Implementation Time (FTE):** 12-16 hours (1.5-2 days)
