/**
 * Music Generation Service
 * 
 * Uses ElevenLabs REST API directly for browser-compatible music generation.
 * Endpoint: POST https://api.elevenlabs.io/v1/music/compose
 */

import { getApiKeys } from "../lib/apiFallback"

const ELEVENLABS_API_KEYS = getApiKeys("VITE_ELEVENLABS_API_KEY")
const ELEVENLABS_BASE_URL = "https://api.elevenlabs.io/v1"

export interface MusicGenerationOptions {
  prompt: string
  durationMs?: number // Default: 30000 (30 seconds)
}

/**
 * Generate music using ElevenLabs music.compose API
 * @param options - Music generation options
 * @returns Blob URL of the generated music (audio/mpeg)
 */
export async function generateMusic(
  options: MusicGenerationOptions
): Promise<string> {
  if (ELEVENLABS_API_KEYS.length === 0) {
    throw new Error("ElevenLabs API key is required. Set VITE_ELEVENLABS_API_KEY in your .env file")
  }

  const {
    prompt,
    durationMs = 30000,
  } = options

  let lastError: Error | null = null

  for (const apiKey of ELEVENLABS_API_KEYS) {
    try {
      const response = await fetch(`${ELEVENLABS_BASE_URL}/music/compose`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "xi-api-key": apiKey,
        },
        body: JSON.stringify({
          prompt: prompt.trim(),
          music_length_ms: durationMs,
        }),
      })

      if (!response.ok) {
        let errorData: any = {}
        try {
          errorData = await response.json()
        } catch {
          errorData = { message: response.statusText }
        }

        const errMsg = `ElevenLabs Music API error: ${response.status} ${response.statusText} - ${JSON.stringify(errorData)}`

        // Retry with next key on auth/rate errors
        if ([401, 403, 429].includes(response.status)) {
          lastError = new Error(errMsg)
          continue
        }
        throw new Error(errMsg)
      }

      // Response is audio binary stream
      const blob = await response.blob()
      const audioBlob = new Blob([blob], { type: "audio/mpeg" })
      return URL.createObjectURL(audioBlob)
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error))
      const errMsg = lastError.message.toLowerCase()
      if (errMsg.includes("401") || errMsg.includes("403") || errMsg.includes("429")) {
        continue
      }
      throw lastError
    }
  }

  throw lastError || new Error("All ElevenLabs API keys failed for music generation")
}
