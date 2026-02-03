import { z } from 'zod';
import { Request, Response, NextFunction } from 'express';

/**
 * Validation middleware factory
 */
export function validate(schema: z.ZodSchema) {
  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      schema.parse(req.body);
      next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({
          error: 'Validation failed',
          details: error.errors.map(e => ({
            path: e.path.join('.'),
            message: e.message
          }))
        });
        return;
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

// Tag validation schemas
export const createTagSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  type: z.string().min(1, 'Type is required'),
  categories: z.array(z.string()).optional().default([]),
  valueType: z.string().optional(),
  options: z.any().optional(),
  properties: z.any().optional()
});

export const updateTagSchema = z.object({
  name: z.string().min(1).optional(),
  type: z.string().min(1).optional(),
  categories: z.array(z.string()).optional(),
  valueType: z.string().optional(),
  options: z.any().optional(),
  properties: z.any().optional()
});

// Entry validation schemas
export const createEntrySchema = z.object({
  tagIds: z.array(z.string().min(1)).min(1, 'At least one tag is required'),
  title: z.string().min(1, 'Title is required'),
  timestamp: z.string().datetime('Invalid timestamp'),
  value: z.union([z.string(), z.number(), z.boolean()]).optional(),
  valueDisplay: z.string().optional(),
  notes: z.string().optional().default(''),
  latitude: z.number().optional(),
  longitude: z.number().optional(),
  locationName: z.string().optional(),
  ipoCategory: z.enum(['input', 'process', 'output']).optional()
});

export const updateEntrySchema = z.object({
  tagIds: z.array(z.string().min(1)).optional(),
  title: z.string().min(1, 'Title cannot be blank').optional(),
  timestamp: z.string().datetime().optional(),
  value: z.union([z.string(), z.number(), z.boolean()]).optional(),
  valueDisplay: z.string().optional(),
  notes: z.string().optional(),
  latitude: z.number().optional(),
  longitude: z.number().optional(),
  locationName: z.string().optional(),
  ipoCategory: z.enum(['input', 'process', 'output']).nullable().optional()
});
