import { VercelRequest, VercelResponse } from '@vercel/node';
import { prisma } from '../../src/lib/prisma';
import { createErrorResponse, createSuccessResponse } from '../../src/lib/validation';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json(createErrorResponse('Method not allowed', 405));
  }

  const { userId } = req.query;

  if (!userId || typeof userId !== 'string') {
    return res.status(400).json(createErrorResponse('User ID required'));
  }

  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    const schedule = await prisma.schedule.findFirst({
      where: {
        user_id: userId,
      },
      select: {
        id: true,
        days_of_week: true,
        time: true,
        created_at: true,
        updated_at: true,
      },
    });

    if (!schedule) {
      return res.status(404).json(createErrorResponse('Schedule not found', 404));
    }

    res.json(createSuccessResponse(schedule));
  } catch (error) {
    console.error('Get schedule error:', error);
    res.status(500).json(createErrorResponse('Failed to fetch schedule', 500));
  }
}
