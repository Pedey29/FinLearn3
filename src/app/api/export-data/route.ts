import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { Database } from '@/types/supabase';

export async function GET() {
  try {
    const supabase = createRouteHandlerClient<Database>({ cookies });
    
    // Check if user is authenticated
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      return new NextResponse(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    // In a real app, you would check if the user has admin role
    
    // Fetch data from all tables
    const { data: blueprintsData, error: blueprintsError } = await supabase
      .from('blueprints')
      .select('*')
      .order('created_at', { ascending: false });
      
    const { data: lessonsData, error: lessonsError } = await supabase
      .from('lessons')
      .select('*')
      .order('created_at', { ascending: false });
      
    const { data: quizzesData, error: quizzesError } = await supabase
      .from('quizzes')
      .select('*')
      .order('created_at', { ascending: false });
    
    // Check for errors
    if (blueprintsError || lessonsError || quizzesError) {
      throw new Error('Error fetching data');
    }
    
    // Combine the data
    const exportData = {
      meta: {
        exportDate: new Date().toISOString(),
        version: '1.0'
      },
      blueprints: blueprintsData || [],
      lessons: lessonsData || [],
      quizzes: quizzesData || []
    };
    
    // Return JSON data
    return new NextResponse(JSON.stringify(exportData, null, 2), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Content-Disposition': 'attachment; filename="finlearn_export.json"'
      }
    });
  } catch (error: any) {
    console.error('Export error:', error.message);
    return new NextResponse(JSON.stringify({ error: 'Failed to export data' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
} 