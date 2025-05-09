'use client';

import { useState, useEffect } from 'react';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { Database } from '@/types/supabase';

export default function QuizGenerator() {
  const [isLoading, setIsLoading] = useState(false);
  const [resultMessage, setResultMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [exams, setExams] = useState<{id: string, name: string}[]>([]);
  const [lessons, setLessons] = useState<{id: string, title: string, blueprint_id: string}[]>([]);
  const [selectedExam, setSelectedExam] = useState<string>('');
  const [selectedLessons, setSelectedLessons] = useState<string[]>([]);
  const [questionsPerLesson, setQuestionsPerLesson] = useState<number>(3);
  const [generationMode, setGenerationMode] = useState<'exam' | 'lessons'>('exam');
  
  const supabase = createClientComponentClient<Database>();
  
  // Check and log Supabase configuration
  useEffect(() => {
    const checkConfig = async () => {
      try {
        console.log('Supabase URL:', process.env.NEXT_PUBLIC_SUPABASE_URL);
        console.log('Functions URL:', `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/`);
        
        // Check if the Edge Function exists
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
          console.log('Authenticated session found');
          
          // Check functions service status
          try {
            // Just a lightweight request to check if functions service is accessible
            await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/`, {
              method: 'HEAD',
              headers: {
                'Authorization': `Bearer ${session.access_token}`
              }
            });
            console.log('Edge Functions service appears to be accessible');
          } catch (e) {
            console.warn('Could not reach Edge Functions service:', e);
          }
        }
      } catch (e) {
        console.error('Error checking Supabase config:', e);
      }
    };
    
    checkConfig();
  }, [supabase]);
  
  useEffect(() => {
    const loadExams = async () => {
      try {
        console.log('[QuizGenerator] Attempting to load exams...');
        const { data, error, status } = await supabase
          .from('exams')
          .select('id, name')
          .order('name');
          
        console.log('[QuizGenerator] Load exams response - Status:', status, 'Data:', data, 'Error:', error);

        if (error) {
          console.error('[QuizGenerator] Error loading exams:', error.message);
          setError(`Failed to load exams. Status: ${status}. Error: ${error.message}`);
          throw error;
        }

        if (data) {
          setExams(data);
          if (data.length > 0) {
            setSelectedExam(data[0].id);
            console.log('[QuizGenerator] Exams loaded and first exam selected:', data[0].id);
          } else {
            console.warn('[QuizGenerator] No exams found in the database.');
            setError('No exams found. Please add exams to the database.');
          }
        } else {
          console.warn('[QuizGenerator] No data returned for exams query, but no explicit error.');
          setError('No exams data returned. Check database and RLS policies.');
        }
      } catch (err) {
        // Error already logged, just ensuring flow
        console.error('[QuizGenerator] Catch block for loadExams:', err);
        // setError is already set if it's a Supabase error object with a message
        if (!(err && typeof err === 'object' && 'message' in err)) {
             setError('An unexpected error occurred while loading exams.');
        }
      }
    };
    
    loadExams();
  }, [supabase]);
  
  useEffect(() => {
    const loadLessons = async () => {
      if (!selectedExam) return;
      
      try {
        setIsLoading(true);
        setLessons([]);
        
        const { data, error } = await supabase
          .from('lessons')
          .select('id, title, blueprint_id, blueprints!inner(exam)')
          .eq('blueprints.exam', selectedExam)
          .order('title');
          
        if (error) throw error;
        
        if (data) {
          setLessons(data.map(lesson => ({
            id: lesson.id,
            title: lesson.title,
            blueprint_id: lesson.blueprint_id
          })));
        }
      } catch (error) {
        console.error('Error loading lessons:', error);
        setError('Failed to load lessons for the selected exam.');
      } finally {
        setIsLoading(false);
      }
    };
    
    if (selectedExam) {
      loadLessons();
    }
  }, [selectedExam, supabase]);
  
  const handleExamChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setSelectedExam(e.target.value);
    setSelectedLessons([]);
    setResultMessage(null);
    setError(null);
  };
  
  const handleLessonSelection = (lessonId: string) => {
    setSelectedLessons(prev => 
      prev.includes(lessonId)
        ? prev.filter(id => id !== lessonId)
        : [...prev, lessonId]
    );
  };
  
  const handleSelectAll = () => {
    if (selectedLessons.length === lessons.length) {
      setSelectedLessons([]);
    } else {
      setSelectedLessons(lessons.map(lesson => lesson.id));
    }
  };
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setResultMessage(null);
    setError(null);
    
    try {
      // Get auth token for admin verification
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('Authentication required. Please log in again.');
      }
      
      console.log('Preparing to invoke Edge Function with token:', session.access_token.substring(0, 10) + '...');
      
      const requestData = {
        ...(generationMode === 'exam' ? { examId: selectedExam } : { lessonIds: selectedLessons }),
        questionsPerLesson
      };
      
      console.log('Request data:', JSON.stringify(requestData));
      
      // Use the Supabase Edge Function URL
      try {
        const { data: functionData, error: functionError } = await supabase.functions.invoke(
          'generate-quiz-questions', 
          {
            body: JSON.stringify(requestData),
            headers: {
              Authorization: `Bearer ${session.access_token}`
            }
          }
        );
        
        console.log('Function response:', functionData, functionError);
        
        if (functionError) {
          throw new Error(functionError.message || 'Failed to generate questions');
        }
        
        setResultMessage(functionData.message || 'Successfully generated quiz questions!');
      } catch (functionCallError) {
        console.error('Edge Function invocation error:', functionCallError);
        
        // Try alternative approach using fetch directly
        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
        if (supabaseUrl) {
          try {
            console.log('Attempting direct fetch to Edge Function');
            const response = await fetch(
              `${supabaseUrl}/functions/v1/generate-quiz-questions`,
              {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer ${session.access_token}`
                },
                body: JSON.stringify(requestData)
              }
            );
            
            console.log('Direct fetch status:', response.status);
            const result = await response.json();
            console.log('Direct fetch result:', result);
            
            if (!response.ok) {
              throw new Error(result.error || 'Failed to generate questions');
            }
            
            setResultMessage(result.message || 'Successfully generated quiz questions!');
          } catch (fetchError) {
            console.error('Direct fetch error:', fetchError);
            throw new Error('Failed to communicate with the Edge Function. Please check your deployment.');
          }
        } else {
          throw functionCallError;
        }
      }
    } catch (error) {
      console.error('Error generating questions:', error);
      setError(typeof error === 'object' && error !== null && 'message' in error
        ? String(error.message)
        : 'An unexpected error occurred'
      );
    } finally {
      setIsLoading(false);
    }
  };
  
  return (
    <div>
      <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
        Generate Quiz Questions
      </h2>
      <p className="text-gray-600 dark:text-gray-400 mb-6">
        Use AI to automatically generate multiple-choice quiz questions from existing lesson content.
      </p>
      
      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 dark:bg-red-900/30 dark:border-red-800 dark:text-red-400">
          <p className="flex items-center">
            <span className="mr-2">⚠️</span> {error}
          </p>
        </div>
      )}
      
      {resultMessage && (
        <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg text-green-700 dark:bg-green-900/30 dark:border-green-800 dark:text-green-400">
          <p className="flex items-center">
            <span className="mr-2">✅</span> {resultMessage}
          </p>
        </div>
      )}
      
      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Generation Mode
          </label>
          <div className="flex space-x-4">
            <label className="inline-flex items-center">
              <input
                type="radio"
                name="generationMode"
                value="exam"
                checked={generationMode === 'exam'}
                onChange={() => setGenerationMode('exam')}
                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
              />
              <span className="ml-2 text-gray-700 dark:text-gray-300">Entire Exam</span>
            </label>
            <label className="inline-flex items-center">
              <input
                type="radio"
                name="generationMode"
                value="lessons"
                checked={generationMode === 'lessons'}
                onChange={() => setGenerationMode('lessons')}
                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
              />
              <span className="ml-2 text-gray-700 dark:text-gray-300">Selected Lessons</span>
            </label>
          </div>
        </div>
        
        <div>
          <label htmlFor="exam" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Select Exam
          </label>
          <select
            id="exam"
            value={selectedExam}
            onChange={handleExamChange}
            className="w-full p-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
            disabled={isLoading}
          >
            {exams.map(exam => (
              <option key={exam.id} value={exam.id}>
                {exam.name}
              </option>
            ))}
          </select>
        </div>
        
        {generationMode === 'lessons' && (
          <div>
            <div className="flex justify-between items-center mb-2">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Select Lessons
              </label>
              <button
                type="button"
                onClick={handleSelectAll}
                className="text-sm text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
              >
                {selectedLessons.length === lessons.length ? 'Deselect All' : 'Select All'}
              </button>
            </div>
            <div className="border border-gray-300 dark:border-gray-700 rounded-md p-2 max-h-60 overflow-y-auto">
              {isLoading ? (
                <div className="flex justify-center py-4">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500"></div>
                </div>
              ) : lessons.length === 0 ? (
                <p className="text-gray-500 dark:text-gray-400 p-2">No lessons available for this exam.</p>
              ) : (
                <div className="space-y-2">
                  {lessons.map(lesson => (
                    <div key={lesson.id} className="flex items-center">
                      <input
                        type="checkbox"
                        id={`lesson-${lesson.id}`}
                        checked={selectedLessons.includes(lesson.id)}
                        onChange={() => handleLessonSelection(lesson.id)}
                        className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                      />
                      <label 
                        htmlFor={`lesson-${lesson.id}`}
                        className="ml-2 block text-sm text-gray-700 dark:text-gray-300 truncate"
                      >
                        {lesson.title}
                      </label>
                    </div>
                  ))}
                </div>
              )}
            </div>
            {generationMode === 'lessons' && selectedLessons.length === 0 && (
              <p className="mt-1 text-sm text-red-600 dark:text-red-400">
                Please select at least one lesson.
              </p>
            )}
          </div>
        )}
        
        <div>
          <label htmlFor="questionsPerLesson" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Questions Per Lesson
          </label>
          <input
            type="number"
            id="questionsPerLesson"
            value={questionsPerLesson}
            onChange={(e) => setQuestionsPerLesson(Math.max(1, Math.min(10, Number(e.target.value))))}
            min="1"
            max="10"
            className="w-full p-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
          />
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Recommended: 3-5 questions per lesson
          </p>
        </div>
        
        <div className="pt-4">
          <button
            type="submit"
            disabled={isLoading || (generationMode === 'lessons' && selectedLessons.length === 0)}
            className={`w-full py-2 px-4 rounded-md text-white font-medium focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 
              ${isLoading || (generationMode === 'lessons' && selectedLessons.length === 0)
                ? 'bg-gray-400 cursor-not-allowed'
                : 'bg-blue-600 hover:bg-blue-700'
              }`}
          >
            {isLoading ? (
              <span className="flex items-center justify-center">
                <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Generating...
              </span>
            ) : (
              'Generate Quiz Questions'
            )}
          </button>
        </div>
      </form>
    </div>
  );
} 