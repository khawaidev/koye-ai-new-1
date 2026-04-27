/**
 * VideoGenLoadingCard
 *
 * In-chat card shown during video generation.
 * States:
 *  - Loading: Animated clapperboard icon + shimmer on video placeholder
 *  - Success: Video player with controls + hover download button
 *  - Error: Error message + retry button
 */

import { motion } from "framer-motion"
import { AlertCircle, Clapperboard, Download, Loader2, RefreshCw } from "lucide-react"

interface VideoGenLoadingCardProps {
  status: "loading" | "success" | "error"
  videoUrl?: string
  prompt?: string
  error?: string
  onRetry?: () => void
}

function AnimatedClapperboard() {
  return (
    <motion.div
      animate={{ rotate: [0, -8, 0, 8, 0] }}
      transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
    >
      <Clapperboard className="h-4 w-4 text-purple-500" />
    </motion.div>
  )
}

export function VideoGenLoadingCard({
  status,
  videoUrl,
  prompt,
  error,
  onRetry,
}: VideoGenLoadingCardProps) {
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
            ${status === "loading" ? "bg-purple-500/10" :
              status === "success" ? "bg-green-500/10 text-green-500" :
              "bg-red-500/10 text-red-500"}
          `}>
            {status === "loading" ? (
              <AnimatedClapperboard />
            ) : status === "error" ? (
              <AlertCircle className="h-4 w-4" />
            ) : (
              <Clapperboard className="h-4 w-4 text-green-500" />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <span className="text-sm font-medium text-foreground">
              {status === "loading" ? "Generating Video..." :
               status === "success" ? "Video generated" :
               "Video generation failed"}
            </span>
            {prompt && (
              <p className="text-[11px] text-muted-foreground truncate mt-0.5">
                {prompt.slice(0, 80)}{prompt.length > 80 ? "..." : ""}
              </p>
            )}
          </div>
          {status === "loading" && (
            <Loader2 className="h-4 w-4 text-muted-foreground animate-spin" />
          )}
        </div>

        {/* Content */}
        <div className="p-3">
          {status === "loading" && (
            <div className="aspect-video rounded-lg bg-muted/30 relative overflow-hidden">
              {/* Shimmer effect */}
              <motion.div
                className="absolute inset-0 bg-gradient-to-br from-transparent via-purple-500/5 to-transparent"
                animate={{
                  backgroundPosition: ["200% 200%", "-200% -200%"],
                }}
                transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
                style={{ backgroundSize: "200% 200%" }}
              />
              {/* Center play icon placeholder */}
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="h-12 w-12 rounded-full bg-muted/40 flex items-center justify-center">
                  <Clapperboard className="h-5 w-5 text-muted-foreground/50" />
                </div>
              </div>
            </div>
          )}

          {status === "success" && videoUrl && (
            <div className="relative group">
              <video
                src={videoUrl}
                controls
                className="w-full rounded-lg"
                preload="metadata"
              />
              {/* Hover download overlay */}
              <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                <a
                  href={videoUrl}
                  download="generated_video.mp4"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-black/60 backdrop-blur-sm text-white text-xs font-medium hover:bg-black/80 transition-colors"
                >
                  <Download className="h-3.5 w-3.5" />
                  Download
                </a>
              </div>
            </div>
          )}

          {status === "error" && (
            <div className="flex flex-col items-center gap-3 py-4">
              <p className="text-sm text-red-400">
                {error || "An unexpected error occurred during video generation."}
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
