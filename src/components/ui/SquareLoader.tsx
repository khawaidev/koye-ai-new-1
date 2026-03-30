
import { cn } from "../../lib/utils"

export function SquareLoader({ className }: { className?: string }) {
  // It natively occupies ~50x50, so we wrap it in a container that scales it down to ~25x25
  return (
    <div className={cn("relative w-[50px] h-[50px] scale-50 origin-center shrink-0", className)}>
      <div className="square" id="sq1"></div>
      <div className="square" id="sq2"></div>
      <div className="square" id="sq3"></div>
      <div className="square" id="sq4"></div>
      <div className="square" id="sq5"></div>
      <div className="square" id="sq6"></div>
      <div className="square" id="sq7"></div>
      <div className="square" id="sq8"></div>
      <div className="square" id="sq9"></div>
    </div>
  )
}

