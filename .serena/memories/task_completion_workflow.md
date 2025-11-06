# PromptHub - Task Completion Workflow
Last Updated: 06/11/2025 19:56 GMT+10

## Pre-Commit Checklist (MANDATORY)

### 1. Code Quality Checks
```bash
# Run linting
npm run lint

# Fix lint errors if any
# Re-run until clean

# Type checking is done during build
# Next.js automatically type-checks
```

### 2. Build Verification
```bash
# Test production build
npm run build

# Verify build succeeds
# Fix any build errors
# Re-run until successful
```

### 3. Database Migration Testing (if applicable)
```bash
# If migrations were created/modified:

# 1. Test migration up
npx prisma migrate dev

# 2. Check status
npx prisma migrate status

# 3. Test in Supabase dashboard
# - Link to Supabase: supabase link --project-ref xmuysganwxygcsxwteil
# - Push changes: supabase db push

# Iterate to fix any issues
```

### 4. Functional Testing
- Test primary functionality affected by changes
- Test authentication flow if auth-related
- Test database operations if data-related
- Verify no breaking changes to existing features
- Check console for errors or warnings
- Test in both light and dark modes
- Verify responsive behavior

### 5. Documentation Updates
- Update CLAUDE.md if workflow changed
- Update README.md if setup changed
- Update Serena memories if architecture changed
- Update comments if complex logic added
- Update inline docs if APIs changed

## Git Commit Process

### Stage Changes
```bash
# Stage all changes
git add .

# Or stage specific files
git add path/to/file

# Or stage by feature
git add src/features/folders/
```

### Review Staged Changes
```bash
# View diff of staged changes
git diff --staged

# Review each change carefully
# Ensure no secrets, debug code, or unwanted changes
```

### Create Commit Message

**Format**: `<prefix>: <message>`

**Prefixes**:
- `feat`: New feature
- `fix`: Bug fix
- `refactor`: Code restructuring
- `style`: Formatting changes
- `chore`: Maintenance tasks
- `docs`: Documentation updates
- `test`: Test additions/changes

**Rules**:
- Be concise but descriptive
- Focus on "what" and "why"
- List multiple changes if needed
- NEVER add author or sign-off
- NEVER include Claude Code signature

**Examples**:
```bash
# Simple fix
git commit -m "fix: Resolve hydration warning in layout"

# Feature with details
git commit -m "feat: Add instant folder updates with optimistic UI

- FolderTree now immediately updates when creating new folders
- FolderItem updates immediately when renaming folders
- Added callback props (onUpdate, onDelete) for state propagation
- Added toast notifications for all folder operations
- Folders maintain alphabetical sort order after updates"

# Multiple fixes
git commit -m "fix: Resolve build errors and console warnings

- Fixed db import in auth/actions.ts (default vs named export)
- Added suppressHydrationWarning to html tag
- Added autocomplete attributes to form inputs
- Created public directory with favicon
- Build now successful with no errors"
```

### Commit
```bash
# Commit staged changes
git commit -m "prefix: message"
```

## Task Completion Criteria

Before marking a task as complete, verify:

### ✓ Code Quality
- [ ] Lint passes: `npm run lint`
- [ ] Build succeeds: `npm run build`
- [ ] Code follows style guidelines
- [ ] File sizes under 500 lines
- [ ] Functions under 50 lines
- [ ] No console errors or warnings

### ✓ Functionality
- [ ] Feature works as expected
- [ ] No breaking changes
- [ ] Error handling implemented
- [ ] Loading states implemented
- [ ] User feedback provided (toast notifications)
- [ ] Optimistic UI updates working

### ✓ Testing (when applicable)
- [ ] Tests written (TDD approach)
- [ ] Tests passing
- [ ] Coverage > 80% for new code
- [ ] Edge cases covered

### ✓ Security
- [ ] No secrets committed
- [ ] Input validation in place (Zod schemas)
- [ ] RLS policies verified
- [ ] Authentication checks present in server actions
- [ ] User ID used in all database queries

### ✓ Database (if applicable)
- [ ] Migrations tested (up/down)
- [ ] Schema changes documented
- [ ] Indexes added where needed
- [ ] RLS policies updated
- [ ] Foreign key constraints correct

### ✓ Documentation
- [ ] Complex logic commented
- [ ] API changes documented
- [ ] README updated if needed
- [ ] CLAUDE.md updated if needed
- [ ] Serena memories updated if architecture changed

### ✓ Git
- [ ] Changes staged
- [ ] Commit message follows format
- [ ] No unwanted files included
- [ ] Branch up to date with main

## Post-Completion Actions

### Update Tracking Systems
1. Mark task as complete in Archon (when available)
2. Update PRP documents if applicable
3. Add completion notes to task
4. Update task status to "review" or "done"

### Create Summaries (if required)
- Document what was implemented
- Note any deviations from plan
- List any blockers encountered
- Suggest next steps or follow-ups

### Prepare for Review
- Ensure all checklist items complete
- Verify functionality one last time
- Check for any console errors
- Test in both light and dark modes
- Verify responsive behavior

## Special Considerations

### Server Management
- HMR is active - avoid unnecessary restarts
- Stop existing servers before starting new ones
- Dev server runs on port 3010
- Use `npm run dev` to start

### Database Constraints
- Use cloud Supabase only (no local instance)
- NO triggers on `auth.users` table (Supabase Cloud restriction)
- Use Supabase CLI for migrations
- Link project: `supabase link --project-ref xmuysganwxygcsxwteil`
- Project URL: https://xmuysganwxygcsxwteil.supabase.co

### Path Handling
- ALWAYS use forward slashes (`/`)
- NEVER use template variables in commands
- Use actual values: `/home/allan/projects/PromptHub`
- Project root: /home/allan/projects/PromptHub

### Architecture Patterns
- Server Components by default
- Client Components only when needed (marked with `"use client"`)
- Server Actions for mutations (marked with `"use server"`)
- No Promise handling in Client Components
- Careful async/await in cookie operations
- Optimistic UI updates for instant feedback

### Important Imports
- Prisma db: `import db from "@/lib/db"` (default export)
- Supabase server: `import { createClient } from "@/lib/supabase/server"`
- Toast: `import { toast } from "sonner"`

## Iteration Process

If any check fails:
1. Fix the issue
2. Re-run all checks from the start
3. Verify fix doesn't break other tests
4. Don't batch fixes - iterate until clean

**Never commit with failing checks or tests!**

## Recent Workflow Improvements
- Optimistic UI pattern established for folder operations
- Toast notifications standardized for all mutations
- Callback props pattern for parent-child state sync
- Error handling with try-catch and user feedback
- Alphabetical sorting maintained after mutations

## Common Issues and Solutions

### Build Errors
- **Import errors**: Check default vs named exports (e.g., `db` is default export)
- **Type errors**: Ensure props interfaces match actual usage
- **Module not found**: Verify path aliases with `@/` prefix

### Console Warnings
- **Hydration mismatches**: Add `suppressHydrationWarning` to affected elements
- **Autocomplete warnings**: Add appropriate `autoComplete` attributes
- **Key warnings**: Ensure unique keys in lists

### Authentication Issues
- Always check user in server actions
- Use `createClient()` from correct import
- Handle redirect errors with try-catch
- Re-throw `NEXT_REDIRECT` errors
