import React from "react"
import { cn } from "../../lib/utils"

interface ShimmerProps {
  className?: string
  width?: string
  height?: string
}

export function Shimmer({ className, width = "100%", height = "100%" }: ShimmerProps) {
  return (
    <div
      className={cn("animate-pulse bg-gradient-to-r from-muted via-muted/50 to-muted", className)}
      style={{ width, height }}
    >
      <div className="h-full w-full bg-gradient-to-r from-transparent via-white/10 to-transparent animate-shimmer" />
    </div>
  )
}

export function ShimmeringText({ text, className }: { text: string; className?: string }) {
  return (
    <div className={cn("relative overflow-hidden", className)}>
      <div className="animate-shimmer bg-gradient-to-r from-transparent via-white/20 to-transparent absolute inset-0" />
      <span className="relative">{text}</span>
    </div>
  )
}

