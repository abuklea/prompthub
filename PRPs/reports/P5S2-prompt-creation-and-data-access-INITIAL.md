# PromptHub
## P5S2: Prompt Creation and Data Access - INITIAL PLAN

| `Title` | `Created` | `Last modified` |
|---------|-----------|-----------------|
| P5S2: Prompt Creation and Data Access - INITIAL PLAN | 07/11/2025 13:36 GMT+10 | 07/11/2025 13:36 GMT+10 |

## Table of Contents
- [Overview](#overview)
- [Task Breakdown](#task-breakdown)
- [Implementation Strategy](#implementation-strategy)
- [Dependencies](#dependencies)
- [Success Criteria](#success-criteria)

---

## Overview

This INITIAL report outlines the execution plan for P5S2: Prompt Creation and Data Access. The goal is to implement core prompt CRUD operations and integrate the EditorPane component into the 3-pane layout.

**Key Objectives:**
- Enable users to create new prompts via "+ New Prompt" button
- Implement prompt selection and detail viewing
- Create EditorPane component with title input
- Establish data flow between components via Zustand store
- Maintain user isolation via RLS and proper authentication

**Estimated Duration:** 3-4 hours (single FTE)

---

## Task Breakdown

### P5S2T1: Create Prompt Validation Schemas
**Assignee:** `senior-backend-engineer`
**Duration:** 15 minutes
**Parallelizable:** No (foundation for server actions)

**Objective:** Define Zod schemas for prompt operations

**Deliverables:**
- `src/features/prompts/schemas.ts` with:
  - createPromptSchema (folderId, title optional)
  - getPromptDetailsSchema (promptId)
  - TypeScript type exports

**Success Criteria:**
- All schemas properly validated
- TypeScript types exported
- No lint errors

---

### P5S2T2: Implement createPrompt Server Action
**Assignee:** `senior-backend-engineer`
**Duration:** 30 minutes
**Parallelizable:** No (depends on T1)

**Objective:** Create server action for prompt creation

**Deliverables:**
- Add `createPrompt` function to `src/features/prompts/actions.ts`
- Validate input with Zod schema
- Check authentication via Supabase
- Create prompt in database via Prisma
- Return ActionResult with promptId

**Success Criteria:**
- Follows error handling pattern (no throws except NEXT_REDIRECT)
- User authentication enforced
- RLS via user_id filter
- Returns proper ActionResult type

---

### P5S2T3: Implement getPromptDetails Server Action
**Assignee:** `senior-backend-engineer`
**Duration:** 30 minutes
**Parallelizable:** [P] (can run parallel with T4)

**Objective:** Create server action for fetching prompt details

**Deliverables:**
- Add `getPromptDetails` function to `src/features/prompts/actions.ts`
- Validate input with Zod schema
- Fetch prompt with user_id filter (RLS)
- Include folder relation
- Return full prompt data

**Success Criteria:**
- User isolation enforced
- Proper error handling
- Returns 404 if prompt not found or unauthorized

---

### P5S2T4: Add "New Prompt" Button to PromptList
**Assignee:** `senior-frontend-engineer`
**Duration:** 45 minutes
**Parallelizable:** [P] (can run parallel with T3)

**Objective:** Add prompt creation UI to PromptList component

**Deliverables:**
- Modify `src/features/prompts/components/PromptList.tsx`
- Add "+ New Prompt" button
- Implement handleNewPrompt function
- Add loading state (creatingPrompt)
- Toast notifications for success/error
- Auto-select newly created prompt
- Refresh prompt list after creation

**Success Criteria:**
- Button disabled when no folder selected
- Button shows "Creating..." during operation
- Dual feedback (toast + inline errors)
- New prompt appears in list immediately
- No console errors

---

### P5S2T5: Add Prompt Selection Handler to PromptList
**Assignee:** `senior-frontend-engineer`
**Duration:** 20 minutes
**Parallelizable:** No (modifies same file as T4)

**Objective:** Implement visual selection highlighting

**Deliverables:**
- Update prompt rendering in PromptList
- Add visual highlight for selected prompt
- Use selectedPrompt from useUiStore
- Apply primary background when selected

**Success Criteria:**
- Selected prompt visually distinct
- Click updates selection
- Uses design system colors

---

### P5S2T6: Create EditorPane Component
**Assignee:** `senior-frontend-engineer`
**Duration:** 60 minutes
**Parallelizable:** [P] (can run after T3, parallel with T4-T5)

**Objective:** Create right pane component for prompt editing

**Deliverables:**
- Create `src/features/editor/components/EditorPane.tsx`
- Watch selectedPrompt from Zustand
- Fetch prompt details on selection change
- Display title input field
- Show loading/error/empty states
- Display placeholder for Monaco Editor

**Success Criteria:**
- Three states handled: no selection, loading, loaded
- Title input is editable
- Error messages displayed properly
- useEffect dependencies correct
- No console errors

---

### P5S2T7: Integrate EditorPane into App Layout
**Assignee:** `senior-frontend-engineer`
**Duration:** 15 minutes
**Parallelizable:** No (depends on T6)

**Objective:** Replace {children} with EditorPane in layout

**Deliverables:**
- Modify `src/app/(app)/layout.tsx`
- Import EditorPane
- Replace {children} with <EditorPane />
- Remove children parameter

**Success Criteria:**
- Build succeeds
- EditorPane renders in right pane
- 3-pane layout maintained

---

### P5S2T8: [OPTIONAL] Centralize ActionResult Type
**Assignee:** `senior-backend-engineer`
**Duration:** 20 minutes
**Parallelizable:** [P] (can run anytime)

**Objective:** Create shared ActionResult type

**Deliverables:**
- Create `src/types/actions.ts` or add to `src/lib/types.ts`
- Export ActionResult<T> type
- Update action files to import shared type

**Success Criteria:**
- Consistent type across all actions
- No duplicate definitions
- TypeScript compiles without errors

---

## Implementation Strategy

### Phase 1: Foundation (T1)
1. Create schemas file with Zod validation
2. Export TypeScript types
3. Verify compilation

### Phase 2: Server Actions (T2, T3 - Sequential for T2, then T3)
1. Implement createPrompt with full error handling
2. Implement getPromptDetails with RLS
3. Test authentication and validation

### Phase 3: UI Components (T4, T5, T6 - Partial Parallel)
1. Add "New Prompt" button (T4)
2. Add selection highlighting (T5)
3. Create EditorPane component (T6 - can run parallel)

### Phase 4: Integration (T7)
1. Integrate EditorPane into layout
2. Verify data flow end-to-end

### Phase 5: Cleanup (T8 - Optional)
1. Centralize types if time permits

---

## Dependencies

### Internal Dependencies
- ✅ P5S1 (Monaco Editor Integration) - Complete
- ✅ P4S5 (PromptList Component) - Complete
- ✅ P3S1 (RLS Policies) - Complete
- ✅ P1S1 (Authentication) - Complete

### External Dependencies
- ✅ Prisma client configured
- ✅ Supabase auth configured
- ✅ Zustand store with selectPrompt
- ✅ Prompt model in database schema
- ✅ Shadcn/ui components available

### Data Flow
```
User clicks "+ New Prompt"
  ↓
createPrompt server action
  ↓
Validate input (Zod)
  ↓
Check auth (Supabase)
  ↓
Create in database (Prisma)
  ↓
Return promptId
  ↓
selectPrompt(promptId) - Zustand
  ↓
EditorPane useEffect triggers
  ↓
getPromptDetails server action
  ↓
Fetch prompt data
  ↓
Display in EditorPane
```

---

## Success Criteria

### Functionality
- [ ] Can create new prompts via "+ New Prompt" button
- [ ] New prompts have "Untitled Prompt" title
- [ ] New prompts auto-selected after creation
- [ ] Can click prompts to select them
- [ ] Selected prompts visually highlighted
- [ ] EditorPane shows selected prompt title
- [ ] Title input is editable
- [ ] Loading states display properly
- [ ] Error messages show on failures
- [ ] Toast notifications for success/error

### Code Quality
- [ ] `npm run lint` passes
- [ ] `npm run build` succeeds
- [ ] TypeScript strict mode compliant
- [ ] All files have proper headers
- [ ] Error handling follows project pattern
- [ ] No console errors

### Security
- [ ] User authentication required
- [ ] RLS enforced (user_id filters)
- [ ] Input validated with Zod
- [ ] No secret leakage

### Performance
- [ ] No unnecessary re-renders
- [ ] useEffect dependencies correct
- [ ] Loading states prevent double-submissions

---

**Plan Status:** READY
**PRP Status:** TODO
**PRP ID:** P5S2
**Archon Project:** PromptHub (d449f266-1f36-47ad-bd2d-30f1a0f5e999)
**PRP Document:** PRPs/P5S2-prompt-creation-and-data-access.md
**Tasks:** 8 tasks (P5S2T1 - P5S2T8)
**Phase:** Phase 5 - Prompt Editor & Version Control
**Dependencies:** P5S1 (Complete), P4S5 (Complete), P3S1 (Complete)
**Implementation Status:** NOT YET STARTED (P5S2)
**Testing Status:** NOT YET TESTED
**Next PRP:** P5S3 - Prompt Saving and Versioning Logic
**Recommendations:**
Agents:
- `senior-backend-engineer` (Tasks 1, 2, 3, 8 - Server actions and schemas)
- `senior-frontend-engineer` (Tasks 4, 5, 6, 7 - UI components and integration)
Notes:
- Critical: Follow error handling pattern (no throws except NEXT_REDIRECT)
- Critical: Use createServer() not createClient() in server actions
- Critical: Include all useEffect dependencies
- T3 and T4 can run in parallel after T2
- T6 can run in parallel with T4-T5
- T8 is optional, skip if time-constrained
**Estimated Implementation Time (FTE):** 3-4 hours
