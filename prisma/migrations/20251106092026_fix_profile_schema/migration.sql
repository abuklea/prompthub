/*
  Warnings:

  - You are about to drop the column `user_id` on the `Profile` table. All the data in the column will be lost.

*/
-- DropIndex
DROP INDEX "Profile_user_id_key";

-- AlterTable
ALTER TABLE "Profile" DROP COLUMN "user_id";
