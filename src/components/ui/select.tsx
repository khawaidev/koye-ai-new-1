import { ChevronDown } from "lucide-react"
import * as React from "react"
import { cn } from "../../lib/utils"

export interface SelectProps {
  value: string
  onValueChange: (value: string) => void
  options: { value: string; label: string }[]
  className?: string
}

export function Select({ value, onValueChange, options, className }: SelectProps) {
  const [isOpen, setIsOpen] = React.useState(false)
  const selectRef = React.useRef<HTMLDivElement>(null)

  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (selectRef.current && !selectRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside)
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside)
    }
  }, [isOpen])

  const selectedOption = options.find((opt) => opt.value === value) || options[0]

  return (
    <div ref={selectRef} className={cn("relative", className)}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "flex items-center gap-2 px-3 py-1.5",
          "bg-background border border-border",
          "text-sm text-foreground font-mono",
          "hover:bg-muted transition-colors",
          "focus:outline-none focus:ring-0"
        )}
      >
        <span>{selectedOption.label}</span>
        <ChevronDown
          className={cn(
            "h-4 w-4 text-muted-foreground transition-transform",
            isOpen && "rotate-180"
          )}
        />
      </button>

      {isOpen && (
        <div className="absolute top-full left-0 mt-1 z-50 min-w-full">
          <div className="bg-background border-2 border-border shadow-lg overflow-hidden">
            {options.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => {
                  onValueChange(option.value)
                  setIsOpen(false)
                }}
                className={cn(
                  "w-full px-3 py-2 text-left text-sm text-foreground font-mono",
                  "hover:bg-muted transition-colors",
                  value === option.value && "bg-foreground text-background"
                )}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

