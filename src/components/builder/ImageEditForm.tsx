import { Download, ImageIcon, Loader2, Send, Upload, X } from "lucide-react"
import { useCallback, useRef, useState } from "react"
import { cn } from "../../lib/utils"
import { type HyperrealImageEditModel } from "../../services/hyperreal"
import { useAppStore } from "../../store/useAppStore"

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

    const [uploadedFile, setUploadedFile] = useState<File | null>(null)
    const [uploadedPreview, setUploadedPreview] = useState<string | null>(null)
    const [editPrompt, setEditPrompt] = useState("")
    const [editEngine, setEditEngine] = useState<HyperrealImageEditModel>("nano-banana-edit")
    const [isGenerating, setIsGenerating] = useState(false)
    const [isDragging, setIsDragging] = useState(false)
    const [error, setError] = useState<string | null>(null)

    const fileInputRef = useRef<HTMLInputElement>(null)

    // Handle file selection
    const handleFileSelect = (file: File) => {
        if (!file.type.startsWith("image/")) {
            setError("Please upload an image file (PNG, JPG, JPEG)")
            return
        }
        setUploadedFile(file)
        setUploadedPreview(URL.createObjectURL(file))
        setError(null)
    }

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (file) handleFileSelect(file)
    }

    // Drag & drop handlers
    const handleDragOver = useCallback((e: React.DragEvent) => {
        e.preventDefault()
        setIsDragging(true)
    }, [])

    const handleDragLeave = useCallback((e: React.DragEvent) => {
        e.preventDefault()
        setIsDragging(false)
    }, [])

    const handleDrop = useCallback((e: React.DragEvent) => {
        e.preventDefault()
        setIsDragging(false)
        const file = e.dataTransfer.files?.[0]
        if (file) handleFileSelect(file)
    }, [])

    // Remove uploaded file
    const handleRemoveFile = () => {
        setUploadedFile(null)
        if (uploadedPreview) URL.revokeObjectURL(uploadedPreview)
        setUploadedPreview(null)
        if (fileInputRef.current) fileInputRef.current.value = ""
    }

    // Download source image — use canvas to bypass CORS restrictions
    const handleDownloadSource = () => {
        const img = new Image()
        img.crossOrigin = "anonymous"
        img.onload = () => {
            const canvas = document.createElement("canvas")
            canvas.width = img.naturalWidth
            canvas.height = img.naturalHeight
            const ctx = canvas.getContext("2d")
            if (!ctx) {
                // Canvas fallback failed, try direct link
                triggerDirectDownload()
                return
            }
            ctx.drawImage(img, 0, 0)
            canvas.toBlob((blob) => {
                if (!blob) {
                    triggerDirectDownload()
                    return
                }
                const url = URL.createObjectURL(blob)
                const a = document.createElement("a")
                a.href = url
                a.download = sourceImageName || "image.png"
                document.body.appendChild(a)
                a.click()
                document.body.removeChild(a)
                URL.revokeObjectURL(url)
            }, "image/png")
        }
        img.onerror = () => {
            // Image load failed (CORS), try direct download link
            triggerDirectDownload()
        }
        img.src = sourceImageUrl
    }

    // Fallback: create a link with download attribute
    const triggerDirectDownload = () => {
        const a = document.createElement("a")
        a.href = sourceImageUrl
        a.download = sourceImageName || "image.png"
        a.target = "_blank"
        a.rel = "noopener noreferrer"
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
    }

    // Generate edited image via the proxy server
    const handleGenerate = async () => {
        if (!uploadedFile || !editPrompt.trim()) return

        setIsGenerating(true)
        setError(null)

        try {
            // The proxy server URL — update this after deploying to Render
            const PROXY_SERVER_URL = import.meta.env.VITE_IMAGE_PROXY_URL || "http://localhost:3002"

            // Build multipart form data with image file + prompt + model
            const formData = new FormData()
            formData.append("image", uploadedFile)
            formData.append("prompt", editPrompt.trim())
            formData.append("model", editEngine)

            // Optionally pass the HyperReal API key from the frontend env
            const apiKey = import.meta.env.VITE_HYPERREAL_API_KEY
            if (apiKey) {
                formData.append("apiKey", apiKey)
            }

            console.log(`📤 Sending to proxy server: ${PROXY_SERVER_URL}/api/edit-image`)
            console.log(`   File: ${uploadedFile.name} (${(uploadedFile.size / 1024).toFixed(1)} KB)`)
            console.log(`   Prompt: ${editPrompt.trim()}`)
            console.log(`   Model: ${editEngine}`)

            const response = await fetch(`${PROXY_SERVER_URL}/api/edit-image`, {
                method: "POST",
                body: formData,
            })

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({ error: response.statusText }))
                throw new Error(errorData.error || errorData.details || `Server error: ${response.status}`)
            }

            const result = await response.json()

            if (!result.success || !result.editedImageUrl) {
                throw new Error("Server returned no edited image URL")
            }

            console.log(`✅ Image edit completed!`)
            console.log(`   Credits used: ${result.creditsUsed}`)
            console.log(`   Result URL: ${result.editedImageUrl}`)

            // Save the edited image to the project
            const timestamp = Date.now()
            const editedName = `ed_${String(timestamp).slice(-7)}.png`
            const editedPath = `images/${editedName}`

            // Use the R2 URL directly (persisting to Supabase would fail due to CORS)
            const finalImageUrl = result.editedImageUrl

            addGeneratedFile(editedPath, finalImageUrl)

            // Show the new image in the viewer
            setSelectedAsset({
                name: editedName,
                path: editedPath,
                type: "image",
                url: finalImageUrl,
                content: finalImageUrl,
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
        <div className="flex flex-col h-full bg-background font-mono">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b-2 border-border bg-muted/50 shrink-0">
                <div className="flex items-center gap-2">
                    <ImageIcon className="h-4 w-4 text-foreground" />
                    <span className="text-xs font-bold tracking-wider text-foreground uppercase">
                        Edit Image
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

            <div className="flex-1 overflow-y-auto p-6 space-y-6">
                {/* Step 1: Download original */}
                <div className="space-y-2">
                    <label className="block text-[10px] font-bold text-muted-foreground tracking-wider uppercase">
                        Step 1 — Download original image
                    </label>
                    <div className="flex items-center gap-3 p-3 border-2 border-border bg-muted/30">
                        {sourceImageUrl && (
                            <img
                                src={sourceImageUrl}
                                alt={sourceImageName}
                                className="h-12 w-12 object-cover border border-border shrink-0"
                            />
                        )}
                        <div className="flex-1 min-w-0">
                            <div className="text-xs font-bold text-foreground truncate">
                                {sourceImageName}
                            </div>
                            <div className="text-[10px] text-muted-foreground">
                                Download this image to your device first
                            </div>
                        </div>
                        <button
                            onClick={handleDownloadSource}
                            className="shrink-0 px-3 py-1.5 text-xs font-bold border-2 border-border bg-foreground text-background hover:opacity-90 transition-all flex items-center gap-1.5"
                        >
                            <Download className="h-3 w-3" />
                            Download
                        </button>
                    </div>
                </div>

                {/* Step 2: Upload image */}
                <div className="space-y-2">
                    <label className="block text-[10px] font-bold text-muted-foreground tracking-wider uppercase">
                        Step 2 — Upload the image here
                    </label>

                    {!uploadedFile ? (
                        <div
                            onDragOver={handleDragOver}
                            onDragLeave={handleDragLeave}
                            onDrop={handleDrop}
                            onClick={() => fileInputRef.current?.click()}
                            className={cn(
                                "border-2 border-dashed p-8 flex flex-col items-center justify-center gap-3 cursor-pointer transition-all",
                                isDragging
                                    ? "border-foreground bg-muted/50"
                                    : "border-border hover:border-foreground/50 hover:bg-muted/20"
                            )}
                        >
                            <Upload className="h-8 w-8 text-muted-foreground" />
                            <div className="text-center">
                                <p className="text-xs font-bold text-foreground">
                                    Drag & drop your image here
                                </p>
                                <p className="text-[10px] text-muted-foreground mt-1">
                                    or click to browse • PNG, JPG, JPEG
                                </p>
                            </div>
                        </div>
                    ) : (
                        <div className="border-2 border-border p-3 flex items-center gap-3">
                            <img
                                src={uploadedPreview!}
                                alt="Uploaded"
                                className="h-16 w-16 object-cover border border-border shrink-0"
                            />
                            <div className="flex-1 min-w-0">
                                <div className="text-xs font-bold text-foreground truncate">
                                    {uploadedFile.name}
                                </div>
                                <div className="text-[10px] text-muted-foreground">
                                    {(uploadedFile.size / 1024).toFixed(1)} KB
                                </div>
                            </div>
                            <button
                                onClick={handleRemoveFile}
                                className="shrink-0 p-1.5 hover:bg-muted rounded transition-colors"
                                title="Remove"
                            >
                                <X className="h-3.5 w-3.5 text-foreground" />
                            </button>
                        </div>
                    )}

                    <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/png,image/jpeg,image/jpg"
                        onChange={handleInputChange}
                        className="hidden"
                    />
                </div>

                {/* Step 3: Model selection */}
                <div className="space-y-2">
                    <label className="block text-[10px] font-bold text-muted-foreground tracking-wider uppercase">
                        Step 3 — Choose edit model
                    </label>
                    <div className="flex gap-2">
                        <button
                            onClick={() => setEditEngine("nano-banana-edit")}
                            disabled={isGenerating}
                            className={cn(
                                "flex-1 px-3 py-2 text-xs font-bold border-2 border-border transition-all",
                                editEngine === "nano-banana-edit"
                                    ? "bg-foreground text-background"
                                    : "bg-background text-foreground hover:bg-muted"
                            )}
                        >
                            Nano Banana
                        </button>
                        <button
                            onClick={() => setEditEngine("nano-banana-pro-edit")}
                            disabled={isGenerating}
                            className={cn(
                                "flex-1 px-3 py-2 text-xs font-bold border-2 border-border transition-all",
                                editEngine === "nano-banana-pro-edit"
                                    ? "bg-foreground text-background"
                                    : "bg-background text-foreground hover:bg-muted"
                            )}
                        >
                            Nano Banana Pro
                        </button>
                    </div>
                </div>

                {/* Step 4: Edit prompt */}
                <div className="space-y-2">
                    <label className="block text-[10px] font-bold text-muted-foreground tracking-wider uppercase">
                        Step 4 — Describe the edit
                    </label>
                    <textarea
                        value={editPrompt}
                        onChange={(e) => setEditPrompt(e.target.value)}
                        placeholder="e.g. Replace the background with a sunset beach scene..."
                        disabled={isGenerating}
                        rows={3}
                        className="w-full px-3 py-2 border-2 border-border font-mono text-sm text-foreground placeholder:text-muted-foreground bg-background focus:outline-none focus:border-foreground/50 resize-none"
                    />
                </div>

                {/* Error */}
                {error && (
                    <div className="p-3 border-2 border-red-500/50 bg-red-500/10 text-xs font-mono text-red-600 dark:text-red-400">
                        {error}
                    </div>
                )}
            </div>

            {/* Generate Button (sticky bottom) */}
            <div className="p-4 border-t-2 border-border bg-background shrink-0">
                <button
                    onClick={handleGenerate}
                    disabled={isGenerating || !uploadedFile || !editPrompt.trim()}
                    className={cn(
                        "w-full px-4 py-3 text-sm font-bold border-2 border-border transition-all flex items-center justify-center gap-2",
                        "bg-foreground text-background hover:opacity-90",
                        (isGenerating || !uploadedFile || !editPrompt.trim()) &&
                        "opacity-50 cursor-not-allowed"
                    )}
                >
                    {isGenerating ? (
                        <>
                            <Loader2 className="h-4 w-4 animate-spin" />
                            Generating...
                        </>
                    ) : (
                        <>
                            <Send className="h-4 w-4" />
                            Generate Edit
                        </>
                    )}
                </button>
            </div>
        </div>
    )
}
