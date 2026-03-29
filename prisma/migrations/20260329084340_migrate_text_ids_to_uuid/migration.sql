/*
  Warnings:

  - The primary key for the `ballots` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The primary key for the `election_choices` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The primary key for the `election_restrictions` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The primary key for the `election_tallies` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The primary key for the `elections` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The primary key for the `faq_categories` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The primary key for the `faq_items` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The primary key for the `issued_tokens` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - Changed the type of `id` on the `ballots` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `election_id` on the `ballots` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `id` on the `election_choices` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `election_id` on the `election_choices` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `id` on the `election_restrictions` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `election_id` on the `election_restrictions` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `election_id` on the `election_tallies` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `choice_id` on the `election_tallies` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `id` on the `elections` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `id` on the `faq_categories` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `id` on the `faq_items` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `category_id` on the `faq_items` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `id` on the `issued_tokens` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `election_id` on the `issued_tokens` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `election_id` on the `used_token_nullifiers` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.

*/
-- DropForeignKey
ALTER TABLE "ballots" DROP CONSTRAINT "ballots_election_id_fkey";

-- DropForeignKey
ALTER TABLE "election_choices" DROP CONSTRAINT "election_choices_election_id_fkey";

-- DropForeignKey
ALTER TABLE "election_restrictions" DROP CONSTRAINT "election_restrictions_election_id_fkey";

-- DropForeignKey
ALTER TABLE "election_tallies" DROP CONSTRAINT "election_tallies_choice_id_fkey";

-- DropForeignKey
ALTER TABLE "election_tallies" DROP CONSTRAINT "election_tallies_election_id_fkey";

-- DropForeignKey
ALTER TABLE "faq_items" DROP CONSTRAINT "faq_items_category_id_fkey";

-- DropForeignKey
ALTER TABLE "issued_tokens" DROP CONSTRAINT "issued_tokens_election_id_fkey";

-- DropForeignKey
ALTER TABLE "used_token_nullifiers" DROP CONSTRAINT "used_token_nullifiers_election_id_fkey";

-- AlterTable
ALTER TABLE "ballots" DROP CONSTRAINT "ballots_pkey",
DROP COLUMN "id",
ADD COLUMN     "id" UUID NOT NULL,
DROP COLUMN "election_id",
ADD COLUMN     "election_id" UUID NOT NULL,
ADD CONSTRAINT "ballots_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "election_choices" DROP CONSTRAINT "election_choices_pkey",
DROP COLUMN "id",
ADD COLUMN     "id" UUID NOT NULL,
DROP COLUMN "election_id",
ADD COLUMN     "election_id" UUID NOT NULL,
ADD CONSTRAINT "election_choices_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "election_restrictions" DROP CONSTRAINT "election_restrictions_pkey",
DROP COLUMN "id",
ADD COLUMN     "id" UUID NOT NULL,
DROP COLUMN "election_id",
ADD COLUMN     "election_id" UUID NOT NULL,
ADD CONSTRAINT "election_restrictions_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "election_tallies" DROP CONSTRAINT "election_tallies_pkey",
DROP COLUMN "election_id",
ADD COLUMN     "election_id" UUID NOT NULL,
DROP COLUMN "choice_id",
ADD COLUMN     "choice_id" UUID NOT NULL,
ADD CONSTRAINT "election_tallies_pkey" PRIMARY KEY ("election_id", "choice_id");

-- AlterTable
ALTER TABLE "elections" DROP CONSTRAINT "elections_pkey",
DROP COLUMN "id",
ADD COLUMN     "id" UUID NOT NULL,
ADD CONSTRAINT "elections_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "faq_categories" DROP CONSTRAINT "faq_categories_pkey",
DROP COLUMN "id",
ADD COLUMN     "id" UUID NOT NULL,
ADD CONSTRAINT "faq_categories_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "faq_items" DROP CONSTRAINT "faq_items_pkey",
DROP COLUMN "id",
ADD COLUMN     "id" UUID NOT NULL,
DROP COLUMN "category_id",
ADD COLUMN     "category_id" UUID NOT NULL,
ADD CONSTRAINT "faq_items_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "issued_tokens" DROP CONSTRAINT "issued_tokens_pkey",
DROP COLUMN "id",
ADD COLUMN     "id" UUID NOT NULL,
DROP COLUMN "election_id",
ADD COLUMN     "election_id" UUID NOT NULL,
ADD CONSTRAINT "issued_tokens_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "used_token_nullifiers" DROP COLUMN "election_id",
ADD COLUMN     "election_id" UUID NOT NULL;

-- CreateIndex
CREATE INDEX "admins_promoted_by_idx" ON "admins"("promoted_by");

-- CreateIndex
CREATE INDEX "ballots_election_id_idx" ON "ballots"("election_id");

-- CreateIndex
CREATE INDEX "election_choices_election_id_position_idx" ON "election_choices"("election_id", "position");

-- CreateIndex
CREATE INDEX "election_restrictions_election_id_type_idx" ON "election_restrictions"("election_id", "type");

-- CreateIndex
CREATE INDEX "faq_items_category_id_position_idx" ON "faq_items"("category_id", "position");

-- CreateIndex
CREATE UNIQUE INDEX "issued_tokens_election_id_user_id_key" ON "issued_tokens"("election_id", "user_id");

-- CreateIndex
CREATE INDEX "used_token_nullifiers_election_id_idx" ON "used_token_nullifiers"("election_id");

-- AddForeignKey
ALTER TABLE "election_restrictions" ADD CONSTRAINT "election_restrictions_election_id_fkey" FOREIGN KEY ("election_id") REFERENCES "elections"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "election_choices" ADD CONSTRAINT "election_choices_election_id_fkey" FOREIGN KEY ("election_id") REFERENCES "elections"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "issued_tokens" ADD CONSTRAINT "issued_tokens_election_id_fkey" FOREIGN KEY ("election_id") REFERENCES "elections"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ballots" ADD CONSTRAINT "ballots_election_id_fkey" FOREIGN KEY ("election_id") REFERENCES "elections"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "used_token_nullifiers" ADD CONSTRAINT "used_token_nullifiers_election_id_fkey" FOREIGN KEY ("election_id") REFERENCES "elections"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "election_tallies" ADD CONSTRAINT "election_tallies_election_id_fkey" FOREIGN KEY ("election_id") REFERENCES "elections"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "election_tallies" ADD CONSTRAINT "election_tallies_choice_id_fkey" FOREIGN KEY ("choice_id") REFERENCES "election_choices"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "faq_items" ADD CONSTRAINT "faq_items_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "faq_categories"("id") ON DELETE CASCADE ON UPDATE CASCADE;
