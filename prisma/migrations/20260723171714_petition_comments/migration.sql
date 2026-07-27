-- CreateEnum
CREATE TYPE "CommentVoteValue" AS ENUM ('UP', 'DOWN');

-- AlterTable
ALTER TABLE "elections" ADD COLUMN     "comments_closed" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "comments_closed_at" TIMESTAMP(3),
ADD COLUMN     "comments_closed_by" TEXT,
ADD COLUMN     "comments_closed_by_full_name" TEXT;

-- CreateTable
CREATE TABLE "comments" (
    "id" UUID NOT NULL,
    "election_id" UUID NOT NULL,
    "user_id" TEXT NOT NULL,
    "full_name" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "edited_at" TIMESTAMP(3),
    "deleted_at" TIMESTAMP(3),
    "deleted_by" TEXT,
    "deleted_by_full_name" TEXT,
    "up_count" INTEGER NOT NULL DEFAULT 0,
    "down_count" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "comments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "comment_votes" (
    "id" UUID NOT NULL,
    "comment_id" UUID NOT NULL,
    "user_id" TEXT NOT NULL,
    "full_name" TEXT NOT NULL,
    "value" "CommentVoteValue" NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "comment_votes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "petition_official_answers" (
    "election_id" UUID NOT NULL,
    "body" TEXT NOT NULL,
    "author_user_id" TEXT NOT NULL,
    "author_full_name" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "edited_at" TIMESTAMP(3),
    "edited_by_user_id" TEXT,
    "edited_by_full_name" TEXT,

    CONSTRAINT "petition_official_answers_pkey" PRIMARY KEY ("election_id")
);

-- CreateIndex
CREATE INDEX "comments_election_id_created_at_idx" ON "comments"("election_id", "created_at");

-- CreateIndex
CREATE INDEX "comments_user_id_idx" ON "comments"("user_id");

-- CreateIndex
CREATE INDEX "comment_votes_comment_id_value_idx" ON "comment_votes"("comment_id", "value");

-- CreateIndex
CREATE UNIQUE INDEX "comment_votes_comment_id_user_id_key" ON "comment_votes"("comment_id", "user_id");

-- AddForeignKey
ALTER TABLE "comments" ADD CONSTRAINT "comments_election_id_fkey" FOREIGN KEY ("election_id") REFERENCES "elections"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comment_votes" ADD CONSTRAINT "comment_votes_comment_id_fkey" FOREIGN KEY ("comment_id") REFERENCES "comments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "petition_official_answers" ADD CONSTRAINT "petition_official_answers_election_id_fkey" FOREIGN KEY ("election_id") REFERENCES "elections"("id") ON DELETE CASCADE ON UPDATE CASCADE;
