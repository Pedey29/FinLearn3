import { cookies } from 'next/headers';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { NextResponse } from 'next/server';
import { NextRequest } from 'next/server';
import { Database } from '@/types/supabase';

export async function POST(request: NextRequest) {
  try {
    console.log("API route called");
    
    // Get authenticated Supabase client for server - use createRouteHandlerClient instead
    const supabase = createRouteHandlerClient<Database>({ cookies });

    // Check if user is authenticated
    const { data: { user }, error: userError } = await supabase.auth.getUser();

    if (userError || !user) {
      console.log("Authentication error:", userError);
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      );
    }

    // Get the request data
    const requestData = await request.json();
    const { userId, jsonData } = requestData;
    
    console.log("Request data:", JSON.stringify({ userId: userId, jsonData: { exam: jsonData.exam, blueprintCount: jsonData.blueprints?.length, cardsCount: jsonData.cards?.length } }));
    
    if (!userId || !jsonData) {
      console.log("Missing userId or jsonData");
      return NextResponse.json(
        { error: 'User ID and JSON data are required' },
        { status: 400 }
      );
    }
    
    // Verify that the user ID matches
    if (user.id !== userId) {
      console.log("User ID mismatch:", user.id, "!=", userId);
      return NextResponse.json(
        { error: 'User ID mismatch' },
        { status: 403 }
      );
    }

    // Check if the jsonData has the expected structure
    if (!jsonData.blueprints || !Array.isArray(jsonData.blueprints) || 
        !jsonData.cards || !Array.isArray(jsonData.cards) ||
        !jsonData.exam) {
      console.log("Invalid jsonData structure");
      return NextResponse.json(
        { error: 'JSON data must include exam, blueprints array, and cards array' },
        { status: 400 }
      );
    }

    // Process the arrays to ensure consistent formats
    const processedCards = jsonData.cards.map((card: any) => {
      if (card.card_type === 'lesson') {
        return {
          ...card,
          exam: jsonData.exam,
          bullet_points: Array.isArray(card.bullet_points) 
            ? card.bullet_points.map((bp: any) => String(bp))
            : []
        };
      } else if (card.card_type === 'quiz') {
        const choices = Array.isArray(card.choices) 
          ? card.choices.map((c: any) => String(c)).slice(0, 4) 
          : ["", "", "", ""];
        
        while (choices.length < 4) {
          choices.push("");
        }
        
        return {
          ...card,
          exam: jsonData.exam,
          choices
        };
      }
      return { ...card, exam: jsonData.exam };
    });

    // Process the blueprints
    const processedBlueprints = jsonData.blueprints.map((bp: any) => ({
      ...bp,
      exam: jsonData.exam
    }));

    // Log the structure we're sending
    console.log("Sending to Edge Function request with these counts:", {
      blueprints: processedBlueprints.length,
      cards: processedCards.length
    });

    // Call the Supabase Edge Function with admin privileges
    const { data: edgeData, error: edgeError } = await supabase.functions.invoke('process-pdf', {
      body: { 
        // The Edge Function needs these properties
        pdfData: {
          userId: userId,
          exam: jsonData.exam,
          text: '',        // Empty string since we're providing JSON directly
          title: 'JSON Upload',
          pages: 0,
          filename: 'json-upload'
        },
        jsonData: {
          ...jsonData,
          cards: processedCards,
          blueprints: processedBlueprints
        }
      }
    });

    if (edgeError) {
      console.error('Edge function error:', edgeError);
      return NextResponse.json(
        { error: 'Failed to process JSON data: ' + edgeError.message },
        { status: 500 }
      );
    }

    console.log("Edge function successful response:", edgeData);
    return NextResponse.json(edgeData);
    
  } catch (error: any) {
    console.error('Error processing JSON data:', error);
    return NextResponse.json(
      { error: 'Internal Server Error: ' + (error.message || 'Unknown error') },
      { status: 500 }
    );
  }
} 