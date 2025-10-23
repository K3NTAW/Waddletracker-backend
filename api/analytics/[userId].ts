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
        date: {
          gte: startDate,
        },
      },
      select: {
        id: true,
        date: true,
        status: true,
        photo_url: true,
        created_at: true,
      },
      orderBy: {
        date: 'asc',
      },
    });

    // Calculate analytics
    const totalCheckIns = checkIns.length;
    const wentCount = checkIns.filter(c => c.status === 'went').length;
    const missedCount = checkIns.filter(c => c.status === 'missed').length;
    const photoCount = checkIns.filter(c => c.photo_url).length;

    // Calculate attendance rate
    const attendanceRate = totalCheckIns > 0 ? (wentCount / totalCheckIns) * 100 : 0;

    // Calculate weekly stats
    const weeklyStats = calculateWeeklyStats(checkIns, days);

    // Calculate streak analytics
    const streakAnalytics = calculateStreakAnalytics(checkIns);

    // Calculate photo analytics
    const photoAnalytics = calculatePhotoAnalytics(checkIns);

    // Calculate consistency score (based on attendance rate and streak consistency)
    const consistencyScore = calculateConsistencyScore(attendanceRate, streakAnalytics);

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
        consistency_score: Math.round(consistencyScore * 100) / 100,
      },
      weekly_stats: weeklyStats,
      streak_analytics: streakAnalytics,
      photo_analytics: photoAnalytics,
      trends: {
        daily_attendance: calculateDailyAttendance(checkIns, days),
        weekly_attendance: calculateWeeklyAttendance(checkIns, days),
        monthly_attendance: calculateMonthlyAttendance(checkIns, days),
      },
    };

    res.json(createSuccessResponse(analytics, 'Analytics data generated'));
  } catch (error) {
    console.error('Get analytics error:', error);
    res.status(500).json(createErrorResponse('Failed to fetch analytics', 500));
  }
}

function calculateWeeklyStats(checkIns: any[], days: number) {
  const weeks = Math.ceil(days / 7);
  const weeklyData = [];

  for (let i = 0; i < weeks; i++) {
    const weekStart = new Date();
    weekStart.setDate(weekStart.getDate() - (i + 1) * 7);
    const weekEnd = new Date();
    weekEnd.setDate(weekEnd.getDate() - i * 7);

    const weekCheckIns = checkIns.filter(c => {
      const checkInDate = new Date(c.date);
      return checkInDate >= weekStart && checkInDate < weekEnd;
    });

    const wentCount = weekCheckIns.filter(c => c.status === 'went').length;
    const missedCount = weekCheckIns.filter(c => c.status === 'missed').length;
    const photoCount = weekCheckIns.filter(c => c.photo_url).length;

    weeklyData.push({
      week: i + 1,
      start_date: weekStart,
      end_date: weekEnd,
      went_count: wentCount,
      missed_count: missedCount,
      photo_count: photoCount,
      attendance_rate: weekCheckIns.length > 0 ? (wentCount / weekCheckIns.length) * 100 : 0,
    });
  }

  return weeklyData.reverse();
}

function calculateStreakAnalytics(checkIns: any[]) {
  const streaks = [];
  let currentStreak = 0;
  let maxStreak = 0;

  for (const checkIn of checkIns) {
    if (checkIn.status === 'went') {
      currentStreak++;
      maxStreak = Math.max(maxStreak, currentStreak);
    } else {
      if (currentStreak > 0) {
        streaks.push(currentStreak);
      }
      currentStreak = 0;
    }
  }

  if (currentStreak > 0) {
    streaks.push(currentStreak);
  }

  const averageStreak = streaks.length > 0 ? streaks.reduce((a, b) => a + b, 0) / streaks.length : 0;

  return {
    current_streak: currentStreak,
    max_streak: maxStreak,
    average_streak: Math.round(averageStreak * 100) / 100,
    total_streaks: streaks.length,
    streak_breakdown: streaks,
  };
}

function calculatePhotoAnalytics(checkIns: any[]) {
  const photos = checkIns.filter(c => c.photo_url);
  const photoRate = checkIns.length > 0 ? (photos.length / checkIns.length) * 100 : 0;

  return {
    total_photos: photos.length,
    photo_rate: Math.round(photoRate * 100) / 100,
    photos_by_status: {
      went: photos.filter(c => c.status === 'went').length,
      missed: photos.filter(c => c.status === 'missed').length,
    },
  };
}

function calculateConsistencyScore(attendanceRate: number, streakAnalytics: any) {
  const attendanceScore = Math.min(attendanceRate, 100) / 100;
  const streakScore = Math.min(streakAnalytics.average_streak / 7, 1); // Normalize to weekly basis
  const consistencyScore = (attendanceScore * 0.7) + (streakScore * 0.3);
  return Math.min(consistencyScore * 100, 100);
}

function calculateDailyAttendance(checkIns: any[], days: number) {
  const dailyData = [];
  for (let i = 0; i < days; i++) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    date.setHours(0, 0, 0, 0);

    const dayCheckIns = checkIns.filter(c => {
      const checkInDate = new Date(c.date);
      checkInDate.setHours(0, 0, 0, 0);
      return checkInDate.getTime() === date.getTime();
    });

    dailyData.push({
      date: date.toISOString().split('T')[0],
      went: dayCheckIns.filter(c => c.status === 'went').length,
      missed: dayCheckIns.filter(c => c.status === 'missed').length,
      total: dayCheckIns.length,
    });
  }

  return dailyData.reverse();
}

function calculateWeeklyAttendance(checkIns: any[], days: number) {
  const weeks = Math.ceil(days / 7);
  const weeklyData = [];

  for (let i = 0; i < weeks; i++) {
    const weekStart = new Date();
    weekStart.setDate(weekStart.getDate() - (i + 1) * 7);
    const weekEnd = new Date();
    weekEnd.setDate(weekEnd.getDate() - i * 7);

    const weekCheckIns = checkIns.filter(c => {
      const checkInDate = new Date(c.date);
      return checkInDate >= weekStart && checkInDate < weekEnd;
    });

    weeklyData.push({
      week: i + 1,
      start_date: weekStart.toISOString().split('T')[0],
      end_date: weekEnd.toISOString().split('T')[0],
      went: weekCheckIns.filter(c => c.status === 'went').length,
      missed: weekCheckIns.filter(c => c.status === 'missed').length,
      total: weekCheckIns.length,
    });
  }

  return weeklyData.reverse();
}

function calculateMonthlyAttendance(checkIns: any[], days: number) {
  const months = Math.ceil(days / 30);
  const monthlyData = [];

  for (let i = 0; i < months; i++) {
    const monthStart = new Date();
    monthStart.setMonth(monthStart.getMonth() - (i + 1));
    const monthEnd = new Date();
    monthEnd.setMonth(monthEnd.getMonth() - i);

    const monthCheckIns = checkIns.filter(c => {
      const checkInDate = new Date(c.date);
      return checkInDate >= monthStart && checkInDate < monthEnd;
    });

    monthlyData.push({
      month: i + 1,
      start_date: monthStart.toISOString().split('T')[0],
      end_date: monthEnd.toISOString().split('T')[0],
      went: monthCheckIns.filter(c => c.status === 'went').length,
      missed: monthCheckIns.filter(c => c.status === 'missed').length,
      total: monthCheckIns.length,
    });
  }

  return monthlyData.reverse();
}
