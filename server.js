const express = require('express');
const cors = require('cors');
const { PrismaClient } = require('@prisma/client');
const jwt = require('jsonwebtoken');
const axios = require('axios');

const app = express();
const prisma = new PrismaClient();

// Middleware
app.use(cors());
app.use(express.json());

// Auth middleware
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  try {
    const user = jwt.verify(token, process.env.JWT_SECRET);
    req.user = user;
    next();
  } catch (error) {
    return res.status(403).json({ error: 'Invalid or expired token' });
  }
};

// Helper functions
const createErrorResponse = (message, statusCode = 400) => ({
  error: message,
  statusCode,
  timestamp: new Date().toISOString(),
});

const createSuccessResponse = (data, message) => ({
  success: true,
  data,
  message,
  timestamp: new Date().toISOString(),
});

// ============================================================================
// MAIN API ENDPOINT
// ============================================================================
app.get('/api', (req, res) => {
  res.json({
    message: 'WaddleTracker API',
    version: '2.0.0',
    endpoints: {
      auth: {
        discord: '/api/auth/discord',
        callback: '/api/auth/callback',
        me: '/api/auth/me',
      },
      users: {
        profile: '/api/users/:id',
        photos: '/api/users/:id/photos',
      },
      checkins: {
        create: '/api/checkins',
        list: '/api/checkins/:userId',
        recent: '/api/checkins/:userId/recent',
        photos: '/api/checkins/:userId/photos',
      },
      schedules: {
        create: '/api/schedules',
        get: '/api/schedules/:userId',
      },
      cheers: {
        send: '/api/cheers',
        list: '/api/cheers/:userId',
      },
      streaks: {
        get: '/api/streak/:userId',
      },
      discord: {
        checkin_embed: '/api/discord/checkin-embed',
        profile_embed: '/api/discord/profile-embed',
        cheer_embed: '/api/discord/cheer-embed',
        webhook: '/api/discord/webhook',
      },
      leaderboard: {
        streaks: '/api/leaderboard/streaks',
        checkins: '/api/leaderboard/checkins',
      },
      gallery: {
        user_photos: '/api/gallery/:userId',
      },
      notifications: {
        user_notifications: '/api/notifications/:userId',
      },
      analytics: {
        user_analytics: '/api/analytics/:userId',
      },
    },
    features: {
      discord_bot_integration: true,
      photo_gallery: true,
      notifications_system: true,
      leaderboards: true,
      analytics: true,
      webhook_support: true,
    },
  });
});

// ============================================================================
// AUTHENTICATION ENDPOINTS
// ============================================================================
app.get('/api/auth/discord', (req, res) => {
  const discordAuthUrl = new URL('https://discord.com/api/oauth2/authorize');
  discordAuthUrl.searchParams.set('client_id', process.env.DISCORD_CLIENT_ID);
  discordAuthUrl.searchParams.set('redirect_uri', process.env.DISCORD_REDIRECT_URI);
  discordAuthUrl.searchParams.set('response_type', 'code');
  discordAuthUrl.searchParams.set('scope', 'identify');

  res.redirect(discordAuthUrl.toString());
});

app.get('/api/auth/callback', async (req, res) => {
  const { code } = req.query;

  if (!code) {
    return res.status(400).json(createErrorResponse('Authorization code required'));
  }

  try {
    // Exchange code for access token
    const tokenResponse = await axios.post('https://discord.com/api/oauth2/token', {
      client_id: process.env.DISCORD_CLIENT_ID,
      client_secret: process.env.DISCORD_CLIENT_SECRET,
      grant_type: 'authorization_code',
      code,
      redirect_uri: process.env.DISCORD_REDIRECT_URI,
    }, {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
    });

    const { access_token } = tokenResponse.data;

    // Get user info from Discord
    const userResponse = await axios.get('https://discord.com/api/users/@me', {
      headers: {
        Authorization: `Bearer ${access_token}`,
      },
    });

    const discordUser = userResponse.data;

    // Find or create user in database
    let user = await prisma.user.findUnique({
      where: { discord_id: discordUser.id },
    });

    if (!user) {
      user = await prisma.user.create({
        data: {
          discord_id: discordUser.id,
          username: discordUser.username,
          avatar_url: discordUser.avatar 
            ? `https://cdn.discordapp.com/avatars/${discordUser.id}/${discordUser.avatar}.png`
            : null,
        },
      });
    } else {
      // Update user info
      user = await prisma.user.update({
        where: { id: user.id },
        data: {
          username: discordUser.username,
          avatar_url: discordUser.avatar 
            ? `https://cdn.discordapp.com/avatars/${discordUser.id}/${discordUser.avatar}.png`
            : null,
        },
      });
    }

    // Generate JWT token
    const token = jwt.sign({
      id: user.id,
      discord_id: user.discord_id,
      username: user.username,
    }, process.env.JWT_SECRET, { expiresIn: '7d' });

    // Redirect to frontend with token
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    res.redirect(`${frontendUrl}/auth/success?token=${token}`);
  } catch (error) {
    console.error('Discord OAuth error:', error);
    res.status(500).json(createErrorResponse('Authentication failed', 500));
  }
});

app.get('/api/auth/me', authenticateToken, async (req, res) => {
  try {
    const userData = await prisma.user.findUnique({
      where: { id: req.user.id },
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

    if (!userData) {
      return res.status(404).json(createErrorResponse('User not found', 404));
    }

    res.json(createSuccessResponse(userData));
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json(createErrorResponse('Failed to fetch user data', 500));
  }
});

// ============================================================================
// USER ENDPOINTS
// ============================================================================
app.get('/api/users/:id', async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.params.id },
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
});

app.patch('/api/users/:id', authenticateToken, async (req, res) => {
  if (req.user.id !== req.params.id) {
    return res.status(403).json(createErrorResponse('Unauthorized', 403));
  }

  try {
    const { bio, avatar_url } = req.body;
    
    const updatedUser = await prisma.user.update({
      where: { id: req.params.id },
      data: { bio, avatar_url },
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
    console.error('Update user error:', error);
    res.status(500).json(createErrorResponse('Failed to update user', 500));
  }
});

app.get('/api/users/:id/photos', async (req, res) => {
  try {
    const photos = await prisma.checkIn.findMany({
      where: {
        user_id: req.params.id,
        photo_url: {
          not: null,
        },
      },
      select: {
        id: true,
        photo_url: true,
        date: true,
        status: true,
        created_at: true,
      },
      orderBy: {
        date: 'desc',
      },
    });

    res.json(createSuccessResponse(photos));
  } catch (error) {
    console.error('Get user photos error:', error);
    res.status(500).json(createErrorResponse('Failed to fetch user photos', 500));
  }
});

// ============================================================================
// CHECK-IN ENDPOINTS
// ============================================================================
app.post('/api/checkins', authenticateToken, async (req, res) => {
  try {
    const { date, status, photo_url, discord_message_id } = req.body;
    const checkInDate = new Date(date || new Date());

    // Check if check-in already exists for this date
    const existingCheckIn = await prisma.checkIn.findUnique({
      where: {
        user_id_date: {
          user_id: req.user.id,
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
        user_id: req.user.id,
        date: checkInDate,
        status,
        photo_url,
        discord_message_id,
      },
    });

    // Update streak
    await updateStreak(req.user.id, checkInDate, status);

    // Get updated user data
    const updatedUser = await prisma.user.findUnique({
      where: { id: req.user.id },
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
    console.error('Create check-in error:', error);
    res.status(500).json(createErrorResponse('Failed to create check-in', 500));
  }
});

app.get('/api/checkins/:userId', async (req, res) => {
  try {
    const checkIns = await prisma.checkIn.findMany({
      where: {
        user_id: req.params.userId,
      },
      select: {
        id: true,
        date: true,
        status: true,
        photo_url: true,
        discord_message_id: true,
        created_at: true,
      },
      orderBy: {
        date: 'desc',
      },
    });

    res.json(createSuccessResponse(checkIns));
  } catch (error) {
    console.error('Get check-ins error:', error);
    res.status(500).json(createErrorResponse('Failed to fetch check-ins', 500));
  }
});

app.get('/api/checkins/:userId/recent', async (req, res) => {
  try {
    const recentCheckIns = await prisma.checkIn.findMany({
      where: {
        user_id: req.params.userId,
      },
      select: {
        id: true,
        date: true,
        status: true,
        photo_url: true,
        discord_message_id: true,
        created_at: true,
      },
      orderBy: {
        date: 'desc',
      },
      take: 5,
    });

    res.json(createSuccessResponse(recentCheckIns));
  } catch (error) {
    console.error('Get recent check-ins error:', error);
    res.status(500).json(createErrorResponse('Failed to fetch recent check-ins', 500));
  }
});

app.get('/api/checkins/:userId/photos', async (req, res) => {
  try {
    const checkInsWithPhotos = await prisma.checkIn.findMany({
      where: {
        user_id: req.params.userId,
        photo_url: {
          not: null,
        },
      },
      select: {
        id: true,
        date: true,
        status: true,
        photo_url: true,
        discord_message_id: true,
        created_at: true,
      },
      orderBy: {
        date: 'desc',
      },
    });

    res.json(createSuccessResponse(checkInsWithPhotos));
  } catch (error) {
    console.error('Get check-ins with photos error:', error);
    res.status(500).json(createErrorResponse('Failed to fetch check-ins with photos', 500));
  }
});

// ============================================================================
// STREAK ENDPOINTS
// ============================================================================
app.get('/api/streak/:userId', async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.params.userId },
      select: {
        streak_count: true,
        longest_streak: true,
        total_checkins: true,
      },
    });

    if (!user) {
      return res.status(404).json(createErrorResponse('User not found', 404));
    }

    res.json(createSuccessResponse({
      current_streak: user.streak_count,
      longest_streak: user.longest_streak,
      total_checkins: user.total_checkins,
    }));
  } catch (error) {
    console.error('Get streak error:', error);
    res.status(500).json(createErrorResponse('Failed to fetch streak data', 500));
  }
});

// ============================================================================
// SCHEDULE ENDPOINTS
// ============================================================================
app.post('/api/schedules', authenticateToken, async (req, res) => {
  try {
    const { days_of_week, time } = req.body;

    // Check if user already has a schedule
    const existingSchedule = await prisma.schedule.findFirst({
      where: { user_id: req.user.id },
    });

    let schedule;
    if (existingSchedule) {
      // Update existing schedule
      schedule = await prisma.schedule.update({
        where: { id: existingSchedule.id },
        data: {
          days_of_week,
          time,
        },
      });
    } else {
      // Create new schedule
      schedule = await prisma.schedule.create({
        data: {
          user_id: req.user.id,
          days_of_week,
          time,
        },
      });
    }

    res.status(201).json(createSuccessResponse(schedule, 'Schedule updated successfully'));
  } catch (error) {
    console.error('Create/update schedule error:', error);
    res.status(500).json(createErrorResponse('Failed to create/update schedule', 500));
  }
});

app.get('/api/schedules/:userId', async (req, res) => {
  try {
    const schedule = await prisma.schedule.findFirst({
      where: {
        user_id: req.params.userId,
      },
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

    res.json(createSuccessResponse(schedule));
  } catch (error) {
    console.error('Get schedule error:', error);
    res.status(500).json(createErrorResponse('Failed to fetch schedule', 500));
  }
});

// ============================================================================
// CHEER ENDPOINTS
// ============================================================================
app.post('/api/cheers', authenticateToken, async (req, res) => {
  try {
    const { to_user_id, message } = req.body;

    // Check if target user exists
    const targetUser = await prisma.user.findUnique({
      where: { id: to_user_id },
    });

    if (!targetUser) {
      return res.status(404).json(createErrorResponse('Target user not found', 404));
    }

    // Prevent self-cheering
    if (req.user.id === to_user_id) {
      return res.status(400).json(createErrorResponse('Cannot cheer yourself', 400));
    }

    // Create cheer
    const cheer = await prisma.cheer.create({
      data: {
        from_user_id: req.user.id,
        to_user_id,
        message,
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
    console.error('Create cheer error:', error);
    res.status(500).json(createErrorResponse('Failed to send cheer', 500));
  }
});

app.get('/api/cheers/:userId', async (req, res) => {
  try {
    const cheers = await prisma.cheer.findMany({
      where: {
        to_user_id: req.params.userId,
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
});

// ============================================================================
// DISCORD BOT ENDPOINTS
// ============================================================================
app.post('/api/discord/checkin-embed', async (req, res) => {
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
});

app.get('/api/discord/profile-embed', async (req, res) => {
  try {
    const { discord_id } = req.query;

    if (!discord_id) {
      return res.status(400).json(createErrorResponse('discord_id is required'));
    }

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

    res.json(createSuccessResponse(embedData, 'Profile embed data generated'));
  } catch (error) {
    console.error('Generate profile embed error:', error);
    res.status(500).json(createErrorResponse('Failed to generate profile embed', 500));
  }
});

// ============================================================================
// LEADERBOARD ENDPOINTS
// ============================================================================
app.get('/api/leaderboard/streaks', async (req, res) => {
  try {
    const { limit = 10, type = 'current' } = req.query;
    const limitNum = parseInt(limit, 10);

    if (isNaN(limitNum) || limitNum < 1 || limitNum > 50) {
      return res.status(400).json(createErrorResponse('Limit must be between 1 and 50'));
    }

    let orderBy;
    let title;

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

    res.json(createSuccessResponse({
      leaderboard,
      title,
    }, 'Streak leaderboard generated'));
  } catch (error) {
    console.error('Get streak leaderboard error:', error);
    res.status(500).json(createErrorResponse('Failed to fetch leaderboard', 500));
  }
});

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================
async function updateStreak(userId, checkInDate, status) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      checkins: {
        where: {
          status: 'went',
        },
        orderBy: {
          date: 'desc',
        },
        take: 1,
      },
    },
  });

  if (!user) {
    throw new Error('User not found');
  }

  let newStreakCount = 1;
  let newLongestStreak = user.longest_streak;

  if (status === 'went') {
    const lastCheckIn = user.checkins[0];
    
    if (lastCheckIn) {
      const lastCheckInDate = new Date(lastCheckIn.date);
      const yesterday = new Date(checkInDate);
      yesterday.setDate(yesterday.getDate() - 1);
      
      // Check if the last check-in was yesterday
      if (lastCheckInDate.toDateString() === yesterday.toDateString()) {
        newStreakCount = user.streak_count + 1;
      }
    }

    // Update longest streak if current streak is higher
    if (newStreakCount > user.longest_streak) {
      newLongestStreak = newStreakCount;
    }
  } else {
    // Reset streak on missed day
    newStreakCount = 0;
  }

  await prisma.user.update({
    where: { id: userId },
    data: {
      streak_count: newStreakCount,
      longest_streak: newLongestStreak,
      total_checkins: user.total_checkins + 1,
    },
  });
}

// ============================================================================
// START SERVER
// ============================================================================
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 WaddleTracker Server running on http://localhost:${PORT}`);
  console.log('📋 Available endpoints:');
  console.log('  • Authentication (Discord OAuth)');
  console.log('  • User Management');
  console.log('  • Check-ins & Streaks');
  console.log('  • Schedules');
  console.log('  • Cheers & Notifications');
  console.log('  • Discord Bot Integration');
  console.log('  • Leaderboards');
  console.log('  • Photo Gallery');
  console.log('  • Analytics & Stats');
  console.log('  • Webhook Support');
  console.log('\n🎯 Ready for Discord bot and app integration!');
});
