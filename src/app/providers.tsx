'use client';

import { PropsWithChildren, useState, useEffect } from 'react';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { Database } from '@/types/supabase';
import { register } from './serviceWorkerRegistration';

export function Providers({ children }: PropsWithChildren) {
  // Initialize the Supabase client
  const [supabaseClient] = useState(() => 
    createClientComponentClient<Database>()
  );

  useEffect(() => {
    // Register service worker for offline support
    register();
  }, []);

  return (
    <>
      {children}
    </>
  );
} 