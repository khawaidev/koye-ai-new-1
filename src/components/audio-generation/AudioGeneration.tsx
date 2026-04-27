import {
  Download,
  Search,
  Play,
  Pause,
  FastForward,
  Rewind,
  Share2,
  Heart,
  ThumbsUp,
  ThumbsDown,
  ChevronRight,
  ChevronDown,
  Zap,
  Clock,
  ArrowUpRight,
  BarChart3,
  Loader2,
  Check,
  FolderInput
} from "lucide-react"
import { useState, useRef, useCallback } from "react"
import { useTaskStore } from "../../store/useTaskStore"
import { checkRateLimit, recordRequest, getRateLimitMessage } from "../../services/rateLimiter"
import { useToast } from "../ui/toast"
import { ImportToProjectPopup } from "../ui/ImportToProjectPopup"
import { useAuth } from "../../hooks/useAuth"
import { uuidv4 } from "../../lib/uuid"
import { saveAudio } from "../../services/multiDbDataService"
import { generateSoundEffect } from "../../services/sfxGeneration"
import { generateMusic } from "../../services/musicGeneration"
import { generateSpeech, getVoices } from "../../services/ttsService"
import { uploadFileToDataDb } from "../../services/supabase"
import { useAppStore } from "../../store/useAppStore"
import { Button } from "../ui/button"
import { cn } from "../../lib/utils"

type AudioTab = "tts" | "sfx" | "music"

const SFX_CATEGORIES = [
  { id: "animals", name: "Animals", image: "https://images.unsplash.com/photo-1546182990-dffeafbe841d?w=200&h=200&fit=crop" },
  { id: "bass", name: "Bass", image: "https://images.unsplash.com/photo-1508700115892-45ecd05ae2ad?w=200&h=200&fit=crop" },
  { id: "booms", name: "Booms", image: "https://images.unsplash.com/photo-1469474968028-56623f02e42e?w=200&h=200&fit=crop" },
  { id: "braams", name: "Braams", image: "https://images.unsplash.com/photo-1514525253344-7634f19b2241?w=200&h=200&fit=crop" },
  { id: "brass", name: "Brass", image: "https://images.unsplash.com/photo-1573871666457-7c7329118cf9?w=200&h=200&fit=crop" },
  { id: "cymbals", name: "Cymbals", image: "https://images.unsplash.com/photo-1519892300165-cb5542fb47c7?w=200&h=200&fit=crop" },
  { id: "devices", name: "Devices", image: "https://images.unsplash.com/photo-1519389950473-47ba0277781c?w=200&h=200&fit=crop" },
]

const MUSIC_CATEGORIES = [
  { id: "toppicks", name: "Top picks", gradient: "from-pink-500 to-orange-500" },
  { id: "chill", name: "Chill", gradient: "from-blue-500 to-cyan-500" },
  { id: "travel", name: "Travel", gradient: "from-green-500 to-teal-500" },
  { id: "gaming", name: "Gaming", gradient: "from-purple-500 to-indigo-500" },
  { id: "holidays", name: "Holidays", gradient: "from-red-500 to-pink-500" },
  { id: "feel-good", name: "Feel-good", gradient: "from-yellow-500 to-orange-500" },
  { id: "moody", name: "Moody", gradient: "from-indigo-900 to-purple-900" },
]

const MOCK_SFX = [
  { id: "s1", title: "censored", tags: "Human", duration: "2s", downloads: "602" },
  { id: "s2", title: "zoo", tags: "Animals > Wild", duration: "27s", downloads: "380" },
  { id: "s3", title: "Windy mountain region", tags: "Ambience > Alpine", duration: "1m 30s", downloads: "705" },
  { id: "s4", title: "Create a short mobile app", tags: "User Interface > Alert", duration: "1s", downloads: "176" },
]

const MOCK_MUSIC = [
  { id: "m1", title: "Take Your Time", artist: "Patrick Patr...", tags: "Amapiano, ...", duration: "2m 0s", bpm: "112 BPM", image: "https://images.unsplash.com/photo-1459749411177-042180ce673c?w=100&h=100&fit=crop" },
  { id: "m2", title: "Half Two", artist: "Patrick Patr...", tags: "UK Garage, ...", duration: "2m 0s", bpm: "132 BPM", image: "https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=100&h=100&fit=crop" },
  { id: "m3", title: "Silence Reminds Me", artist: "Patrick Patr...", tags: "UK Garage, ...", duration: "2m 0s", bpm: "129 BPM", image: "https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=100&h=100&fit=crop" },
  { id: "m4", title: "Island Samba", artist: "Callira Flow", tags: "Samba, ...", duration: "3m 0s", bpm: "105 BPM", image: "https://images.unsplash.com/photo-1514525253344-7634f19b2241?w=100&h=100&fit=crop" },
]

// ─── TTS Model Options ─────────────────────
const TTS_MODELS = [
  { id: "eleven_multilingual_v2", label: "Multilingual v2", tag: "V2", desc: "Most expressive, 29 languages" },
  { id: "eleven_flash_v2_5", label: "Flash v2.5", tag: "⚡", desc: "Ultra-low latency, 32 languages" }]

// ─── SFX Duration Options ──────────────────
const SFX_DURATION_OPTIONS = [
  { label: "Auto", value: null },
  { label: "1s", value: 1 },
  { label: "2s", value: 2 },
  { label: "5s", value: 5 },
  { label: "10s", value: 10 },
  { label: "22s", value: 22 },
]

// ─── Music Duration Options ────────────────
const MUSIC_DURATION_OPTIONS = [
  { label: "Auto", value: 0 },
  { label: "15s", value: 15000 },
  { label: "30s", value: 30000 },
  { label: "60s", value: 60000 },
  { label: "2m", value: 120000 },
  { label: "5m", value: 300000 },
]

export function AudioGeneration() {
  const { user, isAuthenticated } = useAuth()
  const { generatedAudio, addGeneratedAudio, setStage } = useAppStore()
  const { addTask, updateTask } = useTaskStore()
  const { addToast } = useToast()
  const [activeTab, setActiveTab] = useState<AudioTab>("tts")
  const [isGenerating, setIsGenerating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  
  const [importPopup, setImportPopup] = useState<{ isOpen: boolean; url: string; type: "audio"; name: string } | null>(null)

  // ─── TTS States ────────────────────────────
  const [ttsText, setTtsText] = useState("")
  const [voiceId, setVoiceId] = useState("JBFqnCBsd6RMkjVDRZzb")
  const [ttsModel, setTtsModel] = useState("eleven_multilingual_v2")
  const [speed, setSpeed] = useState(1.0)
  const [stability, setStability] = useState(0.5)
  const [similarity, setSimilarity] = useState(0.75)
  const [styleExaggeration, setStyleExaggeration] = useState(0.0)
  const [voices, setVoices] = useState<Array<{ voice_id: string; name: string; category: string }>>([])
  const [voicesLoading, setVoicesLoading] = useState(false)
  const [showVoicePicker, setShowVoicePicker] = useState(false)
  const [showModelPicker, setShowModelPicker] = useState(false)
  const [voiceSearch, setVoiceSearch] = useState("")

  // ─── SFX States ────────────────────────────
  const [sfxPrompt, setSfxPrompt] = useState("")
  const [sfxInfluence, setSfxInfluence] = useState(0.3)
  const [sfxDuration, setSfxDuration] = useState<number | null>(null)
  const [showSfxDuration, setShowSfxDuration] = useState(false)
  const [showSfxInfluence, setShowSfxInfluence] = useState(false)

  // ─── Music States ──────────────────────────
  const [musicPrompt, setMusicPrompt] = useState("")
  const [musicDuration, setMusicDuration] = useState(30000)
  const [showMusicDuration, setShowMusicDuration] = useState(false)
  const [musicInstrumental, setMusicInstrumental] = useState(false)

  const [_currentAudioUrl, setCurrentAudioUrl] = useState<string | null>(null)
  const [audioMetadata, setAudioMetadata] = useState<{ title: string, artist: string, image: string } | null>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const audioRef = useRef<HTMLAudioElement | null>(null)

  // ─── Fetch Voices ──────────────────────────
  const fetchVoices = useCallback(async () => {
    if (voices.length > 0 || voicesLoading) return
    setVoicesLoading(true)
    try {
      const v = await getVoices()
      setVoices(v)
    } catch (e) {
      console.error("Failed to fetch voices:", e)
    } finally {
      setVoicesLoading(false)
    }
  }, [voices.length, voicesLoading])

  const selectedVoice = voices.find(v => v.voice_id === voiceId)
  const selectedModel = TTS_MODELS.find(m => m.id === ttsModel) || TTS_MODELS[0]
  const filteredVoices = voiceSearch
    ? voices.filter(v => v.name.toLowerCase().includes(voiceSearch.toLowerCase()))
    : voices

  const handlePlayAudio = (url: string, metadata: { title: string, artist: string, image: string }) => {
    setCurrentAudioUrl(url)
    setAudioMetadata(metadata)
    setIsPlaying(true)
    if (audioRef.current) {
      audioRef.current.src = url
      audioRef.current.play().catch(console.error)
    }
  }

  const formatTime = (time: number) => {
    const mins = Math.floor(time / 60)
    const secs = Math.floor(Math.floor(time % 60))
    return `${mins}:${secs.toString().padStart(2, "0")}`
  }

  const handleTogglePlay = () => {
    if (audioRef.current) {
      if (isPlaying) audioRef.current.pause()
      else audioRef.current.play()
      setIsPlaying(!isPlaying)
    }
  }

  // ─── Shared Database Saving ─────────────────
  const placeholderAssetIdRef = useRef<string | null>(null)

  const getOrCreatePlaceholderAsset = async (userId: string): Promise<string | null> => {
    if (placeholderAssetIdRef.current) return placeholderAssetIdRef.current
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
    } catch {
      return null
    }
  }

  const uploadAudioToStorage = async (audioUrl: string, userId: string, audioId: string): Promise<string> => {
    try {
      if (audioUrl.startsWith("http") && !audioUrl.startsWith("blob:") && (audioUrl.includes("supabase") || audioUrl.includes("storage"))) {
        return audioUrl
      }
      const response = await fetch(audioUrl)
      if (!response.ok) throw new Error("Failed to fetch audio")
      const blob = await response.blob()
      const file = new File([blob], `${audioId}.mp3`, { type: blob.type || "audio/mpeg" })
      const storagePath = `audio/${userId}/${audioId}.mp3`
      return await uploadFileToDataDb("audio", storagePath, file)
    } catch (e) {
      console.error(e)
      return audioUrl
    }
  }

  const saveGeneratedAudioToDb = async (audioData: { url: string; prompt: string; type: "tts" | "sfx" | "music" }) => {
    if (!isAuthenticated || !user) return
    try {
      const assetId = await getOrCreatePlaceholderAsset(user.id)
      const audioId = uuidv4()
      const storageUrl = await uploadAudioToStorage(audioData.url, user.id, audioId)
      await saveAudio(user.id, {
        id: audioId,
        assetId: assetId || undefined,
        url: storageUrl,
        prompt: audioData.prompt,
        type: audioData.type,
        createdAt: new Date().toISOString()
      } as any)
    } catch (e) {
      console.error("Error saving audio:", e)
    }
  }

  // ─── Generation Handlers ────────────────────
  const handleGenerateTTS = async () => {
    if (!ttsText.trim()) return

    const rateCheck = checkRateLimit("audio-generation")
    if (!rateCheck.allowed) {
      const msg = getRateLimitMessage("audio-generation", rateCheck.retryAfterMs)
      setError(msg)
      addToast({ title: "Rate Limit", description: msg, variant: "warning" })
      return
    }
    recordRequest("audio-generation")

    const taskId = uuidv4()
    const assetName = "TTS: " + ttsText.trim().substring(0, 10)
    addTask({
      id: taskId,
      type: "text-to-audio",
      status: "running",
      config: {},
      createdAt: Date.now(),
      startedAt: Date.now(),
      assetName,
      assetType: "audio",
      prompt: ttsText.trim(),
    })

    addToast({
      title: "Audio Generation Started",
      description: "Speech generation sent to background",
      variant: "info",
    })

    setIsGenerating(true)
    setError(null)
    try {
      const url = await generateSpeech({
        text: ttsText.trim(),
        voiceId,
        modelId: ttsModel,
        speed,
        stability,
        similarityBoost: similarity,
        style: styleExaggeration,
      })
      const audioData = { id: uuidv4(), url, prompt: ttsText.substring(0, 50), status: "succeeded" as const, type: "tts" as const, createdAt: new Date().toISOString() }
      addGeneratedAudio(audioData as any)
      setCurrentAudioUrl(url)
      
      updateTask(taskId, { status: "completed", completedAt: Date.now(), assetUrl: url, resultUrl: url })
      addToast({
        title: "Audio Ready",
        description: "Your generated speech is ready",
        variant: "success",
        action: { label: "View", onClick: () => setStage("audioGeneration") },
      })

      await saveGeneratedAudioToDb(audioData)
    } catch (e: any) { 
      setError(e.message) 
      updateTask(taskId, { status: "failed", error: e.message, completedAt: Date.now() })
      addToast({ title: "Generation Failed", description: e.message, variant: "error" })
    } finally { setIsGenerating(false) }
  }

  const handleGenerateSFX = async () => {
    if (!sfxPrompt.trim()) return

    const rateCheck = checkRateLimit("audio-generation")
    if (!rateCheck.allowed) {
      const msg = getRateLimitMessage("audio-generation", rateCheck.retryAfterMs)
      setError(msg)
      addToast({ title: "Rate Limit", description: msg, variant: "warning" })
      return
    }
    recordRequest("audio-generation")

    const taskId = uuidv4()
    const assetName = "SFX: " + sfxPrompt.trim().substring(0, 10)
    addTask({
      id: taskId,
      type: "audio-generation",
      status: "running",
      config: {},
      createdAt: Date.now(),
      startedAt: Date.now(),
      assetName,
      assetType: "audio",
      prompt: sfxPrompt.trim(),
    })

    addToast({
      title: "Audio Generation Started",
      description: "SFX generation sent to background",
      variant: "info",
    })

    setIsGenerating(true)
    setError(null)
    try {
      const url = await generateSoundEffect({
        text: sfxPrompt.trim(),
        prompt_influence: sfxInfluence,
        duration_seconds: sfxDuration || undefined,
      })
      const audioData = { id: uuidv4(), url, prompt: sfxPrompt, status: "succeeded" as const, type: "sfx" as const, createdAt: new Date().toISOString() }
      addGeneratedAudio(audioData as any)
      setCurrentAudioUrl(url)

      updateTask(taskId, { status: "completed", completedAt: Date.now(), assetUrl: url, resultUrl: url })
      addToast({
        title: "SFX Ready",
        description: "Your sound effect is ready",
        variant: "success",
        action: { label: "View", onClick: () => setStage("audioGeneration") },
      })

      await saveGeneratedAudioToDb(audioData)
    } catch (e: any) { 
      setError(e.message) 
      updateTask(taskId, { status: "failed", error: e.message, completedAt: Date.now() })
      addToast({ title: "Generation Failed", description: e.message, variant: "error" })
    } finally { setIsGenerating(false) }
  }

  const handleGenerateMusic = async () => {
    if (!musicPrompt.trim()) return

    const rateCheck = checkRateLimit("audio-generation")
    if (!rateCheck.allowed) {
      const msg = getRateLimitMessage("audio-generation", rateCheck.retryAfterMs)
      setError(msg)
      addToast({ title: "Rate Limit", description: msg, variant: "warning" })
      return
    }
    recordRequest("audio-generation")

    const taskId = uuidv4()
    const assetName = "Music: " + musicPrompt.trim().substring(0, 10)
    addTask({
      id: taskId,
      type: "audio-generation",
      status: "running",
      config: {},
      createdAt: Date.now(),
      startedAt: Date.now(),
      assetName,
      assetType: "audio",
      prompt: musicPrompt.trim(),
    })

    addToast({
      title: "Audio Generation Started",
      description: "Music generation sent to background",
      variant: "info",
    })

    setIsGenerating(true)
    setError(null)
    try {
      const finalPrompt = musicInstrumental
        ? `${musicPrompt.trim()} (instrumental only, no vocals)`
        : musicPrompt.trim()
      const durationMs = musicDuration === 0 ? 30000 : musicDuration
      const url = await generateMusic({ prompt: finalPrompt, durationMs })
      const audioData = { id: uuidv4(), url, prompt: musicPrompt, status: "succeeded" as const, type: "music" as const, createdAt: new Date().toISOString() }
      addGeneratedAudio(audioData as any)
      setCurrentAudioUrl(url)

      updateTask(taskId, { status: "completed", completedAt: Date.now(), assetUrl: url, resultUrl: url })
      addToast({
        title: "Music Ready",
        description: "Your generated music track is ready",
        variant: "success",
        action: { label: "View", onClick: () => setStage("audioGeneration") },
      })

      await saveGeneratedAudioToDb(audioData)
    } catch (e: any) { 
      setError(e.message) 
      updateTask(taskId, { status: "failed", error: e.message, completedAt: Date.now() })
      addToast({ title: "Generation Failed", description: e.message, variant: "error" })
    } finally { setIsGenerating(false) }
  }

  // ─── Rendering Helper ───────────────────────
  const renderWaveform = (count = 40) => (
    <div className="flex items-center gap-[1px] h-6">
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="w-[2px] bg-muted-foreground/30 rounded-full"
          style={{ height: `${Math.max(2, Math.random() * 100)}%` }}
        />
      ))}
    </div>
  )

  return (
    <div className="flex flex-col h-full bg-background text-foreground overflow-hidden font-sans">
      <audio
        ref={audioRef}
        onTimeUpdate={(e) => setCurrentTime(e.currentTarget.currentTime)}
        onLoadedMetadata={(e) => setDuration(e.currentTarget.duration)}
        onEnded={() => setIsPlaying(false)}
      />

      {/* ─── Top Nav ─── */}
      <div className="flex items-center gap-4 px-6 py-4 border-b border-border shrink-0">
        <div className="flex bg-muted rounded-full p-1">
          <button
            onClick={() => setActiveTab("tts")}
            className={cn(
              "px-4 py-1.5 rounded-full text-xs font-medium transition-all",
              activeTab === "tts" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
            )}
          >
            Text to Speech
          </button>
          <button
            onClick={() => setActiveTab("sfx")}
            className={cn(
              "px-4 py-1.5 rounded-full text-xs font-medium transition-all",
              activeTab === "sfx" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
            )}
          >
            Sound Effects
          </button>
          <button
            onClick={() => setActiveTab("music")}
            className={cn(
              "px-4 py-1.5 rounded-full text-xs font-medium transition-all",
              activeTab === "music" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
            )}
          >
            Music
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-hidden relative">
        {/* ─── TTS Page ─── */}
        {activeTab === "tts" && (
          <div className="flex h-full">
            {/* Left Main */}
            <div className="flex-1 flex flex-col p-8 overflow-y-auto pb-32">
              <textarea
                value={ttsText}
                onChange={e => setTtsText(e.target.value)}
                className="flex-1 bg-transparent border-none focus:ring-0 text-base placeholder:text-muted-foreground/30 resize-none min-h-[300px] outline-none border-0"
                placeholder="Start typing here or paste any text you want to turn into lifelike speech..."
              />

              {/* Smooth fade for suggestions */}
              <div
                className="mt-8 space-y-4 transition-all duration-500 ease-in-out"
                style={{
                  opacity: ttsText.trim() ? 0 : 1,
                  maxHeight: ttsText.trim() ? 0 : 300,
                  overflow: "hidden",
                  transform: ttsText.trim() ? "translateY(10px)" : "translateY(0)",
                  pointerEvents: ttsText.trim() ? "none" : "auto",
                }}
              >
                <p className="text-sm font-semibold text-muted-foreground">Get started with</p>
                <div className="flex flex-wrap gap-2">
                  {[
                    "Narrate a story",
                    "Tell a silly joke",
                    "Record an advertisement",
                    "Speak in different languages",
                    "Direct a dramatic movie scene",
                    "Hear from a video game character",
                    "Introduce your podcast",
                    "Guide a meditation class"
                  ].map(chip => (
                    <button
                      key={chip}
                      onClick={() => setTtsText(chip)}
                      className="px-4 py-2 bg-muted hover:bg-muted-foreground/10 border border-border rounded-xl text-xs font-medium transition-colors"
                    >
                      {chip}
                    </button>
                  ))}
                </div>
              </div>
            </div>


            {/* Right Settings */}
            <div className="w-[400px] border-l border-border bg-background/50 backdrop-blur-sm p-6 overflow-y-auto pb-40 flex flex-col">
              <div className="flex gap-4 mb-6 border-b border-border pb-2">
                <button className="text-sm font-bold border-b-2 border-foreground pb-2">Settings</button>
                <button className="text-sm font-medium text-muted-foreground pb-2">History</button>
              </div>

              <div className="space-y-6">
                {/* ── Voice Picker ── */}
                <div className="relative">
                  <label className="text-xs font-bold text-muted-foreground uppercase mb-2 block">Voice</label>
                  <button
                    onClick={() => { setShowVoicePicker(!showVoicePicker); setShowModelPicker(false); if (!showVoicePicker) fetchVoices() }}
                    className="w-full flex items-center justify-between p-3 bg-muted border border-border rounded-xl hover:border-foreground/20 transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      <div className="w-5 h-5 bg-foreground rounded-full flex items-center justify-center text-background text-[8px] font-bold">
                        {(selectedVoice?.name || "G")[0]}
                      </div>
                      <span className="text-sm font-medium truncate">{selectedVoice?.name || "George"}</span>
                      {selectedVoice?.category && (
                        <span className="text-[9px] text-muted-foreground bg-muted-foreground/10 px-1.5 py-0.5 rounded">{selectedVoice.category}</span>
                      )}
                    </div>
                    <ChevronDown className={cn("w-4 h-4 text-muted-foreground transition-transform", showVoicePicker && "rotate-180")} />
                  </button>
                  {showVoicePicker && (
                    <div className="absolute z-50 mt-1 w-full bg-background border border-border rounded-xl shadow-2xl max-h-72 overflow-hidden flex flex-col animate-in fade-in slide-in-from-top-1 duration-200">
                      <div className="p-2 border-b border-border">
                        <input
                          value={voiceSearch}
                          onChange={e => setVoiceSearch(e.target.value)}
                          placeholder="Search voices..."
                          className="w-full bg-muted border-0 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-foreground/20"
                          autoFocus
                        />
                      </div>
                      <div className="overflow-y-auto flex-1">
                        {voicesLoading ? (
                          <div className="flex items-center justify-center py-8">
                            <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                          </div>
                        ) : filteredVoices.length === 0 ? (
                          <div className="text-center text-xs text-muted-foreground py-8">No voices found</div>
                        ) : (
                          filteredVoices.map(v => (
                            <button
                              key={v.voice_id}
                              onClick={() => { setVoiceId(v.voice_id); setShowVoicePicker(false); setVoiceSearch("") }}
                              className={cn(
                                "w-full flex items-center gap-3 px-3 py-2.5 text-left hover:bg-muted transition-colors text-sm",
                                v.voice_id === voiceId && "bg-muted"
                              )}
                            >
                              <div className="w-6 h-6 bg-foreground/10 rounded-full flex items-center justify-center text-[9px] font-bold shrink-0">
                                {v.name[0]}
                              </div>
                              <div className="flex-1 min-w-0">
                                <span className="font-medium truncate block">{v.name}</span>
                                <span className="text-[10px] text-muted-foreground">{v.category}</span>
                              </div>
                              {v.voice_id === voiceId && <Check className="w-4 h-4 text-foreground shrink-0" />}
                            </button>
                          ))
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {/* ── Model Picker ── */}
                <div className="relative">
                  <label className="text-xs font-bold text-muted-foreground uppercase mb-2 block">Model</label>
                  <button
                    onClick={() => { setShowModelPicker(!showModelPicker); setShowVoicePicker(false) }}
                    className="relative w-full p-4 border border-border rounded-xl bg-muted/50 hover:bg-muted transition-all cursor-pointer text-left"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="px-1.5 py-0.5 border border-foreground/20 rounded text-[10px] font-bold">{selectedModel.tag}</div>
                        <span className="text-sm font-semibold text-foreground">{selectedModel.label}</span>
                      </div>
                      <ChevronDown className={cn("w-4 h-4 text-muted-foreground transition-transform", showModelPicker && "rotate-180")} />
                    </div>
                    <p className="text-[10px] text-muted-foreground mt-2">{selectedModel.desc}</p>
                  </button>
                  {showModelPicker && (
                    <div className="absolute z-50 mt-1 w-full bg-background border border-border rounded-xl shadow-2xl overflow-hidden animate-in fade-in slide-in-from-top-1 duration-200">
                      {TTS_MODELS.map(m => (
                        <button
                          key={m.id}
                          onClick={() => { setTtsModel(m.id); setShowModelPicker(false) }}
                          className={cn(
                            "w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-muted transition-colors",
                            m.id === ttsModel && "bg-muted"
                          )}
                        >
                          <div className="px-1.5 py-0.5 border border-foreground/20 rounded text-[10px] font-bold shrink-0">{m.tag}</div>
                          <div className="flex-1 min-w-0">
                            <span className="text-sm font-semibold block">{m.label}</span>
                            <span className="text-[10px] text-muted-foreground">{m.desc}</span>
                          </div>
                          {m.id === ttsModel && <Check className="w-4 h-4 text-foreground shrink-0" />}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <div className="space-y-4 mt-6">
                  {/* Speed */}
                  <div>
                    <div className="flex justify-between mb-1.5">
                      <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Speed</label>
                      <span className="text-[10px] font-bold tabular-nums">{speed}x</span>
                    </div>
                    <div className="relative h-4 flex items-center">
                      <div className="absolute inset-x-0 h-[3px] bg-muted rounded-full" />
                      <div className="absolute left-0 h-[4px] bg-foreground rounded-full pointer-events-none" style={{ width: `${((speed - 0.5) / 1.5) * 100}%` }} />
                      <input
                        type="range" min="0.7" max="1.2" step="0.05" value={speed}
                        onChange={e => setSpeed(parseFloat(e.target.value))}
                        className="absolute inset-0 w-full h-full appearance-none bg-transparent cursor-pointer z-10 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-foreground"
                      />
                    </div>
                  </div>

                  {/* Stability */}
                  <div>
                    <div className="flex justify-between mb-1.5">
                      <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Stability</label>
                      <span className="text-[10px] font-bold tabular-nums">{Math.round(stability * 100)}%</span>
                    </div>
                    <div className="relative h-4 flex items-center">
                      <div className="absolute inset-x-0 h-[3px] bg-muted rounded-full" />
                      <div className="absolute left-0 h-[4px] bg-foreground rounded-full pointer-events-none" style={{ width: `${stability * 100}%` }} />
                      <input
                        type="range" min="0" max="1" step="0.01" value={stability}
                        onChange={e => setStability(parseFloat(e.target.value))}
                        className="absolute inset-0 w-full h-full appearance-none bg-transparent cursor-pointer z-10 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-foreground"
                      />
                    </div>
                  </div>

                  {/* Similarity */}
                  <div>
                    <div className="flex justify-between mb-1.5">
                      <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Similarity</label>
                      <span className="text-[10px] font-bold tabular-nums">{Math.round(similarity * 100)}%</span>
                    </div>
                    <div className="relative h-4 flex items-center">
                      <div className="absolute inset-x-0 h-[3px] bg-muted rounded-full" />
                      <div className="absolute left-0 h-[4px] bg-foreground rounded-full pointer-events-none" style={{ width: `${similarity * 100}%` }} />
                      <input
                        type="range" min="0" max="1" step="0.01" value={similarity}
                        onChange={e => setSimilarity(parseFloat(e.target.value))}
                        className="absolute inset-0 w-full h-full appearance-none bg-transparent cursor-pointer z-10 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-foreground"
                      />
                    </div>
                  </div>

                  {/* Style Exaggeration */}
                  <div>
                    <div className="flex justify-between mb-1.5">
                      <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Style Exaggeration</label>
                      <span className="text-[10px] font-bold tabular-nums">{Math.round(styleExaggeration * 100)}%</span>
                    </div>
                    <div className="relative h-4 flex items-center">
                      <div className="absolute inset-x-0 h-[3px] bg-muted rounded-full" />
                      <div className="absolute left-0 h-[4px] bg-foreground rounded-full pointer-events-none" style={{ width: `${styleExaggeration * 100}%` }} />
                      <input
                        type="range" min="0" max="1" step="0.01" value={styleExaggeration}
                        onChange={e => setStyleExaggeration(parseFloat(e.target.value))}
                        className="absolute inset-0 w-full h-full appearance-none bg-transparent cursor-pointer z-10 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-foreground"
                      />
                    </div>
                  </div>
                </div>

                {/* Smooth fade-in Generate button */}
                <div
                  className="mt-8 pt-4 border-t border-border/50 transition-all duration-400 ease-in-out"
                  style={{
                    opacity: ttsText.trim() ? 1 : 0,
                    maxHeight: ttsText.trim() ? 100 : 0,
                    overflow: "hidden",
                    transform: ttsText.trim() ? "translateY(0)" : "translateY(8px)",
                    pointerEvents: ttsText.trim() ? "auto" : "none",
                  }}
                >
                  <Button
                    onClick={handleGenerateTTS}
                    disabled={isGenerating}
                    className="w-full bg-foreground text-background font-black py-5 rounded-xl shadow-lg hover:scale-[1.02] active:scale-[0.98] transition-all text-xs uppercase tracking-widest"
                  >
                    {isGenerating ? (
                      <span className="flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> Processing...</span>
                    ) : "Generate Speech"}
                  </Button>
                  {error && activeTab === "tts" && <p className="text-xs text-red-500 mt-2">{error}</p>}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ─── SFX Page ─── */}
        {activeTab === "sfx" && (
          <div className="h-full flex flex-col p-6 overflow-y-auto pb-48">
            {/* Search & Filters */}
            <div className="flex items-center gap-3 mt-2">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input
                  placeholder="Search sound effects..."
                  className="w-full bg-muted/30 border border-border rounded-xl py-2.5 pl-10 pr-4 text-sm focus:ring-1 focus:ring-foreground focus:outline-none"
                />
              </div>
              <button className="flex items-center gap-2 px-4 py-2 bg-muted/30 border border-border rounded-xl text-sm font-medium">
                Trending <ChevronRight className="w-4 h-4 rotate-90" />
              </button>
            </div>

            <div className="flex gap-2 mt-4">
              <button className="px-3 py-1 bg-muted border border-border rounded-lg text-xs font-medium">Looping</button>
              <button className="px-3 py-1 bg-muted border border-border rounded-lg text-xs font-medium text-muted-foreground">+ Duration</button>
            </div>



            {/* List */}
            <div className="mt-8 space-y-2">
              <div className="grid grid-cols-[auto_1fr_1fr_auto_auto_auto] items-center px-4 py-2 text-xs font-bold text-muted-foreground uppercase tracking-widest border-b border-border/50">
                <div className="w-10" />
                <div>Description</div>
                <div className="text-center">Waveform</div>
                <div className="text-right px-6">Duration</div>
                <div className="text-right px-6">Downloads</div>
                <div className="w-16" />
              </div>
              {MOCK_SFX.map(sfx => (
                <div
                  key={sfx.id}
                  onClick={() => handlePlayAudio(
                    "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3", // Mock URL
                    { title: sfx.title, artist: sfx.tags, image: "https://images.unsplash.com/photo-1546182990-dffeafbe841d?w=100&h=100&fit=crop" }
                  )}
                  className="grid grid-cols-[auto_1fr_1fr_auto_auto_auto] items-center px-4 py-3 bg-muted/20 hover:bg-muted/40 border border-white/5 rounded-xl group transition-all cursor-pointer"
                >
                  <div className="w-10">
                    <button className="w-8 h-8 rounded-full bg-foreground flex items-center justify-center text-background opacity-0 group-hover:opacity-100 transition-opacity">
                      <Play className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <div>
                    <p className="text-sm font-bold">{sfx.title}</p>
                    <p className="text-xs text-muted-foreground">{sfx.tags}</p>
                  </div>
                  <div className="flex justify-center flex-1">{renderWaveform()}</div>
                  <div className="text-right px-6 text-xs text-muted-foreground">{sfx.duration}</div>
                  <div className="text-right px-6 text-xs text-muted-foreground">{sfx.downloads}</div>
                  <div className="flex gap-4 justify-end">
                    <Heart className="w-4 h-4 text-muted-foreground hover:text-red-500 transition-colors" />
                    <Download className="w-4 h-4 text-muted-foreground hover:text-foreground transition-colors" />
                  </div>
                </div>
              ))}

            </div>

            {/* Bottom Generation Bar */}
            <div className="absolute bottom-8 left-6 right-6 flex flex-col items-center gap-2">
              {_currentAudioUrl && activeTab === "sfx" && (
                <div className="w-full max-w-4xl bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-4 shadow-2xl flex items-center justify-between gap-4 animate-in fade-in slide-in-from-bottom-2">
                  <div className="flex items-center gap-3 min-w-0">
                    <button onClick={handleTogglePlay} className="w-8 h-8 bg-foreground text-background rounded-full flex items-center justify-center shrink-0">
                      {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 ml-0.5" />}
                    </button>
                    <div className="min-w-0">
                      <p className="text-[10px] font-bold truncate">{audioMetadata?.title}</p>
                      <p className="text-[8px] text-muted-foreground truncate">{audioMetadata?.artist}</p>
                    </div>
                  </div>
                  <div className="flex-1 flex items-center gap-3">
                    <span className="text-[8px] font-medium text-muted-foreground tabular-nums">{formatTime(currentTime)}</span>
                    <div
                      className="flex-1 relative h-1 bg-white/10 rounded-full overflow-hidden cursor-pointer"
                      onClick={(e) => {
                        const rect = e.currentTarget.getBoundingClientRect()
                        const x = e.clientX - rect.left
                        const pct = x / rect.width
                        if (audioRef.current) audioRef.current.currentTime = pct * duration
                      }}
                    >
                      <div className="absolute inset-y-0 left-0 bg-foreground" style={{ width: `${(currentTime / duration) * 100 || 0}%` }} />
                    </div>
                    <span className="text-[8px] font-medium text-muted-foreground tabular-nums">{formatTime(duration)}</span>
                  </div>
                </div>
              )}

              <div className="w-full max-w-4xl bg-muted/80 backdrop-blur-xl border border-border rounded-2xl p-4 shadow-2xl">
                <div className="flex flex-col gap-3">
                  <textarea
                    value={sfxPrompt}
                    onChange={e => setSfxPrompt(e.target.value)}
                    placeholder="Describe a sound..."
                    className="flex-1 bg-transparent border-0 ring-0 focus:ring-0 focus:border-0 outline-none focus:outline-none shadow-none text-lg placeholder:text-muted-foreground/50 resize-none h-20 pt-1"
                  />
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {/* Duration Picker */}
                      <div className="relative">
                        <button
                          onClick={() => { setShowSfxDuration(!showSfxDuration); setShowSfxInfluence(false) }}
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-muted border border-border rounded-lg text-xs font-bold text-muted-foreground hover:text-foreground transition-colors"
                        >
                          <Clock className="w-3.5 h-3.5" />
                          {sfxDuration ? `${sfxDuration}s` : "Auto"}
                          <ChevronDown className={cn("w-3 h-3 transition-transform", showSfxDuration && "rotate-180")} />
                        </button>
                        {showSfxDuration && (
                          <div className="absolute bottom-full mb-1 left-0 bg-background border border-border rounded-lg shadow-xl overflow-hidden z-50 animate-in fade-in slide-in-from-bottom-1 duration-150">
                            {SFX_DURATION_OPTIONS.map(opt => (
                              <button
                                key={opt.label}
                                onClick={() => { setSfxDuration(opt.value); setShowSfxDuration(false) }}
                                className={cn("w-full px-4 py-2 text-xs font-medium text-left hover:bg-muted transition-colors whitespace-nowrap", sfxDuration === opt.value && "bg-muted text-foreground")}
                              >
                                {opt.label}{sfxDuration === opt.value && " ✓"}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                      {/* Prompt Influence Picker */}
                      <div className="relative">
                        <button
                          onClick={() => { setShowSfxInfluence(!showSfxInfluence); setShowSfxDuration(false) }}
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-muted border border-border rounded-lg text-xs font-bold text-muted-foreground hover:text-foreground transition-colors"
                        >
                          <Zap className="w-3.5 h-3.5" />
                          {Math.round(sfxInfluence * 100)}%
                          <ChevronDown className={cn("w-3 h-3 transition-transform", showSfxInfluence && "rotate-180")} />
                        </button>
                        {showSfxInfluence && (
                          <div className="absolute bottom-full mb-1 left-0 bg-background border border-border rounded-lg shadow-xl p-3 z-50 w-48 animate-in fade-in slide-in-from-bottom-1 duration-150">
                            <label className="text-[10px] font-bold text-muted-foreground uppercase block mb-2">Prompt Influence</label>
                            <div className="relative h-4 flex items-center">
                              <div className="absolute inset-x-0 h-[3px] bg-muted rounded-full" />
                              <div className="absolute left-0 h-[4px] bg-foreground rounded-full pointer-events-none" style={{ width: `${sfxInfluence * 100}%` }} />
                              <input
                                type="range" min="0" max="1" step="0.05" value={sfxInfluence}
                                onChange={e => setSfxInfluence(parseFloat(e.target.value))}
                                className="absolute inset-0 w-full h-full appearance-none bg-transparent cursor-pointer z-10 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-foreground"
                              />
                            </div>
                            <div className="flex justify-between mt-1 text-[9px] text-muted-foreground">
                              <span>Creative</span><span>Faithful</span>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                    <button
                      onClick={handleGenerateSFX}
                      disabled={isGenerating || !sfxPrompt.trim()}
                      className="w-10 h-10 bg-foreground text-background rounded-full flex items-center justify-center hover:scale-105 active:scale-95 transition-all disabled:opacity-30"
                    >
                      {isGenerating && activeTab === "sfx" ? <Loader2 className="w-5 h-5 animate-spin" /> : <ArrowUpRight className="w-5 h-5" />}
                    </button>
                  </div>
                  {error && activeTab === "sfx" && <p className="text-xs text-red-500">{error}</p>}
                </div>
              </div>
            </div>

          </div>
        )}

        {/* ─── Music Page ─── */}
        {activeTab === "music" && (
          <div className="h-full flex flex-col p-6 overflow-y-auto pb-48">
            {/* Search & Filters */}
            <div className="mt-2 space-y-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input
                  placeholder="Search for music, genres, or moods"
                  className="w-full bg-muted/30 border border-border rounded-xl py-2.5 pl-10 pr-4 text-sm focus:ring-1 focus:ring-foreground focus:outline-none"
                />
              </div>
              <div className="flex flex-wrap gap-2">
                {["Genre", "Mood", "Theme", "Duration", "BPM", "Vocals"].map(f => (
                  <button key={f} className="px-3 py-1 bg-muted/50 border border-border rounded-lg text-xs font-medium text-muted-foreground hover:text-foreground transition-colors">+ {f}</button>
                ))}
              </div>
            </div>




            {/* Main Content (Featured / Trending) */}
            <div className="grid grid-cols-2 gap-8 mt-12">
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-bold">Featured</h2>
                  <ArrowUpRight className="w-4 h-4 text-muted-foreground" />
                </div>
                <div className="space-y-4">
                  {MOCK_MUSIC.slice(0, 4).map(m => (
                    <div
                      key={m.id}
                      onClick={() => handlePlayAudio(
                        "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3", // Mock URL
                        { title: m.title, artist: m.artist, image: m.image }
                      )}
                      className="flex items-center gap-4 group cursor-pointer p-2 rounded-xl border border-transparent hover:border-white/5 hover:bg-muted/10 transition-all"
                    >
                      <div className="w-12 h-12 rounded-lg overflow-hidden shrink-0 relative">
                        <img src={m.image} className="w-full h-full object-cover" />
                        <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                          <Play className="w-5 h-5 text-white" />
                        </div>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold truncate">{m.title}</p>
                        <p className="text-xs text-muted-foreground truncate">{m.artist} | {m.tags}</p>
                      </div>
                      <div className="flex-1 flex justify-center">{renderWaveform(20)}</div>
                      <div className="text-right text-[10px] text-muted-foreground shrink-0 uppercase tracking-tighter">
                        {m.duration}<br />{m.bpm}
                      </div>
                    </div>
                  ))}

                </div>
              </div>
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-bold">Trending</h2>
                  <ChevronRight className="w-4 h-4 text-muted-foreground" />
                </div>
                <div className="space-y-4">
                  {MOCK_MUSIC.slice(0, 4).map(m => (
                    <div key={m.id + "t"} className="flex items-center gap-4 group cursor-pointer p-2 rounded-xl border border-transparent hover:border-white/5 hover:bg-muted/10 transition-all">
                      <div className="w-12 h-12 rounded-lg overflow-hidden shrink-0 relative">
                        <img src={m.image} className="w-full h-full object-cover" />
                        <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                          <Play className="w-5 h-5 text-white" />
                        </div>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold truncate">{m.title}</p>
                        <p className="text-xs text-muted-foreground truncate">{m.artist} | {m.tags}</p>
                      </div>
                      <div className="flex-1 flex justify-center">{renderWaveform(20)}</div>
                      <div className="text-right text-[10px] text-muted-foreground shrink-0 uppercase tracking-tighter">
                        {m.duration}<br />{m.bpm}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Bottom Generation Bar */}
            <div className="absolute bottom-8 left-6 right-6 flex flex-col items-center gap-2">
              {_currentAudioUrl && activeTab === "music" && (
                <div className="w-full max-w-4xl bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-4 shadow-2xl flex items-center justify-between gap-4 animate-in fade-in slide-in-from-bottom-2">
                  <div className="flex items-center gap-3 min-w-0">
                    <button onClick={handleTogglePlay} className="w-8 h-8 bg-foreground text-background rounded-full flex items-center justify-center shrink-0">
                      {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 ml-0.5" />}
                    </button>
                    <div className="min-w-0">
                      <p className="text-[10px] font-bold truncate">{audioMetadata?.title}</p>
                      <p className="text-[8px] text-muted-foreground truncate">{audioMetadata?.artist}</p>
                    </div>
                  </div>
                  <div className="flex-1 flex items-center gap-3">
                    <span className="text-[8px] font-medium text-muted-foreground tabular-nums">{formatTime(currentTime)}</span>
                    <div
                      className="flex-1 relative h-1 bg-white/10 rounded-full overflow-hidden cursor-pointer"
                      onClick={(e) => {
                        const rect = e.currentTarget.getBoundingClientRect()
                        const x = e.clientX - rect.left
                        const pct = x / rect.width
                        if (audioRef.current) audioRef.current.currentTime = pct * duration
                      }}
                    >
                      <div className="absolute inset-y-0 left-0 bg-foreground" style={{ width: `${(currentTime / duration) * 100 || 0}%` }} />
                    </div>
                    <span className="text-[8px] font-medium text-muted-foreground tabular-nums">{formatTime(duration)}</span>
                  </div>
                </div>
              )}

              <div className="w-full max-w-4xl bg-muted/80 backdrop-blur-xl border border-border rounded-2xl p-4 shadow-2xl">
                <div className="flex flex-col gap-4">
                  <textarea
                    value={musicPrompt}
                    onChange={e => setMusicPrompt(e.target.value)}
                    placeholder="Generate a high-energy rock track with distorted guitars..."
                    className="w-full bg-transparent border-0 ring-0 focus:ring-0 focus:border-0 outline-none focus:outline-none shadow-none text-lg placeholder:text-muted-foreground/50 resize-none h-25 pt-1"
                  />
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {/* Duration Picker */}
                      <div className="relative">
                        <button
                          onClick={() => setShowMusicDuration(!showMusicDuration)}
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-muted border border-border rounded-lg text-xs font-bold text-muted-foreground hover:text-foreground transition-colors"
                        >
                          <Clock className="w-3.5 h-3.5" />
                          {musicDuration === 0 ? "Auto" : musicDuration >= 60000 ? `${musicDuration / 60000}m` : `${musicDuration / 1000}s`}
                          <ChevronDown className={cn("w-3 h-3 transition-transform", showMusicDuration && "rotate-180")} />
                        </button>
                        {showMusicDuration && (
                          <div className="absolute bottom-full mb-1 left-0 bg-background border border-border rounded-lg shadow-xl overflow-hidden z-50 animate-in fade-in slide-in-from-bottom-1 duration-150">
                            {MUSIC_DURATION_OPTIONS.map(opt => (
                              <button
                                key={opt.label}
                                onClick={() => { setMusicDuration(opt.value); setShowMusicDuration(false) }}
                                className={cn("w-full px-4 py-2 text-xs font-medium text-left hover:bg-muted transition-colors whitespace-nowrap", musicDuration === opt.value && "bg-muted text-foreground")}
                              >
                                {opt.label}{musicDuration === opt.value && " ✓"}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                      {/* Instrumental Toggle */}
                      <button
                        onClick={() => setMusicInstrumental(!musicInstrumental)}
                        className={cn(
                          "flex items-center gap-1.5 px-3 py-1.5 border rounded-lg text-xs font-bold transition-colors",
                          musicInstrumental
                            ? "bg-foreground text-background border-foreground"
                            : "bg-muted border-border text-muted-foreground hover:text-foreground"
                        )}
                      >
                        <BarChart3 className="w-3.5 h-3.5" />
                        {musicInstrumental ? "Instrumental" : "With Vocals"}
                      </button>
                    </div>
                    <div className="flex items-center gap-4">
                      <button
                        onClick={handleGenerateMusic}
                        disabled={isGenerating || !musicPrompt.trim()}
                        className="w-10 h-10 bg-foreground text-background rounded-full flex items-center justify-center hover:scale-105 active:scale-95 transition-all disabled:opacity-30"
                      >
                        {isGenerating && activeTab === "music" ? <Loader2 className="w-5 h-5 animate-spin" /> : <ArrowUpRight className="w-5 h-5" />}
                      </button>
                    </div>
                  </div>
                  {error && activeTab === "music" && <p className="text-xs text-red-500">{error}</p>}
                </div>
              </div>
            </div>

          </div>
        )}
      </div>

      {/* ─── Fixed Bottom Player ─── */}
      {_currentAudioUrl && activeTab === "tts" && (
        <div className="shrink-0 h-24 bg-background border-t border-border px-8 flex flex-col justify-center gap-2 z-50">
          <div className="flex items-center gap-4 group">
            <span className="text-[10px] font-medium text-muted-foreground tabular-nums w-10">{formatTime(currentTime)}</span>
            <div
              className="flex-1 relative h-1.5 bg-muted rounded-full overflow-hidden cursor-pointer"
              onClick={(e) => {
                const rect = e.currentTarget.getBoundingClientRect()
                const x = e.clientX - rect.left
                const pct = x / rect.width
                if (audioRef.current) audioRef.current.currentTime = pct * duration
              }}
            >
              <div className="absolute inset-y-0 left-0 bg-foreground group-hover:bg-primary transition-colors" style={{ width: `${(currentTime / duration) * 100 || 0}%` }} />
            </div>
            <span className="text-[10px] font-medium text-muted-foreground tabular-nums w-10">{formatTime(duration)}</span>
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4 max-w-[20%]">
              <div className="w-10 h-10 bg-muted rounded-lg shrink-0 overflow-hidden">
                <img src={audioMetadata?.image || "https://images.unsplash.com/photo-1546182990-dffeafbe841d?w=100&h=100&fit=crop"} className="w-full h-full object-cover" />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-bold truncate">{audioMetadata?.title || "Drafting Audio..."}</p>
                <p className="text-[10px] text-muted-foreground truncate">{audioMetadata?.artist || "AI Generation"}</p>
              </div>
            </div>


            <div className="flex items-center gap-6">
              <button className="text-muted-foreground hover:text-foreground transition-colors"><Rewind className="w-4 h-4" /></button>
              <button
                onClick={handleTogglePlay}
                className="w-10 h-10 bg-foreground text-background rounded-full flex items-center justify-center hover:scale-105 active:scale-95 transition-all"
              >
                {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5 ml-0.5" />}
              </button>
              <button className="text-muted-foreground hover:text-foreground transition-colors"><FastForward className="w-4 h-4" /></button>
            </div>

            <div className="flex items-center gap-4">
              <button 
                onClick={() => {
                  setImportPopup({
                    isOpen: true,
                    url: _currentAudioUrl,
                    type: "audio",
                    name: audioMetadata?.title || "Generated Audio",
                  })
                }}
                className="flex items-center gap-2 px-3 py-1.5 bg-muted rounded-xl text-xs font-bold hover:bg-foreground hover:text-background transition-colors"
              >
                <FolderInput className="w-4 h-4" /> Import to Project
              </button>
              <div className="flex items-center gap-2 px-3 py-1 bg-muted/50 rounded-lg">
                <ThumbsUp className="w-4 h-4 text-muted-foreground hover:text-foreground cursor-pointer" />
                <ThumbsDown className="w-4 h-4 text-muted-foreground hover:text-foreground cursor-pointer" />
              </div>
              <button className="flex items-center gap-2 px-3 py-1.5 bg-muted rounded-xl text-xs font-bold hover:bg-muted-foreground/10 transition-colors">
                <Share2 className="w-4 h-4" /> Share
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Import to Project Popup ─── */}
      {importPopup && (
        <ImportToProjectPopup
          isOpen={importPopup.isOpen}
          onClose={() => setImportPopup(null)}
          assetUrl={importPopup.url}
          assetType={importPopup.type}
          assetName={importPopup.name}
        />
      )}
    </div>
  )
}
