-- GitHub Project Sync Schema for DATA DATABASES (db1, db2, etc.)
-- Run this SQL in EACH of your Data Supabase SQL Editors (db1, db2, db3, etc.)
-- This creates the sync tracking table alongside project_files

-- Enable UUID extension (if not already enabled)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ==================== Project Code Files Sync Tracking ====================
-- Tracks which files have been synced to GitHub with their commit SHA
-- This belongs in data DBs because it relates to project_files
CREATE TABLE IF NOT EXISTS project_github_sync (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  "projectId" UUID NOT NULL,
  "filePath" TEXT NOT NULL,
  "githubSha" TEXT NOT NULL,
  "localHash" TEXT NOT NULL,
  "syncedAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE("projectId", "filePath")
);

-- Index for faster sync checks
CREATE INDEX IF NOT EXISTS idx_project_github_sync_project ON project_github_sync("projectId");
CREATE INDEX IF NOT EXISTS idx_project_github_sync_path ON project_github_sync("filePath");

-- Enable RLS
ALTER TABLE project_github_sync ENABLE ROW LEVEL SECURITY;

-- RLS policy - allow all operations (application-level security, same as other data DB tables)
-- The application should verify the userId matches the authenticated user via the project
DROP POLICY IF EXISTS "Allow all sync operations" ON project_github_sync;
CREATE POLICY "Allow all sync operations"
  ON project_github_sync FOR ALL
  USING (true); -- Application-level security: verify via projectId -> userId in app

-- ==================== Function to Update Sync Timestamp ====================
CREATE OR REPLACE FUNCTION update_github_sync_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW."syncedAt" = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to update syncedAt on update
DROP TRIGGER IF EXISTS update_sync_timestamp ON project_github_sync;
CREATE TRIGGER update_sync_timestamp
  BEFORE UPDATE ON project_github_sync
  FOR EACH ROW
  EXECUTE FUNCTION update_github_sync_timestamp();
