import { VercelRequest, VercelResponse } from '@vercel/node';
import { prisma } from '../../src/lib/prisma';
import { createErrorResponse, createSuccessResponse } from '../../src/lib/validation';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const { userId } = req.query;

  if (!userId || typeof userId !== 'string') {
    return res.status(400).json(createErrorResponse('User ID required'));
  }

  if (req.method === 'GET') {
    try {
      const { 
        page = '1', 
        limit = '20', 
        type = 'all',
        unread_only = 'false'
      } = req.query;

      const pageNum = parseInt(page as string, 10);
      const limitNum = parseInt(limit as string, 10);
      const skip = (pageNum - 1) * limitNum;
      const unreadOnly = unread_only === 'true';

      if (isNaN(pageNum) || pageNum < 1) {
        return res.status(400).json(createErrorResponse('Page must be a positive number'));
      }

      if (isNaN(limitNum) || limitNum < 1 || limitNum > 100) {
        return res.status(400).json(createErrorResponse('Limit must be between 1 and 100'));
      }

      // Build where clause
      let whereClause: any = {
        user_id: userId,
      };

      if (type !== 'all') {
        whereClause.type = type;
      }

      if (unreadOnly) {
        whereClause.read_at = null;
      }

      // Get notifications
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
          orderBy: {
            created_at: 'desc',
          },
          skip,
          take: limitNum,
        }),
        prisma.notification.count({
          where: whereClause,
        }),
      ]);

      // Get unread count
      const unreadCount = await prisma.notification.count({
        where: {
          user_id: userId,
          read_at: null,
        },
      });

      const response = {
        notifications: notifications.map(notification => ({
          id: notification.id,
          type: notification.type,
          title: notification.title,
          message: notification.message,
          data: notification.data,
          read_at: notification.read_at,
          created_at: notification.created_at,
          from_user: notification.from_user,
          formatted_date: new Date(notification.created_at).toLocaleDateString(),
          formatted_time: new Date(notification.created_at).toLocaleTimeString(),
        })),
        pagination: {
          page: pageNum,
          limit: limitNum,
          total: totalCount,
          pages: Math.ceil(totalCount / limitNum),
          has_next: pageNum * limitNum < totalCount,
          has_prev: pageNum > 1,
        },
        unread_count: unreadCount,
      };

      res.json(createSuccessResponse(response, 'Notifications retrieved'));
    } catch (error) {
      console.error('Get notifications error:', error);
      res.status(500).json(createErrorResponse('Failed to fetch notifications', 500));
    }
  } else if (req.method === 'POST') {
    // Mark notifications as read
    try {
      const { notification_ids } = req.body;

      if (!notification_ids || !Array.isArray(notification_ids)) {
        return res.status(400).json(createErrorResponse('notification_ids array is required'));
      }

      const updated = await prisma.notification.updateMany({
        where: {
          id: { in: notification_ids },
          user_id: userId,
          read_at: null,
        },
        data: {
          read_at: new Date(),
        },
      });

      res.json(createSuccessResponse({
        updated_count: updated.count,
      }, 'Notifications marked as read'));
    } catch (error) {
      console.error('Mark notifications as read error:', error);
      res.status(500).json(createErrorResponse('Failed to mark notifications as read', 500));
    }
  } else if (req.method === 'PUT') {
    // Mark all notifications as read
    try {
      const updated = await prisma.notification.updateMany({
        where: {
          user_id: userId,
          read_at: null,
        },
        data: {
          read_at: new Date(),
        },
      });

      res.json(createSuccessResponse({
        updated_count: updated.count,
      }, 'All notifications marked as read'));
    } catch (error) {
      console.error('Mark all notifications as read error:', error);
      res.status(500).json(createErrorResponse('Failed to mark all notifications as read', 500));
    }
  } else {
    res.status(405).json(createErrorResponse('Method not allowed', 405));
  }
}
