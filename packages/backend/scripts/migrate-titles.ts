/**
 * Migration script: Set entry titles from first line of notes
 * Run with: npx ts-node scripts/migrate-titles.ts
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function migrateTitles() {
  console.log('Starting title migration...');

  // Find all entries with empty title but non-empty notes
  const entries = await prisma.entry.findMany({
    where: {
      title: '',
      notes: { not: '' }
    },
    select: {
      id: true,
      notes: true
    }
  });

  console.log(`Found ${entries.length} entries to migrate`);

  let updated = 0;
  for (const entry of entries) {
    if (!entry.notes) continue;

    // Get first line of notes (remove # if it starts with markdown heading)
    let firstLine = entry.notes.split('\n')[0].trim();

    // Remove markdown heading prefix if present
    if (firstLine.startsWith('# ')) {
      firstLine = firstLine.slice(2);
    } else if (firstLine.startsWith('## ')) {
      firstLine = firstLine.slice(3);
    }

    if (firstLine) {
      await prisma.entry.update({
        where: { id: entry.id },
        data: { title: firstLine }
      });
      updated++;
      console.log(`Updated entry ${entry.id}: "${firstLine.substring(0, 50)}..."`);
    }
  }

  console.log(`Migration complete. Updated ${updated} entries.`);
}

migrateTitles()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
