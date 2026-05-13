-- AlterTable: persist candidate's academic group on the registration
ALTER TABLE "candidate_registrations"
  ADD COLUMN "group" TEXT;

-- AlterTable: persist team member's academic group at invite acceptance
ALTER TABLE "team_member_invite_tokens"
  ADD COLUMN "used_by_group" TEXT;