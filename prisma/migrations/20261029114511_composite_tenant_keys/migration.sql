-- DropForeignKey
ALTER TABLE "Folder" DROP CONSTRAINT "Folder_parent_id_fkey";

-- DropForeignKey
ALTER TABLE "Prompt" DROP CONSTRAINT "Prompt_folder_id_fkey";

-- CreateIndex
CREATE UNIQUE INDEX "Folder_id_user_id_key" ON "Folder"("id", "user_id");

-- AddForeignKey
ALTER TABLE "Folder" ADD CONSTRAINT "Folder_parent_id_user_id_fkey" FOREIGN KEY ("parent_id", "user_id") REFERENCES "Folder"("id", "user_id") ON DELETE CASCADE ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "Prompt" ADD CONSTRAINT "Prompt_folder_id_user_id_fkey" FOREIGN KEY ("folder_id", "user_id") REFERENCES "Folder"("id", "user_id") ON DELETE CASCADE ON UPDATE RESTRICT;

