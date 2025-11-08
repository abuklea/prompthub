# PromptHub
## P5S4b - Fix Critical Bugs, Subheader Design, and Tooltip System

| `Title` | `Created` | `Last modified` |
|---------|-----------|-----------------|
| P5S4b - Fix Critical Bugs, Subheader Design, and Tooltip System | 07/11/2025 21:31 GMT+10 | 07/11/2025 21:31 GMT+10 |

## Table of Contents
- [Executive Summary](#executive-summary)
- [Issues Overview](#issues-overview)
- [Root Cause Analysis](#root-cause-analysis)
- [Solution Architecture](#solution-architecture)
- [Implementation Tasks](#implementation-tasks)
- [File Changes Map](#file-changes-map)
- [Testing Strategy](#testing-strategy)
- [Validation Gates](#validation-gates)
- [References](#references)

## Executive Summary

This PRP addresses **four critical issues** affecting user experience in the PromptHub application:

1. **CRITICAL BUG**: Wrong document content displayed when switching between documents
2. **UI Update Bug**: Changes to folders/documents not reflected immediately (requires page reload)
3. **Design Inconsistency**: Folder and document panel subheaders have different visual styles
4. **Missing UX Feature**: No tooltips on interactive UI controls

**Priority**: P0 (Critical bug blocking core functionality)
**Estimated Time**: 4-6 hours
**Complexity**: Medium (requires state management refactoring)

## Issues Overview

### Issue 1: CRITICAL - Wrong Document Displayed (P0)

**Symptom**: When clicking different documents in column 2, the same document content is always shown in the editor (column 3). The displayed document appears to be the last saved document, regardless of which document is selected.

**User Impact**: Users cannot view or edit different documents - core functionality is broken.

**Example Scenario**:
1. User has 3 documents: "Doc A", "Doc B", "Doc C"
2. User edits and saves "Doc C"
3. User clicks "Doc A" → sees "Doc C" content
4. User clicks "Doc B" → still sees "Doc C" content
5. Only page reload shows correct content

### Issue 2: UI Not Updating After CRUD Operations

**Symptom**: When folders or documents are created/renamed/deleted, the UI does not reflect changes immediately. Changes only appear after manual page reload.

**User Impact**: Users must manually refresh after every operation, creating confusion about whether operations succeeded.

**Example Scenarios**:
- Create new folder → folder not visible until reload
- Rename folder → old name persists until reload
- Delete folder → folder still visible until reload
- Same behavior for document operations

### Issue 3: Subheader Design Inconsistency

**Symptom**: Column 1 (Folders) uses icon-only buttons, while Column 2 (Documents) uses text buttons. This creates visual inconsistency and wastes horizontal space.

**User Impact**: Inconsistent UI patterns reduce usability and look unprofessional.

**Current State**:
- Folders toolbar: Icon buttons (Plus, Edit, Trash2)
- Documents toolbar: Text buttons ("New Doc", "Rename", "Delete")

**Desired State**: Both toolbars should use icon-only buttons with consistent styling.

### Issue 4: Missing Tooltips

**Symptom**: Interactive UI controls have no tooltips. Icon buttons use native `title` attribute which provides inconsistent UX.

**User Impact**: Users cannot discover what buttons do without clicking them.

**Required**: Proper tooltip component with:
- Consistent styling across application
- Configurable delay (~700ms)
- Accessible implementation (keyboard navigation)

## Root Cause Analysis

### Issue 1: localStorage Hook State Persistence Bug

**File**: `src/features/editor/components/EditorPane.tsx`

**Root Cause**: The `useLocalStorage` hook (lines 56-59) maintains state across document switches, causing stale localStorage content to override newly fetched prompt data.

**Code Analysis**:
```typescript
// Line 56-59: localStorage key is based on selectedPrompt
const [localContent, setLocalContent, clearLocalContent] = useLocalStorage({
  key: selectedPrompt ? `prompt-${selectedPrompt}` : 'prompt-draft',
  initialValue: ''
})

// Lines 95-105: Content sync effect
useEffect(() => {
  if (promptData?.content) {
    // BUG: localContent from OLD document persists when switching
    if (localContent && localContent !== promptData.content) {
      setContent(localContent)  // ← Uses OLD localStorage value
    } else {
      setContent(promptData.content)
    }
  }
}, [promptData, localContent])
```

**Race Condition Flow**:
1. User selects Document A (selectedPrompt changes)
2. `loadPrompt` useEffect fetches Document A data (lines 62-92)
3. `localContent` still contains Document B's cached content
4. Content sync effect runs (lines 95-105)
5. Since localContent exists, it uses OLD content instead of new promptData
6. Document A's UI shows Document B's content

**Evidence**:
- localStorage keys are document-specific (`prompt-${promptId}`)
- The hook doesn't reset when `selectedPrompt` changes
- The effect prioritizes localStorage over fresh DB data

### Issue 2: Missing Refetch Mechanism

**Files**:
- `src/features/folders/components/FolderTree.tsx`
- `src/features/prompts/components/PromptList.tsx`
- `src/features/folders/components/FolderToolbar.tsx`
- `src/features/prompts/components/DocumentToolbar.tsx`

**Root Cause**: Architectural mismatch between mutation operations and list components.

**FolderTree Issue**:
```typescript
// Line 15-27: useEffect only runs on mount
useEffect(() => {
  async function loadFolders() {
    try {
      const rootFolders = await getRootFolders()
      setFolders(rootFolders)
    } catch (error) {
      console.error("Failed to fetch root folders:", error)
    } finally {
      setLoading(false)
    }
  }
  loadFolders()
}, [])  // ← Empty deps = only runs once
```

**FolderToolbar Pattern**:
```typescript
// Line 20-22: Uses router.refresh() which doesn't trigger FolderTree refetch
await createFolder(newName, null)
router.refresh()  // ← Doesn't communicate with FolderTree
toast.success("Folder created successfully")
```

**Why It Fails**:
1. FolderToolbar calls server action (creates/renames/deletes)
2. Calls `router.refresh()` which is a Next.js pattern
3. FolderTree has empty dependency array, never refetches
4. Local state in FolderTree is stale

**PromptList Partial Solution**:
```typescript
// Line 32: Has selectedPrompt in deps, so refetches when selection changes
}, [selectedFolder, selectedPrompt])
```
This works for creation (because new prompt is auto-selected), but not for rename/delete.

**Solution Needed**: Shared refetch trigger mechanism in Zustand store.

### Issue 3: Button Design Mismatch

**Evidence**:
- FolderToolbar (lines 74-104): Icon buttons with `<Plus>`, `<Edit>`, `<Trash2>`
- DocumentToolbar (lines 60-90): Text buttons with "New Doc", "Rename", "Delete"

**Impact**: Wastes ~180px of horizontal space in Column 2, creates visual inconsistency.

### Issue 4: No Tooltip Infrastructure

**Current State**:
- No shadcn tooltip component installed
- Buttons use native `title` attribute
- Inconsistent across different browsers
- No keyboard accessibility
- No control over delay, styling, or positioning

**Required**: Install and integrate shadcn/ui Tooltip component.

## Solution Architecture

### Solution 1: Fix EditorPane Content Sync

**Approach**: Add cleanup effect to reset content when selectedPrompt changes.

```typescript
// Add cleanup effect BEFORE content sync effect
useEffect(() => {
  // Reset content state when switching documents
  if (selectedPrompt) {
    setContent("")  // Clear stale content immediately
  }
}, [selectedPrompt])

// Existing content sync effect (lines 95-105) runs after cleanup
useEffect(() => {
  if (promptData?.content) {
    if (localContent && localContent !== promptData.content) {
      setContent(localContent)
    } else {
      setContent(promptData.content)
    }
  }
}, [promptData, localContent])
```

**Why This Works**:
1. When selectedPrompt changes, content is immediately cleared
2. loadPrompt fetches new data
3. Content sync effect sets correct content from new promptData
4. No race condition because content starts empty

**Alternative Approach**: Modify useLocalStorage hook to reset on key change (more complex).

### Solution 2: Zustand Refetch Trigger

**Approach**: Add a refetch counter to Zustand store that components can listen to.

```typescript
// src/stores/use-ui-store.ts
interface UiState {
  // ... existing state
  folderRefetchTrigger: number
  promptRefetchTrigger: number

  // Actions to increment triggers
  triggerFolderRefetch: () => void
  triggerPromptRefetch: () => void
}

export const useUiStore = create<UiState>((set) => ({
  // ... existing state
  folderRefetchTrigger: 0,
  promptRefetchTrigger: 0,

  triggerFolderRefetch: () =>
    set((state) => ({ folderRefetchTrigger: state.folderRefetchTrigger + 1 })),
  triggerPromptRefetch: () =>
    set((state) => ({ promptRefetchTrigger: state.promptRefetchTrigger + 1 })),
}))
```

**Usage Pattern**:
```typescript
// FolderToolbar: After mutation
await createFolder(newName, null)
triggerFolderRefetch()  // ← Increment counter
toast.success("Folder created")

// FolderTree: Listen to trigger
const { folderRefetchTrigger } = useUiStore()
useEffect(() => {
  loadFolders()
}, [folderRefetchTrigger])  // ← Refetch when counter changes
```

**Why This Works**:
- Immutable counter changes trigger React re-renders (Zustand pattern)
- Components can choose which triggers to listen to
- Simple, predictable, testable
- No props drilling needed

### Solution 3: Icon-Based DocumentToolbar

**Approach**: Replace text buttons with icons matching FolderToolbar pattern.

**Icon Mapping**:
- "New Doc" → `<FileText>` or `<FilePlus>`
- "Rename" → `<Edit>` or `<Pencil>`
- "Delete" → `<Trash2>`

**Button Styling** (from FolderToolbar pattern):
```typescript
<Button
  variant="ghost"
  size="sm"
  className="min-w-[32px] shrink-0"
>
  <IconComponent className="h-4 w-4" />
</Button>
```

### Solution 4: Shadcn Tooltip System

**Installation**:
```bash
npx shadcn-ui@latest add tooltip
```

**Root Setup** (`src/app/(app)/layout.tsx`):
```typescript
import { TooltipProvider } from "@/components/ui/tooltip"

export default function AppLayout({ children }) {
  return (
    <TooltipProvider delayDuration={700}>
      {children}
    </TooltipProvider>
  )
}
```

**Usage Pattern**:
```typescript
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"

<Tooltip>
  <TooltipTrigger asChild>
    <Button variant="ghost" size="sm">
      <Plus className="h-4 w-4" />
    </Button>
  </TooltipTrigger>
  <TooltipContent>
    <p>Create new folder</p>
  </TooltipContent>
</Tooltip>
```

## Implementation Tasks

### Task 1: Fix EditorPane Content Sync Bug (CRITICAL)

**Priority**: P0
**Estimated Time**: 30 minutes

**Changes**: `src/features/editor/components/EditorPane.tsx`

**Implementation**:
1. Add cleanup effect before line 95 (before content sync effect)
2. Reset content state when selectedPrompt changes
3. Add comment explaining race condition fix

**Code**:
```typescript
// Add after line 92, before line 95
// Reason: Reset content when switching documents to prevent stale localStorage bug (P5S4bT1)
useEffect(() => {
  if (selectedPrompt) {
    setContent("")  // Clear immediately to prevent showing wrong document
  }
}, [selectedPrompt])
```

**Acceptance Criteria**:
- ✅ Switching between documents shows correct content immediately
- ✅ No flash of wrong content before correct content loads
- ✅ localStorage still works for unsaved changes on same document

**Testing**:
1. Create 3 documents with distinct content
2. Edit and save Document C
3. Click Document A → verify shows Document A content
4. Click Document B → verify shows Document B content
5. Click Document C → verify shows Document C content
6. Rapid clicking between documents → all show correct content

---

### Task 2: Add Refetch Triggers to Zustand Store

**Priority**: P1
**Estimated Time**: 20 minutes

**Changes**: `src/stores/use-ui-store.ts`

**Implementation**:
1. Add folderRefetchTrigger and promptRefetchTrigger counters (default: 0)
2. Add triggerFolderRefetch and triggerPromptRefetch actions
3. Update TypeScript interfaces

**Code**:
```typescript
// Add to interface (after line 17)
folderRefetchTrigger: number
promptRefetchTrigger: number

// Add to actions (after line 28)
triggerFolderRefetch: () => void
triggerPromptRefetch: () => void

// Add to store (after line 41)
folderRefetchTrigger: 0,
promptRefetchTrigger: 0,

// Add to store (after line 61)
triggerFolderRefetch: () =>
  set((state) => ({ folderRefetchTrigger: state.folderRefetchTrigger + 1 })),
triggerPromptRefetch: () =>
  set((state) => ({ promptRefetchTrigger: state.promptRefetchTrigger + 1 })),
```

**Acceptance Criteria**:
- ✅ Store compiles without TypeScript errors
- ✅ Counters increment correctly when actions called
- ✅ Zustand devtools show state updates

---

### Task 3: Update FolderTree to Use Refetch Trigger

**Priority**: P1
**Estimated Time**: 30 minutes

**Changes**: `src/features/folders/components/FolderTree.tsx`

**Implementation**:
1. Import triggerFolderRefetch from useUiStore
2. Add folderRefetchTrigger to loadFolders useEffect dependencies
3. Remove router import (no longer needed)

**Code**:
```typescript
// Update line 13
const { folderSort, folderFilter, folderRefetchTrigger } = useUiStore()

// Update line 15-27 useEffect deps
useEffect(() => {
  async function loadFolders() {
    try {
      const rootFolders = await getRootFolders()
      setFolders(rootFolders)
    } catch (error) {
      console.error("Failed to fetch root folders:", error)
    } finally {
      setLoading(false)
    }
  }
  loadFolders()
}, [folderRefetchTrigger])  // ← Add dependency
```

**Acceptance Criteria**:
- ✅ FolderTree refetches when trigger increments
- ✅ No infinite loops or performance issues
- ✅ Loading state displays during refetch

---

### Task 4: Update FolderToolbar to Trigger Refetch

**Priority**: P1
**Estimated Time**: 20 minutes

**Changes**: `src/features/folders/components/FolderToolbar.tsx`

**Implementation**:
1. Import triggerFolderRefetch from useUiStore
2. Replace router.refresh() calls with triggerFolderRefetch()
3. Remove router import

**Code**:
```typescript
// Update line 13
const { selectedFolder, folderSort, folderFilter, setFolderSort, setFolderFilter, triggerFolderRefetch } = useUiStore()

// Update handleNewFolder (replace line 21)
await createFolder(newName, null)
triggerFolderRefetch()  // ← Replace router.refresh()

// Update handleRenameFolder (replace line 36)
await renameFolder(selectedFolder, newName)
triggerFolderRefetch()  // ← Replace router.refresh()

// Update handleDeleteFolder (replace line 50)
await deleteFolder(selectedFolder)
triggerFolderRefetch()  // ← Replace router.refresh()
```

**Acceptance Criteria**:
- ✅ Creating folder shows immediately in list
- ✅ Renaming folder updates immediately in list
- ✅ Deleting folder removes immediately from list
- ✅ No page reload required

**Testing**: Perform all CRUD operations and verify immediate UI updates.

---

### Task 5: Update PromptList to Use Refetch Trigger

**Priority**: P1
**Estimated Time**: 20 minutes

**Changes**: `src/features/prompts/components/PromptList.tsx`

**Implementation**:
1. Import promptRefetchTrigger from useUiStore
2. Add promptRefetchTrigger to loadPrompts useEffect dependencies

**Code**:
```typescript
// Update line 10
const { selectedFolder, selectPrompt, selectedPrompt, docSort, docFilter, promptRefetchTrigger } = useUiStore()

// Update line 32 deps
}, [selectedFolder, selectedPrompt, promptRefetchTrigger])  // ← Add dependency
```

**Acceptance Criteria**:
- ✅ PromptList refetches when trigger increments
- ✅ List updates immediately after create/rename/delete

---

### Task 6: Update DocumentToolbar to Trigger Refetch

**Priority**: P1
**Estimated Time**: 15 minutes

**Changes**: `src/features/prompts/components/DocumentToolbar.tsx`

**Implementation**:
1. Import triggerPromptRefetch from useUiStore
2. Call triggerPromptRefetch() after successful operations
3. Add rename and delete handlers (currently placeholder)

**Code**:
```typescript
// Update line 19
const { selectedFolder, selectedPrompt, docSort, docFilter, setDocSort, setDocFilter, selectPrompt, triggerPromptRefetch } = useUiStore()

// Update handleNewDoc (after line 52)
if (result.data?.promptId) {
  selectPrompt(result.data.promptId)
  triggerPromptRefetch()  // ← Add trigger
}
```

**Note**: Rename and delete handlers will be implemented in separate tasks (beyond this PRP scope).

---

### Task 7: Install Shadcn Tooltip Component

**Priority**: P1
**Estimated Time**: 10 minutes

**Implementation**:
```bash
cd /home/allan/projects/PromptHub
npx shadcn-ui@latest add tooltip
```

**Acceptance Criteria**:
- ✅ Tooltip component created at `src/components/ui/tooltip.tsx`
- ✅ No installation errors
- ✅ Component exports Tooltip, TooltipTrigger, TooltipContent, TooltipProvider

---

### Task 8: Add TooltipProvider to Root Layout

**Priority**: P1
**Estimated Time**: 10 minutes

**Changes**: `src/app/(app)/layout.tsx`

**Implementation**:
1. Import TooltipProvider
2. Wrap children with TooltipProvider
3. Set delayDuration to 700ms

**Code**:
```typescript
import { TooltipProvider } from "@/components/ui/tooltip"

// Wrap the return JSX
<TooltipProvider delayDuration={700}>
  <ResizablePanelsLayout>
    {/* existing content */}
  </ResizablePanelsLayout>
</TooltipProvider>
```

**Acceptance Criteria**:
- ✅ App compiles without errors
- ✅ Tooltip context available to all child components

---

### Task 9: Update FolderToolbar with Tooltips

**Priority**: P2
**Estimated Time**: 30 minutes

**Changes**: `src/features/folders/components/FolderToolbar.tsx`

**Implementation**:
1. Import Tooltip components
2. Wrap each icon button with Tooltip
3. Remove title attributes
4. Add descriptive tooltip text

**Code Pattern**:
```typescript
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"

// Replace lines 74-82
<Tooltip>
  <TooltipTrigger asChild>
    <Button
      variant="ghost"
      size="sm"
      onClick={handleNewFolder}
      className="min-w-[32px] shrink-0"
    >
      <Plus className="h-4 w-4" />
    </Button>
  </TooltipTrigger>
  <TooltipContent>
    <p>Create new folder</p>
  </TooltipContent>
</Tooltip>
```

**Tooltip Text**:
- Plus button: "Create new folder"
- Edit button: "Rename selected folder"
- Trash button: "Delete selected folder"
- Sort dropdown: "Sort folders by name or date"
- Filter input: "Filter folders by name"

**Acceptance Criteria**:
- ✅ All buttons show tooltips on hover after 700ms delay
- ✅ Tooltips dismiss on mouse leave
- ✅ Tooltips work with keyboard navigation
- ✅ No title attribute tooltips remaining

---

### Task 10: Update DocumentToolbar with Icons and Tooltips

**Priority**: P2
**Estimated Time**: 45 minutes

**Changes**: `src/features/prompts/components/DocumentToolbar.tsx`

**Implementation**:
1. Import icon components: FilePlus, Edit, Trash2
2. Import Tooltip components
3. Replace text buttons with icon buttons
4. Wrap each button with Tooltip
5. Match FolderToolbar styling

**Code Pattern**:
```typescript
import { FilePlus, Edit, Trash2, ChevronDown } from "lucide-react"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"

// Replace lines 60-68 (New Doc button)
<Tooltip>
  <TooltipTrigger asChild>
    <Button
      variant="ghost"
      size="sm"
      disabled={!selectedFolder || creatingDoc}
      onClick={handleNewDoc}
      className="min-w-[32px] shrink-0"
    >
      <FilePlus className="h-4 w-4" />
    </Button>
  </TooltipTrigger>
  <TooltipContent>
    <p>{!selectedFolder ? "Select a folder first" : "Create new document"}</p>
  </TooltipContent>
</Tooltip>

// Similar for Rename (Edit icon) and Delete (Trash2 icon)
```

**Icon Choices**:
- New Doc: `<FilePlus>` (consistent with "Plus" pattern)
- Rename: `<Edit>` (matches FolderToolbar)
- Delete: `<Trash2>` (matches FolderToolbar)

**Tooltip Text**:
- FilePlus: "Create new document" (or "Select a folder first" when disabled)
- Edit: "Rename selected document" (or "Select a document first" when disabled)
- Trash2: "Delete selected document" (or "Select a document first" when disabled)
- Sort dropdown: "Sort documents by title, date, or size"
- Filter input: "Filter documents by title"

**Acceptance Criteria**:
- ✅ All buttons use icons instead of text
- ✅ Icon size matches FolderToolbar (h-4 w-4)
- ✅ Button styling matches FolderToolbar
- ✅ All buttons have tooltips with 700ms delay
- ✅ Disabled states show appropriate tooltip messages
- ✅ Visual consistency with Folders panel

---

### Task 11: Update Implementation Plan Document

**Priority**: P2
**Estimated Time**: 15 minutes

**Changes**: `docs/project/PromptHub_06_PLAN_01.md`

**Implementation**:
1. Add new step P5S4b after P5S4 (line 272) and before P5S5 (line 274)
2. Follow existing format and structure
3. Reference this PRP document

**Code**:
```markdown
- Step 4b: [P] Fix Critical Bugs, Subheader Design, and Tooltip System
  - **Task**: Fix critical EditorPane content sync bug causing wrong documents to display, implement Zustand refetch triggers for immediate UI updates after CRUD operations, standardize subheader designs with icon-only buttons, and integrate shadcn Tooltip component with 700ms hover delay across all interactive controls.
  - **Assignee**: `senior-frontend-engineer`
  - **Files**:
    - **MODIFY**: `src/features/editor/components/EditorPane.tsx` - Add content reset effect
    - **MODIFY**: `src/stores/use-ui-store.ts` - Add refetch triggers
    - **MODIFY**: `src/features/folders/components/FolderTree.tsx` - Use refetch trigger
    - **MODIFY**: `src/features/folders/components/FolderToolbar.tsx` - Trigger refetch, add tooltips
    - **MODIFY**: `src/features/prompts/components/PromptList.tsx` - Use refetch trigger
    - **MODIFY**: `src/features/prompts/components/DocumentToolbar.tsx` - Icon buttons, tooltips, trigger refetch
    - **MODIFY**: `src/app/(app)/layout.tsx` - Add TooltipProvider wrapper
    - **CREATE**: `src/components/ui/tooltip.tsx` - Shadcn tooltip component
  - **Step Dependencies**: Phase 5, Step 4
  - **User Instructions**: (1) Switching documents shows correct content immediately, (2) CRUD operations update UI without page reload, (3) All subheader buttons use consistent icon design, (4) All interactive controls show tooltips after 700ms hover, (5) Tooltip text is descriptive and context-aware. Full implementation details in `PRPs/P5S4b-fix-subheader-tooltips-design.md`.
```

**Acceptance Criteria**:
- ✅ New step inserted in correct location
- ✅ Formatting matches existing steps
- ✅ All files listed
- ✅ User instructions are clear

## File Changes Map

### Files to Modify

| File | Changes | Lines | Complexity |
|------|---------|-------|------------|
| `src/features/editor/components/EditorPane.tsx` | Add content reset effect | ~95 | Low |
| `src/stores/use-ui-store.ts` | Add refetch triggers and actions | ~17-62 | Low |
| `src/features/folders/components/FolderTree.tsx` | Add refetch dependency | ~13, 27 | Low |
| `src/features/folders/components/FolderToolbar.tsx` | Replace router.refresh with trigger, add tooltips | ~13-140 | Medium |
| `src/features/prompts/components/PromptList.tsx` | Add refetch dependency | ~10, 32 | Low |
| `src/features/prompts/components/DocumentToolbar.tsx` | Icon buttons, tooltips, trigger refetch | ~1-123 | Medium |
| `src/app/(app)/layout.tsx` | Add TooltipProvider | ~1 | Low |

### Files to Create

| File | Purpose | Size |
|------|---------|------|
| `src/components/ui/tooltip.tsx` | Shadcn tooltip component | ~100 lines |

### Dependencies to Install

```bash
# Shadcn tooltip component (includes @radix-ui/react-tooltip)
npx shadcn-ui@latest add tooltip
```

## Testing Strategy

### Manual Testing Checklist

**Issue 1: EditorPane Content Bug**
- [ ] Create 3 documents with distinct content (use emoji or unique titles)
- [ ] Edit and save Document C
- [ ] Click Document A → verify correct content shown
- [ ] Click Document B → verify correct content shown
- [ ] Click Document C → verify correct content shown
- [ ] Rapidly switch between all 3 → verify no wrong content flashes
- [ ] Make edits without saving → verify localStorage still works
- [ ] Switch away and back → verify unsaved changes restored

**Issue 2: UI Update After CRUD**
- [ ] Create new folder → verify appears immediately
- [ ] Rename folder → verify name updates immediately
- [ ] Delete folder → verify disappears immediately
- [ ] Create new document → verify appears immediately
- [ ] Create 5 folders rapidly → verify all appear
- [ ] Verify no page reload required for any operation

**Issue 3: Design Consistency**
- [ ] Verify FolderToolbar has icon-only buttons
- [ ] Verify DocumentToolbar has icon-only buttons
- [ ] Verify both toolbars use same button size (h-4 w-4 icons)
- [ ] Verify both toolbars use same button spacing
- [ ] Verify visual alignment across both panels

**Issue 4: Tooltip System**
- [ ] Hover over each button → verify tooltip appears after ~700ms
- [ ] Verify tooltip text is descriptive and helpful
- [ ] Tab through buttons with keyboard → verify tooltips appear
- [ ] Verify tooltips dismiss on mouse leave
- [ ] Verify disabled buttons show appropriate tooltip messages
- [ ] Test on mobile (touch) → verify tooltips work

### Automated Testing

**Unit Tests** (if applicable):
```typescript
// Test refetch trigger increments
test('triggerFolderRefetch increments counter', () => {
  const { result } = renderHook(() => useUiStore())
  const initialCount = result.current.folderRefetchTrigger

  act(() => {
    result.current.triggerFolderRefetch()
  })

  expect(result.current.folderRefetchTrigger).toBe(initialCount + 1)
})
```

**Integration Tests**:
- Test folder CRUD operations trigger refetch
- Test document CRUD operations trigger refetch
- Test EditorPane content switching

### Performance Testing

- [ ] Switch between 10+ documents rapidly → no lag
- [ ] Create 20+ folders → UI updates smoothly
- [ ] Monitor Zustand devtools → no unnecessary re-renders
- [ ] Check React DevTools Profiler → acceptable render times

## Validation Gates

**Pre-Implementation**:
```bash
# Ensure dev server is running
npm run dev

# Check current state
git status

# Create feature branch
git checkout -b fix/P5S4b-critical-bugs-tooltips
```

**During Implementation**:
```bash
# After each task, verify compilation
npm run build

# Check TypeScript errors
npx tsc --noEmit

# Run linter
npm run lint
```

**Post-Implementation**:
```bash
# Full build
npm run build

# Verify no errors
echo $?  # Should be 0

# Manual testing (see checklist above)
npm run dev

# Commit changes
git add .
git commit -m "fix: P5S4b - Fix critical EditorPane bug, add refetch triggers, tooltips (P5S4b)"

# Update plan document
git add docs/project/PromptHub_06_PLAN_01.md
git commit -m "docs: Add P5S4b to implementation plan"
```

**Success Criteria**:
- ✅ All 4 issues resolved
- ✅ No TypeScript errors
- ✅ No ESLint errors
- ✅ Build completes successfully
- ✅ All manual tests pass
- ✅ No regressions in existing functionality
- ✅ Code follows project style guidelines

## References

### Documentation
- **Shadcn Tooltip**: https://ui.shadcn.com/docs/components/tooltip
- **React useEffect**: https://react.dev/reference/react/useEffect
- **Zustand Best Practices**: https://github.com/pmndrs/zustand

### Issue Threads
- **Zustand Immutability**: https://github.com/pmndrs/zustand/issues/244
- **Zustand Re-renders**: https://github.com/pmndrs/zustand/discussions/1653

### Icons (Lucide React)
- **FilePlus**: New document icon
- **Edit**: Rename/edit icon
- **Trash2**: Delete icon
- **Plus**: Create new icon

### Existing Patterns in Codebase
- **FolderToolbar**: Icon-only button pattern (lines 74-104)
- **PromptList**: Refetch on selection pattern (line 32)
- **PanelSubheader**: Consistent header design (src/components/layout/PanelSubheader.tsx)

### Key Insights from Research

1. **EditorPane Bug**: localStorage hook doesn't reset between document switches
2. **Zustand Immutability**: State updates must return new objects (already correct)
3. **Next.js Patterns**: router.refresh() doesn't communicate with client state
4. **Tooltip UX**: 700ms delay is standard for hover tooltips
5. **Icon Consistency**: All toolbars should use same icon size (h-4 w-4)

---

**PRP Status**: READY
**PRP ID**: P5S4b
**Archon Project**: PromptHub (d449f266-1f36-47ad-bd2d-30f1a0f5e999)
**PRP Document**: PRPs/P5S4b-fix-subheader-tooltips-design.md
**Tasks**: 11 tasks (P5S4bT1-P5S4bT11)
**Phase**: Phase 5 - Prompt Editor & Version Control
**Dependencies**: P5S4 (Complete)
**Next PRP**: P5S5 - Version History UI
**Recommendations:**
Agents:
- `senior-frontend-engineer` (Tasks 1-11)
Notes:
- T1 is CRITICAL priority - fix immediately
- T2-T6 should be implemented together (refetch system)
- T7-T10 can be done in parallel after T6 complete
- Test thoroughly after T1 to verify bug fix before proceeding
**Estimated Implementation Time (FTE)**: 4-6 hours

**PRP Confidence Score**: 8/10
- Clear understanding of all root causes
- Solutions validated against existing patterns
- Comprehensive testing strategy
- All dependencies documented
- Minor risk: useLocalStorage hook internals not fully examined
