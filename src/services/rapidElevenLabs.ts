// RapidAPI ElevenLabs Sound Effects API Service
// Documentation: https://rapidapi.com/elevenlabs/api/elevenlabs-sound-effects
// Endpoint: https://elevenlabs-sound-effects.p.rapidapi.com/generate-sound

import { getApiKeys, withApiFallback } from "../lib/apiFallback"

// Get API keys with fallback support
const RAPIDAPI_KEYS = getApiKeys("VITE_RAPIDAPI_KEY")
const RAPIDAPI_HOST = "elevenlabs-sound-effects.p.rapidapi.com"
const RAPIDAPI_URL = "https://elevenlabs-sound-effects.p.rapidapi.com/generate-sound"

export interface RapidElevenLabsOptions {
  text: string
  prompt_influence?: number // Default: 0.3
  duration_seconds?: number | null // Optional, null for auto
}

export interface RapidElevenLabsResponse {
  status: string
  request_id: string
  parameters: {
    text: string
    prompt_influence?: number
    duration_seconds?: number | null
  }
  data: Array<{
    content_base64: string
    content_type: string
  }>
}

/**
 * Generate audio using RapidAPI ElevenLabs Sound Effects API
 * @param options - Audio generation options
 * @returns Blob URL of the generated audio
 */
export async function generateAudioWithRapidElevenLabs(
  options: RapidElevenLabsOptions
): Promise<string> {
  if (RAPIDAPI_KEYS.length === 0) {
    throw new Error("RapidAPI key is required. Set VITE_RAPIDAPI_KEY in your .env file")
  }

  const {
    text,
    prompt_influence = 0.3,
    duration_seconds = null,
  } = options

  return await withApiFallback(
    RAPIDAPI_KEYS,
    async (apiKey) => {
      const requestBody: any = {
        text: text.trim(),
        prompt_influence,
      }

      if (duration_seconds !== null && duration_seconds !== undefined) {
        requestBody.duration_seconds = duration_seconds
      }

      const response = await fetch(RAPIDAPI_URL, {
        method: "POST",
        headers: {
          "x-rapidapi-key": apiKey,
          "x-rapidapi-host": RAPIDAPI_HOST,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestBody),
      })

      if (!response.ok) {
        let errorData: any = {}
        try {
          errorData = await response.json()
        } catch {
          errorData = { message: response.statusText }
        }
        throw new Error(
          `RapidAPI ElevenLabs error: ${response.status} ${response.statusText} - ${JSON.stringify(errorData)}`
        )
      }

      const data: RapidElevenLabsResponse = await response.json()

      // Check for error in response
      if (data.status !== "OK" || !data.data || data.data.length === 0) {
        throw new Error(`RapidAPI ElevenLabs error: Invalid response - ${JSON.stringify(data)}`)
      }

      // Extract base64 audio content
      const audioData = data.data[0]
      if (!audioData.content_base64) {
        throw new Error("RapidAPI ElevenLabs error: No audio content in response")
      }

      // Convert base64 to blob
      // The base64 string may or may not have a data URL prefix
      let base64Data = audioData.content_base64
      if (base64Data.includes(",")) {
        // Remove data URL prefix if present (e.g., "data:audio/mpeg;base64,...")
        base64Data = base64Data.split(",")[1]
      }

      const binaryString = atob(base64Data)
      const bytes = new Uint8Array(binaryString.length)
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i)
      }

      // Create blob from bytes
      const contentType = audioData.content_type || "audio/mpeg"
      const blob = new Blob([bytes], { type: contentType })
      
      // Return blob URL
      return URL.createObjectURL(blob)
    }
  )
}

