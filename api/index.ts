import { VercelRequest, VercelResponse } from '@vercel/node';

export default function handler(req: VercelRequest, res: VercelResponse) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

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
    documentation: 'https://github.com/your-username/waddle-tracker-backend',
  });
}
