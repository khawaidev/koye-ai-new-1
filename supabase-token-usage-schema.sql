-- Token Usage Tracking Schema for KOYE AI
-- This tracks AI chat token usage (input + output) for users

-- Enable UUID extension (should already be enabled)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ==================== User Token Usage Table ====================
-- Store daily token usage per user
CREATE TABLE IF NOT EXISTS public.user_token_usage (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  usage_date DATE NOT NULL DEFAULT CURRENT_DATE,
  input_tokens INTEGER NOT NULL DEFAULT 0,
  output_tokens INTEGER NOT NULL DEFAULT 0,
  total_tokens INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Unique constraint to allow upsert on user_id + usage_date
  CONSTRAINT user_token_usage_unique UNIQUE (user_id, usage_date)
);

-- Create indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_user_token_usage_user_id ON public.user_token_usage(user_id);
CREATE INDEX IF NOT EXISTS idx_user_token_usage_date ON public.user_token_usage(usage_date);
CREATE INDEX IF NOT EXISTS idx_user_token_usage_user_date ON public.user_token_usage(user_id, usage_date);

-- ==================== Row Level Security ====================
ALTER TABLE public.user_token_usage ENABLE ROW LEVEL SECURITY;

-- Users can view their own token usage
DROP POLICY IF EXISTS "Users can view their own token usage" ON public.user_token_usage;
CREATE POLICY "Users can view their own token usage"
  ON public.user_token_usage FOR SELECT
  USING (auth.uid() = user_id);

-- Users can insert their own token usage
DROP POLICY IF EXISTS "Users can insert their own token usage" ON public.user_token_usage;
CREATE POLICY "Users can insert their own token usage"
  ON public.user_token_usage FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can update their own token usage
DROP POLICY IF EXISTS "Users can update their own token usage" ON public.user_token_usage;
CREATE POLICY "Users can update their own token usage"
  ON public.user_token_usage FOR UPDATE
  USING (auth.uid() = user_id);

-- ==================== Functions ====================

-- Function to increment token usage (adds to existing record)
CREATE OR REPLACE FUNCTION public.increment_token_usage(
  p_user_id UUID,
  p_input_tokens INTEGER,
  p_output_tokens INTEGER
)
RETURNS VOID AS $$
DECLARE
  v_today DATE := CURRENT_DATE;
BEGIN
  -- Verify user is authenticated and matches the user_id
  IF auth.uid() IS NULL OR auth.uid() != p_user_id THEN
    RAISE EXCEPTION 'Unauthorized: User can only update their own token usage';
  END IF;

  -- Insert or update token usage for today
  INSERT INTO public.user_token_usage (user_id, usage_date, input_tokens, output_tokens, total_tokens, updated_at)
  VALUES (p_user_id, v_today, p_input_tokens, p_output_tokens, p_input_tokens + p_output_tokens, NOW())
  ON CONFLICT (user_id, usage_date)
  DO UPDATE SET
    input_tokens = public.user_token_usage.input_tokens + p_input_tokens,
    output_tokens = public.user_token_usage.output_tokens + p_output_tokens,
    total_tokens = public.user_token_usage.total_tokens + p_input_tokens + p_output_tokens,
    updated_at = NOW();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get user's token usage summary
CREATE OR REPLACE FUNCTION public.get_user_token_summary(p_user_id UUID)
RETURNS TABLE (
  today_input_tokens BIGINT,
  today_output_tokens BIGINT,
  today_total_tokens BIGINT,
  monthly_input_tokens BIGINT,
  monthly_output_tokens BIGINT,
  monthly_total_tokens BIGINT,
  all_time_input_tokens BIGINT,
  all_time_output_tokens BIGINT,
  all_time_total_tokens BIGINT
) AS $$
DECLARE
  v_today DATE := CURRENT_DATE;
  v_month_start DATE := DATE_TRUNC('month', CURRENT_DATE);
BEGIN
  -- Verify user is authenticated and matches the user_id
  IF auth.uid() IS NULL OR auth.uid() != p_user_id THEN
    RAISE EXCEPTION 'Unauthorized: User can only view their own token usage';
  END IF;

  RETURN QUERY
  SELECT
    -- Today's usage
    COALESCE(SUM(CASE WHEN usage_date = v_today THEN input_tokens ELSE 0 END), 0)::BIGINT,
    COALESCE(SUM(CASE WHEN usage_date = v_today THEN output_tokens ELSE 0 END), 0)::BIGINT,
    COALESCE(SUM(CASE WHEN usage_date = v_today THEN total_tokens ELSE 0 END), 0)::BIGINT,
    -- Monthly usage
    COALESCE(SUM(CASE WHEN usage_date >= v_month_start THEN input_tokens ELSE 0 END), 0)::BIGINT,
    COALESCE(SUM(CASE WHEN usage_date >= v_month_start THEN output_tokens ELSE 0 END), 0)::BIGINT,
    COALESCE(SUM(CASE WHEN usage_date >= v_month_start THEN total_tokens ELSE 0 END), 0)::BIGINT,
    -- All-time usage
    COALESCE(SUM(input_tokens), 0)::BIGINT,
    COALESCE(SUM(output_tokens), 0)::BIGINT,
    COALESCE(SUM(total_tokens), 0)::BIGINT
  FROM public.user_token_usage
  WHERE user_id = p_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permissions on functions
GRANT EXECUTE ON FUNCTION public.increment_token_usage(UUID, INTEGER, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_token_summary(UUID) TO authenticated;
