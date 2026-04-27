/**
 * Agent Tool System — Type Definitions
 *
 * Defines the tool vocabulary the LLM agent can invoke,
 * the sandbox change tracking model, and approval workflow types.
 */

// ───── Tool Name Registry ─────

/** File/folder tools that require user approval */
export type FileToolName =
  | "create_file"
  | "create_folder"
  | "delete_file"
  | "delete_folder"
  | "edit_file"
  | "rename_file"
  | "move_file"
  | "copy_file"
  | "search_codebase"
  | "replace_code"

/** Read-only tools — auto-approved, no side effects */
export type ReadOnlyToolName =
  | "get_file_contents"
  | "list_files"

/** Agent-autonomous tools — no user approval needed */
export type AutonomousToolName =
  | "search_web"

export type ToolName = FileToolName | ReadOnlyToolName | AutonomousToolName

// ───── Tool Call ─────

export interface ToolCall {
  /** Unique ID for this invocation */
  id: string
  /** Which tool the LLM is calling */
  tool: ToolName
  /** Tool-specific parameters (varies per tool) */
  params: Record<string, any>
  /** Timestamp of when the tool was parsed */
  timestamp: number
}

// ───── Tool Result ─────

export type ToolApprovalStatus = "pending" | "approved" | "rejected" | "auto"

export interface ToolResult {
  toolCallId: string
  status: ToolApprovalStatus
  /** Data returned to the user / LLM (e.g. file contents, search results) */
  result?: any
  error?: string
}

// ───── Sandbox Change ─────

export type SandboxChangeType =
  | "create"
  | "edit"
  | "delete"
  | "rename"
  | "move"
  | "copy"

export interface SandboxChange {
  /** Unique ID for this change */
  id: string
  /** The tool call that produced this change */
  toolCallId: string
  /** File path affected */
  path: string
  /** Type of mutation */
  type: SandboxChangeType
  /** Original file content (before change), undefined for new files */
  originalContent?: string
  /** New file content (after change), undefined for deletions */
  newContent?: string
  /** For rename/move: the destination path */
  newPath?: string
  /** Lines added in this change */
  linesAdded: number
  /** Lines removed in this change */
  linesRemoved: number
  /** Approval status for this individual change */
  status: ToolApprovalStatus
}

// ───── Approval Mode ─────

/**
 * User preference for how tool calls are handled:
 * - ask_every_time: show approval card for every file-modifying tool
 * - auto_execute: execute immediately without asking
 */
export type ToolApprovalMode = "ask_every_time" | "auto_execute"

// ───── Tool Parameter Shapes (for documentation / validation) ─────

export interface CreateFileParams {
  path: string
  content: string
}

export interface CreateFolderParams {
  path: string
}

export interface DeleteFileParams {
  path: string
}

export interface EditFileParams {
  path: string
  content: string
  /** Optional: specific line range to edit (startLine, endLine) */
  startLine?: number
  endLine?: number
}

export interface GetFileContentsParams {
  path: string
}

export interface ListFilesParams {
  path?: string // optional subfolder filter
}

export interface RenameFileParams {
  path: string
  newName: string
}

export interface MoveFileParams {
  path: string
  destination: string
}

export interface CopyFileParams {
  path: string
  destination: string
}

export interface SearchCodebaseParams {
  query: string
  /** Optional: limit to files matching a glob */
  filePattern?: string
}

export interface ReplaceCodeParams {
  path: string
  search: string
  replace: string
  /** Replace all occurrences or just the first? Default: true */
  replaceAll?: boolean
}

export interface SearchWebParams {
  query: string
}

// ───── Helpers ─────

/** Returns true if the tool modifies files and needs user approval */
export function isFileModifyingTool(tool: ToolName): boolean {
  const modifyingTools: ToolName[] = [
    "create_file", "create_folder", "delete_file", "delete_folder",
    "edit_file", "rename_file", "move_file", "copy_file",
    "replace_code"
  ]
  return modifyingTools.includes(tool)
}

/** Returns true if the tool is read-only (auto-approved) */
export function isReadOnlyTool(tool: ToolName): boolean {
  return tool === "get_file_contents" || tool === "list_files" || tool === "search_codebase"
}

/** Returns true if the tool is autonomous (no approval needed, agent-initiated) */
export function isAutonomousTool(tool: ToolName): boolean {
  return tool === "search_web"
}
