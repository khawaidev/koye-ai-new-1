/**
 * ImageGenLoadingCard
 *
 * In-chat card shown during image generation.
 * States:
 *  - Loading: Spinner + shimmer gradient on placeholder
 *  - Success: Shows generated images with hover-download button
 *  - Error: Error message + "Try again" button
 */

import { motion } from "framer-motion"
import { AlertCircle, Download, Image as ImageIcon, Loader2, RefreshCw } from "lucide-react"

interface ImageGenLoadingCardProps {
  status: "loading" | "success" | "error"
  images?: Array<{ url: string; view?: string }>
  prompt?: string
  error?: string
  onRetry?: () => void
  imageCount?: number
  resolution?: string
}

export function ImageGenLoadingCard({
  status,
  images = [],
  prompt,
  error,
  onRetry,
  imageCount = 4,
  resolution = "1024",
}: ImageGenLoadingCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="w-full my-3"
    >
      <div className="rounded-xl border border-border bg-background overflow-hidden">
        {/* Header */}
        <div className="flex items-center gap-2.5 px-4 py-3 border-b border-border/50 bg-muted/20">
          <div className={`
            flex items-center justify-center h-7 w-7 rounded-lg
            ${status === "loading" ? "bg-blue-500/10 text-blue-500" :
              status === "success" ? "bg-green-500/10 text-green-500" :
              "bg-red-500/10 text-red-500"}
          `}>
            {status === "loading" ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : status === "error" ? (
              <AlertCircle className="h-4 w-4" />
            ) : (
              <ImageIcon className="h-4 w-4" />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <span className="text-sm font-medium text-foreground">
              {status === "loading" ? "Generating images..." :
               status === "success" ? `${images.length} image${images.length > 1 ? "s" : ""} generated` :
               "Image generation failed"}
            </span>
            {prompt && (
              <p className="text-[11px] text-muted-foreground truncate mt-0.5">
                {prompt.slice(0, 80)}{prompt.length > 80 ? "..." : ""}
              </p>
            )}
          </div>
          {status === "loading" && (
            <span className="text-[10px] text-muted-foreground font-mono">
              {imageCount}x {resolution}px
            </span>
          )}
        </div>

        {/* Content */}
        <div className="p-3">
          {status === "loading" && (
            <div className="grid grid-cols-2 gap-2">
              {Array.from({ length: Math.min(imageCount, 4) }).map((_, i) => (
                <div
                  key={i}
                  className="aspect-square rounded-lg overflow-hidden relative bg-muted/30"
                >
                  {/* Shimmer effect */}
                  <div className="absolute inset-0 shimmer-gradient" />
                  <style>{`
                    .shimmer-gradient {
                      background: linear-gradient(
                        135deg,
                        transparent 30%,
                        rgba(255,255,255,0.05) 50%,
                        transparent 70%
                      );
                      background-size: 200% 200%;
                      animation: shimmer 2s infinite linear;
                    }
                    @keyframes shimmer {
                      0% { background-position: 200% 200%; }
                      100% { background-position: -200% -200%; }
                    }
                  `}</style>
                </div>
              ))}
            </div>
          )}

          {status === "success" && images.length > 0 && (
            <div className={`grid gap-2 ${images.length === 1 ? "grid-cols-1" : "grid-cols-2"}`}>
              {images.map((img, i) => (
                <div key={i} className="relative group aspect-square rounded-lg overflow-hidden bg-muted/20">
                  <img
                    src={img.url}
                    alt={img.view || `Generated image ${i + 1}`}
                    className="w-full h-full object-cover"
                  />
                  {/* Hover download overlay */}
                  <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                    <a
                      href={img.url}
                      download={`image_${i + 1}.png`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/20 backdrop-blur-sm text-white text-xs font-medium hover:bg-white/30 transition-colors"
                    >
                      <Download className="h-3.5 w-3.5" />
                      Download
                    </a>
                  </div>
                  {img.view && (
                    <span className="absolute bottom-1.5 left-1.5 text-[10px] px-1.5 py-0.5 rounded bg-black/60 text-white font-mono">
                      {img.view}
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}

          {status === "error" && (
            <div className="flex flex-col items-center gap-3 py-4">
              <p className="text-sm text-red-400">
                {error || "An unexpected error occurred during generation."}
              </p>
              {onRetry && (
                <button
                  onClick={onRetry}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-lg border border-border bg-background text-sm font-medium text-foreground hover:bg-muted transition-colors"
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                  Try Again
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </motion.div>
  )
}
