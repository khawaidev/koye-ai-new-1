import { cn } from "../../lib/utils"

interface OrbProps {
  className?: string
  colors?: string[]
  agentState?: "idle" | "thinking" | "speaking" | "listening"
  size?: number
}

export function Orb({ 
  className, 
  colors,
  agentState = "idle",
  size = 22
}: OrbProps) {
  // Use white colors by default, or use provided colors
  const baseColors = colors && colors.length > 0 
    ? colors 
    : ["#ffffff", "#e5e5e5", "#cccccc"]
  
  // Animation classes based on agent state
  const containerAnimation = {
    idle: "animate-pulse",
    thinking: "", // No container animation for thinking, only inner spin
    speaking: "animate-[pulse_1s_ease-in-out_infinite]",
    listening: "animate-[ping_2s_cubic-bezier(0,0,0.2,1)_infinite]"
  }[agentState] || "animate-pulse"

  return (
    <div
      className={cn(
        "relative rounded-full overflow-hidden",
        containerAnimation,
        className
      )}
      style={{
        width: size,
        height: size,
        background: `radial-gradient(circle at 30% 30%, ${baseColors[0]}, ${baseColors[1] || baseColors[0]}, ${baseColors[2] || baseColors[0]})`,
        boxShadow: `0 0 ${size * 0.5}px rgba(255, 255, 255, 0.3), inset 0 0 ${size * 0.3}px rgba(255, 255, 255, 0.2)`,
      }}
    >
      {/* Animated gradient overlay - spins for thinking, pulses for speaking */}
      <div
        className={cn(
          "absolute inset-0 opacity-40",
          agentState === "thinking" && "animate-spin",
          agentState === "speaking" && "animate-pulse"
        )}
        style={{
          background: `conic-gradient(from 0deg, ${baseColors.join(", ")}, ${baseColors[0]})`,
        }}
      />
      
      {/* Inner glow - different intensity based on state */}
      <div
        className={cn(
          "absolute inset-[30%] rounded-full blur-sm",
          agentState === "thinking" ? "opacity-80" : 
          agentState === "speaking" ? "opacity-70 animate-pulse" :
          agentState === "listening" ? "opacity-60 animate-ping" :
          "opacity-50"
        )}
        style={{
          background: `radial-gradient(circle, rgba(255, 255, 255, 0.8), transparent)`,
        }}
      />
      
      {/* Outer ring for listening state */}
      {agentState === "listening" && (
        <div
          className="absolute inset-0 rounded-full border-2 border-white/40 animate-ping"
          style={{
            animation: "ping 2s cubic-bezier(0, 0, 0.2, 1) infinite",
          }}
        />
      )}
    </div>
  )
}

