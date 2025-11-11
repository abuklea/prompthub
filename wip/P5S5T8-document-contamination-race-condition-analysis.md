# PromptHub
## P5S5T8 - Document Content Cross-Contamination Race Condition Analysis

| `Title` | `Created` | `Last modified` |
|---------|-----------|-----------------|
| P5S5T8 - Document Content Cross-Contamination Race Condition Analysis | 09/11/2025 16:35 GMT+10 | 09/11/2025 16:35 GMT+10 |

## Table of Contents
- [Executive Summary](#executive-summary)
- [Bug Symptoms](#bug-symptoms)
- [Root Cause Analysis](#root-cause-analysis)
- [The Complete Race Sequence](#the-complete-race-sequence)
- [Code Evidence](#code-evidence)
- [Solution Design](#solution-design)
- [Implementation Plan](#implementation-plan)
- [Testing Strategy](#testing-strategy)

---

## Executive Summary

**Severity**: CRITICAL
**Impact**: Data integrity violation - documents showing wrong content
**Affected**: All document switching operations
**Status**: Root cause identified, solution designed

### The Problem

Users experience document content "bleeding" between documents:
1. Creating new documents shows content from previous documents
2. Switching tabs causes title changes to other documents' titles
3. Repeated tab switching results in all documents having identical content
4. Race condition during rapid document switching

### The Root Cause

**Three concurrent race conditions** in the document loading/caching system:

1. **useLocalStorage race**: Saves old content to new document's localStorage key during key transition
2. **EditorPane state race**: promptId changes before content state clears, saving stale data
3. **Cache contamination**: isTransitioning guard releases too early, allowing mixed state writes

---

## Bug Symptoms

### Symptom 1: New Document Shows Previous Content

**User Action**: Create new document while viewing Document A
**Expected**: New document empty or with "[Untitled Doc]" placeholder
**Actual**: New document displays Document A's content

### Symptom 2: Tab Switching Changes Titles

**User Action**: Click Document B tab while on Document A
**Expected**: Document B shows with its title "Document B"
**Actual**: Document B title changes to "Document A" in editor

### Symptom 3: All Documents Become Identical

**User Action**: Rapidly switch between Document A, B, C multiple times
**Expected**: Each document maintains its unique content
**Actual**: After 3-5 switches, all documents show the same content and title

### Symptom 4: VSCode-Like Snappy UX Missing

**User Action**: Switch between tabs
**Expected**: Instant switching like VSCode (cache should provide this)
**Actual**: Flashing content, delayed updates, wrong content briefly visible

---

## Root Cause Analysis

### Race Condition #1: useLocalStorage Save on Key Change

**Location**: `src/features/editor/hooks/useLocalStorage.ts:78-87`

**The Problem**:
```typescript
// Line 78-87
useEffect(() => {
  // Skip save if key just changed (we're loading, not saving)
  if (prevKeyRef.current !== key) {
    return  // ← Guard SHOULD prevent save
  }

  if (typeof window !== 'undefined') {
    localStorage.setItem(key, value)  // ← But STILL saves!
  }
}, [key, value])  // ← Depends on BOTH key and value
```

**The Race**:
1. Document A selected, key = `prompt-A`, value = "Content A"
2. User clicks Document B
3. Effect at line 67-74 runs: key changes to `prompt-B`
4. Line 70: `setValue(saved || initialValue)` - loads Document B content
5. **BUT**: value still = "Content A" in closure
6. Effect at line 78 triggers because **value dependency**
7. Line 80 guard: `prevKeyRef.current` is STILL `prompt-A` (updates at line 73)
8. Guard **FAILS** - thinks we're saving to same document
9. Line 85: `localStorage.setItem('prompt-B', 'Content A')` ← CONTAMINATION!

**The Timing**:
```
T0: key=A, value="Content A", prevKeyRef.current=A
T1: User clicks Doc B → key changes to B
T2: useEffect(key) triggers → loads "Content B" into value
T3: prevKeyRef.current still = A (updates AFTER value)
T4: useEffect(value) triggers with old "Content A"
T5: Guard check: prevKeyRef(A) !== key(B) → returns (CORRECT)
T6: BUT another render cycle...
T7: prevKeyRef.current = B (line 73 completed)
T8: value still = "Content A" in some React closure
T9: Guard check: prevKeyRef(B) === key(B) → continues
T10: Saves "Content A" to localStorage['prompt-B'] ← BUG!
```

---

### Race Condition #2: EditorPane State Not Cleared Before Load

**Location**: `src/features/editor/components/EditorPane.tsx:270-280`

**The Problem**:
```typescript
// Line 270-280
useEffect(() => {
  // CRITICAL: Skip save if promptId just changed (P0T1)
  if (promptId !== promptIdRef.current) {
    return  // ← Guard checks promptIdRef
  }

  if (content && promptId && contentPromptIdRef.current === promptId) {
    setLocalContent(content)  // ← Saves to localStorage
  }
}, [content, promptId, setLocalContent])
```

**The Race**:
1. Document A loaded: promptId=A, content="Content A", promptIdRef.current=A
2. User clicks Document B → promptId changes to B
3. **Effect at line 129 starts loading Document B**
4. Line 140: `if (loadedRef.current === promptId) return` - prevents duplicate load
5. But content state STILL = "Content A"
6. **Effect at line 271 triggers** because promptId changed
7. Line 273 guard: `promptId(B) !== promptIdRef.current(A)` → returns ✓ (CORRECT)
8. **But promptIdRef updates synchronously at line 227**:
```typescript
useEffect(() => {
  promptIdRef.current = promptId  // ← Updates IMMEDIATELY
}, [promptId])
```
9. Now promptIdRef.current = B
10. Content still = "Content A" in state (loads async at line 191-199)
11. **Next render cycle**: Effect at line 271 triggers again
12. Line 273 guard: `promptId(B) !== promptIdRef.current(B)` → FALSE, continues
13. Line 277: `contentPromptIdRef.current === promptId` → FALSE (still A)
14. Doesn't save... **YET**
15. Line 199: `contentPromptIdRef.current = promptId` → sets to B
16. **Another render**: content still "Content A", contentPromptIdRef now B
17. Line 278: `setLocalContent("Content A")` with key `prompt-B` ← BUG!

---

### Race Condition #3: Cache Updated During Transition

**Location**: `src/features/editor/components/EditorPane.tsx:282-318`

**The Problem**:
```typescript
// Line 282-318
useEffect(() => {
  // CRITICAL: Don't update cache during document transition (P0T3)
  if (isTransitioning.current) {
    return  // ← Guard prevents updates during transition
  }

  if (title && promptData && promptId) {
    // ... cache update code
    documentCache.set(promptId, {
      userId: currentUserId,
      promptData,
      title,
      content,  // ← OLD content from previous document!
      lastSaved
    })
  }
}, [title, content, promptData, promptId, ...])
```

**The Race**:
```typescript
// Document A → Document B transition

// Line 152: isTransitioning.current = true (START)
// Line 161-185: Cache hit path
if (cached) {
  contentPromptIdRef.current = promptId  // B
  loadedRef.current = promptId  // B
  setPromptData(cached.promptData)  // Document B data
  setTitle(cached.title)  // "Document B"
  setContent(cached.content)  // "Content B"

  // Line 186-188: Release lock on NEXT TICK
  setTimeout(() => {
    isTransitioning.current = false  // ← TOO EARLY!
  }, 0)
  return
}
```

**The Problem**:
- Lock released `setTimeout(..., 0)` = next tick
- But React state updates are async
- Effect at line 282 triggers BEFORE states settle
- Runs with **mixed state**: new promptId, old content/title
- Saves contaminated data to cache

**The Window**:
```
T0: isTransitioning = true
T1: setTitle("Document B") queued
T2: setContent("Content B") queued
T3: setTimeout(() => isTransitioning = false, 0) scheduled
T4: Effect returns
T5: Next tick: isTransitioning = false
T6: React flush: title="Document A", content="Content A" (old state!)
T7: Effect at 282 runs: isTransitioning=false, guard passes
T8: documentCache.set(B, {title: "A", content: "Content A"}) ← BUG!
T9: Another render: title="Document B", content="Content B" (new state)
T10: Effect at 282 runs again: updates cache correctly
T11: But TAB already got wrong data from T8!
```

---

## The Complete Race Sequence

### Scenario: User Creates New Document While Viewing Document A

**Initial State**:
- Current: Document A (id: `doc-A`)
- Content: "This is Document A content"
- localStorage[`prompt-doc-A`] = "This is Document A content"
- documentCache[`doc-A`] = {title: "Document A", content: "This is Document A content"}

**User Action**: Click "New Doc" button

**T0 (0ms)**: handleNewDoc in DocumentToolbar
```typescript
const result = await createPrompt({ folderId: selectedFolder })
// result.data.promptId = "doc-B"
```

**T1 (50ms)**: Open new tab
```typescript
openTab({
  type: 'document',
  title: "",  // Empty!
  promptId: "doc-B",
  isNewDocument: true
})
```

**T2 (51ms)**: EditorPane receives new promptId
```typescript
// Props change: promptId: "doc-A" → "doc-B"
// Current state: content = "This is Document A content"
```

**T3 (52ms)**: promptIdRef updates
```typescript
// Line 227-229
useEffect(() => {
  promptIdRef.current = "doc-B"  // ← Updates immediately
}, [promptId])
```

**T4 (53ms)**: useLocalStorage key changes
```typescript
// Line 114-117
const [localContent, setLocalContent, clearLocalContent] = useLocalStorage({
  key: promptId ? `prompt-${promptId}` : 'prompt-draft',
  // key changes: "prompt-doc-A" → "prompt-doc-B"
})
```

**T5 (54ms)**: useLocalStorage load effect
```typescript
// Line 67-74
useEffect(() => {
  const saved = localStorage.getItem("prompt-doc-B")  // null or ""
  setValue(saved || "")  // Sets to ""
  prevKeyRef.current = "prompt-doc-B"  // Updates AFTER
}, [key])
```

**T6 (55ms)**: But value still "This is Document A content" in some closure!

**T7 (56ms)**: useLocalStorage save effect triggers
```typescript
// Line 78-87
useEffect(() => {
  if (prevKeyRef.current !== "prompt-doc-B") return  // prevKeyRef IS "prompt-doc-B" now!
  localStorage.setItem("prompt-doc-B", "This is Document A content")  // ← BUG!
}, [key, value])
```

**T8 (57ms)**: EditorPane load effect
```typescript
// Line 129-224
useEffect(() => {
  async function loadPrompt() {
    if (loadedRef.current === "doc-B") return  // NOT loaded yet

    isTransitioning.current = true  // Lock

    const cached = documentCache.get("doc-B")  // null - new doc

    // Database load
    loadedRef.current = "doc-B"
    const result = await getPromptDetails({ promptId: "doc-B" })

    setPromptData(result.data)
    setTitle(result.data.title)  // "" or "[Untitled Doc]"

    // localStorage check!
    const storedContent = localContent || ''
    if (storedContent && storedContent !== result.data.content) {
      setContent(storedContent)  // ← Loads "This is Document A content"!
      toast.info("Restored unsaved changes from browser storage")
    }

    contentPromptIdRef.current = "doc-B"
    isTransitioning.current = false
  }
  loadPrompt()
}, [promptId, localContent])
```

**T9 (200ms)**: Document B now displays Document A's content!

**Result**: New document shows old content ❌

---

## Code Evidence

### File: useLocalStorage.ts

**Problem Area**: Lines 78-87
```typescript
// BROKEN: Saves on key changes due to race in ref updates
useEffect(() => {
  // Skip save if key just changed (we're loading, not saving)
  if (prevKeyRef.current !== key) {
    return
  }

  if (typeof window !== 'undefined') {
    localStorage.setItem(key, value)  // ← Executes with wrong timing
  }
}, [key, value])  // ← Both dependencies trigger effect
```

**Guard Ineffective Because**:
- prevKeyRef updates at line 73 AFTER value loads
- Effect triggers on value change with updated ref
- Guard thinks "same key, safe to save"
- But value is stale from previous document

---

### File: EditorPane.tsx

**Problem Area 1**: Lines 270-280 (localStorage save)
```typescript
useEffect(() => {
  // CRITICAL: Skip save if promptId just changed (P0T1)
  if (promptId !== promptIdRef.current) {
    return  // ← Guard ineffective - promptIdRef updates elsewhere
  }

  if (content && promptId && contentPromptIdRef.current === promptId) {
    setLocalContent(content)  // ← Saves stale content
  }
}, [content, promptId, setLocalContent])
```

**Problem Area 2**: Lines 282-318 (Cache update)
```typescript
useEffect(() => {
  // CRITICAL: Don't update cache during document transition (P0T3)
  if (isTransitioning.current) {
    return  // ← Released too early via setTimeout
  }

  if (title && promptData && promptId) {
    documentCache.set(promptId, {
      userId: currentUserId,
      promptData,
      title,  // ← Can be old title
      content,  // ← Can be old content
      lastSaved
    })
  }
}, [title, content, promptData, promptId, ...])
```

---

## Solution Design

### Solution 1: Fix useLocalStorage Save Race

**Approach**: Use a "just changed" flag instead of ref comparison

```typescript
export function useLocalStorage({ key, initialValue }: UseLocalStorageOptions) {
  const [value, setValue] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem(key)
      return saved || initialValue
    }
    return initialValue
  })

  // NEW: Track if we just loaded (don't save)
  const justLoadedRef = useRef(false)

  // Load on key change
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem(key)
      setValue(saved || initialValue)
      justLoadedRef.current = true  // Mark as just loaded
    }
  }, [key, initialValue])

  // Save on value change ONLY
  useEffect(() => {
    // Skip save if we just loaded
    if (justLoadedRef.current) {
      justLoadedRef.current = false
      return
    }

    if (typeof window !== 'undefined') {
      localStorage.setItem(key, value)
    }
  }, [value])  // ← ONLY value dependency!

  const clearStorage = () => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem(key)
    }
  }

  return [value, setValue, clearStorage] as const
}
```

**Why This Works**:
- `justLoadedRef` flag set when loading (not comparing)
- Save effect ONLY depends on `value`, not `key`
- When key changes → load effect sets flag
- Value changes from load → save effect sees flag, skips
- User edits value → flag already reset, saves correctly

---

### Solution 2: Clear EditorPane State Before Load

**Approach**: Reset ALL state FIRST, then load new document

```typescript
useEffect(() => {
  async function loadPrompt() {
    if (!promptId) {
      // Already clears state...
      setPromptData(null)
      setTitle(null)
      setContent("")
      setError("")
      loadedRef.current = null
      contentPromptIdRef.current = null
      isTransitioning.current = false
      return
    }

    // CRITICAL: Clear state BEFORE any checks!
    setPromptData(null)  // ← NEW: Clear immediately
    setTitle(null)       // ← NEW: Clear immediately
    setContent("")       // ← NEW: Clear immediately
    setError("")         // ← Keep existing

    // Prevent duplicate loads
    if (loadedRef.current === promptId) {
      return
    }

    // NOW set transition lock
    isTransitioning.current = true

    // ... rest of load logic
  }

  loadPrompt()
}, [promptId, localContent, currentUserId])
```

**Why This Works**:
- State cleared SYNCHRONOUSLY before async operations
- No window where old state exists with new promptId
- Guards in other effects see empty content, skip saves
- Loading spinners show briefly (correct UX)

---

### Solution 3: Extend isTransitioning Coverage

**Approach**: Don't release lock until states are confirmed updated

```typescript
// After cache hit:
if (cached) {
  // Validate cache
  if (cached.userId !== currentUserId) {
    console.warn('[EditorPane] Cache entry for different user')
    documentCache.delete(promptId)
  } else {
    // Set ownership refs
    contentPromptIdRef.current = promptId
    loadedRef.current = promptId

    // Set all state
    setPromptData(cached.promptData)
    setTitle(cached.title)
    setContent(cached.content)
    setLastSaved(cached.lastSaved)
    setLoading(false)
    setError("")

    // Release lock via useEffect that runs AFTER render
    // NOT setTimeout!
    return  // Let cleanup effect handle lock release
  }
}
```

**Add cleanup effect**:
```typescript
// AFTER all state updates settle, release lock
useEffect(() => {
  if (promptId && !loading) {
    // States have settled, safe to allow updates
    isTransitioning.current = false
  }
}, [promptId, loading])  // Runs after loading completes
```

**Why This Works**:
- Lock not released until loading=false
- loading changes AFTER all states settle
- Cache update guard works correctly
- No setTimeout uncertainty

---

### Solution 4: Add Content Ownership Validation

**Approach**: Double-check content belongs to promptId before saving

```typescript
// localStorage save effect
useEffect(() => {
  // Guard 1: promptId changed
  if (promptId !== promptIdRef.current) {
    return
  }

  // Guard 2: content ownership confirmed
  if (content && promptId && contentPromptIdRef.current === promptId) {
    // Guard 3: not transitioning
    if (!isTransitioning.current) {
      setLocalContent(content)
    }
  }
}, [content, promptId, setLocalContent])
```

**Cache update effect**:
```typescript
useEffect(() => {
  // Guard 1: not transitioning
  if (isTransitioning.current) {
    return
  }

  // Guard 2: content ownership
  if (contentPromptIdRef.current !== promptId) {
    return
  }

  if (title && promptData && promptId) {
    // Safe to update cache
    documentCache.set(promptId, {
      userId: currentUserId,
      promptData,
      title,
      content,
      lastSaved
    })
  }
}, [title, content, promptData, promptId, ...])
```

---

## Implementation Plan

### Phase 1: Critical Fixes (2 hours)

**Task 1**: Fix useLocalStorage (30 min)
- Implement `justLoadedRef` flag
- Remove key from save effect dependencies
- Test with rapid key changes

**Task 2**: Clear EditorPane State First (30 min)
- Add synchronous state clears at line 130
- Remove setTimeout for isTransitioning
- Add cleanup effect for lock release

**Task 3**: Add Content Ownership Guards (30 min)
- Add isTransitioning check to localStorage save
- Add contentPromptIdRef check to cache update
- Test guard effectiveness

**Task 4**: Testing (30 min)
- Test rapid document switching
- Test new document creation
- Verify no content bleeding

---

### Phase 2: VSCode-Like UX (1 hour)

**Task 5**: Optimize Cache Loading
- Ensure instant display from cache
- No flashing between documents
- Smooth transitions

**Task 6**: Tab Title Sync
- Verify tab titles update correctly
- No title mixing between documents

---

## Testing Strategy

### Test Case 1: New Document Creation

**Steps**:
1. Open Document A with content "Content A"
2. Click "New Doc"
3. Verify new document is empty or has placeholder
4. Type "Content B" into new document
5. Switch back to Document A
6. Verify Document A still shows "Content A"

**Expected**: No content contamination ✓

---

### Test Case 2: Rapid Tab Switching

**Steps**:
1. Create 3 documents: A, B, C with unique content
2. Rapidly click tabs: A → B → C → A → B → C (repeat 5x)
3. After each switch, verify correct content displays
4. Check all documents still have unique content

**Expected**: Content stays isolated ✓

---

### Test Case 3: Title Changes

**Steps**:
1. Open Document A with title "Document A"
2. Switch to Document B
3. Verify tab title shows "Document B"
4. Switch back to A
5. Verify tab title shows "Document A"

**Expected**: Titles don't cross-contaminate ✓

---

### Test Case 4: localStorage Isolation

**Steps**:
1. Open DevTools → Application → localStorage
2. Create Document A, type "Content A"
3. Verify localStorage[`prompt-doc-A`] = "Content A"
4. Create Document B
5. Verify localStorage[`prompt-doc-B`] = "" or missing
6. **NOT** = "Content A"

**Expected**: localStorage keys isolated ✓

---

### Test Case 5: Cache Isolation

**Steps**:
1. Open Document A (loads to cache)
2. Add console.log to cache update effect
3. Switch to Document B
4. Verify console shows:
   - Cache update for A with "Content A"
   - Cache update for B with correct B content
   - **NOT** Cache update for B with "Content A"

**Expected**: Cache entries isolated ✓

---

## Success Criteria

✅ New documents always start empty (no old content)
✅ Tab switching shows correct content instantly (cache works)
✅ Titles don't change when switching tabs
✅ Rapid switching doesn't cause contamination
✅ localStorage keys properly isolated
✅ documentCache entries properly isolated
✅ VSCode-like snappy UX achieved
✅ No race conditions detected in testing

---

**Status**: Ready for implementation
**Priority**: CRITICAL
**Estimated Time**: 3 hours
**Risk**: Low (guards protect against regression)

