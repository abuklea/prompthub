# PromptHub
## P5S3: Prompt Saving and Versioning Logic - INITIAL REPORT

| `Title` | `Created` | `Last modified` |
|---------|-----------|-----------------|
| P5S3: Prompt Saving and Versioning Logic - INITIAL REPORT | 07/11/2025 14:11 GMT+10 | 07/11/2025 14:11 GMT+10 |

## Table of Contents
- [Executive Summary](#executive-summary)
- [Implementation Strategy](#implementation-strategy)
- [Task Breakdown](#task-breakdown)
- [Technical Approach](#technical-approach)
- [Risk Assessment](#risk-assessment)
- [Success Criteria](#success-criteria)
- [Timeline](#timeline)

---

## Executive Summary

**Goal:** Implement Git-style version control for prompts using diff-match-patch library to track changes efficiently.

**Scope:**
- Create diff utility wrapper for patch generation
- Build server action for atomic version saving
- Integrate save functionality into EditorPane
- Ensure proper error handling and user feedback

**Expected Outcome:**
Users can save prompt edits with automatic version tracking. Each save creates a new version record containing the diff from the previous version, enabling efficient storage and future version history reconstruction.

---

## Implementation Strategy

### Phase 1: Foundation (Tasks 1-2)
Create utility functions and validation schemas that form the foundation for version control.

**Deliverables:**
- `src/lib/diff-utils.ts` - Wrapper for diff-match-patch library
- `src/features/editor/schemas.ts` - Zod validation for save operations

**Success Metrics:**
- Utility functions generate correct patches
- Schemas validate input correctly
- No TypeScript errors

### Phase 2: Server Logic (Task 3)
Implement atomic server action that coordinates version creation and prompt updates.

**Deliverables:**
- `src/features/editor/actions.ts` - saveNewVersion server action

**Success Metrics:**
- Transaction ensures atomicity
- User isolation enforced
- Proper error handling
- ActionResult pattern followed

### Phase 3: UI Integration (Task 4)
Connect EditorPane to save functionality with proper state management and user feedback.

**Deliverables:**
- Updated `src/features/editor/components/EditorPane.tsx` with Save button

**Success Metrics:**
- Save button shows loading state
- Toast notifications on success/error
- Content persists during save
- No UI jitter or flashing

### Phase 4: Validation (Task 5)
Manual testing to verify end-to-end functionality and edge cases.

**Deliverables:**
- Testing report documenting all scenarios
- Database verification queries

**Success Metrics:**
- All test cases pass
- No console errors
- Database records correct

---

## Task Breakdown

### Task 1: Create diff-match-patch Utility Wrapper
**File:** `src/lib/diff-utils.ts`

**Implementation:**
```typescript
// createPatch(oldContent, newContent): string
// - Initialize diff_match_patch instance
// - Call patch_make(oldContent, newContent)
// - Serialize with patch_toText()
// - Return serialized patch string

// applyPatch(baseContent, patchText): string | null
// - For future use in version history (P5S5)
// - Deserialize patch from database
// - Apply to base content
// - Return reconstructed content or null on failure
```

**Critical Details:**
- Use `patch_make` NOT `diff_main` (for storage)
- Thread-safe: Create new instance each time
- Handle empty string edge case for first save

**Estimated Time:** 30 minutes
**Assignee:** senior-backend-engineer
**Parallelizable:** No (foundation task)

---

### Task 2: Create Zod Validation Schema
**File:** `src/features/editor/schemas.ts`

**Schema Definition:**
```typescript
saveNewVersionSchema {
  promptId: z.string().uuid('Invalid prompt ID')
  newTitle: z.string().min(1).max(200)
  newContent: z.string()  // No length limit
}
```

**Pattern Reference:** `src/features/prompts/schemas.ts`

**Estimated Time:** 15 minutes
**Assignee:** senior-backend-engineer
**Parallelizable:** Can run parallel with T1

---

### Task 3: Implement saveNewVersion Server Action
**File:** `src/features/editor/actions.ts`

**Function Signature:**
```typescript
async function saveNewVersion(data: unknown):
  Promise<ActionResult<{ versionId: number }>>
```

**Implementation Steps:**
1. Validate input with schema.safeParse()
2. Get authenticated user via createClient()
3. Fetch current prompt with user_id filter
4. Calculate diff using createPatch()
5. Execute Prisma transaction:
   - Create PromptVersion with diff
   - Update Prompt with new title and content
6. Return success with versionId

**Critical Details:**
- Enforce user ownership (user_id filter)
- Re-throw NEXT_REDIRECT errors
- Transaction ensures atomicity
- Console.error for debugging

**Pattern Reference:** `src/features/prompts/actions.ts`

**Estimated Time:** 45 minutes
**Assignee:** senior-backend-engineer
**Dependencies:** T1 (diff-utils), T2 (schemas)

---

### Task 4: Update EditorPane with Save Functionality
**File:** `src/features/editor/components/EditorPane.tsx`

**Changes Required:**
- Add content state (string)
- Add saving state (boolean)
- Add useEffect to sync content with promptData
- Implement handleSave async function
- Replace editor placeholder with actual Editor component
- Add Save button below editor

**Save Handler Logic:**
```typescript
1. Set saving = true
2. Call saveNewVersion({ promptId, newTitle: title, newContent: content })
3. Check result.success discriminated union
4. Show toast.success or toast.error
5. Set saving = false
```

**UI Requirements:**
- Button disabled during save
- Button text: "Saving..." or "Save"
- Toast notifications for feedback
- Preserve existing loading/error states

**Estimated Time:** 60 minutes
**Assignee:** senior-frontend-engineer
**Dependencies:** T3 (server action)

---

### Task 5: Integration Testing and Validation
**Manual Test Cases:**

**TC1: First Save (No Previous Versions)**
- Create new prompt with empty content
- Enter title and content
- Click Save
- Verify: Success toast, PromptVersion created, Prompt updated

**TC2: Subsequent Save (Diff Calculation)**
- Modify content in existing prompt
- Click Save
- Verify: Second PromptVersion created with diff (not full content)

**TC3: Title Change Only**
- Change only title, not content
- Click Save
- Verify: Version created with empty content diff

**TC4: Error Handling - Unauthorized**
- Sign out, attempt to access editor
- Verify: Redirect to /login, no access to save

**TC5: Error Handling - Invalid Prompt ID**
- Manually call with invalid UUID
- Verify: Error toast, no database changes

**TC6: Browser Console Check**
- Perform all tests with DevTools open
- Verify: No console errors or warnings

**Validation Commands:**
```bash
npm run lint      # Must pass
npm run build     # Must succeed
```

**Database Verification:**
```sql
-- Verify PromptVersion records
SELECT id, prompt_id, created_at,
       length(diff) as diff_length
FROM "PromptVersion"
ORDER BY created_at DESC
LIMIT 5;

-- Verify Prompt updated
SELECT id, title, updated_at,
       length(content) as content_length
FROM "Prompt"
WHERE id = 'test-prompt-id';
```

**Estimated Time:** 60 minutes
**Assignee:** qa-test-automation-engineer
**Dependencies:** T4 (UI integration)

---

## Technical Approach

### diff-match-patch Integration

**Why patch_make over diff_main:**
- `diff_main` returns array of diff operations (not directly storable)
- `patch_make` returns patch objects suitable for serialization
- `patch_toText` converts to GNU diff/patch format string
- Patches can be stored as text in database

**First Save Edge Case:**
When no previous version exists, oldContent comes from Prompt.content (empty string ""). The patch will contain the full new content as an "add all" diff. This is correct behavior - the first version's diff represents adding all content from nothing.

### Atomicity with Prisma Transactions

**Why transactions are critical:**
```typescript
// WITHOUT transaction - DANGEROUS
await db.promptVersion.create({...})  // Succeeds
await db.prompt.update({...})         // Fails - version orphaned!

// WITH transaction - SAFE
await db.$transaction(async (tx) => {
  await tx.promptVersion.create({...})
  await tx.prompt.update({...})
  // Both succeed or both fail
})
```

If version creation succeeds but prompt update fails, we'd have orphaned version records. Transactions prevent this.

### User Isolation Pattern

**Always filter by user_id:**
```typescript
// WRONG - any user could save any prompt
const prompt = await db.prompt.findUnique({
  where: { id: promptId }
})

// CORRECT - enforces ownership
const prompt = await db.prompt.findFirst({
  where: {
    id: promptId,
    user_id: user.id  // Critical for security
  }
})
```

RLS policies provide database-level protection, but server actions should also enforce user isolation for defense in depth.

---

## Risk Assessment

### High Priority Risks

**R1: diff-match-patch Import Issues**
- **Risk:** Library may have ESM/CommonJS compatibility issues
- **Mitigation:** Use require-style import, test in isolation first
- **Contingency:** Fallback to storing full content copies if patches fail

**R2: Transaction Timeout**
- **Risk:** Large content diffs might cause transaction timeout
- **Mitigation:** diff-match-patch is fast, typical prompts < 10KB
- **Contingency:** Implement content size validation (warn at 100KB)

**R3: First Save Edge Case**
- **Risk:** Empty oldContent might cause unexpected behavior
- **Mitigation:** Explicitly handle empty string case in createPatch
- **Contingency:** Store empty diff for first version, full content in Prompt

### Medium Priority Risks

**R4: Race Condition on Rapid Saves**
- **Risk:** User clicks Save multiple times quickly
- **Mitigation:** Disable button during save, use saving state
- **Contingency:** Debounce save handler (300ms delay)

**R5: Patch Application Failure (Future)**
- **Risk:** Corrupted patches might not apply in P5S5
- **Mitigation:** Test applyPatch thoroughly, handle null returns
- **Contingency:** Store checksum with each version for validation

### Low Priority Risks

**R6: Large Version History**
- **Risk:** Many versions might slow down queries
- **Mitigation:** Index on prompt_id already exists
- **Contingency:** Implement pagination in P5S5, limit to 50 versions

---

## Success Criteria

### Functional Requirements
- [x] Saving a prompt creates a new PromptVersion record
- [x] PromptVersion.diff contains serialized patch
- [x] Prompt.content and Prompt.title updated atomically
- [x] Prompt.updated_at auto-updates (Prisma @updatedAt)
- [x] First save (no previous version) handled gracefully
- [x] Transaction rollback works on any step failure
- [x] User can only save their own prompts
- [x] Clear error messages for all failure modes

### Code Quality
- [ ] All files pass `npm run lint`
- [ ] `npm run build` succeeds
- [ ] All functions under 50 lines
- [ ] All files under 500 lines
- [ ] JSDoc comments on exported functions
- [ ] No console.log (only console.error for debugging)

### Security
- [ ] User isolation enforced (user_id filter)
- [ ] Invalid promptId returns error (not crash)
- [ ] Unauthorized access blocked
- [ ] No SQL injection possible (Prisma handles)
- [ ] No XSS vulnerability (React handles)

### User Experience
- [ ] Save button has clear label ("Save" / "Saving...")
- [ ] Loading state visible during save
- [ ] Success feedback clear (toast notification)
- [ ] Error feedback helpful (specific error messages)
- [ ] No flashing or jittery UI
- [ ] Editor content persists during save

### Database
- [ ] PromptVersion records created correctly
- [ ] PromptVersion.diff contains patch text
- [ ] Prompt.content updated correctly
- [ ] Prompt.title updated correctly
- [ ] Prompt.updated_at auto-updates
- [ ] No orphaned PromptVersion records
- [ ] Transaction rollback works on error

---

## Timeline

**Total Estimated Time:** 3-4 hours (single FTE)

**Sequential Dependencies:**
```
T1 (diff-utils) ──────┬──> T3 (server action) ──> T4 (UI) ──> T5 (testing)
                      │
T2 (schemas) ─────────┘
```

**Parallel Opportunities:**
- T1 and T2 can run in parallel (both foundation tasks)
- T3 requires both T1 and T2 complete
- T4, T5 must run sequentially

**Critical Path:** T1 → T3 → T4 → T5 (3.5 hours)

**Recommended Execution:**
1. **Hour 1:** T1 + T2 in parallel (senior-backend-engineer)
2. **Hour 2:** T3 server action (senior-backend-engineer)
3. **Hour 3:** T4 UI integration (senior-frontend-engineer)
4. **Hour 4:** T5 validation + fixes (qa-test-automation-engineer)

---

**Plan Status**: READY
**PRP Status**: TODO
**PRP ID**: P5S3
**Archon Project**: PromptHub (d449f266-1f36-47ad-bd2d-30f1a0f5e999)
**PRP Document**: PRPs/P5S3-prompt-saving-and-versioning-logic.md
**Tasks**: 5 tasks (P5S3T1 - P5S3T5)
**Phase**: Phase 5 - Prompt Editor & Version Control
**Dependencies**: P5S2 (Complete - Prompt Creation and Data Access)
**Implementation Status**: NOT YET STARTED (P5S3)
**Testing Status**: NOT YET TESTED
**Next PRP**: P5S4 - Editor UI with Manual Save
**Recommendations:**
Agents:
- `senior-backend-engineer` (Tasks 1-3)
- `senior-frontend-engineer` (Task 4)
- `qa-test-automation-engineer` (Task 5)
Notes:
- T1-T2 can run in parallel
- T3 critical path task (requires T1 and T2)
- Use diff-match-patch already installed (1.0.5)
- Follow P1S1 error handling patterns strictly
**Estimated Implementation Time (FTE)**: 3-4 hours
