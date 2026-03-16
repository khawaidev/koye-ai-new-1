import { Box, ChevronDown, ChevronRight, Code, File, Folder, FolderOpen, Image as ImageIcon, Music, Video } from "lucide-react"
import { useEffect, useState } from "react"
import { cn } from "../../lib/utils"
import type { Image, Model } from "../../store/useAppStore"
import { getFileNodeType } from "../../utils/fileTypeDetection"

export interface FileNode {
  name: string
  path: string
  type: "file" | "folder"
  fileType?: "image" | "model" | "video" | "audio" | "code"
  children?: FileNode[]
  data?: any // Store original asset data
}

interface FileSystemSidebarProps {
  files: Record<string, string> // path -> content
  images: Image[]
  models?: Model[]
  videos?: string[]
  audio?: string[]
  selectedFile: string | null
  onSelectFile: (path: string, type: "file" | "asset", data?: any) => void
}

// Convert flat file structure and assets to tree
export function buildFileTree(
  files: Record<string, string>,
  images: Image[],
  models: Model[] = [],
  videos: string[] = [],
  audio: string[] = []
): FileNode[] {
  const tree: Record<string, FileNode> = {}

  // Helper to add node to tree
  const addNode = (path: string, type: "file" | "folder", fileType?: FileNode["fileType"], data?: any) => {
    const parts = path.split("/")
    let currentPath = ""

    parts.forEach((part, index) => {
      const isLast = index === parts.length - 1
      currentPath = currentPath ? `${currentPath}/${part}` : part

      if (!tree[currentPath]) {
        tree[currentPath] = {
          name: part,
          path: currentPath,
          type: isLast ? type : "folder",
          fileType: isLast ? fileType : undefined,
          children: isLast ? undefined : [],
          data: isLast ? data : undefined
        }
      }

      // Add to parent's children
      if (index > 0) {
        const parentPath = parts.slice(0, index).join("/")
        const parent = tree[parentPath]
        if (parent && parent.children && !parent.children.find(c => c.path === currentPath)) {
          parent.children.push(tree[currentPath])
        }
      }
    })
  }

  // Add generated files - detect type from extension
  Object.keys(files).forEach((path) => {
    const name = path.split('/').pop() || path
    const fileType = getFileNodeType(path) || "code"
    const content = files[path]

    // For images, set the url property so it can be used for editing
    // The content might be a data URL or HTTP URL for images
    const isImageContent = content && (
      content.startsWith('data:image/') ||
      content.startsWith('http://') ||
      content.startsWith('https://')
    )

    addNode(path, "file", fileType, {
      name,
      path,
      content: content,
      // Set url for images to ensure proper handling in BuilderInspector
      url: fileType === 'image' && isImageContent ? content : undefined,
      type: fileType
    })
  })

  // Add Images
  images.forEach((img, index) => {
    const name = `image_${index + 1}_${img.view}.png`
    const path = `assets/images/${name}`
    addNode(path, "file", "image", { ...img, name, path, type: 'image' })
  })

  // Add Models
  models.forEach((model, index) => {
    const name = `model_${index + 1}.glb`
    const path = `assets/models/${name}`
    addNode(path, "file", "model", { ...model, name, path, type: 'model' })
  })

  // Add Videos
  videos.forEach((video, index) => {
    const name = `video_${index + 1}.mp4`
    const path = `assets/videos/${name}`
    addNode(path, "file", "video", { url: video, name, path, type: 'video' })
  })

  // Add Audio
  audio.forEach((track, index) => {
    const name = `audio_${index + 1}.mp3`
    const path = `assets/audio/${name}`
    addNode(path, "file", "audio", { url: track, name, path, type: 'audio' })
  })

  // Get root level nodes
  return Object.values(tree).filter(node => {
    const parts = node.path.split("/")
    return parts.length === 1
  })
}

export function FileSystemSidebar({
  files,
  images,
  models = [],
  videos = [],
  audio = [],
  selectedFile,
  onSelectFile
}: FileSystemSidebarProps) {
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set(["assets", "assets/images", "assets/models", "assets/videos", "assets/audio"]))

  const fileTree = buildFileTree(files, images, models, videos, audio)

  // Debug: Log when component renders and what data is available
  useEffect(() => {
    console.log('FileSystemSidebar rendered with:', {
      filesCount: Object.keys(files).length,
      imagesCount: images.length,
      modelsCount: models.length,
      videosCount: videos.length,
      audioCount: audio.length,
      fileTreeLength: fileTree.length,
      selectedFile
    })
  }, [files, images, models, videos, audio, fileTree.length, selectedFile])

  const toggleFolder = (path: string) => {
    setExpandedFolders((prev) => {
      const next = new Set(prev)
      if (next.has(path)) {
        next.delete(path)
      } else {
        next.add(path)
      }
      return next
    })
  }

  const getFileIcon = (fileType?: FileNode["fileType"]) => {
    switch (fileType) {
      case "image": return <ImageIcon className="h-4 w-4 text-blue-500" />
      case "model": return <Box className="h-4 w-4 text-orange-500" />
      case "video": return <Video className="h-4 w-4 text-purple-500" />
      case "audio": return <Music className="h-4 w-4 text-green-500" />
      case "code": return <Code className="h-4 w-4 text-yellow-500" />
      default: return <File className="h-4 w-4 text-foreground" />
    }
  }

  const formatName = (name: string, isFile: boolean) => {
    if (name.length <= 10) return name

    if (!isFile) {
      return `${name.substring(0, 10)}...`
    }

    const lastDotIndex = name.lastIndexOf('.')
    if (lastDotIndex === -1 || lastDotIndex === 0) {
      return `${name.substring(0, 10)}...`
    }

    const ext = name.substring(lastDotIndex)
    const base = name.substring(0, lastDotIndex)

    if (base.length > 10) {
      return `${base.substring(0, 10)}...${ext}`
    }

    return name
  }

  const renderNode = (node: FileNode, level: number = 0) => {
    const isExpanded = expandedFolders.has(node.path)
    const isSelected = selectedFile === node.path

    if (node.type === "folder") {
      return (
        <div key={node.path}>
          <div
            className={cn(
              "flex items-center gap-1 px-2 py-1 cursor-pointer hover:bg-muted font-mono text-sm",
              level > 0 && "ml-4"
            )}
            style={{ paddingLeft: `${8 + level * 16}px` }}
            onClick={() => toggleFolder(node.path)}
          >
            {isExpanded ? (
              <ChevronDown className="h-3 w-3 text-foreground" />
            ) : (
              <ChevronRight className="h-3 w-3 text-foreground" />
            )}
            {isExpanded ? (
              <FolderOpen className="h-4 w-4 text-foreground" />
            ) : (
              <Folder className="h-4 w-4 text-foreground" />
            )}
            <span className="text-foreground" title={node.name}>
              {formatName(node.name, false)}
            </span>
          </div>
          {isExpanded && node.children && (
            <div>
              {node.children.map((child) => renderNode(child, level + 1))}
            </div>
          )}
        </div>
      )
    } else {
      return (
        <div
          key={node.path}
          className={cn(
            "flex items-center gap-1 px-2 py-1 cursor-pointer hover:bg-muted font-mono text-sm",
            isSelected && "bg-muted",
            level > 0 && "ml-4"
          )}
          style={{ paddingLeft: `${8 + level * 16}px` }}
          onClick={(e) => {
            console.log('FileSystemSidebar: File clicked!', node.path, 'Data:', node.data)
            e.preventDefault()
            e.stopPropagation()
            onSelectFile(node.path, "asset", node.data)
          }}
        >
          {getFileIcon(node.fileType)}
          <span className={cn("text-foreground", isSelected && "font-bold")} title={node.name}>
            {formatName(node.name, true)}
          </span>
        </div>
      )
    }
  }

  return (
    <div className="h-full overflow-y-auto bg-background border-r border-border p-2">
      <div className="mb-2 px-2 py-1 border-b border-border">
        <h3 className="text-xs font-bold text-foreground font-mono">FILE SYSTEM</h3>
      </div>
      <div className="space-y-1">
        {fileTree.length === 0 ? (
          <div className="px-2 py-4 text-center text-muted-foreground text-xs font-mono">
            No files generated yet
          </div>
        ) : (
          fileTree.map((node) => renderNode(node))
        )}
      </div>
    </div>
  )
}
