# PromptHub - Task Completion Workflow
Last Updated: 08/11/2025 12:00 GMT+10 (Updated with P5S4bT1 bug fix)

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

**P5S4b Example**:
```bash
git commit -m "fix: P5S4b - Critical UI fixes and tooltip system

- Fix EditorPane document switching bug (wrong content displayed)
- Implement Zustand refetch trigger system for CRUD operations
- Convert DocumentToolbar to icon-based design
- Add comprehensive tooltip system with 700ms delay
- Add context-aware tooltip messages for disabled states
- Build verified with zero errors"
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
- [ ] **P5S4b**: Refetch triggers work
- [ ] **P5S4b**: Tooltips appear correctly

### ✓ Testing (P1S1 Standards)
- [ ] E2E tests completed (Chrome DevTools MCP)
- [ ] Manual testing guide created
- [ ] 100% test pass rate achieved
- [ ] Accessibility audit performed (when applicable)
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

### ✓ Documentation
- [ ] PRP INITIAL document created
- [ ] PRP REPORT document created
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
5. Add completion summary to Archon

### Create Summaries
- Document what was implemented
- Note any deviations from plan
- List any blockers encountered
- Suggest next steps or follow-ups
- Create REPORT document with:
  - Implementation summary
  - Testing results
  - Lessons learned
  - Recommendations for next phase

### Prepare for Review
- Ensure all checklist items complete
- Verify functionality one last time
- Check for any console errors
- Test in both light and dark modes (if applicable)
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

## Iteration Process

If any check fails:
1. Fix the issue
2. Re-run all checks from the start
3. Verify fix doesn't break other tests
4. Don't batch fixes - iterate until clean

**Never commit with failing checks or tests!**

## Recent Workflow Patterns - VERIFIED & SUCCESSFUL

### P5S4bT1 - Document Content Cross-Contamination Bug Fix (LATEST)

**Duration**: Rapid investigation and fix
**Pattern**: Critical bug diagnosis and surgical fix

**Bug Analysis Process** ✅
1. **Problem Identification**: Documents showing wrong content during switch
2. **Root Cause Analysis**:
   - Effect dependency included `selectedPrompt`
   - On document switch, effect fires before new content loads
   - Old content saves to new document's localStorage key
   - Result: Cross-contamination of document content
3. **Solution Design**: Ref-based guard to track key changes
4. **Implementation**: One-file surgical fix
5. **Verification**: Manual testing confirms content isolation

**Key Pattern Discovered**:
```typescript
// Ref guards prevent stale state issues
const prevKeyRef = useRef<string | null>(null)

useEffect(() => {
  // Detect document switch (key change)
  if (prevKeyRef.current !== selectedDocumentId) {
    prevKeyRef.current = selectedDocumentId
    setLocalContent(initialContent)  // Reset to new doc's content
    return  // Skip save on switch
  }

  // Normal save behavior (not during switch)
  const timer = setTimeout(() => {
    if (localContent !== initialContent) {
      localStorage.setItem(key, localContent)
    }
  }, 500)

  return () => clearTimeout(timer)
}, [localContent, selectedDocumentId, key])
```

**Critical Lesson**: Dependencies in effects with side effects (like saves) must account for transitions between states, not just state changes.

**Files Modified**: 1 (EditorPane.tsx)
**Build Status**: ✅ Successful (zero errors)

### CASCADE_DELETE - Database & Dialog System (~2 Hours)

**Duration**: ~2 hours total (design + implementation + validation)
**Pattern**: Database constraints + professional UI dialog system

**Execution Flow** ✅
1. **Database Schema**: Enabled cascade delete on Folder→Folder and Folder→Prompt
2. **Tag Constraint**: Fixed unique constraint drift (compound unique)
3. **Schema Migration**: Pushed to Supabase via `prisma db push`
4. **Radix UI Components**: Created Dialog and AlertDialog wrappers
5. **Feature Components**: Built FolderDialogs and DocumentDialogs
6. **Toolbar Integration**: Replaced browser prompts with dialogs
7. **Validation**: Build passed, tested all CRUD flows

**Key Success Factors**:
- Clear problem statement (cascade delete + professional UI)
- Modular approach (separate dialog components)
- Radix UI integration for consistent behavior
- Item count calculations in delete warnings
- Loading states during async operations
- Comprehensive testing of delete flows

**Critical Patterns Established**:
- Dialog for forms (create, rename)
- AlertDialog for confirmations (delete)
- Cascade delete rules in Prisma schema
- Item count warnings in delete dialogs
- Keyboard support (Enter/Esc)

**Files Modified**: 2 (FolderToolbar, DocumentToolbar)
**Files Created**: 4 (FolderDialogs, DocumentDialogs, alert-dialog, dialog)
**Dependencies Added**: 2 (@radix-ui components)
**Build Status**: ✅ Successful (zero errors)

### P5S4b - Ultra-Rapid Bug Fix Pattern (11 Tasks in ~55 Minutes)

**Duration**: ~55 minutes total (design + implementation + validation)
**Pattern**: Critical bug fixes, systematic UI improvements, rapid execution

**Execution Flow** ✅
1. **Problem Identification**: 4 critical issues (P0 bug, UI updates, design consistency, tooltips)
2. **Design Phase**: 15-minute design document identifying all issues
3. **Systematic Implementation**: 11 focused tasks executed in sequence
4. **Critical Discoveries**: 
   - Document switching cleanup effect pattern
   - Refetch trigger system for CRUD operations
5. **One-Pass Validation**: Build → Visual testing → Functionality verification

**Key Success Factors**:
- Clear problem statements (4 distinct issues)
- Systematic approach (cleanup → refetch → tooltips → build)
- Root cause analysis (document switching, UI updates)
- Pattern documentation (refetch triggers, cleanup effects)
- Comprehensive testing (all CRUD operations, tooltips)

**P5S4b Tasks Completed**:
```
✅ T1: Document switching bug analysis and fix
✅ T2: EditorPane cleanup effect implementation
✅ T3: Zustand refetch trigger system design
✅ T4: Refetch trigger implementation in store
✅ T5: FolderTree refetch integration
✅ T6: FolderToolbar refetch integration
✅ T7: PromptList refetch integration
✅ T8: DocumentToolbar icon conversion
✅ T9: Tooltip component creation
✅ T10: Comprehensive tooltip implementation
✅ T11: Build verification and testing
```

**Critical Patterns Discovered** (P5S4b):

**Document Switching Cleanup**:
```typescript
useEffect(() => {
  setLocalContent(initialContent)
  setIsDirty(false)
}, [selectedDocumentId])
```

**Refetch Trigger System**:
```typescript
// Store
triggerFolderRefetch: () => set({ folderRefetchTrigger: Date.now() })

// Component
const folderRefetchTrigger = useUIStore(s => s.folderRefetchTrigger)
useEffect(() => {
  fetchFolders()
}, [folderRefetchTrigger])
```

**Validation Results**:
```
✅ npm run build      # Zero TypeScript errors
✅ Document switching # Correct content displayed
✅ CRUD operations    # Immediate UI updates
✅ Tooltips          # All interactive elements
```

**Files Modified** (7 total):
1. `src/features/editor/components/EditorPane.tsx` - Cleanup effect
2. `src/stores/use-ui-store.ts` - Refetch triggers
3. `src/features/folders/components/FolderTree.tsx` - Refetch integration
4. `src/features/folders/components/FolderToolbar.tsx` - Tooltips + refetch
5. `src/features/prompts/components/PromptList.tsx` - Refetch integration
6. `src/features/prompts/components/DocumentToolbar.tsx` - Icons + tooltips
7. `src/app/(app)/layout.tsx` - TooltipProvider

**Files Created** (1 total):
1. `src/components/ui/tooltip.tsx` - Tooltip component

**Lessons Learned**:
- Cleanup effects prevent stale state in document switching
- Timestamp-based refetch triggers are simple and effective
- Icon-only toolbars with tooltips improve consistency
- Context-aware tooltip messages enhance UX
- Systematic testing catches integration issues early

**Architectural Impact**:
- Established refetch trigger pattern for Zustand
- Documented cleanup effect pattern for state resets
- Standardized tooltip system across application
- Consistent icon-based toolbar design language

### P5S4 - Manual Save Workflow (13 Tasks in ~4 Hours)

**Duration**: ~4 hours total (design + implementation + testing)
**Pattern**: Complex feature implementation with state management

**Execution Flow** ✅
1. **Design Phase**: 30-minute INITIAL document with detailed architecture
2. **Implementation**: 13 tasks across editor, state, and UI components
3. **Testing**: Markdown actions verification, keyboard shortcuts
4. **Documentation**: Comprehensive REPORT with patterns documented

**Key Success Factors**:
- Clear architecture (Zustand for state, markdown-actions utilities)
- Modular implementation (editor, store, toolbars separate)
- Strong patterns from P5S1-P5S3d (editor refs, SSR handling)
- Comprehensive testing (manual save, dirty state, shortcuts)

### P5S3d - Compact UI & Monaco Height Fix (4 Tasks in ~1 Hour)

**Duration**: ~1 hour total (design + implementation + validation)
**Pattern**: Targeted UI fixes, systematic component updates

**Key Success Factors**:
- Clear problem statement (compact UI + Monaco height bug)
- Systematic approach (globals → components → editor fix → testing)
- Root cause analysis (Monaco height in flex containers)
- Pattern documentation (absolute inset-0 h-full wrapper)
- Multi-breakpoint testing (375px, 768px, 1920px)

### P5S1 - Monaco Editor Integration (5 Tasks in ~10 Minutes)

**Duration**: ~10 minutes implementation + validation
**Pattern**: Minimal tasks, focused scope, clean execution

**Key Success Factors**:
- Clear scope definition (editor only, no integration yet)
- Strong patterns from P1S1 (dynamic imports, theme system)
- Modular architecture (editor is self-contained feature)
- Simple validation (one test page confirms functionality)

## PRP Documentation Process (PROVEN SUCCESSFUL)

### 1. INITIAL Document ✅
- Created before implementation starts
- Details implementation plan
- Lists all tasks with descriptions
- Includes agent recommendations
- Estimates implementation time

### 2. Implementation Phase ✅
- Follow task order from INITIAL
- Update Archon status: `todo` → `doing` → `review` → `done`
- Document deviations from plan
- Track blockers and solutions
- Update status after each task completion

### 3. REPORT Document ✅
- Created after implementation complete
- Summarizes what was implemented
- Documents testing results
- Lists lessons learned
- Provides recommendations for future PRPs

### 4. Task Verification ✅
- Systematic verification of all tasks
- Code evidence collection and validation
- Browser testing confirmation
- Codebase analysis verification

### 5. Completion Summary ✅
- Task completion tracking in Archon
- Status updates for all tasks moved to done
- Success metrics documented
- Links to all documentation added

## Common Issues and Solutions

### Build Errors
- **Import errors**: Check default vs named exports
- **Type errors**: Ensure props interfaces match usage
- **Module not found**: Verify path aliases with `@/` prefix

### Console Warnings
- **Hydration mismatches**: Add `suppressHydrationWarning` to affected elements
- **Autocomplete warnings**: Add appropriate `autoComplete` attributes
- **Key warnings**: Ensure unique keys in lists

### State Management Issues (P5S4, P5S4b)
- **Stale state**: Use cleanup effects on dependency changes
- **UI not updating**: Implement refetch trigger pattern
- **Race conditions**: Use timestamp-based invalidation

### Monaco Editor Issues (P5S3d, P5S4)
- **Height not rendering**: Use `absolute inset-0 h-full` wrapper
- **Theme not applying**: Define in beforeMount hook
- **Ref not available**: Check onMount callback

## Success Metrics

### P5S4b Implementation Quality
- ✅ 4/4 critical issues resolved
- ✅ 11/11 tasks completed
- ✅ Build succeeds with zero errors
- ✅ Document switching works correctly
- ✅ CRUD operations update UI immediately
- ✅ Tooltips on all interactive elements

### Code Quality (All Phases)
- ✅ All files under 500 lines
- ✅ Lint passes without warnings
- ✅ TypeScript strict mode compliant
- ✅ Production build validated

### Documentation Quality (All Phases)
- ✅ PRP INITIAL delivered
- ✅ PRP REPORT delivered
- ✅ Completion summary in Archon
- ✅ Serena memories updated
- ✅ Patterns documented

## Lessons Learned (Latest)

### P5S4bT1 Lessons - Document Content Management
1. **Ref Guards**: Use refs to detect state transitions and prevent stale side effects
2. **Effect Dependencies**: Consider transition states, not just current states
3. **localStorage Sync**: Guard against saves during document switches
4. **Empty Document Handling**: Allow undefined/empty states, don't assume data always exists
5. **Surgical Fixes**: Minimal changes prevent cascade of bugs

### CASCADE_DELETE Lessons
1. **Cascade Rules**: Simplify data management and prevent orphaned records
2. **Dialog Pattern**: Professional UI replacements for browser prompts
3. **Item Counts**: Critical for user understanding of delete impact
4. **Schema Drift**: Compound unique constraints need verification after fixes
5. **Database Push**: Use `prisma db push` for development schema changes

### P5S4b Lessons
1. **Cleanup Effects**: Critical for preventing stale state
2. **Refetch Triggers**: Timestamp-based is simple and reliable
3. **Tooltip System**: Context-aware messages improve UX
4. **Icon Consistency**: Standardize toolbar design language
5. **Systematic Testing**: Test all CRUD operations thoroughly

### P5S4 Lessons
1. **Zustand State**: Excellent for UI coordination
2. **Dirty Tracking**: Compare local to initial content
3. **Markdown Actions**: Utility functions improve maintainability
4. **Keyboard Shortcuts**: Add via Monaco command API

### Established Patterns (P1S1-P5S3d)
1. **Dual Feedback System**: Very effective for UX
2. **Error Objects**: Better than exceptions for server actions
3. **SSR Safety**: Dynamic import with ssr: false
4. **Monaco Height**: Explicit wrapper pattern required
5. **Compact UI**: Reduce base font size systematically

## Next Phase Preparation

### Recommendations for Future PRPs
1. Continue refetch trigger pattern for CRUD operations
2. Use cleanup effects for state resets
3. Maintain tooltip system for all new components
4. Keep icon-based toolbar design consistent
5. Document critical patterns immediately
6. Test document switching when implementing editors
7. Verify UI updates after mutations
8. Update Serena memories after major phases
9. Use Dialog component for form-based operations
10. Use AlertDialog component for destructive operations
11. Show item counts in delete confirmations
12. Implement cascade delete rules for all foreign key relationships
13. Test cascade delete behavior before committing

## CASCADE_DELETE Pattern Summary

**Database**:
- Enable cascade delete on all parent-child relationships
- Fix constraint drift issues with compound unique constraints
- Use `prisma db push` for schema changes

**UI**:
- Dialog for forms (Create, Rename)
- AlertDialog for confirmations (Delete)
- Show item counts in delete messages
- Include loading states during async operations
- Keyboard support: Enter to submit, Esc to cancel

**Integration**:
- Separate dialog components from toolbars (FolderDialogs, DocumentDialogs)
- Manage dialog open state locally in toolbar
- Call confirmation callbacks from dialogs
- Trigger refetch after successful mutations
- Show success toast after operations
