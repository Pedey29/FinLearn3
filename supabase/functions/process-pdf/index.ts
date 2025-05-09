    // finlearn/supabase/functions/process-pdf/index.ts
    import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
    import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.4';
    import { Configuration, OpenAIApi } from 'https://esm.sh/openai@3.3.0';

    console.log("--------- V6 TEST + Imports + CORS Headers ---------"); // New Marker

    const corsHeaders = { // ADDED BACK
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    };

    const minimalMessage = "Hello from V6 + Imports + CORS Headers."; // New Message

    interface PdfData {
      text: string;
      title: string;
      pages: number;
      filename: string;
      userId: string;
      exam: string;
    }

    interface BlueprintInput { // Renamed to avoid conflict with internal Blueprint
      exam?: string;
      domain?: string;
      section?: string;
      learning_outcome?: string; // This is the primary field from JSON
      los_text?: string;         // Fallback if learning_outcome is missing
    }

    interface Blueprint { // Internal representation after mapping
      exam: string;
      domain: string;
      section: string;
      los_text: string; // This is the canonical key for matching
    }

    interface CardBase {
      exam: string;
      los_text: string;
      card_type: 'lesson' | 'quiz';
    }

    interface LessonCard extends CardBase {
      card_type: 'lesson';
      title: string;
      content: string; // HTML
      bullet_points: string[];
    }

    interface QuizCard extends CardBase {
      card_type: 'quiz';
      stem: string; // This is the question
      choices: string[];
      answer: string; // Letter of correct choice
      explanation: string;
    }

    type Card = LessonCard | QuizCard;

    interface AiResponse { // This structure is used for both AI and direct JSON
      blueprints: Blueprint[];
      cards: Card[];
    }

    // For SQL function
    interface SqlLesson {
      blueprint_index: number;
      title: string;
      content: string;
      bullet_points: string[];
    }

    interface SqlQuiz {
      blueprint_index: number;
      question: string;
      choices: string[];
      correct_index: number; 
      explanation: string;
    }

    serve(async (req: Request) => {
      // Handle CORS preflight request
      if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders });
      }

      try {
        // Check if the request has direct JSON data that should bypass OpenAI processing
        const requestData = await req.json();
        const { pdfData, jsonData } = requestData;
        
        if (!pdfData || !pdfData.userId) {
          return new Response(
            JSON.stringify({ error: 'PDF data (including userId and exam) is required' }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 },
          );
        }

        // Create a Supabase client with the service role key
        const supabaseAdmin = createClient(
          Deno.env.get('SUPABASE_URL') || '',
          Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '',
        );
        
        let learningMaterial: AiResponse;
        
        // Declare variables needed for both paths
        let sqlFormattedBlueprints: any[] = [];
        let sqlLessons: SqlLesson[] = [];
        let sqlQuizzes: SqlQuiz[] = [];
        
        // If jsonData is provided, use it directly instead of calling OpenAI
        if (jsonData && jsonData.blueprints && Array.isArray(jsonData.blueprints)) {
          console.log("Using provided JSON data directly, bypassing OpenAI");
          
          // Map incoming jsonData.blueprints to our internal Blueprint structure
          // Prioritize 'learning_outcome' as the source for 'los_text' for matching
          const mappedBlueprints = jsonData.blueprints.map((bp: BlueprintInput): Blueprint => ({
            exam: bp.exam || pdfData.exam || "UNKNOWN_EXAM",
            domain: bp.domain || "General",
            section: bp.section || "General",
            // Use learning_outcome if present, otherwise los_text, then a default. This becomes the key for matching.
            los_text: (bp.learning_outcome || bp.los_text || `Default_LOS_${Math.random()}`).trim() 
          }));

          learningMaterial = {
            blueprints: mappedBlueprints,
            cards: jsonData.cards || []
          };
          
          const blueprintLosMap = new Map<string, number>();
          learningMaterial.blueprints.forEach((bp, index) => {
            if (bp.los_text.startsWith('Default_LOS_')) {
                console.warn(`Edge Fn: Blueprint at index ${index} is using a default los_text: "${bp.los_text}". Original bp: ${JSON.stringify(jsonData.blueprints[index])}`);
            }
            blueprintLosMap.set(bp.los_text, index);
          });
          console.log("Edge Fn: Blueprint LOS Map created with keys:", Array.from(blueprintLosMap.keys()));

          // Prepare blueprints for SQL insertion (uses the mapped 'los_text' as 'learning_outcome')
          sqlFormattedBlueprints = learningMaterial.blueprints.map(bp => ({
            exam: bp.exam,
            domain: bp.domain,
            section: bp.section,
            learning_outcome: bp.los_text // Ensure this matches the SQL function's expectation
          }));
          
          if (learningMaterial.cards && learningMaterial.cards.length > 0) {
            console.log(`Edge Fn: Processing ${learningMaterial.cards.length} cards.`);
            learningMaterial.cards.forEach((card, cardIndex) => {
              const cardLosText = (card.los_text || "").trim();
              console.log(`Edge Fn: Card ${cardIndex}, Type: ${card.card_type}, Attempting to match los_text: "${cardLosText}"`);
              
              const blueprintIndex = blueprintLosMap.get(cardLosText);
              
              if (blueprintIndex === undefined) {
                console.warn(`Edge Fn: Card with los_text "${cardLosText}" (index ${cardIndex}) does not match any blueprint LOS in the map. Skipping. Card details: ${JSON.stringify(card)}`);
                return;
              }

              if (card.card_type === 'lesson') {
                const lessonCard = card as LessonCard;
                sqlLessons.push({
                  blueprint_index: blueprintIndex,
                  title: lessonCard.title || "Lesson",
                  content: lessonCard.content || "",
                  bullet_points: Array.isArray(lessonCard.bullet_points) ? lessonCard.bullet_points.map(bp => String(bp)) : []
                });
              } else if (card.card_type === 'quiz') {
                const quizCard = card as QuizCard;
                const correctIndex = quizCard.answer ? quizCard.answer.toUpperCase().charCodeAt(0) - 'A'.charCodeAt(0) : 0;
                sqlQuizzes.push({
                  blueprint_index: blueprintIndex,
                  question: quizCard.stem || "Question",
                  choices: Array.isArray(quizCard.choices) ? quizCard.choices.map(c => String(c)).slice(0, 4) : ["", "", "", ""],
                  correct_index: correctIndex >= 0 && correctIndex < 4 ? correctIndex : 0,
                  explanation: quizCard.explanation || ""
                });
              }
            });
          }

          // After processing all cards, check if any lessons or quizzes were actually generated
          if (sqlLessons.length === 0 && sqlQuizzes.length === 0 && learningMaterial.cards.length > 0) {
            const errorMessage = "No cards could be matched to blueprints. Please ensure 'los_text' in cards matches 'learning_outcome' or 'los_text' in blueprints within your JSON data.";
            console.error("Edge Fn: " + errorMessage);
            return new Response(
              JSON.stringify({ error: errorMessage, detail: "All cards were skipped due to mismatch with blueprint identifiers." }),
              { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
            );
          }
        } else {
          // No pre-provided JSON, need to process the PDF text with OpenAI
          const configuration = new Configuration({
            apiKey: Deno.env.get('OPENAI_API_KEY'),
          });
          const openai = new OpenAIApi(configuration);

          const completion = await openai.createChatCompletion({
            model: 'gpt-4.1-mini',
            messages: [
              {
                role: 'system',
                content: `You are an exam-content generator. Your task is to process raw text extracted from study materials for a given financial exam and generate structured learning content.

Inputs you will receive:
- exam_code: e.g., "SIE", "SERIES_7", "CFA_L1"
- raw_text: Full text extracted from one or more PDFs (outline, notes, practice exam) for that exam.

Your primary tasks are:
1.  Locate every official learning-objective bullet in the outline sections of the raw_text. For each, emit a "blueprint" object.
2.  For each learning objective identified, create ONE concise lesson card (around 100-150 words, using simple HTML like <p>, <ul>, <li>, and LaTeX for formulas, with 2-3 key takeaway bullet points).
3.  If the raw_text contains practice-question blocks matching a learning objective, create ONE multiple-choice quiz object for each.

Output Format:
You MUST return a single JSON object with two main keys: "blueprints" and "cards".

Constraints:
- Rewrite source text; do NOT copy proprietary phrases verbatim.
- Keep lesson HTML minimal.
- Ensure every card (lesson or quiz) is linked to its corresponding learning objective via an identical "los_text" field matching the one in its blueprint object.
- For quizzes, 'answer' should be the letter of the correct choice (e.g., "B"). Each quiz must have exactly 4 choices.`,
              },
              {
                role: 'user',
                content: `Exam Code: "${pdfData.exam}"
Raw Text (from: ${pdfData.title}):
"""
${pdfData.text?.substring(0, 14000) || 'No text provided'} 
"""

Based on the system instructions, generate the JSON output.

The JSON output structure should be:
{
  "blueprints": [
    { 
      "exam": "${pdfData.exam}", 
      "domain": "string - main category or domain from outline (e.g., Debt Instruments)", 
      "section": "string - outline section title or identifier (e.g., Bonds, Corporate Bonds)", 
      "los_text": "string - the exact text of the learning objective statement/bullet (e.g., Understand the characteristics of Treasury Bonds.)" 
    } 
    // ... more blueprint objects
  ],
  "cards": [
    // Lesson card example:
    {
      "exam": "${pdfData.exam}",
      "los_text": "string - matches a los_text from a blueprint object",
      "card_type": "lesson",
      "title": "string - concise title for the lesson",
      "content": "string - HTML content for the lesson (approx 100-150 words), LaTeX for formulas",
      "bullet_points": ["string - key takeaway 1", "string - key takeaway 2"] 
    },
    // Quiz card example:
    { 
      "exam": "${pdfData.exam}",
      "los_text": "string - matches a los_text from a blueprint object",
      "card_type": "quiz",
      "stem": "string - the question/stem of the multiple choice question",
      "choices": ["string - choice A", "string - choice B", "string - choice C", "string - choice D"],
      "answer": "string - letter of the correct choice (e.g., 'A', 'B', 'C', or 'D')",
      "explanation": "string - brief explanation of why the answer is correct"
    }
    // ... more card objects (lessons and quizzes mixed)
  ]
}

Ensure you generate a comprehensive set of blueprints based on the provided text, and for each blueprint, at least one lesson card. Generate quiz cards if practice questions are identifiable in the text for a given learning objective. Ensure quiz choices are an array of 4 strings.`,
              },
            ],
            temperature: 0.5,
            max_tokens: 4000,
          });

          const aiResponseContent = completion.data.choices[0]?.message?.content;
          if (!aiResponseContent) {
            throw new Error('Failed to get a response from OpenAI');
          }

          // Parse the AI response to get structured data
          const parsedAiResponse = JSON.parse(aiResponseContent);

          if (!parsedAiResponse.blueprints || !parsedAiResponse.cards) {
            throw new Error('OpenAI response missing blueprints or cards array');
          }
          
          const mappedAiBlueprints = parsedAiResponse.blueprints.map((bp: BlueprintInput): Blueprint => ({
            exam: bp.exam || pdfData.exam || "UNKNOWN_EXAM",
            domain: bp.domain || "General",
            section: bp.section || "General",
            los_text: (bp.learning_outcome || bp.los_text || `Default_LOS_${Math.random()}`).trim()
          }));

          learningMaterial = {
            blueprints: mappedAiBlueprints,
            cards: parsedAiResponse.cards || []
          };
          
          const blueprintLosMap = new Map<string, number>();
          learningMaterial.blueprints.forEach((bp, index) => {
            blueprintLosMap.set(bp.los_text, index);
          });

          // Assign to existing outer-scoped variable
          sqlFormattedBlueprints = learningMaterial.blueprints.map(bp => ({
            exam: bp.exam,
            domain: bp.domain,
            section: bp.section,
            learning_outcome: bp.los_text
          }));

          learningMaterial.cards.forEach((card, cardIndex) => {
            // --- BEGIN DETAILED LOGGING (OpenAI path) --- 
            console.log(`Edge Fn (OpenAI): Card ${cardIndex}, Type: ${card.card_type}`);
            // --- END DETAILED LOGGING --- 
            const cardLosText = (card.los_text || "").trim();
            const blueprintIndex = blueprintLosMap.get(cardLosText);
            
            if (blueprintIndex === undefined) {
              console.warn(`Edge Fn (OpenAI): Card with los_text "${cardLosText}" (index ${cardIndex}) does not match any blueprint. Skipping.`);
              return;
            }

            if (card.card_type === 'lesson') {
              const lessonCard = card as LessonCard;
              // --- BEGIN DETAILED LOGGING (OpenAI path) --- 
              console.log(`Edge Fn (OpenAI): Lesson "${lessonCard.title}", bullets type: ${typeof lessonCard.bullet_points}, isArray: ${Array.isArray(lessonCard.bullet_points)}, Val: ${JSON.stringify(lessonCard.bullet_points)}`);
              // --- END DETAILED LOGGING ---
              sqlLessons.push({
                blueprint_index: blueprintIndex,
                title: lessonCard.title,
                content: lessonCard.content,
                bullet_points: Array.isArray(lessonCard.bullet_points) ? lessonCard.bullet_points.map(bp => String(bp)) : []
              });
            } else if (card.card_type === 'quiz') {
              const quizCard = card as QuizCard;
              // --- BEGIN DETAILED LOGGING (OpenAI path) --- 
              console.log(`Edge Fn (OpenAI): Quiz "${quizCard.stem}", choices type: ${typeof quizCard.choices}, isArray: ${Array.isArray(quizCard.choices)}, Val: ${JSON.stringify(quizCard.choices)}`);
              // --- END DETAILED LOGGING ---
              const correctIndex = quizCard.answer.toUpperCase().charCodeAt(0) - 'A'.charCodeAt(0);
              
              if (correctIndex < 0 || correctIndex >= 4 || !quizCard.choices || quizCard.choices.length !== 4) {
                console.warn(`Edge Fn (OpenAI): Quiz with stem "${quizCard.stem}" (index ${cardIndex}) has invalid answer or choices. Skipping.`);
                return; 
              }
              sqlQuizzes.push({
                blueprint_index: blueprintIndex,
                question: quizCard.stem,
                choices: Array.isArray(quizCard.choices) ? quizCard.choices.map(c => String(c)).slice(0,4) : ["", "", "", ""],
                correct_index: correctIndex,
                explanation: quizCard.explanation
              });
            }
          });
        }

        // --- BEGIN DETAILED LOGGING --- 
        console.log(`Edge Fn: Final sqlLessons for RPC (sample): ${JSON.stringify(sqlLessons.slice(0,1))}`);
        console.log(`Edge Fn: Final sqlQuizzes for RPC (sample): ${JSON.stringify(sqlQuizzes.slice(0,1))}`);
        // --- END DETAILED LOGGING ---

        // --- BEGIN PRE-RPC LOGGING ---
        console.log(`Edge Fn: Pre-RPC sqlFormattedBlueprints length: ${sqlFormattedBlueprints.length}`);
        console.log(`Edge Fn: Pre-RPC sqlLessons length: ${sqlLessons.length}`);
        console.log(`Edge Fn: Pre-RPC sqlQuizzes length: ${sqlQuizzes.length}`);
        
        // Add detailed logging for the first lesson's bullet_points
        if (sqlLessons.length > 0) {
          const sample = sqlLessons[0];
          console.log(`Edge Fn: DEBUG - First lesson bullet_points type: ${typeof sample.bullet_points}`);
          console.log(`Edge Fn: DEBUG - First lesson bullet_points isArray: ${Array.isArray(sample.bullet_points)}`);
          console.log(`Edge Fn: DEBUG - First lesson bullet_points raw value: ${JSON.stringify(sample.bullet_points)}`);
        }
        // --- END PRE-RPC LOGGING ---

        // FALLBACK IMPLEMENTATION - Skip RPC and insert directly if available
        let success = false;
        let insertedData = { blueprintCount: 0, lessonCount: 0, quizCount: 0 };
        
        // Try direct database insert first
        try {
          // 1. Insert blueprints
          const { data: blueprintsData, error: blueprintsError } = await supabaseAdmin
            .from('blueprints')
            .insert(sqlFormattedBlueprints.map(bp => ({
              exam: bp.exam,
              domain: bp.domain,
              section: bp.section,
              learning_outcome: bp.learning_outcome
            })))
            .select('id, learning_outcome');
            
          if (blueprintsError) throw new Error(`Blueprint insert error: ${blueprintsError.message}`);
          console.log(`Edge Fn: Direct DB - Inserted ${blueprintsData.length} blueprints`);
          
          // Create blueprint lookup map for lessons and quizzes
          const blueprintMap = new Map();
          blueprintsData.forEach(bp => {
            blueprintMap.set(bp.learning_outcome, bp.id);
          });
          
          // 2. Insert lessons if any
          if (sqlLessons.length > 0) {
            const lessonsToInsert = [];
            
            for (const lesson of sqlLessons) {
              const blueprintId = blueprintMap.get(sqlFormattedBlueprints[lesson.blueprint_index].learning_outcome);
              if (!blueprintId) {
                console.warn(`Edge Fn: Direct DB - Could not find blueprint ID for lesson ${lesson.title}`);
                continue;
              }
              
              lessonsToInsert.push({
                blueprint_id: blueprintId,
                title: lesson.title,
                content: lesson.content,
                bullet_points: Array.isArray(lesson.bullet_points) 
                  ? JSON.stringify(lesson.bullet_points.map(bp => String(bp)))
                  : JSON.stringify([])
              });
            }
            
            if (lessonsToInsert.length > 0) {
              const { data: lessonsData, error: lessonsError } = await supabaseAdmin
                .from('lessons')
                .insert(lessonsToInsert);
                
              if (lessonsError) throw new Error(`Lesson insert error: ${lessonsError.message}`);
              console.log(`Edge Fn: Direct DB - Inserted ${lessonsToInsert.length} lessons`);
            }
          }
          
          // 3. Insert quizzes if any
          if (sqlQuizzes.length > 0) {
            const quizzesToInsert = [];
            
            for (const quiz of sqlQuizzes) {
              const blueprintId = blueprintMap.get(sqlFormattedBlueprints[quiz.blueprint_index].learning_outcome);
              if (!blueprintId) {
                console.warn(`Edge Fn: Direct DB - Could not find blueprint ID for quiz ${quiz.question}`);
                continue;
              }
              
              quizzesToInsert.push({
                blueprint_id: blueprintId,
                question: quiz.question,
                choices: JSON.stringify(Array.isArray(quiz.choices) 
                  ? quiz.choices.map(c => String(c)).slice(0, 4) 
                  : ["", "", "", ""]),
                correct_index: quiz.correct_index,
                explanation: quiz.explanation
              });
            }
            
            if (quizzesToInsert.length > 0) {
              const { data: quizzesData, error: quizzesError } = await supabaseAdmin
                .from('quizzes')
                .insert(quizzesToInsert);
                
              if (quizzesError) throw new Error(`Quiz insert error: ${quizzesError.message}`);
              console.log(`Edge Fn: Direct DB - Inserted ${quizzesToInsert.length} quizzes`);
            }
          }
          
          // Success path
          success = true;
          insertedData = {
            blueprintCount: blueprintsData.length,
            lessonCount: sqlLessons.length,
            quizCount: sqlQuizzes.length
          };
        } catch (dbError) {
          console.error(`Edge Fn: Direct DB insert failed: ${dbError}`);
          
          // Fall back to RPC call if direct insert fails
          console.log('Edge Fn: Falling back to RPC call after direct DB failure');
          
          // Original RPC code with fix for bullet_points
          const rpcPayload = {
            p_user_id: pdfData.userId,
            p_blueprints: JSON.stringify(sqlFormattedBlueprints),
            p_lessons: JSON.stringify(sqlLessons.map(lesson => ({
              ...lesson,
              // Format bullet_points as a properly JSON stringified array
              bullet_points: Array.isArray(lesson.bullet_points) ? lesson.bullet_points.map(bp => String(bp)) : []
            }))),
            p_quizzes: JSON.stringify(sqlQuizzes.map(quiz => ({
              ...quiz,
              choices: Array.isArray(quiz.choices) ? quiz.choices.map(c => String(c)).slice(0, 4) : ["", "", "", ""]
            })))
          };
          
          console.log(`Edge Fn: DEBUG - RPC payload (sample): ${JSON.stringify(rpcPayload).substring(0, 500)}...`);
          
          const { data: rpcData, error: rpcError } = await supabaseAdmin.rpc('create_learning_materials', rpcPayload);
  
          if (rpcError) {
            console.error('Edge Fn: RPC Error:', rpcError);
            throw new Error(`Database error: ${rpcError.message}`);
          } else {
            // --- BEGIN POST-RPC LOGGING ---
            console.log('Edge Fn: RPC Call successful. rpcData:', JSON.stringify(rpcData));
            // --- END POST-RPC LOGGING ---
            success = true;
          }
        }

        return new Response(
          JSON.stringify({ 
            success: success, 
            message: "Data processed successfully via Edge Function.",
            blueprintCount: insertedData.blueprintCount,
            lessonCount: insertedData.lessonCount,
            quizCount: insertedData.quizCount
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 },
        );
      } catch (error: any) {
        console.error('Edge Fn: Uncaught error during processing:', error);
        return new Response(
          JSON.stringify({ error: error.message, stack: error.stack }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 },
        );
      }
    });