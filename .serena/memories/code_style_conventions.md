# PromptHub - Code Style Conventions

## Critical Architectural Patterns (P5S4)

### 1. Document Cache Pattern (EditorPane.tsx)

**User-Scoped Cache Structure**:
```typescript
const documentCache = new Map<string, {
  userId: string  // CRITICAL: User-scoped for security
  promptData: PromptWithFolder
  title: string | null  // Nullable titles allowed
  content: string
  lastSaved: Date | null
}>()

// ALWAYS clear cache on module load
documentCache.clear()

// Export clearing function for logout
export function clearDocumentCache() {
  documentCache.clear()
}
```

**Security Rules**:
- ALWAYS validate cache entry userId matches currentUserId
- ALWAYS clear cache on logout (called in auth/actions.ts)
- NEVER trust cached data without userId validation

### 2. Race Prevention with Refs Pattern

**Four Critical Refs**:
```typescript
// Prevent duplicate loads in React Strict Mode
const loadedRef = useRef<string | null>(null)

// Track content ownership to prevent cross-contamination
const contentPromptIdRef = useRef<string | null>(null)

// Track current promptId synchronously to prevent stale saves
const promptIdRef = useRef<string | null>(null)

// Track document transition state to prevent stale cache updates
const isTransitioning = useRef(false)
```

**Rules for Refs**:
1. **loadedRef**: Mark as loaded BEFORE database fetch to prevent duplicates
2. **contentPromptIdRef**: Update ONLY after setting content state
3. **promptIdRef**: Update synchronously in useEffect whenever promptId changes
4. **isTransitioning**: Set BEFORE any state changes, clear AFTER completion

**Critical Ordering** (P0T2):
```typescript
// CORRECT: Update ownership refs FIRST, before state changes
contentPromptIdRef.current = promptId
loadedRef.current = promptId
setPromptData(cached.promptData)  // Now state updates are safe

// WRONG: Don't update state before ownership refs
setPromptData(cached.promptData)  // Race condition!
contentPromptIdRef.current = promptId
```

### 3. Transition Lock Guard Pattern (P0T3)

```typescript
// Set lock BEFORE state changes
isTransitioning.current = true

// Do state updates...
setPromptData(data)
setTitle(data.title)
setContent(data.content)

// Release lock AFTER state updates complete (next tick)
setTimeout(() => {
  isTransitioning.current = false
}, 0)

// Guard cache updates with lock check
useEffect(() => {
  if (isTransitioning.current) {
    return  // Skip during transition
  }
  // Safe to update cache
}, [title, content, promptData])
```

### 4. Auto-Save with Transition Guards (P1T4)

```typescript
useAutoSave({
  title,
  content,
  // Disable during loading OR transition
  promptId: (loading || isTransitioning.current) ? null : promptId,
  delay: 500,
  onSave: handleAutoSave
})
```

**Auto-Save Rules**:
- ALWAYS disable during document transitions
- ALWAYS use promptIdRef to verify current document
- ALWAYS validate title before saving
- Use 500ms debounce (configurable via delay param)

### 5. Null Title Handling Pattern (P1T5)

```typescript
// Database allows null titles
title: string | null

// Use getDisplayTitle for UI display
import { getDisplayTitle } from '@/features/prompts/utils'

<Input
  value={title || ""}  // Convert null to empty string for input
  onChange={(e) => setTitle(e.target.value)}
/>

// Display in lists/tabs
<span>{getDisplayTitle(title)}</span>  // Shows "[Untitled Doc]" for null

// Validation before save
const titleResult = titleValidationSchema.safeParse(title)
if (!titleResult.success) {
  // Prompt user to set title
  setShowSetTitleDialog(true)
  return
}
```

## TypeScript Conventions

### Strict Type Safety
```typescript
// ALWAYS use strict mode
"strict": true

// NEVER use 'any' type
// BAD
function process(data: any) { }

// GOOD
function process(data: PromptWithFolder) { }
```

### Null vs Undefined
```typescript
// Use null for explicitly absent values (database nullable fields)
title: string | null

// Use undefined for optional parameters/properties
interface Options {
  delay?: number  // undefined if not provided
}

// NEVER use both in same context
// BAD: title: string | null | undefined
// GOOD: title: string | null
```

### Type Imports
```typescript
// Use type-only imports when appropriate
import type { PromptWithFolder } from '@/types/prompts'
import { getPromptDetails } from '@/features/prompts/actions'
```

## React Patterns

### useEffect Dependency Rules

**Stale Closure Prevention**:
```typescript
// Update ref synchronously when prop changes
useEffect(() => {
  promptIdRef.current = promptId
}, [promptId])

// Use ref in callbacks to get latest value
const handleAutoSave = useCallback(async () => {
  const currentPromptId = promptIdRef.current
  // Use currentPromptId, not promptId from closure
}, []) // Empty deps - uses ref for latest value
```

**Cache Update Dependencies**:
```typescript
useEffect(() => {
  // Skip during transition
  if (isTransitioning.current) return
  
  // Update cache
  documentCache.set(promptId, { ... })
}, [title, content, promptData, promptId, currentUserId])
// Include ALL values used in effect
```

### Client vs Server Components

```typescript
// Client components MUST have "use client" directive
"use client"

import { useState, useEffect } from 'react'

// Server components DON'T need directive (default)
// Can use async/await for data fetching
async function ServerComponent() {
  const data = await fetchData()
  return <div>{data}</div>
}
```

### Refs vs State

**Use Refs For**:
- Values that change but don't need re-render (promptIdRef)
- Preventing stale closures in callbacks (contentPromptIdRef)
- Synchronous tracking across effects (isTransitioning)
- Preventing duplicate operations (loadedRef)

**Use State For**:
- Values that trigger re-renders (title, content)
- UI display values (loading, error)
- User input (form fields)

## Naming Conventions

### Variables & Functions
```typescript
// camelCase for variables and functions
const documentCache = new Map()
function handleAutoSave() { }

// PascalCase for components and types
function EditorPane() { }
interface PromptWithFolder { }

// UPPER_SNAKE_CASE for constants
const MAX_TITLE_LENGTH = 200
const AUTO_SAVE_DELAY = 500
```

### Files & Directories
```typescript
// Components: PascalCase.tsx
EditorPane.tsx
SetTitleDialog.tsx

// Utilities: camelCase.ts
diff-utils.ts
getDisplayTitle.ts

// Actions/Schemas: descriptive.ts
actions.ts
schemas.ts

// Directories: kebab-case
features/prompts/
components/ui/
```

### Boolean Naming
```typescript
// Prefix with is/has/should
const isTransitioning = useRef(false)
const hasUnsavedChanges = content !== promptData.content
const shouldAutoSave = !loading && !isTransitioning.current

// NEVER use negative booleans
// BAD: const notReady = false
// GOOD: const isReady = true
```

## Comment Conventions

### Reason Comments
```typescript
// Reason: Explain WHY, not WHAT
// Reason: Check cache first for instant display
const cached = documentCache.get(promptId)

// Reason: Update ownership refs FIRST, before state changes (P0T2)
contentPromptIdRef.current = promptId
loadedRef.current = promptId
```

### Critical Sections
```typescript
// CRITICAL: Mark security or race-sensitive code
// CRITICAL: Set transition lock BEFORE any state changes (P0T3)
isTransitioning.current = true

// SECURITY: Validate cache entry belongs to current user (P5S4T2)
if (cached.userId !== currentUserId) {
  console.warn('[EditorPane] Cache entry for different user, clearing:', promptId)
  documentCache.delete(promptId)
}
```

### TODO Comments
```typescript
// TODO: Add keyboard shortcuts for tab navigation (P5S4cT8)
// FIXME: Handle edge case when folder deleted while document open
// OPTIMIZE: Consider using SWR for server state management
```

## Error Handling

### Server Actions
```typescript
export async function saveNewVersion(data: SaveNewVersionInput): Promise<ActionResult> {
  try {
    // Validation
    const parsed = saveNewVersionSchema.safeParse(data)
    if (!parsed.success) {
      return { success: false, error: "Validation failed" }
    }

    // Operation
    const result = await db.prompt.update({ ... })
    
    return { success: true, data: result }
  } catch (error) {
    // Re-throw NEXT_REDIRECT for Next.js navigation
    if (error instanceof Error && error.message === "NEXT_REDIRECT") {
      throw error
    }
    
    console.error('[saveNewVersion] Error:', error)
    return { success: false, error: "Failed to save version" }
  }
}
```

### Client Components
```typescript
async function handleSave() {
  setSaving(true)
  const result = await saveNewVersion({ ... })
  
  if (!result.success) {
    toast.error(result.error, { duration: 6000 })
    setSaving(false)
    return
  }
  
  toast.success("Saved successfully")
  setSaving(false)
}
```

## Development Environment Guards

```typescript
// Wrap debug logging with NODE_ENV check (P5S4T5)
if (process.env.NODE_ENV === 'development') {
  console.log('[EditorPane] Loading from cache:', promptId)
}

// Production warning logs (always visible)
console.warn('[EditorPane] Cache entry for different user')
console.error('[EditorPane] Auto-save FAILED:', error)
```

## File Size Limits

- **Max 500 lines per file** - Refactor when approaching limit
- **Max 50 lines per function** - Single, clear responsibility
- **Max 100 characters per line**
- **All text files end with newline** (mandatory)

## Import Organization

```typescript
// 1. React and external libraries
import { useEffect, useState, useCallback, useRef } from "react"
import { toast } from "sonner"

// 2. Internal stores and hooks
import { useUiStore } from "@/stores/use-ui-store"
import { useTabStore } from "@/stores/use-tab-store"

// 3. Actions and utilities
import { getPromptDetails } from "@/features/prompts/actions"
import { getDisplayTitle } from "@/features/prompts/utils"

// 4. Types
import type { PromptWithFolder } from "@/types/prompts"

// 5. UI components (last)
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
```
