// KIE API Service
// Documentation: https://docs.kie.ai/4o-image-api/generate-4-o-image

const KIE_API_KEY = import.meta.env.VITE_KIE_API_KEY || ""

export interface KIEGenerateOptions {
  prompt: string
  filesUrl?: string[]
  size?: string
  callBackUrl?: string
  isEnhance?: boolean
  uploadCn?: boolean
  nVariants?: number
  enableFallback?: boolean
  fallbackModel?: string
}

/**
 * Poll KIE API for task status and retrieve generated images
 * @param taskId - Task ID returned from the generate endpoint
 * @param expectedVariants - Expected number of image variants
 * @returns Blob URL(s) of the generated image(s)
 */
async function pollKIEStatus(taskId: string, expectedVariants: number = 1): Promise<string | string[]> {
  const maxAttempts = 60 // Poll for up to 60 attempts (5 minutes if 5s intervals)
  const pollInterval = 5000 // Poll every 5 seconds
  let attempts = 0

  while (attempts < maxAttempts) {
    await new Promise(resolve => setTimeout(resolve, pollInterval))
    attempts++

    try {
      // Get task details using the "Get 4o Image Details" endpoint
      // Based on docs: https://docs.kie.ai/4o-image-api/generate-4-o-image
      // Try /details/{taskId} first, then /result/{taskId} as fallback
      let statusResponse = await fetch(`https://api.kie.ai/api/v1/gpt4o-image/details/${taskId}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${KIE_API_KEY}`,
          'Content-Type': 'application/json'
        }
      })

      // If details endpoint doesn't exist, try result endpoint
      if (!statusResponse.ok && statusResponse.status === 404) {
        statusResponse = await fetch(`https://api.kie.ai/api/v1/gpt4o-image/result/${taskId}`, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${KIE_API_KEY}`,
            'Content-Type': 'application/json'
          }
        })
      }

      if (!statusResponse.ok) {
        continue // Keep polling
      }

      const statusData = await statusResponse.json()
      console.log(`KIE API Status (attempt ${attempts}):`, statusData)

      // Check if task is completed
      if (statusData.code === 200 && statusData.data) {
        // Task completed, extract images
        if (statusData.data.status === 'completed' || statusData.data.status === 'success' || statusData.data.images) {
          return extractImagesFromResponse(statusData.data, expectedVariants)
        }
        // Task failed
        if (statusData.data.status === 'failed' || statusData.data.status === 'error') {
          throw new Error(`KIE API task failed: ${statusData.data.error || statusData.data.message || 'Unknown error'}`)
        }
        // Task still processing
        if (statusData.data.status === 'processing' || statusData.data.status === 'pending') {
          continue // Keep polling
        }
      }

      // If response has images directly, extract them
      if (statusData.data?.images || statusData.images) {
        return extractImagesFromResponse(statusData, expectedVariants)
      }
    } catch (error) {
      // If it's not a network error, might be that the endpoint doesn't exist
      // Try using callback URL approach or different polling method
      console.warn(`Error polling KIE status (attempt ${attempts}):`, error)
    }
  }

  throw new Error(`KIE API task ${taskId} timed out after ${maxAttempts} attempts`)
}

/**
 * Extract image URLs from KIE API response and convert to blob URLs
 */
async function extractImagesFromResponse(data: any, expectedVariants: number): Promise<string | string[]> {
  // Try various response formats
  let imageUrls: string[] = []

  if (data.images && Array.isArray(data.images)) {
    imageUrls = data.images
  } else if (data.image_url) {
    imageUrls = [data.image_url]
  } else if (data.url) {
    imageUrls = [data.url]
  } else if (data.data?.images && Array.isArray(data.data.images)) {
    imageUrls = data.data.images
  } else if (data.data?.image_url) {
    imageUrls = [data.data.image_url]
  } else if (data.data?.url) {
    imageUrls = [data.data.url]
  }

  if (imageUrls.length === 0) {
    throw new Error(`No images found in KIE API response: ${JSON.stringify(data)}`)
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
 * Generate an image using KIE API
 * @param options - Generation options
 * @returns Blob URL of the generated image or array of URLs for variants
 */
export async function generateImageWithKIE(options: KIEGenerateOptions): Promise<string | string[]> {
  if (!KIE_API_KEY) {
    throw new Error("KIE API key is required. Set VITE_KIE_API_KEY in your .env file")
  }

  try {
    const response = await fetch('https://api.kie.ai/api/v1/gpt4o-image/generate', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${KIE_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        filesUrl: options.filesUrl || [],
        prompt: options.prompt,
        size: options.size || "1:1",
        callBackUrl: options.callBackUrl || undefined,
        isEnhance: options.isEnhance || false,
        uploadCn: options.uploadCn || false,
        nVariants: options.nVariants || 1,
        enableFallback: options.enableFallback || false,
        fallbackModel: options.fallbackModel || "FLUX_MAX"
      })
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`KIE API error: ${response.status} ${response.statusText} - ${errorText}`)
    }

    const data = await response.json()
    
    // Log the response for debugging
    console.log("KIE API Response:", data)
    
    // KIE API returns a taskId for async processing - need to poll for results
    if (data.code === 200 && data.data?.taskId) {
      const taskId = data.data.taskId
      console.log("KIE API returned taskId, polling for results:", taskId)
      
      // Poll for the result
      return await pollKIEStatus(taskId, options.nVariants || 1)
    }
    
    // If it returns image URLs directly (synchronous response)
    if (data.image_url || data.url) {
      const imageUrl = data.image_url || data.url
      const imageResponse = await fetch(imageUrl)
      const blob = await imageResponse.blob()
      return URL.createObjectURL(blob)
    } 
    // If it returns an array of image URLs
    else if (Array.isArray(data.images)) {
      const imageUrls = await Promise.all(
        data.images.map(async (imgUrl: string) => {
          const imageResponse = await fetch(imgUrl)
          const blob = await imageResponse.blob()
          return URL.createObjectURL(blob)
        })
      )
      return imageUrls.length === 1 ? imageUrls[0] : imageUrls
    }
    // If it returns data with image property containing URL
    else if (data.data?.image_url || data.data?.url) {
      const imageUrl = data.data.image_url || data.data.url
      const imageResponse = await fetch(imageUrl)
      const blob = await imageResponse.blob()
      return URL.createObjectURL(blob)
    }
    // If it returns data with images array
    else if (Array.isArray(data.data?.images)) {
      const imageUrls = await Promise.all(
        data.data.images.map(async (imgUrl: string) => {
          const imageResponse = await fetch(imgUrl)
          const blob = await imageResponse.blob()
          return URL.createObjectURL(blob)
        })
      )
      return imageUrls.length === 1 ? imageUrls[0] : imageUrls
    }
    // If it's base64 encoded image
    else if (data.image || data.data?.image) {
      const base64Data = (data.image || data.data.image).replace(/^data:image\/\w+;base64,/, '')
      const binaryString = atob(base64Data)
      const bytes = new Uint8Array(binaryString.length)
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i)
      }
      const blob = new Blob([bytes], { type: 'image/png' })
      return URL.createObjectURL(blob)
    }
    // If it's a direct binary/image response
    else if (response.headers.get('content-type')?.startsWith('image/')) {
      const blob = await response.blob()
      return URL.createObjectURL(blob)
    }
    else {
      // Log the full response for debugging
      console.error("KIE API unexpected response format:", JSON.stringify(data, null, 2))
      throw new Error(`Unexpected response format from KIE API. Response: ${JSON.stringify(data)}`)
    }
  } catch (error) {
    console.error("Error generating image with KIE:", error)
    throw error
  }
}

