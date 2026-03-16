import { ExternalLink, Globe, Image as ImageIcon, Play, ChevronDown, ChevronUp } from "lucide-react"
import { useState } from "react"
import { cn } from "../../lib/utils"
import type { WebSearchResult } from "../../types"

interface WebSearchResultsProps {
  results: WebSearchResult
  className?: string
}

export function WebSearchResults({ results, className }: WebSearchResultsProps) {
  const [isExpanded, setIsExpanded] = useState(true)

  const totalSources = results.organic.length + results.images.length + results.videos.length

  if (totalSources === 0) return null

  return (
    <div className={cn("mt-3 border border-border rounded-lg overflow-hidden bg-muted/30", className)}>
      {/* Header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-muted/50 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Globe className="h-4 w-4 text-blue-500" />
          <span className="text-sm font-medium text-foreground">
            Sources
          </span>
          <span className="text-xs text-muted-foreground px-1.5 py-0.5 bg-muted rounded-full">
            {totalSources}
          </span>
        </div>
        {isExpanded ? (
          <ChevronUp className="h-4 w-4 text-muted-foreground" />
        ) : (
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        )}
      </button>

      {isExpanded && (
        <div className="px-4 pb-3 space-y-3">
          {/* Organic Results — Source Pills */}
          {results.organic.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {results.organic.map((result, i) => (
                <a
                  key={i}
                  href={result.link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 px-2.5 py-1.5 bg-background border border-border rounded-full hover:bg-muted hover:border-foreground/20 transition-all group text-xs"
                  title={result.snippet}
                >
                  {result.favicon ? (
                    <img
                      src={result.favicon}
                      alt=""
                      className="h-3.5 w-3.5 rounded-sm"
                      onError={(e) => {
                        (e.target as HTMLImageElement).style.display = 'none'
                      }}
                    />
                  ) : (
                    <Globe className="h-3 w-3 text-muted-foreground" />
                  )}
                  <span className="text-foreground font-medium truncate max-w-[120px]">
                    {result.source || new URL(result.link).hostname.replace('www.', '')}
                  </span>
                  <ExternalLink className="h-2.5 w-2.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                </a>
              ))}
            </div>
          )}

          {/* Images Row */}
          {results.images.length > 0 && (
            <div>
              <div className="flex items-center gap-1.5 mb-2">
                <ImageIcon className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="text-xs font-medium text-muted-foreground">Images</span>
              </div>
              <div className="flex gap-2 overflow-x-auto scrollbar-thin pb-1">
                {results.images.map((img, i) => (
                  <a
                    key={i}
                    href={img.original || img.link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="shrink-0 group"
                  >
                    <div className="relative w-20 h-20 rounded-lg overflow-hidden border border-border bg-muted">
                      <img
                        src={img.thumbnail || img.original}
                        alt={img.title}
                        className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-200"
                        loading="lazy"
                        onError={(e) => {
                          (e.target as HTMLImageElement).style.display = 'none'
                        }}
                      />
                    </div>
                  </a>
                ))}
              </div>
            </div>
          )}

          {/* Videos Row */}
          {results.videos.length > 0 && (
            <div>
              <div className="flex items-center gap-1.5 mb-2">
                <Play className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="text-xs font-medium text-muted-foreground">Videos</span>
              </div>
              <div className="flex gap-2 overflow-x-auto scrollbar-thin pb-1">
                {results.videos.map((vid, i) => (
                  <a
                    key={i}
                    href={vid.link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="shrink-0 flex items-center gap-2 px-3 py-2 bg-background border border-border rounded-lg hover:bg-muted transition-colors max-w-[220px]"
                  >
                    {vid.thumbnail && (
                      <div className="relative w-12 h-9 rounded overflow-hidden bg-muted shrink-0">
                        <img
                          src={vid.thumbnail}
                          alt=""
                          className="w-full h-full object-cover"
                          loading="lazy"
                          onError={(e) => {
                            (e.target as HTMLImageElement).style.display = 'none'
                          }}
                        />
                        <div className="absolute inset-0 flex items-center justify-center">
                          <Play className="h-3 w-3 text-white drop-shadow-md" fill="white" />
                        </div>
                      </div>
                    )}
                    <div className="min-w-0">
                      <p className="text-xs font-medium text-foreground truncate">
                        {vid.title}
                      </p>
                      <p className="text-[10px] text-muted-foreground">
                        {vid.source}{vid.length ? ` · ${vid.length}` : ''}
                      </p>
                    </div>
                  </a>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
