import { AnimatePresence, motion } from "framer-motion"
import { Box, Check, Cpu, Edit3, Film, Image, Music, X, Zap } from "lucide-react"
import { useEffect, useRef, useState } from "react"
import { useAppStore } from "../../store/useAppStore"
import { getTaskCreditCost, getTaskDisplayName, getTaskEstimatedTime, useTaskStore, type TaskConfig, type TaskType } from "../../store/useTaskStore"

interface TaskProposalCardProps {
    type: TaskType
    config: TaskConfig
    onApprove: (type: TaskType, config: TaskConfig) => void
    onCancel: () => void
}

function getTaskIcon(type: TaskType) {
    switch (type) {
        case "image-generation":
        case "sprite-generation":
            return <Image className="h-5 w-5" />
        case "3d-model":
            return <Box className="h-5 w-5" />
        case "video-generation":
            return <Film className="h-5 w-5" />
        case "audio-generation":
            return <Music className="h-5 w-5" />
        case "auto-rigging":
        case "animation-generation":
            return <Cpu className="h-5 w-5" />
        default:
            return <Zap className="h-5 w-5" />
    }
}

function getEditableFields(type: TaskType, config: TaskConfig) {
    switch (type) {
        case "image-generation":
            return [
                { key: "imageCount", label: "Number of Images", type: "select", options: [1, 2, 3, 4], value: config.imageCount || 4 },
                { key: "imageResolution", label: "Resolution", type: "select", options: ["512", "768", "1024"], value: config.imageResolution || "1024" },
            ]
        case "3d-model":
            return [
                { key: "sourceImage", label: "Source Image", type: "text", value: config.sourceImage || "" },
                { key: "modelResolution", label: "Resolution", type: "select", options: ["512", "1024", "2048"], value: config.modelResolution || "1024" },
                { key: "includeTexture", label: "Include Texture", type: "toggle", value: config.includeTexture !== false },
            ]
        case "video-generation":
            return [
                { key: "sourceImage", label: "Source Image", type: "text", value: config.sourceImage || "" },
                { key: "videoPrompt", label: "Prompt", type: "text", value: config.videoPrompt || "" },
            ]
        case "audio-generation":
            return [
                { key: "audioPrompt", label: "Prompt", type: "text", value: config.audioPrompt || "" },
                { key: "audioType", label: "Type", type: "select", options: ["sfx", "voice", "environment"], value: config.audioType || "sfx" },
            ]
        default:
            return []
    }
}

// Custom autocomplete input for @ mentions
function AutocompleteInput({ value, onChange, placeholder }: { value: string, onChange: (val: string) => void, placeholder?: string }) {
    const [isOpen, setIsOpen] = useState(false)
    const [search, setSearch] = useState("")
    const [activeIndex, setActiveIndex] = useState(0)
    const inputRef = useRef<HTMLInputElement>(null)
    const dropdownRef = useRef<HTMLDivElement>(null)

    const generatedFiles = useAppStore(state => state.generatedFiles) || {}
    const filePaths = Object.keys(generatedFiles).filter(path => !path.endsWith('/'))

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (!isOpen) {
            // Check if user is typing '@' or already typed it
            if (e.key === '@') {
                setIsOpen(true)
                setSearch("")
            }
            return
        }

        const filtered = filePaths.filter(p => p.toLowerCase().includes(search.toLowerCase()))

        if (e.key === 'ArrowDown') {
            e.preventDefault()
            setActiveIndex(prev => (prev < filtered.length - 1 ? prev + 1 : prev))
        } else if (e.key === 'ArrowUp') {
            e.preventDefault()
            setActiveIndex(prev => (prev > 0 ? prev - 1 : prev))
        } else if (e.key === 'Enter') {
            e.preventDefault()
            if (filtered[activeIndex]) {
                selectFile(filtered[activeIndex])
            }
        } else if (e.key === 'Escape') {
            setIsOpen(false)
        }
    }

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const val = e.target.value
        onChange(val)

        // Trigger autocomplete if we see @
        const atIndex = val.lastIndexOf('@')
        if (atIndex !== -1) {
            setIsOpen(true)
            setSearch(val.substring(atIndex + 1))
            setActiveIndex(0)
        } else {
            setIsOpen(false)
        }
    }

    const selectFile = (path: string) => {
        const atIndex = value.lastIndexOf('@')
        if (atIndex !== -1) {
            // Replace the @search with the full path
            const newVal = value.substring(0, atIndex) + path
            onChange(newVal)
        } else {
            onChange(path)
        }
        setIsOpen(false)
        inputRef.current?.focus()
    }

    // Close on click outside
    useEffect(() => {
        const handleClick = (e: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node) &&
                inputRef.current !== e.target) {
                setIsOpen(false)
            }
        }
        document.addEventListener('mousedown', handleClick)
        return () => document.removeEventListener('mousedown', handleClick)
    }, [])

    const filteredFiles = filePaths.filter(p => p.toLowerCase().includes(search.toLowerCase()))

    return (
        <div className="relative w-full">
            <input
                ref={inputRef}
                type="text"
                value={value}
                onChange={handleChange}
                onKeyDown={handleKeyDown}
                placeholder={placeholder}
                className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-foreground/30"
            />

            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        ref={dropdownRef}
                        initial={{ opacity: 0, y: -5 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -5 }}
                        className="absolute z-50 left-0 right-0 mt-1 max-h-48 overflow-y-auto bg-background/95 backdrop-blur-md border border-border rounded-lg shadow-xl"
                    >
                        {filteredFiles.length > 0 ? (
                            <div className="py-1">
                                {filteredFiles.map((path, i) => (
                                    <button
                                        key={path}
                                        onClick={() => selectFile(path)}
                                        className={`w-full text-left px-3 py-2 text-xs truncate ${i === activeIndex ? 'bg-muted text-foreground' : 'text-foreground hover:bg-muted'}`}
                                        onMouseEnter={() => setActiveIndex(i)}
                                    >
                                        📄 {path}
                                    </button>
                                ))}
                            </div>
                        ) : (
                            <div className="p-3 text-xs text-muted-foreground text-center">No files found matching "{search}"</div>
                        )}
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    )
}

export function TaskProposalCard({ type, config, onApprove, onCancel }: TaskProposalCardProps) {
    const { updateProposalConfig } = useTaskStore()
    const [isEditing, setIsEditing] = useState(false)
    const [localConfig, setLocalConfig] = useState<TaskConfig>({ ...config })

    const displayName = getTaskDisplayName(type)
    const icon = getTaskIcon(type)
    // Recalculate credit cost on the fly for the preview
    const creditCost = getTaskCreditCost(type, localConfig)
    const estimatedTime = getTaskEstimatedTime(type)
    const editableFields = getEditableFields(type, localConfig)

    const handleFieldChange = (key: string, value: any) => {
        const updated = { ...localConfig, [key]: value }
        setLocalConfig(updated)
        // Store updates globally too
        updateProposalConfig({ [key]: value })
    }

    const handleApprove = () => {
        // We pass the localConfig which includes all real-time edits
        onApprove(type, localConfig)
    }

    // Build detail rows
    const detailRows: { label: string; value: string }[] = []

    if (type === "image-generation") {
        detailRows.push({ label: "Images", value: `${localConfig.imageCount || 4}` })
        detailRows.push({ label: "Resolution", value: localConfig.imageResolution || "1024" })
    } else if (type === "3d-model") {
        if (localConfig.sourceImage) {
            const shortName = localConfig.sourceImage.split('/').pop() || localConfig.sourceImage
            detailRows.push({ label: "Source", value: shortName })
        }
        detailRows.push({ label: "Res", value: localConfig.modelResolution || "1024" })
        detailRows.push({ label: "Texture", value: localConfig.includeTexture !== false ? "Yes" : "No" })
    } else if (type === "video-generation") {
        if (localConfig.videoPrompt) {
            detailRows.push({ label: "Prompt", value: localConfig.videoPrompt.slice(0, 20) + "..." })
        }
    } else if (type === "audio-generation") {
        detailRows.push({ label: "Type", value: localConfig.audioType || "sfx" })
    }

    // Add cost as a primary stat
    detailRows.push({ label: "Cost", value: `${creditCost} ⚡` })

    return (
        <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.98 }}
            transition={{ duration: 0.25, ease: "easeOut" }}
            className="w-full max-w-full my-4"
        >
            <div className="bg-background hover:bg-muted/10 transition-colors border border-border shadow-sm rounded-xl overflow-hidden flex flex-col md:flex-row items-stretch group relative before:absolute before:inset-0 before:bg-gradient-to-r before:from-foreground/[0.03] before:to-foreground/[0.03] before:opacity-0 hover:before:opacity-100 before:transition-opacity before:pointer-events-none">

                {/* Left side: Icon & Title */}
                <div className="px-4 py-3 border-b md:border-b-0 md:border-r border-border/50 flex md:flex-col items-center justify-between md:justify-center gap-3 w-full md:w-36 shrink-0 bg-muted/20">
                    <div className="flex items-center gap-2 md:flex-col md:text-center">
                        <div className="flex items-center justify-center h-8 w-8 rounded-lg bg-foreground text-background shadow-sm">
                            {icon}
                        </div>
                        <h3 className="text-sm font-bold text-foreground leading-tight">{displayName}</h3>
                    </div>
                    <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-widest md:hidden">Task</span>
                </div>

                {/* Middle side: Details or Edit form */}
                <div className="flex-1 px-4 py-3 flex flex-col justify-center min-w-0">
                    <AnimatePresence mode="wait">
                        {!isEditing ? (
                            <motion.div
                                key="details"
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                className="flex flex-wrap items-center gap-x-6 gap-y-2"
                            >
                                {detailRows.map((row, i) => (
                                    <div key={i} className="flex flex-col">
                                        <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">{row.label}</span>
                                        <span className="text-sm font-semibold text-foreground truncate max-w-[150px]">{row.value}</span>
                                    </div>
                                ))}
                                <div className="flex flex-col min-w-0">
                                    <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Time</span>
                                    <span className="text-sm font-medium text-foreground opacity-80">{estimatedTime}</span>
                                </div>
                            </motion.div>
                        ) : (
                            <motion.div
                                key="editor"
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                className="w-full grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3"
                            >
                                {editableFields.map((field) => (
                                    <div key={field.key} className="space-y-1 w-full">
                                        <label className="text-xs font-medium text-muted-foreground">{field.label}</label>
                                        {field.type === "select" ? (
                                            <select
                                                value={String(field.value)}
                                                onChange={(e) => {
                                                    const val = field.options?.every((o: any) => typeof o === "number")
                                                        ? parseInt(e.target.value)
                                                        : e.target.value
                                                    handleFieldChange(field.key, val)
                                                }}
                                                className="w-full h-8 bg-background border border-border rounded-md px-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-foreground/30 shadow-sm"
                                            >
                                                {(field.options as any[])?.map((opt: any) => (
                                                    <option key={opt} value={opt}>
                                                        {opt}
                                                    </option>
                                                ))}
                                            </select>
                                        ) : field.type === "toggle" ? (
                                            <div className="h-8 flex items-center">
                                                <button
                                                    onClick={() => handleFieldChange(field.key, !field.value)}
                                                    className={`relative w-9 h-5 rounded-full transition-colors ${field.value ? "bg-foreground" : "bg-muted-foreground/30"}`}
                                                >
                                                    <div
                                                        className={`absolute top-0.5 left-0.5 h-4 w-4 rounded-full bg-background shadow-sm transition-transform ${field.value ? "translate-x-4" : "translate-x-0"}`}
                                                    />
                                                </button>
                                            </div>
                                        ) : (
                                            <div className="h-8">
                                                <AutocompleteInput
                                                    value={String(field.value)}
                                                    onChange={(val) => handleFieldChange(field.key, val)}
                                                    placeholder="Type @ to search files..."
                                                />
                                            </div>
                                        )}
                                    </div>
                                ))}
                                <div className="flex flex-col justify-end space-y-1">
                                    <span className="text-xs text-muted-foreground mb-1">Live Cost</span>
                                    <span className="h-8 flex items-center text-sm font-bold text-foreground bg-muted/30 px-3 rounded-md border border-border/50">{creditCost} ⚡</span>
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>

                {/* Right side: Actions */}
                <div className="px-4 py-3 border-t md:border-t-0 md:border-l border-border/50 flex md:flex-col items-center justify-center gap-2 bg-muted/10">
                    <button
                        onClick={handleApprove}
                        className="flex-1 md:flex-none w-full flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-foreground text-background font-medium hover:bg-foreground/90 transition-all active:scale-[0.98] focus:outline-none focus:ring-2 focus:ring-foreground/30"
                    >
                        <Check className="h-4 w-4" />
                        <span className="md:hidden">Approve</span>
                    </button>
                    <div className="flex items-center gap-2 w-full">
                        <button
                            onClick={() => setIsEditing(!isEditing)}
                            title={isEditing ? "Save edits" : "Edit settings"}
                            className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg border border-border font-medium text-xs transition-all active:scale-[0.98] ${isEditing ? 'bg-muted text-foreground' : 'bg-background text-muted-foreground hover:text-foreground hover:bg-muted/50'}`}
                        >
                            <Edit3 className="h-3.5 w-3.5" />
                            {isEditing ? "Done" : "Edit"}
                        </button>
                        <button
                            onClick={onCancel}
                            title="Cancel task"
                            className="flex-shrink-0 flex items-center justify-center p-2 rounded-lg border border-border bg-background text-muted-foreground hover:bg-muted hover:text-foreground hover:border-foreground/30 transition-all active:scale-[0.98]"
                        >
                            <X className="h-4 w-4" />
                        </button>
                    </div>
                </div>
            </div>
        </motion.div>
    )
}

