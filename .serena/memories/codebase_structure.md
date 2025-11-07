# PromptHub - Codebase Structure
Last Updated: 07/11/2025 02:15 GMT+10

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

### P1S1 Implemented Structure
```
src/
├── features/              # Feature modules (domain-driven)
│   └── auth/             # Authentication (P1S1)
│       ├── actions.ts    # Server actions (signUp, signIn, signOut)
│       ├── schemas.ts    # Zod validation schemas
│       └── components/   # Auth UI components
│           ├── AuthForm.tsx        # Main auth form (sign in/up)
│           └── FormError.tsx       # Error display component
│
├── components/           # Shared components
│   ├── layout/          # Layout components (P1S1)
│   │   └── Header.tsx   # Context-aware header
│   └── ui/              # Shadcn UI components
│       ├── button.tsx
│       ├── card.tsx
│       ├── input.tsx
│       ├── label.tsx
│       └── toaster.tsx  # Sonner toast wrapper
│
├── lib/                 # Shared utilities
│   └── supabase/
│       ├── client.ts    # Client-side Supabase client
│       └── server.ts    # Server-side Supabase client
│
├── pages/               # Next.js Pages Router (P1S1)
│   ├── _app.tsx        # App wrapper (fonts, toaster)
│   ├── _document.tsx   # Document (dark mode)
│   ├── index.tsx       # Landing page
│   ├── login.tsx       # Auth page
│   └── dashboard.tsx   # Protected dashboard
│
├── styles/             # Global styles
│   └── globals.css     # Bold Simplicity design system
│
└── middleware.ts       # Auth protection middleware
```

## Key File Locations (P1S1)

### Design System
- **CSS Variables**: `src/styles/globals.css`
- **Colors**: Indigo #4F46E5, Magenta #EC4899
- **Typography**: Inter font (400, 500, 600)
- **Spacing**: 4px grid system

### Authentication
- **Server Actions**: `src/features/auth/actions.ts`
- **Validation Schemas**: `src/features/auth/schemas.ts`
- **Auth Form**: `src/features/auth/components/AuthForm.tsx`
- **Error Component**: `src/features/auth/components/FormError.tsx`

### Layout Components
- **Header**: `src/components/layout/Header.tsx`
- **Context-aware**: Shows different content based on auth state

### Supabase Integration
- **Client**: `src/lib/supabase/client.ts` (browser)
- **Server**: `src/lib/supabase/server.ts` (API/SSR)

### Pages
- **Landing**: `src/pages/index.tsx`
- **Login**: `src/pages/login.tsx`
- **Dashboard**: `src/pages/dashboard.tsx` (protected)

## Database Schema (Prisma)

### Current Models (P1S1)
- **User**: Managed by Supabase Auth (auth.users)
  - No custom user table yet
  - RLS policies enforce data isolation

### Planned Models
- **Profile**: User profiles (1:1 with auth.users)
- **Folder**: Hierarchical folder structure
- **Prompt**: User prompts with content
- **PromptVersion**: Version control
- **Tag**: User-scoped tags

## Architecture Patterns (P1S1)

### Authentication Flow
1. **Client**: AuthForm captures credentials
2. **Server Action**: Validates with Zod schema
3. **Supabase Auth**: Creates/verifies user
4. **Error Handling**: Returns error objects (never throws)
5. **Feedback**: Dual system (toast + inline)
6. **Redirect**: Client-side navigation on success

### Error Handling Pattern
```typescript
// Server actions return error objects
const result = await signIn(data)
if (result.error) {
  // Show inline error
  // Show toast notification
}
```

### Dual Feedback System
- **Toast Notifications**: 
  - Errors: 6000ms duration
  - Success: 3000ms duration
- **Inline Errors**: 
  - Below form fields
  - Red text with error icon
  - FormError component

### Loading States
- **Form Submission**: Button shows "Signing in..."
- **Redirecting**: "Redirecting to dashboard..."
- **Disabled**: Form disabled during submission

### Context-Aware Components
- **Header**: Shows sign out when authenticated
- **Pages**: Different content for auth/unauth users
- **Middleware**: Protects routes automatically

## Component Patterns (P1S1)

### FormError Component
```typescript
// Reusable error display
<FormError message={error} />
```

### Context-Aware Header
```typescript
// Shows sign out when authenticated
<Header />
```

### AuthForm Pattern
- Mode switching (sign in/up)
- Form change detection (useEffect)
- Dual error feedback
- Loading states
- Redirect feedback

## Styling Architecture (P1S1)

### Bold Simplicity Design System
- **Dark Mode First**: Default dark theme
- **Primary Color**: Indigo #4F46E5
- **Accent Color**: Magenta #EC4899
- **Typography**: Inter font family
- **Spacing**: 4px grid (0.5, 1, 2, 3, 4, 6, 8, 12, 16, 24)
- **Borders**: Rounded corners throughout
- **Transitions**: Smooth 150ms ease

### CSS Variable System
```css
:root {
  --primary: 263.4 70% 50.4%;     /* Indigo */
  --accent: 330 81% 60%;          /* Magenta */
  --background: 224 71% 4%;       /* Dark blue-black */
  --foreground: 213 31% 91%;      /* Light text */
  /* ... */
}
```

## File Size Policy
- **Maximum 500 lines per file** (mandatory)
- Current P1S1 files well within limits:
  - AuthForm.tsx: ~200 lines
  - actions.ts: ~100 lines
  - Header.tsx: ~50 lines
  - globals.css: ~150 lines

## Current Implementation Status
✅ Phase 1: Authentication & Design (P1S1 Complete)
⏳ Phase 2: Core Application Features (Pending)
⏳ Phase 3: Advanced Features (Pending)

## P1S1 Deliverables
✅ Design system implementation
✅ Authentication server actions
✅ Auth form components
✅ Error handling patterns
✅ Toast notification system
✅ Context-aware header
✅ Protected routes
✅ E2E testing completed
✅ Accessibility audit passed
✅ Full documentation delivered
