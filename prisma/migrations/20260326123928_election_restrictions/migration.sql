/*
  Warnings:

  - You are about to drop the column `restricted_to_faculty` on the `elections` table. All the data in the column will be lost.
  - You are about to drop the column `restricted_to_group` on the `elections` table. All the data in the column will be lost.

*/
-- CreateEnum
CREATE TYPE "RestrictionType" AS ENUM ('FACULTY', 'GROUP', 'SPECIALITY', 'STUDY_YEAR', 'STUDY_FORM');

-- AlterTable
ALTER TABLE "elections" DROP COLUMN "restricted_to_faculty",
DROP COLUMN "restricted_to_group",
ADD COLUMN     "max_choices" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "min_choices" INTEGER NOT NULL DEFAULT 1;

-- CreateTable
CREATE TABLE "election_restrictions" (
    "id" TEXT NOT NULL,
    "election_id" TEXT NOT NULL,
    "type" "RestrictionType" NOT NULL,
    "value" TEXT NOT NULL,

    CONSTRAINT "election_restrictions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "election_restrictions_election_id_type_idx" ON "election_restrictions"("election_id", "type");

-- AddForeignKey
ALTER TABLE "election_restrictions" ADD CONSTRAINT "election_restrictions_election_id_fkey" FOREIGN KEY ("election_id") REFERENCES "elections"("id") ON DELETE CASCADE ON UPDATE CASCADE;
