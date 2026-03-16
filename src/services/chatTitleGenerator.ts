import { GoogleGenerativeAI } from "@google/generative-ai"
import { getApiKeys, withApiFallback } from "../lib/apiFallback"
import type { Message } from "../types"

// Get API keys with fallback support
const GEMINI_API_KEYS = getApiKeys("VITE_GEMINI_API_KEY")

/**
 * Generate a chat session title using AI based on the conversation
 * @param messages - Array of messages in the conversation
 * @returns Generated title (max 50 characters)
 */
export async function generateChatTitle(messages: Message[]): Promise<string> {
  if (GEMINI_API_KEYS.length === 0) {
    throw new Error("Gemini API key is required for title generation")
  }

  // Need at least one user message and one assistant message
  const userMessages = messages.filter(m => m.role === "user")
  const assistantMessages = messages.filter(m => m.role === "assistant")
  
  if (userMessages.length === 0 || assistantMessages.length === 0) {
    return "New Chat"
  }

  // Get the first user message and first assistant response
  const firstUserMessage = userMessages[0].content
  const firstAssistantMessage = assistantMessages[0].content

  const prompt = `Based on this conversation, generate a concise, descriptive title (MAX 50 characters, no quotes, no punctuation at the end).

User: ${firstUserMessage.substring(0, 200)}
Assistant: ${firstAssistantMessage.substring(0, 300)}

Generate a short, clear title that captures the main topic or goal of this conversation. Examples:
- "Warrior Character Design"
- "Fantasy RPG Asset Creation"
- "3D Model Generation"
- "Game Character Concept"

Return ONLY the title, nothing else.`

  try {
    const title = await withApiFallback(
      GEMINI_API_KEYS,
      async (apiKey) => {
        const genAI = new GoogleGenerativeAI(apiKey)
        const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" })
        
        const result = await model.generateContent(prompt)
        const response = await result.response
        let generatedTitle = response.text().trim()
        
        // Remove quotes if present
        generatedTitle = generatedTitle.replace(/^["']|["']$/g, "")
        
        // Ensure max 50 characters
        if (generatedTitle.length > 50) {
          generatedTitle = generatedTitle.substring(0, 50).trim()
        }
        
        // Fallback if empty or too short
        if (generatedTitle.length < 3) {
          // Generate from first user message
          generatedTitle = firstUserMessage.length > 50 
            ? firstUserMessage.substring(0, 50) + "..."
            : firstUserMessage
        }
        
        return generatedTitle
      }
    )
    
    return title
  } catch (error) {
    console.error("Error generating chat title:", error)
    // Fallback to first user message
    const fallbackTitle = firstUserMessage.length > 50 
      ? firstUserMessage.substring(0, 50) + "..."
      : firstUserMessage
    return fallbackTitle || "New Chat"
  }
}

