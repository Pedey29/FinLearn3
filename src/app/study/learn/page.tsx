import { Suspense } from 'react';
import ClientLearnPage from './learn-page-client';

// This is a Server Component by default
export default function LearnModePage() {
  return (
    <Suspense fallback={
      <div className="flex justify-center items-center h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
        <p>Loading page...</p>
      </div>
    }>
      <ClientLearnPage />
    </Suspense>
  );
} 