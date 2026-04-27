import {
  FilePlus,
  Edit3,
  Trash2,
  Image as ImageIcon,
  FileCode2,
  FileText,
  FileJson2,
  FileType2,
  FileAudio2,
  FileVideo2,
} from "lucide-react"
import { cn } from "../../lib/utils"

export interface FileOperation {
  type: 'create' | 'edit' | 'delete' | 'edit-image'
  path: string
  content?: string
  linesAdded?: number
  linesRemoved?: number
  prompt?: string
  model?: string
}

interface FileOperationCardProps {
  operation: FileOperation
}

export function FileOperationCard({ operation }: FileOperationCardProps) {
  const fileName = operation.path.split("/").pop() || operation.path
  const ext = (fileName.split(".").pop() || "").toLowerCase()
  const isImage = operation.type === 'edit-image' || /\.(png|jpe?g|gif|webp|svg)$/i.test(operation.path)
  const isVideo = /\.(mp4|webm|mov|mkv)$/i.test(operation.path)
  const isAudio = /\.(mp3|wav|ogg|flac|m4a|aac)$/i.test(operation.path)

  const ActionIcon =
    operation.type === "create" ? FilePlus :
    operation.type === "delete" ? Trash2 :
    operation.type === "edit-image" ? ImageIcon :
    operation.type === "edit" ? Edit3 :
    FileText

  const FileTypeIcon =
    isImage ? ImageIcon :
    isVideo ? FileVideo2 :
    isAudio ? FileAudio2 :
    ext === "json" ? FileJson2 :
    ["ts", "tsx", "js", "jsx", "py", "rs", "go", "java", "cpp", "c", "cs", "gd", "lua", "sql", "html", "css"].includes(ext) ? FileCode2 :
    ["md", "txt"].includes(ext) ? FileType2 :
    FileText

  const linesAdded = operation.linesAdded ?? (operation.content ? operation.content.split("\n").length : 0)
  const linesRemoved = operation.linesRemoved ?? 0

  return (
    <div
      className={cn(
        "flex items-center gap-2.5 px-3 py-2 rounded-lg border border-border bg-muted/20",
        "w-full font-mono text-xs transition-colors",
        "hover:bg-muted/30"
      )}
    >
      <div
        className={cn(
          "h-7 w-7 rounded-md flex items-center justify-center shrink-0",
          operation.type === "create" ? "bg-emerald-500/10 text-emerald-400/80"
          : operation.type === "delete" ? "bg-rose-500/10 text-rose-400/80"
          : operation.type === "edit-image" ? "bg-violet-500/10 text-violet-400/80"
          : "bg-sky-500/10 text-sky-400/80"
        )}
        title={operation.type}
      >
        <ActionIcon className="h-4 w-4" />
      </div>

      <div className="flex items-center gap-2 min-w-0 flex-1">
        <FileTypeIcon className="h-4 w-4 text-muted-foreground shrink-0" />
        <span className="truncate text-foreground/90" title={operation.path}>
          {fileName}
        </span>
      </div>

      <div className="flex items-center gap-2 shrink-0 tabular-nums">
        {linesAdded > 0 && (
          <span className="text-emerald-400/70 font-medium">+{linesAdded}</span>
        )}
        {linesRemoved > 0 && (
          <span className="text-rose-400/70 font-medium">-{linesRemoved}</span>
        )}
        {linesAdded === 0 && linesRemoved === 0 && (
          <span className="text-muted-foreground/70">~0</span>
        )}
      </div>
    </div>
  )
}
