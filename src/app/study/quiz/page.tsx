'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import Header from '@/components/Header';
import QuizCard from '@/components/QuizCard';
import { calculateNextReview, quizResultToQuality, updateStreak } from '@/utils/spacedRepetition';
import { Database } from '@/types/supabase';
import type { User } from '@supabase/supabase-js';

interface QuizCardData {
  question: string;
  choices: string[];
  correctIndex: number;
  explanation: string;
}

interface Card {
  id: string;
  type: 'quiz';
  data: QuizCardData;
  blueprintId?: string;
  mastered?: boolean;
}

const MODE_WEIGHT_FACTOR = 5; // Quiz mode = 50% weight

export default function QuizModePage() {
  const [isLoading, setIsLoading] = useState(true);
  const [quizCards, setQuizCards] = useState<Card[]>([]);
  const [currentCardIndex, setCurrentCardIndex] = useState(0);
  const [cardsCompleted, setCardsCompleted] = useState(0);
  const [sessionXp, setSessionXp] = useState(0);
  const [sessionWeightedEffort, setSessionWeightedEffort] = useState(0);
  const [masteryMap, setMasteryMap] = useState<Record<string, boolean>>({});
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [progress, setProgress] = useState({ completed: 0, total: 0 });
  
  const router = useRouter();
  const searchParams = useSearchParams();
  const examParam = searchParams.get('exam') || 'SIE';
  const countParam = Number(searchParams.get('count')) || 10;
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

  const loadData = async (user: User) => {
    try {
      setIsLoading(true);
            
      // Load user's mastery data
      const { data: reviewsData } = await supabase
        .from('reviews')
        .select('*')
        .eq('user_id', user.id);
        
      const newMasteryMap: Record<string, boolean> = {};
      
      if (reviewsData) {
        reviewsData.forEach(review => {
          // Consider mastered if consecutive correct answers >= 3
          const isMastered = review.consecutive_correct_answers >= 3;
          newMasteryMap[review.card_id] = isMastered;
        });
      }
      
      setMasteryMap(newMasteryMap);
      
      // Load quizzes
      await loadQuizzes();
    } catch (error) {
      console.error('Error in initial load:', error);
      setIsLoading(false);
    }
  };

  const loadQuizzes = async () => {
    try {
      // Load quizzes for the selected exam
      const { data: quizzesData, error } = await supabase
        .from('quizzes')
        .select('*, blueprints!inner(*)')
        .eq('blueprints.exam', examParam);

      if (error) {
        console.error('Error loading quizzes:', error);
        setIsLoading(false);
        return;
      }
        
      if (quizzesData) {
        // Sort by mastery (non-mastered first)
        const sortedQuizzes = [...quizzesData].sort((a, b) => {
          const aMastered = masteryMap[a.id] || false;
          const bMastered = masteryMap[b.id] || false;
          return aMastered === bMastered ? 0 : aMastered ? 1 : -1;
        });
        
        // Take only the requested number of quizzes
        const selectedQuizzes = sortedQuizzes.slice(0, countParam).map(quiz => ({
          id: quiz.id,
          type: 'quiz' as const,
          blueprintId: quiz.blueprint_id,
          data: {
            question: quiz.question,
            choices: quiz.choices || [],
            correctIndex: quiz.correct_index,
            explanation: quiz.explanation
          },
          mastered: masteryMap[quiz.id] || false
        }));
        
        setProgress({ 
          completed: 0, 
          total: selectedQuizzes.length 
        });
        
        setQuizCards(selectedQuizzes);
        setCurrentCardIndex(0);
        setCardsCompleted(0);
        setSessionXp(0);
        setSessionWeightedEffort(0);
      }
      
      setIsLoading(false);
    } catch (error) {
      console.error(`Error loading quizzes:`, error);
      setIsLoading(false);
    }
  };

  const handleQuizAnswer = async (quizId: string, isCorrect: boolean) => {
    const quality = quizResultToQuality(isCorrect);
    let xpEarned = 0;
    
    if (isCorrect) {
      xpEarned = 10; // 10 XP per correct quiz answer
      setSessionXp(prev => prev + xpEarned);
    }

    setSessionWeightedEffort(prev => prev + MODE_WEIGHT_FACTOR);
    
    // Update user profile with earned XP
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
    
    await updateReviewData(quizId, quality, isCorrect);
    
    // Wait to show the explanation before moving on
    setTimeout(() => {
      goToNextCard();
    }, 1500);
  };

  const updateReviewData = async (
    cardId: string, 
    quality: number, 
    isCorrect: boolean
  ) => {
    if (!currentUser) return;

    try {
      // Get existing review
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

      // Update consecutive correct answers count
      let currentConsecutive = existingReview?.consecutive_correct_answers || 0;
      let newConsecutive = isCorrect ? currentConsecutive + 1 : 0;

      // Calculate next review date using spaced repetition
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
        card_type: 'quiz',
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
      
      // Update mastery map
      const isMastered = newConsecutive >= 3;
      setMasteryMap(prev => ({
        ...prev, 
        [cardId]: isMastered
      }));
    } catch (error) {
      console.error('Error updating review data:', error);
    }
  };

  const goToNextCard = () => {
    setCardsCompleted(prev => prev + 1);
    setProgress(prev => ({ 
      ...prev, 
      completed: prev.completed + 1 
    }));
    
    if (currentCardIndex + 1 < quizCards.length) {
      setCurrentCardIndex(prev => prev + 1);
    } else {
      // All cards completed - update streak and dashboard
      if (currentUser) {
        updateUserStreak(currentUser.id);
        
        // Log completed session
        supabase.from('activities').insert({
          user_id: currentUser.id,
          activity_type: 'study_session_completed',
          details: {
            mode: 'quiz',
            cards_completed: cardsCompleted + 1,
            xp_earned: sessionXp,
            weighted_effort: sessionWeightedEffort + MODE_WEIGHT_FACTOR
          },
          created_at: new Date().toISOString()
        });
      }
    }
  };

  const updateUserStreak = async (userId: string) => {
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0); // Set to midnight for proper comparison
      
      // Get the user's profile with streak information
      const { data: profile } = await supabase
        .from('profiles')
        .select('streak, last_streak_date, questions_completed_today')
        .eq('id', userId)
        .single();
        
      if (profile) {
        // Count completed questions in quiz mode
        const questionsCompleted = Math.min(cardsCompleted, quizCards.length);
        
        // Use the new streak calculation
        const streakData = {
          lastStreakDate: profile.last_streak_date ? new Date(profile.last_streak_date) : null,
          streak: profile.streak || 0,
          questionsCompleted: profile.questions_completed_today || 0
        };
        
        const updatedStreakData = updateStreak(streakData, questionsCompleted);
        
        // Update the user's profile with new streak data
        await supabase
          .from('profiles')
          .update({ 
            streak: updatedStreakData.streak,
            last_streak_date: updatedStreakData.lastStreakDate ? 
              updatedStreakData.lastStreakDate.toISOString() : 
              new Date().toISOString(),
            questions_completed_today: updatedStreakData.questionsCompleted
          })
          .eq('id', userId);
          
        // Log the activity
        await supabase
          .from('activities')
          .insert({
            user_id: userId,
            activity_type: 'study_session',
            details: {
              mode: 'quiz',
              cards_completed: cardsCompleted,
              questions_completed: questionsCompleted,
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

  // Save progress and return to study menu
  const handleLeaveSession = async () => {
    if (sessionXp > 0 && currentUser) {
      // Log study activity
      await supabase.from('activities').insert({
        user_id: currentUser.id,
        activity_type: 'study_session',
        details: {
          mode: 'quiz',
          cards_completed: cardsCompleted,
          xp_earned: sessionXp,
          weighted_effort: sessionWeightedEffort
        },
        created_at: new Date().toISOString()
      });
      
      // Update streak if needed
      await updateUserStreak(currentUser.id);
    }
    
    // Navigate back to study menu
    router.push('/study');
  };

  // Render current card
  const renderCurrentCard = () => {
    if (quizCards.length === 0 || currentCardIndex >= quizCards.length) {
      return (
        <div className="text-center my-8 p-6 bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700">
          <div className="flex justify-center mb-4">
            <div className="bg-green-100 dark:bg-green-900 rounded-full p-4">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 text-green-600 dark:text-green-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
          </div>
          <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
            Quiz Complete!
          </h3>
          <div className="bg-blue-50 dark:bg-blue-900/30 p-4 rounded-lg mb-6">
            <p className="text-xl font-semibold text-blue-700 dark:text-blue-300">
              +{sessionXp} XP Earned
            </p>
            <p className="text-gray-600 dark:text-gray-400 mt-1">
              Your progress has been saved.
            </p>
          </div>
          <div className="flex flex-col sm:flex-row justify-center gap-4">
            <button
              onClick={() => router.push('/dashboard')}
              className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
            >
              Back to Dashboard
            </button>
            <button
              onClick={() => loadData(currentUser!)}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              New Quiz
            </button>
            <button
              onClick={() => router.push('/study')}
              className="px-6 py-2 bg-gray-200 text-gray-800 dark:bg-gray-700 dark:text-gray-200 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600"
            >
              Change Study Mode
            </button>
          </div>
        </div>
      );
    }

    const currentCard = quizCards[currentCardIndex];
    const quizData = currentCard.data;
        
    return (
      <QuizCard
        quizId={currentCard.id}
        question={quizData.question}
        choices={quizData.choices}
        correctIndex={quizData.correctIndex}
        explanation={quizData.explanation}
        onReview={handleQuizAnswer}
      />
    );
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <Header />
      
      <main className="container mx-auto px-4 py-8">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            Quiz Mode
          </h1>
          <button
            onClick={() => router.push('/study')}
            className="text-sm px-4 py-2 bg-gray-200 text-gray-800 dark:bg-gray-700 dark:text-gray-200 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600"
          >
            Back to Study Menu
          </button>
        </div>
        
        {isLoading ? (
          <div className="flex items-center justify-center min-h-[300px]">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
          </div>
        ) : (
          <>
            {/* Progress bar and stats */}
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
                  <button
                    onClick={handleLeaveSession}
                    className="text-sm px-3 py-1 bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300 rounded-lg hover:bg-blue-200 dark:hover:bg-blue-800"
                  >
                    Leave & Save
                  </button>
                </div>
              </div>
              
              <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2.5">
                <div 
                  className="bg-blue-600 h-2.5 rounded-full" 
                  style={{ width: `${progress.total ? (progress.completed / progress.total) * 100 : 0}%` }}
                ></div>
              </div>
            </div>
            
            {/* Current card */}
            {renderCurrentCard()}
          </>
        )}
      </main>
    </div>
  );
} 