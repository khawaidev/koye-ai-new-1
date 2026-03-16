import { useEffect, useState } from "react"
import appIcon from "../../assets/icon.jpg"
import { cn } from "../../lib/utils"

interface ImageGenerationLoaderProps {
  isVisible: boolean
}

export function ImageGenerationLoader({ isVisible }: ImageGenerationLoaderProps) {
  const [animationProgress, setAnimationProgress] = useState(0)

  useEffect(() => {
    if (!isVisible) {
      setAnimationProgress(0)
      return
    }

    // Animate the beam from 0 to 100%
    const duration = 2000 // 2 seconds
    const startTime = Date.now()

    const animate = () => {
      const elapsed = Date.now() - startTime
      const progress = Math.min((elapsed / duration) * 100, 100)
      setAnimationProgress(progress)

      if (progress < 100) {
        requestAnimationFrame(animate)
      }
    }

    animate()
  }, [isVisible])

  if (!isVisible) return null

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 backdrop-blur-sm pointer-events-auto">
      {/* Blur overlay - blocks all interactions */}
      <div className="absolute inset-0 bg-black/20 backdrop-blur-md pointer-events-auto" />

      {/* Loading content */}
      <div className="relative z-10 flex flex-col items-center gap-8">
        {/* Icons and beam */}
        <div className="relative flex items-center gap-32">
          {/* App Icon (source) */}
          <div className="relative z-10">
            <div className="relative w-16 h-16 rounded-lg bg-white border-2 border-black shadow-2xl p-2">
              <img
                src={appIcon}
                alt="KOYE AI"
                className="w-full h-full object-contain"
              />
              {/* Pulsing glow effect */}
              <div className="absolute inset-0 rounded-lg bg-white animate-pulse opacity-50" />
            </div>
          </div>

          {/* Beam animation */}
          <div className="absolute left-16 right-16 h-1 bg-gradient-to-r from-white via-white to-transparent opacity-0 transition-opacity duration-300"
            style={{
              opacity: animationProgress > 10 ? 1 : 0,
              background: `linear-gradient(to right, 
                   rgba(255, 255, 255, ${Math.min(animationProgress / 50, 1)}), 
                   rgba(255, 255, 255, ${Math.max(0, (animationProgress - 50) / 50)}), 
                   transparent)`
            }}
          >
            {/* Animated beam particle */}
            <div
              className="absolute top-1/2 -translate-y-1/2 w-3 h-3 bg-white rounded-full shadow-lg"
              style={{
                left: `${animationProgress}%`,
                transform: 'translate(-50%, -50%)',
                boxShadow: '0 0 20px rgba(255, 255, 255, 0.8)',
                transition: 'left 0.1s linear'
              }}
            />
          </div>

          {/* Image Gen Icon (destination) */}
          <div className={cn(
            "relative z-10 transition-all duration-500",
            animationProgress > 80 ? "scale-110" : "scale-100"
          )}>
            <div className={cn(
              "relative w-16 h-16 rounded-lg bg-white border-2 border-black shadow-2xl p-2 transition-all duration-500",
              animationProgress > 80 ? "border-white shadow-[0_0_30px_rgba(255,255,255,0.8)]" : ""
            )}>
              <div className="w-full h-full flex items-center justify-center">
                <svg
                  className="w-10 h-10 text-foreground"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                  />
                </svg>
              </div>
              {/* Pulsing glow effect when reached */}
              {animationProgress > 80 && (
                <div className="absolute inset-0 rounded-lg bg-white animate-pulse opacity-75" />
              )}
            </div>
          </div>
        </div>

        {/* Loading text */}
        <div className="text-center">
          <p className="text-white font-mono text-lg font-bold mb-2">
            $ generating_images...
          </p>
          <div className="flex gap-1 justify-center">
            <div className="w-2 h-2 bg-white rounded-full animate-bounce" style={{ animationDelay: '0s' }} />
            <div className="w-2 h-2 bg-white rounded-full animate-bounce" style={{ animationDelay: '0.2s' }} />
            <div className="w-2 h-2 bg-white rounded-full animate-bounce" style={{ animationDelay: '0.4s' }} />
          </div>
        </div>
      </div>
    </div>
  )
}

