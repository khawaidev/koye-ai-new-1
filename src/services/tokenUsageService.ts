import { supabase } from "./supabase"

export interface TokenUsage {
    inputTokens: number
    outputTokens: number
    totalTokens: number
}

export interface UserTokenUsage {
    id: string
    userId: string
    inputTokens: number
    outputTokens: number
    totalTokens: number
    usageDate: string
    createdAt: string
    updatedAt: string
}

export interface UserTokenSummary {
    todayInputTokens: number
    todayOutputTokens: number
    todayTotalTokens: number
    monthlyInputTokens: number
    monthlyOutputTokens: number
    monthlyTotalTokens: number
    allTimeInputTokens: number
    allTimeOutputTokens: number
    allTimeTotalTokens: number
}

// Local token usage cache for aggregating before saving
let tokenUsageBuffer: { inputTokens: number; outputTokens: number } = {
    inputTokens: 0,
    outputTokens: 0,
}

let flushTimeout: ReturnType<typeof setTimeout> | null = null

/**
 * Estimate token count from text (rough approximation)
 * GPT/Gemini tokens are roughly 4 characters per token for English text
 */
export function estimateTokenCount(text: string): number {
    if (!text) return 0
    // Rough estimation: 1 token ≈ 4 characters for English
    // This is a simplified approximation - actual tokenization varies by model
    return Math.ceil(text.length / 4)
}

/**
 * Track token usage from an AI response
 * This buffers the usage and periodically flushes to the database
 */
export function trackTokenUsage(inputTokens: number, outputTokens: number): void {
    tokenUsageBuffer.inputTokens += inputTokens
    tokenUsageBuffer.outputTokens += outputTokens

    // Schedule a flush if not already scheduled
    if (!flushTimeout) {
        flushTimeout = setTimeout(async () => {
            await flushTokenUsage()
        }, 5000) // Flush every 5 seconds
    }
}

/**
 * Flush buffered token usage to the database
 */
async function flushTokenUsage(): Promise<void> {
    if (tokenUsageBuffer.inputTokens === 0 && tokenUsageBuffer.outputTokens === 0) {
        flushTimeout = null
        return
    }

    const { inputTokens, outputTokens } = tokenUsageBuffer

    // Reset buffer
    tokenUsageBuffer = { inputTokens: 0, outputTokens: 0 }
    flushTimeout = null

    try {
        // Get current user from auth
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) {
            console.warn("No authenticated user for token tracking")
            return
        }

        await recordTokenUsage(user.id, inputTokens, outputTokens)
    } catch (error) {
        console.error("Error flushing token usage:", error)
        // Re-add to buffer on error
        tokenUsageBuffer.inputTokens += inputTokens
        tokenUsageBuffer.outputTokens += outputTokens
    }
}

/**
 * Record token usage for a user
 */
export async function recordTokenUsage(
    userId: string,
    inputTokens: number,
    outputTokens: number
): Promise<void> {
    const today = new Date().toISOString().split('T')[0]
    const totalTokens = inputTokens + outputTokens

    // Try to upsert the token usage record
    const { error } = await supabase
        .from("user_token_usage")
        .upsert(
            {
                user_id: userId,
                usage_date: today,
                input_tokens: inputTokens,
                output_tokens: outputTokens,
                total_tokens: totalTokens,
                updated_at: new Date().toISOString(),
            },
            {
                onConflict: "user_id,usage_date",
                ignoreDuplicates: false,
            }
        )

    if (error) {
        // If upsert failed, try to update existing record
        const { error: updateError } = await supabase.rpc("increment_token_usage", {
            p_user_id: userId,
            p_input_tokens: inputTokens,
            p_output_tokens: outputTokens,
        })

        if (updateError) {
            console.error("Error recording token usage:", updateError)
            throw updateError
        }
    }
}

/**
 * Get user's token usage summary
 */
export async function getUserTokenSummary(userId: string): Promise<UserTokenSummary> {
    const today = new Date().toISOString().split('T')[0]
    const firstDayOfMonth = new Date()
    firstDayOfMonth.setDate(1)
    const monthStart = firstDayOfMonth.toISOString().split('T')[0]

    // Get today's usage
    const { data: todayData } = await supabase
        .from("user_token_usage")
        .select("input_tokens, output_tokens, total_tokens")
        .eq("user_id", userId)
        .eq("usage_date", today)
        .single()

    // Get this month's usage
    const { data: monthlyData } = await supabase
        .from("user_token_usage")
        .select("input_tokens, output_tokens, total_tokens")
        .eq("user_id", userId)
        .gte("usage_date", monthStart)

    // Get all-time usage
    const { data: allTimeData } = await supabase
        .from("user_token_usage")
        .select("input_tokens, output_tokens, total_tokens")
        .eq("user_id", userId)

    // Calculate summaries
    const todayInput = todayData?.input_tokens || 0
    const todayOutput = todayData?.output_tokens || 0
    const todayTotal = todayData?.total_tokens || 0

    const monthlyInput = (monthlyData || []).reduce((sum, row) => sum + (row.input_tokens || 0), 0)
    const monthlyOutput = (monthlyData || []).reduce((sum, row) => sum + (row.output_tokens || 0), 0)
    const monthlyTotal = (monthlyData || []).reduce((sum, row) => sum + (row.total_tokens || 0), 0)

    const allTimeInput = (allTimeData || []).reduce((sum, row) => sum + (row.input_tokens || 0), 0)
    const allTimeOutput = (allTimeData || []).reduce((sum, row) => sum + (row.output_tokens || 0), 0)
    const allTimeTotal = (allTimeData || []).reduce((sum, row) => sum + (row.total_tokens || 0), 0)

    return {
        todayInputTokens: todayInput,
        todayOutputTokens: todayOutput,
        todayTotalTokens: todayTotal,
        monthlyInputTokens: monthlyInput,
        monthlyOutputTokens: monthlyOutput,
        monthlyTotalTokens: monthlyTotal,
        allTimeInputTokens: allTimeInput,
        allTimeOutputTokens: allTimeOutput,
        allTimeTotalTokens: allTimeTotal,
    }
}

/**
 * Get user's daily token usage for the last N days
 */
export async function getUserDailyTokenUsage(
    userId: string,
    days: number = 30
): Promise<UserTokenUsage[]> {
    const startDate = new Date()
    startDate.setDate(startDate.getDate() - days)
    const startDateStr = startDate.toISOString().split('T')[0]

    const { data, error } = await supabase
        .from("user_token_usage")
        .select("*")
        .eq("user_id", userId)
        .gte("usage_date", startDateStr)
        .order("usage_date", { ascending: false })

    if (error) {
        console.error("Error fetching daily token usage:", error)
        throw error
    }

    return (data || []).map(row => ({
        id: row.id,
        userId: row.user_id,
        inputTokens: row.input_tokens,
        outputTokens: row.output_tokens,
        totalTokens: row.total_tokens,
        usageDate: row.usage_date,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
    }))
}

/**
 * Calculate estimated credit cost from token usage
 * Based on pricing: 100 credits per million tokens
 */
export function calculateTokenCredits(totalTokens: number): number {
    // 100 credits per 1,000,000 tokens = 0.0001 credits per token
    return Math.ceil((totalTokens / 1000000) * 100)
}

/**
 * Format token count for display (e.g., "1.2M", "500K", "1,234")
 */
export function formatTokenCount(tokens: number): string {
    if (tokens >= 1000000) {
        return (tokens / 1000000).toFixed(1) + "M"
    }
    if (tokens >= 1000) {
        return (tokens / 1000).toFixed(1) + "K"
    }
    return tokens.toLocaleString()
}

// Force flush on page unload
if (typeof window !== "undefined") {
    window.addEventListener("beforeunload", () => {
        if (tokenUsageBuffer.inputTokens > 0 || tokenUsageBuffer.outputTokens > 0) {
            // Use sendBeacon for reliable delivery on page unload
            // Note: This is a simplified version - in production you'd want a dedicated endpoint
            flushTokenUsage()
        }
    })
}
