# PromptHub
## P5S5 - Fix Document Contamination and Race Conditions - INITIAL REPORT

| `Title` | `Created` | `Last modified` |
|---------|-----------|-----------------|
| P5S5 - Fix Document Contamination and Race Conditions - INITIAL REPORT | 09/11/2025 17:16 GMT+10 | 09/11/2025 17:16 GMT+10 |

## Table of Contents
- [Executive Summary](#executive-summary)
- [Problem Overview](#problem-overview)
- [Implementation Strategy](#implementation-strategy)
- [Task Breakdown](#task-breakdown)
- [Risk Assessment](#risk-assessment)
- [Success Criteria](#success-criteria)

---

## Executive Summary

**Status**: Ready for implementation
**Severity**: CRITICAL - Data integrity violation
**Impact**: All document switching operations affected
**Estimated Time**: 3 hours (2 hours implementation + 1 hour testing)

This PRP addresses three concurrent race conditions causing document content to "bleed" between documents during tab switching operations. The fix requires surgical changes to useLocalStorage hook and EditorPane component with comprehensive manual testing.

---

## Problem Overview

### Symptoms

Users experience severe data contamination:
1. **New documents show old content** - Creating documents while viewing another displays previous document's content
2. **Tab switching changes titles** - Document titles change to other documents' titles
3. **Content bleeding** - Rapid switching causes all documents to show identical content
4. **Poor UX** - Flashing wrong content instead of VSCode-like instant switching

### Root Causes

Three concurrent race conditions identified:

**Race #1: useLocalStorage Save on Key Change**
- Location: `src/features/editor/hooks/useLocalStorage.ts:78-87`
- Problem: Effect depends on both `key` and `value`, triggering saves during loads
- Impact: Old content saved to new document's localStorage key

**Race #2: EditorPane State Not Cleared**
- Location: `src/features/editor/components/EditorPane.tsx:129-225`
- Problem: No state clearing when switching documents
- Impact: Mixed state (new promptId + old content) triggers wrong saves

**Race #3: Cache Updated During Transition**
- Location: `src/features/editor/components/EditorPane.tsx:282-319`
- Problem: isTransitioning lock released too early via setTimeout
- Impact: Cache updated with contaminated mixed state

### Analysis Documents

**Primary**: `/home/allan/projects/PromptHub/wip/P5S5T8-document-contamination-race-condition-analysis.md`
**Plan**: `/home/allan/projects/PromptHub/docs/project/PromptHub_06_PLAN_01.md` (Step 5)

---

## Implementation Strategy

### Four-Part Fix

**Part 1: Fix useLocalStorage (30 minutes)**
- Replace ref comparison with boolean flag
- Remove 'key' from save effect dependencies
- Prevent saves during key transitions

**Part 2: Clear EditorPane State (30 minutes)**
- Add synchronous state clearing at function start
- Ensure no window with mixed state exists
- Clear BEFORE all guards and async operations

**Part 3: Extend Transition Guards (30 minutes)**
- Remove setTimeout for lock release
- Add cleanup effect for proper lock management
- Add isTransitioning guard to all save paths
- Add contentPromptId validation

**Part 4: Comprehensive Testing (1 hour)**
- Manual validation protocol
- DevTools inspection
- Console logging verification
- Document all results

### Agent Assignment

**Implementation (Tasks 1-6)**:
- Agent: `senior-frontend-engineer`
- Reason: Deep React hooks understanding required
- Focus: Effect timing, closure behavior, state management

**Testing (Tasks 7-10)**:
- Agent: `qa-test-automation-engineer`
- Reason: Comprehensive manual testing protocol
- Focus: Race condition validation, edge cases

**Documentation (Task 11)**:
- Agent: `senior-frontend-engineer`
- Reason: Results analysis and documentation
- Focus: Test results, remaining issues

### Parallelization Opportunities

Tasks 1-5 are sequential (each builds on previous).
Tasks 7-10 can be parallelized after Task 6 passes.
Task 11 summarizes all results.

---

## Task Breakdown

### Implementation Tasks

**P5S5T1: Fix useLocalStorage Hook**
- Time: 30 minutes
- File: `src/features/editor/hooks/useLocalStorage.ts`
- Changes: Replace prevKeyRef with justLoadedRef flag
- Critical: Remove 'key' from save effect dependencies

**P5S5T2: Clear EditorPane State Synchronously**
- Time: 20 minutes
- File: `src/features/editor/components/EditorPane.tsx`
- Changes: Add state clearing at line 142
- Critical: Clear BEFORE all guards

**P5S5T3: Add Cleanup Effect for Lock Release**
- Time: 15 minutes
- File: `src/features/editor/components/EditorPane.tsx`
- Changes: Remove setTimeout, add cleanup effect
- Critical: Lock releases when loading=false

**P5S5T4: Add Transition Guard to localStorage Save**
- Time: 10 minutes
- File: `src/features/editor/components/EditorPane.tsx`
- Changes: Add isTransitioning check to save effect
- Critical: Three guards total

**P5S5T5: Add Ownership Guard to Cache Update**
- Time: 15 minutes
- File: `src/features/editor/components/EditorPane.tsx`
- Changes: Add contentPromptIdRef validation
- Critical: Two guards for cache safety

**P5S5T6: Build and Lint Validation**
- Time: 10 minutes
- Commands: `npm run lint && npm run build`
- Critical: Zero errors required

### Testing Tasks

**P5S5T7: Test New Document Creation**
- Time: 15 minutes
- Protocol: Create docs while viewing others
- Verify: Empty content, no contamination

**P5S5T8: Test Rapid Tab Switching**
- Time: 20 minutes
- Protocol: 10+ rapid switches between 3 docs
- Verify: Content isolation maintained

**P5S5T9: Test localStorage Isolation**
- Time: 15 minutes
- Protocol: DevTools localStorage inspection
- Verify: Separate keys, no overwrites

**P5S5T10: Test Cache Isolation**
- Time: 20 minutes
- Protocol: Console logging cache updates
- Verify: Correct ownership, no mixed state

### Documentation Task

**P5S5T11: Document Results**
- Time: 10 minutes
- File: Update analysis document
- Add: Implementation results section

---

## Risk Assessment

### High Confidence Areas ✅

1. **Well-Understood Root Causes**
   - Complete race sequence documented
   - Exact timing windows identified
   - Clear before/after code provided

2. **Targeted Fixes**
   - Surgical changes to specific effects
   - Guards don't affect other functionality
   - TypeScript will catch errors

3. **Comprehensive Testing Protocol**
   - Manual validation steps defined
   - DevTools inspection included
   - Console verification specified

### Risk Areas ⚠️

1. **Manual Testing Only**
   - Mitigation: Detailed test protocol
   - No automated E2E tests exist
   - Timing-dependent bugs need careful validation

2. **React Strict Mode Interactions**
   - Mitigation: Test in development mode
   - Double-rendering must work correctly
   - loadedRef guards handle duplicates

3. **Edge Cases**
   - Mitigation: Testing protocol covers:
     - Rapid switching
     - New document creation
     - Browser refresh
     - Multiple tabs open

### Rollback Plan

If issues arise:
1. Git revert to before changes
2. Investigation document preserved
3. Original race conditions return (known behavior)
4. No data loss (localStorage/DB unaffected)

---

## Success Criteria

### Functional Requirements

✅ **New documents always empty**
- No content from previous documents
- Titles are null/placeholder
- localStorage keys isolated

✅ **Tab switching instant and correct**
- Cache provides instant display
- No flashing wrong content
- VSCode-like UX

✅ **No content bleeding**
- 10+ rapid switches maintain isolation
- Each document retains unique content
- Titles stay with correct documents

✅ **localStorage properly isolated**
- Each document has separate key
- Keys never overwrite each other
- Content persists correctly

✅ **documentCache properly isolated**
- Cache updates only with correct ownership
- No mixed state entries
- User-scoped with userId validation

### Technical Requirements

✅ **Build Quality**
- Zero TypeScript errors
- Zero ESLint warnings
- Clean compilation

✅ **React Best Practices**
- Correct effect dependencies
- No infinite loops
- Strict Mode compatible

✅ **Performance**
- No regressions
- Tab switching < 50ms
- Cache hit instant display

### Documentation Requirements

✅ **Code Comments**
- Critical sections explained
- Race conditions documented
- Why not just what

✅ **Results Documented**
- All test results recorded
- Success/failure noted
- Remaining issues listed

---

## Implementation Notes

### Critical Understanding Required

**React Effect Timing**:
- Effects run asynchronously after render
- State updates batched
- Refs update synchronously
- Closure capture can cause stale values

**Key Principles**:
1. State clearing must be synchronous and first
2. Effect dependencies must match intent
3. Guards must check multiple conditions
4. Lock release timing critical

### Before Starting

- [ ] Read PRP completely
- [ ] Review analysis document
- [ ] Understand all three race conditions
- [ ] Check React effect documentation
- [ ] Ensure dev environment ready

### During Implementation

- [ ] Make changes exactly as specified
- [ ] Add comments explaining critical sections
- [ ] Test after each major change
- [ ] Watch console for errors
- [ ] Verify no infinite loops

### After Implementation

- [ ] All tests pass
- [ ] Build succeeds
- [ ] No console errors
- [ ] Results documented
- [ ] Code reviewed

---

**Plan Status**: READY
**PRP Status**: TODO
**PRP ID**: P5S5
**Archon Project**: PromptHub (d449f266-1f36-47ad-bd2d-30f1a0f5e999)
**PRP Document**: PRPs/P5S5-fix-document-contamination-race-conditions.md
**Tasks**: 11 tasks (P5S5T1 - P5S5T11)
**Phase**: Phase 5 - Prompt Editor & Version Control (Step 5)
**Dependencies**: P5S4b (Complete), P5S4c (Complete), P5S4e (Complete)
**Implementation Status**: NOT YET STARTED (P5S5)
**Testing Status**: NOT YET TESTED
**Next PRP**: P5S6 - Version History UI
**Documentation**:
- PRPs/P5S5-fix-document-contamination-race-conditions.md
- wip/P5S5T8-document-contamination-race-condition-analysis.md
- docs/project/PromptHub_06_PLAN_01.md (Step 5)
**Recommendations:**
Agents:
- `senior-frontend-engineer` (Tasks 1-6, 11)
- `qa-test-automation-engineer` (Tasks 7-10)
Notes:**
- Critical race condition fix - requires deep React understanding
- Must understand effect timing and closure behavior
- Testing must be thorough to verify all contamination paths fixed
- Document results for future reference
**Estimated Implementation Time (FTE):** 3 hours (2 hours implementation + 1 hour testing)
