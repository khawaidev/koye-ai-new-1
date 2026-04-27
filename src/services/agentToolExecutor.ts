/**
 * Agent Tool Executor
 *
 * Executes tool calls in a sandbox (in-memory staging) and, upon approval,
 * commits those changes to R2 + Supabase via the existing projectFiles service.
 *
 * Flow:
 * 1. LLM emits tool call → Parser extracts it
 * 2. executeToolInSandbox() runs the tool against current files, produces SandboxChange[]
 * 3. Changes are staged in useAgentToolStore
 * 4. User approves/rejects via UI
 * 5. On approve → applyApprovedChanges() persists to R2 + updates generatedFiles
 */

import { uuidv4 } from "../lib/uuid"
import { deleteProjectFile, saveSingleProjectFile } from "./projectFiles"
import type {
  SandboxChange,
  ToolCall,
  ToolResult,
} from "../types/agentTools"

// ───── Sandbox Execution ─────

/**
 * Execute a tool call in the sandbox (no side effects, no persistence).
 * Returns the sandbox changes produced by the tool.
 */
export function executeToolInSandbox(
  toolCall: ToolCall,
  currentFiles: Record<string, string>
): { changes: SandboxChange[]; result?: ToolResult } {
  const { tool, params, id: toolCallId } = toolCall
  const changes: SandboxChange[] = []

  switch (tool) {
    // ── Create File ──
    case "create_file": {
      const { path, content = "" } = params
      const existing = currentFiles[path]
      changes.push({
        id: uuidv4(),
        toolCallId,
        path,
        type: "create",
        originalContent: existing,
        newContent: content,
        linesAdded: content.split("\n").length,
        linesRemoved: existing ? existing.split("\n").length : 0,
        status: "pending",
      })
      break
    }

    // ── Create Folder ──
    case "create_folder": {
      const { path } = params
      const keepFile = `${path}/.gitkeep`
      changes.push({
        id: uuidv4(),
        toolCallId,
        path: keepFile,
        type: "create",
        newContent: "",
        linesAdded: 0,
        linesRemoved: 0,
        status: "pending",
      })
      break
    }

    // ── Edit File ──
    case "edit_file": {
      // Skip __editImage calls (those are handled separately in ChatInterface)
      if (params.__editImage) break

      const { path, content = "" } = params
      const original = currentFiles[path] ?? ""
      const originalLines = original.split("\n").length
      const newLines = content.split("\n").length
      changes.push({
        id: uuidv4(),
        toolCallId,
        path,
        type: "edit",
        originalContent: original,
        newContent: content,
        linesAdded: Math.max(0, newLines - originalLines),
        linesRemoved: Math.max(0, originalLines - newLines),
        status: "pending",
      })
      break
    }

    // ── Delete File ──
    case "delete_file": {
      const { path } = params
      const original = currentFiles[path]
      changes.push({
        id: uuidv4(),
        toolCallId,
        path,
        type: "delete",
        originalContent: original,
        linesAdded: 0,
        linesRemoved: original ? original.split("\n").length : 0,
        status: "pending",
      })
      break
    }

    // ── Delete Folder ──
    case "delete_folder": {
      const { path } = params
      const prefix = path.endsWith("/") ? path : path + "/"
      for (const filePath of Object.keys(currentFiles)) {
        if (filePath.startsWith(prefix) || filePath === path) {
          const original = currentFiles[filePath]
          changes.push({
            id: uuidv4(),
            toolCallId,
            path: filePath,
            type: "delete",
            originalContent: original,
            linesAdded: 0,
            linesRemoved: original ? original.split("\n").length : 0,
            status: "pending",
          })
        }
      }
      break
    }

    // ── Rename File ──
    case "rename_file": {
      const { path, newName } = params
      const lastSlash = path.lastIndexOf("/")
      const dir = lastSlash > 0 ? path.substring(0, lastSlash) : ""
      const newPath = dir ? `${dir}/${newName}` : newName
      const original = currentFiles[path] ?? ""
      changes.push({
        id: uuidv4(),
        toolCallId,
        path,
        type: "rename",
        originalContent: original,
        newContent: original,
        newPath,
        linesAdded: 0,
        linesRemoved: 0,
        status: "pending",
      })
      break
    }

    // ── Move File ──
    case "move_file": {
      const { path, destination } = params
      const original = currentFiles[path] ?? ""
      changes.push({
        id: uuidv4(),
        toolCallId,
        path,
        type: "move",
        originalContent: original,
        newContent: original,
        newPath: destination,
        linesAdded: 0,
        linesRemoved: 0,
        status: "pending",
      })
      break
    }

    // ── Copy File ──
    case "copy_file": {
      const { path, destination } = params
      const original = currentFiles[path] ?? ""
      changes.push({
        id: uuidv4(),
        toolCallId,
        path,
        type: "copy",
        originalContent: original,
        newContent: original,
        newPath: destination,
        linesAdded: original.split("\n").length,
        linesRemoved: 0,
        status: "pending",
      })
      break
    }

    // ── Replace Code ──
    case "replace_code": {
      const { path, search, replace, replaceAll = true } = params
      const original = currentFiles[path] ?? ""
      let newContent: string
      if (replaceAll) {
        newContent = original.split(search).join(replace)
      } else {
        newContent = original.replace(search, replace)
      }
      const originalLines = original.split("\n").length
      const newLines = newContent.split("\n").length
      changes.push({
        id: uuidv4(),
        toolCallId,
        path,
        type: "edit",
        originalContent: original,
        newContent,
        linesAdded: Math.max(0, newLines - originalLines),
        linesRemoved: Math.max(0, originalLines - newLines),
        status: "pending",
      })
      break
    }

    // ── Read-Only: Get File Contents ──
    case "get_file_contents": {
      const { path } = params
      const content = currentFiles[path]
      return {
        changes: [],
        result: {
          toolCallId,
          status: "auto",
          result: content !== undefined
            ? { path, content }
            : { path, error: `File not found: ${path}` },
        },
      }
    }

    // ── Read-Only: List Files ──
    case "list_files": {
      const { path: dirPath } = params
      let filePaths = Object.keys(currentFiles)
      if (dirPath) {
        const prefix = dirPath.endsWith("/") ? dirPath : dirPath + "/"
        filePaths = filePaths.filter((p) => p.startsWith(prefix))
      }
      return {
        changes: [],
        result: {
          toolCallId,
          status: "auto",
          result: { files: filePaths },
        },
      }
    }

    // ── Read-Only: Search Codebase ──
    case "search_codebase": {
      const { query, filePattern } = params
      const results: Array<{ path: string; line: number; text: string }> = []
      const lowerQuery = query.toLowerCase()

      for (const [filePath, content] of Object.entries(currentFiles)) {
        // Skip binary content
        if (content.startsWith("data:") || content.startsWith("http")) continue
        // Optional glob filter (simple prefix match for now)
        if (filePattern && !filePath.includes(filePattern)) continue

        const lines = content.split("\n")
        for (let i = 0; i < lines.length; i++) {
          if (lines[i].toLowerCase().includes(lowerQuery)) {
            results.push({ path: filePath, line: i + 1, text: lines[i].trim() })
          }
        }
      }

      return {
        changes: [],
        result: {
          toolCallId,
          status: "auto",
          result: { query, matches: results.slice(0, 50) }, // Cap at 50
        },
      }
    }

    // ── Autonomous: Search Web ──
    case "search_web": {
      // This is handled separately in ChatInterface (existing web search flow)
      return {
        changes: [],
        result: {
          toolCallId,
          status: "auto",
          result: { note: "Web search is handled by the existing [WEB_SEARCH: ...] flow." },
        },
      }
    }

    default:
      console.warn(`[AgentToolExecutor] Unknown tool: ${tool}`)
  }

  return { changes }
}

// ───── Persistence (apply approved changes to R2 + Supabase) ─────

/**
 * Apply a list of approved sandbox changes to real storage.
 * Calls projectFiles.ts functions to persist to R2 + Supabase.
 *
 * @returns A map of path → content for the files that were successfully applied.
 */
export async function applyApprovedChanges(
  changes: SandboxChange[],
  projectId: string,
  userId: string,
  githubConnection: any
): Promise<Record<string, string | null>> {
  const applied: Record<string, string | null> = {}

  const saveWithRetry = async (path: string, content: string) => {
    let lastError: unknown = null
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        await saveSingleProjectFile(projectId, userId, "", path, content, githubConnection)
        return
      } catch (error) {
        lastError = error
        console.warn(`[AgentToolExecutor] Save attempt ${attempt} failed for ${path}:`, error)
      }
    }
    throw lastError instanceof Error ? lastError : new Error(`Failed to save ${path}`)
  }

  const deleteWithRetry = async (path: string) => {
    let lastError: unknown = null
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        await deleteProjectFile(projectId, userId, path, githubConnection)
        return
      } catch (error) {
        lastError = error
        console.warn(`[AgentToolExecutor] Delete attempt ${attempt} failed for ${path}:`, error)
      }
    }
    throw lastError instanceof Error ? lastError : new Error(`Failed to delete ${path}`)
  }

  for (const change of changes) {
    if (change.status !== "approved") continue

    try {
      switch (change.type) {
        case "create":
        case "edit": {
          const content = change.newContent ?? ""
          await saveWithRetry(change.path, content)
          applied[change.path] = content
          console.log(`✓ Agent tool applied ${change.type}: ${change.path}`)
          break
        }

        case "delete": {
          await deleteWithRetry(change.path)
          applied[change.path] = null
          console.log(`✓ Agent tool applied delete: ${change.path}`)
          break
        }

        case "rename":
        case "move": {
          if (change.newPath) {
            // Delete old path, create new path
            await deleteWithRetry(change.path)
            const content = change.newContent ?? change.originalContent ?? ""
            await saveWithRetry(change.newPath, content)
            applied[change.path] = null
            applied[change.newPath] = content
            console.log(`✓ Agent tool applied ${change.type}: ${change.path} → ${change.newPath}`)
          }
          break
        }

        case "copy": {
          if (change.newPath && change.newContent !== undefined) {
            await saveWithRetry(change.newPath, change.newContent)
            applied[change.newPath] = change.newContent
            console.log(`✓ Agent tool applied copy: ${change.path} → ${change.newPath}`)
          }
          break
        }
      }
    } catch (error) {
      console.error(`✗ Agent tool failed to apply ${change.type} for ${change.path}:`, error)
    }
  }

  return applied
}

export function applySandboxChangesToFileMap(
  baseFiles: Record<string, string>,
  changes: SandboxChange[]
): Record<string, string> {
  const nextFiles = { ...baseFiles }

  for (const change of changes) {
    switch (change.type) {
      case "create":
      case "edit":
        nextFiles[change.path] = change.newContent ?? ""
        break
      case "delete":
        delete nextFiles[change.path]
        break
      case "rename":
      case "move":
        if (change.newPath) {
          const content = change.newContent ?? change.originalContent ?? nextFiles[change.path] ?? ""
          delete nextFiles[change.path]
          nextFiles[change.newPath] = content
        }
        break
      case "copy":
        if (change.newPath) {
          nextFiles[change.newPath] = change.newContent ?? change.originalContent ?? ""
        }
        break
    }
  }

  return nextFiles
}
