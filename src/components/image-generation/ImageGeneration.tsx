import { ChevronLeft, ChevronRight, Download, Maximize2 } from "lucide-react"
import * as React from "react"
import { useState } from "react"
import { useAuth } from "../../hooks/useAuth"
import { saveImageToStorage } from "../../lib/imageStorage"
import { cn } from "../../lib/utils"
import { uuidv4 } from "../../lib/uuid"
import {
  generateImageWithHyperreal,
  GPT4O_SIZES,
  NANO_BANANA_ASPECT_RATIOS,
  type Gpt4oImageSize,
  type NanoBananaAspectRatio,
} from "../../services/hyperreal"
import { saveImage } from "../../services/multiDbDataService"
import { useAppStore } from "../../store/useAppStore"
import { Button } from "../ui/button"
import { Select } from "../ui/select"
import { ImageZoomModal } from "./ImageZoomModal"

type GenerationMethod = "nano-banana-t2i" | "gpt-4o-image"
type GenerationType = "single" | "four"

interface GeneratedImageData {
  url: string
  prompt: string
  method: string
  view?: string
}

interface ImageGenerationProps {
  isSidebarOpen?: boolean
  onToggleSidebar?: () => void
}

export function ImageGeneration({ isSidebarOpen = false, onToggleSidebar }: ImageGenerationProps) {
  const { user, isAuthenticated } = useAuth()
  const { currentProject } = useAppStore()
  const [method, setMethod] = useState<GenerationMethod>("gpt-4o-image")
  const [generationType, setGenerationType] = useState<GenerationType>("single")
  const [prompt, setPrompt] = useState("")
  const [isGenerating, setIsGenerating] = useState(false)
  const [generatedImages, setGeneratedImages] = useState<GeneratedImageData[]>([])
  const [error, setError] = useState<string | null>(null)
  const [selectedImageIndex, setSelectedImageIndex] = useState<number | null>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)

  // Model-specific options
  const [nanoBananaRatio, setNanoBananaRatio] = useState<NanoBananaAspectRatio>("1:1")
  const [gpt4oSize, setGpt4oSize] = useState<Gpt4oImageSize>("1024x1024")

  // Cache for placeholder asset ID (reuse same asset for all standalone images)
  const placeholderAssetIdRef = React.useRef<string | null>(null)

  const handleGenerate = async () => {
    if (!prompt.trim()) {
      setError("Please enter a prompt")
      return
    }

    setIsGenerating(true)
    setError(null)
    setGeneratedImages([])

    try {
      // Build model-specific options
      const genOptions = method === "gpt-4o-image"
        ? { model: method, size: gpt4oSize }
        : { model: method, aspect_ratio: nanoBananaRatio }

      if (generationType === "single") {
        // Generate single image using HyperReal
        const imageUrl = await generateImageWithHyperreal(prompt, genOptions)

        const imageData: GeneratedImageData = {
          url: imageUrl,
          prompt,
          method,
        }
        setGeneratedImages([imageData])
        setSelectedImageIndex(0)

        await saveGeneratedImage({
          url: imageUrl,
          prompt,
          method,
          view: "front" as const,
        })
      } else {
        // Generate four images (front, left, right, back)
        const imageUrls: string[] = []
        const views = ["front", "left", "right", "back"]

        // For 4 views (character sheets), use portrait format
        const viewOptions = method === "gpt-4o-image"
          ? { model: method, size: "1024x1792" as Gpt4oImageSize }
          : { model: method, aspect_ratio: "2:3" as NanoBananaAspectRatio }

        for (const view of views) {
          const viewPrompt = `${prompt}, ${view} view, orthographic, character sheet, clean white background`

          const imageUrl = await generateImageWithHyperreal(viewPrompt, viewOptions)
          imageUrls.push(imageUrl)

          if (views.indexOf(view) < views.length - 1) {
            await new Promise(resolve => setTimeout(resolve, 1000))
          }
        }

        const imagesData: GeneratedImageData[] = imageUrls.map((url, idx) => ({
          url,
          prompt: `${prompt}, ${views[idx]} view`,
          method,
          view: views[idx],
        }))
        setGeneratedImages(imagesData)
        setSelectedImageIndex(0)

        for (const img of imagesData) {
          await saveGeneratedImage({
            url: img.url,
            prompt: img.prompt,
            method: img.method,
            view: img.view as "front" | "left" | "right" | "back",
          })
        }
      }
    } catch (err) {
      console.error("Error generating images:", err)
      setError(err instanceof Error ? err.message : "Failed to generate images")
    } finally {
      setIsGenerating(false)
    }
  }

  // Helper function to get or create placeholder asset for standalone images
  const getOrCreatePlaceholderAsset = async (userId: string): Promise<string | null> => {
    if (placeholderAssetIdRef.current) {
      return placeholderAssetIdRef.current
    }

    try {
      const { createProject, createAsset, getProjects } = await import("../../services/supabase")
      const projects = await getProjects(userId)
      let standaloneProject = projects.find(p => p.name === "Standalone Images")

      if (!standaloneProject) {
        try {
          standaloneProject = await createProject({
            userId,
            name: "Standalone Images",
            description: "Images generated from the image generation page",
          })
        } catch (projectError) {
          console.warn("Failed to create project (assets table may not exist):", projectError)
          return null
        }
      }

      try {
        const { getAssets } = await import("../../services/supabase")
        const assets = await getAssets(standaloneProject.id)
        let placeholderAsset = assets.find(a => a.type === "character" && a.status === "concept")

        if (!placeholderAsset) {
          try {
            placeholderAsset = await createAsset({
              projectId: standaloneProject.id,
              type: "character" as const,
              status: "concept" as const,
              metadata: {},
            })
          } catch (assetError) {
            console.warn("Failed to create placeholder asset:", assetError)
            return null
          }
        }

        placeholderAssetIdRef.current = placeholderAsset.id
        return placeholderAsset.id
      } catch (assetsError) {
        console.warn("Failed to get assets:", assetsError)
        return null
      }
    } catch (error) {
      console.warn("Error getting placeholder asset:", error)
      return null
    }
  }

  // Helper function to upload blob URL to Supabase storage
  const uploadImageToStorage = async (blobUrl: string, userId: string, imageId: string, view: string): Promise<string> => {
    try {
      if (blobUrl.startsWith("http") && !blobUrl.startsWith("blob:")) {
        // Persist HTTP URLs (e.g., from HyperReal/R2) to our Supabase storage immediately before they expire
        try {
          const { createAssetFromUrl } = await import("../../services/assetService");
          const assetMetadata = await createAssetFromUrl(userId, currentProject?.id || null, "image", `${imageId}-${view}.png`, blobUrl);
          return assetMetadata.url;
        } catch (saveError) {
          console.warn("Failed to persist HTTP URL, storing temporary link instead:", saveError);
          return blobUrl;
        }
      }

      const response = await fetch(blobUrl)
      if (!response.ok) {
        throw new Error(`Failed to fetch blob: ${response.statusText}`)
      }
      const blob = await response.blob()
      const file = new File([blob], `${imageId}-${view}.png`, { type: blob.type || "image/png" })

      const { uploadFileToDataDb } = await import("../../services/supabase")

      const bucket = currentProject ? currentProject.id : "images"
      const storagePath = currentProject
        ? `${imageId}-${view}.png`
        : `images/${userId}/${imageId}-${view}.png`

      const publicUrl = await uploadFileToDataDb(bucket, storagePath, file)
      return publicUrl
    } catch (error) {
      console.error("Error uploading image to storage:", error)
      return blobUrl
    }
  }

  // Helper function to save generated image
  const saveGeneratedImage = async (imageData: {
    url: string
    prompt: string
    method: string
    view: "front" | "left" | "right" | "back"
  }) => {
    try {
      if (isAuthenticated && user) {
        const assetId = await getOrCreatePlaceholderAsset(user.id)
        const imageId = uuidv4()
        const finalUrl = await uploadImageToStorage(imageData.url, user.id, imageId, imageData.view)

        // Truncate prompt for display name (max 10 chars)
        const displayName = imageData.prompt.length > 10
          ? imageData.prompt.substring(0, 10)
          : imageData.prompt

        await saveImage(user.id, {
          assetId: assetId || undefined,
          view: imageData.view,
          url: finalUrl,
          prompt: displayName,
        } as any, currentProject?.id)
        console.log("Image saved to database with storage URL:", finalUrl, assetId ? `(assetId: ${assetId})` : "(no assetId)")
      } else {
        saveImageToStorage({
          url: imageData.url,
          prompt: imageData.prompt,
          method: imageData.method,
          view: imageData.view,
        }, user?.id || null)
        console.log("Image saved to localStorage")
      }
    } catch (error) {
      console.error("Error saving image:", error)
      if (isAuthenticated) {
        try {
          saveImageToStorage({
            url: imageData.url,
            prompt: imageData.prompt,
            method: imageData.method,
            view: imageData.view,
          }, user?.id || null)
          console.log("Image saved to localStorage as fallback")
        } catch (fallbackError) {
          console.error("Failed to save to localStorage as fallback:", fallbackError)
        }
      }
    }
  }

  return (
    <div className="flex h-full bg-background overflow-hidden font-mono">
      {/* Left Sidebar - Generated Images */}
      <div className={cn(
        "shrink-0 border-r border-border bg-background flex flex-col h-full overflow-hidden transition-all duration-300 font-mono",
        isSidebarOpen ? "w-64" : "w-16"
      )}>
        <div className="border-b border-border p-4 shrink-0">
          <div className="flex items-center gap-2">
            {isSidebarOpen && (
              <h2 className="text-sm font-bold text-foreground">Generated Images</h2>
            )}
            {onToggleSidebar && (
              <button
                onClick={onToggleSidebar}
                className="ml-auto p-1 hover:bg-muted rounded transition-colors"
                aria-label={isSidebarOpen ? "Close sidebar" : "Open sidebar"}
              >
                {isSidebarOpen ? (
                  <ChevronLeft className="h-4 w-4 text-foreground" />
                ) : (
                  <ChevronRight className="h-4 w-4 text-foreground" />
                )}
              </button>
            )}
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-4">
          {generatedImages.length === 0 ? (
            <div className="text-center text-muted-foreground font-mono text-xs py-8">
              {isSidebarOpen && <p>$ no_images_generated_yet</p>}
            </div>
          ) : (
            <div className="space-y-3">
              {generatedImages.map((imageData, index) => (
                <button
                  key={index}
                  onClick={() => setSelectedImageIndex(index)}
                  className={cn(
                    "w-full border-2 p-2 text-left transition-all font-mono text-xs",
                    selectedImageIndex === index
                      ? "bg-foreground text-background border-foreground"
                      : "bg-background text-foreground border-border hover:bg-muted"
                  )}
                >
                  <div className="w-full h-32 mb-2 border border-border overflow-hidden bg-background">
                    <img
                      src={imageData.url}
                      alt={`Generated ${index + 1}`}
                      className="w-full h-full object-cover"
                    />
                  </div>
                  {isSidebarOpen && (
                    <>
                      <div className="font-bold truncate">
                        {generationType === "four"
                          ? ["Front", "Left", "Right", "Back"][index]
                          : "Single"}
                      </div>
                      <div className="text-xs mt-1 opacity-70 truncate">
                        {imageData.method === "gpt-4o-image"
                          ? "HyperReal (GPT-4o)"
                          : "HyperReal (Nano)"}
                      </div>
                      {imageData.view && (
                        <div className="text-xs mt-1 opacity-60">
                          {imageData.view}
                        </div>
                      )}
                    </>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <div className="flex-1 overflow-y-auto">
          <div className="container mx-auto max-w-6xl px-6 py-8">
            <div className="mb-8 border-b border-border pb-4">
              <h1 className="text-3xl font-bold text-foreground mb-2">$ image_generation</h1>
              <p className="text-muted-foreground text-sm">Generate images using HyperReal AI API</p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Left Column - Controls */}
              <div className="lg:col-span-1 space-y-6">
                <div className="bg-background border-2 border-border">
                  <div className="border-b border-border p-4">
                    <h2 className="text-sm font-bold text-foreground">Generation Settings</h2>
                  </div>
                  <div className="p-4 space-y-4">
                    {/* Model Selection */}
                    <div className="space-y-2">
                      <label className="text-xs font-medium text-muted-foreground">Model</label>
                      <Select
                        value={method}
                        onValueChange={(value) => setMethod(value as GenerationMethod)}
                        options={[
                          { value: "nano-banana-t2i", label: "Nano Banana (Fast — 34 credits)" },
                          { value: "gpt-4o-image", label: "GPT-4o Image (HQ — 52 credits)" },
                        ]}
                      />
                    </div>

                    {/* Aspect Ratio / Size Selection — model-specific */}
                    <div className="space-y-2">
                      <label className="text-xs font-medium text-muted-foreground">
                        {method === "gpt-4o-image" ? "Image Size" : "Aspect Ratio"}
                      </label>
                      {method === "gpt-4o-image" ? (
                        <Select
                          value={gpt4oSize}
                          onValueChange={(value) => setGpt4oSize(value as Gpt4oImageSize)}
                          options={GPT4O_SIZES.map(s => ({ value: s.value, label: s.label }))}
                        />
                      ) : (
                        <Select
                          value={nanoBananaRatio}
                          onValueChange={(value) => setNanoBananaRatio(value as NanoBananaAspectRatio)}
                          options={NANO_BANANA_ASPECT_RATIOS.map(r => ({ value: r.value, label: r.label }))}
                        />
                      )}
                    </div>

                    {/* Generation Type Selection */}
                    <div className="space-y-2">
                      <label className="text-xs font-medium text-muted-foreground">Generation Type</label>
                      <Select
                        value={generationType}
                        onValueChange={(value) => setGenerationType(value as GenerationType)}
                        options={[
                          { value: "single", label: "Single Image (Front)" },
                          { value: "four", label: "All Four Images" }
                        ]}
                      />
                    </div>

                    {/* Prompt Input */}
                    <div className="space-y-2">
                      <label className="text-xs font-medium text-muted-foreground">Prompt</label>
                      <textarea
                        value={prompt}
                        onChange={(e) => setPrompt(e.target.value)}
                        placeholder={isAuthenticated ? "Enter your image generation prompt..." : "Please login to generate images"}
                        className="w-full min-h-[150px] border border-border bg-background p-3 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-0 resize-none font-mono text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                        disabled={!isAuthenticated}
                      />
                    </div>

                    {/* Generate Button */}
                    <Button
                      onClick={handleGenerate}
                      disabled={isGenerating || !prompt.trim() || !isAuthenticated}
                      className="w-full bg-foreground text-background hover:bg-muted-foreground border border-foreground font-mono text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isGenerating ? "$ generating..." : isAuthenticated ? "$ generate" : "$ login_required"}
                    </Button>

                    {/* Error Display */}
                    {error && (
                      <div className="p-3 border border-red-500 bg-red-500/10 text-red-600 dark:text-red-400 text-xs font-mono">
                        $ error: {error}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Right Column - Selected Image Display */}
              <div className="lg:col-span-1">
                <div className="bg-background border-2 border-border">
                  <div className="border-b border-border p-4">
                    <h2 className="text-sm font-bold text-foreground">Preview</h2>
                  </div>
                  <div className="p-4">
                    {isGenerating ? (
                      <div className="flex items-center justify-center min-h-[400px]">
                        <div className="text-center">
                          <div className="inline-block animate-spin rounded-full h-12 w-12 border-2 border-foreground border-t-transparent mb-4"></div>
                          <p className="text-muted-foreground font-mono text-sm">$ generating images...</p>
                        </div>
                      </div>
                    ) : selectedImageIndex === null || generatedImages.length === 0 ? (
                      <div className="flex items-center justify-center min-h-[400px] text-muted-foreground font-mono text-sm">
                        <p>$ select_an_image_from_sidebar</p>
                      </div>
                    ) : (
                      <div className="relative group bg-background rounded-lg border-2 border-border overflow-hidden">
                        <img
                          src={generatedImages[selectedImageIndex].url}
                          alt={`Generated image ${selectedImageIndex + 1}`}
                          className="w-full h-auto cursor-pointer"
                          onClick={() => setIsModalOpen(true)}
                        />
                        {/* View label */}
                        {generationType === "four" && (
                          <div className="absolute top-2 left-2 px-2 py-1 bg-foreground text-background text-xs font-mono font-bold border border-foreground">
                            {["Front", "Left", "Right", "Back"][selectedImageIndex]}
                          </div>
                        )}
                        {generationType === "single" && (
                          <div className="absolute top-2 left-2 px-2 py-1 bg-foreground text-background text-xs font-mono font-bold border border-foreground">
                            Single
                          </div>
                        )}
                        {/* Action buttons */}
                        <div className="absolute bottom-2 right-2 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Button
                            onClick={(e) => {
                              e.stopPropagation()
                              setIsModalOpen(true)
                            }}
                            size="sm"
                            className="bg-foreground text-background hover:bg-muted-foreground border border-foreground"
                          >
                            <Maximize2 className="h-4 w-4" />
                          </Button>
                          <Button
                            onClick={async (e) => {
                              e.stopPropagation()
                              try {
                                const response = await fetch(generatedImages[selectedImageIndex].url)
                                const blob = await response.blob()
                                const url = URL.createObjectURL(blob)
                                const a = document.createElement("a")
                                a.href = url
                                a.download = `generated-image-${selectedImageIndex + 1}-${Date.now()}.png`
                                document.body.appendChild(a)
                                a.click()
                                document.body.removeChild(a)
                                URL.revokeObjectURL(url)
                              } catch (error) {
                                console.error("Failed to download image:", error)
                              }
                            }}
                            size="sm"
                            className="bg-foreground text-background hover:bg-muted-foreground border border-foreground"
                          >
                            <Download className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Image Zoom Modal */}
      {selectedImageIndex !== null && generatedImages.length > 0 && (
        <ImageZoomModal
          imageUrl={generatedImages[selectedImageIndex].url}
          imageName={generatedImages[selectedImageIndex].view || `Generated Image ${selectedImageIndex + 1}`}
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
        />
      )}
    </div>
  )
}
