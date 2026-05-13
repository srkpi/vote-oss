-- AlterTable: persist candidate's faculty (підрозділ) on the registration
ALTER TABLE "candidate_registrations"
  ADD COLUMN "faculty" TEXT;

-- AlterTable: persist team member's faculty at invite acceptance
ALTER TABLE "team_member_invite_tokens"
  ADD COLUMN "used_by_faculty" TEXT;