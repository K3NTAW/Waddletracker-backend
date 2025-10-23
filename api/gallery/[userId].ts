import { VercelRequest, VercelResponse } from '@vercel/node';
import { prisma } from '../../src/lib/prisma';
import { createErrorResponse, createSuccessResponse } from '../../src/lib/validation';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json(createErrorResponse('Method not allowed', 405));
  }

  const { userId } = req.query;

  if (!userId || typeof userId !== 'string') {
    return res.status(400).json(createErrorResponse('User ID required'));
  }

  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
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
        orderBy: {
          date: 'desc',
        },
        skip,
        take: limitNum,
      }),
      prisma.checkIn.count({
        where: whereClause,
      }),
    ]);

    // Get statistics
    const stats = await prisma.checkIn.groupBy({
      by: ['status'],
      where: {
        user_id: userId,
        photo_url: { not: null },
        ...(Object.keys(dateFilter).length > 0 ? { date: dateFilter } : {}),
      },
      _count: {
        status: true,
      },
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
      select: {
        date: true,
      },
      orderBy: {
        date: 'desc',
      },
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

    res.json(createSuccessResponse(response, 'Photo gallery retrieved'));
  } catch (error) {
    console.error('Get photo gallery error:', error);
    res.status(500).json(createErrorResponse('Failed to fetch photo gallery', 500));
  }
}
