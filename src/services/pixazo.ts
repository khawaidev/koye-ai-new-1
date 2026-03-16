// Pixazo API Service
// Documentation: https://gateway.pixazo.ai/byteplus/v1/getTextToImage
// Endpoint: https://gateway.pixazo.ai/byteplus/v1/getTextToImage

import { getApiKeys, withApiFallback } from "../lib/apiFallback"

// Get API keys with fallback support
const PIXAZO_API_KEYS = getApiKeys("VITE_PIXAZO_API_KEY")
const PIXAZO_API_URL = "https://gateway.pixazo.ai/byteplus/v1/getTextToImage"

export interface PixazoGenerateOptions {
  prompt: string
  model?: string // Default: "seedream-3-0-t2i-250415" for 2D character design
  size?: string // e.g., "1024x1024", "512x512"
  guidance_scale?: number // Default: 2.5
  watermark?: boolean // Default: true
}

/**
 * Generate a single image from a text prompt using Pixazo API
 * @param prompt - Text description of the image to generate
 * @param options - Optional parameters for image generation
 * @returns Blob URL of the generated image
 */
export async function generateImageWithPixazo(
  prompt: string,
  options?: Partial<PixazoGenerateOptions>
): Promise<string> {
  if (PIXAZO_API_KEYS.length === 0) {
    throw new Error("Pixazo API key is required. Set VITE_PIXAZO_API_KEY in your .env file")
  }

  const {
    model = "seedream-3-0-t2i-250415", // Default model for 2D character design
    size = "1024x1024",
    guidance_scale = 2.5,
    watermark = true,
  } = options || {}

  return await withApiFallback(
    PIXAZO_API_KEYS,
    async (apiKey) => {
      const requestBody = {
        model,
        prompt: prompt.trim(),
        size,
        guidance_scale,
        watermark,
      }

      console.log("📤 Pixazo API Request:")
      console.log("   Model:", model)
      console.log("   Size:", size)
      console.log("   Prompt (first 300 chars):", prompt.substring(0, 300))
      console.log("   Prompt length:", prompt.length)

      const response = await fetch(PIXAZO_API_URL, {
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
          `Pixazo API error: ${response.status} ${response.statusText} - ${JSON.stringify(errorData)}`
        )
      }

      const data = await response.json()

      // Check for error in response
      if (data.error) {
        throw new Error(`Pixazo API error: ${data.error.message || data.error}`)
      }

      // Extract image URL from response
      // Response format: { "created": number, "data": [{ "url": "..." }], "usage": { "generated_images": number } }
      if (!data.data || !Array.isArray(data.data) || data.data.length === 0) {
        throw new Error("Pixazo API error: No image URL in response")
      }

      const imageUrl = data.data[0].url

      if (!imageUrl) {
        throw new Error("Pixazo API error: Invalid image URL in response")
      }

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

