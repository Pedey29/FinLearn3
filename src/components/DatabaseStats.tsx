'use client';

import { useState, useEffect } from 'react';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { Database } from '@/types/supabase';

interface DbStats {
  blueprintCount: number;
  lessonCount: number;
  quizCount: number;
  userCount: number;
  loading: boolean;
}

export default function DatabaseStats() {
  const supabase = createClientComponentClient<Database>();
  const [stats, setStats] = useState<DbStats>({
    blueprintCount: 0,
    lessonCount: 0,
    quizCount: 0,
    userCount: 0,
    loading: true
  });

  useEffect(() => {
    const fetchStats = async () => {
      try {
        // Get blueprint count
        const { count: blueprintCount } = await supabase
          .from('blueprints')
          .select('*', { count: 'exact', head: true });
        
        // Get lesson count
        const { count: lessonCount } = await supabase
          .from('lessons')
          .select('*', { count: 'exact', head: true });
        
        // Get quiz count
        const { count: quizCount } = await supabase
          .from('quizzes')
          .select('*', { count: 'exact', head: true });
        
        // Get user count
        const { count: userCount } = await supabase
          .from('profiles')
          .select('*', { count: 'exact', head: true });
        
        setStats({
          blueprintCount: blueprintCount || 0,
          lessonCount: lessonCount || 0,
          quizCount: quizCount || 0,
          userCount: userCount || 0,
          loading: false
        });
      } catch (error) {
        console.error('Error fetching database stats:', error);
        setStats(prev => ({ ...prev, loading: false }));
      }
    };
    
    fetchStats();
  }, [supabase]);

  return (
    <div className="space-y-4">
      {stats.loading ? (
        <div className="flex justify-center items-center h-40">
          <div className="inline-block h-6 w-6 animate-spin rounded-full border-4 border-solid border-current border-r-transparent align-[-0.125em] motion-reduce:animate-[spin_1.5s_linear_infinite]" />
        </div>
      ) : (
        <>
          <div className="flex justify-between items-center p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
            <span className="text-gray-600 dark:text-gray-300">Total Blueprints</span>
            <span className="font-medium text-gray-900 dark:text-white">{stats.blueprintCount}</span>
          </div>
          
          <div className="flex justify-between items-center p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
            <span className="text-gray-600 dark:text-gray-300">Lesson Cards</span>
            <span className="font-medium text-gray-900 dark:text-white">{stats.lessonCount}</span>
          </div>
          
          <div className="flex justify-between items-center p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
            <span className="text-gray-600 dark:text-gray-300">Quiz Cards</span>
            <span className="font-medium text-gray-900 dark:text-white">{stats.quizCount}</span>
          </div>
          
          <div className="flex justify-between items-center p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
            <span className="text-gray-600 dark:text-gray-300">Active Users</span>
            <span className="font-medium text-gray-900 dark:text-white">{stats.userCount}</span>
          </div>
        </>
      )}
    </div>
  );
} 