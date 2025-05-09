'use client';

import { useState, useEffect } from 'react';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { Auth } from '@supabase/auth-ui-react';
import { ThemeSupa } from '@supabase/auth-ui-shared';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Header from '@/components/Header';
import { Database } from '@/types/supabase';

export default function AuthPage() {
  const router = useRouter();
  const supabase = createClientComponentClient<Database>();
  const [redirectToUrl, setRedirectToUrl] = useState('');

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setRedirectToUrl(`${window.location.origin}/api/auth/callback`);
    }

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN') {
        // Redirect to home page after successful sign-in
        router.push('/');
        router.refresh(); // To ensure the header updates if it hasn't already
      }
    });

    // Cleanup subscription on unmount
    return () => {
      subscription?.unsubscribe();
    };
  }, [router, supabase]);

  if (!redirectToUrl) {
    return (
      <div className="min-h-screen flex flex-col">
        <Header />
        <main className="flex-grow flex items-center justify-center">
          <p>Loading...</p>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      
      <main className="flex-grow flex items-center justify-center bg-gray-50 dark:bg-gray-900 p-4">
        <div className="max-w-md w-full bg-white dark:bg-gray-800 rounded-xl shadow-lg p-8 border border-gray-200 dark:border-gray-700">
          <div className="text-center mb-8">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Welcome to FinLearn</h1>
            <p className="text-gray-600 dark:text-gray-400 mt-2">Sign in or create an account to continue</p>
          </div>
          
          <Auth
            supabaseClient={supabase}
            appearance={{ theme: ThemeSupa }}
            theme="auto"
            providers={['google']}
            redirectTo={redirectToUrl}
            onlyThirdPartyProviders={false}
          />
          
          <div className="mt-8 text-center text-sm text-gray-500 dark:text-gray-400">
            <p>
              By signing in, you agree to our{' '}
              <Link href="/terms" className="text-blue-600 dark:text-blue-400 hover:underline">
                Terms of Service
              </Link>{' '}
              and{' '}
              <Link href="/privacy" className="text-blue-600 dark:text-blue-400 hover:underline">
                Privacy Policy
              </Link>
              .
            </p>
          </div>
        </div>
      </main>
      
      <footer className="bg-gray-100 dark:bg-gray-800 py-6">
        <div className="container mx-auto px-4">
          <div className="text-center text-gray-600 dark:text-gray-400">
            <p>© {new Date().getFullYear()} FinLearn. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
} 