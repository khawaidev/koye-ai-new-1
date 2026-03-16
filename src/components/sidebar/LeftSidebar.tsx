import { Bone, Box, File, Folder, Image, MessageSquare, Music, Pen, Plus, Trash2, User, Video, X } from "lucide-react"
import React, { useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"
import appIconLight from "../../assets/icon.jpg"
import appIconDark from "../../assets/icon.png"
import { cn } from "../../lib/utils"
import { recordSessionToProjectContext } from "../../services/projectContext"
import { useAppStore } from "../../store/useAppStore"
import { useGameDevStore } from "../../store/useGameDevStore"
import { useTheme } from "../theme-provider"
import { Button } from "../ui/button"
import { ThemeToggle } from "../ui/theme-toggle"
import { FileSystemSidebar } from "./FileSystemSidebar"

type WorkflowStage = "chat" | "images" | "model" | "texture" | "rig" | "animate" | "audio" | "export" | "build" | "imageGeneration" | "videoGeneration" | "audioGeneration" | "model3DGeneration" | "sprites"

interface LeftSidebarProps {
  isOpen: boolean
  stage?: WorkflowStage
  setStage?: (stage: WorkflowStage) => void
  onToggleSidebar?: () => void
}

// Navigation items for the icon sidebar
const navItems = [
  { id: "chat" as WorkflowStage, icon: MessageSquare, label: "Chat" },
  { id: "imageGeneration" as WorkflowStage, icon: Image, label: "Image Gen" },
  { id: "videoGeneration" as WorkflowStage, icon: Video, label: "Video Gen" },
  { id: "audioGeneration" as WorkflowStage, icon: Music, label: "Audio Gen" },
  { id: "model3DGeneration" as WorkflowStage, icon: Box, label: "3D Model" },
]

export function LeftSidebar({ isOpen, stage, setStage, onToggleSidebar }: LeftSidebarProps) {
  const { theme } = useTheme()
  const navigate = useNavigate()
  const {
    sessions,
    currentSessionId,
    createNewSession,
    switchSession,
    deleteSession,
    leftSidebarMode,
    generatedFiles,
    images,
    currentModel,
    selectedAsset,
    setSelectedAsset,
    currentProject,
    setCurrentProject
  } = useAppStore()

  const {
    saveProjectState,
    clearActiveState
  } = useGameDevStore()

  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [sessionToDelete, setSessionToDelete] = useState<string | null>(null)
  const [sessionTitle, setSessionTitle] = useState<string>("")
  const [selectedFile, setSelectedFile] = useState<string | null>(null)

  const handleDisconnectProject = (e?: React.MouseEvent) => {
    if (e) {
      e.stopPropagation()
    }
    if (currentProject && currentSessionId) {
      saveProjectState(currentProject.id)
      const currentSession = useAppStore.getState().sessions.find(s => s.id === currentSessionId)
      if (currentSession && currentSession.messages.length > 0) {
        recordSessionToProjectContext(
          currentProject.id,
          currentProject.name,
          currentSessionId,
          currentSession.title,
          currentSession.messages.map(m => ({ role: m.role, content: m.content }))
        )
      }
      localStorage.removeItem(`project_${currentSessionId}`)
      localStorage.removeItem(`chat_project_sync_${currentSessionId}`)
      setCurrentProject(null)
      clearActiveState()
    }
  }

  const handleNewChat = () => {
    createNewSession()
    if (setStage) setStage("chat")
  }

  const handleDeleteClick = (e: React.MouseEvent, chatId: string) => {
    e.stopPropagation()
    const session = sessions.find(s => s.id === chatId)
    setSessionToDelete(chatId)
    setSessionTitle(session?.title || "this chat")
    setShowDeleteConfirm(true)
  }

  const handleConfirmDelete = () => {
    if (sessionToDelete) {
      deleteSession(sessionToDelete)
      setShowDeleteConfirm(false)
      setSessionToDelete(null)
      setSessionTitle("")
    }
  }

  const handleCancelDelete = () => {
    setShowDeleteConfirm(false)
    setSessionToDelete(null)
    setSessionTitle("")
  }

  const handleSessionClick = (sessionId: string) => {
    if (sessionId !== currentSessionId) {
      switchSession(sessionId)
    }
  }

  // Sync selectedFile with selectedAsset to ensure toggle and play button are visible
  useEffect(() => {
    if (leftSidebarMode === "file" && selectedFile) {
      const currentAssetPath = (selectedAsset as any)?.path
      if (currentAssetPath === selectedFile) {
        if (!selectedAsset) {
          // Force update below
        } else {
          return
        }
      }

      const fileName = selectedFile.split('/').pop() || selectedFile

      if (generatedFiles[selectedFile]) {
        const assetData = {
          name: fileName,
          path: selectedFile,
          type: 'code',
          content: generatedFiles[selectedFile]
        }
        setSelectedAsset(assetData as any)
        return
      }

      const image = images.find((img, index) => {
        const imageName = `image_${index + 1}_${img.view}.png`
        const imagePath = `assets/images/${imageName}`
        return selectedFile === imagePath ||
          selectedFile.includes(imageName) ||
          selectedFile.endsWith(`/${imageName}`)
      })
      if (image) {
        const assetData = {
          ...image,
          name: fileName,
          path: selectedFile,
          type: 'image'
        }
        setSelectedAsset(assetData as any)
        return
      }

      if (currentModel && (selectedFile.includes('model') || selectedFile.includes('.glb') || selectedFile.includes('.obj'))) {
        const assetData = {
          ...currentModel,
          name: fileName,
          path: selectedFile,
          type: 'model'
        }
        setSelectedAsset(assetData as any)
        return
      }

      const assetData = {
        name: fileName,
        path: selectedFile,
        type: 'file'
      }
      setSelectedAsset(assetData as any)
    }
  }, [leftSidebarMode, selectedFile, selectedAsset, generatedFiles, images, currentModel, setSelectedAsset])

  return (
    <div className="flex h-full">
      {/* Icon Rail - Always visible (Grok-style) */}
      <div className="flex flex-col items-center w-[52px] bg-background border-r border-border/50 py-3 gap-1 shrink-0">
        {/* Logo at top */}
        <button
          onClick={onToggleSidebar}
          className="flex items-center justify-center w-9 h-9 rounded-lg hover:bg-muted/50 transition-colors mb-3"
          title={isOpen ? "Close Sidebar" : "Open Sidebar"}
        >
          <img
            src={theme === "dark" ? appIconDark : appIconLight}
            alt="KOYE"
            className="h-7 w-7 rounded-full object-cover"
          />
        </button>

        {/* New Chat */}
        <button
          onClick={handleNewChat}
          className="flex items-center justify-center w-9 h-9 rounded-lg hover:bg-muted/50 transition-colors text-muted-foreground hover:text-foreground mb-1"
          title="New Chat"
        >
          <Pen className="h-[18px] w-[18px]" />
        </button>

        {/* Nav Items */}
        {navItems.map((item) => {
          const Icon = item.icon
          const isActive = stage === item.id
          return (
            <button
              key={item.id}
              onClick={() => setStage?.(item.id)}
              className={cn(
                "flex items-center justify-center w-9 h-9 rounded-lg transition-colors",
                isActive
                  ? "bg-foreground text-white dark:text-black shadow-md"
                  : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
              )}
              title={item.label}
            >
              <Icon className="h-[18px] w-[18px]" />
            </button>
          )
        })}

        {/* Animation Library */}
        <button
          onClick={() => {
            navigate("/animations")
          }}
          className={cn(
            "flex items-center justify-center w-9 h-9 rounded-lg transition-colors",
            "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
          )}
          title="Animation Library"
        >
          <Bone className="h-[18px] w-[18px]" />
        </button>

        {/* Connected Project */}
        {currentProject && (
          <div className="relative group flex justify-center w-full mt-2">
            <button
              className="flex items-center justify-center w-9 h-9 rounded-lg bg-foreground/10 text-foreground transition-colors hover:bg-foreground/20"
              title={currentProject.name}
            >
              <Folder className="h-[18px] w-[18px]" />
            </button>
            <div className="absolute left-[52px] top-0 hidden group-hover:flex items-center bg-popover text-popover-foreground border border-border shadow-md rounded-md py-1.5 px-3 z-50 whitespace-nowrap animate-in fade-in slide-in-from-left-2 transition-all">
              <span className="text-sm font-medium mr-3">{currentProject.name}</span>
              <button
                onClick={handleDisconnectProject}
                className="hover:bg-muted p-1 rounded-sm text-muted-foreground hover:text-foreground transition-colors"
                title="Disconnect from project"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        )}

        {/* Spacer */}
        <div className="flex-1" />

        {/* User Profile / Dashboard Link */}
        <button
          onClick={() => navigate("/dashboard")}
          className="flex items-center justify-center w-9 h-9 rounded-full hover:bg-muted/50 transition-colors text-muted-foreground hover:text-foreground mb-2 shadow-sm border border-border/50"
          title="Dashboard"
        >
          <User className="h-[18px] w-[18px]" />
        </button>

        {/* Theme Toggle */}
        <ThemeToggle className="w-9 h-9 rounded-full border border-border/50 bg-transparent text-muted-foreground hover:bg-muted/50 hover:text-foreground shadow-none mb-2 active:translate-x-0 active:translate-y-0" />

        {/* Bottom: expand/collapse indicator */}
        <button
          onClick={onToggleSidebar}
          className="flex items-center justify-center w-9 h-9 rounded-lg hover:bg-muted/50 transition-colors text-muted-foreground hover:text-foreground"
          title={isOpen ? "Collapse" : "Expand"}
        >
          <span className="text-sm font-medium">{isOpen ? "«" : "»"}</span>
        </button>
      </div>

      {/* Expanded Panel - Chat History / Files (only when open AND on chat page) */}
      <div className={cn(
        "flex flex-col bg-background transition-all duration-300 overflow-hidden",
        isOpen && stage === "chat" ? "w-60 border-r border-border/50" : "w-0"
      )}>
        {isOpen && stage === "chat" && (
          <>
            {/* Panel Header */}
            <div className="shrink-0 px-4 py-3 flex items-center justify-between">
              <span className="text-sm font-semibold text-foreground">
                {leftSidebarMode === "chat" ? "Chat History" : "Files"}
              </span>
            </div>

            {/* New Chat / Create File Buttons */}
            <div className="px-3 pb-2">
              {leftSidebarMode === "chat" ? (
                <Button
                  onClick={handleNewChat}
                  className="w-full bg-foreground/5 text-foreground hover:bg-foreground/10 text-xs font-medium border border-border/50 rounded-lg transition-all h-8"
                  size="sm"
                >
                  <Plus className="mr-1.5 h-3.5 w-3.5" />
                  New Chat
                </Button>
              ) : (
                <div className="flex gap-2">
                  <Button
                    className="flex-1 bg-foreground/5 text-foreground hover:bg-foreground/10 text-xs border border-border/50 rounded-lg h-8"
                    size="sm"
                  >
                    <File className="mr-1 h-3 w-3" />
                    New File
                  </Button>
                  <Button
                    className="flex-1 bg-foreground/5 text-foreground hover:bg-foreground/10 text-xs border border-border/50 rounded-lg h-8"
                    size="sm"
                  >
                    <Folder className="mr-1 h-3 w-3" />
                    New Folder
                  </Button>
                </div>
              )}
            </div>

            {/* Content Section */}
            <div className="flex-1 overflow-y-auto scrollbar-thin">
              {leftSidebarMode === "chat" ? (
                <div className="px-2 pb-4">
                  {sessions.length === 0 && (
                    <div className="text-center py-8">
                      <MessageSquare className="h-6 w-6 text-muted-foreground/50 mx-auto mb-2" />
                      <p className="text-xs text-muted-foreground">No chat history</p>
                    </div>
                  )}

                  {sessions.map((session) => {
                    const isActive = session.id === currentSessionId
                    const lastMessage = session.messages[session.messages.length - 1]
                    const preview = lastMessage?.content.substring(0, 50) || "No messages"

                    return (
                      <div
                        key={session.id}
                        onClick={() => handleSessionClick(session.id)}
                        className={cn(
                          "group relative mb-1 rounded-lg px-3 py-2.5 transition-colors cursor-pointer",
                          isActive
                            ? "bg-foreground/10 text-foreground"
                            : "text-foreground hover:bg-muted/50"
                        )}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">
                              {session.title}
                            </p>
                            <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5">
                              {preview}
                            </p>
                          </div>
                          <button
                            onClick={(e) => handleDeleteClick(e, session.id)}
                            className="opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:bg-muted rounded"
                          >
                            <Trash2 className="h-3 w-3 text-muted-foreground hover:text-foreground" />
                          </button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              ) : (
                /* File System View */
                <div className="h-full">
                  <FileSystemSidebar
                    files={generatedFiles}
                    images={images}
                    models={currentModel ? [currentModel] : []}
                    selectedFile={selectedFile}
                    onSelectFile={(path: string, _type: "file" | "asset", data?: any) => {
                      setSelectedFile(path)
                      let assetData = data
                      if (!assetData) {
                        assetData = {
                          name: path.split('/').pop() || path,
                          path: path,
                          type: 'code',
                          content: generatedFiles[path] || ''
                        }
                      }
                      const fullAssetData = {
                        ...assetData,
                        name: assetData.name || path.split('/').pop() || path,
                        path: assetData.path || path,
                        type: assetData.type || 'file'
                      }
                      setSelectedAsset(fullAssetData as any)
                    }}
                  />
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* Delete Confirmation Dialog */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-background border border-border rounded-xl shadow-2xl max-w-md w-full mx-4">
            <div className="border-b border-border px-4 py-3 flex items-center justify-between">
              <span className="text-sm font-semibold text-foreground">Delete Chat</span>
              <button
                onClick={handleCancelDelete}
                className="p-1 hover:bg-muted rounded-lg transition-colors"
              >
                <X className="h-4 w-4 text-foreground" />
              </button>
            </div>
            <div className="p-5">
              <p className="text-foreground text-sm mb-2">
                Are you sure you want to delete <span className="font-semibold">"{sessionTitle}"</span>?
              </p>
              <p className="text-xs text-muted-foreground mb-5">
                This action cannot be undone.
              </p>
              <div className="flex gap-2">
                <Button
                  onClick={handleConfirmDelete}
                  className="flex-1 bg-red-500/10 text-red-500 hover:bg-red-500/20 text-sm border border-red-500/20 rounded-lg"
                >
                  Delete
                </Button>
                <Button
                  onClick={handleCancelDelete}
                  variant="outline"
                  className="flex-1 border-border bg-background text-foreground hover:bg-muted text-sm rounded-lg"
                >
                  Cancel
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
