# PromptHub - Codebase Structure
Last Updated: 08/11/2025 12:00 GMT+10 (Updated with P5S4bT1 bug fix)

## Root Directory Structure
```
/home/allan/projects/PromptHub/
├── src/                    # Source code
├── prisma/                 # Database schema and migrations
├── supabase/              # Supabase configuration
├── public/                # Static assets
├── docs/                  # Project documentation and rules
├── PRPs/                  # Product Requirements & Planning
│   └── reports/          # PRP INITIAL and REPORT documents
├── wip/                   # Work in progress files
├── mermaid/               # Generated diagrams
├── .claude/               # Claude configuration and agents
├── .serena/               # Serena MCP configuration
└── .venv/                 # Virtual environment

Configuration Files:
- package.json             # Dependencies and scripts
- tsconfig.json           # TypeScript configuration (strict mode)
- tailwind.config.ts      # Tailwind CSS configuration
- next.config.mjs         # Next.js configuration
- prisma/schema.prisma    # Database schema
- CLAUDE.md               # Project instructions for Claude
- README.md               # Project documentation
- .env                    # Environment variables (not committed)
- .env.example           # Environment template
```

## Source Code Structure (`src/`)

### Current Implementation (P1S1 → P5S4bT1 Document Content Bug Fix)
```
src/
├── app/                  # App Router (Next.js 14)
│   └── (app)/           # App layout group
│       ├── layout.tsx   # Main app layout with TooltipProvider (P5S4b)
│       └── page.tsx     # Dashboard page
│
├── features/             # Feature modules (domain-driven)
│   ├── auth/            # Authentication (P1S1)
│   │   ├── actions.ts   # Server actions (signUp, signIn, signOut)
│   │   ├── schemas.ts   # Zod validation schemas
│   │   └── components/  # Auth UI components
│   │       ├── AuthForm.tsx        # Main auth form
│   │       └── FormError.tsx       # Error display
│   │
│   ├── editor/          # Monaco Editor & Editing (P5S1, P5S3d, P5S4, P5S4b, P5S4bT1)
│   │   ├── types.ts     # TypeScript interfaces
│   │   ├── markdown-actions.ts  # Formatting utilities (P5S4)
│   │   ├── components/  # Editor UI components
│   │   │   ├── Editor.tsx           # Monaco wrapper (P5S3d: h-full fix)
│   │   │   ├── EditorPane.tsx       # Main editor panel (P5S4, P5S4b: cleanup effect, P5S4bT1: ref-guard)
│   │   │   └── EditorSkeleton.tsx   # Loading state
│   │   ├── hooks/       # Editor hooks
│   │   │   └── useLocalStorage.ts   # localStorage hook (P5S4bT1: verified fix)
│   │   └── index.ts     # Centralized exports
│   │
│   ├── folders/         # Folder Management (P5S4, P5S4b, CASCADE_DELETE)
│   │   ├── components/  # Folder UI components
│   │   │   ├── FolderTree.tsx       # Folder tree (P5S4b: refetch integration)
│   │   │   ├── FolderToolbar.tsx    # Folder actions (P5S4b: tooltips, dialogs)
│   │   │   └── FolderDialogs.tsx    # THREE dialog components (NEW: CASCADE_DELETE)
│   │   │       ├── CreateFolderDialog
│   │   │       ├── RenameFolderDialog
│   │   │       └── DeleteFolderDialog
│   │
│   └── prompts/         # Prompt/Document Management (P5S4, P5S4b, CASCADE_DELETE)
│       └── components/  # Prompt UI components
│           ├── PromptList.tsx       # Document list (P5S4b: refetch integration)
│           ├── DocumentToolbar.tsx  # Document actions (P5S4b: icons + tooltips, dialogs)
│           └── DocumentDialogs.tsx  # THREE dialog components (NEW: CASCADE_DELETE)
│               ├── CreateDocumentDialog
│               ├── RenameDocumentDialog
│               └── DeleteDocumentDialog
│
├── components/          # Shared components
│   ├── layout/         # Layout components (P1S1, P5S3d)
│   │   ├── Header.tsx         # Context-aware header
│   │   └── PanelSubheader.tsx # Panel subheader (P5S3d: compact)
│   └── ui/             # Shadcn UI components (P5S3d, P5S4b, CASCADE_DELETE)
│       ├── button.tsx         # P5S3d: h-8/h-7, text-xs
│       ├── card.tsx
│       ├── input.tsx          # P5S3d: h-8
│       ├── label.tsx          # P5S3d: text-xs
│       ├── toaster.tsx        # Sonner toast wrapper
│       ├── tooltip.tsx        # P5S4b: tooltip component
│       ├── alert-dialog.tsx   # NEW: CASCADE_DELETE - confirmation dialogs
│       └── dialog.tsx         # NEW: CASCADE_DELETE - form dialogs
│
├── stores/             # Zustand state management (P5S4, P5S4b)
│   └── use-ui-store.ts # Global UI state (refetch triggers, document state)
│
├── lib/                # Shared utilities
│   └── supabase/
│       ├── client.ts   # Client-side Supabase client
│       └── server.ts   # Server-side Supabase client
│
├── pages/              # Next.js Pages Router (P1S1)
│   ├── _app.tsx       # App wrapper (fonts, toaster)
│   ├── _document.tsx  # Document (dark mode)
│   ├── index.tsx      # Landing page
│   ├── login.tsx      # Auth page
│   └── dashboard.tsx  # Protected dashboard
│
├── styles/            # Global styles
│   └── globals.css    # Bold Simplicity design (P5S3d: 12px base)
│
└── middleware.ts      # Auth protection middleware
```

## Key File Locations (Latest Implementations)

### P5S4bT1 - Document Content Cross-Contamination Bug Fix (LATEST - 08/11/2025)
**Status**: ✅ COMPLETE - Content isolation restored
**Files Modified**: 1 (EditorPane.tsx)

**Critical Fix Location**: `src/features/editor/components/EditorPane.tsx`

**Bug Details**:
- Issue 1: localStorage sync effect saves old content to new document's key during switching
- Issue 2: Empty documents don't load due to strict content check

**Solution**:
- Added `useRef` to track document key changes
- Guard prevents save when key just changed (document switch in progress)
- Fixed condition to allow empty documents to load
- Result: Perfect content isolation, no cross-contamination

### CASCADE_DELETE - Database & Dialog System (08/11/2025 11:30 GMT+10)
**Status**: ✅ COMPLETE and committed to git

**New UI Dialog Components**:
- **FolderDialogs**: `src/features/folders/components/FolderDialogs.tsx` (NEW)
  - CreateFolderDialog (form-based)
  - RenameFolderDialog (form-based)
  - DeleteFolderDialog (confirmation with item counts)
- **DocumentDialogs**: `src/features/prompts/components/DocumentDialogs.tsx` (NEW)
  - CreateDocumentDialog (form-based)
  - RenameDocumentDialog (form-based)
  - DeleteDocumentDialog (confirmation with version counts)

**Dialog Components**:
- **AlertDialog**: `src/components/ui/alert-dialog.tsx` (NEW)
- **Dialog**: `src/components/ui/dialog.tsx` (NEW)

**Integrated Locations**:
- **FolderToolbar**: `src/features/folders/components/FolderToolbar.tsx` (dialogs integrated)
- **DocumentToolbar**: `src/features/prompts/components/DocumentToolbar.tsx` (dialogs integrated)

**Database Schema**:
- **Prisma Schema**: `prisma/schema.prisma` (cascade delete enabled)
- **Migration**: `prisma/migrations/20251108111348_fix_tag_unique_constraint/`

### P5S4b - UI Fixes & Tooltips
- **Tooltip Component**: `src/components/ui/tooltip.tsx`
- **TooltipProvider**: `src/app/(app)/layout.tsx`
- **EditorPane Cleanup**: `src/features/editor/components/EditorPane.tsx`
- **Refetch Store**: `src/stores/use-ui-store.ts`
- **FolderTree Integration**: `src/features/folders/components/FolderTree.tsx`
- **FolderToolbar Integration**: `src/features/folders/components/FolderToolbar.tsx`
- **PromptList Integration**: `src/features/prompts/components/PromptList.tsx`
- **DocumentToolbar Icons**: `src/features/prompts/components/DocumentToolbar.tsx`

### P5S4 - Manual Save & Markdown Actions
- **Markdown Actions**: `src/features/editor/markdown-actions.ts`
- **EditorPane**: `src/features/editor/components/EditorPane.tsx`
- **UI Store**: `src/stores/use-ui-store.ts`
- **Toolbar Components**: Folder and Document toolbars

### P5S3d - Compact UI
- **CSS Variables**: `src/styles/globals.css`
- **Component Sizes**: Button, Input, Label, PanelSubheader
- **Editor Height Fix**: Editor, EditorPane (h-full wrappers)

### P5S1 - Monaco Editor
- **Editor Types**: `src/features/editor/types.ts`
- **Editor Component**: `src/features/editor/components/Editor.tsx`
- **Editor Skeleton**: `src/features/editor/components/EditorSkeleton.tsx`
- **Exports**: `src/features/editor/index.ts`

### P1S1 - Authentication & Design
- **Server Actions**: `src/features/auth/actions.ts`
- **Validation Schemas**: `src/features/auth/schemas.ts`
- **Auth Form**: `src/features/auth/components/AuthForm.tsx`
- **Header**: `src/components/layout/Header.tsx`

## Architecture Patterns (Current)

### Dialog Pattern (CASCADE_DELETE - NEW)

**Dialog Types**:
- **Dialog** (for forms): Create, Rename operations
- **AlertDialog** (for confirmations): Delete operations with warnings

**Dialog Component Structure**:
```typescript
interface CreateFolderDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onConfirm: (data: FormData) => Promise<void>
}

export function CreateFolderDialog({
  open,
  onOpenChange,
  onConfirm
}: CreateFolderDialogProps) {
  const [isLoading, setIsLoading] = useState(false)
  const [name, setName] = useState("")

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    try {
      await onConfirm({ name })
      setName("")
      onOpenChange(false)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create New Folder</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Folder name"
            autoFocus
            disabled={isLoading}
          />
          <DialogFooter>
            <Button onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button onClick={handleSubmit} disabled={isLoading || !name.trim()}>
              {isLoading ? "Creating..." : "Create"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
```

**Delete Confirmation with Item Counts**:
```typescript
export function DeleteFolderDialog({
  folder,
  isLoading,
  onConfirm,
  onCancel
}: Props) {
  const itemCount = calculateTotalItems(folder)

  return (
    <AlertDialog open={!!folder} onOpenChange={onCancel}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete Folder?</AlertDialogTitle>
          <AlertDialogDescription>
            This will permanently delete "{folder?.name}" and all contents:
            - {folder?.subfolders} subfolders
            - {folder?.documents} documents
            - {folder?.versions} versions

            This action cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm} disabled={isLoading}>
            {isLoading ? "Deleting..." : "Delete"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
```

**Integration in Toolbar**:
```typescript
export function FolderToolbar() {
  const [createDialogOpen, setCreateDialogOpen] = useState(false)
  const [deleteFolder, setDeleteFolder] = useState<Folder | null>(null)

  return (
    <>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setCreateDialogOpen(true)}
          >
            <FolderPlus className="h-4 w-4" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>Create new folder</TooltipContent>
      </Tooltip>

      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setDeleteFolder(selectedFolder)}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>Delete folder</TooltipContent>
      </Tooltip>

      <CreateFolderDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
        onConfirm={handleCreateFolder}
      />

      <DeleteFolderDialog
        folder={deleteFolder}
        isLoading={isDeleting}
        onConfirm={handleDeleteFolder}
        onCancel={() => setDeleteFolder(null)}
      />
    </>
  )
}
```

### Database Cascade Delete Pattern (CASCADE_DELETE - NEW)

**Prisma Schema Changes**:
```prisma
model Folder {
  id String @id @default(cuid())
  name String
  user_id String
  parent_id String?

  // Self-referencing for nested folders - CASCADE DELETE
  parent Folder? @relation("NestedFolders", fields: [parent_id], references: [id], onDelete: Cascade)
  children Folder[] @relation("NestedFolders")

  // Cascade delete to prompts
  prompts Prompt[] @relation(onDelete: Cascade)

  user Profile @relation(fields: [user_id], references: [id], onDelete: Cascade)

  @@unique([name, user_id, parent_id])
}

model Prompt {
  id String @id @default(cuid())
  title String
  content String
  folder_id String?

  // Cascade delete to versions
  versions PromptVersion[] @relation(onDelete: Cascade)

  folder Folder? @relation(fields: [folder_id], references: [id], onDelete: Cascade)
  user Profile @relation(fields: [user_id], references: [id], onDelete: Cascade)

  @@unique([title, user_id, folder_id])
}

model Tag {
  id String @id @default(cuid())
  name String
  user_id String

  user Profile @relation(fields: [user_id], references: [id], onDelete: Cascade)

  // FIXED: Compound unique constraint
  @@unique([name, user_id])
}
```

**Benefits**:
- Deleting a folder cascades to all nested folders and documents
- Deleting a document cascades to all versions
- Deleting a user cascades to all their data
- No orphaned records in database
- Users see clear warnings before deletion

**Database Push Command**:
```bash
npx prisma db push  # Pushes schema changes to Supabase
```

### Zustand State Management (P5S4, P5S4b)

**Store Location**: `src/stores/use-ui-store.ts`

**State Structure**:
```typescript
interface UIStore {
  // Document state
  selectedDocumentId: string | null
  selectedDocument: Document | null
  
  // Folder state
  selectedFolderId: string | null
  expandedFolders: Set<string>
  
  // Refetch triggers (P5S4b)
  folderRefetchTrigger: number
  documentRefetchTrigger: number
  
  // Actions
  setSelectedDocument: (doc: Document | null) => void
  setSelectedFolder: (id: string | null) => void
  triggerFolderRefetch: () => void  // P5S4b
  triggerDocumentRefetch: () => void  // P5S4b
}
```

**Refetch Pattern** (P5S4b):
```typescript
// Trigger refetch from mutation
const handleCreateFolder = async () => {
  await createFolder(...)
  useUIStore.getState().triggerFolderRefetch()
}

// Subscribe to refetch in component
const folderRefetchTrigger = useUIStore(s => s.folderRefetchTrigger)
useEffect(() => {
  fetchFolders()
}, [folderRefetchTrigger])
```

### Document Switching Pattern (P5S4b)

**Problem**: Wrong content displayed when switching documents

**Solution**: Cleanup effect in EditorPane
```typescript
useEffect(() => {
  // Reset to initial content when document changes
  setLocalContent(initialContent)
  setIsDirty(false)
}, [selectedDocumentId])
```

**Key Points**:
- Effect runs on `selectedDocumentId` change
- Resets local content to initial content
- Clears dirty state
- Ensures correct content always displayed

### Tooltip System (P5S4b)

**Provider Setup**: `src/app/(app)/layout.tsx`
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

**Component Usage**:
```typescript
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"

<Tooltip>
  <TooltipTrigger asChild>
    <Button variant="ghost" size="icon">
      <FilePlus className="h-4 w-4" />
    </Button>
  </TooltipTrigger>
  <TooltipContent>Create new document</TooltipContent>
</Tooltip>
```

**Features**:
- 700ms hover delay
- Context-aware messages (disabled states)
- Keyboard navigation support
- Consistent placement

### Markdown Actions (P5S4)

**Location**: `src/features/editor/markdown-actions.ts`

**Actions Available**:
- `toggleBold()` - Bold selection (Ctrl+B)
- `toggleItalic()` - Italic selection (Ctrl+I)
- `toggleStrikethrough()` - Strikethrough (Ctrl+Shift+X)
- `insertHeading()` - Insert heading
- `insertLink()` - Insert link
- `insertCodeBlock()` - Insert code block
- `insertUnorderedList()` - Bullet list
- `insertOrderedList()` - Numbered list

**Integration**:
```typescript
import { toggleBold } from "@/features/editor/markdown-actions"

const handleBold = () => {
  const editor = editorRef.current
  if (!editor) return
  toggleBold(editor)
}
```

### Monaco Editor Height Pattern (P5S3d)

**Critical Pattern for Flex Containers**:
```typescript
// EditorPane wrapper structure
<div className="flex-1 overflow-hidden relative">
  <div className="absolute inset-0 h-full">  {/* CRITICAL: h-full */}
    <Editor height="100%" />
  </div>
</div>
```

**Why This Works**:
- `flex-1`: Takes available vertical space
- `overflow-hidden relative`: Creates positioning context
- `absolute inset-0`: Stretches to parent bounds
- `h-full`: Explicitly sets height to 100%
- Monaco `height="100%"`: Now has height reference

## Component Patterns

### Toolbar Pattern (P5S4b)
```typescript
// Icon-based toolbar with tooltips
<div className="flex items-center gap-1">
  <Tooltip>
    <TooltipTrigger asChild>
      <Button variant="ghost" size="icon" onClick={handleAction}>
        <Icon className="h-4 w-4" />
      </Button>
    </TooltipTrigger>
    <TooltipContent>Action description</TooltipContent>
  </Tooltip>
</div>
```

### CRUD with Refetch Pattern (P5S4b)
```typescript
const handleCreate = async (data) => {
  const result = await createItem(data)
  if (result.success) {
    useUIStore.getState().triggerRefetch()
  }
}
```

### Dirty State Tracking (P5S4)
```typescript
const [localContent, setLocalContent] = useState(initialContent)
const [isDirty, setIsDirty] = useState(false)

const handleContentChange = (value: string) => {
  setLocalContent(value)
  setIsDirty(value !== initialContent)
}
```

## File Size Policy
- **Maximum 500 lines per file** (mandatory)
- Current status: All files well within limits
- Largest files: ~300 lines (EditorPane, UI Store)

## Implementation Status by Phase

### P5S4bT1 - Document Content Bug Fix (100% COMPLETE - 08/11/2025)
**Date Completed**: 08/11/2025
**Status**: ✅ Production Ready
**Changes**:
1. **EditorPane.tsx**: Added ref-based guard to prevent stale content save during document switch
2. **EditorPane.tsx**: Fixed empty document display condition
3. **useLocalStorage.ts**: Verified hook implementation is correct

**Key Pattern Discovered**:
```typescript
// Use ref to track key changes and prevent stale saves
const prevKeyRef = useRef<string | null>(null)

useEffect(() => {
  if (prevKeyRef.current !== selectedDocumentId) {
    prevKeyRef.current = selectedDocumentId
    // Skip save on key change - this prevents stale content
    setLocalContent(initialContent)
    return
  }

  // Save only happens after key stabilizes
  const timer = setTimeout(() => {
    if (localContent !== initialContent) {
      localStorage.setItem(key, localContent)
    }
  }, 500)

  return () => clearTimeout(timer)
}, [localContent, selectedDocumentId, key])
```

**Build Status**: ✅ Successful (zero errors)

### CASCADE_DELETE - Database & Dialog System (100% COMPLETE - 08/11/2025)
**Date Completed**: 08/11/2025 11:30 GMT+10
**Status**: ✅ Production Ready
**Changes**:
1. **Database Schema**: Enabled cascade delete on Folder→Folder and Folder→Prompt
2. **Tag Constraint**: Fixed unique constraint drift (compound unique on name, user_id)
3. **Schema Migration**: Successfully pushed to Supabase via `prisma db push`
4. **UI Components**: Created FolderDialogs and DocumentDialogs with 3 dialogs each
5. **Toolbar Integration**: Replaced browser prompts with professional dialogs
6. **Dependencies**: Added @radix-ui/react-alert-dialog and @radix-ui/react-dialog

**Key Files**:
- `src/features/folders/components/FolderDialogs.tsx` - NEW
- `src/features/prompts/components/DocumentDialogs.tsx` - NEW
- `src/components/ui/alert-dialog.tsx` - NEW
- `src/components/ui/dialog.tsx` - NEW
- `prisma/schema.prisma` - Updated with cascade rules
- `src/features/folders/components/FolderToolbar.tsx` - Dialogs integrated
- `src/features/prompts/components/DocumentToolbar.tsx` - Dialogs integrated

**Build Status**: ✅ Successful (zero errors)

### P5S4b - UI Fixes & Tooltips (100% COMPLETE)
**Date Completed**: 07/11/2025 21:00 GMT+10
**Files Modified**: 7
**Files Created**: 1 (tooltip.tsx)
**Critical Fixes**: 4 (document switching, UI updates, design consistency, tooltips)

### P5S4 - Manual Save Workflow (100% COMPLETE)
**Date Completed**: 07/11/2025 20:45 GMT+10
**Files Modified**: ~10
**Files Created**: 1 (markdown-actions.ts)
**Features**: Manual save, markdown toolbar, keyboard shortcuts

### P5S3d - Compact UI (100% COMPLETE)
**Date Completed**: 07/11/2025 19:57 GMT+10
**Files Modified**: 7
**Critical Fix**: Monaco editor height (657px achieved)

### P5S1 - Monaco Editor (100% COMPLETE)
**Date Completed**: 07/11/2025 13:30 GMT+10
**Files Created**: 4 (types, Editor, EditorSkeleton, index)
**Build Status**: Success (zero errors)

### P1S1 - Auth & Design (100% COMPLETE)
**Date Completed**: 07/11/2025 13:10 GMT+10
**E2E Test Pass Rate**: 8/8 (100%)
**Console Errors**: 0 (Zero)

## Design System (P5S3d: Compact UI Standards)

### CSS Variables (globals.css)
```css
html {
  font-size: 12px;  /* P5S3d: Compact UI (was 16px) */
}

:root {
  --primary: 239 84% 67%;      /* Indigo #4F46E5 */
  --accent: 328 85% 70%;       /* Magenta #EC4899 */
  --background: 222 47% 11%;   /* Dark blue-black #0F172A */
  --foreground: 213 31% 91%;   /* Light text #E2E8F0 */
}
```

### Component Sizing Standards
- **Button Default**: `h-8 px-3 text-xs`
- **Button Small**: `h-7 px-2.5 text-xs`
- **Button Icon**: `h-8 w-8` (P5S4b)
- **Input**: `h-8 px-2.5 py-1.5`
- **Label**: `text-xs`
- **PanelSubheader**: `h-10 px-3 text-xs`
- **Icons**: `h-4 w-4` (standard size)

## Testing & Quality

### Build Verification
```bash
npm run lint    # Zero warnings/errors
npm run build   # Successful production build
```

### Functionality Verification
- Document switching works correctly (P5S4b)
- CRUD operations update UI immediately (P5S4b)
- Tooltips appear on all interactive elements (P5S4b)
- Markdown actions work with shortcuts (P5S4)
- Monaco editor renders at correct height (P5S3d)

## Next Phase: P5S5 - Version History UI
⏳ Display version history for documents
⏳ Version comparison interface
⏳ Restore previous versions
⏳ Version metadata display
