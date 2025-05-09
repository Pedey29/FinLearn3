// Test script for Supabase RPC function
// Run this in the browser console after logging in

async function testSupabase() {
  // Get the Supabase client from window if available
  const supabase = window.supabase;
  
  if (!supabase) {
    console.error("Supabase client not found. Run this in the browser console after loading the app.");
    return;
  }
  
  // First test: can we read from the database?
  console.log("Testing database read access...");
  const { data: userProfile, error: profileError } = await supabase.from('profiles').select('*').limit(1);
  
  if (profileError) {
    console.error("Error reading from profiles table:", profileError);
  } else {
    console.log("Successfully read from profiles table:", userProfile);
  }
  
  // Second test: can we insert directly to blueprints?
  console.log("Testing direct insert to blueprints...");
  const { data: insertData, error: insertError } = await supabase
    .from('blueprints')
    .insert([{
      exam: "TEST",
      domain: "Test Domain",
      section: "Test Section",
      learning_outcome: "Test Learning Outcome " + new Date().toISOString(),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }])
    .select();
    
  if (insertError) {
    console.error("Error inserting to blueprints table:", insertError);
  } else {
    console.log("Successfully inserted to blueprints table:", insertData);
  }
  
  // Third test: can we call the RPC function?
  console.log("Testing RPC function...");
  const testBlueprints = [{
    exam: "TEST_RPC",
    domain: "Test RPC Domain",
    section: "Test RPC Section",
    learning_outcome: "Test RPC Learning Outcome " + new Date().toISOString()
  }];
  
  const { data: rpcData, error: rpcError } = await supabase.rpc('create_learning_materials', {
    p_user_id: (await supabase.auth.getUser()).data.user?.id,
    p_blueprints: JSON.stringify(testBlueprints),
    p_lessons: JSON.stringify([]),
    p_quizzes: JSON.stringify([])
  });
  
  if (rpcError) {
    console.error("Error calling RPC function:", rpcError);
  } else {
    console.log("Successfully called RPC function:", rpcData);
  }
}

// Instructions:
// 1. Copy this entire script
// 2. Open your browser console on the FinLearn app (after logging in)
// 3. Paste and run this script
// 4. Check console output for results 