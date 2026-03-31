/**
 * RunwayML API Service — Image Generation & Editing
 * 
 * Uses the RunwayML gen4_image model via REST API.
 * Implements multi-API-key fallback: VITE_RUNWAYML_API_KEY, VITE_RUNWAYML_API_KEY1, ... VITE_RUNWAYML_API_KEY10
 * 
 * Flow:
 *   1. Create a task (POST /v1/text_to_image)
 *   2. Poll for completion (GET /v1/tasks/{id})
 *   3. Return the output image URL
 * 
 * For image editing (reference-based), we upload the source image as a reference
 * and use the prompt to describe the desired edit.
 */

import { getApiKeys } from "../lib/apiFallback"

const RUNWAY_BASE_URL = "https://api.dev.runwayml.com/v1"
const RUNWAY_API_VERSION = "2024-11-06"

// Grab all available RunwayML API keys using the existing fallback system
const RUNWAY_API_KEYS = getApiKeys("VITE_RUNWAYML_API_KEY")

// ─── Types ───────────────────────────────────────────────────────────────────

export interface RunwayTaskOutput {
  id: string
  status: "PENDING" | "RUNNING" | "SUCCEEDED" | "FAILED" | "CANCELLED"
  output?: string[]  // Array of image URLs on success
  failure?: string
  failureCode?: string
}

export type RunwayRatio =
  | "1024:1024"
  | "1080:1080"
  | "1168:880"
  | "1360:768"
  | "1440:1080"
  | "1080:1440"
  | "1808:768"
  | "1920:1080"
  | "1080:1920"
  | "2112:912"
  | "1280:720"
  | "720:1280"
  | "720:720"
  | "960:720"
  | "720:960"
  | "1680:720"

export type RunwayImageModel = "gen4_image_turbo" | "gen4_image" | "gemini_2.5_flash"

export type RunwayVideoModel = "gen4.5" | "gen4_turbo" | "alpha4_turbo" | "gen3a_turbo" | "veo3.1" | "veo3.1_fast" | "veo3"
export type RunwayVideoRatio = "1280:720" | "720:1280" | "1104:832" | "960:960" | "832:1104" | "1584:672"

// ─── Core helpers ────────────────────────────────────────────────────────────

/**
 * Make an authenticated request to the Runway API.
 * Tries each API key in sequence; moves to the next key on 401/403/429.
 */
async function runwayFetch(
  path: string,
  options: RequestInit = {},
  retryKeys: string[] = RUNWAY_API_KEYS
): Promise<Response> {
  if (retryKeys.length === 0) {
    throw new Error("RunwayML API key is required. Set VITE_RUNWAYML_API_KEY in your .env file")
  }

  let lastError: Error | null = null

  for (const apiKey of retryKeys) {
    try {
      const response = await fetch(`${RUNWAY_BASE_URL}${path}`, {
        ...options,
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${apiKey}`,
          "X-Runway-Version": RUNWAY_API_VERSION,
          ...(options.headers || {}),
        },
      })

      // If auth / rate-limit failure → try the next key
      if ([401, 403, 429].includes(response.status)) {
        const errorData = await response.json().catch(() => ({}))
        lastError = new Error(
          `RunwayML API error ${response.status}: ${JSON.stringify(errorData)}`
        )
        console.warn(
          `RunwayML key …${apiKey.slice(-6)} failed (${response.status}), trying next key…`
        )
        continue
      }

      return response
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err))
      const msg = lastError.message.toLowerCase()
      if (
        msg.includes("401") ||
        msg.includes("403") ||
        msg.includes("429") ||
        msg.includes("quota")
      ) {
        continue
      }
      throw lastError
    }
  }

  throw lastError || new Error("All RunwayML API keys failed")
}

// ─── Task polling ────────────────────────────────────────────────────────────

/**
 * Poll a RunwayML task until it reaches a terminal state (SUCCEEDED / FAILED).
 * Returns the task output on success; throws on failure or timeout.
 */
async function pollTask(
  taskId: string,
  maxAttempts = 120,
  intervalMs = 3000
): Promise<RunwayTaskOutput> {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    await new Promise((r) => setTimeout(r, intervalMs))

    const res = await runwayFetch(`/tasks/${taskId}`, { method: "GET" })

    if (!res.ok) {
      console.warn(`RunwayML poll attempt ${attempt + 1} failed: ${res.status}`)
      continue
    }

    const data: RunwayTaskOutput = await res.json()
    console.log(`RunwayML task ${taskId} — status: ${data.status} (attempt ${attempt + 1})`)

    if (data.status === "SUCCEEDED") return data
    if (data.status === "FAILED" || data.status === "CANCELLED") {
      throw new Error(`RunwayML task failed: ${data.failure || data.failureCode || "unknown"}`)
    }
  }

  throw new Error("RunwayML task timed out after maximum polling attempts")
}

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Generate a brand-new image from a text prompt (no reference image).
 * @returns URL of the generated image
 */
export async function generateImageWithRunway(
  promptText: string,
  options?: {
    model?: RunwayImageModel;
    ratio?: RunwayRatio;
  }
): Promise<string> {
  const body = {
    model: options?.model || "gen4_image_turbo",
    promptText,
    ratio: options?.ratio || "1024:1024",
  }

  console.log("🚀 RunwayML text-to-image — creating task…")
  const createRes = await runwayFetch("/text_to_image", {
    method: "POST",
    body: JSON.stringify(body),
  })

  if (!createRes.ok) {
    const errData = await createRes.json().catch(() => ({}))
    throw new Error(`RunwayML create task error: ${createRes.status} — ${JSON.stringify(errData)}`)
  }

  const { id: taskId } = await createRes.json()
  console.log(`✅ RunwayML task created: ${taskId}`)

  const result = await pollTask(taskId)

  if (result.output && result.output.length > 0) {
    return result.output[0]
  }
  throw new Error("RunwayML returned no output images")
}

/**
 * Edit an image by using it as a reference and describing the desired changes.
 *
 * Flow:
 *   1. Convert the image to a public URL (or data-URI if the API allows).
 *   2. Send as a reference image alongside the edit prompt.
 *   3. Poll for the result.
 *
 * @param prompt      - Description of the desired edit / changes
 * @param imageBase64 - Raw base64-encoded image data (no data: prefix)
 * @param imageMimeType - MIME type of the source image (default: image/png)
 * @returns URL of the edited image
 */
export async function editImageWithRunway(
  prompt: string,
  imageBase64?: string,
  imageMimeType: string = "image/png"
): Promise<string> {
  // Build the request body
  const body: any = {
    model: "gen4_image_turbo",
    promptText: prompt,
    ratio: "1024:1024" as RunwayRatio,
  }

  // If a source image is provided, include it as a reference image
  if (imageBase64) {
    const dataUri = `data:${imageMimeType};base64,${imageBase64}`
    body.referenceImages = [
      {
        uri: dataUri,
        useType: "subject",
      },
    ]

    // Enhance the prompt to reference the input image
    body.promptText = `@subject ${prompt}`
  }

  console.log("🖌️ RunwayML image-edit — creating task…")
  const createRes = await runwayFetch("/text_to_image", {
    method: "POST",
    body: JSON.stringify(body),
  })

  if (!createRes.ok) {
    const errData = await createRes.json().catch(() => ({}))
    throw new Error(
      `RunwayML image-edit error: ${createRes.status} — ${JSON.stringify(errData)}`
    )
  }

  const { id: taskId } = await createRes.json()
  console.log(`✅ RunwayML edit task created: ${taskId}`)

  const result = await pollTask(taskId)

  if (result.output && result.output.length > 0) {
    return result.output[0]
  }
  throw new Error("RunwayML returned no output images")
}

/**
 * Generate a video from a text prompt using RunwayML.
 * @returns URL of the generated video
 */
export async function generateVideoWithRunway(
  promptText: string,
  options?: {
    model?: RunwayVideoModel
    ratio?: RunwayVideoRatio
    duration?: number
    seed?: number
    promptImage?: string
    withAudio?: boolean
  }
): Promise<string> {
  const isImageToVideo = !!options?.promptImage;
  const endpoint = isImageToVideo ? "/image_to_video" : "/text_to_video";

  const body: any = {
    model: options?.model || "gen4.5",
    promptText,
    ratio: options?.ratio || "1280:720",
    duration: options?.duration || 10,
    exploreAudio: options?.withAudio ?? true,
  }

  if (isImageToVideo) {
    body.promptImage = options!.promptImage;
  }

  if (options?.seed !== undefined) {
    body.seed = options.seed
  }

  console.log(`🚀 RunwayML ${isImageToVideo ? 'image-to-video' : 'text-to-video'} — creating task…`)
  const createRes = await runwayFetch(endpoint, {
    method: "POST",
    body: JSON.stringify(body),
  })

  if (!createRes.ok) {
    const errData = await createRes.json().catch(() => ({}))
    throw new Error(`RunwayML create video task error: ${createRes.status} — ${JSON.stringify(errData)}`)
  }

  const { id: taskId } = await createRes.json()
  console.log(`✅ RunwayML video task created: ${taskId}`)

  const result = await pollTask(taskId)

  if (result.output && result.output.length > 0) {
    return result.output[0]
  }
  throw new Error("RunwayML returned no output video")
}
