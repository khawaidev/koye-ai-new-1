// Veo 3.1 Video Generation API Service
// Documentation: https://gateway.pixazo.ai/veo/v1
// Endpoint: https://gateway.pixazo.ai/veo/v1/veo-3.1/generate

import { getApiKeys, withApiFallback } from "../lib/apiFallback"

// Get API keys with fallback support
const VEO_API_KEYS = getApiKeys("VITE_PIXAZO_API_KEY")
const VEO_BASE_URL = "https://gateway.pixazo.ai/veo/v1"

export interface VeoGenerateOptions {
  prompt: string
  aspect_ratio?: "16:9" | "9:16" // Default: "16:9"
  duration?: 4 | 6 | 8 // Default: 8
  resolution?: "720p" | "1080p" // Default: "1080p"
  generate_audio?: boolean // Default: true
  negative_prompt?: string
  image?: string // Input image URL for image-to-video
  last_frame?: string // Ending image URL for interpolation
  reference_images?: string[] // 1-3 reference images for R2V
  seed?: number
  webhook?: string
}

export interface VeoGenerateResponse {
  success: boolean
  id: string
  status: "starting" | "processing" | "succeeded" | "failed" | "canceled"
  input?: {
    prompt: string
    aspect_ratio?: string
    duration?: number
    resolution?: string
    generate_audio?: boolean
  }
  output?: string // Video URL when status is "succeeded"
  created_at?: string
}

/**
 * Generate a video using Veo 3.1 API
 * @param options - Video generation options
 * @returns Promise with prediction ID
 */
export async function generateVideoWithVeo(
  options: VeoGenerateOptions
): Promise<VeoGenerateResponse> {
  if (VEO_API_KEYS.length === 0) {
    throw new Error("Pixazo API key is required. Set VITE_PIXAZO_API_KEY in your .env file")
  }

  const {
    prompt,
    aspect_ratio = "16:9",
    duration = 8,
    resolution = "1080p",
    generate_audio = true,
    negative_prompt,
    image,
    last_frame,
    reference_images,
    seed,
    webhook,
  } = options

  return await withApiFallback(
    VEO_API_KEYS,
    async (apiKey) => {
      const requestBody: any = {
        prompt: prompt.trim(),
        aspect_ratio,
        duration,
        resolution,
        generate_audio,
      }

      if (negative_prompt) requestBody.negative_prompt = negative_prompt
      if (image) requestBody.image = image
      if (last_frame) requestBody.last_frame = last_frame
      if (reference_images && reference_images.length > 0) {
        requestBody.reference_images = reference_images
      }
      if (seed !== undefined) requestBody.seed = seed
      if (webhook) requestBody.webhook = webhook

      const response = await fetch(`${VEO_BASE_URL}/veo-3.1/generate`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": "no-cache",
          "Ocp-Apim-Subscription-Key": apiKey,
        },
        body: JSON.stringify(requestBody),
      })

      if (!response.ok) {
        let errorData: any = {}
        try {
          errorData = await response.json()
        } catch {
          errorData = { message: response.statusText }
        }
        throw new Error(
          `Veo API error: ${response.status} ${response.statusText} - ${JSON.stringify(errorData)}`
        )
      }

      const data = await response.json()

      // Check for error in response
      if (data.error || !data.success) {
        throw new Error(`Veo API error: ${data.error?.message || data.error || "Unknown error"}`)
      }

      return data as VeoGenerateResponse
    }
  )
}

/**
 * Check the status of a video generation task
 * @param predictionId - The prediction ID from generateVideoWithVeo
 * @returns Promise with current status and output URL if completed
 */
export async function checkVideoStatus(
  predictionId: string
): Promise<VeoGenerateResponse> {
  if (VEO_API_KEYS.length === 0) {
    throw new Error("Pixazo API key is required. Set VITE_PIXAZO_API_KEY in your .env file")
  }

  return await withApiFallback(
    VEO_API_KEYS,
    async (apiKey) => {
      const response = await fetch(`${VEO_BASE_URL}/veo-3.1/prediction`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": "no-cache",
          "Ocp-Apim-Subscription-Key": apiKey,
        },
        body: JSON.stringify({
          prediction_id: predictionId,
        }),
      })

      if (!response.ok) {
        let errorData: any = {}
        try {
          errorData = await response.json()
        } catch {
          errorData = { message: response.statusText }
        }
        throw new Error(
          `Veo API error: ${response.status} ${response.statusText} - ${JSON.stringify(errorData)}`
        )
      }

      const data = await response.json()

      // Check for error in response
      if (data.error || !data.success) {
        throw new Error(`Veo API error: ${data.error?.message || data.error || "Unknown error"}`)
      }

      return data as VeoGenerateResponse
    }
  )
}

/**
 * Poll video generation status until completion
 * @param predictionId - The prediction ID from generateVideoWithVeo
 * @param onProgress - Optional callback for progress updates
 * @param pollInterval - Polling interval in milliseconds (default: 3000)
 * @param maxAttempts - Maximum polling attempts (default: 100)
 * @returns Promise with completed video URL
 */
export async function pollVideoGeneration(
  predictionId: string,
  onProgress?: (status: VeoGenerateResponse) => void,
  pollInterval: number = 3000,
  maxAttempts: number = 100
): Promise<string> {
  let attempts = 0

  while (attempts < maxAttempts) {
    const status = await checkVideoStatus(predictionId)

    if (onProgress) {
      onProgress(status)
    }

    if (status.status === "succeeded") {
      if (!status.output) {
        throw new Error("Video generation succeeded but no output URL provided")
      }
      return status.output
    }

    if (status.status === "failed") {
      throw new Error("Video generation failed")
    }

    if (status.status === "canceled") {
      throw new Error("Video generation was canceled")
    }

    // Wait before next poll
    await new Promise((resolve) => setTimeout(resolve, pollInterval))
    attempts++
  }

  throw new Error("Video generation timeout: Maximum polling attempts reached")
}

