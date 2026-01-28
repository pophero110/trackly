-- AlterTable
ALTER TABLE "Entry" ADD COLUMN     "tags" TEXT[] DEFAULT ARRAY[]::TEXT[];
