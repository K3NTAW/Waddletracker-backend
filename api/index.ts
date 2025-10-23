import { VercelRequest, VercelResponse } from '@vercel/node';
import { prisma } from '../src/lib/prisma';
import { createErrorResponse, createSuccessResponse } from '../src/lib/validation';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const url = new URL(req.url || '', 'http://localhost');
  const path = url.pathname.replace('/api/', '');

  try {
    // Route to appropriate handler based on path
    switch (true) {
      case path === '':
        return handleMainAPI(req, res);
      case path.startsWith('auth/discord'):
        return handleDiscordAuth(req, res);
      case path.startsWith('auth/callback'):
        return handleAuthCallback(req, res);
      case path.startsWith('auth/me'):
        return handleAuthMe(req, res);
      case path.startsWith('users/') && path.endsWith('/photos'):
        return handleUserPhotos(req, res);
      case path.startsWith('users/'):
        return handleUserProfile(req, res);
      case path === 'checkins' && req.method === 'POST':
        return handleCheckinCreate(req, res);
      case path.startsWith('checkins/') && path.endsWith('/photos'):
        return handleCheckinPhotos(req, res);
      case path.startsWith('checkins/') && path.endsWith('/recent'):
        return handleCheckinRecent(req, res);
      case path.startsWith('checkins/'):
        return handleCheckinList(req, res);
      case path === 'schedules' && req.method === 'POST':
        return handleScheduleCreate(req, res);
      case path.startsWith('schedules/'):
        return handleScheduleGet(req, res);
      case path === 'cheers' && req.method === 'POST':
        return handleCheerSend(req, res);
      case path.startsWith('cheers/'):
        return handleCheerList(req, res);
      case path.startsWith('streak/'):
        return handleStreakGet(req, res);
      case path.startsWith('discord/checkin-embed'):
        return handleDiscordCheckinEmbed(req, res);
      case path.startsWith('discord/profile-embed'):
        return handleDiscordProfileEmbed(req, res);
      case path.startsWith('discord/cheer-embed'):
        return handleDiscordCheerEmbed(req, res);
      case path.startsWith('discord/webhook'):
        return handleDiscordWebhook(req, res);
      case path.startsWith('leaderboard/streaks'):
        return handleLeaderboardStreaks(req, res);
      case path.startsWith('leaderboard/checkins'):
        return handleLeaderboardCheckins(req, res);
      case path.startsWith('gallery/'):
        return handleGalleryPhotos(req, res);
      case path.startsWith('notifications/'):
        return handleNotificationsList(req, res);
      case path.startsWith('analytics/'):
        return handleAnalyticsGet(req, res);
      default:
        return res.status(404).json(createErrorResponse('Endpoint not found', 404));
    }
  } catch (error) {
    console.error('API Error:', error);
    return res.status(500).json(createErrorResponse('Internal server error', 500));
  }
}

// Main API endpoint
async function handleMainAPI(req: VercelRequest, res: VercelResponse) {
  const apiInfo = {
    message: 'WaddleTracker API',
    version: '2.0.0',
    endpoints: {
      auth: {
        discord: '/api/auth/discord',
        callback: '/api/auth/callback',
        me: '/api/auth/me'
      },
      users: {
        profile: '/api/users/:id',
        photos: '/api/users/:id/photos'
      },
      checkins: {
        create: '/api/checkins',
        list: '/api/checkins/:userId',
        recent: '/api/checkins/:userId/recent',
        photos: '/api/checkins/:userId/photos'
      },
      schedules: {
        create: '/api/schedules',
        get: '/api/schedules/:userId'
      },
      cheers: {
        send: '/api/cheers',
        list: '/api/cheers/:userId'
      },
      streaks: {
        get: '/api/streak/:userId'
      },
      discord: {
        checkin_embed: '/api/discord/checkin-embed',
        profile_embed: '/api/discord/profile-embed',
        cheer_embed: '/api/discord/cheer-embed',
        webhook: '/api/discord/webhook'
      },
      leaderboard: {
        streaks: '/api/leaderboard/streaks',
        checkins: '/api/leaderboard/checkins'
      },
      gallery: {
        user_photos: '/api/gallery/:userId'
      },
      notifications: {
        user_notifications: '/api/notifications/:userId'
      },
      analytics: {
        user_analytics: '/api/analytics/:userId'
      }
    },
    features: {
      discord_bot_integration: true,
      photo_gallery: true,
      notifications_system: true,
      leaderboards: true,
      analytics: true,
      webhook_support: true
    }
  };

  return res.json(apiInfo);
}

// Authentication handlers
async function handleDiscordAuth(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json(createErrorResponse('Method not allowed', 405));
  }

  const discordAuthUrl = `https://discord.com/api/oauth2/authorize?client_id=${process.env.DISCORD_CLIENT_ID}&redirect_uri=${process.env.DISCORD_REDIRECT_URI}&response_type=code&scope=identify`;
  return res.redirect(discordAuthUrl);
}

async function handleAuthCallback(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json(createErrorResponse('Method not allowed', 405));
  }

  const { code } = req.query;
  if (!code) {
    return res.status(400).json(createErrorResponse('Authorization code required'));
  }

  // TODO: Implement Discord OAuth callback logic
  return res.json(createSuccessResponse({ message: 'Auth callback - TODO: Implement OAuth logic' }));
}

async function handleAuthMe(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json(createErrorResponse('Method not allowed', 405));
  }

  // TODO: Implement JWT verification and user data retrieval
  return res.json(createSuccessResponse({ message: 'Auth me - TODO: Implement JWT verification' }));
}

// User handlers
async function handleUserProfile(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET' && req.method !== 'PATCH') {
    return res.status(405).json(createErrorResponse('Method not allowed', 405));
  }

  const url = new URL(req.url || '', 'http://localhost');
  const pathParts = url.pathname.split('/');
  const userId = pathParts[pathParts.length - 1];

  if (!userId) {
    return res.status(400).json(createErrorResponse('User ID required'));
  }

  try {
    if (req.method === 'GET') {
      const user = await prisma.user.findUnique({
        where: { id: userId },
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

      if (!user) {
        return res.status(404).json(createErrorResponse('User not found', 404));
      }

      return res.json(createSuccessResponse(user));
    } else {
      // PATCH method - update user
      const { bio, avatar_url } = req.body;
      const updatedUser = await prisma.user.update({
        where: { id: userId },
        data: { bio, avatar_url },
        select: {
          id: true,
          username: true,
          bio: true,
          avatar_url: true,
        },
      });

      return res.json(createSuccessResponse(updatedUser, 'User updated successfully'));
    }
  } catch (error) {
    console.error('User profile error:', error);
    return res.status(500).json(createErrorResponse('Failed to fetch/update user', 500));
  }
}

async function handleUserPhotos(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json(createErrorResponse('Method not allowed', 405));
  }

  const url = new URL(req.url || '', 'http://localhost');
  const pathParts = url.pathname.split('/');
  const userId = pathParts[pathParts.length - 2]; // photos is the last part

  if (!userId) {
    return res.status(400).json(createErrorResponse('User ID required'));
  }

  try {
    const photos = await prisma.checkIn.findMany({
      where: {
        user_id: userId,
        photo_url: { not: null },
      },
      select: {
        id: true,
        photo_url: true,
        date: true,
        status: true,
        created_at: true,
      },
      orderBy: { date: 'desc' },
    });

    return res.json(createSuccessResponse(photos));
  } catch (error) {
    console.error('User photos error:', error);
    return res.status(500).json(createErrorResponse('Failed to fetch user photos', 500));
  }
}

// Check-in handlers
async function handleCheckinCreate(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json(createErrorResponse('Method not allowed', 405));
  }

  // TODO: Implement check-in creation logic
  return res.json(createSuccessResponse({ message: 'Check-in create - TODO: Implement check-in logic' }));
}

async function handleCheckinList(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json(createErrorResponse('Method not allowed', 405));
  }

  const url = new URL(req.url || '', 'http://localhost');
  const pathParts = url.pathname.split('/');
  const userId = pathParts[pathParts.length - 1];

  if (!userId) {
    return res.status(400).json(createErrorResponse('User ID required'));
  }

  try {
    const checkIns = await prisma.checkIn.findMany({
      where: { user_id: userId },
      select: {
        id: true,
        date: true,
        status: true,
        photo_url: true,
        discord_message_id: true,
        created_at: true,
      },
      orderBy: { date: 'desc' },
    });

    return res.json(createSuccessResponse(checkIns));
  } catch (error) {
    console.error('Check-in list error:', error);
    return res.status(500).json(createErrorResponse('Failed to fetch check-ins', 500));
  }
}

async function handleCheckinRecent(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json(createErrorResponse('Method not allowed', 405));
  }

  const url = new URL(req.url || '', 'http://localhost');
  const pathParts = url.pathname.split('/');
  const userId = pathParts[pathParts.length - 2]; // recent is the last part

  if (!userId) {
    return res.status(400).json(createErrorResponse('User ID required'));
  }

  try {
    const recentCheckIns = await prisma.checkIn.findMany({
      where: { user_id: userId },
      select: {
        id: true,
        date: true,
        status: true,
        photo_url: true,
        discord_message_id: true,
        created_at: true,
      },
      orderBy: { date: 'desc' },
      take: 5,
    });

    return res.json(createSuccessResponse(recentCheckIns));
  } catch (error) {
    console.error('Recent check-ins error:', error);
    return res.status(500).json(createErrorResponse('Failed to fetch recent check-ins', 500));
  }
}

async function handleCheckinPhotos(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json(createErrorResponse('Method not allowed', 405));
  }

  const url = new URL(req.url || '', 'http://localhost');
  const pathParts = url.pathname.split('/');
  const userId = pathParts[pathParts.length - 2]; // photos is the last part

  if (!userId) {
    return res.status(400).json(createErrorResponse('User ID required'));
  }

  try {
    const checkInsWithPhotos = await prisma.checkIn.findMany({
      where: {
        user_id: userId,
        photo_url: { not: null },
      },
      select: {
        id: true,
        date: true,
        status: true,
        photo_url: true,
        discord_message_id: true,
        created_at: true,
      },
      orderBy: { date: 'desc' },
    });

    return res.json(createSuccessResponse(checkInsWithPhotos));
  } catch (error) {
    console.error('Check-ins with photos error:', error);
    return res.status(500).json(createErrorResponse('Failed to fetch check-ins with photos', 500));
  }
}

// Schedule handlers
async function handleScheduleCreate(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json(createErrorResponse('Method not allowed', 405));
  }

  // TODO: Implement schedule creation logic
  return res.json(createSuccessResponse({ message: 'Schedule create - TODO: Implement schedule logic' }));
}

async function handleScheduleGet(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json(createErrorResponse('Method not allowed', 405));
  }

  const url = new URL(req.url || '', 'http://localhost');
  const pathParts = url.pathname.split('/');
  const userId = pathParts[pathParts.length - 1];

  if (!userId) {
    return res.status(400).json(createErrorResponse('User ID required'));
  }

  try {
    const schedule = await prisma.schedule.findFirst({
      where: { user_id: userId },
      select: {
        id: true,
        days_of_week: true,
        time: true,
        created_at: true,
        updated_at: true,
      },
    });

    if (!schedule) {
      return res.status(404).json(createErrorResponse('Schedule not found', 404));
    }

    return res.json(createSuccessResponse(schedule));
  } catch (error) {
    console.error('Schedule get error:', error);
    return res.status(500).json(createErrorResponse('Failed to fetch schedule', 500));
  }
}

// Cheer handlers
async function handleCheerSend(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json(createErrorResponse('Method not allowed', 405));
  }

  // TODO: Implement cheer sending logic
  return res.json(createSuccessResponse({ message: 'Cheer send - TODO: Implement cheer logic' }));
}

async function handleCheerList(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json(createErrorResponse('Method not allowed', 405));
  }

  const url = new URL(req.url || '', 'http://localhost');
  const pathParts = url.pathname.split('/');
  const userId = pathParts[pathParts.length - 1];

  if (!userId) {
    return res.status(400).json(createErrorResponse('User ID required'));
  }

  try {
    const cheers = await prisma.cheer.findMany({
      where: { to_user_id: userId },
      include: {
        from_user: {
          select: {
            id: true,
            username: true,
            avatar_url: true,
          },
        },
      },
      orderBy: { created_at: 'desc' },
    });

    return res.json(createSuccessResponse(cheers));
  } catch (error) {
    console.error('Cheer list error:', error);
    return res.status(500).json(createErrorResponse('Failed to fetch cheers', 500));
  }
}

// Streak handler
async function handleStreakGet(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json(createErrorResponse('Method not allowed', 405));
  }

  const url = new URL(req.url || '', 'http://localhost');
  const pathParts = url.pathname.split('/');
  const userId = pathParts[pathParts.length - 1];

  if (!userId) {
    return res.status(400).json(createErrorResponse('User ID required'));
  }

  try {
    // TODO: Implement streak calculation logic
    const streakData = {
      current_streak: 0,
      longest_streak: 0,
      total_checkins: 0,
    };

    return res.json(createSuccessResponse(streakData));
  } catch (error) {
    console.error('Streak get error:', error);
    return res.status(500).json(createErrorResponse('Failed to fetch streak data', 500));
  }
}

// Discord handlers
async function handleDiscordCheckinEmbed(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json(createErrorResponse('Method not allowed', 405));
  }

  // TODO: Implement Discord check-in embed logic
  return res.json(createSuccessResponse({ message: 'Discord check-in embed - TODO: Implement embed logic' }));
}

async function handleDiscordProfileEmbed(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json(createErrorResponse('Method not allowed', 405));
  }

  // TODO: Implement Discord profile embed logic
  return res.json(createSuccessResponse({ message: 'Discord profile embed - TODO: Implement embed logic' }));
}

async function handleDiscordCheerEmbed(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json(createErrorResponse('Method not allowed', 405));
  }

  // TODO: Implement Discord cheer embed logic
  return res.json(createSuccessResponse({ message: 'Discord cheer embed - TODO: Implement embed logic' }));
}

async function handleDiscordWebhook(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json(createErrorResponse('Method not allowed', 405));
  }

  // TODO: Implement Discord webhook logic
  return res.json(createSuccessResponse({ message: 'Discord webhook - TODO: Implement webhook logic' }));
}

// Leaderboard handlers
async function handleLeaderboardStreaks(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json(createErrorResponse('Method not allowed', 405));
  }

  try {
    const { limit = '10', type = 'current' } = req.query;
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

    const embedData = {
      title,
      description: `Top ${limitNum} users by ${type === 'current' ? 'current streak' : 'longest streak'}`,
      color: 0xffd700,
      fields: leaderboard.map((entry) => ({
        name: `${getRankEmoji(entry.rank)} ${entry.user.username}`,
        value: `${type === 'current' ? 'Current' : 'Longest'}: **${type === 'current' ? entry.streak_count : entry.longest_streak}** days\nTotal: ${entry.total_checkins} check-ins`,
        inline: true,
      })),
      footer: { text: 'Keep pushing yourself! 💪' },
      timestamp: new Date().toISOString(),
    };

    return res.json(createSuccessResponse({
      leaderboard,
      embed: embedData,
    }, 'Streak leaderboard generated'));
  } catch (error) {
    console.error('Streak leaderboard error:', error);
    return res.status(500).json(createErrorResponse('Failed to fetch leaderboard', 500));
  }
}

async function handleLeaderboardCheckins(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json(createErrorResponse('Method not allowed', 405));
  }

  try {
    const { limit = '10', period = 'all' } = req.query;
    const limitNum = parseInt(limit as string, 10);

    if (isNaN(limitNum) || limitNum < 1 || limitNum > 50) {
      return res.status(400).json(createErrorResponse('Limit must be between 1 and 50'));
    }

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
          select: { id: true },
        },
      },
    });

    const usersWithCounts = users.map(user => ({
      ...user,
      checkin_count: period === 'all' ? user.total_checkins : user.checkins.length,
    })).sort((a, b) => b.checkin_count - a.checkin_count).slice(0, limitNum);

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

    const embedData = {
      title: '📊 Check-in Leaderboard',
      description: `Top ${limitNum} users by check-ins (${periodText})`,
      color: 0x00ff00,
      fields: leaderboard.map((entry) => ({
        name: `${getRankEmoji(entry.rank)} ${entry.user.username}`,
        value: `Check-ins: **${entry.checkin_count}**\nCurrent Streak: ${entry.streak_count} days`,
        inline: true,
      })),
      footer: { text: 'Consistency is key! 🎯' },
      timestamp: new Date().toISOString(),
    };

    return res.json(createSuccessResponse({
      leaderboard,
      embed: embedData,
      period: periodText,
    }, 'Check-in leaderboard generated'));
  } catch (error) {
    console.error('Check-in leaderboard error:', error);
    return res.status(500).json(createErrorResponse('Failed to fetch leaderboard', 500));
  }
}

// Gallery handler
async function handleGalleryPhotos(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json(createErrorResponse('Method not allowed', 405));
  }

  const url = new URL(req.url || '', 'http://localhost');
  const pathParts = url.pathname.split('/');
  const userId = pathParts[pathParts.length - 1];

  if (!userId) {
    return res.status(400).json(createErrorResponse('User ID required'));
  }

  try {
    const { 
      page = '1', 
      limit = '20', 
      status = 'all',
      year = 'all',
      month = 'all'
    } = req.query;

    const pageNum = parseInt(page as string, 10);
    const limitNum = parseInt(limit as string, 10);
    const skip = (pageNum - 1) * limitNum;

    if (isNaN(pageNum) || pageNum < 1) {
      return res.status(400).json(createErrorResponse('Page must be a positive number'));
    }

    if (isNaN(limitNum) || limitNum < 1 || limitNum > 100) {
      return res.status(400).json(createErrorResponse('Limit must be between 1 and 100'));
    }

    // Build date filter
    let dateFilter: any = {};
    if (year !== 'all') {
      const yearNum = parseInt(year as string, 10);
      if (!isNaN(yearNum)) {
        dateFilter.gte = new Date(yearNum, 0, 1);
        dateFilter.lt = new Date(yearNum + 1, 0, 1);
      }
    }

    if (month !== 'all' && year !== 'all') {
      const yearNum = parseInt(year as string, 10);
      const monthNum = parseInt(month as string, 10);
      if (!isNaN(yearNum) && !isNaN(monthNum) && monthNum >= 1 && monthNum <= 12) {
        dateFilter.gte = new Date(yearNum, monthNum - 1, 1);
        dateFilter.lt = new Date(yearNum, monthNum, 1);
      }
    }

    // Build status filter
    let statusFilter: any = {};
    if (status !== 'all') {
      statusFilter.status = status;
    }

    // Get user info
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        username: true,
        avatar_url: true,
        streak_count: true,
        longest_streak: true,
        total_checkins: true,
      },
    });

    if (!user) {
      return res.status(404).json(createErrorResponse('User not found', 404));
    }

    // Get check-ins with photos
    const whereClause = {
      user_id: userId,
      photo_url: { not: null },
      ...statusFilter,
      ...(Object.keys(dateFilter).length > 0 ? { date: dateFilter } : {}),
    };

    const [checkIns, totalCount] = await Promise.all([
      prisma.checkIn.findMany({
        where: whereClause,
        select: {
          id: true,
          date: true,
          status: true,
          photo_url: true,
          discord_message_id: true,
          created_at: true,
        },
        orderBy: { date: 'desc' },
        skip,
        take: limitNum,
      }),
      prisma.checkIn.count({ where: whereClause }),
    ]);

    // Get statistics
    const stats = await prisma.checkIn.groupBy({
      by: ['status'],
      where: {
        user_id: userId,
        photo_url: { not: null },
        ...(Object.keys(dateFilter).length > 0 ? { date: dateFilter } : {}),
      },
      _count: { status: true },
    });

    const statusCounts = stats.reduce((acc, stat) => {
      acc[stat.status] = stat._count.status;
      return acc;
    }, {} as Record<string, number>);

    // Get year/month options for filters
    const yearMonthOptions = await prisma.checkIn.findMany({
      where: {
        user_id: userId,
        photo_url: { not: null },
      },
      select: { date: true },
      orderBy: { date: 'desc' },
    });

    const years = [...new Set(yearMonthOptions.map(c => new Date(c.date).getFullYear()))].sort((a, b) => b - a);
    const months = [...new Set(yearMonthOptions.map(c => new Date(c.date).getMonth() + 1))].sort((a, b) => a - b);

    // Format response
    const photos = checkIns.map(checkIn => ({
      id: checkIn.id,
      date: checkIn.date,
      status: checkIn.status,
      photo_url: checkIn.photo_url,
      discord_message_id: checkIn.discord_message_id,
      created_at: checkIn.created_at,
      formatted_date: new Date(checkIn.date).toLocaleDateString(),
      formatted_time: new Date(checkIn.created_at).toLocaleTimeString(),
    }));

    const response = {
      user: {
        id: user.id,
        username: user.username,
        avatar_url: user.avatar_url,
        streak_count: user.streak_count,
        longest_streak: user.longest_streak,
        total_checkins: user.total_checkins,
      },
      photos,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total: totalCount,
        pages: Math.ceil(totalCount / limitNum),
        has_next: pageNum * limitNum < totalCount,
        has_prev: pageNum > 1,
      },
      filters: {
        status: status as string,
        year: year as string,
        month: month as string,
      },
      stats: {
        total_photos: totalCount,
        went_photos: statusCounts.went || 0,
        missed_photos: statusCounts.missed || 0,
      },
      filter_options: {
        years,
        months,
        statuses: ['all', 'went', 'missed'],
      },
    };

    return res.json(createSuccessResponse(response, 'Photo gallery retrieved'));
  } catch (error) {
    console.error('Photo gallery error:', error);
    return res.status(500).json(createErrorResponse('Failed to fetch photo gallery', 500));
  }
}

// Notifications handler
async function handleNotificationsList(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET' && req.method !== 'POST' && req.method !== 'PUT') {
    return res.status(405).json(createErrorResponse('Method not allowed', 405));
  }

  const url = new URL(req.url || '', 'http://localhost');
  const pathParts = url.pathname.split('/');
  const userId = pathParts[pathParts.length - 1];

  if (!userId) {
    return res.status(400).json(createErrorResponse('User ID required'));
  }

  try {
    if (req.method === 'GET') {
      const { 
        page = '1', 
        limit = '20', 
        type = 'all',
        unread_only = 'false'
      } = req.query;

      const pageNum = parseInt(page as string, 10);
      const limitNum = parseInt(limit as string, 10);
      const skip = (pageNum - 1) * limitNum;

      if (isNaN(pageNum) || pageNum < 1) {
        return res.status(400).json(createErrorResponse('Page must be a positive number'));
      }

      if (isNaN(limitNum) || limitNum < 1 || limitNum > 100) {
        return res.status(400).json(createErrorResponse('Limit must be between 1 and 100'));
      }

      // Build filters
      let whereClause: any = { to_user_id: userId };
      
      if (type !== 'all') {
        whereClause.type = type;
      }

      if (unread_only === 'true') {
        whereClause.read_at = null;
      }

      const [notifications, totalCount] = await Promise.all([
        prisma.notification.findMany({
          where: whereClause,
          include: {
            from_user: {
              select: {
                id: true,
                username: true,
                avatar_url: true,
              },
            },
          },
          orderBy: { created_at: 'desc' },
          skip,
          take: limitNum,
        }),
        prisma.notification.count({ where: whereClause }),
      ]);

      const response = {
        notifications,
        pagination: {
          page: pageNum,
          limit: limitNum,
          total: totalCount,
          pages: Math.ceil(totalCount / limitNum),
          has_next: pageNum * limitNum < totalCount,
          has_prev: pageNum > 1,
        },
        filters: {
          type: type as string,
          unread_only: unread_only === 'true',
        },
      };

      return res.json(createSuccessResponse(response, 'Notifications retrieved'));
    } else if (req.method === 'POST') {
      // Mark specific notifications as read
      const { notification_ids } = req.body;
      
      if (!Array.isArray(notification_ids)) {
        return res.status(400).json(createErrorResponse('notification_ids must be an array'));
      }

      await prisma.notification.updateMany({
        where: {
          id: { in: notification_ids },
          to_user_id: userId,
        },
        data: { read_at: new Date() },
      });

      return res.json(createSuccessResponse({ updated_count: notification_ids.length }, 'Notifications marked as read'));
    } else {
      // PUT method - mark all notifications as read
      const updatedCount = await prisma.notification.updateMany({
        where: {
          to_user_id: userId,
          read_at: null,
        },
        data: { read_at: new Date() },
      });

      return res.json(createSuccessResponse({ updated_count: updatedCount.count }, 'All notifications marked as read'));
    }
  } catch (error) {
    console.error('Notifications error:', error);
    return res.status(500).json(createErrorResponse('Failed to fetch/update notifications', 500));
  }
}

// Analytics handler
async function handleAnalyticsGet(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json(createErrorResponse('Method not allowed', 405));
  }

  const url = new URL(req.url || '', 'http://localhost');
  const pathParts = url.pathname.split('/');
  const userId = pathParts[pathParts.length - 1];

  if (!userId) {
    return res.status(400).json(createErrorResponse('User ID required'));
  }

  try {
    const { period = '30' } = req.query;
    const days = parseInt(period as string, 10);

    if (isNaN(days) || days < 1 || days > 365) {
      return res.status(400).json(createErrorResponse('Period must be between 1 and 365 days'));
    }

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    // Get user info
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        username: true,
        streak_count: true,
        longest_streak: true,
        total_checkins: true,
        joined_at: true,
      },
    });

    if (!user) {
      return res.status(404).json(createErrorResponse('User not found', 404));
    }

    // Get check-ins for the period
    const checkIns = await prisma.checkIn.findMany({
      where: {
        user_id: userId,
        date: { gte: startDate },
      },
      select: {
        id: true,
        date: true,
        status: true,
        photo_url: true,
        created_at: true,
      },
      orderBy: { date: 'asc' },
    });

    // Calculate analytics
    const totalCheckIns = checkIns.length;
    const wentCount = checkIns.filter(c => c.status === 'went').length;
    const missedCount = checkIns.filter(c => c.status === 'missed').length;
    const photoCount = checkIns.filter(c => c.photo_url).length;

    // Calculate attendance rate
    const attendanceRate = totalCheckIns > 0 ? (wentCount / totalCheckIns) * 100 : 0;

    const analytics = {
      user: {
        id: user.id,
        username: user.username,
        current_streak: user.streak_count,
        longest_streak: user.longest_streak,
        total_checkins: user.total_checkins,
        joined_at: user.joined_at,
      },
      period: {
        days,
        start_date: startDate,
        end_date: new Date(),
      },
      overview: {
        total_checkins: totalCheckIns,
        went_count: wentCount,
        missed_count: missedCount,
        photo_count: photoCount,
        attendance_rate: Math.round(attendanceRate * 100) / 100,
      },
    };

    return res.json(createSuccessResponse(analytics, 'Analytics data generated'));
  } catch (error) {
    console.error('Analytics error:', error);
    return res.status(500).json(createErrorResponse('Failed to fetch analytics', 500));
  }
}

// Helper function
function getRankEmoji(rank: number): string {
  switch (rank) {
    case 1: return '🥇';
    case 2: return '🥈';
    case 3: return '🥉';
    default: return `${rank}.`;
  }
}