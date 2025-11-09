# PromptHub
## Server Request Frequency Audit Report

| `Title` | `Created` | `Last modified` |
|---------|-----------|-----------------|
| Server Request Frequency Audit Report | 09/11/2025 14:30 GMT+10 | 09/11/2025 14:30 GMT+10 |

## Table of Contents
- [Executive Summary](#executive-summary)
- [Critical Issues (P0)](#critical-issues-p0)
- [High Priority Issues (P1)](#high-priority-issues-p1)
- [Nice to Have (P2)](#nice-to-have-p2)
- [Scenario Analysis](#scenario-analysis)
- [Optimization Recommendations](#optimization-recommendations)
- [Implementation Priority](#implementation-priority)

---

## Executive Summary

**Audit Date**: 09/11/2025  
**Auditor**: Senior Backend Engineer Agent  
**Objective**: Identify and optimize excessive server request patterns in PromptHub

### Key Findings

- **Total request patterns analyzed**: 15
- **Critical issues found**: 2
- **High priority issues found**: 3
- **Nice to have optimizations**: 2
- **Estimated request reduction**: 60-70%

### Impact Summary

Current implementation makes **excessive database requests** that can be eliminated through:
1. Using existing cached data from Zustand store
2. Implementing optimistic UI updates
3. Adding request deduplication
4. Better cache-first strategies

**Critical Performance Impact**: Every document selection, creation, rename, or deletion triggers 2-3x more database requests than necessary.

---

## Critical Issues (P0)

### P0-1: DocumentToolbar Fetches Full Prompt Details for Title Only

**Location**: `/home/allan/projects/PromptHub/src/features/prompts/components/DocumentToolbar.tsx:39-56`

**Problem**: 
- Fetches FULL prompt details (`getPromptDetails`) just to get the document title
- Triggers on EVERY `selectedPrompt` change
- The title is **already available** in Zustand `prompts` array (populated by PromptList)

**Impact**: 
- **1 unnecessary database request per document selection**
- Fetches full document content + folder relation when only title is needed
- Happens EVERY time user clicks a document in the list

**Code**:
```typescript
// Lines 39-56 in DocumentToolbar.tsx
useEffect(() => {
  async function loadPromptTitle() {
    if (!selectedPrompt) {
      setSelectedPromptTitle("")
      setSelectedPromptHasVersions(false)
      return
    }

    const result = await getPromptDetails({ promptId: selectedPrompt })
    // ^^^^ UNNECESSARY DATABASE HIT
    if (result.success && result.data) {
      setSelectedPromptTitle(result.data.title)
      setSelectedPromptHasVersions(false)
    }
  }

  loadPromptTitle()
}, [selectedPrompt])
```

**Solution**: 
Use title from Zustand store instead:

```typescript
useEffect(() => {
  if (!selectedPrompt) {
    setSelectedPromptTitle("")
    setSelectedPromptHasVersions(false)
    return
  }

  // Get title from existing prompts array in Zustand
  const prompts = useUiStore.getState().prompts
  const prompt = prompts.find(p => p.id === selectedPrompt)
  
  if (prompt) {
    setSelectedPromptTitle(prompt.title || "")
    // TODO: Add version count to prompts array if needed
    setSelectedPromptHasVersions(false)
  }
}, [selectedPrompt])
```

**Estimated Impact**: Eliminates 100% of these requests (could be 10-50+ per session)

---

### P0-2: Excessive Refetches After Every Mutation

**Location**: 
- `/home/allan/projects/PromptHub/src/features/prompts/components/PromptList.tsx:47-64`
- `/home/allan/projects/PromptHub/src/stores/use-ui-store.ts:89-90`

**Problem**:
- `getPromptsByFolder()` refetches entire folder's documents after EVERY mutation
- Triggered by `promptRefetchTrigger` increment after: create, rename, delete operations
- Could use optimistic updates instead

**Impact**:
- **1 full folder refetch per create/rename/delete operation**
- Fetches ALL documents in folder when only 1 changed
- No optimistic UI - users see loading states unnecessarily

**Triggered From**:
1. `DocumentToolbar.handleNewDoc()` - line 95
2. `DocumentToolbar.handleConfirmRename()` - line 112
3. `DocumentToolbar.handleConfirmDelete()` - line 132
4. `EditorPane.handleSave()` - line 331
5. `FolderToolbar.handleDeleteFolder()` - line 60

**Code**:
```typescript
// PromptList.tsx:47-64
useEffect(() => {
  async function loadPrompts() {
    if (!selectedFolder) {
      setPrompts([])
      return
    }
    setLoading(true)
    try {
      const folderPrompts = await getPromptsByFolder(selectedFolder)
      // ^^^^ REFETCHES ALL DOCUMENTS AFTER EVERY MUTATION
      setPrompts(folderPrompts)
    } catch (error) {
      console.error("Failed to fetch prompts:", error)
    } finally {
      setLoading(false)
    }
  }
  loadPrompts()
}, [selectedFolder, promptRefetchTrigger, setPrompts])
//                   ^^^^^^^^^^^^^^^^^^^ Incremented after every mutation
```

**Solution**: 
Implement optimistic updates in Zustand store:

```typescript
// In DocumentToolbar after createPrompt success:
const newPrompt = { 
  id: result.data.promptId, 
  title: "[Untitled Doc]",
  content: "",
  created_at: new Date(),
  // ... other fields
}
useUiStore.getState().addPrompt(newPrompt) // Optimistic add
// NO triggerPromptRefetch() call

// In DocumentToolbar after renamePrompt success:
useUiStore.getState().updatePromptTitle(promptId, newTitle) // Already exists!
// NO triggerPromptRefetch() call

// In DocumentToolbar after deletePrompt success:
useUiStore.getState().removePrompt(promptId) // New action needed
// NO triggerPromptRefetch() call
```

**Estimated Impact**: Eliminates 60-80% of folder refetch requests

---

## High Priority Issues (P1)

### P1-1: New Document Creation Makes 3 Database Requests

**Location**: Document creation flow across multiple components

**Problem**: Creating a new document triggers 3 sequential database requests:

**Flow**:
1. `createPrompt()` - INSERT new document (necessary)
2. `triggerPromptRefetch()` - increments trigger
3. `getPromptsByFolder()` - SELECT all folder documents (unnecessary - optimistic update)
4. `getPromptDetails()` - SELECT new document details (unnecessary - already have from create)

**Impact**: 
- **2 unnecessary requests per document creation**
- Total of 3 requests when only 1 is needed
- User sees loading states during refetch

**Code Flow**:
```typescript
// DocumentToolbar.tsx:69-97
const result = await createPrompt({ folderId: selectedFolder })
// DATABASE HIT #1 (necessary)

if (result.data?.promptId) {
  openTab({ /* ... */ })
  triggerPromptRefetch()  
  // DATABASE HIT #2 - getPromptsByFolder (unnecessary)
}

// Then EditorPane loads:
const result = await getPromptDetails({ promptId })
// DATABASE HIT #3 (unnecessary - could return from createPrompt)
```

**Solution**:
1. Have `createPrompt()` return full prompt object (not just ID)
2. Use optimistic update in Zustand store
3. Pre-populate EditorPane cache

```typescript
// Modified createPrompt to return full prompt:
export async function createPrompt(data: unknown): Promise<ActionResult<Prompt>> {
  // ... existing code ...
  const prompt = await db.prompt.create({ /* ... */ })
  return { success: true, data: prompt } // Return full object
}

// In DocumentToolbar:
const result = await createPrompt({ folderId: selectedFolder })
if (result.success && result.data) {
  // Optimistic update
  useUiStore.getState().addPrompt(result.data)
  
  // Pre-populate cache
  documentCache.set(result.data.id, {
    userId: currentUserId,
    promptData: result.data,
    title: result.data.title || "",
    content: result.data.content || "",
    lastSaved: new Date()
  })
  
  openTab({ /* ... */ })
  // NO triggerPromptRefetch()
}
```

**Estimated Impact**: Reduces new document creation from 3 to 1 request (67% reduction)

---

### P1-2: Document Deletion Makes 2 Database Requests

**Location**: Document deletion flow

**Problem**: Deleting a document triggers unnecessary refetch:

**Flow**:
1. `deletePrompt()` - DELETE document (necessary)
2. `triggerPromptRefetch()` - increments trigger
3. `getPromptsByFolder()` - SELECT all folder documents (unnecessary)

**Impact**: 
- **1 unnecessary request per deletion**
- Total of 2 requests when only 1 is needed

**Solution**: Optimistic update

```typescript
// In DocumentToolbar after deletePrompt success:
useUiStore.getState().removePrompt(selectedPrompt)
closeTabsByPromptId(selectedPrompt)
selectPrompt(null)
// NO triggerPromptRefetch()
```

**Estimated Impact**: Reduces deletion from 2 to 1 request (50% reduction)

---

### P1-3: Document Rename Makes 2 Database Requests

**Location**: Document rename flow

**Problem**: Same issue as deletion

**Flow**:
1. `renamePrompt()` - UPDATE document title (necessary)
2. `triggerPromptRefetch()` - increments trigger
3. `getPromptsByFolder()` - SELECT all folder documents (unnecessary)

**Impact**: 
- **1 unnecessary request per rename**

**Solution**: Already partially implemented!

```typescript
// In DocumentToolbar after renamePrompt success:
setSelectedPromptTitle(newTitle)
updatePromptTitle(selectedPrompt, newTitle) // ALREADY EXISTS in Zustand!
// NO triggerPromptRefetch()
```

**Note**: The `updatePromptTitle()` action already exists in useUiStore (line 94-99). Just remove the `triggerPromptRefetch()` call.

**Estimated Impact**: Reduces rename from 2 to 1 request (50% reduction)

---

## Nice to Have (P2)

### P2-1: No Request Deduplication

**Problem**: Multiple simultaneous requests to same endpoint are possible

**Impact**: Low (unlikely in typical usage, but possible in edge cases)

**Solution**: Implement in-flight request tracking

```typescript
// Create a request cache with in-flight tracking
const requestCache = new Map<string, Promise<any>>()

export async function getPromptDetails(data: unknown): Promise<ActionResult> {
  const parsed = getPromptDetailsSchema.safeParse(data)
  if (!parsed.success) return { success: false, error: "Invalid" }
  
  const cacheKey = `prompt-${parsed.data.promptId}`
  
  // Check if request already in flight
  if (requestCache.has(cacheKey)) {
    return requestCache.get(cacheKey)!
  }
  
  // Create promise and cache it
  const promise = _getPromptDetailsImpl(parsed.data.promptId)
  requestCache.set(cacheKey, promise)
  
  try {
    const result = await promise
    return result
  } finally {
    requestCache.delete(cacheKey)
  }
}
```

**Estimated Impact**: Minimal (edge case protection)

---

### P2-2: EditorPane Always Loads from Database on First Tab Open

**Problem**: Cache only helps with subsequent tab switches, not first open

**Impact**: Medium (1 request per unique document per session)

**Solution**: Pre-populate cache from PromptList data

```typescript
// When opening tab from PromptList, pass initial data:
const handleSingleClick = () => {
  selectPrompt(prompt.id)
  
  // Pre-populate cache before opening tab
  const currentUserId = /* get from store */
  documentCache.set(prompt.id, {
    userId: currentUserId,
    promptData: prompt, // We already have this!
    title: prompt.title || "",
    content: prompt.content || "", // Might not have content...
    lastSaved: null
  })
  
  openTab({ /* ... */ })
}
```

**Note**: This only works if PromptList fetches include `content` field. Currently it does (line 16-24 in actions.ts). But fetching content for ALL documents in folder is wasteful.

**Better Solution**: Keep current behavior (lazy load content on tab open). Cache works well for tab switching.

**Estimated Impact**: Low priority - current caching strategy is reasonable

---

## Scenario Analysis

### Scenario A: Tab Switching (Existing Document)

**Current Flow**:
1. User clicks document in PromptList
2. EditorPane receives new promptId
3. EditorPane checks cache
   - **CACHE HIT**: 0 requests ✅
   - **CACHE MISS**: `getPromptDetails()` - 1 request

**Optimization**: Already optimal for cache hits. P2-2 could pre-populate cache.

**Requests**: 0-1 (depends on cache)

---

### Scenario B: New Document Creation

**Current Flow**:
1. User clicks "New Doc"
2. `createPrompt()` - **DATABASE HIT #1** (INSERT)
3. `triggerPromptRefetch()`
4. `getPromptsByFolder()` - **DATABASE HIT #2** (SELECT ALL)
5. EditorPane loads new document
6. `getPromptDetails()` - **DATABASE HIT #3** (SELECT ONE)

**Requests**: **3 total**

**Optimized Flow** (with P0-2 and P1-1 fixes):
1. User clicks "New Doc"
2. `createPrompt()` returns full object - **DATABASE HIT #1** (INSERT)
3. Optimistic update to Zustand prompts array
4. Pre-populate EditorPane cache
5. EditorPane loads from cache

**Requests**: **1 total** (67% reduction)

---

### Scenario C: Document Deletion

**Current Flow**:
1. User confirms delete
2. `deletePrompt()` - **DATABASE HIT #1** (DELETE)
3. `triggerPromptRefetch()`
4. `getPromptsByFolder()` - **DATABASE HIT #2** (SELECT ALL)

**Requests**: **2 total**

**Optimized Flow** (with P0-2 and P1-2 fixes):
1. User confirms delete
2. `deletePrompt()` - **DATABASE HIT #1** (DELETE)
3. Optimistic update removes from Zustand array
4. Close tabs and update UI

**Requests**: **1 total** (50% reduction)

---

### Scenario D: Document Rename

**Current Flow**:
1. User confirms rename
2. `renamePrompt()` - **DATABASE HIT #1** (UPDATE)
3. `triggerPromptRefetch()`
4. `getPromptsByFolder()` - **DATABASE HIT #2** (SELECT ALL)

**Requests**: **2 total**

**Optimized Flow** (with P0-2 and P1-3 fixes):
1. User confirms rename
2. `renamePrompt()` - **DATABASE HIT #1** (UPDATE)
3. Update Zustand store with new title (already implemented!)

**Requests**: **1 total** (50% reduction)

---

### Scenario E: Folder Selection

**Current Flow**:
1. User selects folder
2. `getPromptsByFolder()` - **DATABASE HIT #1** (SELECT ALL)

**Requests**: **1 total**

**Optimization**: Already optimal. First folder load requires database hit.

**Note**: Could implement folder-level caching, but low priority.

---

## Optimization Recommendations

### Recommendation 1: Remove Redundant getPromptDetails in DocumentToolbar

**Problem**: DocumentToolbar fetches full prompt details just for title  
**Location**: `src/features/prompts/components/DocumentToolbar.tsx:39-56`  
**Impact**: 1 unnecessary request per document selection (10-50+ per session)  
**Solution**: Use title from Zustand prompts array  
**Effort**: 10 minutes  
**Priority**: P0

**Implementation**:
```typescript
// REMOVE lines 39-56 (entire useEffect)

// REPLACE with:
useEffect(() => {
  if (!selectedPrompt) {
    setSelectedPromptTitle("")
    setSelectedPromptHasVersions(false)
    return
  }

  const prompts = useUiStore.getState().prompts
  const prompt = prompts.find(p => p.id === selectedPrompt)
  
  if (prompt) {
    setSelectedPromptTitle(prompt.title || "")
    setSelectedPromptHasVersions(false)
  }
}, [selectedPrompt])
```

---

### Recommendation 2: Implement Optimistic Updates for Mutations

**Problem**: Every create/rename/delete triggers full folder refetch  
**Location**: Multiple components call `triggerPromptRefetch()`  
**Impact**: 1 unnecessary refetch per mutation  
**Solution**: Add optimistic update actions to Zustand store  
**Effort**: 1-2 hours  
**Priority**: P0

**Implementation Steps**:

**Step 1**: Add actions to `useUiStore`
```typescript
// src/stores/use-ui-store.ts
interface UiState {
  // ... existing ...
  addPrompt: (prompt: Prompt) => void
  removePrompt: (promptId: string) => void
  // updatePromptTitle already exists!
}

export const useUiStore = create<UiState>((set) => ({
  // ... existing ...
  
  addPrompt: (prompt) =>
    set((state) => ({
      prompts: [...state.prompts, prompt]
    })),
  
  removePrompt: (promptId) =>
    set((state) => ({
      prompts: state.prompts.filter(p => p.id !== promptId)
    })),
}))
```

**Step 2**: Update DocumentToolbar to use optimistic updates
```typescript
// After createPrompt success:
if (result.success && result.data) {
  const newPrompt = result.data // Full prompt object from server
  useUiStore.getState().addPrompt(newPrompt)
  // REMOVE: triggerPromptRefetch()
}

// After renamePrompt success:
updatePromptTitle(selectedPrompt, newTitle) // Already exists!
// REMOVE: triggerPromptRefetch()

// After deletePrompt success:
useUiStore.getState().removePrompt(selectedPrompt)
// REMOVE: triggerPromptRefetch()
```

**Step 3**: Update EditorPane
```typescript
// After saveNewVersion success:
updatePromptTitle(promptId, title) // Already exists!
// REMOVE: triggerPromptRefetch()
```

---

### Recommendation 3: Return Full Object from createPrompt

**Problem**: createPrompt returns only ID, forcing subsequent getPromptDetails call  
**Location**: `src/features/prompts/actions.ts:33-91`  
**Impact**: 1 unnecessary request per document creation  
**Solution**: Return full Prompt object instead of just ID  
**Effort**: 30 minutes  
**Priority**: P1

**Implementation**:
```typescript
// actions.ts:33
export async function createPrompt(
  data: unknown
): Promise<ActionResult<Prompt>> { // Change return type
  // ... existing validation ...

  const prompt = await db.prompt.create({
    data: {
      user_id: user.id,
      folder_id: parsed.data.folderId,
      title: title,
      content: "",
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

  return { success: true, data: prompt } // Return full object
}
```

**Step 2**: Pre-populate cache in DocumentToolbar
```typescript
// After createPrompt success:
if (result.success && result.data) {
  // Optimistic update
  useUiStore.getState().addPrompt(result.data)
  
  // Pre-populate EditorPane cache
  const currentUserId = /* get from auth */
  documentCache.set(result.data.id, {
    userId: currentUserId,
    promptData: result.data,
    title: result.data.title || "",
    content: result.data.content || "",
    lastSaved: new Date()
  })
  
  openTab({ /* ... */ })
}
```

---

### Recommendation 4: Add Request Deduplication (Optional)

**Problem**: No protection against duplicate simultaneous requests  
**Location**: All server actions  
**Impact**: Low (edge case protection)  
**Solution**: Implement in-flight request cache  
**Effort**: 2-3 hours  
**Priority**: P2

**Implementation**: See P2-1 solution above.

---

## Implementation Priority

### Phase 1: Critical Fixes (P0) - 2-3 hours
**Priority**: Immediate  
**Impact**: 60-70% request reduction

1. **Remove DocumentToolbar getPromptDetails** (10 min)
   - File: `DocumentToolbar.tsx`
   - Action: Replace useEffect with Zustand lookup
   
2. **Implement Optimistic Updates** (1-2 hours)
   - File: `use-ui-store.ts`
   - Action: Add `addPrompt` and `removePrompt` actions
   
3. **Update All Mutation Handlers** (1 hour)
   - Files: `DocumentToolbar.tsx`, `EditorPane.tsx`, `FolderToolbar.tsx`
   - Action: Replace `triggerPromptRefetch()` with optimistic updates

### Phase 2: High Priority (P1) - 1-2 hours
**Priority**: This Sprint  
**Impact**: Additional 10-20% reduction

4. **Return Full Object from createPrompt** (30 min)
   - File: `actions.ts`
   - Action: Change return type and include folder relation
   
5. **Pre-populate Cache on Create** (30 min)
   - File: `DocumentToolbar.tsx`
   - Action: Add cache population after successful create

### Phase 3: Nice to Have (P2) - 2-3 hours
**Priority**: Future Sprint  
**Impact**: Edge case protection

6. **Request Deduplication** (2-3 hours)
   - Files: All server actions
   - Action: Implement in-flight request cache

---

## Testing Checklist

After implementing optimizations, verify:

- [ ] Tab switching still works (cache hits)
- [ ] New document creation works (1 request only)
- [ ] Document deletion works (1 request only)
- [ ] Document rename works (1 request only)
- [ ] PromptList updates immediately after mutations (optimistic)
- [ ] EditorPane loads from cache for new documents
- [ ] No console errors or warnings
- [ ] Network tab shows reduced request count
- [ ] UI feels snappier (no loading states during mutations)

---

## Expected Performance Gains

**Before Optimization**:
- Document selection: 1-2 requests
- Document creation: 3 requests
- Document rename: 2 requests
- Document deletion: 2 requests
- **Total for typical session** (10 creates, 5 renames, 3 deletes, 20 selections): **60-70 requests**

**After Optimization**:
- Document selection: 0-1 requests (cache)
- Document creation: 1 request
- Document rename: 1 request
- Document deletion: 1 request
- **Total for typical session**: **20-30 requests**

**Reduction: 60-70% fewer requests** 🎉

---

## Conclusion

The audit revealed significant opportunities for optimization. The critical issues (P0) should be addressed immediately as they account for the majority of unnecessary requests. 

The primary anti-pattern is the use of `triggerPromptRefetch()` after every mutation instead of optimistic updates. This causes full folder refetches when only local state updates are needed.

Implementing the P0 and P1 recommendations will result in a **VSCode-like snappy experience** with minimal server load.
