import { ArrowUp, ChevronDown, Film, Image as ImageIcon, Loader2, Plus } from "lucide-react"
import { useState } from "react"
import { cn } from "../../lib/utils"
import { editImageWithRunway } from "../../services/runwayml"
import { useAppStore } from "../../store/useAppStore"

const MODELS = ["gen4_image_turbo", "gemini_2.5_flash"] as const;
const GEN4_RATIOS = ["1024:1024", "1080:1080", "1168:880", "1360:768", "1440:1080", "1080:1440", "1808:768", "1920:1080", "1080:1920", "2112:912", "1280:720", "720:1280", "720:720", "960:720", "720:960", "1680:720"];
const GEMINI_RATIOS = ["1344:768", "768:1344", "1024:1024", "1184:864", "864:1184", "1536:672", "832:1248", "1248:832", "896:1152", "1152:896"];

function RatioIcon({ ratio, isInline }: { ratio: string, isInline: boolean }) {
    const [wStr, hStr] = ratio.split(":");
    const width = parseInt(wStr, 10);
    const height = parseInt(hStr, 10);
    const maxDim = 14;
    const scale = Math.max(width, height) / maxDim;
    return (
        <div className={cn("border flex-shrink-0 opacity-70", isInline ? "border-foreground" : "border-white")} style={{ width: Math.max(2, width/scale), height: Math.max(2, height/scale) }} />
    );
}

function formatRatioLabel(ratio: string) {
    if (!ratio || !ratio.includes(":")) return ratio;
    const [wStr, hStr] = ratio.split(":");
    const w = parseInt(wStr, 10);
    const h = parseInt(hStr, 10);
    const gcd = (a: number, b: number): number => b === 0 ? a : gcd(b, a % b);
    const divisor = gcd(w, h);
    let rw = w / divisor;
    let rh = h / divisor;
    
    // special cases
    if (w === 1360 && h === 768) { rw = 16; rh = 9; }
    else if (w === 1168 && h === 880) { rw = 4; rh = 3; }
    else if (w === 2112 && h === 912) { rw = 21; rh = 9; }
    else if (w === 1680 && h === 720) { rw = 21; rh = 9; }
    else if (w === 1344 && h === 768) { rw = 16; rh = 9; }
    else if (w === 768 && h === 1344) { rw = 9; rh = 16; } 
    else if (w === 1184 && h === 864) { rw = 4; rh = 3; }
    else if (w === 864 && h === 1184) { rw = 3; rh = 4; }
    else if (w === 1536 && h === 672) { rw = 21; rh = 9; }
    else if (w === 832 && h === 1248) { rw = 2; rh = 3; }
    else if (w === 1248 && h === 832) { rw = 3; rh = 2; }
    else if (w === 896 && h === 1152) { rw = 3; rh = 4; } 
    else if (w === 1152 && h === 896) { rw = 4; rh = 3; }

    return `${rw}:${rh}`;
}

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
    const [selectedModel, setSelectedModel] = useState<(typeof MODELS)[number]>("gen4_image_turbo")
    const [selectedRatio, setSelectedRatio] = useState<string>("1024:1024")
    const [isModelDropdownOpen, setIsModelDropdownOpen] = useState(false)
    const [isRatioDropdownOpen, setIsRatioDropdownOpen] = useState(false)

    const changeModel = (model: (typeof MODELS)[number]) => {
        setSelectedModel(model);
        if (model === "gen4_image_turbo" && !GEN4_RATIOS.includes(selectedRatio)) {
            setSelectedRatio("1024:1024");
        } else if (model === "gemini_2.5_flash" && !GEMINI_RATIOS.includes(selectedRatio)) {
            setSelectedRatio("1024:1024");
        }
        setIsModelDropdownOpen(false);
    }

    if (!isImageEditMode && !isInline) return null

    const handleEditImageDirect = async () => {
        if (!editPrompt.trim() || !imageUrl) return

        setIsEditingImage(true)
        try {
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
                resultUrl = await editImageWithRunway(prompt, base64, mimeType, {
                    model: selectedModel as any,
                    ratio: selectedRatio
                })
            } catch (runwayErr) {
                console.error("RunwayML failed:", runwayErr)
                throw runwayErr
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
                ? "w-full bg-muted/30 border border-border p-4 rounded-xl flex flex-col gap-4"
                : "absolute bottom-6 left-1/2 -translate-x-1/2 w-[95%] max-w-5xl bg-black/80 backdrop-blur-3xl border border-white/10 shadow-2xl p-6 rounded-[32px] flex flex-col gap-6 z-50 transition-all duration-500",
        )}>
            {/* Top row: Input area */}
            <div className={cn("flex gap-4", isInline ? "flex-col" : "items-start")}>
                {/* Add image block */}
                {!isInline && (
                    <div className={cn(
                        "bg-white/5 border border-white/10 rounded-2xl flex flex-col items-center justify-center gap-1.5 cursor-pointer hover:bg-white/10 transition-colors shrink-0 relative group",
                        "w-24 h-24"
                    )}>
                        <div className="relative">
                            <ImageIcon className={cn("text-white/40", "h-10 w-10")} />
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
                        "flex-1 bg-transparent border-none resize-none font-medium focus:outline-none",
                        isInline ? "text-base w-full text-foreground placeholder:text-muted-foreground" : "text-xl mt-1 min-h-[40px] text-white placeholder:text-white/20"
                    )}
                />
            </div>

            {/* Bottom row: Controls and Submit */}
            <div className={cn("flex", isInline ? "flex-col gap-3" : "justify-between items-center")}>
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
                    <div className="relative">
                        <button 
                            onClick={() => { setIsRatioDropdownOpen(!isRatioDropdownOpen); setIsModelDropdownOpen(false); }}
                            className={cn(
                                "flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold transition-all min-w-[5rem] justify-between",
                                isInline 
                                    ? "bg-background border border-border text-foreground hover:bg-muted"
                                    : "bg-transparent border border-white/10 text-white hover:bg-white/5"
                            )}
                        >
                            <span className="flex items-center gap-1.5 truncate">
                                <RatioIcon ratio={selectedRatio} isInline={isInline} />
                                {formatRatioLabel(selectedRatio)}
                            </span>
                            <ChevronDown className={cn("h-3 w-3 opacity-50 transition-transform shrink-0", isRatioDropdownOpen && "rotate-180")} />
                        </button>
                        {isRatioDropdownOpen && (
                            <div className={cn(
                                "absolute bottom-full left-0 mb-2 max-h-48 overflow-y-auto rounded-xl p-1 z-50 min-w-[140px] custom-scrollbar shadow-xl border",
                                isInline 
                                    ? "bg-background border-border"
                                    : "bg-black border-white/10"
                            )}>
                                {(selectedModel === "gen4_image_turbo" ? GEN4_RATIOS : GEMINI_RATIOS).map((ratio) => (
                                    <button
                                        key={ratio}
                                        onClick={() => { setSelectedRatio(ratio); setIsRatioDropdownOpen(false); }}
                                        className={cn(
                                            "w-full text-left px-3 py-1.5 text-xs rounded-lg transition-colors whitespace-nowrap flex items-center justify-between",
                                            isInline 
                                                ? (selectedRatio === ratio ? "bg-foreground/10 text-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground")
                                                : (selectedRatio === ratio ? "bg-white/10 text-white" : "text-white/80 hover:bg-white/10 hover:text-white")
                                        )}
                                    >
                                        <div className="flex items-center gap-2">
                                            <RatioIcon ratio={ratio} isInline={isInline} />
                                            <span>{formatRatioLabel(ratio)}</span>
                                        </div>
                                        <span className={cn("text-[9px] opacity-40 leading-none", isInline ? "text-foreground" : "text-white")}>{ratio}</span>
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Model selector */}
                    <div className="relative">
                        <button 
                            onClick={() => { setIsModelDropdownOpen(!isModelDropdownOpen); setIsRatioDropdownOpen(false); }}
                            className={cn(
                                "flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold transition-all w-32 justify-between",
                                isInline 
                                    ? "bg-background border border-border text-foreground hover:bg-muted"
                                    : "bg-transparent border border-white/10 text-white hover:bg-white/5"
                            )}
                        >
                            <span className="truncate">{selectedModel}</span>
                            <ChevronDown className={cn("h-3 w-3 opacity-50 transition-transform shrink-0", isModelDropdownOpen && "rotate-180")} />
                        </button>
                        {isModelDropdownOpen && (
                            <div className={cn(
                                "absolute bottom-full left-0 mb-2 rounded-xl p-1 z-50 min-w-full shadow-xl border",
                                isInline 
                                    ? "bg-background border-border"
                                    : "bg-black border-white/10"
                            )}>
                                {MODELS.map((model) => (
                                    <button
                                        key={model}
                                        onClick={() => changeModel(model)}
                                        className={cn(
                                            "w-full text-left px-3 py-1.5 text-xs rounded-lg transition-colors whitespace-nowrap",
                                            isInline 
                                                ? (selectedModel === model ? "bg-foreground/10 text-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground")
                                                : (selectedModel === model ? "bg-white/10 text-white" : "text-white/80 hover:bg-white/10 hover:text-white")
                                        )}
                                    >
                                        {model}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                {/* Submit button */}
                <button
                    onClick={handleEditImageDirect}
                    disabled={isEditingImage || !editPrompt.trim()}
                    className={cn(
                        "flex items-center justify-center rounded-full transition-all group",
                        isInline 
                            ? "w-full h-10 bg-foreground text-background hover:bg-foreground/90 font-bold"
                            : "w-12 h-12 bg-white/20 hover:bg-white/30 text-white",
                        (isEditingImage || !editPrompt.trim()) && "opacity-20 cursor-not-allowed scale-95"
                    )}
                >
                    {isEditingImage ? (
                        <Loader2 className="h-5 w-5 animate-spin" />
                    ) : isInline ? (
                        <span className="text-xs uppercase tracking-widest">Generate Edit</span>
                    ) : (
                        <ArrowUp className="h-6 w-6 group-hover:translate-y-[-2px] transition-transform" />
                    )}
                </button>
                {children}
            </div>
        </div>
    )
}
