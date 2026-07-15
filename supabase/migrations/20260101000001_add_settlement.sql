-- Add settlement status column to weeks table
-- This replaces localStorage-based settlement tracking
ALTER TABLE public.weeks ADD COLUMN IF NOT EXISTS is_settled BOOLEAN DEFAULT false;

-- Add DELETE policy for weeks table (needed for restoreSettledWeek)
CREATE POLICY IF NOT EXISTS "Users can delete own archive" ON public.archive
  FOR DELETE USING (auth.uid() = user_id);