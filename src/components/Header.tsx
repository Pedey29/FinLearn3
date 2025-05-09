'use client';

import Link from 'next/link';
import { useState, useEffect } from 'react';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import type { Session } from '@supabase/supabase-js';
import { Database } from '@/types/supabase';
import { usePathname } from 'next/navigation';

export default function Header() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [userXp, setUserXp] = useState(0);
  const [streak, setStreak] = useState(0);
  const supabase = createClientComponentClient<Database>();
  const pathname = usePathname();

  useEffect(() => {
    const getSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      setSession(session);

      if (session) {
        // Fetch user profile data
        const { data: profile } = await supabase
          .from('profiles')
          .select('xp, streak')
          .eq('id', session.user.id)
          .single();

        if (profile) {
          setUserXp(profile.xp);
          setStreak(profile.streak);
        }
      }
      
      setLoading(false);
    };

    getSession();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, [supabase]);

  const isActive = (path: string) => {
    return pathname === path;
  };

  const handleStudyNavigation = (e: React.MouseEvent) => {
    e.preventDefault();
    // Force a complete page reload for the study page to avoid caching issues
    window.location.href = '/study';
  };

  return (
    <header className="bg-white dark:bg-gray-800 shadow-sm">
      <div className="container mx-auto px-4 py-3 flex justify-between items-center">
        <Link href="/" className="flex items-center space-x-2">
          <span className="text-xl font-bold text-blue-600 dark:text-blue-400">FinLearn</span>
        </Link>
        
        <nav className="hidden md:flex space-x-8">
          <a
            href="/study"
            onClick={handleStudyNavigation}
            className={`text-gray-700 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400 ${
              isActive('/study')
                ? 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300'
                : ''
            }`}
          >
            Study Now
          </a>
          <Link
            href="/dashboard"
            className={`text-gray-700 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400 ${
              isActive('/dashboard')
                ? 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300'
                : ''
            }`}
          >
            Dashboard
          </Link>
          {session?.user.app_metadata.role === 'admin' && (
            <Link href="/admin" className="text-gray-700 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400">
              Admin
            </Link>
          )}
        </nav>
        
        <div className="flex items-center space-x-4">
          {!loading && session ? (
            <>
              <div className="hidden md:flex items-center space-x-4">
                <div className="text-sm">
                  <span className="font-medium text-amber-500">✨ {userXp} XP</span>
                </div>
                <div className="text-sm">
                  <span className="font-medium text-red-500">🔥 {streak} days</span>
                </div>
              </div>
              <Link 
                href="/profile" 
                className="text-gray-700 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400"
              >
                Profile
              </Link>
              <button 
                onClick={async () => {
                  await supabase.auth.signOut();
                }}
                className="text-sm text-gray-700 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400"
              >
                Sign out
              </button>
            </>
          ) : (
            !loading && (
              <Link 
                href="/auth" 
                className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md text-sm"
              >
                Sign in
              </Link>
            )
          )}
        </div>
      </div>
    </header>
  );
} 