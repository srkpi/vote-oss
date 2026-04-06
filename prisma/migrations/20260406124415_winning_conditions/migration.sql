-- AlterTable
ALTER TABLE "elections" ADD COLUMN     "winning_conditions" JSONB NOT NULL DEFAULT '{}';
