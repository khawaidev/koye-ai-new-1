/**
 * Model3DGenLoadingCard
 *
 * In-chat card shown during 3D model generation.
 * States:
 *  - Loading: Animated bone icon + "Generating 3D Model..."
 *  - Success: "3D Model generated" + "View in Editor" + download button
 *  - Error: Error message + retry button
 */

import { motion } from "framer-motion"
import { AlertCircle, Bone, Box, Download, ExternalLink, Loader2, RefreshCw } from "lucide-react"

interface Model3DGenLoadingCardProps {
  status: "loading" | "success" | "error"
  modelUrl?: string
  modelName?: string
  prompt?: string
  error?: string
  onRetry?: () => void
  onViewInEditor?: () => void
}

function AnimatedBone() {
  return (
    <motion.div
      animate={{
        rotateY: [0, 180, 360],
        scale: [1, 1.1, 1],
      }}
      transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut" }}
    >
      <Bone className="h-4 w-4 text-orange-500" />
    </motion.div>
  )
}

export function Model3DGenLoadingCard({
  status,
  modelUrl,
  modelName,
  prompt,
  error,
  onRetry,
  onViewInEditor,
}: Model3DGenLoadingCardProps) {
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
            ${status === "loading" ? "bg-orange-500/10" :
              status === "success" ? "bg-green-500/10 text-green-500" :
              "bg-red-500/10 text-red-500"}
          `}>
            {status === "loading" ? (
              <AnimatedBone />
            ) : status === "error" ? (
              <AlertCircle className="h-4 w-4" />
            ) : (
              <Box className="h-4 w-4 text-green-500" />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <span className="text-sm font-medium text-foreground">
              {status === "loading" ? "Generating 3D Model..." :
               status === "success" ? `3D Model generated${modelName ? ` — ${modelName}` : ""}` :
               "3D Model generation failed"}
            </span>
            {prompt && (
              <p className="text-[11px] text-muted-foreground truncate mt-0.5">
                {prompt.slice(0, 80)}{prompt.length > 80 ? "..." : ""}
              </p>
            )}
          </div>
          {status === "loading" && (
            <div className="flex items-center gap-1.5">
              <Loader2 className="h-4 w-4 text-muted-foreground animate-spin" />
              <span className="text-[10px] text-muted-foreground font-mono">~40s</span>
            </div>
          )}
        </div>

        {/* Content */}
        <div className="p-4">
          {status === "loading" && (
            <div className="flex flex-col items-center gap-4 py-6">
              {/* 3D placeholder animation */}
              <motion.div
                className="w-20 h-20 rounded-2xl bg-muted/30 border border-border/50 flex items-center justify-center"
                animate={{
                  rotateY: [0, 360],
                  borderColor: ["rgba(249,115,22,0.1)", "rgba(249,115,22,0.3)", "rgba(249,115,22,0.1)"],
                }}
                transition={{
                  rotateY: { duration: 4, repeat: Infinity, ease: "linear" },
                  borderColor: { duration: 2, repeat: Infinity, ease: "easeInOut" },
                }}
                style={{ perspective: "500px" }}
              >
                <Box className="h-8 w-8 text-orange-500/40" />
              </motion.div>
              <p className="text-xs text-muted-foreground">
                Building mesh, textures, and materials...
              </p>
            </div>
          )}

          {status === "success" && (
            <div className="flex items-center gap-3">
              {/* 3D model icon */}
              <div className="flex items-center justify-center h-14 w-14 rounded-xl bg-orange-500/10 border border-orange-500/20 shrink-0">
                <Box className="h-6 w-6 text-orange-500" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground">
                  {modelName || "model.glb"}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  3D model ready for use
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {onViewInEditor && (
                  <button
                    onClick={onViewInEditor}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-foreground text-background text-xs font-medium hover:bg-foreground/90 transition-colors"
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                    View in Editor
                  </button>
                )}
                {modelUrl && (
                  <a
                    href={modelUrl}
                    download={modelName || "model.glb"}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-border bg-background text-xs font-medium text-foreground hover:bg-muted transition-colors"
                  >
                    <Download className="h-3.5 w-3.5" />
                    Download
                  </a>
                )}
              </div>
            </div>
          )}

          {status === "error" && (
            <div className="flex flex-col items-center gap-3 py-4">
              <p className="text-sm text-red-400">
                {error || "An unexpected error occurred during 3D model generation."}
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
