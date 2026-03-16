import { supabase } from "./supabase"

export interface CreditCost {
    id: string
    featureType: string
    subType?: string
    resolution?: string
    hasTexture?: boolean
    credits: number
    description: string
    metadata?: Record<string, any>
}

export interface CreditTopup {
    id: string
    userId: string
    creditsPurchased: number
    amountPaid: number
    currency: string
    paymentId?: string
    paymentStatus: 'pending' | 'completed' | 'failed' | 'refunded'
    createdAt: string
}

/**
 * Get all credit costs from database
 */
export async function getCreditCosts(): Promise<CreditCost[]> {
    const { data, error } = await supabase
        .from("credit_costs")
        .select("*")
        .order("credits", { ascending: true })

    if (error) throw error

    return (data || []).map(cost => ({
        id: cost.id,
        featureType: cost.feature_type,
        subType: cost.sub_type,
        resolution: cost.resolution,
        hasTexture: cost.has_texture,
        credits: cost.credits,
        description: cost.description,
        metadata: cost.metadata || {},
    }))
}

/**
 * Get credit cost for a specific feature and options
 */
export async function getCreditCostForFeature(
    featureType: string,
    options: {
        subType?: string
        resolution?: string
        hasTexture?: boolean
        duration?: number // For per-second features like audio/video
    } = {}
): Promise<number> {
    const { subType, resolution, hasTexture, duration } = options

    let query = supabase
        .from("credit_costs")
        .select("credits")
        .eq("feature_type", featureType)

    if (subType !== undefined) {
        query = query.eq("sub_type", subType)
    }

    if (resolution !== undefined) {
        query = query.eq("resolution", resolution)
    }

    if (hasTexture !== undefined) {
        query = query.eq("has_texture", hasTexture)
    }

    const { data, error } = await query.limit(1).single()

    if (error) {
        console.error("Error fetching credit cost:", error)
        throw new Error(`Credit cost not found for ${featureType}`)
    }

    const credits = data?.credits || 0

    // For per-second features, multiply by duration
    if (duration && (featureType === 'audio' || featureType === 'video')) {
        return credits * duration
    }

    return credits
}

/**
 * Get user's current credit balance
 */
export async function getUserCreditBalance(userId: string): Promise<number> {
    const { data, error } = await supabase.rpc("get_user_credit_balance", {
        p_user_id: userId,
    })

    if (error) throw error
    return data || 0
}

/**
 * Check if user has enough credits for an action
 */
export async function checkCreditBalance(
    userId: string | null,
    requiredCredits: number
): Promise<{ allowed: boolean; currentBalance: number; required: number; remaining: number }> {
    // For non-authenticated users
    if (!userId) {
        return {
            allowed: false,
            currentBalance: 0,
            required: requiredCredits,
            remaining: 0,
        }
    }

    const currentBalance = await getUserCreditBalance(userId)
    const allowed = currentBalance >= requiredCredits
    const remaining = Math.max(0, currentBalance - requiredCredits)

    return {
        allowed,
        currentBalance,
        required: requiredCredits,
        remaining,
    }
}

/**
 * Deduct credits from user balance and log usage
 */
export async function deductCredits(
    userId: string,
    creditsAmount: number,
    featureType: string,
    metadata: Record<string, any> = {}
): Promise<number> {
    const { data, error } = await supabase.rpc("deduct_user_credits", {
        p_user_id: userId,
        p_credits_amount: creditsAmount,
        p_feature_type: featureType,
        p_metadata: metadata,
    })

    if (error) {
        // Check for insufficient credits error
        if (error.message.includes('Insufficient credits')) {
            throw new Error(error.message)
        }
        throw error
    }

    return data || 0
}

/**
 * Add credits to user balance (from top-ups or other sources)
 */
export async function addCredits(
    userId: string,
    creditsAmount: number,
    source: string = 'topup'
): Promise<number> {
    const { data, error } = await supabase.rpc("add_user_credits", {
        p_user_id: userId,
        p_credits_amount: creditsAmount,
        p_source: source,
    })

    if (error) throw error
    return data || 0
}

/**
 * Reset monthly credits for a user
 */
export async function resetMonthlyCredits(userId: string): Promise<number> {
    const { data, error } = await supabase.rpc("reset_monthly_credits", {
        p_user_id: userId,
    })

    if (error) throw error
    return data || 0
}

/**
 * Record a credit top-up purchase
 */
export async function recordCreditTopup(
    userId: string,
    creditsPurchased: number,
    amountPaid: number,
    currency: string,
    paymentId?: string
): Promise<CreditTopup> {
    const { data, error } = await supabase
        .from("credit_topups")
        .insert({
            user_id: userId,
            credits_purchased: creditsPurchased,
            amount_paid: amountPaid,
            currency,
            payment_id: paymentId,
            payment_status: 'pending',
        })
        .select()
        .single()

    if (error) throw error

    return {
        id: data.id,
        userId: data.user_id,
        creditsPurchased: data.credits_purchased,
        amountPaid: data.amount_paid,
        currency: data.currency,
        paymentId: data.payment_id,
        paymentStatus: data.payment_status,
        createdAt: data.created_at,
    }
}

/**
 * Update credit top-up payment status
 */
export async function updateCreditTopupStatus(
    topupId: string,
    status: 'completed' | 'failed' | 'refunded'
): Promise<void> {
    const { error } = await supabase
        .from("credit_topups")
        .update({ payment_status: status })
        .eq("id", topupId)

    if (error) throw error
}

/**
 * Get user's credit top-up history
 */
export async function getUserCreditTopups(userId: string): Promise<CreditTopup[]> {
    const { data, error } = await supabase
        .from("credit_topups")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })

    if (error) throw error

    return (data || []).map(topup => ({
        id: topup.id,
        userId: topup.user_id,
        creditsPurchased: topup.credits_purchased,
        amountPaid: topup.amount_paid,
        currency: topup.currency,
        paymentId: topup.payment_id,
        paymentStatus: topup.payment_status,
        createdAt: topup.created_at,
    }))
}
