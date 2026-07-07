-- Full-text search fix.
--
-- Problem: "Prompt"."content_tsv" was a plain nullable tsvector column that was
-- never populated (no trigger / no generated expression), so the existing GIN
-- index "Prompt_content_tsv_idx" indexed only NULLs. The search query recomputed
-- to_tsvector() inline, forcing a sequential scan.
--
-- Fix: recreate content_tsv as a STORED generated column derived from title +
-- content, so Postgres keeps it in sync automatically and the GIN index becomes
-- usable by `content_tsv @@ to_tsquery(...)` queries.
--
-- Notes:
-- - Prisma models this column as Unsupported("tsvector"), so it is never written
--   by the client (generated columns also reject explicit writes).
-- - Safe to run on existing data: the generated values are backfilled on ADD COLUMN.

DROP INDEX IF EXISTS "Prompt_content_tsv_idx";

ALTER TABLE "Prompt" DROP COLUMN IF EXISTS "content_tsv";

ALTER TABLE "Prompt"
  ADD COLUMN "content_tsv" tsvector
  GENERATED ALWAYS AS (
    to_tsvector('english', coalesce("title", '') || ' ' || coalesce("content", ''))
  ) STORED;

CREATE INDEX "Prompt_content_tsv_idx" ON "Prompt" USING GIN ("content_tsv");
