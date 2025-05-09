'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import Header from '@/components/Header';
import { Database } from '@/types/supabase';
import type { User } from '@supabase/supabase-js';

export default function StudyMenuPage() {
  const [isLoading, setIsLoading] = useState(true);
  const [selectedExam, setSelectedExam] = useState<string>('SIE');
  const [quizCount, setQuizCount] = useState(10);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  
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
      await loadUserPreferences(session.user);
      setIsLoading(false);
    };
    checkAuthAndLoad();
  }, [router, supabase]);

  const loadUserPreferences = async (user: User) => {
    try {
      // Load user's selected exam
      const { data: profileData } = await supabase
        .from('profiles')
        .select('current_exam')
        .eq('id', user.id)
        .single();
        
      if (profileData?.current_exam) {
        setSelectedExam(profileData.current_exam);
      }
    } catch (error) {
      console.error('Error loading user preferences:', error);
      setIsLoading(false);
    }
  };
  
  // Update quiz count
  const handleQuizCountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseInt(e.target.value, 10);
    if (!isNaN(value) && value > 0 && value <= 50) {
      setQuizCount(value);
    }
  };

  const startLearnMode = () => {
    router.push(`/study/learn?exam=${selectedExam}`);
  };

  const startLessonsMode = () => {
    router.push(`/study/lessons?exam=${selectedExam}`);
  };

  const startQuizMode = () => {
    router.push(`/study/quiz?exam=${selectedExam}&count=${quizCount}`);
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <Header />
      
      <main className="container mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-6">
          Study
        </h1>
        
        {isLoading ? (
          <div className="flex items-center justify-center min-h-[300px]">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 p-6">
              <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-3">
                Learn
              </h2>
              <p className="text-gray-600 dark:text-gray-300 mb-4">
                Sequential lessons and quizzes to master the material. Each lesson is followed by a related quiz.
              </p>
              <button
                onClick={startLearnMode}
                className="w-full py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                Start Learning
              </button>
              <span className="inline-block mt-3 px-3 py-1 bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200 rounded-full text-sm font-medium">
                Recommended
              </span>
            </div>
            
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 p-6">
              <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-3">
                Lessons
              </h2>
              <p className="text-gray-600 dark:text-gray-300 mb-4">
                Browse through lessons without quizzes. Good for initial learning and review.
              </p>
              <button
                onClick={startLessonsMode}
                className="w-full py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
              >
                Browse Lessons
              </button>
              <span className="inline-block mt-3 px-3 py-1 bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200 rounded-full text-sm font-medium">
                Read & Review
              </span>
            </div>
            
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 p-6">
              <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-3">
                Quiz
              </h2>
              <p className="text-gray-600 dark:text-gray-300 mb-4">
                Practice with multiple-choice questions. Earn 10 XP for each correct answer.
              </p>
              
              <div className="mb-4">
                <label htmlFor="quizCount" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Number of questions:
                </label>
                <input 
                  type="number" 
                  id="quizCount"
                  value={quizCount}
                  onChange={handleQuizCountChange}
                  min="1"
                  max="50"
                  className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                />
              </div>
              
              <button
                onClick={startQuizMode}
                className="w-full py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
              >
                Start Quiz
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
} 