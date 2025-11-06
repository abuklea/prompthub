# PromptHub
## CLAUDE.md - Project Instructions

| `Title` | `Created` | `Last modified` |
|---------|-----------|-----------------|
| CLAUDE.md - Project Instructions | 06/11/2025 00:00 GMT+10 | 06/11/2025 14:30 GMT+10 |

---

## CRITICAL: ARCHON-FIRST RULE

**READ THIS FIRST - OVERRIDES ALL OTHER INSTRUCTIONS**

This project uses **Archon MCP server** for task management. Do NOT use TodoWrite.

```bash
# Project Configuration
ARCHON_PROJECT_ID: d449f266-1f36-47ad-bd2d-30f1a0f5e999
ARCHON_PROJECT_NAME: PromptHub
WORKSPACE_FOLDER: /home/allan/projects
SUPABASE_PROJECT_ID: xmuysganwxygcsxwteil
SUPABASE_PROJECT_URL: https://xmuysganwxygcsxwteil.supabase.co
```

**Mandatory Workflow:**
1. Check Archon for current tasks BEFORE any work
2. Update task status to `doing` BEFORE implementation
3. Update task to `review` BEFORE completion
4. Task flow: `todo` → `doing` → `review` → `done`

---

## Project Overview

**PromptHub** is a centralized repository where users can efficiently store, organize, and manage their AI prompts, built with a modern, themeable, and responsive frontend.

## Technology Stack

**Frontend:**
- Next.js 14.2.3 (Pages Router)
- React 18.3.1
- TypeScript 5.4.5
- Tailwind CSS 3.4.3
- Shadcn/UI components
- Framer Motion 11.2.4

**Backend:**
- Supabase (PostgreSQL + Auth + Storage + RLS)
- Prisma 6.19.0 (ORM)
- Next.js API routes

**State Management:**
- Zustand 4.5.2 (global state)
- React Hook Form 7.66.0 (forms)
- Zod 3.25.76 (validation)

**Development:**
- Node.js + npm
- ESLint + TypeScript strict mode
- Dev server port: 3010

## Rule Imports

@docs/rules/archon.md
@docs/rules/project.md
@docs/rules/documentation.md
@docs/rules/documentation-prp.md
@docs/rules/tools.md
@docs/rules/testing.md
@docs/rules/git.md

---

## Core Development Rules

### Mandatory Practices

**NO Placeholders or Mock Data:**
- NEVER use dummy/mock data in implementations
- ONLY real, validated, production-ready data
- Exception: Test suites only
- NO temporary workarounds or bypasses

**NO Backwards Compatibility:**
- Clean, modern implementations only
- Don't support superseded code/methods
- Remove old patterns when upgrading

**Production Code Only:**
- Real database operations ALWAYS
- No disabled or bypassed features
- Proper error handling required
- Full integration before task completion

**Verification Required:**
- NEVER assume, presume, or guess
- Verify file paths and module names
- Ask for clarification when uncertain
- Don't over-estimate completeness

### Agent and Task Management

**Subagent Usage:**
- Use Task tool to spawn parallel subagents
- Assign most-suitable agent for each task
- Mark parallelizable tasks with `[P]`
- Share comprehensive context between agents

**Task Guidelines:**
- Task size: 30 minutes - 4 hours
- Split large tasks into discrete units
- Check for duplicates before creating
- Update Archon status BEFORE and AFTER work
- Sync Archon tasks with PRP documents
- Prefix task IDs: PXTXSX (e.g., P1T1S1)

**Task Completion Criteria:**
- ✅ Goals achieved
- ✅ Best practices followed
- ✅ Code style guidelines met
- ✅ Security addressed
- ✅ Tests passing (80%+ coverage)
- ✅ Documentation updated
- ✅ Completion summary added to Archon
- ✅ Task status set to `review`

---

## Design Principles

### KISS (Keep It Simple, Stupid)
Choose straightforward solutions over complex ones. Simple solutions are easier to understand, maintain, and debug.

### YAGNI (You Aren't Gonna Need It)
Implement features only when needed, not when anticipated. Avoid speculative development.

### SOLID Principles
- **Single Responsibility**: One clear purpose per function/class/module
- **Open/Closed**: Open for extension, closed for modification
- **Dependency Inversion**: Depend on abstractions, not implementations

### DRY (Don't Repeat Yourself)
Centralize and reuse common components. Apply SSOT (Single Source of Truth) principles.

### Additional Design Rules
- Use clear, meaningful, unambiguous names
- Fail fast: Check errors early, raise exceptions immediately
- Document complex algorithms with tables and mermaid diagrams
- Follow TDD: Tests before implementation, 80%+ coverage
- Run lint/typecheck often
- Use TypeScript for all Next.js/React code

---

## Code Structure & Style

### File Structure Rules
- **Max 500 lines per file** - Refactor when approaching limit
- **Max 50 lines per function** - Single, clear responsibility
- **Max 100 characters per line**
- **Modular architecture** - Group by feature or responsibility
- **All text files end with newline** (mandatory)

### TypeScript/React Standards
- Strict TypeScript mode enabled
- Functional components with TypeScript interfaces
- PascalCase for components, camelCase for functions/variables

### File Naming Conventions (EXAMPLES)

| Type | Convention | Example |
|------|------------|---------|
| Components | PascalCase.tsx | `GlobeViewer.tsx` |
| Pages | kebab-case/lowercase | `login.tsx`, `auth/sign-in.tsx` |
| Utilities | camelCase.ts | `formatCoordinates.ts` |
| Types | *.types.ts | `user.types.ts` |
| Actions | actions.ts | `features/auth/actions.ts` |

### Code Documentation
- Module docstrings explaining purpose
- Complete docstrings for public functions
- Inline comments with `// Reason:` prefix for complex logic
- Documentation for developers only (no marketing language)
- Be critical and realistic (no over-confidence or over-selling)

---

## Security & Environment

### Security Requirements
- Never commit secrets - use environment variables
- Validate all user input
- Parameterized queries for database operations
- Rate limiting for public APIs
- JWT authentication via Supabase Auth
- RLS policies for data isolation
- Environment variable validation on startup

### Environment Variables
Required in `.env`:
```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=""
NEXT_PUBLIC_SUPABASE_ANON_KEY=""
SUPABASE_SERVICE_ROLE_KEY=""

# Prisma
DATABASE_URL=""
DIRECT_URL=""
```

---

## Architecture Patterns

### Next.js Patterns
- Server Components by default
- Client Components only when needed (interactivity, hooks)
- Server Actions for mutations
- API routes for external integrations
- Avoid handling Promises in Client Components

### State Management
- Zustand for global state
- React Hook Form for forms
- Zod for validation
- Local state with useState/useContext

### Database Patterns
- Supabase for auth, storage, realtime
- Prisma for type-safe database access
- RLS policies enforce multi-tenancy
- No triggers on `auth.users` (Supabase Cloud limitation)

---

## MCP Tool Usage

### Tool Priority Order
1. **archon** - Task management (PRIMARY - never use TodoWrite)
2. **serena** - Code analysis, intelligent editing, cross-references
3. **perplex** / **brave** - Online research, debugging, solutions
4. **seqthk** - Complex task planning and reasoning
5. **ref** / **context7** - API docs and code examples
6. **time** - Date/time and timezone tools
7. **mermaid** - Generate PNG + SVG (transparent backgrounds)

### Mermaid Diagram Generation
Always generate BOTH formats:
```bash
# Output location: /home/allan/projects/mermaid/
# Format: {{filename}}-{{diagram_id}}.png
# Format: {{filename}}-{{diagram_id}}.svg
# Background: transparent (both files)
```

---

## Path & File Conventions

### Path Rules
- ALWAYS use forward slashes (`/`), never backslashes
- NEVER use template variables in commands (replace with actual values)
- No `{{WORKSPACE_FOLDER}}` - use `/home/allan/projects/PromptHub`

### File Organization
| Purpose | Location | Naming Pattern |
|---------|----------|----------------|
| Work in progress | `./wip/` | `T417-T420-validation-testing-guide.md` |
| PRP documents | `./PRPs/` | `P#S#-feature-name.md` |
| PRP reports | `./PRPs/reports/` | `*-INITIAL.md`, `*-REPORT.md` |

---

## Development Workflow

### Pre-Commit Checklist
1. Run `npm run lint` - Fix all errors
2. Run `npm run build` - Verify build success
3. Test primary functionality
4. Run database migration tests (up/down cycles)
5. Update documentation if needed
6. Stage and commit with proper prefix

### Git Commit Prefixes
```bash
feat: New feature
fix: Bug fix
refactor: Code restructuring
style: Formatting changes
chore: Maintenance tasks
docs: Documentation updates
test: Test additions/changes
```

### Server Management
- Dev server runs on port 3010
- HMR is active - avoid unnecessary restarts
- Stop existing servers before starting new ones
- Use `npm run dev` to start

### Database Management
- Use Supabase cloud (no local instance)
- Use `supabase` CLI for migrations
- Connect: `supabase link --project-ref xmuysganwxygcsxwteil`
- NO triggers on `auth.users` table (Supabase Cloud restriction)

---

## Performance Guidelines

### Best Practices
- Prefer async/await over promise chains
- Debounce user input handlers
- Optimize database queries (use indexes)
- Implement proper loading states
- Handle Supabase server client cookie operations carefully

### Optimization Targets
- Initial page load < 2s
- Time to interactive < 3s
- Lighthouse score > 90
- Test coverage > 80%

---

## Critical Reminders

**DO NOT:**
- ❌ Use `supabase start` (cloud Supabase only)
- ❌ Create triggers on `auth.users` table
- ❌ Use template variables in commands
- ❌ Use TodoWrite (use Archon)
- ❌ Add marketing language to docs
- ❌ Commit secrets or env values
- ❌ Use placeholder/mock data in production code
- ❌ Implement backwards compatibility

**ALWAYS:**
- ✅ Check Archon tasks before starting work
- ✅ Use forward slashes in paths
- ✅ Run lint/typecheck before commits
- ✅ Update task status in Archon
- ✅ Write tests (TDD approach)
- ✅ Document complex logic
- ✅ Use real, production-ready data
- ✅ End files with newline character
