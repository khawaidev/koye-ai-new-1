/**
 * R2 Storage Service (Frontend)
 *
 * Communicates with the Cloudflare Worker proxy to upload, delete,
 * and list binary assets in R2. No R2 secrets touch the browser.
 *
 * Code files are NOT stored in R2 — they stay in Supabase DB.
 */

import { getSession } from "./supabase"

// Worker URL — safe to expose (no secrets)
const R2_WORKER_URL = import.meta.env.VITE_R2_WORKER_URL || ""
// Public read URL for the R2 bucket (r2.dev subdomain or custom domain)
const R2_PUBLIC_URL = import.meta.env.VITE_R2_PUBLIC_URL || ""

function joinUrl(base: string, path: string): string {
  const trimmedBase = base.replace(/\/+$/, "")
  const trimmedPath = path.replace(/^\/+/, "")
  return `${trimmedBase}/${trimmedPath}`
}

// ----- Auth helper -----

async function getAuthToken(): Promise<string> {
  const session = await getSession()
  if (!session?.access_token) {
    throw new Error("Not authenticated — please log in to upload assets")
  }
  return session.access_token
}

// ----- Binary asset detection -----

const BINARY_EXTENSIONS = new Set([
  // Images
  "png", "jpg", "jpeg", "gif", "webp", "bmp", "ico", "svg", "tiff",
  // 3D Models
  "glb", "gltf", "obj", "fbx", "stl", "3ds", "dae", "ply",
  // Video
  "mp4", "webm", "mov", "avi", "mkv",
  // Audio
  "mp3", "wav", "ogg", "flac", "m4a", "aac",
  // Archives
  "zip", "rar", "7z", "tar", "gz",
  // Other binary
  "pdf", "wasm",
])

/**
 * Check if a file path is a binary asset (should go to R2)
 */
export function isBinaryAsset(filePath: string): boolean {
  const ext = filePath.split(".").pop()?.toLowerCase() || ""
  return BINARY_EXTENSIONS.has(ext)
}

// ----- MIME type detection -----

function getMimeType(filePath: string): string {
  const ext = filePath.split(".").pop()?.toLowerCase() || ""
  const mimeMap: Record<string, string> = {
    png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg",
    gif: "image/gif", webp: "image/webp", svg: "image/svg+xml",
    bmp: "image/bmp", ico: "image/x-icon", tiff: "image/tiff",
    glb: "model/gltf-binary", gltf: "model/gltf+json",
    obj: "model/obj", fbx: "application/octet-stream",
    stl: "model/stl", "3ds": "application/octet-stream",
    mp4: "video/mp4", webm: "video/webm", mov: "video/quicktime",
    mp3: "audio/mpeg", wav: "audio/wav", ogg: "audio/ogg",
    flac: "audio/flac", m4a: "audio/mp4", aac: "audio/aac",
    pdf: "application/pdf", zip: "application/zip",
    wasm: "application/wasm",
  }
  return mimeMap[ext] || "application/octet-stream"
}

// ----- Core operations -----

/**
 * Upload a binary asset to R2 via the Worker proxy.
 *
 * @param userId - The user's Supabase user ID
 * @param r2Key  - Path inside R2 (e.g., "projects/{projectId}/assets/images/{uuid}.png")
 * @param data   - File content as Blob, ArrayBuffer, or base64 data URL string
 * @param contentType - Optional MIME type override
 * @returns The full public URL to the uploaded file
 */
export async function uploadAssetToR2(
  userId: string,
  r2Key: string,
  data: Blob | ArrayBuffer | string,
  contentType?: string
): Promise<string> {
  if (!R2_WORKER_URL) {
    throw new Error("R2 Worker URL not configured. Set VITE_R2_WORKER_URL in .env")
  }

  const token = await getAuthToken()
  const fullKey = `${userId}/${r2Key}`

  // Determine the MIME type
  const mime = contentType || getMimeType(r2Key)

  // Convert data to ArrayBuffer for upload
  let body: ArrayBuffer
  if (data instanceof Blob) {
    body = await data.arrayBuffer()
  } else if (data instanceof ArrayBuffer) {
    body = data
  } else if (typeof data === "string") {
    try {
      if (data.startsWith("data:")) {
        // Data URL → base64 → binary
        const base64 = data.split(",")[1]
        const binary = atob(base64)
        const bytes = new Uint8Array(binary.length)
        for (let i = 0; i < binary.length; i++) {
          bytes[i] = binary.charCodeAt(i)
        }
        body = bytes.buffer
      } else {
        // Attempt as raw base64 string
        const binary = atob(data)
        const bytes = new Uint8Array(binary.length)
        for (let i = 0; i < binary.length; i++) {
          bytes[i] = binary.charCodeAt(i)
        }
        body = bytes.buffer
      }
    } catch {
      // If atob() fails, this is just plain text, not a base64 string.
      // E.g., a standard string or malformed data stream.
      // We encode it using standard UTF-8 instead.
      const encoder = new TextEncoder()
      body = encoder.encode(data).buffer
    }
  } else {
    throw new Error("Unsupported data type for R2 upload")
  }

  const response = await fetch(joinUrl(R2_WORKER_URL, "/upload"), {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "X-File-Key": fullKey,
      "X-Content-Type": mime,
      "Content-Type": "application/octet-stream",
    },
    body,
  })

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ error: response.statusText }))
    throw new Error(`R2 upload failed: ${(errorData as any).error || response.statusText}`)
  }

  console.log(`✓ Uploaded to R2: ${fullKey} (${body.byteLength} bytes)`)

  // Return the public URL for reading
  return getR2PublicUrl(userId, r2Key)
}

/**
 * Delete a binary asset from R2 via the Worker proxy.
 */
export async function deleteAssetFromR2(
  userId: string,
  r2Key: string
): Promise<void> {
  if (!R2_WORKER_URL) {
    throw new Error("R2 Worker URL not configured")
  }

  const token = await getAuthToken()
  const fullKey = `${userId}/${r2Key}`

  const response = await fetch(joinUrl(R2_WORKER_URL, "/delete"), {
    method: "DELETE",
    headers: {
      Authorization: `Bearer ${token}`,
      "X-File-Key": fullKey,
    },
  })

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ error: response.statusText }))
    throw new Error(`R2 delete failed: ${(errorData as any).error || response.statusText}`)
  }

  console.log(`✓ Deleted from R2: ${fullKey}`)
}

/**
 * List files in R2 under a prefix.
 */
export async function listR2Assets(
  userId: string,
  prefix: string = ""
): Promise<Array<{ key: string; size: number; uploaded: string }>> {
  if (!R2_WORKER_URL) {
    throw new Error("R2 Worker URL not configured")
  }

  const token = await getAuthToken()
  const fullPrefix = `${userId}/${prefix}`

  const listUrl = new URL(joinUrl(R2_WORKER_URL, "/list"))
  listUrl.searchParams.set("prefix", fullPrefix)
  const response = await fetch(listUrl.toString(), {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  })

  if (!response.ok) {
    throw new Error(`R2 list failed: ${response.statusText}`)
  }

  const data = (await response.json()) as {
    files: Array<{ key: string; size: number; uploaded: string }>
  }

  return data.files
}

/**
 * Get the public read URL for an R2 asset.
 * No API call needed — just construct the URL.
 */
export function getR2PublicUrl(userId: string, r2Key: string): string {
  if (!R2_PUBLIC_URL) {
    // Fallback: construct from Worker URL (Worker can serve files too, but slower)
    console.warn("VITE_R2_PUBLIC_URL not set — using Worker URL for reads (slower)")
    return joinUrl(R2_WORKER_URL, `/file/${userId}/${r2Key}`)
  }
  return `${R2_PUBLIC_URL}/${userId}/${r2Key}`
}

/**
 * Attempts to parse a public URL into an R2 userId and r2Key.
 * Returns null if the URL is not an R2 URL.
 */
export function parseR2Url(url: string): { userId: string, r2Key: string } | null {
  if (!url) return null
  
  // Method 1: Matches R2_PUBLIC_URL (e.g. https://pub-xxx.r2.dev/userId/r2Key)
  if (R2_PUBLIC_URL && url.startsWith(R2_PUBLIC_URL)) {
    const relative = url.substring(R2_PUBLIC_URL.length).replace(/^\//, '')
    const parts = relative.split('/')
    if (parts.length >= 2) {
      const userId = parts[0]
      const r2Key = parts.slice(1).join('/')
      return { userId, r2Key }
    }
  }

  // Method 2: Matches R2_WORKER_URL fallback (e.g. https://worker-domain.com/file/userId/r2Key)
  if (R2_WORKER_URL && url.startsWith(`${R2_WORKER_URL}/file/`)) {
    const relative = url.substring(`${R2_WORKER_URL}/file/`.length)
    const parts = relative.split('/')
    if (parts.length >= 2) {
      const userId = parts[0]
      const r2Key = parts.slice(1).join('/')
      return { userId, r2Key }
    }
  }

  return null
}

/**
 * Check if R2 storage is properly configured.
 */
export function isR2Configured(): boolean {
  return !!R2_WORKER_URL
}
