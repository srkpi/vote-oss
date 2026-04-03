-- CreateEnum
CREATE TYPE "BypassTokenType" AS ENUM ('GLOBAL', 'ELECTION');

-- AlterTable
ALTER TABLE "jwt_tokens" ADD COLUMN     "initial_auth_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- CreateTable
CREATE TABLE "bypass_tokens" (
    "token_hash" TEXT NOT NULL,
    "type" "BypassTokenType" NOT NULL,
    "election_id" UUID,
    "bypass_not_studying" BOOLEAN NOT NULL DEFAULT false,
    "bypass_restrictions" TEXT[],
    "created_by" TEXT NOT NULL,
    "valid_until" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "bypass_tokens_pkey" PRIMARY KEY ("token_hash")
);

-- CreateTable
CREATE TABLE "bypass_token_usages" (
    "id" UUID NOT NULL,
    "token_hash" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "used_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revoked_at" TIMESTAMP(3),

    CONSTRAINT "bypass_token_usages_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "bypass_tokens_type_election_id_idx" ON "bypass_tokens"("type", "election_id");

-- CreateIndex
CREATE INDEX "bypass_tokens_created_by_idx" ON "bypass_tokens"("created_by");

-- CreateIndex
CREATE INDEX "bypass_token_usages_user_id_idx" ON "bypass_token_usages"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "bypass_token_usages_token_hash_user_id_key" ON "bypass_token_usages"("token_hash", "user_id");

-- AddForeignKey
ALTER TABLE "bypass_tokens" ADD CONSTRAINT "bypass_tokens_election_id_fkey" FOREIGN KEY ("election_id") REFERENCES "elections"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bypass_tokens" ADD CONSTRAINT "bypass_tokens_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "admins"("user_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bypass_token_usages" ADD CONSTRAINT "bypass_token_usages_token_hash_fkey" FOREIGN KEY ("token_hash") REFERENCES "bypass_tokens"("token_hash") ON DELETE CASCADE ON UPDATE CASCADE;
