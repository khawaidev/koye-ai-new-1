-- Add GitHub Project Sync Columns to Projects Table
-- Run this SQL in your Supabase SQL Editor (Main Database)

-- Add GitHub sync columns to projects table
ALTER TABLE public.projects
ADD COLUMN IF NOT EXISTS "githubRepoId" TEXT,
ADD COLUMN IF NOT EXISTS "githubRepoName" TEXT,
ADD COLUMN IF NOT EXISTS "githubRepoOwner" TEXT,
ADD COLUMN IF NOT EXISTS "githubBranch" TEXT DEFAULT 'main',
ADD COLUMN IF NOT EXISTS "githubSyncEnabled" BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS "githubLastSyncedAt" TIMESTAMP WITH TIME ZONE;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_projects_github_repo ON public.projects("githubRepoId");

-- ==================== GitHub User Connections Table ====================
-- Stores user's GitHub connection details (required for project creation)
CREATE TABLE IF NOT EXISTS public.github_connections (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  "userId" UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  "accessToken" TEXT NOT NULL,
  "refreshToken" TEXT,
  "tokenExpiresAt" TIMESTAMP WITH TIME ZONE,
  "githubUserId" TEXT NOT NULL,
  "githubUsername" TEXT NOT NULL,
  "avatarUrl" TEXT,
  "scopes" TEXT[] DEFAULT '{}',
  "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE("userId")
);

-- Index for faster lookups
CREATE INDEX IF NOT EXISTS idx_github_connections_user_id ON public.github_connections("userId");

-- Enable RLS
ALTER TABLE public.github_connections ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view their own github connection" ON public.github_connections;
DROP POLICY IF EXISTS "Users can insert their own github connection" ON public.github_connections;
DROP POLICY IF EXISTS "Users can update their own github connection" ON public.github_connections;
DROP POLICY IF EXISTS "Users can delete their own github connection" ON public.github_connections;

-- RLS Policies for github_connections
CREATE POLICY "Users can view their own github connection"
  ON public.github_connections FOR SELECT
  USING (auth.uid() = "userId");

CREATE POLICY "Users can insert their own github connection"
  ON public.github_connections FOR INSERT
  WITH CHECK (auth.uid() = "userId");

CREATE POLICY "Users can update their own github connection"
  ON public.github_connections FOR UPDATE
  USING (auth.uid() = "userId");

CREATE POLICY "Users can delete their own github connection"
  ON public.github_connections FOR DELETE
  USING (auth.uid() = "userId");

-- ==================== Project Code Files Sync Tracking ====================
-- Tracks which files have been synced to GitHub with their commit SHA
CREATE TABLE IF NOT EXISTS public.project_github_sync (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  "projectId" UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  "filePath" TEXT NOT NULL,
  "githubSha" TEXT NOT NULL,
  "localHash" TEXT NOT NULL,
  "syncedAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE("projectId", "filePath")
);

-- Index for faster sync checks
CREATE INDEX IF NOT EXISTS idx_project_github_sync_project ON public.project_github_sync("projectId");

-- Enable RLS
ALTER TABLE public.project_github_sync ENABLE ROW LEVEL SECURITY;

-- RLS policy - users can manage sync records for their own projects
DROP POLICY IF EXISTS "Users can manage their project sync records" ON public.project_github_sync;
CREATE POLICY "Users can manage their project sync records"
  ON public.project_github_sync FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.projects 
      WHERE public.projects.id = "projectId" 
      AND public.projects."userId" = auth.uid()
    )
  );

-- ==================== Function to Update Sync Timestamp ====================
CREATE OR REPLACE FUNCTION update_github_sync_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW."syncedAt" = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to update syncedAt on update
DROP TRIGGER IF EXISTS update_sync_timestamp ON public.project_github_sync;
CREATE TRIGGER update_sync_timestamp
  BEFORE UPDATE ON public.project_github_sync
  FOR EACH ROW
  EXECUTE FUNCTION update_github_sync_timestamp();
