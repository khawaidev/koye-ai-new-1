/**
 * ElevenLabs Sound Effects Service
 * 
 * Multi-API fallback:
 * 1. Direct ElevenLabs /v1/sound-generation (rotates VITE_ELEVENLABS_API_KEY*)
 * 2. RapidAPI ElevenLabs Sound Effects (rotates VITE_RAPIDAPI_KEY*)
 */

import { getApiKeys, withApiFallback } from "../lib/apiFallback"
import { generateAudioWithRapidElevenLabs } from "./rapidElevenLabs"

const ELEVENLABS_API_KEYS = getApiKeys("VITE_ELEVENLABS_API_KEY")
const ELEVENLABS_BASE_URL = "https://api.elevenlabs.io/v1"

export interface SfxGenerationOptions {
  text: string
  prompt_influence?: number
  duration_seconds?: number | null
}

export async function generateSfx(
  options: SfxGenerationOptions
): Promise<string> {
  const { text, prompt_influence = 0.3, duration_seconds = null } = options

  // ─── Tier 1: Direct ElevenLabs API ───
  if (ELEVENLABS_API_KEYS.length > 0) {
    try {
      return await withApiFallback(
        ELEVENLABS_API_KEYS,
        async (apiKey) => {
          const body: Record<string, unknown> = {
            text: text.trim(),
            prompt_influence,
          }
          if (duration_seconds != null) {
            body.duration_seconds = duration_seconds
          }

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
            try { errorData = await response.json() } catch { errorData = { message: response.statusText } }
            throw new Error(
              `ElevenLabs SFX error: ${response.status} ${response.statusText} - ${JSON.stringify(errorData)}`
            )
          }

          const blob = await response.blob()
          return URL.createObjectURL(new Blob([blob], { type: "audio/mpeg" }))
        }
      )
    } catch (err) {
      console.warn("[SFX] Direct ElevenLabs failed, trying RapidAPI fallback...", err)
    }
  }

  // ─── Tier 2: RapidAPI Fallback ───
  return await generateAudioWithRapidElevenLabs({
    text,
    prompt_influence,
    duration_seconds,
  })
}
