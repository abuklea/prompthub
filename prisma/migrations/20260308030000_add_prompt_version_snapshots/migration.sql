ALTER TABLE "PromptVersion"
ADD COLUMN "title_snapshot" TEXT,
ADD COLUMN "content_snapshot" TEXT NOT NULL DEFAULT '';
