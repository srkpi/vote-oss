-- Switch ElectionCampaign from days+time-of-day to absolute timestamps.
-- Drop strategy: clear existing campaigns (they would be invalid against the
-- new shape and the feature has no production consumers yet).

DELETE FROM "election_campaigns";

ALTER TABLE "election_campaigns"
  DROP COLUMN "registration_days",
  DROP COLUMN "registration_review_days",
  DROP COLUMN "registration_opens_time",
  DROP COLUMN "registration_closes_time",
  DROP COLUMN "signature_days",
  DROP COLUMN "signature_review_days",
  DROP COLUMN "signatures_opens_time",
  DROP COLUMN "signatures_closes_time";

ALTER TABLE "election_campaigns"
  ADD COLUMN "registration_closes_at" TIMESTAMP(3) NOT NULL,
  ADD COLUMN "signatures_opens_at"    TIMESTAMP(3),
  ADD COLUMN "signatures_closes_at"   TIMESTAMP(3);