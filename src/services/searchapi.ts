/**
 * SearchAPI Service — Web search via searchapi.io
 * Supports Google Search, Google Images, and Google Videos.
 * Multi-key fallback: tries VITE_SEARCHAPI_KEY, VITE_SEARCHAPI_KEY1, VITE_SEARCHAPI_KEY2, etc.
 */

const SEARCHAPI_BASE = "https://www.searchapi.io/api/v1/search"

// ─── Types ───────────────────────────────────────────────────────────────────

export interface WebSearchResult {
  query: string
  organic: Array<{
    title: string
    link: string
    snippet: string
    source: string
    favicon?: string
  }>
  images: Array<{
    title: string
    link: string
    thumbnail: string
    original: string
  }>
  videos: Array<{
    title: string
    link: string
    thumbnail?: string
    source: string
    length?: string
  }>
  relatedSearches: Array<{ query: string }>
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
  return [...new Set(keys)]
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
    lower.includes("invalid api key")
  )
}

// ─── Low-level fetch helpers ─────────────────────────────────────────────────

async function fetchWithFallback<T>(
  buildUrl: (apiKey: string) => string,
  parseResponse: (data: any) => T
): Promise<T> {
  const keys = getAllSearchApiKeys()
  let lastError: any = null

  for (let i = 0; i < keys.length; i++) {
    try {
      const url = buildUrl(keys[i])
      console.log(`[SearchAPI] Trying key ${i + 1} for search`)

      const response = await fetch(url)

      if (!response.ok) {
        const errorText = await response.text().catch(() => "Unknown error")
        throw new Error(`HTTP ${response.status}: ${errorText}`)
      }

      const data = await response.json()
      return parseResponse(data)
    } catch (error) {
      lastError = error
      console.warn(`[SearchAPI] Key ${i + 1} failed:`, error)
      if (!shouldTryNextKey(error)) throw error
    }
  }

  throw lastError || new Error("All SearchAPI keys failed")
}

// ─── Google Search ───────────────────────────────────────────────────────────

async function searchGoogle(query: string): Promise<{
  organic: WebSearchResult["organic"]
  relatedSearches: WebSearchResult["relatedSearches"]
}> {
  return fetchWithFallback(
    (apiKey) => {
      const params = new URLSearchParams({
        engine: "google",
        q: query,
        api_key: apiKey,
        gl: "us",
        hl: "en",
      })
      return `${SEARCHAPI_BASE}?${params.toString()}`
    },
    (data) => {
      const organic = (data.organic_results || []).slice(0, 6).map((r: any) => ({
        title: r.title || "",
        link: r.link || "",
        snippet: r.snippet || "",
        source: r.source || r.domain || "",
        favicon: r.favicon || undefined,
      }))

      const relatedSearches = (data.related_searches || []).slice(0, 5).map((r: any) => ({
        query: r.query || "",
      }))

      return { organic, relatedSearches }
    }
  )
}

// ─── Google Images ───────────────────────────────────────────────────────────

async function searchGoogleImages(query: string): Promise<WebSearchResult["images"]> {
  return fetchWithFallback(
    (apiKey) => {
      const params = new URLSearchParams({
        engine: "google_images",
        q: query,
        api_key: apiKey,
        gl: "us",
        hl: "en",
      })
      return `${SEARCHAPI_BASE}?${params.toString()}`
    },
    (data) => {
      return (data.images || []).slice(0, 6).map((img: any) => ({
        title: img.title || "",
        link: img.source?.link || img.link || "",
        thumbnail: img.thumbnail || "",
        original: img.original?.link || img.original || "",
      }))
    }
  )
}

// ─── Google Videos ───────────────────────────────────────────────────────────

async function searchGoogleVideos(query: string): Promise<WebSearchResult["videos"]> {
  return fetchWithFallback(
    (apiKey) => {
      const params = new URLSearchParams({
        engine: "google_videos",
        q: query,
        api_key: apiKey,
        gl: "us",
        hl: "en",
      })
      return `${SEARCHAPI_BASE}?${params.toString()}`
    },
    (data) => {
      return (data.videos || data.video_results || []).slice(0, 4).map((v: any) => ({
        title: v.title || "",
        link: v.link || "",
        thumbnail: v.thumbnail || undefined,
        source: v.source || v.channel || "",
        length: v.length || v.duration || undefined,
      }))
    }
  )
}

// ─── Unified Web Search ──────────────────────────────────────────────────────

/**
 * Performs a unified web search combining Google Search, Images, and Videos.
 * All three calls run in parallel for speed.
 */
export async function webSearch(query: string): Promise<WebSearchResult> {
  console.log(`[SearchAPI] Performing web search for: "${query}"`)

  // Run all three in parallel — if images/videos fail, we still return text results
  const [googleResult, images, videos] = await Promise.all([
    searchGoogle(query),
    searchGoogleImages(query).catch((err) => {
      console.warn("[SearchAPI] Image search failed:", err)
      return [] as WebSearchResult["images"]
    }),
    searchGoogleVideos(query).catch((err) => {
      console.warn("[SearchAPI] Video search failed:", err)
      return [] as WebSearchResult["videos"]
    }),
  ])

  return {
    query,
    organic: googleResult.organic,
    images,
    videos,
    relatedSearches: googleResult.relatedSearches,
  }
}

/**
 * Formats web search results into a text block that can be injected into the AI's context.
 */
export function formatSearchResultsForContext(results: WebSearchResult): string {
  let context = `\n\n[WEB SEARCH RESULTS for "${results.query}"]\n\n`

  if (results.organic.length > 0) {
    context += "### Top Results:\n"
    results.organic.forEach((r, i) => {
      context += `${i + 1}. **${r.title}** (${r.source})\n   ${r.snippet}\n   URL: ${r.link}\n\n`
    })
  }

  if (results.images.length > 0) {
    context += "\n### Related Images:\n"
    results.images.slice(0, 3).forEach((img, i) => {
      context += `${i + 1}. ${img.title} — ${img.link}\n`
    })
  }

  if (results.videos.length > 0) {
    context += "\n### Related Videos:\n"
    results.videos.slice(0, 3).forEach((vid, i) => {
      context += `${i + 1}. ${vid.title} (${vid.source}${vid.length ? `, ${vid.length}` : ""}) — ${vid.link}\n`
    })
  }

  context += "\n[END OF SEARCH RESULTS]\n"
  context += "INSTRUCTIONS: Use the search results above to answer the user's question. Cite sources when possible. Do NOT output another [WEB_SEARCH: ...] marker.\n"

  return context
}
