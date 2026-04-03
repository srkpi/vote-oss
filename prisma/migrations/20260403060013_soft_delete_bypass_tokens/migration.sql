-- AlterTable
ALTER TABLE "election_bypass_tokens" ADD COLUMN     "deleted_at" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "global_bypass_tokens" ADD COLUMN     "deleted_at" TIMESTAMP(3);
