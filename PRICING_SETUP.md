# Pricing Plans and Usage Tracking Setup Guide

This guide explains how to set up the pricing plans and usage tracking system for KOYE AI.

## Overview

The pricing system tracks:
- User subscriptions to different plans (FREE, PRO, PRO_PLUS, ULTRA, STUDIO)
- Daily usage limits for each feature (chat messages, image generations, 3D conversions, etc.)
- Automatic plan assignment (FREE plan for new users)

## Database Setup

### 1. Run the SQL Schema

Run the `supabase-pricing-schema.sql` file in your **main Supabase database** SQL editor:

```sql
-- This creates:
-- 1. pricing_plans table (stores all plan details)
-- 2. user_subscriptions table (tracks user's current plan)
-- 3. user_usage table (tracks daily usage per feature)
-- 4. Functions for checking and incrementing usage
-- 5. Default pricing plans (FREE, PRO_TRIAL, PRO, PRO_PLUS, ULTRA, STUDIO)
```

### 2. Verify Plans Were Created

After running the SQL, verify the plans were created:

```sql
SELECT name, display_name, price_inr, price_usd FROM pricing_plans;
```

You should see 6 plans: FREE, PRO_TRIAL, PRO, PRO_PLUS, ULTRA, STUDIO

## Usage Limits

### Plan Limits Structure

Each plan has limits stored as JSON in the `limits` column:

```json
{
  "chat_messages_per_day": 20,  // -1 for unlimited
  "image_generations_per_day_koye2dv1": 5,
  "image_generations_per_day_koye2dv2": 50,
  "image_to_3d_per_day": 10,
  "image_to_3d_per_week": 1,  // Alternative to per_day
  "auto_rig_per_day": -1,  // -1 for unlimited
  "auto_rig_per_week": 1,
  "priority_queue": "high",  // false, "medium", "high", "ultra"
  "storage_gb": 20,
  "commercial_license": true,
  "early_access": false,
  "team_members": 5,  // -1 for unlimited
  "api_access": false
}
```

## Feature Types

The system tracks usage for these features:
- `chat_message` - AI chat messages
- `image_generation` - Image generations (with model type)
- `image_to_3d` - 2D to 3D conversions
- `auto_rig` - Auto-rigging operations
- `animation_generation` - Animation generation

## Usage in Code

### 1. Check Usage Before Action

```typescript
import { usePricing } from "../hooks/usePricing"

function MyComponent() {
  const { checkLimit, incrementUsage } = usePricing()

  const handleSendMessage = async () => {
    // Check if user can send message
    const limitCheck = await checkLimit("chat_message")
    
    if (!limitCheck.allowed) {
      alert(`Daily limit reached: ${limitCheck.currentUsage}/${limitCheck.limit}`)
      return
    }

    // Send message...
    
    // Increment usage after successful action
    await incrementUsage("chat_message")
  }
}
```

### 2. Check Image Generation Limits

```typescript
const limitCheck = await checkLimit("image_generation", "koye-2dv2")
if (!limitCheck.allowed) {
  // Show upgrade prompt
}
```

### 3. Get User's Current Plan

```typescript
const { subscription, usage } = usePricing()

if (subscription) {
  console.log(`Current plan: ${subscription.planDisplayName}`)
  console.log(`Usage today:`, usage)
}
```

## Automatic Plan Assignment

When a new user signs up, they are automatically assigned the FREE plan via a database trigger.

## Subscription Management

### Subscribe User to Plan

```typescript
import { subscribeToPlan } from "../services/pricingService"

await subscribeToPlan(userId, planId)
```

### Check Subscription Status

The system automatically checks if subscriptions are expired and falls back to FREE plan limits.

## Daily Usage Reset

Usage counts are tracked per day (using `CURRENT_DATE`). The system automatically resets at midnight (database timezone).

## Rate Limiting

For chat messages, plans may have a rate limit (requests per minute):
- FREE: No rate limit (but daily limit)
- PRO/PRO_PLUS/ULTRA/STUDIO: 10 requests per minute

This should be enforced in your API/backend, not just in the database.

## Notes

- Usage is tracked per user per day per feature type
- Limits of `-1` mean unlimited
- Expired subscriptions automatically fall back to FREE plan limits
- Non-authenticated users are treated as FREE plan users
- Usage tracking happens automatically when you call `incrementUsage()`

