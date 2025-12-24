import { z } from 'zod';
import { Request, Response, NextFunction } from 'express';

/**
 * Validation middleware factory
 */
export function validate(schema: z.ZodSchema) {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      schema.parse(req.body);
      next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          error: 'Validation failed',
          details: error.errors.map(e => ({
            path: e.path.join('.'),
            message: e.message
          }))
        });
      }
      next(error);
    }
  };
}

// Auth validation schemas
export const registerSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  name: z.string().optional()
});

export const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required')
});

// Entity validation schemas
export const createEntitySchema = z.object({
  name: z.string().min(1, 'Name is required'),
  type: z.string().min(1, 'Type is required'),
  categories: z.array(z.string()).optional().default([]),
  valueType: z.string().optional(),
  options: z.any().optional(),
  properties: z.any().optional()
});

export const updateEntitySchema = z.object({
  name: z.string().min(1).optional(),
  type: z.string().min(1).optional(),
  categories: z.array(z.string()).optional(),
  valueType: z.string().optional(),
  options: z.any().optional(),
  properties: z.any().optional()
});

// Entry validation schemas
export const createEntrySchema = z.object({
  entityId: z.string().min(1, 'Entity ID is required'),
  timestamp: z.string().datetime('Invalid timestamp'),
  value: z.union([z.string(), z.number(), z.boolean()]).optional(),
  valueDisplay: z.string().optional(),
  notes: z.string().optional().default(''),
  images: z.array(z.string()).optional().default([]),
  propertyValues: z.record(z.union([z.string(), z.number(), z.boolean()])).optional(),
  propertyValueDisplays: z.record(z.string()).optional()
});

export const updateEntrySchema = z.object({
  timestamp: z.string().datetime().optional(),
  value: z.union([z.string(), z.number(), z.boolean()]).optional(),
  valueDisplay: z.string().optional(),
  notes: z.string().optional(),
  images: z.array(z.string()).optional(),
  propertyValues: z.record(z.union([z.string(), z.number(), z.boolean()])).optional(),
  propertyValueDisplays: z.record(z.string()).optional()
});
