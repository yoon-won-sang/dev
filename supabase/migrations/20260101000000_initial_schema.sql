-- Habit Tracker Database Schema
-- Run this in Supabase SQL Editor

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users table (extends Supabase auth.users)
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID REFERENCES auth.users(id) PRIMARY KEY,
  role TEXT NOT NULL CHECK (role IN ('child', 'parent')),
  display_name TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Weekly habit data
CREATE TABLE IF NOT EXISTS public.weeks (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) NOT NULL,
  week_id TEXT NOT NULL, -- e.g., "2026-W28"
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  days JSONB NOT NULL, -- {월: [...], 화: [...], ...}
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, week_id)
);

-- Archive history for settled weeks
CREATE TABLE IF NOT EXISTS public.archive (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) NOT NULL,
  week_id TEXT NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  score INTEGER NOT NULL,
  grade TEXT NOT NULL,
  reward INTEGER NOT NULL,
  approved_count INTEGER NOT NULL,
  total_count INTEGER NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, week_id)
);

-- Enable Row Level Security
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.weeks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.archive ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view own profile" ON public.profiles
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON public.profiles
  FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Users can insert own week data" ON public.weeks
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view own week data" ON public.weeks
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can update own week data" ON public.weeks
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can view own archive" ON public.archive
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own archive" ON public.archive
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own archive" ON public.archive
  FOR DELETE USING (auth.uid() = user_id);

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, role, display_name)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'role', 'child'),
    NEW.raw_user_meta_data->>'display_name'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Realtime publication
ALTER PUBLICATION supabase_realtime ADD TABLE public.weeks;
ALTER PUBLICATION supabase_realtime ADD TABLE public.archive;