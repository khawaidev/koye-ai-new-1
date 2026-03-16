import { useEffect, useState } from "react"
import {
  checkCreditBalance,
  deductCredits as deductCreditsService,
  getCreditCostForFeature
} from "../services/creditService"
import type { PricingPlan, UsageCount, UserSubscription } from "../services/pricingService"
import {
  checkUsageLimit,
  getPricingPlans,
  getUserSubscription,
  getUserUsageSummary,
  incrementUserUsage,
} from "../services/pricingService"
import { useAuth } from "./useAuth"

export function usePricing() {
  const { user, isAuthenticated } = useAuth()
  const [plans, setPlans] = useState<PricingPlan[]>([])
  const [subscription, setSubscription] = useState<UserSubscription | null>(null)
  const [usage, setUsage] = useState<UsageCount[]>([])
  const [creditBalance, setCreditBalance] = useState<number>(0)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadPricingData()
  }, [user, isAuthenticated])

  const loadPricingData = async () => {
    try {
      setLoading(true)

      // Always load plans (public data)
      const plansData = await getPricingPlans()
      setPlans(plansData)

      // Only try to load subscription/usage if user is authenticated
      if (isAuthenticated && user) {
        try {
          // Wait a bit for auth to fully propagate (fixes timing issues with new signups)
          await new Promise(resolve => setTimeout(resolve, 100))

          const [subscriptionData, usageData] = await Promise.all([
            getUserSubscription(user.id).catch((err) => {
              // If subscription fetch fails (e.g., RLS error), just return null
              // This can happen if user just signed up and subscription hasn't been created yet
              console.warn("Failed to fetch subscription (user may not have one yet):", err)
              return null
            }),
            getUserUsageSummary(user.id).catch((err) => {
              // If usage fetch fails, return empty array
              console.warn("Failed to fetch usage:", err)
              return []
            }),
          ])

          setSubscription(subscriptionData)
          setUsage(usageData)
          setCreditBalance(subscriptionData?.creditsBalance || 0)
        } catch (error) {
          // Non-critical errors - user can still use the app
          console.warn("Error loading user-specific pricing data:", error)
          setSubscription(null)
          setUsage([])
        }
      } else {
        setSubscription(null)
        setUsage([])
      }
    } catch (error) {
      console.error("Error loading pricing data:", error)
      // Set defaults on error
      setSubscription(null)
      setUsage([])
    } finally {
      setLoading(false)
    }
  }

  const checkLimit = async (
    featureType: "chat_message" | "image_generation" | "image_to_3d" | "auto_rig" | "animation_generation",
    imageModel?: "koye-2dv1" | "koye-2dv2"
  ) => {
    const userId = isAuthenticated && user ? user.id : null
    return checkUsageLimit(userId, featureType, imageModel)
  }

  const incrementUsage = async (
    featureType: "chat_message" | "image_generation" | "image_to_3d" | "auto_rig" | "animation_generation",
    count: number = 1
  ) => {
    if (!isAuthenticated || !user) {
      throw new Error("User must be authenticated to track usage")
    }
    await incrementUserUsage(user.id, featureType, count)
    // Reload usage summary
    const usageData = await getUserUsageSummary(user.id)
    setUsage(usageData)
  }

  // New credit-based functions
  const getCostForAction = async (
    featureType: string,
    options: {
      subType?: string
      resolution?: string
      hasTexture?: boolean
      duration?: number
    } = {}
  ) => {
    return getCreditCostForFeature(featureType, options)
  }

  const checkCredits = async (requiredCredits: number) => {
    const userId = isAuthenticated && user ? user.id : null
    return checkCreditBalance(userId, requiredCredits)
  }

  const deductCredits = async (
    creditsAmount: number,
    featureType: string,
    metadata: Record<string, any> = {}
  ) => {
    if (!isAuthenticated || !user) {
      throw new Error("User must be authenticated to use credits")
    }
    const newBalance = await deductCreditsService(user.id, creditsAmount, featureType, metadata)
    setCreditBalance(newBalance)
    // Reload usage and subscription data
    await loadPricingData()
    return newBalance
  }

  return {
    plans,
    subscription,
    usage,
    creditBalance,
    loading,
    checkLimit,
    incrementUsage,
    // New credit-based functions
    getCostForAction,
    checkCredits,
    deductCredits,
    refresh: loadPricingData,
  }
}

