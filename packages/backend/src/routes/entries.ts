import { Router } from 'express';
import { prisma } from '../db/client.js';
import { requireAuth, AuthRequest } from '../middleware/auth.js';
import { validate, createEntrySchema, updateEntrySchema } from '../middleware/validation.js';
import type { IEntry } from '@trackly/shared';

const router = Router();

// All routes require authentication
router.use(requireAuth);

/**
 * GET /api/entries
 * List all entries for the authenticated user
 * Optional query params: entityId (filter by entity)
 */
router.get('/', async (req: AuthRequest, res, next) => {
  try {
    const userId = req.user!.id;
    const { entityId } = req.query;

    const where: any = { userId };
    if (entityId) {
      where.entityId = entityId as string;
    }

    const entries = await prisma.entry.findMany({
      where,
      orderBy: { timestamp: 'desc' }
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
      propertyValues: entry.propertyValues ? (entry.propertyValues as any) : undefined,
      propertyValueDisplays: entry.propertyValueDisplays ? (entry.propertyValueDisplays as any) : undefined,
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
router.get('/:id', async (req: AuthRequest, res, next) => {
  try {
    const { id } = req.params;
    const userId = req.user!.id;

    const entry = await prisma.entry.findFirst({
      where: { id, userId }
    });

    if (!entry) {
      return res.status(404).json({ error: 'Entry not found' });
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
      propertyValues: entry.propertyValues ? (entry.propertyValues as any) : undefined,
      propertyValueDisplays: entry.propertyValueDisplays ? (entry.propertyValueDisplays as any) : undefined,
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
router.post('/', validate(createEntrySchema), async (req: AuthRequest, res, next) => {
  try {
    const userId = req.user!.id;
    const { entityId, timestamp, value, valueDisplay, notes, images, propertyValues, propertyValueDisplays } = req.body;

    // Verify entity exists and belongs to user
    const entity = await prisma.entity.findFirst({
      where: { id: entityId, userId }
    });

    if (!entity) {
      return res.status(404).json({ error: 'Entity not found' });
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
        propertyValues: propertyValues || null,
        propertyValueDisplays: propertyValueDisplays || null,
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
      propertyValues: entry.propertyValues ? (entry.propertyValues as any) : undefined,
      propertyValueDisplays: entry.propertyValueDisplays ? (entry.propertyValueDisplays as any) : undefined,
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
router.put('/:id', validate(updateEntrySchema), async (req: AuthRequest, res, next) => {
  try {
    const { id } = req.params;
    const userId = req.user!.id;

    // Verify ownership
    const existingEntry = await prisma.entry.findFirst({
      where: { id, userId }
    });

    if (!existingEntry) {
      return res.status(404).json({ error: 'Entry not found' });
    }

    // Prepare update data
    const updateData: any = {};
    if (req.body.timestamp) updateData.timestamp = new Date(req.body.timestamp);
    if (req.body.value !== undefined) updateData.value = req.body.value?.toString() || null;
    if (req.body.valueDisplay !== undefined) updateData.valueDisplay = req.body.valueDisplay || null;
    if (req.body.notes !== undefined) updateData.notes = req.body.notes;
    if (req.body.images !== undefined) updateData.images = req.body.images;
    if (req.body.propertyValues !== undefined) updateData.propertyValues = req.body.propertyValues;
    if (req.body.propertyValueDisplays !== undefined) updateData.propertyValueDisplays = req.body.propertyValueDisplays;

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
      propertyValues: entry.propertyValues ? (entry.propertyValues as any) : undefined,
      propertyValueDisplays: entry.propertyValueDisplays ? (entry.propertyValueDisplays as any) : undefined,
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
router.delete('/:id', async (req: AuthRequest, res, next) => {
  try {
    const { id } = req.params;
    const userId = req.user!.id;

    // Verify ownership
    const entry = await prisma.entry.findFirst({
      where: { id, userId }
    });

    if (!entry) {
      return res.status(404).json({ error: 'Entry not found' });
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
