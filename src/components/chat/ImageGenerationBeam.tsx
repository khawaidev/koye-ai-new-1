import { useRef } from "react"
import appIcon from "../../assets/icon.jpg"
import imageIcon from "../../assets/image.png"
import { cn } from "../../lib/utils"

interface ImageGenerationBeamProps {
  isGenerating: boolean
  className?: string
}

export function ImageGenerationBeam({ isGenerating, className }: ImageGenerationBeamProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const fromRef = useRef<HTMLDivElement>(null)
  const toRef = useRef<HTMLDivElement>(null)

  if (!isGenerating) return null

  return (
    <div
      ref={containerRef}
      className={cn(
        "relative flex items-center justify-center gap-3 py-6 px-4",
        className
      )}
    >
      {/* App Icon (Source) */}
      <div
        ref={fromRef}
        className="relative z-10 flex h-10 w-10 items-center justify-center rounded-full bg-black border-2 border-white/20 shadow-lg"
      >
        <img
          src={appIcon}
          alt="KOYE"
          className="h-8 w-8 rounded-full object-cover"
        />
      </div>

      {/* Animated Beam */}
      <div className="relative w-32 h-1 overflow-hidden">
        <svg
          width="100%"
          height="100%"
          className="absolute inset-0"
          style={{ overflow: "visible" }}
        >
          <defs>
            <linearGradient id="orange-beam-gradient" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#fb923c" stopOpacity="0" />
              <stop offset="30%" stopColor="#fb923c" stopOpacity="0.8" />
              <stop offset="50%" stopColor="#fb923c" stopOpacity="1" />
              <stop offset="70%" stopColor="#fb923c" stopOpacity="0.8" />
              <stop offset="100%" stopColor="#fb923c" stopOpacity="0" />
            </linearGradient>
            <filter id="orange-glow">
              <feGaussianBlur stdDeviation="2" result="coloredBlur" />
              <feMerge>
                <feMergeNode in="coloredBlur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>
          <line
            x1="0"
            y1="50%"
            x2="100%"
            y2="50%"
            stroke="url(#orange-beam-gradient)"
            strokeWidth="3"
            filter="url(#orange-glow)"
            className="beam-line"
            style={{
              strokeDasharray: "12 6",
            }}
          />
        </svg>
      </div>

      {/* Image Icon (Destination) */}
      <div
        ref={toRef}
        className="relative z-10 flex h-10 w-10 items-center justify-center rounded-full bg-black border-2 border-orange-400/70 shadow-lg"
      >
        <img
          src={imageIcon}
          alt="Image"
          className="h-6 w-6 object-contain"
        />
      </div>

      <style>{`
        .beam-line {
          animation: beam-dash 1.5s linear infinite, beam-pulse 2s ease-in-out infinite;
        }
        
        @keyframes beam-dash {
          0% {
            stroke-dashoffset: 0;
          }
          100% {
            stroke-dashoffset: -18;
          }
        }
        
        @keyframes beam-pulse {
          0%, 100% {
            opacity: 0.6;
          }
          50% {
            opacity: 1;
          }
        }
      `}</style>
    </div>
  )
}

