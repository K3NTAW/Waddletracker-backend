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

  const { limit = '10', period = 'all' } = req.query;

  try {
    const limitNum = parseInt(limit as string, 10);
    if (isNaN(limitNum) || limitNum < 1 || limitNum > 50) {
      return res.status(400).json(createErrorResponse('Limit must be between 1 and 50'));
    }

    // Calculate date filter based on period
    let dateFilter: any = {};
    let periodText = 'all time';

    if (period === 'week') {
      const weekAgo = new Date();
      weekAgo.setDate(weekAgo.getDate() - 7);
      dateFilter = { gte: weekAgo };
      periodText = 'this week';
    } else if (period === 'month') {
      const monthAgo = new Date();
      monthAgo.setMonth(monthAgo.getMonth() - 1);
      dateFilter = { gte: monthAgo };
      periodText = 'this month';
    } else if (period === 'year') {
      const yearAgo = new Date();
      yearAgo.setFullYear(yearAgo.getFullYear() - 1);
      dateFilter = { gte: yearAgo };
      periodText = 'this year';
    }

    // Get users with check-in counts
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
        checkins: {
          where: period !== 'all' ? {
            date: dateFilter,
            status: 'went',
          } : {
            status: 'went',
          },
          select: {
            id: true,
          },
        },
      },
    });

    // Calculate check-in counts and sort
    const usersWithCounts = users.map(user => ({
      ...user,
      checkin_count: period === 'all' ? user.total_checkins : user.checkins.length,
    })).sort((a, b) => b.checkin_count - a.checkin_count).slice(0, limitNum);

    // Create leaderboard data
    const leaderboard = usersWithCounts.map((user, index) => ({
      rank: index + 1,
      user: {
        id: user.id,
        discord_id: user.discord_id,
        username: user.username,
        avatar_url: user.avatar_url,
      },
      checkin_count: user.checkin_count,
      streak_count: user.streak_count,
      longest_streak: user.longest_streak,
      joined_at: user.joined_at,
    }));

    // Create Discord embed data
    const embedData = {
      title: '📊 Check-in Leaderboard',
      description: `Top ${limitNum} users by check-ins (${periodText})`,
      color: 0x00ff00,
      fields: leaderboard.map((entry, index) => ({
        name: `${getRankEmoji(entry.rank)} ${entry.user.username}`,
        value: `Check-ins: **${entry.checkin_count}**\nCurrent Streak: ${entry.streak_count} days`,
        inline: true,
      })),
      footer: {
        text: 'Consistency is key! 🎯',
      },
      timestamp: new Date().toISOString(),
    };

    res.json(createSuccessResponse({
      leaderboard,
      embed: embedData,
      period: periodText,
    }, 'Check-in leaderboard generated'));
  } catch (error) {
    console.error('Get check-in leaderboard error:', error);
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
