CREATE TABLE "kpi_identities" (
  "subject" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  CONSTRAINT "kpi_identities_pkey" PRIMARY KEY ("subject")
);
CREATE UNIQUE INDEX "kpi_identities_user_id_key" ON "kpi_identities"("user_id");
