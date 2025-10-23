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

  const { id } = req.query;

  if (!id || typeof id !== 'string') {
    return res.status(400).json(createErrorResponse('User ID required'));
  }

  try {
    const photos = await prisma.checkIn.findMany({
      where: {
        user_id: id,
        photo_url: {
          not: null,
        },
      },
      select: {
        id: true,
        photo_url: true,
        date: true,
        status: true,
        created_at: true,
      },
      orderBy: {
        date: 'desc',
      },
    });

    res.json(createSuccessResponse(photos));
  } catch (error) {
    console.error('Get user photos error:', error);
    res.status(500).json(createErrorResponse('Failed to fetch user photos', 500));
  }
}
