/**
 * Gemini Smart API Router
 *
 * Intelligently routes requests across multiple API keys and model fallbacks,
 * tracking RPM / TPM / RPD usage per model per key in IndexedDB.
 *
 * Model priority (per key):
 *   1. gemini-3.1-flash-lite-preview  (primary)  – RPM 15, TPM 250K, RPD 500
 *   2. gemini-2.5-flash               (secondary) – RPM 5,  TPM 250K, RPD 20
 *   3. gemini-2.5-flash-lite          (tertiary)  – RPM 10, TPM 250K, RPD 20
 *   4. gemini-3-flash-preview         (quaternary) – RPM 5,  TPM 250K, RPD 20
 *
 * Flow:  primary → secondary → tertiary → quaternary → (next key) → … → Hyperreal fallback.
 *
 * An API key is "retired for 1 minute" when RPM or TPM is exceeded for the
 * current model.  It is "retired for 1 day" only when RPD is exhausted on
 * ALL models for that key.
 */

import { GoogleGenAI, ThinkingLevel } from "@google/genai"
import { getApiKeys } from "../lib/apiFallback"

// ─── Model definitions ───────────────────────────────────────────────────────

export interface ModelSpec {
  id: string
  rpm: number
  tpm: number
  rpd: number
}

export const MODEL_SPECS: ModelSpec[] = [
  { id: "gemini-3.1-flash-lite-preview", rpm: 15, tpm: 250_000, rpd: 500 },
  { id: "gemini-3-flash-preview", rpm: 5, tpm: 250_000, rpd: 20 },
  { id: "gemini-2.5-flash-lite", rpm: 10, tpm: 250_000, rpd: 20 },
  { id: "gemini-2.5-flash", rpm: 5, tpm: 250_000, rpd: 20 },
]

// ─── Usage tracking (IndexedDB) ──────────────────────────────────────────────

const DB_NAME = "koye_gemini_usage"
const DB_VERSION = 1
const STORE_NAME = "usage"

interface UsageRecord {
  /** Composite key:  `${apiKeyHash}::${modelId}` */
  id: string
  apiKeyHash: string
  modelId: string
  /** Requests made in the current minute window */
  rpm_used: number
  /** Tokens used in the current minute window */
  tpm_used: number
  /** Requests made in the current day window */
  rpd_used: number
  /** Timestamp (ms) of the minute window start */
  minute_window: number
  /** Timestamp (ms) of the day window start (midnight) */
  day_window: number
}

/** Short fingerprint so we never store the raw key */
function hashKey(apiKey: string): string {
  let h = 0
  for (let i = 0; i < apiKey.length; i++) {
    h = ((h << 5) - h + apiKey.charCodeAt(i)) | 0
  }
  return "k" + Math.abs(h).toString(36)
}

// ── Cached DB connection (avoids re-opening IndexedDB on every call) ─────────
let _dbCache: IDBDatabase | null = null
let _dbPromise: Promise<IDBDatabase> | null = null

function openDB(): Promise<IDBDatabase> {
  // Return cached connection if it's still open
  if (_dbCache) {
    try {
      // Quick liveness check — transaction will throw if DB was closed
      _dbCache.transaction(STORE_NAME, "readonly")
      return Promise.resolve(_dbCache)
    } catch {
      _dbCache = null
    }
  }
  // Deduplicate concurrent open requests
  if (_dbPromise) return _dbPromise

  _dbPromise = new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)
    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: "id" })
      }
    }
    request.onsuccess = () => {
      _dbCache = request.result
      _dbPromise = null
      // If the browser closes the connection, clear cache
      _dbCache.onclose = () => { _dbCache = null }
      resolve(_dbCache)
    }
    request.onerror = () => {
      _dbPromise = null
      reject(request.error)
    }
  })
  return _dbPromise
}

function emptyRecord(apiKeyHash: string, modelId: string): UsageRecord {
  return {
    id: `${apiKeyHash}::${modelId}`,
    apiKeyHash,
    modelId,
    rpm_used: 0,
    tpm_used: 0,
    rpd_used: 0,
    minute_window: 0,
    day_window: 0,
  }
}

async function getUsage(apiKeyHash: string, modelId: string): Promise<UsageRecord> {
  const db = await openDB()
  const id = `${apiKeyHash}::${modelId}`
  return new Promise((resolve) => {
    const tx = db.transaction(STORE_NAME, "readonly")
    const store = tx.objectStore(STORE_NAME)
    const req = store.get(id)
    req.onsuccess = () => resolve(req.result ?? emptyRecord(apiKeyHash, modelId))
    req.onerror = () => resolve(emptyRecord(apiKeyHash, modelId))
  })
}

/**
 * Batch-read all model usage records for a given key in a SINGLE transaction.
 * This is dramatically faster than calling getUsage() N times sequentially.
 */
async function getAllUsageForKey(apiKeyHash: string): Promise<Map<string, UsageRecord>> {
  const db = await openDB()
  const result = new Map<string, UsageRecord>()
  return new Promise((resolve) => {
    const tx = db.transaction(STORE_NAME, "readonly")
    const store = tx.objectStore(STORE_NAME)
    // Read all 4 model records in parallel within the same transaction
    let pending = MODEL_SPECS.length
    for (const spec of MODEL_SPECS) {
      const id = `${apiKeyHash}::${spec.id}`
      const req = store.get(id)
      req.onsuccess = () => {
        const rec = req.result ?? emptyRecord(apiKeyHash, spec.id)
        result.set(spec.id, refreshWindows(rec))
        if (--pending === 0) resolve(result)
      }
      req.onerror = () => {
        result.set(spec.id, refreshWindows(emptyRecord(apiKeyHash, spec.id)))
        if (--pending === 0) resolve(result)
      }
    }
  })
}

async function putUsage(record: UsageRecord): Promise<void> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite")
    const store = tx.objectStore(STORE_NAME)
    store.put(record)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}

// ─── Window helpers ──────────────────────────────────────────────────────────

function currentMinuteWindow(): number {
  return Math.floor(Date.now() / 60_000) * 60_000
}

function currentDayWindow(): number {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  return d.getTime()
}

/** Reset counters if the window has rolled over */
function refreshWindows(rec: UsageRecord): UsageRecord {
  const mw = currentMinuteWindow()
  const dw = currentDayWindow()
  if (rec.minute_window !== mw) {
    rec.rpm_used = 0
    rec.tpm_used = 0
    rec.minute_window = mw
  }
  if (rec.day_window !== dw) {
    rec.rpd_used = 0
    rec.day_window = dw
  }
  return rec
}

// ─── Core availability check ─────────────────────────────────────────────────

async function isModelAvailable(
  apiKeyHash: string,
  spec: ModelSpec,
  estimatedTokens: number = 500
): Promise<boolean> {
  let rec = await getUsage(apiKeyHash, spec.id)
  rec = refreshWindows(rec)

  if (rec.rpd_used >= spec.rpd) return false          // daily limit hit
  if (rec.rpm_used >= spec.rpm) return false           // per-minute limit hit
  if (rec.tpm_used + estimatedTokens > spec.tpm) return false // token budget exceeded

  return true
}

/** Record one successful request's usage */
export async function recordUsage(
  apiKey: string,
  modelId: string,
  tokensUsed: number
): Promise<void> {
  const kh = hashKey(apiKey)
  let rec = await getUsage(kh, modelId)
  rec = refreshWindows(rec)
  rec.rpm_used += 1
  rec.tpm_used += tokensUsed
  rec.rpd_used += 1
  await putUsage(rec)
}

/** Check if ALL models are exhausted for the day on this key */
async function isKeyRetiredForDay(apiKeyHash: string): Promise<boolean> {
  for (const spec of MODEL_SPECS) {
    let rec = await getUsage(apiKeyHash, spec.id)
    rec = refreshWindows(rec)
    if (rec.rpd_used < spec.rpd) return false // at least one model has capacity
  }
  return true
}

// ─── Smart Router ────────────────────────────────────────────────────────────

export interface SmartRouteResult {
  apiKey: string
  modelId: string
  client: GoogleGenAI
}

const GEMINI_API_KEYS = getApiKeys("VITE_GEMINI_API_KEY")

/**
 * Pick the best (apiKey, model) pair that is currently within limits.
 *
 * @param estimatedTokens – rough estimate of input+output tokens for budget check
 * @returns `SmartRouteResult` with the chosen key, model, and pre-built client
 * @throws if every key × model combination is exhausted
 */
export async function pickRoute(
  estimatedTokens: number = 500
): Promise<SmartRouteResult> {
  for (const apiKey of GEMINI_API_KEYS) {
    const kh = hashKey(apiKey)

    // Batch-read ALL model usage for this key in one transaction (fast!)
    const usageMap = await getAllUsageForKey(kh)

    // Check if key is retired for the day (all models RPD exhausted)
    const allDayExhausted = MODEL_SPECS.every(spec => {
      const rec = usageMap.get(spec.id)!
      return rec.rpd_used >= spec.rpd
    })
    if (allDayExhausted) {
      console.log(`[SmartRouter] Key ${kh} retired for day, skipping`)
      continue
    }

    // Try models in priority order using the already-loaded records
    for (const spec of MODEL_SPECS) {
      const rec = usageMap.get(spec.id)!
      const available =
        rec.rpd_used < spec.rpd &&
        rec.rpm_used < spec.rpm &&
        rec.tpm_used + estimatedTokens <= spec.tpm

      if (available) {
        console.log(`[SmartRouter] Selected key=${kh} model=${spec.id}`)
        return {
          apiKey,
          modelId: spec.id,
          client: new GoogleGenAI({ apiKey }),
        }
      }
    }

    console.log(`[SmartRouter] All models exhausted for key ${kh} this minute, trying next key`)
  }

  throw new Error("ALL_GEMINI_KEYS_EXHAUSTED")
}

/**
 * Execute a Gemini API call with full smart routing.
 *
 * 1. Picks the best key+model via `pickRoute`.
 * 2. Executes the caller's function.
 * 3. On success → records usage.
 * 4. On rate-limit → marks the model, retries with next available slot.
 * 5. When all Gemini keys are exhausted → throws `ALL_GEMINI_KEYS_EXHAUSTED`
 *    so the caller can fall back to Hyperreal.
 *
 * @param fn – receives `{ client, modelId, apiKey }` and returns a result + tokensUsed
 */
export async function withSmartRoute<T>(
  fn: (route: SmartRouteResult) => Promise<{ result: T; tokensUsed: number }>,
  estimatedTokens: number = 500,
  maxAttempts: number = 12 // 4 models × 3 keys = 12 possible combos
): Promise<T> {
  let lastError: any = null

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    let route: SmartRouteResult

    try {
      route = await pickRoute(estimatedTokens)
    } catch (e) {
      // No available routes at all
      throw e
    }

    try {
      const { result, tokensUsed } = await fn(route)
      // Record successful usage
      await recordUsage(route.apiKey, route.modelId, tokensUsed)
      return result
    } catch (error) {
      lastError = error
      const msg = error instanceof Error ? error.message : String(error)
      const isRateLimit =
        msg.includes("429") ||
        msg.includes("quota") ||
        msg.includes("rate") ||
        msg.includes("RESOURCE_EXHAUSTED")

      if (isRateLimit) {
        // "Burn" this model's budget so pickRoute skips it next iteration
        const kh = hashKey(route.apiKey)
        const spec = MODEL_SPECS.find((s) => s.id === route.modelId)
        if (spec) {
          let rec = await getUsage(kh, route.modelId)
          rec = refreshWindows(rec)
          // Saturate whichever limit was likely hit
          rec.rpm_used = spec.rpm
          await putUsage(rec)
        }
        console.warn(
          `[SmartRouter] Rate limited on key=${kh} model=${route.modelId}, rotating…`
        )
        continue
      }

      // Non-rate-limit error (e.g. 404, bad request) → don't retry, propagate
      throw error
    }
  }

  throw lastError || new Error("Smart router exhausted all attempts")
}

// ─── Streaming variant ───────────────────────────────────────────────────────

/**
 * Same as `withSmartRoute` but for streaming generators.
 * Returns an async generator that transparently retries on rate-limit errors.
 */
export async function* withSmartRouteStream(
  fn: (
    route: SmartRouteResult
  ) => AsyncGenerator<{ text: string; tokensUsed: number }, void, unknown>,
  estimatedTokens: number = 500,
  maxAttempts: number = 12
): AsyncGenerator<string, void, unknown> {
  let lastError: any = null

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    let route: SmartRouteResult

    try {
      route = await pickRoute(estimatedTokens)
    } catch (e) {
      throw e
    }

    try {
      let totalTokens = 0
      for await (const chunk of fn(route)) {
        totalTokens += chunk.tokensUsed
        yield chunk.text
      }
      // Record successful usage at the end of the stream
      await recordUsage(route.apiKey, route.modelId, totalTokens)
      return
    } catch (error) {
      lastError = error
      const msg = error instanceof Error ? error.message : String(error)
      const isRateLimit =
        msg.includes("429") ||
        msg.includes("quota") ||
        msg.includes("rate") ||
        msg.includes("RESOURCE_EXHAUSTED")

      if (isRateLimit) {
        const kh = hashKey(route.apiKey)
        const spec = MODEL_SPECS.find((s) => s.id === route.modelId)
        if (spec) {
          let rec = await getUsage(kh, route.modelId)
          rec = refreshWindows(rec)
          rec.rpm_used = spec.rpm
          await putUsage(rec)
        }
        console.warn(
          `[SmartRouter] Stream rate limited on key=${kh} model=${route.modelId}, rotating…`
        )
        continue
      }

      throw error
    }
  }

  throw lastError || new Error("Smart router stream exhausted all attempts")
}

// ─── Debug / monitoring helpers ──────────────────────────────────────────────

export interface KeyUsageSummary {
  keyHash: string
  models: Array<{
    modelId: string
    rpm_used: number
    rpm_limit: number
    tpm_used: number
    tpm_limit: number
    rpd_used: number
    rpd_limit: number
    available: boolean
  }>
  retiredForDay: boolean
}

/** Get a human-readable snapshot of all API key usage (for debugging / UI) */
export async function getUsageSummary(): Promise<KeyUsageSummary[]> {
  const summaries: KeyUsageSummary[] = []

  for (const apiKey of GEMINI_API_KEYS) {
    const kh = hashKey(apiKey)
    const models = []

    for (const spec of MODEL_SPECS) {
      let rec = await getUsage(kh, spec.id)
      rec = refreshWindows(rec)
      models.push({
        modelId: spec.id,
        rpm_used: rec.rpm_used,
        rpm_limit: spec.rpm,
        tpm_used: rec.tpm_used,
        tpm_limit: spec.tpm,
        rpd_used: rec.rpd_used,
        rpd_limit: spec.rpd,
        available: await isModelAvailable(kh, spec),
      })
    }

    summaries.push({
      keyHash: kh,
      models,
      retiredForDay: await isKeyRetiredForDay(kh),
    })
  }

  return summaries
}
