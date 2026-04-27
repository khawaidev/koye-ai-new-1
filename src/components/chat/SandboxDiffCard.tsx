/**
 * SandboxDiffCard
 *
 * Per-file change card shown within a ToolApprovalCard.
 * Displays: [filename] [+N green / -M red] [✗ reject] [✓ approve]
 *
 * Clicking the filename expands to show a basic diff view.
 */

import { motion } from "framer-motion"
import {
  Check,
  Code,
  File,
  FileMinus,
  FilePlus,
  Pencil,
  X,
} from "lucide-react"
import type { SandboxChange } from "../../types/agentTools"

interface SandboxDiffCardProps {
  change: SandboxChange
  isResolved: boolean
  onApprove: () => void
  onReject: () => void
}

function getChangeIcon(type: SandboxChange["type"]) {
  switch (type) {
    case "create":
      return <FilePlus className="h-3.5 w-3.5" />
    case "edit":
      return <Pencil className="h-3.5 w-3.5" />
    case "delete":
      return <FileMinus className="h-3.5 w-3.5" />
    case "rename":
    case "move":
      return <File className="h-3.5 w-3.5" />
    case "copy":
      return <Code className="h-3.5 w-3.5" />
    default:
      return <File className="h-3.5 w-3.5" />
  }
}

function getChangeColor(type: SandboxChange["type"]) {
  switch (type) {
    case "create":
    case "copy":
      return "text-green-500"
    case "delete":
      return "text-red-500"
    case "edit":
    case "rename":
    case "move":
      return "text-blue-500"
    default:
      return "text-muted-foreground"
  }
}

function getChangeBg(type: SandboxChange["type"]) {
  switch (type) {
    case "create":
    case "copy":
      return "bg-green-500/10"
    case "delete":
      return "bg-red-500/10"
    case "edit":
    case "rename":
    case "move":
      return "bg-blue-500/10"
    default:
      return "bg-muted/30"
  }
}

export function SandboxDiffCard({
  change,
  isResolved,
  onApprove,
  onReject,
}: SandboxDiffCardProps) {
  const fileName = change.path.split("/").pop() || change.path
  const statusColor = getChangeColor(change.type)
  const statusBg = getChangeBg(change.type)
  const icon = getChangeIcon(change.type)

  const isIndividuallyResolved =
    isResolved || change.status === "approved" || change.status === "rejected"

  return (
    <motion.div
      initial={{ opacity: 0, x: -4 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.2 }}
      className={`
        rounded-lg border overflow-hidden transition-all
        ${isIndividuallyResolved
          ? change.status === "approved"
            ? "border-green-500/20 bg-green-500/5"
            : change.status === "rejected"
              ? "border-red-500/20 bg-red-500/5 opacity-60"
              : "border-border bg-background"
          : "border-border bg-background hover:bg-muted/20"
        }
      `}
    >
      {/* ── Compact Row (no content dropdown) ── */}
      <div className="flex items-center gap-2 px-3 py-2">
        {/* File type icon */}
        <div className={`shrink-0 p-1 rounded ${statusBg} ${statusColor}`}>
          {icon}
        </div>

        {/* File name */}
        <div className="flex-1 text-left min-w-0">
          <span className="text-xs font-mono font-medium text-foreground truncate block" title={change.path}>
            {fileName}
          </span>
          {change.newPath && (
            <span className="text-[10px] text-muted-foreground truncate block" title={change.newPath}>
              → {change.newPath.split("/").pop()}
            </span>
          )}
        </div>

        {/* Lines changed */}
        <div className="flex items-center gap-1.5 shrink-0 text-[11px] font-mono">
          {change.linesAdded > 0 && (
            <span className="text-emerald-400/70 font-medium">+{change.linesAdded}</span>
          )}
          {change.linesRemoved > 0 && (
            <span className="text-rose-400/70 font-medium">-{change.linesRemoved}</span>
          )}
          {change.linesAdded === 0 && change.linesRemoved === 0 && change.type !== "delete" && (
            <span className="text-muted-foreground">~0</span>
          )}
        </div>

        {/* Individual approve/reject (only when parent is not resolved) */}
        {!isResolved && change.status === "pending" && (
          <div className="flex items-center gap-1 shrink-0 ml-1">
            <button
              onClick={onReject}
              className="flex items-center justify-center h-6 w-6 rounded text-rose-400/70 hover:bg-rose-500/10 transition-all active:scale-90"
              title="Reject this file"
            >
              <X className="h-3 w-3" />
            </button>
            <button
              onClick={onApprove}
              className="flex items-center justify-center h-6 w-6 rounded text-emerald-400/70 hover:bg-emerald-500/10 transition-all active:scale-90"
              title="Approve this file"
            >
              <Check className="h-3 w-3" />
            </button>
          </div>
        )}

        {/* Resolved status label */}
        {isIndividuallyResolved && (
          <span className={`text-[10px] font-medium shrink-0 ${
            change.status === "approved" ? "text-green-500" : "text-red-400"
          }`}>
            {change.status === "approved" ? "Approved" : "Rejected"}
          </span>
        )}
      </div>
    </motion.div>
  )
}
