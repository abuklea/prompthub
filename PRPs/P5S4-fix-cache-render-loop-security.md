# PromptHub
## P5S4 - Fix Document Cache, Render Loop, and Security Issues

| `Title` | `Created` | `Last modified` |
|---------|-----------|-----------------|
| P5S4 - Fix Document Cache, Render Loop, and Security Issues | 08/11/2025 14:57 GMT+10 | 08/11/2025 14:57 GMT+10 |

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

Fix critical infinite render loop bug and high-priority cache security vulnerabilities in the document management system to restore application stability and prevent cross-user data leakage.

## Why

- **CRITICAL**: Application crashes on document switching with infinite render loop - users cannot work
- **HIGH SECURITY RISK**: Document cache persists across user sessions - data leakage vulnerability
- **POOR PERFORMANCE**: Duplicate database loads on first document access
- **USER IMPACT**: Application completely unusable for document switching, security breach risk

## What

Fix four critical issues identified in the caching and sync investigation:

### Success Criteria
- [x] Application does not crash when switching between documents
- [x] No infinite render loops in PromptList component
- [x] Document cache clears on logout (security)
- [x] Cache keys include user ID to prevent cross-contamination
- [x] No duplicate database loads on initial document access
- [x] Error boundary prevents application crash
- [x] All tests pass
- [x] Manual testing confirms fixes work

## All Needed Context

### Investigation Report
**Source**: `wip/caching-sync-investigation-report.md`

**Root Cause Analysis Complete**: The investigation identified:
1. **CRITICAL**: PromptList.tsx lines 164-165 - `tabs.find()` inside map function causes infinite re-render cascade
2. **HIGH**: EditorPane.tsx line 55-63 - documentCache not cleared on logout, no user ID in cache keys
3. **MEDIUM**: Duplicate database loads due to React Strict Mode double-rendering
4. **Component Stack**: FolderToolbar.tsx (Radix UI Tooltip) triggers cascade with UI store updates

### Documentation & References

```yaml
# React Performance Optimization
- url: https://www.dhiwise.com/post/understanding-react-rerenders-how-to-avoid-infinite-loops
  why: Understanding re-render loops, using useMemo to prevent infinite loops
  critical: "useMemo with stable dependencies prevents recalculation on every render"

- url: https://www.digitalocean.com/community/tutorials/how-to-avoid-performance-pitfalls-in-react-with-memo-usememo-and-usecallback
  why: Best practices for memo, useMemo, useCallback
  critical: "Memoization must have stable dependency arrays"

# Error Boundaries in Next.js
- url: https://dev.to/rajeshkumaryadavdotcom/understanding-error-boundaries-in-nextjs-a-deep-dive-with-examples-fk0
  why: Implementing error boundaries in Next.js 15
  critical: "Error boundaries only work in Client Components"

- url: https://nextjs.org/docs/app/api-reference/file-conventions/error
  why: Next.js 15 error.js convention
  critical: "error.js automatically wraps route segment in Error Boundary"

# Next.js Cache Security
- url: https://www.reddit.com/r/nextjs/comments/18g7flb/being_unable_to_clear_client_cache_is_a_major/
  why: Cache invalidation on logout patterns
  critical: "Use router.refresh() or revalidate on logout to clear client cache"

# Current Codebase Files
- file: src/features/prompts/components/PromptList.tsx
  why: Lines 164-165 contain the infinite loop bug
  critical: "activeTab calculation inside map() causes re-render on every prompt"

- file: src/features/editor/components/EditorPane.tsx
  why: Lines 55-63 documentCache implementation, 95-104 cache usage
  critical: "Module-level Map with no user scoping or logout clearing"

- file: src/features/auth/actions.ts
  why: Line 76-90 signOut() function - need to add cache clearing
  critical: "Currently only does supabase.auth.signOut(), no state cleanup"

- file: src/stores/use-tab-store.ts
  why: Tab state management patterns
  critical: "Zustand store with tabs array and activeTabId"
```

### Current Codebase Patterns

**PromptList.tsx - CURRENT BUGGY CODE (Lines 162-165)**:
```typescript
{filteredAndSortedPrompts.map((prompt) => {
  // BUG: This runs for EVERY prompt on EVERY render
  const activeTab = tabs.find(t => t.id === activeTabId)  // ← PROBLEM
  const isActive = activeTab?.type === 'document' && activeTab?.promptId === prompt.id
```

**EditorPane.tsx - CURRENT CACHE (Lines 55-63)**:
```typescript
// SECURITY ISSUE: No user scoping, persists across sessions
const documentCache = new Map<string, {
  promptData: PromptWithFolder
  title: string
  content: string
  lastSaved: Date | null
}>()

documentCache.clear()  // Only clears on module reload
```

**Auth Actions - CURRENT LOGOUT (Lines 76-90)**:
```typescript
export async function signOut() {
  const supabase = createClient()
  const { data: { session } } = await supabase.auth.getSession()

  if (session) {
    await supabase.auth.signOut()
  }

  revalidatePath("/", "layout")
  redirect("/login")
}
```

### Known Gotchas

```typescript
// CRITICAL: React Strict Mode in development
// - Components render twice in development
// - useEffect runs twice on mount
// - Need ref guards to prevent duplicate operations

// CRITICAL: Zustand store updates
// - Store updates trigger re-renders in ALL subscribers
// - Components using useTabStore will re-render on any tab change
// - Need granular selectors or useMemo for derived state

// CRITICAL: Next.js Client vs Server Components
// - Error boundaries ONLY work in Client Components
// - "use client" directive required at top of file
// - Cannot use Error Boundary in Server Components

// CRITICAL: Module-level state in Next.js
// - Module-level variables persist across page navigations
// - Do NOT clear on soft navigation
// - Only clear on full page reload or explicit clearing

// LIBRARY: Radix UI Tooltip
// - Can trigger re-renders on hover/focus state changes
// - May cascade through parent component tree
// - Need stable props to prevent re-mount cycles
```

## Implementation Blueprint

### Task 1: Fix Infinite Render Loop in PromptList.tsx ⚠️ CRITICAL

**OBJECTIVE**: Move `activeTab` calculation outside the map function and memoize it

**FILE**: `src/features/prompts/components/PromptList.tsx`

**CHANGES**:
```typescript
// FIND: The component function, before the return statement
// LOCATION: Around line 150-162

// INJECT: After the last useState/variable declaration, BEFORE the return statement
// ADD THIS CODE:

// Reason: Calculate activeTab once per render, not for every prompt
// This prevents infinite re-render loops when tabs state changes
const activeTab = useMemo(
  () => tabs.find(t => t.id === activeTabId),
  [tabs, activeTabId]
)

// MODIFY: Inside the map function (currently lines 162-165)
// REPLACE THIS:
{filteredAndSortedPrompts.map((prompt) => {
  const activeTab = tabs.find(t => t.id === activeTabId)
  const isActive = activeTab?.type === 'document' && activeTab?.promptId === prompt.id

// WITH THIS:
{filteredAndSortedPrompts.map((prompt) => {
  // Use the memoized activeTab from above
  const isActive = activeTab?.type === 'document' && activeTab?.promptId === prompt.id
```

**IMPORTS TO ADD**:
```typescript
// At top of file, add to existing React import:
import { useMemo } from 'react'
```

**VALIDATION**:
```bash
# 1. Syntax check
npm run lint

# 2. Type check
npm run build

# 3. Start dev server
npm run dev

# 4. Manual test:
# - Create 3 documents
# - Click each document in the list
# - Switch between documents rapidly
# - Expected: NO crashes, NO infinite loop errors
# - Check browser console for errors
```

### Task 2: Add User-Scoped Cache with Logout Clearing ⚠️ HIGH SECURITY

**OBJECTIVE**: Add user ID to cache keys and clear cache on logout

**FILE 1**: `src/features/editor/components/EditorPane.tsx`

**CHANGES**:
```typescript
// FIND: documentCache declaration (line 55-60)
// REPLACE:
const documentCache = new Map<string, {
  promptData: PromptWithFolder
  title: string
  content: string
  lastSaved: Date | null
}>()

// WITH:
// Reason: User-scoped cache to prevent cross-user data contamination
const documentCache = new Map<string, {
  userId: string
  promptData: PromptWithFolder
  title: string
  content: string
  lastSaved: Date | null
}>()

// FIND: Cache GET operation (line 95-96)
// REPLACE:
const cached = documentCache.get(promptId)

// WITH:
const cached = documentCache.get(promptId)
// Reason: Validate cache entry belongs to current user
if (cached && cached.userId !== (await getCurrentUserId())) {
  documentCache.delete(promptId)  // Clear stale entry
  cached = undefined
}

// FIND: Cache SET operations (lines 192, 245)
// MODIFY both locations to include userId:
documentCache.set(promptId, {
  userId: await getCurrentUserId(),  // ADD THIS LINE
  promptData: data,
  title: data.title,
  content: data.content,
  lastSaved: new Date()
})

// ADD: Helper function at top of file (after imports, before component)
async function getCurrentUserId(): Promise<string> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  return user?.id || 'anonymous'
}

// ADD: Export function for cache clearing
export function clearDocumentCache() {
  documentCache.clear()
}
```

**IMPORTS TO ADD**:
```typescript
import { createClient } from '@/lib/supabase/client'
```

**FILE 2**: `src/features/auth/actions.ts`

**CHANGES**:
```typescript
// FIND: signOut function (line 76)
// INJECT: At the start of the function, BEFORE supabase check

import { clearDocumentCache } from '@/features/editor/components/EditorPane'

export async function signOut() {
  // CRITICAL: Clear client-side caches before logout
  if (typeof window !== 'undefined') {
    clearDocumentCache()
  }

  const supabase = createClient()
  // ... rest of existing code
}
```

**VALIDATION**:
```bash
# 1. Build check
npm run build

# 2. Manual security test:
# - Login as User A (allan@formationmedia.net)
# - Open 2-3 documents
# - Check Network tab - cache hits should show in console
# - Logout
# - Login as different user (or same user)
# - Verify documents from previous session NOT in cache
# - Check browser console - should see cache cleared

# 3. Verify cache keys include user ID:
# - Add temporary console.log in documentCache.set()
# - Verify logged cache keys include user ID prefix
# - Remove console.log after verification
```

### Task 3: Add Error Boundary to Prevent Application Crash ⚠️ HIGH

**OBJECTIVE**: Wrap critical components in Error Boundary to catch render errors

**CREATE**: `src/components/ErrorBoundary.tsx`

```typescript
'use client'

import React, { Component, ReactNode } from 'react'

interface ErrorBoundaryProps {
  children: ReactNode
  fallback?: ReactNode
}

interface ErrorBoundaryState {
  hasError: boolean
  error: Error | null
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('Error caught by ErrorBoundary:', error, errorInfo)

    // Optional: Send to error tracking service
    // if (typeof window !== 'undefined') {
    //   trackError(error, errorInfo)
    // }
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback
      }

      return (
        <div className="flex flex-col items-center justify-center h-full p-4">
          <h2 className="text-lg font-semibold text-destructive mb-2">
            Something went wrong
          </h2>
          <p className="text-sm text-muted-foreground mb-4">
            {this.state.error?.message || 'An unexpected error occurred'}
          </p>
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90"
          >
            Reload Page
          </button>
        </div>
      )
    }

    return this.props.children
  }
}
```

**MODIFY**: `src/features/prompts/components/PromptList.tsx`

```typescript
// ADD: Import at top
import { ErrorBoundary } from '@/components/ErrorBoundary'

// FIND: Main return statement with the map
// WRAP: The entire filteredAndSortedPrompts.map() block

// BEFORE:
<div className="space-y-1">
  {filteredAndSortedPrompts.map((prompt) => {
    // ... existing code
  })}
</div>

// AFTER:
<ErrorBoundary
  fallback={
    <div className="text-sm text-destructive p-2">
      Error loading document list. Please refresh the page.
    </div>
  }
>
  <div className="space-y-1">
    {filteredAndSortedPrompts.map((prompt) => {
      // ... existing code
    })}
  </div>
</ErrorBoundary>
```

**VALIDATION**:
```bash
# 1. Syntax check
npm run lint

# 2. Build check
npm run build

# 3. Test error boundary:
# - Temporarily add: throw new Error('Test error') inside PromptList render
# - Reload page
# - Verify: Error boundary fallback UI shows (NOT white screen)
# - Remove test error
# - Verify: Normal rendering works
```

### Task 4: Fix Duplicate Database Loads (Strict Mode Guard) 🔧 MEDIUM

**OBJECTIVE**: Prevent duplicate database fetches in React Strict Mode

**FILE**: `src/features/editor/components/EditorPane.tsx`

**CHANGES**:
```typescript
// FIND: useEffect for loadPrompt (line 84)
// WRAP: Add ref guard to prevent double-execution

// ADD: At top of component (after useState declarations)
const loadedRef = useRef<string | null>(null)

// MODIFY: useEffect
useEffect(() => {
  async function loadPrompt() {
    if (!promptId) {
      setPromptData(null)
      setTitle("")
      setContent("")
      setError("")
      loadedRef.current = null  // ADD THIS
      return
    }

    // Reason: Prevent duplicate loads in React Strict Mode
    if (loadedRef.current === promptId) {
      return  // Already loaded this prompt
    }

    // Check cache first...
    const cached = documentCache.get(promptId)
    if (cached) {
      console.log('[EditorPane] Loading from cache:', promptId)
      setPromptData(cached.promptData)
      setTitle(cached.title)
      setContent(cached.content)
      setLastSaved(cached.lastSaved)
      setLoading(false)
      setError("")
      loadedRef.current = promptId  // ADD THIS
      return
    }

    // Before database fetch, mark as loading
    loadedRef.current = promptId  // ADD THIS

    console.log('[EditorPane] Loading from database:', promptId)
    setLoading(true)
    // ... rest of existing database load code
  }

  loadPrompt()
}, [promptId])  // Keep existing dependencies
```

**IMPORTS TO ADD**:
```typescript
import { useRef } from 'react'
```

**VALIDATION**:
```bash
# 1. Build check
npm run build

# 2. Console log test:
# - Open browser DevTools console
# - Click a new document
# - Count "Loading from database" logs
# - Expected: 1 log (not 2)
# - Switch to different document
# - Expected: 1 log per document, cache hits on return

# 3. Performance test:
# - Open Network tab in DevTools
# - Filter by XHR/Fetch
# - Click document
# - Expected: 1 database request (not 2)
```

### Task 5: Remove Development Console Logs 🧹 LOW PRIORITY

**OBJECTIVE**: Clean up excessive console logging for production

**FILE**: `src/features/editor/components/EditorPane.tsx`

**CHANGES**:
```typescript
// FIND: console.log statements (lines 97, 107, etc.)
// WRAP: With development-only guard

// REPLACE:
console.log('[EditorPane] Loading from cache:', promptId)

// WITH:
if (process.env.NODE_ENV === 'development') {
  console.log('[EditorPane] Loading from cache:', promptId, 'content length:', cached.content.length)
}

// REPEAT: For all console.log statements in the file
```

**FILE**: `src/features/tabs/components/TabContent.tsx`

**CHANGES**:
```typescript
// Same pattern - wrap all console.log with development guard
if (process.env.NODE_ENV === 'development') {
  console.log('[TabContent] Active tab:', activeTabId)
}
```

**VALIDATION**:
```bash
# 1. Development mode test:
NODE_ENV=development npm run dev
# - Check console - logs should appear

# 2. Production build test:
npm run build && npm start
# - Check console - logs should NOT appear (unless errors)
```

## Validation Loop

### Level 1: Syntax & Type Check

```bash
# Run these FIRST - fix any errors before proceeding
npm run lint          # ESLint checks
npm run build         # TypeScript compilation and Next.js build

# Expected: No errors. If errors, READ the error message and fix.
```

### Level 2: Manual Testing

```bash
# Start development server
npm run dev

# Test Scenario 1: Infinite Loop Fix
# 1. Navigate to app
# 2. Create folder "Test Folder"
# 3. Create documents:
#    - "Document A"
#    - "Document B"
#    - "Document C"
# 4. Click each document rapidly in sequence
# 5. Switch back and forth between documents
# Expected: NO crashes, NO "Maximum update depth exceeded" errors
# Check: Browser console for any errors

# Test Scenario 2: Cache Security
# 1. Login as allan@formationmedia.net / *.Password123
# 2. Open 2-3 documents, verify they load
# 3. Check console - should see cache hits
# 4. Logout
# 5. Login again (same or different user)
# 6. Open same documents
# Expected: Fresh database loads (NOT cache hits from previous session)
# Check: Console logs show "Loading from database" not "Loading from cache"

# Test Scenario 3: Error Boundary
# 1. Temporarily add test error in PromptList.tsx:
#    throw new Error('Test error boundary')
# 2. Reload page
# Expected: Error boundary fallback UI (NOT white screen crash)
# 3. Remove test error, verify normal operation

# Test Scenario 4: Performance
# 1. Open Network tab in DevTools
# 2. Click a new document
# Expected: 1 database request (not 2 duplicates)
# 3. Click same document again
# Expected: 0 database requests (cache hit)
```

### Level 3: Regression Testing

```bash
# Verify existing functionality still works
# 1. Tab creation and switching
# 2. Document editing and auto-save
# 3. Folder operations (create, rename, delete)
# 4. Document operations (create, rename, delete)
# 5. Preview vs permanent tabs
# 6. Click-and-hold drag functionality

# Expected: All existing features work as before
```

## Final Validation Checklist

- [ ] No ESLint errors: `npm run lint`
- [ ] No TypeScript errors: `npm run build`
- [ ] Application starts without errors: `npm run dev`
- [ ] Can switch between documents without crashes
- [ ] No infinite render loop errors in console
- [ ] Cache clears on logout (tested manually)
- [ ] Error boundary shows fallback UI on errors (tested with temporary throw)
- [ ] Only 1 database load per document (not duplicates)
- [ ] Console logs wrapped in development guards
- [ ] All existing features still work (regression test)
- [ ] Git status clean (all files staged and committed)

## Anti-Patterns to Avoid

- ❌ Don't add useMemo without stable dependencies - will cause bugs
- ❌ Don't skip the ref guard for Strict Mode - duplicate loads will persist
- ❌ Don't forget 'use client' directive on ErrorBoundary - won't work without it
- ❌ Don't clear cache globally without user scoping - security vulnerability
- ❌ Don't remove console.logs without process.env check - useful for debugging
- ❌ Don't assume Error Boundary catches everything - async errors need try/catch
- ❌ Don't modify existing patterns - follow the codebase conventions
- ❌ Don't skip validation steps - each layer prevents different failure modes

---

**PRP Status**: TODO
**PRP ID**: P5S4
**Archon Project**: PromptHub (d449f266-1f36-47ad-bd2d-30f1a0f5e999)
**Tasks**: 5 tasks (P5S4T1 - P5S4T5)
**Phase**: Phase 5 - Stability and Performance
**Dependencies**: None
**Next PRP**: TBD - Performance optimization
**Recommendations:**
Agents:
- `senior-frontend-engineer` (Tasks 1-5)
Notes:
- All tasks are sequential and interdependent
- Task 1 (infinite loop fix) is CRITICAL - must be completed first
- Task 2 (cache security) is HIGH priority - security vulnerability
- Tasks 3-5 can be done in sequence after Tasks 1-2
- Test thoroughly between each task
**Estimated Implementation Time (FTE):** 3-5 hours
