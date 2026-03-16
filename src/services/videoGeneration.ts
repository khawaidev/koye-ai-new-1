// Video Generation Service using API Market
// Documentation: https://prod.api.market/api/v1/magicapi/illustration-to-animation-api

import { getApiKeys } from "../lib/apiFallback"

const API_MARKET_BASE_URL = "https://prod.api.market/api/v1/magicapi/illustration-to-animation-api"
const VERSION = "0486ff07368e816ec3d5c69b9581e7a09b55817f567a0d74caad9395c9295c77"

// Get API keys with fallback support
const API_MARKET_KEYS = getApiKeys("VITE_API_MARKET_KEY")

export interface VideoGenerationOptions {
  images: string[] // Array of image URLs (1-3 images)
  prompt?: string
  loop?: boolean
  maxWidth?: number
  maxHeight?: number
  interpolate?: boolean
  negativePrompt?: string
  colorCorrection?: boolean
}

export interface VideoPrediction {
  id: string
  status: "starting" | "processing" | "succeeded" | "failed" | "canceled"
  output?: string[] // Array of video URLs
  error?: string
  created_at?: string
  started_at?: string
  completed_at?: string
}

/**
 * Create a video generation prediction
 * @param options - Video generation options
 * @returns Prediction ID
 */
export async function createVideoPrediction(options: VideoGenerationOptions): Promise<string> {
  if (API_MARKET_KEYS.length === 0) {
    throw new Error("API Market key is required. Set VITE_API_MARKET_KEY in your .env file")
  }

  if (!options.images || options.images.length === 0) {
    throw new Error("At least one image is required for video generation")
  }

  if (options.images.length > 3) {
    throw new Error("Maximum 3 images are supported for video generation")
  }

  const apiKey = API_MARKET_KEYS[0] // Use first key

  const input: any = {
    loop: options.loop ?? false,
    prompt: options.prompt || "",
    max_width: options.maxWidth || 512,
    max_height: options.maxHeight || 512,
    interpolate: options.interpolate ?? false,
    negative_prompt: options.negativePrompt || "",
    color_correction: options.colorCorrection ?? true,
  }

  // Add images (image_1, image_2, image_3)
  options.images.forEach((imageUrl, index) => {
    input[`image_${index + 1}`] = imageUrl
  })

  const response = await fetch(`${API_MARKET_BASE_URL}/predictions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-market-key": apiKey,
    },
    body: JSON.stringify({
      version: VERSION,
      input,
    }),
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`Video generation API error: ${response.status} ${response.statusText} - ${errorText}`)
  }

  const data = await response.json()
  
  // Extract prediction ID from response
  const predictionId = data.id || data.prediction_id || data.predictionId
  
  if (!predictionId) {
    throw new Error("No prediction ID in response")
  }

  return predictionId
}

/**
 * Get the status and result of a video generation prediction
 * @param predictionId - The prediction ID from createVideoPrediction
 * @returns Prediction status and result
 */
export async function getVideoPrediction(predictionId: string): Promise<VideoPrediction> {
  if (API_MARKET_KEYS.length === 0) {
    throw new Error("API Market key is required. Set VITE_API_MARKET_KEY in your .env file")
  }

  const apiKey = API_MARKET_KEYS[0] // Use first key

  const response = await fetch(`${API_MARKET_BASE_URL}/predictions/${predictionId}`, {
    method: "GET",
    headers: {
      "x-api-market-key": apiKey,
    },
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`Video generation API error: ${response.status} ${response.statusText} - ${errorText}`)
  }

  const data = await response.json()

  // Normalize the response structure
  const status = data.status || data.state || "unknown"
  const output = data.output || data.result?.output || data.result || []
  
  // Ensure output is an array
  const outputArray = Array.isArray(output) ? output : output ? [output] : []

  return {
    id: predictionId,
    status: status.toLowerCase() as VideoPrediction["status"],
    output: outputArray.length > 0 ? outputArray : undefined,
    error: data.error || data.message,
    created_at: data.created_at || data.createdAt,
    started_at: data.started_at || data.startedAt,
    completed_at: data.completed_at || data.completedAt,
  }
}

/**
 * Poll for video generation completion
 * @param predictionId - The prediction ID
 * @param onProgress - Optional callback for progress updates
 * @param maxAttempts - Maximum polling attempts (default: 60)
 * @param intervalMs - Polling interval in milliseconds (default: 2000)
 * @returns Final prediction result
 */
export async function pollVideoPrediction(
  predictionId: string,
  onProgress?: (status: string) => void,
  maxAttempts: number = 60,
  intervalMs: number = 2000
): Promise<VideoPrediction> {
  let attempts = 0

  while (attempts < maxAttempts) {
    const prediction = await getVideoPrediction(predictionId)

    if (onProgress) {
      onProgress(prediction.status)
    }

    if (prediction.status === "succeeded") {
      return prediction
    }

    if (prediction.status === "failed" || prediction.status === "canceled") {
      throw new Error(prediction.error || `Video generation ${prediction.status}`)
    }

    // Wait before next poll
    await new Promise((resolve) => setTimeout(resolve, intervalMs))
    attempts++
  }

  throw new Error("Video generation timeout: Maximum polling attempts reached")
}

