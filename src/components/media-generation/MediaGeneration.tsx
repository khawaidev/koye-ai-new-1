import * as React from "react"
import { motion, AnimatePresence } from "framer-motion"
import { useState, useEffect, useRef, useMemo } from "react"
import { Plus, Image as ImageIcon, Film, ChevronLeft, ChevronRight, Settings, X, RectangleHorizontal, RectangleVertical, Square, Search, Download, SlidersHorizontal, ChevronDown, RotateCcw } from "lucide-react"
import { FILTER_GROUPS, DISCOVER_GALLERY, type FilterGroup } from "../../data/discoverGallery"
import { useAuth } from "../../hooks/useAuth"
import { saveImageToStorage } from "../../lib/imageStorage"
import { uuidv4 } from "../../lib/uuid"
import { saveImage, saveVideo } from "../../services/multiDbDataService"
import {
  generateImageWithRunway,
  generateVideoWithRunway,
  type RunwayImageModel,
  type RunwayRatio,
  type RunwayVideoModel,
  type RunwayVideoRatio,
} from "../../services/runwayml"
import { uploadFileToDataDb } from "../../services/supabase"
import { useAppStore } from "../../store/useAppStore"
import { ImageGenerationLoader } from "../ui/ImageGenerationLoader"
import { VideoGenerationLoader } from "../ui/VideoGenerationLoader"

import sumiImg from "../../../images/sumi.png"
import realisticImg from "../../../images/realistic.png"
import threeDAnimeImg from "../../../images/3d-anime.png"
import twoDAnimeImg from "../../../images/2d-anime.png"
import semiRealisticImg from "../../../images/semi-realistic.png"
import cartoonImg from "../../../images/cartoon.png"
import pixelImg from "../../../images/pixel.png"
import gachaImg from "../../../images/gacha.png"
import mangaImg from "../../../images/manga.png"
import lowpolyImg from "../../../images/lowpoly.png"
import sketchImg from "../../../images/sketch.png"

// ─── Types ───────────────────────────────────────────────────────────────────

type GenerationType = "image" | "video"

// ─── Art Style Definitions ──────────────────────────────────────────────────

const ART_STYLES = [
  { id: "ink", name: "Ink / Sumi-e", tags: "ink wash, sumi-e, brush strokes, minimal, negative space", image: sumiImg },
  { id: "realistic", name: "Realistic", tags: "photorealistic, PBR, cinematic, ultra-detailed", image: realisticImg },
  { id: "3d-anime", name: "3D Anime", tags: "3d anime, semi realistic shading, vibrant", image: threeDAnimeImg },
  { id: "2d-anime", name: "2D Anime", tags: "2d anime, cel shading, line art, vibrant", image: twoDAnimeImg },
  { id: "semi-realistic", name: "Semi-Realistic", tags: "stylized realism, hero design, painterly", image: semiRealisticImg },
  { id: "cartoon", name: "Cartoon", tags: "cartoon, exaggerated, vibrant, playful", image: cartoonImg },
  { id: "pixel", name: "Pixel Art", tags: "pixel, 8-bit, 16-bit, retro", image: pixelImg },
  { id: "gacha", name: "Gacha / Anime", tags: "anime polished, gacha, glossy, high detail", image: gachaImg },
  { id: "comic", name: "Manga / Comic", tags: "comic, inked, bold outline, cel shading", image: mangaImg },
  { id: "lowpoly", name: "Low Poly", tags: "low poly, geometric, simple", image: lowpolyImg },
  { id: "sketch", name: "Sketch / Concept", tags: "rough lines, early-stage look", image: sketchImg },
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

// ─── Component ───────────────────────────────────────────────────────────────

export function MediaGeneration() {
  const { user, isAuthenticated } = useAuth()
  const { currentProject, images, addImage, generatedVideos, addGeneratedVideo } = useAppStore()

  // ── Core state ──
  const [genType, setGenType] = useState<GenerationType>("image")
  const [prompt, setPrompt] = useState("")
  const [isGenerating, setIsGenerating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // ── Image state ──
  const [imageModel, setImageModel] = useState<RunwayImageModel>("gen4_image_turbo")
  const [imageRatio, setImageRatio] = useState<RunwayRatio>("1024:1024")

  // ── Video state ──
  const [videoModel, setVideoModel] = useState<RunwayVideoModel>("gen4.5")
  const [videoRatio, setVideoRatio] = useState<RunwayVideoRatio>("1280:720")
  const [videoDuration, setVideoDuration] = useState<number>(10)

  // ── Maximization state ──
  const [maximizedMedia, setMaximizedMedia] = useState<{ url: string, name: string, type: 'image' | 'video' } | null>(null)

  // ── Image upload state ──
  const [attachedImage, setAttachedImage] = useState<File | null>(null)
  const [attachedImagePreview, setAttachedImagePreview] = useState<string | null>(null)

  // ── Settings panel ──
  const [showSettings, setShowSettings] = useState(false)
  const [showRatioSelect, setShowRatioSelect] = useState(false)
  const [showModelSelect, setShowModelSelect] = useState(false)

  // ── Filter state ──
  const [showFilterPanel, setShowFilterPanel] = useState(false)
  const [pendingFilters, setPendingFilters] = useState<ActiveFilters>({})
  const [appliedFilters, setAppliedFilters] = useState<ActiveFilters>({})
  const [searchQuery, setSearchQuery] = useState("")
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({})
  const filterPanelRef = useRef<HTMLDivElement>(null)

  // ── Close dropdowns on outside click ──
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement
      if (!target.closest('.media-dropdown-element')) {
        setShowRatioSelect(false)
        setShowModelSelect(false)
      }
      if (showFilterPanel && filterPanelRef.current && !filterPanelRef.current.contains(target) && !target.closest('.filter-toggle-btn')) {
        setShowFilterPanel(false)
      }
    }
    document.addEventListener("mousedown", handleClick)
    return () => document.removeEventListener("mousedown", handleClick)
  }, [showFilterPanel])

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
    if (genType === "video") return videoModel === "gen4.5" || videoModel === "gen4_turbo"
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

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (attachedImagePreview) URL.revokeObjectURL(attachedImagePreview)
    }
  }, [attachedImagePreview])

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

    setIsGenerating(true)
    setError(null)

    try {
      let attachedUrl: string | undefined
      if (attachedImage && user) {
        attachedUrl = await uploadImageToStorage(attachedImage, user.id, uuidv4())
      }

      if (genType === "image") {
        const imageUrl = await generateImageWithRunway(prompt.trim(), {
          model: imageModel,
          ratio: imageRatio,
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
        })
        const predictionId = uuidv4()
        addGeneratedVideo({
          url: videoUrl,
          prompt: prompt.trim(),
          predictionId,
          status: "succeeded" as any,
        })
        setMaximizedMedia({ url: videoUrl, name: 'Generated Video', type: 'video' })

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
      setError(err instanceof Error ? err.message : "Failed to generate")
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
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search communities, prompts, styles and more..."
            className="w-full bg-background/30 backdrop-blur-3xl hover:bg-background/40 focus:bg-background/50 border border-white/10 focus:border-white/20 text-foreground pl-12 pr-14 py-4 rounded-3xl shadow-[0_8px_32px_rgba(0,0,0,0.2)] transition-all duration-500 outline-none placeholder:text-muted-foreground/40"
          />
          {/* Filter button */}
          <button
            onClick={() => {
              if (!showFilterPanel) setPendingFilters({ ...appliedFilters })
              setShowFilterPanel(!showFilterPanel)
            }}
            className={`filter-toggle-btn absolute inset-y-0 right-3 flex items-center z-10 transition-colors ${
              activeFilterCount > 0 ? 'text-primary' : 'text-muted-foreground/60 hover:text-foreground'
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
                                      className={`px-3 py-1.5 rounded-full text-[11px] font-medium transition-all duration-200 border ${
                                        isSelected
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

        {/* ── Discover Grid (filtered gallery + generated media) ── */}
        <div className="px-4 pt-4 pb-2">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-muted-foreground tracking-wide uppercase">Discover</h3>
            {activeFilterCount > 0 && (
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
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-2">
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
          </div>
        </div>
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
                <label className="shrink-0 p-2 cursor-pointer text-muted-foreground hover:text-foreground transition-colors rounded-lg hover:bg-muted ml-1 mt-1">
                  <Plus className="w-5 h-5" />
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
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder={isAuthenticated ? "Type to imagine..." : "Please login to generate"}
                className="flex-1 w-full bg-transparent text-foreground placeholder:text-muted-foreground p-3 text-sm resize-none focus:outline-none min-h-[80px] max-h-[200px]"
                rows={3}
                disabled={!isAuthenticated || isGenerating}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault()
                    handleGenerate()
                  }
                }}
              />
            </div>

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
                          : { "gen4.5": "gen4.5", "gen4_turbo": "gen4_turbo", "veo3.1": "veo3.1", "veo3.1_fast": "veo3.1_fast", "veo3": "veo3" }
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

              {/* Right side: settings + generate */}
              <div className="flex items-center gap-2">
                {/* Settings button */}
                <button
                  onClick={() => setShowSettings(!showSettings)}
                  className={`p-1.5 rounded-full transition-colors ${showSettings ? "bg-muted text-foreground" : "text-muted-foreground hover:text-foreground"
                    }`}
                >
                  <Settings className="w-4 h-4" />
                </button>

                {/* Generate button */}
                <button
                  onClick={handleGenerate}
                  disabled={isGenerating || !prompt.trim() || !isAuthenticated}
                  className="w-8 h-8 bg-foreground rounded-full flex items-center justify-center hover:bg-foreground/90 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                >
                  {isGenerating ? (
                    <div className="w-4 h-4 border-2 border-background border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <svg className="w-4 h-4 text-background" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="12" y1="19" x2="12" y2="5" />
                      <polyline points="5 12 12 5 19 12" />
                    </svg>
                  )}
                </button>
              </div>
            </div>
          </div>

          {/* ── Settings Panel (above bar, slides up) ── */}
          {showSettings && (
            <div className="absolute bottom-[calc(100%+8px)] right-0 w-64 bg-background border border-border rounded-xl p-4 space-y-3 shadow-2xl z-50 animate-in fade-in zoom-in-95 duration-100">
              {/* Duration (video only) */}
              {genType === "video" ? (
                <div>
                  <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider mb-1.5 block">
                    Duration (seconds)
                  </label>
                  <select
                    value={videoDuration}
                    onChange={(e) => setVideoDuration(parseInt(e.target.value))}
                    className="w-full bg-muted text-foreground text-sm px-3 py-2 rounded-lg border border-border focus:outline-none focus:ring-1 focus:ring-ring"
                  >
                    {[2, 3, 4, 5, 6, 7, 8, 9, 10].map(d => (
                      <option key={d} value={d}>{d}s</option>
                    ))}
                  </select>
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">No additional settings</p>
              )}

              {/* Info about image requirement */}
              {genType === "video" && videoModel === "gen4_turbo" && (
                <p className="text-[11px] text-amber-500 font-medium">
                  ⚠ gen4_turbo requires a prompt image. Use the + button to attach one.
                </p>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ── Image Maximisation Overlay ── */}
      <AnimatePresence>
        {maximizedMedia && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setMaximizedMedia(null)}
            className="fixed inset-0 z-[100] bg-background/40 backdrop-blur-xl flex justify-center items-center p-4 overflow-hidden"
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 20 }}
              onClick={(e) => e.stopPropagation()}
              className="relative w-fit max-w-3xl h-[80vh] bg-background rounded-[32px] overflow-hidden shadow-2xl border border-border/50 group"
            >
              {/* Background blurred filler to satisfy "cover" requirement within the card area */}
              <div className="absolute inset-0 z-0 select-none pointer-events-none">
                {maximizedMedia.type === 'image' ? (
                  <img src={maximizedMedia.url} alt="" className="w-full h-full object-cover blur-2xl opacity-40 scale-110" />
                ) : (
                  <video src={maximizedMedia.url} className="w-full h-full object-cover blur-2xl opacity-40 scale-110" muted />
                )}
              </div>

              {/* Foreground Image / Video - Sizing the parent card to match content ratio */}
              <div className="relative z-10 h-full w-auto flex items-center justify-center">
                {maximizedMedia.type === 'image' ? (
                  <img
                    src={maximizedMedia.url}
                    alt={maximizedMedia.name}
                    className="h-full w-auto max-w-full object-contain shadow-xl"
                  />
                ) : (
                  <video
                    src={maximizedMedia.url}
                    className="h-full w-auto max-w-full object-contain shadow-xl"
                    autoPlay
                    loop
                    controls
                  />
                )}
              </div>

              {/* Top controls (X button) */}
              <div className="absolute top-4 right-4 z-[30] pointer-events-auto">
                <button
                  onClick={() => setMaximizedMedia(null)}
                  className="w-10 h-10 bg-black/60 backdrop-blur-xl text-white rounded-full flex items-center justify-center border border-white/20 hover:bg-black/80 hover:scale-110 transition-all shadow-lg group-hover:opacity-100"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Top Left (Style Name / Title) */}
              <div className="absolute top-4 left-4 z-[30] pointer-events-none">
                <div className="bg-black/60 backdrop-blur-xl px-4 py-2 rounded-full border border-white/20 shadow-lg pointer-events-auto">
                  <span className="text-white text-sm font-medium tracking-wide">{maximizedMedia.name}</span>
                </div>
              </div>

              {/* Bottom right (Download button) */}
              <div className="absolute bottom-4 right-4 z-[30] pointer-events-auto">
                <button
                  onClick={async () => {
                    try {
                      const response = await fetch(maximizedMedia.url);
                      const blob = await response.blob();
                      const url = URL.createObjectURL(blob);
                      const a = document.createElement("a");
                      a.href = url;
                      a.download = `${maximizedMedia.name.replace(/\s+/g, '-').toLowerCase()}-${Date.now()}.png`;
                      document.body.appendChild(a);
                      a.click();
                      document.body.removeChild(a);
                      URL.revokeObjectURL(url);
                    } catch (err) {
                      console.error("Failed to download:", err);
                    }
                  }}
                  className="flex items-center gap-2 bg-primary/90 hover:bg-primary backdrop-blur-xl text-primary-foreground px-6 py-3 rounded-full border border-white/10 transition-all shadow-xl hover:scale-105 active:scale-95"
                >
                  <Download className="w-4 h-4" />
                  <span className="text-sm font-semibold">Download</span>
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Loading Screens ── */}
      <ImageGenerationLoader isVisible={isGenerating && genType === "image"} />
      <VideoGenerationLoader isVisible={isGenerating && genType === "video"} />
    </div>
  )
}
