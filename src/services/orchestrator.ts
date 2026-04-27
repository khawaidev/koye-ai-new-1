/**
 * Uses the smart Gemini router to classify intents and route
 * user messages to the optimal model:
 * 
 * - general        → Gemini (via smart router / standard SDK)
 * - light_coding   → Gemini 3 Flash (via smart router / standard SDK)
 * - advanced_coding → gemini-3.1-pro (Hyperreal) — only for genuinely complex tasks
 * - advanced_reasoning → gemini-3.1-pro (Hyperreal) — deep analysis / architecture
 *
 * IMPORTANT: light_coding now routes through the standard Gemini SDK (not Hyperreal)
 * to avoid CORS issues and reduce latency for simple code changes.
 */

import { ThinkingLevel } from "@google/genai"
import { getApiKeys } from "../lib/apiFallback"
import { sendMessageToHyperrealStream, type HyperrealMessage } from "./hyperreal"
import { withSmartRoute, type SmartRouteResult } from "./geminiSmartRouter"

const GEMINI_API_KEYS = getApiKeys("VITE_GEMINI_API_KEY")

const CLASSIFIER_PROMPT = `You are an intent classifier. Classify the user's LATEST message into exactly one category:

- "general": casual chat, greetings, simple questions, image analysis, multimodal conversations, basic coding help, simple explanations, game design discussion, asset descriptions, simple file operations
- "light_coding": fast, light, or small changes in code, minor refactoring, adding comments, fixing simple syntax errors, or writing small isolated functions, creating/editing a few files with straightforward content
- "advanced_coding": complex game engine code, writing full game systems, shaders, physics engines, multiplayer networking code, complex algorithms, debugging intricate code issues, writing complete classes/modules with 50+ lines
- "advanced_reasoning": deep system architecture design, multi-step project planning, complex research analysis, database schema design, scaling strategies, detailed technical comparisons, comprehensive game design documents

IMPORTANT RULES:
1. Default to "general" if unsure - it's the safest choice
2. Only use "advanced_coding" for genuinely complex coding tasks, NOT simple code snippets
3. Use "light_coding" for brief, fast, or minor code edits and code suggestions
4. Only use "advanced_reasoning" for deep planning/analysis, NOT simple questions about architecture
5. Short messages, questions, and conversational messages are ALWAYS "general" (unless explicitly asking for a quick code change, which is "light_coding")
6. Messages with images attached are ALWAYS "general"

Reply with ONLY the category name, nothing else.`

export type OrchestratorIntent = "general" | "light_coding" | "advanced_coding" | "advanced_reasoning"

export interface ModelSwitchInfo {
  intent: OrchestratorIntent
  modelName: string
  displayName: string
}

/**
 * Classify user intent using heuristic keyword matching.
 * Keeps it fast and avoids an extra API call for classification.
 */
export async function classifyIntent(
  userMessage: string,
  hasImages: boolean = false
): Promise<OrchestratorIntent> {
  if (hasImages) {
    console.log("[Orchestrator] Has images → general")
    return "general"
  }

  const text = userMessage.toLowerCase()

  // Very short messages are always general
  if (text.length < 15) {
    console.log("[Orchestrator] Short message → general")
    return "general"
  }

  // Advanced reasoning triggers — must be genuinely complex multi-step planning
  const reasoningKeywords = [
    "design the entire architecture",
    "comprehensive design document",
    "database schema design",
    "scaling strategy for",
    "detailed technical comparison",
    "system design for",
    "multi-step project plan",
  ]
  const hasReasoningKeyword = reasoningKeywords.some(kw => text.includes(kw))
  const hasReasoningComplexityHint =
    text.includes("tradeoff") ||
    text.includes("trade-off") ||
    text.includes("pros and cons") ||
    text.includes("step by step architecture")
  if (hasReasoningKeyword && hasReasoningComplexityHint) {
    console.log("[Orchestrator] Heuristic match → advanced_reasoning")
    return "advanced_reasoning"
  }

  // Advanced coding triggers — genuinely complex multi-file systems
  const advCodingKeywords = [
    "multiplayer networking",
    "physics engine",
    "write a complete",
    "full game system",
    "complex algorithm",
    "shader code",
    "game engine code",
    "implement the entire",
    "build the full",
    "write all the",
  ]
  const hasAdvancedCodingKeyword = advCodingKeywords.some(kw => text.includes(kw))
  const hasAdvancedCodingScopeHint =
    text.includes("multi-file") ||
    text.includes("multiple files") ||
    text.includes("from scratch") ||
    text.includes("end to end")
  if (hasAdvancedCodingKeyword && hasAdvancedCodingScopeHint) {
    console.log("[Orchestrator] Heuristic match → advanced_coding")
    return "advanced_coding"
  }

  // Light coding triggers — simple file operations, quick edits, minor code
  const lightCodingKeywords = [
    "create file",
    "edit file",
    "update file",
    "modify file",
    "add a function",
    "fix the bug",
    "fix this",
    "refactor",
    "write a function",
    "write a script",
    "add code",
    "update the code",
    "change the code",
    "implement",
    "add a method",
    "create a class",
    "write code",
  ]
  // Only match light_coding if the message is reasonably coding-focused
  // Avoid triggering on very casual mentions of these words
  if (lightCodingKeywords.some(kw => text.includes(kw))) {
    console.log("[Orchestrator] Heuristic match → light_coding")
    return "light_coding"
  }

  // Generic code-related words — still route to light_coding (handled by Gemini SDK)
  const genericCodeWords = ["code", "function", "bug", "error", "script"]
  const hasCodeContext = genericCodeWords.some(w => {
    // Must be a whole word, not part of another word
    const regex = new RegExp(`\\b${w}\\b`, "i")
    return regex.test(text)
  })
  if (hasCodeContext && text.length > 30) {
    console.log("[Orchestrator] Generic code context → light_coding")
    return "light_coding"
  }

  console.log("[Orchestrator] Defaulting to general")
  return "general"
}

/**
 * Get display info for a given intent
 */
function getModelInfo(intent: OrchestratorIntent): ModelSwitchInfo {
  switch (intent) {
    case "light_coding":
      return {
        intent,
        modelName: "gemini-2.5-flash-lite",
        displayName: "Gemini 2.5 Flash Lite",
      }
    case "advanced_coding":
      return {
        intent,
        modelName: "gemini-3.1-pro",
        displayName: "Gemini 3.1 Pro (Advanced Coding)",
      }
    case "advanced_reasoning":
      return {
        intent,
        modelName: "gemini-3.1-pro",
        displayName: "Gemini 3.1 Pro (Advanced Reasoning)",
      }
    case "general":
    default:
      return {
        intent: "general",
        modelName: "gemini-3.1-flash-lite-preview",
        displayName: "Gemini 3.1 Flash Lite Preview",
      }
  }
}

/**
 * Convert Gemini-format messages to Hyperreal OpenAI-format messages
 */
function convertToHyperrealMessages(
  geminiMessages: Array<{
    role: "user" | "model"
    parts: Array<{ text?: string; inlineData?: { mimeType: string; data: string } }>
  }>
): HyperrealMessage[] {
  const hyperrealMessages: HyperrealMessage[] = []
  let systemInjected = false

  for (const msg of geminiMessages) {
    const textParts = msg.parts
      .filter((p) => p.text)
      .map((p) => p.text!)
      .join("\n")

    if (textParts) {
      // Preserve system instructions when routing to Hyperreal.
      // ChatInterface prefixes them with "SYSTEM INSTRUCTION: ...".
      if (
        !systemInjected &&
        msg.role === "user" &&
        textParts.startsWith("SYSTEM INSTRUCTION:")
      ) {
        hyperrealMessages.push({
          role: "system",
          content: textParts.replace(/^SYSTEM INSTRUCTION:\s*/i, "").trim(),
        })
        systemInjected = true
        continue
      }

      hyperrealMessages.push({
        role: msg.role === "model" ? "assistant" : "user",
        content: textParts,
      })
    }
  }

  return hyperrealMessages
}

/**
 * Route a message through the orchestrator with streaming.
 * 
 * 1. Classifies intent using heuristic keywords (fast, no API call)
 * 2. If general or light_coding → returns intent so caller uses Gemini SDK directly
 * 3. If advanced_coding or advanced_reasoning → streams from Hyperreal (gemini-3.1-pro)
 * 
 * DESIGN DECISION: light_coding now returns "general" to the caller so it routes
 * through the standard Gemini SDK. This avoids CORS issues with Hyperreal for
 * simple tasks and gives faster response times. Only genuinely complex tasks
 * (advanced_coding, advanced_reasoning) go through Hyperreal.
 * 
 * @param geminiMessages - Messages in Gemini format (same as sendMessageToGeminiStream)
 * @param onModelSwitch - Optional callback when a non-default model is selected
 * @returns AsyncGenerator yielding text chunks, or intent if caller should use gemini.ts
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

  // general AND light_coding both route through Gemini SDK (caller handles it)
  // This avoids CORS issues and is faster for simple tasks
  if (intent === "general" || intent === "light_coding") {
    return intent
  }

  // Only advanced_coding and advanced_reasoning route to Hyperreal (gemini-3.1-pro)
  const hyperrealModel = "gemini-3.1-pro"
  const hyperrealMessages = convertToHyperrealMessages(geminiMessages)

  try {
    for await (const chunk of sendMessageToHyperrealStream(hyperrealModel, hyperrealMessages)) {
      yield chunk
    }
    return intent
  } catch (error) {
    // Graceful fallback: if Hyperreal is unavailable (CORS, billing, quota, network, etc.),
    // let caller transparently route back to standard Gemini flow.
    console.warn(`[Orchestrator] Hyperreal routing failed for ${intent}, falling back to general:`, error)
    return "general"
  }
}

export { getModelInfo }
