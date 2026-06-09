-- AlterTable
ALTER TABLE "elections" ADD COLUMN     "edited_at" TIMESTAMP(3),
ADD COLUMN     "edited_by" TEXT;

-- AddForeignKey
ALTER TABLE "elections" ADD CONSTRAINT "elections_edited_by_fkey" FOREIGN KEY ("edited_by") REFERENCES "admins"("user_id") ON DELETE SET NULL ON UPDATE CASCADE;
