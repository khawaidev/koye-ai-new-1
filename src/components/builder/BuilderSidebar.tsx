import { Box, Check, ChevronDown, ChevronRight, Clipboard, ClipboardCopy, Code, File, Folder, FolderOpen, Image as ImageIcon, MoreVertical, Music, Pencil, Scissors, Trash2, Upload, Video, X } from "lucide-react"
import { useEffect, useRef, useState } from "react"
import { cn } from "../../lib/utils"
import { deleteProjectFile } from "../../services/projectFiles"
import { useAppStore } from "../../store/useAppStore"
import { isSettingsFile } from "../../utils/projectSettings"
import { buildFileTree, type FileNode } from "../sidebar/FileSystemSidebar"
import { Button } from "../ui/button"

interface BuilderSidebarProps {
    selectedFile: string | null
    onSelectFile: (path: string, type: "file" | "asset", data?: any) => void
    onFileCreated?: () => void
    projectId?: string
    userId?: string
}

export function BuilderSidebar({ selectedFile, onSelectFile, onFileCreated, projectId, userId }: BuilderSidebarProps) {
    // githubConnection is used when auto-save uploads files - it's passed down via store
    const { generatedFiles, images, currentModel, addGeneratedFile, setGeneratedFiles, githubConnection: _githubConnection } = useAppStore()
    const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set(["assets", "assets/images", "assets/videos", "assets/models", "assets/audio"]))
    const [showNewFileDialog, setShowNewFileDialog] = useState(false)
    const [showNewFolderDialog, setShowNewFolderDialog] = useState(false)
    const [newFileName, setNewFileName] = useState("")
    const [newFolderName, setNewFolderName] = useState("")
    const [newFileContent, setNewFileContent] = useState("")

    // File operations state
    const [showSettingsMenu, setShowSettingsMenu] = useState(false)
    const [showRenameDialog, setShowRenameDialog] = useState(false)
    const [renameValue, setRenameValue] = useState("")
    const [clipboard, setClipboard] = useState<{ path: string; content: string; operation: "copy" | "cut" } | null>(null)
    const settingsMenuRef = useRef<HTMLDivElement>(null)

    // Drag and drop state
    const [isDragOver, setIsDragOver] = useState(false)
    const [isUploading, setIsUploading] = useState(false)
    const [uploadProgress, setUploadProgress] = useState<{ current: number; total: number } | null>(null)
    const dropZoneRef = useRef<HTMLDivElement>(null)

    // Helper to determine file type from extension
    const getFileType = (fileName: string): 'image' | 'model' | 'video' | 'audio' | 'code' | 'other' => {
        const ext = fileName.split('.').pop()?.toLowerCase() || ''
        const imageExts = ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'bmp', 'ico']
        const modelExts = ['glb', 'gltf', 'obj', 'fbx', 'stl', '3ds']
        const videoExts = ['mp4', 'webm', 'mov', 'avi', 'mkv']
        const audioExts = ['mp3', 'wav', 'ogg', 'flac', 'm4a', 'aac']
        const codeExts = ['js', 'ts', 'jsx', 'tsx', 'html', 'css', 'json', 'py', 'java', 'cpp', 'c', 'h', 'md', 'txt', 'xml', 'yaml', 'yml']

        if (imageExts.includes(ext)) return 'image'
        if (modelExts.includes(ext)) return 'model'
        if (videoExts.includes(ext)) return 'video'
        if (audioExts.includes(ext)) return 'audio'
        if (codeExts.includes(ext)) return 'code'
        return 'other'
    }

    // Check if file is binary (needs base64 encoding)
    const isBinaryFile = (fileName: string): boolean => {
        const fileType = getFileType(fileName)
        return ['image', 'model', 'video', 'audio'].includes(fileType)
    }

    // Handle drag events
    const handleDragEnter = (e: React.DragEvent) => {
        e.preventDefault()
        e.stopPropagation()
        setIsDragOver(true)
    }

    const handleDragLeave = (e: React.DragEvent) => {
        e.preventDefault()
        e.stopPropagation()
        // Only set to false if we're leaving the drop zone entirely
        if (dropZoneRef.current && !dropZoneRef.current.contains(e.relatedTarget as Node)) {
            setIsDragOver(false)
        }
    }

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault()
        e.stopPropagation()
    }

    // Handle file drop
    const handleDrop = async (e: React.DragEvent) => {
        e.preventDefault()
        e.stopPropagation()
        setIsDragOver(false)

        const files = Array.from(e.dataTransfer.files)
        if (files.length === 0) return

        setIsUploading(true)
        setUploadProgress({ current: 0, total: files.length })

        try {
            for (let i = 0; i < files.length; i++) {
                const file = files[i]
                setUploadProgress({ current: i + 1, total: files.length })

                const targetPath = getTargetPath(file.name)

                // Check if file already exists
                let finalPath = targetPath
                let counter = 1
                const baseName = file.name.includes('.')
                    ? file.name.substring(0, file.name.lastIndexOf('.'))
                    : file.name
                const ext = file.name.includes('.')
                    ? file.name.substring(file.name.lastIndexOf('.'))
                    : ''

                while ((generatedFiles || {})[finalPath]) {
                    const dir = targetPath.includes('/')
                        ? targetPath.substring(0, targetPath.lastIndexOf('/'))
                        : ''
                    finalPath = dir
                        ? `${dir}/${baseName}_${counter}${ext}`
                        : `${baseName}_${counter}${ext}`
                    counter++
                }

                if (isBinaryFile(file.name)) {
                    // Handle binary files - convert to base64 data URL
                    const content = await new Promise<string>((resolve, reject) => {
                        const reader = new FileReader()
                        reader.onload = () => resolve(reader.result as string)
                        reader.onerror = reject
                        reader.readAsDataURL(file)
                    })
                    addGeneratedFile(finalPath, content)
                } else {
                    // Handle text files
                    const content = await new Promise<string>((resolve, reject) => {
                        const reader = new FileReader()
                        reader.onload = () => resolve(reader.result as string)
                        reader.onerror = reject
                        reader.readAsText(file)
                    })
                    addGeneratedFile(finalPath, content)
                }

                console.log(`Added file: ${finalPath} (${file.size} bytes)`)

                // Expand parent folders
                const pathParts = finalPath.split('/')
                if (pathParts.length > 1) {
                    setExpandedFolders(prev => {
                        const next = new Set(prev)
                        let currentPath = ''
                        for (let j = 0; j < pathParts.length - 1; j++) {
                            currentPath = currentPath ? `${currentPath}/${pathParts[j]}` : pathParts[j]
                            next.add(currentPath)
                        }
                        return next
                    })
                }
            }

            onFileCreated?.()
        } catch (error) {
            console.error('Error uploading files:', error)
            alert('Failed to upload some files. Please try again.')
        } finally {
            setIsUploading(false)
            setUploadProgress(null)
        }
    }

    // Close settings menu when clicking outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (settingsMenuRef.current && !settingsMenuRef.current.contains(event.target as Node)) {
                setShowSettingsMenu(false)
            }
        }
        document.addEventListener("mousedown", handleClickOutside)
        return () => document.removeEventListener("mousedown", handleClickOutside)
    }, [])

    // Filter out the hidden settings file from generatedFiles before building tree
    const visibleFiles = Object.fromEntries(
        Object.entries(generatedFiles || {}).filter(([path]) => !isSettingsFile(path))
    )

    // Use the exported buildFileTree function
    const fileTree = buildFileTree(visibleFiles, images, currentModel ? [currentModel] : [], [], [])

    // Get target folder path based on file type and current selection
    const getTargetPath = (fileName: string): string => {
        const fileType = getFileType(fileName)
        let basePath = ''

        // If a file/folder is selected, use that as context
        if (selectedFile) {
            const isFolder = fileTree.some(node =>
                node.path === selectedFile && node.type === 'folder'
            ) || expandedFolders.has(selectedFile)

            if (isFolder) {
                basePath = selectedFile
            } else if (selectedFile.includes('/')) {
                basePath = selectedFile.substring(0, selectedFile.lastIndexOf('/'))
            }
        }

        // For binary assets, organize into type subfolders
        if (isBinaryFile(fileName)) {
            // Map file types to standard project subfolders
            const folderMap: Record<string, string> = {
                image: 'assets/images',
                model: 'assets/models',
                video: 'assets/videos',
                audio: 'assets/audio',
            }
            const assetFolder = folderMap[fileType] || 'assets'

            // If we're already in an appropriate subfolder, use the selected path
            if (basePath === assetFolder || basePath.startsWith(assetFolder + '/')) {
                return `${basePath}/${fileName}`
            }
            return `${assetFolder}/${fileName}`
        }

        // For code/text files, place in current context or root
        return basePath ? `${basePath}/${fileName}` : fileName
    }

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

    // Format file/folder name with truncation
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

    const handleCreateFile = () => {
        if (!newFileName.trim()) return

        // Determine the path - check if selectedFile is a folder or file
        let basePath = ''
        if (selectedFile) {
            const isFolder = fileTree.some(node =>
                node.path === selectedFile && node.type === 'folder'
            ) || expandedFolders.has(selectedFile)

            if (isFolder) {
                basePath = selectedFile
            } else if (selectedFile.includes('/')) {
                basePath = selectedFile.substring(0, selectedFile.lastIndexOf('/'))
            }
        }

        const filePath = basePath ? `${basePath}/${newFileName.trim()}` : newFileName.trim()

        if ((generatedFiles || {})[filePath]) {
            alert(`File "${filePath}" already exists!`)
            return
        }

        addGeneratedFile(filePath, newFileContent || '')

        if (basePath) {
            setExpandedFolders(prev => new Set([...prev, basePath]))
        }

        setNewFileName("")
        setNewFileContent("")
        setShowNewFileDialog(false)
        onFileCreated?.()
    }

    const handleCreateFolder = () => {
        if (!newFolderName.trim()) return

        let basePath = ''
        if (selectedFile) {
            const isFolder = fileTree.some(node =>
                node.path === selectedFile && node.type === 'folder'
            ) || expandedFolders.has(selectedFile)

            if (isFolder) {
                basePath = selectedFile
            } else if (selectedFile.includes('/')) {
                basePath = selectedFile.substring(0, selectedFile.lastIndexOf('/'))
            }
        }

        const folderPath = basePath ? `${basePath}/${newFolderName.trim()}` : newFolderName.trim()

        const folderExists = Object.keys(generatedFiles).some(path =>
            path.startsWith(folderPath + '/') || path === folderPath
        )

        if (folderExists) {
            alert(`Folder "${folderPath}" already exists!`)
            return
        }

        const indexFilePath = `${folderPath}/.gitkeep`
        addGeneratedFile(indexFilePath, '')

        setExpandedFolders(prev => {
            const next = new Set([...prev, folderPath])
            if (basePath) {
                next.add(basePath)
            }
            return next
        })

        setNewFolderName("")
        setShowNewFolderDialog(false)
        onFileCreated?.()
    }

    // File operations
    const handleRename = async () => {
        if (!selectedFile || !renameValue.trim()) return

        // Don't allow renaming settings file
        if (isSettingsFile(selectedFile)) return

        const content = generatedFiles[selectedFile]
        if (content === undefined) return

        // Get the directory path
        const lastSlashIndex = selectedFile.lastIndexOf('/')
        const dirPath = lastSlashIndex > 0 ? selectedFile.substring(0, lastSlashIndex) : ''
        const newPath = dirPath ? `${dirPath}/${renameValue.trim()}` : renameValue.trim()

        if (generatedFiles[newPath] !== undefined) {
            alert(`A file with name "${renameValue.trim()}" already exists!`)
            return
        }

        try {
            // For rename: delete old file from DB/GitHub (if exists), the new file will be saved on next auto-save
            if (projectId && userId) {
                await deleteProjectFile(projectId, userId, selectedFile, _githubConnection)
            }

            // Update local state: remove old, add new
            const updatedFiles = { ...generatedFiles }
            delete updatedFiles[selectedFile]
            updatedFiles[newPath] = content
            setGeneratedFiles(updatedFiles)

            // Select the renamed file
            onSelectFile(newPath, "asset", { path: newPath, content, type: 'code' })

            setShowRenameDialog(false)
            setRenameValue("")
            onFileCreated?.()
        } catch (error) {
            console.error('Error renaming file:', error)
            alert('Failed to rename file. Please try again.')
        }
    }

    const handleDelete = async () => {
        if (!selectedFile) return

        // Don't allow deleting settings file
        if (isSettingsFile(selectedFile)) return

        if (!confirm(`Are you sure you want to delete "${selectedFile}"?`)) return

        try {
            // Delete from database directly (and GitHub if code file)
            if (projectId && userId) {
                try {
                    await deleteProjectFile(projectId, userId, selectedFile, _githubConnection)
                } catch (e) {
                    console.warn('Deletion failed, but continuing with local removal:', e)
                }
            }

            // Remove from local state
            const updatedFiles = { ...generatedFiles }
            delete updatedFiles[selectedFile]
            setGeneratedFiles(updatedFiles)

            // Clear selection
            onSelectFile("", "file")
            setShowSettingsMenu(false)
            onFileCreated?.()
        } catch (error) {
            console.error('Error deleting file:', error)
            alert('Failed to delete file. Please try again.')
        }
    }

    const handleCopy = () => {
        if (!selectedFile) return

        const content = generatedFiles[selectedFile]
        if (content === undefined) return

        setClipboard({ path: selectedFile, content, operation: "copy" })
        setShowSettingsMenu(false)
    }

    const handleCut = () => {
        if (!selectedFile) return

        const content = generatedFiles[selectedFile]
        if (content === undefined) return

        setClipboard({ path: selectedFile, content, operation: "cut" })
        setShowSettingsMenu(false)
    }

    const handlePaste = () => {
        if (!clipboard) return

        // Determine destination folder
        let destFolder = ''
        if (selectedFile) {
            const isFolder = fileTree.some(node =>
                node.path === selectedFile && node.type === 'folder'
            ) || expandedFolders.has(selectedFile)

            if (isFolder) {
                destFolder = selectedFile
            } else if (selectedFile.includes('/')) {
                destFolder = selectedFile.substring(0, selectedFile.lastIndexOf('/'))
            }
        }

        const fileName = clipboard.path.split('/').pop() || 'pasted_file'
        let newPath = destFolder ? `${destFolder}/${fileName}` : fileName

        // Handle name conflicts
        let counter = 1
        const baseName = fileName.includes('.') ? fileName.substring(0, fileName.lastIndexOf('.')) : fileName
        const ext = fileName.includes('.') ? fileName.substring(fileName.lastIndexOf('.')) : ''
        while (generatedFiles[newPath] !== undefined) {
            newPath = destFolder
                ? `${destFolder}/${baseName}_copy${counter}${ext}`
                : `${baseName}_copy${counter}${ext}`
            counter++
        }

        const updatedFiles = { ...generatedFiles }
        updatedFiles[newPath] = clipboard.content

        // If it was a cut operation, delete the original
        if (clipboard.operation === "cut") {
            delete updatedFiles[clipboard.path]
            setClipboard(null)
        }

        setGeneratedFiles(updatedFiles)
        setShowSettingsMenu(false)
        onFileCreated?.()
    }

    const openRenameDialog = () => {
        if (!selectedFile) return
        const fileName = selectedFile.split('/').pop() || ''
        setRenameValue(fileName)
        setShowRenameDialog(true)
        setShowSettingsMenu(false)
    }

    const getFileIcon = (fileType?: FileNode["fileType"], isSelected?: boolean) => {
        switch (fileType) {
            case "image": return <ImageIcon className={isSelected ? "h-4 w-4 text-background" : "h-4 w-4 text-blue-600"} />
            case "model": return <Box className={isSelected ? "h-4 w-4 text-background" : "h-4 w-4 text-orange-600"} />
            case "video": return <Video className={isSelected ? "h-4 w-4 text-background" : "h-4 w-4 text-purple-600"} />
            case "audio": return <Music className={isSelected ? "h-4 w-4 text-background" : "h-4 w-4 text-green-600"} />
            case "code": return <Code className={isSelected ? "h-4 w-4 text-background" : "h-4 w-4 text-yellow-600"} />
            default: return <File className={isSelected ? "h-4 w-4 text-background" : "h-4 w-4 text-foreground"} />
        }
    }

    const renderNode = (node: FileNode, level: number = 0) => {
        const isExpanded = expandedFolders.has(node.path)
        const isSelected = selectedFile === node.path

        if (node.type === "folder") {
            return (
                <div key={node.path}>
                    <div
                        className={cn(
                            "flex items-center gap-1.5 px-2 py-1.5 cursor-pointer hover:bg-muted font-mono text-xs rounded transition-colors",
                            level > 0 && "ml-4"
                        )}
                        style={{ paddingLeft: `${8 + level * 16}px` }}
                        onClick={() => toggleFolder(node.path)}
                    >
                        {isExpanded ? (
                            <ChevronDown className="h-3 w-3 text-foreground shrink-0" />
                        ) : (
                            <ChevronRight className="h-3 w-3 text-foreground shrink-0" />
                        )}
                        {isExpanded ? (
                            <FolderOpen className="h-4 w-4 text-foreground shrink-0" />
                        ) : (
                            <Folder className="h-4 w-4 text-foreground shrink-0" />
                        )}
                        <span className="text-foreground font-medium truncate" title={node.name}>
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
                        "flex items-center gap-1.5 px-2 py-1.5 cursor-pointer hover:bg-muted font-mono text-xs rounded transition-colors",
                        isSelected && "bg-foreground text-background hover:bg-foreground/90",
                        level > 0 && "ml-4"
                    )}
                    style={{ paddingLeft: `${8 + level * 16}px` }}
                    onClick={() => onSelectFile(node.path, "asset", node.data)}
                >
                    <div className="shrink-0">
                        {getFileIcon(node.fileType, isSelected)}
                    </div>
                    <span
                        className={cn(
                            "truncate font-medium",
                            isSelected ? "text-background font-bold" : "text-foreground"
                        )}
                        title={node.name}
                    >
                        {formatName(node.name, true)}
                    </span>
                </div>
            )
        }
    }

    return (
        <div className="w-64 border-r-2 border-border bg-background flex flex-col h-full font-mono">
            {/* Header */}
            <div className="px-4 py-3 border-b-2 border-border bg-muted/50">
                <h3 className="text-xs font-bold text-foreground tracking-wider">FILE EXPLORER</h3>
            </div>

            {/* Creation Buttons */}
            <div className="p-3 border-b-2 border-border flex gap-2 bg-background items-center">
                <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowNewFileDialog(true)}
                    className="flex-1 border-2 border-border hover:bg-foreground hover:text-background bg-background text-foreground font-mono text-xs font-bold transition-all shadow-[2px_2px_0px_0px_currentColor] hover:shadow-[1px_1px_0px_0px_currentColor]"
                    title="New File"
                >
                    <File className="h-3.5 w-3.5 mr-1.5" />
                    FILE
                </Button>
                <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowNewFolderDialog(true)}
                    className="flex-1 border-2 border-border hover:bg-foreground hover:text-background bg-background text-foreground font-mono text-xs font-bold transition-all shadow-[2px_2px_0px_0px_currentColor] hover:shadow-[1px_1px_0px_0px_currentColor]"
                    title="New Folder"
                >
                    <Folder className="h-3.5 w-3.5 mr-1.5" />
                    FOLDER
                </Button>

                {/* Settings Menu Button */}
                <div className="relative" ref={settingsMenuRef}>
                    <button
                        onClick={() => setShowSettingsMenu(!showSettingsMenu)}
                        className={cn(
                            "p-1.5 border-2 border-border rounded transition-all hover:bg-foreground hover:text-background",
                            showSettingsMenu ? "bg-foreground text-background" : "bg-background text-foreground"
                        )}
                        title="File Options"
                    >
                        <MoreVertical className="h-4 w-4" />
                    </button>

                    {/* Settings Dropdown Menu */}
                    {showSettingsMenu && (
                        <div className="absolute right-0 top-full mt-1 w-40 bg-background border-2 border-border shadow-[4px_4px_0px_0px_currentColor] z-50">
                            <button
                                onClick={openRenameDialog}
                                disabled={!selectedFile || !generatedFiles[selectedFile]}
                                className="w-full px-3 py-2 text-left text-xs text-foreground font-mono font-bold flex items-center gap-2 hover:bg-foreground hover:text-background disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-background disabled:hover:text-foreground"
                            >
                                <Pencil className="h-3 w-3" />
                                Rename
                            </button>
                            <button
                                onClick={handleDelete}
                                disabled={!selectedFile || !generatedFiles[selectedFile]}
                                className="w-full px-3 py-2 text-left text-xs text-foreground font-mono font-bold flex items-center gap-2 hover:bg-foreground hover:text-background disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-background disabled:hover:text-foreground"
                            >
                                <Trash2 className="h-3 w-3" />
                                Delete
                            </button>
                            <div className="border-t border-border" />
                            <button
                                onClick={handleCut}
                                disabled={!selectedFile || !generatedFiles[selectedFile]}
                                className="w-full px-3 py-2 text-left text-xs text-foreground font-mono font-bold flex items-center gap-2 hover:bg-foreground hover:text-background disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-background disabled:hover:text-foreground"
                            >
                                <Scissors className="h-3 w-3" />
                                Cut
                            </button>
                            <button
                                onClick={handleCopy}
                                disabled={!selectedFile || !generatedFiles[selectedFile]}
                                className="w-full px-3 py-2 text-left text-xs text-foreground font-mono font-bold flex items-center gap-2 hover:bg-foreground hover:text-background disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-background disabled:hover:text-foreground"
                            >
                                <ClipboardCopy className="h-3 w-3" />
                                Copy
                            </button>
                            <button
                                onClick={handlePaste}
                                disabled={!clipboard}
                                className="w-full px-3 py-2 text-left text-xs text-foreground font-mono font-bold flex items-center gap-2 hover:bg-foreground hover:text-background disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-background disabled:hover:text-foreground"
                            >
                                <Clipboard className="h-3 w-3" />
                                Paste
                                {clipboard && (
                                    <span className="ml-auto text-[10px] opacity-60">
                                        {clipboard.operation === "cut" ? "(cut)" : "(copy)"}
                                    </span>
                                )}
                            </button>
                        </div>
                    )}
                </div>
            </div>

            {/* File Tree with Drop Zone */}
            <div
                ref={dropZoneRef}
                className={cn(
                    "flex-1 overflow-y-auto py-2 bg-background relative transition-colors",
                    isDragOver && "bg-blue-50 dark:bg-blue-950"
                )}
                onDragEnter={handleDragEnter}
                onDragLeave={handleDragLeave}
                onDragOver={handleDragOver}
                onDrop={handleDrop}
            >
                {/* Drop Zone Overlay */}
                {isDragOver && (
                    <div className="absolute inset-0 z-10 flex items-center justify-center bg-blue-100/80 border-2 border-dashed border-blue-500 m-2 rounded-lg">
                        <div className="text-center">
                            <Upload className="h-8 w-8 mx-auto mb-2 text-blue-600" />
                            <p className="text-sm font-bold text-blue-700">Drop files here</p>
                            <p className="text-xs text-blue-600 mt-1">Files will be added to project</p>
                        </div>
                    </div>
                )}

                {/* Upload Progress */}
                {isUploading && uploadProgress && (
                    <div className="absolute top-2 left-2 right-2 z-20 bg-white border-2 border-black shadow-lg p-3 rounded">
                        <div className="flex items-center gap-2">
                            <div className="animate-spin h-4 w-4 border-2 border-black border-t-transparent rounded-full" />
                            <span className="text-xs font-mono font-bold text-black">
                                Uploading {uploadProgress.current}/{uploadProgress.total}...
                            </span>
                        </div>
                        <div className="mt-2 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                            <div
                                className="h-full bg-black transition-all duration-300"
                                style={{ width: `${(uploadProgress.current / uploadProgress.total) * 100}%` }}
                            />
                        </div>
                    </div>
                )}

                {fileTree.length === 0 ? (
                    <div className="px-4 py-8 text-center text-black/50 text-xs font-mono">
                        <Upload className="h-8 w-8 mx-auto mb-2 text-black/30" />
                        <p className="font-semibold">No files in project</p>
                        <p className="text-[10px] mt-1">Create files or drag & drop to get started</p>
                    </div>
                ) : (
                    <div className="px-2">
                        {fileTree.map((node) => renderNode(node))}
                    </div>
                )}
            </div>

            {/* Clipboard indicator */}
            {clipboard && (
                <div className="px-3 py-2 border-t-2 border-black bg-gray-50 flex items-center gap-2">
                    <Check className="h-3 w-3 text-green-600" />
                    <span className="text-[10px] font-mono text-black/70 truncate">
                        {clipboard.operation === "cut" ? "Cut: " : "Copied: "}
                        {clipboard.path.split('/').pop()}
                    </span>
                    <button
                        onClick={() => setClipboard(null)}
                        className="ml-auto p-0.5 hover:bg-black/10 rounded"
                    >
                        <X className="h-3 w-3 text-black/50" />
                    </button>
                </div>
            )}

            {/* New File Dialog */}
            {showNewFileDialog && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
                    <div className="w-full max-w-md bg-white border-2 border-black shadow-2xl font-mono">
                        <div className="border-b-2 border-black px-4 py-2 flex items-center justify-between bg-gray-50">
                            <span className="text-black font-mono text-sm font-bold">NEW FILE</span>
                            <button
                                onClick={() => {
                                    setShowNewFileDialog(false)
                                    setNewFileName("")
                                    setNewFileContent("")
                                }}
                                className="text-black hover:bg-black/10 p-1 rounded transition-colors"
                            >
                                <X className="h-4 w-4" />
                            </button>
                        </div>
                        <div className="p-4 space-y-4">
                            <div>
                                <label className="block text-xs font-medium text-black mb-1 font-mono">
                                    $ file_name:
                                </label>
                                <input
                                    type="text"
                                    value={newFileName}
                                    onChange={(e) => setNewFileName(e.target.value)}
                                    placeholder="example.js"
                                    className="w-full border-2 border-black px-3 py-2 bg-white text-black placeholder:text-black/40 focus:outline-none focus:ring-1 focus:ring-black font-mono text-sm"
                                    autoFocus
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter' && newFileName.trim()) {
                                            handleCreateFile()
                                        } else if (e.key === 'Escape') {
                                            setShowNewFileDialog(false)
                                            setNewFileName("")
                                            setNewFileContent("")
                                        }
                                    }}
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-black mb-1 font-mono">
                                    $ content (optional):
                                </label>
                                <textarea
                                    value={newFileContent}
                                    onChange={(e) => setNewFileContent(e.target.value)}
                                    placeholder="// File content..."
                                    rows={6}
                                    className="w-full border-2 border-black px-3 py-2 bg-white text-black placeholder:text-black/40 focus:outline-none focus:ring-1 focus:ring-black font-mono text-sm resize-none"
                                    onKeyDown={(e) => {
                                        if (e.key === 'Escape') {
                                            setShowNewFileDialog(false)
                                            setNewFileName("")
                                            setNewFileContent("")
                                        }
                                    }}
                                />
                            </div>
                            <div className="flex gap-2">
                                <Button
                                    onClick={handleCreateFile}
                                    disabled={!newFileName.trim()}
                                    className="flex-1 bg-black text-white hover:bg-gray-800 font-mono text-xs font-bold border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:shadow-[1px_1px_0px_0px_rgba(0,0,0,1)] transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none"
                                >
                                    $ create
                                </Button>
                                <Button
                                    variant="outline"
                                    onClick={() => {
                                        setShowNewFileDialog(false)
                                        setNewFileName("")
                                        setNewFileContent("")
                                    }}
                                    className="flex-1 border-2 border-black bg-white text-black hover:bg-black/10 font-mono text-xs font-bold shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:shadow-[1px_1px_0px_0px_rgba(0,0,0,1)] transition-all"
                                >
                                    $ cancel
                                </Button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* New Folder Dialog */}
            {showNewFolderDialog && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
                    <div className="w-full max-w-md bg-white border-2 border-black shadow-2xl font-mono">
                        <div className="border-b-2 border-black px-4 py-2 flex items-center justify-between bg-gray-50">
                            <span className="text-black font-mono text-sm font-bold">NEW FOLDER</span>
                            <button
                                onClick={() => {
                                    setShowNewFolderDialog(false)
                                    setNewFolderName("")
                                }}
                                className="text-black hover:bg-black/10 p-1 rounded transition-colors"
                            >
                                <X className="h-4 w-4" />
                            </button>
                        </div>
                        <div className="p-4 space-y-4">
                            <div>
                                <label className="block text-xs font-medium text-black mb-1 font-mono">
                                    $ folder_name:
                                </label>
                                <input
                                    type="text"
                                    value={newFolderName}
                                    onChange={(e) => setNewFolderName(e.target.value)}
                                    placeholder="my-folder"
                                    className="w-full border-2 border-black px-3 py-2 bg-white text-black placeholder:text-black/40 focus:outline-none focus:ring-1 focus:ring-black font-mono text-sm"
                                    autoFocus
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter' && newFolderName.trim()) {
                                            handleCreateFolder()
                                        } else if (e.key === 'Escape') {
                                            setShowNewFolderDialog(false)
                                            setNewFolderName("")
                                        }
                                    }}
                                />
                            </div>
                            <div className="flex gap-2">
                                <Button
                                    onClick={handleCreateFolder}
                                    disabled={!newFolderName.trim()}
                                    className="flex-1 bg-black text-white hover:bg-gray-800 font-mono text-xs font-bold border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:shadow-[1px_1px_0px_0px_rgba(0,0,0,1)] transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none"
                                >
                                    $ create
                                </Button>
                                <Button
                                    variant="outline"
                                    onClick={() => {
                                        setShowNewFolderDialog(false)
                                        setNewFolderName("")
                                    }}
                                    className="flex-1 border-2 border-black bg-white text-black hover:bg-black/10 font-mono text-xs font-bold shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:shadow-[1px_1px_0px_0px_rgba(0,0,0,1)] transition-all"
                                >
                                    $ cancel
                                </Button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Rename Dialog */}
            {showRenameDialog && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
                    <div className="w-full max-w-md bg-white border-2 border-black shadow-2xl font-mono">
                        <div className="border-b-2 border-black px-4 py-2 flex items-center justify-between bg-gray-50">
                            <span className="text-black font-mono text-sm font-bold">RENAME FILE</span>
                            <button
                                onClick={() => {
                                    setShowRenameDialog(false)
                                    setRenameValue("")
                                }}
                                className="text-black hover:bg-black/10 p-1 rounded transition-colors"
                            >
                                <X className="h-4 w-4" />
                            </button>
                        </div>
                        <div className="p-4 space-y-4">
                            <div>
                                <label className="block text-xs font-medium text-black mb-1 font-mono">
                                    $ new_name:
                                </label>
                                <input
                                    type="text"
                                    value={renameValue}
                                    onChange={(e) => setRenameValue(e.target.value)}
                                    placeholder="new-name.js"
                                    className="w-full border-2 border-black px-3 py-2 bg-white text-black placeholder:text-black/40 focus:outline-none focus:ring-1 focus:ring-black font-mono text-sm"
                                    autoFocus
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter' && renameValue.trim()) {
                                            handleRename()
                                        } else if (e.key === 'Escape') {
                                            setShowRenameDialog(false)
                                            setRenameValue("")
                                        }
                                    }}
                                />
                            </div>
                            <div className="flex gap-2">
                                <Button
                                    onClick={handleRename}
                                    disabled={!renameValue.trim()}
                                    className="flex-1 bg-black text-white hover:bg-gray-800 font-mono text-xs font-bold border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:shadow-[1px_1px_0px_0px_rgba(0,0,0,1)] transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none"
                                >
                                    $ rename
                                </Button>
                                <Button
                                    variant="outline"
                                    onClick={() => {
                                        setShowRenameDialog(false)
                                        setRenameValue("")
                                    }}
                                    className="flex-1 border-2 border-black bg-white text-black hover:bg-black/10 font-mono text-xs font-bold shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:shadow-[1px_1px_0px_0px_rgba(0,0,0,1)] transition-all"
                                >
                                    $ cancel
                                </Button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
