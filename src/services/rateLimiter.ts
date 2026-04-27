/**
 * Client-side Rate Limiter Service
 *
 * Uses a sliding-window approach per service type.
 * Each service tracks timestamps of recent requests.
 * LLM Chat is tracked separately from generation services.
 */

export type RateLimitedService =
  | "image-generation"
  | "audio-generation"
  | "3d-model"
  | "llm-chat"

interface RateLimitConfig {
  maxCalls: number
  windowMs: number
}

// Free-user rate limits
const RATE_LIMITS: Record<RateLimitedService, RateLimitConfig> = {
  "image-generation": { maxCalls: 2, windowMs: 60_000 },
  "audio-generation": { maxCalls: 2, windowMs: 60_000 },
  "3d-model":         { maxCalls: 1, windowMs: 60_000 },
  "llm-chat":         { maxCalls: 10, windowMs: 60_000 },
}

// In-memory store: service → array of request timestamps
const requestLog = new Map<RateLimitedService, number[]>()

/**
 * Prune timestamps older than the window for a given service.
 */
function pruneOldEntries(service: RateLimitedService): number[] {
  const config = RATE_LIMITS[service]
  if (!config) return []

  const now = Date.now()
  const cutoff = now - config.windowMs
  const entries = (requestLog.get(service) || []).filter((ts) => ts > cutoff)
  requestLog.set(service, entries)
  return entries
}

/**
 * Check whether a request is allowed for the given service.
 *
 * @returns `allowed` — true if the request can proceed.
 *          `retryAfterMs` — milliseconds until the next slot opens (0 if allowed).
 *          `remaining` — number of calls left in the current window.
 */
export function checkRateLimit(service: RateLimitedService): {
  allowed: boolean
  retryAfterMs: number
  remaining: number
} {
  const config = RATE_LIMITS[service]
  if (!config) return { allowed: true, retryAfterMs: 0, remaining: Infinity }

  const entries = pruneOldEntries(service)

  if (entries.length < config.maxCalls) {
    return {
      allowed: true,
      retryAfterMs: 0,
      remaining: config.maxCalls - entries.length,
    }
  }

  // Window is full — calculate when the oldest entry expires
  const oldestInWindow = entries[0]
  const retryAfterMs = oldestInWindow + config.windowMs - Date.now()

  return {
    allowed: false,
    retryAfterMs: Math.max(0, retryAfterMs),
    remaining: 0,
  }
}

/**
 * Record that a request was made for the given service.
 * Call this AFTER the request has been accepted (inside the generation handler).
 */
export function recordRequest(service: RateLimitedService): void {
  const entries = pruneOldEntries(service)
  entries.push(Date.now())
  requestLog.set(service, entries)
}

/**
 * Get human-readable retry message.
 */
export function getRateLimitMessage(service: RateLimitedService, retryAfterMs: number): string {
  const seconds = Math.ceil(retryAfterMs / 1000)
  const config = RATE_LIMITS[service]
  const serviceName = service.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
  return `Rate limit reached for ${serviceName}. Max ${config?.maxCalls} call${(config?.maxCalls || 0) > 1 ? "s" : ""} per minute. Try again in ${seconds}s.`
}
