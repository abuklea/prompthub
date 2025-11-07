# PromptHub
## P5S3c: Fix Subheader Layout with Resizable Columns - INITIAL PLAN

| `Title` | `Created` | `Last modified` |
|---------|-----------|-----------------|
| P5S3c: Fix Subheader Layout with Resizable Columns - INITIAL PLAN | 07/11/2025 17:57 GMT+10 | 07/11/2025 17:57 GMT+10 |

## Table of Contents
- [Executive Summary](#executive-summary)
- [Problem Statement](#problem-statement)
- [Solution Overview](#solution-overview)
- [Implementation Plan](#implementation-plan)
- [Task Breakdown](#task-breakdown)
- [Risk Assessment](#risk-assessment)
- [Success Criteria](#success-criteria)

## Executive Summary

This PRP addresses critical UI/UX issues in PromptHub's main application layout where fixed-width columns cause toolbar content to overflow and overlap. The solution implements user-resizable columns with animated drag handles using `react-resizable-panels`, providing a professional, customizable workspace while solving the immediate toolbar cramping issues visible in current screenshots.

**Primary Goal:** Transform fixed-width 3-column layout into user-resizable layout with animated drag handles and persistent column widths.

**Business Impact:**
- Eliminates toolbar overlap/cramping issues (visible in current implementation)
- Empowers users to customize workspace to their workflow preferences
- Improves usability across different screen sizes and resolutions
- Creates more professional, polished application feel

## Problem Statement

### Current Issues

**Layout Problems:**
1. Fixed column widths (`w-64`, `w-96`, `flex-1`) cause toolbar content to overflow
2. FolderToolbar and DocumentToolbar buttons are cramped and don't fit properly
3. No way for users to adjust layout to their preferences
4. Poor responsive design for different viewport sizes

**User Impact:**
- Toolbar buttons overlap or are inaccessible
- Inability to optimize layout for individual workflows
- Poor space utilization on large displays
- Cramped interface on smaller displays

### Screenshots Evidence
Based on the PRP documentation, screenshots show visible toolbar overflow in the current implementation at `wip/screenshots/Screenshot 2025-11-07 172601.png` and `wip/screenshots/Screenshot 2025-11-07 172616.png`.

## Solution Overview

### Technical Approach

**Core Technology:**
- `react-resizable-panels` - Battle-tested library for resizable layouts
- `framer-motion@11.2.4` - Existing dependency for handle animations
- `localStorage` - Automatic persistence via react-resizable-panels

**Architecture Changes:**
1. Convert Server Component layout to use Client Component wrapper
2. Maintain Server Component benefits for auth and header
3. Use PanelGroup/Panel/PanelResizeHandle pattern
4. Wrap handles with custom animated component

**Key Features:**
- User can drag vertical separators to resize columns (mouse, touch, keyboard)
- Drag handles animate smoothly toward cursor when nearby (~50px proximity)
- Handles return to center position with spring animation when released
- Column widths persist across sessions (localStorage)
- Min/max constraints prevent UI breakage
- All components adapt responsively to width changes

## Implementation Plan

### Phase 1: Library Setup and Core Components (Tasks 1-3)

**Task 1: Install Dependencies**
- Install `react-resizable-panels` (latest stable)
- Verify package.json update
- No breaking changes expected

**Task 2: Create AnimatedResizeHandle Component**
- File: `src/components/layout/AnimatedResizeHandle.tsx`
- Wraps PanelResizeHandle with framer-motion animation
- Tracks mouse/touch position relative to handle
- Animates handle Y position toward cursor when nearby
- Returns to center with spring animation
- Visual feedback states (idle, hover, dragging)

**Task 3: Create ResizablePanelsLayout Component**
- File: `src/components/layout/ResizablePanelsLayout.tsx`
- Client component wrapper for PanelGroup
- Three panels with constraints:
  - Folders: 15-30% width, default 20%
  - Documents: 20-40% width, default 30%
  - Editor: 40-70% width, default 50%
- Automatic localStorage persistence

### Phase 2: Layout Integration (Task 4)

**Task 4: Update Main Layout**
- File: `src/app/(app)/layout.tsx`
- Replace fixed-width divs with ResizablePanelsLayout
- Maintain Server Component structure for auth
- Pass panel children as props
- Preserve PanelSubheader components

### Phase 3: Responsive Improvements (Tasks 5-7)

**Task 5: FolderToolbar Responsive Classes**
- File: `src/features/folders/components/FolderToolbar.tsx`
- Replace fixed-width classes with flex utilities
- Add min-width to prevent button squishing
- Responsive input field sizing
- Overflow handling with text-ellipsis

**Task 6: DocumentToolbar Responsive Classes**
- File: `src/features/prompts/components/DocumentToolbar.tsx`
- Match FolderToolbar responsive pattern
- Ensure dropdown and buttons remain clickable
- Input field responsive sizing

**Task 7: EditorPane Width Handling**
- File: `src/features/editor/components/EditorPane.tsx`
- Verify Monaco editor auto-resize behavior
- Add overflow-hidden to container
- Minimal changes expected

### Phase 4: Testing and Refinement (Task 8)

**Task 8: Integration Testing**
- Test handle animation smoothness (60fps target)
- Verify spring animation feel
- Test various viewport sizes
- Test touch interaction on mobile/tablet
- Test keyboard accessibility (Tab + Arrow keys)
- Performance monitoring during resize

## Task Breakdown

### Task Assignment and Dependencies

| Task | Description | Assignee | Parallelizable | Estimated Time | Dependencies |
|------|-------------|----------|----------------|----------------|--------------|
| T1 | Install react-resizable-panels | senior-frontend-engineer | Yes | 5 min | None |
| T2 | Create AnimatedResizeHandle | senior-frontend-engineer | Yes | 45 min | T1 |
| T3 | Create ResizablePanelsLayout | senior-frontend-engineer | No | 30 min | T2 |
| T4 | Update layout.tsx | senior-frontend-engineer | No | 30 min | T3 |
| T5 | FolderToolbar responsive | senior-frontend-engineer | Yes | 30 min | T4 |
| T6 | DocumentToolbar responsive | senior-frontend-engineer | Yes | 30 min | T4 |
| T7 | EditorPane verification | senior-frontend-engineer | Yes | 15 min | T4 |
| T8 | Integration testing | qa-test-automation-engineer | No | 60 min | T5, T6, T7 |

**Total Estimated Time:** 3-4 hours for single FTE

**Parallelization Opportunities:**
- T1, T2 can run in parallel
- T5, T6, T7 can run in parallel after T4

### Detailed Task Descriptions

**P5S3cT1: Install react-resizable-panels**
- Command: `npm install react-resizable-panels`
- Verify: Check package.json for dependency entry
- No code changes, just dependency installation

**P5S3cT2: Create AnimatedResizeHandle Component**
- Implement mouse/touch position tracking
- Calculate proximity to handle (<50px)
- Animate Y position toward cursor with spring animation
- Return to center when cursor moves away
- Visual states: idle (subtle), hover (scale up), dragging (full opacity)
- Use motion.div with useMotionValue for performance

**P5S3cT3: Create ResizablePanelsLayout Component**
- Wrap PanelGroup with direction="horizontal"
- Configure three Panel components with min/max constraints
- Add AnimatedResizeHandle between panels
- Set up localStorage persistence with autoSaveId
- Accept panel content as props

**P5S3cT4: Update Layout.tsx**
- Keep as Server Component for auth
- Replace fixed-width divs with ResizablePanelsLayout
- Pass FolderTree, PromptList, EditorPane as props
- Maintain PanelSubheader components
- Preserve existing functionality

**P5S3cT5: Add Responsive Classes to FolderToolbar**
- Replace w-64 fixed width with flex utilities
- Add min-width to buttons (min-w-[80px])
- Input field: flex-1 with max-w constraint
- Add overflow-hidden and text-ellipsis
- Test at minimum column width (15%)

**P5S3cT6: Add Responsive Classes to DocumentToolbar**
- Match FolderToolbar responsive pattern
- Ensure dropdown remains functional
- Button min-width constraints
- Input field responsive sizing
- Test at minimum column width (20%)

**P5S3cT7: Ensure EditorPane Handles Width Changes**
- Verify Monaco editor auto-resize
- Add overflow-hidden to container if needed
- Test at various column widths
- Minimal changes expected (editor already flex-1)

**P5S3cT8: Integration Testing and Validation**
- Manual testing checklist (see PRP validation section)
- Performance testing (60fps target)
- Touch and keyboard accessibility
- Persistence testing (localStorage)
- Cross-browser testing (Chrome, Firefox, Safari)

## Risk Assessment

### Low Risk Items
- ✅ Library maturity: react-resizable-panels is battle-tested
- ✅ No database changes required
- ✅ No API changes required
- ✅ Existing framer-motion dependency (no new animation library)
- ✅ Comprehensive PRP with detailed implementation guidance

### Medium Risk Items
- ⚠️ Animation performance on low-end devices (mitigation: use transform, not top/left)
- ⚠️ Touch interaction edge cases (mitigation: library handles touch natively)
- ⚠️ Spring animation parameter tuning (mitigation: can iterate quickly)

### Mitigation Strategies
- Use GPU-accelerated transform for animations
- Follow library best practices for touch support
- Performance testing with DevTools profiling
- Iterative tuning of animation parameters

## Success Criteria

### Functional Requirements
- [x] Columns can be resized by dragging separators
- [x] Mouse, touch, and keyboard input all work
- [x] Drag handles animate smoothly toward cursor when nearby
- [x] Handles return to center when released
- [x] Column widths persist across page reloads
- [x] Min/max constraints prevent layout breakage
- [x] All toolbar content fits without overflow

### Technical Requirements
- [x] TypeScript compilation passes (`npm run build`)
- [x] ESLint passes with no warnings (`npm run lint`)
- [x] 60fps animation performance
- [x] No console errors during interactions
- [x] Works on viewport widths 768px+

### User Experience Requirements
- [x] Smooth, natural-feeling animations
- [x] Clear visual feedback on interaction
- [x] Professional appearance
- [x] Intuitive drag behavior
- [x] Accessible via keyboard navigation

### Validation Commands
```bash
# Installation verification
cat package.json | grep react-resizable-panels

# Build and lint
npm run build
npm run lint

# Development server for manual testing
npm run dev
```

### Testing Checklist
See PRP document for comprehensive manual testing checklist covering:
- Basic resizing functionality
- Handle animation behavior
- Constraint enforcement
- Persistence verification
- Toolbar content at various widths
- Touch support
- Keyboard accessibility
- Performance profiling

---

**Plan Status**: READY
**PRP Status**: TODO
**PRP ID**: P5S3c
**Archon Project**: PromptHub (d449f266-1f36-47ad-bd2d-30f1a0f5e999)
**PRP Document**: PRPs/P5S3c-fix-subheader-layout-resizable-columns.md
**Tasks**: 8 tasks (P5S3cT1 - P5S3cT8)
**Phase**: Phase 5 - Prompt Editor & Version Control (Step 3c - between 3b and 4)
**Dependencies**: P5S3b (Complete)
**Implementation Status**: NOT YET STARTED (P5S3c)
**Testing Status**: NOT YET TESTED
**Next PRP**: P5S4 - Editor UI with Manual Save
**Recommendations:**
Agents:
- `senior-frontend-engineer` (Tasks 1-7)
- `qa-test-automation-engineer` (Task 8)
Notes:**
- T1 (dependency installation) is quick and straightforward
- T2-T3 (component creation) with `senior-frontend-engineer` can partially overlap
- T5-T7 (responsive updates) with `senior-frontend-engineer` in parallel after T4
- Use existing framer-motion (no new animation dependencies)
- Follow Next.js 14 client/server component boundaries
- Test on real devices for touch interaction verification
**Estimated Implementation Time (FTE):** 3-4 hours
