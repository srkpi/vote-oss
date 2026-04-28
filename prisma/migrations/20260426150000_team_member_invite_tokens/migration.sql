-- CreateEnum
CREATE TYPE "TeamInviteResponse" AS ENUM ('ACCEPTED', 'REJECTED');

-- CreateTable
CREATE TABLE "team_member_invite_tokens" (
  "token_hash"        TEXT                  NOT NULL,
  "registration_id"   UUID                  NOT NULL,
  "slot"              INTEGER               NOT NULL,
  "created_at"        TIMESTAMP(3)          NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expires_at"        TIMESTAMP(3)          NOT NULL,
  "used_at"           TIMESTAMP(3),
  "used_by_user_id"   TEXT,
  "used_by_full_name" TEXT,
  "response"          "TeamInviteResponse",
  "revoked_at"        TIMESTAMP(3),

  CONSTRAINT "team_member_invite_tokens_pkey" PRIMARY KEY ("token_hash")
);

-- CreateIndex
CREATE INDEX "team_member_invite_tokens_registration_id_idx"
  ON "team_member_invite_tokens"("registration_id");

-- CreateIndex
CREATE INDEX "team_member_invite_tokens_registration_id_slot_idx"
  ON "team_member_invite_tokens"("registration_id", "slot");

-- AddForeignKey
ALTER TABLE "team_member_invite_tokens"
  ADD CONSTRAINT "team_member_invite_tokens_registration_id_fkey"
  FOREIGN KEY ("registration_id") REFERENCES "candidate_registrations"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;