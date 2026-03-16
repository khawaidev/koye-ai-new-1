import { useState } from "react"
import { cn } from "../../lib/utils"
import { ImageViewerModal } from "../ui/image-viewer-modal"
import { PixelImage } from "../ui/pixel-image"

interface ImageGenerationCardsProps {
  images: Array<{ view: "front" | "left" | "right" | "back"; url: string }>
  isLoading?: boolean
  className?: string
}

export function ImageGenerationCards({ images, isLoading = false, className }: ImageGenerationCardsProps) {
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [selectedIndex, setSelectedIndex] = useState(0)

  // All possible views with labels
  const allViews: Array<{ view: "front" | "left" | "right" | "back"; label: string }> = [
    { view: "front", label: "Front" },
    { view: "left", label: "Left" },
    { view: "right", label: "Right" },
    { view: "back", label: "Back" },
  ]

  // Dynamically filter views based on what images are actually provided
  // This ensures we only show cards for images that exist or are loading
  const views = allViews.filter(({ view }) =>
    images.some(img => img.view === view)
  )

  // If no valid views found but images exist, show all views that have images
  // This handles the case where images might have different view values
  const displayViews = views.length > 0 ? views :
    images.map(img => ({
      view: img.view,
      label: img.view.charAt(0).toUpperCase() + img.view.slice(1)
    }))

  // Prepare images for modal (only valid images)
  const validImages = displayViews
    .map(({ view, label }) => {
      const image = images.find((img) => img.view === view)
      if (image && image.url && image.url !== "error") {
        return { view, url: image.url, label }
      }
      return null
    })
    .filter((img): img is { view: "front" | "left" | "right" | "back"; url: string; label: string } => img !== null)

  const handleImageClick = (index: number) => {
    // Find the index in validImages array
    const clickedView = displayViews[index]
    if (!clickedView) return
    const validIndex = validImages.findIndex((img) => img.view === clickedView.view)
    if (validIndex !== -1) {
      setSelectedIndex(validIndex)
      setIsModalOpen(true)
    }
  }

  return (
    <>
      <div className={cn("flex gap-2 flex-wrap", className)}>
        {displayViews.map(({ view, label }, index) => {
          const image = images.find((img) => img.view === view)
          const url = image?.url || ""
          const isError = url === "error"
          const isEmpty = !url || url === ""
          const isValid = url && url !== "error"
          const isClickable = isValid && validImages.length > 0

          return (
            <div
              key={view}
              className={cn(
                "relative flex flex-col gap-1.5",
                "w-24 h-24 overflow-hidden",
                "border-2 border-black bg-white",
                isError && "border-red-500 bg-red-50",
                isClickable && "cursor-pointer hover:border-black hover:scale-105 transition-all"
              )}
              onClick={() => isClickable && handleImageClick(index)}
            >
              {isEmpty && !isError ? (
                <PixelImage
                  src=""
                  alt={`${label} view - Loading`}
                  className="h-full w-full"
                />
              ) : isError ? (
                <div className="flex h-full items-center justify-center bg-red-50">
                  <div className="text-center">
                    <p className="text-red-700 text-[10px] font-bold font-mono">Error</p>
                  </div>
                </div>
              ) : (
                <PixelImage
                  src={url}
                  alt={`${label} view`}
                  className="h-full w-full"
                />
              )}
              <div className="absolute bottom-0 left-0 right-0 bg-black px-1 py-0.5">
                <p className="text-[10px] text-white text-center truncate font-mono font-bold">{label}</p>
              </div>
            </div>
          )
        })}
      </div>

      {/* Image Viewer Modal */}
      {validImages.length > 0 && (
        <ImageViewerModal
          images={validImages}
          currentIndex={selectedIndex}
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          onNavigate={(index) => setSelectedIndex(index)}
        />
      )}
    </>
  )
}

