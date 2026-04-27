import { ThinkingLevel } from "@google/genai"
import { getApiKeys } from "../lib/apiFallback"
import { estimateTokenCount, trackTokenUsage } from "./tokenUsageService"
import { withSmartRoute, withSmartRouteStream, type SmartRouteResult } from "./geminiSmartRouter"

// Get API keys with fallback support
const GEMINI_API_KEYS = getApiKeys("VITE_GEMINI_API_KEY")

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
   - NEVER output [WEB_SEARCH: ...] more than once in a single response.

7. GAME IDEAS AND CONTEXT:
   - If the user starts describing a game idea or discussing anything about building a game, and the PROJECT CONTEXT indicates they are NOT connected to a project, YOU MUST include the EXACT marker "[CONNECT_PROJECT_REQUIRED]" somewhere in your response.
   - If the user discusses the game idea, changes, theme, or assets of the game, and they ARE connected to a project, ALWAYS automatically create or update a file named "game-context.md" in the project using CREATE_FILE or EDIT_FILE. It should contain the complete user's game idea refined by you through the discussions.`



export async function sendMessageToGemini(
  messages: Array<{ role: "user" | "model"; parts: Array<{ text?: string; inlineData?: { mimeType: string; data: string } }> }>
): Promise<string> {
  if (GEMINI_API_KEYS.length === 0) {
    throw new Error("Gemini API key is required. Set VITE_GEMINI_API_KEY in your .env file")
  }

  // Estimate input tokens for budget check
  let estTokens = estimateTokenCount(SYSTEM_PROMPT)
  for (const msg of messages) {
    for (const part of msg.parts) {
      if (part.text) estTokens += estimateTokenCount(part.text)
    }
  }

  try {
    return await withSmartRoute(async (route: SmartRouteResult) => {
      const contents = messages.map(msg => ({
        role: msg.role === "model" ? "assistant" : "user",
        parts: msg.parts.map(part => {
          if (part.inlineData) {
            return { inlineData: { mimeType: part.inlineData.mimeType, data: part.inlineData.data } }
          }
          return { text: part.text || "" }
        })
      }))

      const result = await route.client.models.generateContent({
        model: route.modelId,
        systemInstruction: SYSTEM_PROMPT,
        contents,
        config: {
          thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
          temperature: 0.8,
        },
      })

      const text = result.text || ""
      return { result: text, tokensUsed: estTokens + estimateTokenCount(text) }
    }, estTokens)
  } catch (error) {
    // If all Gemini keys exhausted, fall back to Hyperreal
    if (error instanceof Error && error.message === "ALL_GEMINI_KEYS_EXHAUSTED") {
      console.warn("[Gemini] All API keys exhausted, falling back to Hyperreal")
      const { sendMessageToHyperrealStream } = await import("./hyperreal")
      // Collect Hyperreal stream into a single string
      let fullText = ""
      const hyperMessages = messages.map(m => ({
        role: m.role === "model" ? "assistant" as const : "user" as const,
        content: m.parts.map(p => p.text || "").join("")
      }))
      for await (const chunk of sendMessageToHyperrealStream(hyperMessages, SYSTEM_PROMPT)) {
        fullText += chunk
      }
      return fullText
    }
    throw error
  }
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

// Streaming mode for fast responses — uses smart router
export async function* sendMessageToGeminiStream(
  messages: Array<{ role: "user" | "model"; parts: Array<{ text?: string; inlineData?: { mimeType: string; data: string } }> }>
): AsyncGenerator<string, void, unknown> {
  if (GEMINI_API_KEYS.length === 0) {
    throw new Error("Gemini API key is required. Set VITE_GEMINI_API_KEY in your .env file")
  }

  // Calculate input tokens for budget estimate
  let inputTokens = estimateTokenCount(SYSTEM_PROMPT)
  for (const msg of messages) {
    for (const part of msg.parts) {
      if (part.text) inputTokens += estimateTokenCount(part.text)
    }
  }

  let outputTokens = 0

  try {
    const gen = withSmartRouteStream(async function* (route: SmartRouteResult) {
      const contents = messages.map(msg => ({
        role: msg.role === "model" ? "assistant" : "user",
        parts: msg.parts.map(part => {
          if (part.inlineData) {
            return { inlineData: { mimeType: part.inlineData.mimeType, data: part.inlineData.data } }
          }
          return { text: part.text || "" }
        })
      }))

      const stream = await route.client.models.generateContentStream({
        model: route.modelId,
        systemInstruction: SYSTEM_PROMPT,
        contents,
        config: {
          thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
          temperature: 0.8,
        },
      })

      for await (const chunk of stream) {
        const chunkText = chunk.text()
        if (chunkText) {
          const tokens = estimateTokenCount(chunkText)
          outputTokens += tokens
          yield { text: chunkText, tokensUsed: tokens }
        }
      }
    }, inputTokens)

    for await (const text of gen) {
      yield text
    }

    trackTokenUsage(inputTokens, outputTokens)
  } catch (error) {
    // If all Gemini keys exhausted, fall back to Hyperreal streaming
    if (error instanceof Error && error.message === "ALL_GEMINI_KEYS_EXHAUSTED") {
      console.warn("[Gemini] All API keys exhausted, falling back to Hyperreal stream")
      const { sendMessageToHyperrealStream } = await import("./hyperreal")
      const hyperMessages = messages.map(m => ({
        role: m.role === "model" ? "assistant" as const : "user" as const,
        content: m.parts.map(p => p.text || "").join("")
      }))
      for await (const chunk of sendMessageToHyperrealStream(hyperMessages, SYSTEM_PROMPT)) {
        yield chunk
      }
      return
    }
    throw error
  }
}

/**
 * Thinking mode for heavy responses — uses smart router with thinkingConfig
 */
export async function sendMessageToGeminiWithThinking(
  messages: Array<{ role: "user" | "model"; parts: Array<{ text?: string; inlineData?: { mimeType: string; data: string } }> }>
): Promise<{ response: string; thinking: string }> {
  if (GEMINI_API_KEYS.length === 0) {
    throw new Error("Gemini API key is required. Set VITE_GEMINI_API_KEY in your .env file")
  }

  let estTokens = estimateTokenCount(SYSTEM_PROMPT)
  for (const msg of messages) {
    for (const part of msg.parts) {
      if (part.text) estTokens += estimateTokenCount(part.text)
    }
  }

  try {
    return await withSmartRoute(async (route: SmartRouteResult) => {
      const contents = messages.map(msg => ({
        role: msg.role === "model" ? "assistant" : "user",
        parts: msg.parts.map(part => {
          if (part.inlineData) {
            return { inlineData: { mimeType: part.inlineData.mimeType, data: part.inlineData.data } }
          }
          return { text: part.text || "" }
        })
      }))

      const genResult = await route.client.models.generateContent({
        model: route.modelId,
        systemInstruction: SYSTEM_PROMPT,
        contents,
        config: {
          thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
          temperature: 0.8,
        },
      })

      let thinkingText = ""
      const candidate = genResult.candidates?.[0]
      if (candidate) {
        thinkingText = (candidate as any).thought || "Thinking process completed."
      }

      const responseText = genResult.text || ""
      return {
        result: {
          response: responseText,
          thinking: thinkingText || "Analyzing your request and generating a thoughtful response..."
        },
        tokensUsed: estTokens + estimateTokenCount(responseText),
      }
    }, estTokens)
  } catch (error) {
    if (error instanceof Error && error.message === "ALL_GEMINI_KEYS_EXHAUSTED") {
      console.warn("[Gemini] All keys exhausted in thinking mode, returning fallback")
      return {
        response: "I'm currently experiencing high demand. Please try again in a moment.",
        thinking: "All API resources temporarily exhausted."
      }
    }
    throw error
  }
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

    // Use smart router for API keys
    const enhancedPrompt = await withSmartRoute(async (route: SmartRouteResult) => {
      const result = await route.client.models.generateContent({
        model: route.modelId,
        contents: [
          {
            parts: [
              { text: analysisPrompt },
              {
                inlineData: {
                  mimeType: "image/png",
                  data: base64,
                }
              }
            ]
          }
        ],
        config: {
          thinkingConfig: {
            thinkingLevel: ThinkingLevel.LOW,
          }
        }
      })

      const text = result.text || ""
      return { result: text, tokensUsed: estimateTokenCount(analysisPrompt) + estimateTokenCount(text) }
    }, estimateTokenCount(analysisPrompt))

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

  // Use smart router for API keys
  const generatedPrompt = await withSmartRoute(async (route: SmartRouteResult) => {
    const result = await route.client.models.generateContent({
      model: route.modelId,
      contents: prompt,
      config: {
        thinkingConfig: {
          thinkingLevel: ThinkingLevel.LOW,
        }
      }
    })
    const text = result.text || ""
    return { result: text, tokensUsed: estimateTokenCount(prompt) + estimateTokenCount(text) }
  }, estimateTokenCount(prompt))

  // Strict limit: 3500 characters max (leaves 1500 for view keywords)
  if (generatedPrompt.length > 3500) {
    return generatedPrompt.substring(0, 3500).trim()
  }

  return generatedPrompt
}
