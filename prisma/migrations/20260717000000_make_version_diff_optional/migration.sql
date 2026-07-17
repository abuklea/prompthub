-- Make diff column optional with a default empty string.
-- The diff field is no longer computed or read; snapshots are the
-- authoritative version-storage model.
ALTER TABLE "PromptVersion" ALTER COLUMN "diff" SET DEFAULT '';
