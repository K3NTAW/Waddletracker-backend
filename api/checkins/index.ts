import { VercelRequest, VercelResponse } from '@vercel/node';
import { verifyToken } from '../../src/lib/auth';
import { prisma } from '../../src/lib/prisma';
import { createCheckInSchema, createErrorResponse, createSuccessResponse } from '../../src/lib/validation';
import { updateStreak } from '../../src/lib/streak';

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
      const body = createCheckInSchema.parse(req.body);
      const checkInDate = new Date(body.date);

      // Check if check-in already exists for this date
      const existingCheckIn = await prisma.checkIn.findUnique({
        where: {
          user_id_date: {
            user_id: authUser.id,
            date: checkInDate,
          },
        },
      });

      if (existingCheckIn) {
        return res.status(409).json(createErrorResponse('Check-in already exists for this date', 409));
      }

      // Create check-in
      const checkIn = await prisma.checkIn.create({
        data: {
          user_id: authUser.id,
          date: checkInDate,
          status: body.status,
          photo_url: body.photo_url,
          discord_message_id: body.discord_message_id,
        },
      });

      // Update streak
      await updateStreak(authUser.id, checkInDate, body.status);

      // Get updated user data
      const updatedUser = await prisma.user.findUnique({
        where: { id: authUser.id },
        select: {
          streak_count: true,
          longest_streak: true,
          total_checkins: true,
        },
      });

      res.status(201).json(createSuccessResponse({
        checkIn,
        streak: updatedUser,
      }, 'Check-in created successfully'));
    } catch (error) {
      if (error instanceof Error && error.name === 'ZodError') {
        return res.status(400).json(createErrorResponse('Invalid input data', 400));
      }
      console.error('Create check-in error:', error);
      res.status(500).json(createErrorResponse('Failed to create check-in', 500));
    }
  } else {
    res.status(405).json(createErrorResponse('Method not allowed', 405));
  }
}
