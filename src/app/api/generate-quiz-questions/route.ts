import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import OpenAI from 'openai';
import { Database } from '@/types/supabase';

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Number of questions to generate per lesson by default
const DEFAULT_QUESTIONS_PER_LESSON = 3;

// Interface for the generated question
interface GeneratedQuestion {
  question: string;
  choices: string[];
  correctIndex: number;
  explanation: string;
}

export async function POST(req: NextRequest) {
  try {
    // Initialize Supabase client
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    
    if (!supabaseUrl || !supabaseKey) {
      return NextResponse.json(
        { error: 'Server configuration error' },
        { status: 500 }
      );
    }
    
    // Create authenticated Supabase client with service role key
    const supabase = createClient<Database>(supabaseUrl, supabaseKey);
    
    // Verify admin authorization
    const authHeader = req.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'Unauthorized request' },
        { status: 401 }
      );
    }
    
    const token = authHeader.split(' ')[1];
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Authentication failed' },
        { status: 401 }
      );
    }
    
    // Verify the user is an admin
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();
      
    if (!profile || profile.role !== 'admin') {
      return NextResponse.json(
        { error: 'Unauthorized: Admin access required' },
        { status: 403 }
      );
    }
    
    // Parse request body
    const requestData = await req.json();
    const { lessonIds, examId, questionsPerLesson = DEFAULT_QUESTIONS_PER_LESSON } = requestData;
    
    // Validate parameters
    if ((!lessonIds || !lessonIds.length) && !examId) {
      return NextResponse.json(
        { error: 'Either lessonIds or examId is required' },
        { status: 400 }
      );
    }
    
    let lessonsToProcess = [];
    
    // Fetch lessons either by specific IDs or by exam
    if (lessonIds && lessonIds.length) {
      const { data: lessons } = await supabase
        .from('lessons')
        .select('*, blueprints!inner(*)')
        .in('id', lessonIds);
      
      lessonsToProcess = lessons || [];
    } else if (examId) {
      // Get all lessons for a specific exam
      const { data: lessons } = await supabase
        .from('lessons')
        .select('*, blueprints!inner(*)')
        .eq('blueprints.exam', examId);
      
      lessonsToProcess = lessons || [];
    }
    
    if (!lessonsToProcess.length) {
      return NextResponse.json(
        { error: 'No lessons found to process' },
        { status: 404 }
      );
    }
    
    // Process each lesson and generate questions
    const results = await Promise.all(
      lessonsToProcess.map(async (lesson) => {
        const questions = await generateQuestionsForLesson(lesson, questionsPerLesson);
        return { lessonId: lesson.id, questions };
      })
    );
    
    // Save generated questions to the database
    let savedCount = 0;
    let skippedCount = 0;
    
    for (const result of results) {
      for (const question of result.questions) {
        // Check if a similar question already exists to avoid duplicates
        const { data: existingQuestions } = await supabase
          .from('quizzes')
          .select('id')
          .eq('blueprint_id', question.blueprintId)
          .ilike('question', `%${question.question.substring(0, 50)}%`)
          .limit(1);
        
        if (existingQuestions && existingQuestions.length > 0) {
          skippedCount++;
          continue;
        }
        
        // Insert the new question
        const { error } = await supabase
          .from('quizzes')
          .insert({
            blueprint_id: question.blueprintId,
            question: question.question,
            choices: question.choices,
            correct_index: question.correctIndex,
            explanation: question.explanation,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          });
        
        if (!error) {
          savedCount++;
        } else {
          console.error('Error saving question:', error);
          skippedCount++;
        }
      }
    }
    
    return NextResponse.json({
      success: true,
      message: `Generated ${savedCount} questions (${skippedCount} skipped) from ${lessonsToProcess.length} lessons`,
      totalQuestions: savedCount,
      skippedQuestions: skippedCount,
      processedLessons: lessonsToProcess.length
    });
    
  } catch (error) {
    console.error('Question generation error:', error);
    return NextResponse.json(
      { error: 'Failed to generate questions', message: String(error) },
      { status: 500 }
    );
  }
}

// Function to generate multiple choice questions for a lesson using OpenAI
async function generateQuestionsForLesson(lesson: any, count: number) {
  try {
    // Extract key lesson information
    const { id, title, content, bullet_points, blueprint_id } = lesson;
    
    // Parse bullet points if they're stored as a string
    let bulletPointsText = '';
    if (bullet_points) {
      try {
        const bulletPointsArray = typeof bullet_points === 'string' 
          ? JSON.parse(bullet_points) 
          : bullet_points;
        
        if (Array.isArray(bulletPointsArray)) {
          bulletPointsText = bulletPointsArray.map(point => `• ${point}`).join('\n');
        }
      } catch (e) {
        console.warn('Error parsing bullet points:', e);
      }
    }
    
    // Combine lesson content for the prompt
    const lessonContent = `
      Title: ${title}
      
      Content: 
      ${content}
      
      ${bulletPointsText ? `Key Points:\n${bulletPointsText}` : ''}
    `;
    
    // Prompt for OpenAI to generate multiple-choice questions
    const response = await openai.chat.completions.create({
      model: "gpt-4-turbo-preview",
      messages: [
        {
          role: "system",
          content: "You are an expert educational content creator specialized in generating high-quality multiple-choice quiz questions. Create challenging but fair questions that test understanding rather than mere recall."
        },
        {
          role: "user",
          content: `Generate ${count} multiple-choice questions based on this lesson content. Each question should have exactly 4 options with only one correct answer.
          
          Return the response in this specific JSON format:
          [
            {
              "question": "Question text here?",
              "choices": ["Option A", "Option B", "Option C", "Option D"],
              "correctIndex": 0,
              "explanation": "Explanation why option A is correct and others are wrong."
            }
          ]
          
          Make sure the correct answer is indicated by the correctIndex (0-3).
          
          Here's the lesson content:
          ${lessonContent}`
        }
      ],
      response_format: { type: "json_object" },
      temperature: 0.7,
    });
    
    // Parse the response to get the generated questions
    const responseContent = response.choices[0]?.message?.content || '';
    let parsedQuestions: GeneratedQuestion[] = [];
    
    try {
      const parsedResponse = JSON.parse(responseContent);
      
      if (parsedResponse.questions || Array.isArray(parsedResponse)) {
        parsedQuestions = parsedResponse.questions || parsedResponse;
      }
      
      // Validate and format each question
      return parsedQuestions.map((q: GeneratedQuestion) => ({
        blueprintId: blueprint_id,
        question: q.question,
        choices: Array.isArray(q.choices) ? q.choices : [],
        correctIndex: typeof q.correctIndex === 'number' ? q.correctIndex : 0,
        explanation: q.explanation || 'No explanation provided.'
      }));
    } catch (e) {
      console.error('Error parsing OpenAI response:', e, responseContent);
      return [];
    }
  } catch (error) {
    console.error(`Error generating questions for lesson ${lesson.id}:`, error);
    return [];
  }
}

// Keep the Next.js API route as a fallback for the Edge Function 