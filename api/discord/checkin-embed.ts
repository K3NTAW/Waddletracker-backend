import { VercelRequest, VercelResponse } from '@vercel/node';
import { prisma } from '../../src/lib/prisma';
import { createErrorResponse, createSuccessResponse } from '../../src/lib/validation';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json(createErrorResponse('Method not allowed', 405));
  }

  try {
    const { user_id, checkin_id } = req.body;

    if (!user_id || !checkin_id) {
      return res.status(400).json(createErrorResponse('user_id and checkin_id are required'));
    }

    // Get user and check-in data for Discord embed
    const user = await prisma.user.findUnique({
      where: { id: user_id },
      select: {
        id: true,
        username: true,
        avatar_url: true,
        streak_count: true,
        longest_streak: true,
        total_checkins: true,
      },
    });

    const checkIn = await prisma.checkIn.findUnique({
      where: { id: checkin_id },
      select: {
        id: true,
        date: true,
        status: true,
        photo_url: true,
        discord_message_id: true,
        created_at: true,
      },
    });

    if (!user || !checkIn) {
      return res.status(404).json(createErrorResponse('User or check-in not found', 404));
    }

    // Create Discord embed data
    const embedData = {
      title: `🏋️ ${checkIn.status === 'went' ? 'Gym Check-In' : 'Missed Session'}`,
      description: `**${user.username}** ${checkIn.status === 'went' ? 'completed their workout!' : 'missed their scheduled session.'}`,
      color: checkIn.status === 'went' ? 0x00ff00 : 0xff0000,
      thumbnail: {
        url: user.avatar_url || 'https://cdn.discordapp.com/embed/avatars/0.png',
      },
      fields: [
        {
          name: '🔥 Current Streak',
          value: `${user.streak_count} days`,
          inline: true,
        },
        {
          name: '🏆 Longest Streak',
          value: `${user.longest_streak} days`,
          inline: true,
        },
        {
          name: '📊 Total Check-ins',
          value: `${user.total_checkins}`,
          inline: true,
        },
        {
          name: '📅 Date',
          value: new Date(checkIn.date).toLocaleDateString(),
          inline: true,
        },
        {
          name: '⏰ Time',
          value: new Date(checkIn.created_at).toLocaleTimeString(),
          inline: true,
        },
      ],
      footer: {
        text: checkIn.status === 'went' 
          ? 'Keep up the great work! 💪' 
          : 'Don\'t worry, tomorrow is a new day! 🌅',
      },
      timestamp: checkIn.created_at,
    };

    // Add photo if available
    if (checkIn.photo_url) {
      embedData.image = {
        url: checkIn.photo_url,
      };
    }

    res.json(createSuccessResponse(embedData, 'Discord embed data generated'));
  } catch (error) {
    console.error('Generate check-in embed error:', error);
    res.status(500).json(createErrorResponse('Failed to generate embed data', 500));
  }
}
