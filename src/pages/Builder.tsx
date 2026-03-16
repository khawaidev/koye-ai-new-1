import { useCallback, useEffect, useRef, useState } from "react"
import { useParams, useSearchParams } from "react-router-dom"
import iconJpg from "../assets/icon.jpg"
import { BuilderHeader } from "../components/builder/BuilderHeader"
import { BuilderInspector } from "../components/builder/BuilderInspector"
import { BuilderSidebar } from "../components/builder/BuilderSidebar"
import { BuilderWelcomeModal } from "../components/builder/BuilderWelcomeModal"
import { ImageEditForm } from "../components/builder/ImageEditForm"
import { UnifiedViewer } from "../components/ui/UnifiedViewer"
import { useAuth } from "../hooks/useAuth"
import { loadProjectFilesFromStorage, saveProjectFilesToStorage } from "../services/projectFiles"
import { useAppStore } from "../store/useAppStore"
import { detectFileType } from "../utils/fileTypeDetection"

type HistoryState = {
    files: Record<string, string>
    timestamp: number
}

export function Builder() {
    const { projectId } = useParams()
    const [searchParams] = useSearchParams()
    const projectName = searchParams.get("name") || "Untitled Project"
    const { user } = useAuth()

    const {
        selectedAsset,
        setSelectedAsset,
        generatedFiles,
        setGeneratedFiles,
        githubConnection,
        isImageEditMode,
        setIsImageEditMode,
    } = useAppStore()

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

        // Logic similar to LeftSidebar to ensure complete asset data
        let assetData = data

        if (!assetData) {
            // Get content from generatedFiles if it exists
            const content = generatedFiles[path]

            // Determine type based on file detection
            let assetType = fileTypeInfo.category
            if (assetType === 'text') {
                assetType = 'code' // Treat text files as code for display
            }

            assetData = {
                name: fileName,
                path: path,
                type: assetType === 'unknown' ? 'code' : assetType,
                content: content,
                url: content && (content.startsWith('http') || content.startsWith('data:')) ? content : undefined
            }
        } else {
            // Ensure assetData has all required fields
            assetData = {
                ...assetData,
                name: assetData.name || fileName,
                path: assetData.path || path,
                type: assetData.type || (fileTypeInfo.category === 'unknown' ? 'code' : fileTypeInfo.category),
                content: assetData.content || generatedFiles[path]
            }
        }



        setSelectedAsset(assetData)
    }

    const handleFileCreated = () => {
        // History is automatically saved via useEffect when generatedFiles changes
        // This callback can be used for other side effects if needed
    }

    // Auto-save function
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

            // Save to localStorage as backup (keyed by projectId)
            // Filter out large files (data URLs, images) to avoid quota errors
            try {
                const storageKey = `project_${projectId}_files`
                const filteredFiles: Record<string, string> = {}

                for (const [path, content] of Object.entries(currentFiles || {})) {
                    // Skip large data URLs (images, etc.) - they're already in Supabase
                    if (content && (
                        content.startsWith('data:image') ||
                        content.startsWith('data:video') ||
                        content.startsWith('data:audio') ||
                        content.length > 100000 // Skip files larger than 100KB
                    )) {
                        // Store just a reference marker instead
                        filteredFiles[path] = `[STORED_IN_DB:${content.length}]`
                    } else {
                        filteredFiles[path] = content
                    }
                }

                localStorage.setItem(storageKey, JSON.stringify({
                    files: filteredFiles,
                    timestamp: Date.now(),
                    projectName: projectName
                }))
            } catch (storageError) {
                // Quota exceeded - just skip localStorage, data is in Supabase anyway
                console.warn('localStorage quota exceeded, skipping local backup')
            }

            // Save to GitHub or Supabase (this is the primary storage)
            await saveProjectFilesToStorage(
                projectId,
                user.id,
                projectName,
                currentFiles,
                githubConnection
            )

            setLastSaved(new Date())
            console.log('Auto-saved project files')
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
    const hasLoadedRef = useRef(false)

    // Load project files on mount (only once)
    useEffect(() => {
        if (projectId && user && !hasLoadedRef.current) {
            hasLoadedRef.current = true  // Mark as loaded to prevent re-running
            const loadFiles = async () => {
                try {
                    const storageKey = `project_${projectId}_files`
                    const savedData = localStorage.getItem(storageKey)

                    // PRIORITY 1: Use localStorage if available (most recent session state)
                    // This preserves deletions and renames from the current/last session
                    if (savedData) {
                        try {
                            const parsed = JSON.parse(savedData)
                            if (parsed.files && Object.keys(parsed.files).length > 0) {
                                console.log('Loading from localStorage (session state)', Object.keys(parsed.files).length, 'files')
                                setGeneratedFiles(parsed.files)
                                if (parsed.timestamp) {
                                    setLastSaved(new Date(parsed.timestamp))
                                }
                                setIsLoading(false)
                                return // Use localStorage, don't load from DB
                            }
                        } catch (error) {
                            console.error('Error parsing localStorage:', error)
                        }
                    }

                    // PRIORITY 2: Load from DB (fallback for first load or no local data)
                    console.log('Loading from database...')

                    // Fetch all files directly - deletions are now handled immediately via service role
                    // No need for settings.koye based filtering anymore
                    const dbFiles = await loadProjectFilesFromStorage(
                        projectId,
                        user.id,
                        githubConnection
                    )

                    if (Object.keys(dbFiles).length > 0) {
                        console.log('Loaded', Object.keys(dbFiles).length, 'files from database')

                        // Filter out any .settings.koye files that may exist from old versions
                        const cleanFiles = Object.fromEntries(
                            Object.entries(dbFiles).filter(([path]) => !path.includes('.settings.koye'))
                        )

                        setGeneratedFiles(cleanFiles)
                        setLastSaved(new Date())
                    } else {
                        console.log('No files found in database')
                    }
                } catch (error) {
                    console.error('Error loading project files:', error)
                    // Final fallback to localStorage
                    const storageKey = `project_${projectId}_files`
                    const savedData = localStorage.getItem(storageKey)
                    if (savedData) {
                        try {
                            const parsed = JSON.parse(savedData)
                            if (parsed.files && Object.keys(parsed.files).length > 0) {
                                setGeneratedFiles(parsed.files)
                                if (parsed.timestamp) {
                                    setLastSaved(new Date(parsed.timestamp))
                                }
                            }
                        } catch (err) {
                            console.error('Error loading from localStorage:', err)
                        }
                    }
                } finally {
                    // Add a small delay to show the animation
                    setTimeout(() => setIsLoading(false), 1500)
                }
            }

            loadFiles()
        } else {
            setIsLoading(false)
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [projectId, user?.id])  // Only depend on projectId and user.id, hasLoadedRef prevents re-runs

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

                    // Only sync if we have valid files data
                    if (!parsed.files || typeof parsed.files !== 'object') {
                        return
                    }

                    const currentFiles = useAppStore.getState().generatedFiles || {}

                    // Only update if timestamp is newer
                    const lastCheck = localStorage.getItem(`${syncKey}_lastCheck`)
                    const lastCheckTime = lastCheck ? parseInt(lastCheck) : 0

                    if (parsed.timestamp > lastCheckTime) {
                        // MERGE files instead of replacing - chat adds files, doesn't overwrite
                        // Only add new files from chat that don't exist locally
                        const newFiles = { ...currentFiles }
                        let hasNewFiles = false

                        for (const [path, content] of Object.entries(parsed.files)) {
                            if (!currentFiles[path]) {
                                newFiles[path] = content as string
                                hasNewFiles = true
                                console.log('Builder: Adding file from chat:', path)
                            }
                        }

                        if (hasNewFiles) {
                            console.log('Builder: Merged new files from chat')
                            isUndoRedoRef.current = true // Prevent adding to undo history
                            setGeneratedFiles(newFiles)
                        }

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

    if (isLoading) {
        return (
            <div className="flex h-screen w-full items-center justify-center bg-background">
                <div className="flex flex-col items-center gap-4">
                    <div className="h-14 w-14 rounded-full overflow-hidden border-2 border-foreground bg-background animate-spin-think">
                        <img src={iconJpg} alt="Loading..." className="h-full w-full object-cover" />
                    </div>
                    <div className="font-mono text-sm font-bold text-foreground animate-pulse">
                        Loading Project...
                    </div>
                </div>
            </div>
        )
    }

    // Render logic to switch between viewer and image edit form
    const renderBuilderViewerArea = () => {
        if (isImageEditMode && selectedAsset) {
            // Resolve image URL from multiple sources
            const assetPath = (selectedAsset as any).path
            const files = useAppStore.getState().generatedFiles || {}
            let imgUrl = (selectedAsset as any).url || (selectedAsset as any).content
            if (assetPath && files[assetPath]) {
                const fc = files[assetPath]
                if (fc.startsWith('http') || fc.startsWith('data:image') || fc.startsWith('blob:')) {
                    imgUrl = fc
                } else {
                    const urlMatch = fc.match(/\**URL:\**\s*(https?:\/\/[^\s\n*)]+)/i) || fc.match(/# URL:\s*(https?:\/\/[^\s\n]+)/i)
                    if (urlMatch) {
                        imgUrl = urlMatch[1]
                    }
                }
            }
            const imgName = (selectedAsset as any).name || assetPath?.split('/').pop() || 'image.png'

            if (imgUrl) {
                return (
                    <ImageEditForm
                        sourceImageUrl={imgUrl}
                        sourceImageName={imgName}
                        onClose={() => setIsImageEditMode(false)}
                    />
                )
            }
        }
        return <UnifiedViewer />
    }
    return (
        <div className="flex flex-col h-screen bg-background overflow-hidden font-mono text-foreground">
            <BuilderHeader
                projectName={projectName}
                onUndo={handleUndo}
                onRedo={handleRedo}
                onPlay={handlePlay}
                canUndo={canUndo}
                canRedo={canRedo}
            />

            <div className="flex-1 flex min-h-0 border-t-2 border-border">
                {/* Left Sidebar - File Explorer */}
                <BuilderSidebar
                    selectedFile={selectedAsset ? (selectedAsset as any).path : null}
                    onSelectFile={handleSelectFile}
                    onFileCreated={handleFileCreated}
                    projectId={projectId}
                    userId={user?.id}
                />

                {/* Middle - Viewer / Image Edit Form */}
                <div className="flex-1 bg-muted/20 relative min-w-0 border-x-2 border-border">
                    {renderBuilderViewerArea()}
                </div>

                {/* Right Sidebar - Inspector */}
                <BuilderInspector />
            </div>

            {/* Welcome Modal */}
            <BuilderWelcomeModal isOpen={showWelcome} onClose={handleCloseWelcome} />
        </div>
    )
}
