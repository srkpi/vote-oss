-- CreateEnum
CREATE TYPE "CandidateRegistrationStatus" AS ENUM (
  'DRAFT',
  'AWAITING_TEAM',
  'PENDING_REVIEW',
  'APPROVED',
  'REJECTED',
  'WITHDRAWN'
);

-- CreateTable
CREATE TABLE "candidate_registrations" (
  "id"                    UUID                          NOT NULL,
  "form_id"               UUID                          NOT NULL,
  "user_id"               TEXT                          NOT NULL,
  "full_name"             TEXT                          NOT NULL,
  "phone_number"          TEXT                          NOT NULL,
  "telegram_tag"          TEXT                          NOT NULL,
  "campaign_program_url"  TEXT,
  "status"                "CandidateRegistrationStatus" NOT NULL DEFAULT 'DRAFT',
  "submitted_at"          TIMESTAMP(3),
  "reviewed_by_user_id"   TEXT,
  "reviewed_by_full_name" TEXT,
  "reviewed_at"           TIMESTAMP(3),
  "rejection_reason"      TEXT,
  "withdrawn_at"          TIMESTAMP(3),
  "created_at"            TIMESTAMP(3)                  NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"            TIMESTAMP(3)                  NOT NULL,

  CONSTRAINT "candidate_registrations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "candidate_registrations_form_id_user_id_key"
  ON "candidate_registrations"("form_id", "user_id");

-- CreateIndex
CREATE INDEX "candidate_registrations_user_id_idx" ON "candidate_registrations"("user_id");

-- CreateIndex
CREATE INDEX "candidate_registrations_status_idx" ON "candidate_registrations"("status");

-- AddForeignKey
ALTER TABLE "candidate_registrations"
  ADD CONSTRAINT "candidate_registrations_form_id_fkey"
  FOREIGN KEY ("form_id") REFERENCES "candidate_registration_forms"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;