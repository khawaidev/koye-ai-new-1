import { AnimatePresence, motion } from "framer-motion"
import { Check, Eye, Loader2, RefreshCw, X } from "lucide-react"
import { useEffect, useState } from "react"
import { getTaskDisplayName, useTaskStore, type Task, type TaskStatus } from "../../store/useTaskStore"
import { useAppStore } from "../../store/useAppStore"

function formatElapsedTime(startMs: number): string {
    const elapsed = Math.floor((Date.now() - startMs) / 1000)
    if (elapsed < 60) return `${elapsed}s`
    const mins = Math.floor(elapsed / 60)
    const secs = elapsed % 60
    return `${mins}m ${secs}s`
}

function TaskStatusBadge({ status }: { status: TaskStatus }) {
    switch (status) {
        case "running":
        case "pending":
            return (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-yellow-500/15 text-yellow-500 border border-yellow-500/20">
                    <Loader2 className="h-3 w-3 animate-spin" />
                    Processing
                </span>
            )
        case "completed":
            return (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-green-500/15 text-green-500 border border-green-500/20">
                    <Check className="h-3 w-3" />
                    Completed
                </span>
            )
        case "failed":
            return (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-red-500/15 text-red-500 border border-red-500/20">
                    <X className="h-3 w-3" />
                    Failed
                </span>
            )
        case "cancelled":
            return (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-muted-foreground/15 text-muted-foreground border border-muted-foreground/20">
                    Cancelled
                </span>
            )
        default:
            return null
    }
}

function TaskRow({ task }: { task: Task }) {
    const { cancelTask, retryTask, removeTask } = useTaskStore()
    const { setStage } = useAppStore()
    const [elapsed, setElapsed] = useState("")
    const isActive = task.status === "running" || task.status === "pending"

    useEffect(() => {
        if (!isActive) {
            if (task.startedAt && task.completedAt) {
                const duration = Math.floor((task.completedAt - task.startedAt) / 1000)
                setElapsed(`${duration}s`)
            }
            return
        }
        const start = task.startedAt || task.createdAt
        const tick = () => setElapsed(formatElapsedTime(start))
        tick()
        const interval = setInterval(tick, 1000)
        return () => clearInterval(interval)
    }, [task.startedAt, task.createdAt, task.completedAt, isActive])

    const displayName = getTaskDisplayName(task.type)
    const assetLabel = task.assetName || task.prompt?.substring(0, 8) || "—"

    const handleView = () => {
        // Navigate to the appropriate stage based on asset type
        if (task.assetType === "image" || task.assetType === "video") {
            setStage("mediaGeneration")
        } else if (task.assetType === "audio") {
            setStage("audioGeneration")
        } else if (task.assetType === "model") {
            setStage("model3DGeneration")
        }
    }

    return (
        <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, x: 50, height: 0 }}
            transition={{ duration: 0.25 }}
            className="flex items-center gap-3 px-4 py-3 border-b border-border/50 hover:bg-muted/30 transition-colors group"
        >
            {/* Task type */}
            <span className="text-xs font-semibold text-foreground shrink-0 w-[110px] truncate font-mono">
                {displayName}
            </span>

            {/* Asset name */}
            <span className="text-xs text-muted-foreground truncate w-[80px] shrink-0 font-mono" title={task.prompt || undefined}>
                {assetLabel}
            </span>

            {/* Status Badge */}
            <div className="shrink-0">
                <TaskStatusBadge status={task.status} />
            </div>

            {/* Progress bar / View / Retry */}
            <div className="flex-1 min-w-[100px] flex items-center">
                {isActive ? (
                    <div className="w-full h-[5px] rounded-full bg-muted-foreground/15 relative overflow-hidden">
                        <div
                            className="h-full rounded-full"
                            style={{
                                background: "linear-gradient(90deg, #3b82f6, #8b5cf6)",
                                animation: "taskBarMoving 1.2s ease-in-out infinite",
                            }}
                        />
                    </div>
                ) : task.status === "completed" ? (
                    <button
                        onClick={handleView}
                        className="flex items-center gap-1.5 px-3 py-1 text-xs font-semibold rounded-lg bg-foreground text-background hover:opacity-90 transition-all"
                    >
                        <Eye className="h-3 w-3" />
                        View
                    </button>
                ) : task.status === "failed" ? (
                    <button
                        onClick={() => retryTask(task.id)}
                        className="flex items-center gap-1.5 px-3 py-1 text-xs font-semibold rounded-lg bg-red-500/10 text-red-500 hover:bg-red-500/20 border border-red-500/20 transition-all"
                    >
                        <RefreshCw className="h-3 w-3" />
                        Retry
                    </button>
                ) : null}
            </div>

            {/* Elapsed time */}
            <span className="text-[10px] font-mono text-muted-foreground tabular-nums shrink-0 w-[40px] text-right">
                {elapsed}
            </span>

            {/* Cancel / Dismiss */}
            <button
                onClick={() => isActive ? cancelTask(task.id) : removeTask(task.id)}
                className="shrink-0 flex items-center justify-center h-6 w-6 rounded-full text-muted-foreground hover:text-red-500 hover:bg-red-500/10 transition-all opacity-50 group-hover:opacity-100"
                title={isActive ? "Cancel task" : "Dismiss"}
            >
                <X className="h-3.5 w-3.5" />
            </button>
        </motion.div>
    )
}

export function TasksPage() {
    const { tasks, getStatusCounts } = useTaskStore()
    const counts = getStatusCounts()

    // Sort: running first, then pending, then failed, then completed, then cancelled
    const sortedTasks = [...tasks].sort((a, b) => {
        const statusOrder: Record<TaskStatus, number> = {
            running: 0,
            pending: 1,
            failed: 2,
            completed: 3,
            cancelled: 4,
        }
        const aDiff = statusOrder[a.status] - statusOrder[b.status]
        if (aDiff !== 0) return aDiff
        return b.createdAt - a.createdAt
    })

    return (
        <div className="h-full flex flex-col bg-background overflow-hidden">
            {/* Header */}
            <div className="shrink-0 px-6 py-5 border-b border-border">
                <div className="flex items-center justify-between">
                    <h1 className="text-lg font-bold font-mono text-foreground">
                        Tasks and Processes
                    </h1>
                    <div className="flex items-center gap-4">
                        {counts.failed > 0 && (
                            <div className="flex items-center gap-1.5">
                                <div className="w-2 h-2 rounded-full bg-red-500" />
                                <span className="text-xs font-mono text-red-500">{counts.failed} failed</span>
                            </div>
                        )}
                        {counts.processing > 0 && (
                            <div className="flex items-center gap-1.5">
                                <div className="w-2 h-2 rounded-full bg-yellow-500 animate-pulse" />
                                <span className="text-xs font-mono text-yellow-500">{counts.processing} processing</span>
                            </div>
                        )}
                        {counts.completed > 0 && (
                            <div className="flex items-center gap-1.5">
                                <div className="w-2 h-2 rounded-full bg-green-500" />
                                <span className="text-xs font-mono text-green-500">{counts.completed} completed</span>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Task list */}
            <div className="flex-1 overflow-y-auto scrollbar-thin">
                {sortedTasks.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-center px-6">
                        <div className="w-16 h-16 rounded-full bg-muted/30 flex items-center justify-center mb-4">
                            <Loader2 className="h-8 w-8 text-muted-foreground/40" />
                        </div>
                        <p className="text-muted-foreground font-mono text-sm mb-1">No tasks yet</p>
                        <p className="text-muted-foreground/60 text-xs max-w-xs">
                            Generate images, videos, audio, or 3D models — tasks will appear here so you can work on other things.
                        </p>
                    </div>
                ) : (
                    <AnimatePresence>
                        {sortedTasks.map((task) => (
                            <TaskRow key={task.id} task={task} />
                        ))}
                    </AnimatePresence>
                )}
            </div>

            {/* Inline keyframes */}
            <style>{`
                @keyframes taskBarMoving {
                    0% { width: 0%; margin-left: 0; }
                    50% { width: 100%; margin-left: 0; }
                    100% { width: 0%; margin-left: 100%; }
                }
            `}</style>
        </div>
    )
}
