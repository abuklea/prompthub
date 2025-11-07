# PromptHub
## Compact UI and Monaco Editor Fix - Design Document

| `Title` | `Created` | `Last modified` |
|---------|-----------|-----------------|
| Compact UI and Monaco Editor Fix - Design Document | 07/11/2025 19:26 GMT+10 | 07/11/2025 19:26 GMT+10 |

## Table of Contents
- [Overview](#overview)
- [Design Goals](#design-goals)
- [Approach: Hybrid CSS Base + Shadcn Overrides](#approach-hybrid-css-base--shadcn-overrides)
- [Section 1: Global CSS Foundation](#section-1-global-css-foundation)
- [Section 2: Shadcn Component Adjustments](#section-2-shadcn-component-adjustments)
- [Section 3: Monaco Editor Fix](#section-3-monaco-editor-fix)
- [Section 4: Responsive Layout Strategy](#section-4-responsive-layout-strategy)
- [Section 5: Implementation Validation](#section-5-implementation-validation)
- [Success Criteria](#success-criteria)

## Overview

This design addresses two primary issues in the PromptHub application:

1. **Font size reduction**: Reduce all UI text by 25-30% for a more compact, power-user interface
2. **Monaco editor rendering bug**: Fix the editor rendering extremely small instead of filling available vertical space

**Scope**: All text content (body, labels, buttons, inputs) and the Monaco editor component in the right panel.

## Design Goals

- **Moderate compactness**: 25-30% font size reduction (base font 16px → 12px)
- **Information density**: Power-user IDE-like feel with maximum screen real estate utilization
- **Editor fix**: Monaco editor must fill vertical space from subheader to footer
- **Responsive compatibility**: All changes must work across desktop, tablet, and mobile breakpoints
- **No regressions**: Existing functionality (resizable panels, auto-save, version control) must continue working

## Approach: Hybrid CSS Base + Shadcn Overrides

**Selected strategy**: Reduce base font in `globals.css`, then override Shadcn component sizes explicitly.

**Why this approach**:
- Clean cascade from root font-size change
- Explicit control over component sizing where needed
- Clear separation between global styles and component-specific adjustments
- Monaco editor font can be preserved independently (14px for code readability)

**Alternatives considered**:
1. ❌ CSS Variables + Tailwind Config only - too many component-specific edge cases
2. ❌ Component-level granular control only - repetitive, hard to maintain consistency

## Section 1: Global CSS Foundation

**File**: `src/styles/globals.css`

**Changes**:

```css
@layer base {
  /* Reduce root font size by 25% (16px → 12px) */
  html {
    font-size: 12px;
  }

  body {
    font-size: 1rem;  /* Now equals 12px instead of 16px */
    line-height: 1.5; /* Maintain readability */
  }
}
```

**Effect**: All rem-based values automatically scale down proportionally:
- `text-sm` (0.875rem) becomes 10.5px instead of 14px
- `p-4` (1rem) becomes 12px instead of 16px
- `h-10` (2.5rem) becomes 30px instead of 40px

**Preservation**: Monaco editor font will be explicitly set to 14px in `Editor.tsx` to maintain code readability.

## Section 2: Shadcn Component Adjustments

**Target components**: Button, Input, Label, PanelSubheader (core UI building blocks)

### Button (`src/components/ui/button.tsx`)

**Changes**:
```tsx
// Default variant sizing
- className: "h-10 px-4 py-2 text-sm"
+ className: "h-8 px-3 py-1.5 text-xs"

// Small variant sizing
- className: "h-9 px-3 text-sm"
+ className: "h-7 px-2.5 text-xs"
```

### Input (`src/components/ui/input.tsx`)

**Changes**:
```tsx
- className: "h-10 px-3 py-2 text-sm"
+ className: "h-8 px-2.5 py-1.5 text-sm"
```

Note: Keep `text-sm` - it will naturally be smaller with 12px base (10.5px rendered).

### Label (`src/components/ui/label.tsx`)

**Changes**:
```tsx
- className: "text-sm font-medium"
+ className: "text-xs font-medium"
```

### PanelSubheader (`src/components/layout/PanelSubheader.tsx`)

**Changes**:
```tsx
// Container height
- className: "h-12 px-4"
+ className: "h-10 px-3"

// Title text
- className: "text-sm font-semibold"
+ className: "text-xs font-semibold"
```

**Result**: More compact panel headers matching the reduced overall UI density.

## Section 3: Monaco Editor Fix

**Problem**: Monaco editor renders extremely small despite proper flex layout structure.

**Root cause**: Monaco's `height="100%"` prop requires parent to have concrete pixel dimensions. The `flex-1` class creates a flexible container, but Monaco (as a React component) cannot read computed CSS flex height.

**Solution**: Absolute positioning wrapper to give Monaco measurable dimensions.

**File**: `src/features/editor/components/EditorPane.tsx`

**Current structure** (broken):
```tsx
<div className="flex-1 overflow-hidden">
  <Editor height="100%" />  {/* Cannot measure parent height */}
</div>
```

**Fixed structure**:
```tsx
<div className="flex-1 overflow-hidden relative">
  {/* relative establishes positioning context */}

  <div className="absolute inset-0">
    {/* absolute + inset-0 = fills parent with measurable dimensions */}
    <Editor
      value={content}
      onChange={(value) => setContent(value || "")}
      language="markdown"
      height="100%"  {/* Now resolves to actual pixels */}
    />
  </div>
</div>
```

**Why this works**:
- `relative` on parent keeps it in flex flow
- `absolute inset-0` on wrapper makes it fill parent's content box completely
- Monaco can now resolve `height="100%"` to concrete pixel value
- Parent still responds to panel resizing via `flex-1`

**Responsive safety**: Absolute positioning is contained within relative parent that responds to resizing.

## Section 4: Responsive Layout Strategy

**Compatibility with ResizablePanelsLayout**:

The absolute positioning approach maintains responsive behavior because:

1. **Flex parent stays in flow**: `flex-1 overflow-hidden relative` remains a flex item
2. **Absolute child adapts**: `inset-0` fills whatever size parent becomes (300px or 800px)
3. **Panel resizing works**: `react-resizable-panels` resizes Panel components → parent resizes → absolute child follows

**Testing breakpoints**:
- **Mobile**: 375px width - panels may stack or scroll
- **Tablet**: 768px width - hybrid layout
- **Desktop**: 1920px width - full three-column layout

**Responsive behavior verification**:
- Drag panel handles → editor resizes smoothly
- Change browser width → proportional adjustment
- Monaco fills vertical space at all widths
- Font sizes remain consistent across breakpoints

## Section 5: Implementation Validation

### Level 1: Build Verification
```bash
npm run build
```
**Expected**: No TypeScript errors, successful build.

### Level 2: Visual Testing with Chrome DevTools

```bash
# Start dev server
npm run dev  # localhost:3010
```

**Chrome DevTools MCP workflow**:
```typescript
// 1. Load application
mcp__chrome-devtools__new_page({ url: "http://localhost:3010" })
mcp__chrome-devtools__take_screenshot({ fullPage: true })

// 2. Navigate to editor (select folder → select prompt)
mcp__chrome-devtools__click({ uid: "folder-item-1" })
mcp__chrome-devtools__click({ uid: "prompt-item-1" })

// 3. Capture editor state
mcp__chrome-devtools__take_screenshot({
  uid: "editor-pane",
  filePath: "wip/screenshots/editor-after-fix.png"
})

// 4. Test responsive breakpoints
mcp__chrome-devtools__resize_page({ width: 375, height: 812 })  // Mobile
mcp__chrome-devtools__take_screenshot({ filePath: "wip/screenshots/mobile-view.png" })

mcp__chrome-devtools__resize_page({ width: 768, height: 1024 })  // Tablet
mcp__chrome-devtools__take_screenshot({ filePath: "wip/screenshots/tablet-view.png" })

mcp__chrome-devtools__resize_page({ width: 1920, height: 1080 })  // Desktop
mcp__chrome-devtools__take_screenshot({ filePath: "wip/screenshots/desktop-view.png" })
```

### Level 3: Interactive Testing

**Manual verification checklist**:
- [ ] Drag panel resize handles - smooth resizing
- [ ] Type in Monaco editor - characters render at 14px
- [ ] Ctrl+S to save - button responds correctly
- [ ] Navigate between prompts - editor reloads properly
- [ ] Auto-save indicator updates correctly

## Success Criteria

**Font size reduction**:
- ✅ Body text is ~25% smaller than before (12px base vs 16px)
- ✅ Button labels are compact but readable (text-xs)
- ✅ Input fields have reduced height (h-8 vs h-10)
- ✅ Panel subheaders are more compact (h-10 vs h-12)
- ✅ Overall UI feels tighter and information-dense

**Monaco editor fix**:
- ✅ Editor fills vertical space from subheader to footer
- ✅ No tiny rendering issue
- ✅ Content is scrollable within editor
- ✅ Editor font remains at 14px (not affected by 12px base)

**Responsive layout**:
- ✅ All breakpoints render without overflow (375px, 768px, 1920px)
- ✅ Font sizes remain consistent across breakpoints
- ✅ Panel resizing works smoothly at all widths
- ✅ Editor maintains full height at all widths

**No regressions**:
- ✅ Build passes without errors
- ✅ No visual regressions (overflow, cut-off content)
- ✅ Interactive features work (resizing, typing, saving, auto-save)
- ✅ Version control features still function
- ✅ ResizablePanelsLayout localStorage persistence works
