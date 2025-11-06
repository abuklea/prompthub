-- PromptHub
-- P3S1 Task 1: Fix Tag Schema Unique Constraint
--
-- CRITICAL: Must run this BEFORE creating RLS policies
--
-- Problem: Current Tag.name has global UNIQUE constraint
-- Solution: Change to composite UNIQUE (name, user_id) for per-user tag namespaces
--
-- Execution: Run in Supabase SQL Editor
-- URL: https://supabase.com/dashboard/project/xmuysganwxygcsxwteil/sql

-- Step 1: Drop the existing global unique index/constraint
-- Note: Prisma creates this as a UNIQUE INDEX, not a named constraint
DROP INDEX IF EXISTS "Tag_name_key";

-- Step 2: Create composite unique constraint (per-user unique tags)
ALTER TABLE "Tag" ADD CONSTRAINT "Tag_name_user_id_key"
  UNIQUE ("name", "user_id");

-- Explanation:
-- This allows multiple users to have tags with the same name
-- Each user has their own namespace for tag names
-- Example: User A and User B can both have a "work" tag

-- Verification Query (run after migration):
-- SELECT conname, contype
-- FROM pg_constraint
-- WHERE conrelid = 'Tag'::regclass;
-- Expected: See "Tag_name_user_id_key" unique constraint
