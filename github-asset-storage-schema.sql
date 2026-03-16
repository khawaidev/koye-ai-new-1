-- Asset Storage Schema for GitHub-based Storage Policy
-- This creates tables to track assets stored in GitHub

-- ==================== General Assets Table ====================
-- Tracks assets generated outside of projects (Image Gen, 3D Model Gen, etc.)
CREATE TABLE IF NOT EXISTS public.general_assets (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  asset_type TEXT NOT NULL CHECK (asset_type IN ('image', 'model', 'video', 'audio')),
  file_name TEXT NOT NULL,
  github_path TEXT NOT NULL,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for general assets
CREATE INDEX IF NOT EXISTS idx_general_assets_user_id ON public.general_assets(user_id);
CREATE INDEX IF NOT EXISTS idx_general_assets_type ON public.general_assets(asset_type);
CREATE UNIQUE INDEX IF NOT EXISTS idx_general_assets_github_path ON public.general_assets(github_path);

-- ==================== Project Assets Table ====================
-- Tracks assets within projects
CREATE TABLE IF NOT EXISTS public.project_assets (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  asset_type TEXT NOT NULL CHECK (asset_type IN ('image', 'model', 'video', 'audio', 'code', 'other')),
  file_name TEXT NOT NULL,
  file_path TEXT NOT NULL,  -- Relative path within project (e.g., 'assets/images/hero.png')
  github_path TEXT NOT NULL, -- Full GitHub path (e.g., 'projects/{id}/assets/images/{assetId}.png')
  source_asset_id UUID,  -- Reference to general_assets.id if imported from general
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for project assets  
CREATE INDEX IF NOT EXISTS idx_project_assets_project_id ON public.project_assets(project_id);
CREATE INDEX IF NOT EXISTS idx_project_assets_user_id ON public.project_assets(user_id);
CREATE INDEX IF NOT EXISTS idx_project_assets_type ON public.project_assets(asset_type);
CREATE UNIQUE INDEX IF NOT EXISTS idx_project_assets_github_path ON public.project_assets(github_path);
CREATE INDEX IF NOT EXISTS idx_project_assets_source ON public.project_assets(source_asset_id);

-- ==================== Update Projects Table ====================
-- Add GitHub sync info to projects
ALTER TABLE public.projects
ADD COLUMN IF NOT EXISTS github_path TEXT,
ADD COLUMN IF NOT EXISTS github_synced_at TIMESTAMP WITH TIME ZONE;

-- ==================== Row Level Security ====================

-- Enable RLS on new tables
ALTER TABLE public.general_assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_assets ENABLE ROW LEVEL SECURITY;

-- General assets policies
DROP POLICY IF EXISTS "Users can view their own general assets" ON public.general_assets;
CREATE POLICY "Users can view their own general assets"
  ON public.general_assets FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their own general assets" ON public.general_assets;
CREATE POLICY "Users can insert their own general assets"
  ON public.general_assets FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own general assets" ON public.general_assets;
CREATE POLICY "Users can update their own general assets"
  ON public.general_assets FOR UPDATE
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own general assets" ON public.general_assets;
CREATE POLICY "Users can delete their own general assets"
  ON public.general_assets FOR DELETE
  USING (auth.uid() = user_id);

-- Project assets policies
DROP POLICY IF EXISTS "Users can view their own project assets" ON public.project_assets;
CREATE POLICY "Users can view their own project assets"
  ON public.project_assets FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their own project assets" ON public.project_assets;
CREATE POLICY "Users can insert their own project assets"
  ON public.project_assets FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own project assets" ON public.project_assets;
CREATE POLICY "Users can update their own project assets"
  ON public.project_assets FOR UPDATE
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own project assets" ON public.project_assets;
CREATE POLICY "Users can delete their own project assets"
  ON public.project_assets FOR DELETE
  USING (auth.uid() = user_id);

-- ==================== Functions ====================

-- Function to create a general asset record
CREATE OR REPLACE FUNCTION public.create_general_asset(
  p_user_id UUID,
  p_asset_type TEXT,
  p_file_name TEXT,
  p_github_path TEXT,
  p_metadata JSONB DEFAULT '{}'
)
RETURNS UUID AS $$
DECLARE
  v_asset_id UUID;
BEGIN
  IF auth.uid() IS NULL OR auth.uid() != p_user_id THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  INSERT INTO public.general_assets (user_id, asset_type, file_name, github_path, metadata)
  VALUES (p_user_id, p_asset_type, p_file_name, p_github_path, p_metadata)
  RETURNING id INTO v_asset_id;

  RETURN v_asset_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to create a project asset record
CREATE OR REPLACE FUNCTION public.create_project_asset(
  p_project_id UUID,
  p_user_id UUID,
  p_asset_type TEXT,
  p_file_name TEXT,
  p_file_path TEXT,
  p_github_path TEXT,
  p_source_asset_id UUID DEFAULT NULL,
  p_metadata JSONB DEFAULT '{}'
)
RETURNS UUID AS $$
DECLARE
  v_asset_id UUID;
BEGIN
  IF auth.uid() IS NULL OR auth.uid() != p_user_id THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  INSERT INTO public.project_assets (project_id, user_id, asset_type, file_name, file_path, github_path, source_asset_id, metadata)
  VALUES (p_project_id, p_user_id, p_asset_type, p_file_name, p_file_path, p_github_path, p_source_asset_id, p_metadata)
  RETURNING id INTO v_asset_id;

  RETURN v_asset_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to import a general asset to a project
CREATE OR REPLACE FUNCTION public.import_asset_to_project(
  p_general_asset_id UUID,
  p_project_id UUID,
  p_new_github_path TEXT,
  p_file_path TEXT
)
RETURNS UUID AS $$
DECLARE
  v_asset RECORD;
  v_new_asset_id UUID;
BEGIN
  -- Get the general asset
  SELECT * INTO v_asset FROM public.general_assets WHERE id = p_general_asset_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'General asset not found';
  END IF;

  IF auth.uid() IS NULL OR auth.uid() != v_asset.user_id THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  -- Create project asset with reference to source
  INSERT INTO public.project_assets (
    project_id, user_id, asset_type, file_name, file_path, github_path, source_asset_id, metadata
  )
  VALUES (
    p_project_id, v_asset.user_id, v_asset.asset_type, v_asset.file_name, 
    p_file_path, p_new_github_path, p_general_asset_id, v_asset.metadata
  )
  RETURNING id INTO v_new_asset_id;

  RETURN v_new_asset_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to delete a general asset
CREATE OR REPLACE FUNCTION public.delete_general_asset(p_asset_id UUID)
RETURNS TEXT AS $$
DECLARE
  v_github_path TEXT;
BEGIN
  SELECT github_path INTO v_github_path 
  FROM public.general_assets 
  WHERE id = p_asset_id AND user_id = auth.uid();

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Asset not found or unauthorized';
  END IF;

  DELETE FROM public.general_assets WHERE id = p_asset_id;

  RETURN v_github_path;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to delete a project asset
CREATE OR REPLACE FUNCTION public.delete_project_asset(p_asset_id UUID)
RETURNS TEXT AS $$
DECLARE
  v_github_path TEXT;
BEGIN
  SELECT github_path INTO v_github_path 
  FROM public.project_assets 
  WHERE id = p_asset_id AND user_id = auth.uid();

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Asset not found or unauthorized';
  END IF;

  DELETE FROM public.project_assets WHERE id = p_asset_id;

  RETURN v_github_path;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to rename/move a project asset
CREATE OR REPLACE FUNCTION public.rename_project_asset(
  p_asset_id UUID,
  p_new_file_name TEXT,
  p_new_file_path TEXT,
  p_new_github_path TEXT
)
RETURNS TEXT AS $$
DECLARE
  v_old_github_path TEXT;
BEGIN
  SELECT github_path INTO v_old_github_path 
  FROM public.project_assets 
  WHERE id = p_asset_id AND user_id = auth.uid();

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Asset not found or unauthorized';
  END IF;

  UPDATE public.project_assets
  SET file_name = p_new_file_name,
      file_path = p_new_file_path,
      github_path = p_new_github_path,
      updated_at = NOW()
  WHERE id = p_asset_id;

  RETURN v_old_github_path;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
