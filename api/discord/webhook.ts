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
    const { 
      type, 
      user_id, 
      checkin_id, 
      cheer_id, 
      webhook_url,
      channel_id 
    } = req.body;

    if (!type || !webhook_url) {
      return res.status(400).json(createErrorResponse('type and webhook_url are required'));
    }

    let embedData: any = {};

    switch (type) {
      case 'checkin':
        if (!user_id || !checkin_id) {
          return res.status(400).json(createErrorResponse('user_id and checkin_id are required for checkin type'));
        }
        embedData = await generateCheckInEmbed(user_id, checkin_id);
        break;

      case 'cheer':
        if (!cheer_id) {
          return res.status(400).json(createErrorResponse('cheer_id is required for cheer type'));
        }
        embedData = await generateCheerEmbed(cheer_id);
        break;

      case 'reminder':
        if (!user_id) {
          return res.status(400).json(createErrorResponse('user_id is required for reminder type'));
        }
        embedData = await generateReminderEmbed(user_id);
        break;

      case 'achievement':
        if (!user_id) {
          return res.status(400).json(createErrorResponse('user_id is required for achievement type'));
        }
        embedData = await generateAchievementEmbed(user_id, req.body.achievement_type);
        break;

      default:
        return res.status(400).json(createErrorResponse('Invalid type. Must be: checkin, cheer, reminder, or achievement'));
    }

    // Send webhook to Discord
    const webhookPayload = {
      content: embedData.content || null,
      embeds: [embedData.embed],
      channel_id: channel_id || null,
    };

    const webhookResponse = await fetch(webhook_url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(webhookPayload),
    });

    if (!webhookResponse.ok) {
      throw new Error(`Discord webhook failed: ${webhookResponse.statusText}`);
    }

    const webhookResult = await webhookResponse.json() as any;

    res.json(createSuccessResponse({
      webhook_sent: true,
      message_id: webhookResult.id,
      channel_id: webhookResult.channel_id,
    }, 'Webhook sent successfully'));

  } catch (error) {
    console.error('Discord webhook error:', error);
    res.status(500).json(createErrorResponse('Failed to send webhook', 500));
  }
}

async function generateCheckInEmbed(userId: string, checkinId: string) {
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

  const checkIn = await prisma.checkIn.findUnique({
    where: { id: checkinId },
    select: {
      id: true,
      date: true,
      status: true,
      photo_url: true,
      created_at: true,
    },
  });

  if (!user || !checkIn) {
    throw new Error('User or check-in not found');
  }

  return {
    embed: {
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
      ...(checkIn.photo_url && { image: { url: checkIn.photo_url } }),
    },
  };
}

async function generateCheerEmbed(cheerId: string) {
  const cheer = await prisma.cheer.findUnique({
    where: { id: cheerId },
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
    throw new Error('Cheer not found');
  }

  return {
    embed: {
      title: '💬 Cheer Received!',
      description: `**${cheer.from_user.username}** sent a cheer to **${cheer.to_user.username}**!`,
      color: 0xffd700,
      thumbnail: {
        url: cheer.from_user.avatar_url || 'https://cdn.discordapp.com/embed/avatars/0.png',
      },
      fields: [
        {
          name: '💬 Message',
          value: cheer.message || 'No message provided',
          inline: false,
        },
      ],
      footer: {
        text: 'Keep up the great work! 💪',
      },
      timestamp: cheer.created_at,
    },
  };
}

async function generateReminderEmbed(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      username: true,
      avatar_url: true,
      streak_count: true,
    },
  });

  if (!user) {
    throw new Error('User not found');
  }

  return {
    embed: {
      title: '⏰ Gym Reminder',
      description: `Hey **${user.username}**! It's time for your scheduled workout!`,
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
          name: '💪 Action',
          value: 'Time to hit the gym!',
          inline: true,
        },
      ],
      footer: {
        text: 'Don\'t break your streak! 💪',
      },
      timestamp: new Date().toISOString(),
    },
  };
}

async function generateAchievementEmbed(userId: string, achievementType: string) {
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
    throw new Error('User not found');
  }

  let title = '🏆 Achievement Unlocked!';
  let description = `**${user.username}** has unlocked a new achievement!`;
  let color = 0xffd700;

  switch (achievementType) {
    case 'streak_7':
      title = '🔥 7-Day Streak!';
      description = `**${user.username}** has maintained a 7-day streak!`;
      color = 0xff6b35;
      break;
    case 'streak_30':
      title = '🔥 30-Day Streak!';
      description = `**${user.username}** has maintained a 30-day streak!`;
      color = 0xff0000;
      break;
    case 'checkins_50':
      title = '💪 50 Check-ins!';
      description = `**${user.username}** has completed 50 gym sessions!`;
      color = 0x00ff00;
      break;
    case 'checkins_100':
      title = '💪 100 Check-ins!';
      description = `**${user.username}** has completed 100 gym sessions!`;
      color = 0x0099ff;
      break;
  }

  return {
    embed: {
      title,
      description,
      color,
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
      ],
      footer: {
        text: 'Congratulations! Keep up the amazing work! 🎉',
      },
      timestamp: new Date().toISOString(),
    },
  };
}
