# PromptHub
## P3S1: Row Level Security (RLS) Policies Implementation

| `Title` | `Created` | `Last modified` |
|---------|-----------|-----------------|
| P3S1: Row Level Security (RLS) Policies Implementation | 06/11/2025 20:09 GMT+10 | 06/11/2025 20:09 GMT+10 |

## Table of Contents
- [Goal](#goal)
- [Why](#why)
- [What](#what)
- [Success Criteria](#success-criteria)
- [All Needed Context](#all-needed-context)
- [Current Codebase Structure](#current-codebase-structure)
- [Desired Codebase Structure](#desired-codebase-structure)
- [Known Gotchas & Library Quirks](#known-gotchas--library-quirks)
- [Implementation Blueprint](#implementation-blueprint)
- [Data Models and Structure](#data-models-and-structure)
- [Task List](#task-list)
- [Task Details with Pseudocode](#task-details-with-pseudocode)
- [Integration Points](#integration-points)
- [Validation Loop](#validation-loop)
- [Final Validation Checklist](#final-validation-checklist)
- [Anti-Patterns to Avoid](#anti-patterns-to-avoid)

---

## Goal

Implement comprehensive Row Level Security (RLS) policies for all user-specific tables in the PromptHub database to ensure complete data isolation at the database level. Users must only be able to perform CRUD operations on their own data, providing defense-in-depth security that protects against unauthorized access even if application-level checks fail.

## Why

- **Security Foundation**: RLS is a critical security layer that enforces data isolation at the PostgreSQL level, independent of application code
- **Defense in Depth**: Protects user data even if application code has vulnerabilities or is bypassed through direct database access
- **Compliance**: Essential for multi-tenant applications to prevent data leaks between users
- **Trust**: Users must trust that their prompts and data are completely private and isolated
- **Prerequisite**: Phase 2 authentication is complete; this security layer must be in place before building folder/prompt management features

## What

Implement PostgreSQL RLS policies for all tables containing user-specific data:
- **Profile**: User profile data (linked to Supabase auth.users)
- **Folder**: User's folder hierarchy
- **Prompt**: User's prompt content and metadata
- **Tag**: User's custom tags
- **PromptVersion**: Version history for prompts
- **_PromptToTag**: Junction table linking prompts to tags

### Success Criteria

- ✅ RLS enabled on all user-specific tables
- ✅ Comprehensive policies for SELECT, INSERT, UPDATE, DELETE operations
- ✅ Policies use performance-optimized patterns (wrapped auth.uid(), explicit roles)
- ✅ Tag schema fixed to support per-user tag namespaces
- ✅ Multi-user validation confirms complete data isolation
- ✅ No performance degradation (indexes utilized correctly)
- ✅ All policies follow Supabase best practices

---

## All Needed Context

### Documentation & References

```yaml
# CRITICAL - Read these for implementation context

- url: https://supabase.com/docs/guides/database/postgres/row-level-security
  why: Official Supabase RLS documentation with performance best practices
  critical: |
    - Always wrap auth.uid() in SELECT: (select auth.uid())
    - Specify role with TO authenticated/anon
    - Check for NULL: auth.uid() IS NOT NULL
    - Add indexes on user_id columns (already present)
    - Use USING clause for SELECT/DELETE, WITH CHECK for INSERT/UPDATE

- file: /home/allan/projects/PromptHub/prisma/schema.prisma
  why: Current database schema showing all tables, relationships, and indexes
  critical: |
    - Profile.id is auth.users.id (no separate user_id)
    - All other tables have user_id FK to Profile
    - Tag has UNIQUE constraint on name (MUST FIX - should be per-user)
    - Indexes already exist on user_id columns

- file: /home/allan/projects/PromptHub/src/features/auth/actions.ts
  why: Shows how authentication works and how user sessions are established
  critical: |
    - Uses Supabase auth.signUp(), auth.signInWithPassword()
    - Profile creation handled in ensureProfileExists()
    - Auth context available via (select auth.uid())

- file: /home/allan/projects/PromptHub/prisma/migrations/20251106035636_project_setup/migration.sql
  why: Initial database schema showing all table structures and constraints
  critical: Shows existing indexes and foreign key relationships

- doc: Supabase RLS Performance Guide
  url: https://supabase.com/docs/guides/database/postgres/row-level-security#rls-performance-recommendations
  why: Critical performance patterns to avoid slow policies
  critical: |
    - Call functions with select: (select auth.uid()) instead of auth.uid()
    - Add indexes on filter columns (already present)
    - Specify roles in policies (TO authenticated)
    - Minimize joins in policies
```

---

## Current Codebase Structure

```
/home/allan/projects/PromptHub/
├── prisma/
│   ├── schema.prisma              # Database schema with all models
│   └── migrations/                # Existing migrations
│       ├── 20251106035636_project_setup/
│       │   └── migration.sql      # Initial schema
│       └── 20251106092026_fix_profile_schema/
│           └── migration.sql      # Profile schema fix
├── src/
│   ├── features/
│   │   ├── auth/
│   │   │   ├── actions.ts         # Auth server actions
│   │   │   └── schemas.ts         # Auth validation schemas
│   │   ├── folders/
│   │   │   └── actions.ts         # Folder server actions
│   │   └── prompts/
│   │       └── actions.ts         # Prompt server actions
│   ├── lib/
│   │   ├── db.ts                  # Prisma client singleton
│   │   └── supabase/
│   │       └── server.ts          # Supabase server client
│   └── app/
│       ├── (app)/                 # Protected routes
│       └── (auth)/                # Auth routes
└── wip/                           # Working files directory
```

---

## Desired Codebase Structure

```
/home/allan/projects/PromptHub/
├── prisma/
│   └── migrations/
│       └── [NEW] 20251106_fix_tag_unique_constraint/
│           └── migration.sql      # Fix Tag unique constraint
├── wip/
│   ├── [NEW] P3S1-rls-policies.sql          # All RLS policies (main deliverable)
│   ├── [NEW] P3S1-tag-schema-fix.sql        # Tag schema migration
│   ├── [NEW] P3S1-rls-validation-test.md    # Multi-user test results
│   └── [NEW] P3S1-rls-performance-test.md   # EXPLAIN ANALYZE results
└── [No application code changes needed - all database-level SQL]
```

---

## Known Gotchas & Library Quirks

```sql
-- CRITICAL: Supabase RLS Performance Patterns

-- ❌ BAD - Function called for every row
CREATE POLICY "bad_policy" ON prompts
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- ✅ GOOD - Function called once per query
CREATE POLICY "good_policy" ON prompts
  FOR SELECT
  TO authenticated
  USING ((SELECT auth.uid()) = user_id);

-- CRITICAL: Always check for NULL to be explicit
-- ❌ BAD - Silently fails for unauthenticated users
USING (auth.uid() = user_id)

-- ✅ GOOD - Explicit authentication check
USING ((SELECT auth.uid()) IS NOT NULL AND (SELECT auth.uid()) = user_id)

-- CRITICAL: UPDATE policies need both USING and WITH CHECK
CREATE POLICY "update_policy" ON prompts
  FOR UPDATE
  TO authenticated
  USING ((SELECT auth.uid()) = user_id)      -- Check existing row ownership
  WITH CHECK ((SELECT auth.uid()) = user_id);  -- Check new row ownership

-- CRITICAL: Profile table uses id = auth.uid() directly
-- Profile.id IS the Supabase auth.users.id, no separate user_id column
CREATE POLICY "profile_select" ON "Profile"
  FOR SELECT
  TO authenticated
  USING ((SELECT auth.uid()) = id);  -- Note: id, not user_id

-- GOTCHA: Tag schema issue
-- Current: Tag.name has UNIQUE constraint (global namespace)
-- Problem: Two users can't have same tag name
-- Solution: Change to composite unique (name, user_id)
```

```yaml
# Supabase/Prisma Quirks:
- Supabase Auth provides auth.uid() function in database context
- RLS policies are checked BEFORE application code
- Empty results (not errors) indicate RLS blocking access
- Service role key bypasses RLS (never use in client code)
- Policies execute with role of the JWT (authenticated/anon)
- Indexes on user_id are critical for RLS performance
```

---

## Implementation Blueprint

### Data Models and Structure

The database schema is already defined in `prisma/schema.prisma`. Key relationships:

```prisma
Profile (id = auth.users.id)
  ├── Folder (user_id FK)
  │   ├── children (recursive self-join)
  │   └── Prompt (folder_id FK)
  ├── Prompt (user_id FK)
  │   ├── PromptVersion (prompt_id FK)
  │   └── Tag (many-to-many via _PromptToTag)
  └── Tag (user_id)
```

**Critical Insight**: Security flows from Profile → all child tables via user_id. PromptVersion and _PromptToTag inherit security through their parent relationships.

---

## Task List

```yaml
Task 1: Fix Tag Schema Unique Constraint
  Description: Create migration to change Tag.name unique constraint to composite (name, user_id)
  File: wip/P3S1-tag-schema-fix.sql
  Why: Current schema prevents multiple users from having same tag names

Task 2: Enable RLS on All Tables
  Description: Enable row level security on Profile, Folder, Prompt, Tag, PromptVersion, _PromptToTag
  File: wip/P3S1-rls-policies.sql (section 1)
  Why: Tables are fully accessible without RLS - critical security issue

Task 3: Create Profile RLS Policies
  Description: Implement SELECT and UPDATE policies for Profile table
  File: wip/P3S1-rls-policies.sql (section 2)
  Why: Users need to read/update their own profile only

Task 4: Create Folder RLS Policies
  Description: Implement SELECT, INSERT, UPDATE, DELETE policies for Folder table
  File: wip/P3S1-rls-policies.sql (section 3)
  Why: Users need full CRUD on their folder hierarchy

Task 5: Create Prompt RLS Policies
  Description: Implement SELECT, INSERT, UPDATE, DELETE policies for Prompt table
  File: wip/P3S1-rls-policies.sql (section 4)
  Why: Users need full CRUD on their prompts

Task 6: Create Tag RLS Policies
  Description: Implement SELECT, INSERT, DELETE policies for Tag table
  File: wip/P3S1-rls-policies.sql (section 5)
  Why: Users need to manage their tags (UPDATE rarely needed due to many-to-many)

Task 7: Create PromptVersion RLS Policies
  Description: Implement SELECT and INSERT policies for PromptVersion table
  File: wip/P3S1-rls-policies.sql (section 6)
  Why: Version history access controlled through parent Prompt

Task 8: Create _PromptToTag Junction Table Policies
  Description: Implement SELECT, INSERT, DELETE policies for _PromptToTag table
  File: wip/P3S1-rls-policies.sql (section 7)
  Why: Tag associations controlled through both Prompt and Tag ownership

Task 9: Multi-User Validation Testing
  Description: Test with multiple users to validate complete data isolation
  File: wip/P3S1-rls-validation-test.md
  Why: Must verify users cannot access each other's data

Task 10: Performance Validation
  Description: Run EXPLAIN ANALYZE on queries to verify indexes are used
  File: wip/P3S1-rls-performance-test.md
  Why: Ensure RLS policies don't cause performance degradation
```

---

## Task Details with Pseudocode

### Task 1: Fix Tag Schema Unique Constraint

```sql
-- File: wip/P3S1-tag-schema-fix.sql
-- CRITICAL: Must run this BEFORE creating RLS policies

-- Step 1: Drop the existing global unique constraint
ALTER TABLE "Tag" DROP CONSTRAINT "Tag_name_key";

-- Step 2: Create composite unique constraint (per-user unique tags)
ALTER TABLE "Tag" ADD CONSTRAINT "Tag_name_user_id_key"
  UNIQUE ("name", "user_id");

-- Explanation:
-- This allows multiple users to have tags with the same name
-- Each user has their own namespace for tag names
-- Example: User A and User B can both have a "work" tag
```

### Task 2: Enable RLS on All Tables

```sql
-- File: wip/P3S1-rls-policies.sql
-- Section 1: Enable RLS

-- CRITICAL: After enabling RLS, NO data is accessible until policies are created
-- This is expected behavior and ensures security by default

ALTER TABLE "Profile" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Folder" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Prompt" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Tag" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "PromptVersion" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "_PromptToTag" ENABLE ROW LEVEL SECURITY;

-- Verification: Check RLS is enabled
-- SELECT tablename, rowsecurity
-- FROM pg_tables
-- WHERE schemaname = 'public';
-- Expected: rowsecurity = true for all tables
```

### Task 3: Create Profile RLS Policies

```sql
-- File: wip/P3S1-rls-policies.sql
-- Section 2: Profile Policies

-- PATTERN: Profile uses id (not user_id) because id = auth.users.id
-- Users can SELECT and UPDATE only their own profile
-- INSERT handled by auth trigger (not via application)
-- DELETE not needed (handled by Supabase Auth)

-- Policy: Users can view their own profile
CREATE POLICY "profile_select_own" ON "Profile"
  FOR SELECT
  TO authenticated
  USING (
    (SELECT auth.uid()) IS NOT NULL
    AND (SELECT auth.uid()) = id
  );

-- Policy: Users can update their own profile
CREATE POLICY "profile_update_own" ON "Profile"
  FOR UPDATE
  TO authenticated
  USING ((SELECT auth.uid()) = id)
  WITH CHECK ((SELECT auth.uid()) = id);

-- Explanation:
-- USING: Checks if existing row belongs to user (required for UPDATE)
-- WITH CHECK: Ensures updated row still belongs to user
-- No INSERT policy: Profile creation handled by trigger/application
-- No DELETE policy: User deletion handled by Supabase Auth
```

### Task 4: Create Folder RLS Policies

```sql
-- File: wip/P3S1-rls-policies.sql
-- Section 3: Folder Policies

-- Policy: Users can view their own folders
CREATE POLICY "folder_select_own" ON "Folder"
  FOR SELECT
  TO authenticated
  USING (
    (SELECT auth.uid()) IS NOT NULL
    AND (SELECT auth.uid()) = user_id
  );

-- Policy: Users can create folders for themselves
CREATE POLICY "folder_insert_own" ON "Folder"
  FOR INSERT
  TO authenticated
  WITH CHECK ((SELECT auth.uid()) = user_id);

-- Policy: Users can update their own folders
CREATE POLICY "folder_update_own" ON "Folder"
  FOR UPDATE
  TO authenticated
  USING ((SELECT auth.uid()) = user_id)
  WITH CHECK ((SELECT auth.uid()) = user_id);

-- Policy: Users can delete their own folders
CREATE POLICY "folder_delete_own" ON "Folder"
  FOR DELETE
  TO authenticated
  USING ((SELECT auth.uid()) = user_id);

-- Explanation:
-- Full CRUD access for users on their own folders
-- Parent/child relationships enforced by FK constraints (not RLS)
-- ON DELETE RESTRICT on parent_id prevents deleting parent with children
```

### Task 5: Create Prompt RLS Policies

```sql
-- File: wip/P3S1-rls-policies.sql
-- Section 4: Prompt Policies

-- Policy: Users can view their own prompts
CREATE POLICY "prompt_select_own" ON "Prompt"
  FOR SELECT
  TO authenticated
  USING (
    (SELECT auth.uid()) IS NOT NULL
    AND (SELECT auth.uid()) = user_id
  );

-- Policy: Users can create prompts for themselves
CREATE POLICY "prompt_insert_own" ON "Prompt"
  FOR INSERT
  TO authenticated
  WITH CHECK ((SELECT auth.uid()) = user_id);

-- Policy: Users can update their own prompts
CREATE POLICY "prompt_update_own" ON "Prompt"
  FOR UPDATE
  TO authenticated
  USING ((SELECT auth.uid()) = user_id)
  WITH CHECK ((SELECT auth.uid()) = user_id);

-- Policy: Users can delete their own prompts
CREATE POLICY "prompt_delete_own" ON "Prompt"
  FOR DELETE
  TO authenticated
  USING ((SELECT auth.uid()) = user_id);

-- Explanation:
-- Full CRUD access for users on their own prompts
-- Cascade deletes to PromptVersion handled by FK constraints
-- folder_id can be NULL (prompts not in folders)
```

### Task 6: Create Tag RLS Policies

```sql
-- File: wip/P3S1-rls-policies.sql
-- Section 5: Tag Policies

-- Policy: Users can view their own tags
CREATE POLICY "tag_select_own" ON "Tag"
  FOR SELECT
  TO authenticated
  USING (
    (SELECT auth.uid()) IS NOT NULL
    AND (SELECT auth.uid()) = user_id
  );

-- Policy: Users can create tags for themselves
CREATE POLICY "tag_insert_own" ON "Tag"
  FOR INSERT
  TO authenticated
  WITH CHECK ((SELECT auth.uid()) = user_id);

-- Policy: Users can delete their own tags
CREATE POLICY "tag_delete_own" ON "Tag"
  FOR DELETE
  TO authenticated
  USING ((SELECT auth.uid()) = user_id);

-- Explanation:
-- No UPDATE policy: Tag names are immutable (delete and recreate if needed)
-- Unique constraint on (name, user_id) ensures per-user tag namespaces
-- Cascade deletes to _PromptToTag handled by FK constraints
```

### Task 7: Create PromptVersion RLS Policies

```sql
-- File: wip/P3S1-rls-policies.sql
-- Section 6: PromptVersion Policies

-- Policy: Users can view versions of their own prompts
CREATE POLICY "prompt_version_select_own" ON "PromptVersion"
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM "Prompt"
      WHERE "Prompt".id = "PromptVersion".prompt_id
        AND "Prompt".user_id = (SELECT auth.uid())
    )
  );

-- Policy: Users can create versions for their own prompts
CREATE POLICY "prompt_version_insert_own" ON "PromptVersion"
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM "Prompt"
      WHERE "Prompt".id = prompt_id
        AND "Prompt".user_id = (SELECT auth.uid())
    )
  );

-- Explanation:
-- Access controlled through parent Prompt relationship
-- EXISTS subquery checks ownership via Prompt.user_id
-- No UPDATE/DELETE: Version history is immutable
-- CASCADE delete from Prompt handles cleanup
```

### Task 8: Create _PromptToTag Junction Table Policies

```sql
-- File: wip/P3S1-rls-policies.sql
-- Section 7: _PromptToTag Junction Table Policies

-- Policy: Users can view tag associations for their prompts
CREATE POLICY "prompt_tag_select_own" ON "_PromptToTag"
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM "Prompt"
      WHERE "Prompt".id = "A"
        AND "Prompt".user_id = (SELECT auth.uid())
    )
    AND EXISTS (
      SELECT 1 FROM "Tag"
      WHERE "Tag".id = "B"
        AND "Tag".user_id = (SELECT auth.uid())
    )
  );

-- Policy: Users can create associations between their prompts and tags
CREATE POLICY "prompt_tag_insert_own" ON "_PromptToTag"
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM "Prompt"
      WHERE "Prompt".id = "A"
        AND "Prompt".user_id = (SELECT auth.uid())
    )
    AND EXISTS (
      SELECT 1 FROM "Tag"
      WHERE "Tag".id = "B"
        AND "Tag".user_id = (SELECT auth.uid())
    )
  );

-- Policy: Users can delete associations between their prompts and tags
CREATE POLICY "prompt_tag_delete_own" ON "_PromptToTag"
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM "Prompt"
      WHERE "Prompt".id = "A"
        AND "Prompt".user_id = (SELECT auth.uid())
    )
    AND EXISTS (
      SELECT 1 FROM "Tag"
      WHERE "Tag".id = "B"
        AND "Tag".user_id = (SELECT auth.uid())
    )
  );

-- Explanation:
-- Column A = Prompt.id, Column B = Tag.id (Prisma convention)
-- Both sides must be owned by the user
-- Prevents users from tagging others' prompts or using others' tags
```

---

## Integration Points

```yaml
DATABASE:
  - migration: Create new migration for Tag schema fix
    command: npx prisma migrate dev --name fix_tag_unique_constraint
    file: wip/P3S1-tag-schema-fix.sql

  - sql_execution: Run RLS policies in Supabase SQL Editor
    command: Execute wip/P3S1-rls-policies.sql in Supabase dashboard
    url: https://supabase.com/dashboard/project/xmuysganwxygcsxwteil/sql
    note: Cannot use Prisma migrate for RLS policies - must use Supabase SQL Editor

SUPABASE:
  - dashboard: https://supabase.com/dashboard/project/xmuysganwxygcsxwteil
  - sql_editor: Use SQL Editor to execute RLS policy scripts
  - table_editor: Verify RLS enabled status on each table
  - auth: Create test users for validation testing

APPLICATION:
  - no_changes: RLS is database-level, no application code changes needed
  - validation: Test existing auth flow works correctly with RLS enabled
  - testing: Use existing test user (allan@formationmedia.net) + create new test user
```

---

## Validation Loop

### Level 1: SQL Syntax Validation

```bash
# Step 1: Validate SQL syntax before execution
# Copy SQL files to local and check syntax

# For Tag schema fix:
cat wip/P3S1-tag-schema-fix.sql

# For RLS policies:
cat wip/P3S1-rls-policies.sql

# Expected: No syntax errors, valid PostgreSQL SQL
# If errors: Fix syntax issues before proceeding
```

### Level 2: RLS Policy Deployment

```bash
# Step 1: Connect to Supabase
# Login to Supabase dashboard: https://supabase.com/dashboard/project/xmuysganwxygcsxwteil

# Step 2: Execute Tag schema fix
# Navigate to SQL Editor
# Paste contents of wip/P3S1-tag-schema-fix.sql
# Run query
# Expected: Success message, no errors

# Step 3: Verify schema fix
# Run in SQL Editor:
SELECT conname, contype
FROM pg_constraint
WHERE conrelid = 'Tag'::regclass;

# Expected: See "Tag_name_user_id_key" unique constraint

# Step 4: Execute RLS policies
# Paste contents of wip/P3S1-rls-policies.sql
# Run query
# Expected: All policies created successfully

# Step 5: Verify RLS enabled
SELECT tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN ('Profile', 'Folder', 'Prompt', 'Tag', 'PromptVersion', '_PromptToTag');

# Expected: rowsecurity = true for all tables

# Step 6: List all policies
SELECT schemaname, tablename, policyname, cmd, roles
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;

# Expected: All policies created and properly configured
```

### Level 3: Multi-User Validation Testing

```bash
# Create test document: wip/P3S1-rls-validation-test.md

# Test Setup:
# User A: allan@formationmedia.net (existing)
# User B: test@example.com (create new)

# Test Cases:

## Test 1: Profile Isolation
# 1. Login as User A
# 2. Check: Can SELECT own profile
# 3. Check: Cannot SELECT User B's profile
# 4. Login as User B
# 5. Check: Can SELECT own profile
# 6. Check: Cannot SELECT User A's profile

## Test 2: Folder Isolation
# 1. Login as User A, create folder "Personal"
# 2. Login as User B, create folder "Personal"
# 3. Login as User A
# 4. Check: Can SELECT own "Personal" folder
# 5. Check: Cannot SELECT User B's "Personal" folder
# 6. Check: Can UPDATE/DELETE own folder
# 7. Check: Cannot UPDATE/DELETE User B's folder

## Test 3: Prompt Isolation
# 1. Login as User A, create prompt "My Secret Prompt"
# 2. Login as User B, create prompt "My Secret Prompt"
# 3. Login as User A
# 4. Check: Can SELECT own prompt
# 5. Check: Cannot SELECT User B's prompt
# 6. Check: Can UPDATE/DELETE own prompt
# 7. Check: Cannot UPDATE/DELETE User B's prompt

## Test 4: Tag Isolation
# 1. Login as User A, create tag "work"
# 2. Login as User B, create tag "work"
# 3. Verify: Both succeed (per-user unique constraint)
# 4. Login as User A
# 5. Check: Can SELECT own "work" tag
# 6. Check: Cannot SELECT User B's "work" tag

## Test 5: PromptVersion Isolation
# 1. Login as User A, save prompt version
# 2. Login as User B, save prompt version
# 3. Login as User A
# 4. Check: Can SELECT own prompt versions
# 5. Check: Cannot SELECT User B's prompt versions

## Test 6: Tag Association Isolation
# 1. Login as User A, tag prompt with "work"
# 2. Login as User B, try to tag User A's prompt
# 3. Check: User B's attempt fails (cannot use others' prompts)
# 4. Login as User A, try to use User B's tag
# 5. Check: User A's attempt fails (cannot use others' tags)

## Test 7: Unauthenticated Access
# 1. Logout (no auth token)
# 2. Try to SELECT from any table
# 3. Expected: Empty results (not errors)

# Document results in: wip/P3S1-rls-validation-test.md
```

### Level 4: Performance Validation

```sql
-- Create test document: wip/P3S1-rls-performance-test.md

-- Test 1: Verify indexes are used for Folder queries
EXPLAIN ANALYZE
SELECT * FROM "Folder"
WHERE user_id = 'test-user-id';

-- Expected:
-- Should use "Folder_user_id_parent_id_idx" index
-- Execution time should be < 5ms for small dataset

-- Test 2: Verify indexes are used for Prompt queries
EXPLAIN ANALYZE
SELECT * FROM "Prompt"
WHERE user_id = 'test-user-id';

-- Expected:
-- Should use "Prompt_user_id_folder_id_idx" index
-- Execution time should be < 5ms for small dataset

-- Test 3: Verify indexes are used for Tag queries
EXPLAIN ANALYZE
SELECT * FROM "Tag"
WHERE user_id = 'test-user-id';

-- Expected:
-- Should use "Tag_user_id_idx" index
-- Execution time should be < 5ms for small dataset

-- Test 4: Verify wrapped auth.uid() performance
EXPLAIN ANALYZE
SELECT * FROM "Prompt"
WHERE user_id = (SELECT auth.uid());

-- Expected:
-- InitPlan showing cached auth.uid() call (called once, not per row)
-- Execution time similar to direct user_id query

-- Document results in: wip/P3S1-rls-performance-test.md
-- Include query plans, execution times, and index usage confirmation
```

---

## Final Validation Checklist

- [ ] Tag unique constraint changed to composite (name, user_id)
- [ ] RLS enabled on all 6 tables (Profile, Folder, Prompt, Tag, PromptVersion, _PromptToTag)
- [ ] All policies created successfully (20+ policies total)
- [ ] All policies use wrapped auth.uid(): `(SELECT auth.uid())`
- [ ] All policies specify role: `TO authenticated`
- [ ] All policies check for NULL: `(SELECT auth.uid()) IS NOT NULL`
- [ ] UPDATE policies have both USING and WITH CHECK clauses
- [ ] Multi-user testing confirms complete data isolation
- [ ] No user can access another user's data
- [ ] Unauthenticated requests return empty results (not errors)
- [ ] Performance testing confirms indexes are used
- [ ] EXPLAIN ANALYZE shows InitPlan for auth.uid() (cached per-statement)
- [ ] Query execution times are acceptable (< 10ms for small datasets)
- [ ] All SQL files documented in wip/ directory:
  - [ ] wip/P3S1-tag-schema-fix.sql
  - [ ] wip/P3S1-rls-policies.sql
  - [ ] wip/P3S1-rls-validation-test.md
  - [ ] wip/P3S1-rls-performance-test.md

---

## Anti-Patterns to Avoid

```sql
-- ❌ Don't use unwrapped auth.uid() - causes performance issues
CREATE POLICY "bad" ON prompts
  USING (auth.uid() = user_id);  -- Called for EVERY row

-- ✅ Always wrap in SELECT for caching
CREATE POLICY "good" ON prompts
  USING ((SELECT auth.uid()) = user_id);  -- Called ONCE per query

-- ❌ Don't omit explicit NULL check
CREATE POLICY "bad" ON prompts
  USING ((SELECT auth.uid()) = user_id);  -- Silently fails for anonymous

-- ✅ Always check for authentication
CREATE POLICY "good" ON prompts
  USING ((SELECT auth.uid()) IS NOT NULL AND (SELECT auth.uid()) = user_id);

-- ❌ Don't omit role specification
CREATE POLICY "bad" ON prompts
  FOR SELECT
  USING ((SELECT auth.uid()) = user_id);  -- Runs for anonymous users too

-- ✅ Always specify the role
CREATE POLICY "good" ON prompts
  FOR SELECT
  TO authenticated
  USING ((SELECT auth.uid()) = user_id);

-- ❌ Don't use USING without WITH CHECK for UPDATE
CREATE POLICY "bad" ON prompts
  FOR UPDATE
  USING ((SELECT auth.uid()) = user_id);  -- Only checks existing row

-- ✅ Use both USING and WITH CHECK for UPDATE
CREATE POLICY "good" ON prompts
  FOR UPDATE
  USING ((SELECT auth.uid()) = user_id)      -- Check existing row
  WITH CHECK ((SELECT auth.uid()) = user_id); -- Check updated row

-- ❌ Don't use complex joins in policies
CREATE POLICY "bad" ON prompts
  USING (
    user_id IN (
      SELECT p.user_id FROM "Profile" p
      JOIN "Folder" f ON f.user_id = p.id
      WHERE f.id = folder_id  -- Joins back to prompts table!
    )
  );

-- ✅ Keep policies simple and direct
CREATE POLICY "good" ON prompts
  USING ((SELECT auth.uid()) = user_id);

-- ❌ Don't bypass testing with service role key
-- Never use service role key in application code
-- Never skip multi-user testing

-- ✅ Test thoroughly with actual user accounts
-- Create real test users in Supabase Auth
-- Test all CRUD operations for both users
-- Verify complete data isolation
```

---

## Implementation Confidence Score

**Score: 8/10**

**Reasoning:**
- ✅ **Clear requirements**: RLS policies are well-documented in Supabase docs
- ✅ **Straightforward SQL**: No complex application logic, pure database policies
- ✅ **Good examples**: Supabase docs provide excellent policy examples
- ✅ **Existing schema**: Database schema already in place with proper indexes
- ✅ **Performance patterns**: Clear optimization guidelines provided
- ⚠️ **Testing requirement**: Requires creating test users and thorough validation
- ⚠️ **Schema fix needed**: Must fix Tag unique constraint first
- ⚠️ **Manual SQL execution**: Cannot use Prisma migrations for RLS policies

**Risk Mitigation:**
- SQL syntax is standard PostgreSQL - low error risk
- Performance patterns are well-documented and tested by Supabase
- Testing checklist is comprehensive and executable
- Rollback is simple: DROP POLICY statements if needed

**Expected Issues:**
- May need to iterate on policy syntax if initial attempt has errors
- Testing requires creating and managing multiple user accounts
- Must use Supabase SQL Editor (cannot automate via Prisma)

---

**PRP Status**: COMPLETE
**PRP ID**: P3S1
**Phase**: Phase 3 - Data Security and Core Data Access
**Dependencies**: Phase 2 (Authentication) must be complete
**Next PRP**: P4S1 - Folder Data Access Server Actions
**Archon Project**: PromptHub (d449f266-1f36-47ad-bd2d-30f1a0f5e999)
**Estimated Implementation Time (FTE)**: 3-4 hours
