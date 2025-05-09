'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { Database } from '@/types/supabase';

interface QuizCardProps {
  quizId: string;
  question: string;
  choices: string[];
  correctIndex: number;
  explanation: string;
  onReview: (quizId: string, isCorrect: boolean) => void;
}

export default function QuizCard({
  quizId,
  question,
  choices,
  correctIndex,
  explanation,
  onReview
}: QuizCardProps) {
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [isRevealed, setIsRevealed] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const supabase = createClientComponentClient<Database>();

  const handleSelect = (index: number) => {
    if (isSubmitted) return;
    setSelectedIndex(index);
  };

  const handleSubmit = () => {
    if (selectedIndex === null || isSubmitted) return;
    
    setIsSubmitted(true);
    setIsRevealed(true);
    
    const isCorrect = selectedIndex === correctIndex;
    onReview(quizId, isCorrect);
  };

  const getButtonClass = (index: number) => {
    if (!isRevealed) {
      return selectedIndex === index 
        ? 'bg-blue-100 border-blue-500 text-blue-700 dark:bg-blue-900 dark:border-blue-500 dark:text-blue-300'
        : 'bg-white border-gray-300 text-gray-700 dark:bg-gray-800 dark:border-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700';
    }
    
    if (index === correctIndex) {
      return 'bg-green-100 border-green-500 text-green-700 dark:bg-green-900 dark:border-green-500 dark:text-green-300';
    }
    
    if (index === selectedIndex) {
      return 'bg-red-100 border-red-500 text-red-700 dark:bg-red-900 dark:border-red-500 dark:text-red-300';
    }
    
    return 'bg-white border-gray-300 text-gray-400 dark:bg-gray-800 dark:border-gray-600 dark:text-gray-500';
  };

  return (
    <div className="w-full max-w-xl mx-auto p-2">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 p-6">
        <div className="mb-6">
          <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
            {question}
          </h3>
          
          <div className="space-y-3">
            {choices.map((choice, index) => (
              <button
                key={index}
                onClick={() => handleSelect(index)}
                disabled={isSubmitted}
                className={`w-full p-3 border-2 rounded-lg text-left flex items-start transition-colors ${getButtonClass(index)}`}
              >
                <span className="flex-shrink-0 w-6 h-6 mr-3 flex items-center justify-center rounded-full border border-current">
                  {String.fromCharCode(65 + index)}
                </span>
                <span>{choice}</span>
              </button>
            ))}
          </div>
        </div>
        
        {!isSubmitted ? (
          <button
            onClick={handleSubmit}
            disabled={selectedIndex === null}
            className="w-full py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Submit Answer
          </button>
        ) : (
          <motion.div 
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            transition={{ duration: 0.3 }}
            className="mt-4"
          >
            <div className={`p-4 rounded-lg ${selectedIndex === correctIndex 
              ? 'bg-green-50 dark:bg-green-900/30' 
              : 'bg-red-50 dark:bg-red-900/30'
            }`}>
              <div className="flex items-start">
                <span className={`flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center mr-3 ${
                  selectedIndex === correctIndex
                    ? 'bg-green-100 text-green-700 dark:bg-green-800 dark:text-green-300'
                    : 'bg-red-100 text-red-700 dark:bg-red-800 dark:text-red-300'
                }`}>
                  {selectedIndex === correctIndex ? '✓' : '✗'}
                </span>
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-1">
                    <p className={`font-medium ${
                      selectedIndex === correctIndex
                        ? 'text-green-700 dark:text-green-300'
                        : 'text-red-700 dark:text-red-300'
                    }`}>
                      {selectedIndex === correctIndex ? 'Correct!' : 'Incorrect'}
                    </p>
                    
                    {selectedIndex === correctIndex && (
                      <span className="text-xs bg-green-100 text-green-800 dark:bg-green-800 dark:text-green-200 py-1 px-2 rounded">
                        +10 XP
                      </span>
                    )}
                  </div>
                  <p className="text-gray-700 dark:text-gray-300">{explanation}</p>
                  
                  <div className="mt-3 text-xs text-gray-500 dark:text-gray-400">
                    {selectedIndex === correctIndex 
                      ? "This concept will be reviewed less frequently now." 
                      : "We'll review this concept again soon."}
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
} 