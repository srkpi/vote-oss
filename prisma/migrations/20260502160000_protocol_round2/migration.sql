-- AlterTable: GroupMember.role (free-form per-member role used to populate
-- protocol responsibles and attendance lists).
ALTER TABLE "group_members"
  ADD COLUMN "role" TEXT;

-- AlterTable: Protocol.attendance (JSON list of {fullname, posada,
-- present_text} rows; backs the `members` variable on the generator).
ALTER TABLE "protocols"
  ADD COLUMN "attendance" JSONB NOT NULL DEFAULT '[]';

-- Backfill any pre-existing protocols without a number (only relevant in dev),
-- then make Protocol.number NOT NULL.  Counts within the same calendar year
-- per group, falling back to 1 when there's no prior numbering.
WITH numbered AS (
  SELECT id,
         ROW_NUMBER() OVER (
           PARTITION BY group_id, EXTRACT(YEAR FROM date)
           ORDER BY date, created_at
         ) AS seq
    FROM "protocols"
   WHERE "number" IS NULL
)
UPDATE "protocols" p
   SET "number" = n.seq
  FROM numbered n
 WHERE p.id = n.id;

ALTER TABLE "protocols"
  ALTER COLUMN "number" SET NOT NULL;