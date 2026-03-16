import { GoogleGenerativeAI } from "@google/generative-ai"
import { getApiKeys, withApiFallback } from "../lib/apiFallback"
import { estimateTokenCount, trackTokenUsage } from "./tokenUsageService"

// Get API keys with fallback support
const GEMINI_API_KEYS = getApiKeys("VITE_GEMINI_API_KEY")

// Helper to get model instance with API key
function getGeminiModel(apiKey: string, modelName: string) {
  const genAI = new GoogleGenerativeAI(apiKey)
  return genAI.getGenerativeModel({ model: modelName })
}

// Get primary model instances (will use first available key)
const getPrimaryGeminiModel = () => {
  if (GEMINI_API_KEYS.length === 0) {
    throw new Error("Gemini API key is required. Set VITE_GEMINI_API_KEY in your .env file")
  }
  return getGeminiModel(GEMINI_API_KEYS[0], "gemini-2.5-flash")
}

const getPrimaryGeminiImageModel = () => {
  if (GEMINI_API_KEYS.length === 0) {
    throw new Error("Gemini API key is required. Set VITE_GEMINI_API_KEY in your .env file")
  }
  return getGeminiModel(GEMINI_API_KEYS[0], "gemini-2.5-flash-image")
}

export const geminiModel = getPrimaryGeminiModel()
export const geminiImageModel = getPrimaryGeminiImageModel()

const SYSTEM_PROMPT = `You are KOYE AI, an expert in game design, game coding, game programming languages etc and asset creation for both 2D and 3D games.
You help users design game assets(2d images, 3d models, texture, rigging, video cutscense, etc) through deep conversations, brutal honesty, and accuracy.

IMPORTANT: CREDIT COSTS
Before generating any asset, ALWAYS inform the user of the credit cost:

💬 AI Chat: 100 credits per million tokens
🎨 Image Generation:
   - Standard (koye2dv1): 5 credits
   - HQ (koye2dv1.5): 10 credits
   - Ultra (koye2dv2): 15 credits

🧱 3D Models (koye 3d v1):
   - Basic (512): 20 credits (+5 credits if texture)
   - Standard (1024): 50 credits (+10 credits if texture)
   - High-Res (1536): 70 credits (+20 credits if texture)

🧍 Rigging & Animation:
   - Auto-Rig: 10 credits
   - Animation: 30 credits per animation

🎵 Audio & Video:
   - Audio: 5 credits per second
   - Video 720p: 10 credits per second
   - Video 1080p: 25 credits per second

🎮 Game Generation (AI builder):
   - 2D Prototype: 100 credits (using previously generated assets)
   - 3D Prototype: 250 credits (using previously generated assets)
   - Full Small Game: 500 credits (using previously generated assets)

Example: "I'll generate 4 HQ images for you. This will cost 40 credits (4 × 10). Ready to proceed?"

IMPORTANT WORKFLOW RULES:

1. GAME TYPE DETECTION:
   - Chat with the user to understand their game concept
   - Ask questions about gameplay, art style, perspective (2D vs 3D), and asset requirements
   - Determine if the game is 2D or 3D based on the conversation

2. FOR 3D GAMES:
   - Chat with the user to gather DETAILED information about the character/asset:
     * Character appearance (height, build, clothing, colors, style)
     * Visual design details (hair, face, body type, outfit, weapons, armor)
     * Game context (genre, art style, setting)
   - You MUST have sufficient details before proceeding (at least 2-3 exchanges with the user)
   - Ask the user: "Do you want a single front-facing image (1 image) or all four views/angles for 3D modeling (4 images: Front, Left, Right, Back)?"
   - Wait for the user's clear response
   
   ⚠️ CRITICAL - PROMPT GENERATION FOR KOYE2DV1:
   BEFORE triggering image generation, you MUST:
   1. Generate a detailed prompt following this EXACT structure:
   
   "[Subject & Framing]: A full-body, uncropped [gender] [theme/style] character, clearly and completely visible from the top of the head to the soles of the feet, centered perfectly inside the frame with extra margin above the head and below the feet so no body parts are cut off.
   
   [Camera]: The camera is positioned at neutral eye-level, straight-on, with no tilt, no zoom, no crop, and no perspective distortion.
   
   [Pose]: The character is standing in a strict, neutral A-pose: feet shoulder-width apart, legs straight and fully visible, arms extended downward and outward at approximately 30 degrees from the torso, elbows straight, wrists neutral, fingers relaxed and slightly separated, palms facing inward toward the thighs.
   
   [Character Details]: [Gender] in [age], [build], realistic human proportions, [expression]. [Hair description with color, length, style].
   
   [Clothing]: Clothing consists of [detailed description with textures, materials, and colors]. [State accessories or: No weapons, armor, belts, pouches, jewelry, cloaks, or accessories.]
   
   [Rendering]: Rendered in realistic game-ready style, evenly lit with soft frontal studio lighting. Plain solid gray background, sharp focus, clean silhouette, optimized for image-to-3D character reconstruction."
   
   2. Show this complete prompt to the user with: "Here's the image generation prompt I've created for you:"
   3. Then ask: "Please confirm if this looks good. I'll generate [1/4] image(s) for you. This will cost [X] credits."
   4. WAIT for user to say "yes", "confirm", "looks good", "proceed", etc.
   5. ONLY AFTER confirmation, use the trigger phrase
   
   - INFORM THE USER OF THE CREDIT COST based on their plan's model and number of images
   - IMPORTANT: If user says "single", "one", or "front", generate ONLY 1 image. DO NOT list all four views.
   - IMPORTANT: If user says "four", "all views", or "all angles", then list: Front, Left, Right, Back and generate 4 images.
   - After receiving confirmation, use one of these EXACT trigger phrases to initiate image generation:
     * "generating the images now" (for multiple images)
     * "generating your image now" (for single image)
     * "starting image generation"
     * "initiating image generation"
     * "proceeding with image generation"
     * "generating your images"
     * "creating the images"
   - DO NOT use generic phrases like "generating", "image generation", or "generate image" - these are too vague
   - The system will handle model selection based on user's plan
   
   - FOR 3D GAME ENGINE:
     * When the user has generated 3D models and wants to test/view their 3D game, you can trigger the 3D game engine
     * Use one of these EXACT trigger phrases to open the 3D game engine in a new tab:
       * "opening 3d game engine"
       * "launching 3d game engine"
       * "opening babylon game engine"
       * "launching babylon engine"
       * "opening the 3d game engine now"
       * "launching the 3d game engine now"
       * "let's test your game in the 3d engine"
       * "opening game engine to view your 3d models"
       * "let's preview your 3d models in the game engine"
     * The system will automatically open the Babylon.js 3D game engine in a new browser tab
     * Only trigger this when the user has generated 3D models and wants to test/view their game

3. FOR 2D GAMES:
   - Chat with the user to gather DETAILED information about the character/asset:
     * Character or asset description
     * Visual style and appearance
     * Game context and art style
   - You MUST have sufficient details before proceeding (at least 2-3 exchanges with the user)
   - Once you've determined it's a 2D game, ask the user: "Will this asset be static (non-animated icons, items, UI elements) or animated (characters, animations)?"
   - Wait for the user's response
   
   ⚠️ CRITICAL - YOU MUST GENERATE AND SHOW THE PROMPT:
   - After collecting character details, generate a detailed prompt using the koye2dv1 format (full-body, A-pose, gray background, etc.)
   - Say: "Here's the prompt I'll use for image generation:" followed by the complete detailed prompt
   - Then say: "Please confirm if this looks good, and I'll generate sample images (2-5 variations) for you to choose from."
   - INFORM THE USER OF THE CREDIT COST (e.g., "This will cost 20 credits for 2 samples")
   - Wait for user confirmation
   - After confirmation AND verifying you have enough details, use one of these EXACT trigger phrases:
     * "generating sample images now"
     * "generating image variations now"
     * "creating sample images now"
   - DO NOT use generic phrases - be explicit
   - The system will generate 2-5 sample images with slightly different prompts
   - User will select one by typing the serial number (1, 2, 3, etc.)
   - If static: the process is complete
   - If animated: ask "Please describe the action or animation to be performed by this sprite"
   - After they describe the animation, the system will show sprite count options (5, 11, 22, or 44 sprites)
   - User selects by typing the number into chat
   
   - FOR 2D GAME ENGINE:
     * When the user has generated assets (images, sprites) and wants to test/play their 2D game, you can trigger the 2D game engine
     * Use one of these EXACT trigger phrases to open the 2D game engine in a new tab:
       * "opening 2d game engine"
       * "launching 2d game engine"
       * "opening phaser game engine"
       * "launching phaser engine"
       * "opening the 2d game engine now"
       * "launching the 2d game engine now"
       * "let's test your game in the 2d engine"
       * "opening game engine to test your assets"
     * The system will automatically open the Phaser 2D game engine in a new browser tab
     * Only trigger this when the user has generated assets and wants to test/play their game

4. GENERAL GUIDELINES:
   - CRITICAL: Do NOT trigger image generation unless you have:
     * At least 2-3 exchanges with the user
     * Detailed character/asset description (appearance, style, colors, etc.)
     * Clear game context (2D/3D, genre, art style)
     * SHOWN the user the complete prompt you will use
     * User confirmation when required
   - ALWAYS inform users of credit costs BEFORE generating
   - ALWAYS show the generated prompt to the user BEFORE asking for confirmation
   - Always ask clarifying questions before generating
   - Be specific about what you're generating
   - Use clear, structured prompts following the koye2dv1 format
   - Wait for user confirmation when required
   - Be conversational and helpful throughout the process
   - Only use the EXACT trigger phrases listed above - do not improvise or use similar phrases

5. RESET FLOW:
   - If the user wants to start over or reset the workflow, output the token \`[RESET_FLOW]\`
   - This will clear all game dev state and restart from the beginning
   - Only trigger this when the user explicitly requests to reset, restart, or start over

6. WEB SEARCH:
   - If you do NOT know the answer, or the user asks about recent/real-time information,
     current prices, latest news, specific products, tutorials, or anything outside your training data,
     you MUST trigger a web search.
   - To trigger a web search, output EXACTLY: [WEB_SEARCH: <your search query>]
   - Example: [WEB_SEARCH: best free 3D model rigging tools 2026]
   - Do NOT search for things you already know well (game design basics, programming concepts, general knowledge, etc.)
   - STRICTLY only use web search when you genuinely lack the information. Do NOT use it for every message.
   - When you trigger a web search, STOP your response immediately after the [WEB_SEARCH: ...] marker. Do not continue writing after it.
   - After the search results are injected by the system, you will be asked again. Use those results to write a comprehensive answer citing sources.
   - NEVER output [WEB_SEARCH: ...] more than once in a single response.`



export async function sendMessageToGemini(
  messages: Array<{ role: "user" | "model"; parts: Array<{ text?: string; inlineData?: { mimeType: string; data: string } }> }>
): Promise<string> {
  if (GEMINI_API_KEYS.length === 0) {
    throw new Error("Gemini API key is required. Set VITE_GEMINI_API_KEY in your .env file")
  }

  // Use image model if request involves images
  const useImageModel = needsImageModel(messages)
  const modelName = useImageModel ? "gemini-2.5-flash-image" : "gemini-2.5-flash"

  return await withApiFallback(
    GEMINI_API_KEYS,
    async (apiKey) => {
      const genAI = new GoogleGenerativeAI(apiKey)
      let model = genAI.getGenerativeModel({ model: modelName })

      try {
        const chat = model.startChat({
          history: [
            {
              role: "user",
              parts: [{ text: SYSTEM_PROMPT }],
            },
            {
              role: "model",
              parts: [{ text: "Hello! I'm GameForge AI, your expert game asset creation partner. Let's design something amazing together. What kind of game asset would you like to create?" }],
            },
            ...messages.slice(0, -1),
          ],
        })

        const result = await chat.sendMessage(messages[messages.length - 1].parts)
        const response = await result.response
        return response.text()
      } catch (error) {
        // Check if it's a quota error (429) and we're using image model
        const errorMsg = error instanceof Error ? error.message : String(error)
        const isQuotaError = errorMsg.includes("429") || errorMsg.includes("quota") || errorMsg.includes("Quota exceeded")

        // Fallback to base model if image model hits quota error
        if (isQuotaError && useImageModel) {
          console.warn("Image model quota exceeded, falling back to base model (gemini-2.5-flash)")
          model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" })

          // Retry with base model
          const chat = model.startChat({
            history: [
              {
                role: "user",
                parts: [{ text: SYSTEM_PROMPT }],
              },
              {
                role: "model",
                parts: [{ text: "Hello! I'm GameForge AI, your expert game asset creation partner. Let's design something amazing together. What kind of game asset would you like to create?" }],
              },
              ...messages.slice(0, -1),
            ],
          })

          const result = await chat.sendMessage(messages[messages.length - 1].parts)
          const response = await result.response
          return response.text()
        } else {
          throw error
        }
      }
    }
  )
}

// Helper to detect if request needs image model
function needsImageModel(
  messages: Array<{ role: "user" | "model"; parts: Array<{ text?: string; inlineData?: { mimeType: string; data: string } }> }>
): boolean {
  const lastMessage = messages[messages.length - 1]
  if (!lastMessage) return false

  // Check if message has images
  const hasImages = lastMessage.parts.some(part => part.inlineData)
  if (!hasImages) {
    // No images - check if it's a text-to-image generation request
    const text = lastMessage.parts.find(p => p.text)?.text || ""
    const lowerText = text.toLowerCase()
    const generationKeywords = [
      "generate image", "create image", "make image", "image generation",
      "text to image", "draw", "illustrate", "visualize",
      "render", "concept art", "artwork", "generate a", "create a"
    ]
    return generationKeywords.some(keyword => lowerText.includes(keyword))
  }

  // Message has images - check if it's asking for generation/modification vs analysis
  const text = lastMessage.parts.find(p => p.text)?.text || ""
  const lowerText = text.toLowerCase()

  // Analysis keywords - questions about what's in the image
  const analysisKeywords = [
    "what", "describe", "see", "identify", "recognize", "analyze",
    "explain", "tell me about", "what is", "what are", "what does",
    "can you see", "do you see", "what can you", "what's in",
    "what is in", "what does this", "what is this", "what are these"
  ]

  // Generation/modification keywords - requests to create or modify images
  const generationKeywords = [
    "make", "change", "modify", "edit", "generate", "create",
    "add", "remove", "replace", "transform", "convert", "turn into",
    "make the", "change the", "modify the", "edit the", "add a",
    "remove the", "replace the", "can you make", "can you change",
    "can you modify", "can you edit", "can you add", "can you remove",
    "make it", "change it", "modify it", "edit it", "turn it",
    "wear", "put on", "take off", "switch", "swap"
  ]

  // Check if it's an analysis request (use base model)
  const isAnalysis = analysisKeywords.some(keyword => lowerText.includes(keyword))

  // Check if it's a generation/modification request (use image model)
  const isGeneration = generationKeywords.some(keyword => lowerText.includes(keyword))

  // If it's clearly a generation request, use image model
  if (isGeneration) return true

  // If it's clearly an analysis request, use base model
  if (isAnalysis) return false

  // Default: if images are present but unclear intent, use base model for safety
  // (better to use base model for analysis than image model for simple questions)
  return false
}

// Streaming mode for fast responses
export async function* sendMessageToGeminiStream(
  messages: Array<{ role: "user" | "model"; parts: Array<{ text?: string; inlineData?: { mimeType: string; data: string } }> }>
): AsyncGenerator<string, void, unknown> {
  if (GEMINI_API_KEYS.length === 0) {
    throw new Error("Gemini API key is required. Set VITE_GEMINI_API_KEY in your .env file")
  }

  // Use image model if request involves images
  const useImageModel = needsImageModel(messages)
  const modelName = useImageModel ? "gemini-2.5-flash-image" : "gemini-2.5-flash"

  // Calculate input tokens from all messages (system prompt + history + current message)
  let inputTokens = estimateTokenCount(SYSTEM_PROMPT)
  inputTokens += estimateTokenCount("Hello! I'm GameForge AI, your expert game asset creation partner. Let's design something amazing together. What kind of game asset would you like to create?")
  for (const msg of messages) {
    for (const part of msg.parts) {
      if (part.text) {
        inputTokens += estimateTokenCount(part.text)
      }
    }
  }

  // Track output tokens
  let outputTokens = 0

  let lastError: any = null

  for (const apiKey of GEMINI_API_KEYS) {
    try {
      const genAI = new GoogleGenerativeAI(apiKey)
      let model = genAI.getGenerativeModel({ model: modelName })

      try {
        const chat = model.startChat({
          history: [
            {
              role: "user",
              parts: [{ text: SYSTEM_PROMPT }],
            },
            {
              role: "model",
              parts: [{ text: "Hello! I'm GameForge AI, your expert game asset creation partner. Let's design something amazing together. What kind of game asset would you like to create?" }],
            },
            ...messages.slice(0, -1),
          ],
        })

        const result = await chat.sendMessageStream(messages[messages.length - 1].parts)

        for await (const chunk of result.stream) {
          const chunkText = chunk.text()
          if (chunkText) {
            outputTokens += estimateTokenCount(chunkText)
            yield chunkText
          }
        }

        // Track token usage after successful completion
        trackTokenUsage(inputTokens, outputTokens)

        // Success - return (exit the generator)
        return
      } catch (error) {
        // Check if it's a quota error (429) and we're using image model
        const errorMsg = error instanceof Error ? error.message : String(error)
        const isQuotaError = errorMsg.includes("429") || errorMsg.includes("quota") || errorMsg.includes("Quota exceeded")

        // Fallback to base model if image model hits quota error
        if (isQuotaError && useImageModel) {
          console.warn("Image model quota exceeded, falling back to base model (gemini-2.5-flash)")
          model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" })

          // Retry with base model
          const chat = model.startChat({
            history: [
              {
                role: "user",
                parts: [{ text: SYSTEM_PROMPT }],
              },
              {
                role: "model",
                parts: [{ text: "Hello! I'm GameForge AI, your expert game asset creation partner. Let's design something amazing together. What kind of game asset would you like to create?" }],
              },
              ...messages.slice(0, -1),
            ],
          })

          const result = await chat.sendMessageStream(messages[messages.length - 1].parts)

          for await (const chunk of result.stream) {
            const chunkText = chunk.text()
            if (chunkText) {
              outputTokens += estimateTokenCount(chunkText)
              yield chunkText
            }
          }

          // Track token usage after successful completion
          trackTokenUsage(inputTokens, outputTokens)

          // Success - return (exit the generator)
          return
        } else {
          // Not a quota error or not using image model - throw to trigger fallback to next API key
          throw error
        }
      }
    } catch (error) {
      lastError = error

      // Check if we should try the next key
      const errorMsg = error instanceof Error ? error.message : String(error)
      const shouldFallback = shouldFallbackToNextKey(error)

      if (!shouldFallback) {
        // Error is not retryable, throw immediately
        throw error
      }

      // Log fallback attempt (but don't throw yet - try next key)
      const currentIndex = GEMINI_API_KEYS.indexOf(apiKey)
      if (currentIndex < GEMINI_API_KEYS.length - 1) {
        console.warn(`Gemini API key ${currentIndex + 1} failed, trying fallback ${currentIndex + 2}...`, error)
      }
    }
  }

  // All keys failed
  throw lastError || new Error("All Gemini API keys failed")
}

// Helper function for streaming fallback
function shouldFallbackToNextKey(error: any): boolean {
  if (!error) return false

  const errorMessage = error instanceof Error ? error.message : String(error)
  const errorString = errorMessage.toLowerCase()

  const retryableErrors = [
    "401",
    "403",
    "429",
    "unauthorized",
    "forbidden",
    "quota",
    "rate limit",
    "invalid api key",
    "api key",
    "authentication",
    "invalid key"
  ]

  return retryableErrors.some(keyword => errorString.includes(keyword))
}

// Thinking mode for heavy responses - uses REST API with thinking_config
export async function sendMessageToGeminiWithThinking(
  messages: Array<{ role: "user" | "model"; parts: Array<{ text?: string; inlineData?: { mimeType: string; data: string } }> }>
): Promise<{ response: string; thinking: string }> {
  if (GEMINI_API_KEYS.length === 0) {
    throw new Error("Gemini API key is required. Set VITE_GEMINI_API_KEY in your .env file")
  }

  // Use image model if request involves images
  const useImageModel = needsImageModel(messages)
  const modelName = useImageModel ? "gemini-2.5-flash-image" : "gemini-2.5-flash"

  // Build conversation history with system prompt (reusable)
  const history = [
    {
      role: "user",
      parts: [{ text: SYSTEM_PROMPT }],
    },
    {
      role: "model",
      parts: [{ text: "Hello! I'm GameForge AI, your expert game asset creation partner. Let's design something amazing together. What kind of game asset would you like to create?" }],
    },
    ...messages.slice(0, -1),
  ]

  // Convert messages to API format
  const contents = history.map(msg => ({
    role: msg.role,
    parts: msg.parts.map(part => {
      if (part.inlineData) {
        return {
          inlineData: {
            mimeType: part.inlineData.mimeType,
            data: part.inlineData.data,
          }
        }
      }
      return { text: part.text || "" }
    })
  }))

  // Add the current message
  const currentMessage = messages[messages.length - 1]
  contents.push({
    role: "user",
    parts: currentMessage.parts.map(part => {
      if (part.inlineData) {
        return {
          inlineData: {
            mimeType: part.inlineData.mimeType,
            data: part.inlineData.data,
          }
        }
      }
      return { text: part.text || "" }
    })
  })

  // Build request body
  const requestBody = {
    contents,
  }

  return await withApiFallback(
    GEMINI_API_KEYS,
    async (apiKey) => {
      const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`

      try {
        // Make API request
        const response = await fetch(API_URL, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(requestBody),
        })

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}))
          throw new Error(`API request failed: ${response.status} ${response.statusText} - ${JSON.stringify(errorData)}`)
        }

        const data = await response.json()

        // Extract thinking and response from the API response
        let thinking = ""
        let responseText = ""

        if (data.candidates && data.candidates[0]) {
          const candidate = data.candidates[0]

          // Extract thinking steps
          if (candidate.thinkingSteps && Array.isArray(candidate.thinkingSteps)) {
            thinking = candidate.thinkingSteps
              .map((step: any) => {
                if (step.text) return step.text
                if (step.content?.parts) {
                  return step.content.parts
                    .map((p: any) => p.text || "")
                    .filter((t: string) => t)
                    .join(" ")
                }
                return ""
              })
              .filter((t: string) => t)
              .join("\n\n")
          }

          // Extract response text
          if (candidate.content && candidate.content.parts) {
            const responseParts = candidate.content.parts
              .map((part: any) => part.text || "")
              .filter((t: string) => t)
            responseText = responseParts.join(" ")
          }
        }

        // If no thinking found, use a default message
        if (!thinking) {
          thinking = "Analyzing your request and generating a thoughtful response..."
        }

        // If no response text, try to get it from the full response
        if (!responseText && data.candidates?.[0]?.content?.parts) {
          responseText = data.candidates[0].content.parts
            .map((p: any) => p.text || "")
            .join(" ")
        }

        return {
          response: responseText || "I've processed your request.",
          thinking: thinking
        }
      } catch (error) {
        // Check if it's a quota error (429) and we're using image model
        const errorMsg = error instanceof Error ? error.message : String(error)
        const isQuotaError = errorMsg.includes("429") || errorMsg.includes("quota") || errorMsg.includes("Quota exceeded")

        // Fallback to base model if image model hits quota error
        if (isQuotaError && useImageModel) {
          console.warn("Image model quota exceeded, falling back to base model (gemini-2.5-flash)")
          const fallbackModelName = "gemini-2.5-flash"
          const fallbackAPI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${fallbackModelName}:generateContent?key=${apiKey}`

          // Retry with base model
          const fallbackResponse = await fetch(fallbackAPI_URL, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify(requestBody),
          })

          if (!fallbackResponse.ok) {
            const errorData = await fallbackResponse.json().catch(() => ({}))
            throw new Error(`API request failed: ${fallbackResponse.status} ${fallbackResponse.statusText} - ${JSON.stringify(errorData)}`)
          }

          const fallbackData = await fallbackResponse.json()

          // Extract thinking and response from the API response
          let thinking = ""
          let responseText = ""

          if (fallbackData.candidates && fallbackData.candidates[0]) {
            const candidate = fallbackData.candidates[0]

            // Extract thinking steps
            if (candidate.thinkingSteps && Array.isArray(candidate.thinkingSteps)) {
              thinking = candidate.thinkingSteps
                .map((step: any) => {
                  if (step.text) return step.text
                  if (step.content?.parts) {
                    return step.content.parts
                      .map((p: any) => p.text || "")
                      .filter((t: string) => t)
                      .join(" ")
                  }
                  return ""
                })
                .filter((t: string) => t)
                .join("\n\n")
            }

            // Extract response text
            if (candidate.content && candidate.content.parts) {
              const responseParts = candidate.content.parts
                .map((part: any) => part.text || "")
                .filter((t: string) => t)
              responseText = responseParts.join(" ")
            }
          }

          // If no thinking found, use a default message
          if (!thinking) {
            thinking = "Analyzing your request and generating a thoughtful response..."
          }

          // If no response text, try to get it from the full response
          if (!responseText && fallbackData.candidates?.[0]?.content?.parts) {
            responseText = fallbackData.candidates[0].content.parts
              .map((p: any) => p.text || "")
              .join(" ")
          }

          return {
            response: responseText || "I've processed your request.",
            thinking: thinking
          }
        } else {
          throw error
        }
      }
    }
  )
}

/**
 * Generate an image using Gemini image model with image input (image-to-image)
 * @param imageUrl - URL of the source image (blob URL)
 * @param prompt - Text prompt describing the desired transformation
 * @returns Blob URL of the generated image
 */
export async function generateImageFromImage(imageUrl: string, viewPrompt: string): Promise<string> {
  if (GEMINI_API_KEYS.length === 0) {
    throw new Error("Gemini API key is required. Set VITE_GEMINI_API_KEY in your .env file")
  }

  try {
    // Fetch the image and convert to base64
    const response = await fetch(imageUrl)
    const blob = await response.blob()
    const base64 = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader()
      reader.onloadend = () => {
        const base64String = reader.result as string
        resolve(base64String.split(",")[1]) // Remove data:image/png;base64, prefix
      }
      reader.onerror = reject
      reader.readAsDataURL(blob)
    })

    // Use Gemini image model to analyze the front image and generate an enhanced prompt
    const analysisPrompt = `Analyze this character image (front view in T-pose). Create a detailed, concise image generation prompt (max 2000 characters) for generating the ${viewPrompt} of this exact same character. 

    The prompt must:
    - Describe all character details: appearance, clothing, colors, accessories, proportions
    - Maintain exact character consistency across views
    - Specify: ${viewPrompt}, orthographic projection, character turn-around sheet, clean white background
    - Be concise and use comma-separated phrases
    
    Return ONLY the prompt, no explanations.`

    // Use fallback system for API keys
    const enhancedPrompt = await withApiFallback(
      GEMINI_API_KEYS,
      async (apiKey) => {
        const genAI = new GoogleGenerativeAI(apiKey)
        const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash-image" })

        const result = await model.generateContent([
          {
            text: analysisPrompt,
          },
          {
            inlineData: {
              mimeType: "image/png",
              data: base64,
            },
          },
        ])

        const responseData = await result.response
        return responseData.text().trim()
      }
    )

    // Ensure prompt is not too long (5000 char limit)
    const finalPrompt = enhancedPrompt.length > 5000
      ? enhancedPrompt.substring(0, 5000).trim()
      : enhancedPrompt

    // Use HyperReal image-to-image API for actual generation
    const { imageToImageWithHyperreal } = await import("./hyperreal")
    return await imageToImageWithHyperreal(imageUrl, finalPrompt)
  } catch (error) {
    console.error("Error generating image from image with Gemini:", error)
    // Fallback: use HyperReal directly with the original prompt
    const { imageToImageWithHyperreal } = await import("./hyperreal")
    return await imageToImageWithHyperreal(imageUrl, viewPrompt)
  }
}

export async function generateImagePrompt(userDescription: string): Promise<string> {
  if (GEMINI_API_KEYS.length === 0) {
    throw new Error("Gemini API key is required. Set VITE_GEMINI_API_KEY in your .env file")
  }

  const prompt = `Create a detailed image generation prompt (between 900 and 1200 characters) for a game character asset optimized for koye-2dv1 (ClipDrop) and 3D reconstruction.

User description: ${userDescription}

YOU MUST follow this EXACT structure for the prompt:

1. SUBJECT & FRAMING (start with this):
"A full-body, uncropped [gender] [theme/style] character, clearly and completely visible from the top of the head to the soles of the feet, centered perfectly inside the frame with extra margin above the head and below the feet so no body parts are cut off."

2. CAMERA POSITION (always include):
"The camera is positioned at neutral eye-level, straight-on, with no tilt, no zoom, no crop, and no perspective distortion."

3. POSE (always A-pose for 3D-ready):
"The character is standing in a strict, neutral A-pose: feet shoulder-width apart, legs straight and fully visible, arms extended downward and outward at approximately 30 degrees from the torso, elbows straight, wrists neutral, fingers relaxed and slightly separated, palms facing inward toward the thighs."

4. CHARACTER DETAILS:
"[Gender] in [age], [build], realistic human proportions, [expression]. [Hair details]."

5. CLOTHING & EQUIPMENT:
"Clothing consists of [detailed description with textures/colors]. [Specify accessories or 'No weapons, armor, belts, pouches, jewelry, cloaks, or accessories.']"

6. RENDERING & BACKGROUND (always end with):
"Rendered in realistic game-ready style, evenly lit with soft frontal studio lighting. Plain solid gray background, sharp focus, clean silhouette, optimized for image-to-3D character reconstruction."

CRITICAL REQUIREMENTS:
- Full body from head to feet, NO cropping
- A-pose with arms at 30 degrees
- Plain solid gray background
- Game-ready, optimized for 3D reconstruction
- Specific textures, colors, materials

Return ONLY the formatted prompt following the structure above. No explanations.`

  // Use fallback system for API keys
  const generatedPrompt = await withApiFallback(
    GEMINI_API_KEYS,
    async (apiKey) => {
      const genAI = new GoogleGenerativeAI(apiKey)
      const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" })

      const result = await model.generateContent(prompt)
      const response = await result.response
      return response.text().trim()
    }
  )

  // Strict limit: 3500 characters max (leaves 1500 for view keywords)
  if (generatedPrompt.length > 3500) {
    return generatedPrompt.substring(0, 3500).trim()
  }

  return generatedPrompt
}
