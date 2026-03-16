// Banana API Service (NanoBanana API)
// API: https://api.nanobananaapi.ai/api/v1/nanobanana/generate

import { getApiKeys, withApiFallback } from "../lib/apiFallback"

// Get API keys with fallback support
const BANANA_API_KEYS = getApiKeys("VITE_BANANA_API_KEY")
const BANANA_CALLBACK_SERVER_URL = import.meta.env.VITE_BANANA_CALLBACK_SERVER_URL || ""

export interface BananaGenerateOptions {
  prompt: string
  numImages?: number
  type?: string
  image_size?: string
  model?: string // Model name: koye2dv1.5, koye2dv2, etc.
  callBackUrl?: string // Required by API, but we'll try polling if not provided
}

/**
 * Poll Banana API for task status and retrieve generated images
 * @param taskId - Task ID returned from the generate endpoint
 * @returns Blob URL(s) of the generated image(s)
 */
async function pollBananaStatus(taskId: string): Promise<string | string[]> {
  const maxAttempts = 60 // Poll for up to 60 attempts (5 minutes if 5s intervals)
  const pollInterval = 5000 // Poll every 5 seconds
  let attempts = 0

  // If we have a callback server URL, poll that instead
  const callbackServerUrl = BANANA_CALLBACK_SERVER_URL

  while (attempts < maxAttempts) {
    await new Promise(resolve => setTimeout(resolve, pollInterval))
    attempts++

    try {
      // If we have a callback server, poll it first
      if (callbackServerUrl) {
        const callbackResponse = await fetch(`${callbackServerUrl}/result/${taskId}`, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json'
          }
        })

        if (callbackResponse.ok) {
          const callbackData = await callbackResponse.json()
          console.log(`Banana API Status from callback server (attempt ${attempts}):`, callbackData)

          // Check if we have the result
          if (callbackData.code === 200 && callbackData.data) {
            // The callback server stores the Banana API response
            // Structure: { code: 200, msg: 'success', data: { taskId, code, msg, data: { images/urls }, fullResponse: {...} } }
            const storedData = callbackData.data

            // Try multiple extraction paths
            let imageData = null

            // Path 1: Check storedData.data (nested Banana API response) - this contains info.resultImageUrl
            if (storedData.data) {
              imageData = storedData.data
              console.log('Trying extraction from storedData.data:', imageData)
            }
            // Path 2: Check storedData.fullResponse.data (full Banana API callback data)
            else if (storedData.fullResponse?.data) {
              imageData = storedData.fullResponse.data
              console.log('Trying extraction from storedData.fullResponse.data:', imageData)
            }
            // Path 3: Check storedData.fullResponse (full Banana API callback)
            else if (storedData.fullResponse) {
              imageData = storedData.fullResponse
              console.log('Trying extraction from storedData.fullResponse:', imageData)
            }
            // Path 4: Check storedData directly
            else {
              imageData = storedData
              console.log('Trying extraction from storedData:', imageData)
            }

            // Try to extract images from the found data
            if (imageData) {
              try {
                return await extractImagesFromResponse(imageData)
              } catch (error) {
                console.warn('Failed to extract from imageData, trying alternative paths:', error)
              }
            }

            // Fallback: Try extracting from all possible locations
            const allPossibleData = [
              storedData.data,
              storedData.fullResponse?.data,
              storedData.fullResponse,
              storedData,
              callbackData.data,
              callbackData
            ]

            for (const possibleData of allPossibleData) {
              if (possibleData) {
                try {
                  const result = await extractImagesFromResponse(possibleData)
                  if (result) {
                    console.log('Successfully extracted images from alternative path')
                    return result
                  }
                } catch {
                  // Continue trying other paths
                }
              }
            }

            // Log the full structure for debugging
            console.error('Could not extract images. Full callback data structure:', JSON.stringify(callbackData, null, 2))
          }
        }
      }

      // Fallback: Try Banana API endpoints directly (may not work)
      // Use first available API key for polling
      const pollingApiKey = BANANA_API_KEYS[0] || ""

      // Pattern 1: /task/{taskId}
      let statusResponse = await fetch(`https://api.nanobananaapi.ai/api/v1/nanobanana/task/${taskId}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${pollingApiKey}`,
          'Content-Type': 'application/json'
        }
      })

      // Pattern 2: /get/{taskId}
      if (!statusResponse.ok && statusResponse.status === 404) {
        statusResponse = await fetch(`https://api.nanobananaapi.ai/api/v1/nanobanana/get/${taskId}`, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${pollingApiKey}`,
            'Content-Type': 'application/json'
          }
        })
      }

      // Pattern 3: /retrieve/{taskId}
      if (!statusResponse.ok && statusResponse.status === 404) {
        statusResponse = await fetch(`https://api.nanobananaapi.ai/api/v1/nanobanana/retrieve/${taskId}`, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${pollingApiKey}`,
            'Content-Type': 'application/json'
          }
        })
      }

      // Pattern 4: POST to /result with taskId in body
      if (!statusResponse.ok && statusResponse.status === 404) {
        statusResponse = await fetch(`https://api.nanobananaapi.ai/api/v1/nanobanana/result`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${pollingApiKey}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ taskId })
        })
      }

      // Pattern 5: GET /result/{taskId}
      if (!statusResponse.ok && statusResponse.status === 404) {
        statusResponse = await fetch(`https://api.nanobananaapi.ai/api/v1/nanobanana/result/${taskId}`, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${pollingApiKey}`,
            'Content-Type': 'application/json'
          }
        })
      }

      if (statusResponse.ok) {
        const statusData = await statusResponse.json()
        console.log(`Banana API Status (attempt ${attempts}):`, statusData)

        // Check if task is completed
        if (statusData.code === 200 && statusData.data) {
          // Task completed, extract images
          if (statusData.data.status === 'completed' || statusData.data.status === 'success' || statusData.data.images || statusData.data.image_url) {
            return extractImagesFromResponse(statusData.data)
          }
        }

        // If response has images directly, extract them
        if (statusData.data?.images || statusData.images || statusData.data?.image_url || statusData.image_url) {
          return extractImagesFromResponse(statusData)
        }
      } else {
        // If all endpoints return 404, continue polling the callback server
        if (attempts === 1 && !callbackServerUrl) {
          console.warn(`Banana API polling endpoints not found. Task ID: ${taskId}. Make sure VITE_BANANA_CALLBACK_SERVER_URL is set.`)
        }
      }
    } catch (error) {
      console.warn(`Error polling Banana status (attempt ${attempts}):`, error)
    }
  }

  throw new Error(`Banana API task ${taskId} timed out after ${maxAttempts} attempts. The API might require a callback URL. Check the console for the initial response format.`)
}

/**
 * Extract image URLs from Banana API response and convert to blob URLs
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function extractImagesFromResponse(data: any): Promise<string | string[]> {
  // Try various response formats
  let imageUrls: string[] = []

  // Banana API specific: Check for info.resultImageUrl
  if (data?.info?.resultImageUrl) {
    imageUrls = [data.info.resultImageUrl]
  }
  else if (data?.data?.info?.resultImageUrl) {
    imageUrls = [data.data.info.resultImageUrl]
  }
  // Check for array of images
  else if (data?.images && Array.isArray(data.images)) {
    imageUrls = data.images
  }
  // Check for single image URL fields
  else if (data?.image_url) {
    imageUrls = [data.image_url]
  }
  else if (data?.url) {
    imageUrls = [data.url]
  }
  // Check nested data structure
  else if (data?.data?.images && Array.isArray(data.data.images)) {
    imageUrls = data.data.images
  }
  else if (data?.data?.image_url) {
    imageUrls = [data.data.image_url]
  }
  else if (data?.data?.url) {
    imageUrls = [data.data.url]
  }
  // Check for imageUrl (camelCase)
  else if (data?.imageUrl) {
    imageUrls = [data.imageUrl]
  }
  else if (data?.data?.imageUrl) {
    imageUrls = [data.data.imageUrl]
  }
  // Check for imageUrls (plural, camelCase)
  else if (data?.imageUrls && Array.isArray(data.imageUrls)) {
    imageUrls = data.imageUrls
  }
  else if (data?.data?.imageUrls && Array.isArray(data.data.imageUrls)) {
    imageUrls = data.data.imageUrls
  }
  // Check for resultImageUrl directly
  else if (data?.resultImageUrl) {
    imageUrls = [data.resultImageUrl]
  }
  else if (data?.data?.resultImageUrl) {
    imageUrls = [data.data.resultImageUrl]
  }

  if (imageUrls.length === 0) {
    console.error('No images found in response. Full data:', JSON.stringify(data, null, 2))
    throw new Error(`No images found in Banana API response: ${JSON.stringify(data)}`)
  }

  // Fetch images and convert to blob URLs
  const blobUrls = await Promise.all(
    imageUrls.map(async (imgUrl: string) => {
      const imageResponse = await fetch(imgUrl)
      if (!imageResponse.ok) {
        throw new Error(`Failed to fetch image from ${imgUrl}`)
      }
      const blob = await imageResponse.blob()
      return URL.createObjectURL(blob)
    })
  )

  return blobUrls.length === 1 ? blobUrls[0] : blobUrls
}

/**
 * Generate an image using Banana API (NanoBanana)
 * @param options - Generation options
 * @returns Blob URL of the generated image or array of URLs for multiple images
 */
export async function generateImageWithBanana(options: BananaGenerateOptions): Promise<string | string[]> {
  if (BANANA_API_KEYS.length === 0) {
    throw new Error("Banana API key is required. Set VITE_BANANA_API_KEY in your .env file")
  }

  return await withApiFallback(
    BANANA_API_KEYS,
    async (apiKey) => {
      const response = await fetch('https://api.nanobananaapi.ai/api/v1/nanobanana/generate', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          prompt: options.prompt,
          numImages: options.numImages || 1,
          type: options.type || "TEXTTOIAMGE",
          image_size: options.image_size || "16:9",
          model: options.model || "koye2dv1.5", // Default to koye2dv1.5
          callBackUrl: options.callBackUrl || (BANANA_CALLBACK_SERVER_URL ? `${BANANA_CALLBACK_SERVER_URL}/callback` : undefined)
        })
      })

      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`Banana API error: ${response.status} ${response.statusText} - ${errorText}`)
      }

      const data = await response.json()
      console.log("Banana API Response:", data)

      // Check various response formats
      // If it returns image URLs directly
      if (data.image_url || data.url || data.data?.image_url || data.data?.url) {
        const imageUrl = data.image_url || data.url || data.data?.image_url || data.data?.url
        const imageResponse = await fetch(imageUrl)
        const blob = await imageResponse.blob()
        return URL.createObjectURL(blob)
      }

      // If it returns an array of image URLs
      if (Array.isArray(data.images) || Array.isArray(data.data?.images)) {
        const imageUrls = Array.isArray(data.images) ? data.images : data.data.images
        const blobUrls = await Promise.all(
          imageUrls.map(async (imgUrl: string) => {
            const imageResponse = await fetch(imgUrl)
            const blob = await imageResponse.blob()
            return URL.createObjectURL(blob)
          })
        )
        return blobUrls.length === 1 ? blobUrls[0] : blobUrls
      }

      // If it returns base64 image
      if (data.image || data.data?.image) {
        const base64Data = (data.image || data.data.image).replace(/^data:image\/\w+;base64,/, '')
        const binaryString = atob(base64Data)
        const bytes = new Uint8Array(binaryString.length)
        for (let i = 0; i < binaryString.length; i++) {
          bytes[i] = binaryString.charCodeAt(i)
        }
        const blob = new Blob([bytes], { type: 'image/png' })
        return URL.createObjectURL(blob)
      }

      // Banana API returns a taskId - according to docs it uses callbacks, but we'll try polling
      if (data.code === 200 && (data.data?.taskId || data.taskId || data.data?.task_id || data.task_id)) {
        const taskId = data.data?.taskId || data.taskId || data.data?.task_id || data.task_id
        console.log("Banana API returned taskId:", taskId)
        console.warn("Note: Banana API typically uses callback URLs. Polling may not work. Consider providing a callBackUrl.")

        // Try to poll for the result (may not work if API only supports callbacks)
        return await pollBananaStatus(taskId)
      }

      // If none of the above matched, log and throw error
      console.error("Banana API unexpected response format:", JSON.stringify(data, null, 2))
      throw new Error(`Unexpected response format from Banana API. Response: ${JSON.stringify(data)}`)
    }
  )
}

