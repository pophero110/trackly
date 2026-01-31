import { Router } from 'express';
import { prisma } from '../db/client.js';
import { requireAuth, AuthRequest } from '../middleware/auth.js';
import { validate, createEntrySchema, updateEntrySchema } from '../middleware/validation.js';
import { extractHashtags } from '../utils/tagExtractor.js';
import type { IEntry } from '@trackly/shared';

const router: Router = Router();

// All routes require authentication
router.use(requireAuth);

/**
 * GET /api/entries
 * List entries for the authenticated user with cursor-based pagination
 * Query params:
 *   - tagId (filter by tag)
 *   - includeArchived (include archived entries)
 *   - sortBy (field to sort by: timestamp, createdAt, tagName)
 *   - sortOrder (asc or desc, default: desc)
 *   - limit (page size, default: 30)
 *   - after (cursor: sort field value, ISO timestamp or string)
 *   - afterId (cursor: entry ID for tie-breaking)
 *   - hashtags (comma-separated list of hashtags to filter by, AND logic)
 */
router.get('/', async (req: AuthRequest, res, next): Promise<void> => {
  try {
    const userId = req.user!.id;
    const { tagId, includeArchived, sortBy, sortOrder, limit, after, afterId, hashtags } = req.query;

    // Base where clause
    const baseWhere: any = { userId };
    if (tagId) {
      baseWhere.tagId = tagId as string;
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
    const validSortFields = ['timestamp', 'createdAt', 'tagName', 'updatedAt'];
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
    const formattedEntries: IEntry[] = resultEntries.map(entry => ({
      id: entry.id,
      tagId: entry.tagId,
      tagName: entry.tagName,
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
    }));

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
 * GET /api/entries/:id
 * Get a single entry by ID
 */
router.get('/:id', async (req: AuthRequest, res, next): Promise<void> => {
  try {
    const { id } = req.params;
    const userId = req.user!.id;

    const entry = await prisma.entry.findFirst({
      where: { id, userId }
    });

    if (!entry) {
      res.status(404).json({ error: 'Entry not found' });
      return;
    }

    const formattedEntry: IEntry = {
      id: entry.id,
      tagId: entry.tagId,
      tagName: entry.tagName,
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

    res.json(formattedEntry);
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
    const { tagId, title, timestamp, value, valueDisplay, notes, latitude, longitude, locationName } = req.body;

    // Verify tag exists and belongs to user
    const tag = await prisma.tag.findFirst({
      where: { id: tagId, userId }
    });

    if (!tag) {
      res.status(404).json({ error: 'Tag not found' });
      return;
    }

    // Extract hashtags from notes and title
    const extractedHashtags = [
      ...extractHashtags(notes || ''),
      ...extractHashtags(title || '')
    ];
    // Deduplicate hashtags
    const hashtags = [...new Set(extractedHashtags)];

    // Create entry
    const entry = await prisma.entry.create({
      data: {
        tagId,
        tagName: tag.name,
        title,
        timestamp: new Date(timestamp),
        value: value?.toString() || null,
        valueDisplay: valueDisplay || null,
        notes: notes || '',
        hashtags,
        latitude: latitude ?? null,
        longitude: longitude ?? null,
        locationName: locationName || null,
        userId
      }
    });

    const formattedEntry: IEntry = {
      id: entry.id,
      tagId: entry.tagId,
      tagName: entry.tagName,
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

    res.status(201).json(formattedEntry);
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
      where: { id, userId }
    });

    if (!existingEntry) {
      res.status(404).json({ error: 'Entry not found' });
      return;
    }

    // If tagId is being updated, verify the new tag exists and belongs to user
    if (req.body.tagId && req.body.tagId !== existingEntry.tagId) {
      const newTag = await prisma.tag.findFirst({
        where: { id: req.body.tagId, userId }
      });

      if (!newTag) {
        res.status(404).json({ error: 'New tag not found' });
        return;
      }
    }

    // Prepare update data
    const updateData: any = {};
    if (req.body.tagId !== undefined) updateData.tagId = req.body.tagId;
    if (req.body.tagName !== undefined) updateData.tagName = req.body.tagName;
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

    // Update entry
    const entry = await prisma.entry.update({
      where: { id },
      data: updateData
    });

    const formattedEntry: IEntry = {
      id: entry.id,
      tagId: entry.tagId,
      tagName: entry.tagName,
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

    res.json(formattedEntry);
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
      data: { isArchived: isArchived ?? true }
    });

    const formattedEntry: IEntry = {
      id: entry.id,
      tagId: entry.tagId,
      tagName: entry.tagName,
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

    res.json(formattedEntry);
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

    // Delete entry
    await prisma.entry.delete({
      where: { id }
    });

    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

export default router;
