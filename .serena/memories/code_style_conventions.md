# PromptHub - Code Style & Conventions
Last Updated: 07/11/2025 21:10 GMT+10

## TypeScript Configuration
- **Strict Mode**: Enabled
- **Module Resolution**: bundler
- **Path Aliases**: `@/*` maps to `src/*`
- **JSX**: preserve (Next.js handles compilation)
- **Target**: ES2017
- **Lib**: ES2020, DOM, DOM.Iterable

## Naming Conventions

### Files
| Type | Convention | Example |
|------|------------|---------|
| Components | PascalCase.tsx | `AuthForm.tsx`, `EditorPane.tsx` |
| Pages | kebab-case or lowercase | `login.tsx`, `dashboard.tsx` |
| Actions | actions.ts | `features/auth/actions.ts` |
| Schemas | schemas.ts | `features/auth/schemas.ts` |
| Utils | camelCase.ts | `markdown-actions.ts` |
| Types | *.types.ts | `user.types.ts` (if needed) |
| Stores | use-*-store.ts | `use-ui-store.ts` |

### Code Naming
- **Components**: PascalCase (`AuthForm`, `EditorPane`)
- **Functions**: camelCase (`signIn`, `toggleBold`)
- **Variables**: camelCase (`selectedDocument`, `isDirty`)
- **Constants**: UPPER_SNAKE_CASE or camelCase (project uses camelCase)
- **Interfaces/Types**: PascalCase (`EditorProps`, `UIStore`)
- **Server Actions**: camelCase with descriptive verbs (`signIn`, `createDocument`)

## Code Structure Rules

### File Size Limits
- **Max 500 lines per file** (mandatory)
- **Max 50 lines per function** (single responsibility)
- **Max 100 characters per line**
- Current status: All files well under limits (largest ~300 lines)

### Function Guidelines
- Single, clear responsibility
- Prefer async/await over promise chains
- Early returns for error handling
- Clear, meaningful names
- Try-catch blocks for error handling
- Toast notifications for user feedback

### Component Guidelines
- Functional components with TypeScript interfaces
- Props interface defined at top of file or inline
- Client Components marked with `"use client"`
- Hooks at top of component body
- Event handlers prefixed with `handle` (e.g., `handleSave`)

## Latest Patterns (P5S4, P5S4b)

### Zustand Store Pattern (P5S4, P5S4b)

**Store Location**: `src/stores/use-ui-store.ts`

```typescript
import { create } from 'zustand'

interface UIStore {
  // State
  selectedDocumentId: string | null
  folderRefetchTrigger: number
  documentRefetchTrigger: number
  
  // Actions
  setSelectedDocument: (doc: Document | null) => void
  triggerFolderRefetch: () => void
  triggerDocumentRefetch: () => void
}

export const useUIStore = create<UIStore>((set) => ({
  selectedDocumentId: null,
  folderRefetchTrigger: 0,
  documentRefetchTrigger: 0,
  
  setSelectedDocument: (doc) => set({ 
    selectedDocumentId: doc?.id ?? null,
    selectedDocument: doc 
  }),
  
  triggerFolderRefetch: () => set({ 
    folderRefetchTrigger: Date.now() 
  }),
  
  triggerDocumentRefetch: () => set({ 
    documentRefetchTrigger: Date.now() 
  })
}))
```

### Refetch Trigger Pattern (P5S4b)

**Trigger from Mutation**:
```typescript
const handleCreateFolder = async (name: string) => {
  const result = await createFolder({ name, parentId })
  
  if (result.success) {
    toast.success("Folder created")
    useUIStore.getState().triggerFolderRefetch()
  }
}
```

**Subscribe in Component**:
```typescript
const folderRefetchTrigger = useUIStore(s => s.folderRefetchTrigger)

useEffect(() => {
  const fetchFolders = async () => {
    const data = await getFolders()
    setFolders(data)
  }
  fetchFolders()
}, [folderRefetchTrigger])
```

### Document Switching Cleanup Pattern (P5S4b)

**Problem**: Stale content when switching documents

**Solution**: Cleanup effect
```typescript
const EditorPane = ({ document }: Props) => {
  const [localContent, setLocalContent] = useState(document?.content ?? '')
  const [isDirty, setIsDirty] = useState(false)
  
  // Reset content when document changes
  useEffect(() => {
    setLocalContent(document?.content ?? '')
    setIsDirty(false)
  }, [document?.id])  // Trigger on ID change
  
  const handleContentChange = (value: string) => {
    setLocalContent(value)
    setIsDirty(value !== document?.content)
  }
  
  return <Editor value={localContent} onChange={handleContentChange} />
}
```

### Tooltip Pattern (P5S4b)

**Setup in Layout**:
```typescript
import { TooltipProvider } from "@/components/ui/tooltip"

export default function AppLayout({ children }) {
  return (
    <TooltipProvider delayDuration={700}>
      {children}
    </TooltipProvider>
  )
}
```

**Usage in Components**:
```typescript
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"

<Tooltip>
  <TooltipTrigger asChild>
    <Button 
      variant="ghost" 
      size="icon"
      onClick={handleCreate}
      disabled={!canCreate}
    >
      <FilePlus className="h-4 w-4" />
    </Button>
  </TooltipTrigger>
  <TooltipContent>
    {canCreate ? "Create new document" : "Select a folder first"}
  </TooltipContent>
</Tooltip>
```

**Best Practices**:
- Use `asChild` on TooltipTrigger to avoid wrapper div
- Provide context-aware messages for disabled states
- Keep tooltips concise (1-5 words)
- Use 700ms delay for hover (set in provider)

### Toolbar Pattern (P5S4, P5S4b)

**Icon-based Toolbar**:
```typescript
<div className="flex items-center gap-1">
  <Tooltip>
    <TooltipTrigger asChild>
      <Button variant="ghost" size="icon" onClick={handleCreate}>
        <FilePlus className="h-4 w-4" />
      </Button>
    </TooltipTrigger>
    <TooltipContent>Create new</TooltipContent>
  </Tooltip>
  
  <Tooltip>
    <TooltipTrigger asChild>
      <Button variant="ghost" size="icon" onClick={handleEdit}>
        <Edit className="h-4 w-4" />
      </Button>
    </TooltipTrigger>
    <TooltipContent>Edit</TooltipContent>
  </Tooltip>
</div>
```

### Markdown Actions Pattern (P5S4)

**Action Utilities**: `src/features/editor/markdown-actions.ts`

```typescript
import type monaco from 'monaco-editor'

export function toggleBold(editor: monaco.editor.IStandaloneCodeEditor) {
  const selection = editor.getSelection()
  if (!selection) return
  
  const model = editor.getModel()
  if (!model) return
  
  const selectedText = model.getValueInRange(selection)
  const newText = `**${selectedText}**`
  
  editor.executeEdits('', [{
    range: selection,
    text: newText,
    forceMoveMarkers: true
  }])
}

// Similar functions for: toggleItalic, insertHeading, insertLink, etc.
```

**Integration**:
```typescript
import { toggleBold, toggleItalic } from '@/features/editor/markdown-actions'

const EditorPane = () => {
  const editorRef = useRef<monaco.editor.IStandaloneCodeEditor>()
  
  const handleBold = () => {
    if (editorRef.current) {
      toggleBold(editorRef.current)
    }
  }
  
  return (
    <>
      <Toolbar onBold={handleBold} />
      <Editor onMount={(editor) => editorRef.current = editor} />
    </>
  )
}
```

## SSR Handling Pattern (P5S1)

### Dynamic Import for SSR-Incompatible Libraries
```typescript
// Problem: Monaco uses window/document APIs, breaks during SSR
// Solution: Dynamic import with ssr: false

import dynamic from "next/dynamic"

const Editor = dynamic(
  () => import("./components/Editor").then(mod => mod.Editor),
  {
    loading: () => <EditorSkeleton />,
    ssr: false  // CRITICAL: Prevents SSR execution
  }
)
```

**Key Principles**:
- Use `dynamic()` from Next.js for SSR-incompatible components
- Set `ssr: false` to skip server-side rendering
- Provide `loading` component for better UX
- Theme definition in `beforeMount` hook (timing critical)
- Never access window/document outside of event callbacks

## Monaco Editor Patterns (P5S1, P5S3d, P5S4)

### Theme Definition
```typescript
const onBeforeMount: BeforeMount = (monaco) => {
  monaco.editor.defineTheme("boldSimplicity", {
    base: "vs-dark",
    inherit: true,
    rules: [
      { token: "comment", foreground: "94A3B8" },
      { token: "keyword", foreground: "EC4899" },
      // ... more rules
    ],
    colors: {
      "editor.background": "#0F172A",
      "editor.foreground": "#E2E8F0",
      "editorCursor.foreground": "#EC4899",
    }
  })
}
```

### Height in Flex Containers (P5S3d - CRITICAL)
```typescript
// Wrapper structure for Monaco in flex layouts
<div className="flex-1 overflow-hidden relative">
  <div className="absolute inset-0 h-full">  {/* CRITICAL: h-full */}
    <Editor height="100%" />
  </div>
</div>
```

**Why This Works**:
- `flex-1`: Takes available vertical space
- `overflow-hidden relative`: Creates positioning context
- `absolute inset-0`: Stretches to parent bounds
- `h-full`: Explicitly sets height to 100%
- Monaco `height="100%"`: Now has height reference

### Editor Ref Pattern (P5S4)
```typescript
const EditorPane = () => {
  const editorRef = useRef<monaco.editor.IStandaloneCodeEditor>()
  
  const handleMount = (editor: monaco.editor.IStandaloneCodeEditor) => {
    editorRef.current = editor
    
    // Add keyboard shortcuts
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => {
      handleSave()
    })
  }
  
  return <Editor onMount={handleMount} />
}
```

## Server Action Pattern (P1S1)

### Error Objects (Never Throws)
```typescript
"use server"

import { createClient } from "@/lib/supabase/server"
import { signInSchema } from "./schemas"

export async function signIn(data: unknown) {
  // Validate input
  const parsed = signInSchema.safeParse(data)
  if (!parsed.success) {
    return { error: "Invalid input" }
  }

  // Supabase operation
  const supabase = createClient()
  const { error } = await supabase.auth.signInWithPassword({
    email: parsed.data.email,
    password: parsed.data.password
  })

  // Return error object (NEVER throw)
  if (error) {
    return { error: error.message }
  }

  return { success: true }
}
```

## Client Component Patterns

### Dual Feedback Pattern (P1S1)
```typescript
"use client"

import { useState } from "react"
import { toast } from "sonner"

export function Form() {
  const [formError, setFormError] = useState("")
  const [isLoading, setIsLoading] = useState(false)

  const handleSubmit = async (data: FormData) => {
    setIsLoading(true)
    setFormError("") // Clear previous inline error

    const result = await action(data)

    if (result.error) {
      // Dual feedback
      setFormError(result.error)           // Inline error
      toast.error(result.error, {          // Toast notification
        duration: 6000
      })
      setIsLoading(false)
      return
    }

    toast.success("Success", { duration: 3000 })
  }

  return (
    <form onSubmit={handleSubmit}>
      {/* Form fields */}
      <FormError message={formError} />
    </form>
  )
}
```

### Dirty State Tracking (P5S4)
```typescript
const [localContent, setLocalContent] = useState(initialContent)
const [isDirty, setIsDirty] = useState(false)

const handleContentChange = (value: string) => {
  setLocalContent(value)
  setIsDirty(value !== initialContent)
}

const handleSave = async () => {
  if (!isDirty) return
  
  const result = await saveDocument({ content: localContent })
  if (result.success) {
    setIsDirty(false)
    toast.success("Saved")
  }
}
```

## Import Organization
1. React and Next.js
2. Third-party libraries (Monaco, Zustand, etc.)
3. Internal absolute imports (`@/...`)
4. Relative imports
5. Types (if needed separately)

```typescript
import { useState, useEffect, useRef } from "react"
import { useRouter } from "next/router"
import dynamic from "next/dynamic"
import { toast } from "sonner"
import type monaco from "monaco-editor"

import { Button } from "@/components/ui/button"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { useUIStore } from "@/stores/use-ui-store"
import { toggleBold } from "@/features/editor/markdown-actions"

import { FormError } from "./FormError"
```

## Color System (P5S3d - Compact UI)

### CSS Variables (globals.css)
```css
html {
  font-size: 12px;  /* P5S3d: Compact UI (was 16px) */
}

:root {
  --primary: 239 84% 67%;      /* Indigo #4F46E5 */
  --accent: 328 85% 70%;       /* Magenta #EC4899 */
  --background: 222 47% 11%;   /* Dark blue-black #0F172A */
  --card: 220 26% 14%;         /* Gray 900 #111827 */
  --foreground: 213 31% 91%;   /* Light text #E2E8F0 */
}
```

### Component Sizing Standards (P5S3d, P5S4b)
- **Button Default**: `h-8 px-3 text-xs`
- **Button Small**: `h-7 px-2.5 text-xs`
- **Button Icon**: `h-8 w-8` (P5S4b)
- **Input**: `h-8 px-2.5 py-1.5`
- **Label**: `text-xs`
- **PanelSubheader**: `h-10 px-3 text-xs`
- **Icons**: `h-4 w-4` (standard toolbar icons)
- **Monaco Code**: 14px (preserved for readability)

### Tailwind Classes
```typescript
// Primary button
className="bg-primary text-primary-foreground hover:bg-primary/90"

// Ghost button (toolbar icons)
className="hover:bg-accent/10 hover:text-accent"

// Icon size (P5S4b standard)
className="h-4 w-4"
```

## Best Practices

### Error Handling
- **Server Actions**: Return error objects, never throw
- **Client Components**: Handle errors with try-catch
- **Dual Feedback**: Toast + inline errors (when applicable)
- **Error Clearing**: Clear on form change or action retry
- **User-Friendly Messages**: Clear, actionable errors

### State Management
- **Zustand**: Global UI state, refetch triggers
- **Local State**: Component-specific state (dirty, loading)
- **Cleanup Effects**: Reset state on dependency changes
- **Refetch Pattern**: Timestamp-based invalidation

### User Feedback
- **Toast Durations**:
  - Errors: 6000ms (6 seconds)
  - Success: 3000ms (3 seconds)
- **Toast Positioning**: Top center (default)
- **Inline Errors**: Below form fields with icon
- **Tooltips**: 700ms hover delay, context-aware messages

### Performance
- Prefer async/await
- Client-side navigation (next/router)
- Cleanup effects for subscriptions
- Debounce expensive operations

## Common Patterns Summary

### Latest Patterns (P5S4b)
1. **Refetch Triggers**: Timestamp-based invalidation
2. **Cleanup Effects**: Reset state on dependency changes
3. **Tooltip System**: Context-aware, 700ms delay
4. **Icon Toolbars**: Consistent icon-only buttons

### Established Patterns (P5S1-P5S4)
1. **SSR Safety**: Dynamic import with `ssr: false`
2. **Monaco Height**: `absolute inset-0 h-full` wrapper
3. **Dirty Tracking**: Compare local to initial content
4. **Markdown Actions**: Utility functions for formatting
5. **Error Objects**: Server actions return errors

### Core Patterns (P1S1)
1. **Dual Feedback**: Toast + inline errors
2. **Context-Aware**: Components adapt to auth state
3. **Loading States**: Separate loading/redirecting states
4. **Form Changes**: Clear errors on input change
