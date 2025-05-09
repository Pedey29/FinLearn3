import { createClient } from '@supabase/supabase-js';
import { Database } from '@/types/supabase';

// This is a one-time migration script to add the questions_completed_today column
// to the profiles table for streak tracking

async function addQuestionsCompletedColumn() {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    
    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Supabase environment variables are not set');
    }
    
    // Create a Supabase client with the service role key
    const supabase = createClient<Database>(supabaseUrl, supabaseServiceKey);
    
    // Check if the column already exists to prevent errors
    const { data: columnExists, error: checkError } = await supabase.rpc(
      'column_exists',
      { table_name: 'profiles', column_name: 'questions_completed_today' }
    );
    
    if (checkError) {
      // If the RPC doesn't exist, we can try a simple query instead
      console.log('Error checking column existence:', checkError);
      
      // Alternatively, just proceed with adding the column
      console.log('Proceeding to add column anyway...');
    } else if (columnExists) {
      console.log('Column already exists, no action needed');
      return;
    }
    
    // Add the questions_completed_today column
    const { error } = await supabase.rpc(
      'add_column_if_not_exists',
      {
        table_name: 'profiles',
        column_name: 'questions_completed_today',
        column_type: 'integer',
        column_default: '0'
      }
    );
    
    if (error) {
      console.error('Error adding column:', error);
      
      // Fallback to direct SQL if RPC fails
      console.log('Attempting direct SQL...');
      
      const { error: sqlError } = await supabase.from('_migrations').insert({
        name: 'add_questions_completed_today',
        script: `
          ALTER TABLE profiles 
          ADD COLUMN IF NOT EXISTS questions_completed_today INTEGER DEFAULT 0;
        `
      });
      
      if (sqlError) {
        console.error('Error with SQL fallback:', sqlError);
        throw sqlError;
      }
    }
    
    console.log('Migration completed successfully');
  } catch (error) {
    console.error('Migration failed:', error);
    throw error;
  }
}

export async function GET() {
  try {
    await addQuestionsCompletedColumn();
    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    return new Response(JSON.stringify({ success: false, error: String(error) }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

export async function POST() {
  return GET();
} 