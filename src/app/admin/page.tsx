'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import Header from '@/components/Header';
import PdfUploader from '@/components/PdfUploader';
import ManualCardCreator from '@/components/ManualCardCreator';
import DatabaseStats from '@/components/DatabaseStats';
import QuizGenerator from '@/components/QuizGenerator';
import { Database } from '@/types/supabase';

export default function AdminPage() {
  const [isLoading, setIsLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [activeTab, setActiveTab] = useState<'pdf' | 'manual' | 'quiz' | 'users'>('pdf');
  const router = useRouter();
  const supabase = createClientComponentClient<Database>();

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        router.push('/auth');
        return;
      }
      
      // In a real app, you would check if the user has admin role
      // For now, we'll just check if they're authenticated
      setIsAdmin(true);
      setIsLoading(false);
    };
    
    checkAuth();
  }, [router, supabase]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex flex-col">
        <Header />
        <main className="flex-grow flex items-center justify-center">
          <div className="text-center">
            <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-current border-r-transparent align-[-0.125em] motion-reduce:animate-[spin_1.5s_linear_infinite]" />
            <p className="mt-4 text-gray-600 dark:text-gray-400">Loading...</p>
          </div>
        </main>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="min-h-screen flex flex-col">
        <Header />
        <main className="flex-grow flex items-center justify-center">
          <div className="text-center p-6 max-w-md">
            <h1 className="text-2xl font-bold text-red-600 mb-4">Access Denied</h1>
            <p className="text-gray-600 dark:text-gray-400">
              You don't have permission to access this page. Please contact an administrator.
            </p>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      
      <main className="flex-grow bg-gray-50 dark:bg-gray-900 py-8">
        <div className="container mx-auto px-4">
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Admin Console</h1>
            <p className="text-gray-600 dark:text-gray-400 mt-2">
              Manage content and generate learning materials for your students.
            </p>
          </div>
          
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            <div className="lg:col-span-8">
              <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md p-6 border border-gray-200 dark:border-gray-700">
                <div className="mb-6 border-b border-gray-200 dark:border-gray-700">
                  <nav className="flex -mb-px space-x-8 overflow-x-auto">
                    <button
                      onClick={() => setActiveTab('pdf')}
                      className={`py-4 px-1 border-b-2 font-medium text-sm whitespace-nowrap ${
                        activeTab === 'pdf'
                          ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                          : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
                      }`}
                    >
                      PDF Generator
                    </button>
                    <button
                      onClick={() => setActiveTab('manual')}
                      className={`py-4 px-1 border-b-2 font-medium text-sm whitespace-nowrap ${
                        activeTab === 'manual'
                          ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                          : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
                      }`}
                    >
                      Manual Creation
                    </button>
                    <button
                      onClick={() => setActiveTab('quiz')}
                      className={`py-4 px-1 border-b-2 font-medium text-sm whitespace-nowrap ${
                        activeTab === 'quiz'
                          ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                          : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
                      }`}
                    >
                      Quiz Generator
                    </button>
                    <button
                      onClick={() => setActiveTab('users')}
                      className={`py-4 px-1 border-b-2 font-medium text-sm whitespace-nowrap ${
                        activeTab === 'users'
                          ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                          : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
                      }`}
                    >
                      User Management
                    </button>
                  </nav>
                </div>
                
                {activeTab === 'pdf' && (
                  <>
                    <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
                      PDF Content Generator
                    </h2>
                    <p className="text-gray-600 dark:text-gray-400 mb-6">
                      Upload SIE outlines, study notes, or mock exams. Our system will extract text and generate learning materials.
                    </p>
                    <PdfUploader />
                  </>
                )}
                
                {activeTab === 'manual' && (
                  <>
                    <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
                      Manual Card Creation
                    </h2>
                    <p className="text-gray-600 dark:text-gray-400 mb-6">
                      Create custom lesson and quiz cards manually. These will be immediately available to all users.
                    </p>
                    <ManualCardCreator />
                  </>
                )}
                
                {activeTab === 'quiz' && (
                  <QuizGenerator />
                )}
                
                {activeTab === 'users' && (
                  <>
                    <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
                      User Management
                    </h2>
                    <p className="text-gray-600 dark:text-gray-400 mb-6">
                      This feature is coming soon. You'll be able to manage user accounts, reset progress, and more.
                    </p>
                    <div className="p-8 text-center">
                      <div className="inline-block p-4 rounded-full bg-gray-100 dark:bg-gray-700 mb-4">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 text-gray-500 dark:text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                        </svg>
                      </div>
                      <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                        Feature Coming Soon
                      </h3>
                      <p className="text-gray-600 dark:text-gray-400">
                        We're working on building this functionality. Check back soon!
                      </p>
                    </div>
                  </>
                )}
              </div>
            </div>
            
            <div className="lg:col-span-4">
              <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md p-6 border border-gray-200 dark:border-gray-700">
                <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
                  Content Statistics
                </h2>
                
                <DatabaseStats />
                
                <button
                  onClick={() => window.open('/api/export-data', '_blank')}
                  className="mt-6 w-full px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2"
                >
                  Export Database
                </button>
              </div>
              
              <div className="mt-6 bg-white dark:bg-gray-800 rounded-xl shadow-md p-6 border border-gray-200 dark:border-gray-700">
                <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
                  Quick Actions
                </h2>
                
                <div className="space-y-3">
                  <button 
                    onClick={() => setActiveTab('manual')}
                    className="w-full px-4 py-2 text-left text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg flex items-center">
                    <span className="mr-2">➕</span> Create Manual Card
                  </button>
                  <button 
                    onClick={() => setActiveTab('quiz')}
                    className="w-full px-4 py-2 text-left text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg flex items-center">
                    <span className="mr-2">🧠</span> Generate Quiz Questions
                  </button>
                  <button 
                    className="w-full px-4 py-2 text-left text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg flex items-center"
                    onClick={() => window.open('https://supabase.com/dashboard/project/owuhdhyysziwwnspiigi/editor', '_blank')}
                  >
                    <span className="mr-2">📊</span> View Supabase Dashboard
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
} 