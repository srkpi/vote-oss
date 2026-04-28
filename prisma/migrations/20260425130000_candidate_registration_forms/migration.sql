-- CreateTable
CREATE TABLE "candidate_registration_forms" (
  "id"                        UUID         NOT NULL,
  "group_id"                  UUID         NOT NULL,
  "title"                     TEXT         NOT NULL,
  "description"               TEXT,
  "requires_campaign_program" BOOLEAN      NOT NULL DEFAULT false,
  "team_size"                 INTEGER      NOT NULL DEFAULT 0,
  "opens_at"                  TIMESTAMP(3) NOT NULL,
  "closes_at"                 TIMESTAMP(3) NOT NULL,
  "created_by"                TEXT         NOT NULL,
  "created_by_full_name"      TEXT         NOT NULL,
  "created_at"                TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"                TIMESTAMP(3) NOT NULL,
  "updated_by"                TEXT,
  "deleted_at"                TIMESTAMP(3),
  "deleted_by"                TEXT,

  CONSTRAINT "candidate_registration_forms_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "candidate_registration_form_restrictions" (
  "id"      UUID              NOT NULL,
  "form_id" UUID              NOT NULL,
  "type"    "RestrictionType" NOT NULL,
  "value"   TEXT              NOT NULL,

  CONSTRAINT "candidate_registration_form_restrictions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "candidate_registration_forms_group_id_idx" ON "candidate_registration_forms"("group_id");

-- CreateIndex
CREATE INDEX "candidate_registration_forms_deleted_at_idx" ON "candidate_registration_forms"("deleted_at");

-- CreateIndex
CREATE INDEX "candidate_registration_form_restrictions_form_id_type_idx" ON "candidate_registration_form_restrictions"("form_id", "type");

-- AddForeignKey
ALTER TABLE "candidate_registration_forms"
  ADD CONSTRAINT "candidate_registration_forms_group_id_fkey"
  FOREIGN KEY ("group_id") REFERENCES "groups"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "candidate_registration_form_restrictions"
  ADD CONSTRAINT "candidate_registration_form_restrictions_form_id_fkey"
  FOREIGN KEY ("form_id") REFERENCES "candidate_registration_forms"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;