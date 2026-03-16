-- Supabase Data Database Schema
-- This schema should be applied to each additional database (db1, db2, db3, etc.)
-- These databases store user-generated content: chats, images, 3D models, jobs

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ==================== Chat Sessions ====================
CREATE TABLE IF NOT EXISTS chat_sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  "userId" UUID NOT NULL,
  title TEXT NOT NULL,
  messages JSONB NOT NULL DEFAULT '[]',
  "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ==================== Images ====================
CREATE TABLE IF NOT EXISTS images (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  "userId" UUID NOT NULL,
  "assetId" UUID,
  view TEXT NOT NULL CHECK (view IN ('front', 'left', 'right', 'back')),
  url TEXT NOT NULL,
  prompt TEXT NOT NULL,
  "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ==================== 3D Models ====================
CREATE TABLE IF NOT EXISTS models (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  "userId" UUID NOT NULL,
  "assetId" UUID,
  url TEXT NOT NULL,
  format TEXT NOT NULL CHECK (format IN ('glb', 'obj', 'fbx')),
  status TEXT NOT NULL CHECK (status IN ('raw', 'textured', 'rigged')),
  "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ==================== Videos ====================
CREATE TABLE IF NOT EXISTS videos (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  "userId" UUID NOT NULL,
  "assetId" UUID,
  url TEXT NOT NULL,
  prompt TEXT,
  "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ==================== Audio ====================
CREATE TABLE IF NOT EXISTS audio (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  "userId" UUID NOT NULL,
  "assetId" UUID,
  url TEXT NOT NULL,
  prompt TEXT,
  "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ==================== Jobs ====================
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

-- ==================== Indexes ====================
CREATE INDEX IF NOT EXISTS idx_chat_sessions_user_id ON chat_sessions("userId");
CREATE INDEX IF NOT EXISTS idx_chat_sessions_updated_at ON chat_sessions("updatedAt");
CREATE INDEX IF NOT EXISTS idx_images_user_id ON images("userId");
CREATE INDEX IF NOT EXISTS idx_images_asset_id ON images("assetId");
CREATE INDEX IF NOT EXISTS idx_models_user_id ON models("userId");
CREATE INDEX IF NOT EXISTS idx_models_asset_id ON models("assetId");
CREATE INDEX IF NOT EXISTS idx_videos_user_id ON videos("userId");
CREATE INDEX IF NOT EXISTS idx_videos_asset_id ON videos("assetId");
CREATE INDEX IF NOT EXISTS idx_audio_user_id ON audio("userId");
CREATE INDEX IF NOT EXISTS idx_audio_asset_id ON audio("assetId");
CREATE INDEX IF NOT EXISTS idx_jobs_user_id ON jobs("userId");
CREATE INDEX IF NOT EXISTS idx_jobs_status ON jobs(status);
CREATE INDEX IF NOT EXISTS idx_jobs_created_at ON jobs("createdAt");

-- ==================== Row Level Security ====================
ALTER TABLE chat_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE images ENABLE ROW LEVEL SECURITY;
ALTER TABLE models ENABLE ROW LEVEL SECURITY;
ALTER TABLE videos ENABLE ROW LEVEL SECURITY;
ALTER TABLE audio ENABLE ROW LEVEL SECURITY;
ALTER TABLE jobs ENABLE ROW LEVEL SECURITY;

-- Policies: Users can only access their own data
-- Note: These databases don't have auth.users, so we rely on userId matching
-- The application should verify the userId matches the authenticated user

-- Drop existing policies if they exist, then create new ones
DROP POLICY IF EXISTS "Users can view their own chat sessions" ON chat_sessions;
CREATE POLICY "Users can view their own chat sessions"
  ON chat_sessions FOR SELECT
  USING (true); -- Application-level security: verify userId in app

DROP POLICY IF EXISTS "Users can create their own chat sessions" ON chat_sessions;
CREATE POLICY "Users can create their own chat sessions"
  ON chat_sessions FOR INSERT
  WITH CHECK (true); -- Application-level security: verify userId in app

DROP POLICY IF EXISTS "Users can update their own chat sessions" ON chat_sessions;
CREATE POLICY "Users can update their own chat sessions"
  ON chat_sessions FOR UPDATE
  USING (true); -- Application-level security: verify userId in app

DROP POLICY IF EXISTS "Users can delete their own chat sessions" ON chat_sessions;
CREATE POLICY "Users can delete their own chat sessions"
  ON chat_sessions FOR DELETE
  USING (true); -- Application-level security: verify userId in app

DROP POLICY IF EXISTS "Users can manage their own images" ON images;
CREATE POLICY "Users can manage their own images"
  ON images FOR ALL
  USING (true); -- Application-level security: verify userId in app

DROP POLICY IF EXISTS "Users can manage their own models" ON models;
CREATE POLICY "Users can manage their own models"
  ON models FOR ALL
  USING (true); -- Application-level security: verify userId in app

DROP POLICY IF EXISTS "Users can manage their own videos" ON videos;
CREATE POLICY "Users can manage their own videos"
  ON videos FOR ALL
  USING (true); -- Application-level security: verify userId in app

DROP POLICY IF EXISTS "Users can manage their own audio" ON audio;
CREATE POLICY "Users can manage their own audio"
  ON audio FOR ALL
  USING (true); -- Application-level security: verify userId in app

DROP POLICY IF EXISTS "Users can manage their own jobs" ON jobs;
CREATE POLICY "Users can manage their own jobs"
  ON jobs FOR ALL
  USING (true); -- Application-level security: verify userId in app

-- ==================== Storage Buckets ====================
-- Create storage buckets for user-generated files
-- These buckets store images, models, videos, and audio files
INSERT INTO storage.buckets (id, name, public)
VALUES ('images', 'images', true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public)
VALUES ('models', 'models', true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public)
VALUES ('videos', 'videos', true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public)
VALUES ('audio', 'audio', true)
ON CONFLICT (id) DO NOTHING;

-- ==================== Storage Policies ====================
-- Storage policies for data databases (application-level security)
-- Note: These databases don't have auth.users, so we allow all operations
-- on storage buckets and rely on application-level security (bucket is public, app verifies userId)

-- Allow all operations on images bucket (no auth check - app verifies userId)
DROP POLICY IF EXISTS "Allow all image operations" ON storage.objects;
CREATE POLICY "Allow all image operations"
  ON storage.objects FOR ALL
  USING (bucket_id = 'images')
  WITH CHECK (bucket_id = 'images');

-- Allow all operations on models bucket (no auth check - app verifies userId)
DROP POLICY IF EXISTS "Allow all model operations" ON storage.objects;
CREATE POLICY "Allow all model operations"
  ON storage.objects FOR ALL
  USING (bucket_id = 'models')
  WITH CHECK (bucket_id = 'models');

-- Allow all operations on videos bucket (no auth check - app verifies userId)
DROP POLICY IF EXISTS "Allow all video operations" ON storage.objects;
CREATE POLICY "Allow all video operations"
  ON storage.objects FOR ALL
  USING (bucket_id = 'videos')
  WITH CHECK (bucket_id = 'videos');

-- Allow all operations on audio bucket (no auth check - app verifies userId)
DROP POLICY IF EXISTS "Allow all audio operations" ON storage.objects;
CREATE POLICY "Allow all audio operations"
  ON storage.objects FOR ALL
  USING (bucket_id = 'audio')
  WITH CHECK (bucket_id = 'audio');

-- ==================== Functions ====================
-- Function to update updatedAt timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW."updatedAt" = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop existing triggers if they exist, then create new ones
DROP TRIGGER IF EXISTS update_chat_sessions_updated_at ON chat_sessions;
CREATE TRIGGER update_chat_sessions_updated_at
  BEFORE UPDATE ON chat_sessions
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_jobs_updated_at ON jobs;
CREATE TRIGGER update_jobs_updated_at
  BEFORE UPDATE ON jobs
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

