import { useState, useMemo, useEffect, useRef } from "react"
import { Save, X } from "lucide-react"
import { detectFileType, getFileExtension } from "../../utils/fileTypeDetection"
import { useAppStore } from "../../store/useAppStore"
import { useAuth } from "../../hooks/useAuth"
import { Button } from "../ui/button"

interface CodeViewerProps {
  content: string
  fileName: string
  path?: string
}

export function CodeViewer({ content: initialContent, fileName, path }: CodeViewerProps) {
  const filePath = path || fileName
  const { addGeneratedFile, generatedFiles, currentProject, githubConnection } = useAppStore()
  const { user } = useAuth()
  const [editedContent, setEditedContent] = useState(initialContent)
  const [isDirty, setIsDirty] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const initialContentRef = useRef(initialContent)

  // Update content when initialContent changes (file selection changed)
  useEffect(() => {
    initialContentRef.current = initialContent
    setEditedContent(initialContent)
    setIsDirty(false)
  }, [initialContent, filePath])

  // Also update if the file content changes in the store (from external save)
  useEffect(() => {
    if (filePath && generatedFiles[filePath]) {
      const storeContent = generatedFiles[filePath]
      // Only update if we're not currently editing and content differs
      if (!isDirty && storeContent !== initialContentRef.current) {
        initialContentRef.current = storeContent
        setEditedContent(storeContent)
      }
    }
  }, [generatedFiles, filePath, isDirty])

  const fileType = useMemo(() => detectFileType(filePath), [filePath])
  const extension = useMemo(() => getFileExtension(filePath), [filePath])

  // Map extensions to language names for display
  const language = useMemo(() => {
    const ext = extension.toLowerCase()
    const langMap: Record<string, string> = {
      js: "JavaScript",
      jsx: "JSX",
      ts: "TypeScript",
      tsx: "TSX",
      py: "Python",
      java: "Java",
      cpp: "C++",
      c: "C",
      h: "C Header",
      hpp: "C++ Header",
      cs: "C#",
      go: "Go",
      rs: "Rust",
      rb: "Ruby",
      php: "PHP",
      swift: "Swift",
      kt: "Kotlin",
      dart: "Dart",
      r: "R",
      scala: "Scala",
      clj: "Clojure",
      hs: "Haskell",
      vue: "Vue",
      svelte: "Svelte",
      html: "HTML",
      css: "CSS",
      scss: "SCSS",
      sass: "SASS",
      less: "Less",
      json: "JSON",
      xml: "XML",
      yaml: "YAML",
      yml: "YAML",
      toml: "TOML",
      ini: "INI",
      sh: "Shell",
      bash: "Bash",
      sql: "SQL",
      graphql: "GraphQL",
      gql: "GraphQL",
      lua: "Lua",
      md: "Markdown",
      markdown: "Markdown",
      txt: "Plain Text",
      log: "Log",
      dockerfile: "Dockerfile",
      makefile: "Makefile",
      cmake: "CMake",
      gitignore: "Git Ignore",
      gitattributes: "Git Attributes"
    }
    return langMap[ext] || ext.toUpperCase() || "Text"
  }, [extension])

  // Count lines for display
  const lineCount = useMemo(() => {
    return editedContent.split('\n').length
  }, [editedContent])

  // Handle content change
  const handleContentChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newContent = e.target.value
    setEditedContent(newContent)
    setIsDirty(newContent !== initialContentRef.current)
  }

  // Handle save
  const handleSave = async () => {
    if (!filePath) return

    addGeneratedFile(filePath, editedContent)
    initialContentRef.current = editedContent
    setIsDirty(false)

    // Update the selectedAsset in store to reflect the change
    const { setSelectedAsset, selectedAsset } = useAppStore.getState()
    if (selectedAsset && (selectedAsset as any).path === filePath) {
      setSelectedAsset({
        ...selectedAsset,
        content: editedContent
      } as any)
    }

    // Also save to project if connected
    if (currentProject && user) {
      try {
        const { saveSingleProjectFile } = await import("../../services/projectFiles")
        await saveSingleProjectFile(
          currentProject.id,
          user.id,
          currentProject.name,
          filePath,
          editedContent,
          githubConnection
        )
        console.log(`Saved file ${filePath} to project: ${currentProject.name}`)
      } catch (error) {
        console.error("Error saving file to project:", error)
      }
    }
  }

  // Handle keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Only handle if textarea is focused or no input is focused
      if (document.activeElement?.tagName === 'INPUT' && document.activeElement !== textareaRef.current) {
        return
      }

      // Ctrl+S or Cmd+S to save
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault()
        if (isDirty && filePath) {
          handleSave()
        }
      }

      // Escape to cancel (revert changes) - only if textarea is focused
      if (e.key === 'Escape' && isDirty && document.activeElement === textareaRef.current) {
        if (confirm('Discard changes?')) {
          setEditedContent(initialContentRef.current)
          setIsDirty(false)
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isDirty, editedContent, initialContent, filePath])

  // Format content with line numbers for display
  const formattedContent = useMemo(() => {
    const lines = editedContent.split('\n')
    return lines.map((line, index) => ({
      number: index + 1,
      content: line
    }))
  }, [editedContent])

  return (
    <div className="flex h-full flex-col bg-background border-2 border-border font-mono">
      {/* File Header */}
      <div className="border-b-2 border-border px-4 py-2 flex items-center justify-between shrink-0 bg-muted/50">
        <div className="flex items-center gap-3">
          <span className="text-foreground font-mono text-xs font-bold">{fileName}</span>
          {language && (
            <span className="text-muted-foreground font-mono text-xs px-2 py-0.5 bg-muted/30 rounded">
              {language}
            </span>
          )}
          {isDirty && (
            <span className="text-orange-600 font-mono text-xs px-2 py-0.5 bg-orange-50 rounded border border-orange-200">
              • unsaved
            </span>
          )}
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-4 text-muted-foreground font-mono text-xs">
            <span>{lineCount} lines</span>
            <span>{editedContent.length} chars</span>
          </div>
          {isDirty && filePath && (
            <div className="flex items-center gap-2 ml-4">
              <Button
                onClick={handleSave}
                className="bg-foreground text-background hover:bg-muted-foreground font-mono text-xs font-bold px-3 py-1.5 border-2 border-border shadow-[2px_2px_0px_0px_currentColor] hover:shadow-[1px_1px_0px_0px_currentColor] transition-all"
                title="Save (Ctrl+S)"
              >
                <Save className="h-3.5 w-3.5 mr-1.5" />
                SAVE
              </Button>
              <Button
                onClick={() => {
                  if (confirm('Discard changes?')) {
                    setEditedContent(initialContentRef.current)
                    setIsDirty(false)
                  }
                }}
                variant="outline"
                className="border-2 border-border bg-background text-foreground hover:bg-muted font-mono text-xs font-bold px-3 py-1.5 shadow-[2px_2px_0px_0px_currentColor] hover:shadow-[1px_1px_0px_0px_currentColor] transition-all"
                title="Discard (Esc)"
              >
                <X className="h-3.5 w-3.5" />
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Code Editor with Line Numbers */}
      <div className="flex-1 overflow-hidden bg-background relative">
        <div className="absolute inset-0 flex overflow-auto">
          {/* Line Numbers */}
          <div className="sticky left-0 bg-muted/50 border-r-2 border-border px-3 py-2 text-right text-muted-foreground font-mono text-xs select-none z-10">
            {formattedContent.map((line) => (
              <div key={line.number} className="leading-6">
                {line.number}
              </div>
            ))}
          </div>

          {/* Code Editor */}
          <div className="flex-1 relative">
            <textarea
              ref={textareaRef}
              value={editedContent}
              onChange={handleContentChange}
              className="absolute inset-0 w-full h-full px-4 py-2 font-mono text-sm text-foreground bg-transparent resize-none outline-none leading-6 whitespace-pre-wrap break-words"
              style={{
                fontFamily: 'monospace',
                tabSize: 2,
              }}
              spellCheck={false}
              placeholder="Start typing..."
            />
            {/* Overlay for line number alignment - invisible but maintains spacing */}
            <div className="absolute inset-0 px-4 py-2 pointer-events-none font-mono text-sm leading-6 whitespace-pre-wrap break-words text-transparent">
              {formattedContent.map((line, index) => (
                <div key={index} className="min-h-[1.5rem]">
                  {line.content || '\u00A0'}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Footer with hints */}
      {isDirty && (
        <div className="border-t-2 border-border px-4 py-2 bg-muted/50 text-muted-foreground font-mono text-xs">
          <span>Press <kbd className="px-1.5 py-0.5 bg-muted border border-border rounded">Ctrl+S</kbd> to save, <kbd className="px-1.5 py-0.5 bg-muted border border-border rounded">Esc</kbd> to discard</span>
        </div>
      )}
    </div>
  )
}
