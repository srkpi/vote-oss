-- AlterTable: add wall-clock HH:MM overrides for registration form and signature elections.
-- Existing rows are backfilled from announced_at's time-of-day in Kyiv so behaviour
-- doesn't drift for already-created campaigns.

ALTER TABLE "election_campaigns"
  ADD COLUMN "registration_opens_time"  TEXT,
  ADD COLUMN "registration_closes_time" TEXT,
  ADD COLUMN "signatures_opens_time"    TEXT,
  ADD COLUMN "signatures_closes_time"   TEXT;

-- Backfill: use the announced_at wall-clock time in Kyiv for both registration
-- bounds.  Existing campaigns thus keep their previous opens=closes=announced_at time.
UPDATE "election_campaigns"
SET
  "registration_opens_time"  = to_char(("announced_at" AT TIME ZONE 'Europe/Kyiv'), 'HH24:MI'),
  "registration_closes_time" = to_char(("announced_at" AT TIME ZONE 'Europe/Kyiv'), 'HH24:MI');

-- Same backfill for signature campaigns; non-signature stay NULL.
UPDATE "election_campaigns"
SET
  "signatures_opens_time"  = to_char(("announced_at" AT TIME ZONE 'Europe/Kyiv'), 'HH24:MI'),
  "signatures_closes_time" = to_char(("announced_at" AT TIME ZONE 'Europe/Kyiv'), 'HH24:MI')
WHERE "signature_collection" = TRUE;

ALTER TABLE "election_campaigns"
  ALTER COLUMN "registration_opens_time"  SET NOT NULL,
  ALTER COLUMN "registration_closes_time" SET NOT NULL;