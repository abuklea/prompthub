# PromptHub - Task Completion Workflow
Last Updated: 07/11/2025 02:15 GMT+10

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
- Test in both light and dark modes (if applicable)
- Verify responsive behavior
- **P1S1 Pattern**: Use E2E testing with Chrome DevTools MCP

### 5. Documentation Updates
- Update CLAUDE.md if workflow changed
- Update README.md if setup changed
- Update Serena memories if architecture changed
- Update comments if complex logic added
- Update inline docs if APIs changed
- **P1S1 Pattern**: Create PRP INITIAL + REPORT documents

## Git Commit Process

### Stage Changes
```bash
# Stage all changes
git add .

# Or stage specific files
git add path/to/file

# Or stage by feature
git add src/features/auth/
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

**P1S1 Example**:
```bash
git commit -m "feat: Complete P1S1 Authentication & Bold Simplicity design system

- Implement sign up, sign in, sign out server actions
- Add dual feedback system (toast + inline errors)
- Create Bold Simplicity design with Indigo/Magenta colors
- Add context-aware Header component
- Implement loading and redirect states
- Add form change detection to clear errors
- Complete E2E testing with 100% pass rate
- Deliver full documentation (INITIAL + REPORT + guides)"
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
- [ ] User feedback provided
- [ ] **P1S1 Pattern**: Dual feedback (toast + inline)

### ✓ Testing (P1S1 Standards)
- [ ] E2E tests completed (Chrome DevTools MCP)
- [ ] Manual testing guide created
- [ ] 100% test pass rate achieved
- [ ] Accessibility audit performed
- [ ] Edge cases covered

### ✓ Security
- [ ] No secrets committed
- [ ] Input validation in place (Zod schemas)
- [ ] RLS policies verified (when applicable)
- [ ] Authentication checks present
- [ ] User ID used in database queries (when applicable)

### ✓ Database (if applicable)
- [ ] Migrations tested (up/down)
- [ ] Schema changes documented
- [ ] Indexes added where needed
- [ ] RLS policies updated
- [ ] Foreign key constraints correct

### ✓ Documentation (P1S1 Standards)
- [ ] PRP INITIAL document created
- [ ] PRP REPORT document created
- [ ] E2E testing report delivered
- [ ] Accessibility audit report delivered
- [ ] Task completion summary added to Archon
- [ ] Complex logic commented
- [ ] README updated if needed
- [ ] CLAUDE.md updated if needed
- [ ] Serena memories updated

### ✓ Git
- [ ] Changes staged
- [ ] Commit message follows format
- [ ] No unwanted files included
- [ ] Branch up to date with main

## Post-Completion Actions

### Update Tracking Systems
1. Mark task as complete in Archon
2. Update PRP documents
3. Add completion notes to task
4. Update task status to "review" or "done"
5. **P1S1 Pattern**: Add completion summary to Archon

### Create Summaries (P1S1 Standards)
- Document what was implemented
- Note any deviations from plan
- List any blockers encountered
- Suggest next steps or follow-ups
- Create REPORT document with:
  - Implementation summary
  - Testing results
  - Accessibility audit results
  - Lessons learned
  - Recommendations for next phase

### Prepare for Review
- Ensure all checklist items complete
- Verify functionality one last time
- Check for any console errors
- Test in both light and dark modes (if applicable)
- Verify responsive behavior
- **P1S1 Pattern**: Run E2E tests one final time

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

### Architecture Patterns (P1S1)
- **Error Handling**: Server actions return error objects (never throw)
- **Dual Feedback**: Toast + inline errors
- **Toast Durations**: 6s errors, 3s success
- **Loading States**: Separate isLoading and isRedirecting
- **Form Changes**: Clear inline errors on form change
- **Context-Aware**: Components adapt based on auth state

## Iteration Process

If any check fails:
1. Fix the issue
2. Re-run all checks from the start
3. Verify fix doesn't break other tests
4. Don't batch fixes - iterate until clean

**Never commit with failing checks or tests!**

## P1S1 Workflow Patterns

### PRP Documentation Process
1. **INITIAL Document**:
   - Created before implementation starts
   - Details implementation plan
   - Lists all tasks with descriptions
   - Includes agent recommendations
   - Estimates implementation time

2. **Implementation Phase**:
   - Follow task order from INITIAL
   - Update Archon status for each task
   - Document any deviations from plan
   - Track blockers and solutions

3. **REPORT Document**:
   - Created after implementation complete
   - Summarizes what was implemented
   - Documents testing results
   - Includes accessibility audit
   - Lists lessons learned
   - Provides recommendations

### E2E Testing Process
1. **Test Planning**:
   - Identify user flows to test
   - Create step-by-step test cases
   - Define expected results
   - Include edge cases

2. **Test Execution**:
   - Use Chrome DevTools MCP
   - Follow test cases exactly
   - Document actual results
   - Take screenshots if needed
   - Note any issues

3. **Test Reporting**:
   - Create E2E testing report
   - List all test cases
   - Document pass/fail status
   - Include screenshots
   - Note any bugs found
   - Verify 100% pass rate

### Accessibility Testing Process
1. **Audit Planning**:
   - Identify components to audit
   - Define WCAG 2.1 criteria
   - Create checklist

2. **Audit Execution**:
   - Test keyboard navigation
   - Verify ARIA labels
   - Check color contrast
   - Test screen reader compatibility
   - Verify focus indicators

3. **Audit Reporting**:
   - Create accessibility report
   - Document findings
   - List issues (if any)
   - Provide recommendations
   - Verify compliance

## Common Issues and Solutions

### Build Errors
- **Import errors**: Check default vs named exports
- **Type errors**: Ensure props interfaces match usage
- **Module not found**: Verify path aliases with `@/` prefix

### Console Warnings
- **Hydration mismatches**: Add `suppressHydrationWarning` to affected elements
- **Autocomplete warnings**: Add appropriate `autoComplete` attributes
- **Key warnings**: Ensure unique keys in lists

### Authentication Issues (P1S1)
- Always check user in server actions (when needed)
- Use correct Supabase client (client vs server)
- Handle errors with error objects, not exceptions
- Return { error: string } or { success: true }

### Testing Issues (P1S1)
- Clear browser cache before E2E tests
- Use incognito mode for clean state
- Test logout before testing login
- Verify toast notifications appear
- Check inline errors display correctly

## P1S1 Success Metrics

### Implementation Quality
- ✅ All 12 tasks completed
- ✅ Design system fully implemented
- ✅ Authentication flows working
- ✅ Error handling robust
- ✅ Loading states smooth

### Testing Quality
- ✅ 100% E2E test pass rate
- ✅ All user flows tested
- ✅ Edge cases covered
- ✅ Accessibility compliant

### Documentation Quality
- ✅ PRP INITIAL delivered
- ✅ PRP REPORT delivered
- ✅ E2E testing report created
- ✅ Accessibility audit completed
- ✅ Completion summary in Archon
- ✅ Serena memories updated

## Next Phase Preparation

### Lessons Learned (P1S1)
1. **Dual Feedback System**: Very effective for UX
2. **Error Objects**: Better than exceptions for server actions
3. **E2E Testing**: Chrome DevTools MCP excellent for testing
4. **Documentation**: INITIAL + REPORT pattern very thorough
5. **Accessibility**: Important to test early and often

### Recommendations for Future PRPs
1. Continue dual feedback pattern
2. Maintain error object pattern in server actions
3. Use E2E testing for all user-facing features
4. Create INITIAL + REPORT for all PRPs
5. Update Serena memories after major phases
6. Keep task granularity appropriate (30min-4hr)
7. Document patterns as they emerge
