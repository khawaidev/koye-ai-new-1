import { useMemo } from "react"
import { cn } from "../../lib/utils"

interface CodeViewProps {
  files: Record<string, string> // path -> content
  selectedFile: string | null
  onSelectFile: (path: string) => void
}

export function CodeView({ files, selectedFile, onSelectFile }: CodeViewProps) {
  const selectedContent = useMemo(() => {
    if (!selectedFile || !files[selectedFile]) {
      return null
    }
    return files[selectedFile]
  }, [selectedFile, files])
  
  const fileExtension = useMemo(() => {
    if (!selectedFile) return ""
    const parts = selectedFile.split(".")
    return parts.length > 1 ? parts[parts.length - 1] : ""
  }, [selectedFile])
  
  // Determine language for syntax highlighting (basic)
  const language = useMemo(() => {
    const ext = fileExtension.toLowerCase()
    const langMap: Record<string, string> = {
      js: "javascript",
      jsx: "javascript",
      ts: "typescript",
      tsx: "typescript",
      py: "python",
      html: "html",
      css: "css",
      json: "json",
      md: "markdown",
      yml: "yaml",
      yaml: "yaml",
    }
    return langMap[ext] || "text"
  }, [fileExtension])
  
  if (!selectedFile || !selectedContent) {
    return (
      <div className="flex h-full items-center justify-center bg-white border-2 border-black">
        <div className="text-center text-black/50 font-mono">
          <p className="text-sm mb-2">No file selected</p>
          <p className="text-xs">Select a file from the sidebar to view its contents</p>
        </div>
      </div>
    )
  }
  
  return (
    <div className="flex h-full flex-col bg-white border-2 border-black">
      {/* File Header */}
      <div className="border-b border-black px-4 py-2 flex items-center justify-between shrink-0 bg-black/5">
        <div className="flex items-center gap-2">
          <span className="text-black font-mono text-xs font-bold">{selectedFile}</span>
          <span className="text-black/50 font-mono text-xs">({language})</span>
        </div>
      </div>
      
      {/* Code Content */}
      <div className="flex-1 overflow-auto p-4 bg-white">
        <pre className="font-mono text-sm text-black whitespace-pre-wrap">
          <code>{selectedContent}</code>
        </pre>
      </div>
    </div>
  )
}

