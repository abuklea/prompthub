# PromptHub
## P5S4 - Fix Document Cache, Render Loop, and Security Issues - INITIAL REPORT

| `Title` | `Created` | `Last modified` |
|---------|-----------|-----------------|
| P5S4 - Fix Document Cache, Render Loop, and Security Issues - INITIAL REPORT | 08/11/2025 15:07 GMT+10 | 08/11/2025 15:07 GMT+10 |

## Table of Contents
- [Executive Summary](#executive-summary)
- [Task Breakdown](#task-breakdown)
- [Implementation Sequence](#implementation-sequence)
- [Risk Assessment](#risk-assessment)
- [Success Criteria](#success-criteria)

## Executive Summary

This PRP addresses **CRITICAL** infinite render loop crashes and **HIGH SECURITY** cache vulnerabilities in the document management system. The application is currently unusable for document switching, and there's a severe data leakage risk from cross-session cache persistence.

**Scope**: 5 tasks, sequential execution required
**Estimated Time**: 3-5 hours
**Priority**: CRITICAL - Application stability and security

### Root Causes Identified
1. **Infinite Loop**: PromptList.tsx calculates `activeTab` inside map function on every render
2. **Security**: documentCache lacks user scoping and persists across logout
3. **Performance**: Duplicate database loads due to React Strict Mode
4. **Resilience**: No error boundary to prevent application crashes

### Plan Modifications from PRP

**Task 2 - Cache Validation Fix**:
- Original plan had const reassignment bug
- **Solution**: Restructure to use early return pattern and cache user ID at mount

**Task 3 - Error Boundary Scope**:
- Original wrapped only the map function
- **Solution**: Wrap entire PromptList component for comprehensive error catching

**Task 4 - User ID Caching**:
- Added user ID caching at component mount to avoid repeated async calls
- Prevents async overhead in cache validation

## Task Breakdown

### P5S4T1: Fix Infinite Render Loop in PromptList.tsx ⚠️ CRITICAL

**Objective**: Move `activeTab` calculation outside map function using useMemo

**Current Bug** (Lines 162-165):
```typescript
{filteredAndSortedPrompts.map((prompt) => {
  const activeTab = tabs.find(t => t.id === activeTabId)  // ← Runs for EVERY prompt
  const isActive = activeTab?.type === 'document' && activeTab?.promptId === prompt.id
```

**Solution**:
```typescript
// Before return statement, add:
const activeTab = useMemo(
  () => tabs.find(t => t.id === activeTabId),
  [tabs, activeTabId]
)

// In map function:
{filteredAndSortedPrompts.map((prompt) => {
  const isActive = activeTab?.type === 'document' && activeTab?.promptId === prompt.id
```

**Files Modified**: `src/features/prompts/components/PromptList.tsx`

**Validation**:
- Build check: `npm run build`
- Manual test: Rapidly switch between 3+ documents
- Expected: No crashes, no "Maximum update depth exceeded"

**Dependencies**: None

---

### P5S4T2: Add User-Scoped Cache with Logout Clearing ⚠️ HIGH SECURITY

**Objective**: Add user ID to cache keys, clear cache on logout, validate cache entries

**Security Issues**:
1. No user scoping in cache keys
2. Cache persists across sessions
3. Cache never validates ownership

**Solution Part 1 - EditorPane.tsx**:

Add user ID state and caching:
```typescript
const [currentUserId, setCurrentUserId] = useState<string>('')

// On mount, fetch and cache user ID
useEffect(() => {
  async function loadUserId() {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    setCurrentUserId(user?.id || 'anonymous')
  }
  loadUserId()
}, [])
```

Update cache structure:
```typescript
const documentCache = new Map<string, {
  userId: string  // ADD THIS
  promptData: PromptWithFolder
  title: string
  content: string
  lastSaved: Date | null
}>()
```

Cache validation (restructured to fix const bug):
```typescript
const cached = documentCache.get(promptId)
if (cached) {
  // Validate user ID - early return if mismatch
  if (cached.userId !== currentUserId) {
    console.warn('[EditorPane] Cache entry for different user, clearing')
    documentCache.delete(promptId)
    // Continue to database load below
  } else {
    // Valid cache hit
    console.log('[EditorPane] Loading from cache:', promptId)
    setPromptData(cached.promptData)
    setTitle(cached.title)
    setContent(cached.content)
    setLastSaved(cached.lastSaved)
    setLoading(false)
    setError("")
    return
  }
}
```

Update cache SET operations:
```typescript
documentCache.set(promptId, {
  userId: currentUserId,  // ADD THIS
  promptData: data,
  title: data.title,
  content: data.content,
  lastSaved: new Date()
})
```

Export cache clearing function:
```typescript
export function clearDocumentCache() {
  documentCache.clear()
  console.log('[EditorPane] Document cache cleared')
}
```

**Solution Part 2 - Auth Actions**:

Update signOut in `src/features/auth/actions.ts`:
```typescript
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

**Files Modified**:
- `src/features/editor/components/EditorPane.tsx`
- `src/features/auth/actions.ts`

**Imports to Add**:
```typescript
// EditorPane.tsx
import { createClient } from '@/lib/supabase/client'

// actions.ts
import { clearDocumentCache } from '@/features/editor/components/EditorPane'
```

**Validation**:
- Build check: `npm run build`
- Security test: Login as User A, open docs, logout, login as User B, verify cache cleared
- User ID test: Add temporary console.log to verify userId in cache entries

**Dependencies**: None

---

### P5S4T3: Add Error Boundary to PromptList Component ⚠️ HIGH

**Objective**: Wrap entire PromptList component in Error Boundary to prevent application crashes

**Create**: `src/components/ErrorBoundary.tsx`

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

**Modify**: `src/features/prompts/components/PromptList.tsx`

Wrap the ENTIRE component return in ErrorBoundary:
```typescript
import { ErrorBoundary } from '@/components/ErrorBoundary'

export function PromptList() {
  // ... all existing code ...

  return (
    <ErrorBoundary
      fallback={
        <div className="text-sm text-destructive p-2">
          Error loading document list. Please refresh the page.
        </div>
      }
    >
      {/* ALL EXISTING RETURN JSX HERE */}
    </ErrorBoundary>
  )
}
```

**Files Created**: `src/components/ErrorBoundary.tsx`
**Files Modified**: `src/features/prompts/components/PromptList.tsx`

**Validation**:
- Build check: `npm run build`
- Error test: Add `throw new Error('Test')` inside PromptList, verify fallback UI
- Remove test error, verify normal operation

**Dependencies**: None

---

### P5S4T4: Fix Duplicate Database Loads (Strict Mode Guard) 🔧 MEDIUM

**Objective**: Prevent duplicate database fetches in React Strict Mode using ref guard

**Current Issue**: React Strict Mode causes useEffect to run twice, resulting in 2 database loads

**Solution**:

Add ref guard to EditorPane.tsx:
```typescript
import { useRef } from 'react'

// At top of component
const loadedRef = useRef<string | null>(null)

// In loadPrompt useEffect
useEffect(() => {
  async function loadPrompt() {
    if (!promptId) {
      setPromptData(null)
      setTitle("")
      setContent("")
      setError("")
      loadedRef.current = null  // Reset ref
      return
    }

    // GUARD: Prevent duplicate loads in Strict Mode
    if (loadedRef.current === promptId) {
      return  // Already loaded this prompt
    }

    // Check cache first...
    const cached = documentCache.get(promptId)
    if (cached && cached.userId === currentUserId) {
      console.log('[EditorPane] Loading from cache:', promptId)
      setPromptData(cached.promptData)
      setTitle(cached.title)
      setContent(cached.content)
      setLastSaved(cached.lastSaved)
      setLoading(false)
      setError("")
      loadedRef.current = promptId  // Mark as loaded
      return
    }

    // Before database fetch
    loadedRef.current = promptId  // Mark as loading

    console.log('[EditorPane] Loading from database:', promptId)
    setLoading(true)
    // ... rest of database load code
  }

  loadPrompt()
}, [promptId, currentUserId])
```

**Files Modified**: `src/features/editor/components/EditorPane.tsx`

**Validation**:
- Console test: Count "Loading from database" logs, expect 1 per document (not 2)
- Network tab: Verify 1 request per document switch

**Dependencies**: Task 2 (uses currentUserId)

---

### P5S4T5: Remove Development Console Logs 🧹 LOW PRIORITY

**Objective**: Wrap console.log statements with development-only guards

**Solution**:

Wrap all console.log in EditorPane.tsx:
```typescript
if (process.env.NODE_ENV === 'development') {
  console.log('[EditorPane] Loading from cache:', promptId, 'content length:', cached.content.length)
}
```

Apply to TabContent.tsx as well:
```typescript
if (process.env.NODE_ENV === 'development') {
  console.log('[TabContent] Active tab:', activeTabId)
}
```

**Files Modified**:
- `src/features/editor/components/EditorPane.tsx`
- `src/features/tabs/components/TabContent.tsx`

**Validation**:
- Development: Logs should appear
- Production build: `npm run build && npm start`, logs should NOT appear

**Dependencies**: None (can run in parallel)

---

## Implementation Sequence

### Phase 1: Critical Fixes (Sequential)
1. **P5S4T1** - Fix infinite render loop ⚠️ MUST BE FIRST
2. **P5S4T2** - Fix cache security ⚠️ MUST BE SECOND
3. **P5S4T3** - Add error boundary (can run after T1/T2)

### Phase 2: Performance & Polish (Parallel)
4. **P5S4T4** - Fix duplicate loads (depends on T2)
5. **P5S4T5** - Clean console logs (independent)

**Rationale**:
- T1 fixes app crashes - MUST be first
- T2 fixes security - MUST be second
- T3 prevents future crashes
- T4 & T5 are optimizations

## Risk Assessment

### High Risk Areas
1. **Error Boundary**: Must test thoroughly - could mask real errors
2. **Cache Validation**: Must not break existing cache hits
3. **Ref Guard**: Could prevent legitimate re-loads if logic is wrong

### Mitigation Strategies
1. Test error boundary with actual errors before deploying
2. Add extensive logging during cache validation testing
3. Test ref guard with rapid document switching

### Rollback Plan
1. Git commit after each task completion
2. If issues arise, revert specific commit
3. Error boundary can be removed without breaking existing code

## Success Criteria

### Functional Requirements
- [ ] Application does not crash when switching documents
- [ ] No infinite render loops in console
- [ ] Cache clears on logout
- [ ] Cache entries have user ID validation
- [ ] Only 1 database load per document (not duplicates)
- [ ] Error boundary shows fallback on errors

### Technical Requirements
- [ ] No ESLint errors: `npm run lint`
- [ ] No TypeScript errors: `npm run build`
- [ ] Application starts: `npm run dev`
- [ ] All console logs wrapped in dev guards

### Security Requirements
- [ ] Cache cleared on logout (manual test)
- [ ] Cache entries validated for user ID
- [ ] No cross-user data contamination

### Regression Requirements
- [ ] Tab switching still works
- [ ] Document editing still works
- [ ] Auto-save still works
- [ ] Folder operations still work

---

**Plan Status**: READY
**PRP Status**: TODO
**PRP ID**: P5S4
**Archon Project**: PromptHub (d449f266-1f36-47ad-bd2d-30f1a0f5e999)
**PRP Document**: PRPs/P5S4-fix-cache-render-loop-security.md
**Tasks**: 5 tasks (P5S4T1 - P5S4T5)
**Phase**: Phase 5 - Stability and Performance
**Dependencies**: None
**Implementation Status**: NOT YET STARTED (P5S4)
**Testing Status**: NOT YET TESTED
**Next PRP**: TBD - Performance optimization
**Recommendations:**
Agents:
- `senior-frontend-engineer` (Tasks 1-5)
Notes:
- Tasks 1-3 MUST be sequential (critical path)
- Tasks 4-5 can run in parallel after T2
- Test thoroughly between each critical task
- Validate security manually with multi-user test
**Estimated Implementation Time (FTE):** 3-5 hours
