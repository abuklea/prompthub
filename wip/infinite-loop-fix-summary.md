# PromptHub - Infinite Loop Bug Fix Summary

| `Title` | `Created` | `Last modified` |
|---------|-----------|-----------------|
| Infinite Loop Bug Fix Summary | 08/11/2025 13:45 GMT+10 | 08/11/2025 13:45 GMT+10 |

## Table of Contents
- [Problem Overview](#problem-overview)
- [Root Cause Analysis](#root-cause-analysis)
- [The Fix](#the-fix)
- [Technical Details](#technical-details)
- [Verification](#verification)

## Problem Overview

**Error**: `Maximum update depth exceeded` - React infinite loop error
**Location**: `src/features/editor/components/EditorPane.tsx`
**Impact**: Application crashes with runtime error, unusable editor
**Severity**: CRITICAL

## Root Cause Analysis

### The Problematic Code (Lines 162-179)

```typescript
// BEFORE (BROKEN)
useEffect(() => {
  if (title && promptData) {
    const isDirty = content !== promptData.content
    updateTab(tabId, { title, isDirty })

    if (isDirty) {
      const currentTab = tabs.find(t => t.id === tabId)  // ← Reads from tabs
      if (currentTab?.isPreview) {
        promotePreviewTab(tabId)  // ← Updates tabs state
      }
    }
  }
}, [title, content, promptData, tabId, updateTab, tabs, promotePreviewTab])  // ← tabs causes loop!
```

### Why It Loops Infinitely

1. **Effect depends on `tabs` array** (in dependency array)
2. **Effect calls `promotePreviewTab()`** which modifies `tabs` state
3. **Modified `tabs` triggers effect again** (dependency changed)
4. **Cycle repeats infinitely**: effect runs → tabs change → effect runs → tabs change → ...

### Zustand Store Confirmation

From `use-tab-store.ts` lines 130-136:

```typescript
promotePreviewTab: (tabId) => {
  set(state => ({
    tabs: state.tabs.map(t =>
      t.id === tabId ? { ...t, isPreview: false } : t
    )
  }))
},
```

This function **creates a new `tabs` array**, triggering the effect again.

## The Fix

### Solution: Use Direct Store Access

Instead of depending on the reactive `tabs` from the hook, we:
1. **Removed `tabs` from dependency array** (breaks the loop)
2. **Used `useTabStore.getState().tabs`** to read current state imperatively
3. **Reordered operations** to promote first, then update

```typescript
// AFTER (FIXED)
useEffect(() => {
  if (title && promptData) {
    const isDirty = content !== promptData.content

    // Reason: Get current tab state from store to check if preview
    const currentTab = useTabStore.getState().tabs.find(t => t.id === tabId)

    // Reason: Auto-promote preview tab to permanent when content is edited (P5S4dT3)
    // CRITICAL: Only promote on first edit to avoid infinite loop
    if (isDirty && currentTab?.isPreview) {
      promotePreviewTab(tabId)
    }

    // Update tab after promotion check
    updateTab(tabId, {
      title,
      isDirty
    })
  }
}, [title, content, promptData, tabId, updateTab, promotePreviewTab])
```

### Key Changes

1. ✅ **Removed `tabs` from dependencies** - Breaks the infinite loop
2. ✅ **Direct store access**: `useTabStore.getState().tabs` - Non-reactive read
3. ✅ **Promote before update** - Ensures correct order of operations
4. ✅ **Added comments** - Documents the critical fix for future maintainers

## Technical Details

### Why Direct Store Access Works

**Zustand's `getState()`**:
- Returns current state snapshot
- **Not reactive** - doesn't subscribe to changes
- **Doesn't trigger re-renders** when state changes
- Perfect for conditional logic inside effects

### Effect Dependencies After Fix

```typescript
[title, content, promptData, tabId, updateTab, promotePreviewTab]
```

**Stable dependencies**:
- `title`, `content` - User input (expected to trigger updates)
- `promptData` - Server data (changes when document loads)
- `tabId` - Tab identity (changes when switching tabs)
- `updateTab`, `promotePreviewTab` - Zustand actions (stable references)

## Verification

### Testing Steps

1. ✅ Server restarted successfully
2. ✅ No compilation errors
3. ✅ HMR applied changes without issues
4. ✅ File header updated with changelog

### Expected Behavior After Fix

- Opening a preview tab (single-click) works
- Editing content promotes preview → permanent tab
- No infinite loops or crashes
- Console clean (no "Maximum update depth" errors)

### Manual Test Required

Navigate to: `http://localhost:3010/dashboard`
1. Single-click a prompt (opens preview tab)
2. Edit the content
3. Verify tab becomes permanent (italic removed)
4. Check console - should be clean

## Related Files

### Modified
- `src/features/editor/components/EditorPane.tsx` (Lines 162-182)

### Related (Not Modified)
- `src/stores/use-tab-store.ts` (promotePreviewTab implementation)
- `src/features/tabs/types.ts` (TabData interface)

## Lessons Learned

### React useEffect Pitfalls

1. **Never include reactive state that the effect modifies** in dependencies
2. **Use direct store access** (`getState()`) for conditional reads
3. **Zustand actions are stable** - safe in dependency arrays
4. **Zustand state subscriptions are reactive** - can cause loops

### Best Practices

✅ **DO**: Use `store.getState()` for imperative reads in effects
✅ **DO**: Keep dependency arrays minimal and stable
✅ **DO**: Document critical fixes with inline comments

❌ **DON'T**: Include reactive state you're modifying in deps
❌ **DON'T**: Use hooks (`useTabs()`) inside effects if you modify that state
❌ **DON'T**: Assume Zustand prevents infinite loops automatically

## Status

**Fix Applied**: ✅ 08/11/2025 13:45 GMT+10
**Compilation**: ✅ Success
**Server Status**: ✅ Running (HMR active)
**Manual Testing**: ⏳ Required

## Next Steps

1. Test the fix manually in browser
2. Verify preview tab promotion works
3. Check console for any errors
4. Commit the fix if verification passes

---

**Bug Severity**: CRITICAL
**Fix Complexity**: Low (dependency array fix)
**Risk**: Minimal (direct store access is standard Zustand pattern)
**Confidence**: High (root cause identified and resolved)
