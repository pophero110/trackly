/**
 * Migration script: Backfill tags for existing entries
 * Run with: node scripts/backfill-tags.mjs
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Extract hashtags from text (mirrors frontend/backend logic)
 */
function extractHashtags(text) {
  if (!text) return [];

  // Remove markdown links to avoid matching hashtags in URLs
  const textWithoutLinks = text.replace(/\[([^\]]+?)\]\((.+?)\)/g, '');

  const hashtagRegex = /(?<![a-zA-Z0-9_])#([a-zA-Z0-9_]+)(?![a-zA-Z0-9_])/g;
  const hashtags = [];
  let match;

  while ((match = hashtagRegex.exec(textWithoutLinks)) !== null) {
    if (!hashtags.includes(match[1].toLowerCase())) {
      hashtags.push(match[1].toLowerCase());
    }
  }

  return hashtags;
}

async function backfillTags() {
  console.log('Starting tags backfill...');

  const entries = await prisma.entry.findMany({
    select: { id: true, title: true, notes: true, tags: true }
  });

  console.log(`Found ${entries.length} entries to process`);

  let updated = 0;
  let skipped = 0;

  for (const entry of entries) {
    const extractedTags = [
      ...extractHashtags(entry.notes || ''),
      ...extractHashtags(entry.title || '')
    ];
    const tags = [...new Set(extractedTags)];

    // Skip if no tags found and no existing tags
    if (tags.length === 0 && (!entry.tags || entry.tags.length === 0)) {
      skipped++;
      continue;
    }

    // Update entry with extracted tags
    await prisma.entry.update({
      where: { id: entry.id },
      data: { tags }
    });

    updated++;
    if (tags.length > 0) {
      console.log(`Updated entry ${entry.id}: [${tags.join(', ')}]`);
    }
  }

  console.log(`\nDone!`);
  console.log(`  Updated: ${updated} entries`);
  console.log(`  Skipped: ${skipped} entries (no tags)`);
}

backfillTags()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
