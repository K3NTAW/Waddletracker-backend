import { VercelRequest, VercelResponse } from '@vercel/node';
import { z } from 'zod';

export const validateRequest = <T>(
  schema: z.ZodSchema<T>,
  req: VercelRequest,
  res: VercelResponse
): T | null => {
  try {
    return schema.parse(req.body);
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({
        error: 'Validation failed',
        details: error.errors.map(err => ({
          field: err.path.join('.'),
          message: err.message,
        })),
        statusCode: 400,
        timestamp: new Date().toISOString(),
      });
    } else {
      res.status(500).json({
        error: 'Internal server error',
        statusCode: 500,
        timestamp: new Date().toISOString(),
      });
    }
    return null;
  }
};

export const validateQuery = <T>(
  schema: z.ZodSchema<T>,
  req: VercelRequest,
  res: VercelResponse
): T | null => {
  try {
    return schema.parse(req.query);
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({
        error: 'Query validation failed',
        details: error.errors.map(err => ({
          field: err.path.join('.'),
          message: err.message,
        })),
        statusCode: 400,
        timestamp: new Date().toISOString(),
      });
    } else {
      res.status(500).json({
        error: 'Internal server error',
        statusCode: 500,
        timestamp: new Date().toISOString(),
      });
    }
    return null;
  }
};
