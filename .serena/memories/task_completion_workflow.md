# PromptHub - Task Completion Workflow

## Pre-Commit Checklist (MANDATORY)

### 1. Code Quality Checks
```bash
# Run linting
npm run lint

# Fix lint errors if any
# Re-run until clean

# Run type checking
npx tsc --noEmit

# Fix type errors
# Re-run until clean
```

### 2. Build Verification
```bash
# Test production build
npm run build

# Verify build succeeds
# Fix any build errors
# Re-run until successful
```

### 3. Database Migration Testing
```bash
# If migrations were created/modified:

# 1. Test migration up
npx prisma migrate dev

# 2. Check status
npx prisma migrate status

# 3. Test migration down (careful!)
# Create test database backup first
# Rollback and reapply to verify

# Iterate to fix any issues
```

### 4. Functional Testing
- Test primary functionality affected by changes
- Test authentication flow if auth-related
- Test database operations if data-related
- Verify no breaking changes to existing features

### 5. Documentation Updates
- Update CLAUDE.md if needed
- Update README.md if setup changed
- Update comments if complex logic added
- Update inline docs if APIs changed

## Git Commit Process

### Stage Changes
```bash
# Stage all changes
git add .

# Or stage specific files
git add path/to/file
```

### Review Staged Changes
```bash
# View diff of staged changes
git diff --staged

# Review each change
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

**Example**:
```bash
git commit -m "feat: implement folder creation with nested support
  - Add createFolder server action
  - Implement parent_id relationship
  - Add RLS policies for folder access
  - Update FolderTree component with create UI"
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
- [ ] Type check passes: `npx tsc --noEmit`
- [ ] Build succeeds: `npm run build`
- [ ] Code follows style guidelines
- [ ] File sizes under 500 lines
- [ ] Functions under 50 lines

### ✓ Functionality
- [ ] Feature works as expected
- [ ] No breaking changes
- [ ] Error handling implemented
- [ ] Loading states implemented
- [ ] User feedback provided

### ✓ Testing
- [ ] Tests written (TDD approach)
- [ ] Tests passing
- [ ] Coverage > 80% for new code
- [ ] Edge cases covered

### ✓ Security
- [ ] No secrets committed
- [ ] Input validation in place
- [ ] RLS policies verified
- [ ] Authentication checks present

### ✓ Database
- [ ] Migrations tested (up/down)
- [ ] Schema changes documented
- [ ] Indexes added where needed
- [ ] RLS policies updated

### ✓ Documentation
- [ ] Complex logic commented
- [ ] API changes documented
- [ ] README updated if needed
- [ ] CLAUDE.md updated if needed

### ✓ Git
- [ ] Changes staged
- [ ] Commit message follows format
- [ ] No unwanted files included
- [ ] Branch up to date with main

## Post-Completion Actions

### Update Tracking Systems
1. Mark task as complete in Archon (if available)
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

### Database Constraints
- Use cloud Supabase only (no local instance)
- NO triggers on `auth.users` table (Supabase Cloud restriction)
- Use Supabase CLI for migrations
- Link project: `supabase link --project-ref xmuysganwxygcsxwteil`

### Path Handling
- ALWAYS use forward slashes (`/`)
- NEVER use template variables in commands
- Use actual values: `/home/allan/projects/PromptHub`

### Architecture Patterns
- Server Components by default
- Client Components only when needed
- Server Actions for mutations
- No Promise handling in Client Components
- Careful async/await in cookie operations

## Iteration Process

If any check fails:
1. Fix the issue
2. Re-run all checks from the start
3. Verify fix doesn't break other tests
4. Don't batch fixes - iterate until clean

**Never commit with failing checks or tests!**
