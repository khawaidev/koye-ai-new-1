import { Box, Globe } from "lucide-react"
import { useEffect, useState } from "react"
import { cn } from "../../lib/utils"
import type { ImageView, WebSearchResult } from "../../types"
import { ImageZoomModal } from "../image-generation/ImageZoomModal"
import { PixelImage } from "../ui/pixel-image"
import { Response } from "../ui/response"
import { ShimmeringText } from "../ui/shimmering-text"
import { ConnectProjectPrompt } from "./ConnectProjectPrompt"
import { ImageGenerationCards } from "./ImageGenerationCards"
import { VideoPlayer } from "./VideoPlayer"
import { ChatAvatar } from "./VoiceChatLayout"
import { WebSearchResults } from "./WebSearchResults"

interface ResponseMessageProps {
  content: string
  images?: string[]
  generatedImages?: Array<{ view: ImageView; url: string }>
  sampleImages?: Array<{ id: number; url: string; prompt: string }>
  videos?: string[] // Array of video URLs
  model3dUrl?: string // URL of generated 3D model
  isGeneratingImage?: boolean // Show image generation loading indicator
  webSearchResults?: WebSearchResult // Web search results
  isWebSearching?: boolean // Show web search loading indicator
  className?: string
  isStreaming?: boolean
  isThinking?: boolean
  thinking?: string
  isSwitching?: boolean
  showConnectPrompt?: boolean
  onConnectProject?: () => void
  onCreateProject?: () => void
}

const loadingPhrases = [
  "Generating images...",
  "Creating assets...",
  "Rendering pixels...",
  "Applying details...",
  "Almost ready...",
]

export function ResponseMessage({
  content,
  images,
  generatedImages,
  sampleImages,
  videos,
  model3dUrl,
  isGeneratingImage = false,
  webSearchResults,
  isWebSearching = false,
  className,
  isStreaming = false,
  isThinking = false,
  thinking,
  isSwitching = false,
  showConnectPrompt = false,
  onConnectProject,
  onCreateProject,
}: ResponseMessageProps) {
  // Determine agent state based on props
  const agentState = isSwitching ? "thinking" : isThinking ? "thinking" : isStreaming ? "speaking" : "idle"

  // Show shimmering text even when thinking text is empty
  const showThinking = isThinking || isSwitching

  // Check if images are still loading (either explicit flag or placeholder images with empty URLs)
  const isLoadingImages = isGeneratingImage || (generatedImages && generatedImages.some(img => !img.url || img.url === ""))

  // State for image zoom modal
  const [selectedSampleImage, setSelectedSampleImage] = useState<{ url: string; id: number } | null>(null)

  // State for cycling loading phrases
  const [currentPhraseIndex, setCurrentPhraseIndex] = useState(0)

  useEffect(() => {
    if (isLoadingImages) {
      const interval = setInterval(() => {
        setCurrentPhraseIndex((prev) => (prev + 1) % loadingPhrases.length)
      }, 3000)
      return () => clearInterval(interval)
    } else {
      setCurrentPhraseIndex(0)
    }
  }, [isLoadingImages])

  return (
    <div className={cn("flex gap-4", className)}>
      <ChatAvatar role="assistant" agentState={agentState} />

      <div className="flex max-w-[85%] flex-col gap-3">
        {/* Loading Indicator for Image Generation - Replaces content when loading */}
        {isLoadingImages ? (
          <div className="flex items-center gap-3 py-4 px-2">
            <div className="h-5 w-5 border-2 border-foreground border-t-transparent rounded-full animate-spin" />
            <span className="font-medium text-[15px] text-foreground">
              {loadingPhrases[currentPhraseIndex]}
            </span>
          </div>
        ) : (
          <>
            {/* Content */}
            <div
              className={cn(
                "rounded-lg px-1 py-1 transition-all bg-transparent text-[15px] text-foreground leading-relaxed",
                isThinking && "animate-pulse"
              )}
            >
              {showThinking ? (
                <div className="flex items-center gap-3">
                  <div className="h-4 w-4 border-2 border-foreground border-t-transparent rounded-full animate-spin" />
                  <ShimmeringText
                    text={thinking || "Thinking..."}
                    duration={2}
                    wave={true}
                    shimmeringColor="hsl(var(--muted-foreground))"
                    className="font-medium text-[15px] text-foreground"
                  />
                </div>
              ) : (
                <Response content={content} isStreaming={isStreaming} />
              )}
            </div>

            {/* Web Search Loading Indicator */}
            {isWebSearching && (
              <div className="flex items-center gap-3 py-3 px-2">
                <div className="h-4 w-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                <div className="flex items-center gap-1.5">
                  <Globe className="h-4 w-4 text-blue-500" />
                  <span className="font-medium text-sm text-foreground">Searching the web...</span>
                </div>
              </div>
            )}

            {/* Web Search Results */}
            {webSearchResults && (
              <WebSearchResults results={webSearchResults} />
            )}
          </>
        )}

        {/* Connect Project Prompt */}
        {showConnectPrompt && onConnectProject && onCreateProject && (
          <ConnectProjectPrompt
            onConnectClick={onConnectProject}
            onCreateClick={onCreateProject}
          />
        )}

        {/* Generated 4-view images (small cards) */}
        {generatedImages && generatedImages.length > 0 && (
          <ImageGenerationCards
            images={generatedImages}
            isLoading={isLoadingImages}
          />
        )}

        {/* Sample images for 2D selection (numbered grid) */}
        {sampleImages && sampleImages.length > 0 && (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {sampleImages.map((sample) => (
              <div
                key={sample.id}
                className="relative border-2 border-border rounded-lg overflow-hidden shadow-md bg-background cursor-pointer hover:scale-105 transition-transform"
                onClick={() => setSelectedSampleImage({ url: sample.url, id: sample.id })}
              >
                <PixelImage
                  src={sample.url}
                  alt={`Sample ${sample.id}`}
                  className="w-full h-48 object-cover"
                />
                <div className="absolute bottom-0 left-0 right-0 bg-foreground/80 text-background text-center py-2 font-mono text-sm font-bold">
                  {sample.id}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Regular uploaded images */}
        {images && images.length > 0 && (
          <div className="flex gap-2 flex-wrap">
            {images.map((img, idx) => (
              <div
                key={idx}
                className="cursor-pointer hover:scale-105 transition-transform"
                onClick={() => setSelectedSampleImage({ url: img, id: idx + 1 })}
              >
                <PixelImage
                  src={img}
                  alt={`Response image ${idx + 1}`}
                  className="h-36 w-36 rounded-lg border border-border shadow-md object-cover"
                />
              </div>
            ))}
          </div>
        )}

        {/* Generated videos (cutscenes) */}
        {videos && videos.length > 0 && (
          <div className="space-y-4">
            {videos.map((videoUrl, idx) => (
              <div key={idx} className="border-2 border-border rounded-lg overflow-hidden bg-black">
                <VideoPlayer
                  videoUrl={videoUrl}
                  className="w-full"
                  autoPlay={false}
                />
              </div>
            ))}
          </div>
        )}

        {/* 3D Model View Button */}
        {model3dUrl && (
          <div className="mt-2">
            <button
              onClick={() => window.dispatchEvent(new CustomEvent('view-3d-model', { detail: { modelUrl: model3dUrl } }))}
              className="flex items-center gap-2 bg-foreground text-background hover:bg-muted-foreground font-mono text-sm font-bold px-4 py-3 border-2 border-foreground shadow-[2px_2px_0px_0px_currentColor] transition-all rounded w-full justify-center"
            >
              <Box className="h-4 w-4" />
              <span>View 3D Model</span>
            </button>
          </div>
        )}

      </div>

      {/* Image Zoom Modal for sample images and regular images */}
      {selectedSampleImage && (
        <ImageZoomModal
          imageUrl={selectedSampleImage.url}
          imageName={`Sample ${selectedSampleImage.id}`}
          isOpen={!!selectedSampleImage}
          onClose={() => setSelectedSampleImage(null)}
        />
      )}
    </div>
  )
}
