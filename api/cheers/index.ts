import { VercelRequest, VercelResponse } from '@vercel/node';
import { verifyToken } from '../../src/lib/auth';
import { prisma } from '../../src/lib/prisma';
import { createCheerSchema, createErrorResponse, createSuccessResponse } from '../../src/lib/validation';

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
      const body = createCheerSchema.parse(req.body);

      // Check if target user exists
      const targetUser = await prisma.user.findUnique({
        where: { id: body.to_user_id },
      });

      if (!targetUser) {
        return res.status(404).json(createErrorResponse('Target user not found', 404));
      }

      // Prevent self-cheering
      if (authUser.id === body.to_user_id) {
        return res.status(400).json(createErrorResponse('Cannot cheer yourself', 400));
      }

      // Create cheer
      const cheer = await prisma.cheer.create({
        data: {
          from_user_id: authUser.id,
          to_user_id: body.to_user_id,
          message: body.message,
        },
        include: {
          from_user: {
            select: {
              id: true,
              username: true,
              avatar_url: true,
            },
          },
          to_user: {
            select: {
              id: true,
              username: true,
              avatar_url: true,
            },
          },
        },
      });

      res.status(201).json(createSuccessResponse(cheer, 'Cheer sent successfully'));
    } catch (error) {
      if (error instanceof Error && error.name === 'ZodError') {
        return res.status(400).json(createErrorResponse('Invalid input data', 400));
      }
      console.error('Create cheer error:', error);
      res.status(500).json(createErrorResponse('Failed to send cheer', 500));
    }
  } else {
    res.status(405).json(createErrorResponse('Method not allowed', 405));
  }
}
