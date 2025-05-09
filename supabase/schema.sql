-- Create tables for the FinLearn platform

-- Users table extension for additional user data
CREATE TABLE IF NOT EXISTS profiles (
  id UUID REFERENCES auth.users(id) NOT NULL PRIMARY KEY,
  email TEXT,
  full_name TEXT,
  avatar_url TEXT,
  xp INTEGER DEFAULT 0,
  streak INTEGER DEFAULT 0,
  last_streak_date DATE,
  exam_date DATE NULL,
  current_exam TEXT NULL,
  daily_goal INTEGER DEFAULT 20,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create a trigger to create a profile when a new user signs up via Supabase Auth
CREATE OR REPLACE FUNCTION create_profile_for_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email)
  VALUES (NEW.id, NEW.email);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger the function every time a user is created
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION create_profile_for_user();

-- Blueprint table for learning outcomes
CREATE TABLE IF NOT EXISTS blueprints (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  exam TEXT NOT NULL,  -- SIE, Series 7, CFA L1, etc.
  domain TEXT NOT NULL, -- Main category or section 
  section TEXT NOT NULL, -- Sub-section
  learning_outcome TEXT NOT NULL, -- The specific learning outcome
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Lesson cards
CREATE TABLE IF NOT EXISTS lessons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  blueprint_id UUID REFERENCES blueprints(id),
  title TEXT NOT NULL,
  content TEXT NOT NULL, -- HTML content including LaTeX formulas
  bullet_points JSONB, -- Array of bullet points
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Quiz cards
CREATE TABLE IF NOT EXISTS quizzes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  blueprint_id UUID REFERENCES blueprints(id),
  question TEXT NOT NULL,
  choices JSONB NOT NULL, -- Array of answer choices
  correct_index INTEGER NOT NULL,
  explanation TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Review records for spaced repetition
CREATE TABLE IF NOT EXISTS reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) NOT NULL,
  card_type TEXT NOT NULL, -- 'lesson' or 'quiz'
  card_id UUID NOT NULL, -- either a lesson_id or quiz_id
  ease_factor FLOAT DEFAULT 2.5,
  interval INTEGER DEFAULT 0, -- in days
  repetitions INTEGER DEFAULT 0,
  consecutive_correct_answers INTEGER DEFAULT 0,
  next_review TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_review TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_blueprints_exam ON blueprints(exam);
CREATE INDEX IF NOT EXISTS idx_lessons_blueprint_id ON lessons(blueprint_id);
CREATE INDEX IF NOT EXISTS idx_quizzes_blueprint_id ON quizzes(blueprint_id);
CREATE INDEX IF NOT EXISTS idx_reviews_user_id ON reviews(user_id);
CREATE INDEX IF NOT EXISTS idx_reviews_next_review ON reviews(next_review);

-- RLS Policies
-- Enable RLS on all tables
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE blueprints ENABLE ROW LEVEL SECURITY;
ALTER TABLE lessons ENABLE ROW LEVEL SECURITY;
ALTER TABLE quizzes ENABLE ROW LEVEL SECURITY;
ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;

-- Policy for profiles (users can only see and edit their own profile)
CREATE POLICY profiles_policy ON profiles
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- Policy for blueprints, lessons, and quizzes (any authenticated user can read, only admins can write)
CREATE POLICY blueprints_read_policy ON blueprints
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY lessons_read_policy ON lessons
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY quizzes_read_policy ON quizzes
  FOR SELECT USING (auth.role() = 'authenticated');

-- Policy for reviews (users can only access their own reviews)
CREATE POLICY reviews_policy ON reviews
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid()); 