import { ArrowUp, ChevronDown, Film, Image as ImageIcon, Loader2, Plus, Smartphone } from "lucide-react"
import { useState } from "react"
import { cn } from "../../lib/utils"
import { editImageWithAicc } from "../../services/aicc"
import { editImageWithRunway } from "../../services/runwayml"
import { useAppStore } from "../../store/useAppStore"

interface ImageEditOverlayProps {
    imageUrl: string
    isInline?: boolean
    children?: React.ReactNode
}

export function ImageEditOverlay({ imageUrl, isInline = false, children }: ImageEditOverlayProps) {
    const isImageEditMode = useAppStore((state) => state.isImageEditMode)
    const setIsImageEditMode = useAppStore((state) => state.setIsImageEditMode)
    const addGeneratedFile = useAppStore((state) => state.addGeneratedFile)
    const setSelectedAsset = useAppStore((state) => state.setSelectedAsset)

    const [editPrompt, setEditPrompt] = useState("")
    const [isEditingImage, setIsEditingImage] = useState(false)

    if (!isImageEditMode && !isInline) return null

    const handleEditImageDirect = async () => {
        if (!editPrompt.trim() || !imageUrl) return

        setIsEditingImage(true)
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

            const { base64, mimeType } = await urlToBase64(imageUrl)
            const prompt = editPrompt.trim()

            let resultUrl: string | null = null

            try {
                resultUrl = await editImageWithRunway(prompt, base64, mimeType)
            } catch (runwayErr) {
                console.warn("RunwayML failed, falling back to AI.CC…", runwayErr)
            }

            if (!resultUrl) {
                resultUrl = await editImageWithAicc(prompt, base64, mimeType)
            }

            const timestamp = Date.now()
            const editedName = `ed_${String(timestamp).slice(-7)}.png`
            const editedPath = `images/${editedName}`

            addGeneratedFile(editedPath, resultUrl)

            setSelectedAsset({
                name: editedName,
                path: editedPath,
                type: "image",
                url: resultUrl,
                content: resultUrl,
            } as any)
            
            setEditPrompt("")
            setIsImageEditMode(false)
        } catch (err) {
            console.error("Error editing image:", err)
            alert(err instanceof Error ? err.message : "Failed to edit image.")
        } finally {
            setIsEditingImage(false)
        }
    }

    return (
        <div className={cn(
            isInline 
                ? "w-full bg-white/5 border border-white/10 p-4 rounded-2xl flex flex-col gap-4"
                : "absolute bottom-6 left-1/2 -translate-x-1/2 w-[95%] max-w-5xl bg-black/80 backdrop-blur-3xl border border-white/10 shadow-2xl p-6 rounded-[32px] flex flex-col gap-6 z-50 transition-all duration-500",
        )}>
            {/* Top row: Input area */}
            <div className={cn("flex gap-4", isInline ? "flex-col" : "items-start")}>
                {/* Add image block */}
                {!isInline && (
                    <div className={cn(
                        "bg-white/5 border border-white/10 rounded-2xl flex flex-col items-center justify-center gap-1.5 cursor-pointer hover:bg-white/10 transition-colors shrink-0 relative group",
                        isInline ? "w-full h-32" : "w-24 h-24"
                    )}>
                        <div className="relative">
                            <ImageIcon className={cn("text-white/40", isInline ? "h-14 w-14" : "h-10 w-10")} />
                            <div className="absolute -top-1 -right-1 bg-white text-black rounded-full p-0.5 border border-black shadow-lg">
                                <Plus className="h-3 w-3" />
                            </div>
                        </div>
                        <span className="text-[10px] font-bold text-white/50 tracking-tighter uppercase">Add Image</span>
                    </div>
                )}

                {/* Text area */}
                <textarea
                    value={editPrompt}
                    onChange={(e) => setEditPrompt(e.target.value)}
                    placeholder="Type to imagine..."
                    disabled={isEditingImage}
                    rows={isInline ? 3 : 1}
                    className={cn(
                        "flex-1 bg-transparent border-none text-white placeholder:text-white/20 resize-none font-medium focus:outline-none",
                        isInline ? "text-base w-full" : "text-xl mt-1 min-h-[40px]"
                    )}
                />
            </div>

            {/* Bottom row: Controls and Submit */}
            <div className={cn("flex justify-between", isInline ? "flex-col gap-4" : "items-center")}>
                <div className={cn("flex flex-wrap gap-2", isInline ? "justify-start" : "items-center")}>
                    {/* Mode selector */}
                    {!isInline && (
                        <div className="flex items-center bg-transparent border border-white/10 rounded-full p-1 gap-1">
                            <button className="flex items-center gap-2 bg-white text-black px-3 py-1 rounded-full text-xs font-semibold transition-all">
                                <ImageIcon className="h-3 w-3" />
                                Image
                            </button>
                            <button className="flex items-center gap-2 text-white/60 hover:text-white px-3 py-1 rounded-full text-xs font-semibold transition-all">
                                <Film className="h-3 w-3" />
                                Video
                            </button>
                        </div>
                    )}

                    {/* Aspect Ratio selector */}
                    <button className="flex items-center gap-1.5 bg-transparent border border-white/10 text-white px-3 py-1 rounded-full text-xs font-semibold hover:bg-white/5 transition-all">
                        <Smartphone className="h-3 w-3" />
                        9:16
                        <ChevronDown className="h-3 w-3 opacity-50" />
                    </button>

                    {/* Model selector */}
                    <button className="flex items-center gap-1.5 bg-transparent border border-white/10 text-white px-3 py-1 rounded-full text-xs font-semibold hover:bg-white/5 transition-all">
                        gen4_turbo
                        <ChevronDown className="h-3 w-3 opacity-50" />
                    </button>
                </div>

                {/* Submit button */}
                <button
                    onClick={handleEditImageDirect}
                    disabled={isEditingImage || !editPrompt.trim()}
                    className={cn(
                        "bg-white/20 hover:bg-white/30 text-white flex items-center justify-center rounded-full transition-all group",
                        isInline ? "w-full h-10" : "w-12 h-12",
                        (isEditingImage || !editPrompt.trim()) && "opacity-20 cursor-not-allowed scale-95"
                    )}
                >
                    {isEditingImage ? (
                        <Loader2 className="h-5 w-5 animate-spin" />
                    ) : isInline ? (
                        <span className="text-xs font-bold uppercase tracking-widest">Generate Edit</span>
                    ) : (
                        <ArrowUp className="h-6 w-6 group-hover:translate-y-[-2px] transition-transform" />
                    )}
                </button>
                {children}
            </div>
        </div>
    )
}
