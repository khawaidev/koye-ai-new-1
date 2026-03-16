import { File, FileCode, Music } from "lucide-react"
import { useAppStore } from "../../store/useAppStore"
import { detectFileType } from "../../utils/fileTypeDetection"
import { ImageViewer } from "../image-viewer/ImageViewer"
import { ModelViewer } from "../model-viewer/ModelViewer"
import { CodeViewer } from "./CodeViewer"

export function UnifiedViewer() {
    const selectedAsset = useAppStore((state) => state.selectedAsset)
    const images = useAppStore((state) => state.images)
    const generatedFiles = useAppStore((state) => state.generatedFiles)

    if (!selectedAsset) {
        return (
            <div className="flex h-full flex-col items-center justify-center bg-muted/20 text-muted-foreground font-mono">
                <FileCode className="h-16 w-16 mb-4 opacity-20" />
                <p className="text-sm">Select a file to view</p>
            </div>
        )
    }

    const assetPath = (selectedAsset as any).path
    const assetName = (selectedAsset as any).name || (assetPath ? assetPath.split('/').pop() : 'Unknown')

    // Detect file type from path if available
    let fileType = assetPath ? detectFileType(assetPath) : null

    // Helper function to extract URL from markdown reference text
    const extractUrlFromContent = (content: string): string | null => {
        // Check for URL pattern in markdown reference (e.g. - **URL:** https://...)
        const urlMatch = content.match(/\**URL:\**\s*(https?:\/\/[^\s\n*)]+)/i) || content.match(/# URL:\s*(https?:\/\/[^\s\n]+)/i)
        if (urlMatch) {
            return urlMatch[1]
        }
        // Fallback: simply find the first http(s) link in the content
        const httpMatch = content.match(/(https?:\/\/[^\s\n*)]+)/i)
        if (httpMatch) {
            return httpMatch[1]
        }
        // Check for blob URL
        const blobMatch = content.match(/(blob:[^\s\n*)]+)/)
        if (blobMatch) {
            return blobMatch[1]
        }
        return null
    }

    // Handle Image - check by type property, view property, data.url, or file extension
    if (
        (selectedAsset as any).type === 'image' ||
        ('view' in selectedAsset && 'url' in selectedAsset) ||
        (fileType && fileType.category === 'image')
    ) {
        // First check if selectedAsset.data has URL (from FileSystemSidebar)
        const dataUrl = (selectedAsset as any).data?.url || (selectedAsset as any).url
        if (dataUrl && (dataUrl.startsWith('data:image/') || dataUrl.startsWith('http') || dataUrl.startsWith('blob:'))) {
            return (
                <div className="flex h-full items-center justify-center bg-muted/20 p-4">
                    <img
                        src={dataUrl}
                        alt={assetName}
                        className="max-h-full max-w-full object-contain"
                    />
                </div>
            )
        }

        // If it's a file path pointing to an image, try to load it
        if (fileType && fileType.category === 'image' && assetPath && generatedFiles[assetPath]) {
            const imageContent = generatedFiles[assetPath]
            // Direct URL or data URL
            if (imageContent.startsWith('data:image/') || imageContent.startsWith('http') || imageContent.startsWith('blob:')) {
                return (
                    <div className="flex h-full items-center justify-center bg-muted/20 p-4">
                        <img
                            src={imageContent}
                            alt={assetName}
                            className="max-h-full max-w-full object-contain"
                        />
                    </div>
                )
            }
            // Try to extract URL from markdown reference
            const extractedUrl = extractUrlFromContent(imageContent)
            if (extractedUrl) {
                return (
                    <div className="flex h-full items-center justify-center bg-muted/20 p-4">
                        <img
                            src={extractedUrl}
                            alt={assetName}
                            className="max-h-full max-w-full object-contain"
                        />
                    </div>
                )
            }
        }

        // It's an Image object from the store
        if ('view' in selectedAsset && 'url' in selectedAsset) {
            return <ImageViewer images={images} />
        }

        // Fallback: try to show as image if URL exists in any form
        if ((selectedAsset as any).url) {
            return (
                <div className="flex h-full items-center justify-center bg-muted/20 p-4">
                    <img
                        src={(selectedAsset as any).url}
                        alt={assetName}
                        className="max-h-full max-w-full object-contain"
                    />
                </div>
            )
        }
    }

    // Handle Model - ONLY when explicitly typed as model (set by Builder.tsx) or actual model file extension
    if (
        (selectedAsset as any).type === 'model' ||
        (fileType && fileType.category === 'model')
    ) {
        // Already has format + url (e.g. set by Builder.tsx handleSelectFile)
        if ('url' in selectedAsset && (selectedAsset as any).url) {
            return <ModelViewer model={selectedAsset as any} onClose={() => { }} />
        }

        // If it's an actual model file (.glb, .fbx etc), try to get URL from generatedFiles
        let modelUrl = (selectedAsset as any).url || (selectedAsset as any).data?.url

        if (!modelUrl && assetPath && generatedFiles[assetPath]) {
            const modelContent = generatedFiles[assetPath]
            if (modelContent.startsWith('http') || modelContent.startsWith('blob:') || modelContent.startsWith('data:')) {
                modelUrl = modelContent
            } else {
                modelUrl = extractUrlFromContent(modelContent)
            }
        }

        if (modelUrl) {
            const ext = assetPath?.split('.').pop()?.toLowerCase() || 'glb'
            const format = ['glb', 'gltf', 'obj', 'fbx', 'stl'].includes(ext) ? ext : ((selectedAsset as any).format || 'glb')

            const modelObj = {
                url: modelUrl,
                format,
                name: assetName,
                status: 'completed' as const,
            }
            return <ModelViewer model={modelObj as any} onClose={() => { }} />
        }
    }

    // Handle Video - check by type property or file extension
    if (
        (selectedAsset as any).type === 'video' ||
        (fileType && fileType.category === 'video')
    ) {
        const fileContent = assetPath ? generatedFiles[assetPath] : null;
        const videoUrl = (selectedAsset as any).url ||
            (fileContent && (fileContent.startsWith('http') || fileContent.startsWith('blob:') || fileContent.startsWith('data:')) ? fileContent : null)

        if (videoUrl) {
            return (
                <div className="flex h-full items-center justify-center bg-background">
                    <video
                        src={videoUrl}
                        controls
                        className="max-h-full max-w-full"
                    />
                </div>
            )
        }
    }

    // Handle Audio - check by type property or file extension
    if (
        (selectedAsset as any).type === 'audio' ||
        (fileType && fileType.category === 'audio')
    ) {
        const fileContent = assetPath ? generatedFiles[assetPath] : null;
        const audioUrl = (selectedAsset as any).url ||
            (fileContent && (fileContent.startsWith('http') || fileContent.startsWith('blob:') || fileContent.startsWith('data:')) ? fileContent : null)

        if (audioUrl) {
            return (
                <div className="flex h-full flex-col items-center justify-center bg-background text-foreground p-8">
                    <Music className="h-24 w-24 mb-8 text-green-500" />
                    <audio
                        src={audioUrl}
                        controls
                        className="w-full max-w-md"
                    />
                    <p className="mt-4 font-mono text-sm">{assetName}</p>
                </div>
            )
        }
    }

    // Handle Code/Text files - check by content, type property, or file extension
    const content = (selectedAsset as any).content ||
        (assetPath && generatedFiles[assetPath])

    if (content !== undefined && content !== null) {
        // Check if it's actually a code/text file
        if (
            (selectedAsset as any).type === 'code' ||
            (fileType && (fileType.category === 'code' || fileType.category === 'text'))
        ) {
            return (
                <CodeViewer
                    content={String(content)}
                    fileName={assetName}
                    path={assetPath}
                />
            )
        }

        // Fallback: show as text if no specific type detected
        if (!fileType || fileType.category === 'unknown') {
            return (
                <CodeViewer
                    content={String(content)}
                    fileName={assetName}
                    path={assetPath}
                />
            )
        }
    }

    // Unsupported or unknown type
    return (
        <div className="flex h-full flex-col items-center justify-center bg-muted/20 text-muted-foreground font-mono p-8">
            <File className="h-16 w-16 mb-4 opacity-20" />
            <p className="text-sm mb-2">Unsupported file type</p>
            <p className="text-xs text-muted-foreground/70">{assetName}</p>
        </div>
    )
}
