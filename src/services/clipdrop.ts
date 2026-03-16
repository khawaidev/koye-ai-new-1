// ClipDrop API Service
// Documentation: https://clipdrop.co/api
// Endpoint: https://clipdrop-api.co/text-to-image/v1

import { getApiKeys, withApiFallback } from "../lib/apiFallback"

// Get API keys with fallback support
const CLIPDROP_API_KEYS = getApiKeys("VITE_CLIPDROP_API_KEY")
const CLIPDROP_API_URL = "https://clipdrop-api.co/text-to-image/v1"

/**
 * Generate a single image from a text prompt
 * @param prompt - Text description of the image to generate
 * @returns Blob URL of the generated image
 */
export async function generateImage(prompt: string): Promise<string> {
  if (CLIPDROP_API_KEYS.length === 0) {
    throw new Error("ClipDrop API key is required. Set VITE_CLIPDROP_API_KEY in your .env file")
  }

  // Final validation: ensure prompt is under 5000 characters
  const validatedPrompt = prompt.length > 5000 ? prompt.substring(0, 5000).trim() : prompt

  return await withApiFallback(
    CLIPDROP_API_KEYS,
    async (apiKey) => {
      const form = new FormData()
      form.append('prompt', validatedPrompt)

      console.log("📤 ClipDrop API Request:")
      console.log("   Prompt (first 300 chars):", validatedPrompt.substring(0, 300))
      console.log("   Prompt length:", validatedPrompt.length)

      const response = await fetch(CLIPDROP_API_URL, {
        method: 'POST',
        headers: {
          'x-api-key': apiKey,
        },
        body: form,
      })

      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`ClipDrop API error: ${response.status} ${response.statusText} - ${errorText}`)
      }

      // Get response as ArrayBuffer, then convert to Blob
      const arrayBuffer = await response.arrayBuffer()
      const blob = new Blob([arrayBuffer], { type: 'image/png' })
      const url = URL.createObjectURL(blob)

      return url
    }
  )
}

/**
 * Generate four orthographic views (front, left, right, back) for 3D model generation
 * Front: ClipDrop with T-pose, white background
 * Left/Right/Back: Gemini image model using front image as input
 * @param prompt - Base prompt describing the game asset
 * @returns Object containing URLs for all four views
 */
export async function generateFourViews(
  prompt: string
): Promise<Record<"front" | "left" | "right" | "back", string>> {
  if (CLIPDROP_API_KEYS.length === 0) {
    throw new Error("ClipDrop API key is required. Set VITE_CLIPDROP_API_KEY in your .env file")
  }

  // Import Gemini function dynamically to avoid circular dependencies
  const { generateImageFromImage } = await import("./gemini")

  // Step 1: Generate front image with ClipDrop (T-pose, white background)
  const frontPrompt = `${prompt}, front view, T-pose, strict T-pose, arms extended horizontally, legs straight, orthographic projection, character sheet, clean white background, technical drawing style`

  // Validate and truncate front prompt
  const validatedFrontPrompt = frontPrompt.length > 5000 ? frontPrompt.substring(0, 5000).trim() : frontPrompt

  console.log("Generating front image with ClipDrop...")
  const frontImageUrl = await generateImage(validatedFrontPrompt)

  // Add delay before generating other views (avoid rate limits)
  await new Promise(resolve => setTimeout(resolve, 2000))

  // Step 2: Generate left, right, back views using Gemini image model
  // Gemini will analyze the front image and create enhanced prompts, then ClipDrop generates the images
  const otherViews: Array<{ view: "left" | "right" | "back"; prompt: string }> = [
    {
      view: "left",
      prompt: "left side view"
    },
    {
      view: "right",
      prompt: "right side view"
    },
    {
      view: "back",
      prompt: "back view"
    }
  ]

  const otherViewUrls: Record<"left" | "right" | "back", string> = {
    left: "",
    right: "",
    back: "",
  }

  // Generate other views sequentially with delays to avoid rate limits
  for (let i = 0; i < otherViews.length; i++) {
    const { view, prompt: viewPrompt } = otherViews[i]

    try {
      console.log(`Generating ${view} view with Gemini image model...`)
      const viewImageUrl = await generateImageFromImage(frontImageUrl, viewPrompt)
      otherViewUrls[view] = viewImageUrl

      // Add delay between requests (2 seconds between each)
      if (i < otherViews.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 2000))
      }
    } catch (error) {
      console.error(`Error generating ${view} view:`, error)
      // If Gemini fails, fallback to ClipDrop for this view
      const fallbackPrompt = `${prompt}, ${view} view, orthographic, character sheet, clean white background`
      const validatedFallback = fallbackPrompt.length > 5000 ? fallbackPrompt.substring(0, 5000).trim() : fallbackPrompt
      otherViewUrls[view] = await generateImage(validatedFallback)

      // Add delay after fallback
      if (i < otherViews.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 2000))
      }
    }
  }

  return {
    front: frontImageUrl,
    left: otherViewUrls.left,
    right: otherViewUrls.right,
    back: otherViewUrls.back,
  }
}

/**
 * Image-to-image transformation using ClipDrop
 * @param imageFile - Source image file
 * @param prompt - Text description of desired transformation
 * @returns Blob URL of the transformed image
 */
export async function imageToImage(
  imageFile: File,
  prompt: string
): Promise<string> {
  if (CLIPDROP_API_KEYS.length === 0) {
    throw new Error("ClipDrop API key is required. Set VITE_CLIPDROP_API_KEY in your .env file")
  }

  return await withApiFallback(
    CLIPDROP_API_KEYS,
    async (apiKey) => {
      const form = new FormData()
      form.append('image_file', imageFile)
      form.append('prompt', prompt)

      const response = await fetch("https://clipdrop-api.co/image-to-image/v1", {
        method: "POST",
        headers: {
          "x-api-key": apiKey,
        },
        body: form,
      })

      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`ClipDrop API error: ${response.status} ${response.statusText} - ${errorText}`)
      }

      // Get response as ArrayBuffer, then convert to Blob
      const arrayBuffer = await response.arrayBuffer()
      const blob = new Blob([arrayBuffer], { type: 'image/png' })
      const url = URL.createObjectURL(blob)

      return url
    }
  )
}

/**
 * Image-to-image transformation using ClipDrop from a blob URL
 * @param imageUrl - URL of the source image (blob URL)
 * @param prompt - Text description of desired transformation
 * @returns Blob URL of the transformed image
 */
export async function imageToImageFromUrl(
  imageUrl: string,
  prompt: string
): Promise<string> {
  if (CLIPDROP_API_KEYS.length === 0) {
    throw new Error("ClipDrop API key is required. Set VITE_CLIPDROP_API_KEY in your .env file")
  }

  // Fetch the image from URL and convert to File
  const response = await fetch(imageUrl)
  const blob = await response.blob()
  const imageFile = new File([blob], "image.png", { type: "image/png" })

  return await imageToImage(imageFile, prompt)
}

/**
 * Replace background of an image using ClipDrop API
 * @param imageFile - Source image file
 * @param prompt - Description of the new background
 * @returns Blob URL of the image with replaced background
 */
export async function replaceBackground(
  imageFile: File,
  prompt: string
): Promise<string> {
  if (CLIPDROP_API_KEYS.length === 0) {
    throw new Error("ClipDrop API key is required. Set VITE_CLIPDROP_API_KEY in your .env file")
  }

  return await withApiFallback(
    CLIPDROP_API_KEYS,
    async (apiKey) => {
      const form = new FormData()
      form.append('image_file', imageFile)
      form.append('prompt', prompt)

      const response = await fetch("https://clipdrop-api.co/replace-background/v1", {
        method: "POST",
        headers: {
          "x-api-key": apiKey,
        },
        body: form,
      })

      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`ClipDrop API error: ${response.status} ${response.statusText} - ${errorText}`)
      }

      // Get response as ArrayBuffer, then convert to Blob
      const arrayBuffer = await response.arrayBuffer()
      const blob = new Blob([arrayBuffer], { type: 'image/png' })
      const url = URL.createObjectURL(blob)

      return url
    }
  )
}

/**
 * Replace background from a URL
 * @param imageUrl - URL of the source image
 * @param prompt - Description of the new background
 * @returns Blob URL of the image with replaced background
 */
export async function replaceBackgroundFromUrl(
  imageUrl: string,
  prompt: string
): Promise<string> {
  // Fetch the image from URL and convert to File
  const response = await fetch(imageUrl)
  const blob = await response.blob()
  const imageFile = new File([blob], "image.png", { type: "image/png" })

  return await replaceBackground(imageFile, prompt)
}
