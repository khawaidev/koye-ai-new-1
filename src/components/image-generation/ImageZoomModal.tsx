import { Download, RotateCw, X, ZoomIn, ZoomOut } from "lucide-react"
import { useEffect, useState } from "react"
import { Button } from "../ui/button"

interface ImageZoomModalProps {
  imageUrl: string
  imageName: string
  isOpen: boolean
  onClose: () => void
}

export function ImageZoomModal({ imageUrl, imageName, isOpen, onClose }: ImageZoomModalProps) {
  const [zoom, setZoom] = useState(1)
  const [position, setPosition] = useState({ x: 0, y: 0 })
  const [isDragging, setIsDragging] = useState(false)
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 })
  const [rotation, setRotation] = useState(0)

  // Reset zoom and position when modal opens
  useEffect(() => {
    if (isOpen) {
      setZoom(1)
      setPosition({ x: 0, y: 0 })
      setRotation(0)
    }
  }, [isOpen])

  // Handle keyboard shortcuts
  useEffect(() => {
    if (!isOpen) return

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose()
      } else if (e.key === "+" || e.key === "=") {
        handleZoomIn()
      } else if (e.key === "-") {
        handleZoomOut()
      } else if (e.key === "0") {
        handleResetZoom()
      } else if (e.key === "r" || e.key === "R") {
        handleRotate()
      }
    }

    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [isOpen, zoom])

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

  const handleRotate = () => {
    setRotation((prev) => (prev + 90) % 360)
  }

  const handleDownload = async () => {
    try {
      const response = await fetch(imageUrl)
      const blob = await response.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = imageName || `generated-image-${Date.now()}.png`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch (error) {
      console.error("Failed to download image:", error)
    }
  }

  if (!isOpen) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-background/95 backdrop-blur-sm"
      onClick={onClose}
      onWheel={handleWheel}
    >
      {/* Close button */}
      <button
        onClick={onClose}
        className="absolute top-4 right-4 z-10 bg-foreground p-2 text-background hover:bg-muted-foreground border-2 border-border transition-colors font-mono"
        aria-label="Close"
      >
        <X className="h-6 w-6" />
      </button>

      {/* Image container */}
      <div
        className="relative max-w-[95vw] max-h-[95vh] overflow-hidden"
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
          <img
            src={imageUrl}
            alt={imageName}
            className="max-w-full max-h-[95vh] object-contain"
            draggable={false}
          />
        </div>
      </div>

      {/* Controls toolbar */}
      <div
        className="absolute bottom-4 left-1/2 -translate-x-1/2 z-10 flex gap-2 bg-background p-3 border-2 border-border font-mono"
        onClick={(e) => e.stopPropagation()}
      >
        <Button
          onClick={(e) => {
            e.stopPropagation()
            handleZoomOut()
          }}
          variant="ghost"
          size="sm"
          disabled={zoom <= 0.5}
          className="text-foreground hover:bg-muted border border-border"
          aria-label="Zoom out"
        >
          <ZoomOut className="h-5 w-5" />
        </Button>

        <Button
          onClick={(e) => {
            e.stopPropagation()
            handleResetZoom()
          }}
          variant="ghost"
          size="sm"
          className="text-foreground hover:bg-muted min-w-[60px] border border-border font-mono"
          aria-label="Reset zoom"
        >
          {Math.round(zoom * 100)}%
        </Button>

        <Button
          onClick={(e) => {
            e.stopPropagation()
            handleZoomIn()
          }}
          variant="ghost"
          size="sm"
          disabled={zoom >= 5}
          className="text-foreground hover:bg-muted border border-border"
          aria-label="Zoom in"
        >
          <ZoomIn className="h-5 w-5" />
        </Button>

        <div className="w-px bg-border mx-1" />

        <Button
          onClick={(e) => {
            e.stopPropagation()
            handleRotate()
          }}
          variant="ghost"
          size="sm"
          className="text-foreground hover:bg-muted border border-border"
          aria-label="Rotate"
        >
          <RotateCw className="h-5 w-5" />
        </Button>

        <div className="w-px bg-border mx-1" />

        <Button
          onClick={(e) => {
            e.stopPropagation()
            handleDownload()
          }}
          variant="ghost"
          size="sm"
          className="text-foreground hover:bg-muted border border-border font-mono"
          aria-label="Download"
        >
          <Download className="h-5 w-5 mr-2" />
          Download
        </Button>
      </div>

      {/* Zoom indicator */}
      <div className="absolute top-4 left-1/2 -translate-x-1/2 z-10 bg-background px-4 py-2 text-sm text-foreground border-2 border-border font-mono font-bold">
        {imageName}
      </div>
    </div>
  )
}

