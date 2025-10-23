import { VercelRequest, VercelResponse } from '@vercel/node';
import { verifyToken } from '../../src/lib/auth';
import { prisma } from '../../src/lib/prisma';
import { createScheduleSchema, createErrorResponse, createSuccessResponse } from '../../src/lib/validation';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method === 'POST') {
    // Verify authentication
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
      return res.status(401).json(createErrorResponse('Access token required', 401));
    }

    const authUser = verifyToken(token);
    if (!authUser) {
      return res.status(403).json(createErrorResponse('Invalid or expired token', 403));
    }

    try {
      const body = createScheduleSchema.parse(req.body);

      // Check if user already has a schedule
      const existingSchedule = await prisma.schedule.findFirst({
        where: { user_id: authUser.id },
      });

      let schedule;
      if (existingSchedule) {
        // Update existing schedule
        schedule = await prisma.schedule.update({
          where: { id: existingSchedule.id },
          data: {
            days_of_week: body.days_of_week,
            time: body.time,
          },
        });
      } else {
        // Create new schedule
        schedule = await prisma.schedule.create({
          data: {
            user_id: authUser.id,
            days_of_week: body.days_of_week,
            time: body.time,
          },
        });
      }

      res.status(201).json(createSuccessResponse(schedule, 'Schedule updated successfully'));
    } catch (error) {
      if (error instanceof Error && error.name === 'ZodError') {
        return res.status(400).json(createErrorResponse('Invalid input data', 400));
      }
      console.error('Create/update schedule error:', error);
      res.status(500).json(createErrorResponse('Failed to create/update schedule', 500));
    }
  } else {
    res.status(405).json(createErrorResponse('Method not allowed', 405));
  }
}
