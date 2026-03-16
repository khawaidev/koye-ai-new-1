-- Update plan durations in the database
-- Run this in your Supabase SQL editor to set expiry dates for plans

-- Update PRO_TRIAL to have 7 days duration
UPDATE public.pricing_plans
SET duration_days = 7, is_one_time = true
WHERE name = 'PRO_TRIAL';

-- Update PRO to have 30 days duration (monthly subscription)
UPDATE public.pricing_plans
SET duration_days = 30, is_one_time = false
WHERE name = 'PRO';

-- Update PRO_PLUS to have 30 days duration (monthly subscription)
UPDATE public.pricing_plans
SET duration_days = 30, is_one_time = false
WHERE name = 'PRO_PLUS';

-- Update ULTRA to have 30 days duration (monthly subscription)
UPDATE public.pricing_plans
SET duration_days = 30, is_one_time = false
WHERE name = 'ULTRA';

-- STUDIO remains NULL (unlimited/custom duration)

