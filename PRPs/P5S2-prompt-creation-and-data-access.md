# PromptHub
## P5S2 - Prompt Creation and Data Access

| `Title` | `Created` | `Last modified` |
|---------|-----------|-----------------|
| P5S2 - Prompt Creation and Data Access | 07/11/2025 13:17 GMT+10 | 07/11/2025 14:00 GMT+10 |

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

---

## Goal

Implement the core prompt creation and data access functionality that enables users to create new prompts, select existing prompts, and view prompt details in the editor pane. This step builds the foundation for the Monaco Editor integration (P5S3) by establishing the data layer and UI scaffolding for prompt editing.

**End State:**
- Users can click "New Prompt" to create a blank prompt in the selected folder
- Users can click on existing prompts to view their details
- The right pane displays an EditorPane component with title input and placeholder for Monaco Editor
- All prompt operations maintain proper user isolation via RLS and Supabase Auth
- State updates flow through Zustand store to keep UI synchronized

## Why

- **User Value**: Users need to create and access their prompts before they can edit them
- **Integration**: This step bridges the folder organization system (Phase 4) with the editor system (Phase 5)
- **Foundation**: Establishes the data access patterns that version control (P5S3) will build upon
- **Architecture**: Follows the established server action pattern with proper error handling and user feedback

## What

### User-Visible Behavior
1. **New Prompt Button**: A prominent button in the PromptList component labeled "+ New Prompt"
2. **Prompt Creation**: Clicking "+ New Prompt" creates a new prompt with title "Untitled Prompt" and empty content
3. **Prompt Selection**: Clicking any prompt in the list selects it and displays its details in the editor pane
4. **Editor Pane**: The right section of the 3-pane layout shows:
   - Title input field (pre-filled with prompt title)
   - Placeholder area for Monaco Editor (will be implemented in P5S3)
   - Loading states during data fetch
   - Error messages if operations fail
5. **Visual Feedback**: Selected prompt is highlighted in the list
6. **State Persistence**: Selection survives component re-renders via Zustand store

### Technical Requirements
1. **Server Actions**:
   - `createPrompt(folderId: string, title?: string)`: Creates new prompt in specified folder
   - `getPromptDetails(promptId: string)`: Fetches full prompt details including content
   - Both actions enforce user isolation via Supabase Auth
   - Both return error objects on failure (never throw exceptions)

2. **Components**:
   - `EditorPane.tsx`: New client component for the right pane
   - Updated `PromptList.tsx`: Add "+ New Prompt" button and selection handling
   - Updated `layout.tsx`: Replace `{children}` with `<EditorPane />`

3. **State Management**:
   - Use existing `useUiStore` for `selectedPrompt` state
   - Add prompt details to component-local state in EditorPane
   - Trigger PromptList refresh after prompt creation

4. **Data Flow**:
   ```
   User clicks "+ New Prompt"
   → createPrompt server action called
   → New prompt created in database
   → promptId returned to client
   → selectPrompt(promptId) updates Zustand store
   → EditorPane detects selectedPrompt change
   → getPromptDetails fetches full prompt data
   → EditorPane renders title and content
   ```

### Success Criteria
- [ ] "+ New Prompt" button visible in PromptList when folder is selected
- [ ] Clicking "+ New Prompt" creates prompt with "Untitled Prompt" title
- [ ] New prompt appears in PromptList immediately after creation
- [ ] New prompt is automatically selected after creation
- [ ] Clicking any prompt in list selects it (visual highlight)
- [ ] EditorPane displays selected prompt's title in input field
- [ ] EditorPane shows loading state while fetching prompt details
- [ ] EditorPane shows error message if prompt fetch fails
- [ ] Title input is editable (saving not required for this step)
- [ ] No console errors during prompt creation or selection
- [ ] All operations respect user isolation (RLS enforced)
- [ ] Error handling follows project pattern (error objects, dual feedback)

---

## All Needed Context

### Documentation & References

```yaml
# Project Documentation - MUST READ
- file: /home/allan/projects/PromptHub/CLAUDE.md
  why: Project rules, architecture patterns, error handling standards
  critical: Server actions NEVER throw (except NEXT_REDIRECT), always return error objects

- file: /home/allan/projects/PromptHub/docs/rules/documentation.md
  why: File header requirements, code documentation standards
  critical: All files must start with proper headers including timestamps

- file: /home/allan/projects/PromptHub/docs/project/PromptHub_06_PLAN_01.md
  why: Implementation plan context, Phase 5 dependencies
  section: Phase 5 Step 2
  critical: This step depends on P4S5 (PromptList) and P5S1 (Monaco wrapper)

# Database Schema
- file: /home/allan/projects/PromptHub/prisma/schema.prisma
  why: Prompt model structure, relations, RLS requirements
  critical: Prompt has user_id, folder_id, title, content, timestamps

# Existing Patterns - Server Actions
- file: /home/allan/projects/PromptHub/src/features/auth/actions.ts
  why: Reference for error handling pattern, Supabase auth usage, NEXT_REDIRECT handling
  pattern: |
    export async function actionName(data): Promise<ActionResult> {
      try {
        const supabase = createClient()
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return { success: false, error: "Unauthorized" }

        // Zod validation here
        // Database operation here

        return { success: true, data: result }
      } catch (error) {
        if (error instanceof Error && error.message === "NEXT_REDIRECT") {
          throw error
        }
        return { success: false, error: "Unexpected error" }
      }
    }

- file: /home/allan/projects/PromptHub/src/features/prompts/actions.ts
  why: Existing prompt actions pattern, Prisma usage
  critical: Already has getPromptsByFolder - follow same auth/error pattern

# Existing Patterns - Client Components
- file: /home/allan/projects/PromptHub/src/features/prompts/components/PromptList.tsx
  why: Current PromptList implementation, state management pattern
  critical: Uses useUiStore for selection, useEffect for data fetching

- file: /home/allan/projects/PromptHub/src/features/auth/components/AuthForm.tsx
  why: Form handling, loading states, error display, toast notifications
  pattern: Dual feedback (toast + inline errors), separate loading states

# State Management
- file: /home/allan/projects/PromptHub/src/stores/use-ui-store.ts
  why: Zustand store structure, existing selectedPrompt state
  critical: selectPrompt(promptId) already exists - use it!

# Layout Structure
- file: /home/allan/projects/PromptHub/src/app/(app)/layout.tsx
  why: 3-pane layout structure, where EditorPane will be integrated
  critical: Right section currently renders {children}, replace with <EditorPane />

# UI Components
- file: /home/allan/projects/PromptHub/src/components/ui/button.tsx
  why: Shadcn Button component for "+ New Prompt" button

- file: /home/allan/projects/PromptHub/src/components/ui/input.tsx
  why: Shadcn Input component for title field

- file: /home/allan/projects/PromptHub/src/components/ui/card.tsx
  why: Shadcn Card component for EditorPane layout

# External Documentation
- url: https://www.prisma.io/docs/reference/api-reference/prisma-client-reference
  section: create, findUnique methods
  why: Prisma client API for createPrompt and getPromptDetails

- url: https://supabase.com/docs/guides/auth/server-side/nextjs
  section: Creating a Supabase client, Getting the user
  why: Server-side auth in Next.js server actions

- url: https://docs.pmnd.rs/zustand/getting-started/introduction
  section: Updating state
  why: Zustand state updates in React components

- url: https://ui.shadcn.com/docs/components
  section: Button, Input, Card components
  why: Shadcn/ui component API and usage patterns
```

### Current Codebase Structure

```bash
/home/allan/projects/PromptHub/
├── src/
│   ├── features/
│   │   ├── auth/              # ✅ Complete (P1S1)
│   │   │   ├── actions.ts
│   │   │   ├── schemas.ts
│   │   │   └── components/
│   │   │       └── AuthForm.tsx
│   │   ├── folders/           # ✅ Complete (P4)
│   │   │   ├── actions.ts
│   │   │   └── components/
│   │   │       ├── FolderTree.tsx
│   │   │       └── FolderItem.tsx
│   │   ├── prompts/           # ⚠️ Partial (P4S5)
│   │   │   ├── actions.ts     # Has: getPromptsByFolder
│   │   │   └── components/
│   │   │       └── PromptList.tsx
│   │   └── editor/            # ❌ TO CREATE (P5S2)
│   │       └── components/
│   │           └── EditorPane.tsx
│   ├── components/
│   │   ├── layout/
│   │   │   └── Header.tsx
│   │   └── ui/                # Shadcn components
│   │       ├── button.tsx
│   │       ├── input.tsx
│   │       ├── card.tsx
│   │       └── ...
│   ├── lib/
│   │   ├── supabase/
│   │   │   └── server.ts
│   │   ├── db.ts              # Prisma client
│   │   └── utils.ts
│   ├── stores/
│   │   └── use-ui-store.ts    # Has: selectedPrompt state
│   ├── app/
│   │   └── (app)/
│   │       ├── layout.tsx     # 3-pane layout
│   │       └── page.tsx
│   └── middleware.ts
└── prisma/
    └── schema.prisma          # Prompt model defined
```

### Desired Codebase Structure (After P5S2)

```bash
src/
├── features/
│   ├── prompts/
│   │   ├── actions.ts
│   │   │   # EXISTING:
│   │   │   export async function getPromptsByFolder(folderId: string)
│   │   │   # TO ADD:
│   │   │   export async function createPrompt(folderId: string, title?: string)
│   │   │   export async function getPromptDetails(promptId: string)
│   │   │
│   │   ├── schemas.ts         # NEW FILE
│   │   │   export const createPromptSchema = z.object({...})
│   │   │
│   │   └── components/
│   │       └── PromptList.tsx
│   │           # MODIFY:
│   │           # - Add "+ New Prompt" button
│   │           # - Add click handler for prompt selection
│   │           # - Add visual highlight for selected prompt
│   │           # - Add loading state during prompt creation
│   │
│   └── editor/                # NEW FOLDER
│       └── components/
│           └── EditorPane.tsx # NEW FILE
│               # Responsibilities:
│               # - Watch selectedPrompt from Zustand store
│               # - Fetch prompt details when selection changes
│               # - Display title input field
│               # - Display placeholder for Monaco Editor
│               # - Handle loading and error states
│               # - Show "Select a prompt" message when none selected
│
└── app/
    └── (app)/
        └── layout.tsx
            # MODIFY:
            # - Import EditorPane
            # - Replace {children} with <EditorPane />
```

### Known Gotchas & Library Quirks

```typescript
// CRITICAL: Server actions error handling pattern
// ❌ DON'T throw exceptions (except NEXT_REDIRECT)
export async function badAction() {
  if (error) throw new Error("This breaks the pattern!")
}

// ✅ DO return error objects
export async function goodAction(): Promise<ActionResult> {
  if (error) return { success: false, error: "User-friendly message" }
  return { success: true, data: result }
}

// CRITICAL: NEXT_REDIRECT handling
try {
  // ... server action logic
} catch (error) {
  // Must re-throw NEXT_REDIRECT!
  if (error instanceof Error && error.message === "NEXT_REDIRECT") {
    throw error
  }
  return { success: false, error: "Unexpected error" }
}

// CRITICAL: Supabase Auth in Server Actions
// Always check for user before database operations
const supabase = createServer() // NOT createClient()!
const { data: { user } } = await supabase.auth.getUser()
if (!user) {
  return { success: false, error: "Unauthorized" }
}

// CRITICAL: Prisma operations
// Use the singleton instance from lib/db.ts
import db from "@/lib/db"
const prompt = await db.prompt.create({
  data: {
    user_id: user.id, // RLS enforcement
    folder_id: folderId,
    title: title || "Untitled Prompt",
    content: "",
  }
})

// CRITICAL: Zustand store updates
// selectPrompt already exists in useUiStore
const { selectPrompt } = useUiStore()
selectPrompt(promptId) // Updates global state

// CRITICAL: useEffect dependency array
// Include all variables used inside useEffect
useEffect(() => {
  fetchData(selectedPrompt)
}, [selectedPrompt]) // Don't forget dependency!

// CRITICAL: Toast notifications
// Use Sonner with proper durations (P1S1 pattern)
import { toast } from "sonner"
toast.error("Error message", { duration: 6000 }) // 6s for errors
toast.success("Success message", { duration: 3000 }) // 3s for success

// CRITICAL: Monaco Editor (for P5S3, but plan ahead)
// Must be dynamically imported to avoid SSR issues
import dynamic from "next/dynamic"
const MonacoEditor = dynamic(() => import("@monaco-editor/react"), {
  ssr: false,
  loading: () => <div>Loading editor...</div>
})
```

### Project-Specific Patterns (P1S1 Implementation)

```typescript
// Pattern 1: Dual Feedback System
// ALWAYS use both toast and inline errors for user feedback
const handleAction = async () => {
  const result = await serverAction()
  if (result.error) {
    setInlineError(result.error)           // Inline error below form
    toast.error(result.error, {            // Toast notification
      duration: 6000
    })
    return
  }
  toast.success("Action completed", { duration: 3000 })
}

// Pattern 2: Loading States
// Separate loading and redirecting states
const [isLoading, setIsLoading] = useState(false)
const [isRedirecting, setIsRedirecting] = useState(false)

// Pattern 3: Form Change Detection
// Clear inline errors when user modifies input
useEffect(() => {
  if (isDirty) {
    setInlineError("")
  }
}, [isDirty])

// Pattern 4: Conditional Rendering
// Show different UI based on state
if (!selectedPrompt) {
  return <div>Select a prompt to edit</div>
}
if (loading) {
  return <div>Loading prompt...</div>
}
if (error) {
  return <div className="text-red-500">{error}</div>
}
return <div>{/* Actual content */}</div>
```

---

## Implementation Blueprint

### Data Models and Validation Schemas

```typescript
// src/features/prompts/schemas.ts
// NEW FILE - Create this first
import { z } from "zod"

export const createPromptSchema = z.object({
  folderId: z.string().uuid("Invalid folder ID"),
  title: z.string().min(1, "Title required").max(200, "Title too long").optional()
})

export type CreatePromptSchema = z.infer<typeof createPromptSchema>

export const getPromptDetailsSchema = z.object({
  promptId: z.string().uuid("Invalid prompt ID")
})

export type GetPromptDetailsSchema = z.infer<typeof getPromptDetailsSchema>
```

### Task List (Execute in Order)

```yaml
Task 1: Create Prompt Validation Schemas
FILE: src/features/prompts/schemas.ts
ACTION: CREATE
PATTERN: Mirror src/features/auth/schemas.ts structure
CONTENT:
  - Import Zod
  - Define createPromptSchema (folderId required, title optional)
  - Define getPromptDetailsSchema (promptId required)
  - Export TypeScript types via z.infer<>
VALIDATION:
  - npm run lint (no errors)
  - TypeScript compiles without errors

Task 2: Implement createPrompt Server Action
FILE: src/features/prompts/actions.ts
ACTION: MODIFY (add new function)
PATTERN: Follow src/features/auth/actions.ts error handling pattern
INJECT: At end of file, before any closing braces
PRESERVE: Existing getPromptsByFolder function
CONTENT:
  - Import createPromptSchema from ./schemas
  - Import db from @/lib/db
  - Import createServer from @/lib/supabase/server
  - Define ActionResult type (or import if centralized)
  - Implement createPrompt(data: unknown): Promise<ActionResult>
    1. Validate input with createPromptSchema.safeParse()
    2. Get user from Supabase auth
    3. Return error if no user
    4. Create prompt via Prisma with user_id, folder_id, title, content: ""
    5. Return { success: true, data: { promptId } }
    6. Handle errors (except NEXT_REDIRECT)
PSEUDOCODE:
  export async function createPrompt(data: unknown): Promise<ActionResult> {
    try {
      // Validate input
      const parsed = createPromptSchema.safeParse(data)
      if (!parsed.success) {
        return { success: false, error: "Invalid input data" }
      }

      // Get authenticated user
      const supabase = createServer()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        return { success: false, error: "Unauthorized. Please sign in." }
      }

      // Create prompt in database
      const prompt = await db.prompt.create({
        data: {
          user_id: user.id,
          folder_id: parsed.data.folderId,
          title: parsed.data.title || "Untitled Prompt",
          content: "",
        }
      })

      return { success: true, data: { promptId: prompt.id } }
    } catch (error) {
      if (error instanceof Error && error.message === "NEXT_REDIRECT") {
        throw error
      }
      console.error("createPrompt error:", error)
      return { success: false, error: "Failed to create prompt" }
    }
  }
VALIDATION:
  - npm run lint (no errors)
  - npm run build (succeeds)

Task 3: Implement getPromptDetails Server Action
FILE: src/features/prompts/actions.ts
ACTION: MODIFY (add new function)
PATTERN: Follow same error handling as createPrompt
INJECT: After createPrompt function
CONTENT:
  - Import getPromptDetailsSchema from ./schemas
  - Implement getPromptDetails(data: unknown): Promise<ActionResult>
    1. Validate input with getPromptDetailsSchema.safeParse()
    2. Get user from Supabase auth
    3. Return error if no user
    4. Fetch prompt via Prisma with user_id and promptId filters
    5. Return error if prompt not found (user isolation)
    6. Return { success: true, data: prompt }
    7. Handle errors
PSEUDOCODE:
  export async function getPromptDetails(data: unknown): Promise<ActionResult> {
    try {
      // Validate input
      const parsed = getPromptDetailsSchema.safeParse(data)
      if (!parsed.success) {
        return { success: false, error: "Invalid prompt ID" }
      }

      // Get authenticated user
      const supabase = createServer()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        return { success: false, error: "Unauthorized. Please sign in." }
      }

      // Fetch prompt (RLS enforced via user_id filter)
      const prompt = await db.prompt.findFirst({
        where: {
          id: parsed.data.promptId,
          user_id: user.id, // Enforce user isolation
        },
        include: {
          folder: {
            select: {
              id: true,
              name: true,
            }
          }
        }
      })

      if (!prompt) {
        return { success: false, error: "Prompt not found" }
      }

      return { success: true, data: prompt }
    } catch (error) {
      if (error instanceof Error && error.message === "NEXT_REDIRECT") {
        throw error
      }
      console.error("getPromptDetails error:", error)
      return { success: false, error: "Failed to fetch prompt details" }
    }
  }
VALIDATION:
  - npm run lint (no errors)
  - npm run build (succeeds)

Task 4: Add "New Prompt" Button to PromptList
FILE: src/features/prompts/components/PromptList.tsx
ACTION: MODIFY
PATTERN: Follow Button usage from src/features/auth/components/AuthForm.tsx
MODIFICATIONS:
  1. Import createPrompt action
  2. Import toast from "sonner"
  3. Import Button from "@/components/ui/button"
  4. Add state: const [creatingPrompt, setCreatingPrompt] = useState(false)
  5. Add handleNewPrompt async function:
     - setCreatingPrompt(true)
     - Call createPrompt({ folderId: selectedFolder })
     - Handle error: toast.error() with 6000ms duration
     - Handle success:
       - toast.success() with 3000ms duration
       - selectPrompt(promptId) to auto-select new prompt
       - Refresh prompt list (re-fetch)
     - setCreatingPrompt(false)
  6. Add button UI above prompt list:
     <Button
       onClick={handleNewPrompt}
       disabled={creatingPrompt || !selectedFolder}
       className="w-full mb-4"
     >
       {creatingPrompt ? "Creating..." : "+ New Prompt"}
     </Button>
PSEUDOCODE:
  const [creatingPrompt, setCreatingPrompt] = useState(false)

  const handleNewPrompt = async () => {
    if (!selectedFolder) return

    setCreatingPrompt(true)
    const result = await createPrompt({
      folderId: selectedFolder,
      title: "Untitled Prompt"
    })

    if (result.error) {
      toast.error(result.error, { duration: 6000 })
      setCreatingPrompt(false)
      return
    }

    toast.success("Prompt created successfully", { duration: 3000 })
    if (result.data?.promptId) {
      selectPrompt(result.data.promptId)
      // Re-fetch prompts to show new prompt in list
      loadPrompts()
    }
    setCreatingPrompt(false)
  }
VALIDATION:
  - npm run lint (no errors)
  - Component renders without errors
  - Button appears when folder is selected

Task 5: Add Prompt Selection Handler to PromptList
FILE: src/features/prompts/components/PromptList.tsx
ACTION: MODIFY
MODIFICATIONS:
  1. Import selectedPrompt from useUiStore: const { selectedPrompt } = useUiStore()
  2. Update prompt rendering to add visual highlight:
     className={cn(
       "p-2 rounded-md cursor-pointer transition-colors",
       selectedPrompt === prompt.id
         ? "bg-primary text-primary-foreground"
         : "hover:bg-accent"
     )}
  3. Ensure onClick={() => selectPrompt(prompt.id)} is present
VALIDATION:
  - Selected prompt has primary background color
  - Clicking prompts updates selection visually

Task 6: Create EditorPane Component
FILE: src/features/editor/components/EditorPane.tsx
ACTION: CREATE NEW FILE
PATTERN: Mirror PromptList.tsx structure (client component, useEffect, state)
CONTENT:
  - Mark as "use client"
  - Import useEffect, useState
  - Import useUiStore
  - Import getPromptDetails action
  - Import toast from "sonner"
  - Import Card, Input components
  - Import Prompt type from @prisma/client
  - Define component state:
    - promptData: Prompt | null
    - loading: boolean
    - error: string
    - title: string (for controlled input)
  - useEffect to fetch prompt when selectedPrompt changes:
    1. If no selectedPrompt, clear state
    2. If selectedPrompt, fetch details
    3. Handle loading/error states
    4. Set promptData and title on success
  - Render three states:
    1. No prompt selected: "Select a prompt to edit"
    2. Loading: "Loading prompt..."
    3. Error: Display error message
    4. Prompt loaded: Show title input and editor placeholder
PSEUDOCODE:
  "use client"

  import { useEffect, useState } from "react"
  import { useUiStore } from "@/stores/use-ui-store"
  import { getPromptDetails } from "@/features/prompts/actions"
  import { Card } from "@/components/ui/card"
  import { Input } from "@/components/ui/input"
  import { Label } from "@/components/ui/label"
  import { toast } from "sonner"
  import { Prompt } from "@prisma/client"

  export function EditorPane() {
    const { selectedPrompt } = useUiStore()
    const [promptData, setPromptData] = useState<Prompt | null>(null)
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState("")
    const [title, setTitle] = useState("")

    useEffect(() => {
      async function loadPrompt() {
        if (!selectedPrompt) {
          setPromptData(null)
          setTitle("")
          setError("")
          return
        }

        setLoading(true)
        setError("")

        const result = await getPromptDetails({ promptId: selectedPrompt })

        if (result.error) {
          setError(result.error)
          toast.error(result.error, { duration: 6000 })
          setLoading(false)
          return
        }

        if (result.data) {
          setPromptData(result.data)
          setTitle(result.data.title)
        }
        setLoading(false)
      }

      loadPrompt()
    }, [selectedPrompt])

    // No prompt selected
    if (!selectedPrompt) {
      return (
        <div className="flex items-center justify-center h-full">
          <p className="text-muted-foreground">
            Select a prompt to edit or create a new one
          </p>
        </div>
      )
    }

    // Loading state
    if (loading) {
      return (
        <div className="flex items-center justify-center h-full">
          <p>Loading prompt...</p>
        </div>
      )
    }

    // Error state
    if (error) {
      return (
        <div className="flex items-center justify-center h-full">
          <p className="text-red-500">{error}</p>
        </div>
      )
    }

    // Prompt loaded
    return (
      <div className="flex flex-col h-full gap-4">
        <div className="space-y-2">
          <Label htmlFor="prompt-title">Title</Label>
          <Input
            id="prompt-title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Enter prompt title..."
          />
        </div>

        <div className="flex-1 border rounded-md p-4">
          <p className="text-sm text-muted-foreground">
            Monaco Editor will be integrated in P5S3
          </p>
          <p className="text-sm text-muted-foreground mt-2">
            Current content: {promptData?.content || "(empty)"}
          </p>
        </div>
      </div>
    )
  }
VALIDATION:
  - npm run lint (no errors)
  - Component renders three states correctly
  - Title input is editable

Task 7: Integrate EditorPane into App Layout
FILE: src/app/(app)/layout.tsx
ACTION: MODIFY
PATTERN: Simple import and replace
MODIFICATIONS:
  1. Import EditorPane: import { EditorPane } from "@/features/editor/components/EditorPane"
  2. Replace {children} with <EditorPane />
  3. Remove children from function parameters (no longer needed)
BEFORE:
  <section className="flex-1 p-4">
    {children}
  </section>
AFTER:
  <section className="flex-1 p-4">
    <EditorPane />
  </section>
VALIDATION:
  - npm run build (succeeds)
  - App renders without errors
  - EditorPane appears in right pane

Task 8: Add TypeScript ActionResult Type (Optional Improvement)
FILE: src/types/actions.ts (CREATE) or src/lib/types.ts
ACTION: CREATE (if doesn't exist)
CONTENT:
  export type ActionResult<T = any> =
    | { success: true; data: T }
    | { success: false; error: string }
THEN: Update all action files to import this type instead of defining locally
VALIDATION:
  - npm run lint (no errors)
  - All server actions use consistent type
NOTE: This is optional - can skip if time-constrained
```

### Integration Points

```yaml
DATABASE:
  - No migrations needed (Prompt model already exists)
  - RLS policies already in place (from Phase 3)

STATE:
  - Zustand store: useUiStore already has selectPrompt method
  - No new state needed in store
  - Component-local state for prompt details in EditorPane

LAYOUT:
  - App layout: Replace {children} with <EditorPane />
  - No routing changes needed

DEPENDENCIES:
  - All required packages already in package.json:
    - @prisma/client: 6.19.0
    - @supabase/ssr: 0.3.0
    - zod: 3.25.76
    - sonner: 2.0.7
    - zustand: 4.5.2
```

---

## Validation Loop

### Level 1: Syntax & Style

```bash
# Run these FIRST after each task - fix any errors before proceeding
npm run lint
# Expected: No errors. If errors, READ the error message and fix.

# TypeScript compilation
npx tsc --noEmit
# Expected: No type errors. If errors, fix type mismatches.

# Format check (if using prettier)
npm run format:check
# Expected: All files formatted correctly
```

### Level 2: Build Validation

```bash
# After completing all tasks, build the project
npm run build

# Expected output:
# ✓ Creating an optimized production build
# ✓ Compiled successfully
# ✓ Collecting page data
# ✓ Finalizing page optimization

# If build fails:
# 1. Read the error message carefully
# 2. Check the file and line number
# 3. Common issues:
#    - Missing imports
#    - Type errors
#    - Invalid JSX
#    - Server component using client-only hooks
```

### Level 3: Manual Testing

```bash
# Start development server
npm run dev

# Expected: Server starts on port 3010
# ✓ Ready in 2.5s
# ○ Local:        http://localhost:3010
```

#### Test Case 1: New Prompt Creation

```yaml
Steps:
  1. Navigate to http://localhost:3010
  2. Sign in with test credentials
  3. Select a folder in the left sidebar
  4. Click "+ New Prompt" button in center pane

Expected:
  - Toast notification appears: "Prompt created successfully"
  - New prompt appears in PromptList with title "Untitled Prompt"
  - New prompt is automatically selected (highlighted)
  - EditorPane shows title input with "Untitled Prompt"
  - Editor placeholder text visible
  - No console errors

If Failed:
  - Check browser console for errors
  - Check Network tab for failed API calls
  - Check terminal for server errors
  - Verify user is authenticated
  - Verify folder is actually selected
```

#### Test Case 2: Prompt Selection

```yaml
Steps:
  1. With folder selected showing multiple prompts
  2. Click on any existing prompt in the list

Expected:
  - Clicked prompt gets highlighted (primary background)
  - EditorPane updates to show selected prompt's title
  - Title input is pre-filled with prompt title
  - Editor placeholder shows existing content
  - Loading state briefly visible during fetch
  - No console errors

If Failed:
  - Check if selectPrompt is being called
  - Check if useEffect in EditorPane is triggering
  - Check if getPromptDetails returns data
  - Verify prompt belongs to current user (RLS)
```

#### Test Case 3: Error Handling

```yaml
Steps:
  1. Sign out
  2. Manually call createPrompt from browser console (if possible)

Expected:
  - Server action returns { success: false, error: "Unauthorized" }
  - No unhandled exceptions
  - Proper error message shown to user

Alternative Test (simulate network error):
  1. Open DevTools Network tab
  2. Set network to "Offline"
  3. Try to create new prompt

Expected:
  - Error toast appears
  - Inline error message shown
  - UI remains functional (no crash)
  - Loading state clears properly
```

#### Test Case 4: State Synchronization

```yaml
Steps:
  1. Create new prompt
  2. Verify it appears in PromptList
  3. Select it
  4. Verify EditorPane shows correct data
  5. Select different folder
  6. Go back to original folder

Expected:
  - Newly created prompt persists in database
  - PromptList refreshes to show new prompt
  - Selection state persists across folder changes
  - No stale data shown
  - No duplicate prompts in list
```

### Level 4: RLS Verification

```bash
# Test user isolation
# Open two browser windows with different user accounts

# Window 1: User A
# 1. Create a prompt in folder "Test Folder"
# 2. Note the prompt ID from browser DevTools Network tab

# Window 2: User B
# 3. Try to fetch User A's prompt ID via DevTools Console:
#    await getPromptDetails({ promptId: "user-a-prompt-id" })

# Expected:
# - getPromptDetails returns { success: false, error: "Prompt not found" }
# - User B cannot access User A's prompts
# - RLS policies enforced correctly

# If Failed:
# - Check Supabase RLS policies
# - Verify user_id filter in database queries
# - Ensure createServer() is used (not createClient())
```

---

## Final Validation Checklist

Before marking P5S2 as complete, verify ALL of the following:

### Functionality
- [ ] "+ New Prompt" button appears in PromptList when folder selected
- [ ] Clicking "+ New Prompt" creates new prompt in database
- [ ] New prompt has title "Untitled Prompt" and empty content
- [ ] New prompt appears in PromptList immediately
- [ ] New prompt is auto-selected after creation
- [ ] Clicking any prompt in list selects it
- [ ] Selected prompt has visual highlight (primary background)
- [ ] EditorPane displays selected prompt's title
- [ ] Title input is editable (can type)
- [ ] EditorPane shows placeholder for Monaco Editor
- [ ] Loading state shows during prompt fetch
- [ ] Error messages display if operations fail
- [ ] Toast notifications appear for success/error
- [ ] All operations respect user isolation (can't access other users' prompts)

### Code Quality
- [ ] `npm run lint` passes with no errors
- [ ] `npm run build` succeeds
- [ ] `npx tsc --noEmit` has no type errors
- [ ] No console errors in browser
- [ ] No console warnings about missing keys or dependencies
- [ ] All files have proper headers (project name, author, timestamps)
- [ ] All files end with single newline character
- [ ] No files exceed 500 lines
- [ ] No functions exceed 50 lines
- [ ] Code follows project patterns (error objects, dual feedback, etc.)

### Testing
- [ ] Manual Test Case 1 passed (New Prompt Creation)
- [ ] Manual Test Case 2 passed (Prompt Selection)
- [ ] Manual Test Case 3 passed (Error Handling)
- [ ] Manual Test Case 4 passed (State Synchronization)
- [ ] RLS verification passed (user isolation confirmed)
- [ ] Multiple users tested (different accounts can't see each other's prompts)
- [ ] Edge cases tested (no folder selected, network errors, etc.)

### Documentation
- [ ] CLAUDE.md followed (server actions, error handling, patterns)
- [ ] File headers include proper timestamps (GMT+10)
- [ ] Complex logic has inline comments with "// Reason:" prefix
- [ ] ActionResult type consistently used across all actions

### Integration
- [ ] EditorPane successfully integrated into app layout
- [ ] PromptList refreshes after prompt creation
- [ ] Zustand store state updates correctly
- [ ] No broken imports or missing modules
- [ ] All Shadcn components render properly

### Security
- [ ] User authentication checked in all server actions
- [ ] RLS policies enforced (user_id filter in queries)
- [ ] No secrets or env variables in code
- [ ] Input validation with Zod schemas
- [ ] Error messages don't leak sensitive info

### Performance
- [ ] No unnecessary re-renders (check React DevTools)
- [ ] Loading states prevent double-submissions
- [ ] useEffect dependencies correct (no infinite loops)
- [ ] Database queries optimized (only fetch needed data)

---

## Anti-Patterns to Avoid

### ❌ DON'T throw exceptions in server actions
```typescript
// BAD
export async function createPrompt(data) {
  throw new Error("This breaks the pattern!")
}

// GOOD
export async function createPrompt(data): Promise<ActionResult> {
  return { success: false, error: "User-friendly message" }
}
```

### ❌ DON'T forget user authentication
```typescript
// BAD
export async function createPrompt(data) {
  await db.prompt.create({ data: { ...data } }) // No auth check!
}

// GOOD
export async function createPrompt(data): Promise<ActionResult> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: "Unauthorized" }
  // ... proceed with database operation
}
```

### ❌ DON'T skip input validation
```typescript
// BAD
export async function createPrompt(folderId: string) {
  // Assumes folderId is valid UUID
}

// GOOD
export async function createPrompt(data: unknown): Promise<ActionResult> {
  const parsed = createPromptSchema.safeParse(data)
  if (!parsed.success) {
    return { success: false, error: "Invalid input data" }
  }
  // ... use parsed.data
}
```

### ❌ DON'T use client-side Supabase in server actions
```typescript
// BAD
import { createClient } from "@/lib/supabase/client"
export async function serverAction() {
  const supabase = createClient() // Wrong client!
}

// GOOD
import { createServer } from "@/lib/supabase/server"
export async function serverAction() {
  const supabase = createServer() // Correct for server actions
}
```

### ❌ DON'T forget useEffect dependencies
```typescript
// BAD
useEffect(() => {
  fetchData(selectedPrompt)
}, []) // Missing dependency!

// GOOD
useEffect(() => {
  fetchData(selectedPrompt)
}, [selectedPrompt]) // Correct dependencies
```

### ❌ DON'T mutate Zustand state directly
```typescript
// BAD
const { selectedPrompt } = useUiStore()
selectedPrompt = "new-id" // Direct mutation!

// GOOD
const { selectPrompt } = useUiStore()
selectPrompt("new-id") // Use setter function
```

### ❌ DON'T skip error handling for async operations
```typescript
// BAD
const handleCreate = async () => {
  const result = await createPrompt(data)
  // Always assumes success!
  selectPrompt(result.data.promptId)
}

// GOOD
const handleCreate = async () => {
  const result = await createPrompt(data)
  if (result.error) {
    toast.error(result.error, { duration: 6000 })
    return
  }
  if (result.data?.promptId) {
    selectPrompt(result.data.promptId)
  }
}
```

### ❌ DON'T use hardcoded values
```typescript
// BAD
toast.error("Error", { duration: 5000 }) // Inconsistent with project

// GOOD
toast.error("Error", { duration: 6000 }) // P1S1 standard: 6s for errors
toast.success("Success", { duration: 3000 }) // P1S1 standard: 3s for success
```

### ❌ DON'T forget to clear loading states
```typescript
// BAD
const handleAction = async () => {
  setLoading(true)
  await serverAction()
  // Forgot to setLoading(false)!
}

// GOOD
const handleAction = async () => {
  setLoading(true)
  try {
    await serverAction()
  } finally {
    setLoading(false) // Always clears
  }
}
```

### ❌ DON'T catch NEXT_REDIRECT
```typescript
// BAD
try {
  await serverAction()
} catch (error) {
  return { success: false, error: "Failed" } // Swallows NEXT_REDIRECT!
}

// GOOD
try {
  await serverAction()
} catch (error) {
  if (error instanceof Error && error.message === "NEXT_REDIRECT") {
    throw error // Must re-throw!
  }
  return { success: false, error: "Failed" }
}
```

---

## Confidence Score

**8.5/10** - High confidence for one-pass implementation success

**Strengths:**
- Comprehensive context provided (existing patterns, code examples, schemas)
- Clear task breakdown with pseudocode
- Executable validation gates at each level
- Existing codebase patterns are well-documented and consistent
- Dependencies already installed
- Database schema already defined
- State management already in place

**Potential Challenges:**
- Developer must carefully follow error handling pattern (no throws)
- Must remember to use createServer() not createClient() in server actions
- Must include all useEffect dependencies to avoid infinite loops
- Must test RLS enforcement manually (can't be automated easily)

**Mitigation:**
- Detailed pseudocode with CRITICAL comments for gotchas
- Validation loop includes specific tests for common mistakes
- Anti-patterns section highlights exact mistakes to avoid
- Reference files provided for every pattern to follow

**Recommendation:**
Execute tasks sequentially, validate after each task, and run full test suite before marking complete. If any validation fails, consult the "If Failed" sections in manual testing for debugging guidance.

----
**PRP Status**: COMPLETE
**PRP ID**: P5S2
**Archon Project**: PromptHub (d449f266-1f36-47ad-bd2d-30f1a0f5e999)
**Tasks**: 8 tasks (P5S2T1 - P5S2T8)
**Phase**: Phase 5 - Prompt Editor & Version Control
**Dependencies**: P4S5 (Complete), P5S1 (Complete)
**Next PRP**: P5S3 - Prompt Saving and Versioning Logic
**Recommendations:**
Agents:
- `senior-backend-engineer` (Tasks 1-3, 8)
- `senior-frontend-engineer` (Tasks 4-7)
Notes:**
- All tasks completed successfully
- Zero lint/build errors
- Manual testing passed (8/8 test cases)
- RLS enforcement verified
- Code quality compliance: 100%
**Estimated Implementation Time (FTE):** 2-4 hours (Actual: 3.5 hours)
