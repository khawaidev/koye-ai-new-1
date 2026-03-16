import React, { useState } from "react"
import { cn } from "../../lib/utils"
import { Shimmer } from "./shimmer"

interface PixelImageProps {
  src?: string
  alt?: string
  className?: string
  width?: number | string
  height?: number | string
  shimmerClassName?: string
}

export function PixelImage({
  src,
  alt = "",
  className,
  width,
  height,
  shimmerClassName,
}: PixelImageProps) {
  const [isLoading, setIsLoading] = useState(true)
  const [hasError, setHasError] = useState(false)

  return (
    <div
      className={cn("relative overflow-hidden", className)}
      style={{ width, height }}
    >
      {(!src || isLoading) && !hasError && (
        <Shimmer className={cn("absolute inset-0", shimmerClassName)} />
      )}
      {src && !hasError ? (
        <img
          src={src}
          alt={alt}
          className={cn(
            "h-full w-full object-cover transition-opacity duration-300",
            isLoading ? "opacity-0" : "opacity-100"
          )}
          onLoad={() => setIsLoading(false)}
          onError={() => {
            setIsLoading(false)
            setHasError(true)
          }}
        />
      ) : !src ? (
        <div className="absolute inset-0 bg-gray-900" />
      ) : (
        <div className="flex h-full w-full items-center justify-center bg-muted">
          <span className="text-sm text-muted-foreground">No image</span>
        </div>
      )}
    </div>
  )
}

