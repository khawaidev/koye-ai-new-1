import { X } from "lucide-react"
import { useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"

interface SignUpPopupProps {
  isOpen: boolean
  onClose: () => void
}

export function SignUpPopup({ isOpen, onClose }: SignUpPopupProps) {
  const navigate = useNavigate()
  const [isVisible, setIsVisible] = useState(false)

  useEffect(() => {
    if (isOpen) {
      // Trigger animation after a brief delay
      setTimeout(() => setIsVisible(true), 10)
    } else {
      setIsVisible(false)
    }
  }, [isOpen])

  const handleSignUp = () => {
    navigate("/signup")
    onClose()
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-4 pointer-events-none">
      <div
        className={`
          bg-background border-2 border-border shadow-2xl px-6 py-4
          transform transition-all duration-300 ease-out pointer-events-auto
          font-mono
          ${isVisible ? "translate-y-0 opacity-100" : "-translate-y-full opacity-0"}
        `}
      >
        <div className="flex items-center justify-between gap-4">
          <div className="flex-1">
            <p className="text-sm font-bold text-foreground">
              $ sign_up_for_free_to_use_this_feature
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleSignUp}
              className="px-4 py-1.5 bg-foreground text-background hover:bg-muted-foreground border border-foreground text-xs font-mono transition-colors"
            >
              Sign Up
            </button>
            <button
              onClick={onClose}
              className="p-1 hover:bg-muted rounded border border-border transition-colors"
              aria-label="Close"
            >
              <X className="h-4 w-4 text-foreground" />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

