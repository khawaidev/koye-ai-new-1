// DeAPI Service
// Documentation: https://docs.gamercoin.com/depin-api/api/text-to-image

const DEAPI_API_KEY = import.meta.env.VITE_DEAPI_API_KEY || ""

export interface DeAPIGenerateOptions {
  prompt: string
  negative_prompt?: string
  model?: string
  loras?: Array<{ name: string; weight: number }>
  width?: number
  height?: number
  guidance?: number
  steps?: number
  seed?: number
}

/**
 * Poll DeAPI for request status and retrieve generated image
 * @param requestId - Request ID returned from the txt2img endpoint
 * @returns Blob URL of the generated image
 */
async function pollDeAPIStatus(requestId: string): Promise<string> {
  const maxAttempts = 60 // Poll for up to 60 attempts (5 minutes if 5s intervals)
  const pollInterval = 5000 // Poll every 5 seconds
  let attempts = 0

  while (attempts < maxAttempts) {
    await new Promise(resolve => setTimeout(resolve, pollInterval))
    attempts++

    try {
      // Try to get request results - based on "Get Results" endpoint from docs
      const statusResponse = await fetch(`https://api.deapi.ai/api/v1/client/results/${requestId}`, {
        method: 'GET',
        headers: {
          "Authorization": `Bearer ${DEAPI_API_KEY}`,
          "Accept": "application/json"
        }
      })

      if (!statusResponse.ok) {
        // If results endpoint doesn't exist, try alternative endpoints
        if (statusResponse.status === 404) {
          // Try status endpoint
          const altResponse = await fetch(`https://api.deapi.ai/api/v1/client/status/${requestId}`, {
            method: 'GET',
            headers: {
              "Authorization": `Bearer ${DEAPI_API_KEY}`,
              "Accept": "application/json"
            }
          })

          if (altResponse.ok) {
            const altData = await altResponse.json()
            return extractImageFromDeAPIResponse(altData)
          }
        }
        continue // Keep polling
      }

      const statusData = await statusResponse.json()
      console.log(`DeAPI Status (attempt ${attempts}):`, statusData)

      // Check if request is completed
      if (statusData.data) {
        // Task completed, extract image
        if (statusData.data.status === 'completed' || statusData.data.status === 'success' || statusData.data.image_url || statusData.data.image) {
          return extractImageFromDeAPIResponse(statusData.data)
        }
        // Task failed
        if (statusData.data.status === 'failed' || statusData.data.status === 'error') {
          throw new Error(`DeAPI request failed: ${statusData.data.error || statusData.data.message || 'Unknown error'}`)
        }
        // Task still processing
        if (statusData.data.status === 'processing' || statusData.data.status === 'pending') {
          continue // Keep polling
        }
      }

      // If response has image directly, extract it
      if (statusData.image_url || statusData.image || statusData.data?.image_url || statusData.data?.image) {
        return extractImageFromDeAPIResponse(statusData)
      }
    } catch (error) {
      console.warn(`Error polling DeAPI status (attempt ${attempts}):`, error)
    }
  }

  throw new Error(`DeAPI request ${requestId} timed out after ${maxAttempts} attempts`)
}

/**
 * Extract image URL from DeAPI response and convert to blob URL
 */
async function extractImageFromDeAPIResponse(data: any): Promise<string> {
  let imageUrl: string | null = null

  if (data.image_url) {
    imageUrl = data.image_url
  } else if (data.url) {
    imageUrl = data.url
  } else if (data.data?.image_url) {
    imageUrl = data.data.image_url
  } else if (data.data?.url) {
    imageUrl = data.data.url
  }

  if (imageUrl) {
    // Fetch image and convert to blob
    const imageResponse = await fetch(imageUrl)
    if (!imageResponse.ok) {
      throw new Error(`Failed to fetch image from ${imageUrl}`)
    }
    const blob = await imageResponse.blob()
    return URL.createObjectURL(blob)
  }

  // Check for base64 encoded image
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

  throw new Error(`No image found in DeAPI response: ${JSON.stringify(data)}`)
}

/**
 * Generate an image using DeAPI
 * According to docs: https://docs.gamercoin.com/depin-api/api/text-to-image
 * The endpoint returns a request_id that needs to be polled via the "Get Results" endpoint
 * @param options - Generation options
 * @returns Blob URL of the generated image
 */
export async function generateImageWithDeAPI(options: DeAPIGenerateOptions): Promise<string> {
  if (!DEAPI_API_KEY) {
    throw new Error("DeAPI API key is required. Set VITE_DEAPI_API_KEY in your .env file")
  }

  try {
    // Generate a random seed if not provided (required by API)
    const seed = options.seed ?? Math.floor(Math.random() * 1000000)
    // Ensure steps is at most 10 (API requirement)
    const steps = Math.min(options.steps || 10, 10)
    
    const response = await fetch('https://api.deapi.ai/api/v1/client/txt2img', {
      method: 'POST',
      headers: {
        "Authorization": `Bearer ${DEAPI_API_KEY}`,
        "Accept": "application/json",
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        prompt: options.prompt,
        negative_prompt: options.negative_prompt || "blur, darkness, noise",
        model: options.model || "Flux1schnell",
        loras: options.loras || [],
        width: options.width || 512,
        height: options.height || 512,
        guidance: options.guidance || 7.5,
        steps: steps,
        seed: seed
      })
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`DeAPI error: ${response.status} ${response.statusText} - ${errorText}`)
    }

    const data = await response.json()
    console.log("DeAPI Response:", data)
    
    // DeAPI returns a request_id for async processing - need to poll for results
    // Response format: { "data": { "request_id": "c08a339c-73e5-4d67-a4d5-231302fbff9a" } }
    if (data.data?.request_id) {
      const requestId = data.data.request_id
      console.log("DeAPI returned request_id, polling for results:", requestId)
      
      // Poll for the result using the "Get Results" endpoint
      return await pollDeAPIStatus(requestId)
    }
    
    // If it returns image directly (synchronous response - unlikely but handle it)
    if (data.image_url || data.image || data.data?.image_url || data.data?.image) {
      return extractImageFromDeAPIResponse(data)
    }
    
    throw new Error(`Unexpected response format from DeAPI. Expected request_id but got: ${JSON.stringify(data)}`)
  } catch (error) {
    console.error("Error generating image with DeAPI:", error)
    throw error
  }
}
