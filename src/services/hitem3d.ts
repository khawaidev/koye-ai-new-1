// Hitem3D API Service - Multi-API key fallback support
// Based on: https://docs.hitem3d.ai/en/api/api-reference/

import { getPairedApiKeys } from "../lib/apiFallback";

const HITEM3D_API_BASE = "https://api.hitem3d.ai"

// ==================== Multi-key credential management ====================

// Get ALL available API key pairs from environment
function getAllApiKeyPairs(): Array<{ clientId: string; clientSecret: string }> {
  const pairs = getPairedApiKeys(
    "VITE_HITEM3D_ACCESS_KEY",
    "VITE_HITEM3D_SECRET_KEY",
    10
  )

  // Also check CLIENT_ID/CLIENT_SECRET naming convention
  const clientPairs = getPairedApiKeys(
    "VITE_HITEM3D_CLIENT_ID",
    "VITE_HITEM3D_CLIENT_SECRET",
    10
  )

  const allPairs = [
    ...pairs.map(p => ({ clientId: p.key1, clientSecret: p.key2 })),
    ...clientPairs.map(p => ({ clientId: p.key1, clientSecret: p.key2 })),
  ]

  // Deduplicate by clientId
  const seen = new Set<string>()
  return allPairs.filter(p => {
    if (seen.has(p.clientId)) return false
    seen.add(p.clientId)
    return true
  })
}

// ==================== Per-key token caching ====================

// Cache tokens per clientId so each key pair gets its own cached token
const tokenCache = new Map<string, { token: string; expiresAt: number }>()

async function getAccessTokenForPair(pair: { clientId: string; clientSecret: string }, signal?: AbortSignal): Promise<string> {
  // Return cached token if still valid (with 1 hour buffer)
  const cached = tokenCache.get(pair.clientId)
  if (cached && cached.expiresAt > Date.now() + 3600000) {
    return cached.token
  }

  // Create Basic auth header
  const credentials = btoa(`${pair.clientId}:${pair.clientSecret}`)

  const response = await fetch(`${HITEM3D_API_BASE}/open-api/v1/auth/token`, {
    method: "POST",
    headers: {
      "Authorization": `Basic ${credentials}`,
      "Content-Type": "application/json",
    },
    signal,
  })

  if (!response.ok) {
    let errorData: any = {}
    try {
      errorData = await response.json()
    } catch {
      errorData = { message: response.statusText }
    }
    // Clear cache on error
    tokenCache.delete(pair.clientId)
    throw new Error(`Failed to get Hitem3D token: ${response.status} ${response.statusText} - ${JSON.stringify(errorData)}`)
  }

  const data = await response.json()

  // Check for error in response
  if (data.code && data.code !== 200) {
    tokenCache.delete(pair.clientId)
    throw new Error(`Hitem3D API error: ${data.message || data.msg || "Unknown error"} (code: ${data.code})`)
  }

  // Handle different response structures
  const accessToken = data.data?.accessToken || data.accessToken || data.data?.token || data.token

  if (!accessToken) {
    console.error("Hitem3D API response:", data)
    tokenCache.delete(pair.clientId)
    throw new Error(`Hitem3D API error: No access token in response. Response: ${JSON.stringify(data)}`)
  }

  // Cache token (expires in 24 hours, but we'll refresh after 23 hours)
  tokenCache.set(pair.clientId, {
    token: accessToken,
    expiresAt: Date.now() + 23 * 60 * 60 * 1000,
  })

  return accessToken
}

// ==================== Fallback error detection ====================

function shouldTryNextKey(error: any): boolean {
  if (!error) return false
  const msg = error instanceof Error ? error.message : String(error)
  const lower = msg.toLowerCase()

  return (
    lower.includes("401") ||
    lower.includes("402") ||
    lower.includes("403") ||
    lower.includes("429") ||
    lower.includes("503") ||
    lower.includes("unauthorized") ||
    lower.includes("forbidden") ||
    lower.includes("payment required") ||
    lower.includes("insufficient") ||
    lower.includes("quota") ||
    lower.includes("rate limit") ||
    lower.includes("overloaded") ||
    lower.includes("invalid") ||
    lower.includes("expired") ||
    lower.includes("credits") ||
    lower.includes("balance") ||
    lower.includes("not enough") ||
    lower.includes("30010000") ||
    lower.includes("failed to get hitem3d token")
  )
}

// ==================== Types ====================

export interface Hitem3DJob {
  jobId: string
  status: "pending" | "processing" | "completed" | "failed"
  progress?: number
  result?: {
    modelUrl: string
    format: "obj" | "glb" | "stl" | "fbx"
    meshUrl?: string // For staged generation
  }
  error?: string
}

export type GenerationMode = "single" | "four"
export type GenerationType = "both" | "mesh" | "texture"
export type ModelResolution = "512" | "1024" | "1536" | "1536Pro"
export type ModelFormat = "obj" | "glb" | "stl" | "fbx"

export interface Generate3DModelOptions {
  mode: GenerationMode
  type: GenerationType
  resolution: ModelResolution
  format: ModelFormat
  images: File[] // Single image for "single" mode, 4 images for "four" mode
  meshUrl?: string // Required for "texture" type (staged generation)
  callbackUrl?: string
  face?: number // Face count (100000-2000000). If not provided, will use recommended value based on resolution
}

// ==================== Helper functions ====================

// Map format to API format code
function formatToCode(format: ModelFormat): string {
  const map: Record<ModelFormat, string> = {
    obj: "1",
    glb: "2",
    stl: "3",
    fbx: "4",
  }
  return map[format]
}

// Map generation type to request_type
function typeToRequestType(type: GenerationType): string {
  const map: Record<GenerationType, string> = {
    mesh: "1", // Geometry only
    texture: "2", // Texture only (staged)
    both: "3", // Both geometry and texture
  }
  return map[type]
}

// Get recommended face count based on resolution
function getRecommendedFaceCount(resolution: ModelResolution): number {
  const map: Record<ModelResolution, number> = {
    "512": 500000,      // Recommended for 512³
    "1024": 1000000,    // Recommended for 1024³
    "1536": 2000000,    // Recommended for 1536³
    "1536Pro": 2000000, // Recommended for 1536³ Pro
  }
  return map[resolution]
}

// Validate and clamp face count to valid range (100000-2000000)
function validateFaceCount(face: number): number {
  const min = 100000
  const max = 2000000
  if (face < min) {
    console.warn(`Face count ${face} is below minimum ${min}, using ${min}`)
    return min
  }
  if (face > max) {
    console.warn(`Face count ${face} exceeds maximum ${max}, using ${max}`)
    return max
  }
  return face
}

// ==================== Core API functions with multi-key fallback ====================

/**
 * Create a 3D model generation task (with multi-key fallback)
 */
export async function create3DModelTask(options: Generate3DModelOptions, signal?: AbortSignal): Promise<string> {
  const allPairs = getAllApiKeyPairs()

  if (allPairs.length === 0) {
    throw new Error("No Hitem3D API credentials found. Set VITE_HITEM3D_ACCESS_KEY and VITE_HITEM3D_SECRET_KEY in your .env file")
  }

  let lastError: any = null

  for (let i = 0; i < allPairs.length; i++) {
    // Check if cancelled before trying next key
    if (signal?.aborted) {
      throw new DOMException("3D model generation cancelled by user", "AbortError")
    }

    const pair = allPairs[i]

    try {
      console.log(`🔑 Hitem3D: Trying API key pair ${i + 1}/${allPairs.length} (${pair.clientId.substring(0, 8)}...)`)

      const token = await getAccessTokenForPair(pair, signal)

      const formData = new FormData()

      // Add images
      if (options.mode === "single") {
        if (options.images.length !== 1) {
          throw new Error("Single image mode requires exactly 1 image")
        }
        formData.append("images", options.images[0])
      } else {
        // Four images mode
        if (options.images.length !== 4) {
          throw new Error("Four images mode requires exactly 4 images")
        }
        options.images.forEach((image) => {
          formData.append("multi_images", image)
        })
      }

      // Add parameters
      formData.append("request_type", typeToRequestType(options.type))
      formData.append("model", "hitem3dv1.5") // Always use v1.5

      // Normalize resolution value (API expects "1536pro" lowercase)
      const normalizedResolution = options.resolution === "1536Pro" ? "1536pro" : options.resolution
      formData.append("resolution", normalizedResolution)

      formData.append("format", formatToCode(options.format))

      // Add face count (required, must be 100000-2000000)
      const faceCount = options.face !== undefined
        ? validateFaceCount(options.face)
        : getRecommendedFaceCount(options.resolution)
      formData.append("face", faceCount.toString())

      // Add mesh_url if texture-only generation
      if (options.type === "texture" && options.meshUrl) {
        formData.append("mesh_url", options.meshUrl)
      }

      // Add callback URL if provided
      if (options.callbackUrl) {
        formData.append("callback_url", options.callbackUrl)
      }

      const response = await fetch(`${HITEM3D_API_BASE}/open-api/v1/submit-task`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${token}`,
        },
        body: formData,
        signal,
      })

      if (!response.ok) {
        let errorData: any = {}
        try {
          errorData = await response.json()
        } catch {
          errorData = { message: response.statusText }
        }
        throw new Error(`Failed to create Hitem3D task: ${response.status} ${response.statusText} - ${JSON.stringify(errorData)}`)
      }

      const data = await response.json()

      // Check for error in response
      if (data.code && data.code !== 200) {
        throw new Error(`Hitem3D API error: ${data.message || data.msg || "Unknown error"} (code: ${data.code})`)
      }

      // Handle different response structures (API returns task_id in snake_case)
      const taskId = data.data?.task_id || data.data?.taskId || data.task_id || data.taskId || data.data?.id || data.id

      if (!taskId) {
        console.error("Hitem3D API response:", data)
        throw new Error(`Hitem3D API error: No task ID in response. Response: ${JSON.stringify(data)}`)
      }

      console.log(`✅ Hitem3D: Task created with key pair ${i + 1} — Task ID: ${taskId}`)
      return taskId

    } catch (error) {
      lastError = error
      const errorMsg = error instanceof Error ? error.message : String(error)
      console.warn(`❌ Hitem3D key pair ${i + 1}/${allPairs.length} failed: ${errorMsg}`)

      // Invalidate cached token for this pair
      tokenCache.delete(pair.clientId)

      if (!shouldTryNextKey(error)) {
        // Non-retryable error (e.g., invalid image, wrong params) — don't try more keys
        throw error
      }

      if (i < allPairs.length - 1) {
        console.log(`🔄 Hitem3D: Falling back to key pair ${i + 2}...`)
      }
    }
  }

  // All pairs failed
  throw lastError || new Error("All Hitem3D API key pairs failed")
}

/**
 * Query task status (with multi-key fallback)
 */
export async function queryTaskStatus(taskId: string, signal?: AbortSignal): Promise<Hitem3DJob> {
  const allPairs = getAllApiKeyPairs()

  if (allPairs.length === 0) {
    throw new Error("No Hitem3D API credentials found")
  }

  let lastError: any = null

  for (let i = 0; i < allPairs.length; i++) {
    // Check if cancelled before trying next key
    if (signal?.aborted) {
      throw new DOMException("Task status query cancelled by user", "AbortError")
    }

    const pair = allPairs[i]

    try {
      const token = await getAccessTokenForPair(pair, signal)

      // API expects task_id (snake_case) as query parameter
      const response = await fetch(`${HITEM3D_API_BASE}/open-api/v1/query-task?task_id=${taskId}`, {
        method: "GET",
        headers: {
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        signal,
      })

      if (!response.ok) {
        let errorData: any = {}
        try {
          errorData = await response.json()
        } catch {
          errorData = { message: response.statusText }
        }
        throw new Error(`Failed to query Hitem3D task: ${response.status} ${response.statusText} - ${JSON.stringify(errorData)}`)
      }

      const data = await response.json()

      // Check for error in response
      if (data.code && data.code !== 200) {
        throw new Error(`Hitem3D API error: ${data.message || data.msg || "Unknown error"} (code: ${data.code})`)
      }

      const taskData = data.data || data

      // Map API response state to our interface
      // API returns: "created", "queueing", "processing", "success", "failed"
      const apiState = taskData.state || taskData.status
      const status = apiState === "success" || apiState === "SUCCESS" || apiState === "completed" ? "completed" :
        apiState === "failed" || apiState === "FAILED" ? "failed" :
          apiState === "processing" || apiState === "PROCESSING" || apiState === "queueing" || apiState === "QUEUEING" ? "processing" : "pending"

      // API returns url directly in data, not in result object
      const modelUrl = taskData.url || taskData.result?.url || taskData.result?.modelUrl || taskData.modelUrl

      const result = (status === "completed" && modelUrl) ? {
        modelUrl,
        format: (taskData.format || taskData.result?.format || "glb") as ModelFormat,
        meshUrl: taskData.meshUrl || taskData.result?.meshUrl,
      } : undefined

      return {
        jobId: taskId,
        status,
        progress: taskData.progress,
        result,
        error: taskData.error || taskData.message || taskData.msg,
      }

    } catch (error) {
      lastError = error
      tokenCache.delete(pair.clientId)

      if (!shouldTryNextKey(error)) {
        throw error
      }

      if (i < allPairs.length - 1) {
        console.warn(`Hitem3D queryTaskStatus: key pair ${i + 1} failed, trying pair ${i + 2}...`)
      }
    }
  }

  throw lastError || new Error("All Hitem3D API key pairs failed for queryTaskStatus")
}

// ==================== Legacy functions for backward compatibility ====================

export async function generate3DModel(
  images: Record<"front" | "left" | "right" | "back", string>
): Promise<string> {
  // Convert URLs to Files
  const imageFiles: File[] = []
  const views: Array<"front" | "left" | "right" | "back"> = ["front", "left", "right", "back"]

  for (const view of views) {
    const url = images[view]
    if (!url) continue

    const response = await fetch(url)
    const blob = await response.blob()
    const file = new File([blob], `${view}.png`, { type: "image/png" })
    imageFiles.push(file)
  }

  if (imageFiles.length !== 4) {
    throw new Error("All four views are required")
  }

  return await create3DModelTask({
    mode: "four",
    type: "both",
    resolution: "1024",
    format: "glb",
    images: imageFiles,
  })
}

export async function checkJobStatus(jobId: string, signal?: AbortSignal): Promise<Hitem3DJob> {
  return await queryTaskStatus(jobId, signal)
}

export async function downloadModel(modelUrl: string, signal?: AbortSignal): Promise<Blob> {
  try {
    const response = await fetch(modelUrl, { signal })
    if (!response.ok) {
      throw new Error(`Failed to download model: ${response.statusText}`)
    }
    return await response.blob()
  } catch (error) {
    console.error("Error downloading model:", error)
    throw error
  }
}
