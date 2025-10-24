import { VercelRequest, VercelResponse } from '@vercel/node';
import { prisma } from '../src/lib/prisma';
import { createErrorResponse, createSuccessResponse } from '../src/lib/validation';

// Helper function to get user's schedule and determine day type
async function getScheduledDayType(userId: string, date: Date = new Date()) {
  const schedule = await prisma.schedule.findUnique({
    where: { user_id: userId },
  });

  if (!schedule || !schedule.is_active) {
    return null; // No schedule or inactive
  }

  // For weekly schedules, check the day of week
  if (schedule.schedule_type === 'weekly') {
    const dayOfWeek = date.getDay(); // 0 = Sunday, 1 = Monday, etc.
    const dayFields = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    const dayField = dayFields[dayOfWeek] as keyof typeof schedule;
    
    return schedule[dayField] ? 'workout' : 'rest';
  }

  // For rotating schedules, use the rotation pattern
  if (schedule.schedule_type === 'rotating' && schedule.rotation_pattern) {
    const pattern = schedule.rotation_pattern.split(',');
    const daysSinceStart = Math.floor((date.getTime() - schedule.created_at.getTime()) / (1000 * 60 * 60 * 24));
    const patternIndex = daysSinceStart % pattern.length;
    const dayType = pattern[patternIndex].trim().toLowerCase();
    
    // Update current rotation day
    await prisma.schedule.update({
      where: { id: schedule.id },
      data: { current_rotation_day: patternIndex },
    });
    
    return dayType === 'rest' ? 'rest' : 'workout';
  }

  return null;
}

// Helper function to calculate streak (including scheduled rest days)
async function calculateStreak(userId: string) {
  const checkins = await prisma.checkIn.findMany({
    where: { user_id: userId },
    orderBy: { date: 'desc' },
  });

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  // Get user's schedule to determine if today is a scheduled rest day
  const scheduledDayType = await getScheduledDayType(userId, today);
  
  // If today is a scheduled rest day and user hasn't checked in, count it as a rest day
  if (scheduledDayType === 'rest') {
    const todayCheckin = checkins.find(checkin => {
      const checkinDate = new Date(checkin.date);
      checkinDate.setHours(0, 0, 0, 0);
      return checkinDate.getTime() === today.getTime();
    });
    
    // If no check-in today but it's a scheduled rest day, create a virtual rest day
    if (!todayCheckin) {
      // Add a virtual rest day to the checkins array for streak calculation
      checkins.unshift({
        id: 'virtual_rest',
        user_id: userId,
        date: today,
        status: 'rest' as any,
        workout_type: 'Rest Day',
        notes: 'Scheduled rest day',
        photo_url: null,
        duration_minutes: null,
        calories_burned: null,
        discord_message_id: null,
        created_at: today,
        updated_at: today,
      });
    }
  }

  if (checkins.length === 0) {
    return { current_streak: 0, longest_streak: 0, total_checkins: 0 };
  }

  let currentStreak = 0;
  let longestStreak = 0;
  let tempStreak = 0;
  
  // Check if user has activity today (check-in or scheduled rest day)
  const todayActivity = checkins.find(checkin => {
    const checkinDate = new Date(checkin.date);
    checkinDate.setHours(0, 0, 0, 0);
    return checkinDate.getTime() === today.getTime();
  });

  if (todayActivity) {
    currentStreak = 1;
    tempStreak = 1;
    
    // Count consecutive days backwards (including rest days and scheduled rest days)
    for (let i = 1; i < checkins.length; i++) {
      const currentDate = new Date(checkins[i].date);
      const previousDate = new Date(checkins[i - 1].date);
      
      const dayDiff = Math.floor((previousDate.getTime() - currentDate.getTime()) / (1000 * 60 * 60 * 24));
      
      // Streak continues if it's consecutive days (including rest days)
      // Only breaks if there's a gap of more than 1 day
      if (dayDiff === 1) {
        tempStreak++;
        currentStreak = tempStreak;
      } else if (dayDiff > 1) {
        // Gap of more than 1 day breaks the streak
        break;
      }
      // If dayDiff === 0, it's the same day, so we continue
    }
  }

  // Calculate longest streak (including rest days)
  tempStreak = 1;
  longestStreak = 1;
  
  for (let i = 1; i < checkins.length; i++) {
    const currentDate = new Date(checkins[i].date);
    const previousDate = new Date(checkins[i - 1].date);
    
    const dayDiff = Math.floor((previousDate.getTime() - currentDate.getTime()) / (1000 * 60 * 60 * 24));
    
    if (dayDiff === 1) {
      tempStreak++;
      longestStreak = Math.max(longestStreak, tempStreak);
    } else if (dayDiff > 1) {
      tempStreak = 1;
    }
    // If dayDiff === 0, it's the same day, so we continue
  }

  return {
    current_streak: currentStreak,
    longest_streak: longestStreak,
    total_checkins: checkins.filter(c => c.id !== 'virtual_rest').length, // Don't count virtual rest days in total
  };
}

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
      case path === 'schedules/flexible' && req.method === 'POST':
        return handleFlexibleScheduleCreate(req, res);
      case path.startsWith('schedules/'):
        return handleScheduleGet(req, res);
      case path === 'cheers' && req.method === 'POST':
        return handleCheerSend(req, res);
      case path.startsWith('cheers/'):
        return handleCheerList(req, res);
      case path.startsWith('streak/'):
        return handleStreakGet(req, res);
      case path.startsWith('discord/user/'):
        return handleDiscordUserProfile(req, res);
      case path.startsWith('discord/register-embed'):
        return handleDiscordRegisterEmbed(req, res);
      case path.startsWith('discord/register'):
        return handleDiscordRegister(req, res);
      case path.startsWith('discord/checkin'):
        return handleDiscordCheckin(req, res);
      case path.startsWith('discord/rest-day'):
        return handleDiscordRestDay(req, res);
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
        flexible: '/api/schedules/flexible',
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
        user_profile: '/api/discord/user/:discordId',
        register_embed: '/api/discord/register-embed',
        register: '/api/discord/register',
        checkin: '/api/discord/checkin',
        rest_day: '/api/discord/rest-day',
        checkin_embed: '/api/discord/checkin-embed',
        profile_embed: '/api/discord/profile-embed?discord_id={discordId}',
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

  try {
    // Exchange code for access token
    const tokenResponse = await fetch('https://discord.com/api/oauth2/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client_id: process.env.DISCORD_CLIENT_ID!,
        client_secret: process.env.DISCORD_CLIENT_SECRET!,
        grant_type: 'authorization_code',
        code: code as string,
        redirect_uri: process.env.DISCORD_REDIRECT_URI!,
      }),
    });

    if (!tokenResponse.ok) {
      return res.status(400).json(createErrorResponse('Failed to exchange code for token'));
    }

    const tokenData = await tokenResponse.json() as any;
    const { access_token } = tokenData;

    // Get user info from Discord
    const userResponse = await fetch('https://discord.com/api/users/@me', {
      headers: {
        Authorization: `Bearer ${access_token}`,
      },
    });

    if (!userResponse.ok) {
      return res.status(400).json(createErrorResponse('Failed to fetch user info from Discord'));
    }

    const discordUser = await userResponse.json() as any;

    // Find or create user in database
    let user = await prisma.user.findUnique({
      where: { discord_id: discordUser.id },
    });

    if (!user) {
      user = await prisma.user.create({
        data: {
          discord_id: discordUser.id,
          username: discordUser.username,
          avatar_url: discordUser.avatar ? 
            `https://cdn.discordapp.com/avatars/${discordUser.id}/${discordUser.avatar}.png` : 
            null,
          bio: null,
          timezone: 'UTC',
          is_active: true,
        },
      });
    } else {
      // Update user info
      user = await prisma.user.update({
        where: { id: user.id },
        data: {
          username: discordUser.username,
          avatar_url: discordUser.avatar ? 
            `https://cdn.discordapp.com/avatars/${discordUser.id}/${discordUser.avatar}.png` : 
            null,
        },
      });
    }

    // Generate JWT token
    const jwt = require('jsonwebtoken');
    const token = jwt.sign(
      { 
        id: user.id, 
        discord_id: user.discord_id, 
        username: user.username 
      },
      process.env.JWT_SECRET!,
      { expiresIn: '7d' }
    );

    // Redirect to frontend with token
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    return res.redirect(`${frontendUrl}/auth/callback?token=${token}`);

  } catch (error) {
    console.error('Auth callback error:', error);
    return res.status(500).json(createErrorResponse('Internal server error'));
  }
}

async function handleAuthMe(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json(createErrorResponse('Method not allowed', 405));
  }

  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json(createErrorResponse('Authorization header required'));
    }

    const token = authHeader.split(' ')[1];
    const jwt = require('jsonwebtoken');
    
    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET!);
    } catch (error) {
      return res.status(401).json(createErrorResponse('Invalid or expired token'));
    }

    // Get user from database
    const user = await prisma.user.findUnique({
      where: { id: decoded.id },
      select: {
        id: true,
        discord_id: true,
        username: true,
        avatar_url: true,
        bio: true,
        timezone: true,
        is_active: true,
        created_at: true,
        updated_at: true,
      },
    });

    if (!user) {
      return res.status(404).json(createErrorResponse('User not found'));
    }

    return res.json(createSuccessResponse({
      user: {
        id: user.id,
        discord_id: user.discord_id,
        username: user.username,
        avatar_url: user.avatar_url,
        bio: user.bio,
        timezone: user.timezone,
        is_active: user.is_active,
        created_at: user.created_at,
        updated_at: user.updated_at,
      },
    }));

  } catch (error) {
    console.error('Auth me error:', error);
    return res.status(500).json(createErrorResponse('Internal server error'));
  }
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

  try {
    // Verify authentication
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json(createErrorResponse('Authorization header required'));
    }

    const token = authHeader.split(' ')[1];
    const jwt = require('jsonwebtoken');
    
    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET!);
    } catch (error) {
      return res.status(401).json(createErrorResponse('Invalid or expired token'));
    }

    const { workout_type, notes, photo_url, duration_minutes, calories_burned } = req.body;

    // Validate required fields
    if (!workout_type) {
      return res.status(400).json(createErrorResponse('Workout type is required'));
    }

    // Check if user already checked in today
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const existingCheckin = await prisma.checkIn.findFirst({
      where: {
        user_id: decoded.id,
        date: {
          gte: today,
          lt: tomorrow,
        },
      },
    });

    if (existingCheckin) {
      return res.status(400).json(createErrorResponse('User has already checked in today'));
    }

    // Create check-in
    const checkin = await prisma.checkIn.create({
      data: {
        user_id: decoded.id,
        status: 'went',
        workout_type,
        notes: notes || null,
        photo_url: photo_url || null,
        duration_minutes: duration_minutes || null,
        calories_burned: calories_burned || null,
        date: new Date(),
      },
    });

    // Calculate and update streak
    const streak = await calculateStreak(decoded.id);
    await prisma.user.update({
      where: { id: decoded.id },
      data: { 
        current_streak: streak.current_streak,
        longest_streak: streak.longest_streak,
        total_checkins: streak.total_checkins,
      },
    });

    return res.status(201).json(createSuccessResponse({
      checkin: {
        id: checkin.id,
        user_id: checkin.user_id,
        workout_type: checkin.workout_type,
        notes: checkin.notes,
        photo_url: checkin.photo_url,
        duration_minutes: checkin.duration_minutes,
        calories_burned: checkin.calories_burned,
        date: checkin.date,
        created_at: checkin.created_at,
      },
      streak: streak,
    }));

  } catch (error) {
    console.error('Check-in create error:', error);
    return res.status(500).json(createErrorResponse('Internal server error'));
  }
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

  try {
    // Verify authentication
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json(createErrorResponse('Authorization header required'));
    }

    const token = authHeader.split(' ')[1];
    const jwt = require('jsonwebtoken');
    
    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET!);
    } catch (error) {
      return res.status(401).json(createErrorResponse('Invalid or expired token'));
    }

    const { 
      monday, tuesday, wednesday, thursday, friday, saturday, sunday,
      timezone, reminder_time, is_active 
    } = req.body;

    // Validate required fields
    if (!monday && !tuesday && !wednesday && !thursday && !friday && !saturday && !sunday) {
      return res.status(400).json(createErrorResponse('At least one day must be selected'));
    }

    // Check if user already has a schedule
    const existingSchedule = await prisma.schedule.findFirst({
      where: { user_id: decoded.id },
    });

    let schedule;
    if (existingSchedule) {
      // Update existing schedule
      schedule = await prisma.schedule.update({
        where: { id: existingSchedule.id },
        data: {
          monday: monday || false,
          tuesday: tuesday || false,
          wednesday: wednesday || false,
          thursday: thursday || false,
          friday: friday || false,
          saturday: saturday || false,
          sunday: sunday || false,
          timezone: timezone || 'UTC',
          reminder_time: reminder_time || '09:00',
          is_active: is_active !== undefined ? is_active : true,
        },
      });
    } else {
      // Create new schedule
      schedule = await prisma.schedule.create({
        data: {
          user_id: decoded.id,
          monday: monday || false,
          tuesday: tuesday || false,
          wednesday: wednesday || false,
          thursday: thursday || false,
          friday: friday || false,
          saturday: saturday || false,
          sunday: sunday || false,
          timezone: timezone || 'UTC',
          reminder_time: reminder_time || '09:00',
          is_active: is_active !== undefined ? is_active : true,
        },
      });
    }

    return res.status(201).json(createSuccessResponse({
      schedule: {
        id: schedule.id,
        user_id: schedule.user_id,
        monday: schedule.monday,
        tuesday: schedule.tuesday,
        wednesday: schedule.wednesday,
        thursday: schedule.thursday,
        friday: schedule.friday,
        saturday: schedule.saturday,
        sunday: schedule.sunday,
        timezone: schedule.timezone,
        reminder_time: schedule.reminder_time,
        is_active: schedule.is_active,
        created_at: schedule.created_at,
        updated_at: schedule.updated_at,
      },
    }));

  } catch (error) {
    console.error('Schedule create error:', error);
    return res.status(500).json(createErrorResponse('Internal server error'));
  }
}

// Handle flexible schedule creation (with rotation patterns)
async function handleFlexibleScheduleCreate(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json(createErrorResponse('Method not allowed', 405));
  }

  try {
    // Verify authentication
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json(createErrorResponse('Authorization header required'));
    }

    const token = authHeader.split(' ')[1];
    const jwt = require('jsonwebtoken');
    
    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET!);
    } catch (error) {
      return res.status(401).json(createErrorResponse('Invalid or expired token'));
    }

    const { 
      schedule_type, rotation_pattern, monday, tuesday, wednesday, thursday, friday, saturday, sunday,
      timezone, reminder_time, rest_days_allowed 
    } = req.body;

    // Validate schedule type
    if (!['weekly', 'rotating', 'custom'].includes(schedule_type)) {
      return res.status(400).json(createErrorResponse('Schedule type must be weekly, rotating, or custom'));
    }

    // For rotating schedules, validate rotation pattern
    if (schedule_type === 'rotating' && !rotation_pattern) {
      return res.status(400).json(createErrorResponse('Rotation pattern is required for rotating schedules'));
    }

    if (schedule_type === 'rotating' && rotation_pattern) {
      const pattern = rotation_pattern.split(',').map((p: string) => p.trim().toLowerCase());
      const validTypes = ['upper', 'lower', 'rest', 'cardio', 'strength', 'workout'];
      const invalidTypes = pattern.filter((p: string) => !validTypes.includes(p));
      
      if (invalidTypes.length > 0) {
        return res.status(400).json(createErrorResponse(`Invalid workout types in pattern: ${invalidTypes.join(', ')}. Valid types: ${validTypes.join(', ')}`));
      }
    }

    // For weekly schedules, validate at least one day is selected
    if (schedule_type === 'weekly' && !monday && !tuesday && !wednesday && !thursday && !friday && !saturday && !sunday) {
      return res.status(400).json(createErrorResponse('At least one day must be selected for weekly schedules'));
    }

    // Check if user already has a schedule
    const existingSchedule = await prisma.schedule.findFirst({
      where: { user_id: decoded.id },
    });

    let schedule;
    if (existingSchedule) {
      // Update existing schedule
      schedule = await prisma.schedule.update({
        where: { id: existingSchedule.id },
        data: {
          schedule_type,
          rotation_pattern: schedule_type === 'rotating' ? rotation_pattern : null,
          monday: schedule_type === 'weekly' ? (monday || false) : false,
          tuesday: schedule_type === 'weekly' ? (tuesday || false) : false,
          wednesday: schedule_type === 'weekly' ? (wednesday || false) : false,
          thursday: schedule_type === 'weekly' ? (thursday || false) : false,
          friday: schedule_type === 'weekly' ? (friday || false) : false,
          saturday: schedule_type === 'weekly' ? (saturday || false) : false,
          sunday: schedule_type === 'weekly' ? (sunday || false) : false,
          timezone: timezone || 'UTC',
          reminder_time: reminder_time || '09:00',
          rest_days_allowed: rest_days_allowed !== undefined ? rest_days_allowed : true,
          current_rotation_day: 0,
        },
      });
    } else {
      // Create new schedule
      schedule = await prisma.schedule.create({
        data: {
          user_id: decoded.id,
          schedule_type,
          rotation_pattern: schedule_type === 'rotating' ? rotation_pattern : null,
          monday: schedule_type === 'weekly' ? (monday || false) : false,
          tuesday: schedule_type === 'weekly' ? (tuesday || false) : false,
          wednesday: schedule_type === 'weekly' ? (wednesday || false) : false,
          thursday: schedule_type === 'weekly' ? (thursday || false) : false,
          friday: schedule_type === 'weekly' ? (friday || false) : false,
          saturday: schedule_type === 'weekly' ? (saturday || false) : false,
          sunday: schedule_type === 'weekly' ? (sunday || false) : false,
          timezone: timezone || 'UTC',
          reminder_time: reminder_time || '09:00',
          rest_days_allowed: rest_days_allowed !== undefined ? rest_days_allowed : true,
          current_rotation_day: 0,
        },
      });
    }

    // Get today's scheduled day type
    const today = new Date();
    const scheduledDayType = await getScheduledDayType(decoded.id, today);
    
    return res.status(201).json(createSuccessResponse({
      schedule: {
        id: schedule.id,
        user_id: schedule.user_id,
        schedule_type: schedule.schedule_type,
        rotation_pattern: schedule.rotation_pattern,
        monday: schedule.monday,
        tuesday: schedule.tuesday,
        wednesday: schedule.wednesday,
        thursday: schedule.thursday,
        friday: schedule.friday,
        saturday: schedule.saturday,
        sunday: schedule.sunday,
        timezone: schedule.timezone,
        reminder_time: schedule.reminder_time,
        rest_days_allowed: schedule.rest_days_allowed,
        current_rotation_day: schedule.current_rotation_day,
        is_active: schedule.is_active,
        created_at: schedule.created_at,
        updated_at: schedule.updated_at,
      },
      today_scheduled_type: scheduledDayType,
      message: schedule_type === 'rotating' 
        ? `Rotation schedule created! Pattern: ${rotation_pattern}. Today is: ${scheduledDayType || 'not scheduled'}`
        : `Schedule created! Today is: ${scheduledDayType || 'not scheduled'}`,
    }));

  } catch (error) {
    console.error('Flexible schedule creation error:', error);
    return res.status(500).json(createErrorResponse('Internal server error'));
  }
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
        monday: true,
        tuesday: true,
        wednesday: true,
        thursday: true,
        friday: true,
        saturday: true,
        sunday: true,
        timezone: true,
        reminder_time: true,
        is_active: true,
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

  try {
    // Verify authentication
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json(createErrorResponse('Authorization header required'));
    }

    const token = authHeader.split(' ')[1];
    const jwt = require('jsonwebtoken');
    
    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET!);
    } catch (error) {
      return res.status(401).json(createErrorResponse('Invalid or expired token'));
    }

    const { to_user_id, message, type } = req.body;

    // Validate required fields
    if (!to_user_id) {
      return res.status(400).json(createErrorResponse('Recipient user ID is required'));
    }

    if (!message || message.trim().length === 0) {
      return res.status(400).json(createErrorResponse('Cheer message is required'));
    }

    // Check if recipient exists
    const recipient = await prisma.user.findUnique({
      where: { id: to_user_id },
    });

    if (!recipient) {
      return res.status(404).json(createErrorResponse('Recipient user not found'));
    }

    // Prevent self-cheering
    if (decoded.id === to_user_id) {
      return res.status(400).json(createErrorResponse('Cannot send cheer to yourself'));
    }

    // Create cheer
    const cheer = await prisma.cheer.create({
      data: {
        from_user_id: decoded.id,
        to_user_id: to_user_id,
        message: message.trim(),
        type: type || 'general',
      },
    });

    // Create notification for recipient
    await prisma.notification.create({
      data: {
        user_id: to_user_id,
        from_user_id: decoded.id,
        type: 'cheer',
        title: 'New Cheer! 🎉',
        message: `You received a cheer: "${message.trim()}"`,
        data: {
          cheer_id: cheer.id,
          from_username: decoded.username,
        },
      },
    });

    // Get sender info for response
    const sender = await prisma.user.findUnique({
      where: { id: decoded.id },
      select: {
        id: true,
        username: true,
        avatar_url: true,
      },
    });

    return res.status(201).json(createSuccessResponse({
      cheer: {
        id: cheer.id,
        from_user_id: cheer.from_user_id,
        to_user_id: cheer.to_user_id,
        message: cheer.message,
        type: cheer.type,
        created_at: cheer.created_at,
        sender: sender,
      },
    }));

  } catch (error) {
    console.error('Cheer send error:', error);
    return res.status(500).json(createErrorResponse('Internal server error'));
  }
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
    // Check if user exists
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true },
    });

    if (!user) {
      return res.status(404).json(createErrorResponse('User not found'));
    }

    // Calculate streak using our helper function
    const streakData = await calculateStreak(userId);

    // Get additional streak information
    const checkins = await prisma.checkIn.findMany({
      where: { user_id: userId },
      orderBy: { date: 'desc' },
      take: 10,
    });

    const recentCheckins = checkins.map(checkin => ({
      id: checkin.id,
      date: checkin.date,
      workout_type: checkin.workout_type,
      notes: checkin.notes,
    }));

    return res.json(createSuccessResponse({
      ...streakData,
      recent_checkins: recentCheckins,
      last_checkin: checkins[0] ? {
        id: checkins[0].id,
        date: checkins[0].date,
        workout_type: checkins[0].workout_type,
      } : null,
    }));
  } catch (error) {
    console.error('Streak get error:', error);
    return res.status(500).json(createErrorResponse('Failed to fetch streak data', 500));
  }
}

// Discord handlers
async function handleDiscordCheckin(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json(createErrorResponse('Method not allowed', 405));
  }

  try {
    const { discord_id, username, avatar_url, status, photo_url, date, workout_type, notes, duration_minutes, calories_burned } = req.body;

    if (!discord_id || !username) {
      return res.status(400).json(createErrorResponse('Discord ID and username are required'));
    }

    // Find user by Discord ID
    const user = await prisma.user.findUnique({
      where: { discord_id: discord_id },
    });

    if (!user) {
      return res.status(404).json(createErrorResponse('User not found - not registered'));
    }

    // Check if user already checked in today (only for non-rest days)
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const existingCheckin = await prisma.checkIn.findFirst({
      where: {
        user_id: user.id,
        date: {
          gte: today,
          lt: tomorrow,
        },
      },
    });

    // Only prevent duplicate check-ins if it's not a rest day
    if (existingCheckin && status !== 'rest') {
      return res.status(400).json(createErrorResponse('User has already checked in today'));
    }

    // Create check-in
    const checkin = await prisma.checkIn.create({
      data: {
        user_id: user.id,
        status: status || 'went',
        workout_type: workout_type || null,
        notes: notes || null,
        photo_url: photo_url || null,
        duration_minutes: duration_minutes || null,
        calories_burned: calories_burned || null,
        date: date ? new Date(date) : new Date(),
      },
    });

    // Calculate and update streak
    const streak = await calculateStreak(user.id);
    await prisma.user.update({
      where: { id: user.id },
      data: { 
        current_streak: streak.current_streak,
        longest_streak: streak.longest_streak,
        total_checkins: streak.total_checkins,
      },
    });

    // Create Discord embed based on status
    const isRestDay = status === 'rest';
    const embed: any = {
      title: isRestDay ? '😴 Rest Day Logged!' : '🏋️ Check-in Logged!',
      description: isRestDay 
        ? `**${username}** has logged a rest day - recovery is important! 💪`
        : `**${username}** has successfully logged their workout!`,
      color: isRestDay ? 0xffa500 : 0x00ff00, // Orange for rest, green for workout
      thumbnail: {
        url: avatar_url || user.avatar_url || 'https://cdn.discordapp.com/embed/avatars/0.png',
      },
      fields: [
        {
          name: isRestDay ? '😴 Rest Day' : '💪 Workout Type',
          value: isRestDay ? 'Recovery & Rest' : (workout_type || 'General Exercise'),
          inline: true,
        },
        {
          name: '🔥 Current Streak',
          value: `${streak.current_streak} days`,
          inline: true,
        },
        {
          name: '📊 Total Check-ins',
          value: `${streak.total_checkins}`,
          inline: true,
        },
      ],
      footer: {
        text: isRestDay ? 'WaddleFit - Rest is part of the journey! 💤' : 'WaddleFit - Keep up the great work!',
      },
      timestamp: new Date().toISOString(),
    };

    // Add optional fields if provided
    if (notes) {
      embed.fields.push({
        name: '📝 Notes',
        value: notes,
        inline: false,
      });
    }

    if (duration_minutes) {
      embed.fields.push({
        name: '⏱️ Duration',
        value: `${duration_minutes} minutes`,
        inline: true,
      });
    }

    if (calories_burned) {
      embed.fields.push({
        name: '🔥 Calories Burned',
        value: `${calories_burned}`,
        inline: true,
      });
    }

    // Add image if available
    if (photo_url) {
      embed.image = {
        url: photo_url,
      };
    }

    return res.json(createSuccessResponse({
      embed: embed,
      checkin: {
        id: checkin.id,
        user_id: checkin.user_id,
        status: checkin.status,
        workout_type: checkin.workout_type,
        notes: checkin.notes,
        photo_url: checkin.photo_url,
        duration_minutes: checkin.duration_minutes,
        calories_burned: checkin.calories_burned,
        date: checkin.date,
        created_at: checkin.created_at,
      },
      streak: streak,
    }));

  } catch (error) {
    console.error('Discord check-in error:', error);
    return res.status(500).json(createErrorResponse('Internal server error'));
  }
}

// Handle Discord rest day check-in
async function handleDiscordRestDay(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json(createErrorResponse('Method not allowed', 405));
  }

  try {
    const { discord_id, username, avatar_url, notes, date } = req.body;

    if (!discord_id || !username) {
      return res.status(400).json(createErrorResponse('Discord ID and username are required'));
    }

    // Find user by Discord ID
    const user = await prisma.user.findUnique({
      where: { discord_id: discord_id },
    });

    if (!user) {
      return res.status(404).json(createErrorResponse('User not found - not registered'));
    }

    // Check if user already checked in today
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const existingCheckin = await prisma.checkIn.findFirst({
      where: {
        user_id: user.id,
        date: {
          gte: today,
          lt: tomorrow,
        },
      },
    });

    if (existingCheckin) {
      return res.status(400).json(createErrorResponse('User has already checked in today'));
    }

    // Create rest day check-in
    const checkin = await prisma.checkIn.create({
      data: {
        user_id: user.id,
        status: 'rest',
        workout_type: 'Rest Day',
        notes: notes || 'Planned rest day for recovery',
        date: date ? new Date(date) : new Date(),
      },
    });

    // Calculate and update streak (rest days count for streaks)
    const streak = await calculateStreak(user.id);
    await prisma.user.update({
      where: { id: user.id },
      data: { 
        current_streak: streak.current_streak,
        longest_streak: streak.longest_streak,
        total_checkins: streak.total_checkins,
      },
    });

    // Create Discord embed for rest day
    const embed: any = {
      title: '😴 Rest Day Logged!',
      description: `**${username}** has logged a rest day - recovery is important! 💪`,
      color: 0xffa500, // Orange color for rest
      thumbnail: {
        url: avatar_url || user.avatar_url || 'https://cdn.discordapp.com/embed/avatars/0.png',
      },
      fields: [
        {
          name: '😴 Rest Day',
          value: 'Recovery & Rest',
          inline: true,
        },
        {
          name: '🔥 Current Streak',
          value: `${streak.current_streak} days`,
          inline: true,
        },
        {
          name: '📊 Total Check-ins',
          value: `${streak.total_checkins}`,
          inline: true,
        },
      ],
      footer: {
        text: 'WaddleFit - Rest is part of the journey! 💤',
      },
      timestamp: new Date().toISOString(),
    };

    // Add notes if provided
    if (notes) {
      embed.fields.push({
        name: '📝 Notes',
        value: notes,
        inline: false,
      });
    }

    return res.json(createSuccessResponse({
      embed: embed,
      checkin: {
        id: checkin.id,
        user_id: checkin.user_id,
        status: checkin.status,
        workout_type: checkin.workout_type,
        notes: checkin.notes,
        date: checkin.date,
        created_at: checkin.created_at,
      },
      streak: streak,
    }));

  } catch (error) {
    console.error('Discord rest day error:', error);
    return res.status(500).json(createErrorResponse('Internal server error'));
  }
}

async function handleDiscordUserProfile(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json(createErrorResponse('Method not allowed', 405));
  }

  try {
    const url = new URL(req.url || '', 'http://localhost');
    const pathParts = url.pathname.split('/');
    const discordId = pathParts[pathParts.length - 1];

    if (!discordId) {
      return res.status(400).json(createErrorResponse('Discord ID required'));
    }

    // Find user by Discord ID
    const user = await prisma.user.findUnique({
      where: { discord_id: discordId },
      select: {
        id: true,
        discord_id: true,
        username: true,
        avatar_url: true,
        bio: true,
        timezone: true,
        is_active: true,
        current_streak: true,
        longest_streak: true,
        total_checkins: true,
        created_at: true,
        updated_at: true,
      },
    });

    if (!user) {
      return res.status(404).json(createErrorResponse('User not found - not registered'));
    }

    // Get recent check-ins
    const recentCheckins = await prisma.checkIn.findMany({
      where: { user_id: user.id },
      orderBy: { date: 'desc' },
      take: 5,
      select: {
        id: true,
        workout_type: true,
        date: true,
        notes: true,
        photo_url: true,
      },
    });

    // Get cheers received
    const cheersReceived = await prisma.cheer.count({
      where: { to_user_id: user.id },
    });

    // Get cheers sent
    const cheersSent = await prisma.cheer.count({
      where: { from_user_id: user.id },
    });

    // Calculate days since joining
    const daysSinceJoining = Math.floor((Date.now() - new Date(user.created_at).getTime()) / (1000 * 60 * 60 * 24));

    return res.json(createSuccessResponse({
      user: {
        id: user.id,
        discord_id: user.discord_id,
        username: user.username,
        avatar_url: user.avatar_url,
        bio: user.bio,
        timezone: user.timezone,
        is_active: user.is_active,
        created_at: user.created_at,
        updated_at: user.updated_at,
      },
      stats: {
        current_streak: user.current_streak,
        longest_streak: user.longest_streak,
        total_checkins: user.total_checkins,
        cheers_received: cheersReceived,
        cheers_sent: cheersSent,
        days_since_joining: daysSinceJoining,
      },
      recent_checkins: recentCheckins,
    }));

  } catch (error) {
    console.error('Discord user profile error:', error);
    return res.status(500).json(createErrorResponse('Internal server error'));
  }
}

async function handleDiscordRegisterEmbed(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json(createErrorResponse('Method not allowed', 405));
  }

  try {
    const { discord_id, username, avatar_url } = req.body;

    if (!discord_id || !username) {
      return res.status(400).json(createErrorResponse('Discord ID and username are required'));
    }

    // Create registration embed with button
    const embed = {
      title: '👤 User Not Found',
      description: `**User:** @${username}\n\nThis user hasn't registered with WaddleTracker yet.\nThey need to register to start tracking their fitness journey!`,
      color: 0xff6b6b, // Red color
      thumbnail: {
        url: avatar_url || 'https://cdn.discordapp.com/embed/avatars/0.png',
      },
      fields: [
        {
          name: '🔗 How to Register',
          value: 'Click the button below to register instantly!',
          inline: false,
        },
        {
          name: '✨ What You Get',
          value: '• Track your workouts\n• Build streaks\n• Get cheered on\n• Join the community!',
          inline: false,
        },
      ],
      footer: {
        text: 'WaddleFit - Your fitness journey starts here!',
      },
      timestamp: new Date().toISOString(),
    };

    // Create components with registration button
    const components = [
      {
        type: 1, // Action Row
        components: [
          {
            type: 2, // Button
            style: 1, // Primary (blue)
            label: 'Register Now!',
            custom_id: `register_${discord_id}`,
            emoji: {
              name: '🚀',
            },
          },
          {
            type: 2, // Button
            style: 2, // Secondary (gray)
            label: 'Learn More',
            custom_id: `learn_more_${discord_id}`,
            emoji: {
              name: 'ℹ️',
            },
          },
        ],
      },
    ];

    return res.json(createSuccessResponse({
      embed: embed,
      components: components,
      user: {
        discord_id: discord_id,
        username: username,
        avatar_url: avatar_url,
      },
    }));

  } catch (error) {
    console.error('Discord register embed error:', error);
    return res.status(500).json(createErrorResponse('Internal server error'));
  }
}

async function handleDiscordRegister(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json(createErrorResponse('Method not allowed', 405));
  }

  try {
    const { discord_id, username, avatar_url } = req.body;

    if (!discord_id || !username) {
      return res.status(400).json(createErrorResponse('Discord ID and username are required'));
    }

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { discord_id: discord_id },
    });

    if (existingUser) {
      return res.status(400).json(createErrorResponse('User already registered'));
    }

    // Create new user
    const user = await prisma.user.create({
      data: {
        discord_id: discord_id,
        username: username,
        avatar_url: avatar_url || null,
        bio: null,
        timezone: 'UTC',
        is_active: true,
      },
    });

    // Generate JWT token for the new user
    const jwt = require('jsonwebtoken');
    const token = jwt.sign(
      { 
        id: user.id, 
        discord_id: user.discord_id, 
        username: user.username 
      },
      process.env.JWT_SECRET!,
      { expiresIn: '7d' }
    );

    // Create success embed
    const successEmbed = {
      title: '🎉 Welcome to WaddleTracker!',
      description: `**${username}** has successfully registered!\n\nYou can now start tracking your fitness journey!`,
      color: 0x00ff00, // Green color
      thumbnail: {
        url: user.avatar_url || 'https://cdn.discordapp.com/embed/avatars/0.png',
      },
      fields: [
        {
          name: '🚀 Get Started',
          value: 'Use `/checkin` to log your first workout!',
          inline: false,
        },
        {
          name: '📊 Your Stats',
          value: '• Current Streak: 0 days\n• Total Check-ins: 0\n• Ready to start!',
          inline: false,
        },
      ],
      footer: {
        text: 'WaddleFit - Let\'s get fit together!',
      },
      timestamp: new Date().toISOString(),
    };

    return res.status(201).json(createSuccessResponse({
      user: {
        id: user.id,
        discord_id: user.discord_id,
        username: user.username,
        avatar_url: user.avatar_url,
      },
      token: token,
      message: 'User registered successfully!',
      embed: successEmbed,
    }));

  } catch (error) {
    console.error('Discord register error:', error);
    return res.status(500).json(createErrorResponse('Internal server error'));
  }
}

async function handleDiscordCheckinEmbed(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json(createErrorResponse('Method not allowed', 405));
  }

  try {
    const { user_id, checkin_id } = req.body;

    if (!user_id) {
      return res.status(400).json(createErrorResponse('User ID is required'));
    }

    // Get user info
    const user = await prisma.user.findUnique({
      where: { id: user_id },
      select: {
        id: true,
        username: true,
        avatar_url: true,
        current_streak: true,
        total_checkins: true,
      },
    });

    if (!user) {
      return res.status(404).json(createErrorResponse('User not found'));
    }

    let checkin = null;
    if (checkin_id) {
      checkin = await prisma.checkIn.findUnique({
        where: { id: checkin_id },
        select: {
          id: true,
          workout_type: true,
          notes: true,
          photo_url: true,
          duration_minutes: true,
          calories_burned: true,
          date: true,
        },
      });
    } else {
      // Get latest check-in
      checkin = await prisma.checkIn.findFirst({
        where: { user_id: user_id },
        orderBy: { date: 'desc' },
        select: {
          id: true,
          workout_type: true,
          notes: true,
          photo_url: true,
          duration_minutes: true,
          calories_burned: true,
          date: true,
        },
      });
    }

    if (!checkin) {
      return res.status(404).json(createErrorResponse('No check-in found'));
    }

    // Create Discord embed
    const embed: any = {
      title: `🏋️ ${user.username} just checked in!`,
      description: `**Workout:** ${checkin.workout_type}\n${checkin.notes ? `**Notes:** ${checkin.notes}\n` : ''}${checkin.duration_minutes ? `**Duration:** ${checkin.duration_minutes} minutes\n` : ''}${checkin.calories_burned ? `**Calories:** ${checkin.calories_burned}\n` : ''}`,
      color: 0x00ff00, // Green color
      thumbnail: {
        url: user.avatar_url || 'https://cdn.discordapp.com/embed/avatars/0.png',
      },
      fields: [
        {
          name: '🔥 Current Streak',
          value: `${user.current_streak} days`,
          inline: true,
        },
        {
          name: '📊 Total Check-ins',
          value: `${user.total_checkins}`,
          inline: true,
        },
        {
          name: '📅 Date',
          value: new Date(checkin.date).toLocaleDateString(),
          inline: true,
        },
      ],
      footer: {
        text: 'WaddleFit - Keep up the great work!',
      },
      timestamp: new Date().toISOString(),
    };

    // Add image if available
    if (checkin.photo_url) {
      embed.image = {
        url: checkin.photo_url,
      };
    }

    return res.json(createSuccessResponse({
      embed: embed,
      user: {
        id: user.id,
        username: user.username,
        avatar_url: user.avatar_url,
      },
      checkin: checkin,
    }));

  } catch (error) {
    console.error('Discord check-in embed error:', error);
    return res.status(500).json(createErrorResponse('Internal server error'));
  }
}

async function handleDiscordProfileEmbed(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json(createErrorResponse('Method not allowed', 405));
  }

  try {
    const url = new URL(req.url || '', 'http://localhost');
    const discordId = url.searchParams.get('discord_id');

    if (!discordId) {
      return res.status(400).json(createErrorResponse('Discord ID is required'));
    }

    // Get user info with stats by Discord ID
    const user = await prisma.user.findUnique({
      where: { discord_id: discordId },
      select: {
        id: true,
        discord_id: true,
        username: true,
        avatar_url: true,
        bio: true,
        current_streak: true,
        longest_streak: true,
        total_checkins: true,
        created_at: true,
      },
    });

    if (!user) {
      return res.status(404).json(createErrorResponse('User not found - not registered'));
    }

    // Get recent check-ins
    const recentCheckins = await prisma.checkIn.findMany({
      where: { user_id: user.id },
      orderBy: { date: 'desc' },
      take: 5,
      select: {
        id: true,
        workout_type: true,
        date: true,
        notes: true,
      },
    });

    // Get cheers received
    const cheersReceived = await prisma.cheer.count({
      where: { to_user_id: user.id },
    });

    // Get cheers sent
    const cheersSent = await prisma.cheer.count({
      where: { from_user_id: user.id },
    });

    // Calculate days since joining
    const daysSinceJoining = Math.floor((Date.now() - new Date(user.created_at).getTime()) / (1000 * 60 * 60 * 24));

    // Create Discord embed
    const embed = {
      title: `👤 ${user.username}'s Profile`,
      description: user.bio || 'No bio available',
      color: 0x0099ff, // Blue color
      thumbnail: {
        url: user.avatar_url || 'https://cdn.discordapp.com/embed/avatars/0.png',
      },
      fields: [
        {
          name: '🔥 Current Streak',
          value: `${user.current_streak} days`,
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
          name: '🎉 Cheers Received',
          value: `${cheersReceived}`,
          inline: true,
        },
        {
          name: '💝 Cheers Sent',
          value: `${cheersSent}`,
          inline: true,
        },
        {
          name: '📅 Member Since',
          value: `${daysSinceJoining} days ago`,
          inline: true,
        },
      ],
      footer: {
        text: 'WaddleFit - Fitness Community',
      },
      timestamp: new Date().toISOString(),
    };

    // Add recent check-ins if available
    if (recentCheckins.length > 0) {
      const recentWorkouts = recentCheckins.map(checkin => 
        `• ${checkin.workout_type} (${new Date(checkin.date).toLocaleDateString()})`
      ).join('\n');
      
      embed.fields.push({
        name: '📝 Recent Workouts',
        value: recentWorkouts,
        inline: false,
      });
    }

    return res.json(createSuccessResponse({
      embed: embed,
      user: {
        id: user.id,
        username: user.username,
        avatar_url: user.avatar_url,
        bio: user.bio,
      },
      stats: {
        current_streak: user.current_streak,
        longest_streak: user.longest_streak,
        total_checkins: user.total_checkins,
        cheers_received: cheersReceived,
        cheers_sent: cheersSent,
        days_since_joining: daysSinceJoining,
      },
    }));

  } catch (error) {
    console.error('Discord profile embed error:', error);
    return res.status(500).json(createErrorResponse('Internal server error'));
  }
}

async function handleDiscordCheerEmbed(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json(createErrorResponse('Method not allowed', 405));
  }

  try {
    const { cheer_id } = req.body;

    if (!cheer_id) {
      return res.status(400).json(createErrorResponse('Cheer ID is required'));
    }

    // Get cheer with user info
    const cheer = await prisma.cheer.findUnique({
      where: { id: cheer_id },
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

    if (!cheer) {
      return res.status(404).json(createErrorResponse('Cheer not found'));
    }

    // Create Discord embed
    const embed = {
      title: '🎉 Someone sent a cheer!',
      description: `**${cheer.from_user.username}** cheered **${cheer.to_user.username}**:\n\n"${cheer.message}"`,
      color: 0xffd700, // Gold color
      thumbnail: {
        url: cheer.from_user.avatar_url || 'https://cdn.discordapp.com/embed/avatars/0.png',
      },
      fields: [
        {
          name: '👤 From',
          value: cheer.from_user.username,
          inline: true,
        },
        {
          name: '👤 To',
          value: cheer.to_user.username,
          inline: true,
        },
        {
          name: '💬 Type',
          value: cheer.type || 'general',
          inline: true,
        },
      ],
      footer: {
        text: 'WaddleFit - Spread the positivity!',
      },
      timestamp: new Date(cheer.created_at).toISOString(),
    };

    return res.json(createSuccessResponse({
      embed: embed,
      cheer: {
        id: cheer.id,
        message: cheer.message,
        type: cheer.type,
        created_at: cheer.created_at,
      },
      from_user: cheer.from_user,
      to_user: cheer.to_user,
    }));

  } catch (error) {
    console.error('Discord cheer embed error:', error);
    return res.status(500).json(createErrorResponse('Internal server error'));
  }
}

async function handleDiscordWebhook(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json(createErrorResponse('Method not allowed', 405));
  }

  try {
    const { webhook_url, event_type, data } = req.body;

    if (!webhook_url) {
      return res.status(400).json(createErrorResponse('Webhook URL is required'));
    }

    if (!event_type) {
      return res.status(400).json(createErrorResponse('Event type is required'));
    }

    if (!data) {
      return res.status(400).json(createErrorResponse('Data is required'));
    }

    // Validate webhook URL format
    try {
      new URL(webhook_url);
    } catch (error) {
      return res.status(400).json(createErrorResponse('Invalid webhook URL format'));
    }

    let payload;
    
    switch (event_type) {
      case 'checkin':
        payload = {
          content: `🏋️ **${data.username}** just checked in!`,
          embeds: [data.embed],
        };
        break;
        
      case 'cheer':
        payload = {
          content: `🎉 **${data.from_username}** cheered **${data.to_username}**!`,
          embeds: [data.embed],
        };
        break;
        
      case 'streak_milestone':
        payload = {
          content: `🔥 **${data.username}** reached a ${data.streak_count} day streak! Amazing work!`,
          embeds: [data.embed],
        };
        break;
        
      case 'profile':
        payload = {
          content: `👤 **${data.username}'s** profile`,
          embeds: [data.embed],
        };
        break;
        
      default:
        payload = {
          content: data.message || 'WaddleFit notification',
          embeds: data.embed ? [data.embed] : undefined,
        };
    }

    // Send webhook to Discord
    const webhookResponse = await fetch(webhook_url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!webhookResponse.ok) {
      const errorText = await webhookResponse.text();
      console.error('Discord webhook error:', errorText);
      return res.status(400).json(createErrorResponse('Failed to send webhook to Discord'));
    }

    const webhookResult = await webhookResponse.json() as any;

    return res.json(createSuccessResponse({
      success: true,
      webhook_id: webhookResult.id,
      event_type: event_type,
      sent_at: new Date().toISOString(),
    }));

  } catch (error) {
    console.error('Discord webhook error:', error);
    return res.status(500).json(createErrorResponse('Internal server error'));
  }
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
      let whereClause: any = { user_id: userId };
      
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
          user_id: userId,
        },
        data: { read_at: new Date() },
      });

      return res.json(createSuccessResponse({ updated_count: notification_ids.length }, 'Notifications marked as read'));
    } else {
      // PUT method - mark all notifications as read
      const updatedCount = await prisma.notification.updateMany({
        where: {
          user_id: userId,
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