import { create } from "zustand"
import { persist } from "zustand/middleware"

export type TaskType = "image-generation" | "3d-model" | "video-generation" | "audio-generation" | "auto-rigging" | "animation-generation" | "sprite-generation" | "text-to-image" | "image-to-image" | "text-to-video" | "text-to-audio" | "text-to-3d"

export type TaskStatus = "pending" | "running" | "completed" | "failed" | "cancelled"

export interface TaskConfig {
    // Image generation
    imageCount?: number
    imageResolution?: string
    // 3D model
    sourceImage?: string
    backImage?: string
    leftImage?: string
    rightImage?: string
    modelResolution?: string
    includeTexture?: boolean
    textPrompt?: string
    // Video
    videoPrompt?: string
    // Audio
    audioPrompt?: string
    audioType?: string
    // General / API overrides
    aiModel?: string
    creditCost?: number
    estimatedTime?: string
}

export interface Task {
    id: string
    type: TaskType
    status: TaskStatus
    config: TaskConfig
    createdAt: number
    startedAt?: number
    completedAt?: number
    error?: string
    progress?: number
    resultMessageId?: string // links to the chat message holding the result
    resultUrl?: string // link to view the generated asset (opens in new tab)
    // Extended fields for background task UI
    assetName?: string       // Display name (first 8 chars of asset/prompt)
    assetUrl?: string        // URL of the generated asset once done
    assetType?: "image" | "video" | "audio" | "model" // For routing the "View" button
    prompt?: string          // The generation prompt
}

// Credit cost lookup
export function getTaskCreditCost(type: TaskType, config: TaskConfig): number {
    switch (type) {
        case "image-generation": {
            const count = config.imageCount || 4
            return count * 5 // 5 credits per image
        }
        case "3d-model":
            return config.modelResolution === "2048" ? 80 : 60
        case "video-generation":
            return 40
        case "audio-generation":
            return 20
        case "auto-rigging":
            return 50
        case "animation-generation":
            return 30
        case "sprite-generation":
            return 25
        default:
            return 10
    }
}

export function getTaskEstimatedTime(type: TaskType): string {
    switch (type) {
        case "image-generation":
            return "~20 seconds"
        case "3d-model":
            return "~40 seconds"
        case "video-generation":
            return "~60 seconds"
        case "audio-generation":
            return "~15 seconds"
        case "auto-rigging":
            return "~30 seconds"
        case "animation-generation":
            return "~25 seconds"
        case "sprite-generation":
            return "~20 seconds"
        default:
            return "~30 seconds"
    }
}

export function getTaskDisplayName(type: TaskType): string {
    switch (type) {
        case "image-generation":
        case "text-to-image":
            return "Text to Image"
        case "image-to-image":
            return "Image to Image"
        case "3d-model":
        case "text-to-3d":
            return "Text to 3D"
        case "video-generation":
        case "text-to-video":
            return "Text to Video"
        case "audio-generation":
        case "text-to-audio":
            return "Text to Audio"
        case "auto-rigging":
            return "Auto Rigging"
        case "animation-generation":
            return "Animation Generation"
        case "sprite-generation":
            return "Sprite Generation"
        default:
            return "Task"
    }
}

interface TaskStoreState {
    tasks: Task[]
    // A pending proposal that the user needs to approve/edit/cancel
    pendingProposal: {
        type: TaskType
        config: TaskConfig
    } | null

    // Actions
    proposeTask: (type: TaskType, config: TaskConfig) => void
    clearProposal: () => void
    updateProposalConfig: (config: Partial<TaskConfig>) => void
    addTask: (task: Task) => void
    updateTask: (id: string, updates: Partial<Task>) => void
    removeTask: (id: string) => void
    cancelTask: (id: string) => void
    retryTask: (id: string) => void
    getRunningTasks: () => Task[]
    getRecentTasks: () => Task[]
    getTasksByStatus: (status: TaskStatus) => Task[]
    getStatusCounts: () => { failed: number; processing: number; completed: number }
}

export const useTaskStore = create<TaskStoreState>()(
    persist(
        (set, get) => ({
            tasks: [],
            pendingProposal: null,

    proposeTask: (type, config) => {
        // Calculate credit cost and estimated time
        const creditCost = getTaskCreditCost(type, config)
        const estimatedTime = getTaskEstimatedTime(type)
        set({
            pendingProposal: {
                type,
                config: { ...config, creditCost, estimatedTime },
            },
        })
    },

    clearProposal: () => set({ pendingProposal: null }),

    updateProposalConfig: (configUpdates) => {
        const current = get().pendingProposal
        if (!current) return
        const newConfig = { ...current.config, ...configUpdates }
        // Recalculate credit cost
        newConfig.creditCost = getTaskCreditCost(current.type, newConfig)
        set({ pendingProposal: { ...current, config: newConfig } })
    },

    addTask: (task) =>
        set((state) => ({ tasks: [...state.tasks, task] })),

    updateTask: (id, updates) =>
        set((state) => ({
            tasks: state.tasks.map((t) => (t.id === id ? { ...t, ...updates } : t)),
        })),

    removeTask: (id) =>
        set((state) => ({ tasks: state.tasks.filter((t) => t.id !== id) })),

    cancelTask: (id) => {
        const task = get().tasks.find((t) => t.id === id)
        if (task && (task.status === "running" || task.status === "pending")) {
            set((state) => ({
                tasks: state.tasks.map((t) =>
                    t.id === id ? { ...t, status: "cancelled" as TaskStatus } : t
                ),
            }))
            // Dispatch cancellation event so WorkflowManager can abort
            window.dispatchEvent(
                new CustomEvent("cancel-task", { detail: { taskId: id } })
            )
        }
    },

    getRunningTasks: () => get().tasks.filter((t) => t.status === "running" || t.status === "pending"),

    getRecentTasks: () => {
        // Return tasks from the last hour, sorted by creation time descending
        const oneHourAgo = Date.now() - 60 * 60 * 1000
        return get()
            .tasks.filter((t) => t.createdAt > oneHourAgo)
            .sort((a, b) => b.createdAt - a.createdAt)
    },

    retryTask: (id) => {
        const task = get().tasks.find((t) => t.id === id)
        if (task && task.status === "failed") {
            set((state) => ({
                tasks: state.tasks.map((t) =>
                    t.id === id
                        ? { ...t, status: "pending" as TaskStatus, error: undefined, progress: 0, startedAt: undefined, completedAt: undefined }
                        : t
                ),
            }))
            // Dispatch retry event so WorkflowManager / generation handlers can re-run
            window.dispatchEvent(
                new CustomEvent("retry-task", { detail: { taskId: id, task } })
            )
        }
    },

    getTasksByStatus: (status) => get().tasks.filter((t) => t.status === status),

    getStatusCounts: () => {
        const tasks = get().tasks
        return {
            failed: tasks.filter((t) => t.status === "failed").length,
            processing: tasks.filter((t) => t.status === "running" || t.status === "pending").length,
            completed: tasks.filter((t) => t.status === "completed").length,
        }
    }}),
    {
        name: 'task-store-storage',
        // Optional: you can choose to only persist certain parts of the state
        // partialize: (state) => ({ tasks: state.tasks }),
    }
))
