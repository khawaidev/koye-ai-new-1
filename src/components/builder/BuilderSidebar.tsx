import { Box, Check, ChevronDown, ChevronRight, Clipboard, ClipboardCopy, Code, File, Folder, FolderOpen, Image as ImageIcon, MoreVertical, Music, Pencil, Scissors, Trash2, Upload, Video, X } from "lucide-react"
import { useEffect, useRef, useState } from "react"
import { cn } from "../../lib/utils"
import { deleteProjectFile, saveSingleProjectFile } from "../../services/projectFiles"
import { useAppStore } from "../../store/useAppStore"
import { isSettingsFile } from "../../utils/projectSettings"
import { buildFileTree, type FileNode } from "../sidebar/FileSystemSidebar"
import { Button } from "../ui/button"
import type { UploadOverlayState } from "../../pages/Builder"

interface BuilderSidebarProps {
    selectedFile: string | null
    onSelectFile: (path: string, type: "file" | "asset", data?: any) => void
    onFileCreated?: () => void
    projectId?: string
    userId?: string
    onFileSynced?: (path: string, content: string | null) => void
    onUploadStateChange?: (state: UploadOverlayState | null) => void
}

export function BuilderSidebar({ selectedFile, onSelectFile, onFileCreated, projectId, userId, onFileSynced, onUploadStateChange }: BuilderSidebarProps) {
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
    const dropZoneRef = useRef<HTMLDivElement>(null)
    const fileInputRef = useRef<HTMLInputElement>(null)

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
        // Treat everything as binary EXCEPT explicitly text/code files
        // This prevents corruption of unknown binary files (like .pdf, .zip)
        return fileType !== 'code'
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
    // Handle file drop
    const handleDrop = async (e: React.DragEvent) => {
        e.preventDefault()
        e.stopPropagation()
        setIsDragOver(false)

        const files = Array.from(e.dataTransfer.files)
        await handleFiles(files)
    }

    const handleFileInput = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files) {
            const files = Array.from(e.target.files)
            await handleFiles(files)
            e.target.value = ''
        }
    }

    const handleFiles = async (files: File[]) => {
        if (files.length === 0) return

        if (!projectId || !userId) {
            alert('Project not ready. Please wait and try again.')
            return
        }

        // User uploads ALWAYS go to 'uploads/' folder
        const basePath = 'uploads'

        // Initialize upload state for the overlay in Builder.tsx
        const fileStatuses: Array<{ name: string; status: 'pending' | 'reading' | 'uploading' | 'success' | 'failed' }> = files.map(f => ({ name: f.name, status: 'pending' as const }))
        onUploadStateChange?.({ isUploading: true, files: [...fileStatuses] })

        const successfulPaths: string[] = []

        // Ensure the uploads folder is expanded in the sidebar
        setExpandedFolders(prev => new Set([...prev, 'uploads']))

        // Start reading all files into memory concurrently (parallel) for speed
        const readFiles = await Promise.all(files.map(async (file, idx) => {
            if (file.size > 30 * 1024 * 1024) {
                fileStatuses[idx] = { name: file.name, status: 'failed' };
                return { file, content: null, error: 'exceeds 30MB limit' };
            }

            fileStatuses[idx] = { name: file.name, status: 'reading' };
            onUploadStateChange?.({ isUploading: true, files: [...fileStatuses] });

            try {
                let content: string;
                if (isBinaryFile(file.name)) {
                    content = await new Promise<string>((resolve, reject) => {
                        const reader = new FileReader();
                        reader.onload = () => resolve(reader.result as string);
                        reader.onerror = reject;
                        reader.readAsDataURL(file);
                    });
                } else {
                    content = await new Promise<string>((resolve, reject) => {
                        const reader = new FileReader();
                        reader.onload = () => resolve(reader.result as string);
                        reader.onerror = reject;
                        reader.readAsText(file);
                    });
                }
                return { file, content, error: null };
            } catch (err) {
                return { file, content: null, error: 'failed to read' };
            }
        }));

        onUploadStateChange?.({ isUploading: true, files: [...fileStatuses] });

        try {
            // Sequential upload queue ("next by next" as requested)
            for (let i = 0; i < readFiles.length; i++) {
                const { file, content, error } = readFiles[i];

                if (error) {
                    fileStatuses[i] = { name: file.name, status: 'failed' };
                    onUploadStateChange?.({ isUploading: true, files: [...fileStatuses] });
                    if (error === 'exceeds 30MB limit') alert(`File ${file.name} exceeds 30MB limit.`);
                    continue;
                }

                if (!content) continue;

                // Determine final path
                const targetName = file.name;
                let finalPath = `${basePath}/${targetName}`;
                let counter = 1;
                const baseName = targetName.includes('.') ? targetName.substring(0, targetName.lastIndexOf('.')) : targetName;
                const ext = targetName.includes('.') ? targetName.substring(targetName.lastIndexOf('.')) : '';

                while ((generatedFiles || {})[finalPath]) {
                    finalPath = `${basePath}/${baseName}_${counter}${ext}`;
                    counter++;
                }

                // Update status: uploading
                fileStatuses[i] = { name: finalPath, status: 'uploading' };
                onUploadStateChange?.({ isUploading: true, files: [...fileStatuses] });

                try {
                    await saveSingleProjectFile(projectId, userId, '', finalPath, content, _githubConnection);

                    // Success — add to local state & mark as synced
                    addGeneratedFile(finalPath, content);
                    onFileSynced?.(finalPath, content);
                    successfulPaths.push(finalPath);

                    fileStatuses[i] = { name: finalPath, status: 'success' };
                } catch (err) {
                    addGeneratedFile(finalPath, content); // Fallback: add locally
                    fileStatuses[i] = { name: finalPath, status: 'failed' };
                }

                onUploadStateChange?.({ isUploading: true, files: [...fileStatuses] });
            }

            // Auto-select the first successfully uploaded file in the viewer
            if (successfulPaths.length > 0) {
                onSelectFile(successfulPaths[0], 'asset')
            }

            onFileCreated?.()
        } catch (error) {
            console.error('Error uploading files:', error)
        } finally {
            // Keep the overlay visible briefly to show results
            await new Promise(resolve => setTimeout(resolve, 1500))
            onUploadStateChange?.(null)
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

        const content = newFileContent || ''
        addGeneratedFile(filePath, content)

        if (basePath) {
            setExpandedFolders(prev => new Set([...prev, basePath]))
        }

        // Persist to backend immediately (fire-and-forget)
        if (projectId && userId) {
            saveSingleProjectFile(projectId, userId, '', filePath, content, _githubConnection)
                .then(() => {
                    onFileSynced?.(filePath, content)
                    console.log(`✓ Created file persisted: ${filePath}`)
                })
                .catch(e => console.warn(`Failed to persist new file ${filePath}:`, e))
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

        // Persist folder marker to backend immediately
        if (projectId && userId) {
            saveSingleProjectFile(projectId, userId, '', indexFilePath, '', _githubConnection)
                .then(() => {
                    onFileSynced?.(indexFilePath, '')
                    console.log(`✓ Created folder persisted: ${folderPath}`)
                })
                .catch(e => console.warn(`Failed to persist new folder ${folderPath}:`, e))
        }

        setNewFolderName("")
        setShowNewFolderDialog(false)
        onFileCreated?.()
    }

    // File operations
    const handleRename = async () => {
        if (!selectedFile || !renameValue.trim()) return

        // Don't allow renaming settings file
        if (isSettingsFile(selectedFile)) return

        // Check if selected item is a folder
        const isFolder = !generatedFiles[selectedFile] && Object.keys(generatedFiles).some(p => p.startsWith(selectedFile + '/'))

        if (isFolder) {
            // Rename folder: move all children under new prefix
            const lastSlash = selectedFile.lastIndexOf('/')
            const parentDir = lastSlash > 0 ? selectedFile.substring(0, lastSlash) : ''
            const newFolderPath = parentDir ? `${parentDir}/${renameValue.trim()}` : renameValue.trim()

            const updatedFiles = { ...generatedFiles }
            const prefix = selectedFile + '/'

            for (const oldPath of Object.keys(updatedFiles)) {
                if (oldPath.startsWith(prefix)) {
                    const newPath = newFolderPath + '/' + oldPath.substring(prefix.length)
                    const content = updatedFiles[oldPath]
                    delete updatedFiles[oldPath]
                    updatedFiles[newPath] = content

                    if (projectId && userId) {
                        deleteProjectFile(projectId, userId, oldPath, _githubConnection).catch(() => {})
                        saveSingleProjectFile(projectId, userId, '', newPath, content, _githubConnection)
                            .then(() => onFileSynced?.(newPath, content))
                            .catch(() => {})
                        onFileSynced?.(oldPath, null)
                    }
                }
            }

            setGeneratedFiles(updatedFiles)
            onSelectFile(newFolderPath, "file")
        } else {
            // Rename single file
            const content = generatedFiles[selectedFile]
            if (content === undefined) return

            const lastSlashIndex = selectedFile.lastIndexOf('/')
            const dirPath = lastSlashIndex > 0 ? selectedFile.substring(0, lastSlashIndex) : ''
            const newPath = dirPath ? `${dirPath}/${renameValue.trim()}` : renameValue.trim()

            if (generatedFiles[newPath] !== undefined) {
                alert(`A file with name "${renameValue.trim()}" already exists!`)
                return
            }

            // Update local state: remove old, add new
            const updatedFiles = { ...generatedFiles }
            delete updatedFiles[selectedFile]
            updatedFiles[newPath] = content
            setGeneratedFiles(updatedFiles)

            onSelectFile(newPath, "asset", { path: newPath, content, type: 'code' })

            // Persist rename to backend
            if (projectId && userId) {
                deleteProjectFile(projectId, userId, selectedFile, _githubConnection)
                    .then(() => onFileSynced?.(selectedFile, null))
                    .catch(() => {})
                saveSingleProjectFile(projectId, userId, '', newPath, content, _githubConnection)
                    .then(() => onFileSynced?.(newPath, content))
                    .catch(e => console.warn('Failed to persist renamed file:', e))
            }
        }

        setShowRenameDialog(false)
        setRenameValue("")
        onFileCreated?.()
    }

    const handleDelete = async () => {
        if (!selectedFile) return

        // Don't allow deleting settings file
        if (isSettingsFile(selectedFile)) return

        // Check if selected item is a folder
        const isFolder = !generatedFiles[selectedFile] && Object.keys(generatedFiles).some(p => p.startsWith(selectedFile + '/'))
        const label = isFolder ? `folder "${selectedFile}" and all its contents` : `"${selectedFile}"`

        if (!confirm(`Are you sure you want to delete ${label}?`)) return

        const updatedFiles = { ...generatedFiles }

        if (isFolder) {
            // Delete all files under this folder
            const prefix = selectedFile + '/'
            for (const path of Object.keys(updatedFiles)) {
                if (path.startsWith(prefix)) {
                    delete updatedFiles[path]
                    // Backend delete (fire-and-forget)
                    if (projectId && userId) {
                        deleteProjectFile(projectId, userId, path, _githubConnection)
                            .then(() => console.log(`Background delete completed: ${path}`))
                            .catch(e => console.warn(`Background delete failed for ${path}:`, e))
                        onFileSynced?.(path, null)
                    }
                }
            }
        } else {
            // Delete single file
            delete updatedFiles[selectedFile]
            if (projectId && userId) {
                deleteProjectFile(projectId, userId, selectedFile, _githubConnection)
                    .then(() => console.log(`Background delete completed: ${selectedFile}`))
                    .catch(e => console.warn(`Background delete failed for ${selectedFile}:`, e))
                onFileSynced?.(selectedFile, null)
            }
        }

        setGeneratedFiles(updatedFiles)

        // Clear selection immediately
        onSelectFile("", "file")
        setShowSettingsMenu(false)
        onFileCreated?.()
    }

    const handleCopy = () => {
        if (!selectedFile) return

        // Check if it's a folder
        const isFolder = !generatedFiles[selectedFile] && Object.keys(generatedFiles).some(p => p.startsWith(selectedFile + '/'))

        if (isFolder) {
            // Collect all files under this folder
            const prefix = selectedFile + '/'
            const folderContent = JSON.stringify(
                Object.entries(generatedFiles)
                    .filter(([p]) => p.startsWith(prefix))
                    .map(([p, c]) => ({ relativePath: p.substring(prefix.length), content: c }))
            )
            setClipboard({ path: selectedFile, content: folderContent, operation: "copy" })
        } else {
            const content = generatedFiles[selectedFile]
            if (content === undefined) return
            setClipboard({ path: selectedFile, content, operation: "copy" })
        }
        setShowSettingsMenu(false)
    }

    const handleCut = () => {
        if (!selectedFile) return

        // Check if it's a folder
        const isFolder = !generatedFiles[selectedFile] && Object.keys(generatedFiles).some(p => p.startsWith(selectedFile + '/'))

        if (isFolder) {
            const prefix = selectedFile + '/'
            const folderContent = JSON.stringify(
                Object.entries(generatedFiles)
                    .filter(([p]) => p.startsWith(prefix))
                    .map(([p, c]) => ({ relativePath: p.substring(prefix.length), content: c }))
            )
            setClipboard({ path: selectedFile, content: folderContent, operation: "cut" })
        } else {
            const content = generatedFiles[selectedFile]
            if (content === undefined) return
            setClipboard({ path: selectedFile, content, operation: "cut" })
        }
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

        // Check if clipboard contains a folder (JSON array of files)
        let isFolderPaste = false
        let folderFiles: Array<{relativePath: string, content: string}> = []
        try {
            const parsed = JSON.parse(clipboard.content)
            if (Array.isArray(parsed) && parsed.length > 0 && parsed[0].relativePath !== undefined) {
                isFolderPaste = true
                folderFiles = parsed
            }
        } catch { /* not JSON, it's a single file */ }

        const updatedFiles = { ...generatedFiles }

        if (isFolderPaste) {
            const folderName = clipboard.path.split('/').pop() || 'folder'
            let newFolderPath = destFolder ? `${destFolder}/${folderName}` : folderName
            // Avoid conflicts
            let counter = 1
            while (Object.keys(updatedFiles).some(p => p.startsWith(newFolderPath + '/'))) {
                newFolderPath = destFolder
                    ? `${destFolder}/${folderName}_copy${counter}`
                    : `${folderName}_copy${counter}`
                counter++
            }
            for (const { relativePath, content } of folderFiles) {
                const newPath = `${newFolderPath}/${relativePath}`
                updatedFiles[newPath] = content
                if (projectId && userId) {
                    saveSingleProjectFile(projectId, userId, '', newPath, content, _githubConnection)
                        .then(() => onFileSynced?.(newPath, content))
                        .catch(() => {})
                }
            }
            // If cut, delete originals
            if (clipboard.operation === "cut") {
                const prefix = clipboard.path + '/'
                for (const p of Object.keys(updatedFiles)) {
                    if (p.startsWith(prefix) && !p.startsWith(newFolderPath + '/')) {
                        delete updatedFiles[p]
                        if (projectId && userId) {
                            deleteProjectFile(projectId, userId, p, _githubConnection).catch(() => {})
                            onFileSynced?.(p, null)
                        }
                    }
                }
                setClipboard(null)
            }
        } else {
            // Single file paste
            const fileName = clipboard.path.split('/').pop() || 'pasted_file'
            let newPath = destFolder ? `${destFolder}/${fileName}` : fileName

            // Handle name conflicts
            let counter = 1
            const baseName = fileName.includes('.') ? fileName.substring(0, fileName.lastIndexOf('.')) : fileName
            const ext = fileName.includes('.') ? fileName.substring(fileName.lastIndexOf('.')) : ''
            while (updatedFiles[newPath] !== undefined) {
                newPath = destFolder
                    ? `${destFolder}/${baseName}_copy${counter}${ext}`
                    : `${baseName}_copy${counter}${ext}`
                counter++
            }

            updatedFiles[newPath] = clipboard.content

            // Persist pasted file immediately
            if (projectId && userId) {
                saveSingleProjectFile(projectId, userId, '', newPath, clipboard.content, _githubConnection)
                    .then(() => onFileSynced?.(newPath, clipboard.content))
                    .catch(e => console.warn('Failed to persist pasted file:', e))
            }

            // If it was a cut operation, delete the original
            if (clipboard.operation === "cut") {
                delete updatedFiles[clipboard.path]
                if (projectId && userId) {
                    deleteProjectFile(projectId, userId, clipboard.path, _githubConnection).catch(() => {})
                    onFileSynced?.(clipboard.path, null)
                }
                setClipboard(null)
            }
        }

        setGeneratedFiles(updatedFiles)
        setShowSettingsMenu(false)
        onFileCreated?.()
    }

    const openRenameDialog = () => {
        if (!selectedFile) return
        // For folders, get just the folder name
        const name = selectedFile.split('/').pop() || ''
        setRenameValue(name)
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
                            isSelected && "bg-foreground text-background hover:bg-foreground/90",
                            level > 0 && "ml-4"
                        )}
                        style={{ paddingLeft: `${8 + level * 16}px` }}
                        onClick={() => {
                            toggleFolder(node.path)
                            onSelectFile(node.path, "file")
                        }}
                    >
                        {isExpanded ? (
                            <ChevronDown className={cn("h-3 w-3 shrink-0", isSelected ? "text-background" : "text-foreground")} />
                        ) : (
                            <ChevronRight className={cn("h-3 w-3 shrink-0", isSelected ? "text-background" : "text-foreground")} />
                        )}
                        {isExpanded ? (
                            <FolderOpen className={cn("h-4 w-4 shrink-0", isSelected ? "text-background" : "text-foreground")} />
                        ) : (
                            <Folder className={cn("h-4 w-4 shrink-0", isSelected ? "text-background" : "text-foreground")} />
                        )}
                        <span className={cn("font-medium truncate", isSelected ? "text-background font-bold" : "text-foreground")} title={node.name}>
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
        <div className="w-64 border-r border-white/10 bg-background flex flex-col h-full font-mono">


            {/* Creation Buttons */}
            <div className="p-3 border-b border-white/10 flex gap-1.5 bg-background items-center">
                <input 
                    type="file" 
                    multiple 
                    className="hidden" 
                    ref={fileInputRef} 
                    onChange={handleFileInput} 
                />
                <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowNewFileDialog(true)}
                    className="flex-1 px-1 border border-white/10 hover:bg-foreground hover:text-background bg-background text-foreground font-mono text-[10px] font-bold transition-all shadow-sm"
                    title="New File"
                >
                    <File className="h-3 w-3 mr-1" />
                    FILE
                </Button>
                <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowNewFolderDialog(true)}
                    className="flex-1 px-1 border border-white/10 hover:bg-foreground hover:text-background bg-background text-foreground font-mono text-[10px] font-bold transition-all shadow-sm"
                    title="New Folder"
                >
                    <Folder className="h-3 w-3 mr-1" />
                    FOLDER
                </Button>
                <Button
                    variant="outline"
                    size="sm"
                    onClick={() => fileInputRef.current?.click()}
                    className="flex-1 px-1 border border-white/10 hover:bg-foreground hover:text-background bg-background text-foreground font-mono text-[10px] font-bold transition-all shadow-sm"
                    title="Upload File"
                >
                    <Upload className="h-3 w-3 mr-1" />
                    UPLOAD
                </Button>

                {/* Settings Menu Button */}
                <div className="relative" ref={settingsMenuRef}>
                    <button
                        onClick={() => setShowSettingsMenu(!showSettingsMenu)}
                        className={cn(
                            "p-1.5 border border-white/10 rounded transition-all hover:bg-foreground hover:text-background",
                            showSettingsMenu ? "bg-foreground text-background" : "bg-background text-foreground"
                        )}
                        title="File Options"
                    >
                        <MoreVertical className="h-4 w-4" />
                    </button>

                    {/* Settings Dropdown Menu */}
                    {showSettingsMenu && (() => {
                        // A selected item is valid if it's a file OR a folder (has children)
                        const isValidSelection = selectedFile && (
                            generatedFiles[selectedFile] !== undefined ||
                            Object.keys(generatedFiles).some(p => p.startsWith(selectedFile + '/'))
                        )
                        return (
                        <div className="absolute right-0 top-full mt-1 w-40 bg-background border-2 border-border shadow-[4px_4px_0px_0px_currentColor] z-50">
                            <button
                                onClick={openRenameDialog}
                                disabled={!isValidSelection}
                                className="w-full px-3 py-2 text-left text-xs text-foreground font-mono font-bold flex items-center gap-2 hover:bg-foreground hover:text-background disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-background disabled:hover:text-foreground"
                            >
                                <Pencil className="h-3 w-3" />
                                Rename
                            </button>
                            <button
                                onClick={handleDelete}
                                disabled={!isValidSelection}
                                className="w-full px-3 py-2 text-left text-xs text-foreground font-mono font-bold flex items-center gap-2 hover:bg-foreground hover:text-background disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-background disabled:hover:text-foreground"
                            >
                                <Trash2 className="h-3 w-3" />
                                Delete
                            </button>
                            <div className="border-t border-border" />
                            <button
                                onClick={handleCut}
                                disabled={!isValidSelection}
                                className="w-full px-3 py-2 text-left text-xs text-foreground font-mono font-bold flex items-center gap-2 hover:bg-foreground hover:text-background disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-background disabled:hover:text-foreground"
                            >
                                <Scissors className="h-3 w-3" />
                                Cut
                            </button>
                            <button
                                onClick={handleCopy}
                                disabled={!isValidSelection}
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
                        )
                    })()}
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

                {/* Upload progress is now shown in the Builder viewer overlay */}

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
