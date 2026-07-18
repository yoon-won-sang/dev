-- Parent-Child Relationship Management
-- This allows parents to view their children's habit data

-- Create parent-child relationship table
CREATE TABLE IF NOT EXISTS public.parent_child_relations (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  parent_id UUID REFERENCES auth.users(id) NOT NULL,
  child_id UUID REFERENCES auth.users(id) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(parent_id, child_id)
);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_parent_child_relations_parent 
  ON public.parent_child_relations(parent_id);
CREATE INDEX IF NOT EXISTS idx_parent_child_relations_child 
  ON public.parent_child_relations(child_id);

-- Enable RLS on the new table
ALTER TABLE public.parent_child_relations ENABLE ROW LEVEL SECURITY;

-- RLS Policies for parent_child_relations
-- Parents can view their own children
CREATE POLICY "Parents can view their children" ON public.parent_child_relations
  FOR SELECT USING (auth.uid() = parent_id);

-- Parents can add children
CREATE POLICY "Parents can add children" ON public.parent_child_relations
  FOR INSERT WITH CHECK (auth.uid() = parent_id);

-- Parents can remove children
CREATE POLICY "Parents can remove children" ON public.parent_child_relations
  FOR DELETE USING (auth.uid() = parent_id);

-- Children can view their parents
CREATE POLICY "Children can view their parents" ON public.parent_child_relations
  FOR SELECT USING (auth.uid() = child_id);

-- Update profiles RLS policies to allow parents to view their children's profiles
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;

CREATE POLICY "Users can view own profile" ON public.profiles
  FOR SELECT USING (
    auth.uid() = id 
    OR 
    auth.uid() IN (
      SELECT parent_id 
      FROM public.parent_child_relations 
      WHERE child_id = profiles.id
    )
  );

-- Update weeks RLS policies to allow parents to view children's data
DROP POLICY IF EXISTS "Users can view own week data" ON public.weeks;

CREATE POLICY "Users can view own week data" ON public.weeks
  FOR SELECT USING (
    auth.uid() = user_id 
    OR 
    auth.uid() IN (
      SELECT parent_id 
      FROM public.parent_child_relations 
      WHERE child_id = weeks.user_id
    )
  );

-- Keep other policies the same
CREATE POLICY "Users can insert own week data" ON public.weeks
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own week data" ON public.weeks
  FOR UPDATE USING (auth.uid() = user_id);

-- Update archive RLS policies to allow parents to view children's data
DROP POLICY IF EXISTS "Users can view own archive" ON public.archive;

CREATE POLICY "Users can view own archive" ON public.archive
  FOR SELECT USING (
    auth.uid() = user_id 
    OR 
    auth.uid() IN (
      SELECT parent_id 
      FROM public.parent_child_relations 
      WHERE child_id = archive.user_id
    )
  );

-- Keep other policies the same
CREATE POLICY "Users can insert own archive" ON public.archive
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own archive" ON public.archive
  FOR DELETE USING (auth.uid() = user_id);

-- Helper function to check if user is parent of another user
CREATE OR REPLACE FUNCTION public.is_parent_of(child_user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 
    FROM public.parent_child_relations 
    WHERE parent_id = auth.uid() 
    AND child_id = child_user_id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Helper function to get children list for a parent
CREATE OR REPLACE FUNCTION public.get_children()
RETURNS TABLE (
  id UUID,
  display_name TEXT,
  email TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    p.id,
    p.display_name,
    u.email::TEXT
  FROM public.profiles p
  JOIN auth.users u ON u.id = p.id
  JOIN public.parent_child_relations pcr ON pcr.child_id = p.id
  WHERE pcr.parent_id = auth.uid()
  AND p.role = 'child'
  ORDER BY p.display_name;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Helper function to find user by email (replaces admin.listUsers)
CREATE OR REPLACE FUNCTION public.find_user_by_email(email_to_find TEXT)
RETURNS TABLE (
  id UUID,
  email TEXT,
  raw_user_meta_data JSONB
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    u.id,
    u.email::TEXT,
    u.raw_user_meta_data
  FROM auth.users u
  WHERE u.email = email_to_find;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Helper function to get all available children (not yet linked to parent)
CREATE OR REPLACE FUNCTION public.get_available_children()
RETURNS TABLE (
  id UUID,
  display_name TEXT,
  email TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    p.id,
    p.display_name,
    u.email::TEXT
  FROM public.profiles p
  JOIN auth.users u ON u.id = p.id
  WHERE p.role = 'child'
  AND p.id NOT IN (
    SELECT child_id 
    FROM public.parent_child_relations 
    WHERE parent_id = auth.uid()
  )
  ORDER BY p.display_name;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
