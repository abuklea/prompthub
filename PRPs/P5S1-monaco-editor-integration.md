# PromptHub
## P5S1: Monaco Editor Integration

| `Title` | `Created` | `Last modified` |
|---------|-----------|-----------------|
| P5S1: Monaco Editor Integration | 07/11/2025 13:17 GMT+10 | 07/11/2025 13:17 GMT+10 |

## Table of Contents
- [Goal](#goal)
- [Why](#why)
- [What](#what)
- [All Needed Context](#all-needed-context)
- [Implementation Blueprint](#implementation-blueprint)
- [Validation Loop](#validation-loop)
- [Final Validation Checklist](#final-validation-checklist)
- [Anti-Patterns to Avoid](#anti-patterns-to-avoid)
- [PRP Metadata](#prp-metadata)

---

## Goal

Create a production-ready Monaco Editor wrapper component for PromptHub that:
- Works seamlessly with Next.js Pages Router (no SSR issues)
- Matches the Bold Simplicity design system (dark theme)
- Provides a clean, reusable API for prompt editing
- Handles loading states gracefully
- Supports TypeScript with full type safety
- Integrates with the existing P1S1 authentication and layout system

**End State**: A `<Editor />` component that can be dropped into any page, handles SSR correctly, displays with the dark theme matching our design system, and provides onChange/onMount callbacks for content management.

---

## Why

### Business Value
- **Core Feature**: Monaco Editor is the foundation for the prompt editing experience (Phase 5)
- **User Expectations**: Developers expect VS Code-like editing capabilities for their prompts
- **Version Control**: Rich editing enables better diff tracking and version management
- **Productivity**: Syntax highlighting, autocomplete, and keyboard shortcuts improve workflow

### Integration Context
- **Phase 5 Step 1**: Foundation component for subsequent prompt editing features
- **Phase 5 Step 2**: Will be integrated into EditorPane component for prompt creation/editing
- **Phase 5 Step 4**: Supports manual saving workflow with version control

### Problems This Solves
- ✅ Provides professional code/text editing experience
- ✅ Enables syntax highlighting for multiple languages (markdown, JavaScript, etc.)
- ✅ Supports keyboard shortcuts familiar to developers
- ✅ Maintains consistency with Bold Simplicity design system
- ✅ Handles Next.js SSR constraints properly

---

## What

### User-Visible Behavior
When a user accesses a prompt editing page:
1. They see a loading state briefly (elegant skeleton/spinner)
2. Monaco Editor renders with dark theme matching the app design
3. Editor displays existing prompt content or placeholder text
4. They can type, edit, and use VS Code-like keyboard shortcuts
5. Content changes are captured via onChange callback
6. No console errors, no SSR hydration issues

### Technical Requirements

#### Component API
```typescript
interface EditorProps {
  value?: string                    // Controlled value
  defaultValue?: string             // Initial value (uncontrolled)
  language?: string                 // "markdown" | "javascript" | "typescript" | etc.
  height?: string | number          // Default: "500px"
  theme?: "vs-dark" | "light"       // Default: "vs-dark"
  readOnly?: boolean                // Default: false
  onChange?: (value: string | undefined) => void
  onMount?: (editor: any, monaco: any) => void
  options?: object                  // Monaco editor options
  className?: string                // Wrapper CSS classes
}
```

#### Browser Compatibility
- Modern browsers (Chrome, Firefox, Safari, Edge)
- No IE11 support required (Monaco doesn't support it anyway)

#### Performance
- Dynamic import with code splitting (reduces initial bundle)
- Loading state prevents layout shift
- No performance degradation on fast networks
- Acceptable on 3G connections

### Success Criteria
- [ ] Component renders without SSR errors
- [ ] Dark theme matches Bold Simplicity colors
- [ ] `npm run build` succeeds with zero errors
- [ ] `npm run lint` passes with zero warnings
- [ ] TypeScript strict mode compliant
- [ ] Loading state displays during dynamic import
- [ ] onChange callback fires on content changes
- [ ] Editor height is explicit and renders correctly
- [ ] No console errors in development or production
- [ ] Works on test page without integration issues

---

## All Needed Context

### Documentation & References

```yaml
# MUST READ - Include these in your context window

- url: https://github.com/suren-atoyan/monaco-react
  why: Official @monaco-editor/react documentation with all props and APIs
  critical: Next.js SSR handling pattern documented here

- url: https://microsoft.github.io/monaco-editor/
  why: Monaco Editor API reference for options and configuration
  section: IStandaloneEditorConstructionOptions for editor options

- url: https://nextjs.org/docs/pages/building-your-application/optimizing/lazy-loading
  why: Next.js dynamic import documentation
  critical: SSR must be disabled for Monaco - dynamic(() => import(), { ssr: false })

- file: src/features/auth/components/AuthForm.tsx
  why: P1S1 client component pattern - shows "use client", TypeScript interfaces, error handling
  pattern: Client component with state management and event handlers

- file: src/components/layout/Header.tsx
  why: Context-aware component pattern with useEffect
  pattern: Component that adapts based on runtime state

- file: src/styles/globals.css
  why: Bold Simplicity CSS variable system
  critical: Dark theme colors that Monaco must match

- file: src/lib/utils.ts
  why: Utility functions including cn() for className merging
  pattern: Tailwind + class-variance-authority pattern
```

### Current Codebase Structure

```bash
/home/allan/projects/PromptHub/
├── src/
│   ├── features/              # Feature modules
│   │   ├── auth/             # P1S1 authentication (COMPLETE)
│   │   │   ├── actions.ts
│   │   │   ├── schemas.ts
│   │   │   └── components/
│   │   │       └── AuthForm.tsx
│   │   ├── folders/          # Folder management (PENDING)
│   │   ├── prompts/          # Prompt CRUD (PENDING)
│   │   └── editor/           # TO BE CREATED (P5S1)
│   │       ├── components/
│   │       │   ├── Editor.tsx          # Monaco wrapper
│   │       │   └── EditorSkeleton.tsx  # Loading state
│   │       └── types.ts                # TypeScript interfaces
│   │
│   ├── components/           # Shared components
│   │   ├── layout/
│   │   │   └── Header.tsx   # Context-aware header
│   │   └── ui/              # Shadcn components
│   │
│   ├── lib/                 # Utilities
│   │   ├── supabase/
│   │   └── utils.ts
│   │
│   ├── pages/               # Next.js pages
│   │   ├── _app.tsx
│   │   ├── index.tsx
│   │   ├── login.tsx
│   │   └── dashboard.tsx
│   │
│   └── styles/
│       └── globals.css      # Bold Simplicity design system
│
├── package.json             # Dependencies (Monaco already installed)
├── tsconfig.json           # TypeScript strict mode
└── next.config.mjs         # Next.js config
```

### Desired Codebase After P5S1

```bash
src/features/editor/
├── components/
│   ├── Editor.tsx              # Main Monaco wrapper component
│   │   - Responsibility: Dynamic import, SSR handling, theme config
│   │   - Exports: Editor component (default)
│   │   - Dependencies: @monaco-editor/react, next/dynamic
│   │
│   └── EditorSkeleton.tsx      # Loading state component
│       - Responsibility: Display during dynamic import
│       - Exports: EditorSkeleton component (default)
│       - Dependencies: None (pure UI)
│
└── types.ts                    # TypeScript interfaces
    - Responsibility: EditorProps interface and type exports
    - Exports: EditorProps, MonacoEditor, Monaco types
```

### Known Gotchas & Critical Information

```typescript
// CRITICAL: Monaco Editor SSR Issues
// Monaco requires browser environment (window, document, etc.)
// Solution: Use Next.js dynamic import with ssr: false

// ❌ WRONG - This will break SSR
import Editor from '@monaco-editor/react'

// ✅ CORRECT - Dynamic import with SSR disabled
import dynamic from 'next/dynamic'
const Editor = dynamic(() => import('@monaco-editor/react'), {
  ssr: false,
  loading: () => <EditorSkeleton />
})

// CRITICAL: Height is Required
// Monaco MUST have explicit height or it won't render
<Editor height="500px" /> // ✅ Works
<Editor />                // ❌ Won't render properly

// CRITICAL: Theme Customization
// Custom themes must be defined in beforeMount, NOT onMount
function handleBeforeMount(monaco) {
  monaco.editor.defineTheme('boldSimplicity', {
    base: 'vs-dark',
    inherit: true,
    rules: [],
    colors: {
      'editor.background': '#0F172A',  // From globals.css --background
    }
  })
}

// CRITICAL: Cleanup on Unmount
// Monaco creates DOM elements that need cleanup
useEffect(() => {
  return () => {
    // Cleanup happens automatically with @monaco-editor/react v4+
    // But good to know for custom instances
  }
}, [])

// Library Version: @monaco-editor/react v4.6.0
// - Uses 'onMount' instead of deprecated 'editorDidMount'
// - Uses 'beforeMount' instead of 'editorWillMount'
// - Single Editor component (no separate ControlledEditor/UncontrolledEditor)

// Next.js Pages Router (NOT App Router)
// - Use 'use client' directive
// - Import from 'next/dynamic', not 'next/dynamic/legacy'
// - Component will be code-split automatically
```

### Bold Simplicity Design System Colors

From `src/styles/globals.css`:

```css
:root {
  --primary: 239 84% 67%;      /* Indigo #4F46E5 */
  --accent: 328 85% 70%;       /* Magenta #EC4899 */
  --background: 222 47% 11%;   /* Dark blue-black #0F172A */
  --card: 220 26% 14%;         /* Gray 900 #111827 */
  --foreground: 213 31% 91%;   /* Light text #E2E8F0 */
  --muted: 215 20% 65%;        /* Gray 400 #94A3B8 */
  --border: 216 34% 17%;       /* Border color */
}
```

### Monaco Editor Documentation Examples

**Next.js SSR-Safe Pattern** (from @monaco-editor/react docs):
```tsx
import dynamic from 'next/dynamic'

const Editor = dynamic(() => import('@monaco-editor/react'), {
  ssr: false,
  loading: () => <div>Loading editor...</div>
})

export default function EditorPage() {
  function handleEditorChange(value, event) {
    console.log('Code changed:', value)
  }

  return (
    <Editor
      height="80vh"
      defaultLanguage="javascript"
      defaultValue="// Start coding"
      onChange={handleEditorChange}
      theme="vs-dark"
    />
  )
}
```

**Custom Theme Configuration**:
```tsx
function handleBeforeMount(monaco) {
  monaco.editor.defineTheme('myCustomTheme', {
    base: 'vs-dark',
    inherit: true,
    rules: [
      { token: 'comment', foreground: 'ffa500', fontStyle: 'italic' }
    ],
    colors: {
      'editor.background': '#1e1e1e'
    }
  })
}

<Editor
  beforeMount={handleBeforeMount}
  theme="myCustomTheme"
/>
```

**Editor Instance Access**:
```tsx
function MyEditor() {
  const editorRef = useRef(null)

  function handleEditorDidMount(editor, monaco) {
    editorRef.current = editor

    // Configure editor
    editor.updateOptions({
      fontSize: 14,
      minimap: { enabled: true }
    })

    // Add keyboard shortcut
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => {
      console.log('Save triggered')
    })
  }

  return <Editor onMount={handleEditorDidMount} />
}
```

---

## Implementation Blueprint

### Task 1: Create TypeScript Interfaces and Types

**File**: `src/features/editor/types.ts`

**Responsibility**: Define all TypeScript types for the editor feature

```typescript
// Pseudocode with critical details
import type { OnChange, OnMount, BeforeMount } from '@monaco-editor/react'

export interface EditorProps {
  // Content management
  value?: string              // Controlled mode
  defaultValue?: string       // Uncontrolled mode (initial value)

  // Configuration
  language?: string          // Default: "markdown"
  height?: string | number   // Default: "500px" - REQUIRED for rendering
  theme?: 'vs-dark' | 'light' | string  // Default: "vs-dark"
  readOnly?: boolean         // Default: false

  // Event handlers
  onChange?: OnChange        // Fires on content change
  onMount?: OnMount          // Fires when editor mounts
  beforeMount?: BeforeMount  // Fires before editor mounts (for theme setup)

  // Monaco options
  options?: object           // IStandaloneEditorConstructionOptions

  // Styling
  className?: string         // Wrapper classes
}

export interface EditorSkeletonProps {
  height?: string | number   // Match editor height
  className?: string
}

// Re-export Monaco types for convenience
export type { OnChange, OnMount, BeforeMount }
```

**Integration Points**:
- Import these types in Editor.tsx and EditorSkeleton.tsx
- Use for prop validation and autocomplete

---

### Task 2: Create Loading State Component

**File**: `src/features/editor/components/EditorSkeleton.tsx`

**Responsibility**: Display elegant loading state during dynamic import

**Pattern**: Follow Bold Simplicity design with skeleton/pulse animation

```typescript
// Pseudocode
"use client"

import type { EditorSkeletonProps } from '../types'

export default function EditorSkeleton({
  height = "500px",
  className = ""
}: EditorSkeletonProps) {
  // PATTERN: Use Tailwind for styling
  // PATTERN: Pulse animation for loading feel
  // PATTERN: Match editor dimensions to prevent layout shift

  return (
    <div
      className={cn(
        "w-full rounded-md border border-border bg-card",
        "animate-pulse", // Tailwind pulse animation
        className
      )}
      style={{ height }}
    >
      <div className="p-4 space-y-3">
        {/* Simulate editor lines with skeleton bars */}
        <div className="h-4 bg-muted/20 rounded w-3/4"></div>
        <div className="h-4 bg-muted/20 rounded w-1/2"></div>
        <div className="h-4 bg-muted/20 rounded w-5/6"></div>
        <div className="h-4 bg-muted/20 rounded w-2/3"></div>
      </div>
    </div>
  )
}
```

**Integration Points**:
- Used as loading component in dynamic import
- Displays during Monaco initialization (~100-500ms)
- Prevents layout shift

---

### Task 3: Create Monaco Editor Wrapper Component

**File**: `src/features/editor/components/Editor.tsx`

**Responsibility**: Wrap Monaco with Next.js SSR handling and theme configuration

**Pattern**: Client component with dynamic import, theme customization, P1S1 patterns

```typescript
// Pseudocode with CRITICAL implementation details
"use client"

import { useRef } from 'react'
import dynamic from 'next/dynamic'
import type { EditorProps } from '../types'
import { cn } from '@/lib/utils'

// CRITICAL: Dynamic import with SSR disabled
// Monaco requires browser environment (window, document)
const MonacoEditor = dynamic(() => import('@monaco-editor/react'), {
  ssr: false,  // MUST be false - Monaco breaks SSR
  loading: () => import('./EditorSkeleton').then(mod => <mod.default />)
})

export default function Editor({
  value,
  defaultValue = '',
  language = 'markdown',
  height = '500px',  // CRITICAL: Monaco needs explicit height
  theme = 'vs-dark',
  readOnly = false,
  onChange,
  onMount,
  beforeMount,
  options = {},
  className = ''
}: EditorProps) {
  const editorRef = useRef(null)

  // PATTERN: beforeMount for theme customization
  function handleBeforeMount(monaco: any) {
    // Define custom theme matching Bold Simplicity
    monaco.editor.defineTheme('boldSimplicity', {
      base: 'vs-dark',
      inherit: true,  // Inherit vs-dark as base
      rules: [],      // Can add custom syntax highlighting rules
      colors: {
        // Map to CSS variables from globals.css
        'editor.background': '#0F172A',        // --background
        'editor.foreground': '#E2E8F0',        // --foreground
        'editorLineNumber.foreground': '#94A3B8',  // --muted
        'editor.selectionBackground': '#4F46E530',  // --primary with opacity
        'editor.lineHighlightBackground': '#11182710',
      }
    })

    // Call user's beforeMount if provided
    if (beforeMount) {
      beforeMount(monaco)
    }
  }

  // PATTERN: onMount for editor instance access
  function handleMount(editor: any, monaco: any) {
    editorRef.current = editor

    // Configure editor options
    editor.updateOptions({
      fontSize: 14,
      fontFamily: 'Inter, monospace',  // Match app font
      lineHeight: 1.6,
      padding: { top: 16, bottom: 16 },
      scrollBeyondLastLine: false,
      minimap: { enabled: false },     // Disable for cleaner look
      renderLineHighlight: 'line',
      smoothScrolling: true,
      ...options  // User options override defaults
    })

    // Call user's onMount if provided
    if (onMount) {
      onMount(editor, monaco)
    }
  }

  // PATTERN: Merge Monaco options with defaults
  const editorOptions = {
    readOnly,
    automaticLayout: true,  // Auto-resize on container change
    scrollbar: {
      verticalScrollbarSize: 8,
      horizontalScrollbarSize: 8,
    },
    ...options
  }

  return (
    <div className={cn("rounded-md border border-border overflow-hidden", className)}>
      <MonacoEditor
        height={height}
        language={language}
        value={value}
        defaultValue={defaultValue}
        theme={theme === 'vs-dark' ? 'boldSimplicity' : theme}
        onChange={onChange}
        onMount={handleMount}
        beforeMount={handleBeforeMount}
        options={editorOptions}
      />
    </div>
  )
}
```

**Integration Points**:
- Exports default Editor component
- Can be imported in any page/component
- Handles SSR automatically via dynamic import
- Provides clean API matching React patterns

---

### Task 4: Create Test Page for Verification

**File**: `src/pages/test-editor.tsx`

**Responsibility**: Test the Editor component in isolation

**Pattern**: Simple page with editor, demonstrates controlled and uncontrolled usage

```typescript
// Pseudocode
"use client"

import { useState } from 'react'
import Editor from '@/features/editor/components/Editor'

export default function TestEditorPage() {
  const [content, setContent] = useState('# Hello Monaco\n\nStart editing...')

  function handleChange(value: string | undefined) {
    setContent(value || '')
    console.log('Content changed:', value?.substring(0, 50))
  }

  function handleMount(editor: any, monaco: any) {
    console.log('Editor mounted:', { editor, monaco })
  }

  return (
    <div className="container mx-auto p-8">
      <h1 className="text-2xl font-bold mb-4">Monaco Editor Test</h1>

      <div className="mb-4 text-sm text-muted">
        <p>Character count: {content.length}</p>
      </div>

      <Editor
        value={content}
        onChange={handleChange}
        onMount={handleMount}
        language="markdown"
        height="600px"
        className="mb-4"
      />

      <div className="mt-4 p-4 bg-card rounded-md border border-border">
        <h2 className="font-semibold mb-2">Preview:</h2>
        <pre className="text-sm text-muted whitespace-pre-wrap">
          {content}
        </pre>
      </div>
    </div>
  )
}
```

**Integration Points**:
- Navigate to /test-editor to verify component
- Test onChange, onMount callbacks
- Verify theme matches Bold Simplicity
- Check for console errors

---

### Task 5: Update Export Paths (Optional but Recommended)

**File**: `src/features/editor/index.ts`

**Responsibility**: Centralize exports for cleaner imports

```typescript
// Clean export pattern
export { default as Editor } from './components/Editor'
export { default as EditorSkeleton } from './components/EditorSkeleton'
export type { EditorProps, EditorSkeletonProps } from './types'
```

**Integration Points**:
- Allows `import { Editor } from '@/features/editor'`
- Instead of `import Editor from '@/features/editor/components/Editor'`

---

## Validation Loop

### Level 1: Syntax & Type Checking

```bash
# Run FIRST - fix any errors before proceeding
npm run lint
# Expected: ✓ No ESLint warnings or errors

# TypeScript type checking (if separate command)
npx tsc --noEmit
# Expected: ✓ No type errors

# Expected errors to fix:
# - Missing type annotations
# - Incorrect prop types
# - Import path errors
```

### Level 2: Build Verification (CRITICAL)

```bash
# This is the SSR test - MUST pass
npm run build
# Expected: ✓ Build completes without errors
# Expected: ✓ No "window is not defined" or "document is not defined" errors
# Expected: ✓ Bundle analysis shows code splitting for Monaco

# If build fails with SSR errors:
# 1. Verify dynamic import has ssr: false
# 2. Check that Monaco is not imported directly
# 3. Ensure "use client" directive is present
```

### Level 3: Development Server Testing

```bash
# Start dev server (may already be running on port 3010)
npm run dev

# Navigate to: http://localhost:3010/test-editor
```

**Manual Test Checklist**:
1. **Initial Load**
   - [ ] EditorSkeleton shows briefly
   - [ ] Monaco Editor renders with dark theme
   - [ ] No console errors
   - [ ] Editor height is 600px (matches prop)

2. **Functionality**
   - [ ] Can type and edit content
   - [ ] onChange callback fires (check console)
   - [ ] Character count updates in real-time
   - [ ] Preview section shows content

3. **Theme Verification**
   - [ ] Background color matches Bold Simplicity (#0F172A)
   - [ ] Text color is light (#E2E8F0)
   - [ ] Line numbers are visible
   - [ ] Selection highlight uses primary color

4. **Performance**
   - [ ] No lag when typing
   - [ ] Smooth scrolling
   - [ ] No memory leaks (check DevTools Performance)

### Level 4: Production Build Testing

```bash
# Build for production
npm run build

# Run production server
npm run start

# Navigate to: http://localhost:3000/test-editor
```

**Production Test Checklist**:
- [ ] Editor loads without errors
- [ ] No console warnings
- [ ] Bundle size acceptable (<500KB for Monaco chunk)
- [ ] Loading state displays correctly
- [ ] All functionality works as in development

### Level 5: Integration Test (After Phase 5 Step 2)

**Test with EditorPane component**:
```bash
# After P5S2 implementation
# Navigate to a prompt editing page
# Verify Editor integrates correctly
```

---

## Final Validation Checklist

Before marking P5S1 complete:

### Code Quality
- [ ] `npm run build` succeeds with zero errors
- [ ] `npm run lint` passes with zero warnings
- [ ] TypeScript strict mode compliant (no `any` types except Monaco APIs)
- [ ] All files under 500 lines
- [ ] All functions under 50 lines
- [ ] Files end with newline character

### Functionality
- [ ] Editor renders without SSR errors
- [ ] Dynamic import works correctly
- [ ] Loading state displays during import
- [ ] Dark theme matches Bold Simplicity
- [ ] onChange callback fires on content changes
- [ ] onMount callback provides editor instance
- [ ] Height prop is respected
- [ ] No console errors in dev or production

### Documentation
- [ ] All files have proper headers (if required by project standards)
- [ ] TypeScript interfaces are well-documented
- [ ] Component props are clear and typed
- [ ] Test page demonstrates usage

### Performance
- [ ] Monaco chunk is code-split (check build output)
- [ ] Initial page load not significantly impacted
- [ ] No memory leaks (test with DevTools)
- [ ] Typing performance is smooth

### Design System
- [ ] Theme matches Bold Simplicity colors
- [ ] Font matches Inter (app font)
- [ ] Border radius matches design system
- [ ] Spacing follows 4px grid

---

## Anti-Patterns to Avoid

### ❌ SSR Anti-Patterns

```typescript
// ❌ WRONG - Direct import breaks SSR
import Editor from '@monaco-editor/react'

// ❌ WRONG - Missing ssr: false flag
const Editor = dynamic(() => import('@monaco-editor/react'))

// ❌ WRONG - Using Monaco in server component
export default async function Page() {
  return <Editor /> // Can't use in async server component
}

// ✅ CORRECT
"use client"
import dynamic from 'next/dynamic'
const Editor = dynamic(() => import('@monaco-editor/react'), {
  ssr: false,
  loading: () => <EditorSkeleton />
})
```

### ❌ Height Anti-Patterns

```typescript
// ❌ WRONG - No height specified
<Editor /> // Monaco won't render properly

// ❌ WRONG - Relative height without container
<div style={{ height: '100%' }}>
  <Editor height="100%" /> // Parent has no height
</div>

// ✅ CORRECT
<Editor height="500px" />
// or
<Editor height="80vh" />
```

### ❌ Theme Anti-Patterns

```typescript
// ❌ WRONG - Defining theme after mount
function handleMount(editor, monaco) {
  monaco.editor.defineTheme('custom', {...}) // Too late!
}

// ❌ WRONG - Hardcoding colors
colors: {
  'editor.background': '#000000' // Use CSS variables
}

// ✅ CORRECT
function handleBeforeMount(monaco) {
  monaco.editor.defineTheme('boldSimplicity', {
    base: 'vs-dark',
    colors: {
      'editor.background': '#0F172A' // From globals.css
    }
  })
}
```

### ❌ Component Pattern Anti-Patterns

```typescript
// ❌ WRONG - Missing "use client" directive
export default function Editor() {
  const [value, setValue] = useState('') // Breaks without "use client"
  return <MonacoEditor />
}

// ❌ WRONG - Inline styles instead of Tailwind
<div style={{ border: '1px solid gray' }}>
  <Editor />
</div>

// ✅ CORRECT
"use client"
<div className="border border-border rounded-md">
  <Editor />
</div>
```

### ❌ State Management Anti-Patterns

```typescript
// ❌ WRONG - Mixing controlled/uncontrolled
<Editor value={value} defaultValue="..." /> // Pick one!

// ❌ WRONG - Not handling undefined
function handleChange(value) {
  setContent(value) // value can be undefined!
}

// ✅ CORRECT
function handleChange(value: string | undefined) {
  setContent(value || '')
}
```

### ❌ Memory Leak Anti-Patterns

```typescript
// ❌ WRONG - Not cleaning up editor instance
function MyComponent() {
  const editorRef = useRef(null)

  function handleMount(editor) {
    editorRef.current = editor
    // No cleanup!
  }

  return <Editor onMount={handleMount} />
}

// ✅ CORRECT
// @monaco-editor/react v4 handles cleanup automatically
// But if creating custom instances:
useEffect(() => {
  return () => {
    editorRef.current?.dispose()
  }
}, [])
```

---

## PRP Metadata

### Dependencies
- **Existing**: `@monaco-editor/react` v4.6.0 (already in package.json)
- **Next.js**: v14.2.3 (Pages Router)
- **React**: v18.3.1
- **TypeScript**: v5.4.5

### Archon Project
- **Project ID**: d449f266-1f36-47ad-bd2d-30f1a0f5e999
- **Project Name**: PromptHub
- **Phase**: Phase 5 - Prompt Editor & Version Control
- **Step**: Step 1 - Monaco Editor Integration

### Related PRPs
- **Depends On**: P1S1 (Authentication & Design System) - COMPLETE
- **Required For**: P5S2 (Prompt Creation and Data Access)
- **Required For**: P5S4 (Editor UI with Manual Save)

### Estimated Implementation Time (FTE)
**2-3 hours** for a single full-time developer

**Breakdown**:
- Task 1 (Types): 15 minutes
- Task 2 (Skeleton): 20 minutes
- Task 3 (Editor): 60-90 minutes (includes theme customization)
- Task 4 (Test page): 20 minutes
- Task 5 (Exports): 10 minutes
- Testing & Validation: 30-45 minutes

### PRP Confidence Score
**8.5/10** - High confidence for one-pass implementation success

**Strengths**:
- ✅ Dependencies already installed
- ✅ Comprehensive documentation included
- ✅ Clear SSR handling pattern
- ✅ P1S1 patterns well-established
- ✅ Monaco examples from official docs
- ✅ Executable validation commands

**Risk Factors**:
- ⚠️ SSR handling (well-documented, but critical)
- ⚠️ Theme customization (straightforward with beforeMount)

---

**PRP Status**: COMPLETE
**PRP ID**: P5S1
**Archon Project**: PromptHub (d449f266-1f36-47ad-bd2d-30f1a0f5e999)
**Tasks**: 5 tasks (P5S1T1 - P5S1T5)
**Phase**: Phase 5 - Prompt Editor & Version Control
**Next PRP**: P5S2 - Prompt Creation and Data Access

**Recommendations:**
Agents:
- `senior-frontend-engineer` (All tasks - TypeScript, React, Next.js expertise required)

Notes:
- Critical: SSR handling with dynamic import (ssr: false)
- Critical: Explicit height required for Monaco rendering
- Critical: Theme customization in beforeMount, not onMount
- Follow P1S1 patterns for consistency
- Test in both development and production builds

**Estimated Implementation Time (FTE):** 2-3 hours (Actual: ~10 minutes)
