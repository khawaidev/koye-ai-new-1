/**
 * Sound Generation Service
 * 
 * Uses ElevenLabs REST API directly for browser-compatible sound generation.
 * Endpoint: POST https://api.elevenlabs.io/v1/sound-generation
 */

import { getApiKeys } from "../lib/apiFallback"

const ELEVENLABS_API_KEYS = getApiKeys("VITE_ELEVENLABS_API_KEY")
const ELEVENLABS_BASE_URL = "https://api.elevenlabs.io/v1"

export interface SFXGenerationOptions {
  text: string
  duration_seconds?: number
  prompt_influence?: number
}

/**
 * Generate sound effects using ElevenLabs sound-generation API
 * @param options - SFX generation options
 * @returns Blob URL of the generated audio (audio/mpeg)
 */
export async function generateSoundEffect(
  options: SFXGenerationOptions
): Promise<string> {
  if (ELEVENLABS_API_KEYS.length === 0) {
    throw new Error("ElevenLabs API key is required. Set VITE_ELEVENLABS_API_KEY in your .env file")
  }

  const {
    text,
    duration_seconds,
    prompt_influence = 0.3,
  } = options

  let lastError: Error | null = null

  for (const apiKey of ELEVENLABS_API_KEYS) {
    try {
      const body: any = {
        text: text.trim(),
        prompt_influence,
      }
      if (duration_seconds) body.duration_seconds = duration_seconds

      const response = await fetch(`${ELEVENLABS_BASE_URL}/sound-generation`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "xi-api-key": apiKey,
        },
        body: JSON.stringify(body),
      })

      if (!response.ok) {
        let errorData: any = {}
        try {
          errorData = await response.json()
        } catch {
          errorData = { message: response.statusText }
        }

        const errMsg = `ElevenLabs SFX API error: ${response.status} ${response.statusText} - ${JSON.stringify(errorData)}`

        if ([401, 403, 429].includes(response.status)) {
          lastError = new Error(errMsg)
          continue
        }
        throw new Error(errMsg)
      }

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

  throw lastError || new Error("All ElevenLabs API keys failed for sound effects")
}
