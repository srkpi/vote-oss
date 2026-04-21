-- AlterEnum
ALTER TYPE "RestrictionType" ADD VALUE 'GROUP_MEMBERSHIP';

-- AlterTable
ALTER TABLE "admin_invite_tokens" ADD COLUMN     "manage_groups" BOOLEAN NOT NULL DEFAULT false,
ALTER COLUMN "manage_admins" SET DEFAULT false,
ALTER COLUMN "restricted_to_faculty" SET DEFAULT true;

-- AlterTable
ALTER TABLE "admins" ADD COLUMN     "manage_groups" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "elections" ADD COLUMN     "public_viewing" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "groups" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "owner_id" TEXT NOT NULL,
    "created_by" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "updated_by" TEXT,
    "deleted_at" TIMESTAMP(3),
    "deleted_by" TEXT,

    CONSTRAINT "groups_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "group_members" (
    "id" UUID NOT NULL,
    "group_id" UUID NOT NULL,
    "user_id" TEXT NOT NULL,
    "display_name" TEXT NOT NULL,
    "joined_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMP(3),
    "deleted_by" TEXT,

    CONSTRAINT "group_members_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "group_invite_links" (
    "id" UUID NOT NULL,
    "group_id" UUID NOT NULL,
    "token_hash" TEXT NOT NULL,
    "label" TEXT,
    "max_usage" INTEGER NOT NULL,
    "current_usage" INTEGER NOT NULL DEFAULT 0,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "created_by" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMP(3),
    "deleted_by" TEXT,

    CONSTRAINT "group_invite_links_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "group_invite_link_usages" (
    "id" UUID NOT NULL,
    "link_id" UUID NOT NULL,
    "user_id" TEXT NOT NULL,
    "used_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "group_invite_link_usages_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "groups_owner_id_idx" ON "groups"("owner_id");

-- CreateIndex
CREATE INDEX "group_members_user_id_idx" ON "group_members"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "group_members_group_id_user_id_key" ON "group_members"("group_id", "user_id");

-- CreateIndex
CREATE UNIQUE INDEX "group_invite_links_token_hash_key" ON "group_invite_links"("token_hash");

-- CreateIndex
CREATE INDEX "group_invite_links_group_id_idx" ON "group_invite_links"("group_id");

-- CreateIndex
CREATE INDEX "group_invite_link_usages_user_id_idx" ON "group_invite_link_usages"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "group_invite_link_usages_link_id_user_id_key" ON "group_invite_link_usages"("link_id", "user_id");

-- AddForeignKey
ALTER TABLE "group_members" ADD CONSTRAINT "group_members_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "group_invite_links" ADD CONSTRAINT "group_invite_links_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "group_invite_link_usages" ADD CONSTRAINT "group_invite_link_usages_link_id_fkey" FOREIGN KEY ("link_id") REFERENCES "group_invite_links"("id") ON DELETE CASCADE ON UPDATE CASCADE;
