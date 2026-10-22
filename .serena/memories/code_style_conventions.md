# PromptHub - Code Style Conventions

## Critical Architectural Patterns (P5S4)

### 1. Document Cache Pattern (src/features/editor/document-cache.ts)

The cache is a module-level map in `document-cache.ts`; neither the hook nor `EditorPane.tsx` owns it.

**API**: `getCachedDocument(userId, promptId)`, `setDocumentCacheEntry(userId, promptId, entry)`,
`updateDocumentCacheEntry(userId, promptId, patch)`, `clearDocumentCache()` and the `ANONYMOUS` identity. An entry holds
`userId`, `promptData`, `title`, `content`, `lastSaved` and `synced` (the baseline the server is known to hold).

**Security Rules**:
- ALWAYS read through `getCachedDocument`: it drops and never returns an entry written for another user
- NEVER cache for `ANONYMOUS` (a failed or timed-out user lookup): `setDocumentCacheEntry` and
  `updateDocumentCacheEntry` ignore it, and nothing is served to it
- ALWAYS clear the cache on logout: `Header.tsx` calls `clearDocumentCache()`
- NEVER trust cached data without the userId check

### 2. Document Loading: the `ready` Token Protocol

`useDocumentLoader` (`src/features/editor/hooks/useDocumentLoader.ts`) loads the open document; the protocol is in
`loader-protocol.ts` (`runLoad`, `fetchDocument`, `commit`) and the reducer in `loader-state.ts`.

**Rules**:
1. **Identity gate**: the load waits for the user id. A rejected lookup, or none within `IDENTITY_TIMEOUT_MS`, settles
   as `ANONYMOUS`.
2. **One action**: the document and its sync baseline (`synced`) arrive in ONE reducer action (`apply`), so there is no
   render with new content and an old baseline.
3. **`ready`**: true only in renders whose `title`, `content` and `promptData` belong to `promptId`. Gate every
   consumer on it (the editor mount, auto-save, the cache write, the draft write). It replaces the ownership
   flags (`contentPromptIdRef`, `titlePromptIdRef`, `loadedRef`) and the transition effect (`isTransitioning`), which
   no longer exist.
4. **Abort**: each run has an `AbortSignal`; a superseded run (new document or identity, unmount) changes nothing
   after its fetch.
5. **Completions**: a finished save or restore goes through `markSynced` / `applyServerState`. They update the cache
   entry first, and change React state only when the completed document is the open one.
6. **Refs that remain**: `promptIdRef` (the open document, null after unmount; read in handlers only) and
   `monacoPromptIdRef` (the Monaco onChange guard).

```typescript
const { title, content, promptData, ready, synced, markSynced } = useDocumentLoader({ promptId, io })

// CORRECT: gate on ready; the fields belong to promptId in this render
useEffect(() => {
  if (!ready || !synced) return
  setDocumentCacheEntry(currentUserId, promptId, { promptData, title, content, lastSaved, synced })
}, [ready, synced, title, content, promptData])

// WRONG: reading title/content without ready can pair them with another document's promptId
```

### 3. Reading the Editor State

`EditorPane.tsx` renders from `viewState` and `saveStatus` (`src/features/editor/sync.ts`), not from ad hoc
`loading`/`error` combinations.

### 4. Auto-Save

```typescript
useAutoSave({
  title,
  content,
  // Disabled until the content belongs to promptId, and while a manual save or a restore runs
  promptId: ready && !busy ? promptId : null,
  // A write is due only while the working copy differs from what the server holds
  baseline: synced,
  onSave: handleAutoSave // read through a ref; (promptId, title, content) are those at the time the timer fired
})
```

**Auto-Save Rules** (`useAutoSave.ts`, armed by `useServerAutoSave.ts`):
- ALWAYS disable it until `ready` (a null `promptId` cancels a pending write)
- ALWAYS pass the baseline: nothing is written on mount or for an edit reverted to the baseline
- A blank or null title is never autosaved
- The write completes through `markSynced` with the document it started with, never the one open now
- 500ms debounce (`AUTOSAVE_DELAY_MS`, configurable via the `delay` option)

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
  // Skip until the content belongs to promptId
  if (!ready || !synced) return

  // Update cache
  setDocumentCacheEntry(currentUserId, promptId, { ... })
}, [title, content, promptData, promptId, currentUserId, ready, synced])
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
- Guards read inside handlers and callbacks (promptIdRef, monacoPromptIdRef)

Never use a ref to say which document the state belongs to: that is the `ready` token.

**Use State For**:
- Values that trigger re-renders (title, content)
- UI display values (loading, error)
- User input (form fields)

## Naming Conventions

### Variables & Functions
```typescript
// camelCase for variables and functions
const autoSaveDelay = 500
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

// Utilities: camelCase.ts or kebab-case.ts
document-cache.ts
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
const hasUnsavedChanges = content !== promptData.content
const shouldAutoSave = ready

// NEVER use negative booleans
// BAD: const notReady = false
// GOOD: const isReady = true
```

## Comment Conventions

### Reason Comments
```typescript
// Reason: Explain WHY, not WHAT
// Reason: Check cache first for instant display
const cached = getCachedDocument(userId, promptId)

// Reason: the document and its baseline are applied in one action, so `ready` is never true for half a document
commit(ctx, { promptData, title, content, lastSaved, synced })
```

### Critical Sections
```typescript
// CRITICAL: Mark security or race-sensitive code

// SECURITY: a cache entry is served only to the user it was written for (P5S4T2);
// getCachedDocument drops an entry whose userId differs
const cached = getCachedDocument(userId, promptId)
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

- **Code-size bands, not a hard cap** - see `docs/rules/code-size.md`; gate: `scripts/audit-code-size.sh`
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
