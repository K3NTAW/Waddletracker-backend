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
    version: '1.0.0',
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
    },
    documentation: 'https://github.com/your-username/waddle-tracker-backend',
  });
}
