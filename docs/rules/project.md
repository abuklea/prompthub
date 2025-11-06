# PROJECT: PromptHub

<brief>
PromptHub is a centralized repository where users can efficiently store, organize, and manage their AI prompts, built with a modern, themeable, and responsive frontend.
</brief>

## WEB PORTAL ARCHITECTURE

**Frontend**: Next.js 15 + React 19 + TypeScript + Tailwind CSS + Shadcn/UI + Framer Motion  
**Backend**: Supabase (PostgreSQL+Auth+Storage+Realtime+RLS policies)
**State Management**: Zustand for global state, React Context for local state  
**Deployment**: Vercel hosting for frontend with Next.js API routes for serverless functions, Supabase managed backend  
**UI Components**: Shadcn components and custom additions  
**Development**: Node.js + npm ecosystem

## Core Instructions, rules, and Requirements

- **MANDATORY**: Use appropriate AGENTS and **subagents** for all tasks
- **CRITICAL**: Always use forward slashes (`/`) for paths, never backslashes
- Virtual environment at project root: `.venv/`, not `/backend/`
- PRP documentations and outputs (guides, working documents) to be placed in folder: `./PRPs/docs`
- You _MUST_ create an initial PRP start report (`*-INITIAL.md`) that details the plan for executing the PRP
- You _MUST_ create a PRP completion report (`*-REPORT.md`) as a final outcome as per instructions
- PRP start (`*-INITIAL.md`) and completion (`*-REPORT.md`) reports are to be placed in folder: `PRPs/reports`
- Any other project testing/debugging/working files go in `./wip` folder:
  - Use consistently formatted and informative file naming
  - prefix with task number/code of range of related tasks, T,  (e.g. T211-taskname, T110-T112-taskname, ...)
  - use lower hyphen case, EXAMPLES:
    - T417-T420-validation-testing-guide.md
    - T118-band-management-test-report.md
    - T320-T321-integration-testing-completion-summary.md

- The server is using HMR. Don't keep starting new servers UNLESS NECESSARY!
- **ALWAYS** stop any running servers before starting (or restarting) any frontend and/or backend servers, and only do so if required and not already running.

## Development Rules
- **ALWAYS use subagents** for complex tasks, and parallelize tasks when possible
- **Quality**: Run lint/typecheck before commits, and plan/iterate to remove errors
- **Database**: ALWAYS test migration up/down cycles before database commits

## Specific Preferences
- Prefer async/await
- Asynchronous operations within synchronous-looking function signatures, such as the Supabase server client's cookie handling, must be carefully managed to avoid `await` misuse.

## Template Rule Variables
- Template variables represent dynamic arguments, make sure to use the correct and intended values:

**PROJECT SPECIFIC DETAILS**:
{
  - {{ARCHON_PROJECT_NAME}} = `PromptHub`
  - {{SUPABASE_PROJECT_ID}} = `xmuysganwxygcsxwteil`
  - {{SUPABASE_PROJECT_URL}} = `https://xmuysganwxygcsxwteil.supabase.co`
  - {{WORKSPACE_FOLDER}} = `/home/allan/projects`

## Terminal Commands

- CRITICAL! NEVER use or attempt to use the template rule variables themselves instead of their mapped VALUES.
- Template variables such as `{{WORKSPACE_FOLDER}}` and `{{ARCHON_PROJECT_ID}}` NEED TO ALWAYS BE REPLACED with the _correct and intended actual/dynamic values_.
- When running system/terminal commands, make sure the cwd/environment is correct and any required environments have been activated:
  - `cd {{WORKSPACE_FOLDER}}; source .venv/bin/activate;`

## Database, authentication & Storage
- Use the `supabase cli` application to administer the remote database:
  - Connect using: `supabase link --project-ref {{SUPABASE_PROJECT_ID}}` (Note: The developer must be prompted to login manually using `supabase cli` if not already logged in)
  - Use the `supabase cli` tools to perform db migration, management, and configuration of the database
- **NEVER** call `supabase start` or create a local Supabase instance; we are using cloud Supabase
- **Auth**: Supabase JWT + RLS policies
- **NO database triggers on auth.users** when using Supabase Auth as it not permitted in Supabase Cloud
- **Storage**: Example: `storage/{user_id}/{dataset_id}/` isolation
- **Quotas**: Per-user file size limits (env vars: DEFAULT_MAX_*_SIZE_MB)

### Supabase Integration
- **Authentication**: Row Level Security (RLS) policies for data isolation
- **Storage**: User-scoped file storage with path pattern `{user_id}/{dataset_id}/`
- **Real-time**: Supabase
- **Edge Functions**: For server-side processing

### Environment Configuration
Required environment variables (see `.env.example`):
```bash
# Supabase (Required)
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_key
SUPABASE_JWT_SECRET=your_jwt_secret

# Application (Required)
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

## Architecture Constraints (NEVER CHANGE)
- **Optimal Architecture**: Locate and apply the optimal, and best architectures and coding patterns specific to the development platform/framework (i.e., Next.js) 
  - Don't attempt to handle a Promise in a Client Component. Instead, create a Server Component wrapper that awaits
  the promise and passes the resolved values to the Client Component.
- **Branding & UI**: 
  - Page Titles: MUST use `usePageTitle` hook with "Walking Tours | {{PAGE_TITLE}}" format
  - Header Brand: MUST use "Walking Tours" format with `font-extrabold tracking-tighter text-2xl`
- **Background Components**: MUST use smart interval management with exit conditions (NEVER continuous polling)
- **UI Styling**: MUST use modular Shadcn Studio theme supported system (https://shadcnstudio.com/theme-generator) with CSS variables (NEVER hardcoded colors)
- **Active States**: MUST provide universal and visual press/hover/interaction feedback on ALL interactive elements
- **UI Section Management**: MUST use modular components and responsive grids and layouts that support mobile and desktop modes, with touch and mouse (each with expertly designed and well-considered UI/layout implementations for each specific mode), using collapsible patterns with localStorage persistence
- **File Structure**: MUST keep all files under 500 lines, use modular architecture patterns to keep file sizes down and in check

## Security & Performance

### EXAMPLE PATTERNS

**Security Patterns**:
```typescript
// Row Level Security (RLS) enforcement in all Supabase queries
const { data, error } = await supabase
  .from('tours')
  .select('*')
  .eq('user_id', user.id); // RLS policy auto-enforces this filter

// Environment variable validation
const requiredEnvVars = [
  'NEXT_PUBLIC_SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_ANON_KEY'
];

requiredEnvVars.forEach(varName => {
  if (!process.env[varName]) {
    throw new Error(`Missing required environment variable: ${varName}`);
  }
});
```

**Performance Patterns**:

```typescript
// Debounced resize handling if required
const debouncedResize = useMemo(
  () => debounce(() => {
    if (viewerRef.current) viewerRef.current.resize();
  }, 100),
  []
);
```
