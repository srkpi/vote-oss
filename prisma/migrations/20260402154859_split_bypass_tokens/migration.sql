/*
  Warnings:

  - You are about to drop the `bypass_token_usages` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `bypass_tokens` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "bypass_token_usages" DROP CONSTRAINT "bypass_token_usages_token_hash_fkey";

-- DropForeignKey
ALTER TABLE "bypass_tokens" DROP CONSTRAINT "bypass_tokens_created_by_fkey";

-- DropForeignKey
ALTER TABLE "bypass_tokens" DROP CONSTRAINT "bypass_tokens_election_id_fkey";

-- DropTable
DROP TABLE "bypass_token_usages";

-- DropTable
DROP TABLE "bypass_tokens";

-- DropEnum
DROP TYPE "BypassTokenType";

-- CreateTable
CREATE TABLE "global_bypass_tokens" (
    "token_hash" TEXT NOT NULL,
    "bypass_not_studying" BOOLEAN NOT NULL DEFAULT false,
    "bypass_graduate" BOOLEAN NOT NULL DEFAULT false,
    "max_usage" INTEGER NOT NULL,
    "current_usage" INTEGER NOT NULL DEFAULT 0,
    "valid_until" TIMESTAMP(3) NOT NULL,
    "created_by" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "global_bypass_tokens_pkey" PRIMARY KEY ("token_hash")
);

-- CreateTable
CREATE TABLE "global_bypass_token_usages" (
    "id" UUID NOT NULL,
    "token_hash" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "used_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revoked_at" TIMESTAMP(3),

    CONSTRAINT "global_bypass_token_usages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "election_bypass_tokens" (
    "token_hash" TEXT NOT NULL,
    "election_id" UUID NOT NULL,
    "bypass_restrictions" TEXT[],
    "max_usage" INTEGER NOT NULL,
    "current_usage" INTEGER NOT NULL DEFAULT 0,
    "created_by" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "election_bypass_tokens_pkey" PRIMARY KEY ("token_hash")
);

-- CreateTable
CREATE TABLE "election_bypass_token_usages" (
    "id" UUID NOT NULL,
    "token_hash" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "used_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revoked_at" TIMESTAMP(3),

    CONSTRAINT "election_bypass_token_usages_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "global_bypass_tokens_created_by_idx" ON "global_bypass_tokens"("created_by");

-- CreateIndex
CREATE INDEX "global_bypass_token_usages_user_id_idx" ON "global_bypass_token_usages"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "global_bypass_token_usages_token_hash_user_id_key" ON "global_bypass_token_usages"("token_hash", "user_id");

-- CreateIndex
CREATE INDEX "election_bypass_tokens_election_id_idx" ON "election_bypass_tokens"("election_id");

-- CreateIndex
CREATE INDEX "election_bypass_tokens_created_by_idx" ON "election_bypass_tokens"("created_by");

-- CreateIndex
CREATE INDEX "election_bypass_token_usages_user_id_idx" ON "election_bypass_token_usages"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "election_bypass_token_usages_token_hash_user_id_key" ON "election_bypass_token_usages"("token_hash", "user_id");

-- AddForeignKey
ALTER TABLE "global_bypass_tokens" ADD CONSTRAINT "global_bypass_tokens_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "admins"("user_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "global_bypass_token_usages" ADD CONSTRAINT "global_bypass_token_usages_token_hash_fkey" FOREIGN KEY ("token_hash") REFERENCES "global_bypass_tokens"("token_hash") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "election_bypass_tokens" ADD CONSTRAINT "election_bypass_tokens_election_id_fkey" FOREIGN KEY ("election_id") REFERENCES "elections"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "election_bypass_tokens" ADD CONSTRAINT "election_bypass_tokens_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "admins"("user_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "election_bypass_token_usages" ADD CONSTRAINT "election_bypass_token_usages_token_hash_fkey" FOREIGN KEY ("token_hash") REFERENCES "election_bypass_tokens"("token_hash") ON DELETE CASCADE ON UPDATE CASCADE;
