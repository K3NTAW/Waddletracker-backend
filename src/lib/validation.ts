import { z } from 'zod';

// User validation schemas
export const updateUserSchema = z.object({
  bio: z.string().optional(),
  avatar_url: z.string().url().optional(),
});

// Check-in validation schemas
export const createCheckInSchema = z.object({
  date: z.string().datetime().optional().default(() => new Date().toISOString()),
  status: z.enum(['went', 'missed']),
  photo_url: z.string().url().optional(),
  discord_message_id: z.string().optional(),
});

// Schedule validation schemas
export const createScheduleSchema = z.object({
  days_of_week: z.array(z.string()).min(1).max(7),
  time: z.string().optional(),
});

// Cheer validation schemas
export const createCheerSchema = z.object({
  to_user_id: z.string().cuid(),
  message: z.string().max(500).optional(),
});

// Query validation schemas
export const userIdParamSchema = z.object({
  id: z.string().cuid(),
});

export const userIdQuerySchema = z.object({
  userId: z.string().cuid(),
});

// Error response helper
export const createErrorResponse = (message: string, statusCode: number = 400) => ({
  error: message,
  statusCode,
  timestamp: new Date().toISOString(),
});

// Success response helper
export const createSuccessResponse = (data: any, message?: string) => ({
  success: true,
  data,
  message,
  timestamp: new Date().toISOString(),
});
