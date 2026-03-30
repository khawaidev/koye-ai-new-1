/**
 * Orchestrator Service
 * 
 * Uses Gemini 2.5 Flash as a lightweight intent classifier to route
 * user messages to the optimal model:
 * 
 * - general → Gemini 2.5 Flash (existing gemini.ts)
 * - advanced_coding → gpt-5.1-codex-max (ai.cc)
 * - advanced_reasoning → gemini-2.5-pro (ai.cc)
 */

import { GoogleGenerativeAI } from "@google/generative-ai"
import { getApiKeys } from "../lib/apiFallback"
import { sendMessageToAiccStream, type AiccMessage } from "./aicc"

const GEMINI_API_KEYS = getApiKeys("VITE_GEMINI_API_KEY")

// The system prompt from gemini.ts — we re-import the concept here
// but the actual SYSTEM_PROMPT is injected by ChatInterface into the messages array
const CLASSIFIER_PROMPT = `You are an intent classifier. Classify the user's LATEST message into exactly one category:

- "general": casual chat, greetings, simple questions, image analysis, multimodal conversations, basic coding help, simple explanations, game design discussion, asset descriptions, simple file operations
- "advanced_coding": complex game engine code, writing full game systems, shaders, physics engines, multiplayer networking code, complex algorithms, debugging intricate code issues, writing complete classes/modules with 50+ lines
- "advanced_reasoning": deep system architecture design, multi-step project planning, complex research analysis, database schema design, scaling strategies, detailed technical comparisons, comprehensive game design documents

IMPORTANT RULES:
1. Default to "general" if unsure - it's the safest choice
2. Only use "advanced_coding" for genuinely complex coding tasks, NOT simple code snippets
3. Only use "advanced_reasoning" for deep planning/analysis, NOT simple questions about architecture
4. Short messages, questions, and conversational messages are ALWAYS "general"
5. Messages with images attached are ALWAYS "general"

Reply with ONLY the category name, nothing else.`

export type OrchestratorIntent = "general" | "advanced_coding" | "advanced_reasoning"

export interface ModelSwitchInfo {
  intent: OrchestratorIntent
  modelName: string
  displayName: string
}

/**
 * Classify user intent using Gemini 2.5 Flash (fast, cheap call)
 */
export async function classifyIntent(
  userMessage: string,
  hasImages: boolean = false
): Promise<OrchestratorIntent> {
  // Short-circuit: if message has images, always use general
  if (hasImages) {
    console.log("[Orchestrator] Has images → general")
    return "general"
  }

  // Short-circuit: very short messages are always general
  if (userMessage.length < 50) {
    console.log("[Orchestrator] Short message → general")
    return "general"
  }

  if (GEMINI_API_KEYS.length === 0) {
    console.warn("[Orchestrator] No Gemini API keys, defaulting to general")
    return "general"
  }

  try {
    const genAI = new GoogleGenerativeAI(GEMINI_API_KEYS[0])
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" })

    const result = await model.generateContent([
      { text: CLASSIFIER_PROMPT },
      { text: `User message: "${userMessage}"` },
    ])

    const response = result.response.text().trim().toLowerCase()

    // Parse response
    if (response.includes("advanced_coding")) return "advanced_coding"
    if (response.includes("advanced_reasoning")) return "advanced_reasoning"
    return "general"
  } catch (error) {
    console.warn("[Orchestrator] Classification failed, defaulting to general:", error)
    return "general"
  }
}

/**
 * Get display info for a given intent
 */
function getModelInfo(intent: OrchestratorIntent): ModelSwitchInfo {
  switch (intent) {
    case "advanced_coding":
      return {
        intent,
        modelName: "gpt-5.1-codex-max",
        displayName: "GPT-5.1 Codex Max (Advanced Coding)",
      }
    case "advanced_reasoning":
      return {
        intent,
        modelName: "gemini-2.5-pro",
        displayName: "Gemini 2.5 Pro (Advanced Reasoning)",
      }
    case "general":
    default:
      return {
        intent: "general",
        modelName: "gemini-2.5-flash",
        displayName: "Gemini 2.5 Flash",
      }
  }
}

/**
 * Convert Gemini-format messages to ai.cc OpenAI-format messages
 */
function convertToAiccMessages(
  geminiMessages: Array<{
    role: "user" | "model"
    parts: Array<{ text?: string; inlineData?: { mimeType: string; data: string } }>
  }>
): AiccMessage[] {
  const aiccMessages: AiccMessage[] = []

  for (const msg of geminiMessages) {
    const textParts = msg.parts
      .filter((p) => p.text)
      .map((p) => p.text!)
      .join("\n")

    if (textParts) {
      aiccMessages.push({
        role: msg.role === "model" ? "assistant" : "user",
        content: textParts,
      })
    }
  }

  return aiccMessages
}

/**
 * Route a message through the orchestrator with streaming.
 * 
 * 1. Classifies intent using Gemini 2.5 Flash
 * 2. If general → delegates to Gemini streaming (caller should use existing gemini.ts)
 * 3. If advanced → streams from ai.cc
 * 
 * @param geminiMessages - Messages in Gemini format (same as sendMessageToGeminiStream)
 * @param onModelSwitch - Optional callback when a non-default model is selected
 * @returns AsyncGenerator yielding text chunks, or null if intent is "general" (caller should fallback to gemini.ts)
 */
export async function* routeMessageStream(
  geminiMessages: Array<{
    role: "user" | "model"
    parts: Array<{ text?: string; inlineData?: { mimeType: string; data: string } }>
  }>,
  onModelSwitch?: (info: ModelSwitchInfo) => void
): AsyncGenerator<string, OrchestratorIntent, unknown> {
  // Extract the latest user message text for classification
  const lastMessage = geminiMessages[geminiMessages.length - 1]
  const userText = lastMessage?.parts
    .filter((p) => p.text)
    .map((p) => p.text!)
    .join(" ") || ""
  const hasImages = lastMessage?.parts.some((p) => p.inlineData) || false

  // Classify intent
  const intent = await classifyIntent(userText, hasImages)
  const modelInfo = getModelInfo(intent)

  console.log(`[Orchestrator] Intent: ${intent}, routing to ${modelInfo.modelName}`)

  // Notify caller about model switch
  if (onModelSwitch) {
    onModelSwitch(modelInfo)
  }

  // If general, return intent so caller can use existing gemini.ts
  if (intent === "general") {
    return intent
  }

  // Route to ai.cc for advanced models
  const aiccModel = intent === "advanced_coding" ? "gpt-5.1-codex-max" : "gemini-2.5-pro"
  const aiccMessages = convertToAiccMessages(geminiMessages)

  for await (const chunk of sendMessageToAiccStream(aiccModel, aiccMessages)) {
    yield chunk
  }

  return intent
}

export { getModelInfo }
