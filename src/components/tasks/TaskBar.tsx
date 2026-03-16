import { AnimatePresence, motion } from "framer-motion"
import { Check, ChevronDown, ChevronUp, Loader2, X } from "lucide-react"
import { useEffect, useState } from "react"
import { getTaskDisplayName, useTaskStore, type Task, type TaskStatus } from "../../store/useTaskStore"

function formatElapsedTime(startMs: number): string {
    const elapsed = Math.floor((Date.now() - startMs) / 1000)
    if (elapsed < 60) return `${elapsed}s`
    const mins = Math.floor(elapsed / 60)
    const secs = elapsed % 60
    return `${mins}m ${secs}s`
}

function TaskStatusIcon({ status }: { status: TaskStatus }) {
    switch (status) {
        case "running":
        case "pending":
            return <Loader2 className="h-4 w-4 animate-spin text-blue-400" />
        case "completed":
            return (
                <div className="h-4 w-4 rounded-full bg-green-500 flex items-center justify-center">
                    <Check className="h-2.5 w-2.5 text-white" strokeWidth={3} />
                </div>
            )
        case "failed":
        case "cancelled":
            return (
                <div className="h-4 w-4 rounded-full bg-red-500 flex items-center justify-center">
                    <X className="h-2.5 w-2.5 text-white" strokeWidth={3} />
                </div>
            )
        default:
            return null
    }
}

function TaskItem({ task, onClose }: { task: Task; onClose: (id: string) => void }) {
    const { cancelTask } = useTaskStore()
    const [elapsed, setElapsed] = useState("")
    const isActive = task.status === "running" || task.status === "pending"

    useEffect(() => {
        if (!isActive) {
            // Show final elapsed time
            if (task.startedAt && task.completedAt) {
                setElapsed(formatElapsedTime(task.startedAt + (Date.now() - task.completedAt)))
            }
            return
        }
        const start = task.startedAt || task.createdAt
        const tick = () => setElapsed(formatElapsedTime(start))
        tick()
        const interval = setInterval(tick, 1000)
        return () => clearInterval(interval)
    }, [task.startedAt, task.createdAt, task.completedAt, isActive])

    const handleXClick = () => {
        if (isActive) {
            cancelTask(task.id)
        } else {
            onClose(task.id)
        }
    }

    const displayName = getTaskDisplayName(task.type)

    return (
        <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20, height: 0 }}
            transition={{ duration: 0.2 }}
            className="flex items-center gap-3 px-3 py-2.5 hover:bg-muted/50 transition-colors group rounded-lg"
        >
            {/* Task name */}
            <span className="text-xs font-semibold text-foreground whitespace-nowrap truncate min-w-0 max-w-[120px]">
                {displayName}
            </span>

            {/* Elapsed time */}
            <span className="text-[10px] font-mono text-muted-foreground whitespace-nowrap tabular-nums">
                {elapsed}
            </span>

            {/* Status icon */}
            <TaskStatusIcon status={task.status} />

            {/* Loading bar */}
            <div className="flex-1 min-w-[80px] h-[4px] rounded-full bg-muted-foreground/15 relative overflow-hidden">
                {isActive ? (
                    /* Animated indeterminate loader matching the reference CSS */
                    <div className="absolute inset-0">
                        <div
                            className="h-full rounded-full"
                            style={{
                                background: "linear-gradient(90deg, #3b82f6, #8b5cf6)",
                                animation: "taskBarMoving 1s ease-in-out infinite",
                            }}
                        />
                    </div>
                ) : task.status === "completed" ? (
                    <div
                        className="absolute inset-0 h-full rounded-full bg-gradient-to-r from-green-400 to-emerald-500"
                        style={{ width: "100%" }}
                    />
                ) : (
                    <div
                        className="absolute inset-0 h-full rounded-full bg-gradient-to-r from-red-400 to-red-500"
                        style={{ width: task.progress ? `${task.progress}%` : "30%" }}
                    />
                )}
            </div>

            {/* View button if resultUrl is available */}
            {task.status === "completed" && task.resultUrl && (
                <a
                    href={task.resultUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="shrink-0 flex items-center justify-center px-2 py-0.5 text-[10px] font-medium rounded-md bg-foreground text-background hover:min-w-fit hover:opacity-90 transition-all mr-1"
                >
                    View
                </a>
            )}

            {/* X button */}
            <button
                onClick={handleXClick}
                className="shrink-0 flex items-center justify-center h-5 w-5 rounded-full text-muted-foreground hover:text-red-500 hover:bg-red-500/10 transition-all opacity-60 group-hover:opacity-100"
                title={isActive ? "Stop task" : "Dismiss"}
            >
                <X className="h-3 w-3" />
            </button>
        </motion.div>
    )
}

export function TaskBar() {
    const { tasks, removeTask } = useTaskStore()
    const [isExpanded, setIsExpanded] = useState(false)

    // Get visible tasks: running first, then recent completed/failed
    const visibleTasks = tasks
        .filter((t) => t.status !== "cancelled" || Date.now() - t.createdAt < 30000)
        .sort((a, b) => {
            // Running tasks first
            const aActive = a.status === "running" || a.status === "pending" ? 0 : 1
            const bActive = b.status === "running" || b.status === "pending" ? 0 : 1
            if (aActive !== bActive) return aActive - bActive
            return b.createdAt - a.createdAt
        })

    const handleCloseTask = (id: string) => {
        removeTask(id)
    }

    if (visibleTasks.length === 0) return null

    const defaultShown = visibleTasks.slice(0, 1)
    const expandedShown = visibleTasks.slice(0, 5)
    const hasOverflow = visibleTasks.length > 5
    const overflowTasks = hasOverflow ? visibleTasks.slice(5) : []
    const shownTasks = isExpanded ? expandedShown : defaultShown

    return (
        <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="w-full"
        >
            <div className="bg-background/95 backdrop-blur-md border border-border rounded-2xl shadow-lg overflow-hidden">
                {/* Toggle expand header */}
                {visibleTasks.length > 1 && (
                    <button
                        onClick={() => setIsExpanded(!isExpanded)}
                        className="w-full flex items-center justify-between px-4 py-1.5 text-xs text-muted-foreground hover:text-foreground hover:bg-muted/40 transition-colors border-b border-border/50"
                    >
                        <span className="font-medium">
                            {visibleTasks.length} task{visibleTasks.length > 1 ? "s" : ""}
                        </span>
                        {isExpanded ? (
                            <ChevronDown className="h-3 w-3" />
                        ) : (
                            <ChevronUp className="h-3 w-3" />
                        )}
                    </button>
                )}

                {/* Task list */}
                <div className={`${isExpanded && hasOverflow ? "max-h-[250px] overflow-y-auto" : ""}`}>
                    <AnimatePresence>
                        {shownTasks.map((task) => (
                            <TaskItem key={task.id} task={task} onClose={handleCloseTask} />
                        ))}
                    </AnimatePresence>

                    {/* Overflow tasks (scrollable) */}
                    {isExpanded && overflowTasks.length > 0 && (
                        <AnimatePresence>
                            {overflowTasks.map((task) => (
                                <TaskItem key={task.id} task={task} onClose={handleCloseTask} />
                            ))}
                        </AnimatePresence>
                    )}
                </div>
            </div>

            {/* Inline keyframes for the animated loader bar */}
            <style>{`
        @keyframes taskBarMoving {
          0% { width: 0%; margin-left: 0; }
          50% { width: 100%; margin-left: 0; }
          100% { width: 0%; margin-left: 100%; }
        }
      `}</style>
        </motion.div>
    )
}
