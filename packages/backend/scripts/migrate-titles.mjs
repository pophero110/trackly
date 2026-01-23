/**
 * Migration script: Set entry titles from first line of notes
 * Run with: node scripts/migrate-titles.mjs
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function migrateTitles() {
  console.log('Starting title migration...');

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

    let firstLine = entry.notes.split('\n')[0].trim();

    // Remove markdown heading prefix
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
      console.log(`Updated: "${firstLine.substring(0, 50)}"`);
    }
  }

  console.log(`Done. Updated ${updated} entries.`);
}

migrateTitles()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
