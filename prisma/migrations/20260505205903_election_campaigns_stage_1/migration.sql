-- CreateEnum
CREATE TYPE "CampaignState" AS ENUM ('ANNOUNCED', 'REGISTRATION_OPEN', 'REGISTRATION_REVIEW', 'SIGNATURES_OPEN', 'SIGNATURES_REVIEW', 'VOTING_OPEN', 'VOTING_CLOSED', 'COMPLETED', 'FAILED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ElectionKind" AS ENUM ('REGULAR', 'BY_ELECTION', 'REPLACEMENT', 'REPEAT');

-- CreateTable
CREATE TABLE "election_campaigns" (
    "id" UUID NOT NULL,
    "group_id" UUID NOT NULL,
    "position_title" TEXT NOT NULL,
    "election_kind" "ElectionKind" NOT NULL,
    "state" "CampaignState" NOT NULL DEFAULT 'ANNOUNCED',
    "announced_at" TIMESTAMP(3) NOT NULL,
    "registration_days" INTEGER NOT NULL,
    "registration_review_days" INTEGER NOT NULL,
    "signature_collection" BOOLEAN NOT NULL DEFAULT false,
    "signature_days" INTEGER,
    "signature_review_days" INTEGER,
    "signature_quorum" INTEGER,
    "team_size" INTEGER NOT NULL DEFAULT 0,
    "requires_campaign_program" BOOLEAN NOT NULL DEFAULT false,
    "voting_opens_at" TIMESTAMP(3) NOT NULL,
    "voting_closes_at" TIMESTAMP(3) NOT NULL,
    "created_by" TEXT NOT NULL,
    "created_by_full_name" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMP(3),
    "deleted_by" TEXT,
    "registration_form_id" UUID,
    "final_election_id" UUID,

    CONSTRAINT "election_campaigns_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "election_campaign_restrictions" (
    "id" UUID NOT NULL,
    "campaign_id" UUID NOT NULL,
    "type" "RestrictionType" NOT NULL,
    "value" TEXT NOT NULL,

    CONSTRAINT "election_campaign_restrictions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "election_campaigns_group_id_state_idx" ON "election_campaigns"("group_id", "state");

-- CreateIndex
CREATE INDEX "election_campaigns_deleted_at_idx" ON "election_campaigns"("deleted_at");

-- CreateIndex
CREATE INDEX "election_campaign_restrictions_campaign_id_type_idx" ON "election_campaign_restrictions"("campaign_id", "type");

-- AddForeignKey
ALTER TABLE "election_campaigns" ADD CONSTRAINT "election_campaigns_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "election_campaign_restrictions" ADD CONSTRAINT "election_campaign_restrictions_campaign_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "election_campaigns"("id") ON DELETE CASCADE ON UPDATE CASCADE;
