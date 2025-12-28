-- AlterTable
ALTER TABLE "Entry" ADD COLUMN     "isArchived" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE INDEX "Entry_isArchived_idx" ON "Entry"("isArchived");
