-- AlterTable
ALTER TABLE "admin_invite_tokens" ADD COLUMN     "manage_faq" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "admins" ADD COLUMN     "manage_faq" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "elections" ALTER COLUMN "created_by_full_name" DROP DEFAULT;
