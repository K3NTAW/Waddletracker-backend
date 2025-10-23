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
    const { from_discord_id, to_discord_id, message } = req.body;

    if (!from_discord_id || !to_discord_id) {
      return res.status(400).json(createErrorResponse('from_discord_id and to_discord_id are required'));
    }

    // Get users by Discord IDs
    const [fromUser, toUser] = await Promise.all([
      prisma.user.findUnique({
        where: { discord_id: from_discord_id },
        select: { id: true, username: true, avatar_url: true },
      }),
      prisma.user.findUnique({
        where: { discord_id: to_discord_id },
        select: { id: true, username: true, avatar_url: true },
      }),
    ]);

    if (!fromUser || !toUser) {
      return res.status(404).json(createErrorResponse('One or both users not found', 404));
    }

    // Create cheer in database
    const cheer = await prisma.cheer.create({
      data: {
        from_user_id: fromUser.id,
        to_user_id: toUser.id,
        message: message || null,
      },
    });

    // Create Discord embed data
    const embedData = {
      title: '💬 Cheer Received!',
      description: `**${fromUser.username}** sent you a cheer!`,
      color: 0xffd700,
      thumbnail: {
        url: fromUser.avatar_url || 'https://cdn.discordapp.com/embed/avatars/0.png',
      },
      fields: [
        {
          name: '👤 From',
          value: fromUser.username,
          inline: true,
        },
        {
          name: '👤 To',
          value: toUser.username,
          inline: true,
        },
        {
          name: '💬 Message',
          value: message || 'No message provided',
          inline: false,
        },
      ],
      footer: {
        text: 'Keep up the great work! 💪',
      },
      timestamp: new Date().toISOString(),
    };

    res.json(createSuccessResponse({
      embed: embedData,
      cheer_id: cheer.id,
    }, 'Cheer created and embed generated'));
  } catch (error) {
    console.error('Create cheer embed error:', error);
    res.status(500).json(createErrorResponse('Failed to create cheer', 500));
  }
}
