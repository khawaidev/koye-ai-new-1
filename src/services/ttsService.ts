/**
 * Text-to-Speech (TTS) Service
 * 
 * Uses ElevenLabs REST API for browser-compatible text-to-speech generation.
 * Endpoint: POST https://api.elevenlabs.io/v1/text-to-speech/{voice_id}
 */

import { getApiKeys } from "../lib/apiFallback"

const ELEVENLABS_API_KEYS = getApiKeys("VITE_ELEVENLABS_API_KEY")
const ELEVENLABS_BASE_URL = "https://api.elevenlabs.io/v1"

// Default voice ID — "George" (deep, warm male voice)
const DEFAULT_VOICE_ID = "JBFqnCBsd6RMkjVDRZzb"

export interface TTSOptions {
  text: string
  voiceId?: string
  modelId?: string
  outputFormat?: string
  stability?: number
  similarityBoost?: number
  speed?: number
}

/**
 * Generate speech from text using ElevenLabs TTS API
 * @param options - TTS options
 * @returns Blob URL of the generated audio (audio/mpeg)
 */
export async function generateSpeech(
  options: TTSOptions
): Promise<string> {
  if (ELEVENLABS_API_KEYS.length === 0) {
    throw new Error("ElevenLabs API key is required. Set VITE_ELEVENLABS_API_KEY in your .env file")
  }

  const {
    text,
    voiceId = DEFAULT_VOICE_ID,
    modelId = "eleven_multilingual_v2",
    outputFormat = "mp3_44100_128",
    stability = 0.5,
    similarityBoost = 0.75,
    speed = 1.0,
  } = options

  let lastError: Error | null = null

  for (const apiKey of ELEVENLABS_API_KEYS) {
    try {
      const response = await fetch(
        `${ELEVENLABS_BASE_URL}/text-to-speech/${voiceId}?output_format=${outputFormat}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "xi-api-key": apiKey,
          },
          body: JSON.stringify({
            text: text.trim(),
            model_id: modelId,
            voice_settings: {
              stability,
              similarity_boost: similarityBoost,
              speed,
            },
          }),
        }
      )

      if (!response.ok) {
        let errorData: any = {}
        try {
          errorData = await response.json()
        } catch {
          errorData = { message: response.statusText }
        }

        const errMsg = `ElevenLabs TTS error: ${response.status} ${response.statusText} - ${JSON.stringify(errorData)}`

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

  throw lastError || new Error("All ElevenLabs API keys failed for TTS")
}

/**
 * Play audio from a blob URL
 * @param blobUrl - URL created by URL.createObjectURL
 * @returns Promise that resolves when audio finishes playing
 */
export function playAudio(blobUrl: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const audio = new Audio(blobUrl)
    audio.onended = () => resolve()
    audio.onerror = (e) => reject(new Error(`Audio playback error: ${e}`))
    audio.play().catch(reject)
  })
}

/**
 * Get available ElevenLabs voices
 * @returns Array of voice objects
 */
export async function getVoices(): Promise<
  Array<{ voice_id: string; name: string; category: string }>
> {
  if (ELEVENLABS_API_KEYS.length === 0) {
    throw new Error("ElevenLabs API key is required")
  }

  const apiKey = ELEVENLABS_API_KEYS[0]

  const response = await fetch(`${ELEVENLABS_BASE_URL}/voices`, {
    headers: {
      "xi-api-key": apiKey,
    },
  })

  if (!response.ok) {
    throw new Error(`Failed to fetch voices: ${response.statusText}`)
  }

  const data = await response.json()
  return (data.voices || []).map((v: any) => ({
    voice_id: v.voice_id,
    name: v.name,
    category: v.category || "unknown",
  }))
}
