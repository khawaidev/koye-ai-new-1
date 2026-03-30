import { Download, Maximize2 } from "lucide-react"
import * as React from "react"
import { useState } from "react"
import { useAuth } from "../../hooks/useAuth"
import { saveImageToStorage } from "../../lib/imageStorage"
import { uuidv4 } from "../../lib/uuid"
import {
  generateImageWithRunway,
  type RunwayRatio,
  type RunwayImageModel,
} from "../../services/runwayml"
import { saveImage } from "../../services/multiDbDataService"
import { useAppStore } from "../../store/useAppStore"
import { Button } from "../ui/button"
import { Select } from "../ui/select"
import { ImageZoomModal } from "./ImageZoomModal"


type GenerationType = "single" | "four"

// GeneratedImageData interface removed as it's not needed with global store


export function ImageGeneration() {
  const { user, isAuthenticated } = useAuth()
  const { currentProject, images, addImage } = useAppStore()
  const [method, setMethod] = useState<RunwayImageModel>("gen4_image_turbo")
  const [generationType, setGenerationType] = useState<GenerationType>("single")
  const [prompt, setPrompt] = useState("")
  const [isGenerating, setIsGenerating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selectedImageIndex, setSelectedImageIndex] = useState<number | null>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)

  // Model-specific options
  const [runwayRatio, setRunwayRatio] = useState<RunwayRatio>("1024:1024")

  // Cache for placeholder asset ID (reuse same asset for all standalone images)
  const placeholderAssetIdRef = React.useRef<string | null>(null)

  const handleGenerate = async () => {
    if (!prompt.trim()) {
      setError("Please enter a prompt")
      return
    }

    setIsGenerating(true)
    setError(null)

    try {
      // Build model-specific options
      const genOptions = { model: method, ratio: runwayRatio }

      if (generationType === "single") {
        // Generate single image using RunwayML
        const imageUrl = await generateImageWithRunway(prompt, genOptions)

        const imageData = {
          id: uuidv4(),
          assetId: "", 
          url: imageUrl,
          prompt,
          createdAt: new Date().toISOString(),
          view: "front" as const
        }
        addImage(imageData)
        setSelectedImageIndex(images.length) // Point to the new image

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
        const viewOptions = { model: method, ratio: "1080:1440" as RunwayRatio }

        for (const view of views) {
          const viewPrompt = `${prompt}, ${view} view, orthographic, character sheet, clean white background`

          const imageUrl = await generateImageWithRunway(viewPrompt, viewOptions)
          imageUrls.push(imageUrl)

          const imageData = {
            id: uuidv4(),
            assetId: "",
            url: imageUrl,
            prompt: `${prompt}, ${view} view`,
            createdAt: new Date().toISOString(),
            view: view as any
          }
          addImage(imageData)

          if (views.indexOf(view) < views.length - 1) {
            await new Promise(resolve => setTimeout(resolve, 1000))
          }
        }
        
        setSelectedImageIndex(images.length)

        for (let i = 0; i < views.length; i++) {
          await saveGeneratedImage({
            url: imageUrls[i],
            prompt: `${prompt}, ${views[i]} view`,
            method,
            view: views[i] as any,
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

  // ... (helper functions stay below)
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
      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <div className="flex-1 overflow-y-auto">
          <div className="container mx-auto max-w-6xl px-6 py-8">
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
                        onValueChange={(value) => setMethod(value as RunwayImageModel)}
                        options={[
                          { value: "gen4_image_turbo", label: "gen4_image_turbo (Default, Fast)" },
                          { value: "gen4_image", label: "gen4_image (High Quality)" },
                          { value: "gemini_2.5_flash", label: "gemini_2.5_flash" },
                        ]}
                      />
                    </div>

                    {/* Aspect Ratio / Size Selection — model-specific */}
                    <div className="space-y-2">
                      <label className="text-xs font-medium text-muted-foreground">
                        Aspect Ratio / Size
                      </label>
                      <Select
                        value={runwayRatio}
                        onValueChange={(value) => setRunwayRatio(value as RunwayRatio)}
                        options={[
                          { value: "1024:1024", label: "1024:1024 (1:1)" },
                          { value: "1360:768", label: "1360:768 (16:9)" },
                          { value: "768:1360", label: "768:1360 (9:16)" },
                          { value: "1080:1080", label: "1080:1080" },
                          { value: "1440:1080", label: "1440:1080" },
                          { value: "1080:1440", label: "1080:1440" },
                          { value: "1920:1080", label: "1920:1080" },
                          { value: "1080:1920", label: "1080:1920" },
                          { value: "1280:720", label: "1280:720" },
                          { value: "720:1280", label: "720:1280" },
                        ]}
                      />
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
                    ) : selectedImageIndex === null || images.length === 0 ? (
                      <div className="flex items-center justify-center min-h-[400px] text-muted-foreground font-mono text-sm">
                        <p>$ select_an_image_from_sidebar</p>
                      </div>
                    ) : (
                      <div className="relative group bg-background rounded-lg border-2 border-border overflow-hidden">
                        <img
                          src={images[selectedImageIndex]?.url}
                          alt={`Generated image`}
                          className="w-full h-auto cursor-pointer"
                          onClick={() => setIsModalOpen(true)}
                        />
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
                                const response = await fetch(images[selectedImageIndex].url)
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
      {selectedImageIndex !== null && images[selectedImageIndex] && (
        <ImageZoomModal
          imageUrl={images[selectedImageIndex].url}
          imageName={images[selectedImageIndex].view || `Generated Image ${selectedImageIndex + 1}`}
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
        />
      )}
    </div>
  )
}
