import { Check, X } from "lucide-react"
import { useCallback, useEffect, useRef, useState } from "react"
import { useParams, useSearchParams } from "react-router-dom"
import { cn } from "../lib/utils"
import iconJpg from "../assets/icon.jpg"
import { BuilderHeader } from "../components/builder/BuilderHeader"
import { BuilderInspector } from "../components/builder/BuilderInspector"
import { BuilderSidebar } from "../components/builder/BuilderSidebar"
import { BuilderWelcomeModal } from "../components/builder/BuilderWelcomeModal"

import { UnifiedViewer } from "../components/ui/UnifiedViewer"
import { useAuth } from "../hooks/useAuth"
import { deleteProjectFile, loadProjectFilesFromStorage, saveProjectFilesToStorage } from "../services/projectFiles"
import { useAppStore } from "../store/useAppStore"
import { detectFileType } from "../utils/fileTypeDetection"
import { bulkSaveVFS } from "../services/vfs"
import { ProjectLoader } from "../components/ui/ProjectLoader"

type HistoryState = {
    files: Record<string, string>
    timestamp: number
}

// Upload overlay state type
export interface UploadFileStatus {
    name: string
    status: 'pending' | 'reading' | 'uploading' | 'success' | 'failed'
    error?: string
}

export interface UploadOverlayState {
    isUploading: boolean
    files: UploadFileStatus[]
}

export function Builder({ projectId: propsProjectId, projectName: propsProjectName }: { projectId?: string, projectName?: string } = {}) {
    const { projectId: routeProjectId } = useParams()
    const [searchParams] = useSearchParams()
    const { user } = useAuth()

    const {
        selectedAsset,
        setSelectedAsset,
        generatedFiles,
        setGeneratedFiles,
        githubConnection,
        currentProject,
    } = useAppStore()

    const projectId = propsProjectId || routeProjectId || currentProject?.id
    const projectName = propsProjectName || searchParams.get("name") || currentProject?.name || "Untitled Project"

    // Undo/Redo history
    const historyRef = useRef<HistoryState[]>([])
    const historyIndexRef = useRef<number>(-1)
    const [canUndo, setCanUndo] = useState(false)
    const [canRedo, setCanRedo] = useState(false)

    // Auto-save
    const autoSaveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
    const [_isSaving, setIsSaving] = useState(false)
    const [_lastSaved, setLastSaved] = useState<Date | null>(null)
    const [showWelcome, setShowWelcome] = useState(false)

    // Upload overlay state — controlled by BuilderSidebar, rendered here
    const [uploadState, setUploadState] = useState<UploadOverlayState | null>(null)

    // Track last-saved file contents to only sync changed files
    const lastSavedFilesRef = useRef<Record<string, string>>({})

    // Save current state to history
    const saveToHistory = () => {
        // Get latest generatedFiles from store to avoid closure issues
        const currentFiles = useAppStore.getState().generatedFiles
        const currentState: HistoryState = {
            files: { ...currentFiles },
            timestamp: Date.now()
        }

        // Remove any future history if we're not at the end
        if (historyIndexRef.current < historyRef.current.length - 1) {
            historyRef.current = historyRef.current.slice(0, historyIndexRef.current + 1)
        }

        historyRef.current.push(currentState)
        historyIndexRef.current = historyRef.current.length - 1

        // Limit history to 50 states
        if (historyRef.current.length > 50) {
            historyRef.current.shift()
            historyIndexRef.current--
        }

        updateUndoRedoState()
    }

    // Initialize history with current state on mount
    useEffect(() => {
        if (historyRef.current.length === 0) {
            saveToHistory()
        }
    }, [])

    // Save to history when generatedFiles changes (but only if not from undo/redo)
    // We use a ref to track if the change is from undo/redo
    const isUndoRedoRef = useRef(false)

    useEffect(() => {
        // Skip saving if this change came from undo/redo
        if (isUndoRedoRef.current) {
            isUndoRedoRef.current = false
            return
        }

        // Only save if history is initialized (not on first mount)
        if (historyRef.current.length > 0) {
            saveToHistory()
        }
    }, [generatedFiles])

    const updateUndoRedoState = () => {
        setCanUndo(historyIndexRef.current > 0)
        setCanRedo(historyIndexRef.current < historyRef.current.length - 1)
    }

    const handleUndo = () => {
        if (historyIndexRef.current > 0) {
            historyIndexRef.current--
            const previousState = historyRef.current[historyIndexRef.current]
            isUndoRedoRef.current = true // Mark as undo/redo operation
            setGeneratedFiles(previousState.files)
            updateUndoRedoState()
        }
    }

    const handleRedo = () => {
        if (historyIndexRef.current < historyRef.current.length - 1) {
            historyIndexRef.current++
            const nextState = historyRef.current[historyIndexRef.current]
            isUndoRedoRef.current = true // Mark as undo/redo operation
            setGeneratedFiles(nextState.files)
            updateUndoRedoState()
        }
    }

    const handlePlay = () => {
        console.log("Play project")
        window.open(`/project-engine-render?projectId=${projectId}&name=${encodeURIComponent(projectName)}`, '_blank')
    }

    const handleSelectFile = (path: string, _type: "file" | "asset", data?: any) => {
        // Detect file type from path
        const fileTypeInfo = detectFileType(path)
        const fileName = path.split('/').pop() || path

        // Always get the latest content from generatedFiles
        const currentContent = generatedFiles[path]

        // Determine type based on file detection
        let assetType = fileTypeInfo.category

        // Special case: check if it's a folder (no content and exists as prefix)
        if (currentContent === undefined) {
             const isFolder = Object.keys(generatedFiles).some(p => p.startsWith(path + '/'))
             if (isFolder) {
                 assetType = 'folder' as any
             }
        }

        if (assetType === 'text') {
            assetType = 'code' // Treat text files as code for display
        }

        // Resolve the URL from the actual content (covers data URLs, http URLs, blob URLs)
        let resolvedUrl: string | undefined = currentContent && (
            currentContent.startsWith('data:') ||
            currentContent.startsWith('http') ||
            currentContent.startsWith('blob:')
        ) ? currentContent : undefined

        // Fallback: if content is markdown metadata (legacy), try to extract URL from it
        if (!resolvedUrl && currentContent && fileTypeInfo.isBinary) {
            const urlMatch = currentContent.match(/\**URL:\*\*\s*(https?:\/\/[^\s\n*)]+)/i)
                || currentContent.match(/# URL:\s*(https?:\/\/[^\s\n]+)/i)
                || currentContent.match(/(https?:\/\/[^\s\n*)]+)/i)
            if (urlMatch) {
                resolvedUrl = urlMatch[1]
            }
        }

        // Build the asset data, merging any provided data with resolved values
        const assetData = {
            ...(data || {}),
            name: (data?.name) || fileName,
            path: (data?.path) || path,
            type: (data?.type) || (assetType === 'unknown' ? 'code' : assetType),
            content: currentContent,
            url: resolvedUrl || (data?.url) // Prefer freshly resolved URL
        }

        setSelectedAsset(assetData)
    }

    const handleFileCreated = () => {
        // History is automatically saved via useEffect when generatedFiles changes
        // This callback can be used for other side effects if needed
    }

    // Called by BuilderSidebar after a file is immediately synced (upload, create, delete)
    const handleFileSynced = useCallback((path: string, content: string | null) => {
        if (content === null) {
            // File was deleted — remove from snapshot so auto-save doesn't re-upload
            delete lastSavedFilesRef.current[path]
        } else {
            lastSavedFilesRef.current[path] = content
        }
    }, [])

    // Auto-save function — only saves files that have CHANGED since last save
    const autoSave = useCallback(async () => {
        if (!projectId || !user) return

        setIsSaving(true)
        try {
            // Get latest generatedFiles from store (default to empty object if undefined)
            const currentFiles = useAppStore.getState().generatedFiles || {}

            // Skip if no files to save
            if (Object.keys(currentFiles).length === 0) {
                console.log('No files to auto-save')
                setIsSaving(false)
                return
            }

            // Find files that have actually changed since last save
            const changedFiles: Record<string, string> = {}
            for (const [path, content] of Object.entries(currentFiles)) {
                if (lastSavedFilesRef.current[path] !== content) {
                    changedFiles[path] = content
                }
            }

            // Detect files that were DELETED (exist in snapshot but not in current)
            const deletedPaths: string[] = []
            for (const path of Object.keys(lastSavedFilesRef.current)) {
                if (!(path in currentFiles)) {
                    deletedPaths.push(path)
                }
            }

            if (Object.keys(changedFiles).length === 0 && deletedPaths.length === 0) {
                console.log('No changed files to auto-save')
                setIsSaving(false)
                return
            }

            console.log(`[auto-save] ${Object.keys(changedFiles).length} changed, ${deletedPaths.length} deleted`)

            // Delete removed files from backend
            for (const deletedPath of deletedPaths) {
                deleteProjectFile(projectId, user.id, deletedPath, githubConnection)
                    .then(() => console.log(`[auto-save] Deleted from backend: ${deletedPath}`))
                    .catch(e => console.warn(`[auto-save] Delete failed for ${deletedPath}:`, e))
            }

            // Save ONLY changed files to storage (priority sync)
            await saveProjectFilesToStorage(
                projectId,
                user.id,
                projectName,
                changedFiles,
                githubConnection
            )

            // Update snapshot to mark these files as saved
            lastSavedFilesRef.current = { ...currentFiles }

            setLastSaved(new Date())
            console.log('Auto-saved changed files')
        } catch (error) {
            console.error('Error auto-saving:', error)
        } finally {
            setIsSaving(false)
        }
    }, [projectId, projectName, user, githubConnection])

    // Debounced auto-save when generatedFiles changes
    useEffect(() => {
        // Skip saving if this change came from undo/redo or sync
        if (isUndoRedoRef.current) {
            return
        }

        // Only auto-save if history is initialized (not on first mount)
        if (historyRef.current.length > 0 && projectId) {
            // Clear existing timeout
            if (autoSaveTimeoutRef.current) {
                clearTimeout(autoSaveTimeoutRef.current)
            }

            // Set new timeout for auto-save (2 seconds after last change)
            autoSaveTimeoutRef.current = setTimeout(() => {
                autoSave()
            }, 2000)

            // Sync to chat - only file paths, not content (to avoid quota issues)
            try {
                const syncKey = `project_${projectId}_sync`
                const filePaths = Object.keys(generatedFiles)
                localStorage.setItem(syncKey, JSON.stringify({
                    timestamp: Date.now(),
                    sessionId: 'builder',
                    filePaths: filePaths // Only sync paths, not full content
                }))
            } catch {
                // Ignore quota errors for sync
            }
        }

        // Cleanup timeout on unmount
        return () => {
            if (autoSaveTimeoutRef.current) {
                clearTimeout(autoSaveTimeoutRef.current)
            }
        }
    }, [generatedFiles, projectId, autoSave])

    const [isLoading, setIsLoading] = useState(true)
    const loadedProjectIdRef = useRef<string | null>(null)

    // Load project files on mount or project switch
    // Storage is the SOLE source of truth — no localStorage merge
    useEffect(() => {
        if (projectId && user && loadedProjectIdRef.current !== projectId) {
            loadedProjectIdRef.current = projectId  // Mark this project as loaded
            
            // Immediately clear the old project's files and history so they don't bleed over
            setGeneratedFiles({})
            lastSavedFilesRef.current = {}
            historyRef.current = []
            historyIndexRef.current = -1
            setSelectedAsset(null)
            setIsLoading(true)

            const loadFiles = async () => {
                try {
                    // Fetch from storage — this is the only source of truth
                    console.log(`Loading project files for ${projectId} from storage...`)
                    const dbFiles = await loadProjectFilesFromStorage(
                        projectId,
                        user.id,
                        githubConnection
                    )

                    const finalFiles = Object.fromEntries(
                        Object.entries(dbFiles).filter(([path]) => !path.includes('.settings.koye'))
                    )

                    if (Object.keys(finalFiles).length > 0) {
                        console.log('Loaded', Object.keys(finalFiles).length, 'files from storage')
                        setGeneratedFiles(finalFiles)
                        // Set the snapshot so auto-save doesn't re-upload everything
                        lastSavedFilesRef.current = { ...finalFiles }
                        setLastSaved(new Date())
                    } else {
                        console.log('No files found in storage')
                        setGeneratedFiles({})
                    }

                    // Update VFS backup (replaces localStorage to avoid 5MB limit and UI lag)
                    if (projectId && Object.keys(finalFiles).length > 0) {
                        try {
                            await bulkSaveVFS(projectId, finalFiles)
                            console.log(`✓ Backed up ${Object.keys(finalFiles).length} files to VFS (IndexedDB)`)
                        } catch (vfsError) {
                            console.warn('Failed to backup to VFS:', vfsError)
                        }
                    }
                } catch (error) {
                    console.error('Error loading project files:', error)
                } finally {
                    // Add a small delay to show the animation
                    setTimeout(() => setIsLoading(false), 1500)
                }
            }

            loadFiles()
        } else if (!projectId) {
            setIsLoading(false)
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [projectId, user?.id])  // Dependency on projectId triggers reload on switch

    // Listen for real-time sync from chat
    useEffect(() => {
        if (!projectId) return

        const syncKey = `project_${projectId}_sync`

        // Check for updates every 2 seconds (reduced frequency)
        const syncInterval = setInterval(() => {
            const syncData = localStorage.getItem(syncKey)
            if (syncData) {
                try {
                    const parsed = JSON.parse(syncData)

                    // Only update if timestamp is newer
                    const lastCheck = localStorage.getItem(`${syncKey}_lastCheck`)
                    const lastCheckTime = lastCheck ? parseInt(lastCheck) : 0

                    if (parsed.timestamp > lastCheckTime) {
                        console.log('Builder: Received sync signal from chat')
                        // We rely on useAppStore for global state, no need to merge via localStorage
                        localStorage.setItem(`${syncKey}_lastCheck`, parsed.timestamp.toString())
                    }
                } catch (error) {
                    console.error('Error syncing from chat:', error)
                }
            }
        }, 2000)

        return () => clearInterval(syncInterval)
    }, [projectId, setGeneratedFiles])

    // Check if opened from chat (show welcome modal)
    useEffect(() => {
        const fromChat = searchParams.get('fromChat')
        const welcomeShownKey = `builder_welcome_shown_${projectId}`
        const hasShownWelcome = localStorage.getItem(welcomeShownKey)

        if (fromChat === 'true' && !hasShownWelcome && !isLoading) {
            setShowWelcome(true)
            localStorage.setItem(welcomeShownKey, 'true')
        }
    }, [projectId, searchParams, isLoading])

    const handleCloseWelcome = () => {
        setShowWelcome(false)
    }

    const [inspectorWidth, setInspectorWidth] = useState(320)
    const [isResizingInspector, setIsResizingInspector] = useState(false)
    const [isInspectorCollapsed, setIsInspectorCollapsed] = useState(false)

    // Handle Inspector Resizing
    const startResizingInspector = useCallback((e: React.MouseEvent) => {
        e.preventDefault()
        setIsResizingInspector(true)
    }, [])

    const stopResizingInspector = useCallback(() => {
        setIsResizingInspector(false)
    }, [])

    const resizeInspector = useCallback((e: MouseEvent) => {
        if (isResizingInspector) {
            const newWidth = window.innerWidth - e.clientX
            if (newWidth < 50) {
                setInspectorWidth(0)
                setIsInspectorCollapsed(true)
            } else {
                setInspectorWidth(Math.min(800, Math.max(200, newWidth)))
                setIsInspectorCollapsed(false)
            }
        }
    }, [isResizingInspector])

    useEffect(() => {
        if (isResizingInspector) {
            window.addEventListener('mousemove', resizeInspector)
            window.addEventListener('mouseup', stopResizingInspector)
        } else {
            window.removeEventListener('mousemove', resizeInspector)
            window.removeEventListener('mouseup', stopResizingInspector)
        }
        return () => {
            window.removeEventListener('mousemove', resizeInspector)
            window.removeEventListener('mouseup', stopResizingInspector)
        }
    }, [isResizingInspector, resizeInspector, stopResizingInspector])

    // Logic to reopen Inspector by dragging from the right screen edge
    const handleRightEdgeDrag = useCallback((e: React.MouseEvent) => {
         if (isInspectorCollapsed && e.clientX > window.innerWidth - 10) {
              startResizingInspector(e)
         }
    }, [isInspectorCollapsed, startResizingInspector])

    if (isLoading) {
        return <ProjectLoader />
    }

    return (
        <div 
            className="flex flex-col h-full bg-background overflow-hidden font-mono text-foreground select-none"
            onMouseMove={(e) => {
                 if (isInspectorCollapsed && e.clientX > window.innerWidth - 10) {
                      // Optional: show a hint or allow dragging to reopen
                 }
            }}
        >
            <BuilderHeader
                projectName={projectName}
                onUndo={handleUndo}
                onRedo={handleRedo}
                onPlay={handlePlay}
                canUndo={canUndo}
                canRedo={canRedo}
            />

            <div className="flex-1 flex min-h-0 border-t border-white/10 relative">
                {/* Reopen Trigger Zone (Extreme Right) */}
                {isInspectorCollapsed && (
                    <div 
                        className="absolute right-0 top-0 bottom-0 w-2 z-[60] cursor-ew-resize hover:bg-white/5 transition-colors"
                        onMouseDown={(e) => {
                             setIsInspectorCollapsed(false)
                             setInspectorWidth(200)
                             startResizingInspector(e)
                        }}
                        onMouseMove={handleRightEdgeDrag}
                    />
                )}

                {/* Left Sidebar - File Explorer */}
                <BuilderSidebar
                    selectedFile={selectedAsset ? (selectedAsset as any).path : null}
                    onSelectFile={handleSelectFile}
                    onFileCreated={handleFileCreated}
                    projectId={projectId}
                    userId={user?.id}
                    onFileSynced={handleFileSynced}
                    onUploadStateChange={setUploadState}
                />

                {/* Middle - Viewer / Upload Overlay */}
                <div className="flex-1 bg-muted/20 relative min-w-0 border-x border-white/10">
                    <UnifiedViewer />

                    {/* Upload to Project Overlay — covers the viewer area */}
                    {uploadState && uploadState.isUploading && (
                        <div className="absolute inset-0 z-50 bg-background/95 backdrop-blur-sm flex flex-col items-center justify-center">
                            <div className="max-w-md w-full p-8">
                                <div className="flex flex-col items-center mb-8">
                                    <div className="h-14 w-14 rounded-full overflow-hidden border border-white/20 bg-background animate-spin-think mb-4">
                                        <img src={iconJpg} alt="Uploading..." className="h-full w-full object-cover" />
                                    </div>
                                    <h3 className="font-mono text-lg font-bold text-foreground">
                                        UPLOADING TO PROJECT
                                    </h3>
                                    <p className="font-mono text-xs text-muted-foreground mt-1">
                                        Syncing files to your project
                                    </p>
                                </div>

                                <div className="space-y-3 border border-white/10 p-4 bg-background">
                                    {uploadState.files.map((file, idx) => (
                                        <div key={idx} className="flex items-center gap-3 font-mono text-xs">
                                            <div className="w-5 h-5 flex items-center justify-center shrink-0">
                                                {file.status === 'pending' && (
                                                    <div className="h-2 w-2 rounded-full bg-muted-foreground" />
                                                )}
                                                {file.status === 'reading' && (
                                                    <div className="animate-spin h-4 w-4 border-2 border-foreground border-t-transparent rounded-full" />
                                                )}
                                                {file.status === 'uploading' && (
                                                    <div className="animate-spin h-4 w-4 border-2 border-blue-500 border-t-transparent rounded-full" />
                                                )}
                                                {file.status === 'success' && (
                                                    <Check className="h-4 w-4 text-green-600" />
                                                )}
                                                {file.status === 'failed' && (
                                                    <X className="h-4 w-4 text-red-600" />
                                                )}
                                            </div>
                                            <span className="truncate text-foreground flex-1">{file.name}</span>
                                            <span className="text-muted-foreground shrink-0">
                                                {file.status === 'pending' && 'Waiting...'}
                                                {file.status === 'reading' && 'Reading...'}
                                                {file.status === 'uploading' && 'Uploading...'}
                                                {file.status === 'success' && 'Uploaded ✓'}
                                                {file.status === 'failed' && 'Failed ✗'}
                                            </span>
                                        </div>
                                    ))}
                                </div>

                                {/* Progress bar */}
                                <div className="mt-4 h-2 bg-muted rounded-full overflow-hidden">
                                    <div
                                        className="h-full bg-foreground transition-all duration-500"
                                        style={{
                                            width: `${((uploadState.files.filter(f => f.status === 'success' || f.status === 'failed').length) / Math.max(uploadState.files.length, 1)) * 100}%`
                                        }}
                                    />
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* Right Sidebar - Inspector */}
                <div 
                    className={cn(
                        "relative flex shrink-0 border-l border-white/10",
                        !isResizingInspector && "transition-all duration-300 ease-in-out",
                        isInspectorCollapsed ? "w-0 border-none" : "w-auto"
                    )}
                    style={{ 
                        width: isInspectorCollapsed ? 0 : `${inspectorWidth}px`,
                        opacity: isInspectorCollapsed ? 0 : 1,
                        pointerEvents: isInspectorCollapsed ? 'none' : 'auto'
                    }}
                >
                    {/* Resize Handle */}
                    {!isInspectorCollapsed && (
                        <div 
                            className={cn(
                                "absolute left-0 top-0 bottom-0 w-1 cursor-ew-resize z-50 hover:bg-white/20 transition-colors",
                                isResizingInspector && "bg-white/30"
                            )}
                            onMouseDown={startResizingInspector}
                        />
                    )}
                    <div className="flex-1 overflow-hidden h-full">
                        <BuilderInspector />
                    </div>
                </div>
            </div>

            {/* Welcome Modal */}
            <BuilderWelcomeModal isOpen={showWelcome} onClose={handleCloseWelcome} />
        </div>
    )
}

