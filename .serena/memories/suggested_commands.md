# PromptHub - Suggested Commands

## Development Commands

### Server Management
```bash
# Start development server (port 3010)
npm run dev

# Build for production
npm run build

# Start production server
npm start

# IMPORTANT: Server uses HMR - avoid unnecessary restarts
# Stop existing servers before starting new ones if needed
```

### Code Quality
```bash
# Run ESLint
npm run lint

# Run TypeScript type checking
npx tsc --noEmit

# Run both (recommended before commits)
npm run lint && npx tsc --noEmit
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

## Task Completion Checklist

### Before Committing
1. ✓ Run `npm run lint` - Fix all errors
2. ✓ Run `npx tsc --noEmit` - Fix type errors
3. ✓ Run `npm run build` - Verify build success
4. ✓ Test primary functionality
5. ✓ Test database migrations (up/down cycles)
6. ✓ Update documentation if needed
7. ✓ Stage and commit with proper prefix

### After Task Completion
1. ✓ Verify tests passing (80%+ coverage)
2. ✓ Check code follows style guidelines
3. ✓ Confirm no secrets committed
4. ✓ Update task status in tracking system
5. ✓ Create completion summary if required

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
