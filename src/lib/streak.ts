import { prisma } from './prisma';
import { CheckInStatus } from '@prisma/client';

export interface StreakData {
  current_streak: number;
  longest_streak: number;
  total_checkins: number;
}

export const calculateStreak = async (userId: string): Promise<StreakData> => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      streak_count: true,
      longest_streak: true,
      total_checkins: true,
    },
  });

  if (!user) {
    throw new Error('User not found');
  }

  return {
    current_streak: user.streak_count,
    longest_streak: user.longest_streak,
    total_checkins: user.total_checkins,
  };
};

export const updateStreak = async (userId: string, checkInDate: Date, status: CheckInStatus): Promise<void> => {
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
};
