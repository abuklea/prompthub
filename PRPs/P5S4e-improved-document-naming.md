# PromptHub
## P5S4e - Improved Document Naming and Save Workflow

| `Title` | `Created` | `Last modified` |
|---------|-----------|-----------------|
| P5S4e - Improved Document Naming and Save Workflow | 08/11/2025 17:06 GMT+10 | 08/11/2025 17:06 GMT+10 |

## Table of Contents
- [Goal](#goal)
- [Why](#why)
- [What](#what)
- [Success Criteria](#success-criteria)
- [All Needed Context](#all-needed-context)
- [Implementation Blueprint](#implementation-blueprint)
- [Validation Loop](#validation-loop)
- [Anti-Patterns to Avoid](#anti-patterns-to-avoid)

---

## Goal

Enforce proper document title validation before persisting documents to the database, preventing users from saving documents with empty or placeholder titles like "[Untitled Doc]". Implement a clean workflow where new documents are created with null titles in the database but display meaningful placeholders in the UI, and require explicit title entry before allowing saves.

## Why

- **Data Quality**: Prevent accumulation of poorly-named documents with placeholder titles in the database
- **User Experience**: Clear workflow - new documents must be titled before saving, avoiding confusion
- **Database Integrity**: Empty or placeholder titles should never be persisted as permanent document names
- **Professional UX**: Follows standard application patterns (VSCode, Google Docs) where new documents require naming before save
- **Prevents User Errors**: Users closing unsaved documents get confirmation prompts to prevent accidental data loss

## What

Transform the document creation and save workflow to:

1. **New Document Creation**: Create database record with `title = NULL`, display "[Untitled Doc]" placeholder in UI
2. **Title Validation**: Prevent saving with empty, null, or placeholder pattern titles (e.g., "[Untitled Doc]", "[Untitled Doc 2]")
3. **Set Title Dialog**: Modal prompt for title entry when user attempts to save without valid title
4. **Close Confirmation**: Dialog when closing unsaved new documents, offering save/discard/cancel options
5. **Title Entry Flow**: If user chooses save from close dialog, cascade to title entry if needed
6. **Persistence Rule**: Documents only persist with valid titles after explicit "Save Version" action

### Success Criteria

- [ ] New documents created with `title = NULL` in database
- [ ] UI displays "[Untitled Doc]" for documents with null/empty title (PromptList and tabs)
- [ ] Save Version button validates title before proceeding
- [ ] SetTitleDialog opens when attempting to save without valid title
- [ ] Title validation rejects empty strings and placeholder patterns `/^\[Untitled Doc( \d+)?\]$/i`
- [ ] Closing tab with unsaved new document triggers UnsavedChangesDialog
- [ ] Save option from close dialog flows to title entry then save
- [ ] Canceling title dialog keeps document in tab without saving
- [ ] Database migration allows NULL title field
- [ ] Existing documents unaffected by changes
- [ ] TypeScript compilation succeeds
- [ ] All tests pass

---

## All Needed Context

### Documentation & References

```yaml
# MUST READ - Include these in your context window

- file: src/features/prompts/actions.ts
  why: Current createPrompt logic generates placeholder titles and saves immediately
  critical: Lines 48-100 show auto-generation of "[Untitled Doc N]" pattern that we're replacing

- file: src/features/prompts/components/DocumentDialogs.tsx
  why: RenameDocumentDialog pattern to mirror for SetTitleDialog
  critical: Form validation, dialog structure, submit handling (lines 122-185)

- file: src/features/prompts/components/DocumentToolbar.tsx
  why: Current document creation flow and rename dialog integration
  critical: handleNewDoc (lines 69-92) and handleConfirmRename (lines 98-110)

- file: src/features/editor/components/EditorPane.tsx
  why: Current save workflow and state management patterns
  critical: handleSave function (lines 279-326), isNewDocument tracking needed

- file: src/stores/use-tab-store.ts
  why: Tab close logic to intercept for unsaved document confirmation
  critical: closeTab method (lines 84-109), need to add confirmation check

- file: src/features/tabs/types.ts
  why: TabData interface needs isNewDocument flag
  critical: Add optional boolean flag to track unsaved new documents

- file: prisma/schema.prisma
  why: Database schema needs title field to allow NULL
  critical: Current "title String" must become "title String?"

- doc: https://www.prisma.io/docs/orm/prisma-migrate
  section: Modifying existing fields
  critical: How to safely migrate from required to optional field

- doc: https://ui.shadcn.com/docs/components/alert-dialog
  why: UnsavedChangesDialog component pattern
  critical: AlertDialog for destructive confirmations

- doc: https://ui.shadcn.com/docs/components/dialog
  why: SetTitleDialog component pattern
  critical: Modal dialog with form validation
```

### Current Codebase Patterns

**Document Creation Flow (Current)**:
```typescript
// src/features/prompts/actions.ts:33-121
export async function createPrompt(data: unknown) {
  // Current: Generates title automatically
  let title = parsed.data.title || "[Untitled Doc]"

  // Finds next available number for untitled docs
  if (!parsed.data.title) {
    const untitledDocs = await db.prompt.findMany({
      where: { title: { startsWith: "[Untitled Doc" } }
    })
    // Calculates next number...
  }

  // PROBLEM: Immediately persists placeholder title to database
  const prompt = await db.prompt.create({
    data: { title: title, ... }
  })
}
```

**Save Workflow (Current)**:
```typescript
// src/features/editor/components/EditorPane.tsx:279-326
const handleSave = async () => {
  // Current: No title validation
  const result = await saveNewVersion({
    promptId,
    newTitle: title,  // Accepts any title including placeholders
    newContent: content,
  })
}
```

**Tab Close (Current)**:
```typescript
// src/stores/use-tab-store.ts:84-109
closeTab: (tabId) => {
  // Current: No confirmation for unsaved documents
  const newTabs = tabs.filter(t => t.id !== tabId)
  set({ tabs: newTabs, ... })
}
```

### Known Gotchas & Library Quirks

```typescript
// CRITICAL: Prisma migration for nullable field
// When changing String -> String?, existing data is preserved
// Migration will succeed as long as no existing NULL values (we have none)

// CRITICAL: Zod validation pattern for placeholder detection
// Must use regex with case-insensitive flag and optional number group
// Pattern: /^\[Untitled Doc( \d+)?\]$/i
// Matches: "[Untitled Doc]", "[untitled doc]", "[Untitled Doc 2]"

// CRITICAL: TabData isNewDocument flag persistence
// Flag is in Zustand store with persist middleware
// Must reset to false after first successful save
// Otherwise old tabs will incorrectly show as "new" after reload

// CRITICAL: Dialog component hierarchy
// SetTitleDialog can open from EditorPane OR UnsavedChangesDialog
// Need state management to prevent double-open scenarios
// Use controlled open state with proper cleanup

// CRITICAL: Auto-save vs Manual save distinction
// autoSavePrompt: Should allow NULL title (saves content only)
// saveNewVersion: Must validate and require valid title
// Don't block auto-save or user loses drafts

// GOTCHA: Display helper must handle null AND empty string
// Database allows NULL, but some paths might set ""
// Helper: const getDisplayTitle = (title: string | null) => title || "[Untitled Doc]"
```

---

## Implementation Blueprint

### Data Models & Validation

```typescript
// prisma/schema.prisma
// MODIFY: Change title field to nullable
model Prompt {
  id         String   @id @default(uuid())
  user_id    String
  folder_id  String
  title      String?  // CHANGED: Was String, now nullable
  content    String   @default("")
  created_at DateTime @default(now())
  updated_at DateTime @updatedAt

  folder     Folder   @relation(fields: [folder_id], references: [id], onDelete: Cascade)
  // ... other relations
}
```

```typescript
// src/features/prompts/schemas.ts
// CREATE: Title validation schema
import { z } from "zod"

// Helper function to detect placeholder patterns
export function isPlaceholderTitle(title: string): boolean {
  const placeholderPattern = /^\[Untitled Doc( \d+)?\]$/i
  return placeholderPattern.test(title.trim())
}

// Validation schema for document titles
export const titleValidationSchema = z.string()
  .min(1, "Title cannot be empty")
  .refine(
    (val) => !isPlaceholderTitle(val),
    "Please provide a custom title for your document"
  )

// Export type for TypeScript
export type ValidTitle = z.infer<typeof titleValidationSchema>
```

```typescript
// src/lib/utils.ts or new src/features/prompts/utils.ts
// CREATE: Display helper function
export function getDisplayTitle(title: string | null | undefined): string {
  return title?.trim() || "[Untitled Doc]"
}
```

### Task List (Ordered by Dependencies)

```yaml
Task 1: Database Schema Migration
MODIFY prisma/schema.prisma:
  - FIND: "title      String"
  - REPLACE: "title      String?"
  - RUN: npx prisma migrate dev --name allow_null_document_title
  - VERIFY: Migration creates successfully
  - VERIFY: Existing documents retain their titles

Task 2: Validation Schemas and Helpers
MODIFY src/features/prompts/schemas.ts:
  - CREATE: isPlaceholderTitle(title: string) function
  - CREATE: titleValidationSchema using Zod
  - PATTERN: Use .refine() for custom validation
  - EXPORT: Both function and schema

CREATE src/features/prompts/utils.ts (or add to existing utils):
  - CREATE: getDisplayTitle(title: string | null) function
  - RETURN: "[Untitled Doc]" for null/empty, else actual title
  - EXPORT: Function for use in components

Task 3: Update createPrompt Server Action
MODIFY src/features/prompts/actions.ts:
  - FIND: createPrompt function (lines 33-121)
  - REMOVE: All "[Untitled Doc]" generation logic (lines 48-80)
  - MODIFY: Create with title: null instead of generated placeholder
  - PRESERVE: Duplicate title validation for non-null titles (lines 82-99)
  - KEEP: All other logic (user auth, folder validation, etc.)

Task 4: Update saveNewVersion with Title Validation
MODIFY src/features/prompts/actions.ts:
  - FIND: saveNewVersion function (lines 36-105)
  - ADD: Import titleValidationSchema from schemas
  - INJECT: Title validation before diff calculation
  - PATTERN:
    ```typescript
    // Validate title before saving
    const titleResult = titleValidationSchema.safeParse(newTitle)
    if (!titleResult.success) {
      return {
        success: false,
        error: "Please provide a valid title for your document"
      }
    }
    ```
  - PRESERVE: All existing transaction logic

Task 5: Update autoSavePrompt to Handle Null Titles
MODIFY src/features/editor/actions.ts:
  - FIND: autoSavePrompt function
  - MODIFY: Allow title parameter to be null or string
  - UPDATE: Type signature to: title: string | null
  - SKIP: Don't validate title in auto-save (allows drafts with no title)
  - PRESERVE: All other auto-save logic

Task 6: Create SetTitleDialog Component
CREATE src/features/prompts/components/SetTitleDialog.tsx:
  - MIRROR: RenameDocumentDialog pattern from DocumentDialogs.tsx
  - MODIFY: Purpose is setting initial title, not renaming
  - ADD: More prominent "Title Required" messaging
  - VALIDATE: Use titleValidationSchema on submit
  - EXPORT: SetTitleDialog component

Pseudocode:
```typescript
interface SetTitleDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onConfirm: (title: string) => void
  currentTitle?: string  // Optional, defaults to ""
}

export function SetTitleDialog({ open, onOpenChange, onConfirm, currentTitle = "" }) {
  const [title, setTitle] = useState(currentTitle)
  const [error, setError] = useState("")

  // Reset when dialog opens
  useEffect(() => {
    if (open) {
      setTitle(currentTitle)
      setError("")
    }
  }, [open, currentTitle])

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()

    // Validate using Zod schema
    const result = titleValidationSchema.safeParse(title)
    if (!result.success) {
      setError(result.error.errors[0].message)
      return
    }

    onConfirm(title.trim())
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Set Document Title</DialogTitle>
            <DialogDescription>
              Please provide a title for this document before saving.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="document-title">Title *</Label>
              <Input
                id="document-title"
                value={title}
                onChange={(e) => {
                  setTitle(e.target.value)
                  setError("") // Clear error on change
                }}
                placeholder="Enter document title"
                autoFocus
              />
              {error && (
                <p className="text-sm text-destructive">{error}</p>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit">
              Save with Title
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
```

Task 7: Create UnsavedChangesDialog Component
CREATE src/features/tabs/components/UnsavedChangesDialog.tsx:
  - MIRROR: DeleteDocumentDialog pattern from DocumentDialogs.tsx
  - MODIFY: Three actions (Save/Discard/Cancel) instead of two
  - USE: AlertDialog for warning context
  - EXPORT: UnsavedChangesDialog component

Pseudocode:
```typescript
interface UnsavedChangesDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSave: () => void | Promise<void>
  onDiscard: () => void | Promise<void>
  documentTitle: string
}

export function UnsavedChangesDialog({
  open,
  onOpenChange,
  onSave,
  onDiscard,
  documentTitle
}) {
  const handleSave = async () => {
    await onSave()
    onOpenChange(false)
  }

  const handleDiscard = async () => {
    await onDiscard()
    onOpenChange(false)
  }

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Unsaved Document</AlertDialogTitle>
          <AlertDialogDescription>
            "{documentTitle}" has not been saved yet.
            Do you want to save it before closing?
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <Button variant="destructive" onClick={handleDiscard}>
            Discard
          </Button>
          <AlertDialogAction onClick={handleSave}>
            Save
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
```

Task 8: Update TabData Types
MODIFY src/features/tabs/types.ts:
  - FIND: TabData interface (lines 32-42)
  - ADD: isNewDocument?: boolean field
  - COMMENT: // True for documents not yet saved with valid title

Task 9: Update Tab Store with Close Confirmation
MODIFY src/stores/use-tab-store.ts:
  - FIND: closeTab method (lines 84-109)
  - ADD: Check for isNewDocument flag before closing
  - CREATE: closeTabWithConfirmation(tabId) method
  - PATTERN: Return boolean indicating if should show dialog
  - USAGE: UI components call this to check before closing

Pseudocode:
```typescript
// Add to store interface
shouldConfirmClose: (tabId: string) => boolean
closeTabDirectly: (tabId: string) => void

// Implementation
shouldConfirmClose: (tabId) => {
  const tab = get().tabs.find(t => t.id === tabId)
  return tab?.isNewDocument === true
}

closeTabDirectly: (tabId) => {
  // Original closeTab logic, renamed
  const tabs = get().tabs
  const index = tabs.findIndex(t => t.id === tabId)
  if (index === -1) return
  if (tabs[index].isPinned) return

  const newTabs = tabs.filter(t => t.id !== tabId)
  let newActiveId = get().activeTabId

  if (newActiveId === tabId) {
    if (newTabs.length > 0) {
      newActiveId = newTabs[Math.min(index, newTabs.length - 1)].id
    } else {
      newActiveId = null
    }
  }

  set({
    tabs: newTabs,
    activeTabId: newActiveId,
    layout: removeTabFromLayout(get().layout, tabId)
  })
}
```

Task 10: Update EditorPane with Save Validation
MODIFY src/features/editor/components/EditorPane.tsx:
  - ADD: State for SetTitleDialog visibility
  - FIND: handleSave function (lines 279-326)
  - INJECT: Title validation before saveNewVersion call
  - PATTERN: If validation fails, open SetTitleDialog
  - ADD: handleSetTitle callback to update title and retry save
  - UPDATE: After successful save, set tab isNewDocument to false

Pseudocode:
```typescript
// Add state
const [showSetTitleDialog, setShowSetTitleDialog] = useState(false)
const [pendingSave, setPendingSave] = useState(false)

// Modify handleSave
const handleSave = useCallback(async () => {
  if (!promptId) return

  // Validate title first
  const titleResult = titleValidationSchema.safeParse(title)
  if (!titleResult.success) {
    // Title invalid - prompt user to set title
    setShowSetTitleDialog(true)
    return
  }

  // Title valid - proceed with save
  setSaving(true)
  const result = await saveNewVersion({
    promptId,
    newTitle: title,
    newContent: content,
  })

  if (result.success) {
    toast.success("Version saved successfully")
    clearLocalContent()
    setLastSaved(new Date())

    // CRITICAL: Mark document as no longer "new"
    updateTab(tabId, { isNewDocument: false })

    // Update cache and prompt data...
  } else {
    toast.error(result.error)
  }
  setSaving(false)
}, [promptId, title, content, tabId, updateTab, clearLocalContent])

// Handle title set from dialog
const handleSetTitle = (newTitle: string) => {
  setTitle(newTitle)
  setShowSetTitleDialog(false)

  // Trigger save after title is set
  // Use setTimeout to ensure state update completes
  setTimeout(() => {
    handleSave()
  }, 0)
}

// Add dialog to render
<SetTitleDialog
  open={showSetTitleDialog}
  onOpenChange={setShowSetTitleDialog}
  onConfirm={handleSetTitle}
  currentTitle={title}
/>
```

Task 11: Update PromptList Display
MODIFY src/features/prompts/components/PromptList.tsx:
  - IMPORT: getDisplayTitle from utils
  - FIND: Prompt title display in map (around line 179-222)
  - REPLACE: prompt.title with getDisplayTitle(prompt.title)
  - APPLY: To both list item display and tab creation

Task 12: Update DocumentTab Display
MODIFY src/features/tabs/components/DocumentTab.tsx:
  - IMPORT: getDisplayTitle from utils
  - FIND: Tab title span (line 125-132)
  - REPLACE: tab.title with getDisplayTitle(tab.title)
  - PRESERVE: isPreview italic styling

Task 13: Integrate UnsavedChangesDialog in Tab Close Flow
MODIFY src/features/tabs/components/DocumentTab.tsx:
  - ADD: State for UnsavedChangesDialog
  - MODIFY: Close button onClick handler
  - CHECK: useTabStore.shouldConfirmClose(tab.id) before closing
  - SHOW: UnsavedChangesDialog if confirmation needed
  - IMPLEMENT: onSave, onDiscard, onCancel handlers

Pseudocode:
```typescript
const [showUnsavedDialog, setShowUnsavedDialog] = useState(false)
const { shouldConfirmClose, closeTabDirectly } = useTabStore()

const handleClose = () => {
  if (shouldConfirmClose(tab.id)) {
    setShowUnsavedDialog(true)
  } else {
    onClose() // Original close behavior
  }
}

const handleSaveAndClose = async () => {
  // Trigger save in EditorPane
  // This might open SetTitleDialog if title is invalid
  // After save completes, close tab
  // Implementation depends on EditorPane exposing save handler
}

const handleDiscardAndClose = async () => {
  // If document was persisted to DB, delete it
  if (tab.promptId) {
    await deletePrompt(tab.promptId)
  }
  closeTabDirectly(tab.id)
}

// In render
<UnsavedChangesDialog
  open={showUnsavedDialog}
  onOpenChange={setShowUnsavedDialog}
  onSave={handleSaveAndClose}
  onDiscard={handleDiscardAndClose}
  documentTitle={getDisplayTitle(tab.title)}
/>
```

Task 14: Update DocumentToolbar New Doc Creation
MODIFY src/features/prompts/components/DocumentToolbar.tsx:
  - FIND: handleNewDoc function (lines 69-92)
  - MODIFY: After createPrompt success, mark tab as isNewDocument
  - UPDATE: selectPrompt and openTab calls to set flag

Pseudocode:
```typescript
const handleNewDoc = async () => {
  if (!selectedFolder) return

  setCreatingDoc(true)
  const result = await createPrompt({
    folderId: selectedFolder,
    // No title - server creates with NULL
  })

  if (!result.success) {
    toast.error(result.error, { duration: 6000 })
    setCreatingDoc(false)
    return
  }

  toast.success("Document created successfully", { duration: 3000 })

  if (result.data?.promptId) {
    // Open tab with isNewDocument flag
    openTab({
      type: 'document',
      title: "", // Empty title - will display as placeholder
      promptId: result.data.promptId,
      isNewDocument: true  // CRITICAL: Mark as new
    })
    selectPrompt(result.data.promptId)
    triggerPromptRefetch()
  }
  setCreatingDoc(false)
}
```
```

### Integration Points

```yaml
DATABASE:
  - migration: "npx prisma migrate dev --name allow_null_document_title"
  - schema: "Change Prompt.title from String to String?"
  - verify: "Existing documents preserve titles, new documents can have NULL"

VALIDATION:
  - schema: "src/features/prompts/schemas.ts"
  - pattern: "titleValidationSchema with placeholder rejection"
  - reuse: "Apply same schema in rename dialog for consistency"

STATE_MANAGEMENT:
  - zustand: "src/stores/use-tab-store.ts"
  - add: "shouldConfirmClose method for dialog trigger check"
  - add: "closeTabDirectly for direct close without confirmation"
  - flag: "isNewDocument in TabData for tracking unsaved documents"

UI_COMPONENTS:
  - create: "SetTitleDialog in src/features/prompts/components/"
  - create: "UnsavedChangesDialog in src/features/tabs/components/"
  - modify: "EditorPane to integrate SetTitleDialog in save flow"
  - modify: "DocumentTab to integrate UnsavedChangesDialog in close flow"

ACTIONS:
  - modify: "createPrompt to set title: null"
  - modify: "saveNewVersion to validate title"
  - modify: "autoSavePrompt to accept null title"
  - keep: "renamePrompt validation as-is"
```

---

## Validation Loop

### Level 1: Syntax & Type Checking

```bash
# Database migration must succeed
npx prisma migrate dev --name allow_null_document_title
# Expected: Migration file created, database updated
# Verify: SELECT title FROM "Prompt" WHERE title IS NULL; (should show new docs)

# TypeScript compilation
npm run build
# Expected: No type errors
# Common issue: Ensure all title usage accounts for null possibility

# Type checking
npx tsc --noEmit
# Expected: 0 errors
# Watch for: title parameter in functions now accepts null

# Linting
npm run lint
# Expected: No linting errors
# Auto-fix: npm run lint -- --fix
```

### Level 2: Unit Tests

```typescript
// CREATE: src/features/prompts/__tests__/schemas.test.ts
import { titleValidationSchema, isPlaceholderTitle } from '../schemas'

describe('isPlaceholderTitle', () => {
  it('should return true for exact placeholder', () => {
    expect(isPlaceholderTitle('[Untitled Doc]')).toBe(true)
  })

  it('should return true for numbered placeholder', () => {
    expect(isPlaceholderTitle('[Untitled Doc 2]')).toBe(true)
    expect(isPlaceholderTitle('[Untitled Doc 10]')).toBe(true)
  })

  it('should be case insensitive', () => {
    expect(isPlaceholderTitle('[untitled doc]')).toBe(true)
    expect(isPlaceholderTitle('[UNTITLED DOC 5]')).toBe(true)
  })

  it('should return false for valid titles', () => {
    expect(isPlaceholderTitle('My Document')).toBe(false)
    expect(isPlaceholderTitle('Project Plan')).toBe(false)
  })
})

describe('titleValidationSchema', () => {
  it('should reject empty string', () => {
    const result = titleValidationSchema.safeParse('')
    expect(result.success).toBe(false)
  })

  it('should reject placeholder patterns', () => {
    expect(titleValidationSchema.safeParse('[Untitled Doc]').success).toBe(false)
    expect(titleValidationSchema.safeParse('[Untitled Doc 3]').success).toBe(false)
  })

  it('should accept valid titles', () => {
    expect(titleValidationSchema.safeParse('My Document').success).toBe(true)
    expect(titleValidationSchema.safeParse('Project Plan v2').success).toBe(true)
  })
})
```

```typescript
// CREATE: src/features/prompts/__tests__/utils.test.ts
import { getDisplayTitle } from '../utils'

describe('getDisplayTitle', () => {
  it('should return placeholder for null', () => {
    expect(getDisplayTitle(null)).toBe('[Untitled Doc]')
  })

  it('should return placeholder for empty string', () => {
    expect(getDisplayTitle('')).toBe('[Untitled Doc]')
    expect(getDisplayTitle('  ')).toBe('[Untitled Doc]')
  })

  it('should return actual title when valid', () => {
    expect(getDisplayTitle('My Document')).toBe('My Document')
  })
})
```

```bash
# Run unit tests
npm test -- schemas.test.ts utils.test.ts
# Expected: All tests pass
# If failing: Read error, fix implementation, re-run
```

### Level 3: Integration Testing

**Test Scenario 1: Create and Save New Document with Title Prompt**

```bash
# Manual test steps:
1. Log in to application
2. Select a folder
3. Click "New Doc" button
4. Verify: "[Untitled Doc]" appears in PromptList
5. Verify: Tab shows "[Untitled Doc]" (italic if preview)
6. Type some content in editor
7. Click "Save Version" button
8. Verify: SetTitleDialog opens with "Please provide a title"
9. Leave title empty and click "Save with Title"
10. Verify: Error message "Title cannot be empty" appears
11. Enter "[Untitled Doc]" and click "Save with Title"
12. Verify: Error message "Please provide a custom title" appears
13. Enter "Test Document" and click "Save with Title"
14. Verify: Success toast "Version saved successfully"
15. Verify: Tab title updates to "Test Document"
16. Verify: PromptList shows "Test Document"
17. Verify: Database query shows title: "Test Document"

# Database verification
npx prisma studio
# Navigate to Prompt table
# Find the test document
# Verify: title = "Test Document" (not NULL, not placeholder)
```

**Test Scenario 2: Close Unsaved New Document**

```bash
# Manual test steps:
1. Create new document (as above, steps 1-5)
2. Type some content
3. Click X button on tab
4. Verify: UnsavedChangesDialog opens
5. Verify: Message includes "[Untitled Doc]" title
6. Verify: Three buttons: Cancel, Discard, Save
7. Click "Cancel"
8. Verify: Dialog closes, tab remains open
9. Click X button again
10. Click "Discard"
11. Verify: Tab closes
12. Verify: Document deleted from database
13. Verify: No "[Untitled Doc]" in PromptList

# Database verification (after discard)
# Document should NOT exist in database
```

**Test Scenario 3: Save from Close Dialog**

```bash
# Manual test steps:
1. Create new document
2. Type content
3. Click X button on tab
4. Click "Save" in UnsavedChangesDialog
5. Verify: SetTitleDialog opens (cascaded)
6. Enter valid title "Saved from Close"
7. Click "Save with Title"
8. Verify: Document saves successfully
9. Verify: Tab closes after save
10. Verify: Document appears in PromptList with correct title
11. Verify: Database has document with title "Saved from Close"
```

**Test Scenario 4: Existing Documents Unaffected**

```bash
# Manual test steps:
1. Open existing document (with title already set)
2. Edit content
3. Click "Save Version"
4. Verify: Saves immediately without SetTitleDialog
5. Close and reopen document
6. Verify: Title displays correctly (not placeholder)
7. Verify: All existing documents maintain their titles
```

### Level 4: Edge Case Testing

```bash
# Edge case 1: Multiple untitled docs in same folder
1. Create document 1 - shows "[Untitled Doc]"
2. Create document 2 - shows "[Untitled Doc]"
3. Both show same placeholder (no auto-numbering)
4. Save each with different titles
5. Verify: Both save correctly

# Edge case 2: Auto-save with null title
1. Create new document
2. Type content
3. Wait 500ms for auto-save
4. Verify: Content saves, title remains NULL
5. Refresh page
6. Verify: Content persists, title still shows "[Untitled Doc]"

# Edge case 3: Rename to empty/placeholder
1. Select existing document
2. Click Rename
3. Try to rename to "" or "[Untitled Doc]"
4. Verify: Validation prevents rename
5. Error message shown

# Edge case 4: Tab persistence across reload
1. Create new document, don't save
2. Reload page
3. Verify: Unsaved document gone (expected behavior)
4. Create and save document
5. Reload page
6. Verify: Document persists with title
```

---

## Final Validation Checklist

- [ ] All tests pass: `npm test`
- [ ] No linting errors: `npm run lint`
- [ ] No type errors: `npx tsc --noEmit`
- [ ] Build succeeds: `npm run build`
- [ ] Database migration applied successfully
- [ ] Manual test scenario 1 passes (save with title prompt)
- [ ] Manual test scenario 2 passes (close unsaved)
- [ ] Manual test scenario 3 passes (save from close)
- [ ] Manual test scenario 4 passes (existing docs unaffected)
- [ ] All edge cases tested and passing
- [ ] SetTitleDialog validates correctly
- [ ] UnsavedChangesDialog flows correctly
- [ ] Placeholder display works in list and tabs
- [ ] Auto-save preserves content with null title
- [ ] Database contains no documents with placeholder titles
- [ ] Existing documents retain their titles after migration

---

## Anti-Patterns to Avoid

- ❌ Don't save placeholder titles to database - keep title NULL until user provides valid name
- ❌ Don't block auto-save for documents without titles - users need draft protection
- ❌ Don't show SetTitleDialog on every edit - only on manual save attempt
- ❌ Don't allow closing SetTitleDialog to proceed with save - cancel should abort save
- ❌ Don't forget to reset isNewDocument flag after successful save - causes infinite prompts
- ❌ Don't validate title in auto-save - breaks draft workflow
- ❌ Don't hard-code placeholder strings everywhere - use getDisplayTitle helper
- ❌ Don't skip migration testing - ensure NULL titles don't break queries
- ❌ Don't forget to delete document on "Discard" - prevents orphaned records
- ❌ Don't make title required in database without migration - breaks existing code
- ❌ Don't use async state updates in dialog flows - causes race conditions
- ❌ Don't forget to handle both null AND empty string in display logic

---

**Confidence Score: 9/10**

This PRP provides comprehensive context for implementing the improved document naming workflow. The agent has access to:
- Exact patterns from existing dialog components
- Current workflows to modify
- Clear validation requirements
- Database migration strategy
- Complete task breakdown with pseudocode
- Extensive testing scenarios

Minor uncertainty exists around dialog state coordination between SetTitleDialog and UnsavedChangesDialog when cascading, but the sequential flow described should handle it correctly.

----
**PRP Status**: TODO
**PRP ID**: P5S4e
**Archon Project**: PromptHub (d449f266-1f36-47ad-bd2d-30f1a0f5e999)
**PRP Document**: PRPs/P5S4e-improved-document-naming.md
**Tasks**: 14 tasks (P5S4eT1 - P5S4eT14)
**Phase**: Phase 5 - Prompt Editor & Version Control
**Dependencies**: P5S4c (Complete)
**Next PRP**: P5S5 - Version History UI
**Recommendations:**
Agents:
- `senior-frontend-engineer` (Tasks 6, 7, 10, 11, 12, 13, 14)
- `senior-backend-engineer` (Tasks 1, 3, 4, 5)
- `ux-ui-designer` (Tasks 6, 7 - review dialog UX)
- `qa-test-automation-engineer` (Tasks in parallel - write tests for validation)
Notes:**
- T1 (Database migration) first - blocking dependency
- T2 (Validation schemas) second - reusable utilities
- T3-5 (Backend actions) in parallel after T1-T2
- T6-7 (Dialog components) in parallel with T3-5
- T8-14 (Integration) after T3-7 complete
- Run full test suite before marking complete
**Estimated Implementation Time (FTE):** 8-12 hours (1-1.5 days)
