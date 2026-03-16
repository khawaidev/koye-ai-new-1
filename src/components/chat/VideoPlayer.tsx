import { useState, useRef, useEffect } from "react"
import { Maximize2, Minimize2, Play, Pause, Volume2, VolumeX } from "lucide-react"
import { cn } from "../../lib/utils"

interface VideoPlayerProps {
  videoUrl: string
  className?: string
  autoPlay?: boolean
}

export function VideoPlayer({ videoUrl, className, autoPlay = false }: VideoPlayerProps) {
  const [isPlaying, setIsPlaying] = useState(autoPlay)
  const [isMuted, setIsMuted] = useState(false)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [showControls, setShowControls] = useState(true)
  const videoRef = useRef<HTMLVideoElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const controlsTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    const video = videoRef.current
    if (!video) return

    if (isPlaying) {
      video.play().catch(console.error)
    } else {
      video.pause()
    }
  }, [isPlaying])

  useEffect(() => {
    const video = videoRef.current
    if (!video) return

    video.muted = isMuted
  }, [isMuted])

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    if (isFullscreen) {
      if (container.requestFullscreen) {
        container.requestFullscreen()
      }
    } else {
      if (document.fullscreenElement) {
        document.exitFullscreen()
      }
    }
  }, [isFullscreen])

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement)
    }

    document.addEventListener("fullscreenchange", handleFullscreenChange)
    return () => {
      document.removeEventListener("fullscreenchange", handleFullscreenChange)
    }
  }, [])

  const handleMouseMove = () => {
    setShowControls(true)
    if (controlsTimeoutRef.current) {
      clearTimeout(controlsTimeoutRef.current)
    }
    controlsTimeoutRef.current = setTimeout(() => {
      if (isPlaying) {
        setShowControls(false)
      }
    }, 3000)
  }

  const togglePlay = () => {
    setIsPlaying(!isPlaying)
  }

  const toggleMute = () => {
    setIsMuted(!isMuted)
  }

  const toggleFullscreen = () => {
    setIsFullscreen(!isFullscreen)
  }

  return (
    <div
      ref={containerRef}
      className={cn(
        "relative bg-black border-2 border-black rounded-lg overflow-hidden group",
        className
      )}
      onMouseMove={handleMouseMove}
      onMouseLeave={() => {
        if (isPlaying) {
          setShowControls(false)
        }
      }}
    >
      <video
        ref={videoRef}
        src={videoUrl}
        className="w-full h-full object-contain"
        loop
        playsInline
        onClick={togglePlay}
      />

      {/* Controls Overlay */}
      <div
        className={cn(
          "absolute inset-0 bg-black/40 transition-opacity duration-300 flex items-center justify-center",
          showControls ? "opacity-100" : "opacity-0"
        )}
      >
        {/* Play/Pause Button (Center) */}
        <button
          onClick={togglePlay}
          className="absolute inset-0 flex items-center justify-center"
        >
          {!isPlaying && (
            <div className="bg-white/90 rounded-full p-4 hover:bg-white transition-colors">
              <Play className="h-8 w-8 text-black ml-1" fill="black" />
            </div>
          )}
        </button>

        {/* Bottom Controls Bar */}
        <div className="absolute bottom-0 left-0 right-0 bg-black/80 p-3 flex items-center gap-3">
          {/* Play/Pause */}
          <button
            onClick={togglePlay}
            className="text-white hover:text-white/80 transition-colors"
            aria-label={isPlaying ? "Pause" : "Play"}
          >
            {isPlaying ? (
              <Pause className="h-5 w-5" />
            ) : (
              <Play className="h-5 w-5" fill="white" />
            )}
          </button>

          {/* Mute/Unmute */}
          <button
            onClick={toggleMute}
            className="text-white hover:text-white/80 transition-colors"
            aria-label={isMuted ? "Unmute" : "Mute"}
          >
            {isMuted ? (
              <VolumeX className="h-5 w-5" />
            ) : (
              <Volume2 className="h-5 w-5" />
            )}
          </button>

          {/* Spacer */}
          <div className="flex-1" />

          {/* Fullscreen Toggle */}
          <button
            onClick={toggleFullscreen}
            className="text-white hover:text-white/80 transition-colors"
            aria-label={isFullscreen ? "Exit fullscreen" : "Enter fullscreen"}
          >
            {isFullscreen ? (
              <Minimize2 className="h-5 w-5" />
            ) : (
              <Maximize2 className="h-5 w-5" />
            )}
          </button>
        </div>
      </div>
    </div>
  )
}

