import * as React from "react"
import { motion, AnimatePresence } from "framer-motion"
import { useState, useEffect, useRef, useMemo, useCallback } from "react"
import { Plus, Image as ImageIcon, Film, ChevronLeft, ChevronRight, X, RectangleHorizontal, RectangleVertical, Square, Search, Download, SlidersHorizontal, ChevronDown, RotateCcw, Loader2, ExternalLink, Globe, Volume2, VolumeX, Clock, Pencil, FolderOpen, FolderInput, Sparkles, File as FileIcon, FolderClosed } from "lucide-react"
import { searchBingImages, downloadImageSafe, downloadImageAsBlob, type BingImageResult } from "../../services/bingImageSearch"
import { FILTER_GROUPS, DISCOVER_GALLERY, type FilterGroup } from "../../data/discoverGallery"
import { useAuth } from "../../hooks/useAuth"
import { saveImageToStorage } from "../../lib/imageStorage"
import { uuidv4 } from "../../lib/uuid"
import { saveImage, saveVideo } from "../../services/multiDbDataService"
import { saveSingleProjectFile } from "../../services/projectFiles"
import {
  generateImageWithRunway,
  generateVideoWithRunway,
  editImageWithRunway,
  editVideoWithRunway,
  type RunwayImageModel,
  type RunwayRatio,
  type RunwayVideoModel,
  type RunwayVideoRatio,
} from "../../services/runwayml"
import { getAllUserAssets, type AssetMetadata } from "../../services/assetService"
import { uploadFileToDataDb } from "../../services/supabase"
import { useAppStore } from "../../store/useAppStore"
import { useTaskStore } from "../../store/useTaskStore"
import { checkRateLimit, recordRequest, getRateLimitMessage } from "../../services/rateLimiter"
import { ImageGenerationLoader } from "../ui/ImageGenerationLoader"
import { VideoGenerationLoader } from "../ui/VideoGenerationLoader"
import { ImportToProjectPopup } from "../ui/ImportToProjectPopup"
import { useToast } from "../ui/toast"

// Images are now served from the /public/images directory

// ─── Types ───────────────────────────────────────────────────────────────────

type GenerationType = "image" | "video"

// ─── Art Style Definitions ──────────────────────────────────────────────────

const ART_STYLES = [
  { id: "ink", name: "Ink / Sumi-e", tags: "ink wash, sumi-e, brush strokes, minimal, negative space", image: "/images/sumi.png" },
  { id: "realistic", name: "Realistic", tags: "photorealistic, PBR, cinematic, ultra-detailed", image: "/images/realistic.png" },
  { id: "3d-anime", name: "3D Anime", tags: "3d anime, semi realistic shading, vibrant", image: "/images/3d-anime.png" },
  { id: "2d-anime", name: "2D Anime", tags: "2d anime, cel shading, line art, vibrant", image: "/images/2d-anime.png" },
  { id: "semi-realistic", name: "Semi-Realistic", tags: "stylized realism, hero design, painterly", image: "/images/semi-realistic.png" },
  { id: "cartoon", name: "Cartoon", tags: "cartoon, exaggerated, vibrant, playful", image: "/images/cartoon.png" },
  { id: "pixel", name: "Pixel Art", tags: "pixel, 8-bit, 16-bit, retro", image: "/images/pixel.png" },
  { id: "gacha", name: "Gacha / Anime", tags: "anime polished, gacha, glossy, high detail", image: "/images/gacha.png" },
  { id: "comic", name: "Manga / Comic", tags: "comic, inked, bold outline, cel shading", image: "/images/manga.png" },
  { id: "lowpoly", name: "Low Poly", tags: "low poly, geometric, simple", image: "/images/lowpoly.png" },
  { id: "sketch", name: "Sketch / Concept", tags: "rough lines, early-stage look", image: "/images/sketch.png" },
]

// Placeholder inspiration items (images/videos that have been generated)
const INSPIRATION_ITEMS = [
  { id: "1", type: "image" as const, url: "" },
  { id: "2", type: "image" as const, url: "" },
  { id: "3", type: "image" as const, url: "" },
  { id: "4", type: "video" as const, url: "" },
  { id: "5", type: "image" as const, url: "" },
  { id: "6", type: "image" as const, url: "" },
  { id: "7", type: "video" as const, url: "" },
  { id: "8", type: "image" as const, url: "" },
]

// ─── Filter Helpers ──────────────────────────────────────────────────────────

type ActiveFilters = Record<string, string[]>  // { filterGroupId: selectedValues[] }

/** Check whether a conditional filter group should be visible given the current selections */
function isFilterGroupVisible(group: FilterGroup, activeFilters: ActiveFilters): boolean {
  if (!group.showWhen) return true
  const parentValues = activeFilters[group.showWhen.filterGroupId] || []
  return group.showWhen.values.some(v => parentValues.includes(v))
}

// ─── Image Ratios ────────────────────────────────────────────────────────────

const IMAGE_RATIOS: { value: RunwayRatio; label: string }[] = [
  { value: "1024:1024", label: "1:1" },
  { value: "1360:768", label: "16:9" },
  { value: "720:1280", label: "9:16" },
  { value: "1920:1080", label: "HD" },
  { value: "1080:1920", label: "HD Portrait" },
  { value: "1080:1080", label: "Square HD" },
]

const VIDEO_RATIOS: { value: RunwayVideoRatio; label: string }[] = [
  { value: "1280:720", label: "16:9" },
  { value: "720:1280", label: "9:16" },
  { value: "960:960", label: "1:1" },
]

// ─── Edit Image Ratios (same as gen ratios) ──────────────────────────────────

const EDIT_IMAGE_RATIOS: { value: string; label: string }[] = [
  { value: "1024:1024", label: "1:1" },
  { value: "1360:768", label: "16:9" },
  { value: "720:1280", label: "9:16" },
  { value: "1920:1080", label: "HD" },
  { value: "1080:1920", label: "HD Portrait" },
]

const EDIT_IMAGE_MODELS: { value: RunwayImageModel; label: string }[] = [
  { value: "gen4_image_turbo", label: "gen4_image_turbo" },
  { value: "gen4_image", label: "gen4_image" },
  { value: "gemini_2.5_flash", label: "gemini_2.5_flash" },
]

type GalleryTab = "discover" | "generated"
type MentionTarget = "generate" | "edit"
type MentionItem = { path: string; name: string; type: "file" | "folder" }

// ─── Component ───────────────────────────────────────────────────────────────

export function MediaGeneration() {
  const { user, isAuthenticated } = useAuth()
  const { currentProject, generatedFiles, images, addImage, generatedVideos, addGeneratedVideo, addGeneratedFile, setStage } = useAppStore()
  const { addTask, updateTask } = useTaskStore()
  const { addToast } = useToast()

  // ── Core state ──
  const [genType, setGenType] = useState<GenerationType>("image")
  const [prompt, setPrompt] = useState("")
  const [isGenerating, setIsGenerating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // ── Image state ──
  const [imageModel, setImageModel] = useState<RunwayImageModel>("gen4_image_turbo")
  const [imageRatio, setImageRatio] = useState<RunwayRatio>("720:1280")

  // ── Video state ──
  const [videoModel, setVideoModel] = useState<RunwayVideoModel>("gen4_turbo")
  const [videoRatio, setVideoRatio] = useState<RunwayVideoRatio>("720:1280")
  const [videoDuration, setVideoDuration] = useState<number>(10)
  const [videoWithAudio, setVideoWithAudio] = useState<boolean>(true)

  // ── Maximization state ──
  const [maximizedMedia, setMaximizedMedia] = useState<{ url: string, name: string, type: 'image' | 'video' } | null>(null)

  // ── Image upload state ──
  const [attachedImage, setAttachedImage] = useState<File | null>(null)
  const [attachedImagePreview, setAttachedImagePreview] = useState<string | null>(null)

  // ── Settings panel ──
  const [showRatioSelect, setShowRatioSelect] = useState(false)
  const [showModelSelect, setShowModelSelect] = useState(false)

  // ── Gallery Tab state ──
  const [galleryTab, setGalleryTab] = useState<GalleryTab>("discover")

  // ── Generated Assets state ──
  const [userAssets, setUserAssets] = useState<AssetMetadata[]>([])
  const [isLoadingAssets, setIsLoadingAssets] = useState(false)
  const [assetsLoaded, setAssetsLoaded] = useState(false)

  // ── Asset Edit state ──
  const [isEditMode, setIsEditMode] = useState(false)
  const [editPrompt, setEditPrompt] = useState("")
  const [isEditing, setIsEditing] = useState(false)
  const [editError, setEditError] = useState<string | null>(null)
  const [editImageModel, setEditImageModel] = useState<RunwayImageModel>("gen4_image_turbo")
  const [editImageRatio, setEditImageRatio] = useState<string>("1024:1024")
  const [editImageSeed, setEditImageSeed] = useState<string>("70943470")
  const [showEditModelSelect, setShowEditModelSelect] = useState(false)
  const [showEditRatioSelect, setShowEditRatioSelect] = useState(false)
  const [editReferenceImage, setEditReferenceImage] = useState<File | null>(null)
  const [editReferenceImagePreview, setEditReferenceImagePreview] = useState<string | null>(null)
  const [showMentionSuggestions, setShowMentionSuggestions] = useState(false)
  const [mentionQuery, setMentionQuery] = useState("")
  const [mentionTarget, setMentionTarget] = useState<MentionTarget | null>(null)
  const [mentionStart, setMentionStart] = useState<number | null>(null)
  const [mentionEnd, setMentionEnd] = useState<number | null>(null)
  const [selectedMentionIndex, setSelectedMentionIndex] = useState(0)

  // ── Filter state ──
  const [showFilterPanel, setShowFilterPanel] = useState(false)
  const [pendingFilters, setPendingFilters] = useState<ActiveFilters>({})
  const [appliedFilters, setAppliedFilters] = useState<ActiveFilters>({})
  const [searchQuery, setSearchQuery] = useState("")
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({})
  const filterPanelRef = useRef<HTMLDivElement>(null)
  const promptTextareaRef = useRef<HTMLTextAreaElement>(null)
  const editPromptTextareaRef = useRef<HTMLTextAreaElement>(null)
  const mentionSuggestionsRef = useRef<HTMLDivElement>(null)

  // ── Import popup state ──
  const [importPopup, setImportPopup] = useState<{ isOpen: boolean; url: string; type: "image" | "video"; name: string } | null>(null)

  // ── Bing Image Search state ──
  const [bingResults, setBingResults] = useState<BingImageResult[]>(() => {
    try {
      const saved = localStorage.getItem("koye_bing_results")
      return saved ? JSON.parse(saved) : []
    } catch {
      return []
    }
  })
  const [isBingSearching, setIsBingSearching] = useState(false)
  const [bingSearchError, setBingSearchError] = useState<string | null>(null)
  const [lastBingQuery, setLastBingQuery] = useState(() => {
    return localStorage.getItem("koye_bing_query") || ""
  })
  const [downloadingId, setDownloadingId] = useState<string | null>(null)
  const [isImportingToProject, setIsImportingToProject] = useState(false)
  const [importingBingId, setImportingBingId] = useState<string | null>(null)

  // Persist search results and query to localStorage
  useEffect(() => {
    localStorage.setItem("koye_bing_results", JSON.stringify(bingResults))
  }, [bingResults])

  useEffect(() => {
    localStorage.setItem("koye_bing_query", lastBingQuery)
  }, [lastBingQuery])
  // Track whether we are in "search results" mode (Discover hidden)
  const hasActiveSearch = bingResults.length > 0 || isBingSearching

  // ── Fetch user generated assets when switching to Generated tab ──
  useEffect(() => {
    if (galleryTab === "generated" && !assetsLoaded && user && isAuthenticated) {
      setIsLoadingAssets(true)
      getAllUserAssets(user.id)
        .then((assets) => {
          // Only show image and video assets
          const mediaAssets = assets.filter(a => a.assetType === "image" || a.assetType === "video")
          setUserAssets(mediaAssets)
          setAssetsLoaded(true)
        })
        .catch((err) => {
          console.error("Failed to fetch user assets:", err)
        })
        .finally(() => setIsLoadingAssets(false))
    }
  }, [galleryTab, assetsLoaded, user, isAuthenticated])

  // ── Close dropdowns on outside click ──
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement
      if (!target.closest('.media-dropdown-element')) {
        setShowRatioSelect(false)
        setShowModelSelect(false)
        setShowEditModelSelect(false)
        setShowEditRatioSelect(false)
      }
      if (!target.closest('.media-mention-suggestions') && !target.closest('.media-mention-input')) {
        setShowMentionSuggestions(false)
      }
      if (showFilterPanel && filterPanelRef.current && !filterPanelRef.current.contains(target) && !target.closest('.filter-toggle-btn')) {
        setShowFilterPanel(false)
      }
    }
    document.addEventListener("mousedown", handleClick)
    return () => document.removeEventListener("mousedown", handleClick)
  }, [showFilterPanel])

  // ── Bing Image Search: triggered only by button click or Enter key ──
  const executeBingSearch = useCallback(async (query: string) => {
    const trimmed = query.trim()
    if (!trimmed || trimmed.length < 2) return
    // Don't re-search the same query
    if (trimmed === lastBingQuery) return

    setIsBingSearching(true)
    setBingSearchError(null)
    console.log(`[MediaGen] Triggering Bing search: "${trimmed}"`)

    try {
      const results = await searchBingImages(trimmed)
      setBingResults(results)
      setLastBingQuery(trimmed)
    } catch (err) {
      console.error("[MediaGen] Bing search error:", err)
      setBingSearchError(err instanceof Error ? err.message : "Search failed")
      setBingResults([])
    } finally {
      setIsBingSearching(false)
    }
  }, [lastBingQuery])

  // Handle Enter key on search bar for instant search
  const handleSearchKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault()
      executeBingSearch(searchQuery)
    }
  }, [searchQuery, executeBingSearch])

  // Handle search button click
  const handleSearchClick = useCallback(() => {
    executeBingSearch(searchQuery)
  }, [searchQuery, executeBingSearch])

  // Clear Bing results when search query is emptied
  const handleSearchQueryChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value
    setSearchQuery(val)
    // When user clears the search bar, clear results and return to Discover
    if (!val.trim()) {
      setBingResults([])
      setLastBingQuery("")
      setBingSearchError(null)
    }
  }, [])

  // Download handler for Bing results
  const handleBingDownload = useCallback(async (e: React.MouseEvent, img: BingImageResult) => {
    e.stopPropagation()
    setDownloadingId(img.id)
    const ext = img.originalUrl.match(/\.(jpe?g|png|webp|gif)/i)?.[1] || "png"
    const safeName = img.title.replace(/[^a-zA-Z0-9]/g, "-").substring(0, 40).replace(/-+$/, "")
    await downloadImageSafe(img.originalUrl || img.thumbnailUrl, `${safeName}.${ext}`)
    setDownloadingId(null)
  }, [])

  const handleBingImportToProject = useCallback(async (e: React.MouseEvent, img: BingImageResult) => {
    e.stopPropagation()
    if (!currentProject || !user) {
      addToast({
        title: "Project Required",
        description: "Connect to a project to import assets.",
        variant: "warning",
      })
      return
    }

    setImportingBingId(img.id)
    setIsImportingToProject(true)
    try {
      const sourceUrl = img.originalUrl || img.thumbnailUrl
      const blob = await downloadImageAsBlob(sourceUrl)
      const ext = blob.type.includes("jpeg")
        ? "jpg"
        : blob.type.includes("webp")
          ? "webp"
          : blob.type.includes("gif")
            ? "gif"
            : "png"
      const safeName = img.title.replace(/[^a-zA-Z0-9]/g, "-").substring(0, 40).replace(/-+$/, "") || `bing-${Date.now()}`
      const fileName = `${safeName}.${ext}`
      const filePath = `images/${fileName}`

      const file = new File([blob], fileName, { type: blob.type || "image/png" })
      const imageUrl = await uploadImageToStorage(file, user.id, uuidv4())
      await saveSingleProjectFile(currentProject.id, user.id, currentProject.name, filePath, imageUrl, null)
      addGeneratedFile(filePath, imageUrl)

      addToast({
        title: "Imported",
        description: `Added to ${currentProject.name}/images`,
        variant: "success",
      })
    } catch (err) {
      console.error("[MediaGen] Failed to import Bing image:", err)
      addToast({
        title: "Import Failed",
        description: err instanceof Error ? err.message : "Failed to import image to project",
        variant: "error",
      })
    } finally {
      setIsImportingToProject(false)
      setImportingBingId(null)
    }
  }, [addGeneratedFile, addToast, currentProject, user])

  const handleSaveCurrentImageToProject = useCallback(async () => {
    if (!maximizedMedia || maximizedMedia.type !== "image") return
    if (!currentProject || !user) {
      addToast({
        title: "Project Required",
        description: "Connect to a project to save this image.",
        variant: "warning",
      })
      return
    }

    setIsImportingToProject(true)
    try {
      const blob = await downloadImageAsBlob(maximizedMedia.url)
      const ext = blob.type.includes("jpeg")
        ? "jpg"
        : blob.type.includes("webp")
          ? "webp"
          : blob.type.includes("gif")
            ? "gif"
            : "png"
      const safeName = maximizedMedia.name.replace(/[^a-zA-Z0-9]/g, "-").substring(0, 40).replace(/-+$/, "") || `image-${Date.now()}`
      const fileName = `${safeName}.${ext}`
      const filePath = `images/${fileName}`

      const file = new File([blob], fileName, { type: blob.type || "image/png" })
      const imageUrl = await uploadImageToStorage(file, user.id, uuidv4())
      await saveSingleProjectFile(currentProject.id, user.id, currentProject.name, filePath, imageUrl, null)
      addGeneratedFile(filePath, imageUrl)

      addToast({
        title: "Saved to Project",
        description: `Added to ${currentProject.name}/images`,
        variant: "success",
      })
    } catch (err) {
      console.error("[MediaGen] Failed to save selected image to project:", err)
      addToast({
        title: "Save Failed",
        description: err instanceof Error ? err.message : "Failed to save image to project",
        variant: "error",
      })
    } finally {
      setIsImportingToProject(false)
    }
  }, [addGeneratedFile, addToast, currentProject, maximizedMedia, user])

  // ── Filter helpers ──
  const togglePendingFilter = (groupId: string, value: string) => {
    setPendingFilters(prev => {
      const current = prev[groupId] || []
      const updated = current.includes(value)
        ? current.filter(v => v !== value)
        : [...current, value]
      const next = { ...prev, [groupId]: updated }
      // Clean up empty arrays
      if (next[groupId].length === 0) delete next[groupId]
      // When a parent filter changes, clear child filters that are no longer valid
      FILTER_GROUPS.forEach(fg => {
        if (fg.showWhen?.filterGroupId === groupId) {
          if (!isFilterGroupVisible(fg, next)) {
            delete next[fg.id]
          }
        }
      })
      return next
    })
  }

  const applyFilters = () => {
    setAppliedFilters({ ...pendingFilters })
    setShowFilterPanel(false)
  }

  const resetFilters = () => {
    setPendingFilters({})
    setAppliedFilters({})
    setExpandedGroups({})
  }

  const toggleGroupExpanded = (groupId: string) => {
    setExpandedGroups(prev => ({ ...prev, [groupId]: !prev[groupId] }))
  }

  const activeFilterCount = Object.values(appliedFilters).reduce((sum, arr) => sum + arr.length, 0)

  // ── Compute filtered discover gallery ──
  const filteredGallery = useMemo(() => {
    const hasFilters = Object.keys(appliedFilters).length > 0
    const query = searchQuery.trim().toLowerCase()

    let items = DISCOVER_GALLERY

    // If no filters and no search, show items tagged "default"
    if (!hasFilters && !query) {
      return items.filter(item => item.tags.includes("default"))
    }

    // Filter by applied tags (AND across groups, OR within a group)
    if (hasFilters) {
      items = items.filter(item => {
        return Object.entries(appliedFilters).every(([_groupId, selectedValues]) => {
          return selectedValues.some(val => item.tags.map(t => t.toLowerCase()).includes(val.toLowerCase()))
        })
      })
    }

    // Filter by search query (matches any tag or name)
    if (query) {
      items = items.filter(item => {
        const nameMatch = item.name.toLowerCase().includes(query)
        const tagMatch = item.tags.some(t => t.toLowerCase().includes(query))
        return nameMatch || tagMatch
      })
    }

    return items
  }, [appliedFilters, searchQuery])

  // ── Carousel ref ──
  const carouselRef = useRef<HTMLDivElement>(null)

  // ── Art Style Selection ──
  const [selectedStyle, setSelectedStyle] = useState<string | null>(null)

  // Cache for placeholder asset ID
  const placeholderAssetIdRef = React.useRef<string | null>(null)

  // ── Determine which models support image input ──
  const modelSupportsImage = () => {
    if (genType === "image") return true // referenceImages supported for all image models
    if (genType === "video") return videoModel === "gen4.5" || videoModel === "gen4_turbo" || videoModel === "veo3.1" || videoModel === "veo3.1_fast"
    return false
  }

  // ── Handle attach image ──
  const handleAttachImage = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      setAttachedImage(file)
      setAttachedImagePreview(URL.createObjectURL(file))
    }
  }

  const clearAttachedImage = () => {
    if (attachedImagePreview) URL.revokeObjectURL(attachedImagePreview)
    setAttachedImage(null)
    setAttachedImagePreview(null)
  }

  const handleEditReferenceImage = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (editReferenceImagePreview) URL.revokeObjectURL(editReferenceImagePreview)
    setEditReferenceImage(file)
    setEditReferenceImagePreview(URL.createObjectURL(file))
  }

  const clearEditReferenceImage = () => {
    if (editReferenceImagePreview) URL.revokeObjectURL(editReferenceImagePreview)
    setEditReferenceImage(null)
    setEditReferenceImagePreview(null)
  }

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (attachedImagePreview) URL.revokeObjectURL(attachedImagePreview)
      if (editReferenceImagePreview) URL.revokeObjectURL(editReferenceImagePreview)
    }
  }, [attachedImagePreview, editReferenceImagePreview])

  const blobToBase64Data = (blob: Blob): Promise<{ base64: string; mimeType: string }> => {
    const reader = new FileReader()
    return new Promise((resolve) => {
      reader.onloadend = () => {
        const result = reader.result as string
        const [prefix, encoded] = result.split(",")
        const mimeMatch = prefix.match(/^data:(.*?);base64$/)
        resolve({
          base64: encoded,
          mimeType: mimeMatch?.[1] || blob.type || "image/png",
        })
      }
      reader.readAsDataURL(blob)
    })
  }

  const availableMentionFiles = useMemo<MentionItem[]>(() => {
    if (!currentProject || !generatedFiles) return []
    const fileKeys = Object.keys(generatedFiles)
    const files = fileKeys.map((path) => ({
      path,
      name: path.split("/").pop() || path,
      type: "file" as const,
    }))
    const folders = new Set<string>()
    fileKeys.forEach((path) => {
      const parts = path.split("/")
      for (let i = 0; i < parts.length - 1; i++) {
        folders.add(parts.slice(0, i + 1).join("/"))
      }
    })
    const folderItems = Array.from(folders).map((path) => ({
      path,
      name: path.split("/").pop() || path,
      type: "folder" as const,
    }))
    return [...folderItems, ...files]
  }, [currentProject, generatedFiles])

  const filteredMentionFiles = useMemo(() => {
    if (!mentionQuery) return availableMentionFiles
    const search = mentionQuery.toLowerCase()
    return availableMentionFiles.filter(
      (item) => item.path.toLowerCase().includes(search) || item.name.toLowerCase().includes(search)
    )
  }, [availableMentionFiles, mentionQuery])

  const closeMentionSuggestions = () => {
    setShowMentionSuggestions(false)
    setMentionQuery("")
    setMentionTarget(null)
    setMentionStart(null)
    setMentionEnd(null)
    setSelectedMentionIndex(0)
  }

  const updateMentionState = (target: MentionTarget, value: string, caret: number) => {
    if (!currentProject) {
      closeMentionSuggestions()
      return
    }
    const beforeCursor = value.slice(0, caret)
    const atIndex = beforeCursor.lastIndexOf("@")
    if (atIndex === -1) {
      closeMentionSuggestions()
      return
    }
    const query = beforeCursor.slice(atIndex + 1)
    if (/\s/.test(query)) {
      closeMentionSuggestions()
      return
    }
    setMentionTarget(target)
    setMentionStart(atIndex)
    setMentionEnd(caret)
    setMentionQuery(query)
    setShowMentionSuggestions(true)
    setSelectedMentionIndex(0)
  }

  const insertMentionIntoTarget = (item: MentionItem) => {
    if (mentionStart === null || mentionEnd === null || !mentionTarget) return
    const targetRef = mentionTarget === "generate" ? promptTextareaRef : editPromptTextareaRef
    const setter = mentionTarget === "generate" ? setPrompt : setEditPrompt
    const currentValue = mentionTarget === "generate" ? prompt : editPrompt
    const nextValue = `${currentValue.slice(0, mentionStart)}@${item.path} ${currentValue.slice(mentionEnd)}`
    setter(nextValue)
    closeMentionSuggestions()
    setTimeout(() => {
      const el = targetRef.current
      if (!el) return
      const cursor = mentionStart + item.path.length + 2
      el.focus()
      el.setSelectionRange(cursor, cursor)
    }, 0)
  }

  const buildMentionTag = (raw: string, fallbackIndex: number) => {
    const base = raw
      .toLowerCase()
      .replace(/[^a-z0-9_]+/g, "_")
      .replace(/^_+|_+$/g, "")
    const withFallback = base || `ref${fallbackIndex}`
    if (withFallback.length < 3) return `${withFallback}ref`.slice(0, 16)
    return withFallback.slice(0, 16)
  }

  const getMentionedPaths = (text: string): string[] => {
    const matches = Array.from(text.matchAll(/@([^\s]+)/g)).map((m) => m[1].replace(/[),.;!?]+$/, ""))
    return Array.from(new Set(matches))
  }

  const resolveMentionedReferenceImages = useCallback(async (text: string) => {
    if (!currentProject || !generatedFiles) return [] as Array<{ base64: string; mimeType?: string; tag?: string }>
    const mentioned = getMentionedPaths(text)
    const refs: Array<{ base64: string; mimeType?: string; tag?: string }> = []

    for (let index = 0; index < mentioned.length; index++) {
      if (refs.length >= 3) break
      const mention = mentioned[index]
      const directPath = generatedFiles[mention] ? mention : Object.keys(generatedFiles).find((p) => p.endsWith(`/${mention}`) || p === mention)
      if (!directPath) continue
      const value = generatedFiles[directPath]
      if (!value) continue

      const isImagePath = /\.(png|jpg|jpeg|webp|gif)$/i.test(directPath)
      if (!isImagePath) continue

      let source = value
      if (!source.startsWith("http") && !source.startsWith("data:") && !source.startsWith("blob:")) {
        const urlMatch = source.match(/\**URL:\**\s*(https?:\/\/[^\s\n*)]+)/i) || source.match(/# URL:\s*(https?:\/\/[^\s\n]+)/i)
        if (urlMatch) source = urlMatch[1]
      }

      if (!source.startsWith("http") && !source.startsWith("data:") && !source.startsWith("blob:")) continue

      try {
        if (source.startsWith("data:")) {
          const [prefix, encoded] = source.split(",")
          const mimeMatch = prefix.match(/^data:(.*?);base64$/)
          if (encoded) refs.push({ base64: encoded, mimeType: mimeMatch?.[1] || "image/png", tag: buildMentionTag(directPath.split("/").pop() || `ref${index + 1}`, index + 1) })
          continue
        }
        const response = await fetch(source)
        if (!response.ok) continue
        const blob = await response.blob()
        const converted = await blobToBase64Data(blob)
        refs.push({
          base64: converted.base64,
          mimeType: converted.mimeType,
          tag: buildMentionTag(directPath.split("/").pop() || `ref${index + 1}`, index + 1),
        })
      } catch (e) {
        console.warn("[MediaGen] Failed to resolve mentioned reference:", mention, e)
      }
    }
    return refs
  }, [currentProject, generatedFiles])

  const handleMentionKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (!showMentionSuggestions || filteredMentionFiles.length === 0) return false
    if (e.key === "ArrowDown") {
      e.preventDefault()
      setSelectedMentionIndex((prev) => (prev < filteredMentionFiles.length - 1 ? prev + 1 : prev))
      return true
    }
    if (e.key === "ArrowUp") {
      e.preventDefault()
      setSelectedMentionIndex((prev) => (prev > 0 ? prev - 1 : 0))
      return true
    }
    if (e.key === "Escape") {
      e.preventDefault()
      closeMentionSuggestions()
      return true
    }
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      insertMentionIntoTarget(filteredMentionFiles[selectedMentionIndex])
      return true
    }
    return false
  }

  // ── Upload helper ──
  const uploadImageToStorage = async (imageFile: File, userId: string, imageId: string): Promise<string> => {
    const storagePath = `images/${userId}/${imageId}.png`
    return await uploadFileToDataDb("images", storagePath, imageFile)
  }

  // ── Placeholder asset ──
  const getOrCreatePlaceholderAsset = async (userId: string): Promise<string | null> => {
    if (placeholderAssetIdRef.current) return placeholderAssetIdRef.current
    try {
      const { createProject, createAsset, getProjects, getAssets } = await import("../../services/supabase")
      const projects = await getProjects(userId)
      const bucketName = genType === "image" ? "Standalone Images" : "Standalone Videos"
      let project = projects.find(p => p.name === bucketName)
      if (!project) {
        project = await createProject({ userId, name: bucketName, description: `Generated from the media generation page` })
      }
      const assets = await getAssets(project.id)
      let asset = assets.find(a => a.status === "concept")
      if (!asset) {
        asset = await createAsset({ projectId: project.id, type: "prop", status: "concept", metadata: {} })
      }
      placeholderAssetIdRef.current = asset.id
      return asset.id
    } catch {
      return null
    }
  }

  // ── Art style click ──
  const handleStyleClick = (style: typeof ART_STYLES[number]) => {
    setSelectedStyle(style.id)
    setPrompt(prev => {
      const cleaned = ART_STYLES.reduce((p, s) => p.replace(`, ${s.tags}`, "").replace(s.tags, ""), prev).trim()
      return cleaned ? `${cleaned}, ${style.tags}` : style.tags
    })
    setMaximizedMedia({ url: style.image, name: style.name, type: 'image' })
  }

  // ── Carousel scroll ──
  const scrollCarousel = (dir: "left" | "right") => {
    if (carouselRef.current) {
      carouselRef.current.scrollBy({ left: dir === "left" ? -300 : 300, behavior: "smooth" })
    }
  }

  // ── Generate ──
  const handleGenerate = async () => {
    if (!prompt.trim()) {
      setError("Please enter a prompt")
      return
    }
    if (genType === "video" && videoModel === "gen4_turbo" && !attachedImage) {
      setError("gen4_turbo requires an input image")
      return
    }

    // Rate limit check
    const rateLimitService = genType === "image" ? "image-generation" : "image-generation" // video uses same limiter
    const rateCheck = checkRateLimit(rateLimitService as any)
    if (!rateCheck.allowed) {
      const msg = getRateLimitMessage(rateLimitService as any, rateCheck.retryAfterMs)
      setError(msg)
      addToast({ title: "Rate Limit", description: msg, variant: "warning" })
      return
    }

    // Record the request
    recordRequest(rateLimitService as any)

    // Create background task
    const taskId = uuidv4()
    const taskType = genType === "image" ? "text-to-image" as const : "text-to-video" as const
    const assetName = prompt.trim().substring(0, 8)
    addTask({
      id: taskId,
      type: taskType,
      status: "running",
      config: {},
      createdAt: Date.now(),
      startedAt: Date.now(),
      assetName,
      assetType: genType === "image" ? "image" : "video",
      prompt: prompt.trim(),
    })

    // Show "sent to background" toast
    addToast({
      title: "Task Started",
      description: `${genType === "image" ? "Image" : "Video"} generation sent to background`,
      variant: "info",
    })

    setIsGenerating(true)
    setError(null)

    try {
      let attachedUrl: string | undefined
      if (attachedImage && user) {
        attachedUrl = await uploadImageToStorage(attachedImage, user.id, uuidv4())
      }

      if (genType === "image") {
        const mentionReferences = await resolveMentionedReferenceImages(prompt.trim())
        let uploadReference: { base64: string; mimeType?: string; tag?: string } | null = null
        if (attachedImage) {
          const uploaded = await blobToBase64Data(attachedImage)
          uploadReference = {
            base64: uploaded.base64,
            mimeType: uploaded.mimeType,
            tag: "upload",
          }
        }
        const imageReferences = [uploadReference, ...mentionReferences].filter(Boolean) as Array<{ base64: string; mimeType?: string; tag?: string }>
        const imageUrl = await generateImageWithRunway(prompt.trim(), {
          model: imageModel,
          ratio: imageRatio,
          referenceImages: imageReferences.length > 0 ? imageReferences : undefined,
        })
        const imageData = {
          id: uuidv4(),
          assetId: "",
          url: imageUrl,
          prompt: prompt.trim(),
          createdAt: new Date().toISOString(),
          view: "front" as const,
        }
        addImage(imageData)
        setMaximizedMedia({ url: imageUrl, name: 'Generated Image', type: 'image' })

        // Update task as completed
        updateTask(taskId, { status: "completed", completedAt: Date.now(), assetUrl: imageUrl, resultUrl: imageUrl })
        addToast({
          title: "Image Ready",
          description: "Your image has been generated",
          variant: "success",
          action: { label: "View", onClick: () => setStage("mediaGeneration") },
        })

        // Save to DB
        if (isAuthenticated && user) {
          try {
            const assetId = await getOrCreatePlaceholderAsset(user.id)
            const { createAssetFromUrl } = await import("../../services/assetService")
            const saved = await createAssetFromUrl(user.id, currentProject?.id || null, "image", `${uuidv4()}.png`, imageUrl)
            await saveImage(user.id, { assetId: assetId || undefined, view: "front", url: saved.url, prompt: prompt.trim().substring(0, 10) } as any, currentProject?.id)
          } catch (err) {
            console.error("Error saving image:", err)
            saveImageToStorage({ url: imageUrl, prompt: prompt.trim(), method: imageModel, view: "front" }, user?.id || null)
          }
        }
      } else {
        // Video generation
        const videoUrl = await generateVideoWithRunway(prompt.trim(), {
          model: videoModel,
          ratio: videoRatio,
          duration: videoDuration,
          promptImage: attachedUrl,
          withAudio: videoWithAudio,
        })
        const predictionId = uuidv4()
        addGeneratedVideo({
          url: videoUrl,
          prompt: prompt.trim(),
          predictionId,
          status: "succeeded" as any,
        })
        setMaximizedMedia({ url: videoUrl, name: 'Generated Video', type: 'video' })

        // Update task as completed
        updateTask(taskId, { status: "completed", completedAt: Date.now(), assetUrl: videoUrl, resultUrl: videoUrl })
        addToast({
          title: "Video Ready",
          description: "Your video has been generated",
          variant: "success",
          action: { label: "View", onClick: () => setStage("mediaGeneration") },
        })

        // Save to DB
        if (isAuthenticated && user) {
          try {
            const assetId = await getOrCreatePlaceholderAsset(user.id)
            await saveVideo(user.id, { userId: user.id, assetId: assetId || undefined, url: videoUrl, prompt: prompt.trim() })
          } catch (err) {
            console.error("Error saving video:", err)
          }
        }
      }
    } catch (err) {
      console.error("Error generating:", err)
      const errorMsg = err instanceof Error ? err.message : "Failed to generate"
      setError(errorMsg)
      updateTask(taskId, { status: "failed", error: errorMsg, completedAt: Date.now() })
      addToast({ title: "Generation Failed", description: errorMsg, variant: "error" })
    } finally {
      setIsGenerating(false)
    }
  }

  // ── Gradient colors per art style ──
  const styleGradients: Record<string, string> = {
    ink: "from-gray-800 to-gray-600",
    realistic: "from-amber-800 to-orange-600",
    anime: "from-pink-600 to-purple-600",
    "semi-realistic": "from-indigo-700 to-blue-500",
    cartoon: "from-yellow-500 to-red-500",
    pixel: "from-green-600 to-teal-400",
    painting: "from-rose-700 to-amber-500",
    gacha: "from-fuchsia-600 to-pink-400",
    comic: "from-red-700 to-yellow-500",
    lowpoly: "from-cyan-600 to-green-400",
    sketch: "from-neutral-600 to-neutral-400",
    "retro-cartoon": "from-orange-600 to-yellow-400",
    futuristic: "from-violet-700 to-cyan-400",
    medieval: "from-amber-900 to-yellow-700",
    tribal: "from-orange-900 to-amber-700",
  }

  // ── Handle Edit Asset ──
  const handleEditAsset = async () => {
    if (!editPrompt.trim() || !maximizedMedia) return
    setIsEditing(true)
    setEditError(null)

    try {
      if (maximizedMedia.type === 'image') {
        // Image edit: fetch source image → convert to base64 → send to edit API.
        // For external URLs (Bing search results from Pinterest, ArtStation, etc.),
        // use the robust multi-proxy downloadImageAsBlob to handle CORS.
        let blob: Blob
        const isLocal = maximizedMedia.url.startsWith('/') ||
                        maximizedMedia.url.includes('localhost') ||
                        maximizedMedia.url.includes('.supabase.co') ||
                        maximizedMedia.url.includes('.r2.dev') ||
                        maximizedMedia.url.includes('.workers.dev') ||
                        maximizedMedia.url.includes('r2.cloudflarestorage.com')

        if (isLocal) {
          // CORS-friendly — fetch directly
          const response = await fetch(maximizedMedia.url)
          if (!response.ok) throw new Error(`Failed to fetch image: HTTP ${response.status}`)
          blob = await response.blob()
        } else {
          // External URL (Bing search result) — use robust multi-proxy download
          console.log('[MediaGen] Downloading external image for edit via proxy...')
          blob = await downloadImageAsBlob(maximizedMedia.url)
        }

        // Optionally upload to R2 as a temporary source so the edit API can
        // receive a stable, accessible URL instead of a cross-origin one.
        let sourceUrlForApi = maximizedMedia.url
        if (!isLocal && user && isAuthenticated) {
          try {
            const { createAssetFromUrl } = await import('../../services/assetService')
            // Use the blob URL for createAssetFromUrl — it will upload to R2
            const blobUrl = URL.createObjectURL(blob)
            const tempName = `temp_edit_src_${Date.now()}.png`
            const tempAsset = await createAssetFromUrl(user.id, currentProject?.id || null, 'image', tempName, blobUrl)
            URL.revokeObjectURL(blobUrl)
            sourceUrlForApi = tempAsset.url
            console.log('[MediaGen] Uploaded source image to R2 for edit API:', sourceUrlForApi)
          } catch (uploadErr) {
            console.warn('[MediaGen] Failed to upload source to R2, using blob directly:', uploadErr)
            // Continue with blob-based base64 approach
          }
        }

        // Convert source image to base64 for the edit API
        const { base64, mimeType } = await blobToBase64Data(blob)

        // Optional user-uploaded reference image (supports both default and search-result edits)
        const mentionReferences = await resolveMentionedReferenceImages(editPrompt.trim())
        let additionalReferenceImages: { base64: string; mimeType?: string; tag?: string }[] = [...mentionReferences]
        if (editReferenceImage) {
          const uploadedRef = await blobToBase64Data(editReferenceImage)
          additionalReferenceImages = [{
            base64: uploadedRef.base64,
            mimeType: uploadedRef.mimeType,
            tag: "reference",
          }, ...additionalReferenceImages]
        }

        const editedUrl = await editImageWithRunway(editPrompt.trim(), base64, mimeType, {
          model: editImageModel,
          ratio: editImageRatio,
          additionalReferenceImages: additionalReferenceImages.length > 0 ? additionalReferenceImages : undefined,
        })

        // Persist the edited result to R2
        let finalEditedUrl = editedUrl
        if (user && isAuthenticated) {
          try {
            const { createAssetFromUrl } = await import('../../services/assetService')
            const editedName = `edited_${Date.now()}.png`
            const savedAsset = await createAssetFromUrl(
              user.id,
              currentProject?.id || null,
              'image',
              editedName,
              editedUrl
            )
            finalEditedUrl = savedAsset.url
            console.log('[MediaGen] Saved edited image to R2:', finalEditedUrl)
          } catch (saveErr) {
            console.warn('[MediaGen] Failed to persist edited image to R2:', saveErr)
          }
        }

        // Update the maximized view with the new result
        setMaximizedMedia({ url: finalEditedUrl, name: 'Edited Image', type: 'image' })
        setIsEditMode(false)
        setEditPrompt('')
        clearEditReferenceImage()

        // Save to store
        addImage({
          id: uuidv4(),
          assetId: '',
          url: finalEditedUrl,
          prompt: editPrompt.trim(),
          createdAt: new Date().toISOString(),
          view: 'front' as const,
        })
      } else {
        // Video edit: use video-to-video
        const seed = undefined
        const editedUrl = await editVideoWithRunway(maximizedMedia.url, editPrompt.trim(), {
          seed,
        })

        setMaximizedMedia({ url: editedUrl, name: 'Edited Video', type: 'video' })
        setIsEditMode(false)
        setEditPrompt('')

        // Save to store
        addGeneratedVideo({
          url: editedUrl,
          prompt: editPrompt.trim(),
          predictionId: uuidv4(),
          status: 'succeeded' as any,
        })
      }

      // Mark assets as needing reload
      setAssetsLoaded(false)
    } catch (err) {
      console.error('Error editing asset:', err)
      setEditError(err instanceof Error ? err.message : 'Failed to edit')
    } finally {
      setIsEditing(false)
    }
  }

  return (
    <div className="relative h-full bg-background overflow-hidden text-foreground">
      {/* ── Top Search Bar (Glassy Liquid Input UI) ── */}
      <div className="absolute top-0 left-0 right-0 z-30 px-4 pt-6 pb-4 bg-transparent pointer-events-none">
        <div className="relative max-w-4xl mx-auto w-full group pointer-events-auto">
          <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none text-muted-foreground/60 group-focus-within:text-primary transition-colors z-10">
            <Search className="w-5 h-5 transition-transform duration-300 group-focus-within:scale-110" />
          </div>
          <input
            type="text"
            value={searchQuery}
            onChange={handleSearchQueryChange}
            onKeyDown={handleSearchKeyDown}
            placeholder="Search game assets, concepts, references..."
            className="w-full bg-background/30 backdrop-blur-3xl hover:bg-background/40 focus:bg-background/50 border border-white/10 focus:border-white/20 text-foreground pl-12 pr-24 py-4 rounded-3xl shadow-[0_8px_32px_rgba(0,0,0,0.2)] transition-all duration-500 outline-none placeholder:text-muted-foreground/40"
          />
          {/* Search button + loading indicator */}
          <button
            onClick={handleSearchClick}
            disabled={isBingSearching || !searchQuery.trim()}
            className={`absolute inset-y-0 right-12 flex items-center z-10 transition-all ${searchQuery.trim() ? 'text-primary hover:text-primary/80' : 'text-muted-foreground/30 pointer-events-none'}`}
            title="Search"
          >
            <div className="p-1.5 rounded-xl hover:bg-white/10 transition-colors">
              {isBingSearching ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <Search className="w-5 h-5" />
              )}
            </div>
          </button>
          {/* Filter button */}
          <button
            onClick={() => {
              if (!showFilterPanel) setPendingFilters({ ...appliedFilters })
              setShowFilterPanel(!showFilterPanel)
            }}
            className={`filter-toggle-btn absolute inset-y-0 right-3 flex items-center z-10 transition-colors ${activeFilterCount > 0 ? 'text-primary' : 'text-muted-foreground/60 hover:text-foreground'
              }`}
          >
            <div className="relative p-1.5 rounded-xl hover:bg-white/10 transition-colors">
              <SlidersHorizontal className="w-5 h-5" />
              {activeFilterCount > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 bg-primary text-primary-foreground text-[9px] font-bold rounded-full flex items-center justify-center">
                  {activeFilterCount}
                </span>
              )}
            </div>
          </button>

          {/* ── Filter Popup Panel ── */}
          <AnimatePresence>
            {showFilterPanel && (
              <motion.div
                ref={filterPanelRef}
                initial={{ opacity: 0, y: -10, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -10, scale: 0.97 }}
                transition={{ duration: 0.2, ease: "easeOut" }}
                className="absolute top-[calc(100%+12px)] right-0 w-[380px] max-h-[70vh] bg-background/80 backdrop-blur-3xl border border-white/10 rounded-2xl shadow-[0_16px_64px_rgba(0,0,0,0.3)] overflow-hidden z-50 flex flex-col"
              >
                {/* Header */}
                <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b border-white/5">
                  <div className="flex items-center gap-2">
                    <SlidersHorizontal className="w-4 h-4 text-primary" />
                    <h3 className="text-sm font-semibold text-foreground">Filters</h3>
                    {Object.values(pendingFilters).reduce((s, a) => s + a.length, 0) > 0 && (
                      <span className="text-[10px] bg-primary/20 text-primary px-2 py-0.5 rounded-full font-medium">
                        {Object.values(pendingFilters).reduce((s, a) => s + a.length, 0)} selected
                      </span>
                    )}
                  </div>
                  <button
                    onClick={resetFilters}
                    className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground transition-colors px-2 py-1 rounded-lg hover:bg-white/5"
                  >
                    <RotateCcw className="w-3 h-3" />
                    Reset
                  </button>
                </div>

                {/* Filter Groups (scrollable) */}
                <div className="flex-1 overflow-y-auto px-4 py-3 space-y-1 scrollbar-thin">
                  {FILTER_GROUPS.filter(g => isFilterGroupVisible(g, pendingFilters)).map((group) => {
                    const isExpanded = expandedGroups[group.id] ?? false
                    const selectedCount = (pendingFilters[group.id] || []).length

                    return (
                      <div key={group.id} className="rounded-xl overflow-hidden">
                        {/* Group Header */}
                        <button
                          onClick={() => toggleGroupExpanded(group.id)}
                          className="w-full flex items-center justify-between px-3 py-2.5 hover:bg-white/5 rounded-xl transition-colors"
                        >
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-medium text-foreground">{group.label}</span>
                            {selectedCount > 0 && (
                              <span className="text-[9px] bg-primary text-primary-foreground px-1.5 py-0.5 rounded-full font-bold">
                                {selectedCount}
                              </span>
                            )}
                          </div>
                          <ChevronDown className={`w-3.5 h-3.5 text-muted-foreground transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`} />
                        </button>

                        {/* Options */}
                        <AnimatePresence>
                          {isExpanded && (
                            <motion.div
                              initial={{ height: 0, opacity: 0 }}
                              animate={{ height: "auto", opacity: 1 }}
                              exit={{ height: 0, opacity: 0 }}
                              transition={{ duration: 0.2, ease: "easeOut" }}
                              className="overflow-hidden"
                            >
                              <div className="flex flex-wrap gap-1.5 px-3 pb-3 pt-1">
                                {group.options.map((opt) => {
                                  const isSelected = (pendingFilters[group.id] || []).includes(opt.value)
                                  return (
                                    <button
                                      key={opt.value}
                                      onClick={() => togglePendingFilter(group.id, opt.value)}
                                      className={`px-3 py-1.5 rounded-full text-[11px] font-medium transition-all duration-200 border ${isSelected
                                        ? 'bg-primary text-primary-foreground border-primary shadow-sm scale-[1.02]'
                                        : 'bg-white/5 text-muted-foreground border-white/10 hover:bg-white/10 hover:text-foreground hover:border-white/20'
                                        }`}
                                    >
                                      {opt.label}
                                    </button>
                                  )
                                })}
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    )
                  })}
                </div>

                {/* Apply Button */}
                <div className="px-4 pb-4 pt-2 border-t border-white/5">
                  <button
                    onClick={applyFilters}
                    className="w-full py-3 bg-foreground text-background text-sm font-semibold rounded-xl hover:bg-foreground/90 active:scale-[0.98] transition-all shadow-lg"
                  >
                    Apply Filters
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* ── Scrollable content area ── */}
      <div className="h-full overflow-y-auto min-h-0 pt-28 pb-36">
        {/* ── Art Styles Carousel ── */}
        <div className="px-4 pt-4 pb-2">
          <h3 className="text-sm font-semibold text-muted-foreground mb-3 tracking-wide uppercase">Featured Art Styles</h3>
          <div className="relative group/carousel">
            {/* Left arrow */}
            <button
              onClick={() => scrollCarousel("left")}
              className="absolute left-0 top-1/2 -translate-y-1/2 z-10 w-8 h-8 bg-black/70 backdrop-blur-sm border border-white/10 rounded-full flex items-center justify-center text-white opacity-0 group-hover/carousel:opacity-100 transition-opacity hover:bg-white/20"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            <div
              ref={carouselRef}
              className="flex gap-3 overflow-x-auto scrollbar-hide scroll-smooth snap-x snap-mandatory"
              style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
            >
              {ART_STYLES.map((style) => (
                <button
                  key={style.id}
                  onClick={() => handleStyleClick(style)}
                  className={`snap-start shrink-0 relative w-[280px] h-[370px] rounded-xl overflow-hidden group/card cursor-pointer transition-all duration-300 ${selectedStyle === style.id
                    ? "ring-2 ring-primary scale-[1.02]"
                    : "hover:ring-1 hover:ring-border hover:scale-[1.01]"
                    }`}
                >
                  {/* Background – either image or gradient */}
                  {style.image ? (
                    <img src={style.image} alt={style.name} className="absolute inset-0 w-full h-full object-cover" />
                  ) : (
                    <div className={`absolute inset-0 bg-gradient-to-br ${styleGradients[style.id] || "from-gray-700 to-gray-500"}`} />
                  )}
                  {/* Dark overlay */}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
                  {/* Label */}
                  <div className="absolute bottom-0 left-0 right-0 p-2.5">
                    <p className="text-xs font-semibold text-white leading-tight">{style.name}</p>
                  </div>
                </button>
              ))}
            </div>

            {/* Right arrow */}
            <button
              onClick={() => scrollCarousel("right")}
              className="absolute right-0 top-1/2 -translate-y-1/2 z-10 w-8 h-8 bg-black/70 backdrop-blur-sm border border-white/10 rounded-full flex items-center justify-center text-white opacity-0 group-hover/carousel:opacity-100 transition-opacity hover:bg-white/20"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* ── Bing Image Search Results (separate from Discover, not affected by filters) ── */}
        {(bingResults.length > 0 || isBingSearching || bingSearchError) && (
          <div className="px-4 pt-4 pb-2">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Globe className="w-4 h-4 text-primary" />
                <h3 className="text-sm font-semibold text-muted-foreground tracking-wide uppercase">Search Results</h3>
                {bingResults.length > 0 && (
                  <span className="text-[10px] bg-primary/15 text-primary px-2 py-0.5 rounded-full font-medium">
                    {bingResults.length} found
                  </span>
                )}
              </div>
              {bingResults.length > 0 && (
                <button
                  onClick={() => { setBingResults([]); setLastBingQuery(""); setSearchQuery("") }}
                  className="text-[10px] text-muted-foreground hover:text-foreground transition-colors underline"
                >
                  Clear results
                </button>
              )}
            </div>

            {/* Error state */}
            {bingSearchError && (
              <div className="mb-3 p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-xs">
                {bingSearchError}
              </div>
            )}

            {/* Loading skeleton */}
            {isBingSearching && bingResults.length === 0 && (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-2 mb-4">
                {Array.from({ length: 12 }).map((_, i) => (
                  <div key={`skel-${i}`} className="relative aspect-[3/4] rounded-lg overflow-hidden bg-muted animate-pulse">
                    <div className="absolute inset-0 flex items-center justify-center">
                      <Loader2 className="w-5 h-5 text-muted-foreground/30 animate-spin" />
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Bing search result grid */}
            {bingResults.length > 0 && (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-2 mb-4">
                {bingResults.map((img) => (
                  <div
                    key={img.id}
                    onClick={() => setMaximizedMedia({ url: img.originalUrl || img.thumbnailUrl, name: img.title, type: 'image' })}
                    className="relative aspect-[3/4] rounded-lg overflow-hidden cursor-pointer group/card hover:ring-1 hover:ring-primary/50 transition-all bg-muted"
                  >
                    {/* Use thumbnail for grid performance, original for maximize */}
                    <img
                      src={img.thumbnailUrl || img.originalUrl}
                      alt={img.title}
                      loading="lazy"
                      className="absolute inset-0 w-full h-full object-cover transition-transform duration-300 group-hover/card:scale-105"
                      onError={(e) => {
                        // Fallback if thumbnail fails: try original
                        const target = e.target as HTMLImageElement
                        if (target.src !== img.originalUrl && img.originalUrl) {
                          target.src = img.originalUrl
                        }
                      }}
                    />
                    {/* Hover overlay */}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent opacity-0 group-hover/card:opacity-100 transition-opacity duration-200" />

                    {/* Bottom info + download */}
                    <div className="absolute bottom-0 left-0 right-0 p-2 opacity-0 group-hover/card:opacity-100 transition-opacity duration-200">
                      <p className="text-[10px] font-medium text-white truncate mb-1.5">{img.title}</p>
                      <div className="flex items-center justify-between">
                        <span className="text-[9px] text-white/60 truncate max-w-[60%]">{img.sourceName}</span>
                        <button
                          onClick={(e) => currentProject ? handleBingImportToProject(e, img) : handleBingDownload(e, img)}
                          disabled={downloadingId === img.id || importingBingId === img.id}
                          className="flex items-center gap-1 bg-white/20 hover:bg-white/30 backdrop-blur-sm text-white text-[10px] font-medium px-2 py-1 rounded-full transition-all disabled:opacity-50"
                        >
                          {downloadingId === img.id || importingBingId === img.id ? (
                            <Loader2 className="w-3 h-3 animate-spin" />
                          ) : (
                            <Download className="w-3 h-3" />
                          )}
                          {currentProject ? "Import to project" : "Download"}
                        </button>
                      </div>
                    </div>

                    {/* Source badge */}
                    <div className="absolute top-1.5 right-1.5 opacity-0 group-hover/card:opacity-100 transition-opacity">
                      <a
                        href={img.sourceUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="flex items-center gap-0.5 bg-black/50 backdrop-blur-sm text-white/80 text-[9px] px-1.5 py-0.5 rounded-full hover:bg-black/70 transition-colors"
                      >
                        <ExternalLink className="w-2.5 h-2.5" />
                        Source
                      </a>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── Gallery Section with Tab Toggle ── Hidden when search results are active */}
        {!hasActiveSearch && <div className="px-4 pt-4 pb-2">
          {/* Tab Toggle: Discover / Generated Assets */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center bg-background/50 border border-border rounded-full p-0.5">
              <button
                onClick={() => setGalleryTab("discover")}
                className={`flex items-center gap-1.5 px-4 py-1.5 rounded-full text-xs font-semibold transition-all duration-300 ${galleryTab === "discover"
                  ? "bg-foreground text-background shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <Sparkles className="w-3.5 h-3.5" />
                Discover
              </button>
              <button
                onClick={() => setGalleryTab("generated")}
                className={`flex items-center gap-1.5 px-4 py-1.5 rounded-full text-xs font-semibold transition-all duration-300 ${galleryTab === "generated"
                  ? "bg-foreground text-background shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <FolderOpen className="w-3.5 h-3.5" />
                Generated Assets
              </button>
            </div>
            {galleryTab === "discover" && activeFilterCount > 0 && (
              <div className="flex items-center gap-2">
                <div className="flex flex-wrap gap-1">
                  {Object.entries(appliedFilters).flatMap(([groupId, values]) =>
                    values.map(v => {
                      const group = FILTER_GROUPS.find(g => g.id === groupId)
                      const opt = group?.options.find(o => o.value === v)
                      return (
                        <span key={`${groupId}-${v}`} className="text-[10px] bg-primary/15 text-primary px-2 py-0.5 rounded-full font-medium">
                          {opt?.label || v}
                        </span>
                      )
                    })
                  )}
                </div>
                <button
                  onClick={resetFilters}
                  className="text-[10px] text-muted-foreground hover:text-foreground transition-colors underline"
                >
                  Clear
                </button>
              </div>
            )}
            {galleryTab === "generated" && assetsLoaded && (
              <button
                onClick={() => { setAssetsLoaded(false) }}
                className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground transition-colors"
              >
                <RotateCcw className="w-3 h-3" />
                Refresh
              </button>
            )}
          </div>

          {/* ── DISCOVER TAB ── */}
          {galleryTab === "discover" && (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-2">
            {/* Search fallback for Discover gallery */}
            {searchQuery.trim() && filteredGallery.length === 0 && (
              <div className="col-span-full flex flex-col items-center justify-center py-14 px-6 text-center bg-muted/20 backdrop-blur-sm border border-dashed border-border rounded-[32px] my-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
                <div className="w-16 h-16 bg-background/50 rounded-full flex items-center justify-center mb-4 shadow-inner">
                  <Search className="w-8 h-8 text-primary/40" />
                </div>
                <h4 className="text-lg font-bold text-foreground mb-2">No local matches found</h4>
                <p className="text-sm text-muted-foreground mb-8 max-w-sm">
                  We couldn't find any results in the local gallery for <span className="text-foreground font-semibold">"{searchQuery}"</span>. Try an advanced search across the web.
                </p>
                <button
                  onClick={handleSearchClick}
                  className="flex items-center gap-3 bg-foreground text-background px-8 py-3.5 rounded-full text-sm font-bold hover:bg-foreground/90 transition-all shadow-[0_8px_30px_rgb(0,0,0,0.12)] active:scale-95 group"
                >
                  <Globe className="w-4 h-4 group-hover:rotate-12 transition-transform duration-500" />
                  Advance Search
                </button>
              </div>
            )}

            {/* Show gallery items from data file */}
            {filteredGallery.map((item) => (
              <div
                key={`gallery-${item.id}`}
                onClick={() => setMaximizedMedia({ url: item.url, name: item.name, type: item.type })}
                className="relative aspect-[3/4] rounded-lg overflow-hidden cursor-pointer group/card hover:ring-1 hover:ring-border transition-all bg-muted"
              >
                {item.type === 'video' ? (
                  <video src={item.url} className="absolute inset-0 w-full h-full object-cover" muted />
                ) : (
                  <img src={item.url} alt={item.name} className="absolute inset-0 w-full h-full object-cover" />
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent opacity-0 group-hover/card:opacity-100 transition-opacity" />
                <div className="absolute bottom-0 left-0 right-0 p-2 opacity-0 group-hover/card:opacity-100 transition-opacity">
                  <p className="text-[10px] font-medium text-white truncate">{item.name}</p>
                </div>
                {item.type === 'video' && (
                  <div className="absolute bottom-1 right-1 bg-black/60 text-[10px] text-white px-1 rounded flex gap-1 items-center">
                    <Film className="w-3 h-3" /> VIDEO
                  </div>
                )}
              </div>
            ))}
            {/* Show generated images */}
            {images.slice(-12).map((img, idx) => (
              <div
                key={`img-${idx}`}
                onClick={() => setMaximizedMedia({ url: img.url, name: img.view || 'Generated Image', type: 'image' })}
                className="relative aspect-[3/4] rounded-lg overflow-hidden cursor-pointer group/card hover:ring-1 hover:ring-border transition-all bg-muted"
              >
                <img src={img.url} alt="" className="absolute inset-0 w-full h-full object-cover" />
                <div className="absolute inset-0 bg-black/0 group-hover/card:bg-black/20 transition-colors" />
              </div>
            ))}
            {/* Show generated videos */}
            {generatedVideos.filter(v => v.url || (v as any).videoUrl).slice(-6).map((vid, idx) => (
              <div
                key={`vid-${idx}`}
                onClick={() => setMaximizedMedia({ url: (vid as any).videoUrl || vid.url, name: 'Generated Video', type: 'video' })}
                className="relative aspect-[3/4] rounded-lg overflow-hidden cursor-pointer group/card hover:ring-1 hover:ring-border transition-all bg-muted flex items-center justify-center"
              >
                {(vid as any).videoUrl || vid.url ? (
                  <video src={(vid as any).videoUrl || vid.url} className="absolute inset-0 w-full h-full object-cover" />
                ) : (
                  <Film className="w-8 h-8 text-muted-foreground" />
                )}
                <div className="absolute inset-0 bg-black/0 group-hover/card:bg-black/20 transition-colors" />
                <div className="absolute bottom-1 right-1 bg-black/60 text-[10px] text-white px-1 rounded flex gap-1 items-center">
                  <Film className="w-3 h-3" /> VIDEO
                </div>
              </div>
            ))}
            {/* Placeholder cards if nothing at all */}
            {filteredGallery.length === 0 && images.length === 0 && generatedVideos.filter(v => v.url || (v as any).videoUrl).length === 0 && INSPIRATION_ITEMS.map((item) => (
              <div
                key={item.id}
                className="relative aspect-[3/4] rounded-lg overflow-hidden bg-muted border border-border"
              >
                <div className="absolute inset-0 flex items-center justify-center">
                  {item.type === "image" ? (
                    <ImageIcon className="w-6 h-6 text-muted-foreground" />
                  ) : (
                    <Film className="w-6 h-6 text-muted-foreground" />
                  )}
                </div>
              </div>
            ))}
            {/* Discover More button for matched results */}
            {searchQuery.trim() && filteredGallery.length > 0 && (
              <div className="col-span-full flex flex-col items-center justify-center py-12 mt-10 border-t border-dashed border-border/30 animate-in fade-in slide-in-from-bottom-6 duration-700">
                <div className="text-center mb-6">
                  <p className="text-xs font-medium text-muted-foreground/60 uppercase tracking-widest mb-1">End of local results</p>
                  <h5 className="text-lg font-bold text-foreground">Can't find what you're looking for?</h5>
                </div>
                <button
                  onClick={handleSearchClick}
                  className="flex items-center gap-3 bg-foreground text-background px-10 py-4 rounded-full text-sm font-bold hover:bg-foreground/90 hover:scale-105 transition-all shadow-[0_15px_40px_rgba(0,0,0,0.15)] active:scale-95 group"
                >
                  <Globe className="w-5 h-5 group-hover:rotate-45 transition-transform duration-500" />
                  Discover more for "{searchQuery}"
                </button>
              </div>
            )}
          </div>
          )}

          {/* ── GENERATED ASSETS TAB ── */}
          {galleryTab === "generated" && (
          <div>
            {/* Loading */}
            {isLoadingAssets && (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-2">
                {Array.from({ length: 12 }).map((_, i) => (
                  <div key={`asset-skel-${i}`} className="relative aspect-[3/4] rounded-lg overflow-hidden bg-muted animate-pulse">
                    <div className="absolute inset-0 flex items-center justify-center">
                      <Loader2 className="w-5 h-5 text-muted-foreground/30 animate-spin" />
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Not logged in */}
            {!isAuthenticated && (
              <div className="flex flex-col items-center justify-center py-20 text-center">
                <FolderOpen className="w-12 h-12 text-muted-foreground/30 mb-4" />
                <h4 className="text-sm font-semibold text-foreground mb-1">Login Required</h4>
                <p className="text-xs text-muted-foreground">Sign in to view your generated assets.</p>
              </div>
            )}

            {/* Empty state */}
            {isAuthenticated && assetsLoaded && !isLoadingAssets && userAssets.length === 0 && (
              <div className="flex flex-col items-center justify-center py-20 text-center">
                <div className="w-16 h-16 bg-muted/50 rounded-full flex items-center justify-center mb-4">
                  <ImageIcon className="w-8 h-8 text-muted-foreground/40" />
                </div>
                <h4 className="text-sm font-semibold text-foreground mb-1">No assets yet</h4>
                <p className="text-xs text-muted-foreground max-w-xs">Generate your first image or video using the prompt bar below.</p>
              </div>
            )}

            {/* Assets Masonry Grid - respects original dimensions */}
            {isAuthenticated && assetsLoaded && !isLoadingAssets && userAssets.length > 0 && (
              <div className="columns-2 sm:columns-3 md:columns-4 lg:columns-5 xl:columns-6 gap-2 space-y-2">
                {userAssets.map((asset) => {
                  const isVideo = asset.assetType === "video"
                  return (
                    <div
                      key={asset.id}
                      onClick={() => setMaximizedMedia({
                        url: asset.url,
                        name: asset.name,
                        type: isVideo ? 'video' : 'image'
                      })}
                      className="relative break-inside-avoid rounded-lg overflow-hidden cursor-pointer group/card hover:ring-1 hover:ring-primary/50 transition-all bg-muted"
                    >
                      {isVideo ? (
                        <video
                          src={asset.url}
                          className="w-full h-auto object-contain block"
                          muted
                          preload="metadata"
                        />
                      ) : (
                        <img
                          src={asset.url}
                          alt={asset.name}
                          className="w-full h-auto object-contain block"
                          loading="lazy"
                        />
                      )}
                      {/* Hover overlay */}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/10 to-transparent opacity-0 group-hover/card:opacity-100 transition-opacity duration-200" />
                      {/* Bottom info */}
                      <div className="absolute bottom-0 left-0 right-0 p-2 opacity-0 group-hover/card:opacity-100 transition-opacity duration-200">
                        <p className="text-[10px] font-medium text-white truncate">{asset.name.substring(0, 24)}</p>
                        <p className="text-[9px] text-white/50 mt-0.5">{new Date(asset.createdAt).toLocaleDateString()}</p>
                      </div>
                      {/* Video badge */}
                      {isVideo && (
                        <div className="absolute bottom-1 right-1 bg-black/60 text-[10px] text-white px-1 rounded flex gap-1 items-center">
                          <Film className="w-3 h-3" /> VIDEO
                        </div>
                      )}
                      {/* Import to project icon */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          setImportPopup({
                            isOpen: true,
                            url: asset.url,
                            type: isVideo ? "video" : "image",
                            name: asset.name,
                          })
                        }}
                        className="absolute bottom-1.5 right-1.5 w-7 h-7 rounded-lg bg-black/60 backdrop-blur-sm flex items-center justify-center text-white opacity-0 group-hover/card:opacity-100 hover:bg-primary/80 transition-all z-10"
                        title="Import to project"
                      >
                        <FolderInput className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
          )}
        </div>}
      </div>

      {/* ── Bottom Input Bar ── */}
      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-background via-background to-transparent pt-8 pb-4 px-4 flex justify-center">
        <div className="w-full max-w-3xl relative">
          {/* Attached image preview */}
          {attachedImagePreview && (
            <div className="mb-2 flex items-center gap-2 px-2">
              <div
                className="relative w-12 h-12 rounded-lg overflow-hidden border border-border cursor-pointer hover:opacity-80 transition-opacity"
                onClick={() => setMaximizedMedia({ url: attachedImagePreview, name: 'Attached Image', type: 'image' })}
              >
                <img src={attachedImagePreview} alt="Attached" className="w-full h-full object-cover" />
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    clearAttachedImage();
                  }}
                  className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full flex items-center justify-center hover:bg-red-600 transition-colors"
                >
                  <X className="w-3 h-3 text-white" />
                </button>
              </div>
              <span className="text-xs text-muted-foreground">Image attached</span>
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="mb-2 mx-2 p-2 bg-red-500/10 border border-red-500/30 rounded-lg text-red-500 text-xs font-mono">
              {error}
            </div>
          )}

          {/* Input container */}
          <div className="relative bg-muted/60 backdrop-blur-xl border border-border rounded-2xl focus-within:ring-1 focus-within:ring-border transition-all">
            {/* Image upload button (top left inside the bar) */}
            <div className="flex flex-col sm:flex-row items-start pt-2 px-2 pb-0">
              {modelSupportsImage() && (
                <label className="shrink-0 w-16 h-16 flex flex-col items-center justify-center cursor-pointer text-muted-foreground hover:text-foreground hover:bg-muted transition-all rounded-xl ml-2 mt-2 border border-border/50 bg-background/50 hover:scale-[1.02] shadow-sm group">
                  <div className="relative">
                    <ImageIcon className="w-7 h-7" />
                    <div className="absolute -top-1 -right-1 bg-primary rounded-full p-0.5">
                      <Plus className="w-2.5 h-2.5 text-primary-foreground" />
                    </div>
                  </div>
                  <span className="text-[9px] font-bold mt-1 uppercase tracking-tighter opacity-60 group-hover:opacity-100">Add Image</span>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleAttachImage}
                    className="hidden"
                    disabled={!isAuthenticated}
                  />
                </label>
              )}
              <textarea
                ref={promptTextareaRef}
                value={prompt}
                onChange={(e) => {
                  const value = e.target.value
                  setPrompt(value)
                  updateMentionState("generate", value, e.target.selectionStart ?? value.length)
                }}
                placeholder={
                  isAuthenticated
                    ? (currentProject ? "Type to imagine... (use @ to mention project files)" : "Type to imagine...")
                    : "Please login to generate"
                }
                className="media-mention-input flex-1 w-full bg-transparent text-foreground placeholder:text-muted-foreground p-3 text-sm resize-none focus:outline-none min-h-[80px] max-h-[200px]"
                rows={3}
                disabled={!isAuthenticated || isGenerating}
                onKeyDown={(e) => {
                  if (handleMentionKeyDown(e)) return
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault()
                    handleGenerate()
                  }
                }}
              />
            </div>

            {showMentionSuggestions && mentionTarget === "generate" && currentProject && filteredMentionFiles.length > 0 && (
              <div
                ref={mentionSuggestionsRef}
                className="media-mention-suggestions absolute left-3 right-3 bottom-[calc(100%+8px)] max-h-52 overflow-y-auto bg-background border border-border rounded-xl shadow-xl z-50"
              >
                {filteredMentionFiles.map((item, index) => (
                  <button
                    key={`gen-mention-${item.path}`}
                    onClick={() => insertMentionIntoTarget(item)}
                    className={`w-full text-left px-3 py-2 text-xs flex items-center gap-2 border-b border-border/20 last:border-b-0 ${index === selectedMentionIndex ? "bg-muted text-foreground" : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"}`}
                  >
                    {item.type === "folder" ? <FolderClosed className="w-3.5 h-3.5 shrink-0" /> : <FileIcon className="w-3.5 h-3.5 shrink-0" />}
                    <span className="truncate">{item.path}</span>
                  </button>
                ))}
              </div>
            )}

            {/* Bottom toolbar */}
            <div className="flex items-center justify-between px-3 pb-2.5 pt-0.5">
              {/* Left side: type toggle + ratio */}
              <div className="flex items-center gap-2">
                {/* Image / Video toggle */}
                <div className="flex items-center bg-background border border-border rounded-full p-0.5">
                  <button
                    onClick={() => setGenType("image")}
                    className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium transition-all ${genType === "image"
                      ? "bg-foreground text-background shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                      }`}
                  >
                    <ImageIcon className="w-3 h-3" />
                    Image
                  </button>
                  <button
                    onClick={() => setGenType("video")}
                    className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium transition-all ${genType === "video"
                      ? "bg-foreground text-background shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                      }`}
                  >
                    <Film className="w-3 h-3" />
                    Video
                  </button>
                </div>

                {/* Aspect Ratio Custom Dropdown */}
                <div className="relative media-dropdown-element">
                  <button
                    onClick={() => {
                      setShowRatioSelect(!showRatioSelect)
                      setShowModelSelect(false)
                    }}
                    className="flex items-center gap-2 bg-background border border-border text-foreground text-xs px-3 py-1 rounded-full hover:bg-muted transition-colors focus:ring-1 focus:ring-ring"
                  >
                    {/* Shape Rendering */}
                    {(() => {
                      const r = genType === "image" ? imageRatio : videoRatio
                      if (r === "1360:768" || r === "1920:1080" || r === "1280:720") return <RectangleHorizontal className="w-3.5 h-3.5" />
                      if (r === "720:1280" || r === "1080:1920") return <RectangleVertical className="w-3.5 h-3.5" />
                      if (r === "1024:1024" || r === "1080:1080" || r === "960:960") return <Square className="w-3.5 h-3.5" />
                      return <RectangleHorizontal className="w-3.5 h-3.5" />
                    })()}
                    <span>
                      {genType === "image"
                        ? IMAGE_RATIOS.find(x => x.value === imageRatio)?.label
                        : VIDEO_RATIOS.find(x => x.value === videoRatio)?.label}
                    </span>
                    <ChevronRight className={showRatioSelect ? "w-3 h-3 text-muted-foreground -rotate-90 transition-transform" : "w-3 h-3 text-muted-foreground rotate-90 transition-transform"} />
                  </button>

                  {showRatioSelect && (
                    <div className="absolute bottom-[calc(100%+8px)] left-0 min-w-[120px] bg-background border border-border rounded-xl shadow-xl overflow-hidden py-1 z-50 animate-in fade-in zoom-in-95 duration-100">
                      {(genType === "image" ? IMAGE_RATIOS : VIDEO_RATIOS).map((r) => (
                        <button
                          key={r.value}
                          onClick={() => {
                            if (genType === "image") setImageRatio(r.value as RunwayRatio)
                            else setVideoRatio(r.value as RunwayVideoRatio)
                            setShowRatioSelect(false)
                          }}
                          className={`w-full text-left flex items-center gap-2 px-3 py-2 text-xs transition-colors ${(genType === "image" ? imageRatio === r.value : videoRatio === r.value)
                            ? "bg-muted text-foreground font-medium"
                            : "text-muted-foreground hover:bg-muted hover:text-foreground"
                            }`}
                        >
                          {(() => {
                            const val = r.value
                            if (val === "1360:768" || val === "1920:1080" || val === "1280:720") return <RectangleHorizontal className="w-3 h-3" />
                            if (val === "720:1280" || val === "1080:1920") return <RectangleVertical className="w-3 h-3" />
                            if (val === "1024:1024" || val === "1080:1080" || val === "960:960") return <Square className="w-3 h-3" />
                            return <RectangleHorizontal className="w-3 h-3" />
                          })()}
                          {r.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Model Custom Dropdown */}
                <div className="relative media-dropdown-element">
                  <button
                    onClick={() => {
                      setShowModelSelect(!showModelSelect)
                      setShowRatioSelect(false)
                    }}
                    className="flex items-center gap-2 bg-background border border-border text-foreground text-xs px-3 py-1 rounded-full hover:bg-muted transition-colors focus:ring-1 focus:ring-ring max-w-[160px]"
                  >
                    <span className="truncate">{genType === "image" ? imageModel : videoModel}</span>
                    <ChevronRight className={showModelSelect ? "w-3 h-3 shrink-0 text-muted-foreground -rotate-90 transition-transform" : "w-3 h-3 shrink-0 text-muted-foreground rotate-90 transition-transform"} />
                  </button>

                  {showModelSelect && (
                    <div className="absolute bottom-[calc(100%+8px)] left-0 min-w-[160px] bg-background border border-border rounded-xl shadow-xl overflow-hidden py-1 z-50 animate-in fade-in zoom-in-95 duration-100">
                      {Object.entries(
                        genType === "image"
                          ? { "gen4_image_turbo": "gen4_image_turbo", "gen4_image": "gen4_image", "gemini_2.5_flash": "gemini_2.5_flash" }
                          : { "gen4.5": "gen4.5", "gen4_turbo": "gen4_turbo", "veo3.1": "veo3.1", "veo3.1_fast": "veo3.1_fast" }
                      ).map(([val, label]) => (
                        <button
                          key={val}
                          onClick={() => {
                            if (genType === "image") setImageModel(val as RunwayImageModel)
                            else setVideoModel(val as RunwayVideoModel)
                            setShowModelSelect(false)
                          }}
                          className={`w-full text-left px-3 py-2 text-xs transition-colors ${(genType === "image" ? imageModel === val : videoModel === val)
                            ? "bg-muted text-foreground font-medium"
                            : "text-muted-foreground hover:bg-muted hover:text-foreground"
                            }`}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Right side: video controls (duration + audio) + generate */}
              <div className="flex items-center gap-2">
                {genType === "video" && (
                  <div className="flex items-center gap-1 bg-background border border-border rounded-full p-0.5">
                    {/* Duration Toggle */}
                    <button
                      onClick={() => setVideoDuration(prev => prev === 5 ? 10 : 5)}
                      className="flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold text-muted-foreground hover:text-foreground hover:bg-muted transition-all"
                      title="Set video duration"
                    >
                      <Clock className="w-3.5 h-3.5" />
                      {videoDuration}s
                    </button>
                    {/* Audio Toggle */}
                    <button
                      onClick={() => setVideoWithAudio(!videoWithAudio)}
                      className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold transition-all ${videoWithAudio ? "text-primary hover:bg-primary/10" : "text-muted-foreground hover:bg-muted"
                        }`}
                      title={videoWithAudio ? "Audio enabled" : "Audio disabled"}
                    >
                      {videoWithAudio ? <Volume2 className="w-3.5 h-3.5" /> : <VolumeX className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                )}
                {/* Generate button */}
                <button
                  onClick={handleGenerate}
                  disabled={isGenerating || !prompt.trim() || !isAuthenticated || (genType === "video" && videoModel === "gen4_turbo" && !attachedImage)}
                  className="w-10 h-10 bg-foreground text-background rounded-full flex items-center justify-center hover:scale-105 active:scale-95 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                >
                  {isGenerating ? (
                    <div className="w-5 h-5 border-2 border-background border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="12" y1="19" x2="12" y2="5" />
                      <polyline points="5 12 12 5 19 12" />
                    </svg>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Image Maximisation Overlay ── */}
      <AnimatePresence>
        {maximizedMedia && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => { if (!isEditMode) { setMaximizedMedia(null); setIsEditMode(false); setEditPrompt(""); setEditError(null); clearEditReferenceImage(); closeMentionSuggestions() } }}
            className="fixed inset-0 z-[100] bg-background/40 backdrop-blur-xl flex flex-col overflow-hidden"
          >
            {/* Media Container - in edit mode: fills from top to edit bar; normal: centered 80vh */}
            <motion.div
              initial={{ scale: 0.97, opacity: 0, y: 16 }}
              animate={{
                scale: 1,
                opacity: 1,
                y: 0,
              }}
              exit={{ scale: 0.97, opacity: 0, y: 16 }}
              transition={{ duration: 0.4, ease: [0.4, 0, 0.2, 1] }}
              onClick={(e) => e.stopPropagation()}
              className={`relative mx-auto w-fit max-w-3xl overflow-hidden group ${isEditMode ? 'flex-1 min-h-0 mt-0 mb-0' : 'my-auto'}`}
              style={{
                height: isEditMode ? undefined : '80vh',
                transition: 'height 0.5s cubic-bezier(0.4, 0, 0.2, 1), flex 0.5s cubic-bezier(0.4, 0, 0.2, 1), margin 0.5s cubic-bezier(0.4, 0, 0.2, 1)',
              }}
            >


              {/* Foreground Media */}
              <div className="relative z-10 h-full w-auto flex items-center justify-center p-3">
                {maximizedMedia.type === 'image' ? (
                  <img
                    src={maximizedMedia.url}
                    alt={maximizedMedia.name}
                    className="h-full w-auto max-w-full object-contain rounded-2xl"
                    style={{ transition: 'all 0.5s cubic-bezier(0.4, 0, 0.2, 1)' }}
                  />
                ) : (
                  <video
                    src={maximizedMedia.url}
                    className="h-full w-auto max-w-full object-contain rounded-2xl"
                    style={{ transition: 'all 0.5s cubic-bezier(0.4, 0, 0.2, 1)' }}
                    autoPlay
                    loop
                    controls
                  />
                )}
              </div>

              {/* Top controls (X button) */}
              <div className="absolute top-4 right-4 z-[30] pointer-events-auto">
                <button
                  onClick={() => { setMaximizedMedia(null); setIsEditMode(false); setEditPrompt(""); setEditError(null); clearEditReferenceImage(); closeMentionSuggestions() }}
                  className="w-10 h-10 bg-black/60 backdrop-blur-xl text-white rounded-full flex items-center justify-center border border-white/20 hover:bg-black/80 hover:scale-110 transition-all shadow-lg"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Top Left (Asset Name - first 8 chars) */}
              <div className="absolute top-4 left-4 z-[30] pointer-events-none">
                <div className="bg-black/60 backdrop-blur-xl px-4 py-2 rounded-full border border-white/20 shadow-lg pointer-events-auto">
                  <span className="text-white text-sm font-medium tracking-wide">{maximizedMedia.name.substring(0, 8)}{maximizedMedia.name.length > 8 ? '…' : ''}</span>
                </div>
              </div>

              {/* Bottom controls (Edit + Download) - hidden when in edit mode */}
              {!isEditMode && (
                <div className="absolute bottom-4 right-4 z-[30] pointer-events-auto flex items-center gap-2">
                  <button
                    onClick={() => {
                      setIsEditMode(true)
                      setEditError(null)
                      setEditPrompt("")
                      clearEditReferenceImage()
                      closeMentionSuggestions()
                    }}
                    className="flex items-center gap-2 bg-white/10 hover:bg-white/20 backdrop-blur-xl text-white px-5 py-3 rounded-full border border-white/20 transition-all shadow-xl hover:scale-105 active:scale-95"
                  >
                    <Pencil className="w-4 h-4" />
                    <span className="text-sm font-semibold">Edit</span>
                  </button>
                  <button
                    onClick={async () => {
                      if (maximizedMedia.type === "image" && currentProject) {
                        await handleSaveCurrentImageToProject()
                        return
                      }
                      const safeName = maximizedMedia.name.replace(/\s+/g, '-').toLowerCase()
                      const ext = maximizedMedia.type === 'video' ? 'mp4' : 'png'
                      const fileName = `${safeName}-${Date.now()}.${ext}`
                      await downloadImageSafe(maximizedMedia.url, fileName)
                    }}
                    className="flex items-center gap-2 bg-primary/90 hover:bg-primary backdrop-blur-xl text-primary-foreground px-6 py-3 rounded-full border border-white/10 transition-all shadow-xl hover:scale-105 active:scale-95"
                  >
                    <Download className="w-4 h-4" />
                    <span className="text-sm font-semibold">
                      {maximizedMedia.type === "image" && currentProject ? "Save to project" : "Download"}
                    </span>
                  </button>
                </div>
              )}
            </motion.div>

            {/* ── Edit Input Panel (slides up from bottom, compact like media gen bar) ── */}
            <AnimatePresence>
              {isEditMode && (
                <motion.div
                  initial={{ y: 60, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  exit={{ y: 60, opacity: 0 }}
                  transition={{ type: "spring", stiffness: 300, damping: 30 }}
                  onClick={(e) => e.stopPropagation()}
                  className="shrink-0 bg-transparent pb-4 pt-3 px-4 flex justify-center"
                >
                  <div className="w-full max-w-3xl relative">
                    {/* Edit error */}
                    {editError && (
                      <div className="mb-2 mx-2 p-2 bg-red-500/10 border border-red-500/30 rounded-lg text-red-500 text-xs font-mono">
                        {editError}
                      </div>
                    )}

                    {/* Edit loading indicator */}
                    {isEditing && (
                      <div className="mb-2 mx-2 flex items-center gap-2 text-xs text-muted-foreground">
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>{maximizedMedia.type === 'image' ? 'Editing image...' : 'Editing video with gen4_aleph...'}</span>
                      </div>
                    )}

                      {/* Optional reference image for edit mode */}
                      {maximizedMedia.type === 'image' && editReferenceImagePreview && (
                        <div className="px-3 pt-3">
                          <div className="flex items-center gap-2">
                            <div
                              className="relative w-12 h-12 rounded-lg overflow-hidden border border-border cursor-pointer hover:opacity-80 transition-opacity"
                              onClick={() => setMaximizedMedia({ url: editReferenceImagePreview, name: 'Edit Reference', type: 'image' })}
                            >
                              <img src={editReferenceImagePreview} alt="Edit reference" className="w-full h-full object-cover" />
                              <button
                                onClick={(e) => {
                                  e.stopPropagation()
                                  clearEditReferenceImage()
                                }}
                                className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full flex items-center justify-center hover:bg-red-600 transition-colors"
                              >
                                <X className="w-3 h-3 text-white" />
                              </button>
                            </div>
                            <span className="text-xs text-muted-foreground">Optional reference attached</span>
                          </div>
                        </div>
                      )}

                    {/* Compact input container (matches media gen input bar) */}
                    <div className="relative bg-muted/60 backdrop-blur-xl border border-border rounded-2xl focus-within:ring-1 focus-within:ring-border transition-all">
                      {maximizedMedia.type === 'image' && (
                        <label
                          className="absolute top-3 left-3 z-10 w-9 h-9 rounded-full bg-background/80 border border-border flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted cursor-pointer transition-colors"
                          title="Upload reference image"
                        >
                          <Plus className="w-4 h-4" />
                          <input
                            type="file"
                            accept="image/*"
                            onChange={handleEditReferenceImage}
                            className="hidden"
                            disabled={isEditing}
                          />
                        </label>
                      )}
                      <textarea
                        ref={editPromptTextareaRef}
                        value={editPrompt}
                        onChange={(e) => {
                          const value = e.target.value
                          setEditPrompt(value)
                          updateMentionState("edit", value, e.target.selectionStart ?? value.length)
                        }}
                        placeholder={maximizedMedia.type === 'image'
                          ? (currentProject ? "Describe how to edit this image... (use @ to mention project files)" : "Describe how to edit this image...")
                          : "Describe how to edit this video..."
                        }
                        className={`media-mention-input w-full bg-transparent text-foreground placeholder:text-muted-foreground p-3 text-sm resize-none focus:outline-none min-h-[80px] max-h-[200px] ${maximizedMedia.type === 'image' ? 'pl-14' : ''}`}
                        rows={3}
                        disabled={isEditing}
                        onKeyDown={(e) => {
                          if (handleMentionKeyDown(e)) return
                          if (e.key === "Enter" && !e.shiftKey) {
                            e.preventDefault()
                            handleEditAsset()
                          }
                        }}
                      />

                      {showMentionSuggestions && mentionTarget === "edit" && currentProject && filteredMentionFiles.length > 0 && (
                        <div className="media-mention-suggestions absolute left-3 right-3 bottom-[calc(100%+8px)] max-h-52 overflow-y-auto bg-background border border-border rounded-xl shadow-xl z-50">
                          {filteredMentionFiles.map((item, index) => (
                            <button
                              key={`edit-mention-${item.path}`}
                              onClick={() => insertMentionIntoTarget(item)}
                              className={`w-full text-left px-3 py-2 text-xs flex items-center gap-2 border-b border-border/20 last:border-b-0 ${index === selectedMentionIndex ? "bg-muted text-foreground" : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"}`}
                            >
                              {item.type === "folder" ? <FolderClosed className="w-3.5 h-3.5 shrink-0" /> : <FileIcon className="w-3.5 h-3.5 shrink-0" />}
                              <span className="truncate">{item.path}</span>
                            </button>
                          ))}
                        </div>
                      )}

                      {/* Edit Bottom Toolbar */}
                      <div className="flex items-center justify-between px-3 pb-2.5 pt-0.5">
                        <div className="flex items-center gap-2">
                          {/* Model and Ratio controls - only for image editing */}
                          {maximizedMedia.type === 'image' && (
                            <>
                              {/* Edit Model Dropdown */}
                              <div className="relative media-dropdown-element">
                                <button
                                  onClick={() => {
                                    setShowEditModelSelect(!showEditModelSelect)
                                    setShowEditRatioSelect(false)
                                  }}
                                  className="flex items-center gap-2 bg-background border border-border text-foreground text-xs px-3 py-1 rounded-full hover:bg-muted transition-colors max-w-[160px]"
                                >
                                  <span className="truncate">{editImageModel}</span>
                                  <ChevronDown className={`w-3 h-3 shrink-0 text-muted-foreground transition-transform ${showEditModelSelect ? 'rotate-180' : ''}`} />
                                </button>
                                {showEditModelSelect && (
                                  <div className="absolute bottom-[calc(100%+8px)] left-0 min-w-[160px] bg-background border border-border rounded-xl shadow-xl overflow-hidden py-1 z-50 animate-in fade-in zoom-in-95 duration-100">
                                    {EDIT_IMAGE_MODELS.map((m) => (
                                      <button
                                        key={m.value}
                                        onClick={() => {
                                          setEditImageModel(m.value)
                                          setShowEditModelSelect(false)
                                        }}
                                        className={`w-full text-left px-3 py-2 text-xs transition-colors ${editImageModel === m.value
                                          ? "bg-muted text-foreground font-medium"
                                          : "text-muted-foreground hover:bg-muted hover:text-foreground"
                                        }`}
                                      >
                                        {m.label}
                                      </button>
                                    ))}
                                  </div>
                                )}
                              </div>

                              {/* Edit Ratio Dropdown */}
                              <div className="relative media-dropdown-element">
                                <button
                                  onClick={() => {
                                    setShowEditRatioSelect(!showEditRatioSelect)
                                    setShowEditModelSelect(false)
                                  }}
                                  className="flex items-center gap-2 bg-background border border-border text-foreground text-xs px-3 py-1 rounded-full hover:bg-muted transition-colors"
                                >
                                  <span>{EDIT_IMAGE_RATIOS.find(r => r.value === editImageRatio)?.label || '1:1'}</span>
                                  <ChevronDown className={`w-3 h-3 shrink-0 text-muted-foreground transition-transform ${showEditRatioSelect ? 'rotate-180' : ''}`} />
                                </button>
                                {showEditRatioSelect && (
                                  <div className="absolute bottom-[calc(100%+8px)] left-0 min-w-[120px] bg-background border border-border rounded-xl shadow-xl overflow-hidden py-1 z-50 animate-in fade-in zoom-in-95 duration-100">
                                    {EDIT_IMAGE_RATIOS.map((r) => (
                                      <button
                                        key={r.value}
                                        onClick={() => {
                                          setEditImageRatio(r.value)
                                          setShowEditRatioSelect(false)
                                        }}
                                        className={`w-full text-left px-3 py-2 text-xs transition-colors ${editImageRatio === r.value
                                          ? "bg-muted text-foreground font-medium"
                                          : "text-muted-foreground hover:bg-muted hover:text-foreground"
                                        }`}
                                      >
                                        {r.label}
                                      </button>
                                    ))}
                                  </div>
                                )}
                              </div>

                              {/* Seed input for image */}
                              <div className="flex items-center gap-1">
                                <input
                                  type="number"
                                  value={editImageSeed}
                                  onChange={(e) => setEditImageSeed(e.target.value)}
                                  placeholder="Seed"
                                  className="w-20 bg-background border border-border text-foreground text-xs px-2 py-1 rounded-full focus:outline-none focus:ring-1 focus:ring-border placeholder:text-muted-foreground/50"
                                />
                              </div>
                            </>
                          )}

                          {/* Video editing - model label only, no seed/ratio */}
                          {maximizedMedia.type === 'video' && (
                            <div className="flex items-center gap-1 bg-background border border-border text-foreground text-xs px-3 py-1 rounded-full">
                              <Film className="w-3 h-3 text-muted-foreground" />
                              <span className="text-muted-foreground">gen4_aleph</span>
                            </div>
                          )}
                        </div>

                        {/* Right side: Cancel + Generate */}
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => { setIsEditMode(false); setEditPrompt(""); setEditError(null); clearEditReferenceImage(); closeMentionSuggestions() }}
                            className="text-xs text-muted-foreground hover:text-foreground transition-colors px-3 py-1"
                          >
                            Cancel
                          </button>
                          <button
                            onClick={handleEditAsset}
                            disabled={isEditing || !editPrompt.trim()}
                            className="w-10 h-10 bg-foreground text-background rounded-full flex items-center justify-center hover:scale-105 active:scale-95 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                          >
                            {isEditing ? (
                              <div className="w-5 h-5 border-2 border-background border-t-transparent rounded-full animate-spin" />
                            ) : (
                              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                <line x1="12" y1="19" x2="12" y2="5" />
                                <polyline points="5 12 12 5 19 12" />
                              </svg>
                            )}
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Loading Screens ── */}
      <ImageGenerationLoader isVisible={isGenerating && genType === "image"} />
      <VideoGenerationLoader isVisible={isGenerating && genType === "video"} />

      {/* ── Import to Project Popup ── */}
      {importPopup && (
        <ImportToProjectPopup
          isOpen={importPopup.isOpen}
          onClose={() => setImportPopup(null)}
          assetUrl={importPopup.url}
          assetType={importPopup.type}
          assetName={importPopup.name}
        />
      )}

      {isImportingToProject && currentProject && (
        <div className="absolute inset-0 z-[120] bg-background/30 backdrop-blur-sm flex items-center justify-center">
          <div className="bg-background/90 border border-border rounded-2xl px-5 py-4 shadow-xl flex items-center gap-3">
            <Loader2 className="w-5 h-5 animate-spin text-primary" />
            <span className="text-sm font-medium text-foreground">Importing asset to {currentProject.name}</span>
          </div>
        </div>
      )}
    </div>
  )
}
