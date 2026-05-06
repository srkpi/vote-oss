-- AlterTable
ALTER TABLE "election_choices" ADD COLUMN     "candidate_registration_id" UUID;

-- CreateIndex
CREATE INDEX "election_choices_candidate_registration_id_idx" ON "election_choices"("candidate_registration_id");

-- AddForeignKey
ALTER TABLE "election_choices" ADD CONSTRAINT "election_choices_candidate_registration_id_fkey" FOREIGN KEY ("candidate_registration_id") REFERENCES "candidate_registrations"("id") ON DELETE SET NULL ON UPDATE CASCADE;