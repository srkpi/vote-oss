-- AlterTable
ALTER TABLE "elections" ADD COLUMN     "campaign_id" UUID,
ADD COLUMN     "candidate_registration_id" UUID;

-- CreateIndex
CREATE UNIQUE INDEX "elections_candidate_registration_id_key" ON "elections"("candidate_registration_id");

-- CreateIndex
CREATE INDEX "elections_campaign_id_idx" ON "elections"("campaign_id");

-- AddForeignKey
ALTER TABLE "elections" ADD CONSTRAINT "elections_campaign_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "election_campaigns"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "elections" ADD CONSTRAINT "elections_candidate_registration_id_fkey" FOREIGN KEY ("candidate_registration_id") REFERENCES "candidate_registrations"("id") ON DELETE SET NULL ON UPDATE CASCADE;