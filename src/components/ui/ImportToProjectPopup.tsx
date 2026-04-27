import { AnimatePresence, motion } from "framer-motion"
import { Folder, FolderInput, Loader2, X } from "lucide-react"
import { useEffect, useState } from "react"
import { useAuth } from "../../hooks/useAuth"
import { importAssetToProject, createAssetFromUrl, type AssetType } from "../../services/assetService"
import { getProjects, type Project } from "../../services/supabase"
import { useAppStore } from "../../store/useAppStore"

interface ImportToProjectPopupProps {
    isOpen: boolean
    onClose: () => void
    assetUrl: string
    assetType: AssetType
    assetName: string
}

export function ImportToProjectPopup({
    isOpen,
    onClose,
    assetUrl,
    assetType,
    assetName,
}: ImportToProjectPopupProps) {
    const { user } = useAuth()
    const { currentProject, setCurrentProject, setStage } = useAppStore()
    const [projects, setProjects] = useState<Project[]>([])
    const [isLoading, setIsLoading] = useState(false)
    const [isImporting, setIsImporting] = useState<string | null>(null) // project ID being imported to
    const [error, setError] = useState<string | null>(null)

    // If connected to a project, import directly
    useEffect(() => {
        if (isOpen && currentProject && user) {
            handleImport(currentProject)
        }
    }, [isOpen]) // eslint-disable-line react-hooks/exhaustive-deps

    // Load user projects when not connected to one
    useEffect(() => {
        if (isOpen && !currentProject && user) {
            setIsLoading(true)
            setError(null)
            getProjects(user.id)
                .then((p) => setProjects(p))
                .catch((err) => {
                    console.error("Failed to fetch projects:", err)
                    setError("Failed to load projects")
                })
                .finally(() => setIsLoading(false))
        }
    }, [isOpen, currentProject, user])

    const handleImport = async (project: Project) => {
        if (!user) return
        setIsImporting(project.id)
        setError(null)
        try {
            // Create the asset in the project using createAssetFromUrl
            await createAssetFromUrl(user.id, project.id, assetType, assetName, assetUrl)

            // Auto-connect the project if not already connected
            if (!currentProject || currentProject.id !== project.id) {
                setCurrentProject(project)
                // Persist project-session link
                const sessionId = useAppStore.getState().currentSessionId
                if (sessionId) {
                    localStorage.setItem(`project_${sessionId}`, JSON.stringify(project))
                    localStorage.setItem(`chat_project_sync_${sessionId}`, project.id)
                }
            }

            // Navigate to builder
            setStage("build")
            onClose()
        } catch (err) {
            console.error("Import failed:", err)
            setError(err instanceof Error ? err.message : "Import failed")
        } finally {
            setIsImporting(null)
        }
    }

    if (!isOpen) return null

    // If already connected, we handle it silently via the useEffect above
    if (currentProject) {
        return (
            <AnimatePresence>
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
                    onClick={onClose}
                >
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        className="bg-background border border-border rounded-xl shadow-2xl p-6 max-w-sm w-full mx-4"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="flex items-center justify-center gap-3">
                            <Loader2 className="h-5 w-5 animate-spin text-foreground" />
                            <span className="text-sm font-mono text-foreground">Importing to {currentProject.name}...</span>
                        </div>
                        {error && (
                            <p className="mt-3 text-xs text-red-500 text-center">{error}</p>
                        )}
                    </motion.div>
                </motion.div>
            </AnimatePresence>
        )
    }

    // Show project selection list
    return (
        <AnimatePresence>
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
                onClick={onClose}
            >
                <motion.div
                    initial={{ opacity: 0, scale: 0.95, y: 20 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95, y: 20 }}
                    transition={{ duration: 0.2 }}
                    className="bg-background border border-border rounded-xl shadow-2xl max-w-md w-full mx-4 overflow-hidden"
                    onClick={(e) => e.stopPropagation()}
                >
                    {/* Header */}
                    <div className="flex items-center justify-between px-5 py-4 border-b border-border">
                        <div className="flex items-center gap-2">
                            <FolderInput className="h-4 w-4 text-foreground" />
                            <h3 className="text-sm font-bold font-mono text-foreground">Import to Project</h3>
                        </div>
                        <button
                            onClick={onClose}
                            className="p-1 rounded-md hover:bg-muted transition-colors"
                        >
                            <X className="h-4 w-4 text-muted-foreground" />
                        </button>
                    </div>

                    {/* Asset preview */}
                    <div className="px-5 py-3 border-b border-border/50 bg-muted/10">
                        <p className="text-xs text-muted-foreground font-mono">
                            Importing: <span className="text-foreground font-semibold">{assetName}</span>
                            <span className="ml-2 px-1.5 py-0.5 bg-foreground/10 rounded text-[10px] uppercase">{assetType}</span>
                        </p>
                    </div>

                    {/* Project list */}
                    <div className="max-h-[300px] overflow-y-auto scrollbar-thin">
                        {isLoading ? (
                            <div className="flex items-center justify-center py-10">
                                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                                <span className="ml-2 text-sm text-muted-foreground">Loading projects...</span>
                            </div>
                        ) : projects.length === 0 ? (
                            <div className="text-center py-10 px-6">
                                <Folder className="h-8 w-8 text-muted-foreground/40 mx-auto mb-2" />
                                <p className="text-xs text-muted-foreground">No projects found. Create a project first.</p>
                            </div>
                        ) : (
                            projects.map((project) => (
                                <button
                                    key={project.id}
                                    onClick={() => handleImport(project)}
                                    disabled={!!isImporting}
                                    className="w-full flex items-center gap-3 px-5 py-3 hover:bg-muted/40 transition-colors border-b border-border/30 last:border-b-0 disabled:opacity-50 group"
                                >
                                    <div className="w-8 h-8 rounded-lg bg-foreground/5 border border-border/50 flex items-center justify-center group-hover:bg-foreground/10 transition-colors">
                                        <Folder className="h-4 w-4 text-foreground" />
                                    </div>
                                    <div className="flex-1 text-left">
                                        <p className="text-sm font-medium text-foreground">{project.name}</p>
                                        {project.description && (
                                            <p className="text-[10px] text-muted-foreground truncate">{project.description}</p>
                                        )}
                                    </div>
                                    {isImporting === project.id ? (
                                        <Loader2 className="h-4 w-4 animate-spin text-foreground" />
                                    ) : (
                                        <FolderInput className="h-4 w-4 text-muted-foreground group-hover:text-foreground transition-colors" />
                                    )}
                                </button>
                            ))
                        )}
                    </div>

                    {/* Error */}
                    {error && (
                        <div className="px-5 py-3 border-t border-border bg-red-500/5">
                            <p className="text-xs text-red-500">{error}</p>
                        </div>
                    )}
                </motion.div>
            </motion.div>
        </AnimatePresence>
    )
}
