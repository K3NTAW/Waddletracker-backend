import { VercelRequest, VercelResponse } from '@vercel/node';
import { prisma } from '../../src/lib/prisma';
import { createErrorResponse, createSuccessResponse } from '../../src/lib/validation';

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
    const cheers = await prisma.cheer.findMany({
      where: {
        to_user_id: userId,
      },
      include: {
        from_user: {
          select: {
            id: true,
            username: true,
            avatar_url: true,
          },
        },
      },
      orderBy: {
        created_at: 'desc',
      },
    });

    res.json(createSuccessResponse(cheers));
  } catch (error) {
    console.error('Get cheers error:', error);
    res.status(500).json(createErrorResponse('Failed to fetch cheers', 500));
  }
}
