import { User } from "lucide-react"
import React from "react"
import iconJpg from "../../assets/icon.jpg"
import iconPng from "../../assets/icon.png"
import { cn } from "../../lib/utils"
import { useTheme } from "../theme-provider"

interface VoiceChatLayoutProps {
  children: React.ReactNode
  className?: string
}

export function VoiceChatLayout({ children, className }: VoiceChatLayoutProps) {
  return (
    <div
      className={cn("flex h-full w-full flex-col bg-background overflow-hidden", className)}
    >
      {children}
    </div>
  )
}

interface ChatAvatarProps {
  role: "user" | "assistant"
  className?: string
  agentState?: "idle" | "thinking" | "speaking" | "listening"
}

export function ChatAvatar({ role, className, agentState = "idle" }: ChatAvatarProps) {
  const isUser = role === "user"
  const { theme } = useTheme()

  // Determine animation class based on agentState
  let animationClass = ""
  if (!isUser) {
    switch (agentState) {
      case "thinking":
        animationClass = "animate-spin-think"
        break
      case "speaking":
        animationClass = "animate-spin-fast"
        break
      case "idle":
      default:
        animationClass = "animate-spin-slow"
        break
    }
  }

  // Select icon based on theme
  const aiIcon = theme === "dark" ? iconPng : iconJpg

  return (
    <div
      className={cn(
        "flex h-10 w-10 shrink-0 items-center justify-center",
        className
      )}
    >
      {isUser ? (
        <div className="flex h-10 w-10 items-center justify-center rounded-full border-2 border-foreground bg-background text-foreground">
          <User className="h-5 w-5" />
        </div>
      ) : (
        <div className={cn("h-10 w-10 rounded-full overflow-hidden border-2 border-foreground bg-background", animationClass)}>
          <img src={aiIcon} alt="AI" className="h-full w-full object-cover" />
        </div>
      )}
    </div>
  )
}
