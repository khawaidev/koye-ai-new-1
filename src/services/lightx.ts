// LightX AI Image Generator API Service
// Documentation: https://api.lightxeditor.com/external/api/v2/text2image
// Model name: koye-2dv2.5

import { getApiKeys, withApiFallback } from "../lib/apiFallback"

// Get API keys with fallback support
const LIGHTX_API_KEYS = getApiKeys("VITE_LIGHTX_API_KEY")

// Use Vite proxy in development to bypass CORS
// The proxy is configured in vite.config.ts to forward /api/lightx/* to https://api.lightxeditor.com/*
const isDev = import.meta.env.DEV
const LIGHTX_BASE_URL = isDev ? "/api/lightx" : "https://api.lightxeditor.com"
const LIGHTX_TEXT2IMAGE_URL = `${LIGHTX_BASE_URL}/external/api/v2/text2image`
const LIGHTX_ORDER_STATUS_URL = `${LIGHTX_BASE_URL}/external/api/v2/order-status`

// Supported resolutions
export type LightXResolution =
    | "1:1"   // 512 × 512 (Square)
    | "9:16"  // 289 × 512 (Portrait)
    | "3:4"   // 386 × 512 (Portrait)
    | "2:3"   // 341 × 512 (Portrait)
    | "16:9"  // 512 × 289 (Landscape)
    | "4:3"   // 512 × 386 (Landscape)

export interface LightXGenerateOptions {
    prompt: string
    resolution?: LightXResolution // Default: "2:3" for character portraits
    enhancePrompt?: boolean // Default: true - enhances prompt with richer details
}

interface LightXInitResponse {
    statusCode: number
    message: string
    body: {
        orderId: string
        maxRetriesAllowed: number
        avgResponseTimeInSec: number
        status: "init" | "failed"
    }
}

interface LightXStatusResponse {
    statusCode: number
    message: string
    body: {
        orderId: string
        status: "init" | "active" | "failed"
        output?: string // Image URL when status is "active"
    }
}

/**
 * Poll for order status until complete
 * @param orderId - The order ID to check
 * @param apiKey - API key for authentication
 * @param maxRetries - Maximum number of retries (default: 5)
 * @param delayMs - Delay between retries in ms (default: 3000)
 * @returns The output image URL
 */
async function pollOrderStatus(
    orderId: string,
    apiKey: string,
    maxRetries: number = 5,
    delayMs: number = 3000
): Promise<string> {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        console.log(`📊 LightX: Checking order status (attempt ${attempt}/${maxRetries})...`)

        const response = await fetch(LIGHTX_ORDER_STATUS_URL, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "x-api-key": apiKey,
            },
            body: JSON.stringify({ orderId }),
        })

        if (!response.ok) {
            throw new Error(`LightX status check failed: ${response.status} ${response.statusText}`)
        }

        const data: LightXStatusResponse = await response.json()

        console.log(`   Status: ${data.body.status}`)

        if (data.body.status === "active" && data.body.output) {
            console.log("✅ LightX: Image generation complete!")
            return data.body.output
        }

        if (data.body.status === "failed") {
            throw new Error("LightX image generation failed")
        }

        // Status is still "init" - wait and retry
        if (attempt < maxRetries) {
            await new Promise(resolve => setTimeout(resolve, delayMs))
        }
    }

    throw new Error("LightX image generation timed out - max retries exceeded")
}

/**
 * Generate an image using LightX AI Image Generator API
 * @param prompt - Text description of the image to generate
 * @param options - Optional generation parameters
 * @returns Blob URL of the generated image
 */
export async function generateImageWithLightX(
    prompt: string,
    options?: Partial<LightXGenerateOptions>
): Promise<string> {
    if (LIGHTX_API_KEYS.length === 0) {
        throw new Error("LightX API key is required. Set VITE_LIGHTX_API_KEY in your .env file")
    }

    const {
        resolution = "2:3", // Portrait orientation for characters
        enhancePrompt = true, // Enable prompt enhancement for better quality
    } = options || {}

    console.log("📤 LightX API Request:")
    console.log("   Resolution:", resolution)
    console.log("   Enhance Prompt:", enhancePrompt)
    console.log("   Prompt (first 300 chars):", prompt.substring(0, 300))
    console.log("   Prompt length:", prompt.length)

    return await withApiFallback(
        LIGHTX_API_KEYS,
        async (apiKey) => {
            // Step 1: Submit the image generation request
            const requestBody = {
                textPrompt: prompt.trim(),
                resolution,
                enhancePrompt,
            }

            const initResponse = await fetch(LIGHTX_TEXT2IMAGE_URL, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "x-api-key": apiKey,
                },
                body: JSON.stringify(requestBody),
            })

            if (!initResponse.ok) {
                let errorData: any = {}
                try {
                    errorData = await initResponse.json()
                } catch {
                    errorData = { message: initResponse.statusText }
                }
                throw new Error(
                    `LightX API error: ${initResponse.status} ${initResponse.statusText} - ${JSON.stringify(errorData)}`
                )
            }

            const initData: LightXInitResponse = await initResponse.json()

            // Check for initialization errors
            if (initData.statusCode !== 2000 || initData.body.status === "failed") {
                throw new Error(`LightX initialization failed: ${initData.message}`)
            }

            const { orderId, maxRetriesAllowed, avgResponseTimeInSec } = initData.body
            console.log(`🎫 LightX: Order created - ID: ${orderId}`)
            console.log(`   Estimated time: ${avgResponseTimeInSec}s, Max retries: ${maxRetriesAllowed}`)

            // Wait a bit before first status check (based on average response time)
            const initialWait = Math.min(avgResponseTimeInSec * 1000, 5000)
            await new Promise(resolve => setTimeout(resolve, initialWait))

            // Step 2: Poll for the result
            const imageUrl = await pollOrderStatus(orderId, apiKey, maxRetriesAllowed, 3000)

            // Fetch the image and convert to blob URL
            const imageResponse = await fetch(imageUrl)
            if (!imageResponse.ok) {
                throw new Error(`Failed to fetch generated image: ${imageResponse.statusText}`)
            }

            const blob = await imageResponse.blob()
            return URL.createObjectURL(blob)
        }
    )
}

/**
 * Generate image with specific resolution presets
 */
export async function generateLightXSquare(prompt: string): Promise<string> {
    return generateImageWithLightX(prompt, { resolution: "1:1" })
}

export async function generateLightXPortrait(prompt: string): Promise<string> {
    return generateImageWithLightX(prompt, { resolution: "2:3" })
}

export async function generateLightXLandscape(prompt: string): Promise<string> {
    return generateImageWithLightX(prompt, { resolution: "16:9" })
}
