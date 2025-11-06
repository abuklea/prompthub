# PromptHub - Codebase Structure
Last Updated: 06/11/2025 19:56 GMT+10

## Root Directory Structure
```
/home/allan/projects/PromptHub/
├── src/                    # Source code
├── prisma/                 # Database schema and migrations
├── supabase/              # Supabase configuration
├── public/                # Static assets (favicon, etc.)
├── docs/                  # Project documentation and rules
├── PRPs/                  # Product Requirements & Planning
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

### Feature-Based Organization
```
src/
├── features/              # Feature modules (domain-driven)
│   ├── auth/             # Authentication
│   │   ├── actions.ts    # Server actions (signUp, signIn, signOut)
│   │   ├── schemas.ts    # Zod validation schemas
│   │   └── components/   # Auth UI components
│   │       └── AuthForm.tsx
│   ├── folders/          # Folder management
│   │   ├── actions.ts    # CRUD operations (getRootFolders, createFolder, etc.)
│   │   └── components/   # Folder UI
│   │       ├── FolderTree.tsx    # Container with optimistic updates
│   │       └── FolderItem.tsx    # Recursive folder item
│   └── prompts/          # Prompt management
│       ├── actions.ts    # Prompt operations
│       └── components/   # Prompt UI
│           └── PromptList.tsx
│
├── components/           # Shared components
│   ├── layout/          # Layout components
│   │   └── Header.tsx
│   ├── theme-provider.tsx
│   └── ui/              # Shadcn UI components
│       ├── button.tsx
│       ├── input.tsx
│       ├── card.tsx
│       ├── form.tsx
│       ├── label.tsx
│       ├── dropdown-menu.tsx
│       └── sonner.tsx (toast)
│
├── lib/                 # Shared utilities
│   ├── db.ts           # Prisma client singleton (default export)
│   ├── supabase.ts     # Supabase client factory
│   ├── supabase/
│   │   └── server.ts   # Server-side Supabase client
│   └── utils.ts        # Utility functions (cn helper)
│
├── stores/             # Zustand state stores
│   └── use-ui-store.ts # UI state (expanded folders, selected items)
│
├── app/                # Next.js App Router
│   ├── (auth)/        # Authentication routes (route group)
│   │   ├── login/
│   │   │   └── page.tsx
│   │   └── layout.tsx
│   ├── (app)/         # Authenticated app routes (route group)
│   │   ├── dashboard/
│   │   │   └── page.tsx
│   │   ├── profile/
│   │   │   └── page.tsx
│   │   ├── settings/
│   │   │   └── page.tsx
│   │   ├── page.tsx
│   │   └── layout.tsx  # Three-pane layout
│   ├── auth/          # Auth API routes
│   │   └── sign-out/
│   │       └── route.ts
│   └── layout.tsx     # Root layout (theme, fonts)
│
├── styles/            # Global styles
│   └── globals.css    # Tailwind directives + theme variables
│
└── middleware.ts      # Next.js middleware (auth check)
```

## Database Schema (Prisma)

### Current Models
- **Profile**: User profiles (1:1 with auth.users)
  - id (String, PK, from Supabase auth)
  - display_name (optional)
  - created_at

- **Folder**: Hierarchical folder structure (self-referencing)
  - id (UUID, PK)
  - name
  - user_id (FK → Profile)
  - parent_id (FK → Folder, self-reference)
  - children (relation)
  - prompts (relation)
  - created_at

- **Prompt**: User prompts with content and metadata
  - id (UUID, PK)
  - title
  - content (text)
  - content_tsv (tsvector for full-text search)
  - user_id (FK → Profile)
  - folder_id (FK → Folder, nullable)
  - versions (relation)
  - tags (relation)
  - created_at, updated_at

- **PromptVersion**: Version control with diff-match-patch
  - id (Int, PK, auto-increment)
  - diff (text, stores patch)
  - prompt_id (FK → Prompt)
  - created_at

- **Tag**: User-scoped tags (many-to-many with Prompts)
  - id (UUID, PK)
  - name (unique)
  - user_id
  - prompts (relation)

### Key Relationships
- Profile → Folders (1:many)
- Profile → Prompts (1:many)
- Folder → Folder (self-referencing parent/children)
- Folder → Prompts (1:many)
- Prompt → PromptVersion (1:many)
- Prompt ↔ Tag (many-to-many)

### Indexes
- Folder: user_id + parent_id
- Prompt: user_id + folder_id
- Prompt: content_tsv (GIN index for full-text search)
- PromptVersion: prompt_id
- Tag: user_id

## Architecture Patterns

### Next.js App Router Patterns
- **Server Components** by default for data fetching
- **Client Components** only when needed (marked with `"use client"`)
- **Server Actions** for mutations (marked with `"use server"`)
- **Route Groups**: `(auth)` and `(app)` for layout isolation
- **Middleware**: Authentication checks for protected routes

### Authentication Flow
1. Supabase Auth for user management
2. Middleware checks session on all routes
3. Server actions validate user before mutations
4. RLS policies enforce data isolation in database

### State Management Strategy
- **Server State**: Fetched in Server Components, passed to Client Components
- **Global UI State**: Zustand for expanded folders, selected items
- **Form State**: React Hook Form with Zod validation
- **Theme State**: next-themes for dark/light mode
- **Notifications**: Sonner toast library

### Optimistic UI Pattern
- Folder operations update local state immediately
- Server actions return updated data
- Parent-child callback props for state propagation
- Toast notifications for feedback

## File Size Policy
- **Maximum 500 lines per file** (mandatory)
- Use modular architecture to keep files manageable
- Refactor when approaching limit
- Current files are well within limits

## Current Implementation Status
✅ Phase 1: Project Setup (Complete)
✅ Phase 2: Authentication (Complete)
✅ Phase 3: Data Security (RLS policies needed)
🔄 Phase 4: Folder & Prompt Organization (In Progress)
⏳ Phase 5: Monaco Editor & Versioning (Pending)
⏳ Phase 6: Search & Tags (Pending)
