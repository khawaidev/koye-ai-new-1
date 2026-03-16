/**
 * Utility functions for API key fallback support
 * Supports multiple API keys: KEY, KEY1, KEY2, KEY3, etc.
 */

/**
 * Get API keys with fallback support
 * Tries KEY, then KEY1, KEY2, KEY3, etc. until it finds a valid key or exhausts all options
 * @param baseKeyName - Base environment variable name (e.g., "VITE_GEMINI_API_KEY")
 * @param maxFallbacks - Maximum number of fallback keys to try (default: 10)
 * @returns Array of API keys in order of preference
 */
export function getApiKeys(baseKeyName: string, maxFallbacks: number = 10): string[] {
  const keys: string[] = []

  // Get the primary key
  const primaryKey = import.meta.env[baseKeyName] || ""
  if (primaryKey) {
    keys.push(primaryKey)
  }

  // Get fallback keys (KEY1, KEY2, KEY3, etc.)
  for (let i = 1; i <= maxFallbacks; i++) {
    const fallbackKeyName = `${baseKeyName}${i}`
    const fallbackKey = import.meta.env[fallbackKeyName] || ""
    if (fallbackKey) {
      keys.push(fallbackKey)
    }
  }

  return keys.filter(key => key.trim() !== "")
}

/**
 * Execute a function with API key fallback
 * Tries each key in sequence until one succeeds
 * @param keys - Array of API keys to try
 * @param apiCall - Function that takes an API key and returns a Promise
 * @param errorHandler - Optional function to check if error should trigger fallback
 * @returns Result from the first successful API call
 */
export async function withApiFallback<T>(
  keys: string[],
  apiCall: (key: string) => Promise<T>,
  errorHandler?: (error: any) => boolean,
  maxRetries: number = 3,
  retryDelay: number = 1000
): Promise<T> {
  if (keys.length === 0) {
    throw new Error("No API keys provided")
  }

  let lastError: any = null

  for (let i = 0; i < keys.length; i++) {
    const key = keys[i]

    // Retry logic for this key
    for (let retry = 0; retry < maxRetries; retry++) {
      try {
        return await apiCall(key)
      } catch (error) {
        lastError = error

        // Check if error is retryable (503, overloaded, etc.)
        const isRetryable = errorHandler
          ? errorHandler(error)
          : shouldFallbackToNextKey(error)

        // If it's a 503 or overloaded error, retry with delay
        const errorMessage = error instanceof Error ? error.message : String(error)
        const is503Error = errorMessage.includes("503") ||
          errorMessage.includes("overloaded") ||
          errorMessage.includes("try again later")

        if (is503Error && retry < maxRetries - 1) {
          // Wait before retrying (exponential backoff)
          const delay = retryDelay * Math.pow(2, retry)
          console.warn(`API call failed with 503/overload error, retrying in ${delay}ms... (attempt ${retry + 1}/${maxRetries})`)
          await new Promise(resolve => setTimeout(resolve, delay))
          continue // Retry with same key
        }

        // Check if we should try the next key
        if (!isRetryable) {
          // Error is not retryable, throw immediately
          throw error
        }

        // If we've exhausted retries for this key, move to next key
        if (retry === maxRetries - 1) {
          break // Move to next key
        }
      }
    }

    // Log fallback attempt
    if (i < keys.length - 1) {
      console.warn(`API key ${i + 1} failed after ${maxRetries} retries, trying fallback ${i + 2}...`, lastError)
    }
  }

  // All keys failed
  throw lastError || new Error("All API keys failed")
}

/**
 * Determine if an error should trigger fallback to next key
 * @param error - The error that occurred
 * @returns true if we should try the next key, false otherwise
 */
function shouldFallbackToNextKey(error: any): boolean {
  if (!error) return false

  const errorMessage = error instanceof Error ? error.message : String(error)
  const errorString = errorMessage.toLowerCase()

  // Retry on these errors:
  // - Authentication errors (401, 403)
  // - Payment / credit errors (402)
  // - Rate limit errors (429)
  // - Server overload errors (503)
  // - Quota exceeded / insufficient credits
  // - Invalid API key
  const retryableErrors = [
    "401",
    "402",
    "403",
    "429",
    "503",
    "unauthorized",
    "forbidden",
    "payment required",
    "insufficient_credits",
    "insufficient credits",
    "quota",
    "rate limit",
    "overloaded",
    "try again later",
    "invalid api key",
    "api key",
    "authentication",
    "invalid key"
  ]

  return retryableErrors.some(keyword => errorString.includes(keyword))
}

/**
 * Get paired API keys with fallback support (for APIs that need two keys like HITED3D)
 * @param baseKeyName1 - Base name for first key (e.g., "VITE_HITEM3D_ACCESS_KEY")
 * @param baseKeyName2 - Base name for second key (e.g., "VITE_HITEM3D_SECRET_KEY")
 * @param maxFallbacks - Maximum number of fallback pairs to try
 * @returns Array of key pairs in order of preference
 */
export function getPairedApiKeys(
  baseKeyName1: string,
  baseKeyName2: string,
  maxFallbacks: number = 10
): Array<{ key1: string; key2: string }> {
  const pairs: Array<{ key1: string; key2: string }> = []

  // Get primary pair
  const primaryKey1 = import.meta.env[baseKeyName1] || ""
  const primaryKey2 = import.meta.env[baseKeyName2] || ""
  if (primaryKey1 && primaryKey2) {
    pairs.push({ key1: primaryKey1, key2: primaryKey2 })
  }

  // Get fallback pairs
  for (let i = 1; i <= maxFallbacks; i++) {
    const fallbackKey1Name = `${baseKeyName1}${i}`
    const fallbackKey2Name = `${baseKeyName2}${i}`
    const fallbackKey1 = import.meta.env[fallbackKey1Name] || ""
    const fallbackKey2 = import.meta.env[fallbackKey2Name] || ""

    if (fallbackKey1 && fallbackKey2) {
      pairs.push({ key1: fallbackKey1, key2: fallbackKey2 })
    }
  }

  return pairs.filter(pair => pair.key1.trim() !== "" && pair.key2.trim() !== "")
}

/**
 * Execute a function with paired API key fallback
 * @param pairs - Array of key pairs to try
 * @param apiCall - Function that takes a key pair and returns a Promise
 * @param errorHandler - Optional function to check if error should trigger fallback
 * @returns Result from the first successful API call
 */
export async function withPairedApiFallback<T>(
  pairs: Array<{ key1: string; key2: string }>,
  apiCall: (pair: { key1: string; key2: string }) => Promise<T>,
  errorHandler?: (error: any) => boolean
): Promise<T> {
  if (pairs.length === 0) {
    throw new Error("No API key pairs provided")
  }

  let lastError: any = null

  for (let i = 0; i < pairs.length; i++) {
    const pair = pairs[i]
    try {
      return await apiCall(pair)
    } catch (error) {
      lastError = error

      const shouldFallback = errorHandler
        ? errorHandler(error)
        : shouldFallbackToNextKey(error)

      if (!shouldFallback) {
        throw error
      }

      if (i < pairs.length - 1) {
        console.warn(`API key pair ${i + 1} failed, trying fallback pair ${i + 2}...`, error)
      }
    }
  }

  throw lastError || new Error("All API key pairs failed")
}

