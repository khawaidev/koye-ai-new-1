/**
 * AI.CC API Service
 * 
 * OpenAI-compatible client for ai.cc API (https://api.ai.cc/v1).
 * Supports:
 * - gpt-5.1-codex-max (advanced game coding)
 * - gemini-2.5-pro (advanced planning/reasoning)
 * - gemini-3.1-flash-image-preview (image-to-image editing)
 */

import { getApiKeys } from "../lib/apiFallback"

const AICC_BASE_URL = "https://api.ai.cc/v1"
const AICC_API_KEYS = getApiKeys("VITE_AICC_API_KEY")

export type AiccModel = "gpt-5.1-codex-max" | "gemini-2.5-pro"

export interface AiccMessage {
  role: "system" | "user" | "assistant"
  content: string
}

/**
 * Send a non-streaming chat completion to ai.cc
 */
export async function sendMessageToAicc(
  model: AiccModel,
  messages: AiccMessage[],
  temperature: number = 0.7,
  maxTokens?: number
): Promise<string> {
  if (AICC_API_KEYS.length === 0) {
    throw new Error("AI.CC API key is required. Set VITE_AICC_API_KEY in your .env file")
  }

  let lastError: Error | null = null

  for (const apiKey of AICC_API_KEYS) {
    try {
      const body: any = {
        model,
        messages,
        temperature,
      }
      if (maxTokens) body.max_tokens = maxTokens

      const response = await fetch(`${AICC_BASE_URL}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify(body),
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        const errMsg = `AI.CC API error: ${response.status} ${response.statusText} - ${JSON.stringify(errorData)}`

        // Retry on auth/rate-limit errors with next key
        if ([401, 403, 429].includes(response.status)) {
          lastError = new Error(errMsg)
          continue
        }
        throw new Error(errMsg)
      }

      const data = await response.json()
      return data.choices?.[0]?.message?.content || ""
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error))
      const errMsg = lastError.message.toLowerCase()
      if (errMsg.includes("401") || errMsg.includes("403") || errMsg.includes("429") || errMsg.includes("quota")) {
        continue
      }
      throw lastError
    }
  }

  throw lastError || new Error("All AI.CC API keys failed")
}

/**
 * Send a streaming chat completion to ai.cc (SSE)
 * Yields text chunks as they arrive.
 */
export async function* sendMessageToAiccStream(
  model: AiccModel,
  messages: AiccMessage[],
  temperature: number = 0.7,
  maxTokens?: number
): AsyncGenerator<string, void, unknown> {
  if (AICC_API_KEYS.length === 0) {
    throw new Error("AI.CC API key is required. Set VITE_AICC_API_KEY in your .env file")
  }

  let lastError: Error | null = null

  for (const apiKey of AICC_API_KEYS) {
    try {
      const body: any = {
        model,
        messages,
        temperature,
        stream: true,
      }
      if (maxTokens) body.max_tokens = maxTokens

      const response = await fetch(`${AICC_BASE_URL}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify(body),
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        const errMsg = `AI.CC API error: ${response.status} ${response.statusText} - ${JSON.stringify(errorData)}`
        if ([401, 403, 429].includes(response.status)) {
          lastError = new Error(errMsg)
          continue
        }
        throw new Error(errMsg)
      }

      const reader = response.body?.getReader()
      if (!reader) throw new Error("No response body stream")

      const decoder = new TextDecoder()
      let buffer = ""

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })

        // Process SSE lines
        const lines = buffer.split("\n")
        buffer = lines.pop() || "" // Keep incomplete line in buffer

        for (const line of lines) {
          const trimmed = line.trim()
          if (!trimmed || trimmed === "data: [DONE]") continue
          if (!trimmed.startsWith("data: ")) continue

          try {
            const json = JSON.parse(trimmed.slice(6))
            const delta = json.choices?.[0]?.delta?.content
            if (delta) {
              yield delta
            }
          } catch {
            // Skip malformed JSON lines
          }
        }
      }

      // Process remaining buffer
      if (buffer.trim() && buffer.trim() !== "data: [DONE]" && buffer.trim().startsWith("data: ")) {
        try {
          const json = JSON.parse(buffer.trim().slice(6))
          const delta = json.choices?.[0]?.delta?.content
          if (delta) yield delta
        } catch {
          // Skip
        }
      }

      // Successful stream — exit
      return
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error))
      const errMsg = lastError.message.toLowerCase()
      if (errMsg.includes("401") || errMsg.includes("403") || errMsg.includes("429") || errMsg.includes("quota")) {
        continue
      }
      throw lastError
    }
  }

  throw lastError || new Error("All AI.CC API keys failed")
}

/**
 * Generate/edit an image via an AI description text-to-image proxy pipeline using ai.cc
 */
export async function editImageWithAicc(
  prompt: string,
  imageBase64?: string,
  _imageMimeType: string = "image/png"
): Promise<string> {
  if (AICC_API_KEYS.length === 0) {
    throw new Error("AI.CC API key is required. Set VITE_AICC_API_KEY in your .env file")
  }

  const apiKey = AICC_API_KEYS[0]

  let description = ""

  if (imageBase64) {
    // Step 1: Use Gemini 2.5 Flash to describe the image in high detail
    try {
      console.log("   📤 Generating image description via gemini-2.5-flash...")
      const describePayload = {
        model: "gemini-2.5-flash",
        messages: [
          {
            role: "user",
            content: [
              {
                type: "text",
                text: "Describe this image as accurately and as detailed as possible, as if to be used to re-create the image from the ai described text."
              },
              {
                type: "image_url",
                image_url: {
                  url: `data:${_imageMimeType};base64,${imageBase64}`
                }
              }
            ]
          }
        ]
      }

      const describeRes = await fetch(`${AICC_BASE_URL}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify(describePayload),
      })

      if (describeRes.ok) {
        const describeData = await describeRes.json()
        description = describeData.choices?.[0]?.message?.content || ""
        console.log("   ✅ Generated description:", description.substring(0, 100) + "...")
      } else {
        const errText = await describeRes.text().catch(() => "")
        console.warn(`Failed to describe image (HTTP ${describeRes.status}):`, errText)
      }
    } catch (describeErr) {
      console.error("Error during image description phase:", describeErr)
      // We don't hard throw here so we can still try to generate from just the prompt if it somehow fails
    }
  }

  // Step 2: Combine the generated description text with the user's edit prompt
  const finalPrompt = description
    ? `here is the image description:\n${description}\n\napply these changes to it:\n${prompt}\n\ngenerate the image.`
    : prompt

  console.log("   📤 Sending final prompt to doubao-seedream-4-0-250828")

  const requestBody = {
    model: "doubao-seedream-4-0-250828",
    prompt: finalPrompt,
  }

  const response = await fetch(
    `${AICC_BASE_URL}/images/generations`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(requestBody),
    }
  )

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}))
    throw new Error(`AI.CC image edit error: ${response.status} - ${JSON.stringify(errorData)}`)
  }

  const data = await response.json()

  // Extract image from response
  if (data.data && data.data.length > 0 && data.data[0].url) {
    return data.data[0].url
  }

  throw new Error("No image found in AI.CC response")
}