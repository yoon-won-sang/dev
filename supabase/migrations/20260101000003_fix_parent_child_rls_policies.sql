-- Fix RLS policies to allow parents to update their children's data
-- This fixes the "new row violates row-level security policy" error

-- Update weeks INSERT policy to allow parents to insert for their children
DROP POLICY IF EXISTS "Users can insert own week data" ON public.weeks;

CREATE POLICY "Users can insert own week data" ON public.weeks
  FOR INSERT WITH CHECK (
    auth.uid() = user_id 
    OR 
    is_parent_of(user_id)
  );

-- Update weeks UPDATE policy to allow parents to update their children's data
DROP POLICY IF EXISTS "Users can update own week data" ON public.weeks;

CREATE POLICY "Users can update own week data" ON public.weeks
  FOR UPDATE USING (
    auth.uid() = user_id 
    OR 
    is_parent_of(user_id)
  );

-- Update archive INSERT policy to allow parents to insert for their children
DROP POLICY IF EXISTS "Users can insert own archive" ON public.archive;

CREATE POLICY "Users can insert own archive" ON public.archive
  FOR INSERT WITH CHECK (
    auth.uid() = user_id 
    OR 
    is_parent_of(user_id)
  );

-- Update archive DELETE policy to allow parents to delete their children's data
DROP POLICY IF EXISTS "Users can delete own archive" ON public.archive;

CREATE POLICY "Users can delete own archive" ON public.archive
  FOR DELETE USING (
    auth.uid() = user_id 
    OR 
    is_parent_of(user_id)
  );