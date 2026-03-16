-- GitHub Project Sync Schema for MAIN DATABASE
-- Run this SQL in your MAIN Supabase SQL Editor
-- This adds GitHub sync columns to projects and stores user GitHub connections

-- ==================== Add GitHub Sync Columns to Projects ====================
-- Projects table is in the main database
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
-- This belongs in main DB because it's tied to auth.users
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

-- Function to update updatedAt timestamp
CREATE OR REPLACE FUNCTION update_github_connection_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW."updatedAt" = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to update updatedAt on github_connections
DROP TRIGGER IF EXISTS update_github_connection_timestamp ON public.github_connections;
CREATE TRIGGER update_github_connection_timestamp
  BEFORE UPDATE ON public.github_connections
  FOR EACH ROW
  EXECUTE FUNCTION update_github_connection_updated_at();
