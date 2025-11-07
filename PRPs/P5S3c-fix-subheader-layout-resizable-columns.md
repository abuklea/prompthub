# PromptHub
## Resizable Column Layout with Animated Drag Handles

| `Title` | `Created` | `Last modified` |
|---------|-----------|-----------------|
| Resizable Column Layout with Animated Drag Handles | 07/11/2025 17:49 GMT+10 | 07/11/2025 17:49 GMT+10 |

## Table of Contents
- [Goal](#goal)
- [Why](#why)
- [What](#what)
- [All Needed Context](#all-needed-context)
- [Implementation Blueprint](#implementation-blueprint)
- [Validation Loop](#validation-loop)
- [Final Validation Checklist](#final-validation-checklist)
- [Anti-Patterns to Avoid](#anti-patterns-to-avoid)

## Goal

Transform the fixed-width 3-column layout in PromptHub's main application view into a user-resizable layout with animated drag handles. Users should be able to adjust column widths by dragging vertical separators, with handles that smoothly animate to follow the cursor position and provide delightful visual feedback.

### Current State Problems
- Fixed column widths (`w-64`, `w-96`, `flex-1`) cause toolbar content to overlap/overflow
- FolderToolbar and DocumentToolbar buttons are cramped and don't fit properly
- No way for users to adjust layout to their preferences
- Poor responsive design for different viewport sizes

### Desired End State
- User can drag vertical separators to resize columns (mouse, touch, keyboard)
- Drag handles animate smoothly toward cursor/touch point when nearby
- Handles return to center position when released or cursor moves away
- Column widths persist across sessions (localStorage)
- Min/max constraints prevent UI breakage
- All components within columns adapt responsively to width changes

## Why

**User Impact:**
- Eliminates toolbar overlap/cramping issues visible in screenshots
- Empowers users to customize workspace layout to their workflow
- Improves usability across different screen sizes and resolutions
- Creates a more professional, polished application feel

**Technical Value:**
- Follows industry-standard patterns (react-resizable-panels)
- Maintains accessibility (keyboard navigation, screen reader support)
- Leverages existing framer-motion for animations (no new dependencies for animation)
- Integrates cleanly with Next.js 14 architecture

**Problems Solved:**
- Fixed-width columns causing content overflow (primary issue from screenshots)
- Inability to optimize layout for individual user preferences
- Poor space utilization on large displays
- Cramped toolbars on smaller displays

## What

### User-Visible Behavior

**Resizing Columns:**
1. User sees three vertical columns (Folders, Documents, Editor)
2. Between columns are subtle vertical separator lines
3. A small circular handle appears centered on each separator
4. As mouse/touch approaches separator (within ~50px), handle smoothly animates toward cursor
5. User can click/touch and drag the handle to resize adjacent columns
6. During drag, handle follows cursor vertically while resizing horizontally
7. When released, handle animates back to vertical center with spring motion
8. Column widths are saved and persist on page reload

**Visual Feedback:**
- Handle idle state: Subtle, semi-transparent indicator
- Handle hover state: Increased opacity, slight scale up
- Handle dragging state: Stronger color, full opacity
- Smooth framer-motion spring animations (no janky transitions)
- Cursor changes to `col-resize` when over separator area

**Constraints:**
- Folders column: 15-30% of viewport width
- Documents column: 20-40% of viewport width
- Editor column: 40-70% of viewport width
- All components within columns use responsive classes and overflow handling
- Layout prevents any content from breaking or overlapping

### Technical Requirements

**New Components:**
1. `ResizablePanelsLayout.tsx` - Client component wrapping the 3-column layout
2. `AnimatedResizeHandle.tsx` - Custom drag handle with framer-motion animations

**Library Integration:**
- Install `react-resizable-panels` (latest stable version)
- Use existing `framer-motion@11.2.4` for handle animations
- Integrate with existing Zustand store pattern for any needed state

**Architecture:**
- Convert Server Component layout to use Client Component wrapper
- Maintain Server Component benefits where possible (Header, auth, etc.)
- Use PanelGroup/Panel/PanelResizeHandle from react-resizable-panels
- Wrap PanelResizeHandle with custom animated component

### Success Criteria
- [x] Columns can be resized by dragging separators (mouse, touch, keyboard)
- [x] Drag handles animate smoothly toward cursor when nearby
- [x] Handles return to center when released or cursor moves away
- [x] Column widths persist across page reloads (localStorage)
- [x] Min/max constraints prevent layout breakage
- [x] All toolbar content fits without overflow at default and adjusted widths
- [x] Smooth 60fps animations with no jank
- [x] TypeScript compilation passes with no errors
- [x] ESLint passes with no warnings
- [x] Works on mobile/touch devices
- [x] Keyboard navigation supported (Tab to handle, Arrow keys to resize)

## All Needed Context

### Documentation & References

```yaml
# MUST READ - Core Documentation

- url: https://github.com/bvaughn/react-resizable-panels
  why: Official react-resizable-panels documentation with API reference
  critical: |
    - PanelGroup requires direction prop ("horizontal" for our case)
    - Panel accepts defaultSize (percentage), minSize, maxSize, collapsible props
    - PanelResizeHandle provides onDragging callback for animation triggers
    - Supports localStorage persistence via storage prop on PanelGroup
    - Keyboard accessible (Tab to handle, Arrow keys to resize)
    - Touch and mouse support built-in

- url: https://motion.dev/docs/react-use-drag-controls
  why: Pattern for custom drag handle behavior with framer-motion
  critical: |
    - Use motion.div with animate prop for smooth position updates
    - whileHover and whileTap provide gesture states
    - Use spring animations for natural feel: { type: "spring", stiffness: 300, damping: 30 }
    - Transform properties (translateY) are GPU-accelerated

- file: src/app/(app)/layout.tsx
  why: Current layout structure showing fixed-width columns
  pattern: |
    - Server Component with auth check
    - Three columns: w-64 (Folders), w-96 (Documents), flex-1 (Editor)
    - PanelSubheader components above each column
    - Must maintain server component for Header/auth, client wrapper for panels

- file: src/components/layout/PanelSubheader.tsx
  why: Subheader component that contains the overflowing toolbars
  pattern: |
    - Fixed height h-12
    - Flex layout with justify-between
    - Children (toolbars) use flex gap-2
    - Must remain responsive when parent column resizes

- file: src/features/folders/components/FolderToolbar.tsx
  why: Example of toolbar with multiple buttons causing overflow
  pattern: |
    - Multiple Button components with icons
    - DropdownMenu for sort options
    - Input for filtering with flex-1
    - Total width exceeds w-64 causing visible overflow

- file: src/features/prompts/components/DocumentToolbar.tsx
  why: Another toolbar with overflow issues
  pattern: |
    - Multiple buttons + dropdown + input field
    - Similar structure to FolderToolbar
    - Needs responsive classes to adapt to resizing

- file: src/stores/use-ui-store.ts
  why: Existing Zustand store pattern for state management
  pattern: |
    - Simple create() call with typed interface
    - State + actions in one object
    - Could add column width state here if needed (but localStorage sufficient)

- doc: https://www.framer.com/motion/gestures/
  section: Hover, Tap, Pan gestures
  critical: |
    - whileHover={{ scale: 1.1 }} for hover feedback
    - onMouseMove for cursor tracking
    - Use MotionValue for performance (doesn't trigger re-renders)
```

### Current Codebase Structure (Relevant Files)

```bash
src/
├── app/
│   └── (app)/
│       ├── layout.tsx              # TARGET: Convert to use ResizablePanelsLayout
│       └── dashboard/
│           └── page.tsx            # Simple page, no changes needed
├── components/
│   ├── layout/
│   │   ├── Header.tsx             # Keep as-is (Server Component)
│   │   ├── PanelSubheader.tsx     # Keep as-is (works with any width)
│   │   ├── HistoryButton.tsx      # Keep as-is
│   │   ├── ResizablePanelsLayout.tsx   # CREATE: Client wrapper for panels
│   │   └── AnimatedResizeHandle.tsx    # CREATE: Custom drag handle
│   └── ui/                        # Shadcn components (no changes)
├── features/
│   ├── folders/
│   │   └── components/
│   │       ├── FolderTree.tsx     # UPDATE: Add responsive classes
│   │       └── FolderToolbar.tsx  # UPDATE: Add responsive classes
│   ├── prompts/
│   │   └── components/
│   │       ├── PromptList.tsx     # UPDATE: Add responsive classes
│   │       └── DocumentToolbar.tsx # UPDATE: Add responsive classes
│   └── editor/
│       └── components/
│           └── EditorPane.tsx     # UPDATE: Ensure responsive
└── stores/
    └── use-ui-store.ts            # No changes needed (localStorage sufficient)
```

### Desired Codebase After Implementation

```bash
src/
├── components/
│   └── layout/
│       ├── ResizablePanelsLayout.tsx   # NEW: Client wrapper with PanelGroup
│       └── AnimatedResizeHandle.tsx    # NEW: Custom animated handle
├── app/
│   └── (app)/
│       └── layout.tsx              # MODIFIED: Use ResizablePanelsLayout
└── features/                       # MODIFIED: Add responsive classes to toolbars
```

### Known Gotchas & Library Quirks

```typescript
// CRITICAL: react-resizable-panels v3.x API

// ✅ CORRECT: PanelGroup in Client Component with storage
"use client"
import { PanelGroup, Panel, PanelResizeHandle } from "react-resizable-panels"

<PanelGroup
  direction="horizontal"
  storage={localStorage}  // Auto-persists sizes
  autoSaveId="main-layout" // Unique ID for this layout
>
  <Panel defaultSize={20} minSize={15} maxSize={30} />
  <PanelResizeHandle />
  <Panel defaultSize={30} minSize={20} maxSize={40} />
  <PanelResizeHandle />
  <Panel defaultSize={50} minSize={40} maxSize={70} />
</PanelGroup>

// ❌ WRONG: Missing storage prop = widths reset on reload
// ❌ WRONG: Using fixed sizes instead of percentages
// ❌ WRONG: Not setting minSize/maxSize = columns can break UI

// CRITICAL: Framer Motion Performance
// ✅ Use transform for animations (GPU accelerated)
<motion.div style={{ y: yPosition }} />

// ❌ DON'T use top/left (causes layout recalc)
<motion.div style={{ top: yPosition }} />

// CRITICAL: Next.js 14 Client/Server Components
// ✅ CORRECT: Wrap PanelGroup in "use client" component
// ✅ CORRECT: Pass server-rendered children to client component
// ❌ WRONG: Making entire layout.tsx "use client" (loses auth benefits)

// CRITICAL: Mouse Position Tracking
// ✅ Use getBoundingClientRect() for accurate position
const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
  const rect = e.currentTarget.getBoundingClientRect()
  const relativeY = e.clientY - rect.top
  // Use relativeY for animation
}

// ❌ DON'T use pageY/screenY (doesn't account for scrolling/positioning)

// CRITICAL: React-Resizable-Panels SSR
// In Next.js App Router, the library handles SSR correctly with storage prop
// No need for special SSR handling or cookie-based persistence for our use case
// localStorage works because PanelGroup only renders client-side

// GOTCHA: onDragging Callback
// PanelResizeHandle's onDragging prop receives boolean: true when dragging starts, false when stops
<PanelResizeHandle onDragging={(isDragging) => {
  // Use this to pause/resume handle animation
  setIsDragging(isDragging)
}} />
```

## Implementation Blueprint

### Task List (Ordered)

```yaml
Task 1: Install react-resizable-panels dependency
  Command: npm install react-resizable-panels
  Validation: Check package.json for react-resizable-panels entry

Task 2: Create AnimatedResizeHandle component
  File: src/components/layout/AnimatedResizeHandle.tsx
  Responsibility: |
    - Wrap PanelResizeHandle with framer-motion animation
    - Track mouse/touch position relative to handle
    - Animate handle Y position toward cursor when nearby (<50px)
    - Return to center (50%) when cursor moves away or drag ends
    - Provide visual feedback (hover, active states)
  Pattern: Use motion.div with useMotionValue for Y position
  Dependencies: framer-motion (already installed), react-resizable-panels

Task 3: Create ResizablePanelsLayout client component
  File: src/components/layout/ResizablePanelsLayout.tsx
  Responsibility: |
    - Client component ("use client") wrapping PanelGroup
    - Contains three Panel components with AnimatedResizeHandle between
    - Accepts children for each panel as props
    - Configures min/max constraints: Folders (15-30%), Docs (20-40%), Editor (40-70%)
    - Sets up localStorage persistence with autoSaveId
  Pattern: Follow Next.js client/server component boundary best practices
  Dependencies: react-resizable-panels, AnimatedResizeHandle

Task 4: Update layout.tsx to use ResizablePanelsLayout
  File: src/app/(app)/layout.tsx
  Modifications: |
    - Keep as Server Component (maintain auth check)
    - Replace fixed-width divs with ResizablePanelsLayout
    - Pass panel children (FolderTree, PromptList, EditorPane) as props
    - Maintain PanelSubheader components above each panel
  Pattern: Server Component rendering Client Component with Server Children

Task 5: Add responsive classes to FolderToolbar
  File: src/features/folders/components/FolderToolbar.tsx
  Modifications: |
    - Replace fixed-width classes with responsive flex utilities
    - Ensure buttons have min-width to prevent squishing
    - Input uses flex-1 but with max-w constraint
    - Add overflow-hidden and text-ellipsis where needed
  Pattern: Responsive Tailwind utility classes

Task 6: Add responsive classes to DocumentToolbar
  File: src/features/prompts/components/DocumentToolbar.tsx
  Modifications: |
    - Similar to FolderToolbar responsive improvements
    - Ensure dropdown and buttons remain clickable at minimum column width
    - Input field responsive sizing
  Pattern: Match FolderToolbar responsive pattern

Task 7: Ensure EditorPane handles width changes
  File: src/features/editor/components/EditorPane.tsx
  Modifications: |
    - Verify Monaco editor resizes correctly (should auto-resize)
    - Add overflow-hidden to container if needed
  Pattern: Editor already uses flex-1, just verify behavior

Task 8: Test and refine animations
  Responsibility: |
    - Test handle animation smoothness at 60fps
    - Verify spring animation feels natural (adjust stiffness/damping if needed)
    - Test on various viewport sizes
    - Test touch interaction on mobile/tablet
    - Test keyboard accessibility (Tab to handle, arrows to resize)
  Validation: Visual testing + performance monitoring
```

### Detailed Implementation (Key Components)

#### Task 2: AnimatedResizeHandle Component

```typescript
// src/components/layout/AnimatedResizeHandle.tsx
"use client"

import { PanelResizeHandle } from "react-resizable-panels"
import { motion, useMotionValue, animate } from "framer-motion"
import { useState, useEffect, useRef } from "react"

/**
 * Animated resize handle that follows cursor position vertically
 *
 * Behavior:
 * - Default: Handle centered vertically on separator line
 * - Mouse nearby: Animates toward cursor Y position
 * - During drag: Follows cursor Y while resizing columns horizontally
 * - After release: Springs back to center position
 */

interface AnimatedResizeHandleProps {
  className?: string
}

export function AnimatedResizeHandle({ className }: AnimatedResizeHandleProps) {
  const [isDragging, setIsDragging] = useState(false)
  const [isNearby, setIsNearby] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  // Reason: Motion value for smooth Y position (doesn't trigger re-renders)
  const yPosition = useMotionValue(50) // 50% = centered

  useEffect(() => {
    // Reason: Return to center when not interacting
    if (!isDragging && !isNearby) {
      animate(yPosition, 50, {
        type: "spring",
        stiffness: 300,
        damping: 30
      })
    }
  }, [isDragging, isNearby, yPosition])

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!containerRef.current) return

    const rect = containerRef.current.getBoundingClientRect()
    const relativeY = ((e.clientY - rect.top) / rect.height) * 100

    // Reason: Check if cursor is near separator (within 50px)
    const distanceFromCenter = Math.abs(e.clientY - (rect.top + rect.height / 2))
    setIsNearby(distanceFromCenter < 50)

    // Reason: Animate toward cursor if nearby or dragging
    if (isNearby || isDragging) {
      animate(yPosition, Math.max(10, Math.min(90, relativeY)), {
        type: "spring",
        stiffness: 400,
        damping: 40
      })
    }
  }

  const handleMouseLeave = () => {
    setIsNearby(false)
  }

  return (
    <PanelResizeHandle
      className={className}
      onDragging={setIsDragging}
    >
      <div
        ref={containerRef}
        className="relative w-px h-full bg-border hover:bg-border/80 transition-colors cursor-col-resize"
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
      >
        {/* Reason: Animated handle indicator */}
        <motion.div
          className="absolute left-1/2 w-3 h-8 -ml-1.5 rounded-full bg-primary/40 hover:bg-primary/60 hover:scale-110 transition-all"
          style={{
            top: yPosition.get() + "%",
            translateY: "-50%",
            y: yPosition
          }}
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 1.15 }}
        />
      </div>
    </PanelResizeHandle>
  )
}
```

#### Task 3: ResizablePanelsLayout Component

```typescript
// src/components/layout/ResizablePanelsLayout.tsx
"use client"

import { PanelGroup, Panel } from "react-resizable-panels"
import { AnimatedResizeHandle } from "./AnimatedResizeHandle"
import { ReactNode } from "react"

interface ResizablePanelsLayoutProps {
  foldersPanel: ReactNode
  documentsPanel: ReactNode
  editorPanel: ReactNode
}

/**
 * Resizable 3-column panel layout with persistence
 *
 * Columns:
 * - Folders: 15-30% width, default 20%
 * - Documents: 20-40% width, default 30%
 * - Editor: 40-70% width, default 50%
 *
 * Widths persist in localStorage across sessions
 */
export function ResizablePanelsLayout({
  foldersPanel,
  documentsPanel,
  editorPanel
}: ResizablePanelsLayoutProps) {
  return (
    <PanelGroup
      direction="horizontal"
      className="flex-1 overflow-hidden"
      autoSaveId="main-layout"
    >
      {/* Folders Panel */}
      <Panel
        defaultSize={20}
        minSize={15}
        maxSize={30}
        className="flex flex-col overflow-hidden"
      >
        {foldersPanel}
      </Panel>

      <AnimatedResizeHandle />

      {/* Documents Panel */}
      <Panel
        defaultSize={30}
        minSize={20}
        maxSize={40}
        className="flex flex-col overflow-hidden"
      >
        {documentsPanel}
      </Panel>

      <AnimatedResizeHandle />

      {/* Editor Panel */}
      <Panel
        defaultSize={50}
        minSize={40}
        maxSize={70}
        className="flex flex-col overflow-hidden"
      >
        {editorPanel}
      </Panel>
    </PanelGroup>
  )
}
```

#### Task 4: Update Layout.tsx

```typescript
// src/app/(app)/layout.tsx
import { createServer } from "@/lib/supabase"
import { redirect } from "next/navigation"
import { Header } from "@/components/layout/Header"
import { PanelSubheader } from "@/components/layout/PanelSubheader"
import { HistoryButton } from "@/components/layout/HistoryButton"
import { ResizablePanelsLayout } from "@/components/layout/ResizablePanelsLayout"
import { FolderTree } from "@/features/folders/components/FolderTree"
import { FolderToolbar } from "@/features/folders/components/FolderToolbar"
import { PromptList } from "@/features/prompts/components/PromptList"
import { DocumentToolbar } from "@/features/prompts/components/DocumentToolbar"
import { EditorPane } from "@/features/editor/components/EditorPane"

export default async function AppLayout() {
  const supabase = createServer()
  const { data, error } = await supabase.auth.getUser()

  if (error || !data?.user) {
    redirect("/login")
  }

  return (
    <div className="flex flex-col h-screen">
      <Header user={data.user} />

      <ResizablePanelsLayout
        foldersPanel={
          <>
            <PanelSubheader title="Folders">
              <FolderToolbar />
            </PanelSubheader>
            <div className="flex-1 p-4 overflow-y-auto">
              <FolderTree />
            </div>
          </>
        }
        documentsPanel={
          <>
            <PanelSubheader title="Documents">
              <DocumentToolbar />
            </PanelSubheader>
            <div className="flex-1 p-4 overflow-y-auto">
              <PromptList />
            </div>
          </>
        }
        editorPanel={
          <>
            <PanelSubheader title="Editor">
              <HistoryButton />
            </PanelSubheader>
            <div className="flex-1 overflow-hidden">
              <EditorPane />
            </div>
          </>
        }
      />
    </div>
  )
}
```

### Integration Points

```yaml
DEPENDENCIES:
  npm: "react-resizable-panels@^3.0.0"
  existing: "framer-motion@11.2.4"
  existing: "zustand@4.5.2" (not modified, but available if needed)

STATE_MANAGEMENT:
  approach: "localStorage via react-resizable-panels storage prop"
  key: "main-layout" (autoSaveId)
  persistence: "Automatic on resize, no manual code needed"

STYLING:
  system: "Tailwind CSS with existing design tokens"
  handle_idle: "bg-border opacity-40"
  handle_hover: "bg-border opacity-60 scale-110"
  handle_active: "bg-primary opacity-80 scale-115"
  cursor: "cursor-col-resize on handle area"

NO_DATABASE_CHANGES: true
NO_API_CHANGES: true
NO_ENV_VARS: false
```

## Validation Loop

### Level 1: Installation & TypeScript

```bash
# Install dependency
npm install react-resizable-panels

# Expected: Added to package.json, node_modules updated
# Verify: Check package.json contains "react-resizable-panels": "^3.x.x"

# TypeScript compilation
npm run build

# Expected: No TypeScript errors
# If errors: Read error messages, fix type issues in new components
# Common issue: Incorrect prop types, missing imports
```

### Level 2: Linting & Code Style

```bash
# ESLint check
npm run lint

# Expected: No warnings or errors
# If errors: Fix formatting, unused imports, etc.
# react-resizable-panels should not trigger any lint warnings
```

### Level 3: Visual & Functional Testing

**Manual Test Checklist:**

```bash
# Start development server
npm run dev

# Navigate to http://localhost:3010/dashboard (after login)
```

**Test Cases:**

1. **Basic Resizing:**
   - Click and drag first separator (between Folders and Documents)
   - Verify Folders column width changes
   - Verify Documents column width changes proportionally
   - Repeat for second separator (Documents and Editor)

2. **Handle Animation:**
   - Move mouse near separator without clicking
   - Verify handle animates toward cursor position vertically
   - Move mouse away
   - Verify handle returns to center with smooth spring motion

3. **Constraint Enforcement:**
   - Try to drag Folders column very narrow
   - Verify it stops at minimum width (15% = ~230px on 1920px screen)
   - Try to drag Folders column very wide
   - Verify it stops at maximum width (30% = ~576px)
   - Repeat for other columns with their constraints

4. **Persistence:**
   - Resize columns to custom widths
   - Refresh page (F5)
   - Verify columns maintain custom widths
   - Clear localStorage (Dev Tools > Application > Storage)
   - Refresh page
   - Verify columns reset to defaults (20%, 30%, 50%)

5. **Toolbar Content:**
   - At default widths, verify no toolbar overflow
   - Resize Folders column to minimum
   - Verify FolderToolbar buttons remain accessible (may wrap or use responsive patterns)
   - Resize Documents column to minimum
   - Verify DocumentToolbar buttons remain accessible

6. **Touch Support (on device or Chrome DevTools device mode):**
   - Enable touch emulation
   - Touch and drag separator
   - Verify smooth resizing
   - Verify handle animation works with touch

7. **Keyboard Accessibility:**
   - Tab to focus first separator handle
   - Verify visible focus indicator
   - Press Arrow Right/Left keys
   - Verify column resizes in small increments
   - Repeat for second separator

8. **Performance:**
   - Open Chrome DevTools > Performance
   - Record while dragging separator rapidly
   - Verify 60fps (no janky frames)
   - Check main thread isn't blocked during animation

**Expected Results:**
- ✅ All resizing smooth and responsive
- ✅ Handles animate naturally, no stuttering
- ✅ No toolbar overflow at any supported width
- ✅ Widths persist correctly
- ✅ Touch and keyboard work as expected
- ✅ 60fps maintained during interactions

### Level 4: Edge Case Testing

```bash
# Test Cases:

1. Rapid mouse movement:
   - Move cursor quickly across separator
   - Expected: Handle animation stays smooth, no lag

2. Multiple rapid resizes:
   - Drag separator back and forth quickly
   - Expected: No animation conflicts, smooth transitions

3. Narrow viewport (mobile):
   - Resize browser to 768px width
   - Expected: Columns maintain constraints, no horizontal scroll

4. Wide viewport (4K):
   - Resize browser to 3840px width
   - Expected: Columns scale appropriately, handle visible and functional
```

## Final Validation Checklist

- [ ] Dependency installed: `react-resizable-panels` in package.json
- [ ] TypeScript compiles: `npm run build` succeeds with no errors
- [ ] Linting passes: `npm run lint` with no warnings
- [ ] Components created: `AnimatedResizeHandle.tsx`, `ResizablePanelsLayout.tsx`
- [ ] Layout updated: `src/app/(app)/layout.tsx` uses new components
- [ ] Toolbars responsive: FolderToolbar and DocumentToolbar adapt to width changes
- [ ] Basic resizing works: All three columns can be resized
- [ ] Handle animation smooth: Follows cursor and returns to center naturally
- [ ] Constraints enforced: Min/max widths prevent UI breakage
- [ ] Persistence works: Widths saved to localStorage and restored on reload
- [ ] Touch support works: Can resize on touch devices
- [ ] Keyboard accessible: Tab + Arrow keys resize columns
- [ ] No toolbar overflow: Content fits at all supported widths
- [ ] 60fps performance: No dropped frames during resize/animation
- [ ] No console errors: Clean browser console during all interactions
- [ ] Mobile responsive: Works on viewport widths down to 768px
- [ ] Visual polish: Handle states (idle, hover, active) look professional

## Anti-Patterns to Avoid

### ❌ Don't Do These:

**Architecture:**
- ❌ Don't make entire layout.tsx "use client" - keep auth check as Server Component
- ❌ Don't create custom resize logic - use react-resizable-panels (battle-tested, accessible)
- ❌ Don't skip localStorage persistence - frustrating UX without it
- ❌ Don't forget min/max constraints - UI will break on extreme sizes

**Animation:**
- ❌ Don't use CSS top/left for handle animation - causes layout recalc (use transform)
- ❌ Don't use linear animations - spring animations feel more natural
- ❌ Don't track mouse position on every mousemove without throttling
- ❌ Don't animate during drag - only animate idle handle position

**State Management:**
- ❌ Don't put column widths in Zustand - localStorage via library is cleaner
- ❌ Don't manually save/load widths - library handles it automatically
- ❌ Don't forget autoSaveId - needed for localStorage key uniqueness

**Responsive Design:**
- ❌ Don't use fixed pixel widths - percentage-based sizing required
- ❌ Don't skip testing at various viewport sizes
- ❌ Don't forget overflow-hidden on panel containers
- ❌ Don't assume toolbar content will always fit - add responsive classes

**Performance:**
- ❌ Don't trigger re-renders in mousemove handler - use MotionValue
- ❌ Don't skip useCallback/useMemo for handlers - prevents unnecessary re-creation
- ❌ Don't forget to test performance with DevTools

### ✅ Do These Instead:

- ✅ Use PanelGroup/Panel/PanelResizeHandle from library
- ✅ Wrap with custom AnimatedResizeHandle for delightful UX
- ✅ Use spring animations with appropriate stiffness/damping
- ✅ Use transform (translateY) for GPU-accelerated animations
- ✅ Test on real devices, not just DevTools emulation
- ✅ Use getBoundingClientRect for accurate mouse position
- ✅ Leverage existing framer-motion for consistency
- ✅ Follow Next.js 14 client/server component boundaries
- ✅ Add proper TypeScript types for all props
- ✅ Test keyboard accessibility thoroughly

---

## PRP Quality Self-Assessment

**Confidence Level for One-Pass Implementation: 9/10**

**Strengths:**
- ✅ Comprehensive context with actual code examples
- ✅ Clear task breakdown with dependencies
- ✅ Executable validation steps at multiple levels
- ✅ Detailed pseudocode showing critical patterns
- ✅ Library documentation URLs with specific sections
- ✅ Known gotchas and anti-patterns documented
- ✅ Real codebase examples showing patterns to follow
- ✅ Clear success criteria and test cases

**Potential Gaps:**
- ⚠️ Touch proximity detection might need refinement (not critical)
- ⚠️ Spring animation parameters (stiffness/damping) may need tuning for feel
- ⚠️ Mobile breakpoint behavior not fully specified (assume 768px+ for now)

**Why 9/10:**
The PRP provides sufficient context and patterns for successful implementation. An agent has:
1. Library documentation with critical API details
2. Complete working pseudocode for both components
3. Existing codebase patterns to mirror
4. Executable validation commands
5. Clear integration points and constraints

Minor tuning of animation parameters is expected and can be iterated. The core implementation path is clear and comprehensive.
