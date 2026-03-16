-- Update Pricing Plans with New Credit Allocations
-- Free: 200 credits
-- Pro: 500 credits  
-- Pro Plus: 3,000 credits
-- Ultra: 8,000 credits
-- Custom: Unlimited (with FUP)

-- Update FREE plan
UPDATE public.pricing_plans 
SET 
  monthly_credits = 200,
  features = '[
    "200 credits/month",
    "Basic AI chat",
    "Standard image generation",
    "Community support",
    "2GB storage"
  ]'::jsonb,
  limits = '{
    "chatMessagesPerDay": 50,
    "priorityQueue": false,
    "storageGb": 2,
    "commercialLicense": false
  }'::jsonb
WHERE name = 'FREE';

-- Update PRO plan
UPDATE public.pricing_plans 
SET 
  monthly_credits = 500,
  price_inr = 499,
  price_usd = 5.99,
  duration_days = 30,
  description = 'Perfect for indie developers',
  features = '[
    "500 credits/month",
    "Unlimited AI chat",
    "All image models",
    "Basic 3D model generation",
    "Email support",
    "10GB storage",
    "Commercial license"
  ]'::jsonb,
  limits = '{
    "chatMessagesPerDay": -1,
    "priorityQueue": "standard",
    "storageGb": 10,
    "commercialLicense": true
  }'::jsonb
WHERE name = 'PRO';

-- Update or Insert PRO_PLUS plan
INSERT INTO public.pricing_plans (name, display_name, price_inr, price_usd, monthly_credits, is_one_time, duration_days, description, features, limits) VALUES
(
  'PRO_PLUS',
  'Pro Plus',
  1499,
  19.99,
  3000,
  false,
  30,
  'For serious creators',
  '[
    "3,000 credits/month",
    "Unlimited AI chat",
    "All image models (priority)",
    "Advanced 3D model generation",
    "Video generation",
    "Audio generation",
    "Priority support",
    "50GB storage",
    "Commercial license",
    "Early access features"
  ]'::jsonb,
  '{
    "chatMessagesPerDay": -1,
    "priorityQueue": "high",
    "storageGb": 50,
    "commercialLicense": true,
    "earlyAccess": true
  }'::jsonb
)
ON CONFLICT (name) DO UPDATE SET
  display_name = 'Pro Plus',
  price_inr = 1499,
  price_usd = 19.99,
  monthly_credits = 3000,
  duration_days = 30,
  description = 'For serious creators',
  features = '[
    "3,000 credits/month",
    "Unlimited AI chat",
    "All image models (priority)",
    "Advanced 3D model generation",
    "Video generation",
    "Audio generation",
    "Priority support",
    "50GB storage",
    "Commercial license",
    "Early access features"
  ]'::jsonb,
  limits = '{
    "chatMessagesPerDay": -1,
    "priorityQueue": "high",
    "storageGb": 50,
    "commercialLicense": true,
    "earlyAccess": true
  }'::jsonb;

-- Update or Insert ULTRA plan
INSERT INTO public.pricing_plans (name, display_name, price_inr, price_usd, monthly_credits, is_one_time, duration_days, description, features, limits) VALUES
(
  'ULTRA',
  'Ultra',
  3999,
  49.99,
  8000,
  false,
  30,
  'Maximum power for studios',
  '[
    "8,000 credits/month",
    "Unlimited AI chat",
    "All image models (ultra priority)",
    "Max resolution 3D models",
    "4K video generation",
    "Premium audio generation",
    "AI game code generation",
    "Dedicated support",
    "Unlimited storage",
    "Commercial license",
    "API access"
  ]'::jsonb,
  '{
    "chatMessagesPerDay": -1,
    "priorityQueue": "ultra",
    "storageGb": -1,
    "commercialLicense": true,
    "earlyAccess": true,
    "apiAccess": true
  }'::jsonb
)
ON CONFLICT (name) DO UPDATE SET
  display_name = 'Ultra',
  price_inr = 3999,
  price_usd = 49.99,
  monthly_credits = 8000,
  duration_days = 30,
  description = 'Maximum power for studios',
  features = '[
    "8,000 credits/month",
    "Unlimited AI chat",
    "All image models (ultra priority)",
    "Max resolution 3D models",
    "4K video generation",
    "Premium audio generation",
    "AI game code generation",
    "Dedicated support",
    "Unlimited storage",
    "Commercial license",
    "API access"
  ]'::jsonb,
  limits = '{
    "chatMessagesPerDay": -1,
    "priorityQueue": "ultra",
    "storageGb": -1,
    "commercialLicense": true,
    "earlyAccess": true,
    "apiAccess": true
  }'::jsonb;

-- Update or Insert CUSTOM/ENTERPRISE plan
INSERT INTO public.pricing_plans (name, display_name, price_inr, price_usd, monthly_credits, is_one_time, duration_days, description, features, limits) VALUES
(
  'CUSTOM',
  'Custom / Enterprise',
  99999,
  1499,
  -1,
  false,
  NULL,
  'Unlimited with FUP applied',
  '[
    "Unlimited credits (FUP applied)",
    "Unlimited team seats",
    "All features included",
    "Private API endpoint",
    "Custom model training",
    "SLA guarantee",
    "24/7 dedicated support",
    "On-premise option",
    "White-label option"
  ]'::jsonb,
  '{
    "chatMessagesPerDay": -1,
    "priorityQueue": "ultra",
    "storageGb": -1,
    "commercialLicense": true,
    "teamMembers": -1,
    "apiAccess": true,
    "privateEndpoint": true,
    "sla": true,
    "customTraining": true
  }'::jsonb
)
ON CONFLICT (name) DO UPDATE SET
  display_name = 'Custom / Enterprise',
  price_inr = 99999,
  price_usd = 1499,
  monthly_credits = -1,
  duration_days = NULL,
  description = 'Unlimited with FUP applied',
  features = '[
    "Unlimited credits (FUP applied)",
    "Unlimited team seats",
    "All features included",
    "Private API endpoint",
    "Custom model training",
    "SLA guarantee",
    "24/7 dedicated support",
    "On-premise option",
    "White-label option"
  ]'::jsonb,
  limits = '{
    "chatMessagesPerDay": -1,
    "priorityQueue": "ultra",
    "storageGb": -1,
    "commercialLicense": true,
    "teamMembers": -1,
    "apiAccess": true,
    "privateEndpoint": true,
    "sla": true,
    "customTraining": true
  }'::jsonb;

-- ==================== Update Credit Costs ====================
-- Clear existing and insert new costs based on credit-cost.md

DELETE FROM public.credit_costs;

-- AI Chat
INSERT INTO public.credit_costs (feature_type, sub_type, credits, description) VALUES
('chat', 'per_million_tokens', 100, 'AI Chat Messages (per million tokens)');

-- Image Generation
INSERT INTO public.credit_costs (feature_type, sub_type, credits, description) VALUES
('image_generation', 'standard', 5, 'Standard Image (koye 2d v1)'),
('image_generation', 'hq', 10, 'High-Quality Image (koye 2d v1.5)'),
('image_generation', 'ultra', 15, 'Ultra Quality Image (koye 2d v2)');

-- 3D Model Generation
INSERT INTO public.credit_costs (feature_type, sub_type, resolution, has_texture, credits, description) VALUES
('3d_model', 'basic', '512', false, 20, '3D Model Basic (512, no texture)'),
('3d_model', 'basic', '512', true, 25, '3D Model Basic (512, with texture)'),
('3d_model', 'standard', '1024', false, 50, '3D Model Standard (1024, no texture)'),
('3d_model', 'standard', '1024', true, 60, '3D Model Standard (1024, with texture)'),
('3d_model', 'high', '1536', false, 70, '3D Model High-Res (1536, no texture)'),
('3d_model', 'high', '1536', true, 90, '3D Model High-Res (1536, with texture)');

-- Rigging & Animation
INSERT INTO public.credit_costs (feature_type, sub_type, credits, description) VALUES
('rigging', 'auto', 10, 'Auto-Rig'),
('animation', 'per_animation', 30, 'Animation (per animation clip)');

-- Audio Generation
INSERT INTO public.credit_costs (feature_type, sub_type, credits, description) VALUES
('audio', 'per_second', 5, 'Audio Generation (per second)');

-- Video Generation
INSERT INTO public.credit_costs (feature_type, resolution, credits, description) VALUES
('video', '720p', 10, 'Video Generation 720p (per second)'),
('video', '1080p', 25, 'Video Generation 1080p (per second)');

-- Game Generation
INSERT INTO public.credit_costs (feature_type, sub_type, credits, description) VALUES
('game_generation', 'prototype_2d', 100, '2D Prototype Game'),
('game_generation', 'prototype_3d', 250, '3D Prototype Game'),
('game_generation', 'full_small', 500, 'Full Small Game');

-- ==================== Migrate Existing Users ====================
-- Update existing user subscriptions with initial credits based on their plan
UPDATE public.user_subscriptions us
SET credits_balance = pp.monthly_credits
FROM public.pricing_plans pp
WHERE us.plan_id = pp.id
  AND (us.status = 'active' OR us.status = 'trial')
  AND (us.expires_at IS NULL OR us.expires_at > NOW());
