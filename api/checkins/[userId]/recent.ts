import { VercelRequest, VercelResponse } from '@vercel/node';
import { prisma } from '../../../src/lib/prisma';
import { createErrorResponse, createSuccessResponse } from '../../../src/lib/validation';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json(createErrorResponse('Method not allowed', 405));
  }

  const { userId } = req.query;

  if (!userId || typeof userId !== 'string') {
    return res.status(400).json(createErrorResponse('User ID required'));
  }

  try {
    const recentCheckIns = await prisma.checkIn.findMany({
      where: {
        user_id: userId,
      },
      select: {
        id: true,
        date: true,
        status: true,
        photo_url: true,
        discord_message_id: true,
        created_at: true,
      },
      orderBy: {
        date: 'desc',
      },
      take: 5,
    });

    res.json(createSuccessResponse(recentCheckIns));
  } catch (error) {
    console.error('Get recent check-ins error:', error);
    res.status(500).json(createErrorResponse('Failed to fetch recent check-ins', 500));
  }
}
