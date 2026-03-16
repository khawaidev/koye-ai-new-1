-- Project Files Schema for Data Databases (db1, db2, etc.)
-- This schema should be applied to each additional database (db1, db2, db3, etc.)
-- These tables store project files when GitHub is not connected

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ==================== Project Files ====================
-- Stores individual files within a project
CREATE TABLE IF NOT EXISTS project_files (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  "projectId" UUID NOT NULL,
  "userId" UUID NOT NULL,
  path TEXT NOT NULL,
  content TEXT NOT NULL,
  "fileType" TEXT, -- 'code', 'image', 'model', 'video', 'audio', etc.
  "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE("projectId", path) -- Ensure one file per path per project
);

-- ==================== Project File Metadata ====================
-- Stores metadata about project files (for faster queries)
CREATE TABLE IF NOT EXISTS project_file_metadata (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  "projectId" UUID NOT NULL,
  "userId" UUID NOT NULL,
  "fileCount" INTEGER DEFAULT 0,
  "lastUpdated" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  "fileList" JSONB DEFAULT '[]', -- Array of file paths for quick access
  UNIQUE("projectId")
);

-- ==================== Indexes ====================
CREATE INDEX IF NOT EXISTS idx_project_files_project_id ON project_files("projectId");
CREATE INDEX IF NOT EXISTS idx_project_files_user_id ON project_files("userId");
CREATE INDEX IF NOT EXISTS idx_project_files_path ON project_files(path);
CREATE INDEX IF NOT EXISTS idx_project_file_metadata_project_id ON project_file_metadata("projectId");
CREATE INDEX IF NOT EXISTS idx_project_file_metadata_user_id ON project_file_metadata("userId");

-- ==================== Row Level Security ====================
ALTER TABLE project_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_file_metadata ENABLE ROW LEVEL SECURITY;

-- Policies: Users can only access their own project files
DROP POLICY IF EXISTS "Users can manage their own project files" ON project_files;
CREATE POLICY "Users can manage their own project files"
  ON project_files FOR ALL
  USING (true); -- Application-level security: verify userId in app

DROP POLICY IF EXISTS "Users can manage their own project metadata" ON project_file_metadata;
CREATE POLICY "Users can manage their own project metadata"
  ON project_file_metadata FOR ALL
  USING (true); -- Application-level security: verify userId in app

-- ==================== Functions ====================
-- Function to update updatedAt timestamp
CREATE OR REPLACE FUNCTION update_project_file_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW."updatedAt" = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to update updatedAt on project_files
DROP TRIGGER IF EXISTS update_project_files_updated_at ON project_files;
CREATE TRIGGER update_project_files_updated_at
  BEFORE UPDATE ON project_files
  FOR EACH ROW
  EXECUTE FUNCTION update_project_file_updated_at();

-- Function to update project metadata when files change
CREATE OR REPLACE FUNCTION update_project_file_metadata()
RETURNS TRIGGER AS $$
BEGIN
  -- Update or insert metadata
  INSERT INTO project_file_metadata ("projectId", "userId", "fileCount", "lastUpdated", "fileList")
  SELECT 
    NEW."projectId",
    NEW."userId",
    COUNT(*)::INTEGER,
    NOW(),
    COALESCE(jsonb_agg(path ORDER BY path), '[]'::jsonb)
  FROM project_files
  WHERE "projectId" = NEW."projectId"
  ON CONFLICT ("projectId") DO UPDATE SET
    "fileCount" = EXCLUDED."fileCount",
    "lastUpdated" = EXCLUDED."lastUpdated",
    "fileList" = EXCLUDED."fileList";
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to update metadata on insert/update
DROP TRIGGER IF EXISTS update_metadata_on_file_change ON project_files;
CREATE TRIGGER update_metadata_on_file_change
  AFTER INSERT OR UPDATE OR DELETE ON project_files
  FOR EACH ROW
  EXECUTE FUNCTION update_project_file_metadata();

