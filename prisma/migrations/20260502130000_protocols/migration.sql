-- CreateTable
CREATE TABLE "protocols" (
  "id"           UUID         NOT NULL,
  "group_id"     UUID         NOT NULL,
  "number"       INTEGER,
  "name"         TEXT         NOT NULL,
  "date"         DATE         NOT NULL,
  "visitors"     INTEGER,
  "responsibles" JSONB        NOT NULL DEFAULT '[]',
  "oss_snapshot" JSONB        NOT NULL,
  "created_by"   TEXT         NOT NULL,
  "created_at"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"   TIMESTAMP(3) NOT NULL,
  "updated_by"   TEXT,
  "deleted_at"   TIMESTAMP(3),
  "deleted_by"   TEXT,

  CONSTRAINT "protocols_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "protocol_agenda_items" (
  "id"             UUID    NOT NULL,
  "protocol_id"    UUID    NOT NULL,
  "position"       INTEGER NOT NULL,
  "name"           TEXT    NOT NULL,
  "listeners"      JSONB   NOT NULL DEFAULT '[]',
  "result"         TEXT,
  "election_id"    UUID,
  "choice_mapping" JSONB,

  CONSTRAINT "protocol_agenda_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "protocols_group_id_idx" ON "protocols"("group_id");

-- CreateIndex
CREATE INDEX "protocols_deleted_at_idx" ON "protocols"("deleted_at");

-- CreateIndex
CREATE INDEX "protocol_agenda_items_protocol_id_position_idx" ON "protocol_agenda_items"("protocol_id", "position");

-- CreateIndex
CREATE INDEX "protocol_agenda_items_election_id_idx" ON "protocol_agenda_items"("election_id");

-- AddForeignKey
ALTER TABLE "protocols"
  ADD CONSTRAINT "protocols_group_id_fkey"
  FOREIGN KEY ("group_id") REFERENCES "groups"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "protocol_agenda_items"
  ADD CONSTRAINT "protocol_agenda_items_protocol_id_fkey"
  FOREIGN KEY ("protocol_id") REFERENCES "protocols"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "protocol_agenda_items"
  ADD CONSTRAINT "protocol_agenda_items_election_id_fkey"
  FOREIGN KEY ("election_id") REFERENCES "elections"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;