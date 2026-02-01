import { Router } from 'express';
import { prisma } from '../db/client.js';
import { requireAuth, AuthRequest } from '../middleware/auth.js';
import { validate, createEntrySchema, updateEntrySchema } from '../middleware/validation.js';
import { extractHashtags } from '../utils/tagExtractor.js';
import type { IEntry, IEntryTag } from '@trackly/shared';

const router: Router = Router();

// All routes require authentication
router.use(requireAuth);

/**
 * Helper function to format entry with tags for API response
 */
function formatEntry(entry: any): IEntry {
  const tags: IEntryTag[] = entry.entryTags.map((et: any) => ({
    id: et.id,
    tagId: et.tagId,
    tagName: et.tag.name,
    createdAt: et.createdAt.toISOString()
  }));

  return {
    id: entry.id,
    tags,
    title: entry.title,
    timestamp: entry.timestamp.toISOString(),
    value: entry.value || undefined,
    valueDisplay: entry.valueDisplay || undefined,
    notes: entry.notes || '',
    latitude: entry.latitude ?? undefined,
    longitude: entry.longitude ?? undefined,
    locationName: entry.locationName || undefined,
    isArchived: entry.isArchived,
    createdAt: entry.createdAt.toISOString(),
    updatedAt: entry.updatedAt.toISOString()
  };
}

/**
 * GET /api/entries
 * List entries for the authenticated user with cursor-based pagination
 * Query params:
 *   - tagIds (comma-separated list of tag IDs to filter by)
 *   - includeArchived (include archived entries)
 *   - sortBy (field to sort by: timestamp, createdAt)
 *   - sortOrder (asc or desc, default: desc)
 *   - limit (page size, default: 30)
 *   - after (cursor: sort field value, ISO timestamp or string)
 *   - afterId (cursor: entry ID for tie-breaking)
 *   - hashtags (comma-separated list of hashtags to filter by, AND logic)
 */
router.get('/', async (req: AuthRequest, res, next): Promise<void> => {
  try {
    const userId = req.user!.id;
    const { tagIds, includeArchived, sortBy, sortOrder, limit, after, afterId, hashtags } = req.query;

    // Base where clause
    const baseWhere: any = { userId };

    // Filter by tag IDs (entries must have at least one of these tags)
    if (tagIds) {
      const tagIdArray = (tagIds as string).split(',').map(id => id.trim());
      baseWhere.entryTags = {
        some: {
          tagId: { in: tagIdArray }
        }
      };
    }

    if (includeArchived !== 'true') {
      baseWhere.isArchived = false;
    }

    // Filter by hashtags (AND logic - must have all hashtags)
    if (hashtags) {
      const hashtagArray = (hashtags as string).split(',').map(t => t.trim().toLowerCase());
      baseWhere.hashtags = { hasEvery: hashtagArray };
    }

    // Determine sort field and order
    const validSortFields = ['timestamp', 'createdAt', 'updatedAt'];
    const sortField = validSortFields.includes(sortBy as string) ? (sortBy as string) : 'timestamp';
    const order: 'asc' | 'desc' = (sortOrder === 'asc' || sortOrder === 'desc') ? sortOrder : 'desc';

    // Parse limit (default 30, max 100)
    const pageSize = Math.min(Math.max(parseInt(limit as string) || 30, 1), 100);

    // Build where clause with cursor if provided
    let where: any = baseWhere;
    if (after && afterId) {
      const cursorComparison = order === 'desc' ? 'lt' : 'gt';
      const isDateField = ['timestamp', 'createdAt', 'updatedAt'].includes(sortField);
      const cursorValue = isDateField ? new Date(after as string) : after as string;

      where = {
        AND: [
          baseWhere,
          {
            OR: [
              // Entries with sort field value beyond cursor
              { [sortField]: { [cursorComparison]: cursorValue } },
              // Entries with same sort field value but ID beyond cursor
              {
                [sortField]: cursorValue,
                id: { [cursorComparison]: afterId as string }
              }
            ]
          }
        ]
      };
    }

    // Fetch one extra to determine hasMore
    const entries = await prisma.entry.findMany({
      where,
      include: {
        entryTags: {
          include: {
            tag: true
          }
        }
      },
      orderBy: [
        { [sortField]: order },
        { id: order }  // Use ID for tie-breaking (consistent with cursor)
      ],
      take: pageSize + 1
    });

    // Determine if there are more entries
    const hasMore = entries.length > pageSize;
    const resultEntries = hasMore ? entries.slice(0, pageSize) : entries;

    // Build next cursor from last entry
    const lastEntry = resultEntries[resultEntries.length - 1];
    const isDateField = ['timestamp', 'createdAt', 'updatedAt'].includes(sortField);
    const nextCursor = hasMore && lastEntry ? {
      after: isDateField
        ? (lastEntry[sortField as keyof typeof lastEntry] as Date).toISOString()
        : lastEntry[sortField as keyof typeof lastEntry] as string,
      afterId: lastEntry.id
    } : null;

    // Convert to IEntry format
    const formattedEntries: IEntry[] = resultEntries.map(formatEntry);

    res.json({
      entries: formattedEntries,
      pagination: {
        hasMore,
        nextCursor
      }
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/entries/hashtags
 * Get all unique hashtags for the authenticated user
 */
router.get('/hashtags', async (req: AuthRequest, res, next): Promise<void> => {
  try {
    const userId = req.user!.id;

    // Get all unique hashtags from non-archived entries
    const entries = await prisma.entry.findMany({
      where: { userId, isArchived: false },
      select: { hashtags: true }
    });

    // Flatten and deduplicate hashtags
    const allHashtags = new Set<string>();
    entries.forEach(entry => {
      entry.hashtags.forEach(hashtag => allHashtags.add(hashtag));
    });

    const sortedHashtags = Array.from(allHashtags).sort();
    res.json({ hashtags: sortedHashtags });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/entries/search
 * Search entries by title and notes
 * Query params:
 *   - q: search query (required)
 *   - limit: max results (default: 20, max: 50)
 */
router.get('/search', async (req: AuthRequest, res, next): Promise<void> => {
  try {
    const userId = req.user!.id;
    const { q, limit } = req.query;

    if (!q || typeof q !== 'string' || !q.trim()) {
      res.json({ entries: [] });
      return;
    }

    const searchQuery = q.trim();
    const maxResults = Math.min(Math.max(parseInt(limit as string) || 20, 1), 50);

    // Search in title and notes using case-insensitive contains
    const entries = await prisma.entry.findMany({
      where: {
        userId,
        isArchived: false,
        OR: [
          { title: { contains: searchQuery, mode: 'insensitive' } },
          { notes: { contains: searchQuery, mode: 'insensitive' } }
        ]
      },
      include: {
        entryTags: {
          include: {
            tag: true
          }
        }
      },
      orderBy: { timestamp: 'desc' },
      take: maxResults
    });

    const formattedEntries: IEntry[] = entries.map(formatEntry);
    res.json({ entries: formattedEntries });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/entries/:id
 * Get a single entry by ID
 */
router.get('/:id', async (req: AuthRequest, res, next): Promise<void> => {
  try {
    const { id } = req.params;
    const userId = req.user!.id;

    const entry = await prisma.entry.findFirst({
      where: { id, userId },
      include: {
        entryTags: {
          include: {
            tag: true
          }
        }
      }
    });

    if (!entry) {
      res.status(404).json({ error: 'Entry not found' });
      return;
    }

    res.json(formatEntry(entry));
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/entries
 * Create a new entry
 */
router.post('/', validate(createEntrySchema), async (req: AuthRequest, res, next): Promise<void> => {
  try {
    const userId = req.user!.id;
    const { tagIds, title, timestamp, value, valueDisplay, notes, latitude, longitude, locationName } = req.body;

    // Verify all tags exist and belong to user
    const tags = await prisma.tag.findMany({
      where: {
        id: { in: tagIds },
        userId
      }
    });

    if (tags.length !== tagIds.length) {
      res.status(404).json({ error: 'One or more tags not found' });
      return;
    }

    // Extract hashtags from notes and title
    const extractedHashtags = [
      ...extractHashtags(notes || ''),
      ...extractHashtags(title || '')
    ];
    // Deduplicate hashtags
    const hashtags = [...new Set(extractedHashtags)];

    // Create entry with tags in a transaction
    const entry = await prisma.entry.create({
      data: {
        title,
        timestamp: new Date(timestamp),
        value: value?.toString() || null,
        valueDisplay: valueDisplay || null,
        notes: notes || '',
        hashtags,
        latitude: latitude ?? null,
        longitude: longitude ?? null,
        locationName: locationName || null,
        userId,
        entryTags: {
          create: tagIds.map((tagId: string) => ({
            tagId
          }))
        }
      },
      include: {
        entryTags: {
          include: {
            tag: true
          }
        }
      }
    });

    res.status(201).json(formatEntry(entry));
  } catch (error) {
    next(error);
  }
});

/**
 * PUT /api/entries/:id
 * Update an entry
 */
router.put('/:id', validate(updateEntrySchema), async (req: AuthRequest, res, next): Promise<void> => {
  try {
    const { id } = req.params;
    const userId = req.user!.id;

    // Verify ownership
    const existingEntry = await prisma.entry.findFirst({
      where: { id, userId },
      include: {
        entryTags: true
      }
    });

    if (!existingEntry) {
      res.status(404).json({ error: 'Entry not found' });
      return;
    }

    // If tagIds is being updated, verify all new tags exist and belong to user
    if (req.body.tagIds !== undefined) {
      const tags = await prisma.tag.findMany({
        where: {
          id: { in: req.body.tagIds },
          userId
        }
      });

      if (tags.length !== req.body.tagIds.length) {
        res.status(404).json({ error: 'One or more tags not found' });
        return;
      }
    }

    // Prepare update data
    const updateData: any = {};
    if (req.body.title !== undefined) updateData.title = req.body.title;
    if (req.body.timestamp) updateData.timestamp = new Date(req.body.timestamp);
    if (req.body.value !== undefined) updateData.value = req.body.value?.toString() || null;
    if (req.body.valueDisplay !== undefined) updateData.valueDisplay = req.body.valueDisplay || null;
    if (req.body.notes !== undefined) updateData.notes = req.body.notes;
    if (req.body.latitude !== undefined) updateData.latitude = req.body.latitude ?? null;
    if (req.body.longitude !== undefined) updateData.longitude = req.body.longitude ?? null;
    if (req.body.locationName !== undefined) updateData.locationName = req.body.locationName || null;

    // Re-extract hashtags when notes or title change
    if (req.body.notes !== undefined || req.body.title !== undefined) {
      const notesText = req.body.notes ?? existingEntry.notes ?? '';
      const titleText = req.body.title ?? existingEntry.title ?? '';
      const extractedHashtags = [
        ...extractHashtags(notesText),
        ...extractHashtags(titleText)
      ];
      updateData.hashtags = [...new Set(extractedHashtags)];
    }

    // Use transaction to update entry and tags atomically
    const entry = await prisma.$transaction(async (tx) => {
      // Update entry fields
      await tx.entry.update({
        where: { id },
        data: updateData
      });

      // Update tags if provided (replace all existing tags)
      if (req.body.tagIds !== undefined) {
        // Delete existing entry tags
        await tx.entryTag.deleteMany({
          where: { entryId: id }
        });

        // Create new entry tags
        await tx.entryTag.createMany({
          data: req.body.tagIds.map((tagId: string) => ({
            entryId: id,
            tagId
          }))
        });
      }

      // Return updated entry with tags
      return tx.entry.findUnique({
        where: { id },
        include: {
          entryTags: {
            include: {
              tag: true
            }
          }
        }
      });
    });

    if (!entry) {
      res.status(404).json({ error: 'Entry not found' });
      return;
    }

    res.json(formatEntry(entry));
  } catch (error) {
    next(error);
  }
});

/**
 * PATCH /api/entries/:id/archive
 * Archive or unarchive an entry
 */
router.patch('/:id/archive', async (req: AuthRequest, res, next): Promise<void> => {
  try {
    const { id } = req.params;
    const userId = req.user!.id;
    const { isArchived } = req.body;

    // Verify ownership
    const existingEntry = await prisma.entry.findFirst({
      where: { id, userId }
    });

    if (!existingEntry) {
      res.status(404).json({ error: 'Entry not found' });
      return;
    }

    // Update archive status
    const entry = await prisma.entry.update({
      where: { id },
      data: { isArchived: isArchived ?? true },
      include: {
        entryTags: {
          include: {
            tag: true
          }
        }
      }
    });

    res.json(formatEntry(entry));
  } catch (error) {
    next(error);
  }
});

/**
 * DELETE /api/entries/:id
 * Delete an entry
 */
router.delete('/:id', async (req: AuthRequest, res, next): Promise<void> => {
  try {
    const { id } = req.params;
    const userId = req.user!.id;

    // Verify ownership
    const entry = await prisma.entry.findFirst({
      where: { id, userId }
    });

    if (!entry) {
      res.status(404).json({ error: 'Entry not found' });
      return;
    }

    // Delete entry (cascade will delete entry tags)
    await prisma.entry.delete({
      where: { id }
    });

    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

export default router;
