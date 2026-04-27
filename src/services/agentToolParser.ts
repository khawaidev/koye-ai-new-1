/**
 * Agent Tool Parser
 *
 * Parses tool calls from the LLM's streamed text response.
 * Supports two formats:
 *
 * 1. NEW structured format:
 *    [TOOL_CALL: tool_name, { "param": "value" }]
 *
 * 2. LEGACY markers (backward compatible):
 *    [CREATE_FILE: path, content]
 *    [EDIT_FILE: path, content]
 *    [DELETE_FILE: path]
 *    [EDIT_IMAGE: path, prompt, model]
 *
 * Returns an array of ToolCall objects and the content with markers stripped out.
 */

import { uuidv4 } from "../lib/uuid"
import type { ToolCall, ToolName } from "../types/agentTools"

export interface ParseResult {
  /** Tool calls extracted from the response */
  toolCalls: ToolCall[]
  /** The response text with tool call markers removed */
  strippedContent: string
}

// ─── Human-readable tool display names ───
// Used by ChatInterface to show shimmer loading states during tool execution

const TOOL_DISPLAY_NAMES: Record<string, string> = {
  get_file_contents: "Reading file contents…",
  list_files: "Listing project files…",
  search_codebase: "Searching codebase…",
  create_file: "Creating file…",
  edit_file: "Editing file…",
  delete_file: "Deleting file…",
  create_folder: "Creating folder…",
  delete_folder: "Deleting folder…",
  rename_file: "Renaming file…",
  move_file: "Moving file…",
  copy_file: "Copying file…",
  replace_code: "Applying code changes…",
  search_web: "Searching the web…",
}

/**
 * Get a human-readable display name for a tool operation.
 * Returns a friendly string like "Reading file contents…" instead of "get_file_contents".
 */
export function getToolDisplayName(toolName: string): string {
  const key = toolName.trim().toLowerCase()
  return TOOL_DISPLAY_NAMES[key] || "Processing…"
}

/**
 * Detect tool call markers in streaming text and return human-readable hints.
 * Used during streaming to show shimmer loading text instead of raw markers.
 */
export function extractToolHints(text: string): string[] {
  const hints: string[] = []
  const seen = new Set<string>()

  // Detect structured [TOOL_CALL: name, ...] markers
  const structuredPattern = /\[TOOL_CALL:\s*([\w-]+)/g
  let m: RegExpExecArray | null
  while ((m = structuredPattern.exec(text)) !== null) {
    const hint = getToolDisplayName(m[1])
    if (!seen.has(hint)) {
      seen.add(hint)
      hints.push(hint)
    }
  }

  // Detect legacy markers
  const legacyMap: [RegExp, string][] = [
    [/\[CREATE_FILE:/g, "Creating file…"],
    [/\[EDIT_FILE:/g, "Editing file…"],
    [/\[DELETE_FILE:/g, "Deleting file…"],
    [/\[EDIT_IMAGE:/g, "Editing image…"],
    [/<CREATE_FILE/g, "Creating file…"],
    [/<EDIT_FILE/g, "Editing file…"],
    [/<DELETE_FILE/g, "Deleting file…"],
  ]
  for (const [pattern, hint] of legacyMap) {
    if (pattern.test(text) && !seen.has(hint)) {
      seen.add(hint)
      hints.push(hint)
    }
  }

  return hints
}

/**
 * Strip tool call markers from streaming text for clean display.
 * This is a best-effort strip used during streaming — the full parser runs after.
 */
export function stripToolMarkersForDisplay(text: string): string {
  let cleaned = text

  // Strip completed structured [TOOL_CALL: name, { ... }] blocks
  // Use bracket-aware removal
  const structuredBlocks = extractStructuredToolCallBlocks(cleaned)
  for (const block of structuredBlocks) {
    cleaned = cleaned.replace(block.raw, "")
  }

  // Strip completed XML-style markers
  cleaned = cleaned.replace(/<CREATE_FILE\s+path=["'][^"']+["']>[\s\S]*?<\/CREATE_FILE>/gi, "")
  cleaned = cleaned.replace(/<EDIT_FILE\s+path=["'][^"']+["']>[\s\S]*?<\/EDIT_FILE>/gi, "")
  cleaned = cleaned.replace(/<DELETE_FILE\s+path=["'][^"']+["']\s*\/>/gi, "")
  cleaned = cleaned.replace(/<EDIT_IMAGE\s+[^>]*\/>/gi, "")

  // Strip completed legacy bracket markers using bracket-aware removal
  cleaned = stripLegacyBracketMarkers(cleaned)

  // Strip any incomplete/trailing marker starts (still being streamed)
  const markerStarts = ["[TOOL_CALL:", "[CREATE_FILE:", "[EDIT_FILE:", "[DELETE_FILE:", "[EDIT_IMAGE:"]
  for (const ms of markerStarts) {
    const lastIdx = cleaned.lastIndexOf(ms)
    if (lastIdx !== -1) {
      // Check if this marker has been closed
      const afterMarker = cleaned.substring(lastIdx)
      // Count brackets to see if the marker is complete
      let depth = 0
      let complete = false
      for (let i = 0; i < afterMarker.length; i++) {
        if (afterMarker[i] === "[") depth++
        if (afterMarker[i] === "]") {
          depth--
          if (depth === 0) {
            complete = true
            break
          }
        }
      }
      if (!complete) {
        // Truncate at the start of the incomplete marker
        cleaned = cleaned.substring(0, lastIdx)
      }
    }
  }

  return cleaned.trim()
}

/**
 * Strip legacy bracket markers [CREATE_FILE: path, content] etc.
 * using a bracket-depth-aware approach instead of regex.
 */
function stripLegacyBracketMarkers(text: string): string {
  const markers = ["[CREATE_FILE:", "[EDIT_FILE:", "[DELETE_FILE:", "[EDIT_IMAGE:"]
  let result = text

  for (const marker of markers) {
    let searchFrom = 0
    while (searchFrom < result.length) {
      const start = result.indexOf(marker, searchFrom)
      if (start === -1) break

      // Find the matching closing bracket using depth counting
      let depth = 0
      let end = -1
      for (let i = start; i < result.length; i++) {
        if (result[i] === "[") depth++
        if (result[i] === "]") {
          depth--
          if (depth === 0) {
            end = i + 1
            break
          }
        }
      }

      if (end === -1) {
        // Incomplete marker — skip
        searchFrom = start + marker.length
        continue
      }

      // Remove the marker block
      result = result.substring(0, start) + result.substring(end)
      // Don't advance searchFrom since we removed text at `start`
    }
  }

  return result
}

/**
 * Parse all tool calls from the LLM response text.
 * Handles both the new structured format and legacy markers.
 */
export function parseToolCalls(content: string): ParseResult {
  const toolCalls: ToolCall[] = []
  let strippedContent = content

  // ─── 1. Parse NEW structured format ───
  // [TOOL_CALL: tool_name, { "param": "value" }]
  // Parse with a bracket/brace-aware scanner so multiple tool calls and nested JSON are reliable.
  const structuredBlocks = extractStructuredToolCallBlocks(content)
  let match: RegExpExecArray | null

  for (const block of structuredBlocks) {
    try {
      const toolName = block.toolName.trim().toLowerCase() as ToolName
      const params = JSON.parse(block.paramsJson)
      toolCalls.push({
        id: uuidv4(),
        tool: toolName,
        params,
        timestamp: Date.now(),
      })
      strippedContent = strippedContent.replace(block.raw, "")
    } catch (e) {
      console.warn("[AgentToolParser] Failed to parse structured tool call:", block.raw, e)
    }
  }

  // ─── 2. Parse LEGACY CREATE_FILE markers ───
  // XML-style first (more reliable)
  const createXmlRegex = /<CREATE_FILE\s+path=["']([^"']+)["']>([\s\S]*?)<\/CREATE_FILE>/gi
  while ((match = createXmlRegex.exec(content)) !== null) {
    if (toolCalls.some((tc) => tc.params.path === match![1].trim())) continue
    toolCalls.push({
      id: uuidv4(),
      tool: "create_file",
      params: { path: match[1].trim(), content: match[2].trim() },
      timestamp: Date.now(),
    })
    strippedContent = strippedContent.replace(match[0], "")
  }

  // Bracket-style: use bracket-aware extraction
  const legacyCreateBlocks = extractLegacyBracketBlocks(content, "CREATE_FILE")
  for (const block of legacyCreateBlocks) {
    if (toolCalls.some((tc) => tc.params.path === block.path)) continue
    toolCalls.push({
      id: uuidv4(),
      tool: "create_file",
      params: { path: block.path, content: block.content },
      timestamp: Date.now(),
    })
    strippedContent = strippedContent.replace(block.raw, "")
  }

  // ─── 3. Parse LEGACY EDIT_FILE markers ───
  const editXmlRegex = /<EDIT_FILE\s+path=["']([^"']+)["']>([\s\S]*?)<\/EDIT_FILE>/gi
  while ((match = editXmlRegex.exec(content)) !== null) {
    if (toolCalls.some((tc) => tc.params.path === match![1].trim() && tc.tool === "edit_file")) continue
    toolCalls.push({
      id: uuidv4(),
      tool: "edit_file",
      params: { path: match[1].trim(), content: match[2].trim() },
      timestamp: Date.now(),
    })
    strippedContent = strippedContent.replace(match[0], "")
  }

  // Bracket-style: use bracket-aware extraction
  const legacyEditBlocks = extractLegacyBracketBlocks(content, "EDIT_FILE")
  for (const block of legacyEditBlocks) {
    if (toolCalls.some((tc) => tc.params.path === block.path && tc.tool === "edit_file")) continue
    toolCalls.push({
      id: uuidv4(),
      tool: "edit_file",
      params: { path: block.path, content: block.content },
      timestamp: Date.now(),
    })
    strippedContent = strippedContent.replace(block.raw, "")
  }

  // ─── 4. Parse LEGACY DELETE_FILE markers ───
  const deleteRegexes = [
    /<DELETE_FILE\s+path=["']([^"']+)["']\s*\/>/gi,
    /\[DELETE_FILE:\s*([^\]]+?)\]/gi,
  ]
  for (const regex of deleteRegexes) {
    while ((match = regex.exec(content)) !== null) {
      if (toolCalls.some((tc) => tc.params.path === match![1].trim() && tc.tool === "delete_file")) continue

      toolCalls.push({
        id: uuidv4(),
        tool: "delete_file",
        params: {
          path: match[1].trim(),
        },
        timestamp: Date.now(),
      })
      strippedContent = strippedContent.replace(match[0], "")
    }
  }

  // ─── 5. Parse LEGACY EDIT_IMAGE markers (keep for compat, treat as special) ───
  const editImageRegexes = [
    /<EDIT_IMAGE\s+path=["']([^"']+)["']\s+prompt=["']([^"']+)["'](?:\s+model=["']([^"']+)["'])?\s*\/>/gi,
    /\[EDIT_IMAGE:\s*([^\]\,]+?),\s*([^\]\,]+?)(?:,\s*([^\]]+?))?\]/gi,
  ]
  for (const regex of editImageRegexes) {
    while ((match = regex.exec(content)) !== null) {
      toolCalls.push({
        id: uuidv4(),
        tool: "edit_file" as ToolName,  // Treat as edit_file with special __editImage flag
        params: {
          path: match[1].trim(),
          __editImage: true,
          prompt: match[2].trim(),
          model: match[3] ? match[3].trim() : "nano-banana-edit",
        },
        timestamp: Date.now(),
      })
      strippedContent = strippedContent.replace(match[0], "")
    }
  }

  return {
    toolCalls,
    strippedContent: strippedContent.trim(),
  }
}

interface StructuredToolCallBlock {
  raw: string
  toolName: string
  paramsJson: string
}

function extractStructuredToolCallBlocks(content: string): StructuredToolCallBlock[] {
  const blocks: StructuredToolCallBlock[] = []
  const marker = "[TOOL_CALL:"
  let searchFrom = 0

  while (searchFrom < content.length) {
    const start = content.indexOf(marker, searchFrom)
    if (start === -1) break

    let i = start + marker.length
    while (i < content.length && /\s/.test(content[i])) i++

    const toolNameStart = i
    while (i < content.length && /[\w-]/.test(content[i])) i++
    const toolName = content.slice(toolNameStart, i)

    while (i < content.length && /\s/.test(content[i])) i++
    if (content[i] !== ",") {
      searchFrom = start + marker.length
      continue
    }
    i++
    while (i < content.length && /\s/.test(content[i])) i++
    if (content[i] !== "{") {
      searchFrom = start + marker.length
      continue
    }

    const jsonStart = i
    let depth = 0
    let inString = false
    let escaping = false
    let jsonEnd = -1

    for (; i < content.length; i++) {
      const ch = content[i]
      if (inString) {
        if (escaping) {
          escaping = false
          continue
        }
        if (ch === "\\") {
          escaping = true
          continue
        }
        if (ch === "\"") {
          inString = false
        }
        continue
      }
      if (ch === "\"") {
        inString = true
        continue
      }
      if (ch === "{") {
        depth++
        continue
      }
      if (ch === "}") {
        depth--
        if (depth === 0) {
          jsonEnd = i
          i++
          break
        }
      }
    }

    if (jsonEnd === -1) {
      searchFrom = start + marker.length
      continue
    }

    while (i < content.length && /\s/.test(content[i])) i++
    if (content[i] !== "]") {
      searchFrom = start + marker.length
      continue
    }

    const rawEnd = i + 1
    const raw = content.slice(start, rawEnd)
    const paramsJson = content.slice(jsonStart, jsonEnd + 1)
    blocks.push({ raw, toolName, paramsJson })
    searchFrom = rawEnd
  }

  return blocks
}

// ─── Bracket-aware legacy marker extraction ───

interface LegacyBracketBlock {
  raw: string
  path: string
  content: string
}

/**
 * Extract legacy bracket markers like [EDIT_FILE: path, content]
 * using bracket-depth counting so content with `]` characters is handled correctly.
 */
function extractLegacyBracketBlocks(content: string, markerName: string): LegacyBracketBlock[] {
  const blocks: LegacyBracketBlock[] = []
  const marker = `[${markerName}:`
  let searchFrom = 0

  while (searchFrom < content.length) {
    const start = content.indexOf(marker, searchFrom)
    if (start === -1) break

    // Find the matching closing bracket using depth counting
    let depth = 0
    let end = -1
    for (let i = start; i < content.length; i++) {
      if (content[i] === "[") depth++
      if (content[i] === "]") {
        depth--
        if (depth === 0) {
          end = i + 1
          break
        }
      }
    }

    if (end === -1) {
      searchFrom = start + marker.length
      continue
    }

    const raw = content.slice(start, end)
    // Extract path and content from the inner text
    const inner = raw.slice(marker.length, -1).trim() // Remove [MARKER: and ]

    // Split on first comma to get path and content
    const commaIdx = inner.indexOf(",")
    if (commaIdx === -1) {
      searchFrom = end
      continue
    }

    const path = inner.slice(0, commaIdx).trim()
    const fileContent = inner.slice(commaIdx + 1).trim()

    blocks.push({ raw, path, content: fileContent })
    searchFrom = end
  }

  return blocks
}

/**
 * Check if a response text contains any tool calls (quick check without full parsing)
 */
export function hasToolCalls(content: string): boolean {
  return (
    /\[TOOL_CALL:/i.test(content) ||
    /\[CREATE_FILE:/i.test(content) ||
    /\[EDIT_FILE:/i.test(content) ||
    /\[DELETE_FILE:/i.test(content) ||
    /\[EDIT_IMAGE:/i.test(content) ||
    /<CREATE_FILE/i.test(content) ||
    /<EDIT_FILE/i.test(content) ||
    /<DELETE_FILE/i.test(content) ||
    /<EDIT_IMAGE/i.test(content)
  )
}
