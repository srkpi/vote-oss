/*
  Warnings:

  - Added the required column `max_usage` to the `bypass_tokens` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "bypass_tokens" ADD COLUMN     "bypass_graduate" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "current_usage" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "max_usage" INTEGER NOT NULL;
