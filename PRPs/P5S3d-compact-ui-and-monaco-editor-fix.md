# PromptHub
## P5S3d - Compact UI and Monaco Editor Fix

| `Title` | `Created` | `Last modified` |
|---------|-----------|-----------------|
| P5S3d - Compact UI and Monaco Editor Fix | 07/11/2025 19:33 GMT+10 | 07/11/2025 19:33 GMT+10 |

## Table of Contents
- [Goal](#goal)
- [Why](#why)
- [What](#what)
- [Success Criteria](#success-criteria)
- [All Needed Context](#all-needed-context)
- [Implementation Blueprint](#implementation-blueprint)
- [Validation Loop](#validation-loop)
- [Final Validation Checklist](#final-validation-checklist)
- [Anti-Patterns to Avoid](#anti-patterns-to-avoid)

## Goal

Reduce all UI text by 25-30% for a more compact, power-user interface AND fix the Monaco editor rendering bug where the editor renders extremely small instead of filling available vertical space.

**Two distinct problems being solved**:
1. **Font size reduction**: Base font 16px → 12px for information-dense IDE-like feel
2. **Monaco editor bug**: Editor renders tiny instead of filling flex container height

**End state**:
- All UI text (buttons, inputs, labels, headers) is 25% smaller
- Monaco editor fills vertical space from subheader to footer
- Editor code font remains at 14px for readability
- Responsive layout works across all breakpoints (375px, 768px, 1920px)
- Panel resizing continues working smoothly

## Why

**Business value**:
- Power users expect compact, information-dense interfaces
- More screen real estate for content = better productivity
- IDE-like feel matches target audience expectations (developers/prompt engineers)

**Technical necessity**:
- Monaco editor currently broken - renders ~50px tall instead of full height
- Flex-1 container doesn't provide measurable dimensions for Monaco's height="100%" prop
- React components cannot read computed CSS flex height

**Integration with existing features**:
- Must maintain ResizablePanelsLayout functionality (P5S3c)
- Must preserve Monaco editor features (context menu, find/replace) from P5S3b
- Must work with Bold Simplicity design system color scheme

**Problems this solves**:
- For users: Editor is unusable when tiny, UI feels too spacious/wasteful
- For developers: Clear fix pattern for Monaco height issues in flex containers

## What

**User-visible behavior**:
1. All text is noticeably smaller but still readable (12px base instead of 16px)
2. Buttons, inputs, and headers are more compact
3. Monaco editor fills the entire right panel from top to bottom
4. Typing in editor shows 14px font (unchanged)
5. Panel resizing works smoothly without layout breaks

**Technical requirements**:
1. Modify `globals.css` to set `html { font-size: 12px }`
2. Override Shadcn component sizes explicitly (Button, Input, Label, PanelSubheader)
3. Wrap Monaco editor in absolute positioning container
4. Verify Editor.tsx preserves 14px fontSize option
5. Test responsive breakpoints (mobile, tablet, desktop)
6. Ensure build passes with zero errors

### Success Criteria

- [x] Base font is 12px (25% reduction from 16px)
- [x] Button default variant: h-8 px-3 py-1.5 text-xs
- [x] Button small variant: h-7 px-2.5 text-xs
- [x] Input: h-8 px-2.5 py-1.5
- [x] Label: text-xs
- [x] PanelSubheader: h-10 px-3 text-xs
- [x] Monaco editor fills vertical space (not tiny)
- [x] Monaco font is 14px (explicitly set, preserved)
- [x] Build succeeds: `npm run build` with zero errors
- [x] Mobile (375px): No overflow, readable text
- [x] Tablet (768px): Proper layout, resizing works
- [x] Desktop (1920px): Full features, smooth resizing
- [x] Panel resizing works at all widths
- [x] No visual regressions (overflow, cut-off content)

## All Needed Context

### Documentation & References

```yaml
# MUST READ - Include these in your context window

- file: docs/plans/compact-ui-editor-fix-design.md
  why: Complete design rationale, approach selection, responsive strategy, validation workflow
  critical: Explains WHY absolute positioning solves Monaco height bug

- file: src/components/layout/ResizablePanelsLayout.tsx
  why: Understanding panel structure - ensures Monaco fix doesn't break resizing
  critical: flex-1 parent must stay in flex flow for resize to work

- file: src/features/editor/components/EditorPane.tsx
  why: Current broken structure - flex-1 parent with Monaco height="100%"
  critical: Line 200+ shows current editor container needing fix

- file: src/features/editor/components/Editor.tsx
  why: Verify fontSize: 14 is set and won't be affected by global font-size
  critical: Line 106 - fontSize option must remain 14px

- url: https://github.com/suren-atoyan/monaco-react#readme
  section: Props documentation (height prop)
  critical: Monaco requires explicit height - cannot resolve "100%" from flex parent

- file: src/components/ui/button.tsx
  why: Current button sizing to be modified
  critical: Lines 24-26 show current h-9 sizing

- file: src/components/ui/input.tsx
  why: Current input sizing to be modified
  critical: Line 11 shows current h-9 sizing

- file: src/components/layout/PanelSubheader.tsx
  why: Current header sizing to be modified
  critical: Lines 40-41 show current h-12 and text-sm sizing
```

### Current Codebase Tree

```bash
/home/allan/projects/PromptHub/
├── src/
│   ├── styles/
│   │   └── globals.css                              # MODIFY: Root font-size 16px → 12px
│   ├── components/
│   │   ├── ui/
│   │   │   ├── button.tsx                          # MODIFY: h-9 → h-8, text-sm → text-xs
│   │   │   ├── input.tsx                           # MODIFY: h-9 → h-8
│   │   │   └── label.tsx                           # MODIFY: text-sm → text-xs
│   │   └── layout/
│   │       ├── PanelSubheader.tsx                  # MODIFY: h-12 → h-10, text-sm → text-xs
│   │       └── ResizablePanelsLayout.tsx           # NO CHANGE: Verify compatibility
│   └── features/
│       └── editor/
│           └── components/
│               ├── EditorPane.tsx                   # MODIFY: Add absolute wrapper
│               └── Editor.tsx                       # VERIFY: fontSize: 14 unchanged
└── docs/
    └── plans/
        └── compact-ui-editor-fix-design.md         # REFERENCE: Full design spec
```

### Known Gotchas & Library Quirks

```typescript
// CRITICAL: Monaco height="100%" requires parent with concrete pixel dimensions
// ❌ BROKEN: This doesn't work
<div className="flex-1">
  <Editor height="100%" />  // Monaco can't read computed flex height
</div>

// ✅ FIXED: This works
<div className="flex-1 relative">
  <div className="absolute inset-0">
    <Editor height="100%" />  // Now resolves to actual pixels
  </div>
</div>

// CRITICAL: Tailwind rem values scale with html font-size
// When html { font-size: 12px }:
// - text-sm (0.875rem) becomes 10.5px instead of 14px
// - p-4 (1rem) becomes 12px instead of 16px
// - h-10 (2.5rem) becomes 30px instead of 40px
// This is INTENTIONAL - creates proportional scaling

// CRITICAL: Monaco Editor fontSize is independent
// Editor.tsx line 106: fontSize: 14
// This is set via Monaco options, NOT affected by CSS font-size
// Don't change this - code needs 14px for readability

// CRITICAL: Absolute positioning needs relative wrapper
// ❌ WRONG: <div className="flex-1 absolute"> breaks flex layout
// ✅ RIGHT: <div className="flex-1 relative"><div className="absolute inset-0">

// CRITICAL: ResizablePanelsLayout uses localStorage
// autoSaveId="main-layout" persists panel widths
// Don't change this ID or users lose saved layouts
```

## Implementation Blueprint

### Task List (10 Tasks)

```yaml
Task 1: Global CSS Foundation
  MODIFY: src/styles/globals.css
  FIND: "html {"
  CHANGE: Add "font-size: 12px;" in @layer base html block
  VERIFY: All rem values will now scale from 12px base

Task 2: Button Component Sizing
  MODIFY: src/components/ui/button.tsx
  FIND: 'default: "h-9 px-4 py-2"'
  CHANGE: 'default: "h-8 px-3 py-1.5 text-xs"'
  FIND: 'sm: "h-8 rounded-md px-3 text-xs"'
  CHANGE: 'sm: "h-7 rounded-md px-2.5 text-xs"'
  VERIFY: Buttons render smaller but readable

Task 3: Input Component Sizing
  MODIFY: src/components/ui/input.tsx
  FIND: '"flex h-9 w-full'
  CHANGE: '"flex h-8 w-full'
  FIND: 'px-3 py-1'
  CHANGE: 'px-2.5 py-1.5'
  VERIFY: Inputs are more compact

Task 4: Label Component Sizing
  MODIFY: src/components/ui/label.tsx
  FIND: '"text-sm font-medium'
  CHANGE: '"text-xs font-medium'
  VERIFY: Labels are smaller

Task 5: PanelSubheader Component Sizing
  MODIFY: src/components/layout/PanelSubheader.tsx
  FIND: '"h-12 px-4'
  CHANGE: '"h-10 px-3'
  FIND: '"text-sm font-semibold'
  CHANGE: '"text-xs font-semibold'
  VERIFY: Three subheaders (folders, documents, editor) all smaller

Task 6: Monaco Editor Fix - Add Absolute Wrapper
  MODIFY: src/features/editor/components/EditorPane.tsx
  FIND: Pattern around line 200:
    <div className="flex-1 overflow-hidden">
      <Editor
        value={content}
        onChange={(value) => setContent(value || "")}
        language="markdown"
        height="100%"
      />
    </div>
  REPLACE WITH:
    <div className="flex-1 overflow-hidden relative">
      {/* Reason: Absolute wrapper gives Monaco measurable dimensions */}
      <div className="absolute inset-0">
        <Editor
          value={content}
          onChange={(value) => setContent(value || "")}
          language="markdown"
          height="100%"
        />
      </div>
    </div>
  VERIFY: Editor fills vertical space

Task 7: Verify Monaco Font Size Preserved
  READ: src/features/editor/components/Editor.tsx
  VERIFY: Line 106 shows "fontSize: 14"
  CONFIRM: This remains unchanged - code readability requires 14px
  NO CHANGES: This file should not be modified

Task 8: Build Verification
  RUN: npm run build
  EXPECTED: No TypeScript errors, successful build
  IF ERRORS: Read error messages, fix issues, retry

Task 9: Visual Testing - Responsive Breakpoints
  RUN: npm run dev
  USE: Chrome DevTools MCP to test breakpoints:
    - Mobile: 375x812
    - Tablet: 768x1024
    - Desktop: 1920x1080
  CAPTURE: Screenshots for each breakpoint
  VERIFY: No overflow, Monaco fills space, text readable

Task 10: Interactive Testing
  MANUAL: Open http://localhost:3010
  TEST:
    - Drag panel resize handles - smooth resizing
    - Type in Monaco editor - font is 14px
    - Click buttons - smaller but functional
    - Navigate between prompts - editor reloads properly
  VERIFY: All functionality works, UI feels compact
```

### Detailed Implementation Guidance

#### Task 1: Global CSS Foundation

**Location**: `src/styles/globals.css` lines 5-8

**Current Code**:
```css
@layer base {
  :root {
    /* Light mode - PromptHub Style Guide */
    --background: 220 14% 96%;
```

**Add After** `:root {` **Line**:
```css
@layer base {
  /* Reduce root font size by 25% (16px → 12px) */
  html {
    font-size: 12px;
  }

  :root {
    /* Light mode - PromptHub Style Guide */
```

**Why This Works**:
- Tailwind uses rem units that scale with html font-size
- Changing base to 12px makes all rem values 25% smaller
- Components using px values unaffected (need explicit overrides)

**Effect**: All rem-based Tailwind classes automatically scale down proportionally.

---

#### Task 2: Button Component Sizing

**Location**: `src/components/ui/button.tsx` lines 24-26

**Current Code**:
```typescript
size: {
  default: "h-9 px-4 py-2",
  sm: "h-8 rounded-md px-3 text-xs",
  lg: "h-10 rounded-md px-8",
```

**Change To**:
```typescript
size: {
  default: "h-8 px-3 py-1.5 text-xs",
  sm: "h-7 rounded-md px-2.5 text-xs",
  lg: "h-10 rounded-md px-8",  // Keep lg size for special cases
```

**Rationale**:
- default: h-9 (36px) → h-8 (32px) = 11% smaller
- Small: h-8 (32px) → h-7 (28px) = 12.5% smaller
- Padding proportionally reduced
- text-xs explicit (not affected by rem scaling)

---

#### Task 3: Input Component Sizing

**Location**: `src/components/ui/input.tsx` line 11

**Current Code**:
```typescript
"flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-base shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
```

**Change To**:
```typescript
"flex h-8 w-full rounded-md border border-input bg-transparent px-2.5 py-1.5 text-base shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
```

**Changes**:
- `h-9` → `h-8` (36px → 32px)
- `px-3` → `px-2.5` (12px → 10px with new base)
- `py-1` → `py-1.5` (4px → 6px with new base)

**Note**: text-base and text-sm will automatically scale with new 12px base font.

---

#### Task 4: Label Component Sizing

**Location**: `src/components/ui/label.tsx` (find text-sm in className)

**Current Pattern**:
```typescript
"text-sm font-medium ..."
```

**Change To**:
```typescript
"text-xs font-medium ..."
```

**Effect**: Labels now render at 10.5px (text-xs with 12px base) instead of 14px.

---

#### Task 5: PanelSubheader Component Sizing

**Location**: `src/components/layout/PanelSubheader.tsx` lines 40-44

**Current Code**:
```typescript
<div
  className={cn(
    "flex items-center justify-between",
    "h-12 px-4 border-b bg-muted/30",
    className
  )}
>
  <h2 className="text-sm font-semibold text-foreground">
    {title}
  </h2>
```

**Change To**:
```typescript
<div
  className={cn(
    "flex items-center justify-between",
    "h-10 px-3 border-b bg-muted/30",
    className
  )}
>
  <h2 className="text-xs font-semibold text-foreground">
    {title}
  </h2>
```

**Changes**:
- Container: `h-12` → `h-10` (48px → 40px with rem scaling)
- Container: `px-4` → `px-3` (16px → 12px with rem scaling)
- Title: `text-sm` → `text-xs`

**Impact**: All three panel subheaders (Folders, Documents, Editor) become more compact.

---

#### Task 6: Monaco Editor Fix - Absolute Positioning Wrapper

**Location**: `src/features/editor/components/EditorPane.tsx` around line 200

**Current Broken Code**:
```tsx
{/* Editor Section - Flexible Height */}
<div className="flex-1 overflow-hidden">
  <Editor
    value={content}
    onChange={(value) => setContent(value || "")}
    language="markdown"
    height="100%"
  />
</div>
```

**Fixed Code**:
```tsx
{/* Editor Section - Flexible Height */}
<div className="flex-1 overflow-hidden relative">
  {/* Reason: Absolute wrapper gives Monaco measurable dimensions for height="100%" */}
  <div className="absolute inset-0">
    <Editor
      value={content}
      onChange={(value) => setContent(value || "")}
      language="markdown"
      height="100%"
    />
  </div>
</div>
```

**Why This Fix Works**:

1. **Problem**: Monaco's `height="100%"` requires parent with concrete pixel dimensions
   - `flex-1` creates flexible container
   - Monaco (React component) cannot read computed CSS flex height
   - Result: Editor renders tiny (~50px)

2. **Solution**: Absolute positioning wrapper
   - `relative` on parent keeps it in flex flow
   - `absolute inset-0` on wrapper fills parent's content box completely
   - Monaco can now resolve `height="100%"` to concrete pixel value

3. **Responsive Safety**:
   - Parent still responds to panel resizing via `flex-1`
   - Absolute child adapts to whatever size parent becomes
   - ResizablePanelsLayout continues working normally

**Critical**: Only add `relative` and the inner `absolute inset-0` div. Don't change any other props.

---

#### Task 7: Verify Monaco Font Size Preserved

**Location**: `src/features/editor/components/Editor.tsx` line 106

**Verification**:
```typescript
// Configure editor options with sensible defaults
editor.updateOptions({
  fontSize: 14,  // ✅ VERIFY: This must remain 14px
  fontFamily: 'var(--font-geist-mono, monospace)',
  lineHeight: 1.6,
  padding: { top: 16, bottom: 16 },
  // ...
})
```

**Action**: READ ONLY, NO CHANGES
- Confirm `fontSize: 14` is set
- This is independent of global font-size
- Code readability requires 14px minimum

**If Modified by Mistake**: Revert to `fontSize: 14`

---

## Validation Loop

### Level 1: Syntax & Style

```bash
# Run these FIRST - fix any errors before proceeding
npm run lint    # ESLint + Next.js linting
npm run build   # TypeScript type checking + production build

# Expected:
# ✓ Compiled successfully
# No TypeScript errors
# No ESLint warnings

# If errors occur:
# 1. READ the error message carefully
# 2. IDENTIFY which file and line
# 3. FIX the specific issue (usually missing import or type error)
# 4. RE-RUN the command
# 5. ITERATE until clean
```

### Level 2: Visual Testing with Chrome DevTools MCP

```bash
# Start dev server
npm run dev  # Runs on localhost:3010
```

**Testing Workflow**:

```typescript
// 1. Load application
mcp__chrome-devtools__new_page({ url: "http://localhost:3010" })
mcp__chrome-devtools__take_screenshot({
  fullPage: true,
  filePath: "wip/screenshots/P5S3d-baseline-desktop.png"
})

// 2. Login if needed (use test user)
// Navigate to dashboard to see main 3-panel layout

// 3. Test Mobile Breakpoint (375x812 - iPhone SE)
mcp__chrome-devtools__resize_page({ width: 375, height: 812 })
mcp__chrome-devtools__take_screenshot({
  filePath: "wip/screenshots/P5S3d-mobile-compact.png"
})
// Verify: No horizontal overflow, text readable, Monaco fills height

// 4. Test Tablet Breakpoint (768x1024 - iPad)
mcp__chrome-devtools__resize_page({ width: 768, height: 1024 })
mcp__chrome-devtools__take_screenshot({
  filePath: "wip/screenshots/P5S3d-tablet-compact.png"
})
// Verify: Layout adjusts properly, buttons clickable, Monaco responsive

// 5. Test Desktop Breakpoint (1920x1080)
mcp__chrome-devtools__resize_page({ width: 1920, height: 1080 })
mcp__chrome-devtools__take_screenshot({
  filePath: "wip/screenshots/P5S3d-desktop-compact.png"
})
// Verify: All panels visible, Monaco full height, text compact

// 6. Capture Specific Element (Monaco Editor)
mcp__chrome-devtools__take_snapshot()  // Get UIDs
mcp__chrome-devtools__take_screenshot({
  uid: "editor-pane-uid",  // Use actual UID from snapshot
  filePath: "wip/screenshots/P5S3d-monaco-fullheight.png"
})
// Verify: Editor fills from subheader to bottom
```

**Visual Checklist**:
- [ ] Text is noticeably smaller across all UI elements
- [ ] Buttons are compact but still clickable
- [ ] Inputs are reduced height but functional
- [ ] Panel subheaders are tighter
- [ ] Monaco editor fills vertical space (NOT tiny)
- [ ] No horizontal scrollbar at any breakpoint
- [ ] No content overflow or cut-off text

### Level 3: Interactive Testing

**Manual verification steps**:

1. **Panel Resizing**:
   - Drag left handle (folders ↔ documents)
   - Drag right handle (documents ↔ editor)
   - Expected: Smooth resizing, Monaco adjusts height dynamically

2. **Monaco Editor**:
   - Click in editor
   - Type several lines of text
   - Expected: Text appears at 14px font size (larger than UI text)
   - Right-click → context menu appears
   - Ctrl+F → Find dialog appears

3. **Button Interactions**:
   - Click "New Folder" button
   - Click "New Prompt" button
   - Click "Save" button (Ctrl+S)
   - Expected: All buttons respond, smaller but functional

4. **Form Inputs**:
   - Type in prompt title field
   - Expected: Input is compact but usable, text readable

5. **Navigation**:
   - Click between folders
   - Click between prompts
   - Expected: Monaco reloads properly, maintains full height

6. **Responsive Behavior**:
   - Manually resize browser window
   - Test from 375px to 1920px width
   - Expected: Layout adapts, no breaks, Monaco always fills height

**Error Conditions to Test**:
- Select non-existent prompt → error message should be compact
- Create duplicate folder name → validation error readable

## Final Validation Checklist

Before marking task complete:

- [ ] All code changes committed with proper message
- [ ] `npm run build` succeeds with zero errors
- [ ] `npm run lint` shows no warnings
- [ ] Base font is 12px in globals.css
- [ ] Button variants updated (h-8 default, h-7 small)
- [ ] Input height reduced to h-8
- [ ] Label uses text-xs
- [ ] PanelSubheader uses h-10 and text-xs
- [ ] EditorPane has absolute positioning wrapper
- [ ] Editor.tsx fontSize unchanged at 14px
- [ ] Screenshots captured for mobile/tablet/desktop
- [ ] Monaco editor fills vertical space (verified in screenshots)
- [ ] Monaco font is 14px (verified by typing in editor)
- [ ] Panel resizing works smoothly (manually tested)
- [ ] No overflow at 375px width (screenshot verification)
- [ ] No overflow at 768px width (screenshot verification)
- [ ] No overflow at 1920px width (screenshot verification)
- [ ] All interactive elements functional (buttons, inputs, editor)
- [ ] No visual regressions (text cut-off, broken layout)

## Anti-Patterns to Avoid

❌ **Don't change Monaco fontSize in Editor.tsx**
- Code needs 14px minimum for readability
- This is set via Monaco options, independent of CSS font-size

❌ **Don't use height: auto on Monaco**
- Monaco requires explicit height prop
- "auto" won't work - must be px, %, or vh value

❌ **Don't put absolute positioning directly in flex flow**
```typescript
// ❌ WRONG: Breaks flex layout
<div className="flex-1 absolute inset-0">
  <Editor ... />
</div>

// ✅ RIGHT: Needs relative wrapper
<div className="flex-1 relative">
  <div className="absolute inset-0">
    <Editor ... />
  </div>
</div>
```

❌ **Don't modify PanelSubheader without checking all instances**
- Component is used in 3 places: folders, documents, editor
- Change affects all three - verify each one

❌ **Don't change font-size below 12px**
- Accessibility issues: WCAG 2.1 AA requires 12px minimum
- Readability suffers significantly below 12px

❌ **Don't skip responsive testing**
- Must verify 375px, 768px, 1920px breakpoints
- Monaco height bug might resurface at certain widths

❌ **Don't ignore build errors**
- TypeScript errors indicate real problems
- Fix them properly - don't use `@ts-ignore`

❌ **Don't modify ResizablePanelsLayout**
- This component is working correctly
- Absolute positioning fix is in EditorPane, not layout

❌ **Don't change autoSaveId in ResizablePanelsLayout**
- Users' saved panel widths are in localStorage under this key
- Changing it loses their preferences

---

**PRP Confidence Score: 8/10**

**Reasoning**:
- ✅ Clear design document with comprehensive rationale
- ✅ All files exist (MODIFY only, no creation)
- ✅ Validation gates are executable by AI
- ✅ Known gotchas documented with examples
- ✅ Monaco height fix pattern proven in design doc
- ⚠️ Risk: CSS cascade might have unexpected effects on other components
- ⚠️ Mitigation: Explicit overrides for all Shadcn components

**Predicted Issues**:
1. Other components using h-9 or text-sm might look inconsistent
   - **Solution**: Document any inconsistencies, fix in follow-up if needed
2. Third-party components might not scale properly
   - **Solution**: Identify and override explicitly if issues arise
3. Monaco theme colors might need adjustment with compact UI
   - **Solution**: Bold Simplicity theme already matches, should work

**Success Probability**: High (8/10)
- One-pass implementation achievable with careful attention to validation steps
- Chrome DevTools MCP provides concrete visual verification
- Build gates catch TypeScript errors early

----
**PRP Status**: TODO
**PRP ID**: P5S3d
**Archon Project**: PromptHub (d449f266-1f36-47ad-bd2d-30f1a0f5e999)
**PRP Document**: PRPs/P5S3d-compact-ui-and-monaco-editor-fix.md
**Tasks**: 10 tasks (P5S3dT1 - P5S3dT10)
**Phase**: Phase 5 - Prompt Editor & Version Control
**Dependencies**: P5S3c (Complete)
**Next PRP**: P5S4 - Editor UI with Manual Save
**Recommendations:**
Agents:
- `senior-frontend-engineer` (Tasks 1-7)
- `qa-test-automation-engineer` (Tasks 8-10)
Notes:
- T1-5 (CSS/component updates) with `senior-frontend-engineer`
- T6-7 (Monaco fix) with `senior-frontend-engineer`
- T8-10 (Validation) with `qa-test-automation-engineer` in parallel
- Use Chrome DevTools MCP for visual testing (T9)
**Estimated Implementation Time (FTE):** 2-3 hours
