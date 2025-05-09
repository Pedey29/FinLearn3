/**
 * SM-2 Algorithm for Spaced Repetition
 * 
 * Based on SuperMemo-2 algorithm:
 * - https://en.wikipedia.org/wiki/SuperMemo#Description_of_SM-2_algorithm
 * 
 * Quality ratings (1-5):
 * 1-2: Difficult (failed to recall)
 * 3: Medium difficulty (recalled with effort)
 * 4-5: Easy (recalled easily)
 */

interface ReviewData {
  interval: number;       // Current interval in days
  repetitions: number;    // How many times the card has been successfully reviewed
  easeFactor: number;     // Ease factor (>= 1.3)
  nextReview: Date;       // Date of next review
}

export function calculateNextReview(
  quality: number,       // Quality of response (1-5)
  currentData: ReviewData
): ReviewData {
  const { interval, repetitions, easeFactor } = currentData;
  let newInterval: number;
  let newRepetitions: number;
  let newEaseFactor: number;

  // Convert 1-5 scale to 0-5 scale expected by SM-2
  const q = Math.max(0, quality - 1);
  
  // Calculate new ease factor
  newEaseFactor = Math.max(
    1.3, // Minimum ease factor
    easeFactor + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02))
  );

  // If the quality is less than 3 (i.e., quality was 1 or 2), then we reset
  if (quality < 3) {
    newInterval = 1; // Back to 1 day
    newRepetitions = 0; // Reset repetition count
  } else {
    // Update repetition count
    newRepetitions = repetitions + 1;

    // Calculate new interval
    if (newRepetitions === 1) {
      newInterval = 1;
    } else if (newRepetitions === 2) {
      newInterval = 6;
    } else {
      newInterval = Math.round(interval * newEaseFactor);
    }
  }

  // Calculate next review date
  const now = new Date();
  const nextReview = new Date(now);
  nextReview.setDate(now.getDate() + newInterval);

  return {
    interval: newInterval,
    repetitions: newRepetitions,
    easeFactor: newEaseFactor,
    nextReview
  };
}

// For quiz cards, we want to convert a boolean (correct/incorrect) to a quality score
export function quizResultToQuality(isCorrect: boolean): number {
  return isCorrect ? 5 : 2; // 5 for correct, 2 for incorrect
}

// Calculate XP earned from a review
export function calculateXpForReview(quality: number): number {
  return 10; // Always earn 10 XP regardless of rating
}

// New interface for streak-related data
export interface StreakData {
  lastStreakDate: Date | null;  // Date of last streak update
  streak: number;               // Current streak count
  questionsCompleted: number;   // Number of questions completed today
}

/**
 * Update user streak based on completed questions
 * A streak is maintained when:
 * 1. User completes at least 5 questions in a day
 * 2. User logs in on consecutive days and meets the minimum question requirement
 */
export function updateStreak(
  streakData: StreakData,
  questionsCompleted: number = 1
): StreakData {
  const MINIMUM_QUESTIONS_REQUIRED = 5; // Minimum questions to maintain streak
  const today = new Date();
  today.setHours(0, 0, 0, 0); // Set to midnight for proper comparison
  
  // Initialize defaults
  const result: StreakData = {
    lastStreakDate: today,
    streak: streakData.streak || 0,
    questionsCompleted: 0
  };
  
  if (!streakData.lastStreakDate) {
    // First time user
    result.questionsCompleted = questionsCompleted;
    // Only award streak if they've completed the minimum required questions
    result.streak = questionsCompleted >= MINIMUM_QUESTIONS_REQUIRED ? 1 : 0;
    return result;
  }
  
  // Normalize the date to midnight
  const normalizedLastDate = new Date(streakData.lastStreakDate);
  normalizedLastDate.setHours(0, 0, 0, 0);
  
  // Calculate date difference in days
  const diffTime = Math.abs(today.getTime() - normalizedLastDate.getTime());
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  
  if (diffDays === 0) {
    // Same day, update question count
    result.questionsCompleted = streakData.questionsCompleted + questionsCompleted;
    
    // If they've just reached the minimum threshold today, award the streak
    if (streakData.questionsCompleted < MINIMUM_QUESTIONS_REQUIRED && 
        result.questionsCompleted >= MINIMUM_QUESTIONS_REQUIRED) {
      result.streak = streakData.streak + 1;
    } else {
      result.streak = streakData.streak;
    }
  } else if (diffDays === 1) {
    // New day, check if they met the minimum from yesterday
    const metYesterdayRequirement = streakData.questionsCompleted >= MINIMUM_QUESTIONS_REQUIRED;
    
    // Start fresh count for today
    result.questionsCompleted = questionsCompleted;
    
    // If they met yesterday's requirement and have enough questions today, increment streak
    if (metYesterdayRequirement && questionsCompleted >= MINIMUM_QUESTIONS_REQUIRED) {
      result.streak = streakData.streak + 1;
    } else if (metYesterdayRequirement) {
      // They met yesterday's requirement but not today's yet, maintain streak
      result.streak = streakData.streak;
    } else {
      // They didn't meet yesterday's requirement, reset streak
      result.streak = questionsCompleted >= MINIMUM_QUESTIONS_REQUIRED ? 1 : 0;
    }
  } else {
    // More than one day has passed, reset streak
    result.questionsCompleted = questionsCompleted;
    result.streak = questionsCompleted >= MINIMUM_QUESTIONS_REQUIRED ? 1 : 0;
  }
  
  return result;
}

// Compatibility function for old API
export function updateStreakLegacy(lastStreakDate: Date | null, streak: number): { newStreak: number, updatedDate: Date } {
  const today = new Date();
  today.setHours(0, 0, 0, 0); // Set to midnight for proper comparison
  
  if (!lastStreakDate) {
    // First time user
    return { newStreak: 1, updatedDate: today };
  }
  
  // Normalize the date to midnight
  const normalizedLastDate = new Date(lastStreakDate);
  normalizedLastDate.setHours(0, 0, 0, 0);
  
  // Calculate date difference in days
  const diffTime = Math.abs(today.getTime() - normalizedLastDate.getTime());
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  
  if (diffDays === 0) {
    // Already recorded today, maintain current streak
    return { newStreak: streak, updatedDate: today };
  } else if (diffDays === 1) {
    // Consecutive day, increment streak
    return { newStreak: streak + 1, updatedDate: today };
  } else {
    // Streak broken (gap of more than 1 day)
    return { newStreak: 1, updatedDate: today };
  }
} 