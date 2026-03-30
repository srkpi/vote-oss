/*
  Warnings:

  - You are about to drop the `election_tallies` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "election_tallies" DROP CONSTRAINT "election_tallies_choice_id_fkey";

-- DropForeignKey
ALTER TABLE "election_tallies" DROP CONSTRAINT "election_tallies_election_id_fkey";

-- AlterTable
ALTER TABLE "election_choices" ADD COLUMN     "vote_count" INTEGER;

-- DropTable
DROP TABLE "election_tallies";
