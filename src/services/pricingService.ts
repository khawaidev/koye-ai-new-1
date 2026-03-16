import { supabase } from "./supabase"

export interface PricingPlan {
  id: string
  name: string
  displayName: string
  priceInr: number
  priceUsd: number
  monthlyCredits: number
  isOneTime: boolean
  durationDays?: number
  description: string
  features: string[]
  limits: PlanLimits
}

export interface PlanLimits {
  chatMessagesPerDay: number // -1 for unlimited
  chatRateLimitPerMin?: number
  imageGenerationsPerDayKoye2dv2?: number
  imageGenerationsPerDayKoye2dv1?: number
  imageTo3dPerDay?: number
  imageTo3dPerWeek?: number
  autoRigPerDay?: number
  autoRigPerWeek?: number
  animationGenerationQuality?: "720p" | "1080p" | "4K"
  priorityQueue: boolean | "medium" | "high" | "ultra"
  storageGb: number // -1 for unlimited
  commercialLicense?: boolean
  earlyAccess?: boolean
  teamMembers?: number // -1 for unlimited
  apiAccess?: boolean
  privateEndpoint?: boolean
  sla?: boolean
}

export interface UserSubscription {
  id: string
  planId: string
  planName: string
  planDisplayName: string
  status: "active" | "expired" | "cancelled" | "trial"
  expiresAt: string | null
  limits: PlanLimits
  creditsBalance: number
}

export interface UsageCount {
  featureType: "chat_message" | "image_generation" | "image_to_3d" | "auto_rig" | "animation_generation"
  count: number
  limit: number // -1 for unlimited
  isUnlimited: boolean
}

/**
 * Get all pricing plans
 */
export async function getPricingPlans(): Promise<PricingPlan[]> {
  const { data, error } = await supabase
    .from("pricing_plans")
    .select("*")
    .order("price_usd", { ascending: true })

  if (error) throw error

  return (data || []).map(plan => ({
    id: plan.id,
    name: plan.name,
    displayName: plan.display_name,
    priceInr: plan.price_inr,
    priceUsd: parseFloat(plan.price_usd),
    monthlyCredits: plan.monthly_credits || 0,
    isOneTime: plan.is_one_time || false,
    durationDays: plan.duration_days,
    description: plan.description,
    features: plan.features || [],
    limits: plan.limits || {},
  }))
}

/**
 * Get user's current active subscription
 */
export async function getUserSubscription(userId: string): Promise<UserSubscription | null> {
  const { data, error } = await supabase.rpc("get_user_subscription", {
    p_user_id: userId,
  })

  if (error) throw error
  if (!data || data.length === 0) return null

  const sub = data[0]
  return {
    id: sub.subscription_id,
    planId: sub.plan_id,
    planName: sub.plan_name,
    planDisplayName: sub.plan_display_name,
    status: sub.status,
    expiresAt: sub.expires_at,
    limits: sub.limits || {},
    creditsBalance: sub.credits_balance || 0,
  }
}

/**
 * Get user's usage count for a specific feature today
 */
export async function getUserUsageToday(
  userId: string,
  featureType: "chat_message" | "image_generation" | "image_to_3d" | "auto_rig" | "animation_generation"
): Promise<number> {
  const { data, error } = await supabase.rpc("get_user_usage_today", {
    p_user_id: userId,
    p_feature_type: featureType,
  })

  if (error) throw error
  return data || 0
}

/**
 * Increment user's usage count
 */
export async function incrementUserUsage(
  userId: string,
  featureType: "chat_message" | "image_generation" | "image_to_3d" | "auto_rig" | "animation_generation",
  count: number = 1
): Promise<number> {
  const { data, error } = await supabase.rpc("increment_user_usage", {
    p_user_id: userId,
    p_feature_type: featureType,
    p_count: count,
  })

  if (error) throw error
  return data || 0
}

/**
 * Check if user can perform an action based on their plan limits
 * For non-authenticated users, pass empty string and it will use FREE plan limits
 */
export async function checkUsageLimit(
  userId: string | null,
  featureType: "chat_message" | "image_generation" | "image_to_3d" | "auto_rig" | "animation_generation",
  imageModel?: "koye-2dv1" | "koye-2dv2"
): Promise<{ allowed: boolean; currentUsage: number; limit: number; remaining: number }> {
  // For non-authenticated users, use FREE plan limits
  if (!userId) {
    const plans = await getPricingPlans()
    const freePlan = plans.find(p => p.name === "FREE")
    if (!freePlan) {
      throw new Error("FREE plan not found")
    }
    // For non-authenticated, we can't track usage, so return limit check only
    return {
      allowed: true, // Will be checked by client-side tracking
      currentUsage: 0,
      limit: getLimitForFeature(freePlan.limits, featureType, imageModel),
      remaining: getLimitForFeature(freePlan.limits, featureType, imageModel),
    }
  }

  const subscription = await getUserSubscription(userId)

  if (!subscription) {
    // No subscription - use FREE plan limits
    const plans = await getPricingPlans()
    const freePlan = plans.find(p => p.name === "FREE")
    if (!freePlan) {
      throw new Error("FREE plan not found")
    }
    return checkLimitForPlan(freePlan, userId, featureType, imageModel)
  }

  // Check if subscription is expired
  if (subscription.expiresAt && new Date(subscription.expiresAt) < new Date()) {
    // Subscription expired - fall back to FREE plan
    const plans = await getPricingPlans()
    const freePlan = plans.find(p => p.name === "FREE")
    if (!freePlan) {
      throw new Error("FREE plan not found")
    }
    return checkLimitForPlan(freePlan, userId, featureType, imageModel)
  }

  return checkLimitForPlan(subscription, userId, featureType, imageModel)
}

function getLimitForFeature(
  limits: PlanLimits,
  featureType: "chat_message" | "image_generation" | "image_to_3d" | "auto_rig" | "animation_generation",
  imageModel?: "koye-2dv1" | "koye-2dv2"
): number {
  switch (featureType) {
    case "chat_message":
      return limits.chatMessagesPerDay || 0
    case "image_generation":
      if (imageModel === "koye-2dv2") {
        return limits.imageGenerationsPerDayKoye2dv2 || limits.imageGenerationsPerDayKoye2dv1 || 0
      } else {
        return limits.imageGenerationsPerDayKoye2dv1 || limits.imageGenerationsPerDayKoye2dv2 || 0
      }
    case "image_to_3d":
      return limits.imageTo3dPerDay || (limits.imageTo3dPerWeek ? Math.ceil(limits.imageTo3dPerWeek / 7) : 0)
    case "auto_rig":
      return limits.autoRigPerDay || (limits.autoRigPerWeek ? Math.ceil(limits.autoRigPerWeek / 7) : 0)
    case "animation_generation":
      return -1 // Unlimited for now
    default:
      return 0
  }
}

async function checkLimitForPlan(
  plan: PricingPlan | UserSubscription,
  userId: string,
  featureType: "chat_message" | "image_generation" | "image_to_3d" | "auto_rig" | "animation_generation",
  imageModel?: "koye-2dv1" | "koye-2dv2"
): Promise<{ allowed: boolean; currentUsage: number; limit: number; remaining: number }> {
  const limits = plan.limits
  const currentUsage = await getUserUsageToday(userId, featureType)
  const limit = getLimitForFeature(limits, featureType, imageModel)

  const isUnlimited = limit === -1
  const allowed = isUnlimited || currentUsage < limit
  const remaining = isUnlimited ? -1 : Math.max(0, limit - currentUsage)

  return {
    allowed,
    currentUsage,
    limit,
    remaining,
  }
}

/**
 * Subscribe user to a plan
 */
export async function subscribeToPlan(
  userId: string,
  planId: string
): Promise<UserSubscription> {
  // Use database function to handle subscription (bypasses RLS)
  const { data, error } = await supabase.rpc("subscribe_user_to_plan", {
    p_user_id: userId,
    p_plan_id: planId,
  })

  if (error) throw error
  if (!data || data.length === 0) {
    throw new Error("Failed to create subscription")
  }

  const sub = data[0]
  return {
    id: sub.subscription_id,
    planId: sub.plan_id,
    planName: sub.plan_name,
    planDisplayName: sub.plan_display_name,
    status: sub.status,
    expiresAt: sub.expires_at,
    limits: sub.limits || {},
    creditsBalance: sub.credits_balance || 0,
  }
}

/**
 * Get user's usage summary for today
 */
export async function getUserUsageSummary(userId: string): Promise<UsageCount[]> {
  const subscription = await getUserSubscription(userId)

  // If no subscription, use FREE plan limits
  let limits: PlanLimits = {}
  if (!subscription) {
    const plans = await getPricingPlans()
    const freePlan = plans.find(p => p.name === "FREE")
    if (freePlan) {
      limits = freePlan.limits
    }
  } else {
    limits = subscription.limits
  }

  const features: Array<"chat_message" | "image_generation" | "image_to_3d" | "auto_rig" | "animation_generation"> = [
    "chat_message",
    "image_generation",
    "image_to_3d",
    "auto_rig",
    "animation_generation",
  ]

  const usagePromises = features.map(async (featureType) => {
    const count = await getUserUsageToday(userId, featureType)
    const limit = getLimitForFeature(limits, featureType)

    return {
      featureType,
      count,
      limit,
      isUnlimited: limit === -1,
    }
  })

  return Promise.all(usagePromises)
}

