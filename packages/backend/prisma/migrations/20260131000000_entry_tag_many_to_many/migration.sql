-- CreateTable
CREATE TABLE "EntryTag" (
    "id" TEXT NOT NULL,
    "entryId" TEXT NOT NULL,
    "tagId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EntryTag_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "EntryTag_entryId_idx" ON "EntryTag"("entryId");

-- CreateIndex
CREATE INDEX "EntryTag_tagId_idx" ON "EntryTag"("tagId");

-- CreateIndex
CREATE UNIQUE INDEX "EntryTag_entryId_tagId_key" ON "EntryTag"("entryId", "tagId");

-- Migrate existing data from Entry.entityId to EntryTag
INSERT INTO "EntryTag" ("id", "entryId", "tagId", "createdAt")
SELECT
    gen_random_uuid()::TEXT,
    "id",
    "entityId",
    "createdAt"
FROM "Entry"
WHERE "entityId" IS NOT NULL;

-- DropForeignKey (remove the old relation)
ALTER TABLE "Entry" DROP CONSTRAINT IF EXISTS "Entry_entityId_fkey";

-- DropIndex
DROP INDEX IF EXISTS "Entry_entityId_idx";

-- AlterTable (remove old columns)
ALTER TABLE "Entry" DROP COLUMN IF EXISTS "entityId";
ALTER TABLE "Entry" DROP COLUMN IF EXISTS "entityName";

-- AddForeignKey
ALTER TABLE "EntryTag" ADD CONSTRAINT "EntryTag_entryId_fkey" FOREIGN KEY ("entryId") REFERENCES "Entry"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EntryTag" ADD CONSTRAINT "EntryTag_tagId_fkey" FOREIGN KEY ("tagId") REFERENCES "Entity"("id") ON DELETE CASCADE ON UPDATE CASCADE;
