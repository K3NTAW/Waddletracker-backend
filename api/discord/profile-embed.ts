import { VercelRequest, VercelResponse } from '@vercel/node';
import { prisma } from '../../src/lib/prisma';
import { createErrorResponse, createSuccessResponse } from '../../src/lib/validation';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json(createErrorResponse('Method not allowed', 405));
  }

  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const { discord_id } = req.query;

  if (!discord_id || typeof discord_id !== 'string') {
    return res.status(400).json(createErrorResponse('discord_id is required'));
  }

  try {
    // Get user by Discord ID
    const user = await prisma.user.findUnique({
      where: { discord_id },
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
          select: {
            id: true,
            date: true,
            status: true,
            photo_url: true,
          },
          orderBy: {
            date: 'desc',
          },
          take: 5,
        },
      },
    });

    if (!user) {
      return res.status(404).json(createErrorResponse('User not found', 404));
    }

    // Calculate additional stats
    const recentCheckIns = user.checkins;
    const wentCount = recentCheckIns.filter(c => c.status === 'went').length;
    const missedCount = recentCheckIns.filter(c => c.status === 'missed').length;
    const recentPhotos = recentCheckIns.filter(c => c.photo_url).length;

    // Create Discord embed data
    const embedData = {
      title: `👤 ${user.username}'s Profile`,
      description: user.bio || 'No bio set',
      color: 0x0099ff,
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
          name: '📸 Recent Photos',
          value: `${recentPhotos}/5`,
          inline: true,
        },
        {
          name: '✅ Recent Went',
          value: `${wentCount}/5`,
          inline: true,
        },
        {
          name: '❌ Recent Missed',
          value: `${missedCount}/5`,
          inline: true,
        },
        {
          name: '📅 Member Since',
          value: new Date(user.joined_at).toLocaleDateString(),
          inline: true,
        },
      ],
      footer: {
        text: 'Use /cheer @user to send encouragement!',
      },
      timestamp: new Date().toISOString(),
    };

    // Add recent check-ins as description if no bio
    if (!user.bio && recentCheckIns.length > 0) {
      const recentStatus = recentCheckIns.map(c => 
        `${c.status === 'went' ? '✅' : '❌'} ${new Date(c.date).toLocaleDateString()}`
      ).join('\n');
      
      embedData.fields.push({
        name: '📋 Recent Activity',
        value: recentStatus,
        inline: false,
      });
    }

    res.json(createSuccessResponse(embedData, 'Profile embed data generated'));
  } catch (error) {
    console.error('Generate profile embed error:', error);
    res.status(500).json(createErrorResponse('Failed to generate profile embed', 500));
  }
}
