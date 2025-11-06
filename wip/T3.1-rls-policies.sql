-- Enable RLS on all tables
ALTER TABLE "Profile" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Folder" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Prompt" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Tag" ENABLE ROW LEVEL SECURITY;

-- Policies for "Profile" table
CREATE POLICY "Allow individual read access on Profile" ON "Profile" FOR SELECT USING (auth.uid()::text = user_id);
CREATE POLICY "Allow individual update access on Profile" ON "Profile" FOR UPDATE USING (auth.uid()::text = user_id);

-- Policies for "Folder" table
CREATE POLICY "Allow individual access on Folder" ON "Folder" FOR ALL USING (auth.uid()::text = user_id);

-- Policies for "Prompt" table
CREATE POLICY "Allow individual access on Prompt" ON "Prompt" FOR ALL USING (auth.uid()::text = user_id);

-- Policies for "Tag" table
CREATE POLICY "Allow individual access on Tag" ON "Tag" FOR ALL USING (auth.uid()::text = user_id);
