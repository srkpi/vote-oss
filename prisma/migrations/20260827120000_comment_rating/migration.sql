-- AlterTable
-- `rating` is a STORED generated column (not a plain default) so Postgres
-- recomputes it automatically on every UPDATE to up_count/down_count —
-- including the increment/decrement calls in the vote route — with no
-- application code needed to keep it in sync. A generated column cannot
-- also declare DEFAULT, which is why this differs from the schema's
-- `@default(0)` (that annotation only affects Prisma's generated
-- TypeScript input types, it is not applied at the database level).
ALTER TABLE "comments" ADD COLUMN "rating" INTEGER GENERATED ALWAYS AS ("up_count" - "down_count") STORED NOT NULL;

-- CreateIndex
CREATE INDEX "comments_election_id_rating_idx" ON "comments"("election_id", "rating");
