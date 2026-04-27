/**
 * Bing Image Search Service — via searchapi.io
 * Multi-key fallback: tries VITE_SEARCHAPI_KEY, VITE_SEARCHAPI_KEY1, VITE_SEARCHAPI_KEY2, etc.
 *
 * Builds composite queries from the user's input mixing sources:
 *   - site:pinterest.com game {query} clean background
 *   - site:artstation.com game {query} concept art
 *   - site:sketchfab.com {query} 3d model
 *
 * Results are merged, deduplicated, and shuffled for variety.
 */

const SEARCHAPI_BASE = "https://www.searchapi.io/api/v1/search"

// ─── Types ───────────────────────────────────────────────────────────────────

export interface BingImageResult {
  id: string
  title: string
  sourceUrl: string
  sourceName: string
  originalUrl: string
  thumbnailUrl: string
  width: number
  height: number
}

// ─── Multi-key helpers ───────────────────────────────────────────────────────

function getAllSearchApiKeys(): string[] {
  const keys: string[] = []
  const primary = import.meta.env.VITE_SEARCHAPI_KEY
  if (primary) keys.push(primary)

  for (let i = 1; i <= 10; i++) {
    const key = import.meta.env[`VITE_SEARCHAPI_KEY${i}`]
    if (key) keys.push(key)
  }

  if (keys.length === 0) {
    throw new Error("No SearchAPI credentials found. Please set VITE_SEARCHAPI_KEY in .env")
  }
  return [...new Set(keys)] // deduplicate
}

function shouldTryNextKey(error: any): boolean {
  if (!error) return false
  const msg = error instanceof Error ? error.message : String(error)
  const lower = msg.toLowerCase()
  return (
    lower.includes("401") ||
    lower.includes("403") ||
    lower.includes("429") ||
    lower.includes("unauthorized") ||
    lower.includes("quota") ||
    lower.includes("rate limit") ||
    lower.includes("invalid api key") ||
    lower.includes("limit") ||
    lower.includes("exceeded")
  )
}

// ─── Core fetch with multi-key fallback ──────────────────────────────────────

async function fetchBingImages(query: string, size?: string): Promise<BingImageResult[]> {
  const keys = getAllSearchApiKeys()
  let lastError: any = null

  for (let i = 0; i < keys.length; i++) {
    try {
      const params = new URLSearchParams({
        engine: "bing_images",
        q: query,
        api_key: keys[i],
        safe_search: "moderate",
      })
      if (size) params.set("size", size)

      const url = `${SEARCHAPI_BASE}?${params.toString()}`
      console.log(`[BingImageSearch] Trying key ${i + 1}/${keys.length} for: "${query}"`)

      const response = await fetch(url)

      if (!response.ok) {
        const errorText = await response.text().catch(() => "Unknown error")
        throw new Error(`HTTP ${response.status}: ${errorText}`)
      }

      const data = await response.json()
      const images: BingImageResult[] = (data.images || []).map((img: any, idx: number) => ({
        id: `bing-${Date.now()}-${idx}-${Math.random().toString(36).slice(2, 7)}`,
        title: img.title || "Untitled",
        sourceUrl: img.source?.link || "",
        sourceName: img.source?.name || "Unknown",
        originalUrl: img.original?.link || "",
        thumbnailUrl: img.thumbnail || "",
        width: parseInt(img.original?.width, 10) || 0,
        height: parseInt(img.original?.height, 10) || 0,
      }))

      // Filter out results with no usable image URL
      return images.filter(img => img.originalUrl || img.thumbnailUrl)
    } catch (error) {
      lastError = error
      console.warn(`[BingImageSearch] Key ${i + 1} failed:`, error)
      if (!shouldTryNextKey(error)) throw error
    }
  }

  throw lastError || new Error("All SearchAPI keys failed for Bing Image Search")
}

// ─── Composite search (merges multiple source-targeted queries) ──────────────

/**
 * Performs a Bing Image Search using composite queries aimed at game-art sources.
 * Runs up to 3 searches in parallel, merges, deduplicates, and shuffles results.
 */
export async function searchBingImages(userQuery: string): Promise<BingImageResult[]> {
  const trimmed = userQuery.trim()
  if (!trimmed) return []

  // Build the three source-targeted queries
  const queries = [
    `site:pinterest.com game ${trimmed} clean background`,
    `site:artstation.com game ${trimmed} concept art`,
    `site:sketchfab.com ${trimmed} 3d model`,
  ]

  console.log(`[BingImageSearch] Launching composite search for: "${trimmed}"`)

  // Run all three in parallel — allow individual ones to fail gracefully
  const results = await Promise.all(
    queries.map(q =>
      fetchBingImages(q, "large").catch(err => {
        console.warn(`[BingImageSearch] Sub-query failed: "${q}"`, err)
        return [] as BingImageResult[]
      })
    )
  )

  // Merge all results
  const merged = results.flat()

  // Deduplicate by original URL
  const seen = new Set<string>()
  const unique = merged.filter(img => {
    const key = img.originalUrl || img.thumbnailUrl
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })

  // Shuffle for variety (Fisher-Yates)
  for (let i = unique.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [unique[i], unique[j]] = [unique[j], unique[i]]
  }

  console.log(`[BingImageSearch] Total unique results: ${unique.length}`)
  return unique
}

// ─── CORS-safe download helpers ──────────────────────────────────────────────

/**
 * Fetch an image as a Blob using multiple strategies in order:
 *
 * 1. Vite dev proxy (/api/image-proxy) — most reliable, no CORS issues
 * 2. corsproxy.io — fallback public CORS proxy
 * 3. Direct fetch — works for CORS-friendly domains
 *
 * Returns the Blob or throws if ALL strategies fail.
 */
export async function downloadImageAsBlob(imageUrl: string): Promise<Blob> {
  const strategies: Array<{ name: string; fetchFn: () => Promise<Response> }> = [
    {
      name: "Vite image proxy",
      fetchFn: () => fetch(`/api/image-proxy?url=${encodeURIComponent(imageUrl)}`),
    },
    {
      name: "corsproxy.io",
      fetchFn: () => fetch(`https://corsproxy.io/?${encodeURIComponent(imageUrl)}`),
    },
    {
      name: "Direct fetch",
      fetchFn: () => fetch(imageUrl, { mode: "cors" }),
    },
  ]

  let lastError: Error | null = null

  for (const strategy of strategies) {
    try {
      console.log(`[BingImageSearch] Trying download via ${strategy.name}...`)
      const response = await strategy.fetchFn()

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`)
      }

      const blob = await response.blob()

      // Verify we got actual image data (not an HTML error page)
      if (blob.size < 100) {
        throw new Error(`Response too small (${blob.size} bytes), likely not an image`)
      }
      if (blob.type && blob.type.startsWith("text/")) {
        throw new Error(`Got text response instead of image: ${blob.type}`)
      }

      console.log(`[BingImageSearch] ✓ Downloaded ${blob.size} bytes via ${strategy.name}`)
      return blob
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err))
      console.warn(`[BingImageSearch] ${strategy.name} failed:`, lastError.message)
    }
  }

  throw lastError || new Error("All download strategies failed")
}

/**
 * Downloads an image in a CORS-safe way and triggers a browser download.
 *
 * Uses `downloadImageAsBlob` with multi-strategy fallback.
 * If ALL strategies fail, opens the image in a new tab so the user can save manually.
 */
export async function downloadImageSafe(imageUrl: string, fileName: string): Promise<void> {
  try {
    const blob = await downloadImageAsBlob(imageUrl)

    // Trigger browser download
    const blobUrl = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = blobUrl
    a.download = fileName
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    setTimeout(() => URL.revokeObjectURL(blobUrl), 2000)
    console.log(`[BingImageSearch] Downloaded: ${fileName}`)
  } catch (err) {
    console.warn("[BingImageSearch] All download strategies failed, opening in new tab:", err)
    // Last resort: open in new tab so the user can right-click → Save As
    window.open(imageUrl, "_blank")
    console.log(`[BingImageSearch] Opened in new tab for manual download: ${imageUrl}`)
  }
}
