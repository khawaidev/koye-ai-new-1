import { Check, Lock, RefreshCw } from "lucide-react"
import React from "react"
import { useNavigate } from "react-router-dom"
import { useAuth } from "../../hooks/useAuth"
import { cn } from "../../lib/utils"
import type { Image } from "../../store/useAppStore"
import { Button } from "../ui/button"
import { PixelImage } from "../ui/pixel-image"
import { SignUpPopup } from "../ui/SignUpPopup"

interface ImageViewerProps {
  images: Image[]
  onRegenerate?: (view: Image["view"]) => void
  onReplace?: (view: Image["view"]) => void
  onApprove?: (view: Image["view"]) => void
  approvedViews?: Set<Image["view"]>
}

export function ImageViewer({
  images,
  onRegenerate,
  onReplace,
  onApprove,
  approvedViews = new Set(),
}: ImageViewerProps) {
  const { isAuthenticated } = useAuth()
  const navigate = useNavigate()
  const [showSignUpPopup, setShowSignUpPopup] = React.useState(false)

  const views: Array<{ view: Image["view"]; label: string }> = [
    { view: "front", label: "Front" },
    { view: "left", label: "Left" },
    { view: "right", label: "Right" },
    { view: "back", label: "Back" },
  ]

  const getImageForView = (view: Image["view"]) => {
    return images.find((img) => img.view === view)
  }

  const handleLockedAction = () => {
    if (!isAuthenticated) {
      setShowSignUpPopup(true)
    }
  }

  return (
    <>
      <SignUpPopup
        isOpen={showSignUpPopup}
        onClose={() => setShowSignUpPopup(false)}
      />
      <div className="grid grid-cols-2 gap-6 p-6 bg-background font-mono relative">
        {views.map(({ view, label }) => {
          const image = getImageForView(view)
          const isApproved = approvedViews.has(view)

          return (
            <div
              key={view}
              className={cn(
                "bg-background border-2 border-border",
                isApproved && "ring-2 ring-foreground border-foreground"
              )}
            >
              <div className="p-4">
                <div className="mb-3 flex items-center justify-between">
                  <h3 className="font-bold text-foreground text-sm">{label} View</h3>
                  {isApproved && (
                    <Check className="h-5 w-5 text-foreground" />
                  )}
                </div>

                <div className="relative mb-3 aspect-square w-full overflow-hidden border-2 border-border bg-background">
                  {/* Lock Icon Overlay for unregistered users */}
                  {!isAuthenticated && (
                    <div
                      className="absolute inset-0 z-20 flex items-center justify-center bg-background/90 cursor-pointer hover:bg-background/95 transition-colors"
                      onClick={handleLockedAction}
                    >
                      <div className="text-center">
                        <div className="flex justify-center mb-2">
                          <div className="bg-foreground rounded-full p-2 border-2 border-foreground">
                            <Lock className="h-6 w-6 text-background" />
                          </div>
                        </div>
                        <p className="text-xs font-bold text-foreground font-mono">Sign up to view</p>
                      </div>
                    </div>
                  )}
                  {image ? (
                    image.url === "error" ? (
                      <div className="flex h-full items-center justify-center bg-red-50 border-2 border-red-500">
                        <div className="text-center">
                          <p className="text-red-700 text-sm font-bold font-mono">$ error: Generation Failed</p>
                          <p className="text-red-600 text-xs mt-1 font-mono">Please try again</p>
                        </div>
                      </div>
                    ) : image.url === "" ? (
                      <div className="h-full w-full">
                        <PixelImage
                          src=""
                          alt={`${label} view - Loading`}
                          className="h-full w-full"
                        />
                        <div className="absolute inset-0 flex items-center justify-center bg-background/80">
                          <div className="text-muted-foreground text-sm font-mono">$ generating...</div>
                        </div>
                      </div>
                    ) : (
                      <PixelImage
                        src={image.url}
                        alt={`${label} view`}
                        className="h-full w-full"
                      />
                    )
                  ) : (
                    <div className="h-full w-full">
                      <PixelImage
                        src=""
                        alt={`${label} view - Loading`}
                        className="h-full w-full"
                      />
                      <div className="absolute inset-0 flex items-center justify-center bg-background/80">
                        <div className="text-muted-foreground text-sm font-mono">$ loading...</div>
                      </div>
                    </div>
                  )}
                </div>

                <div className="flex gap-2">
                  {onRegenerate && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => onRegenerate(view)}
                      className="flex-1 border-border bg-background text-foreground hover:bg-muted font-mono text-xs"
                    >
                      <RefreshCw className="mr-2 h-4 w-4" />
                      Regenerate
                    </Button>
                  )}
                  {onReplace && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => onReplace(view)}
                      className="flex-1 border-border bg-background text-foreground hover:bg-muted font-mono text-xs"
                    >
                      Replace
                    </Button>
                  )}
                  {onApprove && !isApproved && (
                    <Button
                      variant="default"
                      size="sm"
                      onClick={() => onApprove(view)}
                      className="flex-1 bg-foreground hover:bg-muted-foreground text-background border border-border font-mono text-xs"
                    >
                      <Check className="mr-2 h-4 w-4" />
                      Approve
                    </Button>
                  )}
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </>
  )
}
