/*
  Warnings:

  - You are about to drop the column `entryReferences` on the `Entry` table. All the data in the column will be lost.
  - You are about to drop the column `images` on the `Entry` table. All the data in the column will be lost.
  - You are about to drop the column `linkTitles` on the `Entry` table. All the data in the column will be lost.
  - You are about to drop the column `links` on the `Entry` table. All the data in the column will be lost.
  - You are about to drop the column `propertyValueDisplays` on the `Entry` table. All the data in the column will be lost.
  - You are about to drop the column `propertyValues` on the `Entry` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Entry" DROP COLUMN "entryReferences",
DROP COLUMN "images",
DROP COLUMN "linkTitles",
DROP COLUMN "links",
DROP COLUMN "propertyValueDisplays",
DROP COLUMN "propertyValues";
