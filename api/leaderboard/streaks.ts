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

  const { limit = '10', type = 'current' } = req.query;

  try {
    const limitNum = parseInt(limit as string, 10);
    if (isNaN(limitNum) || limitNum < 1 || limitNum > 50) {
      return res.status(400).json(createErrorResponse('Limit must be between 1 and 50'));
    }

    let orderBy: any;
    let title: string;

    if (type === 'current') {
      orderBy = { streak_count: 'desc' };
      title = '🔥 Current Streak Leaderboard';
    } else if (type === 'longest') {
      orderBy = { longest_streak: 'desc' };
      title = '🏆 Longest Streak Leaderboard';
    } else {
      return res.status(400).json(createErrorResponse('Type must be "current" or "longest"'));
    }

    const users = await prisma.user.findMany({
      select: {
        id: true,
        discord_id: true,
        username: true,
        avatar_url: true,
        streak_count: true,
        longest_streak: true,
        total_checkins: true,
        joined_at: true,
      },
      orderBy,
      take: limitNum,
    });

    // Create leaderboard data
    const leaderboard = users.map((user, index) => ({
      rank: index + 1,
      user: {
        id: user.id,
        discord_id: user.discord_id,
        username: user.username,
        avatar_url: user.avatar_url,
      },
      streak_count: user.streak_count,
      longest_streak: user.longest_streak,
      total_checkins: user.total_checkins,
      joined_at: user.joined_at,
    }));

    // Create Discord embed data
    const embedData = {
      title,
      description: `Top ${limitNum} users by ${type === 'current' ? 'current streak' : 'longest streak'}`,
      color: 0xffd700,
      fields: leaderboard.map((entry, index) => ({
        name: `${getRankEmoji(entry.rank)} ${entry.user.username}`,
        value: `${type === 'current' ? 'Current' : 'Longest'}: **${type === 'current' ? entry.streak_count : entry.longest_streak}** days\nTotal: ${entry.total_checkins} check-ins`,
        inline: true,
      })),
      footer: {
        text: 'Keep pushing yourself! 💪',
      },
      timestamp: new Date().toISOString(),
    };

    res.json(createSuccessResponse({
      leaderboard,
      embed: embedData,
    }, 'Streak leaderboard generated'));
  } catch (error) {
    console.error('Get streak leaderboard error:', error);
    res.status(500).json(createErrorResponse('Failed to fetch leaderboard', 500));
  }
}

function getRankEmoji(rank: number): string {
  switch (rank) {
    case 1: return '🥇';
    case 2: return '🥈';
    case 3: return '🥉';
    default: return `${rank}.`;
  }
}
