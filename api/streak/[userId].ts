import { VercelRequest, VercelResponse } from '@vercel/node';
import { prisma } from '../../src/lib/prisma';
import { calculateStreak } from '../../src/lib/streak';
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
    const streakData = await calculateStreak(userId);
    res.json(createSuccessResponse(streakData));
  } catch (error) {
    if (error instanceof Error && error.message === 'User not found') {
      return res.status(404).json(createErrorResponse('User not found', 404));
    }
    console.error('Get streak error:', error);
    res.status(500).json(createErrorResponse('Failed to fetch streak data', 500));
  }
}
