-- Petitions feature:
--   * Add ElectionType enum + type column to elections
--   * Add description + approval fields + created_by_full_name (encrypted)
--   * Drop FK from elections.created_by to admins.user_id (petitions may be
--     created by any authenticated user, not only admins)
--   * Add manage_petitions to admins and admin_invite_tokens
--
-- Existing rows: created_by_full_name / approved_by_full_name must be backfilled
-- with encrypted admin full names via prisma/scripts/backfill-petition-fields.ts
-- before the post-migration data-integrity check runs.

-- CreateEnum
CREATE TYPE "ElectionType" AS ENUM ('ELECTION', 'PETITION');

-- AlterTable: admins
ALTER TABLE "admins"
  ADD COLUMN "manage_petitions" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable: admin_invite_tokens
ALTER TABLE "admin_invite_tokens"
  ADD COLUMN "manage_petitions" BOOLEAN NOT NULL DEFAULT false;

-- DropForeignKey: elections.created_by no longer references admins.user_id
ALTER TABLE "elections" DROP CONSTRAINT "elections_created_by_fkey";

-- AlterTable: elections
ALTER TABLE "elections"
  ADD COLUMN "type"                  "ElectionType" NOT NULL DEFAULT 'ELECTION',
  ADD COLUMN "description"           TEXT,
  ADD COLUMN "approved"              BOOLEAN        NOT NULL DEFAULT false,
  ADD COLUMN "approved_by_id"        TEXT,
  ADD COLUMN "approved_by_full_name" TEXT,
  ADD COLUMN "approved_at"           TIMESTAMP(3),
  ADD COLUMN "created_by_full_name"  TEXT NOT NULL DEFAULT '';

-- Seed created_by_full_name / approved_* for existing rows so the data-migration
-- script only needs to *encrypt* the values.  We copy admin.full_name (plaintext)
-- here; the Node script then overwrites with an encryptField() ciphertext.
UPDATE "elections" e
SET
  "created_by_full_name"  = a."full_name",
  "approved"              = true,
  "approved_by_id"        = e."created_by",
  "approved_by_full_name" = a."full_name",
  "approved_at"           = e."created_at"
FROM "admins" a
WHERE e."created_by" = a."user_id";

-- CreateIndex
CREATE INDEX "elections_type_idx" ON "elections"("type");