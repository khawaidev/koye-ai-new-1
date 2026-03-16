import React, { useEffect, useState } from "react"
import { X, ZoomIn, ZoomOut, ChevronLeft, ChevronRight, RotateCw } from "lucide-react"
import { cn } from "../../lib/utils"
import { PixelImage } from "./pixel-image"

interface ImageViewerModalProps {
  images: Array<{ view: string; url: string; label: string }>
  currentIndex: number
  isOpen: boolean
  onClose: () => void
  onNavigate: (index: number) => void
}

export function ImageViewerModal({
  images,
  currentIndex,
  isOpen,
  onClose,
  onNavigate,
}: ImageViewerModalProps) {
  const [zoom, setZoom] = useState(1)
  const [position, setPosition] = useState({ x: 0, y: 0 })
  const [isDragging, setIsDragging] = useState(false)
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 })
  const [rotation, setRotation] = useState(0)

  const currentImage = images[currentIndex]

  // Reset zoom and position when image changes
  useEffect(() => {
    setZoom(1)
    setPosition({ x: 0, y: 0 })
    setRotation(0)
  }, [currentIndex])

  // Handle keyboard navigation
  useEffect(() => {
    if (!isOpen) return

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose()
      } else if (e.key === "ArrowLeft") {
        handlePrevious()
      } else if (e.key === "ArrowRight") {
        handleNext()
      } else if (e.key === "+" || e.key === "=") {
        handleZoomIn()
      } else if (e.key === "-") {
        handleZoomOut()
      } else if (e.key === "0") {
        handleResetZoom()
      }
    }

    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [isOpen, currentIndex, images.length])

  const handleZoomIn = () => {
    setZoom((prev) => Math.min(prev + 0.25, 5))
  }

  const handleZoomOut = () => {
    setZoom((prev) => Math.max(prev - 0.25, 0.5))
  }

  const handleResetZoom = () => {
    setZoom(1)
    setPosition({ x: 0, y: 0 })
    setRotation(0)
  }

  const handleWheel = (e: React.WheelEvent) => {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault()
      const delta = e.deltaY > 0 ? -0.1 : 0.1
      setZoom((prev) => Math.max(0.5, Math.min(5, prev + delta)))
    }
  }

  const handleMouseDown = (e: React.MouseEvent) => {
    if (zoom > 1) {
      setIsDragging(true)
      setDragStart({
        x: e.clientX - position.x,
        y: e.clientY - position.y,
      })
    }
  }

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isDragging && zoom > 1) {
      setPosition({
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y,
      })
    }
  }

  const handleMouseUp = () => {
    setIsDragging(false)
  }

  const handleNext = () => {
    if (currentIndex < images.length - 1) {
      onNavigate(currentIndex + 1)
    }
  }

  const handlePrevious = () => {
    if (currentIndex > 0) {
      onNavigate(currentIndex - 1)
    }
  }

  const handleRotate = () => {
    setRotation((prev) => (prev + 90) % 360)
  }

  if (!isOpen || !currentImage) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/95 backdrop-blur-sm"
      onClick={onClose}
      onWheel={handleWheel}
    >
      {/* Close button */}
      <button
        onClick={onClose}
        className="absolute top-4 right-4 z-10 rounded-full bg-black/50 p-2 text-white hover:bg-black/70 transition-colors"
        aria-label="Close"
      >
        <X className="h-6 w-6" />
      </button>

      {/* Navigation buttons */}
      {currentIndex > 0 && (
        <button
          onClick={(e) => {
            e.stopPropagation()
            handlePrevious()
          }}
          className="absolute left-4 z-10 rounded-full bg-black/50 p-3 text-white hover:bg-black/70 transition-colors"
          aria-label="Previous image"
        >
          <ChevronLeft className="h-6 w-6" />
        </button>
      )}

      {currentIndex < images.length - 1 && (
        <button
          onClick={(e) => {
            e.stopPropagation()
            handleNext()
          }}
          className="absolute right-4 z-10 rounded-full bg-black/50 p-3 text-white hover:bg-black/70 transition-colors"
          aria-label="Next image"
        >
          <ChevronRight className="h-6 w-6" />
        </button>
      )}

      {/* Image container */}
      <div
        className="relative max-w-[90vw] max-h-[90vh] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        style={{ cursor: zoom > 1 ? (isDragging ? "grabbing" : "grab") : "default" }}
      >
        <div
          style={{
            transform: `translate(${position.x}px, ${position.y}px) scale(${zoom}) rotate(${rotation}deg)`,
            transition: isDragging ? "none" : "transform 0.2s ease-out",
          }}
        >
          {currentImage.url && currentImage.url !== "error" ? (
            <img
              src={currentImage.url}
              alt={currentImage.label}
              className="max-w-full max-h-[90vh] object-contain"
              draggable={false}
            />
          ) : (
            <div className="flex h-[60vh] w-[60vw] items-center justify-center bg-gray-900">
              <p className="text-white/60">Image not available</p>
            </div>
          )}
        </div>
      </div>

      {/* Controls toolbar */}
      <div
        className="absolute bottom-4 left-1/2 -translate-x-1/2 z-10 flex gap-2 rounded-lg bg-black/50 p-2 backdrop-blur-sm"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={(e) => {
            e.stopPropagation()
            handleZoomOut()
          }}
          className="rounded p-2 text-white hover:bg-white/10 transition-colors"
          aria-label="Zoom out"
          disabled={zoom <= 0.5}
        >
          <ZoomOut className="h-5 w-5" />
        </button>

        <button
          onClick={(e) => {
            e.stopPropagation()
            handleResetZoom()
          }}
          className="rounded px-3 py-2 text-sm text-white hover:bg-white/10 transition-colors"
          aria-label="Reset zoom"
        >
          {Math.round(zoom * 100)}%
        </button>

        <button
          onClick={(e) => {
            e.stopPropagation()
            handleZoomIn()
          }}
          className="rounded p-2 text-white hover:bg-white/10 transition-colors"
          aria-label="Zoom in"
          disabled={zoom >= 5}
        >
          <ZoomIn className="h-5 w-5" />
        </button>

        <button
          onClick={(e) => {
            e.stopPropagation()
            handleRotate()
          }}
          className="rounded p-2 text-white hover:bg-white/10 transition-colors"
          aria-label="Rotate"
        >
          <RotateCw className="h-5 w-5" />
        </button>
      </div>

      {/* Image counter */}
      <div className="absolute top-4 left-1/2 -translate-x-1/2 z-10 rounded-lg bg-black/50 px-4 py-2 text-sm text-white backdrop-blur-sm">
        {currentIndex + 1} / {images.length} - {currentImage.label}
      </div>
    </div>
  )
}

