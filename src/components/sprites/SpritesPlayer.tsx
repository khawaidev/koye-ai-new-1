import { Pause, Play } from "lucide-react"
import { useEffect, useRef, useState } from "react"
import { Button } from "../ui/button"

interface Sprite {
  id: number
  url: string
  prompt: string
}

interface SpritesPlayerProps {
  sprites: Sprite[]
  animationName?: string
  onBack?: () => void
}

export function SpritesPlayer({ sprites, animationName = "Animation", onBack }: SpritesPlayerProps) {
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentFrame, setCurrentFrame] = useState(0)
  const [duration, setDuration] = useState(1) // seconds
  const [customDuration, setCustomDuration] = useState("")
  const [showCustomInput, setShowCustomInput] = useState(false)
  const intervalRef = useRef<NodeJS.Timeout | null>(null)

  const frameInterval = duration / sprites.length

  useEffect(() => {
    if (isPlaying) {
      intervalRef.current = setInterval(() => {
        setCurrentFrame((prev) => (prev + 1) % sprites.length)
      }, frameInterval * 1000)
    } else {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
      }
    }
  }, [isPlaying, duration, sprites.length, frameInterval])

  const handleDurationChange = (value: number) => {
    setDuration(value)
    setShowCustomInput(false)
    setCustomDuration("")
  }

  const handleCustomDuration = () => {
    const num = parseFloat(customDuration)
    if (!isNaN(num) && num > 0) {
      setDuration(num)
      setShowCustomInput(false)
      setCustomDuration("")
    }
  }

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Header */}
      <header className="shrink-0 border-b border-border bg-background px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold text-foreground font-mono">{animationName}</h1>
            <p className="text-sm text-muted-foreground font-mono mt-1">{sprites.length} sprites</p>
          </div>
          {onBack && (
            <Button
              onClick={onBack}
              variant="outline"
              className="border-border bg-background text-foreground hover:bg-muted font-mono"
            >
              Back
            </Button>
          )}
        </div>
      </header>

      {/* Sprite Display Area */}
      <div className="flex-1 flex items-center justify-center bg-background p-8 min-h-0">
        <div className="relative w-full max-w-2xl aspect-square border-2 border-border bg-background shadow-2xl">
          {sprites[currentFrame] && (
            <img
              src={sprites[currentFrame].url}
              alt={`Frame ${currentFrame + 1}`}
              className="w-full h-full object-contain"
            />
          )}
        </div>
      </div>

      {/* Controls */}
      <div className="shrink-0 border-t border-border bg-background px-6 py-4">
        <div className="flex items-center justify-between gap-4">
          {/* Play/Pause */}
          <Button
            onClick={() => setIsPlaying(!isPlaying)}
            className="bg-foreground text-background hover:bg-muted-foreground border border-border font-mono px-6"
          >
            {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
          </Button>

          {/* Frame Counter */}
          <div className="text-sm text-foreground font-mono">
            Frame {currentFrame + 1} / {sprites.length}
          </div>

          {/* Duration Selector */}
          <div className="flex items-center gap-2">
            <span className="text-sm text-foreground font-mono">Duration:</span>
            <div className="flex gap-1">
              {[0.5, 1, 1.5].map((dur) => (
                <Button
                  key={dur}
                  onClick={() => handleDurationChange(dur)}
                  variant={duration === dur ? "default" : "outline"}
                  className={`font-mono text-xs px-3 ${duration === dur
                      ? "bg-foreground text-background border-border"
                      : "border-border bg-background text-foreground hover:bg-muted"
                    }`}
                >
                  {dur}s
                </Button>
              ))})
              {showCustomInput ? (
                <div className="flex gap-1">
                  <input
                    type="number"
                    value={customDuration}
                    onChange={(e) => setCustomDuration(e.target.value)}
                    placeholder="Custom"
                    className="w-20 px-2 py-1 border border-border text-foreground bg-background font-mono text-xs"
                    min="0.1"
                    step="0.1"
                  />
                  <Button
                    onClick={handleCustomDuration}
                    className="bg-foreground text-background hover:bg-muted-foreground border border-border font-mono text-xs px-2"
                  >
                    Set
                  </Button>
                  <Button
                    onClick={() => {
                      setShowCustomInput(false)
                      setCustomDuration("")
                    }}
                    variant="outline"
                    className="border-border bg-background text-foreground hover:bg-muted font-mono text-xs px-2"
                  >
                    Cancel
                  </Button>
                </div>
              ) : (
                <Button
                  onClick={() => setShowCustomInput(true)}
                  variant="outline"
                  className="border-border bg-background text-foreground hover:bg-muted font-mono text-xs px-3"
                >
                  Custom
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

