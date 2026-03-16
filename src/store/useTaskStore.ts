import { create } from "zustand"

export type TaskType = "image-generation" | "3d-model" | "video-generation" | "audio-generation" | "auto-rigging" | "animation-generation" | "sprite-generation"

export type TaskStatus = "pending" | "running" | "completed" | "failed" | "cancelled"

export interface TaskConfig {
    // Image generation
    imageCount?: number
    imageResolution?: string
    // 3D model
    sourceImage?: string
    modelResolution?: string
    includeTexture?: boolean
    textPrompt?: string
    // Video
    videoPrompt?: string
    // Audio
    audioPrompt?: string
    audioType?: string
    // General
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
            return "Image Generation"
        case "3d-model":
            return "3D Model Generation"
        case "video-generation":
            return "Video Generation"
        case "audio-generation":
            return "Audio Generation"
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
    getRunningTasks: () => Task[]
    getRecentTasks: () => Task[]
}

export const useTaskStore = create<TaskStoreState>((set, get) => ({
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
}))
