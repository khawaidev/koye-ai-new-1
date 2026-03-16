import React from "react"
import ReactMarkdown from "react-markdown"
import { cn } from "../../lib/utils"
import { PixelImage } from "../ui/pixel-image"
import { ChatAvatar } from "./VoiceChatLayout"

interface MessageBubbleProps {
  role: "user" | "assistant"
  content: string
  images?: string[]
  isThinking?: boolean
  className?: string
}

export function MessageBubble({
  role,
  content,
  images,
  isThinking = false,
  className,
}: MessageBubbleProps) {
  const isUser = role === "user"
  const agentState = isThinking ? "thinking" : "idle"

  return (
    <div
      className={cn(
        "flex gap-4",
        isUser ? "justify-end" : "flex-row",
        className
      )}
    >
      {!isUser && <ChatAvatar role={role} agentState={agentState} />}

      <div
        className={cn(
          "flex flex-col gap-3",
          isUser ? "items-end" : "items-start max-w-[85%]"
        )}
      >
        {images && images.length > 0 && (
          <div className="flex gap-2 flex-wrap">
            {images.map((img, idx) => (
              <PixelImage
                key={idx}
                src={img}
                alt={`Attachment ${idx + 1}`}
                className="h-36 w-36 rounded-lg border border-border shadow-md"
              />
            ))}
          </div>
        )}

        <div
          className={cn(
            "transition-all text-[15px] leading-relaxed",
            isUser
              ? "px-4 py-1 text-foreground bg-secondary rounded-2xl rounded-br-none max-w-fit shadow-sm"
              : "px-1 py-1 text-foreground bg-transparent"
          )}
        >
          {isThinking ? (
            <div className="flex items-center gap-3 px-3">
              <span className="text-muted-foreground">Thinking...</span>
              <span className="inline-flex gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground animate-bounce" style={{ animationDelay: '0ms' }} />
                <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground animate-bounce" style={{ animationDelay: '150ms' }} />
                <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground animate-bounce" style={{ animationDelay: '300ms' }} />
              </span>
            </div>
          ) : (
            <div className={cn(
              "prose prose-lg max-w-none",
              "prose-headings:text-foreground prose-headings:font-semibold prose-headings:mb-2 prose-headings:mt-3",
              "prose-p:text-foreground prose-p:leading-[1.75] prose-p:text-[15px]",
              isUser ? "prose-p:my-0.5" : "prose-p:my-2",
              "prose-strong:text-foreground prose-strong:font-semibold",
              "prose-code:text-foreground prose-code:bg-muted prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded-md prose-code:text-[13px] prose-code:font-mono prose-code:border-0",
              "prose-pre:bg-muted prose-pre:border prose-pre:border-border prose-pre:rounded-lg prose-pre:p-4 prose-pre:my-3",
              "prose-ul:text-foreground prose-ul:my-2 prose-ul:space-y-1",
              "prose-ol:text-foreground prose-ol:my-2 prose-ol:space-y-1",
              "prose-li:text-foreground prose-li:leading-[1.75]",
              "prose-a:text-foreground prose-a:underline prose-a:underline-offset-2",
              "prose-blockquote:text-foreground prose-blockquote:border-l-foreground prose-blockquote:pl-4 prose-blockquote:my-2"
            )}>
              <ReactMarkdown
                components={{
                  p: ({ children }) => {
                    return (
                      <p className={cn("leading-[1.75] text-[15px] text-foreground", isUser ? "my-0.5" : "my-2")}>
                        {React.Children.map(children, (child) => {
                          if (typeof child === "string") {
                            const parts = child.split(/(@[a-zA-Z0-9_./-]+\.[a-zA-Z0-9]+)/g)
                            return parts.map((part, i) => {
                              if (part.match(/^@[a-zA-Z0-9_./-]+\.[a-zA-Z0-9]+$/)) {
                                return (
                                  <span
                                    key={i}
                                    className="inline-flex items-center px-1.5 py-0.5 mx-0.5 rounded-md bg-blue-500/10 text-blue-400 border border-blue-500/20 font-medium text-xs"
                                  >
                                    <span className="mr-1">📄</span>
                                    {part}
                                  </span>
                                )
                              }
                              return part
                            })
                          }
                          return child
                        })}
                      </p>
                    )
                  },
                  code: ({ children, className }) => {
                    const isInline = !className
                    return isInline ? (
                      <code className="bg-muted text-foreground px-1.5 py-0.5 rounded-md text-[13px] font-mono">
                        {children}
                      </code>
                    ) : (
                      <code className="block bg-transparent text-foreground px-0 py-0 text-[14px] font-mono">
                        {children}
                      </code>
                    )
                  },
                  pre: ({ children }) => (
                    <pre className="bg-muted border border-border p-4 rounded-lg overflow-x-auto my-3 text-[14px] font-mono leading-relaxed">
                      {children}
                    </pre>
                  ),
                }}
              >
                {content.replace(/\[STEP:\s*\d+\]/g, "")}
              </ReactMarkdown>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
