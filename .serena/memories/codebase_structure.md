# PromptHub - Codebase Structure

## Root Directory Structure
```
/home/allan/projects/PromptHub/
├── src/                    # Source code
├── prisma/                 # Database schema and migrations
├── supabase/              # Supabase configuration
├── docs/                  # Project documentation and rules
├── PRPs/                  # Product Requirements & Planning
├── wip/                   # Work in progress files
├── mermaid/               # Generated diagrams
├── .claude/               # Claude configuration
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
```

## Source Code Structure (`src/`)

### Feature-Based Organization
```
src/
├── features/              # Feature modules (domain-driven)
│   ├── auth/             # Authentication
│   │   ├── actions.ts    # Server actions (signUp, signIn)
│   │   ├── schemas.ts    # Zod validation schemas
│   │   └── components/   # Auth UI components
│   ├── folders/          # Folder management
│   │   ├── actions.ts    # CRUD operations
│   │   └── components/   # Folder UI (FolderTree, FolderItem)
│   └── prompts/          # Prompt management
│       ├── actions.ts    # Prompt operations
│       └── components/   # Prompt UI (PromptList)
│
├── components/           # Shared components
│   ├── layout/          # Layout components (Header)
│   └── ui/              # Shadcn UI components
│
├── lib/                 # Shared utilities
│   ├── db.ts           # Prisma client singleton
│   ├── supabase.ts     # Supabase client
│   ├── supabase/server.ts  # Server-side Supabase
│   └── utils.ts        # Utility functions
│
├── stores/             # Zustand state stores
│   └── use-ui-store.ts
│
├── app/                # Next.js App Router
│   ├── (auth)/        # Authentication routes (grouped)
│   │   ├── login/
│   │   └── layout.tsx
│   ├── (app)/         # Authenticated app routes (grouped)
│   │   ├── dashboard/
│   │   ├── profile/
│   │   ├── settings/
│   │   ├── page.tsx
│   │   └── layout.tsx
│   ├── auth/          # Auth API routes
│   │   └── sign-out/
│   └── layout.tsx     # Root layout
│
├── styles/            # Global styles
│   └── globals.css
│
└── middleware.ts      # Next.js middleware (auth check)
```

## Database Schema (Prisma)

### Models
- **Profile**: User profiles (1:1 with auth.users)
- **Folder**: Hierarchical folder structure (self-referencing)
- **Prompt**: User prompts with content and metadata
- **PromptVersion**: Version control with diff-match-patch
- **Tag**: User-scoped tags (many-to-many with Prompts)

### Key Relationships
- Profile → Folders (1:many)
- Profile → Prompts (1:many)
- Folder → Folder (self-referencing parent/children)
- Folder → Prompts (1:many)
- Prompt → PromptVersion (1:many)
- Prompt ↔ Tag (many-to-many)

## Architecture Patterns

### Next.js App Router Patterns
- **Server Components** by default
- **Client Components** only when needed (interactivity, hooks)
- **Server Actions** for mutations (`"use server"`)
- **Route Groups**: `(auth)` and `(app)` for layout isolation
- **Middleware**: Authentication checks for protected routes

### Authentication Flow
1. Supabase Auth for user management
2. Middleware checks session on all routes
3. Server actions validate user on mutations
4. RLS policies enforce data isolation in database

### State Management
- **Server State**: Fetched in Server Components, passed to Client
- **Global State**: Zustand for UI state
- **Form State**: React Hook Form with Zod validation
- **Theme State**: next-themes for dark/light mode

## File Size Policy
- **Maximum 500 lines per file**
- Use modular architecture to keep files manageable
- Refactor when approaching limit
