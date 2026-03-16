// Meshy API Service
// Based on: https://api.meshy.ai/docs

const MESHY_API_BASE = "https://api.meshy.ai"

// Get API key from environment (supports fallback keys)
function getApiKey(): string {
  // Try primary key first
  let apiKey = import.meta.env.VITE_MESHY_API_KEY || ""

  // Try fallback keys if primary not found
  if (!apiKey) {
    for (let i = 1; i <= 10; i++) {
      const fallbackKey = import.meta.env[`VITE_MESHY_API_KEY${i}`] || ""
      if (fallbackKey) {
        apiKey = fallbackKey
        break
      }
    }
  }

  if (!apiKey) {
    throw new Error("Meshy API key is required. Set VITE_MESHY_API_KEY in your .env file")
  }

  return apiKey
}

// ============================================
// TEXT TO 3D API
// ============================================

export type TextTo3DAiModel = "meshy-5" | "meshy-6" | "latest"
export type TextTo3DTopology = "quad" | "triangle"
export type TextTo3DSymmetryMode = "off" | "auto" | "on"
export type TextTo3DPoseMode = "a-pose" | "t-pose" | ""
export type TaskStatus = "PENDING" | "IN_PROGRESS" | "SUCCEEDED" | "FAILED" | "CANCELED"

export interface TextTo3DPreviewOptions {
  prompt: string
  art_style?: "realistic" | "sculpture"
  ai_model?: TextTo3DAiModel
  topology?: TextTo3DTopology
  target_polycount?: number
  should_remesh?: boolean
  symmetry_mode?: TextTo3DSymmetryMode
  pose_mode?: TextTo3DPoseMode
  moderation?: boolean
}

export interface TextTo3DRefineOptions {
  preview_task_id: string
  enable_pbr?: boolean
  texture_prompt?: string
  texture_image_url?: string
  ai_model?: TextTo3DAiModel
  moderation?: boolean
}

export interface TextTo3DTask {
  id: string
  type: "text-to-3d-preview" | "text-to-3d-refine"
  model_urls?: {
    glb?: string
    fbx?: string
    obj?: string
    mtl?: string
    usdz?: string
  }
  thumbnail_url?: string
  prompt: string
  art_style?: string
  progress: number
  started_at: number
  created_at: number
  finished_at: number
  status: TaskStatus
  texture_urls?: Array<{
    base_color?: string
    metallic?: string
    normal?: string
    roughness?: string
  }>
  preceding_tasks: number
  task_error: {
    message: string
  }
}

/**
 * Create a Text to 3D Preview task
 * Costs 20 credits for Meshy-6, 5 credits for other models
 */
export async function createTextTo3DPreview(options: TextTo3DPreviewOptions): Promise<string> {
  const apiKey = getApiKey()

  const payload: any = {
    mode: "preview",
    prompt: options.prompt.substring(0, 600), // Max 600 chars
    ai_model: options.ai_model || "latest",
  }

  if (options.topology) payload.topology = options.topology
  if (options.target_polycount !== undefined) payload.target_polycount = options.target_polycount
  if (options.should_remesh !== undefined) payload.should_remesh = options.should_remesh
  if (options.symmetry_mode) payload.symmetry_mode = options.symmetry_mode
  if (options.pose_mode !== undefined) payload.pose_mode = options.pose_mode
  if (options.moderation !== undefined) payload.moderation = options.moderation

  const response = await fetch(`${MESHY_API_BASE}/openapi/v2/text-to-3d`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  })

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ message: response.statusText }))
    throw new Error(`Text to 3D Preview failed: ${errorData.message || response.statusText}`)
  }

  const data = await response.json()
  return data.result
}

/**
 * Create a Text to 3D Refine task
 */
export async function createTextTo3DRefine(options: TextTo3DRefineOptions): Promise<string> {
  const apiKey = getApiKey()

  const payload: any = {
    mode: "refine",
    preview_task_id: options.preview_task_id,
  }

  if (options.enable_pbr !== undefined) payload.enable_pbr = options.enable_pbr
  if (options.texture_prompt) payload.texture_prompt = options.texture_prompt.substring(0, 600)
  if (options.texture_image_url) payload.texture_image_url = options.texture_image_url
  if (options.ai_model) payload.ai_model = options.ai_model
  if (options.moderation !== undefined) payload.moderation = options.moderation

  const response = await fetch(`${MESHY_API_BASE}/openapi/v2/text-to-3d`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  })

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ message: response.statusText }))
    throw new Error(`Text to 3D Refine failed: ${errorData.message || response.statusText}`)
  }

  const data = await response.json()
  return data.result
}

/**
 * Retrieve a Text to 3D task (works for both preview and refine)
 */
export async function getTextTo3DTask(taskId: string): Promise<TextTo3DTask> {
  const apiKey = getApiKey()

  const response = await fetch(`${MESHY_API_BASE}/openapi/v2/text-to-3d/${taskId}`, {
    method: "GET",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
    },
  })

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ message: response.statusText }))
    throw new Error(`Failed to get Text to 3D task: ${errorData.message || response.statusText}`)
  }

  return await response.json()
}

/**
 * Poll Text to 3D task until complete
 */
export function pollTextTo3DTask(
  taskId: string,
  onUpdate: (task: TextTo3DTask) => void,
  onError?: (error: Error) => void
): number {
  const pollInterval = setInterval(async () => {
    try {
      const task = await getTextTo3DTask(taskId)
      onUpdate(task)

      if (["SUCCEEDED", "FAILED", "CANCELED"].includes(task.status)) {
        clearInterval(pollInterval)
      }
    } catch (error) {
      console.error("Error polling Text to 3D task:", error)
      if (onError) {
        onError(error instanceof Error ? error : new Error("Failed to poll task"))
      }
      clearInterval(pollInterval)
    }
  }, 3000)

  return pollInterval
}

// ============================================
// TEXT TO IMAGE API (koye-2dv3)
// ============================================

export type ImageAiModel = "nano-banana" | "nano-banana-pro"
export type ImageAspectRatio = "1:1" | "16:9" | "9:16" | "4:3" | "3:4"
export type ImagePoseMode = "a-pose" | "t-pose"

export interface TextToImageOptions {
  prompt: string
  ai_model?: ImageAiModel
  generate_multi_view?: boolean
  pose_mode?: ImagePoseMode
  aspect_ratio?: ImageAspectRatio
}

export interface TextToImageTask {
  id: string
  type: "text-to-image"
  ai_model: ImageAiModel
  prompt: string
  status: TaskStatus
  progress: number
  created_at: number
  started_at: number
  finished_at: number
  expires_at: number
  image_urls: string[]
  preceding_tasks?: number
  task_error?: {
    message: string
  }
}

/**
 * Create a Text to Image task (koye-2dv3)
 */
export async function createTextToImage(options: TextToImageOptions): Promise<string> {
  const apiKey = getApiKey()

  const payload: any = {
    ai_model: options.ai_model || "nano-banana",
    prompt: options.prompt,
  }

  if (options.generate_multi_view !== undefined) payload.generate_multi_view = options.generate_multi_view
  if (options.pose_mode) payload.pose_mode = options.pose_mode
  // aspect_ratio cannot be set when generate_multi_view is true
  if (options.aspect_ratio && !options.generate_multi_view) payload.aspect_ratio = options.aspect_ratio

  const response = await fetch(`${MESHY_API_BASE}/openapi/v1/text-to-image`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  })

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ message: response.statusText }))
    throw new Error(`Text to Image failed: ${errorData.message || response.statusText}`)
  }

  const data = await response.json()
  return data.result
}

/**
 * Retrieve a Text to Image task
 */
export async function getTextToImageTask(taskId: string): Promise<TextToImageTask> {
  const apiKey = getApiKey()

  const response = await fetch(`${MESHY_API_BASE}/openapi/v1/text-to-image/${taskId}`, {
    method: "GET",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
    },
  })

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ message: response.statusText }))
    throw new Error(`Failed to get Text to Image task: ${errorData.message || response.statusText}`)
  }

  return await response.json()
}

/**
 * Generate image with Meshy Text-to-Image API (koye-2dv3)
 * This is a convenience function that creates a task and polls until complete
 */
export async function generateImageWithMeshy(
  prompt: string,
  options?: {
    ai_model?: ImageAiModel
    aspect_ratio?: ImageAspectRatio
    generate_multi_view?: boolean
    pose_mode?: ImagePoseMode
  }
): Promise<string | string[]> {
  const taskId = await createTextToImage({
    prompt,
    ai_model: options?.ai_model || "nano-banana",
    aspect_ratio: options?.aspect_ratio,
    generate_multi_view: options?.generate_multi_view,
    pose_mode: options?.pose_mode,
  })

  // Poll until complete
  const maxAttempts = 60
  const intervalMs = 2000

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    await new Promise(resolve => setTimeout(resolve, intervalMs))

    const task = await getTextToImageTask(taskId)

    if (task.status === "SUCCEEDED") {
      if (task.image_urls && task.image_urls.length > 0) {
        return options?.generate_multi_view ? task.image_urls : task.image_urls[0]
      }
      throw new Error("Task succeeded but no image URLs returned")
    }

    if (task.status === "FAILED" || task.status === "CANCELED") {
      throw new Error(`Image generation ${task.status}: ${task.task_error?.message || "Unknown error"}`)
    }
  }

  throw new Error("Image generation timed out")
}

// ============================================
// IMAGE TO IMAGE API
// ============================================

export interface ImageToImageOptions {
  prompt: string
  reference_image_urls: string[]
  ai_model?: ImageAiModel
  generate_multi_view?: boolean
}

export interface ImageToImageTask {
  id: string
  type: "image-to-image"
  ai_model: ImageAiModel
  prompt: string
  status: TaskStatus
  progress: number
  created_at: number
  started_at: number
  finished_at: number
  expires_at: number
  image_urls: string[]
  preceding_tasks?: number
  task_error?: {
    message: string
  }
}

/**
 * Create an Image to Image task
 */
export async function createImageToImage(options: ImageToImageOptions): Promise<string> {
  const apiKey = getApiKey()

  if (!options.reference_image_urls || options.reference_image_urls.length === 0) {
    throw new Error("At least one reference image URL is required")
  }

  if (options.reference_image_urls.length > 5) {
    throw new Error("Maximum 5 reference images allowed")
  }

  const payload: any = {
    ai_model: options.ai_model || "nano-banana",
    prompt: options.prompt,
    reference_image_urls: options.reference_image_urls,
  }

  if (options.generate_multi_view !== undefined) payload.generate_multi_view = options.generate_multi_view

  const response = await fetch(`${MESHY_API_BASE}/openapi/v1/image-to-image`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  })

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ message: response.statusText }))
    throw new Error(`Image to Image failed: ${errorData.message || response.statusText}`)
  }

  const data = await response.json()
  return data.result
}

/**
 * Retrieve an Image to Image task
 */
export async function getImageToImageTask(taskId: string): Promise<ImageToImageTask> {
  const apiKey = getApiKey()

  const response = await fetch(`${MESHY_API_BASE}/openapi/v1/image-to-image/${taskId}`, {
    method: "GET",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
    },
  })

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ message: response.statusText }))
    throw new Error(`Failed to get Image to Image task: ${errorData.message || response.statusText}`)
  }

  return await response.json()
}

/**
 * Edit image with Meshy Image-to-Image API
 * This is a convenience function that creates a task and polls until complete
 */
export async function editImageWithMeshy(
  prompt: string,
  imageUrl: string,
  options?: {
    ai_model?: ImageAiModel
    generate_multi_view?: boolean
  }
): Promise<string | string[]> {
  // Convert blob/data URL to proper format if needed
  let referenceUrl = imageUrl

  if (imageUrl.startsWith('blob:') || imageUrl.startsWith('data:')) {
    // Convert to base64 data URI format expected by Meshy
    if (imageUrl.startsWith('blob:')) {
      const response = await fetch(imageUrl)
      const blob = await response.blob()
      const base64 = await blobToBase64(blob)
      referenceUrl = base64
    }
  }

  const taskId = await createImageToImage({
    prompt,
    reference_image_urls: [referenceUrl],
    ai_model: options?.ai_model || "nano-banana",
    generate_multi_view: options?.generate_multi_view,
  })

  // Poll until complete
  const maxAttempts = 60
  const intervalMs = 2000

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    await new Promise(resolve => setTimeout(resolve, intervalMs))

    const task = await getImageToImageTask(taskId)

    if (task.status === "SUCCEEDED") {
      if (task.image_urls && task.image_urls.length > 0) {
        return options?.generate_multi_view ? task.image_urls : task.image_urls[0]
      }
      throw new Error("Task succeeded but no image URLs returned")
    }

    if (task.status === "FAILED" || task.status === "CANCELED") {
      throw new Error(`Image editing ${task.status}: ${task.task_error?.message || "Unknown error"}`)
    }
  }

  throw new Error("Image editing timed out")
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

// ============================================
// RIGGING API (existing)
// ============================================

export interface RiggingTask {
  id: string
  status: TaskStatus
  progress: number
  created_at: number
  started_at: number
  finished_at: number
  expires_at: number
  task_error: {
    message: string
  }
  result?: {
    rigged_character_fbx_url?: string
    rigged_character_glb_url?: string
    basic_animations?: {
      walking_glb_url?: string
      walking_fbx_url?: string
      walking_armature_glb_url?: string
      running_glb_url?: string
      running_fbx_url?: string
      running_armature_glb_url?: string
    }
  }
  preceding_tasks: number
}

export interface CreateRiggingTaskOptions {
  input_task_id?: string
  model_url?: string
  height_meters?: number
  texture_image_url?: string
}

/**
 * Create a rigging task
 * @param options - Rigging task options
 * @returns Task ID
 */
export async function createRiggingTask(options: CreateRiggingTaskOptions): Promise<string> {
  const apiKey = getApiKey()

  if (!options.input_task_id && !options.model_url) {
    throw new Error("Either input_task_id or model_url must be provided")
  }

  const payload: any = {}
  if (options.input_task_id) {
    payload.input_task_id = options.input_task_id
  }
  if (options.model_url) {
    payload.model_url = options.model_url
  }
  if (options.height_meters !== undefined) {
    payload.height_meters = options.height_meters
  }
  if (options.texture_image_url) {
    payload.texture_image_url = options.texture_image_url
  }

  const response = await fetch(`${MESHY_API_BASE}/openapi/v1/rigging`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  })

  if (!response.ok) {
    let errorMessage = "Unknown error"
    try {
      const errorData = await response.json()
      errorMessage = errorData.message || errorData.error || response.statusText
    } catch {
      errorMessage = response.statusText
    }

    // Provide user-friendly error messages for common issues
    if (errorMessage.includes("pose estimation") || errorMessage.includes("pose_estimation")) {
      throw new Error(
        "Model is not suitable for auto-rigging. Auto-rigging works best with:\n" +
        "• Textured humanoid (bipedal) models\n" +
        "• Models with clearly defined limbs and body structure\n" +
        "• GLB format with textures\n\n" +
        "Not suitable for:\n" +
        "• Non-humanoid assets\n" +
        "• Untextured meshes\n" +
        "• Models with unclear body structure"
      )
    } else if (errorMessage.includes("humanoid") || errorMessage.includes("limb")) {
      throw new Error("Model must be a humanoid (bipedal) character with clearly defined limbs and body structure.")
    } else if (errorMessage.includes("texture") || errorMessage.includes("textured")) {
      throw new Error("Model must be textured. Untextured meshes are not supported for auto-rigging.")
    } else if (response.status === 400) {
      throw new Error(`Invalid request: ${errorMessage}. Please ensure the model URL is accessible and the model is in GLB format with textures.`)
    } else if (response.status === 401 || response.status === 403) {
      throw new Error("Authentication failed. Please check your Meshy API key.")
    } else if (response.status === 404) {
      throw new Error("Model URL not found or inaccessible. Please ensure the URL is publicly accessible.")
    }

    throw new Error(`Meshy API error: ${errorMessage} (status: ${response.status})`)
  }

  const data = await response.json()

  if (!data.result) {
    throw new Error("Meshy API error: No task ID in response")
  }

  return data.result
}

/**
 * Retrieve a rigging task status
 * @param taskId - Task ID
 * @returns Rigging task object
 */
export async function getRiggingTask(taskId: string): Promise<RiggingTask> {
  const apiKey = getApiKey()

  const response = await fetch(`${MESHY_API_BASE}/openapi/v1/rigging/${taskId}`, {
    method: "GET",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
    },
  })

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ message: "Unknown error" }))
    throw new Error(`Meshy API error: ${errorData.message || response.statusText} (status: ${response.status})`)
  }

  return await response.json()
}

/**
 * Stream rigging task updates using Server-Sent Events
 * Note: EventSource doesn't support custom headers, so this uses polling instead
 * For SSE support, you would need a backend proxy
 * @param taskId - Task ID
 * @param onUpdate - Callback for each update
 * @param onError - Callback for errors
 * @returns Interval ID that can be cleared to stop polling
 */
export function streamRiggingTask(
  taskId: string,
  onUpdate: (task: RiggingTask) => void,
  onError?: (error: Error) => void
): number {
  // Use polling instead of SSE since EventSource doesn't support custom headers
  const pollInterval = setInterval(async () => {
    try {
      const task = await getRiggingTask(taskId)
      onUpdate(task)

      // Stop polling when task is finished
      if (["SUCCEEDED", "FAILED", "CANCELED"].includes(task.status)) {
        clearInterval(pollInterval)
      }
    } catch (error) {
      console.error("Error polling rigging task:", error)
      if (onError) {
        onError(error instanceof Error ? error : new Error("Failed to poll rigging task"))
      }
      clearInterval(pollInterval)
    }
  }, 3000) // Poll every 3 seconds

  return pollInterval
}

/**
 * Delete a rigging task
 * @param taskId - Task ID
 */
export async function deleteRiggingTask(taskId: string): Promise<void> {
  const apiKey = getApiKey()

  const response = await fetch(`${MESHY_API_BASE}/openapi/v1/rigging/${taskId}`, {
    method: "DELETE",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
    },
  })

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ message: "Unknown error" }))
    throw new Error(`Meshy API error: ${errorData.message || response.statusText} (status: ${response.status})`)
  }
}
