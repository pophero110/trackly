/*
  Warnings:

  - You are about to drop the column `latitude` on the `Entry` table. All the data in the column will be lost.
  - You are about to drop the column `locationName` on the `Entry` table. All the data in the column will be lost.
  - You are about to drop the column `longitude` on the `Entry` table. All the data in the column will be lost.
  - You are about to drop the column `value` on the `Entry` table. All the data in the column will be lost.
  - You are about to drop the column `valueDisplay` on the `Entry` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Entry" DROP COLUMN "latitude",
DROP COLUMN "locationName",
DROP COLUMN "longitude",
DROP COLUMN "value",
DROP COLUMN "valueDisplay";
