import { Globe } from "lucide-react"
import { useEffect, useState } from "react"
import { cn } from "../../lib/utils"
import type { ImageView, WebSearchResult } from "../../types"
import { ImageZoomModal } from "../image-generation/ImageZoomModal"
import { PixelImage } from "../ui/pixel-image"
import { Response } from "../ui/response"
import { ShimmeringText } from "../ui/shimmering-text"
import { ConnectProjectPrompt } from "./ConnectProjectPrompt"
import { ChatAvatar } from "./VoiceChatLayout"
import { WebSearchResults } from "./WebSearchResults"
import { SquareLoader } from "../ui/SquareLoader"
import { FileOperationCard, type FileOperation } from "./FileOperationCard"
import { ImageGenLoadingCard } from "./generation/ImageGenLoadingCard"
import { AudioGenLoadingCard } from "./generation/AudioGenLoadingCard"
import { VideoGenLoadingCard } from "./generation/VideoGenLoadingCard"
import { Model3DGenLoadingCard } from "./generation/Model3DGenLoadingCard"

interface ResponseMessageProps {
  content: string
  fileOperations?: FileOperation[]
  images?: string[]
  generatedImages?: Array<{ view: ImageView; url: string }>
  sampleImages?: Array<{ id: number; url: string; prompt: string }>
  videos?: string[] // Array of video URLs
  model3dUrl?: string // URL of generated 3D model
  isGeneratingImage?: boolean // Show image generation loading indicator
  isGeneratingVideo?: boolean
  isGeneratingAudio?: boolean
  isGenerating3DModel?: boolean
  audioUrl?: string
  generationError?: string
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

export function ResponseMessage({
  content,
  images,
  generatedImages,
  sampleImages,
  videos,
  model3dUrl,
  isGeneratingImage = false,
  isGeneratingVideo = false,
  isGeneratingAudio = false,
  isGenerating3DModel = false,
  audioUrl,
  generationError,
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
  fileOperations,
}: ResponseMessageProps) {
  // Determine agent state based on props
  const agentState = isSwitching ? "thinking" : isThinking ? "thinking" : isStreaming ? "speaking" : "idle"

  // Show shimmering text even when thinking text is empty
  const showThinking = isThinking || isSwitching

  // Check if images are still loading (either explicit flag or placeholder images with empty URLs)
  const isLoadingImages = isGeneratingImage || (generatedImages && generatedImages.some(img => !img.url || img.url === ""))

  // State for image zoom modal
  const [selectedSampleImage, setSelectedSampleImage] = useState<{ url: string; id: number } | null>(null)

  useEffect(() => {
    if (isLoadingImages) {
      const interval = setInterval(() => {
        // keep interval for subtle activity even if we don't display phrase cycling right now
      }, 3000)
      return () => clearInterval(interval)
    }
  }, [isLoadingImages])

  return (
    <div className={cn("flex gap-4", className)}>
      <ChatAvatar role="assistant" agentState={agentState} />

      <div className="flex max-w-[85%] flex-col gap-3">
        {/* Content */}
        <div
          className={cn(
            "rounded-lg px-1 py-1 transition-all bg-transparent text-[15px] text-foreground leading-relaxed",
            isThinking && "animate-pulse"
          )}
        >
          {showThinking ? (
            <div className="flex items-center gap-1 min-h-[44px]">
              <SquareLoader />
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
          <div className="flex items-center gap-1 py-3 px-2">
            <SquareLoader />
            <div className="flex items-center gap-1.5 ml-1">
              <Globe className="h-4 w-4 text-blue-500" />
              <span className="font-medium text-sm text-foreground">Searching the web...</span>
            </div>
          </div>
        )}

        {/* Web Search Results */}
        {webSearchResults && (
          <WebSearchResults results={webSearchResults} />
        )}

        {/* File Operations */}
        {fileOperations && fileOperations.length > 0 && (
          <div className="flex flex-col gap-2 mt-2 w-full">
            {fileOperations.map((op, idx) => (
              <FileOperationCard key={idx} operation={op} />
            ))}
          </div>
        )}

        {/* Connect Project Prompt */}
        {showConnectPrompt && onConnectProject && onCreateProject && (
          <ConnectProjectPrompt
            onConnectClick={onConnectProject}
            onCreateClick={onCreateProject}
          />
        )}

        {/* ── Asset Generation Cards (Phase 2 UI) ── */}

        {/* Images */}
        {(isGeneratingImage || (generatedImages && generatedImages.length > 0)) && (
          <ImageGenLoadingCard
            status={generationError ? "error" : isGeneratingImage ? "loading" : "success"}
            images={generatedImages}
            error={generationError}
            imageCount={generatedImages?.length || 4}
          />
        )}

        {/* Video */}
        {isGeneratingVideo && (
          <VideoGenLoadingCard status="loading" />
        )}
        {!isGeneratingVideo && videos && videos.map((videoUrl, idx) => (
          <VideoGenLoadingCard key={idx} status="success" videoUrl={videoUrl} />
        ))}

        {/* Audio */}
        {(isGeneratingAudio || audioUrl) && (
          <AudioGenLoadingCard
            status={generationError ? "error" : isGeneratingAudio ? "loading" : "success"}
            audioUrl={audioUrl}
            error={generationError}
          />
        )}

        {/* 3D Model */}
        {(isGenerating3DModel || model3dUrl) && (
          <Model3DGenLoadingCard
            status={generationError ? "error" : isGenerating3DModel ? "loading" : "success"}
            modelUrl={model3dUrl}
            error={generationError}
            onViewInEditor={() => window.dispatchEvent(new CustomEvent('view-3d-model', { detail: { modelUrl: model3dUrl } }))}
          />
        )}

        {/* Sample images for 2D selection (numbered grid) kept for backwards compat/specific flow */}
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

        {/* Regular uploaded images (user context) */}
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
