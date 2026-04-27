export type AssetType = "character" | "prop" | "creature"
export type AssetStatus = "concept" | "images_ready" | "model_ready" | "textured" | "rigged"
export type ImageView = "front" | "left" | "right" | "back"
export type ModelFormat = "glb" | "obj" | "fbx"
export type ModelStatus = "raw" | "textured" | "rigged"
export type EnvironmentType = "day" | "night" | "noon" | "evening" | "dawn"
export type BackgroundType = "city" | "forest" | "desert" | "grassland"

export interface Project {
  id: string
  userId: string
  name: string
  description: string
  createdAt: string
  // GitHub sync fields
  githubRepoId?: string
  githubRepoName?: string
  githubRepoOwner?: string
  githubBranch?: string
  githubSyncEnabled?: boolean
  githubLastSyncedAt?: string
}

export interface Asset {
  id: string
  projectId: string
  type: AssetType
  status: AssetStatus
  metadata: {
    polycount?: number
    rigType?: string
  }
  createdAt: string
}

export interface Image {
  id: string
  assetId: string
  view: ImageView
  url: string
  prompt: string
  createdAt: string
  projectId?: string
}

export interface Model {
  id: string
  assetId: string
  url: string
  format: ModelFormat
  status: ModelStatus
  createdAt: string
  projectId?: string
}

export interface Video {
  id: string
  userId: string
  assetId?: string
  url: string
  prompt?: string
  createdAt: string
  projectId?: string
}

export interface Audio {
  id: string
  userId: string
  assetId?: string
  url: string
  prompt?: string
  createdAt: string
  projectId?: string
}

export interface Message {
  id: string
  role: "user" | "assistant"
  content: string
  images?: string[]
  generatedImages?: Array<{ view: ImageView; url: string }>
  sampleImages?: Array<{ id: number; url: string; prompt: string }> // For 2D sample images
  videos?: string[] // Array of video URLs for cutscenes
  autoImageTriggerHandled?: boolean
  autoVideoTriggerHandled?: boolean // Flag to prevent re-triggering video generation
  autoModelTriggerHandled?: boolean // Flag to prevent re-triggering 3d model generation
  autoWebSearchHandled?: boolean // Flag to prevent re-triggering web search
  model3dUrl?: string // URL for 3d model output
  isGeneratingImage?: boolean // Flag to show image generation loading state
  isGeneratingVideo?: boolean // Flag to show video generation loading state
  isGeneratingAudio?: boolean // Flag to show audio generation loading state
  isGenerating3DModel?: boolean // Flag to show 3D model generation loading state
  audioUrl?: string // URL for generated audio
  generationError?: string // Optional error message for any generation failure
  webSearchResults?: WebSearchResult // Web search results from SearchAPI
  isWebSearching?: boolean // Flag to show web search loading state
  fileOperations?: Array<{ type: 'create' | 'edit' | 'delete' | 'edit-image', path: string, content?: string }>
  timestamp: Date
}

export interface WebSearchResult {
  query: string
  organic: Array<{
    title: string
    link: string
    snippet: string
    source: string
    favicon?: string
  }>
  images: Array<{
    title: string
    link: string
    thumbnail: string
    original: string
  }>
  videos: Array<{
    title: string
    link: string
    thumbnail?: string
    source: string
    length?: string
  }>
  relatedSearches: Array<{ query: string }>
}

export interface ChatSession {
  id: string
  title: string
  messages: Message[]
  createdAt: Date
  updatedAt: Date
}

export interface Job {
  id: string
  type: "image_generation" | "model_generation" | "texture_generation" | "rigging"
  status: "pending" | "processing" | "completed" | "failed"
  progress?: number
  result?: any
  error?: string
  createdAt?: string
  updatedAt?: string
}

export interface GeneratedFile {
  path: string
  content: string
  type: "code" | "asset" | "config"
  createdAt: string
}

export interface GitHubConnection {
  accessToken: string
  repoOwner: string
  repoName: string
  branch: string
  connectedAt: string
}
