-- AlterTable
ALTER TABLE "election_bypass_token_usages" ADD COLUMN     "revoked_by" TEXT;

-- AlterTable
ALTER TABLE "election_bypass_tokens" ADD COLUMN     "deleted_by" TEXT;

-- AlterTable
ALTER TABLE "global_bypass_token_usages" ADD COLUMN     "revoked_by" TEXT;

-- AlterTable
ALTER TABLE "global_bypass_tokens" ADD COLUMN     "deleted_by" TEXT;

-- AddForeignKey
ALTER TABLE "global_bypass_tokens" ADD CONSTRAINT "global_bypass_tokens_deleted_by_fkey" FOREIGN KEY ("deleted_by") REFERENCES "admins"("user_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "election_bypass_tokens" ADD CONSTRAINT "election_bypass_tokens_deleted_by_fkey" FOREIGN KEY ("deleted_by") REFERENCES "admins"("user_id") ON DELETE SET NULL ON UPDATE CASCADE;
