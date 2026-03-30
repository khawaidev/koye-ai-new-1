// HyperReal API Service
// Documentation: See hyperreal.md
// Endpoint: https://api.hypereal.tech/v1/images/generate

import { getApiKeys, withApiFallback } from "../lib/apiFallback"

// API base URL
// In development, use the Vite proxy to bypass CORS
// In production, use the direct API URL
const isDev = typeof window !== 'undefined' && window.location.hostname === 'localhost'
const HYPERREAL_API_BASE = isDev ? "/api/hyperreal" : "https://api.hypereal.tech"

// Get API keys with fallback support (VITE_HYPERREAL_API_KEY, VITE_HYPERREAL_API_KEY1, VITE_HYPERREAL_API_KEY2, etc.)
const HYPERREAL_API_KEYS = getApiKeys("VITE_HYPERREAL_API_KEY")

/**
 * Available text-to-image models
 * - nano-banana-t2i: Fast text-to-image (34 credits) — uses aspect_ratio + output_format
 * - gpt-4o-image: High quality text-to-image (52 credits) — uses size
 */
export type HyperrealImageModel = "nano-banana-t2i" | "gpt-4o-image"

/**
 * nano-banana-t2i aspect ratios
 */
export type NanoBananaAspectRatio = "1:1" | "3:2" | "2:3" | "3:4" | "4:3" | "4:5" | "5:4" | "9:16" | "16:9" | "21:9"

/**
 * gpt-4o-image sizes
 */
export type Gpt4oImageSize = "1024x1024" | "1024x1792" | "1792x1024"

/**
 * User-facing display labels for aspect ratio / size selection
 */
export const NANO_BANANA_ASPECT_RATIOS: { value: NanoBananaAspectRatio; label: string }[] = [
    { value: "1:1", label: "1:1 (Square)" },
    { value: "16:9", label: "16:9 (Landscape)" },
    { value: "9:16", label: "9:16 (Portrait)" },
    { value: "4:3", label: "4:3 (Standard)" },
    { value: "3:4", label: "3:4 (Portrait)" },
    { value: "3:2", label: "3:2 (Photo)" },
    { value: "2:3", label: "2:3 (Portrait Photo)" },
    { value: "4:5", label: "4:5 (Social)" },
    { value: "5:4", label: "5:4 (Landscape)" },
    { value: "21:9", label: "21:9 (Ultrawide)" },
]

export const GPT4O_SIZES: { value: Gpt4oImageSize; label: string }[] = [
    { value: "1024x1024", label: "1:1 (1024×1024)" },
    { value: "1792x1024", label: "16:9 (1792×1024)" },
    { value: "1024x1792", label: "9:16 (1024×1792)" },
]

export interface HyperrealGenerateResponse {
    created: number
    data: Array<{
        url: string
        model: string
    }>
    resultId: string
    creditsUsed: number
}

/**
 * Generate an image using HyperReal Text-to-Image API
 * Handles model-specific payloads:
 * - nano-banana-t2i: { prompt, model, aspect_ratio?, output_format? }
 * - gpt-4o-image:    { prompt, model?, size? }
 *
 * @param prompt - Text description of the image to generate
 * @param options - Model-specific generation options
 * @returns URL of the generated image
 */
export async function generateImageWithHyperreal(
    prompt: string,
    options?: {
        model?: HyperrealImageModel
        // For nano-banana-t2i
        aspect_ratio?: NanoBananaAspectRatio
        output_format?: string
        // For gpt-4o-image
        size?: Gpt4oImageSize
    }
): Promise<string> {
    if (HYPERREAL_API_KEYS.length === 0) {
        throw new Error("HyperReal API key is required. Set VITE_HYPERREAL_API_KEY in your .env file")
    }

    if (!prompt || prompt.trim().length === 0) {
        throw new Error("Prompt is required for image generation")
    }

    const requestedModel = options?.model || "gpt-4o-image"

    // Try the requested model first, then fall back to the other model on 500 errors
    const modelsToTry: HyperrealImageModel[] = requestedModel === "gpt-4o-image"
        ? ["gpt-4o-image", "nano-banana-t2i"]
        : ["nano-banana-t2i", "gpt-4o-image"]

    let lastError: any = null

    for (const modelSlug of modelsToTry) {
        try {
            const result = await withApiFallback(
                HYPERREAL_API_KEYS,
                async (apiKey) => {
                    // Build model-specific payload
                    const payload: Record<string, any> = {
                        prompt: prompt.trim(),
                    }

                    if (modelSlug === "gpt-4o-image") {
                        // gpt-4o-image: uses "size" parameter, model name is optional
                        payload.model = "gpt-4o-image"
                        if (options?.size) {
                            payload.size = options.size
                        }
                        // Default size if not specified
                        if (!payload.size) {
                            payload.size = "1024x1024"
                        }
                    } else {
                        // nano-banana-t2i: uses "aspect_ratio" + "output_format"
                        payload.model = "nano-banana-t2i"
                        if (options?.aspect_ratio) {
                            payload.aspect_ratio = options.aspect_ratio
                        }
                        if (options?.output_format) {
                            payload.output_format = options.output_format
                        }
                    }

                    console.log("📤 HyperReal API Request:")
                    console.log("   Model:", payload.model)
                    console.log("   Prompt (first 300 chars):", prompt.substring(0, 300))
                    console.log("   Prompt length:", prompt.length)
                    if (payload.aspect_ratio) console.log("   Aspect Ratio:", payload.aspect_ratio)
                    if (payload.size) console.log("   Size:", payload.size)

                    const response = await fetch(`${HYPERREAL_API_BASE}/v1/images/generate`, {
                        method: "POST",
                        headers: {
                            "Content-Type": "application/json",
                            "Authorization": `Bearer ${apiKey}`,
                        },
                        body: JSON.stringify(payload),
                    })

                    if (!response.ok) {
                        const errorText = await response.text().catch(() => response.statusText)
                        throw new Error(`HyperReal API error: ${response.status} ${response.statusText} - ${errorText}`)
                    }

                    const data: HyperrealGenerateResponse = await response.json()

                    if (!data.data || data.data.length === 0 || !data.data[0].url) {
                        throw new Error("HyperReal API returned no image URL")
                    }

                    console.log("✅ HyperReal image generated successfully")
                    console.log("   Result ID:", data.resultId)
                    console.log("   Credits used:", data.creditsUsed)
                    console.log("   Image URL:", data.data[0].url.substring(0, 80) + "...")

                    return data.data[0].url
                },
                () => true, // Always fallback to the next API key on error
                1 // Try each key exactly once (no local retries, just move to next key)
            )
            return result
        } catch (error) {
            lastError = error
            const errorMsg = error instanceof Error ? error.message : String(error)
            console.warn(`HyperReal model '${modelSlug}' failed:`, errorMsg)

            // If it's a 500 error (generation failed) or 402 (insufficient credits on all keys), try the other model
            if (errorMsg.includes("500") || errorMsg.includes("Generation failed") ||
                errorMsg.includes("402") || errorMsg.includes("insufficient_credits") ||
                errorMsg.includes("Insufficient credits") || errorMsg.includes("Payment Required")) {
                console.log(`Trying fallback model...`)
                continue
            }

            // For other errors, don't try another model
            throw error
        }
    }

    throw lastError || new Error("All HyperReal models failed")
}

/**
 * Edit an image using HyperReal Image Edit API
 * Sends the source image URL along with an editing prompt
 *
 * @param prompt - Text description of the edit to apply
 * @param imageUrl - URL of the source image to edit
 * @param options - Optional edit options
 * @returns URL of the edited image
 */
export type HyperrealImageEditModel = "nano-banana-edit" | "nano-banana-pro-edit"
export type HyperrealEditResolution = "1k" | "2k" | "4k"

export async function editImageWithHyperreal(
    prompt: string,
    imageUrl: string,
    options?: {
        model?: HyperrealImageEditModel
        aspect_ratio?: NanoBananaAspectRatio
        output_format?: string
        resolution?: HyperrealEditResolution // Only for nano-banana-pro-edit
        skipPreDownload?: boolean // Set true if imageUrl is already a publicly accessible URL
    }
): Promise<string> {
    if (HYPERREAL_API_KEYS.length === 0) {
        throw new Error("HyperReal API key is required. Set VITE_HYPERREAL_API_KEY in your .env file")
    }

    if (!prompt || prompt.trim().length === 0) {
        throw new Error("Prompt is required for image editing")
    }

    if (!imageUrl) {
        throw new Error("Image URL is required for image editing")
    }

    // Pre-download and re-host the image for HyperReal edit
    // HyperReal's API requires actual HTTP URLs in the `images` array (not base64)
    // and their servers often can't access external URLs (R2, etc.)
    // Solution: download the image ourselves, re-upload to Supabase main storage,
    // and pass the permanent Supabase public URL to HyperReal
    let resolvedImageUrl = imageUrl

    // Skip pre-download if the caller already has a publicly accessible URL
    if (options?.skipPreDownload) {
        console.log("⏭️ Skipping pre-download, using provided URL directly:", imageUrl.substring(0, 80) + "...")
    } else if (imageUrl.startsWith('http')) {
        console.log("🔄 Pre-downloading image for HyperReal edit...")
        try {
            // Try direct fetch first, fall back to local proxy for CORS
            let response: Response
            try {
                response = await fetch(imageUrl)
                if (!response.ok) throw new Error(`HTTP ${response.status}`)
            } catch (directErr) {
                console.warn("   Direct fetch failed, trying local proxy...")
                const backendUrl = import.meta.env.VITE_BACKEND_URL || "http://localhost:3001"
                const proxyUrl = `${backendUrl}/api/proxy-image?url=${encodeURIComponent(imageUrl)}`
                response = await fetch(proxyUrl)
                if (!response.ok) throw new Error(`Proxy HTTP ${response.status}`)
            }

            const blob = await response.blob()
            const fileSize = Math.round(blob.size / 1024)
            console.log(`   ✅ Image pre-downloaded (${fileSize} KB)`)

            // Re-upload to Supabase db-1 storage using service-role key (bypasses RLS)
            // so HyperReal can access the image via public URL
            try {
                const { getMultiDbManager } = await import("./multiDbManager")
                const dbManager = getMultiDbManager()

                // Use service-role client to bypass RLS restrictions
                const serviceDb = dbManager.getServiceDb("db1")
                if (!serviceDb) {
                    throw new Error("No service-role client available for db1")
                }

                const tempId = crypto.randomUUID()
                const tempPath = `temp-edit-sources/${tempId}.png`
                const bucketName = "images"

                console.log(`   📦 Uploading ${Math.round(blob.size / 1024)} KB to ${bucketName}/${tempPath}...`)

                const { data: uploadData, error: uploadError } = await serviceDb.storage
                    .from(bucketName)
                    .upload(tempPath, blob, {
                        cacheControl: "3600",
                        upsert: true,
                        contentType: blob.type || "image/png",
                    })

                console.log("   📦 Upload response:", JSON.stringify({ data: uploadData, error: uploadError?.message }))

                if (uploadError) {
                    throw new Error(`Upload failed: ${uploadError.message}`)
                }

                // Use public URL (simpler, shorter - signed URLs cause timeouts)
                const { data: urlData } = serviceDb.storage
                    .from(bucketName)
                    .getPublicUrl(tempPath)

                if (urlData?.publicUrl) {
                    resolvedImageUrl = urlData.publicUrl
                    console.log("   ✅ Public URL:", resolvedImageUrl)
                } else {
                    throw new Error("Could not get public URL from Supabase")
                }
            } catch (uploadErr) {
                console.warn("   ⚠️ Re-upload to Supabase failed, falling back to base64:", uploadErr)
                resolvedImageUrl = await blobToBase64(blob)
            }
        } catch (err) {
            console.error("   ❌ Failed to pre-download image:", err)
            throw new Error(
                "Cannot access the source image for editing. " +
                "The image URL may be expired or inaccessible. " +
                "Please try re-generating the image first."
            )
        }
    } else if (imageUrl.startsWith('blob:')) {
        console.log("🔄 Converting blob URL for HyperReal edit...")
        try {
            const response = await fetch(imageUrl)
            const blob = await response.blob()

            // Try to re-upload blob to Supabase using service-role
            try {
                const { getMultiDbManager } = await import("./multiDbManager")
                const dbManager = getMultiDbManager()
                const serviceDb = dbManager.getServiceDb("db1")

                if (serviceDb) {
                    const tempId = crypto.randomUUID()
                    const tempPath = `temp-edit-sources/${tempId}.png`

                    const { error } = await serviceDb.storage
                        .from("images")
                        .upload(tempPath, blob, {
                            cacheControl: "3600",
                            upsert: true,
                            contentType: blob.type || "image/png",
                        })

                    if (!error) {
                        const { data: urlData } = serviceDb.storage
                            .from("images")
                            .getPublicUrl(tempPath)
                        if (urlData?.publicUrl) {
                            resolvedImageUrl = urlData.publicUrl
                            console.log("   ✅ Blob re-uploaded to Supabase (service-role):", resolvedImageUrl.substring(0, 80) + "...")
                        } else {
                            resolvedImageUrl = await blobToBase64(blob)
                        }
                    } else {
                        resolvedImageUrl = await blobToBase64(blob)
                    }
                } else {
                    resolvedImageUrl = await blobToBase64(blob)
                }
            } catch {
                resolvedImageUrl = await blobToBase64(blob)
                console.warn("   ⚠️ Re-upload failed, falling back to base64")
            }
        } catch (err) {
            console.error("Failed to convert blob URL:", err)
            throw new Error("Cannot convert blob URL for HyperReal API.")
        }
    }
    // data: URLs are passed through as-is (last resort)

    return await withApiFallback(
        HYPERREAL_API_KEYS,
        async (apiKey) => {
            const payload: Record<string, any> = {
                model: options?.model || "nano-banana-edit",
                prompt: prompt.trim(),
                // API docs specify "images" array for edit models
                images: [resolvedImageUrl],
            }

            if (options?.aspect_ratio) {
                payload.aspect_ratio = options.aspect_ratio
            }

            if (options?.output_format) {
                payload.output_format = options.output_format || "png"
            }

            if (payload.model === "nano-banana-pro-edit" && options?.resolution) {
                payload.resolution = options.resolution
            }

            console.log("📤 HyperReal Image Edit Request:")
            console.log("   Full payload:", JSON.stringify({ ...payload, images: payload.images?.map((u: string) => u?.substring(0, 80) + "...") }))

            const response = await fetch(`${HYPERREAL_API_BASE}/v1/images/generate`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${apiKey}`,
                },
                body: JSON.stringify(payload),
            })

            if (!response.ok) {
                const errorText = await response.text().catch(() => response.statusText)
                throw new Error(`HyperReal Image Edit error: ${response.status} ${response.statusText} - ${errorText}`)
            }

            const data: HyperrealGenerateResponse = await response.json()

            if (!data.data || data.data.length === 0 || !data.data[0].url) {
                throw new Error("HyperReal API returned no edited image URL")
            }

            console.log("✅ HyperReal image edit completed")
            console.log("   Response model:", data.data[0].model)
            console.log("   Credits used:", data.creditsUsed)
            console.log("   Result URL:", data.data[0].url)

            return data.data[0].url
        },
        () => true, // Always fallback to the next API key on error
        1 // Try each key exactly once (no local retries, just move to next key)
    )
}

/**
 * Replace the background of an image using HyperReal
 */
export async function replaceBackgroundWithHyperreal(
    imageUrl: string,
    backgroundPrompt: string
): Promise<string> {
    return await editImageWithHyperreal(
        `Replace the background with: ${backgroundPrompt}. Keep the foreground subject exactly the same.`,
        imageUrl,
        { output_format: "png" }
    )
}

/**
 * Image-to-image transformation using HyperReal
 * Drop-in replacement for clipdrop's imageToImageFromUrl
 */
export async function imageToImageWithHyperreal(
    imageUrl: string,
    prompt: string
): Promise<string> {
    return await editImageWithHyperreal(prompt, imageUrl)
}

/**
 * Helper to convert blob to base64 data URI
 */
async function blobToBase64(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader()
        reader.onloadend = () => {
            resolve(reader.result as string)
        }
        reader.onerror = reject
        reader.readAsDataURL(blob)
    })
}

/**
 * Generate a 3D model from text using Hypereal (Meshy6)
 * @param prompt Text description of the 3D model
 * @param options Additional generation parameters
 * @returns Object containing the model URL and format
 */
export async function generate3DModelWithHypereal(
    prompt: string,
    options?: {
        art_style?: "realistic" | "sculpture"
        topology?: "quad" | "triangle"
        target_polycount?: number
        enable_pbr?: boolean
    }
): Promise<{ url: string; format: string }> {
    if (HYPERREAL_API_KEYS.length === 0) {
        throw new Error("HyperReal API key is required. Set VITE_HYPERREAL_API_KEY in your .env file")
    }

    if (!prompt || prompt.trim().length === 0) {
        throw new Error("Prompt is required for 3D generation")
    }

    return await withApiFallback(
        HYPERREAL_API_KEYS,
        async (apiKey) => {
            const payload = {
                model: "meshy6-text-to-3d",
                input: {
                    prompt: prompt.trim(),
                    ...(options?.art_style && { art_style: options.art_style }),
                    ...(options?.topology && { topology: options.topology }),
                    ...(options?.target_polycount && { target_polycount: options.target_polycount }),
                    ...(options?.enable_pbr !== undefined && { enable_pbr: options.enable_pbr }),
                }
            }

            console.log("📤 Hypereal 3D Generation Request:", payload)

            // The API documentation uses https://api.hypereal.cloud
            const response = await fetch("https://api.hypereal.cloud/api/v1/3d/generate", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${apiKey}`,
                },
                body: JSON.stringify(payload),
            })

            if (!response.ok) {
                const errorText = await response.text().catch(() => response.statusText)
                throw new Error(`Hypereal 3D API error: ${response.status} ${response.statusText} - ${errorText}`)
            }

            const data = await response.json()

            if (!data.success || !data.outputUrl) {
                throw new Error("Hypereal 3D API returned no model URL or failed")
            }

            console.log("✅ Hypereal 3D model generated successfully")
            console.log("   Credits used:", data.creditsUsed)
            console.log("   Model URL:", data.outputUrl)

            return {
                url: data.outputUrl,
                format: "glb"
            }
        },
        () => true,
        1
    )
}
