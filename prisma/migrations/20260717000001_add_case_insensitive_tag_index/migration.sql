-- Add case-insensitive unique index on Tag(name, user_id) to prevent
-- race-condition duplicate tags that differ only in casing.
-- The existing case-sensitive constraint is kept for Prisma compatibility.
CREATE UNIQUE INDEX "Tag_name_user_id_ci_key" ON "Tag" (LOWER(name), user_id);
