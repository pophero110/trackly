import { Router } from 'express';
import { prisma } from '../db/client.js';
import { requireAuth, AuthRequest } from '../middleware/auth.js';
import { validate, createEntrySchema, updateEntrySchema } from '../middleware/validation.js';
import type { IEntry } from '@trackly/shared';

const router: Router = Router();

// All routes require authentication
router.use(requireAuth);

/**
 * GET /api/entries
 * List all entries for the authenticated user
 * Optional query params:
 *   - entityId (filter by entity)
 *   - includeArchived (include archived entries)
 *   - sortBy (field to sort by: timestamp, createdAt, entityName)
 *   - sortOrder (asc or desc, default: desc)
 */
router.get('/', async (req: AuthRequest, res, next): Promise<void> => {
  try {
    const userId = req.user!.id;
    const { entityId, includeArchived, sortBy, sortOrder } = req.query;

    const where: any = { userId };
    if (entityId) {
      where.entityId = entityId as string;
    }
    // By default, exclude archived entries unless explicitly requested
    if (includeArchived !== 'true') {
      where.isArchived = false;
    }

    // Determine sort field and order
    const validSortFields = ['timestamp', 'createdAt', 'entityName', 'updatedAt'];
    const sortField = validSortFields.includes(sortBy as string) ? (sortBy as string) : 'timestamp';
    const order = (sortOrder === 'asc' || sortOrder === 'desc') ? sortOrder : 'desc';

    const entries = await prisma.entry.findMany({
      where,
      // Use createdAt as tiebreaker for consistent ordering when primary field matches
      orderBy: [
        { [sortField]: order },
        { createdAt: order }
      ]
    });

    // Convert to IEntry format
    const formattedEntries: IEntry[] = entries.map(entry => ({
      id: entry.id,
      entityId: entry.entityId,
      entityName: entry.entityName,
      timestamp: entry.timestamp.toISOString(),
      value: entry.value || undefined,
      valueDisplay: entry.valueDisplay || undefined,
      notes: entry.notes || '',
      images: entry.images,
      links: entry.links,
      linkTitles: entry.linkTitles ? (entry.linkTitles as any) : undefined,
      entryReferences: entry.entryReferences,
      propertyValues: entry.propertyValues ? (entry.propertyValues as any) : undefined,
      propertyValueDisplays: entry.propertyValueDisplays ? (entry.propertyValueDisplays as any) : undefined,
      latitude: entry.latitude ?? undefined,
      longitude: entry.longitude ?? undefined,
      locationName: entry.locationName || undefined,
      isArchived: entry.isArchived,
      createdAt: entry.createdAt.toISOString(),
      updatedAt: entry.updatedAt.toISOString()
    }));

    res.json(formattedEntries);
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
      entityId: entry.entityId,
      entityName: entry.entityName,
      timestamp: entry.timestamp.toISOString(),
      value: entry.value || undefined,
      valueDisplay: entry.valueDisplay || undefined,
      notes: entry.notes || '',
      images: entry.images,
      links: entry.links,
      linkTitles: entry.linkTitles ? (entry.linkTitles as any) : undefined,
      entryReferences: entry.entryReferences,
      propertyValues: entry.propertyValues ? (entry.propertyValues as any) : undefined,
      propertyValueDisplays: entry.propertyValueDisplays ? (entry.propertyValueDisplays as any) : undefined,
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
    const { entityId, timestamp, value, valueDisplay, notes, images, links, linkTitles, entryReferences, propertyValues, propertyValueDisplays, latitude, longitude, locationName } = req.body;

    // Verify entity exists and belongs to user
    const entity = await prisma.entity.findFirst({
      where: { id: entityId, userId }
    });

    if (!entity) {
      res.status(404).json({ error: 'Entity not found' });
      return;
    }

    // Create entry
    const entry = await prisma.entry.create({
      data: {
        entityId,
        entityName: entity.name,
        timestamp: new Date(timestamp),
        value: value?.toString() || null,
        valueDisplay: valueDisplay || null,
        notes: notes || '',
        images: images || [],
        links: links || [],
        linkTitles: linkTitles || null,
        entryReferences: entryReferences || [],
        propertyValues: propertyValues || null,
        propertyValueDisplays: propertyValueDisplays || null,
        latitude: latitude ?? null,
        longitude: longitude ?? null,
        locationName: locationName || null,
        userId
      }
    });

    const formattedEntry: IEntry = {
      id: entry.id,
      entityId: entry.entityId,
      entityName: entry.entityName,
      timestamp: entry.timestamp.toISOString(),
      value: entry.value || undefined,
      valueDisplay: entry.valueDisplay || undefined,
      notes: entry.notes || '',
      images: entry.images,
      links: entry.links,
      linkTitles: entry.linkTitles ? (entry.linkTitles as any) : undefined,
      entryReferences: entry.entryReferences,
      propertyValues: entry.propertyValues ? (entry.propertyValues as any) : undefined,
      propertyValueDisplays: entry.propertyValueDisplays ? (entry.propertyValueDisplays as any) : undefined,
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

    // If entityId is being updated, verify the new entity exists and belongs to user
    if (req.body.entityId && req.body.entityId !== existingEntry.entityId) {
      const newEntity = await prisma.entity.findFirst({
        where: { id: req.body.entityId, userId }
      });

      if (!newEntity) {
        res.status(404).json({ error: 'New entity not found' });
        return;
      }
    }

    // Prepare update data
    const updateData: any = {};
    if (req.body.entityId !== undefined) updateData.entityId = req.body.entityId;
    if (req.body.entityName !== undefined) updateData.entityName = req.body.entityName;
    if (req.body.timestamp) updateData.timestamp = new Date(req.body.timestamp);
    if (req.body.value !== undefined) updateData.value = req.body.value?.toString() || null;
    if (req.body.valueDisplay !== undefined) updateData.valueDisplay = req.body.valueDisplay || null;
    if (req.body.notes !== undefined) updateData.notes = req.body.notes;
    if (req.body.images !== undefined) updateData.images = req.body.images;
    if (req.body.links !== undefined) updateData.links = req.body.links;
    if (req.body.linkTitles !== undefined) updateData.linkTitles = req.body.linkTitles;
    if (req.body.entryReferences !== undefined) updateData.entryReferences = req.body.entryReferences;
    if (req.body.propertyValues !== undefined) updateData.propertyValues = req.body.propertyValues;
    if (req.body.propertyValueDisplays !== undefined) updateData.propertyValueDisplays = req.body.propertyValueDisplays;
    if (req.body.latitude !== undefined) updateData.latitude = req.body.latitude ?? null;
    if (req.body.longitude !== undefined) updateData.longitude = req.body.longitude ?? null;
    if (req.body.locationName !== undefined) updateData.locationName = req.body.locationName || null;

    // Update entry
    const entry = await prisma.entry.update({
      where: { id },
      data: updateData
    });

    const formattedEntry: IEntry = {
      id: entry.id,
      entityId: entry.entityId,
      entityName: entry.entityName,
      timestamp: entry.timestamp.toISOString(),
      value: entry.value || undefined,
      valueDisplay: entry.valueDisplay || undefined,
      notes: entry.notes || '',
      images: entry.images,
      links: entry.links,
      linkTitles: entry.linkTitles ? (entry.linkTitles as any) : undefined,
      entryReferences: entry.entryReferences,
      propertyValues: entry.propertyValues ? (entry.propertyValues as any) : undefined,
      propertyValueDisplays: entry.propertyValueDisplays ? (entry.propertyValueDisplays as any) : undefined,
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
      entityId: entry.entityId,
      entityName: entry.entityName,
      timestamp: entry.timestamp.toISOString(),
      value: entry.value || undefined,
      valueDisplay: entry.valueDisplay || undefined,
      notes: entry.notes || '',
      images: entry.images,
      links: entry.links,
      linkTitles: entry.linkTitles ? (entry.linkTitles as any) : undefined,
      entryReferences: entry.entryReferences,
      propertyValues: entry.propertyValues ? (entry.propertyValues as any) : undefined,
      propertyValueDisplays: entry.propertyValueDisplays ? (entry.propertyValueDisplays as any) : undefined,
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
