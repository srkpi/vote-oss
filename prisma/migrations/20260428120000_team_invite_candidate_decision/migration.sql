-- CreateEnum
CREATE TYPE "TeamCandidateDecision" AS ENUM ('CONFIRMED', 'DECLINED');

-- AlterTable
ALTER TABLE "team_member_invite_tokens"
  ADD COLUMN "candidate_decision"   "TeamCandidateDecision",
  ADD COLUMN "candidate_decided_at" TIMESTAMP(3);

-- Backfill: tokens that were already accepted by an invitee under the old
-- one-step flow are treated as if the candidate had also confirmed.  This
-- preserves the state of any submitted-and-accepted registrations.
UPDATE "team_member_invite_tokens"
SET    "candidate_decision"   = 'CONFIRMED',
       "candidate_decided_at" = COALESCE("used_at", "created_at")
WHERE  "used_at" IS NOT NULL
  AND  "response" = 'ACCEPTED';