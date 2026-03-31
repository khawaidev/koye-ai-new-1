import { ArrowRight, Box, Download, FileText, Image as ImageIcon, Loader2, Music, Video } from "lucide-react"
import { useEffect, useState } from "react"
import { cn } from "../../lib/utils"
import { create3DModelTask, queryTaskStatus } from "../../services/hitem3d"
import { getImageById } from "../../services/multiDbDataService"
import { editImageWithRunway } from "../../services/runwayml"
import { editImageWithAicc } from "../../services/aicc"

import { createRiggingTask, getRiggingTask } from "../../services/tripo"
import { useAppStore } from "../../store/useAppStore"
import { analyzeImageBackground, isObjectLight } from "../../utils/imageAnalysis"
import { ImageEditOverlay } from "../ui/ImageEditOverlay"


// Credit costs for 3D model generation
const CREDIT_COSTS = {
    "512": { base: 20, texture: 5 },
    "1024": { base: 50, texture: 10 },
    "1536": { base: 70, texture: 20 },
} as const

type Resolution = "512" | "1024" | "1536"

export function BuilderInspector() {
    const selectedAsset = useAppStore((state) => state.selectedAsset)
    const addGeneratedFile = useAppStore((state) => state.addGeneratedFile)
    const setSelectedAsset = useAppStore((state) => state.setSelectedAsset)



    // Auto rig internal state
    const [selectedRigType, setSelectedRigType] = useState("biped")
    const [isRigging, setIsRigging] = useState(false)
    const [rigStatus, setRigStatus] = useState("")


    // Image editing state — now managed via store (isImageEditMode)

    // 3D model generation state
    const [isGenerating3D, setIsGenerating3D] = useState(false)

    // Background warning dialog
    const [showBackgroundWarning, setShowBackgroundWarning] = useState(false)
    const [backgroundIssues, setBackgroundIssues] = useState<string[]>([])
    const [isReplacingBackground, setIsReplacingBackground] = useState(false)

    // Background comparison dialog
    const [showBackgroundComparison, setShowBackgroundComparison] = useState(false)
    const [originalImageUrl, setOriginalImageUrl] = useState("")
    const [newBackgroundImageUrl, setNewBackgroundImageUrl] = useState("")

    // 3D settings dialog
    const [show3DSettings, setShow3DSettings] = useState(false)
    const [resolution, setResolution] = useState<Resolution>("1024")
    const [withTexture, setWithTexture] = useState(true)
    const [imageUrlFor3D, setImageUrlFor3D] = useState("")

    // Resolved image URL (from DB if ID available)
    const [resolvedImageUrl, setResolvedImageUrl] = useState<string | undefined>(undefined)

    // Resolve image URL by ID if available
    useEffect(() => {
        const resolveImageUrl = async () => {
            if (!selectedAsset) {
                setResolvedImageUrl(undefined)
                return
            }

            const assetId = (selectedAsset as any).id
            if (assetId && (selectedAsset as any).type === 'image') {
                try {
                    const imageFromDb = await getImageById(assetId)
                    if (imageFromDb?.url) {
                        setResolvedImageUrl(imageFromDb.url)
                        return
                    }
                } catch (error) {
                    console.warn("Failed to resolve image by ID:", error)
                }
            }
            setResolvedImageUrl(undefined)
        }

        resolveImageUrl()
    }, [selectedAsset])

    // Calculate credit cost
    const creditCost = CREDIT_COSTS[resolution].base + (withTexture ? CREDIT_COSTS[resolution].texture : 0)

    if (!selectedAsset) {
        return (
            <div className="w-64 border-l-2 border-border bg-background flex flex-col h-full font-mono">
                <div className="px-4 py-3 border-b-2 border-border bg-muted/50">
                    <h3 className="text-xs font-bold text-foreground tracking-wider">INSPECTOR</h3>
                </div>
                <div className="flex-1 flex items-center justify-center p-8">
                    <div className="text-center">
                        <FileText className="h-12 w-12 mx-auto mb-3 text-muted-foreground" />
                        <p className="text-xs font-semibold text-muted-foreground mb-1">No file selected</p>
                        <p className="text-[10px] text-muted-foreground/70">Select a file to view properties</p>
                    </div>
                </div>
            </div>
        )
    }

    // Helper to determine icon and type label
    const getAssetInfo = (asset: any) => {
        if (asset.type === 'image' || asset.view) return { icon: ImageIcon, label: 'Image' }
        if (asset.type === 'model' || asset.format) return { icon: Box, label: '3D Model' }
        if (asset.type === 'video') return { icon: Video, label: 'Video' }
        if (asset.type === 'audio') return { icon: Music, label: 'Audio' }
        return { icon: FileText, label: 'File' }
    }

    const { label } = getAssetInfo(selectedAsset)
    const path = (selectedAsset as any).path || 'Unknown path'
    const size = (selectedAsset as any).size ? `${((selectedAsset as any).size / 1024).toFixed(2)} KB` : 'Unknown'
    const created = (selectedAsset as any).createdAt ? new Date((selectedAsset as any).createdAt).toLocaleString() : 'Unknown'

    const isImage = (selectedAsset as any).type === 'image'
    const isModel = (selectedAsset as any).type === 'model' || !!(selectedAsset as any).format

    // Get the image URL - prioritize in this order:
    // 1. resolvedImageUrl (from DB lookup by ID - most accurate for project assets)
    // 2. generatedFiles[path] - contains actual Supabase storage URLs
    // 3. selectedAsset.url - may have the URL directly
    // 4. selectedAsset.content - fallback to content
    const assetPath = (selectedAsset as any).path
    const generatedFiles = useAppStore.getState().generatedFiles || {}

    let imageUrl: string | undefined = resolvedImageUrl

    if (!imageUrl && assetPath && generatedFiles && generatedFiles[assetPath]) {
        const fileContent = typeof generatedFiles[assetPath] === 'string' ? generatedFiles[assetPath] : ''
        // Check if it's an actual image URL (http, https, data:, blob:)
        if (fileContent && (fileContent.startsWith('http') || fileContent.startsWith('data:') || fileContent.startsWith('blob:'))) {
            imageUrl = fileContent
        } else if (fileContent) {
            // Check if it's a markdown metadata file containing a URL
            const urlMatch = fileContent.match(/\**URL:\**\s*(https?:\/\/[^\s\n*)]+)/i) || fileContent.match(/# URL:\s*(https?:\/\/[^\s\n]+)/i)
            if (urlMatch) {
                imageUrl = urlMatch[1]
            }
        }
    }

    // Fallback to asset properties if not found in generatedFiles
    if (!imageUrl) {
        imageUrl = (selectedAsset as any).url || (selectedAsset as any).content
    }


    // Handle auto rig for 3D model
    const handleAutoRig = async () => {
        if (!imageUrl) return
        
        setIsRigging(true)
        setRigStatus("Importing model to Tripo...")
        
        try {
            const taskId = await createRiggingTask({ model_url: imageUrl, rig_type: selectedRigType })
            
            let isComplete = false
            let attempts = 0
            while (!isComplete && attempts < 120) { // Timeout after 120 * 5 = 600s
                attempts++
                setRigStatus(`Rigging model... (${attempts * 5}s)`)
                await new Promise(r => setTimeout(r, 5000))
                
                const taskResult = await getRiggingTask(taskId)
                if (taskResult.status === "SUCCEEDED" && taskResult.result?.rigged_character_glb_url) {
                    isComplete = true
                    const riggedUrl = taskResult.result.rigged_character_glb_url
                    const timestamp = Date.now()
                    const rigName = `rig_${String(timestamp).slice(-7)}.glb`
                    const rigPath = `3d-models/${rigName}`

                    addGeneratedFile(rigPath, riggedUrl)

                    setSelectedAsset({
                        name: rigName,
                        path: rigPath,
                        type: "model",
                        url: riggedUrl,
                        format: "glb",
                        status: "READY",
                    } as any)
                    
                    alert("Auto rigging successful!")
                } else if (taskResult.status === "FAILED" || taskResult.status === "CANCELED") {
                    throw new Error(`Rigging task failed: ${taskResult.task_error?.message || 'Unknown error'}`)
                }
            }
            if (!isComplete) {
                throw new Error("Rigging task timed out")
            }
        } catch (error) {
            console.error(error)
            alert(error instanceof Error ? error.message : "Failed to auto rig.")
        } finally {
            setIsRigging(false)
            setRigStatus("")
        }
    }

    // Handle generate 3D model button click
    const handleGenerate3DClick = async () => {
        if (!imageUrl) return

        setIsGenerating3D(true)
        try {
            // Analyze background
            const analysis = await analyzeImageBackground(imageUrl)

            if (!analysis.isValid) {
                // Show warning dialog
                setBackgroundIssues(analysis.issues)
                setShowBackgroundWarning(true)
                setIsGenerating3D(false)
                return
            }

            // Background is valid, proceed to settings
            setImageUrlFor3D(imageUrl)
            setShow3DSettings(true)
            setIsGenerating3D(false)
        } catch (error) {
            console.error("Error analyzing image:", error)
            alert(`Failed to analyze image: ${error instanceof Error ? error.message : 'Unknown error'}`)
            setIsGenerating3D(false)
        }
    }

    // Handle background replacement
    const handleReplaceBackground = async () => {
        if (!imageUrl) return

        setIsReplacingBackground(true)
        setShowBackgroundWarning(false)

        try {
            // Helper to convert blob/http to base64
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

            // Analyze to get object color
            const analysis = await analyzeImageBackground(imageUrl)
            const objectIsLight = isObjectLight(analysis.averageObjectColor)

            // Generate background prompt based on object color
            const bgPrompt = objectIsLight
                ? "Replace the background with: clean solid dark gray background, plain, no gradient, uniform color. Keep the foreground subject exactly the same."
                : "Replace the background with: clean solid white background, plain, no gradient, uniform color. Keep the foreground subject exactly the same."

            // Extract raw base64
            const { base64, mimeType } = await urlToBase64(imageUrl)

            // Replace background — RunwayML first, AI.CC fallback
            let newImageUrl: string | null = null
            try {
                console.log("🚀 [BG Replace 1/2] RunwayML gen4_image")
                newImageUrl = await editImageWithRunway(bgPrompt, base64, mimeType)
                console.log("✅ Background replaced via RunwayML!")
            } catch (runwayErr) {
                console.warn("⚠️ RunwayML BG replace failed, falling back to AI.CC…", runwayErr)
            }

            if (!newImageUrl) {
                console.log("🔄 [BG Replace 2/2] AI.CC fallback")
                newImageUrl = await editImageWithAicc(bgPrompt, base64, mimeType)
                console.log("✅ Background replaced via AI.CC (fallback)!")
            }

            // Store both for comparison
            setOriginalImageUrl(imageUrl)
            setNewBackgroundImageUrl(newImageUrl || "")
            setShowBackgroundComparison(true)
        } catch (error) {
            console.error("Error replacing background:", error)
            alert(`Failed to replace background: ${error instanceof Error ? error.message : 'Unknown error'}`)
        } finally {
            setIsReplacingBackground(false)
        }
    }

    // Handle proceed with new background
    const handleProceedWithNewBackground = () => {
        setShowBackgroundComparison(false)
        setImageUrlFor3D(newBackgroundImageUrl)
        setShow3DSettings(true)
    }

    // Handle 3D model generation
    const handleGenerate3D = async () => {
        if (!imageUrlFor3D) return

        setShow3DSettings(false)
        setIsGenerating3D(true)

        try {
            // Convert URL to File
            const response = await fetch(imageUrlFor3D)
            const blob = await response.blob()
            const imageFile = new File([blob], "image.png", { type: "image/png" })

            // Create task
            const taskId = await create3DModelTask({
                mode: "single",
                type: withTexture ? "both" : "mesh",
                resolution: resolution,
                format: "glb",
                images: [imageFile],
            })

            // Poll for completion
            let job = await queryTaskStatus(taskId)
            while (job.status === "pending" || job.status === "processing") {
                await new Promise(resolve => setTimeout(resolve, 3000))
                job = await queryTaskStatus(taskId)
            }

            if (job.status === "completed" && job.result?.modelUrl) {
                // Generate name for the model (max 10 chars)
                const timestamp = Date.now()
                const modelName = `md_${String(timestamp).slice(-7)}.glb`
                const modelPath = `3d-models/${modelName}`

                // Add to generated files
                addGeneratedFile(modelPath, job.result.modelUrl)

                // Update viewer to show the new model
                setSelectedAsset({
                    name: modelName,
                    path: modelPath,
                    type: 'model',
                    url: job.result.modelUrl,
                    format: 'glb',
                    status: 'READY',
                } as any)

                alert("3D model generated successfully!")
            } else {
                throw new Error(job.error || "3D model generation failed")
            }
        } catch (error) {
            console.error("Error generating 3D model:", error)
            alert(`Failed to generate 3D model: ${error instanceof Error ? error.message : 'Unknown error'}`)
        } finally {
            setIsGenerating3D(false)
        }
    }

    const isProcessing = isGenerating3D || isReplacingBackground

    const handleDownloadModel = async () => {
        if (!imageUrl) return
        try {
            const response = await fetch(imageUrl)
            const blob = await response.blob()
            const url = URL.createObjectURL(blob)
            const a = document.createElement("a")
            a.href = url
            const ext = (selectedAsset as any).format || assetPath?.split('.').pop() || "glb"
            a.download = `model.${ext}`
            document.body.appendChild(a)
            a.click()
            document.body.removeChild(a)
            URL.revokeObjectURL(url)
        } catch (error) {
            console.error("Error downloading model:", error)
            alert("Failed to download model. Please try again.")
        }
    }

    return (
        <>
            <div className="w-full border-l border-white/10 bg-background flex flex-col h-full font-mono">


                <div className="p-4 space-y-4 overflow-y-auto flex-1 bg-background">
                    <div>
                        <label className="block text-[10px] font-bold text-muted-foreground mb-1.5 tracking-wider uppercase">PATH</label>
                        <div className="text-xs break-all bg-muted/30 border border-white/10 p-2 rounded font-mono text-foreground">{path}</div>
                    </div>

                    <div>
                        <label className="block text-[10px] font-bold text-muted-foreground mb-1.5 tracking-wider uppercase">TYPE</label>
                        <div className="text-xs font-semibold text-foreground uppercase">{label}</div>
                    </div>

                    {/* Dynamic properties based on type */}
                    {(selectedAsset as any).type === 'image' && (
                        <>
                            <div>
                                <label className="block text-[10px] font-bold text-black/60 mb-1.5 tracking-wider uppercase">DIMENSIONS</label>
                                <div className="text-xs font-semibold text-black">1024 x 1024</div>
                            </div>
                            <div>
                                <label className="block text-[10px] font-bold text-black/60 mb-1.5 tracking-wider uppercase">FORMAT</label>
                                <div className="text-xs font-semibold text-black uppercase">PNG</div>
                            </div>
                        </>
                    )}

                    {isModel && (
                        <>
                            <div>
                                <label className="block text-[10px] font-bold text-muted-foreground mb-1.5 tracking-wider uppercase">FORMAT</label>
                                <div className="text-xs font-semibold text-foreground uppercase">{(selectedAsset as any).format || assetPath?.split('.').pop() || 'GLB'}</div>
                            </div>
                            <div>
                                <label className="block text-[10px] font-bold text-muted-foreground mb-1.5 tracking-wider uppercase">STATUS</label>
                                <div className="text-xs font-semibold text-foreground uppercase">{(selectedAsset as any).status || 'READY'}</div>
                            </div>
                        </>
                    )}

                    {/* Common metadata if available */}
                    <div>
                        <label className="block text-[10px] font-bold text-black/60 mb-1.5 tracking-wider uppercase">SIZE</label>
                        <div className="text-xs font-semibold text-black">{size}</div>
                    </div>
                    <div>
                        <label className="block text-[10px] font-bold text-black/60 mb-1.5 tracking-wider uppercase">CREATED</label>
                        <div className="text-xs font-semibold text-black">{created}</div>
                    </div>
                </div>

                {/* Image Actions / Edit Mode */}
                {isImage && (
                    <div className="p-4 border-t border-white/10 space-y-4">
                        <div className="flex items-center justify-between">
                            <h4 className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Image Tools</h4>
                        </div>
                        <ImageEditOverlay imageUrl={imageUrl || ""} isInline={true}>
                            {/* Generate 3D Model Button */}
                            <button
                                onClick={handleGenerate3DClick}
                                disabled={isProcessing}
                                className={cn(
                                    "w-full h-10 px-3 py-2 text-xs font-bold transition-all duration-150 flex items-center justify-center gap-2",
                                    "bg-white/10 text-white border border-white/20 rounded-full",
                                    "hover:bg-white/20",
                                    isProcessing && "opacity-50 cursor-not-allowed"
                                )}
                            >
                                {isGenerating3D || isReplacingBackground ? (
                                    <>
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                        <span>LOADING...</span>
                                    </>
                                ) : (
                                    <>
                                        <Box className="h-4 w-4" />
                                        <span className="text-xs font-bold uppercase tracking-widest">GENERATE 3D MODEL</span>
                                    </>
                                )}
                            </button>
                        </ImageEditOverlay>
                    </div>
                )}

                {/* Model action buttons */}
                {isModel && (
                    <div className="p-4 border-t border-white/10 space-y-4">
                        {/* Download Model Button */}
                        <button
                            onClick={handleDownloadModel}
                            disabled={!imageUrl}
                            className={cn(
                                "w-full px-3 py-2 text-xs font-bold transition-all duration-150 flex items-center justify-center gap-2",
                                "bg-background text-foreground border-2 border-border shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] dark:shadow-[2px_2px_0px_0px_rgba(255,255,255,1)]",
                                "hover:scale-[1.02] active:scale-100 active:shadow-[1px_1px_0px_0px_rgba(0,0,0,1)] dark:active:shadow-[1px_1px_0px_0px_rgba(255,255,255,1)]",
                                !imageUrl && "opacity-50 cursor-not-allowed border-muted-foreground text-muted-foreground shadow-none"
                            )}
                        >
                            <Download className="h-4 w-4" />
                            Download Model
                        </button>
                        
                        {/* Auto Rigging */}
                        <div className="space-y-3 p-3 border border-white/10 rounded-lg bg-foreground/5">
                             <div className="space-y-1 text-center mb-1">
                                 <h4 className="text-[11px] font-bold uppercase tracking-wider text-foreground">Tripo Auto Rig</h4>
                                 <p className="text-[9px] text-muted-foreground">Applies skeletal rig and animations.</p>
                             </div>
                             
                             <div className="space-y-1">
                                 <label className="text-[10px] uppercase font-bold text-muted-foreground">Rig Type</label>
                                 <select 
                                    value={selectedRigType}
                                    onChange={(e) => setSelectedRigType(e.target.value)}
                                    disabled={isRigging || !imageUrl}
                                    className="w-full p-2 text-xs border border-border bg-background focus:outline-none font-sans"
                                 >
                                      <option value="biped">Biped (Humanoid)</option>
                                      <option value="quadruped">Quadruped (4 limbs)</option>
                                      <option value="hexapod">Hexapod (6 limbs)</option>
                                      <option value="octopod">Octopod (8 limbs)</option>
                                      <option value="avian">Avian (Bird)</option>
                                      <option value="serpentine">Serpentine (Snake)</option>
                                      <option value="aquatic">Aquatic (Fish)</option>
                                 </select>
                             </div>
                             
                             <button
                                 onClick={handleAutoRig}
                                 disabled={isRigging || !imageUrl}
                                 className={cn(
                                    "w-full px-3 py-2 mt-2 text-xs font-bold transition-all duration-150 flex items-center justify-center gap-2",
                                    "bg-foreground text-background border-2 border-border shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] dark:shadow-[2px_2px_0px_0px_rgba(255,255,255,1)]",
                                    "hover:scale-[1.02] active:scale-100 active:shadow-[1px_1px_0px_0px_rgba(0,0,0,1)] dark:active:shadow-[1px_1px_0px_0px_rgba(255,255,255,1)]",
                                    (isRigging || !imageUrl) && "opacity-50 cursor-not-allowed transform-none hover:scale-100 shadow-none border border-border"
                                 )}
                             >
                                 {isRigging ? (
                                    <>
                                        <Loader2 className="h-3 w-3 animate-spin"/>
                                        <span className="truncate max-w-[120px]">{rigStatus}</span>
                                    </>
                                 ) : (
                                    <>
                                        Auto Rig Model
                                    </>
                                 )}
                             </button>
                        </div>
                    </div>
                )}
            </div>



            {/* Background Warning Dialog */}
            {showBackgroundWarning && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white border-2 border-black p-6 max-w-md w-full shadow-[8px_8px_0px_0px_rgba(0,0,0,1)]">
                        <h3 className="text-lg font-bold text-black mb-4 font-mono">⚠️ Background Issue Detected</h3>
                        <div className="space-y-2 mb-6">
                            {backgroundIssues.map((issue, i) => (
                                <p key={i} className="text-sm text-black/70 font-mono">• {issue}</p>
                            ))}
                        </div>
                        <p className="text-sm text-black mb-6 font-mono">
                            Would you like to generate a clean background for better 3D model results?
                        </p>
                        <div className="flex gap-2">
                            <button
                                onClick={() => setShowBackgroundWarning(false)}
                                className="flex-1 px-4 py-2 border-2 border-black bg-white text-black font-mono text-sm font-bold hover:bg-gray-100"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleReplaceBackground}
                                className="flex-1 px-4 py-2 border-2 border-black bg-black text-white font-mono text-sm font-bold hover:bg-gray-800"
                            >
                                Yes, Fix Background
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Background Comparison Dialog */}
            {showBackgroundComparison && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white border-2 border-black p-6 max-w-2xl w-full shadow-[8px_8px_0px_0px_rgba(0,0,0,1)]">
                        <h3 className="text-lg font-bold text-black mb-4 font-mono">Background Comparison</h3>
                        <div className="flex items-center gap-4 mb-6">
                            <div className="flex-1">
                                <p className="text-xs font-bold text-black/60 mb-2 font-mono">ORIGINAL</p>
                                <img
                                    src={originalImageUrl}
                                    alt="Original"
                                    className="w-full h-48 object-contain border-2 border-black bg-gray-100"
                                />
                            </div>
                            <ArrowRight className="h-8 w-8 text-black shrink-0" />
                            <div className="flex-1">
                                <p className="text-xs font-bold text-black/60 mb-2 font-mono">NEW BACKGROUND</p>
                                <img
                                    src={newBackgroundImageUrl}
                                    alt="New Background"
                                    className="w-full h-48 object-contain border-2 border-black bg-gray-100"
                                />
                            </div>
                        </div>
                        <div className="flex gap-2">
                            <button
                                onClick={() => setShowBackgroundComparison(false)}
                                className="flex-1 px-4 py-2 border-2 border-black bg-white text-black font-mono text-sm font-bold hover:bg-gray-100"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleProceedWithNewBackground}
                                className="flex-1 px-4 py-2 border-2 border-black bg-black text-white font-mono text-sm font-bold hover:bg-gray-800"
                            >
                                Proceed
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* 3D Settings Dialog */}
            {show3DSettings && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white border-2 border-black p-6 max-w-md w-full shadow-[8px_8px_0px_0px_rgba(0,0,0,1)]">
                        <h3 className="text-lg font-bold text-black mb-4 font-mono">3D Model Settings</h3>

                        {/* Resolution */}
                        <div className="mb-4">
                            <label className="block text-xs font-bold text-black/60 mb-2 font-mono uppercase">Resolution</label>
                            <div className="flex gap-2">
                                {(["512", "1024", "1536"] as Resolution[]).map((res) => (
                                    <button
                                        key={res}
                                        onClick={() => setResolution(res)}
                                        className={cn(
                                            "flex-1 px-3 py-2 border-2 border-black font-mono text-sm font-bold transition-all",
                                            resolution === res
                                                ? "bg-black text-white"
                                                : "bg-white text-black hover:bg-gray-100"
                                        )}
                                    >
                                        {res}p
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Texture Toggle */}
                        <div className="mb-6">
                            <label className="block text-xs font-bold text-black/60 mb-2 font-mono uppercase">Texture</label>
                            <div className="flex gap-2">
                                <button
                                    onClick={() => setWithTexture(true)}
                                    className={cn(
                                        "flex-1 px-3 py-2 border-2 border-black font-mono text-sm font-bold transition-all",
                                        withTexture
                                            ? "bg-black text-white"
                                            : "bg-white text-black hover:bg-gray-100"
                                    )}
                                >
                                    Textured
                                </button>
                                <button
                                    onClick={() => setWithTexture(false)}
                                    className={cn(
                                        "flex-1 px-3 py-2 border-2 border-black font-mono text-sm font-bold transition-all",
                                        !withTexture
                                            ? "bg-black text-white"
                                            : "bg-white text-black hover:bg-gray-100"
                                    )}
                                >
                                    Non-Textured
                                </button>
                            </div>
                        </div>

                        {/* Credit Cost */}
                        <div className="mb-6 p-3 border-2 border-black bg-gray-50">
                            <div className="flex justify-between items-center">
                                <span className="text-xs font-bold text-black/60 font-mono uppercase">Credit Cost</span>
                                <span className="text-lg font-bold text-black font-mono">{creditCost} credits</span>
                            </div>
                        </div>

                        <div className="flex gap-2">
                            <button
                                onClick={() => setShow3DSettings(false)}
                                className="flex-1 px-4 py-2 border-2 border-black bg-white text-black font-mono text-sm font-bold hover:bg-gray-100"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleGenerate3D}
                                className="flex-1 px-4 py-2 border-2 border-black bg-black text-white font-mono text-sm font-bold hover:bg-gray-800"
                            >
                                Generate
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Loading Overlay for Background Replacement */}
            {isReplacingBackground && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                    <div className="bg-white border-2 border-black p-6 flex items-center gap-4 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                        <Loader2 className="h-6 w-6 animate-spin text-black" />
                        <span className="font-mono text-sm font-bold text-black">Replacing background...</span>
                    </div>
                </div>
            )}
        </>
    )
}
