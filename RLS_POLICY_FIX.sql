-- Fix RLS Policies for user_subscriptions table
-- Run this in your Supabase SQL editor to fix the subscription creation issue

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Pricing plans are viewable by everyone" ON public.pricing_plans;
DROP POLICY IF EXISTS "Users can view their own subscription" ON public.user_subscriptions;
DROP POLICY IF EXISTS "Users can insert their own subscription" ON public.user_subscriptions;
DROP POLICY IF EXISTS "Users can update their own subscription" ON public.user_subscriptions;
DROP POLICY IF EXISTS "Users can view their own usage" ON public.user_usage;
DROP POLICY IF EXISTS "Users can insert their own usage" ON public.user_usage;
DROP POLICY IF EXISTS "Users can update their own usage" ON public.user_usage;

-- Create comprehensive policies
CREATE POLICY "Pricing plans are viewable by everyone"
  ON public.pricing_plans FOR SELECT
  USING (true);

CREATE POLICY "Users can view their own subscription"
  ON public.user_subscriptions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own subscription"
  ON public.user_subscriptions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own subscription"
  ON public.user_subscriptions FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view their own usage"
  ON public.user_usage FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own usage"
  ON public.user_usage FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own usage"
  ON public.user_usage FOR UPDATE
  USING (auth.uid() = user_id);

-- Update get_user_subscription function to include 'trial' status
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

-- Create function to subscribe user to a plan (bypasses RLS)
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

