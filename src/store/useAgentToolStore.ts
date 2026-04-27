/**
 * Agent Tool Store
 *
 * Manages sandbox state (staged file changes) and user approval preferences
 * for the agentic tool system. The sandbox is the in-memory staging area
 * where tool-produced changes live BEFORE the user approves them.
 *
 * The Builder viewer reads from a merged view of
 * `generatedFiles` (real) + `sandboxChanges` (staged) so the user
 * can preview changes instantly, even before approving.
 */

import { create } from "zustand"
import { persist } from "zustand/middleware"
import type {
  SandboxChange,
  ToolApprovalMode,
  ToolApprovalStatus,
  ToolCall,
  ToolResult,
} from "../types/agentTools"

interface AgentToolState {
  // ── Sandbox ──
  /** All staged changes from agent tool calls (not yet committed) */
  sandboxChanges: SandboxChange[]

  // ── Approval ──
  /** User preference: ask for every tool or auto-execute */
  approvalMode: ToolApprovalMode
  /** Tool calls waiting for user decision */
  pendingToolCalls: ToolCall[]
  /** Results of tool calls (for read-only tools or after approval) */
  toolResults: ToolResult[]

  // ── Actions ──
  addSandboxChange: (change: SandboxChange) => void
  addSandboxChanges: (changes: SandboxChange[]) => void
  removeSandboxChange: (changeId: string) => void

  addPendingToolCall: (toolCall: ToolCall) => void
  removePendingToolCall: (toolCallId: string) => void

  addToolResult: (result: ToolResult) => void

  /** Approve a single sandbox change by ID */
  approveChange: (changeId: string) => void
  /** Reject a single sandbox change by ID */
  rejectChange: (changeId: string) => void
  /** Approve ALL changes for a given tool call ID */
  approveToolCall: (toolCallId: string) => void
  /** Reject ALL changes for a given tool call ID */
  rejectToolCall: (toolCallId: string) => void

  setApprovalMode: (mode: ToolApprovalMode) => void
  clearSandbox: () => void

  // ── Computed helpers ──
  /** Get all pending (unapproved) changes */
  getPendingChanges: () => SandboxChange[]
  /** Get changes grouped by tool call ID */
  getChangesByToolCall: (toolCallId: string) => SandboxChange[]

  /**
   * Build a merged file map: real files + sandbox overlays.
   * This is what the Builder viewer should use to show previews.
   */
  getMergedFiles: (realFiles: Record<string, string>) => Record<string, string>
}

export const useAgentToolStore = create<AgentToolState>()(
  persist(
    (set, get) => ({
      sandboxChanges: [],
      approvalMode: "auto_execute",
      pendingToolCalls: [],
      toolResults: [],

      // ── Sandbox mutations ──
      addSandboxChange: (change) =>
        set((s) => ({ sandboxChanges: [...s.sandboxChanges, change] })),

      addSandboxChanges: (changes) =>
        set((s) => ({ sandboxChanges: [...s.sandboxChanges, ...changes] })),

      removeSandboxChange: (changeId) =>
        set((s) => ({
          sandboxChanges: s.sandboxChanges.filter((c) => c.id !== changeId),
        })),

      // ── Tool calls ──
      addPendingToolCall: (toolCall) =>
        set((s) => ({ pendingToolCalls: [...s.pendingToolCalls, toolCall] })),

      removePendingToolCall: (toolCallId) =>
        set((s) => ({
          pendingToolCalls: s.pendingToolCalls.filter((t) => t.id !== toolCallId),
        })),

      addToolResult: (result) =>
        set((s) => ({ toolResults: [...s.toolResults, result] })),

      // ── Approval ──
      approveChange: (changeId) =>
        set((s) => ({
          sandboxChanges: s.sandboxChanges.map((c) =>
            c.id === changeId ? { ...c, status: "approved" as ToolApprovalStatus } : c
          ),
        })),

      rejectChange: (changeId) =>
        set((s) => ({
          sandboxChanges: s.sandboxChanges.map((c) =>
            c.id === changeId ? { ...c, status: "rejected" as ToolApprovalStatus } : c
          ),
        })),

      approveToolCall: (toolCallId) =>
        set((s) => ({
          sandboxChanges: s.sandboxChanges.map((c) =>
            c.toolCallId === toolCallId
              ? { ...c, status: "approved" as ToolApprovalStatus }
              : c
          ),
          pendingToolCalls: s.pendingToolCalls.filter((t) => t.id !== toolCallId),
        })),

      rejectToolCall: (toolCallId) =>
        set((s) => ({
          sandboxChanges: s.sandboxChanges.map((c) =>
            c.toolCallId === toolCallId
              ? { ...c, status: "rejected" as ToolApprovalStatus }
              : c
          ),
          pendingToolCalls: s.pendingToolCalls.filter((t) => t.id !== toolCallId),
        })),

      setApprovalMode: (mode) => set({ approvalMode: mode }),

      clearSandbox: () =>
        set({
          sandboxChanges: [],
          pendingToolCalls: [],
          toolResults: [],
        }),

      // ── Computed ──
      getPendingChanges: () =>
        get().sandboxChanges.filter((c) => c.status === "pending"),

      getChangesByToolCall: (toolCallId) =>
        get().sandboxChanges.filter((c) => c.toolCallId === toolCallId),

      getMergedFiles: (realFiles) => {
        const merged = { ...realFiles }
        const changes = get().sandboxChanges

        for (const change of changes) {
          // Only apply pending or approved changes to the preview
          if (change.status === "rejected") continue

          switch (change.type) {
            case "create":
            case "edit":
            case "copy":
              if (change.newContent !== undefined) {
                const targetPath = change.type === "copy" && change.newPath
                  ? change.newPath
                  : change.path
                merged[targetPath] = change.newContent
              }
              break
            case "delete":
              delete merged[change.path]
              break
            case "rename":
            case "move":
              if (change.newPath) {
                const content = merged[change.path] ?? change.originalContent ?? ""
                delete merged[change.path]
                merged[change.newPath] = change.newContent ?? content
              }
              break
          }
        }

        return merged
      },
    }),
    {
      name: "agent-tool-store",
      version: 2,
      // Only persist the approval mode preference, not the volatile sandbox
      partialize: (state) => ({
        approvalMode: state.approvalMode,
      }),
      migrate: (persistedState: any, version: number) => {
        // Migrate old default behavior to auto_execute so existing users
        // do not remain stuck on ask_every_time after this release.
        if (version < 2) {
          const currentMode = persistedState?.approvalMode
          if (!currentMode || currentMode === "ask_every_time") {
            return { ...persistedState, approvalMode: "auto_execute" }
          }
        }
        return persistedState
      },
    }
  )
)
