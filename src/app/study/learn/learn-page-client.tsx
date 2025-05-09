'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import Header from '@/components/Header';
import LessonCard from '@/components/LessonCard';
import QuizCard from '@/components/QuizCard';
import { calculateNextReview, quizResultToQuality, calculateXpForReview, updateStreak } from '@/utils/spacedRepetition';
import { Database } from '@/types/supabase';
import type { User } from '@supabase/supabase-js';

// ... (Keep all interface definitions: CardType, Card, LessonCardData, QuizCardData, Blueprint) ...
// ... (Keep MODE_WEIGHT_FACTORS constant) ...

type CardType = 'lesson' | 'quiz';

interface Card {
  id: string;
  type: CardType;
  data: LessonCardData | QuizCardData;
  blueprintId?: string;
  mastered?: boolean;
}

interface LessonCardData {
  title: string;
  content: string;
  bulletPoints: string[];
}

interface QuizCardData {
  question: string;
  choices: string[];
  correctIndex: number;
  explanation: string;
}

interface Blueprint {
  id: string;
  exam: string;
  domain: string;
  section: string;
  learning_outcome: string;
}

const MODE_WEIGHT_FACTORS = {
  learn: 3,    // Learn mode (lesson + quiz)
  lessons: 2,  // Lessons mode (lesson only)
  quiz: 5,     // Quiz mode
};

export default function ClientLearnPage() {
  const searchParams = useSearchParams();
  const examParam = searchParams.get('exam') || 'SIE';

  const [isLoading, setIsLoading] = useState(true);
  const [cards, setCards] = useState<Card[]>([]);
  const [currentCardIndex, setCurrentCardIndex] = useState(0);
  const [cardsCompleted, setCardsCompleted] = useState(0);
  const [sessionXp, setSessionXp] = useState(0);
  const [sessionWeightedEffort, setSessionWeightedEffort] = useState(0);
  const [blueprints, setBlueprints] = useState<Blueprint[]>([]);
  const [masteryMap, setMasteryMap] = useState<Record<string, boolean>>({});
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [progress, setProgress] = useState({ completed: 0, total: 0 });
  
  const router = useRouter();
  const supabase = createClientComponentClient<Database>();

  useEffect(() => {
    const checkAuthAndLoad = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.push('/auth');
        return;
      }
      setCurrentUser(session.user);
      await loadData(session.user);
    };
    checkAuthAndLoad();
  }, [router, supabase, examParam]);

  const safeParseBulletPoints = (bulletPoints: any) => {
    if (Array.isArray(bulletPoints)) return bulletPoints;
    try {
      if (typeof bulletPoints === 'string') {
        const parsed = JSON.parse(bulletPoints || '[]');
        return Array.isArray(parsed) ? parsed : [];
      }
      return [];
    } catch (e) {
      console.error('Error parsing bulletPoints:', e);
      return [];
    }
  };

  const loadData = async (user: User) => {
    try {
      setIsLoading(true);
      const { data: blueprintsData, error: blueprintsError } = await supabase
        .from('blueprints')
        .select('*')
        .eq('exam', examParam);
      if (blueprintsError) {
        console.error('Error loading blueprints:', blueprintsError);
        return;
      }
      setBlueprints(blueprintsData || []);
      const { data: reviewsData } = await supabase
        .from('reviews')
        .select('*')
        .eq('user_id', user.id);
      const newMasteryMap: Record<string, boolean> = {};
      if (reviewsData) {
        reviewsData.forEach(review => {
          const isMastered = review.consecutive_correct_answers >= 3;
          newMasteryMap[review.card_id] = isMastered;
        });
      }
      setMasteryMap(newMasteryMap);
      await loadCards(blueprintsData || []);
    } catch (error) {
      console.error('Error in initial load:', error);
      setIsLoading(false);
    }
  };

  const loadCards = async (loadedBlueprints: Blueprint[]) => {
    try {
      const lessonQuizPairs: Card[] = [];
      for (const blueprint of loadedBlueprints) {
        const { data: lessonsData } = await supabase
          .from('lessons')
          .select('*')
          .eq('blueprint_id', blueprint.id);
        const { data: quizzesData } = await supabase
          .from('quizzes')
          .select('*')
          .eq('blueprint_id', blueprint.id);
        if (lessonsData && lessonsData.length > 0) {
          const lesson = lessonsData[Math.floor(Math.random() * lessonsData.length)];
          lessonQuizPairs.push({
            id: lesson.id,
            type: 'lesson',
            blueprintId: blueprint.id,
            data: {
              title: lesson.title,
              content: lesson.content,
              bulletPoints: safeParseBulletPoints(lesson.bullet_points)
            },
            mastered: masteryMap[lesson.id] || false
          });
          if (quizzesData && quizzesData.length > 0) {
            const quiz = quizzesData[Math.floor(Math.random() * quizzesData.length)];
            lessonQuizPairs.push({
              id: quiz.id,
              type: 'quiz',
              blueprintId: blueprint.id,
              data: {
                question: quiz.question,
                choices: quiz.choices || [],
                correctIndex: quiz.correct_index,
                explanation: quiz.explanation
              },
              mastered: masteryMap[quiz.id] || false
            });
          }
        }
      }
      setProgress({ completed: 0, total: lessonQuizPairs.length });
      setCards(lessonQuizPairs);
      setCurrentCardIndex(0);
      setCardsCompleted(0);
      setSessionXp(0);
      setSessionWeightedEffort(0);
      setIsLoading(false);
    } catch (error) {
      console.error(`Error loading cards:`, error);
      setIsLoading(false);
    }
  };

  const handleLessonComplete = async (lessonId: string, quality: number) => {
    const isCorrect = quality >= 3;
    const xpEarned = calculateXpForReview(quality);
    setSessionXp(prev => prev + xpEarned);
    const effortPoints = MODE_WEIGHT_FACTORS.learn || 3;
    setSessionWeightedEffort(prev => prev + effortPoints);
    if (currentUser) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('xp')
        .eq('id', currentUser.id)
        .single();
      if (profile) {
        await supabase
          .from('profiles')
          .update({ xp: (profile.xp || 0) + xpEarned })
          .eq('id', currentUser.id);
      }
    }
    await updateReviewData(lessonId, 'lesson', quality, isCorrect);
    goToNextCard();
  };

  const handleQuizAnswer = async (quizId: string, isCorrect: boolean) => {
    const quality = quizResultToQuality(isCorrect);
    let xpEarned = 0;
    if (isCorrect) {
      xpEarned = 10;
      setSessionXp(prev => prev + xpEarned);
    }
    const effortPoints = MODE_WEIGHT_FACTORS.learn || 3;
    setSessionWeightedEffort(prev => prev + effortPoints);
    if (currentUser) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('xp, daily_goal')
        .eq('id', currentUser.id)
        .single();
      if (profile) {
        const newXp = (profile.xp || 0) + xpEarned;
        await supabase
          .from('profiles')
          .update({ xp: newXp })
          .eq('id', currentUser.id);
      }
    }
    await updateReviewData(quizId, 'quiz', quality, isCorrect);
    setTimeout(() => { goToNextCard(); }, 1500);
  };

  const updateReviewData = async (cardId: string, cardType: CardType, quality: number, isCorrect: boolean) => {
    if (!currentUser) return;
    try {
      let { data: existingReview, error: fetchError } = await supabase
        .from('reviews')
        .select('*')
        .eq('user_id', currentUser.id)
        .eq('card_id', cardId)
        .maybeSingle();
      if (fetchError) {
        console.error("Error fetching review:", fetchError);
        return;
      }
      let currentConsecutive = existingReview?.consecutive_correct_answers || 0;
      let newConsecutive = isCorrect ? currentConsecutive + 1 : 0;
      const reviewDataInput = {
        interval: existingReview?.interval || 0,
        repetitions: existingReview?.repetitions || 0,
        easeFactor: existingReview?.ease_factor || 2.5,
        nextReview: new Date()
      };
      const { interval, repetitions, easeFactor, nextReview } = calculateNextReview(quality, reviewDataInput);
      const reviewUpdateData = {
        user_id: currentUser.id,
        card_id: cardId,
        card_type: cardType,
        ease_factor: easeFactor,
        interval: interval,
        repetitions: repetitions,
        consecutive_correct_answers: newConsecutive,
        next_review: nextReview.toISOString(),
        last_review: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      const { error: upsertError } = await supabase
        .from('reviews')
        .upsert(reviewUpdateData, { onConflict: 'user_id, card_id' });
      if (upsertError) {
        console.error('Error upserting review:', upsertError);
        return;
      }
      const isMastered = newConsecutive >= 3;
      setMasteryMap(prev => ({ ...prev, [cardId]: isMastered }));
    } catch (error) {
      console.error('Error updating review data:', error);
    }
  };

  const goToNextCard = () => {
    setCardsCompleted(prev => prev + 1);
    setProgress(prev => ({ ...prev, completed: prev.completed + 1 }));
    if (currentCardIndex + 1 < cards.length) {
      setCurrentCardIndex(prev => prev + 1);
    } else {
      completeSession();
    }
  };

  const completeSession = async () => {
    if (currentUser) {
      await updateUserStreak(currentUser.id);
      await supabase.from('activities').insert({
        user_id: currentUser.id,
        activity_type: 'study_session_completed',
        details: {
          mode: 'learn',
          cards_completed: cardsCompleted + 1,
          xp_earned: sessionXp,
          weighted_effort: sessionWeightedEffort + (MODE_WEIGHT_FACTORS.learn || 3)
        },
        created_at: new Date().toISOString()
      });
    }
  };

  const updateUserStreak = async (userId: string) => {
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const { data: profile } = await supabase
        .from('profiles')
        .select('streak, last_streak_date, questions_completed_today')
        .eq('id', userId)
        .single();
      if (profile) {
        const quizCards = cards.filter(card => card.type === 'quiz');
        const quizzesCompleted = Math.min(cardsCompleted, quizCards.length);
        const streakData = {
          lastStreakDate: profile.last_streak_date ? new Date(profile.last_streak_date) : null,
          streak: profile.streak || 0,
          questionsCompleted: profile.questions_completed_today || 0
        };
        const updatedStreakData = updateStreak(streakData, quizzesCompleted);
        await supabase
          .from('profiles')
          .update({ 
            streak: updatedStreakData.streak,
            last_streak_date: updatedStreakData.lastStreakDate ? updatedStreakData.lastStreakDate.toISOString() : new Date().toISOString(),
            questions_completed_today: updatedStreakData.questionsCompleted
          })
          .eq('id', userId);
        await supabase
          .from('activities')
          .insert({
            user_id: userId,
            activity_type: 'study_session',
            details: {
              mode: 'learn',
              cards_completed: cardsCompleted,
              questions_completed: quizzesCompleted,
              xp_earned: sessionXp,
              weighted_effort: sessionWeightedEffort
            },
            created_at: new Date().toISOString()
          });
      }
    } catch (error) {
      console.error('Error updating streak:', error);
    }
  };

  const handleLeaveSession = async () => {
    if (sessionXp > 0 && currentUser) {
      await supabase.from('activities').insert({
        user_id: currentUser.id,
        activity_type: 'study_session',
        details: {
          mode: 'learn',
          cards_completed: cardsCompleted,
          xp_earned: sessionXp,
          weighted_effort: sessionWeightedEffort
        },
        created_at: new Date().toISOString()
      });
      await updateUserStreak(currentUser.id);
    }
    router.push('/study');
  };

  const renderCurrentCard = () => {
    if (cards.length === 0) {
      return (
        <div className="text-center my-8 p-6 bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700">
          <p className="text-lg text-gray-600 dark:text-gray-400">
            No lessons available for this exam. Try selecting a different exam.
          </p>
          <button onClick={() => router.push('/study')} className="mt-4 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
            Back to Study Menu
          </button>
        </div>
      );
    }
    if (currentCardIndex >= cards.length) {
      return (
        <div className="text-center my-8 p-6 bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700">
          <div className="flex justify-center mb-4">
            <div className="bg-green-100 dark:bg-green-900 rounded-full p-4">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 text-green-600 dark:text-green-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
          </div>
          <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">Congratulations! Learning Complete!</h3>
          <div className="bg-blue-50 dark:bg-blue-900/30 p-4 rounded-lg mb-6">
            <p className="text-xl font-semibold text-blue-700 dark:text-blue-300">+{sessionXp} XP Earned</p>
            <p className="text-gray-600 dark:text-gray-400 mt-1">You've completed all learning materials in this session.</p>
          </div>
          <div className="flex flex-col sm:flex-row justify-center gap-4">
            <button onClick={() => router.push('/dashboard')} className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700">
              Back to Dashboard
            </button>
            <button onClick={() => loadData(currentUser!)} className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
              Start New Learning Session
            </button>
            <button onClick={() => router.push('/study')} className="px-6 py-2 bg-gray-200 text-gray-800 dark:bg-gray-700 dark:text-gray-200 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600">
              Change Study Mode
            </button>
          </div>
        </div>
      );
    }
    const currentCard = cards[currentCardIndex];
    if (currentCard.type === 'lesson') {
      const lessonData = currentCard.data as LessonCardData;
      const safePoints = safeParseBulletPoints(lessonData.bulletPoints);
      return <LessonCard lessonId={currentCard.id} title={lessonData.title} content={lessonData.content} bulletPoints={safePoints} onComplete={handleLessonComplete} />;
    } else {
      const quizData = currentCard.data as QuizCardData;
      let quizContext = "Test your knowledge";
      if (currentCardIndex > 0 && cards[currentCardIndex - 1].type === 'lesson') {
        const previousLesson = cards[currentCardIndex - 1].data as LessonCardData;
        quizContext = `Quiz on: ${previousLesson.title}`;
      }
      return (
        <>
          {quizContext !== "Test your knowledge" && (
            <div className="mb-2 text-sm font-medium text-blue-600 dark:text-blue-400">{quizContext}</div>
          )}
          <QuizCard quizId={currentCard.id} question={quizData.question} choices={quizData.choices} correctIndex={quizData.correctIndex} explanation={quizData.explanation} onReview={handleQuizAnswer} />
        </>
      );
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <Header />
      <main className="container mx-auto px-4 py-8">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Learn Mode</h1>
          <button onClick={() => router.push('/study')} className="text-sm px-4 py-2 bg-gray-200 text-gray-800 dark:bg-gray-700 dark:text-gray-200 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600">
            Back to Study Menu
          </button>
        </div>
        {isLoading ? (
          <div className="flex items-center justify-center min-h-[300px]">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
          </div>
        ) : (
          <>
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 p-4 mb-6">
              <div className="flex flex-col sm:flex-row justify-between items-center mb-4">
                <div className="flex items-center mb-2 sm:mb-0">
                  <div className="mr-4">
                    <span className="text-2xl font-bold text-blue-600 dark:text-blue-400">{cardsCompleted}</span>
                    <span className="text-gray-500 dark:text-gray-400"> / {progress.total}</span>
                  </div>
                  <div>
                    <span className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200 text-xs font-medium px-2 py-1 rounded">
                      {sessionXp} XP Earned
                    </span>
                  </div>
                </div>
                <div className="flex items-center">
                  <button onClick={handleLeaveSession} className="text-sm px-3 py-1 bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300 rounded-lg hover:bg-blue-200 dark:hover:bg-blue-800">
                    Leave & Save
                  </button>
                </div>
              </div>
              <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2.5">
                <div className="bg-blue-600 h-2.5 rounded-full" style={{ width: `${progress.total ? (progress.completed / progress.total) * 100 : 0}%` }}></div>
              </div>
            </div>
            {renderCurrentCard()}
          </>
        )}
      </main>
    </div>
  );
} 