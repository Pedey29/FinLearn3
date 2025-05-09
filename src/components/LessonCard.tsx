'use client';

import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { Database } from '@/types/supabase';

interface LessonCardProps {
  lessonId: string;
  title: string;
  content: string;
  bulletPoints?: string[];
  onComplete: (lessonId: string, quality: number) => void;
}

export default function LessonCard({ 
  lessonId, 
  title, 
  content, 
  bulletPoints = [],
  onComplete
}: LessonCardProps) {
  const supabase = createClientComponentClient<Database>();
  
  // Ensure bulletPoints is always an array
  const ensuredBulletPoints = Array.isArray(bulletPoints) 
    ? bulletPoints 
    : (() => {
        try {
          // Try to parse if it's a string
          if (typeof bulletPoints === 'string') {
            const parsed = JSON.parse(bulletPoints || '[]');
            return Array.isArray(parsed) ? parsed : [];
          }
          return [];
        } catch (e) {
          console.error('Error parsing bulletPoints:', e);
          return [];
        }
      })();

  const handleRating = (quality: number, e: React.MouseEvent) => {
    e.stopPropagation();
    onComplete(lessonId, quality);
  };

  return (
    <div className="w-full max-w-xl mx-auto p-2">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 p-6 flex flex-col">
        <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
          {title}
        </h3>
        
        <div className="flex-grow overflow-y-auto mb-6">
          <div 
            className="text-gray-700 dark:text-gray-300 prose prose-sm dark:prose-invert max-w-none"
            dangerouslySetInnerHTML={{ __html: content }}
          />
          
          {ensuredBulletPoints.length > 0 && (
            <div className="mt-4 bg-gray-50 dark:bg-gray-700 p-4 rounded-lg">
              <h4 className="font-medium text-gray-900 dark:text-white mb-2">Key Takeaways:</h4>
              <ul className="list-disc pl-5 space-y-1">
                {ensuredBulletPoints.map((point, index) => (
                  <li key={index} className="text-gray-700 dark:text-gray-300">
                    {point}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
        
        <div className="border-t pt-4 mt-auto">
          <div className="text-center text-sm text-gray-500 dark:text-gray-400 mb-3">
            Rate your understanding:
          </div>
          
          <div className="flex justify-around gap-2">
            <button
              onClick={(e) => handleRating(1, e)}
              className="flex-1 py-2 px-3 rounded-md text-xs font-medium transition-colors
                bg-red-100 text-red-700 hover:bg-red-200 dark:bg-red-900 dark:text-red-300 dark:hover:bg-red-800"
            >
              Need Review
              <span className="block text-xxs opacity-80 mt-0.5">+10 XP</span>
            </button>
            
            <button
              onClick={(e) => handleRating(3, e)}
              className="flex-1 py-2 px-3 rounded-md text-xs font-medium transition-colors
                bg-yellow-100 text-yellow-700 hover:bg-yellow-200 dark:bg-yellow-900 dark:text-yellow-300 dark:hover:bg-yellow-800"
            >
              Mostly Got It
              <span className="block text-xxs opacity-80 mt-0.5">+10 XP</span>
            </button>
            
            <button
              onClick={(e) => handleRating(5, e)}
              className="flex-1 py-2 px-3 rounded-md text-xs font-medium transition-colors
                bg-green-100 text-green-700 hover:bg-green-200 dark:bg-green-900 dark:text-green-300 dark:hover:bg-green-800"
            >
              Confident
              <span className="block text-xxs opacity-80 mt-0.5">+10 XP</span>
            </button>
          </div>
          
          <div className="mt-3 text-xs text-center text-gray-400 dark:text-gray-500">
            Your ratings help build your personalized review schedule
          </div>
        </div>
      </div>
    </div>
  );
} 