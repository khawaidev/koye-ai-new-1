import React, { forwardRef, useRef } from "react"
import { cn } from "../../lib/utils"

interface AnimatedBeamProps {
  className?: string
  containerRef: React.RefObject<HTMLDivElement>
  fromRef: React.RefObject<HTMLDivElement>
  toRef: React.RefObject<HTMLDivElement>
  curvature?: number
  reverse?: boolean
  duration?: number
  delay?: number
}

export const AnimatedBeam = forwardRef<HTMLDivElement, AnimatedBeamProps>(
  (
    {
      className,
      containerRef,
      fromRef,
      toRef,
      curvature = 0,
      reverse = false,
      duration = 3,
      delay = 0,
    },
    ref
  ) => {
    return (
      <svg
        ref={ref}
        width="100%"
        height="100%"
        className={cn(
          "pointer-events-none absolute left-0 top-0 transform-gpu stroke-2",
          className
        )}
        style={{
          strokeDasharray: "4 2",
          strokeDashoffset: "0",
          animation: `dash ${duration}s linear ${delay}s infinite`,
        }}
      >
        <defs>
          <linearGradient id="gradient" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity="0" />
            <stop offset="50%" stopColor="hsl(var(--primary))" stopOpacity="1" />
            <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path
          d="M 0,0 Q 50,50 100,0"
          stroke="url(#gradient)"
          fill="none"
          className="path"
        />
      </svg>
    )
  }
)
AnimatedBeam.displayName = "AnimatedBeam"

