# PromptHub - Codebase Structure

## Directory Layout

```
PromptHub/
├── src/
│   ├── components/          # Shared UI components
│   │   ├── layout/          # Header, Footer, MainLayout
│   │   ├── ui/              # Shadcn/UI components
│   │   └── ErrorBoundary.tsx # React error boundary (P5S4)
│   ├── features/            # Feature-based modules
│   │   ├── auth/            # Authentication
│   │   │   └── actions.ts   # Sign in/out, clearDocumentCache on logout
│   │   ├── editor/          # Document editor
│   │   │   ├── components/
│   │   │   │   └── EditorPane.tsx # Main editor with cache system (P5S4 refactor)
│   │   │   ├── hooks/
│   │   │   │   ├── useAutoSave.ts # 500ms debounce auto-save
│   │   │   │   └── useLocalStorage.ts # localStorage persistence
│   │   │   ├── actions.ts   # saveNewVersion, autoSavePrompt
│   │   │   └── schemas.ts   # Zod validation schemas
│   │   ├── folders/         # Folder management
│   │   │   └── components/
│   │   │       └── FolderToolbar.tsx # Folder CRUD operations
│   │   ├── prompts/         # Prompt/document management
│   │   │   ├── components/
│   │   │   │   ├── PromptList.tsx # Document list with getDisplayTitle
│   │   │   │   ├── DocumentDialogs.tsx # Rename, delete dialogs
│   │   │   │   ├── DocumentToolbar.tsx # Document actions toolbar
│   │   │   │   └── SetTitleDialog.tsx # Title validation dialog (P5S4e)
│   │   │   ├── actions.ts   # CRUD operations with title validation
│   │   │   ├── schemas.ts   # titleValidationSchema
│   │   │   └── utils.ts     # getDisplayTitle() utility (P5S4)
│   │   └── tabs/            # Tab system
│   │       ├── components/
│   │       │   ├── DocumentTab.tsx # Individual tab with getDisplayTitle
│   │       │   ├── TabContent.tsx # Tab content area
│   │       │   └── UnsavedChangesDialog.tsx # Close confirmation (P5S4e)
│   │       └── types.ts     # TabData interface with isNewDocument flag
│   ├── stores/              # Zustand state management
│   │   ├── use-ui-store.ts  # UI state (selected folder/prompt, refetch)
│   │   └── use-tab-store.ts # Tab state with closeTab interceptor
│   ├── lib/                 # Utilities and libraries
│   │   ├── db.ts            # Prisma client instance
│   │   ├── diff-utils.ts    # Git-style diff creation
│   │   └── supabase/
│   │       ├── client.ts    # Client-side Supabase client (P5S4)
│   │       └── server.ts    # Server-side Supabase client
│   └── types/               # TypeScript type definitions
│       └── actions.ts       # ActionResult type
├── prisma/
│   ├── schema.prisma        # Database schema (title: String? - P5S4)
│   └── migrations/          # Database migrations
│       └── 20251108072630_allow_null_document_title/
├── PRPs/                    # Product Requirements & Planning
│   ├── P5S4-fix-cache-render-loop-security.md
│   ├── P5S4e-improved-document-naming.md
│   └── reports/             # PRP initial and completion reports
├── wip/                     # Work in progress documents
│   ├── caching-sync-investigation-report.md
│   ├── server-request-frequency-audit-2025-11-09.md
│   └── screenshots/         # Development screenshots/GIFs
└── docs/                    # Project documentation
    ├── project/             # Project planning documents
    └── rules/               # Development rules and standards
```

## Core Components

### EditorPane.tsx (src/features/editor/components/)
**Purpose**: Main document editor with caching, auto-save, and tab integration  
**Critical Patterns**:
- User-scoped document cache (Map with userId validation)
- Four critical refs for race prevention (loadedRef, contentPromptIdRef, promptIdRef, isTransitioning)
- 500ms auto-save with transition guards
- localStorage persistence with cross-contamination prevention
- Null title handling with getDisplayTitle utility

**Key Features**:
- Instant tab switching via cache
- React Strict Mode duplicate load prevention
- Security: User-scoped cache cleared on logout
- Performance: Only load from DB when cache miss

### SetTitleDialog.tsx (src/features/prompts/components/)
**Purpose**: Modal dialog for mandatory title entry when saving new documents  
**Created**: P5S4e  
**Features**: Title validation, graceful UX for untitled documents

### UnsavedChangesDialog.tsx (src/features/tabs/components/)
**Purpose**: Confirmation dialog when closing unsaved new document tabs  
**Created**: P5S4e  
**Features**: Save/Discard options with title entry flow

### ErrorBoundary.tsx (src/components/)
**Purpose**: React error boundary for graceful error handling  
**Created**: P5S4

## State Management

### use-tab-store.ts (src/stores/)
**Purpose**: Zustand store for tab state management  
**Key Features**:
- Tab CRUD operations (openTab, closeTab, updateTab)
- Preview vs permanent tab states
- closeTab interceptor for unsaved document checks
- isNewDocument flag tracking (P5S4e)
- localStorage persistence

### use-ui-store.ts (src/stores/)
**Purpose**: Zustand store for UI state  
**Key Features**:
- Selected folder/prompt tracking
- Refetch triggers for list updates
- Prompt title updates

## Database (Prisma)

### Schema (prisma/schema.prisma)
```prisma
model Prompt {
  id          String   @id @default(uuid())
  title       String?  // Nullable (P5S4 migration)
  content     String
  content_tsv Unsupported("tsvector")? // Full-text search
  created_at  DateTime @default(now())
  updated_at  DateTime @updatedAt
  user_id     String
  folder_id   String?
  // Relations...
}
```

**Critical Rules**:
- Title is nullable (allows creation before save)
- User-scoped via RLS policies
- Full-text search via tsvector
- Proper indexes for performance

## Utility Functions

### getDisplayTitle() (src/features/prompts/utils.ts)
**Purpose**: Consistent "[Untitled Doc]" display for null titles  
**Created**: P5S4  
**Usage**: PromptList, DocumentTab, anywhere displaying document titles

### createPatch() (src/lib/diff-utils.ts)
**Purpose**: Generate Git-style diffs for version tracking  
**Usage**: saveNewVersion action

## File Naming Conventions

| Type | Convention | Example |
|------|------------|---------|
| Components | PascalCase.tsx | `EditorPane.tsx` |
| Pages | kebab-case/lowercase | `login.tsx` |
| Utilities | camelCase.ts | `diff-utils.ts` |
| Types | *.types.ts | `actions.ts` |
| Actions | actions.ts | `features/auth/actions.ts` |
| Schemas | schemas.ts | `features/editor/schemas.ts` |

## Module Dependencies

```
EditorPane.tsx
├── Hooks
│   ├── useAutoSave (500ms debounce)
│   └── useLocalStorage (persistence)
├── Actions
│   ├── saveNewVersion (manual save)
│   └── autoSavePrompt (background save)
├── Stores
│   ├── useUiStore (refetch triggers)
│   └── useTabStore (tab updates)
└── Utilities
    ├── getDisplayTitle (null handling)
    └── titleValidationSchema (validation)
```

## Critical Files for Future Development

**EditorPane.tsx**: Document any changes to refs, cache, or auto-save patterns  
**use-tab-store.ts**: Tab system modifications must consider isNewDocument flag  
**actions.ts (prompts)**: Always validate titles before database operations  
**schemas.ts**: Keep titleValidationSchema in sync with business rules
