-- Pricing Plans and Usage Tracking Schema for KOYE AI
-- This should be run in the MAIN Supabase database (not data dbs)

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ==================== Pricing Plans ====================
CREATE TABLE IF NOT EXISTS public.pricing_plans (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL UNIQUE, -- 'FREE', 'PRO_TRIAL', 'PRO', 'PRO_PLUS', 'ULTRA', 'STUDIO'
  display_name TEXT NOT NULL, -- 'Free', 'Pro Trial', 'Pro', 'Pro Plus', 'Ultra', 'Studio'
  price_inr INTEGER NOT NULL DEFAULT 0, -- Price in Indian Rupees per month
  price_usd DECIMAL(10, 2) NOT NULL DEFAULT 0, -- Price in USD per month
  is_one_time BOOLEAN DEFAULT false, -- For trial plans
  duration_days INTEGER, -- For trial plans (e.g., 7 days)
  description TEXT,
  features JSONB DEFAULT '{}', -- Store plan features as JSON
  limits JSONB DEFAULT '{}', -- Store usage limits as JSON
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ==================== User Subscriptions ====================
CREATE TABLE IF NOT EXISTS public.user_subscriptions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  plan_id UUID NOT NULL REFERENCES public.pricing_plans(id),
  status TEXT NOT NULL CHECK (status IN ('active', 'expired', 'cancelled', 'trial')),
  started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  expires_at TIMESTAMP WITH TIME ZONE, -- NULL for unlimited plans
  cancelled_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id) -- One active subscription per user
);

-- ==================== Usage Tracking ====================
CREATE TABLE IF NOT EXISTS public.user_usage (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  usage_date DATE NOT NULL DEFAULT CURRENT_DATE,
  feature_type TEXT NOT NULL CHECK (feature_type IN ('chat_message', 'image_generation', 'image_to_3d', 'auto_rig', 'animation_generation')),
  count INTEGER NOT NULL DEFAULT 0,
  metadata JSONB DEFAULT '{}', -- Additional metadata (e.g., image model used, 3D quality)
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, usage_date, feature_type) -- One record per user per day per feature
);

-- ==================== Indexes ====================
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_user_id ON public.user_subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_status ON public.user_subscriptions(status);
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_expires_at ON public.user_subscriptions(expires_at);
CREATE INDEX IF NOT EXISTS idx_user_usage_user_id ON public.user_usage(user_id);
CREATE INDEX IF NOT EXISTS idx_user_usage_date ON public.user_usage(usage_date);
CREATE INDEX IF NOT EXISTS idx_user_usage_feature ON public.user_usage(feature_type);

-- ==================== Row Level Security ====================
ALTER TABLE public.pricing_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_usage ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist (for re-running the script)
DROP POLICY IF EXISTS "Pricing plans are viewable by everyone" ON public.pricing_plans;
DROP POLICY IF EXISTS "Users can view their own subscription" ON public.user_subscriptions;
DROP POLICY IF EXISTS "Users can insert their own subscription" ON public.user_subscriptions;
DROP POLICY IF EXISTS "Users can update their own subscription" ON public.user_subscriptions;
DROP POLICY IF EXISTS "Users can view their own usage" ON public.user_usage;
DROP POLICY IF EXISTS "Users can insert their own usage" ON public.user_usage;
DROP POLICY IF EXISTS "Users can update their own usage" ON public.user_usage;

-- Pricing plans are publicly readable
CREATE POLICY "Pricing plans are viewable by everyone"
  ON public.pricing_plans FOR SELECT
  USING (true);

-- Users can view their own subscription
CREATE POLICY "Users can view their own subscription"
  ON public.user_subscriptions FOR SELECT
  USING (auth.uid() = user_id);

-- Users can insert their own subscription
CREATE POLICY "Users can insert their own subscription"
  ON public.user_subscriptions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can update their own subscription
CREATE POLICY "Users can update their own subscription"
  ON public.user_subscriptions FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Users can view their own usage
CREATE POLICY "Users can view their own usage"
  ON public.user_usage FOR SELECT
  USING (auth.uid() = user_id);

-- Users can insert their own usage records
CREATE POLICY "Users can insert their own usage"
  ON public.user_usage FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can update their own usage records
CREATE POLICY "Users can update their own usage"
  ON public.user_usage FOR UPDATE
  USING (auth.uid() = user_id);

-- ==================== Functions ====================

-- Function to get user's current active subscription
CREATE OR REPLACE FUNCTION public.get_user_subscription(p_user_id UUID)
RETURNS TABLE (
  subscription_id UUID,
  plan_id UUID,
  plan_name TEXT,
  plan_display_name TEXT,
  status TEXT,
  expires_at TIMESTAMP WITH TIME ZONE,
  limits JSONB
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
    pp.limits
  FROM public.user_subscriptions us
  JOIN public.pricing_plans pp ON us.plan_id = pp.id
  WHERE us.user_id = p_user_id
    AND (us.status = 'active' OR us.status = 'trial')
    AND (us.expires_at IS NULL OR us.expires_at > NOW())
  ORDER BY us.created_at DESC
  LIMIT 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to subscribe user to a plan (bypasses RLS)
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
  limits JSONB
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

  -- Insert or update subscription
  INSERT INTO public.user_subscriptions (user_id, plan_id, status, expires_at, updated_at)
  VALUES (
    p_user_id,
    p_plan_id,
    CASE WHEN v_plan.duration_days IS NOT NULL THEN 'trial' ELSE 'active' END,
    v_expires_at,
    NOW()
  )
  ON CONFLICT (user_id) DO UPDATE SET
    plan_id = p_plan_id,
    status = CASE WHEN v_plan.duration_days IS NOT NULL THEN 'trial' ELSE 'active' END,
    expires_at = v_expires_at,
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
    pp.limits
  FROM public.user_subscriptions us
  JOIN public.pricing_plans pp ON us.plan_id = pp.id
  WHERE us.id = v_subscription_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get user's usage for today
CREATE OR REPLACE FUNCTION public.get_user_usage_today(p_user_id UUID, p_feature_type TEXT)
RETURNS INTEGER AS $$
DECLARE
  usage_count INTEGER;
BEGIN
  SELECT COALESCE(count, 0) INTO usage_count
  FROM public.user_usage
  WHERE user_id = p_user_id
    AND usage_date = CURRENT_DATE
    AND feature_type = p_feature_type;
  
  RETURN COALESCE(usage_count, 0);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to increment usage
CREATE OR REPLACE FUNCTION public.increment_user_usage(
  p_user_id UUID,
  p_feature_type TEXT,
  p_count INTEGER DEFAULT 1
)
RETURNS INTEGER AS $$
DECLARE
  current_count INTEGER;
  new_count INTEGER;
BEGIN
  -- Verify user is authenticated and matches the user_id
  IF auth.uid() IS NULL OR auth.uid() != p_user_id THEN
    RAISE EXCEPTION 'Unauthorized: User can only update their own usage';
  END IF;

  -- Get current count
  SELECT COALESCE(count, 0) INTO current_count
  FROM public.user_usage
  WHERE user_id = p_user_id
    AND usage_date = CURRENT_DATE
    AND feature_type = p_feature_type;
  
  -- Calculate new count
  new_count := COALESCE(current_count, 0) + p_count;
  
  -- Insert or update
  INSERT INTO public.user_usage (user_id, usage_date, feature_type, count)
  VALUES (p_user_id, CURRENT_DATE, p_feature_type, new_count)
  ON CONFLICT (user_id, usage_date, feature_type)
  DO UPDATE SET 
    count = new_count,
    updated_at = NOW();
  
  RETURN new_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ==================== Insert Default Pricing Plans ====================
INSERT INTO public.pricing_plans (name, display_name, price_inr, price_usd, is_one_time, duration_days, description, features, limits) VALUES
(
  'FREE',
  'Free',
  0,
  0,
  false,
  NULL,
  'Best for casual users.',
  '["20 AI chat messages/day", "5 image generations/day (koye-2dv1)", "1 image→3D per week (1024p, koye-3d)", "1 auto-rig/week", "No priority queue", "Community support"]'::jsonb,
  '{
    "chatMessagesPerDay": 20,
    "imageGenerationsPerDayKoye2dv1": 5,
    "imageTo3dPerWeek": 1,
    "autoRigPerWeek": 1,
    "priorityQueue": false,
    "storageGb": 0
  }'::jsonb
),
(
  'PRO_TRIAL',
  'Pro Trial',
  199,
  3.99,
  true,
  7,
  'Full PRO access for 7 days.',
  '["Unlimited chat (10 req/min cap)", "20 image generations/day", "5 × 2D→3D/day (hitem3d)", "Basic auto-rigging", "Medium priority queue", "No watermark", "Unity/Unreal export templates"]'::jsonb,
  '{
    "chatMessagesPerDay": -1,
    "chatRateLimitPerMin": 10,
    "imageGenerationsPerDayKoye2dv1": 20,
    "imageTo3dPerDay": 5,
    "autoRigPerDay": -1,
    "priorityQueue": "medium",
    "storageGb": 0,
    "durationDays": 7
  }'::jsonb
) ON CONFLICT (name) DO UPDATE SET duration_days = 7, is_one_time = true;

INSERT INTO public.pricing_plans (name, display_name, price_inr, price_usd, is_one_time, duration_days, description, features, limits) VALUES
(
  'PRO',
  'Pro',
  999,
  14.99,
  false,
  30,
  'Great for indie developers.',
  '["Unlimited chat (10 req/min cap)", "Image gen: 50/day with koye-2dv2, 100/day with koye-2dv1", "10 × 2D→3D/day", "Full auto-rigging (humanoid + fingers + knees + spine)", "720p animation generation", "Priority processing", "20GB storage", "Unity/Unreal helpers", "Full commercial license"]'::jsonb,
  '{
    "chatMessagesPerDay": -1,
    "chatRateLimitPerMin": 10,
    "imageGenerationsPerDayKoye2dv2": 50,
    "imageGenerationsPerDayKoye2dv1": 100,
    "imageTo3dPerDay": 10,
    "autoRigPerDay": -1,
    "animationGenerationQuality": "720p",
    "priorityQueue": "high",
    "storageGb": 20,
    "commercialLicense": true
  }'::jsonb
),
(
  'PRO_PLUS',
  'Pro Plus',
  1999,
  29.99,
  false,
  30,
  'For creators who need more and faster.',
  '["Everything in PRO", "Higher image limits: 150/day with koye-2dv2, 300/day with koye-2dv1", "20 × 2D→3D/day", "Advanced rigging (chin, groin, fingers+, better skin weights)", "1080p animation generation", "High priority queue", "100GB cloud storage", "Early-access features", "AI Unity/Unreal code-generation", "Custom export presets (FBX/glTF/LOD packs)"]'::jsonb,
  '{
    "chatMessagesPerDay": -1,
    "chatRateLimitPerMin": 10,
    "imageGenerationsPerDayKoye2dv2": 150,
    "imageGenerationsPerDayKoye2dv1": 300,
    "imageTo3dPerDay": 20,
    "autoRigPerDay": -1,
    "animationGenerationQuality": "1080p",
    "priorityQueue": "high",
    "storageGb": 100,
    "commercialLicense": true,
    "earlyAccess": true
  }'::jsonb
),
(
  'ULTRA',
  'Ultra',
  4999,
  69.99,
  false,
  30,
  'For serious devs and micro-studios.',
  '["Everything in PRO_PLUS", "Unlimited image generations via koye-2dv1 (FUP applies)", "500/day with koye-2dv2", "Unlimited 2D→3D conversions", "Studio-grade rigging with blendshapes", "4K animation generation", "Dedicated GPU queue (ultra priority)", "500GB storage", "Multiplayer asset pipeline", "5 team members included", "AI scene builder", "AI gameplay scripting", "API Access"]'::jsonb,
  '{
    "chatMessagesPerDay": -1,
    "chatRateLimitPerMin": 10,
    "imageGenerationsPerDayKoye2dv2": 500,
    "imageGenerationsPerDayKoye2dv1": -1,
    "imageTo3dPerDay": -1,
    "autoRigPerDay": -1,
    "animationGenerationQuality": "4K",
    "priorityQueue": "ultra",
    "storageGb": 500,
    "commercialLicense": true,
    "earlyAccess": true,
    "teamMembers": 5,
    "apiAccess": true
  }'::jsonb
),
(
  'STUDIO',
  'Studio',
  49999,
  999,
  false,
  NULL,
  'For studios & production houses.',
  '["Everything in ULTRA", "Unlimited team seats", "Unlimited storage", "Style-tuned model fine-tuning", "Private inference endpoint", "Guaranteed turnaround (SLA)", "Artist-quality manual review", "Creature/mech/complex rig templates", "On-premise or private cloud deployment", "Dedicated support engineer"]'::jsonb,
  '{
    "chatMessagesPerDay": -1,
    "chatRateLimitPerMin": 10,
    "imageGenerationsPerDayKoye2dv2": -1,
    "imageGenerationsPerDayKoye2dv1": -1,
    "imageTo3dPerDay": -1,
    "autoRigPerDay": -1,
    "animationGenerationQuality": "4K",
    "priorityQueue": "ultra",
    "storageGb": -1,
    "commercialLicense": true,
    "earlyAccess": true,
    "teamMembers": -1,
    "apiAccess": true,
    "privateEndpoint": true,
    "sla": true
  }'::jsonb
) ON CONFLICT (name) DO NOTHING;

-- ==================== Trigger to auto-assign FREE plan to new users ====================
CREATE OR REPLACE FUNCTION public.assign_free_plan_to_new_user()
RETURNS TRIGGER AS $$
DECLARE
  free_plan_id UUID;
BEGIN
  -- Get FREE plan ID
  SELECT id INTO free_plan_id
  FROM public.pricing_plans
  WHERE name = 'FREE'
  LIMIT 1;
  
  -- Assign FREE plan to new user
  IF free_plan_id IS NOT NULL THEN
    INSERT INTO public.user_subscriptions (user_id, plan_id, status)
    VALUES (NEW.id, free_plan_id, 'active')
    ON CONFLICT (user_id) DO NOTHING;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created_assign_plan ON auth.users;
CREATE TRIGGER on_auth_user_created_assign_plan
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.assign_free_plan_to_new_user();

