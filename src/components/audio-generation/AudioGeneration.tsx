import { ChevronLeft, ChevronRight, Download } from "lucide-react"
import * as React from "react"
import { useState } from "react"
import { useAuth } from "../../hooks/useAuth"
import { cn } from "../../lib/utils"
import { uuidv4 } from "../../lib/uuid"
import { saveAudio } from "../../services/multiDbDataService"
import { saveSingleProjectFile } from "../../services/projectFiles"
import { generateAudioWithRapidElevenLabs } from "../../services/rapidElevenLabs"
import { uploadFileToDataDb } from "../../services/supabase"
import { useAppStore } from "../../store/useAppStore"
import { Button } from "../ui/button"

interface GeneratedAudioData {
  url: string
  prompt: string
  createdAt: string
}

interface AudioGenerationProps {
  isSidebarOpen?: boolean
  onToggleSidebar?: () => void
}

export function AudioGeneration({ isSidebarOpen = false, onToggleSidebar }: AudioGenerationProps) {
  const { user, isAuthenticated } = useAuth()
  const [prompt, setPrompt] = useState("")
  const [promptInfluence, setPromptInfluence] = useState(0.3)
  const [durationSeconds, setDurationSeconds] = useState<number | null>(null)
  const [isGenerating, setIsGenerating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [generatedAudios, setGeneratedAudios] = useState<GeneratedAudioData[]>([])
  const [selectedAudioIndex, setSelectedAudioIndex] = useState<number | null>(null)

  // Cache for placeholder asset ID
  const placeholderAssetIdRef = React.useRef<string | null>(null)

  // Helper function to get or create placeholder asset
  const getOrCreatePlaceholderAsset = async (userId: string): Promise<string | null> => {
    if (placeholderAssetIdRef.current) {
      return placeholderAssetIdRef.current
    }

    try {
      const { createProject, createAsset, getProjects, getAssets } = await import("../../services/supabase")

      const projects = await getProjects(userId)
      let standaloneProject = projects.find(p => p.name === "Standalone Audio")

      if (!standaloneProject) {
        standaloneProject = await createProject({
          userId,
          name: "Standalone Audio",
          description: "Audio files generated from the audio generation page",
        })
      }

      const assets = await getAssets(standaloneProject.id)
      let placeholderAsset = assets.find(a => a.type === "prop" && a.status === "concept")

      if (!placeholderAsset) {
        placeholderAsset = await createAsset({
          projectId: standaloneProject.id,
          type: "prop",
          status: "concept",
          metadata: {},
        })
      }

      placeholderAssetIdRef.current = placeholderAsset.id
      return placeholderAsset.id
    } catch (error) {
      console.warn("Error getting placeholder asset:", error)
      return null
    }
  }

  // Helper function to upload audio to storage
  const uploadAudioToStorage = async (audioUrl: string, userId: string, audioId: string): Promise<string> => {
    try {
      // If it's already a Supabase URL, return it
      if (audioUrl.startsWith("http") && !audioUrl.startsWith("blob:")) {
        if (audioUrl.includes("supabase") || audioUrl.includes("storage")) {
          return audioUrl
        }
      }

      // Fetch the audio
      const response = await fetch(audioUrl)
      if (!response.ok) {
        throw new Error(`Failed to fetch audio: ${response.statusText}`)
      }
      const blob = await response.blob()

      // Create a File from the blob
      const file = new File([blob], `${audioId}.mp3`, { type: blob.type || "audio/mpeg" })

      // Upload to Supabase storage (data database)
      const storagePath = `audio/${userId}/${audioId}.mp3`
      const publicUrl = await uploadFileToDataDb("audio", storagePath, file)

      return publicUrl
    } catch (error) {
      console.error("Error uploading audio to storage:", error)
      return audioUrl
    }
  }

  // Helper function to save generated audio
  const saveGeneratedAudio = async (audioData: {
    url: string
    prompt: string
  }) => {
    try {
      if (isAuthenticated && user) {
        const assetId = await getOrCreatePlaceholderAsset(user.id)

        const audioId = uuidv4()

        // Upload audio to storage
        const storageUrl = await uploadAudioToStorage(audioData.url, user.id, audioId)

        await saveAudio(user.id, {
          id: audioId,
          assetId: assetId || undefined,
          url: storageUrl,
          prompt: audioData.prompt,
        } as any)

        // Also save to GitHub project if connected
        const { currentProject, githubConnection, addGeneratedFile } = useAppStore.getState()
        if (currentProject) {
          try {
            const timestamp = Date.now()
            const truncId = String(timestamp).slice(-7)
            const audioFileName = `assets/audio/audio_${truncId}.mp3`
            const metadataFileName = `assets/audio/audio_${truncId}.md`

            const audioContent = `# Audio\n\n- **URL:** ${storageUrl}\n- **Prompt:** ${audioData.prompt}\n- **Generated:** ${new Date().toISOString()}\n`

            // Add to Builder sidebar
            addGeneratedFile(audioFileName, storageUrl)

            // Save metadata .md to GitHub
            await saveSingleProjectFile(
              currentProject.id,
              user.id,
              currentProject.name,
              metadataFileName,
              audioContent,
              githubConnection
            )
            console.log(`✅ Saved audio metadata to GitHub: ${metadataFileName}`)

            // Save audio reference to Supabase
            await saveSingleProjectFile(
              currentProject.id,
              user.id,
              currentProject.name,
              audioFileName,
              audioContent,
              githubConnection
            )
            console.log(`✅ Saved audio to project: ${currentProject.name}`)
          } catch (projectError) {
            console.error("Error saving audio to project:", projectError)
          }
        }
      }
    } catch (error) {
      console.error("Error saving audio:", error)
    }
  }

  const handleGenerate = async () => {
    if (!prompt.trim()) {
      setError("Please enter a prompt")
      return
    }

    setIsGenerating(true)
    setError(null)

    try {
      // Generate audio
      const audioUrl = await generateAudioWithRapidElevenLabs({
        text: prompt.trim(),
        prompt_influence: promptInfluence,
        duration_seconds: durationSeconds,
      })

      const audioData: GeneratedAudioData = {
        url: audioUrl,
        prompt: prompt.trim(),
        createdAt: new Date().toISOString(),
      }

      setGeneratedAudios([audioData, ...generatedAudios])
      setSelectedAudioIndex(0)

      // Save to database
      await saveGeneratedAudio(audioData)
    } catch (err) {
      console.error("Error generating audio:", err)
      setError(err instanceof Error ? err.message : "Failed to generate audio")
    } finally {
      setIsGenerating(false)
    }
  }

  const selectedAudio = selectedAudioIndex !== null ? generatedAudios[selectedAudioIndex] : null

  return (
    <div className="flex h-screen bg-background font-mono">
      {/* Sidebar */}
      <div
        className={cn(
          "bg-background border-r-2 border-border transition-all duration-300 flex flex-col",
          isSidebarOpen ? "w-64" : "w-16"
        )}
      >
        {/* Header */}
        <div className="border-b-2 border-border px-6 py-2 h-14 flex items-center justify-between shrink-0">
          {isSidebarOpen && <h2 className="text-sm font-bold text-foreground">Audio Generation</h2>}
          <button
            onClick={onToggleSidebar}
            className="p-1 hover:bg-muted rounded"
          >
            {isSidebarOpen ? (
              <ChevronLeft className="h-4 w-4 text-foreground" />
            ) : (
              <ChevronRight className="h-4 w-4 text-foreground" />
            )}
          </button>
        </div>

        {/* Content */}
        {isSidebarOpen && (
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            <div>
              <h3 className="text-xs font-bold text-muted-foreground mb-2">$ history</h3>
              <div className="space-y-2">
                {generatedAudios.length === 0 ? (
                  <p className="text-xs text-muted-foreground">$ no_audio_generated_yet</p>
                ) : (
                  generatedAudios.map((audio, index) => (
                    <div
                      key={index}
                      className={cn(
                        "p-2 border border-border cursor-pointer hover:bg-muted transition-colors",
                        selectedAudioIndex === index && "bg-muted border-foreground"
                      )}
                      onClick={() => setSelectedAudioIndex(index)}
                    >
                      <p className="text-xs text-muted-foreground truncate">{audio.prompt}</p>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="border-b-2 border-border px-6 py-4 flex items-center justify-between shrink-0">
          <h1 className="text-3xl font-bold text-foreground">$ audio_generation</h1>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-6">
          <div className="max-w-4xl mx-auto space-y-6">
            {/* Generation Form */}
            <div className="border-2 border-border p-6 space-y-4">
              <div>
                <label className="block text-sm font-bold text-foreground mb-2">
                  $ prompt
                </label>
                <textarea
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  placeholder={isAuthenticated ? "Enter your audio generation prompt (e.g., 'Crickets making sounds in the wild')..." : "Please login to generate audio"}
                  className="w-full border-2 border-border p-3 bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-0 font-mono text-sm resize-none disabled:opacity-50 disabled:cursor-not-allowed"
                  rows={4}
                  disabled={!isAuthenticated}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-bold text-foreground mb-2">
                    $ prompt_influence
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="1"
                    step="0.1"
                    value={promptInfluence}
                    onChange={(e) => setPromptInfluence(parseFloat(e.target.value) || 0.3)}
                    className="w-full border-2 border-border p-3 bg-background text-foreground focus:outline-none focus:ring-0 font-mono text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                    disabled={!isAuthenticated}
                  />
                  <p className="text-xs text-muted-foreground mt-1">0.0 - 1.0 (default: 0.3)</p>
                </div>

                <div>
                  <label className="block text-sm font-bold text-foreground mb-2">
                    $ duration_seconds (optional)
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={durationSeconds || ""}
                    onChange={(e) => setDurationSeconds(e.target.value ? parseInt(e.target.value) : null)}
                    placeholder="Auto"
                    className="w-full border-2 border-border p-3 bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-0 font-mono text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                    disabled={!isAuthenticated}
                  />
                  <p className="text-xs text-muted-foreground mt-1">Leave empty for auto</p>
                </div>
              </div>

              {error && (
                <div className="p-3 bg-red-50 dark:bg-red-900/20 border-2 border-red-500 text-red-700 dark:text-red-400 text-sm">
                  $ error: {error}
                </div>
              )}

              <Button
                onClick={handleGenerate}
                disabled={isGenerating || !prompt.trim() || !isAuthenticated}
                className="w-full bg-foreground text-background hover:bg-muted-foreground border border-foreground font-mono disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isGenerating ? "$ generating_audio..." : isAuthenticated ? "$ generate_audio" : "$ login_required"}
              </Button>
            </div>

            {/* Audio Preview */}
            {selectedAudio && selectedAudio.url && (
              <div className="border-2 border-border p-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-bold text-foreground">$ generated_audio</h2>
                  <a
                    href={selectedAudio.url}
                    download
                    className="px-4 py-2 bg-background text-foreground border-2 border-border hover:bg-muted font-mono text-sm flex items-center gap-2"
                  >
                    <Download className="h-4 w-4" />
                    Download
                  </a>
                </div>
                <div className="border-2 border-border p-4">
                  <audio
                    src={selectedAudio.url}
                    controls
                    className="w-full"
                  />
                </div>
                <p className="text-sm text-muted-foreground mt-2">{selectedAudio.prompt}</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

