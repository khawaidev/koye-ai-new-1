/**
 * AudioGenLoadingCard
 *
 * In-chat card shown during audio generation.
 * States:
 *  - Loading: Animated audio-lines icon + "Generating Audio..."
 *  - Success: Audio player element + download button
 *  - Error: Error message + retry button
 */

import { motion } from "framer-motion"
import { AlertCircle, Download, Loader2, Music, RefreshCw } from "lucide-react"

interface AudioGenLoadingCardProps {
  status: "loading" | "success" | "error"
  audioUrl?: string
  audioType?: "sfx" | "voice" | "music"
  prompt?: string
  error?: string
  onRetry?: () => void
}

function AnimatedAudioBars() {
  return (
    <div className="flex items-end gap-[2px] h-4">
      {[0, 1, 2, 3, 4].map((i) => (
        <motion.div
          key={i}
          className="w-[3px] bg-green-500 rounded-full"
          animate={{
            height: ["4px", "16px", "8px", "14px", "4px"],
          }}
          transition={{
            duration: 1.2,
            repeat: Infinity,
            delay: i * 0.15,
            ease: "easeInOut",
          }}
        />
      ))}
    </div>
  )
}

export function AudioGenLoadingCard({
  status,
  audioUrl,
  audioType = "sfx",
  prompt,
  error,
  onRetry,
}: AudioGenLoadingCardProps) {
  const typeLabels = { sfx: "Sound Effect", voice: "Voice", music: "Music" }

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
            ${status === "loading" ? "bg-green-500/10" :
              status === "success" ? "bg-green-500/10 text-green-500" :
              "bg-red-500/10 text-red-500"}
          `}>
            {status === "loading" ? (
              <AnimatedAudioBars />
            ) : status === "error" ? (
              <AlertCircle className="h-4 w-4" />
            ) : (
              <Music className="h-4 w-4" />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <span className="text-sm font-medium text-foreground">
              {status === "loading" ? "Generating Audio..." :
               status === "success" ? `${typeLabels[audioType]} generated` :
               "Audio generation failed"}
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
        <div className="p-4">
          {status === "loading" && (
            <div className="flex items-center gap-3 py-2">
              <div className="flex-1 h-10 rounded-lg bg-muted/30 relative overflow-hidden">
                <motion.div
                  className="absolute inset-y-0 left-0 w-1/3 bg-gradient-to-r from-transparent via-green-500/10 to-transparent"
                  animate={{ x: ["-100%", "400%"] }}
                  transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                />
              </div>
            </div>
          )}

          {status === "success" && audioUrl && (
            <div className="flex flex-col gap-3">
              <audio
                controls
                src={audioUrl}
                className="w-full h-10 rounded-lg"
                style={{ colorScheme: "dark" }}
              />
              <div className="flex items-center justify-end">
                <a
                  href={audioUrl}
                  download={`audio_${audioType}.mp3`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border bg-background text-xs font-medium text-foreground hover:bg-muted transition-colors"
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
                {error || "An unexpected error occurred during audio generation."}
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
