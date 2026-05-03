-- CreateTable
CREATE TABLE "files" (
  "id"            UUID         NOT NULL,
  "bucket"        TEXT         NOT NULL,
  "object_key"    TEXT         NOT NULL,
  "mime_type"     TEXT         NOT NULL,
  "byte_size"     INTEGER      NOT NULL,
  "sha256"        TEXT         NOT NULL,
  "original_name" TEXT,
  "uploaded_by"   TEXT         NOT NULL,
  "created_at"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "deleted_at"    TIMESTAMP(3),
  "deleted_by"    TEXT,

  CONSTRAINT "files_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "files_object_key_key" ON "files"("object_key");

-- CreateIndex
CREATE INDEX "files_uploaded_by_idx" ON "files"("uploaded_by");

-- CreateIndex
CREATE INDEX "files_deleted_at_idx" ON "files"("deleted_at");

-- AlterTable
ALTER TABLE "groups"
  ADD COLUMN "logo_file_id" UUID;

-- CreateIndex
CREATE INDEX "groups_logo_file_id_idx" ON "groups"("logo_file_id");

-- AddForeignKey
ALTER TABLE "groups"
  ADD CONSTRAINT "groups_logo_file_id_fkey"
  FOREIGN KEY ("logo_file_id") REFERENCES "files"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;