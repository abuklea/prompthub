-- PromptHub
-- P3S1: Row Level Security (RLS) Policies Implementation
--
-- Comprehensive RLS policies for all user-specific tables
-- Following Supabase performance best practices
--
-- Execution: Run in Supabase SQL Editor AFTER Tag schema fix
-- URL: https://supabase.com/dashboard/project/xmuysganwxygcsxwteil/sql
--
-- Performance Patterns Used:
-- - Wrapped auth.uid(): (SELECT auth.uid()) for caching
-- - Explicit roles: TO authenticated
-- - NULL checks: (SELECT auth.uid()) IS NOT NULL
-- - USING + WITH CHECK for UPDATE policies
--
-- Total Policies: 18 across 6 tables
-- - Profile: 2 policies (SELECT, UPDATE)
-- - Folder: 4 policies (SELECT, INSERT, UPDATE, DELETE)
-- - Prompt: 4 policies (SELECT, INSERT, UPDATE, DELETE)
-- - Tag: 3 policies (SELECT, INSERT, DELETE)
-- - PromptVersion: 2 policies (SELECT, INSERT)
-- - _PromptToTag: 3 policies (SELECT, INSERT, DELETE)

-- ============================================================================
-- SECTION 1: Enable RLS on All Tables
-- ============================================================================
-- CRITICAL: After enabling RLS, NO data is accessible until policies are created
-- This is expected behavior and ensures security by default

ALTER TABLE "Profile" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Folder" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Prompt" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Tag" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "PromptVersion" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "_PromptToTag" ENABLE ROW LEVEL SECURITY;

-- Verification Query:
-- SELECT tablename, rowsecurity
-- FROM pg_tables
-- WHERE schemaname = 'public'
--   AND tablename IN ('Profile', 'Folder', 'Prompt', 'Tag', 'PromptVersion', '_PromptToTag');
-- Expected: rowsecurity = true for all tables

-- ============================================================================
-- SECTION 2: Profile Policies
-- ============================================================================
-- Pattern: Profile uses id (not user_id) because id = auth.users.id
-- Users can SELECT and UPDATE only their own profile
-- INSERT handled by auth trigger (not via application)
-- DELETE not needed (handled by Supabase Auth)

-- Policy: Users can view their own profile
CREATE POLICY "profile_select_own" ON "Profile"
  FOR SELECT
  TO authenticated
  USING (
    (SELECT auth.uid()) IS NOT NULL
    AND (SELECT auth.uid())::text = id
  );

-- Policy: Users can update their own profile
CREATE POLICY "profile_update_own" ON "Profile"
  FOR UPDATE
  TO authenticated
  USING ((SELECT auth.uid())::text = id)
  WITH CHECK ((SELECT auth.uid())::text = id);

-- ============================================================================
-- SECTION 3: Folder Policies
-- ============================================================================
-- Full CRUD access for users on their own folders
-- Parent/child relationships enforced by FK constraints (not RLS)
-- ON DELETE RESTRICT on parent_id prevents deleting parent with children

-- Policy: Users can view their own folders
CREATE POLICY "folder_select_own" ON "Folder"
  FOR SELECT
  TO authenticated
  USING (
    (SELECT auth.uid()) IS NOT NULL
    AND (SELECT auth.uid())::text = user_id
  );

-- Policy: Users can create folders for themselves
CREATE POLICY "folder_insert_own" ON "Folder"
  FOR INSERT
  TO authenticated
  WITH CHECK ((SELECT auth.uid())::text = user_id);

-- Policy: Users can update their own folders
CREATE POLICY "folder_update_own" ON "Folder"
  FOR UPDATE
  TO authenticated
  USING ((SELECT auth.uid())::text = user_id)
  WITH CHECK ((SELECT auth.uid())::text = user_id);

-- Policy: Users can delete their own folders
CREATE POLICY "folder_delete_own" ON "Folder"
  FOR DELETE
  TO authenticated
  USING ((SELECT auth.uid())::text = user_id);

-- ============================================================================
-- SECTION 4: Prompt Policies
-- ============================================================================
-- Full CRUD access for users on their own prompts
-- Cascade deletes to PromptVersion handled by FK constraints
-- folder_id can be NULL (prompts not in folders)

-- Policy: Users can view their own prompts
CREATE POLICY "prompt_select_own" ON "Prompt"
  FOR SELECT
  TO authenticated
  USING (
    (SELECT auth.uid()) IS NOT NULL
    AND (SELECT auth.uid())::text = user_id
  );

-- Policy: Users can create prompts for themselves
CREATE POLICY "prompt_insert_own" ON "Prompt"
  FOR INSERT
  TO authenticated
  WITH CHECK ((SELECT auth.uid())::text = user_id);

-- Policy: Users can update their own prompts
CREATE POLICY "prompt_update_own" ON "Prompt"
  FOR UPDATE
  TO authenticated
  USING ((SELECT auth.uid())::text = user_id)
  WITH CHECK ((SELECT auth.uid())::text = user_id);

-- Policy: Users can delete their own prompts
CREATE POLICY "prompt_delete_own" ON "Prompt"
  FOR DELETE
  TO authenticated
  USING ((SELECT auth.uid())::text = user_id);

-- ============================================================================
-- SECTION 5: Tag Policies
-- ============================================================================
-- No UPDATE policy: Tag names are immutable (delete and recreate if needed)
-- Unique constraint on (name, user_id) ensures per-user tag namespaces
-- Cascade deletes to _PromptToTag handled by FK constraints

-- Policy: Users can view their own tags
CREATE POLICY "tag_select_own" ON "Tag"
  FOR SELECT
  TO authenticated
  USING (
    (SELECT auth.uid()) IS NOT NULL
    AND (SELECT auth.uid())::text = user_id
  );

-- Policy: Users can create tags for themselves
CREATE POLICY "tag_insert_own" ON "Tag"
  FOR INSERT
  TO authenticated
  WITH CHECK ((SELECT auth.uid())::text = user_id);

-- Policy: Users can delete their own tags
CREATE POLICY "tag_delete_own" ON "Tag"
  FOR DELETE
  TO authenticated
  USING ((SELECT auth.uid())::text = user_id);

-- ============================================================================
-- SECTION 6: PromptVersion Policies
-- ============================================================================
-- Access controlled through parent Prompt relationship
-- EXISTS subquery checks ownership via Prompt.user_id
-- No UPDATE/DELETE: Version history is immutable
-- CASCADE delete from Prompt handles cleanup

-- Policy: Users can view versions of their own prompts
CREATE POLICY "prompt_version_select_own" ON "PromptVersion"
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM "Prompt"
      WHERE "Prompt".id = "PromptVersion".prompt_id
        AND "Prompt".user_id = (SELECT auth.uid())::text
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
        AND "Prompt".user_id = (SELECT auth.uid())::text
    )
  );

-- ============================================================================
-- SECTION 7: _PromptToTag Junction Table Policies
-- ============================================================================
-- Column A = Prompt.id, Column B = Tag.id (Prisma convention)
-- Both sides must be owned by the user
-- Prevents users from tagging others' prompts or using others' tags

-- Policy: Users can view tag associations for their prompts
CREATE POLICY "prompt_tag_select_own" ON "_PromptToTag"
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM "Prompt"
      WHERE "Prompt".id = "A"
        AND "Prompt".user_id = (SELECT auth.uid())::text
    )
    AND EXISTS (
      SELECT 1 FROM "Tag"
      WHERE "Tag".id = "B"
        AND "Tag".user_id = (SELECT auth.uid())::text
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
        AND "Prompt".user_id = (SELECT auth.uid())::text
    )
    AND EXISTS (
      SELECT 1 FROM "Tag"
      WHERE "Tag".id = "B"
        AND "Tag".user_id = (SELECT auth.uid())::text
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
        AND "Prompt".user_id = (SELECT auth.uid())::text
    )
    AND EXISTS (
      SELECT 1 FROM "Tag"
      WHERE "Tag".id = "B"
        AND "Tag".user_id = (SELECT auth.uid())::text
    )
  );

-- ============================================================================
-- VERIFICATION QUERIES
-- ============================================================================

-- Verify all policies created:
-- SELECT schemaname, tablename, policyname, cmd, roles
-- FROM pg_policies
-- WHERE schemaname = 'public'
-- ORDER BY tablename, policyname;

-- Verify RLS enabled:
-- SELECT tablename, rowsecurity
-- FROM pg_tables
-- WHERE schemaname = 'public'
--   AND tablename IN ('Profile', 'Folder', 'Prompt', 'Tag', 'PromptVersion', '_PromptToTag');

-- ============================================================================
-- IMPLEMENTATION COMPLETE
-- ============================================================================
-- Next Steps:
-- 1. Execute this SQL in Supabase SQL Editor
-- 2. Run verification queries to confirm success
-- 3. Proceed to multi-user validation testing (P3S1T9)
-- 4. Run performance validation (P3S1T10)
