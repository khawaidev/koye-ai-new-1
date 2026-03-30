/**
 * Seedance Video Generation Service
 * 
 * Uses the Hypereal API for Seedance 1.5 Pro video generation.
 * Supports both text-to-video (T2V) and image+text-to-video (I2V).
 * 
 * Endpoint: POST https://api.hypereal.tech/v1/videos/generate
 * Docs: hyperal-video-ge.md
 */

import { getApiKeys, withApiFallback } from "../lib/apiFallback"

const HYPEREAL_API_KEYS = getApiKeys("VITE_HYPERREAL_API_KEY")
const HYPEREAL_VIDEO_URL = "https://api.hypereal.tech/v1/videos/generate"

// Polling endpoint (derived from generate endpoint)
const HYPEREAL_VIDEO_STATUS_URL = "https://api.hypereal.tech/v1/videos/status"

export type SeedanceModel = "seedance-1.5-pro-t2v" | "seedance-1.5-pro-i2v"

export interface SeedanceGenerateOptions {
  prompt: string
  image?: string // Source image URL (for I2V mode)
  duration?: number // Video duration in seconds
  model?: SeedanceModel // Defaults based on whether image is provided
}

export interface SeedanceGenerateResponse {
  jobId: string
  status: "processing" | "succeeded" | "failed" | "starting"
  message?: string
  creditsUsed?: number
  outputUrl?: string // Available when completed
}

/**
 * Generate a video using Seedance 1.5 Pro via Hypereal API
 * Automatically selects T2V or I2V model based on whether an image is provided.
 */
export async function generateVideoWithSeedance(
  options: SeedanceGenerateOptions
): Promise<SeedanceGenerateResponse> {
  if (HYPEREAL_API_KEYS.length === 0) {
    throw new Error("Hypereal API key is required. Set VITE_HYPERREAL_API_KEY in your .env file")
  }

  const {
    prompt,
    image,
    duration = 5,
    model,
  } = options

  // Auto-select model: I2V if image is provided, T2V otherwise
  const selectedModel = model || (image ? "seedance-1.5-pro-i2v" : "seedance-1.5-pro-t2v")

  return await withApiFallback(
    HYPEREAL_API_KEYS,
    async (apiKey) => {
      const input: any = {
        prompt: prompt.trim(),
        duration,
      }

      if (image) {
        input.image = image
      }

      const requestBody: any = {
        model: selectedModel,
        input,
      }

      const response = await fetch(HYPEREAL_VIDEO_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
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
          `Seedance API error: ${response.status} ${response.statusText} - ${JSON.stringify(errorData)}`
        )
      }

      const data = await response.json()

      if (!data.jobId) {
        throw new Error("No jobId in Seedance response")
      }

      return {
        jobId: data.jobId,
        status: data.status || "processing",
        message: data.message,
        creditsUsed: data.creditsUsed,
        outputUrl: data.outputUrl,
      } as SeedanceGenerateResponse
    }
  )
}

/**
 * Check the status of a Seedance video generation job
 */
export async function checkSeedanceVideoStatus(
  jobId: string
): Promise<SeedanceGenerateResponse> {
  if (HYPEREAL_API_KEYS.length === 0) {
    throw new Error("Hypereal API key is required. Set VITE_HYPERREAL_API_KEY in your .env file")
  }

  return await withApiFallback(
    HYPEREAL_API_KEYS,
    async (apiKey) => {
      const response = await fetch(`${HYPEREAL_VIDEO_STATUS_URL}/${jobId}`, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${apiKey}`,
        },
      })

      if (!response.ok) {
        let errorData: any = {}
        try {
          errorData = await response.json()
        } catch {
          errorData = { message: response.statusText }
        }
        throw new Error(
          `Seedance status API error: ${response.status} ${response.statusText} - ${JSON.stringify(errorData)}`
        )
      }

      const data = await response.json()

      return {
        jobId: data.jobId || jobId,
        status: (data.status || "processing").toLowerCase(),
        message: data.message,
        creditsUsed: data.creditsUsed,
        outputUrl: data.outputUrl || data.output_url || data.url,
      } as SeedanceGenerateResponse
    }
  )
}

/**
 * Poll Seedance video generation until completion
 * @param jobId - The job ID from generateVideoWithSeedance
 * @param onProgress - Optional callback for progress updates
 * @param pollInterval - Polling interval in milliseconds (default: 3000)
 * @param maxAttempts - Maximum polling attempts (default: 120 — 6 minutes)
 * @returns Final video URL
 */
export async function pollSeedanceVideoGeneration(
  jobId: string,
  onProgress?: (status: SeedanceGenerateResponse) => void,
  pollInterval: number = 3000,
  maxAttempts: number = 120
): Promise<string> {
  let attempts = 0

  while (attempts < maxAttempts) {
    const status = await checkSeedanceVideoStatus(jobId)

    if (onProgress) {
      onProgress(status)
    }

    if (status.status === "succeeded") {
      if (!status.outputUrl) {
        throw new Error("Video generation succeeded but no output URL provided")
      }
      return status.outputUrl
    }

    if (status.status === "failed") {
      throw new Error(status.message || "Video generation failed")
    }

    // Wait before next poll
    await new Promise((resolve) => setTimeout(resolve, pollInterval))
    attempts++
  }

  throw new Error("Video generation timeout: Maximum polling attempts reached")
}
