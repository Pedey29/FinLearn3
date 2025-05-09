'use client';

import { useState, useCallback, useRef } from 'react';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { Database } from '@/types/supabase';

interface PdfUploaderProps {
  // Add any props here if needed
}

interface Blueprint {
  domain: string;
  section: string;
  learning_outcome: string;
  exam?: string;
}

export default function PdfUploader({}: PdfUploaderProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [jsonContent, setJsonContent] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [processingStep, setProcessingStep] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedExam, setSelectedExam] = useState('SIE');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const supabase = createClientComponentClient<Database>();

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] || null;
    setSelectedFile(file);
    setError(null);
    setJsonContent(null);
  };

  const handleJsonProcessing = useCallback(async () => {
    if (!jsonContent) {
      setError('No JSON content to process');
      return;
    }

    setIsLoading(true);
    setProcessingStep('Parsing JSON data...');
    setError(null);

    try {
      // Parse the JSON content
      const data = JSON.parse(jsonContent);
      
      // Check if data has required arrays
      if (!data.blueprints || !Array.isArray(data.blueprints)) {
        throw new Error('Invalid JSON format: blueprints array is missing');
      }
      
      if (!data.cards || !Array.isArray(data.cards)) {
        throw new Error('Invalid JSON format: cards array is missing');
      }

      setProcessingStep('Preparing to insert data into database...');
      
      // Get current user ID
      const { data: userData, error: userError } = await supabase.auth.getUser();
      
      if (userError || !userData.user) {
        throw new Error('Authentication error: ' + (userError?.message || 'User not found'));
      }
      
      const userId = userData.user.id;
      
      // Simplify blueprints data structure for insertion
      const simpleBlueprints = data.blueprints.map((bp: Blueprint) => ({
        exam: selectedExam,
        domain: bp.domain || '',
        section: bp.section || '',
        learning_outcome: bp.learning_outcome || ''
      }));

      // Try a different approach: create individual items one by one instead of in bulk
      // This should help identify which specific item is causing issues
      if (simpleBlueprints.length > 0) {
        let insertedCount = 0;
        let errorCount = 0;
        
        console.log(`Attempting to insert ${simpleBlueprints.length} blueprints`);
        
        // First, check if we can query the table (to test permissions)
        const { data: queryData, error: queryError } = await supabase
          .from('blueprints')
          .select('id') // Select a simple column instead of count(*)
          .limit(1);
          
        if (queryError) {
          console.error(`Permission test failed. Error querying blueprints table:`, queryError);
          
          // Permission error detected, immediately try the API route fallback
          console.log("Permission error detected. Trying API route fallback immediately.");
          setProcessingStep("Permission error. Trying alternative method...");
          
          // Skip the direct insertion attempts and go straight to the API fallback
          errorCount = 1; // Set error count to trigger the fallback
        } else {
          // We have permission to query, now try inserting
          
          // First, create blueprints one by one
          for (let i = 0; i < Math.min(simpleBlueprints.length, 5); i++) {
            // Just try with first few to see if it works
            const blueprint = simpleBlueprints[i];
            
            console.log(`Insert attempt ${i+1}: ${JSON.stringify(blueprint)}`);
            
            try {
              const { data: bpData, error: bpError } = await supabase
                .from('blueprints')
                .insert([{
                  exam: blueprint.exam,
                  domain: blueprint.domain,
                  section: blueprint.section,
                  learning_outcome: blueprint.learning_outcome,
                  created_at: new Date().toISOString(),
                  updated_at: new Date().toISOString()
                }])
                .select();
              
              if (bpError) {
                console.error(`Error inserting blueprint ${i}:`, bpError);
                
                // Check if this is a permission error (RLS policy)
                if (bpError.message.includes('permission') || bpError.code === '42501') {
                  console.log("Permission error detected. This is likely due to Row Level Security (RLS) policies.");
                  console.log("The database is configured to only allow admins to insert data directly into tables.");
                  console.log("We'll try using the edge function instead, which has admin privileges.");
                  
                  errorCount++;
                  // Break the loop to try the alternative approach
                  break;
                } else {
                  errorCount++;
                }
              } else {
                console.log(`Successfully inserted blueprint ${i}:`, bpData);
                insertedCount++;
              }
            } catch (insertError) {
              console.error(`Exception during insert ${i}:`, insertError);
              errorCount++;
            }
          }
        }
        
        // Try using RPC as a fallback approach with extra safety
        if (insertedCount === 0 && errorCount > 0) {
          console.log("Direct inserts failed, trying API route fallback");
          setProcessingStep("Direct database insertion failed. Trying alternative method...");
          
          try {
            // Make sure all the card data follows the expected structure
            const processedCards = data.cards.map((card: any) => {
              if (card.card_type === 'lesson') {
                // Ensure bullet_points is an array of strings
                return {
                  ...card,
                  exam: selectedExam,
                  bullet_points: Array.isArray(card.bullet_points) 
                    ? card.bullet_points.map((bp: any) => String(bp))
                    : []
                };
              } else if (card.card_type === 'quiz') {
                // Ensure choices is an array of exactly 4 strings
                const choices = Array.isArray(card.choices) 
                  ? card.choices.map((c: any) => String(c)).slice(0, 4) 
                  : ["", "", "", ""];
                
                // If we don't have enough choices, pad with empty strings
                while (choices.length < 4) {
                  choices.push("");
                }

                return {
                  ...card,
                  exam: selectedExam,
                  choices
                };
              }
              return { ...card, exam: selectedExam };
            });

            // Use our new API route to call the edge function
            const response = await fetch('/api/process-json', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                userId: userId,
                jsonData: {
                  blueprints: simpleBlueprints,
                  cards: processedCards, // Use processed cards
                  exam: selectedExam // This is needed for the Edge Function
                }
              })
            });
            
            if (!response.ok) {
              const errorData = await response.json();
              throw new Error(`API error: ${errorData.error || response.statusText}`);
            }
            
            const result = await response.json();
            
            setProcessingStep(`Successfully processed ${result.count || 'unknown number of'} items.`);
            console.log("API route succeeded:", result);
            
            // Reset the form
            setSelectedFile(null);
            setJsonContent(null);
            if (fileInputRef.current) {
              fileInputRef.current.value = '';
            }
          } catch (apiError: any) {
            console.error("API route failed:", apiError);
            setError(`API error: ${apiError.message}`);
          }
        }
      }
    } catch (err: any) {
      console.error('Error processing JSON:', err);
      setError(`Error: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  }, [jsonContent, selectedExam, supabase]);

  const handleFileUpload = useCallback(async () => {
    if (!selectedFile) {
      setError('Please select a file first');
      return;
    }

    setIsLoading(true);
    setProcessingStep('Reading JSON file...');
    setError(null);

    try {
      // Read the file as text
      const text = await selectedFile.text();
      setJsonContent(text);
      setProcessingStep('JSON file loaded successfully');
    } catch (err: any) {
      console.error('Error reading file:', err);
      setError(`Error reading file: ${err.message}`);
      setJsonContent(null);
    } finally {
      setIsLoading(false);
    }
  }, [selectedFile]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col space-y-2">
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
          Select Exam
        </label>
        <select
          value={selectedExam}
          onChange={(e) => setSelectedExam(e.target.value)}
          className="block w-full px-3 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
          disabled={isLoading}
        >
          <option value="SIE">SIE</option>
          <option value="SERIES_7">Series 7</option>
          <option value="SERIES_66">Series 66</option>
          <option value="CFA_L1">CFA Level 1</option>
        </select>
      </div>
      
      <div className="flex flex-col space-y-2">
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
          Upload JSON File
        </label>
        <input
          type="file"
          ref={fileInputRef}
          accept=".json"
          onChange={handleFileChange}
          className="block w-full text-sm text-gray-500 dark:text-gray-400
                    file:mr-4 file:py-2 file:px-4
                    file:rounded-md file:border-0
                    file:text-sm file:font-semibold
                    file:bg-blue-50 file:text-blue-700
                    dark:file:bg-blue-900 dark:file:text-blue-200
                    hover:file:bg-blue-100 dark:hover:file:bg-blue-800"
          disabled={isLoading}
        />
      </div>

      <div className="flex space-x-4">
        <button
          onClick={handleFileUpload}
          disabled={!selectedFile || isLoading}
          className="inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
        >
          Read JSON
        </button>
        
        <button
          onClick={handleJsonProcessing}
          disabled={!jsonContent || isLoading}
          className="inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:opacity-50"
        >
          Process JSON
        </button>
      </div>

      {processingStep && (
        <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-900 text-blue-700 dark:text-blue-200 rounded-md">
          <p className="text-sm">{processingStep}</p>
          {isLoading && (
            <div className="mt-2 flex justify-center">
              <div className="w-5 h-5 border-t-2 border-blue-500 rounded-full animate-spin"></div>
            </div>
          )}
        </div>
      )}

      {error && (
        <div className="mt-4 p-3 bg-red-50 dark:bg-red-900 text-red-700 dark:text-red-200 rounded-md">
          <p className="text-sm">{error}</p>
        </div>
      )}

      {jsonContent && (
        <div className="mt-4">
          <h3 className="text-md font-semibold text-gray-700 dark:text-gray-300 mb-2">
            JSON Preview:
          </h3>
          <div className="p-3 bg-gray-100 dark:bg-gray-800 rounded-md overflow-auto max-h-60">
            <pre className="text-xs text-gray-700 dark:text-gray-300">
              {jsonContent.substring(0, 500)}...
            </pre>
          </div>
        </div>
      )}
    </div>
  );
} 