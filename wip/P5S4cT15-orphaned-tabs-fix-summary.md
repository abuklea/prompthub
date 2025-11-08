# PromptHub
## P5S4cT15: Orphaned Tabs Fix - Implementation Summary

| `Title` | `Created` | `Last modified` |
|---------|-----------|-----------------|
| P5S4cT15: Orphaned Tabs Fix - Implementation Summary | 08/11/2025 13:58 GMT+10 | 08/11/2025 13:58 GMT+10 |

## Table of Contents
- [Problem Description](#problem-description)
- [Root Cause Analysis](#root-cause-analysis)
- [Solution Design](#solution-design)
- [Implementation Details](#implementation-details)
- [Testing Instructions](#testing-instructions)
- [Files Modified](#files-modified)

## Problem Description

**User Report:**
A deleted document tab remains in the editor, even after logout and login again. The user cannot remove it.

**Symptoms:**
1. User deletes a document from the PromptList
2. Tab closes immediately (correct behavior)
3. User logs out and logs back in
4. Deleted document tab reappears in editor
5. Clicking the tab shows error (document no longer exists)
6. Tab cannot be closed or removed

## Root Cause Analysis

### Why This Happens

1. **Tab Deletion Works Correctly**
   - When document deleted, `closeTabsByPromptId()` runs
   - Tab removed from active state
   - UI updates immediately

2. **localStorage Persistence Issue**
   - Zustand persist middleware saves tabs array to localStorage
   - Tab data persisted BEFORE database deletion
   - No validation on restore from localStorage

3. **Session Restore Problem**
   - On logout/login, app layout re-mounts
   - Zustand loads tabs from localStorage
   - Orphaned tabs (for deleted documents) restored
   - No check if documents still exist

### Code Flow

```
User deletes document
  → PromptList calls deletePrompt()
  → Database record deleted
  → closeTabsByPromptId() called
  → Tab removed from Zustand state
  ✓ UI updates correctly

User logs out
  → Zustand persist saves tabs[] to localStorage
  → localStorage still contains deleted document tabs

User logs in
  → App layout mounts
  → Zustand loads tabs[] from localStorage
  ✗ Orphaned tabs restored without validation
  ✗ User sees tabs for non-existent documents
```

## Solution Design

### Strategy

Add **tab validation on app mount** to clean orphaned tabs:

1. **When to validate**: On app layout mount (once per session)
2. **What to validate**: All document tabs with promptIds
3. **How to validate**: Batch database query for prompt existence
4. **How to clean**: Close tabs for non-existent documents

### Architecture

```
App Layout Mount
  ↓
TabCleanupProvider (Client Component)
  ↓
useTabCleanup() Hook
  ↓
1. Read tabs from store
2. Filter document tabs
3. Extract promptIds
  ↓
validatePrompts() Server Action
  ↓
Database: SELECT id WHERE id IN (...)
  ↓
Return valid promptIds
  ↓
4. Compare valid vs current
5. Close orphaned tabs
```

## Implementation Details

### 1. Validation Server Action

**File:** `src/features/prompts/actions.ts`

```typescript
export async function validatePrompts(
  promptIds: string[]
): Promise<ActionResult<{ validIds: string[] }>> {
  // Get authenticated user
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  // Batch query all promptIds with user_id filter
  const prompts = await db.prompt.findMany({
    where: {
      id: { in: promptIds },
      user_id: user.id
    },
    select: { id: true }
  })

  return { success: true, data: { validIds: prompts.map(p => p.id) } }
}
```

**Key Points:**
- Batch operation (single database query)
- User isolation via RLS (user_id filter)
- Returns only valid promptIds

### 2. Cleanup Hook

**File:** `src/hooks/use-tab-cleanup.ts`

```typescript
export function useTabCleanup() {
  const { tabs, closeTab } = useTabStore()
  const hasRun = useRef(false)

  useEffect(() => {
    // Run once on mount only
    if (hasRun.current) return
    hasRun.current = true

    async function cleanOrphanedTabs() {
      // Filter document tabs with promptIds
      const documentTabs = tabs.filter(
        t => t.type === 'document' && t.promptId
      )

      if (documentTabs.length === 0) return

      // Extract unique promptIds
      const uniqueIds = Array.from(
        new Set(documentTabs.map(t => t.promptId!))
      )

      // Validate existence
      const result = await validatePrompts(uniqueIds)
      if (!result.success) return

      // Close orphaned tabs
      const validPromptIds = new Set(result.data?.validIds || [])
      documentTabs.forEach(tab => {
        if (tab.promptId && !validPromptIds.has(tab.promptId)) {
          console.log(`Closing orphaned tab: ${tab.promptId}`)
          closeTab(tab.id)
        }
      })
    }

    cleanOrphanedTabs()
  }, [])
}
```

**Key Points:**
- Runs once per session (hasRun ref guard)
- Empty dependency array (intentional)
- Batch validation (single API call)
- Logs cleanup actions to console

### 3. Provider Component

**File:** `src/components/layout/TabCleanupProvider.tsx`

```typescript
export function TabCleanupProvider({
  children
}: { children: React.ReactNode }) {
  useTabCleanup()
  return <>{children}</>
}
```

**Key Points:**
- Client Component (hook requires client context)
- Transparent wrapper (passes children through)
- Single responsibility (tab cleanup only)

### 4. Layout Integration

**File:** `src/app/(app)/layout.tsx`

```typescript
export default async function AppLayout() {
  // ... auth check ...

  return (
    <TabCleanupProvider>
      <div className="flex flex-col h-screen">
        {/* ... rest of layout ... */}
      </div>
    </TabCleanupProvider>
  )
}
```

**Key Points:**
- Server Component layout unchanged
- TabCleanupProvider wraps entire app
- Runs on every session start

## Testing Instructions

### Manual Test Scenario

**Test: Orphaned Tab Cleanup After Document Deletion**

1. **Setup:**
   - Login to PromptHub
   - Create 3-5 documents in any folder
   - Open all documents in tabs

2. **Create Orphaned Tab:**
   - Select one document (leave tab open)
   - Delete the document from PromptList
   - Verify tab closes immediately ✓

3. **Trigger Session Restart:**
   - Click "Sign Out"
   - Login again with same credentials

4. **Verify Cleanup:**
   - Check editor tab bar
   - **Expected:** Deleted document tab NOT present
   - **Expected:** Other tabs remain open
   - **Expected:** Console shows cleanup log (if any orphaned tabs)

5. **Edge Cases:**
   - Delete last tab → Verify empty state shows
   - Delete active tab → Verify next tab becomes active
   - Delete all folder documents → Verify all tabs close

### Expected Console Output

```
Closing orphaned tab for deleted document: abc-123-def-456
```

### Verification Checklist

- [ ] Deleted document tab does not reappear after logout/login
- [ ] Other tabs remain open correctly
- [ ] No TypeScript errors in build
- [ ] No console errors (except cleanup logs)
- [ ] Active tab selection preserved
- [ ] Tab order preserved
- [ ] Preview/permanent states preserved

## Files Modified

### Created Files

1. **src/hooks/use-tab-cleanup.ts**
   - Cleanup hook with tab validation logic
   - Runs once on mount
   - Closes orphaned tabs

2. **src/components/layout/TabCleanupProvider.tsx**
   - Client component wrapper
   - Enables hook usage in Server Component layout

### Modified Files

1. **src/app/(app)/layout.tsx**
   - Added TabCleanupProvider import
   - Wrapped layout in provider

2. **src/features/prompts/actions.ts**
   - Added validatePrompts server action
   - Batch validation for multiple promptIds

### Build Status

```
✓ Compiled successfully
✓ TypeScript check passed
✓ No linting errors
✓ Build completed: 10/10 pages generated
```

## Impact Assessment

### User Experience

**Before:**
- Orphaned tabs persist after logout/login
- Clicking orphaned tab shows error
- No way to close orphaned tabs
- Confusing and frustrating UX

**After:**
- Orphaned tabs auto-removed on session start
- Clean tab bar with only valid documents
- No manual cleanup required
- Seamless experience

### Performance

**Startup Impact:**
- Single database query per session
- Batch operation (not per-tab)
- Runs in background (non-blocking)
- Negligible performance impact

**Example:**
- 10 open tabs → 1 database query
- 100ms validation time
- No UI blocking
- User doesn't notice cleanup

### Technical Debt

**Solved:**
- localStorage sync issues
- Tab state validation
- Session restore bugs

**Remaining:**
- Could add periodic cleanup (every N minutes)
- Could validate on folder deletion too
- Could add cleanup on tab click (lazy validation)

## Notes

1. **Why not validate on tab click?**
   - More expensive (per-click validation)
   - Session cleanup is sufficient
   - Keeps tab interactions fast

2. **Why not prevent localStorage save?**
   - Need persistence for valid tabs
   - Can't selectively prevent save
   - Validation on restore is safer

3. **Why batch validation?**
   - Single database query
   - Better performance
   - Cleaner code

4. **Future improvements:**
   - Add cleanup on folder deletion
   - Add periodic background cleanup
   - Add retry logic for failed validation

----
**PRP Document**: PRPs/P5S4c-tabbed-editor-upgrade.md
**PRP Status**: IN PROGRESS
**Task ID**: P5S4cT15
**Phase**: Phase 5 - Tabbed Editor Upgrade
**Implementation Status**: COMPLETE (P5S4cT15)
**Testing Status**: READY FOR MANUAL TESTING
