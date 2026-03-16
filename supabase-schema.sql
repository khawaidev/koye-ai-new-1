-- Supabase Database Schema for GameForge AI

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Projects table
CREATE TABLE IF NOT EXISTS projects (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  "userId" UUID NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Assets table
CREATE TABLE IF NOT EXISTS assets (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  "projectId" UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('character', 'prop', 'creature')),
  status TEXT NOT NULL CHECK (status IN ('concept', 'images_ready', 'model_ready', 'textured', 'rigged')),
  metadata JSONB DEFAULT '{}',
  "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Images table
CREATE TABLE IF NOT EXISTS images (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  "assetId" UUID NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
  view TEXT NOT NULL CHECK (view IN ('front', 'left', 'right', 'back')),
  url TEXT NOT NULL,
  prompt TEXT NOT NULL,
  "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Models table
CREATE TABLE IF NOT EXISTS models (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  "assetId" UUID NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  format TEXT NOT NULL CHECK (format IN ('glb', 'obj', 'fbx')),
  status TEXT NOT NULL CHECK (status IN ('raw', 'textured', 'rigged')),
  "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Jobs table (for tracking async operations)
CREATE TABLE IF NOT EXISTS jobs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  "userId" UUID NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('image_generation', 'model_generation', 'texture_generation', 'rigging')),
  status TEXT NOT NULL CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  progress INTEGER DEFAULT 0,
  result JSONB,
  error TEXT,
  "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_projects_user_id ON projects("userId");
CREATE INDEX IF NOT EXISTS idx_assets_project_id ON assets("projectId");
CREATE INDEX IF NOT EXISTS idx_images_asset_id ON images("assetId");
CREATE INDEX IF NOT EXISTS idx_models_asset_id ON models("assetId");
CREATE INDEX IF NOT EXISTS idx_jobs_user_id ON jobs("userId");
CREATE INDEX IF NOT EXISTS idx_jobs_status ON jobs(status);

-- Create storage buckets
INSERT INTO storage.buckets (id, name, public)
VALUES ('assets', 'assets', true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public)
VALUES ('models', 'models', true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public)
VALUES ('images', 'images', true)
ON CONFLICT (id) DO NOTHING;

-- Row Level Security (RLS) policies
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE images ENABLE ROW LEVEL SECURITY;
ALTER TABLE models ENABLE ROW LEVEL SECURITY;
ALTER TABLE jobs ENABLE ROW LEVEL SECURITY;

-- Policies: Users can only access their own data
CREATE POLICY "Users can view their own projects"
  ON projects FOR SELECT
  USING (auth.uid() = "userId");

CREATE POLICY "Users can create their own projects"
  ON projects FOR INSERT
  WITH CHECK (auth.uid() = "userId");

CREATE POLICY "Users can update their own projects"
  ON projects FOR UPDATE
  USING (auth.uid() = "userId");

CREATE POLICY "Users can delete their own projects"
  ON projects FOR DELETE
  USING (auth.uid() = "userId");

-- Similar policies for other tables
CREATE POLICY "Users can manage assets in their projects"
  ON assets FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM projects
      WHERE projects.id = assets."projectId"
      AND projects."userId" = auth.uid()
    )
  );

CREATE POLICY "Users can manage images for their assets"
  ON images FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM assets
      JOIN projects ON projects.id = assets."projectId"
      WHERE assets.id = images."assetId"
      AND projects."userId" = auth.uid()
    )
  );

CREATE POLICY "Users can manage models for their assets"
  ON models FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM assets
      JOIN projects ON projects.id = assets."projectId"
      WHERE assets.id = models."assetId"
      AND projects."userId" = auth.uid()
    )
  );

CREATE POLICY "Users can manage their own jobs"
  ON jobs FOR ALL
  USING (auth.uid() = "userId");

