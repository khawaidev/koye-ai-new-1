import { ArrowUp, File, FolderClosed, Mic, Plus, Square, X, Paperclip, AtSign, Film, FileText } from "lucide-react"
import React, { useEffect, useRef, useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { cn } from "../../lib/utils"
import { useAppStore } from "../../store/useAppStore"
import { TaskBar } from "../tasks/TaskBar"
import { PixelImage } from "../ui/pixel-image"

interface ChatInputProps {
  onSend: (message: string, images: File[], mentionedFiles?: string[]) => void
  onStop?: () => void
  disabled?: boolean
  isGenerating?: boolean
}

interface FileMention {
  path: string
  name: string
  type: 'file' | 'folder'
}

export function ChatInput({ onSend, onStop, disabled, isGenerating }: ChatInputProps) {
  const { currentProject, generatedFiles } = useAppStore()
  const [images, setImages] = useState<File[]>([])
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [suggestionSearch, setSuggestionSearch] = useState("")
  const [selectedSuggestionIndex, setSelectedSuggestionIndex] = useState(0)
  const [showPlusMenu, setShowPlusMenu] = useState(false)

  const fileInputRef = useRef<HTMLInputElement>(null)
  const editorRef = useRef<HTMLDivElement>(null)
  const suggestionsRef = useRef<HTMLDivElement>(null)
  const plusMenuRef = useRef<HTMLDivElement>(null)

  // Get available files and folders from project
  const availableFiles = React.useMemo(() => {
    if (!currentProject || !generatedFiles) {
      console.log('[ChatInput] No files available - currentProject:', !!currentProject, 'generatedFiles:', !!generatedFiles)
      return []
    }

    const fileKeys = Object.keys(generatedFiles)
    console.log('[ChatInput] Available files for autocomplete:', fileKeys)

    const files = fileKeys.map(path => ({
      path,
      name: path.split('/').pop() || path,
      type: 'file' as const
    }))

    // Extract folders
    const folders = new Set<string>()
    fileKeys.forEach(path => {
      const parts = path.split('/')
      // Add all parent directories
      for (let i = 0; i < parts.length - 1; i++) {
        const folderPath = parts.slice(0, i + 1).join('/')
        folders.add(folderPath)
      }
    })

    const folderItems = Array.from(folders).map(path => ({
      path,
      name: path.split('/').pop() || path,
      type: 'folder' as const
    }))

    return [...folderItems, ...files]
  }, [currentProject, generatedFiles])

  // Filter files based on search
  const filteredFiles = React.useMemo(() => {
    if (!suggestionSearch) return availableFiles
    const search = suggestionSearch.toLowerCase()
    return availableFiles.filter(item =>
      item.name.toLowerCase().includes(search) ||
      item.path.toLowerCase().includes(search)
    )
  }, [availableFiles, suggestionSearch])

  const handleSend = () => {
    if (!editorRef.current) return

    // Extract text and mentions
    const clone = editorRef.current.cloneNode(true) as HTMLDivElement
    const mentions: string[] = []

    // Find all mention chips
    const chips = clone.querySelectorAll('.mention-chip')
    chips.forEach((chip) => {
      const path = chip.getAttribute('data-path')
      if (path) {
        mentions.push(path)
        // Replace chip with just the text representation for the message
        chip.textContent = `@${path} `
      }
    })

    const textContent = clone.textContent || ""

    if (textContent.trim() || images.length > 0 || mentions.length > 0) {
      onSend(textContent, images, mentions)

      // Clear editor
      editorRef.current.innerHTML = ""
      setImages([])
      setShowSuggestions(false)
      setSuggestionSearch("")
    }
  }

  // Helper: get all text before the cursor position in the contentEditable
  const getTextBeforeCursor = (): string | null => {
    const selection = window.getSelection()
    if (!selection || selection.rangeCount === 0 || !editorRef.current) return null

    const range = selection.getRangeAt(0)

    // Create a range from start of editor to current cursor
    const preRange = document.createRange()
    preRange.selectNodeContents(editorRef.current)
    preRange.setEnd(range.startContainer, range.startOffset)

    // Walk through all child nodes in the pre-range and collect text
    // This handles cases where contentEditable splits text across multiple nodes
    const fragment = preRange.cloneContents()
    const walker = document.createTreeWalker(fragment, NodeFilter.SHOW_TEXT)
    let fullText = ''
    while (walker.nextNode()) {
      fullText += walker.currentNode.textContent || ''
    }

    return fullText
  }

  const handleInput = () => {
    if (!editorRef.current) return

    const textBeforeCursor = getTextBeforeCursor()
    if (textBeforeCursor === null) return

    // Check for @ mention trigger - look for the last unmatched @
    const lastAt = textBeforeCursor.lastIndexOf('@')

    if (lastAt !== -1 && currentProject) {
      const query = textBeforeCursor.substring(lastAt + 1)
      // If there's a space, stop suggesting
      if (!query.includes(' ')) {
        setSuggestionSearch(query)
        setShowSuggestions(true)
        setSelectedSuggestionIndex(0)
        return
      }
    }

    setShowSuggestions(false)
  }

  const insertMention = (file: FileMention) => {
    if (!editorRef.current) return

    const selection = window.getSelection()
    if (!selection || selection.rangeCount === 0) return

    const range = selection.getRangeAt(0)
    const textNode = range.startContainer

    // Find the @ symbol and replace it
    if (textNode.nodeType === Node.TEXT_NODE) {
      const text = textNode.textContent || ""
      const cursorOffset = range.startOffset
      const lastAt = text.substring(0, cursorOffset).lastIndexOf('@')

      if (lastAt !== -1) {
        // Create the chip element
        const chip = document.createElement('span')
        chip.className = 'mention-chip inline-flex items-center gap-1 bg-blue-100 border border-blue-500 rounded px-1 text-blue-700 font-bold mx-1 select-none'
        chip.contentEditable = 'false'
        chip.setAttribute('data-path', file.path)
        chip.innerHTML = `@${file.name} <span class="mention-remove cursor-pointer hover:text-red-600 ml-0.5 opacity-0 transition-opacity">×</span>`

        // Add hover effect for remove button via CSS class or inline style
        // We'll use a global style or inline style for simplicity
        const style = document.createElement('style')
        style.textContent = `
          .mention-chip:hover .mention-remove { opacity: 1 !important; }
        `
        if (!document.getElementById('mention-styles')) {
          style.id = 'mention-styles'
          document.head.appendChild(style)
        }

        // Split the text node
        const afterText = text.substring(cursorOffset)
        const beforeText = text.substring(0, lastAt)

        const afterNode = document.createTextNode(afterText + '\u00A0') // Add nbsp
        const beforeNode = document.createTextNode(beforeText)

        const parent = textNode.parentNode
        if (parent) {
          parent.insertBefore(beforeNode, textNode)
          parent.insertBefore(chip, textNode)
          parent.insertBefore(afterNode, textNode)
          parent.removeChild(textNode)

          // Move cursor after the chip
          const newRange = document.createRange()
          newRange.setStart(afterNode, 1) // After the nbsp
          newRange.setEnd(afterNode, 1)
          selection.removeAllRanges()
          selection.addRange(newRange)
        }
      }
    }

    setShowSuggestions(false)
    setSuggestionSearch("")
    editorRef.current.focus()
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (showSuggestions && filteredFiles.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setSelectedSuggestionIndex((prev) =>
          prev < filteredFiles.length - 1 ? prev + 1 : prev
        )
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        setSelectedSuggestionIndex((prev) => prev > 0 ? prev - 1 : 0)
      } else if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault()
        insertMention(filteredFiles[selectedSuggestionIndex])
        return
      } else if (e.key === 'Escape') {
        setShowSuggestions(false)
        return
      }
    }

    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  // Handle removing chips
  const handleEditorClick = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement
    if (target.classList.contains('mention-remove')) {
      const chip = target.closest('.mention-chip')
      if (chip) {
        chip.remove()
      }
    }
  }

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    setImages((prev) => [...prev, ...files])
  }

  const removeImage = (index: number) => {
    setImages((prev) => prev.filter((_, i) => i !== index))
  }

  // Close suggestions when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (suggestionsRef.current && !suggestionsRef.current.contains(event.target as Node)) {
        setShowSuggestions(false)
      }
      if (plusMenuRef.current && !plusMenuRef.current.contains(event.target as Node)) {
        setShowPlusMenu(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const triggerMentionMenu = () => {
    setShowPlusMenu(false)
    if (!editorRef.current) return
    editorRef.current.focus()

    // Insert @ at current cursor
    const selection = window.getSelection()
    if (selection && selection.rangeCount > 0) {
      const range = selection.getRangeAt(0)
      const textNode = document.createTextNode('@')
      range.insertNode(textNode)
      range.setStartAfter(textNode)
      range.setEndAfter(textNode)
      selection.removeAllRanges()
      selection.addRange(range)
    } else {
      editorRef.current.innerText += '@'
    }

    // Programmatically trigger the suggestions dropdown showing all files instantly
    setSuggestionSearch("")
    setShowSuggestions(true)
    setSelectedSuggestionIndex(0)
  }

  return (
    <div className="space-y-2 mb-[15px]">
      {images.length > 0 && (
        <div className="flex gap-2 overflow-x-auto pb-1">
          {images.map((img, idx) => {
            const isImage = img.type.startsWith('image/')
            const isVideo = img.type.startsWith('video/')
            
            return (
              <div key={idx} className="relative shrink-0 group flex flex-col items-center">
                {isImage ? (
                  <PixelImage
                    src={URL.createObjectURL(img)}
                    alt={`Preview ${idx + 1}`}
                    className="h-16 w-16 rounded-lg border border-black shadow-md object-cover"
                  />
                ) : (
                  <div className="h-16 w-16 rounded-lg border border-black shadow-md flex flex-col items-center justify-center bg-muted/80 text-muted-foreground p-1">
                    {isVideo ? <Film className="h-6 w-6 mb-1 text-foreground" /> : <FileText className="h-6 w-6 mb-1 text-foreground" />}
                    <span className="text-[8px] font-mono leading-tight truncate w-full text-center tracking-tighter" title={img.name}>{img.name}</span>
                  </div>
                )}
                <button
                  onClick={() => removeImage(idx)}
                  className="absolute -right-1 -top-1 rounded-full bg-background border border-border p-1 shadow-lg hover:bg-muted transition-all opacity-0 group-hover:opacity-100"
                >
                  <X className="h-3 w-3 text-foreground" />
                </button>
              </div>
            )
          })}
        </div>
      )}

      {/* Task Bar (drop-up above input) */}
      <TaskBar />

      {/* Main Input Bar */}
      <div className="relative flex items-center">
        <div className="flex-1 relative">
          {/* Modern input bar with send button inside */}
          <div className="flex items-center gap-3 bg-background border border-border px-4 py-2.5 min-h-[52px] rounded-full shadow-sm focus-within:border-foreground/40 focus-within:shadow-md transition-all">
            {/* Plus Icon on left */}
            <div className="relative" ref={plusMenuRef}>
              <button
                onClick={() => setShowPlusMenu(!showPlusMenu)}
                disabled={disabled || isGenerating}
                className={cn(
                  "shrink-0 flex items-center justify-center w-8 h-8 rounded-full transition-colors disabled:opacity-50",
                  showPlusMenu ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                )}
                aria-label="Add attachment"
              >
                <Plus className={cn("h-5 w-5 transition-transform", showPlusMenu && "rotate-45")} />
              </button>

              <AnimatePresence>
                {showPlusMenu && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.95, y: 10 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95, y: 10 }}
                    transition={{ duration: 0.15 }}
                    className="absolute bottom-full left-0 mb-2 w-48 bg-background border border-border shadow-lg rounded-xl overflow-hidden z-50 py-1"
                  >
                    <button
                      onClick={() => {
                        fileInputRef.current?.click()
                        setShowPlusMenu(false)
                      }}
                      className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-foreground hover:bg-muted transition-colors text-left"
                    >
                      <Paperclip className="h-4 w-4" />
                      <span>Upload from Device</span>
                    </button>
                    {currentProject && (
                      <button
                        onClick={triggerMentionMenu}
                        className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-foreground hover:bg-muted transition-colors text-left"
                      >
                        <AtSign className="h-4 w-4" />
                        <span>Mention Project File</span>
                      </button>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            <input
              ref={fileInputRef}
              type="file"
              accept="image/*,video/*,text/*,.md,.js,.ts,.jsx,.tsx,.html,.css,.json,.py"
              multiple
              onChange={handleImageSelect}
              className="hidden"
            />

            {/* ContentEditable Input */}
            <div
              ref={editorRef}
              contentEditable={!disabled && !isGenerating}
              onInput={handleInput}
              onKeyDown={handleKeyDown}
              onClick={handleEditorClick}
              className="flex-1 bg-transparent border-0 outline-none text-foreground text-sm focus:ring-0 focus:outline-none break-all whitespace-pre-wrap max-h-[200px] overflow-y-auto"
              data-placeholder={currentProject ? "Describe your game idea.. or use @ to mention files" : "Describe your game idea.."}
              style={{ minHeight: '24px' }}
            />

            {/* Microphone Icon */}
            <button
              className="shrink-0 flex items-center justify-center w-8 h-8 rounded-full text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors disabled:opacity-50"
              disabled={disabled || isGenerating}
              aria-label="Voice input"
              onClick={() => {
                console.log("Voice input")
              }}
            >
              <Mic className="h-5 w-5" />
            </button>

            {/* Send/Stop button inside input */}
            {isGenerating ? (
              <button
                onClick={onStop}
                className="shrink-0 flex items-center justify-center w-8 h-8 rounded-full bg-red-500 hover:bg-red-600 active:bg-red-700 transition-all cursor-pointer"
                aria-label="Stop generation"
                type="button"
              >
                <Square className="h-3.5 w-3.5 text-white fill-white" />
              </button>
            ) : (
              <button
                onClick={handleSend}
                className="shrink-0 flex items-center justify-center w-8 h-8 rounded-full bg-foreground hover:opacity-90 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                aria-label="Send message"
              >
                <ArrowUp className="h-4 w-4 text-white dark:text-black" />
              </button>
            )}
          </div>

          {/* File Suggestions Dropdown */}
          {showSuggestions && currentProject && filteredFiles.length > 0 && (
            <div
              ref={suggestionsRef}
              className="absolute bottom-full left-0 right-0 mb-1 bg-background border-2 border-border shadow-lg max-h-48 overflow-y-auto z-50 rounded-xl"
            >
              {filteredFiles.map((file, index) => (
                <button
                  key={file.path}
                  onClick={() => insertMention(file)}
                  className={cn(
                    "w-full text-left px-3 py-2 text-sm flex items-center gap-2 border-b border-border/10 last:border-b-0 transition-colors",
                    index === selectedSuggestionIndex
                      ? "bg-foreground text-background"
                      : "hover:bg-muted text-foreground"
                  )}
                >
                  {file.type === 'folder'
                    ? <FolderClosed className="h-3.5 w-3.5 shrink-0" />
                    : <File className="h-3.5 w-3.5 shrink-0" />
                  }
                  <div className="flex-1 min-w-0">
                    <div className="font-bold truncate">{file.name}</div>
                    <div className="text-xs opacity-70 truncate">{file.path}</div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Styles for placeholder */}
      <style>{`
        [contenteditable]:empty:before {
          content: attr(data-placeholder);
          color: hsl(var(--muted-foreground));
          pointer-events: none;
        }
      `}</style>
    </div>
  )
}
