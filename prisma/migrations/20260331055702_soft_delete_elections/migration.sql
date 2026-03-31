-- AlterTable
ALTER TABLE "elections" ADD COLUMN     "deleted_at" TIMESTAMP(3),
ADD COLUMN     "deleted_by" TEXT;

-- AddForeignKey
ALTER TABLE "elections" ADD CONSTRAINT "elections_deleted_by_fkey" FOREIGN KEY ("deleted_by") REFERENCES "admins"("user_id") ON DELETE SET NULL ON UPDATE CASCADE;
