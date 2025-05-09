'use client';

import Header from '@/components/Header';
import Link from 'next/link';
import { useState, useEffect } from 'react';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { useRouter } from 'next/navigation';
import { Database } from '@/types/supabase';

export default function Home() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const supabase = createClientComponentClient<Database>();

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      setIsLoggedIn(!!session);
      setLoading(false);
    };

    checkAuth();
  }, [supabase]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      
      <main className="flex-grow">
        {/* Hero Section */}
        <section className="bg-gradient-to-b from-white to-blue-50 dark:from-gray-900 dark:to-gray-800 py-16 md:py-24">
          <div className="container mx-auto px-4">
            <div className="flex flex-col md:flex-row items-center">
              <div className="md:w-1/2 mb-8 md:mb-0">
                <h1 className="text-4xl md:text-5xl font-bold text-gray-900 dark:text-white mb-4">
                  Study For Financial Exams with Confidence
                </h1>
                <p className="text-xl text-gray-600 dark:text-gray-300 mb-8">
                  The all-in-one platform for finance professionals preparing for Series exams and the CFA. Learn smarter with our adaptive study system.
                </p>
                <div className="flex flex-col sm:flex-row gap-4">
                  {isLoggedIn ? (
                    <>
                      <Link
                        href="/dashboard"
                        className="bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 px-6 rounded-lg text-center"
                      >
                        Go to Dashboard
                      </Link>
                      <Link
                        href="/study"
                        className="bg-green-600 hover:bg-green-700 text-white font-medium py-3 px-6 rounded-lg text-center"
                      >
                        Start Studying
                      </Link>
                    </>
                  ) : (
                    <>
                      <Link
                        href="/auth"
                        className="bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 px-6 rounded-lg text-center"
                      >
                        Get Started Free
                      </Link>
                      <Link
                        href="/about"
                        className="bg-white dark:bg-gray-800 text-blue-600 dark:text-blue-400 font-medium py-3 px-6 rounded-lg border border-blue-200 dark:border-gray-700 hover:border-blue-300 dark:hover:border-gray-600 text-center"
                      >
                        Learn More
                      </Link>
                    </>
                  )}
                </div>
              </div>
              <div className="md:w-1/2 flex justify-center">
                <div className="w-full max-w-md bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6 border border-gray-200 dark:border-gray-700">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Featured Exams</h3>
                  <ul className="space-y-3">
                    {['SIE', 'Series 7', 'Series 65', 'Series 63', 'CFA Level I'].map((exam) => (
                      <li key={exam} className="flex items-center">
                        <span className="bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-300 p-1 rounded-full mr-3">
                          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 0 1 0 1.414l-8 8a1 1 0 0 1-1.414 0l-4-4a1 1 0 0 1 1.414-1.414L8 12.586l7.293-7.293a1 1 0 0 1 1.414 0z" clipRule="evenodd" />
                          </svg>
                        </span>
                        <span className="text-gray-700 dark:text-gray-300">{exam}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Features Section */}
        <section className="py-16 bg-white dark:bg-gray-900">
          <div className="container mx-auto px-4">
            <h2 className="text-3xl font-bold text-center text-gray-900 dark:text-white mb-12">Key Features</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {[
                {
                  title: 'Smart Content Generation',
                  description: 'Upload study materials and our AI transforms them into bite-sized lessons and quizzes.',
                  icon: '📚'
                },
                {
                  title: 'Adaptive Learning',
                  description: 'Our spaced repetition system focuses on what you need to review most.',
                  icon: '🧠'
                },
                {
                  title: 'Progress Tracking',
                  description: 'Visualize your progress with detailed analytics and stay on track for exam day.',
                  icon: '📊'
                },
              ].map((feature, i) => (
                <div key={i} className="bg-gray-50 dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700">
                  <div className="text-3xl mb-4">{feature.icon}</div>
                  <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">{feature.title}</h3>
                  <p className="text-gray-600 dark:text-gray-400">{feature.description}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      </main>
      
      <footer className="bg-gray-100 dark:bg-gray-800 py-8">
        <div className="container mx-auto px-4">
          <div className="text-center text-gray-600 dark:text-gray-400">
            <p>© {new Date().getFullYear()} FinLearn. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
