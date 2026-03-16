import React from "react"
import type { Message } from "../../store/useAppStore"
import ReactMarkdown from "react-markdown"
import { Bot, User } from "lucide-react"
import { cn } from "../../lib/utils"

interface ChatMessageProps {
  message: Message
}

export function ChatMessage({ message }: ChatMessageProps) {
  const isUser = message.role === "user"

  return (
    <div
      className={cn(
        "flex gap-4 p-4",
        isUser ? "justify-end" : "justify-start"
      )}
    >
      {!isUser && (
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary">
          <Bot className="h-4 w-4 text-primary-foreground" />
        </div>
      )}
      
      <div
        className={cn(
          "max-w-[80%] rounded-lg px-4 py-2",
          isUser
            ? "bg-primary text-primary-foreground"
            : "bg-muted text-muted-foreground"
        )}
      >
        {message.images && message.images.length > 0 && (
          <div className="mb-2 flex gap-2">
            {message.images.map((img, idx) => (
              <img
                key={idx}
                src={img}
                alt={`Upload ${idx + 1}`}
                className="h-20 w-20 rounded object-cover"
              />
            ))}
          </div>
        )}
        
        <div className="prose prose-sm dark:prose-invert max-w-none">
          <ReactMarkdown>{message.content}</ReactMarkdown>
        </div>
      </div>

      {isUser && (
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-secondary">
          <User className="h-4 w-4 text-secondary-foreground" />
        </div>
      )}
    </div>
  )
}

