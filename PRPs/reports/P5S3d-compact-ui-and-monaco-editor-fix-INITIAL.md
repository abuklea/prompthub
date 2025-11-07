# PromptHub
## P5S3d - Compact UI and Monaco Editor Fix - INITIAL REPORT

| `Title` | `Created` | `Last modified` |
|---------|-----------|-----------------|
| P5S3d - Compact UI and Monaco Editor Fix - INITIAL REPORT | 07/11/2025 19:39 GMT+10 | 07/11/2025 19:39 GMT+10 |

## Table of Contents
- [Executive Summary](#executive-summary)
- [Implementation Overview](#implementation-overview)
- [Task Breakdown](#task-breakdown)
- [Risk Assessment](#risk-assessment)
- [Timeline](#timeline)
- [Dependencies](#dependencies)

## Executive Summary

This PRP addresses two critical UI improvements:
1. **Compact UI**: Reduce base font size from 16px to 12px (25% reduction) for power-user, IDE-like interface
2. **Monaco Editor Fix**: Resolve rendering bug where editor appears tiny (~50px) instead of filling vertical space

**Business Value**: More screen real estate, professional IDE feel, working editor functionality

**Technical Approach**:
- Global CSS font-size reduction with explicit component overrides
- Absolute positioning wrapper for Monaco height resolution

**Estimated Time**: 2-3 hours for single FTE

## Implementation Overview

### Phase 1: CSS Foundation (T1)
Modify `src/styles/globals.css` to set `html { font-size: 12px }`. This creates proportional scaling across all rem-based Tailwind classes.

### Phase 2: Component Sizing (T2-T5)
Explicitly override Shadcn component sizes to ensure consistent compact appearance:
- Button: h-9 → h-8 (default), h-8 → h-7 (small)
- Input: h-9 → h-8
- Label: text-sm → text-xs
- PanelSubheader: h-12 → h-10, text-sm → text-xs

### Phase 3: Monaco Editor Fix (T6-T7)
Add absolute positioning wrapper in EditorPane.tsx:
```tsx
<div className="flex-1 relative">
  <div className="absolute inset-0">
    <Editor height="100%" />
  </div>
</div>
```

This resolves Monaco's inability to read flex container dimensions.

### Phase 4: Validation (T8-T10)
- Build verification (T8)
- Visual testing at breakpoints: 375px, 768px, 1920px (T9)
- Interactive testing: panel resize, editor typing, navigation (T10)

## Task Breakdown

### T1: Global CSS Foundation [P]
**File**: `src/styles/globals.css`
**Action**: Add `font-size: 12px` to html element in @layer base
**Success**: All rem values scale proportionally
**Agent**: senior-frontend-engineer

### T2: Button Component Sizing [P]
**File**: `src/components/ui/button.tsx`
**Action**: Update size variants (default: h-8 px-3 text-xs, sm: h-7 px-2.5 text-xs)
**Success**: Buttons render compact but clickable
**Agent**: senior-frontend-engineer

### T3: Input Component Sizing [P]
**File**: `src/components/ui/input.tsx`
**Action**: Change h-9 → h-8, px-3 → px-2.5, py-1 → py-1.5
**Success**: Inputs compact and functional
**Agent**: senior-frontend-engineer

### T4: Label Component Sizing [P]
**File**: `src/components/ui/label.tsx`
**Action**: Change text-sm → text-xs
**Success**: Labels smaller, readable
**Agent**: senior-frontend-engineer

### T5: PanelSubheader Component Sizing [P]
**File**: `src/components/layout/PanelSubheader.tsx`
**Action**: Change h-12 → h-10, px-4 → px-3, text-sm → text-xs
**Success**: All three subheaders (folders, documents, editor) compact
**Agent**: senior-frontend-engineer

### T6: Monaco Editor Absolute Wrapper [P]
**File**: `src/features/editor/components/EditorPane.tsx`
**Action**: Add relative + absolute inset-0 wrapper around Editor component
**Success**: Monaco fills vertical space, not tiny
**Agent**: senior-frontend-engineer
**Critical**: Only modify container structure, preserve all Editor props

### T7: Verify Monaco Font Size [P]
**File**: `src/features/editor/components/Editor.tsx`
**Action**: READ ONLY - Verify fontSize: 14 is set and unchanged
**Success**: Confirmed code font remains 14px
**Agent**: senior-frontend-engineer

### T8: Build Verification
**Command**: `npm run build`
**Success**: Zero TypeScript errors, successful compilation
**Agent**: qa-test-automation-engineer
**Dependency**: T1-T7 complete

### T9: Visual Testing - Responsive Breakpoints
**Tool**: Chrome DevTools MCP
**Actions**:
- Resize to 375x812 (mobile), capture screenshot
- Resize to 768x1024 (tablet), capture screenshot
- Resize to 1920x1080 (desktop), capture screenshot
**Success**: Monaco fills height, no overflow, text readable at all breakpoints
**Agent**: qa-test-automation-engineer
**Dependency**: T8 complete

### T10: Interactive Testing
**Manual**: Test panel resizing, Monaco typing, button clicks, navigation
**Success**: All functionality works, UI compact, Monaco 14px font
**Agent**: qa-test-automation-engineer
**Dependency**: T9 complete

## Risk Assessment

### Low Risk ✅
- **Global font-size change**: Well-understood CSS mechanism, proportional scaling
- **Component overrides**: Explicit, isolated changes to specific files
- **Monaco absolute wrapper**: Proven pattern from design doc

### Medium Risk ⚠️
- **CSS cascade effects**: Other components might inherit unexpected sizes
  - *Mitigation*: Visual testing will catch issues, document for follow-up
- **Third-party component scaling**: Libraries might not scale properly
  - *Mitigation*: Identify in T9 visual testing, override if critical

### High Risk ❌
- None identified

## Timeline

**Estimated Total**: 2-3 hours (single FTE)

**Breakdown**:
- T1-T7 (Implementation): 1-1.5 hours (parallelizable)
- T8 (Build): 5-10 minutes
- T9 (Visual testing): 30-45 minutes
- T10 (Interactive testing): 15-30 minutes

**Parallelization**: T1-T7 can be executed by `senior-frontend-engineer` in parallel as they're independent file changes.

**Sequential Gates**:
1. T1-T7 → T8 (must build successfully before testing)
2. T8 → T9 (must compile before visual testing)
3. T9 → T10 (visual verification before interactive testing)

## Dependencies

**Prerequisite PRP**: P5S3c (Resizable Panels Layout) - COMPLETE ✅
- ResizablePanelsLayout component must exist and work
- Panel resize handles must be functional
- localStorage persistence must be working

**Files Required**:
- ✅ `src/styles/globals.css` (exists)
- ✅ `src/components/ui/button.tsx` (exists)
- ✅ `src/components/ui/input.tsx` (exists)
- ✅ `src/components/ui/label.tsx` (exists)
- ✅ `src/components/layout/PanelSubheader.tsx` (exists)
- ✅ `src/features/editor/components/EditorPane.tsx` (exists)
- ✅ `src/features/editor/components/Editor.tsx` (exists)

**External Dependencies**:
- Monaco React: `@monaco-editor/react` (already installed)
- Tailwind CSS: Configured with rem-based utilities
- Chrome DevTools MCP: For visual testing (T9)

----
**Plan Status**: READY
**PRP Status**: TODO
**PRP ID**: P5S3d
**Archon Project**: PromptHub (d449f266-1f36-47ad-bd2d-30f1a0f5e999)
**PRP Document**: PRPs/P5S3d-compact-ui-and-monaco-editor-fix.md
**Tasks**: 10 tasks (P5S3dT1 - P5S3dT10)
**Phase**: Phase 5 - Prompt Editor & Version Control
**Dependencies**: P5S3c (Complete)
**Implementation Status**: NOT YET STARTED (P5S3d)
**Testing Status**: NOT YET TESTED
**Next PRP**: P5S4 - Editor UI with Manual Save
**Documentation**:
- docs/plans/compact-ui-editor-fix-design.md
**Recommendations:**
Agents:
- `senior-frontend-engineer` (Tasks 1-7)
- `qa-test-automation-engineer` (Tasks 8-10)
Notes:
- T1-7 (Implementation) can run in parallel with `senior-frontend-engineer`
- T8-10 (Validation) sequential with `qa-test-automation-engineer`
- Use Chrome DevTools MCP for visual testing (T9)
- Monaco fontSize: 14 must remain unchanged (T7 verification)
**Estimated Implementation Time (FTE):** 2-3 hours
