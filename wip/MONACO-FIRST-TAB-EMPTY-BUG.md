# PromptHub
## Monaco Editor First Tab Empty Content Bug

| `Title` | `Created` | `Last modified` |
|---------|-----------|-----------------|
| Monaco Editor First Tab Empty Content Bug | 11/11/2025 21:45 GMT+10 | 11/11/2025 21:45 GMT+10 |

## Table of Contents
- [Bug Description](#bug-description)
- [Root Cause Analysis](#root-cause-analysis)
- [Evidence](#evidence)
- [Proposed Fix](#proposed-fix)
- [Testing Strategy](#testing-strategy)

## Bug Description

### Symptoms

When opening the **first tab from zero tabs open**:
1. ✅ Title input shows correct content
2. ❌ Monaco editor displays **empty** content
3. ❌ Content only appears after:
   - Opening a second tab
   - Returning to the first tab
4. ✅ After that, first tab displays correctly

### User Impact

- Confusing UX - users think document is empty
- Forces workaround of opening second tab
- Only affects first tab opened in session

### Frequency

**100% reproducible** - happens every time for first tab from zero tabs.

## Root Cause Analysis

### The Monaco Initialization Race Condition

The bug occurs due to a timing issue between:
1. Monaco Editor file loading (first time only)
2. React component rendering with value prop
3. The key={promptId} forcing remount

### Detailed Sequence

#### First Tab (Zero → One Tab)

```
1. User clicks document A
2. TabContent renders EditorPane (lazy loaded)
3. EditorPane mounts with promptId="A"
4. loadPrompt() runs:
   - setLoading(true)
   - Fetches from database
   - setContent("A")
   - setLoading(false)
5. Component re-renders with content="A"
6. Editor component renders:
   - key="A" (first time)
   - value="A"
7. Monaco starts loading files:
   - /monaco-editor/vs/loader.js
   - /monaco-editor/vs/editor/editor.main.js
   - ... many more files
8. While loading: Monaco shows EMPTY
9. Files finish loading
10. Monaco initializes
11. But value="A" not applied! (BUG)
```

#### Second Tab (One → Two Tabs)

```
1. User clicks document B
2. EditorPane props change to promptId="B"
3. loadPrompt() runs with new ID
4. Editor component REMOUNTS:
   - key changes "A" → "B"
   - Old Editor unmounts
   - New Editor mounts with value="B"
5. Monaco files ALREADY CACHED
6. Monaco initializes quickly
7. value="B" applied correctly ✅
```

#### Back to First Tab (Returning)

```
1. User clicks document A again
2. EditorPane props change to promptId="A"
3. loadPrompt() hits CACHE (instant)
4. Editor component REMOUNTS:
   - key changes "B" → "A"
   - Old Editor unmounts
   - New Editor mounts with value="A"
5. Monaco files ALREADY CACHED
6. Monaco initializes quickly
7. value="A" applied correctly ✅
```

### Why The Bug Occurs

The issue is a **race condition** between Monaco file loading and value prop application:

**First Tab:**
- Monaco loading: SLOW (files not cached, ~500ms-2s)
- Value prop set: FAST (immediately on mount)
- Result: Value set BEFORE Monaco ready → NOT APPLIED

**Subsequent Tabs:**
- Monaco loading: FAST (files cached, <50ms)
- Value prop set: FAST (immediately on mount)
- Result: Monaco ready when value set → APPLIED CORRECTLY

### The key={promptId} Factor

The `key={promptId}` on line 550 of EditorPane.tsx forces Editor to remount on document change:

```typescript
<Editor
  key={promptId}  // ← Forces remount when changing documents
  value={content}
  onChange={...}
/>
```

**Purpose:** Prevents state contamination (P5S5 fixes)
**Side Effect:** On first mount, Monaco might not be ready for value prop

### Why Title Works But Editor Doesn't

```typescript
// Title input - native HTML, always works
<Input
  id="prompt-title"
  value={title || ""}
  onChange={(e) => setTitle(e.target.value)}
/>

// Monaco Editor - requires async initialization
<Editor
  key={promptId}
  value={content}  // ← Not applied if Monaco not ready!
  onChange={...}
/>
```

Native HTML inputs update immediately.
Monaco Editor requires initialization before accepting value prop.

## Evidence

### File Analysis

**TabContent.tsx (lines 58-60):**
```typescript
{activeTab.type === 'document' && (
  <EditorPane promptId={activeTab.promptId!} tabId={activeTab.id} />
)}
```
- No key prop on EditorPane
- Same instance reused when switching tabs
- Only props change

**EditorPane.tsx (line 550):**
```typescript
<Editor
  key={promptId}  // ← Forces remount
  value={content}
  onChange={(value) => {
    if (monacoPromptIdRef.current === promptId) {
      setContent(value || "")
    }
  }}
/>
```
- key={promptId} forces remount on document change
- value={content} should update Monaco
- BUT: Only if Monaco is initialized!

**Editor.tsx (lines 31-46):**
```typescript
const MonacoEditor = dynamic(
  () => import('@monaco-editor/react').then((mod) => {
    // CRITICAL: Configure to use self-hosted Monaco from public directory
    mod.loader.config({
      paths: {
        vs: '/monaco-editor/vs'
      }
    })
    return mod
  }),
  {
    ssr: false,
    loading: () => <EditorSkeleton />
  }
)
```
- Dynamic import with SSR disabled
- Monaco files loaded from /monaco-editor/vs/
- First load not cached = SLOW

### Monaco Loader Behavior

Monaco Editor uses a loader that:
1. Downloads ~50+ JavaScript files on first load
2. Initializes editor instance
3. Applies configuration
4. THEN ready to accept content

**First load timing:**
- File downloads: 300-1000ms (network dependent)
- Initialization: 100-300ms
- **Total: 400-1300ms** before ready

**Cached load timing:**
- File downloads: 0ms (from cache)
- Initialization: 50-100ms
- **Total: 50-100ms** before ready

## Proposed Fix

### Option 1: Wait for Monaco Initialization (Recommended)

Add initialization check in Editor component:

```typescript
// Editor.tsx
function handleMount(editor: any, monaco: any) {
  editorRef.current = editor

  // Configure options...
  editor.updateOptions({ ... })

  // CRITICAL: Ensure value is applied after initialization
  // Reason: On first mount, Monaco might not have applied the value prop
  // Solution: Explicitly set value after mount completes
  const currentValue = editor.getValue()
  if (currentValue !== value && value !== undefined) {
    editor.setValue(value || '')
  }

  // Register actions...
  // Call user onMount...
}
```

**Pros:**
- Ensures value always applied
- No changes to EditorPane logic
- Minimal code change (3 lines)
- Zero side effects

**Cons:**
- Slightly redundant (sets value twice on subsequent loads)
- But harmless as it's a check-and-set

### Option 2: Remove key={promptId} (NOT Recommended)

Remove the key prop and rely on value prop updates:

```typescript
<Editor
  // key={promptId}  // ← REMOVED
  value={content}
  onChange={...}
/>
```

**Pros:**
- No remount, no initialization delay
- Value prop updates would work

**Cons:**
- ❌ Breaks P5S5 fix #1 (onChange contamination)
- ❌ Could reintroduce data destruction bugs
- ❌ Monaco internal state might not reset properly
- **NOT SAFE**

### Option 3: Controlled Remount with Value Reset

Keep key but add value reset logic in EditorPane:

```typescript
// Track if this is first render
const isFirstRenderRef = useRef(true)

useEffect(() => {
  if (isFirstRenderRef.current && content && !loading) {
    isFirstRenderRef.current = false
    // Force re-render after Monaco likely initialized
    setTimeout(() => {
      setContent(content)
    }, 100)
  }
}, [content, loading])
```

**Pros:**
- Keeps key={promptId} for safety
- Forces value reapplication

**Cons:**
- Hacky setTimeout
- Timing not guaranteed
- More complex than Option 1

### Recommendation: Option 1

**Implement the explicit setValue in handleMount:**

**File:** `src/features/editor/components/Editor.tsx`
**Lines:** 115-149 (in handleMount function)
**Change:** Add value check and explicit set after line 131

```typescript
// After editor.updateOptions({ ... })

// CRITICAL: Ensure value is applied after initialization (First tab bug fix)
// Reason: On first Monaco load, value prop may not be applied during mount
// Solution: Explicitly set value after initialization completes
if (value !== undefined) {
  const currentValue = editor.getValue()
  if (currentValue !== value) {
    editor.setValue(value)
  }
}

// Then continue with action registration...
```

## Testing Strategy

### Critical Test

**Setup:**
```
1. Clear browser cache and localStorage
2. Fully close and reopen browser
3. Navigate to PromptHub dashboard
```

**Test Steps:**
```
1. Ensure NO tabs are open (start fresh)
2. Click document A (first tab from zero)
3. EXPECTED BEFORE FIX:
   - Title shows "A" ✅
   - Monaco shows "" (empty) ❌
4. EXPECTED AFTER FIX:
   - Title shows "A" ✅
   - Monaco shows "A" ✅
5. Click document B (second tab)
6. EXPECTED:
   - Both before and after fix: B displays correctly ✅
7. Click back to document A
8. EXPECTED:
   - Both before and after fix: A displays correctly ✅
```

### Additional Tests

**Test Cache Scenario:**
```
1. Open first tab (document A)
2. Verify content displays
3. Close all tabs
4. Open same document A again
5. Verify content displays (Monaco files cached)
```

**Test Multiple Documents:**
```
1. Open documents A, B, C in sequence
2. Verify each displays correctly when opened
3. Switch between tabs
4. Verify all maintain correct content
```

**Test After Page Refresh:**
```
1. Open several tabs
2. Hard refresh page (Ctrl+Shift+R)
3. Verify first tab visible displays correctly
4. Switch to other tabs
5. Verify all display correctly
```

## Implementation Plan

1. ✅ Document bug and root cause
2. ⏳ Implement Option 1 fix in Editor.tsx
3. ⏳ Run TypeScript verification
4. ⏳ Run build verification
5. ⏳ Manual testing (Critical Test scenario)
6. ⏳ Git commit
7. ⏳ User validation

## Related Issues

This bug is separate from the P5S5 data destruction bugs, but:
- Uses same Editor component
- Affected by same key={promptId} that fixes P5S5
- Fix must NOT break P5S5 protections

**P5S5 Protections Must Remain:**
- ✅ monacoPromptIdRef guard in onChange
- ✅ key={promptId} forcing remount
- ✅ All ownership tracking refs

**This fix adds:**
- ✅ Explicit value setting after Monaco initialization
- ✅ No impact on P5S5 protections

---
**Bug Status:** IDENTIFIED
**Fix Status:** PENDING IMPLEMENTATION
**Priority:** P2 - UX issue, not data destructive
**Estimated Fix Time:** 10 minutes
**Testing Time:** 15 minutes
