/**
 * ToolApprovalCard
 *
 * Rendered in the chat interface when the agent calls a file-modifying tool.
 * Shows a banner with:
 * - Tool type label
 * - Reject (✗) and Approve (✓) buttons
 * - Dropdown: "Ask every time" / "Execute every time"
 *
 * Below the banner, renders SandboxDiffCard for each affected file.
 */

import { AnimatePresence, motion } from "framer-motion"
import { Check, ChevronDown, File, FileMinus, FilePlus, Pencil, X } from "lucide-react"
import { useState } from "react"
import { useAgentToolStore } from "../../store/useAgentToolStore"
import type { SandboxChange, ToolApprovalMode } from "../../types/agentTools"
import { SandboxDiffCard } from "./SandboxDiffCard"

interface ToolApprovalCardProps {
  toolCallId: string
  toolName: string
  changes: SandboxChange[]
  onApprove: (toolCallId: string) => void
  onReject: (toolCallId: string) => void
}

const TOOL_LABELS: Record<string, string> = {
  create_file: "Create File",
  create_folder: "Create Folder",
  delete_file: "Delete File",
  delete_folder: "Delete Folder",
  edit_file: "Edit File",
  rename_file: "Rename File",
  move_file: "Move File",
  copy_file: "Copy File",
  replace_code: "Replace Code",
  search_codebase: "Search Codebase",
}

export function ToolApprovalCard({
  toolCallId,
  toolName,
  changes,
  onApprove,
  onReject,
}: ToolApprovalCardProps) {
  const { approvalMode, setApprovalMode, approveChange, rejectChange } = useAgentToolStore()
  const [showDropdown, setShowDropdown] = useState(false)
  const [isResolved, setIsResolved] = useState(false)
  const [resolution, setResolution] = useState<"approved" | "rejected" | null>(null)

  const label = TOOL_LABELS[toolName] ?? toolName
  const primary = changes[0]
  const primaryFileName = primary?.path?.split("/").pop() || primary?.path || label
  const PrimaryIcon =
    primary?.type === "create" ? FilePlus :
    primary?.type === "delete" ? FileMinus :
    primary?.type === "edit" ? Pencil :
    File

  const handleApprove = () => {
    setIsResolved(true)
    setResolution("approved")
    onApprove(toolCallId)
  }

  const handleReject = () => {
    setIsResolved(true)
    setResolution("rejected")
    onReject(toolCallId)
  }

  const handleApprovalModeChange = (mode: ToolApprovalMode) => {
    setApprovalMode(mode)
    setShowDropdown(false)
  }

  const handleIndividualApprove = (changeId: string) => {
    approveChange(changeId)
  }

  const handleIndividualReject = (changeId: string) => {
    rejectChange(changeId)
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -4, scale: 0.98 }}
      transition={{ duration: 0.25, ease: "easeOut" }}
      className="w-full my-3"
    >
      {/* ── Approval Banner ── */}
      <div className={`
        flex items-center gap-2.5 px-3 py-2 rounded-lg border transition-all
        ${isResolved
          ? resolution === "approved"
            ? "bg-green-500/5 border-green-500/20"
            : "bg-red-500/5 border-red-500/20"
          : "bg-muted/30 border-border hover:bg-muted/50"
        }
      `}>
        {/* File icon */}
        <div className={`
          flex items-center justify-center h-7 w-7 rounded-md shrink-0
          ${isResolved
            ? resolution === "approved"
              ? "bg-emerald-500/10 text-emerald-400/80"
              : "bg-rose-500/10 text-rose-400/80"
            : "bg-foreground/10 text-foreground/80"
          }
        `}>
          <PrimaryIcon className="h-4 w-4" />
        </div>

        {/* Filename (instead of "Let agent use ...") */}
        <div className="flex-1 min-w-0">
          <span className="text-sm font-medium text-foreground">
            {isResolved
              ? resolution === "approved"
                ? `✓ Approved`
                : `✗ Rejected`
              : `Pending`
            }
          </span>
          <span className="text-sm font-bold text-foreground truncate block" title={primary?.path || label}>
            {primaryFileName}
          </span>
        </div>

        {/* Actions */}
        {!isResolved && (
          <div className="flex items-center gap-2 shrink-0">
            {/* Reject button */}
            <button
              onClick={handleReject}
              className="flex items-center justify-center h-8 w-8 rounded-lg bg-transparent text-rose-400/70 hover:bg-rose-500/10 transition-all active:scale-95"
              title="Reject"
            >
              <X className="h-4 w-4" />
            </button>

            {/* Approve button */}
            <button
              onClick={handleApprove}
              className="flex items-center justify-center h-8 w-8 rounded-lg bg-transparent text-emerald-400/70 hover:bg-emerald-500/10 transition-all active:scale-95"
              title="Approve"
            >
              <Check className="h-4 w-4" />
            </button>

            {/* Approval mode dropdown */}
            <div className="relative">
              <button
                onClick={() => setShowDropdown(!showDropdown)}
                className="flex items-center gap-1.5 h-8 px-3 rounded-lg border border-border bg-background text-xs text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-all"
              >
                <span className="hidden sm:inline">
                  {approvalMode === "ask_every_time" ? "Ask every time" : "Auto execute"}
                </span>
                <ChevronDown className="h-3 w-3" />
              </button>

              <AnimatePresence>
                {showDropdown && (
                  <motion.div
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -4 }}
                    className="absolute right-0 top-full mt-1 z-50 bg-background border border-border rounded-lg shadow-xl overflow-hidden min-w-[170px]"
                  >
                    <button
                      onClick={() => handleApprovalModeChange("ask_every_time")}
                      className={`w-full text-left px-3 py-2.5 text-xs transition-colors ${
                        approvalMode === "ask_every_time"
                          ? "bg-muted text-foreground font-medium"
                          : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                      }`}
                    >
                      Ask every time
                    </button>
                    <button
                      onClick={() => handleApprovalModeChange("auto_execute")}
                      className={`w-full text-left px-3 py-2.5 text-xs transition-colors ${
                        approvalMode === "auto_execute"
                          ? "bg-muted text-foreground font-medium"
                          : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                      }`}
                    >
                      Execute every time
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        )}
      </div>

      {/* ── Per-File Diff Cards ── */}
      {changes.length > 0 && (
        <div className="mt-2 space-y-1.5">
          {changes.map((change) => (
            <SandboxDiffCard
              key={change.id}
              change={change}
              isResolved={isResolved}
              onApprove={() => handleIndividualApprove(change.id)}
              onReject={() => handleIndividualReject(change.id)}
            />
          ))}
        </div>
      )}
    </motion.div>
  )
}
