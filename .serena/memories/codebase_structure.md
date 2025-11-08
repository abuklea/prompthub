# PromptHub - Codebase Structure
Last Updated: 07/11/2025 21:10 GMT+10

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

### Current Implementation (P1S1 → P5S4b)
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
│   ├── editor/          # Monaco Editor & Editing (P5S1, P5S3d, P5S4, P5S4b)
│   │   ├── types.ts     # TypeScript interfaces
│   │   ├── markdown-actions.ts  # Formatting utilities (P5S4)
│   │   ├── components/  # Editor UI components
│   │   │   ├── Editor.tsx           # Monaco wrapper (P5S3d: h-full fix)
│   │   │   ├── EditorPane.tsx       # Main editor panel (P5S4, P5S4b: cleanup effect)
│   │   │   └── EditorSkeleton.tsx   # Loading state
│   │   └── index.ts     # Centralized exports
│   │
│   ├── folders/         # Folder Management (P5S4, P5S4b)
│   │   └── components/  # Folder UI components
│   │       ├── FolderTree.tsx       # Folder tree (P5S4b: refetch integration)
│   │       └── FolderToolbar.tsx    # Folder actions (P5S4b: tooltips)
│   │
│   └── prompts/         # Prompt/Document Management (P5S4, P5S4b)
│       └── components/  # Prompt UI components
│           ├── PromptList.tsx       # Document list (P5S4b: refetch integration)
│           └── DocumentToolbar.tsx  # Document actions (P5S4b: icons + tooltips)
│
├── components/          # Shared components
│   ├── layout/         # Layout components (P1S1, P5S3d)
│   │   ├── Header.tsx         # Context-aware header
│   │   └── PanelSubheader.tsx # Panel subheader (P5S3d: compact)
│   └── ui/             # Shadcn UI components (P5S3d, P5S4b)
│       ├── button.tsx         # P5S3d: h-8/h-7, text-xs
│       ├── card.tsx
│       ├── input.tsx          # P5S3d: h-8
│       ├── label.tsx          # P5S3d: text-xs
│       ├── toaster.tsx        # Sonner toast wrapper
│       └── tooltip.tsx        # P5S4b: NEW tooltip component
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

### P5S4b - UI Fixes & Tooltips (LATEST)
- **Tooltip Component**: `src/components/ui/tooltip.tsx` (NEW)
- **TooltipProvider**: `src/app/(app)/layout.tsx` (added)
- **EditorPane Cleanup**: `src/features/editor/components/EditorPane.tsx` (bug fix)
- **Refetch Store**: `src/stores/use-ui-store.ts` (triggers added)
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
