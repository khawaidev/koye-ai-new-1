// Image Edit API Service
// Using Seedream V4 Edit API via KIE.AI
// Documentation: 4.md

const KIE_CREATE_TASK_URL = "https://api.kie.ai/api/v1/jobs/createTask"
const KIE_QUERY_TASK_URL = "https://api.kie.ai/api/v1/jobs/recordInfo"

// Helper to get all available API keys
const getApiKeys = () => {
    const keys: string[] = []
    const mainKey = import.meta.env.VITE_KIE_API_KEY
    if (mainKey && mainKey !== "YOUR_API_KEY") keys.push(mainKey)

    // Check for numbered keys 1-10
    for (let i = 1; i <= 10; i++) {
        const key = import.meta.env[`VITE_KIE_API_KEY_${i}`]
        if (key) keys.push(key)
    }

    if (keys.length === 0) keys.push("YOUR_API_KEY")
    return keys
}

export interface ImageEditOptions {
    prompt: string
    imageUrl: string // URL of the image to edit
    guidanceScale?: number // Not used in Seedream V4 Edit
    seed?: number
}

/**
 * Edit an image using Seedream V4 Edit API
 * The KIE API requires PUBLIC HTTP/HTTPS URLs, not data URLs or blob URLs.
 * We upload the image to Supabase storage first to get a public URL.
 * 
 * @param options - Edit options including prompt and image URL
 * @returns Data URL of the edited image
 */
export async function editImage(options: ImageEditOptions): Promise<string> {
    const { prompt, imageUrl, seed = 42 } = options

    // The KIE API requires a public HTTP/HTTPS URL
    // If the image is a blob URL or data URL, we need to upload it to storage first
    let publicImageUrl = imageUrl

    if (imageUrl.startsWith('blob:') || imageUrl.startsWith('data:')) {
        console.log("🔄 Uploading local image to storage for KIE API...")
        try {
            publicImageUrl = await uploadImageToStorage(imageUrl)
            console.log("✅ Image uploaded successfully!")
            console.log("📍 Public URL:", publicImageUrl)
        } catch (error) {
            console.error("❌ Failed to upload image to storage:", error)
            throw new Error("Failed to prepare image for editing. The image must be uploaded to storage first.")
        }
    }

    // Validate that we have a proper HTTP URL
    if (!publicImageUrl.startsWith('http://') && !publicImageUrl.startsWith('https://')) {
        throw new Error("Image URL must be a public HTTP/HTTPS URL for the edit API")
    }

    // CRITICAL: Verify the image is accessible before submitting to KIE API
    console.log("🔍 Verifying image is accessible...")
    const imageVerification = await verifyImageAccessible(publicImageUrl)

    if (!imageVerification.accessible) {
        console.error("❌ Image is NOT accessible:", imageVerification.error)
        throw new Error(`Image upload failed or URL is not accessible: ${imageVerification.error}. Cannot proceed with edit.`)
    }

    console.log("✅ Image verified accessible!")
    console.log("📊 Image details:", {
        url: publicImageUrl,
        contentType: imageVerification.contentType,
        size: imageVerification.size
    })

    // Build request body
    const requestBody = {
        model: "bytedance/seedream-v4-edit",
        input: {
            prompt: prompt.trim(),
            image_urls: [publicImageUrl],
            image_size: "square_hd",
            image_resolution: "1K",
            max_images: 1,
            seed: seed
        }
    }

    console.log("📤 Submitting to KIE API with request:", JSON.stringify(requestBody, null, 2))

    // Try with API keys rotation
    const apiKeys = getApiKeys()
    let lastError: Error | null = null

    for (const apiKey of apiKeys) {
        try {
            return await createTaskAndPoll(apiKey, requestBody)
        } catch (error: any) {
            console.warn(`API call failed with key ${apiKey.substring(0, 8)}...:`, error.message)
            lastError = error

            // If it's a 400 error (like invalid file type), retrying with another key won't help
            if (error.message.includes('400')) {
                throw error
            }
        }
    }

    throw lastError || new Error("All API keys failed")
}

/**
 * Verify that an image URL is accessible and returns proper image content
 */
async function verifyImageAccessible(url: string): Promise<{
    accessible: boolean;
    contentType?: string;
    size?: number;
    error?: string;
}> {
    try {
        // Use HEAD request first to check without downloading full image
        const headResponse = await fetch(url, { method: 'HEAD' })

        if (!headResponse.ok) {
            return {
                accessible: false,
                error: `HTTP ${headResponse.status}: ${headResponse.statusText}`
            }
        }

        const contentType = headResponse.headers.get('content-type') || 'unknown'
        const contentLength = headResponse.headers.get('content-length')

        // Verify it's an image
        if (!contentType.startsWith('image/')) {
            return {
                accessible: false,
                error: `Invalid content type: ${contentType}. Expected image/*`
            }
        }

        return {
            accessible: true,
            contentType,
            size: contentLength ? parseInt(contentLength, 10) : undefined
        }
    } catch (error: any) {
        // If HEAD fails (some servers don't support it), try GET
        try {
            const getResponse = await fetch(url)
            if (!getResponse.ok) {
                return {
                    accessible: false,
                    error: `HTTP ${getResponse.status}: ${getResponse.statusText}`
                }
            }

            const contentType = getResponse.headers.get('content-type') || 'unknown'
            const blob = await getResponse.blob()

            if (!contentType.startsWith('image/') && !blob.type.startsWith('image/')) {
                return {
                    accessible: false,
                    error: `Invalid content type: ${contentType || blob.type}. Expected image/*`
                }
            }

            return {
                accessible: true,
                contentType: contentType || blob.type,
                size: blob.size
            }
        } catch (getError: any) {
            return {
                accessible: false,
                error: `Network error: ${getError.message}`
            }
        }
    }
}

/**
 * Upload a blob URL or data URL to Supabase storage and return the public URL
 */
async function uploadImageToStorage(imageUrl: string): Promise<string> {
    // Import the upload function dynamically to avoid circular dependencies
    const { uploadFileToDataDb } = await import("./supabase")

    // Convert the URL to a Blob
    let blob: Blob

    if (imageUrl.startsWith('blob:')) {
        const response = await fetch(imageUrl)
        blob = await response.blob()
    } else if (imageUrl.startsWith('data:')) {
        // Convert data URL to blob
        const response = await fetch(imageUrl)
        blob = await response.blob()
    } else {
        throw new Error("Expected blob: or data: URL")
    }

    // Ensure valid MIME type
    let finalBlob = blob
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(blob.type)) {
        console.log(`Converting blob type from ${blob.type} to image/png`)
        finalBlob = new Blob([blob], { type: 'image/png' })
    }

    // Create a unique filename
    const timestamp = Date.now()
    const randomId = Math.random().toString(36).substring(2, 10)
    const extension = finalBlob.type === 'image/jpeg' ? 'jpg' : finalBlob.type === 'image/webp' ? 'webp' : 'png'
    const filename = `edit-input-${timestamp}-${randomId}.${extension}`

    // Upload to the "images" bucket in the temp folder
    const storagePath = `temp/edit-inputs/${filename}`

    try {
        const publicUrl = await uploadFileToDataDb("images", storagePath, finalBlob)
        return publicUrl
    } catch (error) {
        console.error("Upload to storage failed:", error)
        throw new Error("Failed to upload image to storage. Please check your database connection.")
    }
}

async function createTaskAndPoll(apiKey: string, requestBody: any): Promise<string> {
    // 1. Create Task
    const createResponse = await fetch(KIE_CREATE_TASK_URL, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${apiKey}`
        },
        body: JSON.stringify(requestBody),
    })

    if (!createResponse.ok) {
        let errorMessage = createResponse.statusText
        try {
            const errorData = await createResponse.json()
            errorMessage = errorData.msg || JSON.stringify(errorData)
        } catch {
            // Keep the statusText
        }
        throw new Error(`KIE API Create Task error: ${createResponse.status} - ${errorMessage}`)
    }

    const createData = await createResponse.json()
    if (createData.code !== 200) {
        throw new Error(`KIE API error: ${createData.msg}`)
    }

    const taskId = createData.data.taskId
    console.log("KIE Task Created:", taskId)

    // 2. Poll for Results
    return await pollForTaskResult(taskId, apiKey)
}

/**
 * Poll task status until completion
 */
async function pollForTaskResult(taskId: string, apiKey: string, maxAttempts: number = 60, intervalMs: number = 2000): Promise<string> {
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
        await sleep(intervalMs)

        const response = await fetch(`${KIE_QUERY_TASK_URL}?taskId=${taskId}`, {
            method: "GET",
            headers: {
                "Authorization": `Bearer ${apiKey}`
            }
        })

        if (!response.ok) {
            console.warn(`Status check failed (attempt ${attempt + 1}):`, response.statusText)
            continue
        }

        const data = await response.json()

        if (data.code !== 200) {
            console.warn(`API returned error code (attempt ${attempt + 1}):`, data.msg)
            continue
        }

        const taskData = data.data
        console.log(`Task status (attempt ${attempt + 1}):`, taskData.state)

        if (taskData.state === 'success') {
            try {
                const resultJson = JSON.parse(taskData.resultJson)
                if (resultJson.resultUrls && resultJson.resultUrls.length > 0) {
                    // Return the first result URL
                    // We convert to data URL for persistence
                    return await fetchAndConvertToDataUrl(resultJson.resultUrls[0])
                }
            } catch (e) {
                console.error("Failed to parse resultJson:", e)
                throw new Error("Failed to parse task results")
            }
        }

        if (taskData.state === 'fail') {
            throw new Error(`Task failed: ${taskData.failMsg || 'Unknown error'}`)
        }

        // Still waiting...
    }

    throw new Error('Task timed out after maximum attempts')
}

/**
 * Sleep helper
 */
function sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
}

/**
 * Fetch an image and convert to Data URL
 */
async function fetchAndConvertToDataUrl(imageUrl: string): Promise<string> {
    try {
        const response = await fetch(imageUrl)
        const blob = await response.blob()
        return await blobToDataUrlFromBlob(blob)
    } catch (error) {
        console.warn('Could not convert to Data URL, returning direct URL:', error)
        return imageUrl
    }
}

/**
 * Convert a blob URL to a data URL (ensuring valid image mime type)
 */
async function blobToDataUrl(url: string): Promise<string> {
    const response = await fetch(url)
    const blob = await response.blob()
    return blobToDataUrlFromBlob(blob)
}

async function blobToDataUrlFromBlob(blob: Blob): Promise<string> {
    // Force valid mime type if generic
    let finalBlob = blob
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(blob.type)) {
        console.log(`Converting blob type from ${blob.type} to image/png`)
        finalBlob = new Blob([blob], { type: 'image/png' })
    }

    return new Promise((resolve, reject) => {
        const reader = new FileReader()
        reader.onloadend = () => {
            const result = reader.result as string
            resolve(result)
        }
        reader.onerror = () => reject(new Error('Failed to convert blob to data URL'))
        reader.readAsDataURL(finalBlob)
    })
}

/**
 * Prepare an image URL for the API
 */
export async function prepareImageForEdit(imageUrl: string): Promise<string> {
    return blobToDataUrl(imageUrl)
}
