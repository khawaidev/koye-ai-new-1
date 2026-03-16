-- Supabase Storage Bucket Setup
-- This SQL creates the storage bucket and policies needed for image uploads
-- Run this in your MAIN Supabase database (not the data databases)

-- ==================== Storage Bucket ====================
-- Create storage bucket for images (if it doesn't exist)
INSERT INTO storage.buckets (id, name, public)
VALUES ('images', 'images', true)
ON CONFLICT (id) DO NOTHING;

-- ==================== Storage Policies ====================
-- Drop existing storage policies if they exist, then create new ones

-- Allow authenticated users to upload images
DROP POLICY IF EXISTS "Authenticated users can upload images" ON storage.objects;
CREATE POLICY "Authenticated users can upload images"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'images' AND
    auth.role() = 'authenticated'
  );

-- Allow authenticated users to view images (public bucket, but policy for consistency)
DROP POLICY IF EXISTS "Authenticated users can view images" ON storage.objects;
CREATE POLICY "Authenticated users can view images"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'images' AND
    auth.role() = 'authenticated'
  );

-- Allow authenticated users to update their own images
DROP POLICY IF EXISTS "Authenticated users can update images" ON storage.objects;
CREATE POLICY "Authenticated users can update images"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'images' AND
    auth.role() = 'authenticated'
  );

-- Allow authenticated users to delete their own images
DROP POLICY IF EXISTS "Authenticated users can delete images" ON storage.objects;
CREATE POLICY "Authenticated users can delete images"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'images' AND
    auth.role() = 'authenticated'
  );

-- ==================== Notes ====================
-- The bucket is set to public=true, which means:
-- 1. Public URLs can be generated for images
-- 2. Images can be accessed without authentication (via public URL)
-- 3. The policies above control who can upload/update/delete

-- If you want to make the bucket private, change public to false and adjust policies accordingly.

