-- Supabase Authentication Setup SQL
-- This file contains SQL for setting up authentication-related tables and policies
-- Note: Supabase automatically creates auth.users table, but you may need to set up additional tables

-- Enable UUID extension (if not already enabled)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create a profiles table to store additional user information
-- This is optional but recommended for storing user metadata
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT,
  full_name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable Row Level Security on profiles
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view their own profile
CREATE POLICY "Users can view own profile"
  ON profiles FOR SELECT
  USING (auth.uid() = id);

-- Policy: Users can update their own profile
CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  USING (auth.uid() = id);

-- Policy: Users can insert their own profile
CREATE POLICY "Users can insert own profile"
  ON profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

-- Function to automatically create a profile when a user signs up
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', '')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to call the function when a new user is created
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Update the existing projects table to reference auth.users properly
-- (This assumes your projects table already exists from supabase-schema.sql)
-- If you need to add a foreign key constraint:
-- ALTER TABLE projects 
--   ADD CONSTRAINT projects_user_id_fkey 
--   FOREIGN KEY ("userId") REFERENCES auth.users(id) ON DELETE CASCADE;

-- Update the existing jobs table to reference auth.users properly
-- ALTER TABLE jobs 
--   ADD CONSTRAINT jobs_user_id_fkey 
--   FOREIGN KEY ("userId") REFERENCES auth.users(id) ON DELETE CASCADE;

-- Create index on profiles email for faster lookups
CREATE INDEX IF NOT EXISTS idx_profiles_email ON profiles(email);

-- Optional: Create a function to get user profile
CREATE OR REPLACE FUNCTION public.get_user_profile(user_id UUID)
RETURNS TABLE (
  id UUID,
  email TEXT,
  full_name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    p.id,
    p.email,
    p.full_name,
    p.avatar_url,
    p.created_at
  FROM public.profiles p
  WHERE p.id = user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant necessary permissions
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT ALL ON public.profiles TO authenticated;

-- Note: Make sure your Supabase project has:
-- 1. Email authentication enabled in Authentication > Providers
-- 2. Email templates configured in Authentication > Email Templates
-- 3. Site URL configured in Authentication > URL Configuration
-- 4. Redirect URLs configured if needed

