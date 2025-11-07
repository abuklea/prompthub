# PromptHub
## P1S1T13: Sign-Up E2E Testing Guide (Manual)

| `Title` | `Created` | `Last modified` |
|---------|-----------|-----------------|
| P1S1T13: Sign-Up E2E Testing Guide (Manual) | 07/11/2025 12:25 GMT+10 | 07/11/2025 12:25 GMT+10 |

## Table of Contents
- [Executive Summary](#executive-summary)
- [Prerequisites](#prerequisites)
- [Test Environment Setup](#test-environment-setup)
- [Test Data Strategy](#test-data-strategy)
- [Test Scenarios](#test-scenarios)
  - [TS01: Valid Sign-Up with Unique Email](#ts01-valid-sign-up-with-unique-email)
  - [TS02: Duplicate Email Rejection](#ts02-duplicate-email-rejection)
  - [TS03: Password Length Validation](#ts03-password-length-validation)
  - [TS04: Password Mismatch Validation](#ts04-password-mismatch-validation)
  - [TS05: Invalid Email Format Validation](#ts05-invalid-email-format-validation)
  - [TS06: Empty Required Fields](#ts06-empty-required-fields)
  - [TS07: Post-Signup Verification](#ts07-post-signup-verification)
  - [TS08: Network Error Handling](#ts08-network-error-handling)
- [Test Data Cleanup Procedures](#test-data-cleanup-procedures)
- [Test Execution Checklist](#test-execution-checklist)
- [Known Issues and Limitations](#known-issues-and-limitations)
- [Future Automation Recommendations](#future-automation-recommendations)
- [Appendix](#appendix)

---

## Executive Summary

**Document Purpose**: Comprehensive manual testing guide for the PromptHub sign-up flow, serving as both an immediate testing resource and specification for future automated E2E test implementation.

**Current State**: PromptHub does not have an automated E2E testing framework installed (no Playwright, Cypress, or similar). This guide provides detailed manual testing procedures until automation is implemented.

**Scope**: Complete sign-up flow testing including:
- Form validation (client-side)
- Authentication flow (Supabase Auth)
- Profile creation (Prisma/PostgreSQL)
- Error handling and user feedback
- Post-signup redirect and session management

**Test Coverage Target**: 100% of sign-up user journeys and edge cases

**Estimated Testing Time**: 30-45 minutes for complete test suite execution

---

## Prerequisites

### Required Access
1. **Supabase Dashboard Access**
   - Project URL: `https://xmuysganwxygcsxwteil.supabase.co`
   - Access to Authentication > Users section
   - Permissions to delete test users

2. **Test Email Account**
   - Primary: `allan@formationmedia.net` (for receiving confirmation emails if enabled)
   - Use + suffix pattern for unique test emails: `allan+test{timestamp}@formationmedia.net`

3. **Database Access** (optional, for verification)
   - PostgreSQL connection via Supabase
   - Read access to `Profile` table

### Required Tools
- Modern web browser (Chrome, Firefox, or Edge recommended)
- Browser DevTools (for console monitoring)
- Text editor (for recording test results)

### Environment Requirements
- Node.js and npm installed
- PromptHub repository cloned
- Environment variables configured (`.env` file)

---

## Test Environment Setup

### Step 1: Build Production Version
```bash
cd /home/allan/projects/PromptHub
npm run build
```

**Expected Output**: Build completes successfully with no errors

### Step 2: Start Production Server
```bash
npm run start
```

**Expected Output**: Server starts on `http://localhost:3000`

### Step 3: Verify Server Running
1. Open browser to `http://localhost:3000`
2. Verify application loads without errors
3. Open Browser DevTools (F12)
4. Navigate to Console tab
5. Verify no console errors

### Step 4: Navigate to Login Page
- URL: `http://localhost:3000/login`
- Verify "Sign In" form is visible
- Verify "Sign Up" toggle link is present

### Step 5: Switch to Sign-Up Mode
1. Click "Sign Up" link at bottom of form
2. Verify form title changes to "Create Account"
3. Verify three fields are present:
   - Email
   - Password
   - Confirm Password
4. Verify button text is "Create Account"

**Environment Ready**: Proceed to test execution

---

## Test Data Strategy

### Email Pattern Convention
Use the following pattern for all test sign-ups:
```
allan+signup{timestamp}@formationmedia.net
```

**Examples**:
- `allan+signup20251107122500@formationmedia.net`
- `allan+signup001@formationmedia.net`
- `allan+signup002@formationmedia.net`

**Why This Pattern**:
- Gmail/GSuite ignores `+` suffixes (all emails go to `allan@formationmedia.net`)
- Timestamp ensures uniqueness
- Easy to identify test accounts for cleanup
- Matches production email format rules

### Password Requirements
Per `SignUpSchema` validation:
- Minimum 8 characters
- No maximum length specified
- No special character requirements

**Test Passwords**:
- Valid: `TestPass123`, `*.Password123`, `ValidPassword2025`
- Invalid: `short`, `test`, `1234567` (< 8 chars)

### Test Data Tracking
Record all test emails created during testing for cleanup:

| Test Scenario | Email Used | Created At | Status | Cleanup Required |
|---------------|------------|------------|--------|------------------|
| TS01 | allan+signup001@... | 12:30 | Created | Yes |
| TS02 | allan+signup001@... | 12:32 | Duplicate | No |
| ... | ... | ... | ... | ... |

---

## Test Scenarios

### TS01: Valid Sign-Up with Unique Email

**Objective**: Verify successful account creation with valid, unique credentials

**Priority**: HIGH (Critical happy path)

**Prerequisites**:
- On sign-up form (`/login` with "Sign Up" mode active)
- Clean browser state (no active session)
- Email address NOT previously registered

**Test Data**:
- Email: `allan+signup{timestamp}@formationmedia.net` (generate unique timestamp)
- Password: `TestPass123`
- Confirm Password: `TestPass123`

**Test Steps**:
1. Fill Email field with unique test email
2. Fill Password field: `TestPass123`
3. Fill Confirm Password field: `TestPass123`
4. Verify all three fields have valid values (no red borders)
5. Click "Create Account" button
6. Observe loading state (button changes to "Loading...")
7. Observe success toast notification
8. Observe redirect behavior

**Expected Results**:
- ✅ Button changes to "Loading..." immediately
- ✅ Success toast appears: "Account created!"
- ✅ Toast automatically dismisses after ~4 seconds
- ✅ Page redirects to `/dashboard`
- ✅ Dashboard page loads successfully
- ✅ User email visible in header
- ✅ "Sign Out" button present
- ✅ No console errors
- ✅ No inline form errors

**Verification Steps** (Database):
1. Open Supabase Dashboard > Authentication > Users
2. Search for test email
3. Verify user exists with:
   - Correct email address
   - "Confirmed" status (or "Waiting for verification" if email confirmation enabled)
   - Created timestamp matches test execution time

4. Check Profile creation:
```sql
SELECT * FROM "Profile" WHERE id = '<user_id_from_supabase>';
```
Expected: One row returned with matching user ID

**Pass Criteria**:
- All expected results verified
- User account created in Supabase Auth
- Profile record created in database
- No errors in browser console

**Actual Results**: _[To be filled during test execution]_

**Status**: ⬜ Not Tested | ✅ Passed | ❌ Failed

---

### TS02: Duplicate Email Rejection

**Objective**: Verify system prevents duplicate account creation with existing email

**Priority**: HIGH (Critical security/data integrity)

**Prerequisites**:
- TS01 completed successfully (test email already registered)
- On sign-up form
- Clean browser state

**Test Data**:
- Email: Same email from TS01 (e.g., `allan+signup001@formationmedia.net`)
- Password: `TestPass456` (different password is fine)
- Confirm Password: `TestPass456`

**Test Steps**:
1. Fill Email field with EXISTING test email from TS01
2. Fill Password field: `TestPass456`
3. Fill Confirm Password field: `TestPass456`
4. Click "Create Account" button
5. Observe loading state
6. Observe error feedback

**Expected Results**:
- ✅ Button changes to "Loading..."
- ✅ Loading state reverts to "Create Account" after error
- ✅ Error toast appears with message similar to:
  - "User already registered"
  - "Email address already in use"
  - (Exact message from Supabase Auth)
- ✅ Inline error message displayed below form
- ✅ User remains on `/login` page (no redirect)
- ✅ Form remains functional (can edit fields)
- ✅ No console errors
- ✅ No account created (verify in Supabase Dashboard if needed)

**Pass Criteria**:
- Error message displayed to user (toast AND inline)
- No duplicate account created
- Form remains functional
- No application crash

**Actual Results**: _[To be filled during test execution]_

**Status**: ⬜ Not Tested | ✅ Passed | ❌ Failed

---

### TS03: Password Length Validation

**Objective**: Verify password must meet minimum length requirement (8 characters)

**Priority**: HIGH (Security requirement)

**Prerequisites**:
- On sign-up form
- Clean form state

**Test Data Set**:

**Test Case 3A: Password Too Short (7 chars)**
- Email: `allan+signup{timestamp}@formationmedia.net`
- Password: `Test123` (7 characters)
- Confirm Password: `Test123`

**Test Case 3B: Password Exactly 8 Chars (Boundary)**
- Email: `allan+signup{timestamp}@formationmedia.net`
- Password: `Test1234` (8 characters)
- Confirm Password: `Test1234`

**Test Steps (Case 3A - Too Short)**:
1. Fill Email field with unique test email
2. Fill Password field: `Test123` (7 chars)
3. Click on another field or attempt to submit
4. Observe validation feedback

**Expected Results (Case 3A)**:
- ✅ Inline validation error appears under Password field
- ✅ Error message: "Password must be at least 8 characters"
- ✅ Password field marked as invalid (red border)
- ✅ "Create Account" button may be disabled OR
- ✅ Form submission blocked with validation error
- ✅ No API call made to Supabase
- ✅ No toast notification (client-side validation only)

**Test Steps (Case 3B - Boundary Test)**:
1. Clear form
2. Fill Email field with NEW unique test email
3. Fill Password field: `Test1234` (exactly 8 chars)
4. Fill Confirm Password: `Test1234`
5. Click "Create Account"
6. Observe behavior

**Expected Results (Case 3B)**:
- ✅ No validation errors
- ✅ Form submission allowed
- ✅ Account creation proceeds (like TS01)
- ✅ Success toast appears
- ✅ Redirect to dashboard

**Pass Criteria**:
- Case 3A: Validation error prevents submission
- Case 3B: 8-character password accepted
- Clear user feedback on validation failure

**Actual Results**: _[To be filled during test execution]_

**Status**: ⬜ Not Tested | ✅ Passed | ❌ Failed

---

### TS04: Password Mismatch Validation

**Objective**: Verify "Confirm Password" must match "Password" field

**Priority**: HIGH (User experience and security)

**Prerequisites**:
- On sign-up form
- Clean form state

**Test Data**:
- Email: `allan+signup{timestamp}@formationmedia.net`
- Password: `TestPass123`
- Confirm Password: `TestPass456` (DIFFERENT from password)

**Test Steps**:
1. Fill Email field with unique test email
2. Fill Password field: `TestPass123`
3. Fill Confirm Password field: `TestPass456` (intentionally different)
4. Click on another field or attempt to submit
5. Observe validation feedback

**Expected Results**:
- ✅ Inline validation error appears under Confirm Password field
- ✅ Error message: "Passwords do not match"
- ✅ Confirm Password field marked as invalid (red border)
- ✅ Form submission blocked
- ✅ No API call made to Supabase
- ✅ No toast notification (client-side validation)

**Additional Test**: Real-time validation
1. After seeing the error, modify Confirm Password to match: `TestPass123`
2. Observe error clears immediately (if real-time validation enabled)

**Expected**: Error message disappears when passwords match

**Pass Criteria**:
- Password mismatch detected and prevented
- Clear error message displayed
- Form becomes valid when passwords match

**Actual Results**: _[To be filled during test execution]_

**Status**: ⬜ Not Tested | ✅ Passed | ❌ Failed

---

### TS05: Invalid Email Format Validation

**Objective**: Verify email field requires valid email format

**Priority**: HIGH (Data integrity)

**Prerequisites**:
- On sign-up form
- Clean form state

**Test Data Set**:

**Test Case 5A: No @ Symbol**
- Email: `invalidemail` (no @)

**Test Case 5B: Missing Domain**
- Email: `test@` (incomplete)

**Test Case 5C: Missing Username**
- Email: `@example.com` (no username)

**Test Case 5D: Spaces in Email**
- Email: `test user@example.com` (contains space)

**Test Steps (Each Case)**:
1. Fill Email field with invalid format
2. Fill Password field: `ValidPass123`
3. Fill Confirm Password: `ValidPass123`
4. Click on another field or attempt to submit
5. Observe validation feedback

**Expected Results (All Cases)**:
- ✅ Inline validation error appears under Email field
- ✅ Error message: "Invalid email" or similar
- ✅ Email field marked as invalid (red border)
- ✅ Form submission blocked
- ✅ No API call made to Supabase
- ✅ Password fields remain valid (no cascading errors)

**Positive Test** (Valid Email):
1. Change Email to valid format: `allan+signup{timestamp}@formationmedia.net`
2. Observe error clears
3. Form becomes submittable

**Pass Criteria**:
- All invalid formats rejected
- Clear validation messages
- Valid format accepted

**Actual Results**: _[To be filled during test execution]_

**Status**: ⬜ Not Tested | ✅ Passed | ❌ Failed

---

### TS06: Empty Required Fields

**Objective**: Verify all fields are required and cannot be submitted empty

**Priority**: MEDIUM (Basic validation)

**Prerequisites**:
- On sign-up form
- Clean form state

**Test Data Set**:

**Test Case 6A: All Fields Empty**
- Email: (empty)
- Password: (empty)
- Confirm Password: (empty)

**Test Case 6B: Only Email Filled**
- Email: `allan+signup{timestamp}@formationmedia.net`
- Password: (empty)
- Confirm Password: (empty)

**Test Case 6C: Email and Password Filled**
- Email: `allan+signup{timestamp}@formationmedia.net`
- Password: `TestPass123`
- Confirm Password: (empty)

**Test Steps (Case 6A)**:
1. Leave all fields empty
2. Click "Create Account" button
3. Observe validation feedback

**Expected Results (Case 6A)**:
- ✅ Form submission blocked
- ✅ Validation errors displayed on all three fields
- ✅ No API call made
- ✅ Button remains "Create Account" (no loading state)

**Expected Results (Case 6B)**:
- ✅ Form submission blocked
- ✅ Validation errors on Password and Confirm Password fields
- ✅ Email field valid (no error)

**Expected Results (Case 6C)**:
- ✅ Form submission blocked
- ✅ Validation error on Confirm Password field only
- ✅ Email and Password fields valid

**Pass Criteria**:
- Empty fields detected and prevented
- Appropriate validation messages
- Only empty fields marked as invalid

**Actual Results**: _[To be filled during test execution]_

**Status**: ⬜ Not Tested | ✅ Passed | ❌ Failed

---

### TS07: Post-Signup Verification

**Objective**: Comprehensive verification of post-signup state and data

**Priority**: HIGH (Critical for user onboarding)

**Prerequisites**:
- Successfully completed sign-up (TS01 or create new test account)
- Redirected to `/dashboard`
- Browser DevTools open

**Test Steps**:

**Part A: UI Verification**
1. Verify URL is `http://localhost:3000/dashboard`
2. Verify page title contains "Dashboard" or "PromptHub"
3. Verify header shows user email (e.g., `allan+signup001@formationmedia.net`)
4. Verify "Sign Out" button is visible and clickable
5. Verify navigation menu present (Dashboard, Profile, Settings, etc.)
6. Verify no loading spinners or error messages

**Part B: Session Verification**
1. Open Browser DevTools > Application tab (Chrome) or Storage tab (Firefox)
2. Navigate to Cookies section
3. Verify Supabase session cookies exist:
   - `sb-{project-ref}-auth-token`
   - Contains valid JWT token
4. Navigate to Local Storage
5. Verify Supabase session data present

**Part C: Authentication State**
1. Open new browser tab
2. Navigate directly to `http://localhost:3000/dashboard`
3. Verify immediate access (no redirect to login)
4. Verify same user session active

**Part D: Protected Route Test**
1. Sign out (click "Sign Out" button)
2. Verify redirect to `/login`
3. In new tab, try to access `http://localhost:3000/dashboard`
4. Verify immediate redirect back to `/login` (no access without auth)

**Part E: Database Verification**

**Check Auth User**:
1. Open Supabase Dashboard > Authentication > Users
2. Find test user by email
3. Verify user fields:
   - ✅ Email matches test email
   - ✅ Email confirmed: true (or false if email verification enabled)
   - ✅ Created at: recent timestamp
   - ✅ Last sign in: recent timestamp
   - ✅ User ID: valid UUID

**Check Profile Creation**:
1. Open Supabase Dashboard > Table Editor > Profile
2. Search for profile with ID matching user ID from step above
3. Verify profile fields:
   - ✅ Profile exists
   - ✅ ID matches auth user ID
   - ✅ Created at: matches user creation time
   - ✅ No orphaned data

**Alternative SQL Verification**:
```sql
-- Get user and profile together
SELECT 
  au.id as user_id,
  au.email,
  au.created_at as user_created_at,
  p.id as profile_id,
  p.created_at as profile_created_at
FROM auth.users au
LEFT JOIN "Profile" p ON au.id = p.id
WHERE au.email = 'allan+signup001@formationmedia.net';
```

Expected: One row with both user and profile data

**Part F: Console Verification**
1. Check Browser DevTools Console
2. Verify no errors throughout entire flow
3. Verify no warnings about missing data or failed requests

**Expected Results**:
- ✅ All UI elements present and functional
- ✅ Session cookies exist and valid
- ✅ Session persists across tabs
- ✅ Protected routes enforce authentication
- ✅ User exists in auth.users table
- ✅ Profile exists in Profile table with matching ID
- ✅ No console errors or warnings

**Pass Criteria**:
- Complete user account creation
- Profile created correctly
- Session management working
- Authentication middleware protecting routes

**Actual Results**: _[To be filled during test execution]_

**Status**: ⬜ Not Tested | ✅ Passed | ❌ Failed

---

### TS08: Network Error Handling

**Objective**: Verify graceful handling of network failures during sign-up

**Priority**: MEDIUM (Error resilience)

**Prerequisites**:
- On sign-up form
- Browser DevTools open

**Test Data**:
- Email: `allan+signup{timestamp}@formationmedia.net`
- Password: `TestPass123`
- Confirm Password: `TestPass123`

**Test Steps**:

**Method 1: Browser Offline Mode**
1. Fill all form fields with valid data
2. Open Browser DevTools > Network tab
3. Enable "Offline" mode (checkbox/dropdown in Network tab)
4. Click "Create Account" button
5. Observe behavior
6. Disable "Offline" mode
7. Retry submission

**Method 2: Network Throttling**
1. Fill form fields with valid data
2. Open DevTools > Network tab
3. Set throttling to "Slow 3G" or "Offline"
4. Click "Create Account" button
5. Observe loading state and timeout behavior

**Expected Results (Offline)**:
- ✅ Button changes to "Loading..."
- ✅ Network request fails (visible in Network tab)
- ✅ Error toast appears with appropriate message:
  - "An unexpected error occurred" OR
  - "Network error" OR
  - Similar user-friendly message
- ✅ Button reverts to "Create Account"
- ✅ Form remains functional (can retry)
- ✅ No application crash
- ✅ No console errors (or only network-related errors)
- ✅ Inline error message may appear below form

**Expected Results (Retry After Network Restored)**:
- ✅ Form submission succeeds
- ✅ Account created successfully
- ✅ Redirect to dashboard

**Pass Criteria**:
- Graceful error handling (no crash)
- User-friendly error message
- Form remains functional for retry
- Successful submission after network restored

**Actual Results**: _[To be filled during test execution]_

**Status**: ⬜ Not Tested | ✅ Passed | ❌ Failed

---

## Test Data Cleanup Procedures

### Why Cleanup is Critical
- Prevents database pollution with test accounts
- Maintains clean Supabase Auth user list
- Avoids hitting user limits on free tier
- Ensures repeatable testing

### Cleanup Method 1: Supabase Dashboard (Manual)

**Steps**:
1. Open Supabase Dashboard: `https://supabase.com/dashboard/project/xmuysganwxygcsxwteil`
2. Navigate to **Authentication** > **Users**
3. Use search box to find test emails: `allan+signup`
4. For each test user:
   - Click the three dots menu (⋮)
   - Select "Delete user"
   - Confirm deletion
5. Verify user removed from list

**Cascade Behavior**: Deleting a Supabase Auth user will automatically delete the associated Profile record (if CASCADE is set on the foreign key).

**Time Estimate**: 1-2 minutes per user

---

### Cleanup Method 2: SQL Query (Bulk Deletion)

**For Multiple Test Users**:

```sql
-- List all test users first (verify before deletion)
SELECT id, email, created_at 
FROM auth.users 
WHERE email LIKE '%+signup%@formationmedia.net'
ORDER BY created_at DESC;
```

**Manual Deletion** (Supabase Dashboard SQL Editor):
```sql
-- Delete profiles for test users (if not CASCADE)
DELETE FROM "Profile" 
WHERE id IN (
  SELECT id FROM auth.users 
  WHERE email LIKE '%+signup%@formationmedia.net'
);

-- Note: Deleting auth.users requires Supabase Dashboard or API
-- Cannot be done directly via SQL for security reasons
```

**Important**: `auth.users` table cannot be modified directly via SQL. Use Dashboard or Supabase Management API.

---

### Cleanup Method 3: Supabase Management API (Future Automation)

**For Automated Test Cleanup**:

```javascript
// Example cleanup script for future automation
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY // Requires service role key
)

async function cleanupTestUsers() {
  // List users with test email pattern
  const { data: { users }, error } = await supabase.auth.admin.listUsers()
  
  const testUsers = users.filter(user => 
    user.email.includes('+signup') && 
    user.email.endsWith('@formationmedia.net')
  )
  
  // Delete each test user
  for (const user of testUsers) {
    await supabase.auth.admin.deleteUser(user.id)
    console.log(`Deleted test user: ${user.email}`)
  }
}
```

**Requirements**:
- `SUPABASE_SERVICE_ROLE_KEY` environment variable
- Admin privileges
- Node.js script execution

---

### Cleanup Checklist

After each testing session:

- [ ] Identify all test emails created (check test tracking table)
- [ ] Verify each test email in Supabase Dashboard
- [ ] Delete all test users via Dashboard
- [ ] Verify profiles deleted (cascade or manual)
- [ ] Clear any test data in other tables (if applicable)
- [ ] Update test tracking table with cleanup status
- [ ] Verify database back to clean state

---

## Test Execution Checklist

### Pre-Test Setup
- [ ] Environment variables configured (`.env`)
- [ ] Production build completed (`npm run build`)
- [ ] Production server running (`npm run start`)
- [ ] Browser DevTools open
- [ ] Test tracking table prepared
- [ ] Supabase Dashboard accessible
- [ ] Timestamp generated for unique test emails

### During Testing
- [ ] Execute tests in order (TS01 → TS08)
- [ ] Record actual results for each test
- [ ] Mark pass/fail status for each test
- [ ] Track all test emails created
- [ ] Screenshot any failures or unexpected behavior
- [ ] Note any console errors or warnings

### Post-Test Actions
- [ ] Complete all test result fields
- [ ] Calculate pass/fail statistics
- [ ] Clean up all test users (see cleanup procedures)
- [ ] Verify database back to clean state
- [ ] Document any bugs found
- [ ] Update test guide with any learnings

### Reporting
- [ ] Summarize test results
- [ ] Report any failures to development team
- [ ] Update task status in Archon
- [ ] Archive test execution records

---

## Known Issues and Limitations

### Current Limitations

1. **No Email Confirmation Flow**
   - Current implementation may not require email verification
   - Users can access dashboard immediately after signup
   - Future enhancement: Add email confirmation requirement

2. **Manual Testing Only**
   - No automated E2E framework installed
   - Tests must be executed manually
   - Time-consuming for regression testing

3. **Limited Password Validation**
   - Only checks minimum length (8 characters)
   - No strength requirements (uppercase, numbers, special chars)
   - No maximum length enforcement

4. **Test Data Cleanup**
   - Requires manual deletion via Dashboard
   - No automated cleanup script
   - Risk of accumulating test accounts

### Workarounds

**Email Confirmation**:
- Test signup flow works without email confirmation
- If enabled in future, add TS09 for email confirmation testing

**Password Strength**:
- Document current validation rules clearly
- Plan for future enhancement (zxcvbn integration, etc.)

**Cleanup**:
- Use consistent email pattern for easy identification
- Schedule regular cleanup sessions
- Implement automated cleanup when E2E framework added

---

## Future Automation Recommendations

### Recommended E2E Framework: Playwright

**Why Playwright**:
- Official support from Microsoft
- Excellent Next.js integration
- Built-in network mocking and interception
- Parallel test execution
- Video recording and screenshots
- Strong TypeScript support
- Cross-browser testing (Chromium, Firefox, WebKit)

### Implementation Plan

**Phase 1: Setup** (Est. 2-3 hours)
```bash
npm install -D @playwright/test
npx playwright install
```

**Phase 2: Configuration** (Est. 1-2 hours)
```typescript
// playwright.config.ts
import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
  ],
  webServer: {
    command: 'npm run start',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
  },
})
```

**Phase 3: Test Implementation** (Est. 4-6 hours)

Convert this manual guide to automated tests:

```typescript
// tests/e2e/auth-signup.spec.ts
import { test, expect } from '@playwright/test'
import { createClient } from '@supabase/supabase-js'

// Test setup with cleanup
test.describe('Sign-Up Flow', () => {
  let testEmail: string
  let testUserId: string
  
  test.beforeEach(() => {
    testEmail = `allan+signup${Date.now()}@formationmedia.net`
  })
  
  test.afterEach(async () => {
    // Cleanup test user
    if (testUserId) {
      const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
      )
      await supabase.auth.admin.deleteUser(testUserId)
    }
  })
  
  test('TS01: Valid sign-up with unique email', async ({ page }) => {
    // Navigate to signup
    await page.goto('/login')
    await page.click('text=Sign Up')
    
    // Fill form
    await page.fill('input[name="email"]', testEmail)
    await page.fill('input[name="password"]', 'TestPass123')
    await page.fill('input[name="confirmPassword"]', 'TestPass123')
    
    // Submit
    await page.click('button[type="submit"]')
    
    // Verify success
    await expect(page).toHaveURL('/dashboard')
    await expect(page.locator('text=Account created!')).toBeVisible()
    
    // Store user ID for cleanup
    // (Extract from session or API response)
  })
  
  test('TS02: Duplicate email rejection', async ({ page }) => {
    // First signup
    await page.goto('/login')
    await page.click('text=Sign Up')
    await page.fill('input[name="email"]', testEmail)
    await page.fill('input[name="password"]', 'TestPass123')
    await page.fill('input[name="confirmPassword"]', 'TestPass123')
    await page.click('button[type="submit"]')
    await expect(page).toHaveURL('/dashboard')
    
    // Sign out
    await page.click('text=Sign Out')
    
    // Try duplicate signup
    await page.click('text=Sign Up')
    await page.fill('input[name="email"]', testEmail)
    await page.fill('input[name="password"]', 'TestPass456')
    await page.fill('input[name="confirmPassword"]', 'TestPass456')
    await page.click('button[type="submit"]')
    
    // Verify error
    await expect(page.locator('text=/already registered|already in use/i')).toBeVisible()
    await expect(page).toHaveURL('/login')
  })
  
  // Continue for all test scenarios...
})
```

**Phase 4: CI/CD Integration** (Est. 1-2 hours)
```yaml
# .github/workflows/e2e-tests.yml
name: E2E Tests
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
      - run: npm ci
      - run: npx playwright install --with-deps
      - run: npm run build
      - run: npm run test:e2e
      - uses: actions/upload-artifact@v3
        if: always()
        with:
          name: playwright-report
          path: playwright-report/
```

### Estimated Total Implementation Time
- **Initial Setup**: 8-12 hours
- **Ongoing Maintenance**: 1-2 hours per sprint
- **ROI**: Significant time savings on regression testing

### Benefits of Automation
- ✅ Consistent test execution
- ✅ Fast feedback (run in CI/CD)
- ✅ Automatic cleanup with afterEach hooks
- ✅ Video recording of failures
- ✅ Cross-browser testing
- ✅ Parallel execution
- ✅ Reduced manual testing time from 45 mins to 5 mins

---

## Appendix

### A. Validation Schema Reference

From `src/features/auth/schemas.ts`:

```typescript
export const SignUpSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: 'Passwords do not match',
  path: ['confirmPassword'],
});
```

**Key Validations**:
- `email`: Must be valid email format (RFC 5322)
- `password`: Minimum 8 characters
- `confirmPassword`: Must match `password` field

---

### B. Server Action Reference

From `src/features/auth/actions.ts`:

```typescript
export async function signUp(values: z.infer<typeof SignUpSchema>): Promise<ActionResult> {
  try {
    const supabase = createClient()
    const { data, error } = await supabase.auth.signUp(values)

    if (error) {
      return { success: false, error: error.message }
    }

    // Ensure profile exists for the new user
    if (data.user?.id) {
      await ensureProfileExists(data.user.id)
    }

    revalidatePath("/", "layout")
    redirect("/dashboard")
  } catch (error) {
    if (error instanceof Error && error.message === "NEXT_REDIRECT") {
      throw error // Re-throw redirect
    }
    return { success: false, error: "An unexpected error occurred" }
  }
}
```

**Flow**:
1. Call Supabase Auth API (`signUp`)
2. Check for errors → return error message
3. Create profile in database (`ensureProfileExists`)
4. Revalidate Next.js cache
5. Redirect to `/dashboard`

---

### C. Common Supabase Error Messages

| Error Code | Message | Meaning |
|------------|---------|---------|
| `user_already_exists` | User already registered | Email already exists in auth.users |
| `invalid_credentials` | Invalid login credentials | Wrong email or password (sign-in) |
| `weak_password` | Password is too weak | Password doesn't meet requirements |
| `email_not_confirmed` | Email not confirmed | Email verification required but not completed |
| `over_email_send_rate_limit` | Email rate limit exceeded | Too many emails sent (confirmation resends) |

---

### D. SQL Queries for Manual Verification

**Find User by Email**:
```sql
SELECT id, email, email_confirmed_at, created_at, last_sign_in_at
FROM auth.users
WHERE email = 'allan+signup001@formationmedia.net';
```

**Find Profile by User ID**:
```sql
SELECT * FROM "Profile" WHERE id = '<user-id-from-above>';
```

**Join User and Profile**:
```sql
SELECT 
  au.id,
  au.email,
  au.email_confirmed_at,
  au.created_at as user_created_at,
  p.id as profile_id,
  p.created_at as profile_created_at
FROM auth.users au
LEFT JOIN "Profile" p ON au.id = p.id
WHERE au.email LIKE '%+signup%@formationmedia.net'
ORDER BY au.created_at DESC;
```

**Count Test Users**:
```sql
SELECT COUNT(*) as test_user_count
FROM auth.users
WHERE email LIKE '%+signup%@formationmedia.net';
```

---

### E. Browser DevTools Tips

**Console Monitoring**:
1. Open DevTools (F12)
2. Navigate to Console tab
3. Enable "Preserve log" (to keep logs across page loads)
4. Filter by "Errors" to see only error messages

**Network Monitoring**:
1. Open DevTools > Network tab
2. Enable "Preserve log"
3. Filter by "Fetch/XHR" to see API calls
4. Look for requests to Supabase endpoints
5. Check request payload and response

**Storage Inspection**:
1. DevTools > Application (Chrome) or Storage (Firefox)
2. Cookies > localhost:3000 > Find Supabase session cookies
3. Local Storage > localhost:3000 > Find Supabase session data
4. Verify session token structure (JWT format)

**Offline Mode Testing**:
1. DevTools > Network tab
2. Check "Offline" checkbox or use throttling dropdown
3. Execute test scenario
4. Disable offline mode to restore connectivity

---

### F. Test Results Summary Template

Copy this template for test execution records:

```markdown
## Test Execution Summary

**Execution Date**: _____________________
**Executed By**: _____________________
**Environment**: Production Build (localhost:3000)
**Build Version**: _____________________

### Results Overview

| Test ID | Test Name | Status | Notes |
|---------|-----------|--------|-------|
| TS01 | Valid Sign-Up | ⬜ | |
| TS02 | Duplicate Email | ⬜ | |
| TS03 | Password Length | ⬜ | |
| TS04 | Password Mismatch | ⬜ | |
| TS05 | Invalid Email | ⬜ | |
| TS06 | Empty Fields | ⬜ | |
| TS07 | Post-Signup Verification | ⬜ | |
| TS08 | Network Error | ⬜ | |

**Pass Rate**: ___/8 (___%)

### Test Emails Created
| Email | User ID | Cleanup Status |
|-------|---------|----------------|
| | | ⬜ |

### Issues Found
1. 
2. 
3. 

### Recommendations
1. 
2. 
3. 
```

---

### G. Troubleshooting Guide

**Issue**: Toast notifications not appearing

**Possible Causes**:
- Sonner toast provider not mounted
- Z-index conflicts with other elements
- JavaScript error blocking toast rendering

**Debug Steps**:
1. Check console for errors
2. Verify toast provider in root layout
3. Test with browser zoom at 100%
4. Try different browser

---

**Issue**: Redirect not working after signup

**Possible Causes**:
- Server action error (check return value)
- Middleware blocking redirect
- Session not created properly

**Debug Steps**:
1. Check Network tab for API response
2. Verify session cookies created
3. Check server logs for errors
4. Test with console.log in server action

---

**Issue**: Profile not created in database

**Possible Causes**:
- Database connection error
- Prisma client not initialized
- Foreign key constraint violation
- RLS policy blocking insert

**Debug Steps**:
1. Check Supabase logs
2. Verify database connection string
3. Test Prisma query directly
4. Check RLS policies on Profile table

---

**Issue**: Form validation not working

**Possible Causes**:
- Zod schema error
- React Hook Form not connected
- Field names don't match schema

**Debug Steps**:
1. Verify field names match schema keys
2. Check form resolver configuration
3. Test schema independently with test data
4. Enable React Hook Form DevTools

---

### H. Related Documentation

**Project Documentation**:
- `/home/allan/projects/PromptHub/README.md` - Project overview
- `/home/allan/projects/PromptHub/CLAUDE.md` - Development guidelines
- `/home/allan/projects/PromptHub/docs/rules/testing.md` - Testing strategy

**Previous Testing Reports**:
- `/home/allan/projects/PromptHub/wip/P1S1T10-e2e-authentication-testing-report.md` - Sign-in flow testing

**External Resources**:
- [Supabase Auth Documentation](https://supabase.com/docs/guides/auth)
- [Next.js Server Actions](https://nextjs.org/docs/app/building-your-application/data-fetching/server-actions-and-mutations)
- [React Hook Form + Zod](https://react-hook-form.com/get-started#SchemaValidation)
- [Playwright Documentation](https://playwright.dev/)

---

## Document Status

**Status**: COMPLETE ✅
**Task ID**: P1S1T13
**Archon Task ID**: 3a5b5ac7-f0b5-46b2-b8f8-99dde9633494
**PRP Document**: PRPs/fix-styling-and-layout.md
**PRP ID**: P1S1
**Phase**: Phase 1 - Initial MVP Development
**Created By**: qa-test-automation-engineer
**Purpose**: Manual E2E testing guide for sign-up flow (until automated framework implemented)
**Next Steps**: 
1. Execute manual tests using this guide
2. Document results in test execution summary
3. Clean up test data
4. Plan for future automation implementation (Playwright recommended)
