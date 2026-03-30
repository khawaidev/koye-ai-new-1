import { Download, Maximize2 } from "lucide-react"
import * as React from "react"
import { useState, useEffect } from "react"
import { useAuth } from "../../hooks/useAuth"
import { uuidv4 } from "../../lib/uuid"
import { saveVideo } from "../../services/multiDbDataService"
import { uploadFileToDataDb } from "../../services/supabase"
import { generateVideoWithRunway, type RunwayVideoRatio, type RunwayVideoModel } from "../../services/runwayml"
import { VideoPlayer } from "../chat/VideoPlayer"
import { Button } from "../ui/button"
import { Select } from "../ui/select"


import { useAppStore } from "../../store/useAppStore"

export function VideoGeneration() {
  const { user, isAuthenticated } = useAuth()
  const { generatedVideos, addGeneratedVideo } = useAppStore()
  const [prompt, setPrompt] = useState("")
  const [aspectRatio, setAspectRatio] = useState<"16:9" | "9:16">("16:9")
  const [duration, setDuration] = useState<4 | 6 | 8>(8)
  const [resolution, setResolution] = useState<"720p" | "1080p">("1080p")
  const [generateAudio, setGenerateAudio] = useState(true)
  const [negativePrompt, setNegativePrompt] = useState("")
  const [model, setModel] = useState<RunwayVideoModel>("gen4.5")
  const [firstFrameImage, setFirstFrameImage] = useState<File | null>(null)
  const [firstFramePreview, setFirstFramePreview] = useState<string | null>(null)
  const [isGenerating, setIsGenerating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selectedVideoIndex, setSelectedVideoIndex] = useState<number | null>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [pollingStatus, setPollingStatus] = useState<any | null>(null)

  // Cache for placeholder asset ID
  const placeholderAssetIdRef = React.useRef<string | null>(null)

  // Helper function to upload image to storage and get public URL
  const uploadImageToStorage = async (imageFile: File, userId: string, imageId: string): Promise<string> => {
    try {
      const storagePath = `images/${userId}/${imageId}.png`
      const publicUrl = await uploadFileToDataDb("images", storagePath, imageFile)
      return publicUrl
    } catch (error) {
      console.error("Error uploading image to storage:", error)
      throw error
    }
  }

  // Handle first frame image selection
  const handleFirstFrameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      setFirstFrameImage(file)
      const previewUrl = URL.createObjectURL(file)
      setFirstFramePreview(previewUrl)
    }
  }

  // Clear first frame
  const clearFirstFrame = () => {
    if (firstFramePreview) {
      URL.revokeObjectURL(firstFramePreview)
    }
    setFirstFrameImage(null)
    setFirstFramePreview(null)
  }

  // Helper function to get or create placeholder asset
  const getOrCreatePlaceholderAsset = async (userId: string): Promise<string | null> => {
    if (placeholderAssetIdRef.current) {
      return placeholderAssetIdRef.current
    }

    try {
      const { createProject, createAsset, getProjects, getAssets } = await import("../../services/supabase")

      const projects = await getProjects(userId)
      let standaloneProject = projects.find(p => p.name === "Standalone Videos")

      if (!standaloneProject) {
        standaloneProject = await createProject({
          userId,
          name: "Standalone Videos",
          description: "Videos generated from the video generation page",
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

  // Helper function to upload video to storage
  const uploadVideoToStorage = async (videoUrl: string, userId: string, videoId: string): Promise<string> => {
    try {
      // If it's already a Supabase URL, return it
      if (videoUrl.startsWith("http") && !videoUrl.startsWith("blob:")) {
        // Check if it's a Supabase storage URL, if not, download and upload
        if (videoUrl.includes("supabase") || videoUrl.includes("storage")) {
          return videoUrl
        }
      }

      // Fetch the video
      const response = await fetch(videoUrl)
      if (!response.ok) {
        throw new Error(`Failed to fetch video: ${response.statusText}`)
      }
      const blob = await response.blob()

      // Create a File from the blob
      const file = new File([blob], `${videoId}.mp4`, { type: blob.type || "video/mp4" })

      // Upload to Supabase storage (data database)
      const storagePath = `videos/${userId}/${videoId}.mp4`
      const publicUrl = await uploadFileToDataDb("videos", storagePath, file)

      return publicUrl
    } catch (error) {
      console.error("Error uploading video to storage:", error)
      return videoUrl
    }
  }

  // Helper function to save generated video
  const saveGeneratedVideo = async (videoData: {
    url: string
    prompt: string
    predictionId: string
  }) => {
    try {
      if (isAuthenticated && user) {
        const assetId = await getOrCreatePlaceholderAsset(user.id)

        const videoId = uuidv4()

        // Upload video to storage
        const storageUrl = await uploadVideoToStorage(videoData.url, user.id, videoId)

        await saveVideo(user.id, {
          userId: user.id,
          assetId: assetId || undefined,
          url: storageUrl,
          prompt: videoData.prompt || undefined,
        })
      }
    } catch (error) {
      console.error("Error saving video:", error)
    }
  }

  const handleGenerate = async () => {
    if (!prompt.trim()) {
      setError("Please enter a prompt")
      return
    }

    if (model === "gen4_turbo" && !firstFrameImage) {
      setError("gen4_turbo requires an initial image to generate video")
      return
    }

    setIsGenerating(true)
    setError(null)
    setPollingStatus(null)

    try {
      let firstFrameUrl: string | undefined

      if (firstFrameImage && user) {
        const imageId = uuidv4()
        firstFrameUrl = await uploadImageToStorage(firstFrameImage, user.id, imageId)
      }

      // Generate video with Runway
      const runwayRatio: RunwayVideoRatio = aspectRatio === "16:9" ? "1280:720" : "720:1280";
      
      const videoUrl = await generateVideoWithRunway(prompt.trim(), {
        model: model,
        ratio: runwayRatio,
        duration: duration,
        promptImage: firstFrameUrl,
      })

      const predictionId = uuidv4()

      const videoData = {
        url: videoUrl,
        prompt: prompt.trim(),
        predictionId: predictionId,
        status: "succeeded" as any,
        createdAt: new Date().toISOString(),
      }

      addGeneratedVideo(videoData)
      setSelectedVideoIndex(0)

      // Save to database
      await saveGeneratedVideo({
        url: videoUrl,
        prompt: prompt.trim(),
        predictionId: predictionId,
      })
    } catch (err) {
      console.error("Error generating video:", err)
      setError(err instanceof Error ? err.message : "Failed to generate video")

      // Update status to failed in global store if we have a predictionId
      // (This is a simplified approach, in a real scenario we'd need the ID)
    } finally {
      setIsGenerating(false)
      setPollingStatus(null)
    }
  }

  const handleVideoClick = (index: number) => {
    setSelectedVideoIndex(index)
    setIsModalOpen(true)
  }

  const selectedVideo = selectedVideoIndex !== null ? generatedVideos[selectedVideoIndex] : null

  // Cleanup blob URLs when component unmounts or images change
  useEffect(() => {
    return () => {
      if (firstFramePreview) {
        URL.revokeObjectURL(firstFramePreview)
      }
    }
  }, [firstFramePreview])

  return (
    <div className="flex h-screen bg-background font-mono">
      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">


        {/* Content Area */}
        <div className="flex-1 overflow-y-auto min-h-0 p-6 pb-20">
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
                  placeholder={isAuthenticated ? "Enter your video generation prompt..." : "Please login to generate videos"}
                  className="w-full border-2 border-border p-3 bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-0 font-mono text-sm resize-none disabled:opacity-50 disabled:cursor-not-allowed"
                  rows={4}
                  disabled={!isAuthenticated}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-bold text-foreground mb-2">
                    $ model
                  </label>
                  <Select
                    value={model}
                    onValueChange={(value) => setModel(value as RunwayVideoModel)}
                    options={[
                      { value: "gen4.5", label: "gen4.5 (Text/Image to Video)" },
                      { value: "gen4_turbo", label: "gen4_turbo (Image to Video)" },
                      { value: "veo3.1", label: "veo3.1" },
                    ]}
                  />
                </div>

                <div>
                  <label className="block text-sm font-bold text-foreground mb-2">
                    $ aspect_ratio
                  </label>
                  <Select
                    value={aspectRatio}
                    onValueChange={(value) => setAspectRatio(value as "16:9" | "9:16")}
                    options={[
                      { value: "16:9", label: "16:9" },
                      { value: "9:16", label: "9:16" },
                    ]}
                  />
                </div>

                <div>
                  <label className="block text-sm font-bold text-foreground mb-2">
                    $ duration
                  </label>
                  <Select
                    value={duration.toString()}
                    onValueChange={(value) => setDuration(parseInt(value) as 4 | 6 | 8)}
                    options={[
                      { value: "4", label: "4 seconds" },
                      { value: "6", label: "6 seconds" },
                      { value: "8", label: "8 seconds" },
                    ]}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-bold text-foreground mb-2">
                    $ resolution
                  </label>
                  <Select
                    value={resolution}
                    onValueChange={(value) => setResolution(value as "720p" | "1080p")}
                    options={[
                      { value: "720p", label: "720p" },
                      { value: "1080p", label: "1080p" },
                    ]}
                  />
                </div>

                <div className="flex items-center gap-2 pt-8">
                  <input
                    type="checkbox"
                    id="generateAudio"
                    checked={generateAudio}
                    onChange={(e) => setGenerateAudio(e.target.checked)}
                    className="w-4 h-4 border-2 border-border"
                  />
                  <label htmlFor="generateAudio" className="text-sm font-bold text-foreground">
                    $ generate_audio
                  </label>
                </div>
              </div>

              <div>
                <label className="block text-sm font-bold text-foreground mb-2">
                  $ negative_prompt (optional)
                </label>
                <input
                  type="text"
                  value={negativePrompt}
                  onChange={(e) => setNegativePrompt(e.target.value)}
                  placeholder="What to exclude from the video..."
                  className="w-full border-2 border-border p-3 bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-0 font-mono text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                  disabled={!isAuthenticated}
                />
              </div>

              {/* First Frame Image Input */}
              <div>
                <label className="block text-sm font-bold text-foreground mb-2">
                  $ prompt_image (optional for gen4.5, required for gen4_turbo)
                </label>
                <div className="space-y-2">
                  {firstFramePreview ? (
                    <div className="relative border-2 border-border">
                      <img
                        src={firstFramePreview}
                        alt="First frame preview"
                        className="w-full h-48 object-contain bg-muted"
                      />
                      <button
                        onClick={clearFirstFrame}
                        className="absolute top-2 right-2 p-1.5 bg-red-600 hover:bg-red-700 text-white rounded"
                        type="button"
                      >
                        <Maximize2 className="h-4 w-4 rotate-45" />
                      </button>
                    </div>
                  ) : (
                    <label className={`block w-full border-2 border-border p-3 bg-background text-foreground hover:bg-muted cursor-pointer font-mono text-sm text-center ${!isAuthenticated ? 'opacity-50 cursor-not-allowed' : ''}`}>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleFirstFrameChange}
                        className="hidden"
                        disabled={!isAuthenticated}
                      />
                      Click to upload initial frame image
                    </label>
                  )}
                </div>
                <p className="text-xs text-muted-foreground mt-1">Input image for image-to-video generation</p>
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
                {isGenerating ? "$ generating_video..." : isAuthenticated ? "$ generate_video" : "$ login_required"}
              </Button>
            </div>

            {/* Status Display */}
            {pollingStatus && (
              <div className="border-2 border-border p-4">
                <p className="text-sm font-bold text-foreground mb-2">$ status</p>
                <p className="text-sm text-muted-foreground">
                  {pollingStatus.status === "starting" && "$ video_generation_starting..."}
                  {pollingStatus.status === "processing" && "$ video_generation_processing..."}
                  {pollingStatus.status === "succeeded" && "$ video_generation_completed"}
                  {pollingStatus.status === "failed" && "$ video_generation_failed"}
                </p>
              </div>
            )}

            {/* Video Preview */}
            {selectedVideo && selectedVideo.url && (
              <div className="border-2 border-border p-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-bold text-foreground">$ generated_video</h2>
                  <div className="flex gap-2">
                    <Button
                      onClick={() => handleVideoClick(selectedVideoIndex!)}
                      className="bg-foreground text-background hover:bg-muted-foreground border border-foreground font-mono text-sm"
                    >
                      <Maximize2 className="h-4 w-4 mr-2" />
                      Maximize
                    </Button>
                    <a
                      href={selectedVideo.url}
                      download
                      className="px-4 py-2 bg-background text-foreground border-2 border-border hover:bg-muted font-mono text-sm flex items-center gap-2"
                    >
                      <Download className="h-4 w-4" />
                      Download
                    </a>
                  </div>
                </div>
                <div className="border-2 border-border">
                  <VideoPlayer
                    videoUrl={selectedVideo.url}
                    className="w-full"
                  />
                </div>
                <p className="text-sm text-muted-foreground mt-2">{selectedVideo.prompt}</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Video Modal */}
      {isModalOpen && selectedVideo && selectedVideo.url && (
        <div
          className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4"
          onClick={() => setIsModalOpen(false)}
        >
          <div className="relative max-w-6xl max-h-full w-full" onClick={(e) => e.stopPropagation()}>
            <button
              onClick={() => setIsModalOpen(false)}
              className="absolute -top-10 right-0 text-white hover:text-white/70"
            >
              <Maximize2 className="h-6 w-6" />
            </button>
            <VideoPlayer
              videoUrl={selectedVideo.url}
              className="w-full"
            />
          </div>
        </div>
      )}
    </div>
  )
}

