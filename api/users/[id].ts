import { VercelRequest, VercelResponse } from '@vercel/node';
import { verifyToken } from '../../src/lib/auth';
import { prisma } from '../../src/lib/prisma';
import { updateUserSchema, createErrorResponse, createSuccessResponse } from '../../src/lib/validation';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const { id } = req.query;

  if (!id || typeof id !== 'string') {
    return res.status(400).json(createErrorResponse('User ID required'));
  }

  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, PATCH, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method === 'GET') {
    try {
      const user = await prisma.user.findUnique({
        where: { id },
        select: {
          id: true,
          discord_id: true,
          username: true,
          avatar_url: true,
          bio: true,
          joined_at: true,
          streak_count: true,
          longest_streak: true,
          total_checkins: true,
          checkins: {
            where: {
              photo_url: {
                not: null,
              },
            },
            select: {
              photo_url: true,
              date: true,
            },
            orderBy: {
              date: 'desc',
            },
          },
        },
      });

      if (!user) {
        return res.status(404).json(createErrorResponse('User not found', 404));
      }

      res.json(createSuccessResponse(user));
    } catch (error) {
      console.error('Get user error:', error);
      res.status(500).json(createErrorResponse('Failed to fetch user data', 500));
    }
  } else if (req.method === 'PATCH') {
    // Verify authentication
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
      return res.status(401).json(createErrorResponse('Access token required', 401));
    }

    const authUser = verifyToken(token);
    if (!authUser || authUser.id !== id) {
      return res.status(403).json(createErrorResponse('Unauthorized', 403));
    }

    try {
      const body = updateUserSchema.parse(req.body);
      
      const updatedUser = await prisma.user.update({
        where: { id },
        data: body,
        select: {
          id: true,
          discord_id: true,
          username: true,
          avatar_url: true,
          bio: true,
          joined_at: true,
          streak_count: true,
          longest_streak: true,
          total_checkins: true,
        },
      });

      res.json(createSuccessResponse(updatedUser, 'User updated successfully'));
    } catch (error) {
      if (error instanceof Error && error.name === 'ZodError') {
        return res.status(400).json(createErrorResponse('Invalid input data', 400));
      }
      console.error('Update user error:', error);
      res.status(500).json(createErrorResponse('Failed to update user', 500));
    }
  } else {
    res.status(405).json(createErrorResponse('Method not allowed', 405));
  }
}
