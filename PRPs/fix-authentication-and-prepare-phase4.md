# PromptHub
## PRP: Fix Authentication Issues and Prepare for Phase 4

| `Title` | `Created` | `Last modified` |
|---------|-----------|-----------------|
| PRP: Fix Authentication Issues and Prepare for Phase 4 | 06/11/2025 17:30 GMT+10 | 06/11/2025 17:30 GMT+10 |

## Table of Contents
- [Executive Summary](#executive-summary)
- [Problem Statement](#problem-statement)
- [Context and Research](#context-and-research)
- [Implementation Blueprint](#implementation-blueprint)
- [Task Breakdown](#task-breakdown)
- [Validation Gates](#validation-gates)
- [Success Criteria](#success-criteria)
- [References](#references)

---

## Executive Summary

**Priority**: Critical - Blocking Production Builds

**Objective**: Fix missing `signOut` function export that prevents builds from completing, then verify the authentication flow is working correctly.

**Impact**:
- ✅ Removes build-blocking TypeScript error
- ✅ Enables users to sign out of the application
- ✅ Clears console warnings during development
- ✅ Prepares project for Phase 4 implementation

**Estimated Time**: 1-2 hours

---

## Problem Statement

### Critical Issue: Missing signOut Export

**Current State**: The application has a build-blocking error:

```bash
Type error: Module '"@/features/auth/actions"' has no exported member 'signOut'.

./src/components/layout/Header.tsx:4:10
import { signOut } from "@/features/auth/actions"  // ❌ Does not exist
```

**Root Cause**: The `Header` component imports `signOut` from `@/features/auth/actions.ts`, but this function is not exported. While a route handler exists at `src/app/auth/sign-out/route.ts`, the Header uses a form action which requires a Server Action, not a route handler.

**Impact**:
- Production builds fail
- TypeScript compilation errors
- Cannot deploy to production
- Development server shows persistent warnings

### Secondary Issue: Authentication Flow Verification

**Observation**: Sign-in attempts result in 303 redirects but loop back to `/login` instead of successfully redirecting to `/dashboard`.

**Possible Causes**:
1. Supabase credentials invalid or expired
2. Session cookie not being set properly
3. Middleware rejecting valid sessions
4. Database Profile record not being created

**Investigation Required**: Yes

---

## Context and Research

### Existing Implementation Patterns

#### Current Server Actions (src/features/auth/actions.ts)
```typescript
"use server"

import { createClient } from "@/lib/supabase/server"
import { SignUpSchema, SignInSchema } from "./schemas"
import { z } from "zod"
import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"

export async function signUp(values: z.infer<typeof SignUpSchema>) {
  const supabase = createClient()
  const { data, error } = await supabase.auth.signUp(values)
  if (error) {
    throw error
  }
  revalidatePath("/", "layout")
  redirect("/dashboard")
}

export async function signIn(values: z.infer<typeof SignInSchema>) {
  const supabase = createClient()
  const { data, error } = await supabase.auth.signInWithPassword(values)
  if (error) {
    throw error
  }
  revalidatePath("/", "layout")
  redirect("/dashboard")
}

// ❌ signOut is MISSING
```

#### Existing Route Handler (src/app/auth/sign-out/route.ts)
```typescript
import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { type NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  const supabase = createClient()

  const {
    data: { session },
  } = await supabase.auth.getSession()

  if (session) {
    await supabase.auth.signOut()
    revalidatePath('/', 'layout')
  }

  return NextResponse.redirect(new URL('/login', req.url), {
    status: 302,
  })
}
```

#### Header Component Usage (src/components/layout/Header.tsx)
```typescript
import { signOut } from "@/features/auth/actions"  // ❌ Import fails
import { Button } from "@/components/ui/button"

export function Header({ user }: { user: any }) {
  return (
    <header className="flex items-center justify-between p-4 border-b">
      <div>
        <h1 className="text-lg font-semibold">{user?.email}</h1>
      </div>
      <form action={signOut}>  {/* ✅ Correct pattern for Server Actions */}
        <Button variant="outline">Sign Out</Button>
      </form>
    </header>
  )
}
```

### Official Supabase Documentation

**Source**: [Supabase Next.js Tutorial - Sign Out](https://supabase.com/docs/guides/getting-started/tutorials/with-nextjs#sign-out)

**Key Pattern**:
```typescript
// Official pattern for sign-out
const supabase = await createClient()
const { data: { user } } = await supabase.auth.getUser()

if (user) {
  await supabase.auth.signOut()
}

revalidatePath("/", "layout")
return NextResponse.redirect(new URL("/login", req.url))
```

**Critical Insights**:
1. Always check if user is logged in before signing out (defensive)
2. Use `revalidatePath("/", "layout")` to clear cached data
3. Redirect to `/login` after sign-out
4. Handle both route handlers and Server Actions

### Why Server Action (Not Route Handler)

The Header component uses the form action pattern:
```typescript
<form action={signOut}>  // ✅ Requires Server Action
```

This is the correct Next.js pattern for forms. Server Actions:
- Are automatically invoked by form submission
- Handle progressive enhancement
- Work without JavaScript
- Are type-safe

Route handlers require manual fetch calls and don't integrate with forms naturally.

---

## Implementation Blueprint

### Pseudocode: signOut Server Action

```typescript
// Goal: Add signOut function to src/features/auth/actions.ts
// Pattern: Match existing signIn/signUp structure

export async function signOut() {
  // 1. Create Supabase client (server-side)
  const supabase = createClient()

  // 2. Get current user session (defensive check)
  const { data: { session } } = await supabase.auth.getSession()

  // 3. Sign out if session exists
  if (session) {
    await supabase.auth.signOut()
  }

  // 4. Revalidate all cached data
  revalidatePath("/", "layout")

  // 5. Redirect to login page
  redirect("/login")
}
```

### Implementation Strategy

**Step 1**: Add signOut function to `src/features/auth/actions.ts`
- Follow existing pattern (signIn/signUp)
- Use Server Action pattern ("use server")
- Include defensive session check
- Proper error handling

**Step 2**: Verify TypeScript compilation
- Run `npx tsc --noEmit`
- Confirm no import errors
- Validate type safety

**Step 3**: Test sign-out flow
- Sign in with test credentials
- Click "Sign Out" button
- Verify redirect to /login
- Confirm session cleared

**Step 4**: Verify authentication flow
- Test complete auth lifecycle
- Check Supabase dashboard for user
- Verify Profile creation
- Test sign-in persistence

---

## Task Breakdown

### Task 1: Add signOut Server Action
**File**: `src/features/auth/actions.ts`

**Action**: Add the following function after `signIn`:

```typescript
export async function signOut() {
  const supabase = createClient()

  // Check if a user's session exists
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

**Rationale**:
- Matches existing signIn/signUp pattern
- Defensive check before sign-out
- Proper cache invalidation
- Correct redirect behavior

**Expected Result**: TypeScript error resolved, import succeeds

---

### Task 2: Run Validation Gates
**Commands**:
```bash
# 1. Lint check
npm run lint

# 2. Type check
npx tsc --noEmit

# 3. Build verification
npm run build
```

**Expected Results**:
- ✅ No lint errors
- ✅ No TypeScript errors
- ✅ Build succeeds
- ✅ No warnings about signOut import

---

### Task 3: Test Sign-Out Functionality
**Steps**:
1. Start dev server: `npm run dev`
2. Navigate to `http://localhost:3010`
3. Sign in with test credentials:
   - Email: `allan@formationmedia.net`
   - Password: `*.Password123`
4. Verify redirect to dashboard/main app
5. Click "Sign Out" button in header
6. Verify redirect to `/login`
7. Confirm cannot access protected routes without signing in again

**Expected Results**:
- ✅ Sign-out button works
- ✅ Redirect to /login occurs
- ✅ Session cleared (cannot access /dashboard)
- ✅ Must sign in again to access app

---

### Task 4: Verify Complete Authentication Flow
**Steps**:
1. **Sign Up Test** (if needed):
   - Create new test account
   - Verify redirect to dashboard
   - Check Supabase Auth dashboard for new user
   - Check Supabase Database for Profile record

2. **Sign In Test**:
   - Sign out if logged in
   - Sign in with `allan@formationmedia.net` / `*.Password123`
   - Verify successful authentication
   - Verify redirect to dashboard
   - Check session persistence (refresh page)

3. **Protected Route Test**:
   - Sign out
   - Try to access `http://localhost:3010/dashboard` directly
   - Verify redirect to `/login`
   - Sign in
   - Verify can access dashboard

4. **Profile Creation Test**:
   - Check Supabase Database `Profile` table
   - Verify user has corresponding profile record
   - Confirm trigger is working

**Expected Results**:
- ✅ Sign-up creates user and profile
- ✅ Sign-in works with valid credentials
- ✅ Sign-in rejects invalid credentials
- ✅ Sign-out clears session
- ✅ Protected routes require authentication
- ✅ Session persists across page refreshes

---

### Task 5: Investigation - Sign-In Redirect Issue
**If sign-in still redirects to /login after Task 3**:

**Debugging Steps**:
1. Check browser DevTools console for errors
2. Check Network tab for failed requests
3. Verify Supabase credentials in `.env`:
   ```bash
   # Verify these are set and valid
   NEXT_PUBLIC_SUPABASE_URL=
   NEXT_PUBLIC_SUPABASE_ANON_KEY=
   DATABASE_URL=
   DIRECT_URL=
   ```
4. Check Supabase dashboard:
   - Project is active
   - Database is online
   - Auth is enabled
5. Check database:
   - Profile table exists
   - Trigger is active
   - RLS policies are correct
6. Test with Supabase CLI:
   ```bash
   supabase link --project-ref xmuysganwxygcsxwteil
   supabase db pull
   ```

**Common Issues**:
- Expired or invalid Supabase credentials
- Project has been paused (free tier)
- Database connection string incorrect
- Profile trigger not created
- RLS policies too restrictive

---

## Validation Gates

### Pre-Implementation Checks
- [x] Codebase analyzed
- [x] Existing patterns identified
- [x] Official documentation reviewed
- [x] Implementation strategy defined

### Post-Implementation Validation

#### 1. Code Quality
```bash
npm run lint
```
**Expected**: No errors

#### 2. Type Safety
```bash
npx tsc --noEmit
```
**Expected**: No TypeScript errors, especially no import errors for `signOut`

#### 3. Build Verification
```bash
npm run build
```
**Expected**: Build succeeds without warnings

#### 4. Functional Testing
**Manual Test Checklist**:
- [ ] Sign-out button appears in header
- [ ] Clicking sign-out redirects to /login
- [ ] Cannot access /dashboard after sign-out
- [ ] Sign-in works with test credentials
- [ ] Sign-in redirects to /dashboard (not back to /login)
- [ ] Session persists on page refresh
- [ ] Protected routes redirect unauthenticated users

---

## Success Criteria

### Must Have (Critical)
1. ✅ `signOut` function exported from `src/features/auth/actions.ts`
2. ✅ TypeScript compilation succeeds
3. ✅ Production build completes without errors
4. ✅ Sign-out button functional in UI
5. ✅ Sign-out clears session and redirects to /login

### Should Have (Important)
1. ✅ Complete authentication flow verified end-to-end
2. ✅ Sign-in works and redirects to dashboard
3. ✅ Protected routes properly secured
4. ✅ Profile creation trigger confirmed working

### Nice to Have (Optional)
1. ✅ Error handling improvements if needed
2. ✅ Documentation updates
3. ✅ Console warnings eliminated

---

## Error Handling Considerations

### Potential Issues and Solutions

#### Issue: signOut fails silently
**Solution**: Add try-catch and logging:
```typescript
export async function signOut() {
  try {
    const supabase = createClient()
    const { data: { session } } = await supabase.auth.getSession()

    if (session) {
      const { error } = await supabase.auth.signOut()
      if (error) {
        console.error("Sign-out error:", error)
        throw error
      }
    }

    revalidatePath("/", "layout")
    redirect("/login")
  } catch (error) {
    console.error("Unexpected sign-out error:", error)
    // Still redirect to login even if sign-out fails
    redirect("/login")
  }
}
```

#### Issue: Redirect doesn't work
**Check**:
- `redirect()` is called outside try-catch (throws internally)
- `/login` route exists and is accessible
- No middleware blocking the redirect

#### Issue: Session not cleared
**Check**:
- Cookie settings in Supabase client
- Browser cookie storage
- Multiple tabs with same session

---

## References

### Documentation
- [Supabase Next.js Tutorial - Sign Out](https://supabase.com/docs/guides/getting-started/tutorials/with-nextjs#sign-out)
- [Next.js Server Actions](https://nextjs.org/docs/14/app/building-your-application/data-fetching/server-actions-and-mutations)
- [Next.js redirect function](https://nextjs.org/docs/14/app/building-your-application/routing/redirecting#redirect-function)
- [Next.js revalidatePath](https://nextjs.org/docs/14/app/api-reference/functions/revalidatePath)

### Existing Code References
- `src/features/auth/actions.ts` - Pattern to follow (signIn/signUp)
- `src/app/auth/sign-out/route.ts` - Alternative route handler implementation
- `src/components/layout/Header.tsx` - Usage of signOut
- `src/lib/supabase/server.ts` - Supabase client creation
- `src/middleware.ts` - Authentication middleware

### Project Documentation
- `PRPs/project-review-and-next-steps.md` - Current project state analysis
- `PRPs/reports/prompthub-v1-authentication-REPORT.md` - Phase 2 completion report
- `docs/project/PromptHub_06_PLAN_01.md` - Full implementation plan
- `CLAUDE.md` - Project instructions and rules

---

## Implementation Timeline

**Total Estimated Time**: 1-2 hours

| Task | Duration | Dependencies |
|------|----------|--------------|
| Task 1: Add signOut function | 15 min | None |
| Task 2: Run validation gates | 10 min | Task 1 |
| Task 3: Test sign-out | 15 min | Task 2 |
| Task 4: Verify auth flow | 30 min | Task 3 |
| Task 5: Debug if needed | 30-60 min | Task 4 (conditional) |

---

## PRP Confidence Score

**9/10** - High confidence for one-pass implementation

**Strengths**:
- Clear, specific problem statement
- Existing patterns well-documented
- Official documentation referenced
- Complete code examples provided
- Validation strategy defined
- Error handling considered

**Minor Uncertainty**:
- Sign-in redirect issue may require additional investigation
- Environment configuration verification needed

**Mitigation**:
- Comprehensive debugging steps provided
- Multiple validation checkpoints
- Fallback strategies included

---

## Next Steps After Completion

Once authentication issues are resolved and validated:

1. **Update Project Status**:
   - Mark Phase 2 as 100% complete
   - Update `PRPs/reports/prompthub-v1-authentication-REPORT.md` if needed

2. **Prepare for Phase 4**:
   - Review Phase 4 requirements from implementation plan
   - Set up tasks in Archon (when available)
   - Begin Phase 4: Prompt Organization & Retrieval

3. **Create Follow-Up PRP**:
   - Generate comprehensive PRP for Phase 4 implementation
   - Include folder system and prompt list development
   - Plan for parallel agent execution

---

**Author**: Claude (AI Development Assistant)
**Review Date**: 06/11/2025 17:30 GMT+10
**Project**: PromptHub v1
**Phase**: Phase 2 - Authentication Completion
**Repository**: /home/allan/projects/PromptHub
