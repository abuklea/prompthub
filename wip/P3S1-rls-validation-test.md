# PromptHub
## P3S1: RLS Multi-User Validation Testing

| `Title` | `Created` | `Last modified` |
|---------|-----------|-----------------|
| P3S1: RLS Multi-User Validation Testing | 06/11/2025 20:23 GMT+10 | 06/11/2025 20:23 GMT+10 |

## Table of Contents
- [Overview](#overview)
- [Test Setup](#test-setup)
- [Test Scenarios](#test-scenarios)
- [Test Results](#test-results)
- [Issues Found](#issues-found)
- [Conclusion](#conclusion)

---

## Overview

This document records the multi-user validation testing for Row Level Security (RLS) policies implemented in P3S1. The goal is to verify complete data isolation between users across all tables.

**Test Date**: [TO BE FILLED]
**Tester**: [TO BE FILLED]
**Duration**: [TO BE FILLED]

---

## Test Setup

### Test Users

| User | Email | Password | Purpose |
|------|-------|----------|---------|
| User A | allan@formationmedia.net | *.Password123 | Existing test user |
| User B | test@example.com | [CREATE NEW] | New test user |

### Test Environment

- **Browser Setup**: Two sessions (normal + incognito mode)
- **Application URL**: http://localhost:3010
- **Supabase Project**: xmuysganwxygcsxwteil

### Prerequisites

- ✅ P3S1T1: Tag schema fix applied
- ✅ P3S1T2: RLS enabled on all tables
- ✅ P3S1T3-T8: All RLS policies created
- ✅ Dev server running on port 3010

---

## Test Scenarios

### Test 1: Profile Isolation

**Objective**: Verify users can only see their own profile

**Steps**:
1. Login as User A
2. Navigate to profile page or check profile data
3. Verify can SELECT own profile
4. Note User A's profile ID
5. Open Supabase SQL Editor
6. Try to query User B's profile: `SELECT * FROM "Profile" WHERE id = '<user-b-id>'`
7. Expected: Empty result (not error)
8. Login as User B
9. Try to query User A's profile
10. Expected: Empty result (not error)

**Result**: [PASS/FAIL]
**Notes**: [TO BE FILLED]

---

### Test 2: Folder Isolation

**Objective**: Verify users can only CRUD own folders

**Steps**:
1. Login as User A
2. Create folder named "Personal"
3. Note folder ID
4. Verify folder appears in folder list
5. Login as User B
6. Create folder named "Personal" (duplicate name OK)
7. Verify User B's folder appears
8. Verify User A's "Personal" folder NOT visible
9. Try to query User A's folder via SQL:
   ```sql
   SELECT * FROM "Folder" WHERE user_id = '<user-a-id>'
   ```
10. Expected: Empty result
11. Login as User A
12. Try to UPDATE User B's folder via SQL
13. Expected: No rows affected
14. Try to DELETE User B's folder via SQL
15. Expected: No rows affected

**Result**: [PASS/FAIL]
**Notes**: [TO BE FILLED]

---

### Test 3: Prompt Isolation

**Objective**: Verify users can only CRUD own prompts

**Steps**:
1. Login as User A
2. Create prompt titled "My Secret Prompt" with content "Confidential data"
3. Note prompt ID
4. Verify prompt appears in prompt list
5. Login as User B
6. Create prompt titled "My Secret Prompt" (duplicate title OK)
7. Verify User B's prompt appears
8. Verify User A's prompt NOT visible
9. Try to query User A's prompt via SQL:
   ```sql
   SELECT * FROM "Prompt" WHERE user_id = '<user-a-id>'
   ```
10. Expected: Empty result
11. Login as User A
12. Try to UPDATE User B's prompt via SQL
13. Expected: No rows affected
14. Try to DELETE User B's prompt via SQL
15. Expected: No rows affected

**Result**: [PASS/FAIL]
**Notes**: [TO BE FILLED]

---

### Test 4: Tag Isolation (Per-User Namespaces)

**Objective**: Verify per-user tag namespaces work correctly

**Steps**:
1. Login as User A
2. Create tag named "work"
3. Note tag ID
4. Login as User B
5. Create tag named "work"
6. Expected: SUCCESS (both users can have "work" tag)
7. Verify User B's "work" tag has different ID
8. Login as User A
9. Verify can only see own "work" tag
10. Try to query User B's tags via SQL:
    ```sql
    SELECT * FROM "Tag" WHERE user_id = '<user-b-id>'
    ```
11. Expected: Empty result

**Result**: [PASS/FAIL]
**Notes**: [TO BE FILLED]

---

### Test 5: PromptVersion Isolation

**Objective**: Verify users can only see versions of their own prompts

**Steps**:
1. Login as User A
2. Create prompt "Version Test"
3. Update prompt to create version history
4. Note version IDs
5. Login as User B
6. Try to query User A's prompt versions via SQL:
   ```sql
   SELECT pv.* FROM "PromptVersion" pv
   JOIN "Prompt" p ON p.id = pv.prompt_id
   WHERE p.user_id = '<user-a-id>'
   ```
7. Expected: Empty result
8. Create own prompt and versions
9. Verify can see own versions only

**Result**: [PASS/FAIL]
**Notes**: [TO BE FILLED]

---

### Test 6: Tag Association Isolation

**Objective**: Verify users cannot tag others' prompts or use others' tags

**Steps**:
1. Login as User A
2. Create prompt "Test Prompt A"
3. Create tag "urgent"
4. Tag prompt with "urgent"
5. Note prompt ID and tag ID
6. Login as User B
7. Create own tag "important"
8. Try to associate User A's prompt with User B's tag via SQL:
   ```sql
   INSERT INTO "_PromptToTag" ("A", "B")
   VALUES ('<user-a-prompt-id>', '<user-b-tag-id>');
   ```
9. Expected: INSERT fails or violates RLS
10. Try to associate User B's prompt with User A's tag
11. Expected: INSERT fails or violates RLS
12. Verify only own prompt-tag associations visible

**Result**: [PASS/FAIL]
**Notes**: [TO BE FILLED]

---

### Test 7: Unauthenticated Access

**Objective**: Verify unauthenticated requests return empty results

**Steps**:
1. Logout from application
2. Open Supabase SQL Editor (using anon key)
3. Try to query tables:
   ```sql
   SELECT * FROM "Profile";
   SELECT * FROM "Folder";
   SELECT * FROM "Prompt";
   SELECT * FROM "Tag";
   SELECT * FROM "PromptVersion";
   SELECT * FROM "_PromptToTag";
   ```
4. Expected: All queries return empty results (not errors)
5. Verify no data leakage for anonymous users

**Result**: [PASS/FAIL]
**Notes**: [TO BE FILLED]

---

## Test Results

### Summary

| Test | Result | Duration | Notes |
|------|--------|----------|-------|
| Test 1: Profile Isolation | [PASS/FAIL] | [TIME] | [NOTES] |
| Test 2: Folder Isolation | [PASS/FAIL] | [TIME] | [NOTES] |
| Test 3: Prompt Isolation | [PASS/FAIL] | [TIME] | [NOTES] |
| Test 4: Tag Isolation | [PASS/FAIL] | [TIME] | [NOTES] |
| Test 5: PromptVersion Isolation | [PASS/FAIL] | [TIME] | [NOTES] |
| Test 6: Tag Association Isolation | [PASS/FAIL] | [TIME] | [NOTES] |
| Test 7: Unauthenticated Access | [PASS/FAIL] | [TIME] | [NOTES] |

### Overall Assessment

- **Total Tests**: 7
- **Passed**: [COUNT]
- **Failed**: [COUNT]
- **Completion**: [PERCENTAGE]%

---

## Issues Found

### Critical Issues

[LIST ANY CRITICAL ISSUES FOUND]

### Medium Issues

[LIST ANY MEDIUM ISSUES FOUND]

### Minor Issues

[LIST ANY MINOR ISSUES FOUND]

---

## Conclusion

### Success Criteria Met

- [ ] Users can only access their own data
- [ ] No data leakage between users
- [ ] Per-user tag namespaces working
- [ ] Unauthenticated access returns empty results
- [ ] All CRUD operations respect RLS policies

### Recommendations

[ANY RECOMMENDATIONS FOR IMPROVEMENTS]

### Sign-off

**Tester**: [NAME]
**Date**: [DATE]
**Status**: [APPROVED/NEEDS REVISION]

---

**Test Status**: [NOT STARTED/IN PROGRESS/COMPLETE]
**PRP**: P3S1 - Row Level Security Policies
**Reference**: PRPs/P3S1-row-level-security-policies.md (Task 9)
