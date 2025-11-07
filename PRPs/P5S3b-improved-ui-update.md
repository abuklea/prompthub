# PromptHub
## P5S3b - Improved UI Update: Layout, Editor, Toolbars & Features

| `Title` | `Created` | `Last modified` |
|---------|-----------|-----------------|
| P5S3b - Improved UI Update: Layout, Editor, Toolbars & Features | 07/11/2025 15:45 GMT+10 | 07/11/2025 15:45 GMT+10 |

## Table of Contents
- [Goal](#goal)
- [Why](#why)
- [What](#what)
- [Success Criteria](#success-criteria)
- [All Needed Context](#all-needed-context)
- [Current Codebase Structure](#current-codebase-structure)
- [Desired Codebase Structure](#desired-codebase-structure)
- [Known Gotchas](#known-gotchas)
- [Implementation Blueprint](#implementation-blueprint)
- [Validation Loop](#validation-loop)
- [Anti-Patterns to Avoid](#anti-patterns-to-avoid)

---

## Goal

Transform the PromptHub UI from a basic 3-panel layout into a professional, feature-rich application with:
1. **Full-height Monaco editor** with proper scrolling and toolbar access
2. **Duplicate title prevention** with user-friendly conflict resolution
3. **Subfolder creation** capability for hierarchical organization
4. **Consistent panel subheaders** with context-aware toolbars and controls
5. **Comprehensive sort/filter systems** for folders and documents
6. **Auto-save with manual versioning** - auto-save for safety, manual save for versions
7. **Placeholder UI** for future features (version history, dashboard, settings)

## Why

**Business Value:**
- **User Experience**: Professional UI increases user confidence and engagement
- **Productivity**: Auto-save prevents data loss, toolbars provide quick access to common operations
- **Organization**: Subfolders and filtering enable managing large prompt libraries
- **Data Integrity**: Duplicate prevention avoids confusion and accidental overwrites

**Technical Value:**
- **Scalability**: Proper layout structure supports future feature additions
- **Maintainability**: Component-based toolbar system is easier to extend
- **User Retention**: Auto-save and version control are table-stakes features for text editors

## What

### Feature Requirements

**1. Monaco Editor Full Height (Critical UX Issue)**
- Editor must extend from below title input to page footer
- Proper scrolling for long documents
- Full Monaco toolbar/context menu access
- Fixed footer with save button always visible

**2. Duplicate Title Prevention**
- Validate title uniqueness within folder before prompt creation
- User-friendly error message with opportunity to choose different title
- Case-insensitive comparison

**3. Subfolder Creation**
- "Add Subfolder" button when folder is selected
- Recursive folder display with visual indentation
- Depth limit (5 levels) to prevent UI issues

**4. Panel Subheaders**
- Three aligned subheaders (one per panel)
- Distinguished from main header (reduced height, different styling)
- Panel 1: "Folders" with folder-specific tools
- Panel 2: "Documents" (renamed from "Prompts") with document tools
- Panel 3: Context-dependent (editor/dashboard/settings)

**5. Sort & Filter Toolbars**
- Folders: Sort by name/date, filter by search text
- Documents: Sort by title/date/size, filter by search text
- Context-aware rename/delete buttons

**6. Auto-Save vs Manual Save**
- Auto-save: Debounced (500ms), updates current prompt content, no version created
- Manual save (Ctrl+S or button): Creates new version using diff system
- localStorage persistence for unsaved changes
- Visual indicators (saving, saved, unsaved changes)

**7. Placeholder UI Elements**
- Version history button in editor subheader (shows "Coming Soon")
- Dashboard page with placeholder stats cards
- Settings page structure with disabled future sections

### Success Criteria

- [ ] Monaco editor visible for new prompts and extends to footer
- [ ] Editor scrolls properly for documents >50 lines
- [ ] Cannot create two prompts with same title in same folder
- [ ] Can create subfolders up to 5 levels deep
- [ ] All three panels have visible, aligned subheaders
- [ ] Can sort folders by name A-Z, Z-A
- [ ] Can filter documents by search text
- [ ] Changes auto-save after 500ms of inactivity
- [ ] Ctrl+S creates new version (not auto-save)
- [ ] Unsaved changes persist in localStorage
- [ ] Version history button present (disabled)
- [ ] Dashboard page renders with placeholders
- [ ] Settings page renders with placeholders

## All Needed Context

### Documentation & References

```yaml
# Monaco Editor Integration
- url: https://microsoft.github.io/monaco-editor/
  section: API Documentation > IStandaloneEditorConstructionOptions
  why: Configure editor options, scrolling, and toolbar features
  critical: Monaco requires parent container with explicit height (px or vh)

- url: https://www.npmjs.com/package/@monaco-editor/react
  section: Usage Examples
  why: React wrapper patterns, beforeMount vs onMount
  critical: Must use dynamic import with ssr:false for Next.js compatibility

- url: https://stackoverflow.com/questions/45654579/height-of-the-monaco-editor
  why: CSS patterns for full-height Monaco in flex containers
  critical: Parent must be display:flex flex-direction:column with explicit height

# Existing Codebase Patterns
- file: src/features/editor/components/Editor.tsx
  why: Monaco configuration pattern, theme setup, beforeMount/onMount usage
  critical: Use same dynamic import pattern, theme configuration approach

- file: src/features/editor/components/EditorPane.tsx
  why: Current editor integration, needs layout restructuring
  critical: Change from nested divs to proper flex layout

- file: src/features/folders/components/FolderItem.tsx
  why: Folder operations pattern (rename, delete), state management
  critical: Use same toast notification, error handling patterns

- file: src/features/folders/actions.ts
  why: Server action pattern with getFolderChildren for subfolder support
  critical: Already has getFolderChildren - just needs UI integration

- file: src/features/prompts/actions.ts
  why: createPrompt action needs duplicate validation added
  critical: Query existing prompts before insert, return ActionResult

- file: src/stores/use-ui-store.ts
  why: Zustand state management for UI state
  critical: Add sort/filter state here, maintain immutability

- file: src/app/(app)/layout.tsx
  why: Current 3-panel layout structure
  critical: Add subheader row between Header and panels

# React Patterns
- pattern: Auto-save with debouncing
  implementation: useEffect + setTimeout + cleanup
  example: |
    const [content, setContent] = useState('')
    useEffect(() => {
      const timer = setTimeout(() => autoSave(content), 500)
      return () => clearTimeout(timer)
    }, [content])

- pattern: localStorage persistence
  implementation: useEffect with localStorage.getItem/setItem
  example: |
    useEffect(() => {
      const saved = localStorage.getItem(`prompt-${id}`)
      if (saved) setContent(saved)
    }, [id])

    useEffect(() => {
      localStorage.setItem(`prompt-${id}`, content)
    }, [content, id])

- pattern: Keyboard shortcuts
  implementation: useEffect with window.addEventListener('keydown')
  example: |
    useEffect(() => {
      const handler = (e: KeyboardEvent) => {
        if ((e.ctrlKey || e.metaKey) && e.key === 's') {
          e.preventDefault()
          handleManualSave()
        }
      }
      window.addEventListener('keydown', handler)
      return () => window.removeEventListener('keydown', handler)
    }, [handleManualSave])
```

### Current Codebase Structure

```
src/
├── app/
│   ├── (app)/
│   │   ├── layout.tsx              # Main 3-panel layout (MODIFY)
│   │   ├── page.tsx                # Welcome page (MODIFY to redirect)
│   │   ├── dashboard/              # NEW - placeholder dashboard
│   │   ├── settings/               # EXISTS - needs placeholder content
│   │   └── profile/                # EXISTS
│   └── (auth)/
├── components/
│   ├── layout/
│   │   └── Header.tsx              # Main app header (exists)
│   └── ui/                         # Shadcn components
├── features/
│   ├── editor/
│   │   ├── components/
│   │   │   ├── Editor.tsx          # Monaco wrapper (EXISTS - good)
│   │   │   ├── EditorPane.tsx      # MODIFY - fix layout
│   │   │   └── EditorSkeleton.tsx
│   │   ├── actions.ts              # MODIFY - add autoSavePrompt
│   │   ├── schemas.ts              # NEW - validation schemas
│   │   ├── hooks/                  # NEW directory
│   │   └── types.ts
│   ├── folders/
│   │   ├── components/
│   │   │   ├── FolderTree.tsx      # MODIFY - add toolbar
│   │   │   ├── FolderItem.tsx      # MODIFY - add subfolder support
│   │   │   └── FolderToolbar.tsx   # NEW - sort/filter/actions
│   │   └── actions.ts              # EXISTS - has createFolder(parentId)
│   └── prompts/
│       ├── components/
│       │   ├── PromptList.tsx      # MODIFY - rename to Documents
│       │   └── DocumentToolbar.tsx # NEW - sort/filter/actions
│       ├── actions.ts              # MODIFY - add duplicate validation
│       └── schemas.ts              # EXISTS - extend as needed
├── stores/
│   └── use-ui-store.ts             # MODIFY - add sort/filter state
└── lib/
    └── utils.ts                    # MODIFY - add debounce utility
```

### Desired Codebase Structure

```
src/
├── app/
│   ├── (app)/
│   │   ├── layout.tsx              # MODIFIED - added subheader row
│   │   ├── page.tsx                # MODIFIED - redirect to dashboard
│   │   ├── dashboard/
│   │   │   └── page.tsx            # NEW - placeholder dashboard
│   │   └── settings/
│   │       └── page.tsx            # MODIFIED - placeholder sections
├── components/
│   └── layout/
│       ├── Header.tsx              # Unchanged
│       └── PanelSubheader.tsx      # NEW - reusable subheader component
├── features/
│   ├── editor/
│   │   ├── components/
│   │   │   ├── Editor.tsx          # Unchanged (already good)
│   │   │   ├── EditorPane.tsx      # MODIFIED - flex layout, auto-save
│   │   │   ├── EditorToolbar.tsx   # NEW - save, undo/redo, version button
│   │   │   └── EditorFooter.tsx    # NEW - save button, status indicator
│   │   ├── hooks/
│   │   │   ├── useAutoSave.ts      # NEW - debounced auto-save logic
│   │   │   └── useLocalStorage.ts  # NEW - localStorage persistence
│   │   ├── actions.ts              # MODIFIED - added autoSavePrompt()
│   │   └── schemas.ts              # NEW - validation schemas
│   ├── folders/
│   │   ├── components/
│   │   │   ├── FolderTree.tsx      # MODIFIED - integrated toolbar
│   │   │   ├── FolderItem.tsx      # MODIFIED - recursive subfolder UI
│   │   │   └── FolderToolbar.tsx   # NEW - new/rename/delete/sort/filter
│   │   └── actions.ts              # Unchanged (already supports subfolders)
│   └── prompts/
│       ├── components/
│       │   ├── PromptList.tsx      # MODIFIED - renamed references
│       │   └── DocumentToolbar.tsx # NEW - new/rename/delete/sort/filter
│       └── actions.ts              # MODIFIED - duplicate validation
├── stores/
│   └── use-ui-store.ts             # MODIFIED - sort/filter state
└── lib/
    └── utils.ts                    # MODIFIED - debounce utility
```

### Known Gotchas

```typescript
// CRITICAL: Monaco Editor Height Requirements
// Parent container MUST have explicit height for Monaco to render
// ❌ WRONG: height: auto, height: 100% without parent height
// ✅ CORRECT: height: 100vh, h-screen, or flex-1 with parent flex

// Example from Stack Overflow:
// https://stackoverflow.com/questions/45654579/height-of-the-monaco-editor
const EditorContainer = () => (
  <div className="flex flex-col h-screen">  {/* Explicit height */}
    <div className="flex-none">Title</div>
    <div className="flex-1">  {/* Takes remaining space */}
      <Editor height="100%" />  {/* Now 100% has context */}
    </div>
  </div>
)

// CRITICAL: Auto-save Debouncing
// Don't save on every keystroke - causes DB performance issues
// Use 500ms debounce (standard for text editors)
// Clear timer on component unmount to prevent memory leaks

// CRITICAL: Duplicate Title Validation
// Must be case-insensitive to prevent "Test" and "test"
// Use Prisma findFirst with where clause before insert

await db.prompt.findFirst({
  where: {
    folder_id: folderId,
    user_id: userId,
    title: {
      equals: title,
      mode: 'insensitive'  // Case-insensitive comparison
    }
  }
})

// CRITICAL: Subfolder Recursion Limit
// Prevent infinite loops and UI overflow
// Limit depth to 5 levels maximum

const FolderItem = ({ folder, depth = 0 }) => {
  if (depth >= 5) return null  // Stop recursion
  // ... render folder and children
}

// CRITICAL: localStorage Cleanup
// Clear localStorage on successful manual save
// Prevents stale data if user closes browser before auto-save

const handleManualSave = async () => {
  await saveNewVersion(...)
  localStorage.removeItem(`prompt-${promptId}`)  // Clear draft
}

// CRITICAL: Keyboard Shortcuts
// Prevent browser default behavior for Ctrl+S

window.addEventListener('keydown', (e) => {
  if ((e.ctrlKey || e.metaKey) && e.key === 's') {
    e.preventDefault()  // MUST prevent browser save dialog
    handleManualSave()
  }
})

// CRITICAL: Next.js Server Actions
// Must have "use server" directive at top of file
// Must return ActionResult type for type safety

"use server"

export async function autoSavePrompt(data: unknown): Promise<ActionResult> {
  // Validation, auth check, database operation
  // Return { success: true, data: ... } or { success: false, error: ... }
}

// CRITICAL: Zustand State Updates
// Must be immutable - create new objects/sets

set((state) => ({
  expandedFolders: new Set(state.expandedFolders).add(folderId)  // ✅ New Set
  // NOT: state.expandedFolders.add(folderId)  // ❌ Mutates state
}))

// GOTCHA: Monaco Options
// Some options only work in beforeMount, others only in onMount
// beforeMount: defineTheme, setModelLanguage
// onMount: updateOptions, focus, setPosition

// GOTCHA: Prisma RLS Enforcement
// Always include user_id filter in where clause
// Never trust client-provided IDs without auth check

const supabase = createClient()
const { data: { user } } = await supabase.auth.getUser()
if (!user) return { success: false, error: "Unauthorized" }

await db.prompt.findFirst({
  where: {
    id: promptId,
    user_id: user.id  // ⚠️ CRITICAL - prevents accessing other users' data
  }
})
```

## Implementation Blueprint

### Task Breakdown (18 Tasks)

```yaml
# ========================================
# GROUP A: LAYOUT FOUNDATION (Sequential)
# ========================================

Task 1: Create PanelSubheader Component
  priority: CRITICAL
  files:
    CREATE: src/components/layout/PanelSubheader.tsx
  description: |
    Reusable subheader component that sits between main header and panels.
    Accepts children for panel-specific toolbar content.
  pseudocode: |
    interface PanelSubheaderProps {
      title: string
      children?: React.ReactNode
      className?: string
    }

    export function PanelSubheader({ title, children, className }: PanelSubheaderProps) {
      return (
        <div className={cn(
          "flex items-center justify-between",
          "h-12 px-4 border-b bg-muted/30",
          className
        )}>
          <h2 className="text-sm font-semibold">{title}</h2>
          <div className="flex items-center gap-2">
            {children}
          </div>
        </div>
      )
    }
  validation:
    - Component renders with title
    - Children slot accepts toolbar buttons
    - Styling matches design (h-12, border-b)

Task 2: Update Layout with Subheader Row
  priority: CRITICAL
  files:
    MODIFY: src/app/(app)/layout.tsx
  description: |
    Add subheader row between Header and main content.
    Ensure 3 subheaders align with 3 panels below.
  pattern: |
    FIND: Current structure with Header + 3 panels
    REPLACE: Header + Subheader row (3 cols) + 3 panels
  pseudocode: |
    <div className="flex flex-col h-screen">
      <Header user={data.user} />

      {/* NEW: Subheader row */}
      <div className="flex border-b">
        <div className="w-64 border-r">
          <PanelSubheader title="Folders">
            {/* Folder toolbar buttons */}
          </PanelSubheader>
        </div>
        <div className="w-96 border-r">
          <PanelSubheader title="Documents">
            {/* Document toolbar buttons */}
          </PanelSubheader>
        </div>
        <div className="flex-1">
          <PanelSubheader title="Editor">
            {/* Editor toolbar buttons */}
          </PanelSubheader>
        </div>
      </div>

      {/* Existing panels - adjust height */}
      <div className="flex flex-1 overflow-hidden">
        <aside className="w-64 p-4 border-r overflow-y-auto">
          <FolderTree />
        </aside>
        <main className="w-96 p-4 border-r overflow-y-auto">
          <PromptList />
        </main>
        <section className="flex-1 overflow-hidden">
          <EditorPane />
        </section>
      </div>
    </div>
  validation:
    - Three subheaders visible and aligned
    - Panel widths match (w-64, w-96, flex-1)
    - No layout shift from previous version

Task 3: Fix EditorPane Layout for Full-Height Monaco
  priority: CRITICAL
  files:
    MODIFY: src/features/editor/components/EditorPane.tsx
  description: |
    Restructure EditorPane to use proper flex layout.
    Ensure Monaco editor extends to footer.
  pattern: |
    FIND: Current nested div structure
    REPLACE: Flex column layout with explicit heights
  pseudocode: |
    // Remove outer padding - EditorPane should fill section completely
    return (
      <div className="flex flex-col h-full">
        {/* Title section - fixed height */}
        <div className="flex-none p-4 space-y-2 border-b">
          <Label htmlFor="prompt-title">Title</Label>
          <Input
            id="prompt-title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
        </div>

        {/* Editor section - takes remaining space */}
        <div className="flex-1 overflow-hidden">
          <Editor
            value={content}
            onChange={setContent}
            language="markdown"
            height="100%"  // Now 100% has context (parent is flex-1)
            options={{
              scrollBeyondLastLine: false,
              wordWrap: 'on',
              lineNumbers: 'on',
              minimap: { enabled: false }
            }}
          />
        </div>

        {/* Footer - fixed height */}
        <div className="flex-none p-4 border-t bg-muted/30">
          <div className="flex justify-end gap-2">
            <span className="text-xs text-muted-foreground self-center">
              {savingStatus}
            </span>
            <Button onClick={handleManualSave} disabled={saving}>
              {saving ? "Saving..." : "Save Version"}
            </Button>
          </div>
        </div>
      </div>
    )
  validation:
    - Monaco editor visible from page load
    - Editor extends to footer (no white space)
    - Scrollbars appear for long content
    - Layout works on different screen heights

# ========================================
# GROUP B: FOLDER PANEL (Parallel after GROUP A)
# ========================================

Task 4: Add Subfolder Support to FolderItem
  priority: HIGH
  files:
    MODIFY: src/features/folders/components/FolderItem.tsx
  description: |
    Enable recursive folder rendering with visual indentation.
    Add "Add Subfolder" button when folder is expanded.
    Limit depth to 5 levels.
  pattern: |
    MIRROR: Recursive component pattern
    ADD: depth prop, indentation styling, subfolder button
  pseudocode: |
    interface FolderItemProps {
      folder: Folder
      depth?: number  // NEW - track nesting level
      onUpdate: (folderId: string, updated: Folder) => void
      onDelete: (folderId: string) => void
    }

    export function FolderItem({ folder, depth = 0, onUpdate, onDelete }: FolderItemProps) {
      const [children, setChildren] = useState<Folder[]>([])
      const [expanded, setExpanded] = useState(false)

      // Limit depth to prevent UI overflow
      if (depth >= 5) return null

      // Load children when expanded
      useEffect(() => {
        if (expanded) {
          getFolderChildren(folder.id).then(setChildren)
        }
      }, [expanded, folder.id])

      const handleAddSubfolder = async () => {
        const name = prompt("Subfolder name")
        if (name) {
          const newFolder = await createFolder(name, folder.id)  // parentId
          setChildren([...children, newFolder].sort(...))
        }
      }

      return (
        <div>
          <div
            className={cn("flex items-center gap-2 p-2", {
              "pl-4": depth === 1,
              "pl-8": depth === 2,
              "pl-12": depth === 3,
              "pl-16": depth === 4,
            })}
          >
            <ChevronRight
              className={cn("transition-transform", expanded && "rotate-90")}
              onClick={() => setExpanded(!expanded)}
            />
            <span>{folder.name}</span>
            {expanded && depth < 4 && (
              <Button size="sm" variant="ghost" onClick={handleAddSubfolder}>
                + Subfolder
              </Button>
            )}
          </div>

          {/* Recursive render children */}
          {expanded && children.map(child => (
            <FolderItem
              key={child.id}
              folder={child}
              depth={depth + 1}
              onUpdate={onUpdate}
              onDelete={onDelete}
            />
          ))}
        </div>
      )
    }
  validation:
    - Can create subfolder under root folder
    - Subfolders visually indented (4 levels visible)
    - Cannot create subfolder at depth 5
    - Subfolders persist after collapse/expand

Task 5: Add Folder Toolbar Component
  priority: MEDIUM
  files:
    CREATE: src/features/folders/components/FolderToolbar.tsx
  description: |
    Toolbar with New Folder, Rename, Delete, Sort, Filter controls.
    Dynamically enables/disables based on selection.
  pseudocode: |
    export function FolderToolbar() {
      const { selectedFolder } = useUiStore()
      const { folderSort, folderFilter, setFolderSort, setFolderFilter } = useUiStore()

      return (
        <div className="flex items-center gap-2">
          <Button size="sm" variant="ghost" onClick={handleNewFolder}>
            <Plus className="h-4 w-4" />
          </Button>

          <Button
            size="sm"
            variant="ghost"
            onClick={handleRename}
            disabled={!selectedFolder}
          >
            <Edit className="h-4 w-4" />
          </Button>

          <Button
            size="sm"
            variant="ghost"
            onClick={handleDelete}
            disabled={!selectedFolder}
          >
            <Trash className="h-4 w-4" />
          </Button>

          <Separator orientation="vertical" className="h-4" />

          <Select value={folderSort} onValueChange={setFolderSort}>
            <SelectTrigger className="w-32 h-8">
              <SelectValue placeholder="Sort by..." />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="name-asc">Name A-Z</SelectItem>
              <SelectItem value="name-desc">Name Z-A</SelectItem>
              <SelectItem value="date-asc">Oldest</SelectItem>
              <SelectItem value="date-desc">Newest</SelectItem>
            </SelectContent>
          </Select>

          <Input
            placeholder="Filter..."
            className="w-32 h-8"
            value={folderFilter}
            onChange={(e) => setFolderFilter(e.target.value)}
          />
        </div>
      )
    }
  validation:
    - All buttons visible in subheader
    - Rename/Delete disabled when no folder selected
    - Sort dropdown changes folder order
    - Filter input filters folder list

Task 6: Integrate Folder Toolbar into FolderTree
  priority: MEDIUM
  files:
    MODIFY: src/features/folders/components/FolderTree.tsx
    MODIFY: src/app/(app)/layout.tsx
  description: |
    Move toolbar from FolderTree into layout subheader.
    Apply sort and filter logic to folder list.
  pattern: |
    MOVE: Toolbar buttons from FolderTree
    TO: Layout subheader via PanelSubheader children
    ADD: Sort and filter logic to folder list
  validation:
    - Toolbar appears in subheader (not in panel body)
    - Sort and filter affect displayed folders
    - State persists across page navigation

# ========================================
# GROUP C: DOCUMENTS PANEL (Parallel after GROUP A)
# ========================================

Task 7: Rename "Prompts" to "Documents"
  priority: LOW
  files:
    MODIFY: src/features/prompts/components/PromptList.tsx
    MODIFY: src/app/(app)/layout.tsx
  description: |
    Update all user-facing text from "Prompts" to "Documents".
    Keep file names as-is (prompts/) for consistency.
  pattern: |
    FIND: "Prompts", "+ New Prompt"
    REPLACE: "Documents", "+ New Doc"
  validation:
    - Panel header shows "Documents"
    - Button shows "+ New Doc"
    - No references to "prompt" in UI text

Task 8: Add Duplicate Title Validation
  priority: HIGH
  files:
    MODIFY: src/features/prompts/actions.ts
  description: |
    Check for existing prompt with same title (case-insensitive) before creating.
    Return user-friendly error message.
  pattern: |
    MODIFY: createPrompt function
    ADD: findFirst query before insert
  pseudocode: |
    export async function createPrompt(data: unknown): Promise<ActionResult<{ promptId: string }>> {
      try {
        const parsed = createPromptSchema.safeParse(data)
        if (!parsed.success) return { success: false, error: "Invalid input" }

        const supabase = createClient()
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return { success: false, error: "Unauthorized" }

        // NEW: Check for duplicate title
        const existing = await db.prompt.findFirst({
          where: {
            folder_id: parsed.data.folderId,
            user_id: user.id,
            title: {
              equals: parsed.data.title || "Untitled Prompt",
              mode: 'insensitive'  // Case-insensitive
            }
          }
        })

        if (existing) {
          return {
            success: false,
            error: `A document named "${parsed.data.title}" already exists in this folder. Please choose a different title.`
          }
        }

        // Existing create logic
        const prompt = await db.prompt.create({ ... })
        return { success: true, data: { promptId: prompt.id } }
      } catch (error) {
        // Existing error handling
      }
    }
  validation:
    - Creating "Test" twice shows error
    - Error message is user-friendly
    - "test" and "Test" are treated as duplicates
    - Can create "Test" in different folders

Task 9: Add Document Toolbar Component
  priority: MEDIUM
  files:
    CREATE: src/features/prompts/components/DocumentToolbar.tsx
  description: |
    Toolbar with New Doc, Rename, Delete, Sort, Filter controls.
    Similar to FolderToolbar but for documents.
  pseudocode: |
    // Mirror FolderToolbar pattern
    export function DocumentToolbar() {
      const { selectedPrompt, selectedFolder } = useUiStore()
      const { docSort, docFilter, setDocSort, setDocFilter } = useUiStore()

      return (
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="ghost"
            onClick={handleNewDoc}
            disabled={!selectedFolder}
          >
            <Plus className="h-4 w-4" />
          </Button>

          {/* Rename, Delete, Sort, Filter similar to FolderToolbar */}
        </div>
      )
    }
  validation:
    - All buttons visible in subheader
    - New Doc disabled when no folder selected
    - Sort dropdown changes document order
    - Filter input filters document list

Task 10: Integrate Document Toolbar
  priority: MEDIUM
  files:
    MODIFY: src/features/prompts/components/PromptList.tsx
    MODIFY: src/app/(app)/layout.tsx
  description: |
    Move toolbar from PromptList into layout subheader.
    Apply sort and filter logic to document list.
  validation:
    - Toolbar appears in subheader
    - Sort and filter affect displayed documents
    - State persists across selections

# ========================================
# GROUP D: EDITOR FEATURES (Parallel after GROUP A)
# ========================================

Task 11: Create Auto-Save Hook
  priority: HIGH
  files:
    CREATE: src/features/editor/hooks/useAutoSave.ts
  description: |
    Custom hook with debounced auto-save logic.
    Debounces at 500ms, clears on unmount.
  pseudocode: |
    import { useEffect, useRef } from 'react'

    interface UseAutoSaveOptions {
      content: string
      promptId: string | null
      delay?: number  // Default 500ms
      onSave: (promptId: string, content: string) => Promise<void>
    }

    export function useAutoSave({ content, promptId, delay = 500, onSave }: UseAutoSaveOptions) {
      const timeoutRef = useRef<NodeJS.Timeout>()

      useEffect(() => {
        if (!promptId) return

        // Clear previous timeout
        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current)
        }

        // Set new timeout for auto-save
        timeoutRef.current = setTimeout(() => {
          onSave(promptId, content)
        }, delay)

        // Cleanup on unmount or content change
        return () => {
          if (timeoutRef.current) {
            clearTimeout(timeoutRef.current)
          }
        }
      }, [content, promptId, delay, onSave])
    }
  validation:
    - Auto-save triggers after 500ms of no typing
    - Typing resets the timer (debouncing works)
    - No auto-save when promptId is null
    - Timeout cleared on unmount

Task 12: Create localStorage Hook
  priority: MEDIUM
  files:
    CREATE: src/features/editor/hooks/useLocalStorage.ts
  description: |
    Custom hook for persisting unsaved changes.
    Loads on mount, saves on change, clears on manual save.
  pseudocode: |
    import { useEffect, useState } from 'react'

    interface UseLocalStorageOptions {
      key: string
      initialValue: string
    }

    export function useLocalStorage({ key, initialValue }: UseLocalStorageOptions) {
      const [value, setValue] = useState<string>(() => {
        // Load from localStorage on mount
        if (typeof window !== 'undefined') {
          const saved = localStorage.getItem(key)
          return saved || initialValue
        }
        return initialValue
      })

      useEffect(() => {
        // Save to localStorage on change
        if (typeof window !== 'undefined') {
          localStorage.setItem(key, value)
        }
      }, [key, value])

      const clearStorage = () => {
        if (typeof window !== 'undefined') {
          localStorage.removeItem(key)
        }
      }

      return [value, setValue, clearStorage] as const
    }
  validation:
    - Unsaved content persists after browser refresh
    - Content loads from localStorage on mount
    - clearStorage removes item from localStorage

Task 13: Add Auto-Save Action
  priority: HIGH
  files:
    MODIFY: src/features/editor/actions.ts
    CREATE: src/features/editor/schemas.ts
  description: |
    Server action for auto-save (updates content, no version).
    Separate from saveNewVersion.
  pseudocode: |
    "use server"

    import { z } from 'zod'

    // NEW schema
    export const autoSaveSchema = z.object({
      promptId: z.string().uuid(),
      content: z.string()
    })

    // NEW action
    export async function autoSavePrompt(data: unknown): Promise<ActionResult> {
      try {
        const parsed = autoSaveSchema.safeParse(data)
        if (!parsed.success) {
          return { success: false, error: "Invalid data" }
        }

        const supabase = createClient()
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) {
          return { success: false, error: "Unauthorized" }
        }

        // Update prompt content (no version created)
        await db.prompt.update({
          where: {
            id: parsed.data.promptId,
            user_id: user.id  // RLS enforcement
          },
          data: {
            content: parsed.data.content,
            updated_at: new Date()
          }
        })

        return { success: true }
      } catch (error) {
        if (error instanceof Error && error.message === "NEXT_REDIRECT") {
          throw error
        }
        console.error("autoSavePrompt error:", error)
        return { success: false, error: "Auto-save failed" }
      }
    }
  validation:
    - Auto-save updates prompt content
    - No version record created
    - Returns success/error properly

Task 14: Integrate Auto-Save into EditorPane
  priority: HIGH
  files:
    MODIFY: src/features/editor/components/EditorPane.tsx
  description: |
    Use useAutoSave and useLocalStorage hooks.
    Show saving status indicator.
    Ctrl+S triggers manual save (version creation).
  pattern: |
    ADD: useAutoSave hook, useLocalStorage hook, keyboard listener
    MODIFY: handleSave to clear localStorage
  pseudocode: |
    import { useAutoSave } from '../hooks/useAutoSave'
    import { useLocalStorage } from '../hooks/useLocalStorage'

    export function EditorPane() {
      const { selectedPrompt } = useUiStore()
      const [promptData, setPromptData] = useState(null)
      const [title, setTitle] = useState("")

      // NEW: localStorage persistence
      const [content, setContent, clearStorage] = useLocalStorage({
        key: `prompt-${selectedPrompt}`,
        initialValue: promptData?.content || ""
      })

      const [savingStatus, setSavingStatus] = useState<'saved' | 'saving' | 'unsaved'>('saved')

      // NEW: Auto-save with debouncing
      useAutoSave({
        content,
        promptId: selectedPrompt,
        delay: 500,
        onSave: async (promptId, content) => {
          setSavingStatus('saving')
          await autoSavePrompt({ promptId, content })
          setSavingStatus('saved')
        }
      })

      // NEW: Keyboard shortcut for manual save
      useEffect(() => {
        const handler = (e: KeyboardEvent) => {
          if ((e.ctrlKey || e.metaKey) && e.key === 's') {
            e.preventDefault()
            handleManualSave()
          }
        }
        window.addEventListener('keydown', handler)
        return () => window.removeEventListener('keydown', handler)
      }, [handleManualSave])

      // MODIFIED: Manual save creates version + clears localStorage
      const handleManualSave = async () => {
        if (!selectedPrompt) return

        setSavingStatus('saving')
        const result = await saveNewVersion({
          promptId: selectedPrompt,
          newTitle: title,
          newContent: content
        })

        if (result.success) {
          clearStorage()  // Clear localStorage draft
          toast.success("Version saved successfully")
          setSavingStatus('saved')
        } else {
          toast.error(result.error)
          setSavingStatus('unsaved')
        }
      }

      // Rest of component...
    }
  validation:
    - Typing triggers auto-save after 500ms
    - Status shows "Saving..." then "Saved"
    - Ctrl+S creates new version
    - localStorage cleared after manual save
    - Unsaved changes persist after refresh

Task 15: Enable Monaco Full Features
  priority: LOW
  files:
    MODIFY: src/features/editor/components/Editor.tsx
  description: |
    Enable Monaco's full feature set (context menu, find/replace, etc.)
  pattern: |
    MODIFY: options object in Editor component
  pseudocode: |
    const editorOptions = {
      readOnly,
      automaticLayout: true,
      scrollBeyondLastLine: false,
      wordWrap: 'on',
      lineNumbers: 'on',
      minimap: { enabled: false },
      // NEW: Enable full features
      contextmenu: true,
      find: {
        seedSearchStringFromSelection: 'always',
        autoFindInSelection: 'multiline'
      },
      quickSuggestions: true,
      suggestOnTriggerCharacters: true,
      ...options
    }
  validation:
    - Right-click shows context menu
    - Ctrl+F opens find dialog
    - Ctrl+H opens replace dialog
    - All Monaco features accessible

# ========================================
# GROUP E: PLACEHOLDER UI (Parallel, anytime)
# ========================================

Task 16: Add Version History Button (Placeholder)
  priority: LOW
  files:
    MODIFY: src/app/(app)/layout.tsx (or EditorToolbar if created)
  description: |
    Add "Version History" button in editor subheader.
    Shows "Coming Soon" toast when clicked.
  pseudocode: |
    <PanelSubheader title="Editor">
      <Button
        size="sm"
        variant="ghost"
        onClick={() => toast.info("Version history coming soon!")}
      >
        <History className="h-4 w-4 mr-1" />
        History
      </Button>

      {/* Other editor toolbar buttons */}
    </PanelSubheader>
  validation:
    - Button visible in editor subheader
    - Click shows toast notification
    - Button styled consistently

Task 17: Create Dashboard Page Placeholder
  priority: LOW
  files:
    CREATE: src/app/(app)/dashboard/page.tsx
  description: |
    Dashboard with placeholder stats cards.
    Shows upcoming features.
  pseudocode: |
    export default function DashboardPage() {
      return (
        <div className="p-8">
          <h1 className="text-3xl font-bold mb-8">Dashboard</h1>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Total Documents</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-4xl font-bold">-</p>
                <p className="text-sm text-muted-foreground">Coming soon</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Recent Activity</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  Activity feed coming soon
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Popular Tags</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  Tag system coming soon
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      )
    }
  validation:
    - Dashboard page renders
    - Shows 3 placeholder cards
    - Professional empty state

Task 18: Add Settings Page Placeholders
  priority: LOW
  files:
    MODIFY: src/app/(app)/settings/page.tsx
  description: |
    Add placeholder sections for future settings.
  pseudocode: |
    export default function SettingsPage() {
      return (
        <div className="p-8 max-w-2xl">
          <h1 className="text-3xl font-bold mb-8">Settings</h1>

          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Auto-save Frequency</CardTitle>
                <CardDescription>
                  Configure how often drafts are auto-saved (Coming soon)
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Select disabled>
                  <SelectTrigger className="w-48">
                    <SelectValue placeholder="500ms (default)" />
                  </SelectTrigger>
                </Select>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Version Retention</CardTitle>
                <CardDescription>
                  Set how many versions to keep per document (Coming soon)
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Input type="number" disabled placeholder="10 (default)" className="w-48" />
              </CardContent>
            </Card>
          </div>
        </div>
      )
    }
  validation:
    - Settings page renders
    - Shows disabled placeholder controls
    - Professional appearance
```

### Integration Points

```yaml
STATE MANAGEMENT:
  store: src/stores/use-ui-store.ts
  add:
    - folderSort: 'name-asc' | 'name-desc' | 'date-asc' | 'date-desc'
    - folderFilter: string
    - docSort: 'title-asc' | 'title-desc' | 'date-asc' | 'date-desc' | 'size-asc' | 'size-desc'
    - docFilter: string
    - setFolderSort: (sort: FolderSort) => void
    - setFolderFilter: (filter: string) => void
    - setDocSort: (sort: DocSort) => void
    - setDocFilter: (filter: string) => void

DATABASE:
  existing: All tables exist (folders, prompts, prompt_versions)
  no_changes: No schema changes needed for this PRP

UTILITIES:
  file: src/lib/utils.ts
  add: |
    export function debounce<T extends (...args: any[]) => any>(
      func: T,
      delay: number
    ): (...args: Parameters<T>) => void {
      let timeoutId: NodeJS.Timeout
      return (...args: Parameters<T>) => {
        clearTimeout(timeoutId)
        timeoutId = setTimeout(() => func(...args), delay)
      }
    }
```

## Validation Loop

### Level 1: Type Safety & Compilation

```bash
# Run TypeScript compiler - MUST pass before proceeding
npm run build

# Expected: Build succeeds with no errors
# If errors: READ error messages, fix type issues, re-run
```

### Level 2: Linting

```bash
# Run ESLint - fix auto-fixable issues
npm run lint

# Expected: No errors, only warnings acceptable
# If errors: Fix manually, re-run
```

### Level 3: Visual Testing (Browser)

```bash
# Start dev server
npm run dev

# Manual tests:
1. Layout:
   - [ ] Three subheaders visible and aligned with panels
   - [ ] Monaco editor extends from title to footer
   - [ ] Footer always visible at bottom
   - [ ] Scrollbars appear for long content

2. Folders:
   - [ ] Can create root folder
   - [ ] Can create subfolder (up to 5 levels)
   - [ ] Folders indent properly by level
   - [ ] Sort dropdown changes folder order
   - [ ] Filter input filters folders

3. Documents:
   - [ ] Panel shows "Documents" not "Prompts"
   - [ ] Button shows "+ New Doc"
   - [ ] Cannot create duplicate title (case-insensitive)
   - [ ] Error message user-friendly
   - [ ] Sort dropdown changes document order
   - [ ] Filter input filters documents

4. Editor:
   - [ ] Monaco visible for new documents
   - [ ] Typing triggers auto-save after 500ms
   - [ ] Status shows "Saving..." then "Saved"
   - [ ] Ctrl+S creates new version
   - [ ] Toast confirms version saved
   - [ ] Refresh preserves unsaved changes (localStorage)
   - [ ] Manual save clears localStorage
   - [ ] Right-click shows Monaco context menu
   - [ ] Ctrl+F opens find dialog

5. Placeholders:
   - [ ] Version History button present
   - [ ] Click shows "Coming Soon" toast
   - [ ] Dashboard page renders with cards
   - [ ] Settings page renders with disabled controls

# If any test fails: Debug using browser DevTools, fix, re-test
```

### Level 4: Responsive Testing

```bash
# Test different screen sizes
1. Desktop (1920x1080): All panels visible
2. Laptop (1366x768): Layout adjusts properly
3. Monitor height variations: Monaco scrolling works

# Expected: Layout adapts without breaking
```

## Final Validation Checklist

- [ ] TypeScript compilation succeeds (npm run build)
- [ ] ESLint passes (npm run lint)
- [ ] All 13 success criteria met (see Success Criteria section)
- [ ] Monaco editor full height on all screen sizes
- [ ] Auto-save works without blocking UI
- [ ] localStorage persists across refreshes
- [ ] No console errors in browser DevTools
- [ ] All toolbars accessible and functional
- [ ] Keyboard shortcuts work (Ctrl+S, Ctrl+F)
- [ ] Error messages user-friendly and helpful
- [ ] Loading states show during async operations
- [ ] Placeholder UI professional and polished

## Anti-Patterns to Avoid

```typescript
// ❌ DON'T: Forget parent height for Monaco
<div className="some-container">
  <Editor height="100%" />  // Won't work - parent has no height
</div>

// ✅ DO: Establish height context
<div className="flex flex-col h-screen">
  <div className="flex-1">
    <Editor height="100%" />  // Works - parent is flex-1
  </div>
</div>

// ❌ DON'T: Save on every keystroke
onChange={(value) => {
  setContent(value)
  saveToDatabase(value)  // Database hammered on every key
}}

// ✅ DO: Debounce auto-save
useAutoSave({
  content,
  delay: 500,  // Only save after 500ms of no typing
  onSave: autoSavePrompt
})

// ❌ DON'T: Case-sensitive duplicate check
const existing = await db.prompt.findFirst({
  where: { title: userInput }  // "Test" !== "test"
})

// ✅ DO: Case-insensitive comparison
const existing = await db.prompt.findFirst({
  where: {
    title: { equals: userInput, mode: 'insensitive' }
  }
})

// ❌ DON'T: Infinite recursion
const FolderItem = ({ folder }) => (
  <div>
    {folder.children.map(child => (
      <FolderItem folder={child} />  // No depth limit
    ))}
  </div>
)

// ✅ DO: Limit recursion depth
const FolderItem = ({ folder, depth = 0 }) => {
  if (depth >= 5) return null  // Stop at 5 levels
  return (
    <div>
      {folder.children.map(child => (
        <FolderItem folder={child} depth={depth + 1} />
      ))}
    </div>
  )
}

// ❌ DON'T: Mutate Zustand state
set((state) => {
  state.expandedFolders.add(folderId)  // Direct mutation
  return state
})

// ✅ DO: Return new state
set((state) => ({
  expandedFolders: new Set(state.expandedFolders).add(folderId)
}))

// ❌ DON'T: Skip RLS enforcement
await db.prompt.findFirst({
  where: { id: promptId }  // Any user can access
})

// ✅ DO: Always filter by user_id
await db.prompt.findFirst({
  where: {
    id: promptId,
    user_id: user.id  // Enforces user isolation
  }
})

// ❌ DON'T: Forget to prevent browser default
window.addEventListener('keydown', (e) => {
  if (e.ctrlKey && e.key === 's') {
    handleSave()  // Browser save dialog still appears
  }
})

// ✅ DO: Prevent default behavior
window.addEventListener('keydown', (e) => {
  if (e.ctrlKey && e.key === 's') {
    e.preventDefault()  // Blocks browser save dialog
    handleSave()
  }
})

// ❌ DON'T: Keep stale localStorage after save
const handleSave = async () => {
  await saveNewVersion(content)
  toast.success("Saved")  // localStorage still has draft
}

// ✅ DO: Clear localStorage on successful save
const handleSave = async () => {
  await saveNewVersion(content)
  clearStorage()  // Remove draft
  toast.success("Saved")
}
```

---

## Confidence Score: 8/10

**Strengths:**
- Clear existing patterns to follow (FolderItem, Editor, server actions)
- Monaco Editor already integrated and working
- Good codebase structure with features separated
- Well-defined requirements with specific measurements
- Comprehensive context provided (docs, examples, gotchas)

**Risk Areas:**
- CSS layout for Monaco full-height can be finicky (depends on parent flex setup)
- Auto-save debounce timing might need tuning for UX feel
- Recursive subfolder UI might need iteration for visual polish
- localStorage timing with auto-save could have edge cases

**Mitigation:**
- Extensive gotchas section addresses known CSS issues
- Clear pseudocode for debouncing pattern
- Depth limit prevents subfolder UI issues
- Clear validation steps for catching edge cases

---

**PRP Status**: READY
**PRP ID**: P5S3b
**Archon Project**: PromptHub (d449f266-1f36-47ad-bd2d-30f1a0f5e999)
**Tasks**: 18 tasks (P5S3bT1 - P5S3bT18)
**Phase**: Phase 5 - Prompt Editor & Version Control (Enhancement)
**Dependencies**: P5S3 (Prompt Saving and Versioning Logic)
**Next PRP**: P5S4 - Editor UI with Manual Save
**Recommendations**:
Agents:
- `senior-frontend-engineer` (Tasks 1-15, 17-18)
- `ux-ui-designer` (Tasks 16-18 - placeholder UI review)
Notes:
- GROUP A (T1-T3) must complete first (foundation)
- GROUPS B, C, D can run in parallel after GROUP A
- GROUP E (placeholders) can run anytime
- Test Monaco height immediately after T3 completion
- Validate auto-save thoroughly in T14 before moving on
**Estimated Implementation Time (FTE):** 12-16 hours (1.5-2 days)
