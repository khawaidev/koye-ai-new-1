import { User } from "lucide-react"
import React from "react"
import { cn } from "../../lib/utils"

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

export function ChatAvatar({ role, className }: ChatAvatarProps) {
  const isUser = role === "user"

  if (!isUser) {
    return null
  }

  return (
    <div
      className={cn(
        "flex h-10 w-10 shrink-0 items-center justify-center",
        className
      )}
    >
      <div className="flex h-10 w-10 items-center justify-center rounded-full border-2 border-foreground bg-background text-foreground">
        <User className="h-5 w-5" />
      </div>
    </div>
  )
}
