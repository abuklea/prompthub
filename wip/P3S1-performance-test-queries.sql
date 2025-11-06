-- PromptHub P3S1: Performance Validation Test Queries
-- Execute these queries in Supabase SQL Editor to verify RLS performance
-- Date: 06/11/2025 20:43 GMT+10

-- ============================================================================
-- TEST 1: Folder Query Performance
-- ============================================================================
-- Objective: Verify Folder_user_id_parent_id_idx is used
-- Expected: Index Scan, execution time < 10ms

EXPLAIN ANALYZE
SELECT * FROM "Folder"
WHERE user_id = (SELECT auth.uid()::text);

-- Expected output indicators:
-- - "InitPlan" showing auth.uid() cached (called once)
-- - "Index Scan using Folder_user_id_parent_id_idx"
-- - Execution Time: < 10ms for small dataset

-- ============================================================================
-- TEST 2: Prompt Query Performance
-- ============================================================================
-- Objective: Verify Prompt_user_id_folder_id_idx is used
-- Expected: Index Scan, execution time < 10ms

EXPLAIN ANALYZE
SELECT * FROM "Prompt"
WHERE user_id = (SELECT auth.uid()::text);

-- Expected output indicators:
-- - "InitPlan" showing auth.uid() cached
-- - "Index Scan using Prompt_user_id_folder_id_idx"
-- - Execution Time: < 10ms for small dataset

-- ============================================================================
-- TEST 3: Tag Query Performance
-- ============================================================================
-- Objective: Verify Tag_user_id_idx is used
-- Expected: Index Scan, execution time < 10ms

EXPLAIN ANALYZE
SELECT * FROM "Tag"
WHERE user_id = (SELECT auth.uid()::text);

-- Expected output indicators:
-- - "InitPlan" showing auth.uid() cached
-- - "Index Scan using Tag_user_id_idx"
-- - Execution Time: < 10ms for small dataset

-- ============================================================================
-- TEST 4: RLS Policy Performance (Folder with RLS)
-- ============================================================================
-- Objective: Verify RLS policy doesn't cause performance degradation
-- Expected: Similar performance to direct query

EXPLAIN ANALYZE
SELECT * FROM "Folder";

-- This query goes through RLS policies
-- Compare execution time with TEST 1
-- Should be similar (RLS adds minimal overhead with proper indexes)

-- ============================================================================
-- TEST 5: Complex Query with JOIN (PromptVersion)
-- ============================================================================
-- Objective: Verify EXISTS subquery in RLS policy performs well
-- Expected: Nested Loop with index usage

EXPLAIN ANALYZE
SELECT * FROM "PromptVersion";

-- Expected output indicators:
-- - Nested Loop with Index Scans
-- - Subquery executed efficiently
-- - Execution Time: < 20ms for small dataset

-- ============================================================================
-- TEST 6: Junction Table Performance (_PromptToTag)
-- ============================================================================
-- Objective: Verify dual EXISTS subqueries perform well
-- Expected: Multiple Nested Loops with index usage

EXPLAIN ANALYZE
SELECT * FROM "_PromptToTag";

-- Expected output indicators:
-- - Multiple nested loops (one per EXISTS clause)
-- - Index scans on both Prompt and Tag tables
-- - Execution Time: < 20ms for small dataset

-- ============================================================================
-- VERIFICATION QUERIES
-- ============================================================================

-- Verify all indexes exist
SELECT
    tablename,
    indexname,
    indexdef
FROM pg_indexes
WHERE schemaname = 'public'
  AND tablename IN ('Profile', 'Folder', 'Prompt', 'Tag', 'PromptVersion', '_PromptToTag')
ORDER BY tablename, indexname;

-- Expected: See all user_id indexes listed

-- Verify RLS enabled on all tables
SELECT
    tablename,
    rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN ('Profile', 'Folder', 'Prompt', 'Tag', 'PromptVersion', '_PromptToTag');

-- Expected: All tables show rowsecurity = true

-- Count policies
SELECT
    tablename,
    COUNT(*) as policy_count
FROM pg_policies
WHERE schemaname = 'public'
GROUP BY tablename
ORDER BY tablename;

-- Expected:
-- Profile: 2 policies
-- Folder: 4 policies
-- Prompt: 4 policies
-- Tag: 3 policies
-- PromptVersion: 2 policies
-- _PromptToTag: 3 policies
-- TOTAL: 18 policies
