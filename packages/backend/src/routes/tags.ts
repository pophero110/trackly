import { Router } from 'express';
import { prisma } from '../db/client.js';
import { requireAuth, AuthRequest } from '../middleware/auth.js';
import { validate, createTagSchema, updateTagSchema } from '../middleware/validation.js';
import type { ITag, ValueType } from '@trackly/shared';

const router: Router = Router();

// All routes require authentication
router.use(requireAuth);

/**
 * GET /api/tags
 * List all tags for the authenticated user
 */
router.get('/', async (req: AuthRequest, res, next): Promise<void> => {
  try {
    const userId = req.user!.id;

    const tags = await prisma.tag.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' }
    });

    // Convert to ITag format
    const formattedTags: ITag[] = tags.map(tag => ({
      id: tag.id,
      name: tag.name,
      type: tag.type as any,
      categories: tag.categories,
      valueType: tag.valueType as ValueType | undefined,
      options: tag.options ? (tag.options as any) : undefined,
      properties: tag.properties ? (tag.properties as any) : undefined,
      createdAt: tag.createdAt.toISOString(),
      updatedAt: tag.updatedAt.toISOString()
    }));

    res.json(formattedTags);
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/tags/:id
 * Get a single tag by ID
 */
router.get('/:id', async (req: AuthRequest, res, next): Promise<void> => {
  try {
    const { id } = req.params;
    const userId = req.user!.id;

    const tag = await prisma.tag.findFirst({
      where: { id, userId }
    });

    if (!tag) {
      res.status(404).json({ error: 'Tag not found' });
      return;
    }

    const formattedTag: ITag = {
      id: tag.id,
      name: tag.name,
      type: tag.type as any,
      categories: tag.categories,
      valueType: tag.valueType as ValueType | undefined,
      options: tag.options ? (tag.options as any) : undefined,
      properties: tag.properties ? (tag.properties as any) : undefined,
      createdAt: tag.createdAt.toISOString(),
      updatedAt: tag.updatedAt.toISOString()
    };

    res.json(formattedTag);
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/tags
 * Create a new tag
 */
router.post('/', validate(createTagSchema), async (req: AuthRequest, res, next): Promise<void> => {
  try {
    const userId = req.user!.id;
    const { name, type, categories, valueType, options, properties } = req.body;

    const tag = await prisma.tag.create({
      data: {
        name,
        type,
        categories: categories || [],
        valueType,
        options: options || null,
        properties: properties || null,
        userId
      }
    });

    const formattedTag: ITag = {
      id: tag.id,
      name: tag.name,
      type: tag.type as any,
      categories: tag.categories,
      valueType: tag.valueType as ValueType | undefined,
      options: tag.options ? (tag.options as any) : undefined,
      properties: tag.properties ? (tag.properties as any) : undefined,
      createdAt: tag.createdAt.toISOString(),
      updatedAt: tag.updatedAt.toISOString()
    };

    res.status(201).json(formattedTag);
  } catch (error) {
    next(error);
  }
});

/**
 * PUT /api/tags/:id
 * Update a tag
 */
router.put('/:id', validate(updateTagSchema), async (req: AuthRequest, res, next): Promise<void> => {
  try {
    const { id } = req.params;
    const userId = req.user!.id;

    // Verify ownership
    const existingTag = await prisma.tag.findFirst({
      where: { id, userId }
    });

    if (!existingTag) {
      res.status(404).json({ error: 'Tag not found' });
      return;
    }

    // Update tag
    const tag = await prisma.tag.update({
      where: { id },
      data: req.body
    });

    const formattedTag: ITag = {
      id: tag.id,
      name: tag.name,
      type: tag.type as any,
      categories: tag.categories,
      valueType: tag.valueType as ValueType | undefined,
      options: tag.options ? (tag.options as any) : undefined,
      properties: tag.properties ? (tag.properties as any) : undefined,
      createdAt: tag.createdAt.toISOString(),
      updatedAt: tag.updatedAt.toISOString()
    };

    res.json(formattedTag);
  } catch (error) {
    next(error);
  }
});

/**
 * DELETE /api/tags/:id
 * Delete a tag (cascade deletes all entries)
 */
router.delete('/:id', async (req: AuthRequest, res, next): Promise<void> => {
  try {
    const { id } = req.params;
    const userId = req.user!.id;

    // Verify ownership
    const tag = await prisma.tag.findFirst({
      where: { id, userId }
    });

    if (!tag) {
      res.status(404).json({ error: 'Tag not found' });
      return;
    }

    // Delete tag (cascade deletes entries)
    await prisma.tag.delete({
      where: { id }
    });

    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

export default router;
