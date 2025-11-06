# PromptHub
## PRP INITIAL: Fix Authentication Issues and Prepare for Phase 4

| `Title` | `Created` | `Last modified` |
|---------|-----------|-----------------|
| PRP INITIAL: Fix Authentication Issues and Prepare for Phase 4 | 06/11/2025 17:29 GMT+10 | 06/11/2025 17:29 GMT+10 |

## Table of Contents
- [Overview](#overview)
- [Planning Summary](#planning-summary)
- [Task Breakdown](#task-breakdown)
- [Implementation Strategy](#implementation-strategy)
- [Risk Assessment](#risk-assessment)
- [Success Metrics](#success-metrics)

---

## Overview

**PRP Document**: PRPs/fix-authentication-and-prepare-phase4.md

**Objective**: Fix critical build-blocking error caused by missing `signOut` function export, then verify complete authentication flow is working correctly.

**Business Impact**:
- **Critical**: Production builds currently failing
- **Blocker**: Cannot deploy to production until resolved
- **Priority**: Must be fixed before Phase 4 implementation begins

**Confidence Level**: 9/10 - Clear problem statement with well-defined solution

---

## Planning Summary

### Current State Analysis

**Critical Issue Identified**:
```typescript
// src/components/layout/Header.tsx:4
import { signOut } from "@/features/auth/actions"  // ❌ Function not exported

Type error: Module '"@/features/auth/actions"' has no exported member 'signOut'.
```

**Root Cause**:
- Header component uses Server Action pattern requiring `signOut` function
- Function exists as route handler (`src/app/auth/sign-out/route.ts`) but not as Server Action
- TypeScript compilation fails, blocking production builds

**Secondary Concern**:
- Sign-in flow may be redirecting users back to `/login` instead of `/dashboard`
- Requires investigation and verification after primary fix

### Solution Approach

**Primary Fix** (15 minutes):
1. Add `signOut` Server Action to `src/features/auth/actions.ts`
2. Follow existing `signIn`/`signUp` pattern for consistency
3. Include defensive session check before sign-out
4. Proper cache invalidation with `revalidatePath`

**Verification** (45-60 minutes):
1. Run validation gates (lint, typecheck, build)
2. Test sign-out functionality end-to-end
3. Verify complete authentication flow
4. Debug sign-in redirect if needed

---

## Task Breakdown

### P1T1: Add signOut Server Action [P]
**Assignee**: `senior-backend-engineer`
**Duration**: 15 minutes
**Complexity**: Low

**Goal**: Export `signOut` function from `src/features/auth/actions.ts` using Server Action pattern

**Implementation**:
```typescript
export async function signOut() {
  const supabase = createClient()

  const {
    data: { session },
  } = await supabase.auth.getSession()

  if (session) {
    await supabase.auth.signOut()
  }

  revalidatePath("/", "layout")
  redirect("/login")
}
```

**Success Criteria**:
- Function exported and importable
- Follows existing pattern (signIn/signUp)
- Defensive session check included
- Proper error handling

**Dependencies**: None

---

### P1T2: Run Validation Gates [P]
**Assignee**: `qa-test-automation-engineer`
**Duration**: 10 minutes
**Complexity**: Low

**Goal**: Verify code quality, type safety, and build success

**Commands**:
```bash
npm run lint          # Expect: No errors
npx tsc --noEmit      # Expect: No TypeScript errors
npm run build         # Expect: Build succeeds
```

**Success Criteria**:
- All linting passes
- No TypeScript compilation errors
- Production build completes successfully
- No import errors for `signOut`

**Dependencies**: P1T1 (Add signOut)

---

### P1T3: Test Sign-Out Functionality [P]
**Assignee**: `qa-test-automation-engineer`
**Duration**: 15 minutes
**Complexity**: Low

**Goal**: Verify sign-out button works and properly clears session

**Test Steps**:
1. Sign in with test credentials (allan@formationmedia.net / *.Password123)
2. Verify redirect to dashboard/app
3. Click "Sign Out" button in header
4. Verify redirect to `/login`
5. Confirm cannot access `/dashboard` without re-authenticating
6. Sign in again to confirm flow works

**Success Criteria**:
- Sign-out button appears in header
- Click redirects to `/login`
- Session cleared (no access to protected routes)
- Can sign in again successfully

**Dependencies**: P1T2 (Validation passes)

---

### P1T4: Verify Complete Authentication Flow [P]
**Assignee**: `qa-test-automation-engineer`
**Duration**: 30 minutes
**Complexity**: Medium

**Goal**: Test complete authentication lifecycle end-to-end

**Test Matrix**:

| Test | Action | Expected Result |
|------|--------|-----------------|
| Sign-up | Create new test account | Redirect to dashboard, Profile created |
| Sign-in | Login with valid credentials | Redirect to dashboard, Session persists |
| Sign-in Invalid | Login with wrong password | Error displayed, no redirect |
| Protected Routes | Access /dashboard without auth | Redirect to /login |
| Session Persistence | Refresh page while logged in | Still authenticated |
| Sign-out | Click sign-out button | Redirect to /login, session cleared |

**Success Criteria**:
- All tests pass without errors
- No console warnings during auth flow
- Database Profile records created correctly
- Session management working properly

**Dependencies**: P1T3 (Sign-out working)

---

### P1T5: Debug Sign-In Redirect (Conditional) [P]
**Assignee**: `problem-solver-orchestrator`
**Duration**: 30-60 minutes
**Complexity**: Medium-High

**Goal**: If sign-in redirects back to /login, identify and fix root cause

**Condition**: Only execute if P1T4 reveals sign-in redirect issue

**Investigation Steps**:
1. Check browser DevTools console for errors
2. Verify Supabase credentials in `.env`
3. Check Supabase dashboard (project active, auth enabled)
4. Verify database Profile table and trigger
5. Test with Supabase CLI: `supabase link --project-ref xmuysganwxygcsxwteil`

**Common Issues**:
- Expired/invalid Supabase credentials
- Project paused (free tier)
- Database connection string incorrect
- Profile trigger not created
- RLS policies too restrictive

**Success Criteria**:
- Root cause identified
- Fix implemented and tested
- Sign-in successfully redirects to /dashboard
- Authentication flow fully functional

**Dependencies**: P1T4 (Auth flow verification)

---

## Implementation Strategy

### Phase 1: Critical Fix (P1T1)
**Duration**: 15 minutes
**Parallelizable**: No (blocks all other tasks)

1. Add `signOut` function to `src/features/auth/actions.ts`
2. Match existing pattern and style
3. Include proper error handling

### Phase 2: Validation (P1T2)
**Duration**: 10 minutes
**Parallelizable**: No (depends on P1T1)

1. Run lint checks
2. Run type checks
3. Run production build
4. Confirm all pass

### Phase 3: Testing (P1T3, P1T4)
**Duration**: 45 minutes
**Parallelizable**: Sequential (P1T3 → P1T4)

1. Test sign-out functionality
2. Test complete auth flow
3. Document any issues found

### Phase 4: Debugging (P1T5)
**Duration**: 30-60 minutes
**Parallelizable**: No
**Conditional**: Only if issues found in Phase 3

1. Investigate redirect issue
2. Implement fix
3. Re-test authentication flow

---

## Risk Assessment

### Low Risk
- **Adding signOut function**: Clear implementation pattern exists
- **Validation gates**: Automated checks, no manual intervention

### Medium Risk
- **Sign-in redirect issue**: May require investigation and environment verification
- **Session management**: Cookie handling can be tricky across environments

### Mitigation Strategies

**For Sign-In Issues**:
- Comprehensive debugging steps provided in PRP
- Multiple validation checkpoints
- Access to Supabase dashboard for environment verification
- Can verify credentials and database state

**For Environment Issues**:
- `.env.example` provides reference
- Supabase CLI tools available for verification
- Can test database connectivity independently

---

## Success Metrics

### Must Have (Critical) ✅
- [ ] `signOut` function exported from `src/features/auth/actions.ts`
- [ ] TypeScript compilation succeeds with no errors
- [ ] Production build completes successfully
- [ ] Sign-out button functional in UI
- [ ] Sign-out clears session and redirects to `/login`

### Should Have (Important) ✅
- [ ] Complete authentication flow verified end-to-end
- [ ] Sign-in works and redirects to `/dashboard`
- [ ] Protected routes properly secured
- [ ] Session persists across page refreshes

### Nice to Have (Optional) ✅
- [ ] No console warnings during development
- [ ] Error handling improvements documented
- [ ] Documentation updated with findings

---

## Parallel Execution Strategy

**Tasks marked [P] can be executed by specialized agents in parallel where dependencies allow.**

**Optimal Agent Assignment**:
- **P1T1**: `senior-backend-engineer` - Server Action implementation
- **P1T2-P1T4**: `qa-test-automation-engineer` - Testing and validation
- **P1T5**: `problem-solver-orchestrator` - Complex debugging if needed

**Execution Flow**:
```
P1T1 (Add signOut) → P1T2 (Validate) → P1T3 (Test signOut) → P1T4 (Full auth test)
                                                                       ↓
                                                         P1T5 (Debug - conditional)
```

---

**Plan Status**: READY
**PRP Status**: TODO
**PRP ID**: P1
**Archon Project**: PromptHub (d449f266-1f36-47ad-bd2d-30f1a0f5e999)
**PRP Document**: PRPs/fix-authentication-and-prepare-phase4.md
**Tasks**: 5 tasks (P1T1 - P1T5)
**Phase**: Phase 2 - Authentication Completion
**Dependencies**: None
**Implementation Status**: NOT YET STARTED (P1)
**Testing Status**: NOT YET TESTED
**Next PRP**: Phase 4 - Prompt Organization & Retrieval
**Documentation**:
- PRPs/fix-authentication-and-prepare-phase4.md (Main PRP)
- docs/rules/archon.md (Archon workflow)
- src/features/auth/actions.ts (Implementation file)
**Recommendations:**
Agents:
- `senior-backend-engineer` (Task 1)
- `qa-test-automation-engineer` (Tasks 2-4)
- `problem-solver-orchestrator` (Task 5 - conditional)
Notes:
- T1 is critical blocker - must complete first
- T2-T4 can run sequentially for comprehensive testing
- T5 only needed if auth flow issues found in T4
- Keep dev server running during testing
- Use test credentials: allan@formationmedia.net / *.Password123
**Estimated Implementation Time (FTE)**: 1-2 hours
