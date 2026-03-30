import { create } from "zustand"
import { uuidv4 } from "../lib/uuid"

// Re-export types for convenience
export type {
  Asset, AssetStatus, AssetType, ChatSession, Image, ImageView, Job, Message, Model, ModelFormat,
  ModelStatus,
  Project,
  WebSearchResult
} from "../types"

// Import types for use in this file
import type {
  Asset,
  ChatSession,
  Image,
  Job,
  Message,
  Model,
  Project,
} from "../types"

interface AppState {
  // Current project and asset
  currentProject: Project | null
  currentAsset: Asset | null

  // Chat sessions
  sessions: ChatSession[]
  currentSessionId: string | null
  messages: Message[]

  // Current user ID (for user-specific storage)
  currentUserId: string | null

  // Images (4-view)
  images: Image[]

  // 3D Model
  currentModel: Model | null

  // Jobs
  jobs: Record<string, Job>

  // UI State
  isGenerating: boolean
  generatingText: string | null
  selectedEnvironment: "day" | "night" | "noon" | "evening" | "dawn"
  selectedBackground: "city" | "forest" | "desert" | "grassland"
  selectedModel: "fast" | "heavy"

  // Builder Mode State
  isBuilderMode: boolean
  builderModeView: "chat" | "code"
  generatedFiles: Record<string, string> // file path -> content
  githubConnection: { accessToken: string; repoOwner: string; repoName: string; branch: string } | null

  // New UI State
  leftSidebarMode: "chat" | "file"
  mainViewMode: "chat" | "viewer"
  selectedAsset: Asset | null // For the viewer
  isImageEditMode: boolean // When true, builder shows image edit form instead of viewer
  stage: string
  isSidebarOpen: boolean
  
  // Generation History
  generatedVideos: Array<{
    predictionId: string;
    url: string;
    prompt: string;
    status: "starting" | "processing" | "succeeded" | "failed";
  }>
  generatedAudio: Array<{
    id: string;
    url: string;
    prompt: string;
    status: "generating" | "succeeded" | "failed";
    type?: "tts" | "sfx" | "music";
    createdAt?: string;
  }>

  // Actions
  setStage: (stage: string) => void
  setCurrentProject: (project: Project | null) => void
  setCurrentAsset: (asset: Asset | null) => void
  setCurrentUserId: (userId: string | null) => void
  resetStore: (userId: string | null) => void
  addMessage: (message: Message) => void
  setMessages: (messages: Message[]) => void
  createNewSession: () => string
  switchSession: (sessionId: string) => void
  deleteSession: (sessionId: string) => void
  updateSessionTitle: (sessionId: string, title: string) => void
  setImages: (images: Image[]) => void
  addImage: (image: Image) => void
  setCurrentModel: (model: Model | null) => void
  addJob: (job: Job) => void
  updateJob: (jobId: string, updates: Partial<Job>) => void
  setIsGenerating: (isGenerating: boolean) => void
  setGeneratingText: (text: string | null) => void
  setSelectedEnvironment: (env: AppState["selectedEnvironment"]) => void
  setSelectedBackground: (bg: AppState["selectedBackground"]) => void
  setSelectedModel: (model: AppState["selectedModel"]) => void
  setIsBuilderMode: (isBuilderMode: boolean) => void
  setBuilderModeView: (view: "chat" | "code") => void
  addGeneratedFile: (path: string, content: string) => void
  setGeneratedFiles: (files: Record<string, string>) => void
  setGitHubConnection: (connection: AppState["githubConnection"]) => void

  // New UI Actions
  setLeftSidebarMode: (mode: "chat" | "file") => void
  setMainViewMode: (mode: "chat" | "viewer") => void
  setSelectedAsset: (asset: Asset | null) => void
  setIsImageEditMode: (isEditMode: boolean) => void

  // 3D Model specific state for Inspector
  modelGeometry: { vertices: number; faces: number } | null
  setModelGeometry: (geometry: { vertices: number; faces: number } | null) => void
  setIsSidebarOpen: (isOpen: boolean) => void
  setGeneratedVideos: (videos: AppState["generatedVideos"]) => void
  addGeneratedVideo: (video: AppState["generatedVideos"][0]) => void
  updateGeneratedVideo: (predictionId: string, updates: Partial<AppState["generatedVideos"][0]>) => void
  setGeneratedAudio: (audio: AppState["generatedAudio"]) => void
  addGeneratedAudio: (audio: AppState["generatedAudio"][0]) => void
}

// Helper functions for localStorage (user-specific)
const getStorageKey = (userId: string | null): string => {
  const userSuffix = userId ? `_${userId}` : "_guest"
  return `koye_chat_sessions${userSuffix}`
}

const getCurrentSessionKey = (userId: string | null): string => {
  const userSuffix = userId ? `_${userId}` : "_guest"
  return `koye_current_session_id${userSuffix}`
}

const loadSessions = (userId: string | null): ChatSession[] => {
  try {
    const storageKey = getStorageKey(userId)
    const saved = localStorage.getItem(storageKey)
    if (saved) {
      const parsed = JSON.parse(saved)
      return parsed.map((session: any) => ({
        ...session,
        createdAt: new Date(session.createdAt),
        updatedAt: new Date(session.updatedAt),
        messages: Array.isArray(session.messages)
          ? session.messages.map((msg: any) => ({
            ...msg,
            timestamp: new Date(msg.timestamp)
          }))
          : []
      }))
    }

    // Migration: Check for old chat history format (only for guest users)
    if (!userId) {
      const oldHistory = localStorage.getItem("koye_chat_history")
      if (oldHistory) {
        try {
          const oldMessages = JSON.parse(oldHistory).map((msg: any) => ({
            ...msg,
            timestamp: new Date(msg.timestamp)
          }))

          if (oldMessages.length > 0) {
            const migratedSession: ChatSession = {
              id: uuidv4(),
              title: generateSessionTitle(oldMessages[0]?.content || ""),
              messages: oldMessages,
              createdAt: oldMessages[0]?.timestamp || new Date(),
              updatedAt: oldMessages[oldMessages.length - 1]?.timestamp || new Date()
            }

            // Save migrated session
            const sessions = [migratedSession]
            saveSessions(sessions, userId)

            // Remove old storage
            localStorage.removeItem("koye_chat_history")

            return sessions
          }
        } catch (migrationError) {
          console.error("Failed to migrate old chat history:", migrationError)
          // Remove corrupted old data
          localStorage.removeItem("koye_chat_history")
        }
      }
    }

    return []
  } catch (error) {
    console.error("Failed to load sessions:", error)
    return []
  }
}

const saveSessions = (sessions: ChatSession[], userId: string | null) => {
  try {
    const storageKey = getStorageKey(userId)
    localStorage.setItem(storageKey, JSON.stringify(sessions.map(session => ({
      ...session,
      createdAt: session.createdAt.toISOString(),
      updatedAt: session.updatedAt.toISOString(),
      messages: Array.isArray(session.messages)
        ? session.messages.map(msg => ({
          ...msg,
          timestamp: msg.timestamp.toISOString()
        }))
        : []
    }))))
  } catch (error) {
    console.error("Failed to save sessions:", error)
  }
}

const getCurrentSessionId = (userId: string | null): string | null => {
  try {
    const sessionKey = getCurrentSessionKey(userId)
    return localStorage.getItem(sessionKey)
  } catch {
    return null
  }
}

const setCurrentSessionId = (id: string | null, userId: string | null) => {
  try {
    const sessionKey = getCurrentSessionKey(userId)
    if (id) {
      localStorage.setItem(sessionKey, id)
    } else {
      localStorage.removeItem(sessionKey)
    }
  } catch (error) {
    console.error("Failed to save current session ID:", error)
  }
}

const generateSessionTitle = (firstMessage: string): string => {
  const trimmed = firstMessage.trim()
  if (trimmed.length === 0) return "New Chat"
  return trimmed.length > 50 ? trimmed.substring(0, 50) + "..." : trimmed
}

export const useAppStore = create<AppState>((set, get) => {
  // Initialize with no user (will be set when user logs in)
  const initialUserId: string | null = null
  const initialSessions = loadSessions(initialUserId)
  const initialSessionId = getCurrentSessionId(initialUserId)

  // Find current session or create one
  let currentSession = initialSessions.find(s => s.id === initialSessionId)
  if (!currentSession && initialSessions.length > 0) {
    currentSession = initialSessions[0]
    setCurrentSessionId(currentSession.id, initialUserId)
  }

  // If no sessions exist, we'll create one on first message
  const initialMessages = currentSession?.messages || []
  const finalSessionId = currentSession?.id || null

  return {
    currentProject: null,
    currentAsset: null,
    sessions: initialSessions,
    currentSessionId: finalSessionId,
    messages: initialMessages,
    currentUserId: initialUserId,
    images: [],
    currentModel: null,
    jobs: {},
    isGenerating: false,
    generatingText: null,
    selectedEnvironment: "day",
    selectedBackground: "city",
    selectedModel: "fast",

    // Builder Mode State
    isBuilderMode: localStorage.getItem("koye_builder_mode") === "true",
    builderModeView: "chat",
    generatedFiles: {},
    githubConnection: null,

    // New UI State
    leftSidebarMode: "chat",
    mainViewMode: "chat",
    selectedAsset: null,
    isImageEditMode: false,
    modelGeometry: null,
    stage: localStorage.getItem("koye_current_stage") || "chat",
    isSidebarOpen: false,
    generatedVideos: [],
    generatedAudio: [],

    setStage: (stage) => {
      localStorage.setItem("koye_current_stage", stage)
      set({ stage })
    },
    setCurrentProject: (project) => {
      const current = get().currentProject
      if (current?.id !== project?.id) {
        set({ 
          currentProject: project,
          generatedFiles: {},  // wipe old project files to prevent bleeding across screens
          selectedAsset: null, // wipe stale UI selections
          modelGeometry: null,
          isImageEditMode: false
        })
      } else {
        set({ currentProject: project })
      }
    },
    setCurrentAsset: (asset) => set({ currentAsset: asset }),

    setCurrentUserId: (userId) => {
      const state = get()
      // If userId changed, reset store and load user-specific data
      if (state.currentUserId !== userId) {
        get().resetStore(userId)
      }
    },

    resetStore: (userId) => {
      // Load user-specific sessions
      const userSessions = loadSessions(userId)
      const userSessionId = getCurrentSessionId(userId)

      // Find current session or create one
      let userSession = userSessions.find(s => s.id === userSessionId)
      if (!userSession && userSessions.length > 0) {
        userSession = userSessions[0]
        setCurrentSessionId(userSession.id, userId)
      }

      const userMessages = userSession?.messages || []
      const finalUserSessionId = userSession?.id || null

      // Try to restore project connection from localStorage
      let restoredProject: any = null
      if (finalUserSessionId) {
        try {
          const savedProject = localStorage.getItem(`project_${finalUserSessionId}`)
          if (savedProject) {
            restoredProject = JSON.parse(savedProject)
            console.log("Restoring project connection during store reset:", restoredProject?.name)
          }
        } catch (error) {
          console.error("Error restoring project during store reset:", error)
        }
      }

      set({
        currentUserId: userId,
        sessions: userSessions,
        currentSessionId: finalUserSessionId,
        messages: userMessages,
        images: [],
        currentModel: null,
        jobs: {},
        currentProject: restoredProject, // Restore project from localStorage
        currentAsset: null,
      })
    },

    addMessage: (message) => {
      const state = get()
      const userId = state.currentUserId
      let sessionId = state.currentSessionId
      let sessions = [...state.sessions]

      // Create new session if none exists
      if (!sessionId) {
        sessionId = uuidv4()
        const newSession: ChatSession = {
          id: sessionId,
          title: generateSessionTitle(message.content),
          messages: [message],
          createdAt: new Date(),
          updatedAt: new Date()
        }
        sessions.push(newSession)
        setCurrentSessionId(sessionId, userId)
        saveSessions(sessions, userId)
        set({
          sessions,
          currentSessionId: sessionId,
          messages: [message]
        })
        return
      }

      // Update existing session
      const sessionIndex = sessions.findIndex(s => s.id === sessionId)
      if (sessionIndex === -1) {
        // Session not found, create new one
        const newSession: ChatSession = {
          id: sessionId,
          title: generateSessionTitle(message.content),
          messages: [message],
          createdAt: new Date(),
          updatedAt: new Date()
        }
        sessions.push(newSession)
      } else {
        // Update existing session
        const updatedMessages = [...sessions[sessionIndex].messages, message]
        sessions[sessionIndex] = {
          ...sessions[sessionIndex],
          messages: updatedMessages,
          updatedAt: new Date(),
          // Update title from first user message if it's still "New Chat"
          title: sessions[sessionIndex].title === "New Chat" && message.role === "user"
            ? generateSessionTitle(message.content)
            : sessions[sessionIndex].title
        }
      }

      saveSessions(sessions, userId)
      set({
        sessions,
        messages: sessions.find(s => s.id === sessionId)?.messages || []
      })
    },

    setMessages: (messages) => set((state) => {
      const userId = state.currentUserId
      let updatedSessions = state.sessions

      if (state.currentSessionId) {
        let sessionUpdated = false
        updatedSessions = state.sessions.map((session) => {
          if (session.id === state.currentSessionId) {
            sessionUpdated = true
            return {
              ...session,
              messages,
              updatedAt: new Date(),
            }
          }
          return session
        })

        if (sessionUpdated) {
          saveSessions(updatedSessions, userId)
        }
      }

      return {
        messages,
        sessions: updatedSessions,
      }
    }),

    createNewSession: () => {
      const newSessionId = uuidv4()
      const newSession: ChatSession = {
        id: newSessionId,
        title: "New Chat",
        messages: [],
        createdAt: new Date(),
        updatedAt: new Date()
      }

      const state = get()
      const userId = state.currentUserId
      const updatedSessions = [newSession, ...state.sessions]
      saveSessions(updatedSessions, userId)
      setCurrentSessionId(newSessionId, userId)

      set({
        sessions: updatedSessions,
        currentSessionId: newSessionId,
        messages: []
      })

      return newSessionId
    },

    switchSession: (sessionId: string) => {
      const state = get()
      const userId = state.currentUserId
      const session = state.sessions.find(s => s.id === sessionId)
      if (session) {
        setCurrentSessionId(sessionId, userId)
        set({
          currentSessionId: sessionId,
          messages: session.messages
        })
      }
    },

    deleteSession: (sessionId: string) => {
      const state = get()
      const userId = state.currentUserId
      const updatedSessions = state.sessions.filter(s => s.id !== sessionId)
      saveSessions(updatedSessions, userId)

      // If deleting current session, switch to another or create new
      if (state.currentSessionId === sessionId) {
        if (updatedSessions.length > 0) {
          const nextSession = updatedSessions[0]
          setCurrentSessionId(nextSession.id, userId)
          set({
            sessions: updatedSessions,
            currentSessionId: nextSession.id,
            messages: nextSession.messages
          })
        } else {
          setCurrentSessionId(null, userId)
          set({
            sessions: [],
            currentSessionId: null,
            messages: []
          })
        }
      } else {
        set({ sessions: updatedSessions })
      }
    },

    updateSessionTitle: (sessionId: string, title: string) => {
      const state = get()
      const userId = state.currentUserId
      const sessions = [...state.sessions]
      const sessionIndex = sessions.findIndex(s => s.id === sessionId)

      if (sessionIndex !== -1) {
        sessions[sessionIndex] = {
          ...sessions[sessionIndex],
          title,
          updatedAt: new Date()
        }
        saveSessions(sessions, userId)
        set({ sessions })
      }
    },

    setImages: (images) => set({ images }),
    addImage: (image) => set((state) => ({ images: [...state.images, image] })),
    setCurrentModel: (model) => set({ currentModel: model }),
    addJob: (job) => set((state) => ({ jobs: { ...state.jobs, [job.id]: job } })),
    updateJob: (jobId, updates) => set((state) => ({
      jobs: {
        ...state.jobs,
        [jobId]: { ...state.jobs[jobId], ...updates }
      }
    })),
    setIsGenerating: (isGenerating) => set({ isGenerating }),
    setGeneratingText: (generatingText) => set({ generatingText }),
    setSelectedEnvironment: (selectedEnvironment) => set({ selectedEnvironment }),
    setSelectedBackground: (selectedBackground) => set({ selectedBackground }),
    setSelectedModel: (selectedModel) => set({ selectedModel }),

    // Builder Mode Actions
    setIsBuilderMode: (isBuilderMode) => {
      localStorage.setItem("koye_builder_mode", String(isBuilderMode))
      set({ isBuilderMode })
    },
    setBuilderModeView: (builderModeView) => set({ builderModeView }),
    addGeneratedFile: (path, content) => set((state) => ({
      generatedFiles: { ...state.generatedFiles, [path]: content }
    })),
    setGeneratedFiles: (generatedFiles) => set({ generatedFiles }),
    setGitHubConnection: (githubConnection) => set({ githubConnection }),

    // New UI Actions
    setLeftSidebarMode: (leftSidebarMode) => set({ leftSidebarMode }),
    setMainViewMode: (mainViewMode) => set({ mainViewMode }),
    setSelectedAsset: (selectedAsset) => set({ selectedAsset }),
    setIsImageEditMode: (isImageEditMode) => set({ isImageEditMode }),
    setModelGeometry: (modelGeometry) => set({ modelGeometry }),
    setIsSidebarOpen: (isSidebarOpen) => set({ isSidebarOpen }),
    setGeneratedVideos: (generatedVideos) => set({ generatedVideos }),
    addGeneratedVideo: (video) => set((state) => ({ 
      generatedVideos: [video, ...state.generatedVideos] 
    })),
    updateGeneratedVideo: (predictionId, updates) => set((state) => ({
      generatedVideos: state.generatedVideos.map((v) => 
        v.predictionId === predictionId ? { ...v, ...updates } : v
      )
    })),
    setGeneratedAudio: (generatedAudio) => set({ generatedAudio }),
    addGeneratedAudio: (audio) => set((state) => ({ 
      generatedAudio: [audio, ...state.generatedAudio] 
    })),
  }
})
