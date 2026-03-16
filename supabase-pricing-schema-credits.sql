-- Credit-Based Pricing System Schema for KOYE AI
-- This extends the existing pricing schema with credit-based functionality

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ==================== Add Credits to Pricing Plans ====================
-- Add monthly_credits column to pricing_plans
ALTER TABLE public.pricing_plans 
ADD COLUMN IF NOT EXISTS monthly_credits INTEGER NOT NULL DEFAULT 0;

-- ==================== Add Credits to User Subscriptions ====================
-- Add credits_balance column to track remaining credits
ALTER TABLE public.user_subscriptions 
ADD COLUMN IF NOT EXISTS credits_balance INTEGER NOT NULL DEFAULT 0;

-- ==================== Credit Costs Table ====================
-- Store credit costs for different features and options
CREATE TABLE IF NOT EXISTS public.credit_costs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  feature_type TEXT NOT NULL, -- 'image_generation', '3d_model', 'rigging', 'animation', 'video', 'audio', 'game_generation', 'texture'
  sub_type TEXT, -- 'standard', 'hq', 'ultra', 'basic', 'advanced', '720p', '1080p', '4k', etc.
  resolution TEXT, -- '512', '1024', '1536', '720p', '1080p', '4k'
  has_texture BOOLEAN DEFAULT false,
  credits INTEGER NOT NULL,
  description TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create unique index for cost lookups
CREATE UNIQUE INDEX IF NOT EXISTS idx_credit_costs_lookup 
ON public.credit_costs(feature_type, COALESCE(sub_type, ''), COALESCE(resolution, ''), COALESCE(has_texture, false));

-- ==================== Credit Top-ups Table ====================
-- Track credit purchases/top-ups
CREATE TABLE IF NOT EXISTS public.credit_topups (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  credits_purchased INTEGER NOT NULL,
  amount_paid DECIMAL(10, 2) NOT NULL,
  currency TEXT NOT NULL DEFAULT 'USD',
  payment_id TEXT, -- Razorpay payment ID
  payment_status TEXT CHECK (payment_status IN ('pending', 'completed', 'failed', 'refunded')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_credit_topups_user_id ON public.credit_topups(user_id);
CREATE INDEX IF NOT EXISTS idx_credit_topups_payment_id ON public.credit_topups(payment_id);

-- ==================== Update User Usage Table ====================
-- Add credits_consumed column to track credit costs
ALTER TABLE public.user_usage 
ADD COLUMN IF NOT EXISTS credits_consumed INTEGER DEFAULT 0;

-- ==================== Row Level Security for New Tables ====================
ALTER TABLE public.credit_costs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.credit_topups ENABLE ROW LEVEL SECURITY;

-- Credit costs are publicly readable
DROP POLICY IF EXISTS "Credit costs are viewable by everyone" ON public.credit_costs;
CREATE POLICY "Credit costs are viewable by everyone"
  ON public.credit_costs FOR SELECT
  USING (true);

-- Users can view their own top-ups
DROP POLICY IF EXISTS "Users can view their own topups" ON public.credit_topups;
CREATE POLICY "Users can view their own topups"
  ON public.credit_topups FOR SELECT
  USING (auth.uid() = user_id);

-- ==================== Functions ====================

-- Function to get user's credit balance
CREATE OR REPLACE FUNCTION public.get_user_credit_balance(p_user_id UUID)
RETURNS INTEGER AS $$
DECLARE
  credit_balance INTEGER;
BEGIN
  SELECT credits_balance INTO credit_balance
  FROM public.user_subscriptions
  WHERE user_id = p_user_id
    AND (status = 'active' OR status = 'trial')
    AND (expires_at IS NULL OR expires_at > NOW())
  ORDER BY created_at DESC
  LIMIT 1;
  
  RETURN COALESCE(credit_balance, 0);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to deduct credits and log usage
CREATE OR REPLACE FUNCTION public.deduct_user_credits(
  p_user_id UUID,
  p_credits_amount INTEGER,
  p_feature_type TEXT,
  p_metadata JSONB DEFAULT '{}'
)
RETURNS INTEGER AS $$
DECLARE
  current_balance INTEGER;
  new_balance INTEGER;
  current_count INTEGER;
BEGIN
  -- Verify user is authenticated and matches the user_id
  IF auth.uid() IS NULL OR auth.uid() != p_user_id THEN
    RAISE EXCEPTION 'Unauthorized: User can only deduct their own credits';
  END IF;

  -- Get current credit balance
  SELECT credits_balance INTO current_balance
  FROM public.user_subscriptions
  WHERE user_id = p_user_id
    AND (status = 'active' OR status = 'trial')
    AND (expires_at IS NULL OR expires_at > NOW())
  ORDER BY created_at DESC
  LIMIT 1;
  
  current_balance := COALESCE(current_balance, 0);
  
  -- Check if user has enough credits
  IF current_balance < p_credits_amount THEN
    RAISE EXCEPTION 'Insufficient credits. Required: %, Available: %', p_credits_amount, current_balance;
  END IF;
  
  -- Calculate new balance
  new_balance := current_balance - p_credits_amount;
  
  -- Update subscription with new balance
  UPDATE public.user_subscriptions
  SET credits_balance = new_balance,
      updated_at = NOW()
  WHERE user_id = p_user_id
    AND (status = 'active' OR status = 'trial')
    AND (expires_at IS NULL OR expires_at > NOW());
  
  -- Get current usage count for today
  SELECT COALESCE(count, 0) INTO current_count
  FROM public.user_usage
  WHERE user_id = p_user_id
    AND usage_date = CURRENT_DATE
    AND feature_type = p_feature_type;
  
  -- Insert or update usage record
  INSERT INTO public.user_usage (user_id, usage_date, feature_type, count, credits_consumed, metadata)
  VALUES (p_user_id, CURRENT_DATE, p_feature_type, 1, p_credits_amount, p_metadata)
  ON CONFLICT (user_id, usage_date, feature_type)
  DO UPDATE SET 
    count = public.user_usage.count + 1,
    credits_consumed = public.user_usage.credits_consumed + p_credits_amount,
    metadata = p_metadata,
    updated_at = NOW();
  
  RETURN new_balance;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to add credits to user balance
CREATE OR REPLACE FUNCTION public.add_user_credits(
  p_user_id UUID,
  p_credits_amount INTEGER,
  p_source TEXT DEFAULT 'topup'
)
RETURNS INTEGER AS $$
DECLARE
  current_balance INTEGER;
  new_balance INTEGER;
BEGIN
  -- Get current credit balance
  SELECT credits_balance INTO current_balance
  FROM public.user_subscriptions
  WHERE user_id = p_user_id
    AND (status = 'active' OR status = 'trial')
    AND (expires_at IS NULL OR expires_at > NOW())
  ORDER BY created_at DESC
  LIMIT 1;
  
  current_balance := COALESCE(current_balance, 0);
  
  -- Calculate new balance
  new_balance := current_balance + p_credits_amount;
  
  -- Update subscription with new balance
  UPDATE public.user_subscriptions
  SET credits_balance = new_balance,
      updated_at = NOW()
  WHERE user_id = p_user_id
    AND (status = 'active' OR status = 'trial')
    AND (expires_at IS NULL OR expires_at > NOW());
  
  RETURN new_balance;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to reset monthly credits
CREATE OR REPLACE FUNCTION public.reset_monthly_credits(p_user_id UUID)
RETURNS INTEGER AS $$
DECLARE
  plan_credits INTEGER;
BEGIN
  -- Get monthly credits from plan
  SELECT pp.monthly_credits INTO plan_credits
  FROM public.user_subscriptions us
  JOIN public.pricing_plans pp ON us.plan_id = pp.id
  WHERE us.user_id = p_user_id
    AND (us.status = 'active' OR us.status = 'trial')
    AND (us.expires_at IS NULL OR us.expires_at > NOW())
  ORDER BY us.created_at DESC
  LIMIT 1;
  
  plan_credits := COALESCE(plan_credits, 0);
  
  -- Reset credits balance to monthly allowance
  UPDATE public.user_subscriptions
  SET credits_balance = plan_credits,
      updated_at = NOW()
  WHERE user_id = p_user_id
    AND (status = 'active' OR status = 'trial')
    AND (expires_at IS NULL OR expires_at > NOW());
  
  RETURN plan_credits;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop existing functions with old signatures before recreating with new signatures
DROP FUNCTION IF EXISTS public.subscribe_user_to_plan(UUID, UUID);
DROP FUNCTION IF EXISTS public.get_user_subscription(UUID);

-- Update subscribe_user_to_plan to initialize credits
CREATE OR REPLACE FUNCTION public.subscribe_user_to_plan(
  p_user_id UUID,
  p_plan_id UUID
)
RETURNS TABLE (
  subscription_id UUID,
  plan_id UUID,
  plan_name TEXT,
  plan_display_name TEXT,
  status TEXT,
  expires_at TIMESTAMP WITH TIME ZONE,
  limits JSONB,
  credits_balance INTEGER
) AS $$
DECLARE
  v_plan RECORD;
  v_expires_at TIMESTAMP WITH TIME ZONE;
  v_subscription_id UUID;
BEGIN
  -- Verify user is authenticated and matches the user_id
  IF auth.uid() IS NULL OR auth.uid() != p_user_id THEN
    RAISE EXCEPTION 'Unauthorized: User can only subscribe themselves';
  END IF;

  -- Get plan details
  SELECT * INTO v_plan
  FROM public.pricing_plans
  WHERE id = p_plan_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Plan not found';
  END IF;

  -- Calculate expiration date
  IF v_plan.duration_days IS NOT NULL THEN
    v_expires_at := NOW() + (v_plan.duration_days || ' days')::INTERVAL;
  ELSE
    v_expires_at := NULL;
  END IF;

  -- Insert or update subscription with credits
  INSERT INTO public.user_subscriptions (user_id, plan_id, status, expires_at, credits_balance, updated_at)
  VALUES (
    p_user_id,
    p_plan_id,
    CASE WHEN v_plan.duration_days IS NOT NULL THEN 'trial' ELSE 'active' END,
    v_expires_at,
    v_plan.monthly_credits,
    NOW()
  )
  ON CONFLICT (user_id) DO UPDATE SET
    plan_id = p_plan_id,
    status = CASE WHEN v_plan.duration_days IS NOT NULL THEN 'trial' ELSE 'active' END,
    expires_at = v_expires_at,
    credits_balance = v_plan.monthly_credits,
    updated_at = NOW()
  RETURNING id INTO v_subscription_id;

  -- Return subscription details
  RETURN QUERY
  SELECT 
    us.id,
    us.plan_id,
    pp.name,
    pp.display_name,
    us.status,
    us.expires_at,
    pp.limits,
    us.credits_balance
  FROM public.user_subscriptions us
  JOIN public.pricing_plans pp ON us.plan_id = pp.id
  WHERE us.id = v_subscription_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update get_user_subscription to include credits
CREATE OR REPLACE FUNCTION public.get_user_subscription(p_user_id UUID)
RETURNS TABLE (
  subscription_id UUID,
  plan_id UUID,
  plan_name TEXT,
  plan_display_name TEXT,
  status TEXT,
  expires_at TIMESTAMP WITH TIME ZONE,
  limits JSONB,
  credits_balance INTEGER
) AS $$
BEGIN
  -- Verify user is authenticated and matches the user_id
  IF auth.uid() IS NULL OR auth.uid() != p_user_id THEN
    RAISE EXCEPTION 'Unauthorized: User can only view their own subscription';
  END IF;

  RETURN QUERY
  SELECT 
    us.id,
    us.plan_id,
    pp.name,
    pp.display_name,
    us.status,
    us.expires_at,
    pp.limits,
    us.credits_balance
  FROM public.user_subscriptions us
  JOIN public.pricing_plans pp ON us.plan_id = pp.id
  WHERE us.user_id = p_user_id
    AND (us.status = 'active' OR us.status = 'trial')
    AND (us.expires_at IS NULL OR us.expires_at > NOW())
  ORDER BY us.created_at DESC
  LIMIT 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ==================== Insert Credit Costs ====================
-- Image Generation Costs
INSERT INTO public.credit_costs (feature_type, sub_type, resolution, credits, description) VALUES
('image_generation', 'standard', '512-768', 1, 'Standard Image (koye 2d v1)'),
('image_generation', 'hq', '1024-1536', 2, 'High-Quality Image (koye 2d v1.5)'),
('image_generation', 'ultra', '4k', 5, 'Ultra-HD 4K Image (koye 2d v2)')
ON CONFLICT DO NOTHING;

-- 3D Model Generation Costs
INSERT INTO public.credit_costs (feature_type, sub_type, resolution, has_texture, credits, description) VALUES
('3d_model', 'basic', '512', false, 10, '2D → 3D Basic (512, no texture)'),
('3d_model', 'basic', '512', true, 13, '2D → 3D Basic (512, with texture)'),
('3d_model', 'standard', '1024', false, 20, '3D Model Standard (1024, no texture)'),
('3d_model', 'standard', '1024', true, 25, '3D Model Standard (1024, with texture)'),
('3d_model', 'high', '1536', false, 25, '3D Model High-Res (1536, no texture)'),
('3d_model', 'high', '1536', true, 33, '3D Model High-Res (1536, with texture)')
ON CONFLICT DO NOTHING;

-- Texture Only Costs
INSERT INTO public.credit_costs (feature_type, resolution, credits, description) VALUES
('texture', '512', 3, 'Texture only (512)'),
('texture', '1024', 5, 'Texture only (1024)'),
('texture', '1536', 8, 'Texture only (1536)')
ON CONFLICT DO NOTHING;

-- Rigging Costs
INSERT INTO public.credit_costs (feature_type, sub_type, credits, description) VALUES
('rigging', 'basic', 10, 'Basic Auto-Rig (Humanoid)'),
('rigging', 'advanced', 10, 'Advanced Rig (Face + Fingers + IK)')
ON CONFLICT DO NOTHING;

-- Animation Costs
INSERT INTO public.credit_costs (feature_type, resolution, credits, description) VALUES
('animation', '720p', 10, '3D Model Animation 720p'),
('animation', '1080p', 20, '3D Model Animation 1080p'),
('animation', '4k', 50, '3D Model Animation 4K')
ON CONFLICT DO NOTHING;

-- Audio Generation Costs
INSERT INTO public.credit_costs (feature_type, sub_type, credits, description) VALUES
('audio', 'per_second', 1, 'Audio Generation (per second)')
ON CONFLICT DO NOTHING;

-- Video Generation Costs
INSERT INTO public.credit_costs (feature_type, resolution, credits, description) VALUES
('video', '720p', 10, 'Video Generation 720p (per second)'),
('video', '1080p', 20, 'Video Generation 1080p (per second)'),
('video', '4k', 50, 'Video Generation 4K (per second)')
ON CONFLICT DO NOTHING;

-- Game Generation Costs
INSERT INTO public.credit_costs (feature_type, sub_type, credits, description) VALUES
('game_generation', 'prototype_2d', 100, 'Prototype Small Game (2D)'),
('game_generation', 'prototype_3d', 250, 'Prototype 3D Game'),
('game_generation', 'full_small', 500, 'Full Small Game Package')
ON CONFLICT DO NOTHING;

-- ==================== Update Pricing Plans with Credits ====================
-- Update existing plans with monthly credits
UPDATE public.pricing_plans SET monthly_credits = 500 WHERE name = 'FREE';
UPDATE public.pricing_plans SET monthly_credits = 1000 WHERE name = 'PRO_TRIAL';

-- Update existing PRO, PRO_PLUS, ULTRA, STUDIO plans with new prices and credits
UPDATE public.pricing_plans 
SET 
  price_inr = 1299,
  price_usd = 19.99,
  monthly_credits = 3000,
  duration_days = 30,
  description = 'Great for indie developers',
  features = '["3,000 credits/month", "Standard priority", "20GB storage", "Commercial license", "Unity/Unreal helpers"]'::jsonb,
  limits = '{
    "chatMessagesPerDay": -1,
    "priorityQueue": "medium",
    "storageGb": 20,
    "commercialLicense": true
  }'::jsonb
WHERE name = 'PRO';

UPDATE public.pricing_plans 
SET 
  price_inr = 2499,
  price_usd = 34.99,
  monthly_credits = 8000,
  duration_days = 30,
  description = 'For creators who need more',
  features = '["8,000 credits/month", "High priority", "100GB storage", "Commercial license", "Early access features", "AI code generation"]'::jsonb,
  limits = '{
    "chatMessagesPerDay": -1,
    "priorityQueue": "high",
    "storageGb": 100,
    "commercialLicense": true,
    "earlyAccess": true
  }'::jsonb
WHERE name = 'PRO_PLUS';

UPDATE public.pricing_plans 
SET 
  price_inr = 49999,
  price_usd = 999,
  monthly_credits = -1,
  duration_days = NULL,
  description = 'For studios & production houses',
  features = '["Unlimited credits", "Unlimited team seats", "Unlimited storage", "Private endpoint", "SLA", "Dedicated support"]'::jsonb,
  limits = '{
    "chatMessagesPerDay": -1,
    "priorityQueue": "ultra",
    "storageGb": -1,
    "commercialLicense": true,
    "teamMembers": -1,
    "apiAccess": true,
    "privateEndpoint": true,
    "sla": true
  }'::jsonb
WHERE name = 'STUDIO';

-- Insert new INDIE plan
INSERT INTO public.pricing_plans (name, display_name, price_inr, price_usd, monthly_credits, is_one_time, duration_days, description, features, limits) VALUES
(
  'INDIE',
  'Indie',
  299,
  4.99,
  500,
  false,
  30,
  'Best for students',
  '["500 credits/month", "No commercial license", "Community support", "Standard priority", "5GB storage"]'::jsonb,
  '{
    "chatMessagesPerDay": -1,
    "priorityQueue": false,
    "storageGb": 5,
    "commercialLicense": false
  }'::jsonb
)
ON CONFLICT (name) DO UPDATE SET
  price_inr = 299,
  price_usd = 4.99,
  monthly_credits = 500;

-- ==================== Migrate Existing Users ====================
-- Update existing user subscriptions with initial credits based on their plan
UPDATE public.user_subscriptions us
SET credits_balance = pp.monthly_credits
FROM public.pricing_plans pp
WHERE us.plan_id = pp.id
  AND us.credits_balance = 0
  AND (us.status = 'active' OR us.status = 'trial')
  AND (us.expires_at IS NULL OR us.expires_at > NOW());
