# PromptHub - Suggested Commands

**Last Updated**: 07/11/2025 13:10 GMT+10
**Project Status**: P1S1 Complete (100% - 15/15 tasks)
**Server Status**: Dev server can run on port 3010 (`npm run dev`)

## Development Commands (P1S1 Proven Workflow)

### Server Management
```bash
# Start development server (port 3010)
npm run dev

# Build for production (verified in P1S1 - zero errors)
npm run build

# Start production server
npm start

# CRITICAL: Server uses HMR (Hot Module Replacement)
# - Avoid unnecessary restarts
# - Changes reflect immediately
# - Stop existing servers before starting new ones
# - Port 3010 must be available
```

### Code Quality (Pre-Commit MANDATORY)
```bash
# Run ESLint (MUST pass before committing)
npm run lint

# Run TypeScript type checking (MUST pass before committing)
npx tsc --noEmit

# Run both (recommended before all commits)
npm run lint && npx tsc --noEmit

# Production build test (P1S1: Verified zero errors)
npm run build

# Build + start for testing
npm run build && npm start
```

### Database Management
```bash
# Link to Supabase project (one-time setup)
supabase link --project-ref xmuysganwxygcsxwteil

# Run Prisma migrations (development)
npx prisma migrate dev

# Generate Prisma client
npx prisma generate

# View database in Prisma Studio
npx prisma studio

# Create a new migration
npx prisma migrate dev --name migration_name

# Test migration up/down cycles (BEFORE commits)
# 1. Apply migration: npx prisma migrate dev
# 2. Check: npx prisma migrate status
# 3. Rollback test: npx prisma migrate reset (CAREFUL: dev only)

# NEVER use: supabase start (cloud Supabase only)
```

### Git Workflow
```bash
# Stage changes
git add .

# Check staged changes
git diff --staged

# Commit with proper prefix
git commit -m "<prefix>: <message>"
# Prefixes: feat, fix, refactor, style, chore, docs, test

# NEVER include Claude Code sign-off in commit messages
```

## Testing Commands

### Test Execution
```bash
# Run tests (when test suite is set up)
npm run test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage

# Target: 80%+ coverage
```

### Integration Testing
```bash
# Test primary functionality after changes
# 1. Start dev server: npm run dev
# 2. Open browser: http://localhost:3010
# 3. Test auth flow: sign up, sign in, sign out
# 4. Test core features: folders, prompts
```

## Supabase CLI Commands

### Project Management
```bash
# Login to Supabase (if needed)
supabase login

# Link to project
supabase link --project-ref xmuysganwxygcsxwteil

# Check project status
supabase status

# View project info
supabase projects list
```

### Database Operations
```bash
# Execute SQL file
supabase db execute -f path/to/file.sql

# Dump database schema
supabase db dump

# Reset database (CAREFUL: destructive)
supabase db reset
```

## System Commands (Linux)

### File Operations
```bash
# List directory contents
ls -la

# Find files
find /path -name "pattern"

# Search in files
grep -r "pattern" /path

# Change directory
cd /path/to/directory

# Current working directory
pwd
```

### Path Rules
- ALWAYS use forward slashes (`/`)
- NEVER use backslashes
- NEVER use template variables like `{{WORKSPACE_FOLDER}}`
- Use actual path: `/home/allan/projects/PromptHub`

## Task Completion Checklist (P1S1 PROVEN PATTERNS)

### Pre-Commit Checks (MANDATORY - P1S1 Pattern)
1. ✅ Run `npm run lint` - Fix all errors
2. ✅ Run `npx tsc --noEmit` - Fix type errors
3. ✅ Run `npm run build` - Verify build success (P1S1: Zero errors achieved)
4. ✅ Test primary functionality in browser
5. ✅ Test database migrations (up/down cycles) if applicable
6. ✅ Check console for errors/warnings
7. ✅ Test in light and dark modes (if UI affected)
8. ✅ Verify responsive behavior
9. ✅ Update documentation if needed
10. ✅ Stage and commit with proper prefix format

### Code Quality Verification (P1S1 Pattern)
1. ✅ File sizes under 500 lines (checked in P1S1)
2. ✅ Functions under 50 lines
3. ✅ Lines under 100 characters
4. ✅ No console.log or debug code
5. ✅ No secrets in code
6. ✅ Proper error handling (try-catch, error objects)
7. ✅ All imports organized correctly

### After Task Completion (P1S1 Pattern)
1. ✅ Verify all tests passing (E2E testing with Chrome DevTools MCP)
2. ✅ Check code follows style guidelines
3. ✅ Confirm no secrets committed
4. ✅ Update Archon task status: `doing` → `review` → `done`
5. ✅ Create completion summary/documentation
6. ✅ Update PRP document if applicable
7. ✅ Update Serena memories if architecture changed

### P1S1 Success Pattern Applied
- E2E tests run with Chrome DevTools MCP
- Accessibility audit performed
- Manual testing guide created
- INITIAL and REPORT documents delivered
- Task verification completed for all core tasks
- Archon status updates tracked
- Console errors: Zero achieved

## Environment Setup

### Required Environment Variables
```bash
# Copy example file
cp .env.example .env

# Edit with your values
# NEXT_PUBLIC_SUPABASE_URL=
# NEXT_PUBLIC_SUPABASE_ANON_KEY=
# SUPABASE_SERVICE_ROLE_KEY=
# DATABASE_URL=
# DIRECT_URL=
```

### Virtual Environment
- Location: `.venv/` at project root
- Activation (if needed): `source .venv/bin/activate`

## Quick Reference

### Project Details
- **Project**: PromptHub
- **Supabase Project ID**: xmuysganwxygcsxwteil
- **Supabase URL**: https://xmuysganwxygcsxwteil.supabase.co
- **Workspace**: /home/allan/projects/PromptHub
- **Dev Port**: 3010
- **Platform**: Linux

### Key Paths
- Source: `src/`
- Features: `src/features/`
- Components: `src/components/`
- Database: `prisma/`
- Docs: `docs/`
- PRPs: `PRPs/`
- WIP: `wip/`
