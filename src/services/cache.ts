/**
 * Client-Side Cache Layer
 * Reduces Supabase egress by caching query results in memory + IndexedDB.
 *
 * Features:
 * - In-memory LRU cache (instant reads, survives within session)
 * - IndexedDB persistence (survives page reloads, cold starts)
 * - TTL-based expiration (configurable per cache key)
 * - Request deduplication (prevents duplicate in-flight requests)
 * - Cache invalidation on writes (save/delete operations)
 * - Image blob caching (avoids re-downloading storage assets)
 */

// ==================== Types ====================

interface CacheEntry<T = unknown> {
    data: T
    timestamp: number
    ttl: number // milliseconds
}

interface CacheConfig {
    /** Time-to-live in milliseconds. Default: 5 minutes */
    ttl?: number
    /** Whether to persist to IndexedDB. Default: true */
    persist?: boolean
    /** Whether to use stale-while-revalidate pattern. Default: true */
    staleWhileRevalidate?: boolean
}

// ==================== Constants ====================

const DEFAULT_TTL = 5 * 60 * 1000       // 5 minutes
const ASSETS_TTL = 10 * 60 * 1000       // 10 minutes for assets (images, models, etc.)
const PROJECTS_TTL = 10 * 60 * 1000     // 10 minutes for projects list
const CHAT_SESSIONS_TTL = 3 * 60 * 1000 // 3 minutes for chat sessions
const IMAGE_BLOB_TTL = 30 * 60 * 1000   // 30 minutes for image blob cache
const DB_NAME = "koye_cache"
const DB_VERSION = 1
const STORE_NAME = "cache_entries"
const MAX_MEMORY_ENTRIES = 200          // Max items in memory LRU cache

// ==================== In-Memory Cache ====================

class MemoryCache {
    private cache = new Map<string, CacheEntry>()
    private accessOrder: string[] = []

    get<T>(key: string): T | null {
        const entry = this.cache.get(key)
        if (!entry) return null

        // Check TTL
        if (Date.now() - entry.timestamp > entry.ttl) {
            this.cache.delete(key)
            this.accessOrder = this.accessOrder.filter(k => k !== key)
            return null
        }

        // Move to end of access order (LRU)
        this.accessOrder = this.accessOrder.filter(k => k !== key)
        this.accessOrder.push(key)

        return entry.data as T
    }

    getStale<T>(key: string): { data: T; isStale: boolean } | null {
        const entry = this.cache.get(key)
        if (!entry) return null

        const isStale = Date.now() - entry.timestamp > entry.ttl
        return { data: entry.data as T, isStale }
    }

    set<T>(key: string, data: T, ttl: number = DEFAULT_TTL): void {
        // Evict if at capacity
        if (this.cache.size >= MAX_MEMORY_ENTRIES && !this.cache.has(key)) {
            const oldest = this.accessOrder.shift()
            if (oldest) this.cache.delete(oldest)
        }

        this.cache.set(key, { data, timestamp: Date.now(), ttl })
        this.accessOrder = this.accessOrder.filter(k => k !== key)
        this.accessOrder.push(key)
    }

    delete(key: string): void {
        this.cache.delete(key)
        this.accessOrder = this.accessOrder.filter(k => k !== key)
    }

    /** Delete all entries matching a prefix */
    invalidateByPrefix(prefix: string): void {
        const keysToDelete: string[] = []
        for (const key of this.cache.keys()) {
            if (key.startsWith(prefix)) {
                keysToDelete.push(key)
            }
        }
        for (const key of keysToDelete) {
            this.delete(key)
        }
    }

    clear(): void {
        this.cache.clear()
        this.accessOrder = []
    }

    get size(): number {
        return this.cache.size
    }
}

// ==================== IndexedDB Persistence ====================

let dbPromise: Promise<IDBDatabase> | null = null

function openDb(): Promise<IDBDatabase> {
    if (dbPromise) return dbPromise

    dbPromise = new Promise((resolve, reject) => {
        try {
            const request = indexedDB.open(DB_NAME, DB_VERSION)

            request.onupgradeneeded = () => {
                const db = request.result
                if (!db.objectStoreNames.contains(STORE_NAME)) {
                    db.createObjectStore(STORE_NAME)
                }
            }

            request.onsuccess = () => resolve(request.result)
            request.onerror = () => {
                console.warn("IndexedDB open failed, cache will be memory-only")
                reject(request.error)
            }
        } catch (e) {
            console.warn("IndexedDB not available, cache will be memory-only")
            reject(e)
        }
    })

    return dbPromise
}

async function idbGet<T>(key: string): Promise<CacheEntry<T> | null> {
    try {
        const db = await openDb()
        return new Promise((resolve) => {
            const tx = db.transaction(STORE_NAME, "readonly")
            const store = tx.objectStore(STORE_NAME)
            const request = store.get(key)

            request.onsuccess = () => {
                const entry = request.result as CacheEntry<T> | undefined
                if (!entry) {
                    resolve(null)
                    return
                }
                // Check TTL
                if (Date.now() - entry.timestamp > entry.ttl) {
                    resolve(null)
                    return
                }
                resolve(entry)
            }
            request.onerror = () => resolve(null)
        })
    } catch {
        return null
    }
}

async function idbSet<T>(key: string, data: T, ttl: number): Promise<void> {
    try {
        const db = await openDb()
        const entry: CacheEntry<T> = { data, timestamp: Date.now(), ttl }

        return new Promise((resolve) => {
            const tx = db.transaction(STORE_NAME, "readwrite")
            const store = tx.objectStore(STORE_NAME)
            store.put(entry, key)
            tx.oncomplete = () => resolve()
            tx.onerror = () => resolve()
        })
    } catch {
        // Silently fail - memory cache still works
    }
}

async function idbDelete(key: string): Promise<void> {
    try {
        const db = await openDb()
        return new Promise((resolve) => {
            const tx = db.transaction(STORE_NAME, "readwrite")
            const store = tx.objectStore(STORE_NAME)
            store.delete(key)
            tx.oncomplete = () => resolve()
            tx.onerror = () => resolve()
        })
    } catch {
        // Silently fail
    }
}

async function idbDeleteByPrefix(prefix: string): Promise<void> {
    try {
        const db = await openDb()
        return new Promise((resolve) => {
            const tx = db.transaction(STORE_NAME, "readwrite")
            const store = tx.objectStore(STORE_NAME)
            const request = store.getAllKeys()

            request.onsuccess = () => {
                const keys = request.result as string[]
                for (const key of keys) {
                    if (typeof key === "string" && key.startsWith(prefix)) {
                        store.delete(key)
                    }
                }
                resolve()
            }
            request.onerror = () => resolve()
        })
    } catch {
        // Silently fail
    }
}

async function idbClear(): Promise<void> {
    try {
        const db = await openDb()
        return new Promise((resolve) => {
            const tx = db.transaction(STORE_NAME, "readwrite")
            const store = tx.objectStore(STORE_NAME)
            store.clear()
            tx.oncomplete = () => resolve()
            tx.onerror = () => resolve()
        })
    } catch {
        // Silently fail
    }
}

// ==================== Request Deduplication ====================

const inFlightRequests = new Map<string, Promise<unknown>>()

// ==================== Main Cache API ====================

const memoryCache = new MemoryCache()

/**
 * Get data from cache or fetch it.
 * Implements stale-while-revalidate: returns stale data immediately while
 * fetching fresh data in the background.
 */
export async function cachedQuery<T>(
    key: string,
    fetcher: () => Promise<T>,
    config: CacheConfig = {}
): Promise<T> {
    const {
        ttl = DEFAULT_TTL,
        persist = true,
        staleWhileRevalidate = true,
    } = config

    // 1. Check in-memory cache first (fastest)
    const memResult = memoryCache.getStale<T>(key)
    if (memResult && !memResult.isStale) {
        return memResult.data
    }

    // 2. If stale data exists and SWR is enabled, return stale + revalidate in background
    if (memResult && memResult.isStale && staleWhileRevalidate) {
        // Fire-and-forget revalidation
        revalidate(key, fetcher, ttl, persist)
        return memResult.data
    }

    // 3. Check IndexedDB (slower but survives refresh)
    if (persist) {
        const idbResult = await idbGet<T>(key)
        if (idbResult) {
            // Populate memory cache
            memoryCache.set(key, idbResult.data, ttl)

            // If stale, revalidate in background
            if (Date.now() - idbResult.timestamp > ttl * 0.8) {
                revalidate(key, fetcher, ttl, persist)
            }

            return idbResult.data
        }
    }

    // 4. Deduplicate in-flight requests
    const existing = inFlightRequests.get(key)
    if (existing) {
        return existing as Promise<T>
    }

    // 5. Fetch fresh data
    const fetchPromise = fetcher()
        .then(data => {
            memoryCache.set(key, data, ttl)
            if (persist) {
                idbSet(key, data, ttl) // Fire-and-forget
            }
            inFlightRequests.delete(key)
            return data
        })
        .catch(err => {
            inFlightRequests.delete(key)
            // If fetch fails, try to return stale data
            const stale = memoryCache.get<T>(key)
            if (stale) return stale
            throw err
        })

    inFlightRequests.set(key, fetchPromise)
    return fetchPromise
}

/** Background revalidation (fire-and-forget) */
function revalidate<T>(
    key: string,
    fetcher: () => Promise<T>,
    ttl: number,
    persist: boolean
): void {
    // Don't duplicate revalidation requests
    if (inFlightRequests.has(key)) return

    const promise = fetcher()
        .then(data => {
            memoryCache.set(key, data, ttl)
            if (persist) {
                idbSet(key, data, ttl)
            }
            inFlightRequests.delete(key)
        })
        .catch(() => {
            inFlightRequests.delete(key)
        })

    inFlightRequests.set(key, promise)
}

// ==================== Cache Invalidation ====================

/**
 * Invalidate a specific cache key
 */
export function invalidateCache(key: string): void {
    memoryCache.delete(key)
    idbDelete(key)
}

/**
 * Invalidate all cache entries matching a prefix.
 * Use after write operations to ensure fresh data.
 *
 * Example prefixes:
 *  - `images:userId`   → invalidate all image queries for a user
 *  - `projects:userId` → invalidate project list
 *  - `chat:`           → invalidate all chat caches
 */
export function invalidateCacheByPrefix(prefix: string): void {
    memoryCache.invalidateByPrefix(prefix)
    idbDeleteByPrefix(prefix)
}

/**
 * Clear all cached data
 */
export function clearAllCache(): void {
    memoryCache.clear()
    idbClear()
}

// ==================== Cache Key Builders ====================

export const CacheKeys = {
    userImages: (userId: string, assetId?: string) =>
        assetId ? `images:${userId}:${assetId}` : `images:${userId}`,

    userModels: (userId: string, assetId?: string) =>
        assetId ? `models:${userId}:${assetId}` : `models:${userId}`,

    userVideos: (userId: string, assetId?: string) =>
        assetId ? `videos:${userId}:${assetId}` : `videos:${userId}`,

    userAudio: (userId: string, assetId?: string) =>
        assetId ? `audio:${userId}:${assetId}` : `audio:${userId}`,

    userChatSessions: (userId: string) =>
        `chat:${userId}`,

    projects: (userId: string) =>
        `projects:${userId}`,

    imageBlob: (url: string) =>
        `blob:${url}`,
}

// ==================== Pre-configured Cache Helpers ====================

/** Cache TTL presets for different data types */
export const CacheTTL = {
    ASSETS: ASSETS_TTL,
    PROJECTS: PROJECTS_TTL,
    CHAT_SESSIONS: CHAT_SESSIONS_TTL,
    IMAGE_BLOB: IMAGE_BLOB_TTL,
    DEFAULT: DEFAULT_TTL,
}

// ==================== Image Blob Cache ====================

/**
 * Cache an image URL as a blob URL to avoid repeat downloads from Supabase storage.
 * This is the biggest egress saver — images are the largest assets and are often
 * displayed multiple times (thumbnails, previews, zoomed views).
 */
export async function getCachedImageUrl(originalUrl: string): Promise<string> {
    // Skip caching for non-Supabase URLs, data URIs, and blob URIs
    if (
        !originalUrl ||
        originalUrl.startsWith("data:") ||
        originalUrl.startsWith("blob:") ||
        (!originalUrl.includes("supabase") && !originalUrl.includes("r2.dev"))
    ) {
        return originalUrl
    }

    const cacheKey = CacheKeys.imageBlob(originalUrl)

    // Check memory cache first
    const cached = memoryCache.get<string>(cacheKey)
    if (cached) return cached

    // Check IndexedDB for base64 data URI
    const idbResult = await idbGet<string>(cacheKey)
    if (idbResult) {
        memoryCache.set(cacheKey, idbResult.data, IMAGE_BLOB_TTL)
        return idbResult.data
    }

    // Not cached — fetch and cache as base64 data URI
    try {
        const response = await fetch(originalUrl)
        if (!response.ok) return originalUrl

        const blob = await response.blob()

        // Only cache images under 5MB
        if (blob.size > 5 * 1024 * 1024) return originalUrl

        // Convert to data URI for IndexedDB persistence
        const dataUri = await new Promise<string>((resolve) => {
            const reader = new FileReader()
            reader.onloadend = () => resolve(reader.result as string)
            reader.readAsDataURL(blob)
        })

        memoryCache.set(cacheKey, dataUri, IMAGE_BLOB_TTL)
        idbSet(cacheKey, dataUri, IMAGE_BLOB_TTL) // Persist

        return dataUri
    } catch {
        return originalUrl
    }
}

// ==================== Debug / Stats ====================

export function getCacheStats(): {
    memoryEntries: number
    inFlightRequests: number
} {
    return {
        memoryEntries: memoryCache.size,
        inFlightRequests: inFlightRequests.size,
    }
}
