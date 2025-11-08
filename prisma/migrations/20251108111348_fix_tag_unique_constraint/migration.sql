-- Fix Tag table unique constraint drift
-- Drop old unique constraint on (name) if it exists
DO $$ 
BEGIN
    IF EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'Tag_name_key'
    ) THEN
        ALTER TABLE "Tag" DROP CONSTRAINT "Tag_name_key";
    END IF;
END $$;

-- Create new unique constraint on (name, user_id) if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'Tag_name_user_id_key'
    ) THEN
        ALTER TABLE "Tag" ADD CONSTRAINT "Tag_name_user_id_key" UNIQUE ("name", "user_id");
    END IF;
END $$;
