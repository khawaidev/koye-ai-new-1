-- Supabase Assets and Projects Schema
-- This schema creates the projects and assets tables needed for the image generation feature
-- Run this SQL in your main Supabase database (not the data databases)

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ==================== Projects Table ====================
CREATE TABLE IF NOT EXISTS projects (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  "userId" UUID NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ==================== Assets Table ====================
CREATE TABLE IF NOT EXISTS assets (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  "projectId" UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('character', 'prop', 'creature')),
  status TEXT NOT NULL CHECK (status IN ('concept', 'images_ready', 'model_ready', 'textured', 'rigged')),
  metadata JSONB DEFAULT '{}',
  "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ==================== Indexes ====================
CREATE INDEX IF NOT EXISTS idx_projects_user_id ON projects("userId");
CREATE INDEX IF NOT EXISTS idx_projects_created_at ON projects("createdAt");
CREATE INDEX IF NOT EXISTS idx_assets_project_id ON assets("projectId");
CREATE INDEX IF NOT EXISTS idx_assets_type ON assets(type);
CREATE INDEX IF NOT EXISTS idx_assets_status ON assets(status);
CREATE INDEX IF NOT EXISTS idx_assets_created_at ON assets("createdAt");

-- ==================== Row Level Security ====================
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE assets ENABLE ROW LEVEL SECURITY;

-- ==================== Policies ====================
-- Drop existing policies if they exist, then create new ones

-- Projects policies
DROP POLICY IF EXISTS "Users can view their own projects" ON projects;
CREATE POLICY "Users can view their own projects"
  ON projects FOR SELECT
  USING (auth.uid() = "userId");

DROP POLICY IF EXISTS "Users can create their own projects" ON projects;
CREATE POLICY "Users can create their own projects"
  ON projects FOR INSERT
  WITH CHECK (auth.uid() = "userId");

DROP POLICY IF EXISTS "Users can update their own projects" ON projects;
CREATE POLICY "Users can update their own projects"
  ON projects FOR UPDATE
  USING (auth.uid() = "userId");

DROP POLICY IF EXISTS "Users can delete their own projects" ON projects;
CREATE POLICY "Users can delete their own projects"
  ON projects FOR DELETE
  USING (auth.uid() = "userId");

-- Assets policies
DROP POLICY IF EXISTS "Users can manage assets in their projects" ON assets;
CREATE POLICY "Users can manage assets in their projects"
  ON assets FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM projects
      WHERE projects.id = assets."projectId"
      AND projects."userId" = auth.uid()
    )
  );

-- ==================== Storage Buckets ====================
-- NOTE: Storage buckets for user-generated images should be created in the DATA DATABASES (db1, db2, etc.)
-- NOT in the main database. 
-- 
-- The main database (this file) only handles:
-- - Projects table
-- - Assets table
--
-- Storage buckets for images/models should be created using supabase-data-db-schema.sql
-- in each data database (db1, db2, db3, etc.)

-- ==================== Comments ====================
COMMENT ON TABLE projects IS 'User projects for organizing game assets';
COMMENT ON TABLE assets IS 'Game assets (characters, props, creatures) belonging to projects';
COMMENT ON COLUMN assets.type IS 'Type of asset: character, prop, or creature';
COMMENT ON COLUMN assets.status IS 'Current status: concept, images_ready, model_ready, textured, or rigged';
COMMENT ON COLUMN assets.metadata IS 'Additional metadata stored as JSON';

