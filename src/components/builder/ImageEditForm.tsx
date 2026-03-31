import { ImageIcon, Loader2, Send, X } from "lucide-react"
import { useState } from "react"
import { cn } from "../../lib/utils"
import { useAppStore } from "../../store/useAppStore"
import { editImageWithRunway } from "../../services/runwayml"
import { editImageWithAicc } from "../../services/aicc"

interface ImageEditFormProps {
    /** URL of the source image being edited */
    sourceImageUrl: string
    /** Name of the source image */
    sourceImageName: string
    /** Called when user closes the edit form */
    onClose: () => void
}

export function ImageEditForm({ sourceImageUrl, sourceImageName, onClose }: ImageEditFormProps) {
    const { addGeneratedFile, setSelectedAsset } = useAppStore()

    const [editPrompt, setEditPrompt] = useState("")
    const [isGenerating, setIsGenerating] = useState(false)
    const [error, setError] = useState<string | null>(null)

    // Generate edited image — tries RunwayML first, then AI.CC as fallback
    const handleGenerate = async () => {
        if (!editPrompt.trim() || !sourceImageUrl) return

        setIsGenerating(true)
        setError(null)

        try {
            // Helper to fetch and convert URL to base64
            const urlToBase64 = async (url: string): Promise<{ base64: string, mimeType: string }> => {
                if (url.startsWith('data:')) {
                    const matches = url.match(/^data:([a-zA-Z0-9]+\/[a-zA-Z0-9-.+]+);base64,(.*)$/)
                    if (matches) return { mimeType: matches[1], base64: matches[2] }
                }
                let response: Response
                try {
                    response = await fetch(url)
                    if (!response.ok) throw new Error(`HTTP ${response.status}`)
                } catch (err) {
                    const backendUrl = import.meta.env.VITE_BACKEND_URL || "http://localhost:3001"
                    const proxyUrl = `${backendUrl}/api/proxy-image?url=${encodeURIComponent(url)}`
                    response = await fetch(proxyUrl)
                }
                const blob = await response.blob()
                return new Promise((resolve, reject) => {
                    const reader = new FileReader()
                    reader.onloadend = () => {
                        const dataUrl = reader.result as string
                        const matches = dataUrl.match(/^data:([a-zA-Z0-9]+\/[a-zA-Z0-9-.+]+);base64,(.*)$/)
                        if (matches) resolve({ mimeType: matches[1], base64: matches[2] })
                        else reject(new Error("Failed to convert image to base64"))
                    }
                    reader.onerror = reject
                    reader.readAsDataURL(blob)
                })
            }

            const { base64, mimeType } = await urlToBase64(sourceImageUrl)
            const prompt = editPrompt.trim()

            let resultUrl: string | null = null

            // ── Provider 1: RunwayML (gen4_image) ──
            try {
                console.log(`🚀 [Provider 1/2] RunwayML gen4_image`)
                console.log(`   Prompt: ${prompt}`)
                resultUrl = await editImageWithRunway(prompt, base64, mimeType)
                console.log(`✅ Image edit completed via RunwayML!`)
            } catch (runwayErr) {
                console.warn("⚠️ RunwayML failed, falling back to AI.CC…", runwayErr)
            }

            // ── Provider 2: AI.CC (fallback) ──
            if (!resultUrl) {
                try {
                    console.log(`🔄 [Provider 2/2] AI.CC doubao-seedream fallback`)
                    resultUrl = await editImageWithAicc(prompt, base64, mimeType)
                    console.log(`✅ Image edit completed via AI.CC (fallback)!`)
                } catch (aiccErr) {
                    console.error("❌ AI.CC fallback also failed:", aiccErr)
                    throw aiccErr // both providers failed → surface the error
                }
            }

            // Save the edited image to the project
            const timestamp = Date.now()
            const editedName = `ed_${String(timestamp).slice(-7)}.png`
            const editedPath = `images/${editedName}`

            addGeneratedFile(editedPath, resultUrl)

            // Show the new image in the viewer
            setSelectedAsset({
                name: editedName,
                path: editedPath,
                type: "image",
                url: resultUrl,
                content: resultUrl,
            } as any)

            // Close the edit form
            onClose()
        } catch (err) {
            console.error("Error editing image:", err)
            setError(err instanceof Error ? err.message : "Failed to edit image. Please try again.")
        } finally {
            setIsGenerating(false)
        }
    }

    return (
        <div className="flex flex-col h-full bg-background font-mono relative">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-background shrink-0 z-10">
                <div className="flex items-center gap-2">
                    <ImageIcon className="h-4 w-4 text-foreground" />
                    <span className="text-sm font-bold tracking-tight text-foreground">
                        Image Translation
                    </span>
                </div>
                <button
                    onClick={onClose}
                    className="p-1 hover:bg-muted rounded transition-colors"
                    title="Close"
                >
                    <X className="h-4 w-4 text-foreground" />
                </button>
            </div>

            <div className="flex-1 flex flex-col min-h-0 bg-muted/20 relative">
                 {/* Source Image Viewer */}
                 <div className="flex-1 overflow-hidden p-6 flex flex-col items-center justify-center">
                    <div className="w-full h-full p-2 border-2 border-border border-dashed rounded-xl flex items-center justify-center bg-background/50 relative overflow-hidden group">
                        {sourceImageUrl ? (
                            <img
                                src={sourceImageUrl}
                                alt={sourceImageName}
                                className="w-full h-full object-contain pointer-events-none"
                            />
                        ) : (
                            <div className="text-muted-foreground text-sm flex flex-col items-center gap-2">
                                <ImageIcon className="h-8 w-8 opacity-50" />
                                No source image available
                            </div>
                        )}
                    </div>
                </div>

                {/* Edit Controls Toolbar */}
                <div className="shrink-0 p-6 bg-background border-t border-border space-y-4">
                     <div className="space-y-2">
                        <label className="block text-xs font-bold text-foreground uppercase tracking-widest">
                            Translation Prompt
                        </label>
                        <textarea
                            value={editPrompt}
                            onChange={(e) => setEditPrompt(e.target.value)}
                            placeholder="e.g. Change the background to a cyberpunk city at night... Make the subject wear sunglasses..."
                            disabled={isGenerating}
                            rows={3}
                            className="w-full px-4 py-3 border border-border rounded-xl font-sans text-sm text-foreground bg-foreground/5 placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-foreground focus:border-transparent resize-none transition-all"
                        />
                    </div>

                    {/* Error */}
                    {error && (
                        <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-xs text-red-500 font-bold flex items-center gap-2">
                             <X className="w-4 h-4" />
                             {error}
                        </div>
                    )}

                    {/* Generate Button */}
                    <button
                        onClick={handleGenerate}
                        disabled={isGenerating || !editPrompt.trim()}
                        className={cn(
                            "w-full px-6 py-3.5 text-sm font-bold transition-all rounded-xl shadow-lg flex items-center justify-center gap-3",
                            "bg-foreground text-background hover:scale-[1.02] active:scale-[0.98]",
                            (isGenerating || !editPrompt.trim()) &&
                            "opacity-50 cursor-not-allowed transform-none hover:scale-100 shadow-none border border-border"
                        )}
                    >
                        {isGenerating ? (
                            <>
                                <Loader2 className="h-5 w-5 animate-spin" />
                                Synthesizing Edit...
                            </>
                        ) : (
                            <>
                                <Send className="h-5 w-5" />
                                Apply Transformation
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    )
}
