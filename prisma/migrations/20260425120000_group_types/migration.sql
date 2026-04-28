-- CreateEnum
CREATE TYPE "GroupType" AS ENUM ('VKSU', 'OTHER');

-- AlterTable
ALTER TABLE "groups" ADD COLUMN "type" "GroupType" NOT NULL DEFAULT 'OTHER';

-- CreateIndex
CREATE INDEX "groups_type_idx" ON "groups"("type");