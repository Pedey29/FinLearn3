'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import Header from '@/components/Header';
import { Database } from '@/types/supabase';
import type { User } from '@supabase/supabase-js';

// Mock data for parts not yet implemented
const mockStaticData = {
  // Domain data will be fetched dynamically
};

interface DomainProgress {
  name: string;
  progress: number;
}

export default function DashboardPage() {
  const [isLoading, setIsLoading] = useState(true);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Database['public']['Tables']['profiles']['Row'] | null>(null);
  const [stats, setStats] = useState({ 
      totalCards: 0, 
      masteredCards: 0, 
      dueToday: 0, 
      completionRate: 0,
      cardsReviewedToday: 0 // TODO: Implement actual tracking
  });
  const [error, setError] = useState<string | null>(null);
  const [domainProgress, setDomainProgress] = useState<DomainProgress[]>([]); // State for domain progress
  const router = useRouter();
  const supabase = createClientComponentClient<Database>();

  useEffect(() => {
    const fetchData = async () => {
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      
      if (sessionError) {
        console.error('Error getting session:', sessionError);
        setError('Could not load session.');
        setIsLoading(false);
        router.push('/auth'); // Redirect if session fails
        return;
      }

      if (!session) {
        router.push('/auth');
        setIsLoading(false); // Stop loading if redirecting
        return;
      }
      setUser(session.user);

      // Fetch user profile data
      const { data: userProfile, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', session.user.id)
        .single();

      if (profileError || !userProfile) {
        console.error('Error fetching profile:', profileError);
        setError('Could not load your profile data.');
        setIsLoading(false);
        return; // Stop if profile fails
      }
      setProfile(userProfile);
      
      // --- Fetch Stats (including Domain Progress) --- 
      let fetchedStats = { totalCards: 0, masteredCards: 0, dueToday: 0, completionRate: 0, cardsReviewedToday: 0 };
      let fetchedDomainProgress: DomainProgress[] = [];
      const currentExam = userProfile.current_exam; // Get current exam from profile
      const masteryThreshold = 5; // Consecutive correct answers
      
      if (currentExam) {
          // 1. Get all blueprints for the current exam
          const { data: examBlueprints, error: blueprintError } = await supabase
              .from('blueprints')
              .select('id, domain')
              .eq('exam', currentExam);

          if (blueprintError) {
              console.error("Error fetching blueprints:", blueprintError);
              setError("Could not load exam structure.");
          } else if (examBlueprints && examBlueprints.length > 0) {
              const distinctDomains = [...new Set(examBlueprints.map(bp => bp.domain))];
              const blueprintIds = examBlueprints.map(bp => bp.id);

              // 2. Get all lesson/quiz IDs linked to these blueprints
              const { data: lessons, error: lessonsError } = await supabase.from('lessons').select('id, blueprint_id').in('blueprint_id', blueprintIds);
              const { data: quizzes, error: quizzesError } = await supabase.from('quizzes').select('id, blueprint_id').in('blueprint_id', blueprintIds);
              
              const allCardIds = [
                  ...(lessons || []).map(l => ({ id: l.id, type: 'lesson', blueprint_id: l.blueprint_id })),
                  ...(quizzes || []).map(q => ({ id: q.id, type: 'quiz', blueprint_id: q.blueprint_id }))
              ];
              fetchedStats.totalCards = allCardIds.length;

              // 3. Get all relevant review records for the user for these cards
              const cardIdsOnly = allCardIds.map(c => c.id);
              let userReviewsMap = new Map<string, { consecutive_correct_answers: number }>();
              if (cardIdsOnly.length > 0) {
                  const { data: reviewData, error: reviewError } = await supabase
                      .from('reviews')
                      .select('card_id, consecutive_correct_answers')
                      .eq('user_id', session.user.id)
                      .in('card_id', cardIdsOnly);
                  if (reviewData) {
                      reviewData.forEach(r => userReviewsMap.set(r.card_id, { consecutive_correct_answers: r.consecutive_correct_answers || 0 }));
                  }
              }
              
              // 4. Calculate overall mastered count & domain progress
              let overallMasteredCount = 0;
              for (const domain of distinctDomains) {
                  const domainBlueprintIds = examBlueprints.filter(bp => bp.domain === domain).map(bp => bp.id);
                  const domainCards = allCardIds.filter(card => card.blueprint_id && domainBlueprintIds.includes(card.blueprint_id));
                  const totalDomainCards = domainCards.length;
                  let masteredDomainCards = 0;

                  domainCards.forEach(card => {
                      const review = userReviewsMap.get(card.id);
                      if (review && review.consecutive_correct_answers >= masteryThreshold) {
                          masteredDomainCards++;
                      }
                  });
                  
                  const domainProg = totalDomainCards > 0 ? Math.round((masteredDomainCards / totalDomainCards) * 100) : 0;
                  fetchedDomainProgress.push({ name: domain, progress: domainProg });
                  overallMasteredCount += masteredDomainCards; // Add to overall count
              }
              fetchedStats.masteredCards = overallMasteredCount; // Use sum from domain calculation
              
              // Calculate overall completion rate
              if (fetchedStats.totalCards > 0) {
                  fetchedStats.completionRate = Math.round((fetchedStats.masteredCards / fetchedStats.totalCards) * 100);
              }
              
              // 5. Fetch Due Today count (can reuse logic from previous step)
              const { count: dueCount } = await supabase
                  .from('reviews')
                  .select('id', { count: 'exact', head: true })
                  .eq('user_id', session.user.id)
                  .lte('next_review', new Date().toISOString()); 
              fetchedStats.dueToday = dueCount || 0;
          }
      } // else: No current exam selected
      
      setStats(fetchedStats);
      setDomainProgress(fetchedDomainProgress); // Set the dynamic domain progress
      // --- End Fetch Stats --- 
      
      setIsLoading(false);
    };
    
    fetchData();
  }, [router, supabase]); // Dependency array might need user profile update trigger if exam changes

  const daysUntilExam = () => {
    if (!profile?.exam_date) {
      return null; // Return null or a placeholder if no date is set
    }
    try {
      const examDate = new Date(profile.exam_date);
      // Check if examDate is valid - Date constructor can return Invalid Date
      if (isNaN(examDate.getTime())) {
          return null; 
      }
      const today = new Date();
      today.setHours(0, 0, 0, 0); // Compare dates only, ignore time
      examDate.setHours(0, 0, 0, 0);

      const diffTime = examDate.getTime() - today.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      return diffDays >= 0 ? diffDays : null; // Return null if date is in the past
    } catch (e) {
      console.error("Error parsing exam date:", e);
      return null; // Return null if parsing fails
    }
  };

  const examDaysText = () => {
      const days = daysUntilExam();
      if (days === null) {
          return (
              <Link href="/profile" className="text-sm font-medium text-blue-600 dark:text-blue-400 hover:underline">
                  Set Exam Date
              </Link>
          );
      }
      return `${days} days until exam`;
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex flex-col">
        <Header />
        <main className="flex-grow flex items-center justify-center">
          <div className="text-center">
            <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-current border-r-transparent align-[-0.125em] motion-reduce:animate-[spin_1.5s_linear_infinite]" />
            <p className="mt-4 text-gray-600 dark:text-gray-400">Loading your dashboard...</p>
          </div>
        </main>
      </div>
    );
  }
  
  if (error) {
     return (
      <div className="min-h-screen flex flex-col">
        <Header />
        <main className="flex-grow flex items-center justify-center">
          <p className="text-red-600 dark:text-red-400">Error: {error}</p>
        </main>
      </div>
    );
  }
  
  // Fallback if profile didn't load for some reason after loading finished
  if (!profile) {
     return (
      <div className="min-h-screen flex flex-col">
        <Header />
        <main className="flex-grow flex items-center justify-center">
          <p className="text-gray-600 dark:text-gray-400">Could not load profile data.</p>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      
      <main className="flex-grow bg-gray-50 dark:bg-gray-900 py-8">
        <div className="container mx-auto px-4">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-8">
            Your Progress Dashboard {profile.full_name ? `for ${profile.full_name}` : ''}
          </h1>
          
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Left column */}
            <div className="lg:col-span-2 space-y-6">
              {/* Study Progress */}
              <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md p-6 border border-gray-200 dark:border-gray-700">
                <div className="flex justify-between items-center mb-4">
                  <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                    {profile.current_exam || 'Exam'} Preparation {/* Use selected exam */}
                  </h2>
                  <div className="text-sm font-medium text-blue-600 dark:text-blue-400">
                    {examDaysText()}
                  </div>
                </div>
                
                <div className="mb-6">
                  <div className="flex justify-between items-center mb-2">
                    <div className="text-sm font-medium text-gray-700 dark:text-gray-300">
                      Overall Completion
                    </div>
                    <div className="text-sm font-medium text-gray-700 dark:text-gray-300">
                      {stats.completionRate}%
                    </div>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2.5 dark:bg-gray-700">
                    <div
                      className="bg-blue-600 h-2.5 rounded-full"
                      style={{ width: `${stats.completionRate}%` }}
                    ></div>
                  </div>
                </div>
                
                {/* === Domain Progress Section === */}
                <div className="space-y-4 mt-6">
                  <h3 className="text-md font-medium text-gray-800 dark:text-gray-200">
                    Progress by Domain
                  </h3>
                  
                  {domainProgress.length > 0 ? (
                    domainProgress.map((domain, index) => (
                      <div key={index} className="space-y-2">
                        <div className="flex justify-between items-center">
                          <div className="text-sm text-gray-600 dark:text-gray-400">
                            {domain.name}
                          </div>
                          <div className="text-sm font-medium text-gray-700 dark:text-gray-300">
                            {domain.progress}%
                          </div>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-1.5 dark:bg-gray-700">
                          <div
                            className="bg-blue-600 h-1.5 rounded-full"
                            style={{ width: `${domain.progress}%` }}
                          ></div>
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      {profile?.current_exam ? 'No domains found for this exam yet.' : 'Select an exam in your profile to see progress.'}
                    </p>
                  )}
                </div>
                
                <div className="mt-6">
                  <Link
                    href="/study"
                    className="w-full py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 flex items-center justify-center"
                  >
                    <span>Start Studying</span>
                  </Link>
                </div>
              </div>
              
              {/* Recent Activity & Weak Points (Still Mock) */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md p-6 border border-gray-200 dark:border-gray-700">
                  <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-4">
                    Recent Activity (Example)
                  </h2>
                   <p className="text-sm text-gray-500 dark:text-gray-400">Coming soon...</p>
                </div>
                <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md p-6 border border-gray-200 dark:border-gray-700">
                  <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-4">
                    Areas to Focus On (Example)
                  </h2>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Coming soon...</p>
                </div>
              </div>
            </div>
            
            {/* Right column */}
            <div className="space-y-6">
              {/* Key Stats */}
              <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md p-6 border border-gray-200 dark:border-gray-700">
                <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-4">
                  Your Stats
                </h2>
                <div className="grid grid-cols-2 gap-4">
                    {/* Total XP */}
                    <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg text-center">
                        <div className="text-3xl font-bold text-blue-600 dark:text-blue-400">{profile.xp}</div>
                        <div className="text-sm text-gray-600 dark:text-gray-400">Total XP</div>
                    </div>
                    {/* Day Streak */}
                    <div className="p-4 bg-red-50 dark:bg-red-900/20 rounded-lg text-center">
                        <div className="text-3xl font-bold text-red-600 dark:text-red-400">{profile.streak}</div>
                        <div className="text-sm text-gray-600 dark:text-gray-400">Day Streak</div>
                    </div>
                    {/* Cards Mastered */}
                    <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-lg text-center">
                        <div className="text-3xl font-bold text-green-600 dark:text-green-400">{stats.masteredCards}</div>
                        <div className="text-sm text-gray-600 dark:text-gray-400">Cards Mastered</div>
                    </div>
                    {/* Total Cards */}
                    <div className="p-4 bg-purple-50 dark:bg-purple-900/20 rounded-lg text-center">
                        <div className="text-3xl font-bold text-purple-600 dark:text-purple-400">{stats.totalCards}</div>
                        <div className="text-sm text-gray-600 dark:text-gray-400">Total Cards</div>
                    </div>
                </div>
              </div>
              
              {/* Upcoming Due */}
              <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md p-6 border border-gray-200 dark:border-gray-700">
                 <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-4">
                    Due Today
                  </h2>
                  <div className="p-4 bg-gray-100 dark:bg-gray-700 rounded-lg text-center">
                      <div className="text-2xl font-bold text-gray-800 dark:text-gray-200">{stats.dueToday}</div>
                      <div className="text-sm text-gray-600 dark:text-gray-400">Cards Due</div>
                  </div>
                   <div className="mt-6">
                      <Link
                        href="/study"
                        className={`w-full py-2.5 rounded-lg focus:outline-none focus:ring-2 focus:ring-offset-2 flex items-center justify-center text-sm ${stats.dueToday > 0 
                          ? 'bg-blue-600 text-white hover:bg-blue-700 focus:ring-blue-500' 
                          : 'bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 cursor-not-allowed opacity-50'}`}
                        aria-disabled={stats.dueToday === 0}
                        onClick={(e) => { if (stats.dueToday === 0) e.preventDefault(); }}
                      >
                        {stats.dueToday > 0 ? 'Start Studying' : 'All Caught Up!'}
                      </Link>
                    </div>
              </div>
              
              {/* Study Plan */}
              <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md p-6 border border-gray-200 dark:border-gray-700">
                 <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-4">
                    Study Plan
                  </h2>
                   <div className="mb-4">
                    <div className="flex justify-between items-center mb-2">
                      <div className="text-sm font-medium text-gray-700 dark:text-gray-300">Daily Goal</div>
                      <div className="text-sm font-medium text-gray-700 dark:text-gray-300">
                        {/* TODO: Add cards reviewed today */} {stats.cardsReviewedToday} / {profile.daily_goal} cards
                      </div>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2 dark:bg-gray-700">
                      <div
                        className="bg-green-600 h-2 rounded-full"
                        // TODO: Calculate % based on cards reviewed today
                        style={{ width: `${Math.min(100, (stats.cardsReviewedToday / profile.daily_goal) * 100)}%` }}
                      ></div>
                    </div>
                  </div>
                  <div className="mt-4">
                      <Link
                        href="/settings"
                        className="w-full py-2.5 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 flex items-center justify-center text-sm"
                      >
                        Adjust Study Plan
                      </Link>
                    </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
} 