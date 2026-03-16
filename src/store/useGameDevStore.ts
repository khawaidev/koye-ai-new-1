import { create } from "zustand"
import { persist } from "zustand/middleware"

export interface GameAsset {
    id: string
    name: string
    type: "character" | "prop" | "environment" | "vehicle" | "weapon" | "other"
    description: string
    status: "pending" | "generating_images" | "images_generated" | "generating_model" | "model_generated" | "rigging" | "rigged" | "generating_animations" | "animations_generated" | "generating_audio" | "audio_generated" | "complete"

    // Artifacts
    imagePrompts?: string[]
    imageUrls?: string[]
    selectedImageIndex?: number

    modelPrompt?: string
    modelUrl?: string
    modelFormat?: "glb" | "fbx" | "obj"

    riggingStatus?: "not_needed" | "pending" | "processing" | "complete" | "failed"

    animations?: GameAnimation[]

    audio?: GameAudio[]
}

export interface GameAnimation {
    id: string
    name: string
    url?: string
    status: "pending" | "generating" | "complete" | "failed"
}

export interface GameAudio {
    id: string
    name: string
    type: "sfx" | "voice" | "environment"
    prompt: string
    url?: string
    status: "pending" | "generating" | "complete" | "failed"
}

interface ProjectGameDevState {
    isActive: boolean
    currentStep: number
    gameDescription: string
    assets: GameAsset[]
    currentAssetId: string | null
    gameType: "2d" | "3d" | null
}

interface GameDevState extends ProjectGameDevState {
    // Global state
    projectStates: Record<string, ProjectGameDevState>

    // Actions
    startFlow: () => void
    setStep: (step: number) => void
    setGameDescription: (desc: string) => void
    addAsset: (asset: GameAsset) => void
    updateAsset: (id: string, updates: Partial<GameAsset>) => void
    setCurrentAssetId: (id: string | null) => void
    setGameType: (gameType: "2d" | "3d") => void
    resetFlow: () => void

    // Project management actions
    saveProjectState: (projectId: string) => void
    loadProjectState: (projectId: string) => void
    clearActiveState: () => void
}

const defaultState: ProjectGameDevState = {
    isActive: false,
    currentStep: 0,
    gameDescription: "",
    assets: [],
    currentAssetId: null,
    gameType: null
}

export const useGameDevStore = create<GameDevState>()(
    persist(
        (set, get) => ({
            ...defaultState,
            projectStates: {},

            startFlow: () => set({ isActive: true, currentStep: 1 }),
            setStep: (step) => set({ currentStep: step }),
            setGameDescription: (desc) => set({ gameDescription: desc }),
            addAsset: (asset) => set((state) => ({ assets: [...state.assets, asset] })),
            updateAsset: (id, updates) => set((state) => ({
                assets: state.assets.map((a) => (a.id === id ? { ...a, ...updates } : a))
            })),
            setCurrentAssetId: (id) => set({ currentAssetId: id }),
            setGameType: (gameType) => set({ gameType, isActive: true, currentStep: 1 }),
            resetFlow: () => set({ ...defaultState }),

            saveProjectState: (projectId) => {
                const state = get()
                const projectState: ProjectGameDevState = {
                    isActive: state.isActive,
                    currentStep: state.currentStep,
                    gameDescription: state.gameDescription,
                    assets: state.assets,
                    currentAssetId: state.currentAssetId,
                    gameType: state.gameType
                }
                set((state) => ({
                    projectStates: {
                        ...state.projectStates,
                        [projectId]: projectState
                    }
                }))
            },

            loadProjectState: (projectId) => {
                const state = get()
                const savedState = state.projectStates[projectId]
                if (savedState) {
                    set({ ...savedState })
                } else {
                    set({ ...defaultState })
                }
            },

            clearActiveState: () => set({ ...defaultState })
        }),
        {
            name: "koye-game-dev-storage",
        }
    )
)
