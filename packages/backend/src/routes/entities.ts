import { Router } from 'express';
import { prisma } from '../db/client.js';
import { requireAuth, AuthRequest } from '../middleware/auth.js';
import { validate, createEntitySchema, updateEntitySchema } from '../middleware/validation.js';
import type { IEntity, ValueType } from '@trackly/shared';

const router: Router = Router();

// All routes require authentication
router.use(requireAuth);

/**
 * GET /api/entities
 * List all entities for the authenticated user
 */
router.get('/', async (req: AuthRequest, res, next): Promise<void> => {
  try {
    const userId = req.user!.id;

    const entities = await prisma.entity.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' }
    });

    // Convert to IEntity format
    const formattedEntities: IEntity[] = entities.map(entity => ({
      id: entity.id,
      name: entity.name,
      type: entity.type as any,
      categories: entity.categories,
      valueType: entity.valueType as ValueType | undefined,
      options: entity.options ? (entity.options as any) : undefined,
      properties: entity.properties ? (entity.properties as any) : undefined,
      createdAt: entity.createdAt.toISOString(),
      updatedAt: entity.updatedAt.toISOString()
    }));

    res.json(formattedEntities);
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/entities/:id
 * Get a single entity by ID
 */
router.get('/:id', async (req: AuthRequest, res, next): Promise<void> => {
  try {
    const { id } = req.params;
    const userId = req.user!.id;

    const entity = await prisma.entity.findFirst({
      where: { id, userId }
    });

    if (!entity) {
      res.status(404).json({ error: 'Entity not found' });
      return;
    }

    const formattedEntity: IEntity = {
      id: entity.id,
      name: entity.name,
      type: entity.type as any,
      categories: entity.categories,
      valueType: entity.valueType as ValueType | undefined,
      options: entity.options ? (entity.options as any) : undefined,
      properties: entity.properties ? (entity.properties as any) : undefined,
      createdAt: entity.createdAt.toISOString(),
      updatedAt: entity.updatedAt.toISOString()
    };

    res.json(formattedEntity);
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/entities
 * Create a new entity
 */
router.post('/', validate(createEntitySchema), async (req: AuthRequest, res, next): Promise<void> => {
  try {
    const userId = req.user!.id;
    const { name, type, categories, valueType, options, properties } = req.body;

    const entity = await prisma.entity.create({
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

    const formattedEntity: IEntity = {
      id: entity.id,
      name: entity.name,
      type: entity.type as any,
      categories: entity.categories,
      valueType: entity.valueType as ValueType | undefined,
      options: entity.options ? (entity.options as any) : undefined,
      properties: entity.properties ? (entity.properties as any) : undefined,
      createdAt: entity.createdAt.toISOString(),
      updatedAt: entity.updatedAt.toISOString()
    };

    res.status(201).json(formattedEntity);
  } catch (error) {
    next(error);
  }
});

/**
 * PUT /api/entities/:id
 * Update an entity
 */
router.put('/:id', validate(updateEntitySchema), async (req: AuthRequest, res, next): Promise<void> => {
  try {
    const { id } = req.params;
    const userId = req.user!.id;

    // Verify ownership
    const existingEntity = await prisma.entity.findFirst({
      where: { id, userId }
    });

    if (!existingEntity) {
      res.status(404).json({ error: 'Entity not found' });
      return;
    }

    // Update entity
    const entity = await prisma.entity.update({
      where: { id },
      data: req.body
    });

    const formattedEntity: IEntity = {
      id: entity.id,
      name: entity.name,
      type: entity.type as any,
      categories: entity.categories,
      valueType: entity.valueType as ValueType | undefined,
      options: entity.options ? (entity.options as any) : undefined,
      properties: entity.properties ? (entity.properties as any) : undefined,
      createdAt: entity.createdAt.toISOString(),
      updatedAt: entity.updatedAt.toISOString()
    };

    res.json(formattedEntity);
  } catch (error) {
    next(error);
  }
});

/**
 * DELETE /api/entities/:id
 * Delete an entity (cascade deletes all entries)
 */
router.delete('/:id', async (req: AuthRequest, res, next): Promise<void> => {
  try {
    const { id } = req.params;
    const userId = req.user!.id;

    // Verify ownership
    const entity = await prisma.entity.findFirst({
      where: { id, userId }
    });

    if (!entity) {
      res.status(404).json({ error: 'Entity not found' });
      return;
    }

    // Delete entity (cascade deletes entries)
    await prisma.entity.delete({
      where: { id }
    });

    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

export default router;
