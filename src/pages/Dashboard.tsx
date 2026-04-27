import {
  AlertTriangle,
  Box,
  Calendar,
  CheckCheck,
  ChevronLeft,
  ChevronRight,
  Copy,
  Crown,
  Download,
  Eye,
  Folder,
  FolderInput,
  Github,
  Grid3x3,
  HelpCircle,
  Home,
  Key,
  Layers,
  LogOut,
  Mail,
  Maximize2,
  MessageSquare,
  Plus,
  Search,
  Settings,
  Trash2,
  TrendingUp,
  User as UserIcon,
  X
} from "lucide-react"
import { motion, AnimatePresence } from "framer-motion"
import { useCallback, useEffect, useState } from "react"
import { useNavigate, useSearchParams } from "react-router-dom"
import { VideoPlayer } from "../components/chat/VideoPlayer"
import { ModelViewer } from "../components/model-viewer/ModelViewer"
import { useTheme } from "../components/theme-provider"
import { Button } from "../components/ui/button"
import { ThemeToggle } from "../components/ui/theme-toggle"
import { useAuth } from "../hooks/useAuth"
import { usePricing } from "../hooks/usePricing"
import { cn } from "../lib/utils"
import { deleteAudio, deleteImage, deleteModel, deleteVideo, getUserAudio, getUserImages, getUserModels, getUserVideos, type AudioWithDb, type ImageWithDb, type ModelWithDb, type VideoWithDb } from "../services/multiDbDataService"
import { getPricingPlans, subscribeToPlan } from "../services/pricingService"
import { saveSingleProjectFile, type GitHubConnectionInput } from "../services/projectFiles"
import { createProject, deleteProject, getProjects, signOut, supabase } from "../services/supabase"
import { calculateTokenCredits, formatTokenCount, getUserTokenSummary, type UserTokenSummary } from "../services/tokenUsageService"
import { useAppStore } from "../store/useAppStore"
import type { Model, Project } from "../types"

type TabType = "explore" | "profile" | "usage" | "projects" | "features" | "accounts"

let globalAssetsCache: {
  userId: string | null;
  timestamp: number;
  images: ImageWithDb[];
  models: ModelWithDb[];
  videos: VideoWithDb[];
  audio: AudioWithDb[];
} | null = null;
const CACHE_DURATION_MS = 2 * 60 * 1000; // 2 minutes

export function Dashboard() {
  const { theme } = useTheme()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { user, session, loading } = useAuth()
  const { subscription, usage, refresh: refreshPricing } = usePricing()
  const tabParam = searchParams.get("tab") as TabType | null
  const [activeTab, setActiveTab] = useState<TabType>(tabParam || "explore")
  const [userImages, setUserImages] = useState<ImageWithDb[]>([])
  const [userModels, setUserModels] = useState<ModelWithDb[]>([])
  const [userVideos, setUserVideos] = useState<VideoWithDb[]>([])
  const [userAudio, setUserAudio] = useState<AudioWithDb[]>([])
  const [selectedImage, setSelectedImage] = useState<string | null>(null)
  const [imageGroup, setImageGroup] = useState<string[] | null>(null)
  const [currentImageIndex, setCurrentImageIndex] = useState<number>(0)
  const [selectedModel, setSelectedModel] = useState<Model | null>(null)
  const [selectedVideo, setSelectedVideo] = useState<string | null>(null)
  const [assetsTab, setAssetsTab] = useState<"images" | "models" | "videos" | "audio">("images")
  const [isLoadingAssets, setIsLoadingAssets] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [itemToDelete, setItemToDelete] = useState<{ type: "image" | "model" | "video" | "audio" | "project"; id: string; dbId?: string } | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)
  const [passwordForm, setPasswordForm] = useState({ current: "", new: "", confirm: "" })
  const [copiedToken, setCopiedToken] = useState(false)
  const [passwordError, setPasswordError] = useState<string | null>(null)
  const [passwordSuccess, setPasswordSuccess] = useState<string | null>(null)
  const [projects, setProjects] = useState<Project[]>([])
  const [isLoadingProjects, setIsLoadingProjects] = useState(false)
  const [showProjectDialog, setShowProjectDialog] = useState(false)
  const [newProjectName, setNewProjectName] = useState("")
  const [newProjectDescription, setNewProjectDescription] = useState("")
  const { addGeneratedFile, setCurrentProject, isSidebarOpen, setIsSidebarOpen } = useAppStore()

  // Import to Project State
  const [showImportDialog, setShowImportDialog] = useState(false)
  const [assetToImport, setAssetToImport] = useState<{ type: "image" | "model" | "video" | "audio"; url: string; name: string } | null>(null)
  const [isImporting, setIsImporting] = useState(false)

  // GitHub Connection Prompt State
  const [isCreatingProject, setIsCreatingProject] = useState(false)

  // Token Usage State
  const [tokenUsage, setTokenUsage] = useState<UserTokenSummary | null>(null)
  const [isLoadingTokenUsage, setIsLoadingTokenUsage] = useState(false)

  const loadProjects = useCallback(async () => {
    if (!user) return
    setIsLoadingProjects(true)
    try {
      const userProjects = await getProjects(user.id)
      setProjects(userProjects)
    } catch (error) {
      console.error("Error loading projects:", error)
    } finally {
      setIsLoadingProjects(false)
    }
  }, [user])

  const loadUserProfile = async () => {
    // User profile loading can be implemented here if needed
  }

  const loadUserAssets = async (forceRefresh = false) => {
    if (!user) return

    if (!forceRefresh && globalAssetsCache && globalAssetsCache.userId === user.id) {
      if (Date.now() - globalAssetsCache.timestamp < CACHE_DURATION_MS) {
        setUserImages(globalAssetsCache.images);
        setUserModels(globalAssetsCache.models);
        setUserVideos(globalAssetsCache.videos);
        setUserAudio(globalAssetsCache.audio);
        return; // early return to save egress
      }
    }

    setIsLoadingAssets(true)
    try {
      const [images, models, videos, audio] = await Promise.all([
        getUserImages(user.id),
        getUserModels(user.id),
        getUserVideos(user.id),
        getUserAudio(user.id),
      ])

      globalAssetsCache = {
        userId: user.id,
        timestamp: Date.now(),
        images,
        models,
        videos,
        audio
      };

      setUserImages(images)
      setUserModels(models)
      setUserVideos(videos)
      setUserAudio(audio)
    } catch (error) {
      console.error("Error loading user assets:", error)
    } finally {
      setIsLoadingAssets(false)
    }
  }

  // Load projects when import dialog opens
  useEffect(() => {
    if (showImportDialog && user) {
      loadProjects()
    }
  }, [showImportDialog, user, loadProjects])

  useEffect(() => {
    if (!loading && !user) {
      navigate("/login")
    }
  }, [user, loading, navigate])

  // Handle tab parameter from URL
  useEffect(() => {
    const tabParam = searchParams.get("tab") as TabType | null
    if (tabParam && ["explore", "profile", "usage", "projects", "features", "accounts"].includes(tabParam)) {
      setActiveTab(tabParam)
    }
  }, [searchParams])

  useEffect(() => {
    if (user) {
      loadUserProfile()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user])

  // Refresh assets when page becomes visible (user returns from chat)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (!document.hidden && activeTab === "profile" && user) {
        console.log("Dashboard visible - refreshing assets (forced)")
        loadUserAssets(true)
      }
    }

    document.addEventListener("visibilitychange", handleVisibilityChange)
    return () => document.removeEventListener("visibilitychange", handleVisibilityChange)
  }, [activeTab, user])

  useEffect(() => {
    if (activeTab === "profile" && user) {
      loadUserAssets()
    }
    if (activeTab === "projects" && user) {
      loadProjects()
    }
    if (activeTab === "usage" && user) {
      loadTokenUsage()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, user, loadProjects])

  // Set sidebar open by default ONLY for dashboard
  useEffect(() => {
    setIsSidebarOpen(true)
    return () => setIsSidebarOpen(false)
  }, [setIsSidebarOpen])

  const loadTokenUsage = async () => {
    if (!user) return
    setIsLoadingTokenUsage(true)
    try {
      const summary = await getUserTokenSummary(user.id)
      setTokenUsage(summary)
    } catch (error) {
      console.error("Error loading token usage:", error)
      // Set default empty usage on error
      setTokenUsage({
        todayInputTokens: 0,
        todayOutputTokens: 0,
        todayTotalTokens: 0,
        monthlyInputTokens: 0,
        monthlyOutputTokens: 0,
        monthlyTotalTokens: 0,
        allTimeInputTokens: 0,
        allTimeOutputTokens: 0,
        allTimeTotalTokens: 0,
      })
    } finally {
      setIsLoadingTokenUsage(false)
    }
  }

  const handleCreateProject = async () => {
    if (!user || !newProjectName.trim()) return

    setIsCreatingProject(true)

    try {
      // Create project in Supabase (no GitHub required)
      const newProject = await createProject({
        userId: user.id,
        name: newProjectName.trim(),
        description: newProjectDescription.trim() || "",
      })

      // Update local state
      setProjects([newProject, ...projects])
      setNewProjectName("")
      setNewProjectDescription("")
      setShowProjectDialog(false)

      // Store project for chat to automatically connect
      localStorage.setItem('pending_project_connection', JSON.stringify(newProject))

      // Disconnect any previous project and set the new one
      setCurrentProject(newProject)

      // Navigate to chat interface (main page) - chat will auto-connect the project
      navigate('/app')
    } catch (error) {
      console.error("Error creating project:", error)
      alert(error instanceof Error ? error.message : "Failed to create project. Please try again.")
    } finally {
      setIsCreatingProject(false)
    }
  }

  const handleOpenProject = (project: Project) => {
    // Store project for chat to automatically connect
    localStorage.setItem('pending_project_connection', JSON.stringify(project))

    // Disconnect any previous project and set the new one
    setCurrentProject(project)

    // Navigate to chat interface (main page) - chat will auto-connect the project and open builder
    navigate('/app')
  }

  const handleDeleteProject = async (e: React.MouseEvent, projectId: string) => {
    e.stopPropagation()
    setItemToDelete({ type: "project", id: projectId })
    setShowDeleteConfirm(true)
  }



  const handleImportToProject = async (projectId: string) => {
    if (!assetToImport || !user) return

    setIsImporting(true)
    try {
      const project = projects.find(p => p.id === projectId)
      if (!project) {
        alert("Project not found")
        return
      }

      const { uploadFileToDataDb } = await import("../services/supabase")
      const { uuidv4 } = await import("../lib/uuid")

      // 1. Try to download asset (may fail with CORS for external R2/CDN URLs)
      let blob: Blob | null = null
      try {
        const response = await fetch(assetToImport.url)
        blob = await response.blob()
      } catch (fetchError) {
        console.warn("Could not download asset (CORS). Will link original URL instead.", fetchError)
      }

      // 2. Prepare new asset info
      const newId = uuidv4()
      const bucket = projectId // Project-specific bucket
      const originalExt = assetToImport.name.split('.').pop() || (
        assetToImport.type === 'image' ? 'png' :
          assetToImport.type === 'video' ? 'mp4' :
            assetToImport.type === 'audio' ? 'mp3' : 'glb'
      )

      // Truncate file name to max 10 chars (excluding extension)
      const rawName = assetToImport.name.replace(/\.[^/.]+$/, '') // strip extension
      const truncatedName = rawName.length > 10 ? rawName.substring(0, 10) : rawName

      const storagePath = `${newId}.${originalExt}` // Unique path in project bucket

      // 3. Upload to Project Bucket (only if we successfully downloaded)
      let newUrl = assetToImport.url
      if (blob) {
        const file = new File([blob], storagePath, { type: blob.type })
        try {
          newUrl = await uploadFileToDataDb(bucket, storagePath, file)
        } catch (uploadError) {
          console.warn("Upload to project bucket failed, falling back to original URL", uploadError)
        }
      }

      // 4. DO NOT create a new DB record — that causes duplicates in the profile assets tab.
      // The original record in the images/models/videos/audio table stays as-is.
      // We only create a project file reference below.

      // 5. Save Project File into the correct subfolder
      let filePath: string
      switch (assetToImport.type) {
        case "image":
          filePath = "images/" + truncatedName + (truncatedName.endsWith('.png') ? '' : '.png')
          break
        case "model":
          filePath = "3d-models/" + truncatedName + (truncatedName.endsWith('.glb') ? '' : '.glb')
          break
        case "video":
          filePath = "videos/" + truncatedName + (truncatedName.endsWith('.mp4') ? '' : '.mp4')
          break
        case "audio":
          filePath = "audio/" + truncatedName + (truncatedName.endsWith('.mp3') ? '' : '.mp3')
          break
        default:
          filePath = "assets/" + truncatedName
      }

      // Add to store for immediate display
      addGeneratedFile(filePath, newUrl)

      // Save to GitHub or Supabase for persistence
      await saveSingleProjectFile(
        projectId,
        user.id,
        project.name,
        filePath,
        newUrl,
        null
      )

      alert(
        "Successfully imported " +
        assetToImport.type +
        ' to project "' +
        project.name +
        '"'
      )

      setShowImportDialog(false)
      setAssetToImport(null)
    } catch (error) {
      console.error("Error importing asset:", error)
      alert("Failed to import asset. Please try again.")
    } finally {
      setIsImporting(false)
    }
  }

  const handleLogout = async () => {
    try {
      await signOut()
      navigate("/login")
    } catch (error) {
      console.error("Error signing out:", error)
    }
  }

  const handleDeleteItem = async () => {
    if (!itemToDelete || !user) return

    setIsDeleting(true)
    try {
      switch (itemToDelete.type) {
        case "image":
          await deleteImage(itemToDelete.id, itemToDelete.dbId!)
          const newImages = userImages.filter(img => img.id !== itemToDelete.id)
          setUserImages(newImages)
          if (globalAssetsCache) globalAssetsCache.images = newImages
          break
        case "model":
          await deleteModel(itemToDelete.id, itemToDelete.dbId!)
          const newModels = userModels.filter(model => model.id !== itemToDelete.id)
          setUserModels(newModels)
          if (globalAssetsCache) globalAssetsCache.models = newModels
          break
        case "video":
          await deleteVideo(itemToDelete.id, itemToDelete.dbId!)
          const newVideos = userVideos.filter(video => video.id !== itemToDelete.id)
          setUserVideos(newVideos)
          if (globalAssetsCache) globalAssetsCache.videos = newVideos
          break
        case "audio":
          await deleteAudio(itemToDelete.id, itemToDelete.dbId!)
          const newAudio = userAudio.filter(audio => audio.id !== itemToDelete.id)
          setUserAudio(newAudio)
          if (globalAssetsCache) globalAssetsCache.audio = newAudio
          break
        case "project":
          await deleteProject(itemToDelete.id)
          setProjects(projects.filter(p => p.id !== itemToDelete.id))
          break
      }
      setShowDeleteConfirm(false)
      setItemToDelete(null)
    } catch (error) {
      console.error("Error deleting item:", error)
      alert("Failed to delete item. Please try again.")
    } finally {
      setIsDeleting(false)
    }
  }

  const confirmDelete = (type: "image" | "model" | "video" | "audio", id: string, dbId: string) => {
    setItemToDelete({ type, id, dbId })
    setShowDeleteConfirm(true)
  }

  const handleBuilder = () => {
    navigate("/app")
  }

  const handleClaimProTrial = async () => {
    if (!user) return
    try {
      const allPlans = await getPricingPlans()
      const proTrialPlan = allPlans.find(p => p.name === "PRO_TRIAL")
      if (proTrialPlan) {
        await subscribeToPlan(user.id, proTrialPlan.id)
        await refreshPricing()
        alert("Pro Trial activated! Enjoy 7 days of full PRO access.")
      }
    } catch (error) {
      console.error("Error claiming Pro Trial:", error)
      alert("Failed to claim Pro Trial. Please try again.")
    }
  }

  const handleUpgrade = async () => {
    navigate("/pricing")
  }

  const handleChangePassword = async () => {
    setPasswordError(null)
    setPasswordSuccess(null)

    if (passwordForm.new !== passwordForm.confirm) {
      setPasswordError("New passwords do not match")
      return
    }

    if (passwordForm.new.length < 6) {
      setPasswordError("Password must be at least 6 characters")
      return
    }

    try {
      const { error } = await supabase.auth.updateUser({
        password: passwordForm.new,
      })

      if (error) throw error

      setPasswordSuccess("Password changed successfully")
      setPasswordForm({ current: "", new: "", confirm: "" })
    } catch (error) {
      setPasswordError(error instanceof Error ? error.message : "Failed to change password")
    }
  }

  const handleDeleteAccount = async () => {
    if (!user) return

    try {
      // Delete user account
      const { error } = await supabase.auth.admin.deleteUser(user.id)
      if (error) throw error

      await signOut()
      navigate("/signup")
    } catch (error) {
      console.error("Error deleting account:", error)
      alert("Failed to delete account. Please contact support.")
    }
  }

  const formatExpirationDate = (dateString: string | null) => {
    if (!dateString) return "Unlimited"
    const date = new Date(dateString)
    const now = new Date()
    const diffTime = date.getTime() - now.getTime()
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))

    if (diffDays < 0) {
      return "Expired"
    } else if (diffDays === 0) {
      return "Expires today"
    } else if (diffDays === 1) {
      return "Expires tomorrow"
    } else if (diffDays <= 7) {
      return "Expires in " + diffDays + " days"
    } else {
      return date.toLocaleDateString("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric"
      })
    }
  }

  const getNextPlanName = () => {
    if (!subscription) return "PRO"
    const planNames = ["FREE", "PRO_TRIAL", "PRO", "PRO_PLUS", "ULTRA", "STUDIO"]
    const currentIndex = planNames.indexOf(subscription.planName)
    if (currentIndex < planNames.length - 1) {
      return planNames[currentIndex + 1]
    }
    return null
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center font-mono">
        <div className="text-foreground">$ loading...</div>
      </div>
    )
  }

  if (!user) {
    return null
  }

  return (
    <div className="flex flex-col h-full w-full bg-background overflow-hidden relative">
      {/* Dynamic Background Elements */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden opacity-30">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-foreground/5 blur-[100px]" />
        <div className="absolute bottom-[20%] right-[-5%] w-[30%] h-[30%] rounded-full bg-foreground/5 blur-[100px]" />
      </div>

      {/* Main Content Area with Sidebar */}
      <div className="flex flex-1 overflow-hidden relative z-10">
        {/* Left Sidebar */}
        <div
          className={cn(
            "bg-background/40 backdrop-blur-2xl border-r border-foreground/10 transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] flex flex-col z-20",
            !isSidebarOpen ? "w-0 overflow-hidden border-none mx-0" : "w-72"
          )}
        >


          <div className="flex-1 overflow-y-auto px-4 pt-6 pb-2 bg-transparent custom-scrollbar">
            <div className="space-y-2 mb-8">
              <p className="px-4 text-[10px] font-bold text-muted-foreground/50 uppercase tracking-[0.2em] mb-4">Main Menu</p>
              <NavItem
                label="Profile"
                active={activeTab === "profile"}
                onClick={() => setActiveTab("profile")}
                collapsed={!isSidebarOpen}
              />
              <NavItem
                label="Projects"
                active={activeTab === "projects"}
                onClick={() => setActiveTab("projects")}
                collapsed={!isSidebarOpen}
              />
            </div>

            <div className="space-y-2 mb-8">
              <p className="px-4 text-[10px] font-bold text-muted-foreground/50 uppercase tracking-[0.2em] mb-4">Account & Data</p>
              <NavItem
                label="Analytics & Usage"
                active={activeTab === "usage"}
                onClick={() => setActiveTab("usage")}
                collapsed={!isSidebarOpen}
              />
              <NavItem
                label="Security"
                active={activeTab === "accounts"}
                onClick={() => setActiveTab("accounts")}
                collapsed={!isSidebarOpen}
              />
            </div>
          </div>

          {/* Bottom Section */}
          <div className="p-6 border-t border-foreground/5 space-y-4">
            <button
              onClick={handleLogout}
              className="w-full flex items-center gap-3 px-4 py-3 text-muted-foreground hover:text-red-400 hover:bg-red-400/5 rounded-lg transition-all border border-transparent hover:border-red-400/20 group"
            >
              <LogOut className="h-5 w-5 transition-transform group-hover:translate-x-1" />
              <span className={cn("text-sm font-medium", !isSidebarOpen && "hidden")}>Sign Out</span>
            </button>
          </div>
        </div>


        {/* Main Content Area */}
        <div className="flex-1 flex flex-col bg-background overflow-hidden">
          {/* Tab Content */}
          <div className="flex-1 overflow-y-auto">
            {activeTab === "explore" && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="p-6 max-w-6xl mx-auto"
              >
                <div className="relative mb-8 group">
                  <div className="absolute -top-6 -left-6 w-5 h-5 bg-foreground/5 text-foreground rounded-full blur-2xl group-hover:scale-150 transition-transform duration-1000" />
                  <h1 className="text-sm font-bold text-foreground mb-6 leading-tight tracking-tighter">
                    Your Creative Workspace, <br />
                    All in One Hub.
                  </h1>
                  <p className="text-sm text-muted-foreground mb-6 max-w-2xl leading-relaxed">
                    Welcome back to Koye. Your dedicated space for project management, asset orchestration, and AI-powered workflow scaling.
                  </p>
                  <div className="flex gap-4">
                    <button className="px-4 py-2 text-sm bg-foreground text-background hover:bg-foreground/90 font-bold rounded-lg hover:scale-105 active:scale-95 transition-all shadow-sm text-foreground">
                      Explore Workspace
                    </button>
                    <button className="px-4 py-2 text-sm bg-foreground/5 text-foreground border border-foreground/10 hover:bg-foreground/10 font-bold rounded-lg transition-all flex items-center gap-2">
                      <Mail className="h-5 w-5" />
                      Contact Support
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div className="p-5 rounded-xl bg-foreground/5 border border-foreground/10 hover:border-foreground/20 transition-all">
                    <h3 className="text-sm font-bold mb-2">Total Assets</h3>
                    <p className="text-sm font-bold text-foreground">{userImages.length + userModels.length + userVideos.length}</p>
                  </div>
                  <div className="p-5 rounded-xl bg-foreground/5 border border-foreground/10 hover:border-foreground/20 transition-all">
                    <h3 className="text-sm font-bold mb-2">Projects</h3>
                    <p className="text-sm font-bold text-foreground">{projects.length}</p>
                  </div>
                  <div className="p-5 rounded-xl bg-foreground/5 border border-foreground/10 hover:border-foreground/20 transition-all">
                    <h3 className="text-sm font-bold mb-2">Plan</h3>
                    <p className="text-sm font-bold text-foreground uppercase">{subscription?.planDisplayName || "Free"}</p>
                  </div>
                </div>
              </motion.div>
            )}

            {activeTab === "profile" && (
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                className="p-6 space-y-12 max-w-7xl mx-auto"
              >
                {/* User Profile Section */}
                <div className="bg-foreground/5 border border-foreground/10 p-5 rounded-lg relative overflow-hidden group">
                  <div className="absolute top-0 right-0 p-5">
                    <div className="w-5 h-5 rounded-full bg-foreground/5 text-foreground blur-2xl" />
                  </div>

                  <div className="flex items-center justify-between mb-6 relative z-10">
                    <div className="flex items-center gap-3">
                      <div className="w-5 h-5 rounded-xl bg-foreground/10 flex items-center justify-center text-sm font-bold text-foreground shadow-sm text-foreground">
                        {user.email?.[0].toUpperCase()}
                      </div>
                      <div>
                        <h2 className="text-sm font-bold text-foreground tracking-tight">Account Overview</h2>
                        <p className="text-muted-foreground">Manage your credentials and personal workspace files.</p>
                      </div>
                    </div>
                    <button
                      onClick={handleLogout}
                      className="px-3 py-1.5 text-xs bg-foreground/5 text-foreground hover:bg-red-400/10 hover:text-red-400 border border-foreground/10 hover:border-red-400/20 rounded-lg transition-all font-bold text-xs tracking-widest"
                    >
                      LOGOUT SESSION
                    </button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-5 relative z-10">
                    <div className="bg-foreground/5 p-6 rounded-xl border border-foreground/5">
                      <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-2 block">Primary Identity</label>
                      <div className="text-sm font-bold text-foreground truncate">{user.email}</div>
                    </div>

                    <div className="bg-foreground/5 p-6 rounded-xl border border-foreground/5">
                      <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-2 block">Current License</label>
                      <div className="flex items-center gap-3">
                        <Crown className="h-5 w-5 text-foreground" />
                        <span className="text-sm font-bold text-foreground">
                          {subscription?.planDisplayName || "Standard Free"}
                        </span>
                      </div>
                    </div>

                    <div className="bg-foreground/5 p-6 rounded-xl border border-foreground/5">
                      <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-2 block">Plan Expiry</label>
                      <div className="flex items-center gap-3">
                        <Calendar className="h-5 w-5 text-foreground/60" />
                        <span className="text-sm font-bold text-foreground">
                          {subscription?.expiresAt
                            ? formatExpirationDate(subscription.expiresAt)
                            : subscription?.planName === "FREE"
                              ? "Lifetime Access"
                              : "N/A"}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Pro Trial Claim Button */}
                  {(!subscription || subscription.planName === "FREE") && (
                    <div className="mt-6 pt-8 border-t border-foreground/5 relative z-10">
                      <button
                        onClick={handleClaimProTrial}
                        className="w-fit mx-auto px-6 py-3 bg-foreground/10 text-foreground border border-foreground/10 hover:bg-foreground/20 text-foreground hover:scale-[1.01] transition-all rounded-xl font-bold text-sm shadow-sm text-foreground flex items-center justify-center gap-3"
                      >
                        <Crown className="h-4 w-4" />
                        Unlock 7-Day PRO Trial
                      </button>
                    </div>
                  )}
                </div>

                {/* User Assets Section */}
                <div className="space-y-6">
                  <div className="flex items-center justify-between">
                    <h2 className="text-sm font-bold tracking-tight">Your Media Library</h2>
                    <div className="flex gap-2 bg-foreground/5 p-1.5 rounded-lg border border-foreground/5">
                      {[
                        { id: "images", label: "Images", count: userImages.length },
                        { id: "models", label: "3D Models", count: userModels.length },
                        { id: "videos", label: "Videos", count: userVideos.length },
                        { id: "audio", label: "Audio", count: userAudio.length }
                      ].map((t) => (
                        <button
                          key={t.id}
                          onClick={() => setAssetsTab(t.id as any)}
                          className={cn(
                            "px-5 py-2 text-xs font-bold rounded-xl transition-all duration-300",
                            assetsTab === t.id
                              ? "bg-foreground text-background hover:bg-foreground/90 shadow-sm"
                              : "text-muted-foreground hover:bg-foreground/5 hover:text-foreground"
                          )}
                        >
                          {t.label}
                          <span className="ml-2 opacity-50 px-1.5 py-0.5 rounded-md bg-black/20">{t.count}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Scrollable Assets Container */}
                  <div className="bg-foreground/5 border border-foreground/10 rounded-xl p-6 min-h-[600px] backdrop-blur-sm">
                    {isLoadingAssets ? (
                      <div className="flex flex-col items-center justify-center py-10 gap-4">
                        <div className="w-4 h-4 border-4 border-foreground/20 border-t-white rounded-full animate-spin" />
                        <span className="text-muted-foreground font-medium tracking-tight">Syncing assets...</span>
                      </div>
                    ) : assetsTab === "images" ? (
                      userImages.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-10 gap-4 opacity-40">
                          <Eye className="w-5 h-5" />
                          <p className="font-bold">No visual assets detected yet.</p>
                        </div>
                      ) : (
                        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                          {userImages.map((image, index) => {
                            const imageTitle = image.prompt?.trim() || "Generated Image " + (index + 1)
                            return (
                              <motion.div
                                key={image.id}
                                whileHover={{ y: -5 }}
                                className="group relative rounded-xl overflow-hidden bg-foreground/5 border border-foreground/10 aspect-square cursor-pointer"
                                onClick={() => {
                                  setSelectedImage(image.url)
                                  setImageGroup([image.url])
                                  setCurrentImageIndex(0)
                                }}
                              >
                                <img
                                  src={image.url}
                                  alt={imageTitle}
                                  className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                                />
                                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-all duration-300 flex flex-col justify-end p-4">
                                  <div className="flex gap-2 justify-end mb-2">
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation()
                                        setAssetToImport({ type: "image", url: image.url, name: imageTitle })
                                        setShowImportDialog(true)
                                      }}
                                      className="p-2 bg-foreground/10 backdrop-blur-md rounded-xl hover:bg-foreground text-background hover:bg-foreground/90 transition-colors"
                                    >
                                      <FolderInput className="h-4 w-4 text-foreground" />
                                    </button>
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation()
                                        confirmDelete("image", image.id, image.dbId)
                                      }}
                                      className="p-2 bg-foreground/10 backdrop-blur-md rounded-xl hover:bg-red-500 transition-colors"
                                    >
                                      <Trash2 className="h-4 w-4 text-foreground" />
                                    </button>
                                  </div>
                                  <p className="text-[10px] font-bold text-foreground/90 truncate uppercase tracking-widest">{imageTitle}</p>
                                </div>
                              </motion.div>
                            )
                          })}
                        </div>
                      )
                    ) : assetsTab === "models" ? (
                      userModels.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-10 gap-4 opacity-40">
                          <Box className="w-5 h-5" />
                          <p className="font-bold">No 3D workspace identified.</p>
                        </div>
                      ) : (
                        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                          {userModels.map((model) => (
                            <motion.div
                              key={model.id}
                              whileHover={{ y: -5 }}
                              className="group relative rounded-xl overflow-hidden bg-foreground/5 border border-foreground/10 aspect-square cursor-pointer"
                              onClick={() => setSelectedModel({
                                id: model.id,
                                assetId: model.assetId || "",
                                url: model.url,
                                format: model.format as "glb" | "obj" | "fbx",
                                status: model.status as "raw" | "textured" | "rigged",
                                createdAt: model.createdAt,
                              })}
                            >
                              <div className="w-full h-full flex flex-col items-center justify-center bg-transparent transition-transform duration-700 group-hover:scale-110">
                                <Box className="w-8 h-8 text-foreground/30 mb-3" />
                                <h4 className="text-xs font-bold text-foreground tracking-tight uppercase">
                                  {model.format} Mesh
                                </h4>
                              </div>

                              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-all duration-300 flex flex-col justify-end p-4">
                                <div className="flex gap-2 justify-end mb-2">
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      setAssetToImport({ type: "model", url: model.url, name: model.format })
                                      setShowImportDialog(true)
                                    }}
                                    className="p-2 bg-white/20 backdrop-blur-md rounded-lg hover:bg-white hover:text-black text-white transition-colors"
                                  >
                                    <FolderInput className="h-4 w-4" />
                                  </button>
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      confirmDelete("model", model.id, model.dbId)
                                    }}
                                    className="p-2 bg-white/20 backdrop-blur-md rounded-lg hover:bg-red-500 hover:text-white transition-colors text-white"
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </button>
                                </div>
                                <p className="text-[10px] font-bold text-white/90 truncate uppercase tracking-widest">{model.status}</p>
                              </div>
                            </motion.div>
                          ))}
                        </div>
                      )
                    ) : assetsTab === "videos" ? (
                      userVideos.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-10 gap-4 opacity-40">
                          <Eye className="w-5 h-5" />
                          <p className="font-bold">Empty cinematic sequence.</p>
                        </div>
                      ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                          {userVideos.map((video) => (
                            <motion.div
                              key={video.id}
                              whileHover={{ y: -5 }}
                              className="group relative rounded-xl overflow-hidden bg-black border border-foreground/10 aspect-video cursor-pointer"
                              onClick={() => setSelectedVideo(video.url)}
                            >
                              <video
                                src={video.url}
                                className="w-full h-full object-contain"
                                muted
                                loop
                                playsInline
                              />
                              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                <Maximize2 className="w-5 h-5 text-foreground/50" />
                              </div>
                              <div className="absolute top-4 right-4 flex gap-2 opacity-0 group-hover:opacity-100 transition-all translate-y-2 group-hover:translate-y-0">
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    setAssetToImport({ type: "video", url: video.url, name: video.prompt || "Video" })
                                    setShowImportDialog(true)
                                  }}
                                  className="p-2 bg-foreground/10 backdrop-blur-md rounded-xl hover:bg-foreground text-background hover:bg-foreground/90 transition-colors text-foreground"
                                >
                                  <FolderInput className="h-4 w-4" />
                                </button>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    confirmDelete("video", video.id, video.dbId)
                                  }}
                                  className="p-2 bg-foreground/10 backdrop-blur-md rounded-xl hover:bg-red-500 transition-colors text-foreground"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </button>
                              </div>
                            </motion.div>
                          ))}
                        </div>
                      )
                    ) : (
                      userAudio.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-10 gap-4 opacity-40">
                          <MessageSquare className="w-5 h-5" />
                          <p className="font-bold">Acoustic signature not found.</p>
                        </div>
                      ) : (
                        <div className="grid grid-cols-1 gap-4">
                          {userAudio.map((audio) => (
                            <motion.div
                              key={audio.id}
                              className="bg-foreground/5 border border-foreground/10 p-6 rounded-xl relative group"
                            >
                              <div className="flex items-center gap-3">
                                <div className="w-4 h-4 rounded-lg bg-foreground/5 flex items-center justify-center shrink-0">
                                  <MessageSquare className="h-5 w-5 text-foreground" />
                                </div>
                                <div className="flex-1 min-w-0">
                                  <h4 className="text-sm font-bold text-foreground truncate tracking-tight uppercase">
                                    {audio.prompt || "Sonic Capture"}
                                  </h4>
                                  <div className="flex items-center gap-4 mt-1">
                                    <p className="text-xs text-muted-foreground/60">{new Date(audio.createdAt).toLocaleDateString()}</p>
                                    <audio src={audio.url} controls className="h-8 max-w-[200px] opacity-60 hover:opacity-100 transition-opacity" />
                                  </div>
                                </div>
                                <div className="flex gap-2">
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      setAssetToImport({ type: "audio", url: audio.url, name: audio.prompt || "Audio" })
                                      setShowImportDialog(true)
                                    }}
                                    className="p-3 bg-foreground/5 rounded-lg hover:bg-foreground/5 text-foreground hover:text-foreground transition-all"
                                  >
                                    <FolderInput className="h-5 w-5" />
                                  </button>
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      confirmDelete("audio", audio.id, audio.dbId)
                                    }}
                                    className="p-3 bg-red-400/5 text-red-400 rounded-lg hover:bg-red-400 hover:text-foreground transition-all"
                                  >
                                    <Trash2 className="h-5 w-5" />
                                  </button>
                                </div>
                              </div>
                            </motion.div>
                          ))}
                        </div>
                      )
                    )}
                  </div>
                </div>
              </motion.div>
            )}

            {activeTab === "usage" && (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="p-6 space-y-10 max-w-6xl mx-auto"
              >
                {/* Credit Balance Card */}
                <div className="bg-foreground/5 border border-foreground/10 p-6 rounded-lg relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-64 h-64 bg-foreground/5 text-foreground blur-[100px] -mr-32 -mt-32" />

                  <div className="flex items-center justify-between mb-6 relative z-10">
                    <div>
                      <h2 className="text-sm font-bold tracking-tight mb-2 text-foreground">Compute Credits</h2>
                      <p className="text-muted-foreground">Your balance for high-performance generation tasks.</p>
                    </div>
                    <div className="flex items-center gap-3 px-3 py-1.5 text-xs bg-foreground/5 text-foreground rounded-lg border border-foreground/10">
                      <Crown className="h-4 w-4 text-foreground" />
                      <span className="text-sm font-bold text-foreground">
                        {subscription?.planDisplayName || "COMMUNITY"}
                      </span>
                    </div>
                  </div>

                  <div className="mb-6 relative z-10">
                    <div className="flex items-end justify-between mb-4">
                      <div>
                        <span className="text-sm font-bold text-foreground tracking-tighter">
                          {subscription?.creditsBalance?.toLocaleString() || 0}
                        </span>
                        <span className="text-sm text-muted-foreground ml-4 font-medium opacity-60">
                          Available Credits
                        </span>
                      </div>
                      <div className="text-right">
                        <div className="text-sm font-bold text-foreground">
                          Capacity: {subscription?.planName === 'CUSTOM' ? 'UNLIMITED' : (
                            subscription?.planName === 'FREE' ? '200' :
                              subscription?.planName === 'PRO' ? '500' :
                                subscription?.planName === 'PRO_PLUS' ? '3,000' :
                                  subscription?.planName === 'ULTRA' ? '8,000' : '200'
                          )}
                        </div>
                        <div className="text-xs text-muted-foreground mt-1">
                          {subscription?.expiresAt ? `Cycle ends ${new Date(subscription.expiresAt).toLocaleDateString()}` : 'Monthly refresh'}
                        </div>
                      </div>
                    </div>
                    {subscription?.planName !== 'CUSTOM' && (
                      <div className="w-full bg-foreground/5 h-4 rounded-full overflow-hidden border border-foreground/5 p-1">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{
                            width: `${Math.min(100, ((subscription?.creditsBalance || 0) / (
                              subscription?.planName === 'FREE' ? 200 :
                                subscription?.planName === 'PRO' ? 500 :
                                  subscription?.planName === 'PRO_PLUS' ? 3000 :
                                    subscription?.planName === 'ULTRA' ? 8000 : 200
                            )) * 100)}%`
                          }}
                          className="bg-foreground text-background hover:bg-foreground/90 h-full rounded-full shadow-sm text-foreground"
                        />
                      </div>
                    )}
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 relative z-10">
                    <div className="bg-foreground/5 p-6 rounded-xl border border-foreground/5">
                      <div className="text-[10px] font-bold text-muted-foreground tracking-[0.2em] uppercase mb-1">Queue Priority</div>
                      <div className="text-sm font-bold text-foreground capitalize">
                        {subscription?.limits?.priorityQueue || 'Standard'}
                      </div>
                    </div>
                    <div className="bg-foreground/5 p-6 rounded-xl border border-foreground/5">
                      <div className="text-[10px] font-bold text-muted-foreground tracking-[0.2em] uppercase mb-1">Storage Limit</div>
                      <div className="text-sm font-bold text-foreground">
                        {subscription?.limits?.storageGb === -1 ? 'Infinite' : `${subscription?.limits?.storageGb || 2} GB`}
                      </div>
                    </div>
                    <div className="bg-foreground/5 p-6 rounded-xl border border-foreground/5">
                      <div className="text-[10px] font-bold text-muted-foreground tracking-[0.2em] uppercase mb-1">Scale Multiplier</div>
                      <div className="text-sm font-bold text-foreground">x1.00</div>
                    </div>
                    <div className="bg-foreground/5 p-6 rounded-xl border border-foreground/5">
                      <div className="text-[10px] font-bold text-muted-foreground tracking-[0.2em] uppercase mb-1">Legal License</div>
                      <div className="text-sm font-bold text-foreground">
                        {subscription?.limits?.commercialLicense ? 'Commercial' : 'Personal'}
                      </div>
                    </div>
                  </div>
                </div>

                {/* AI Token Usage Section */}
                <div className="bg-foreground/5 border border-foreground/10 p-6 rounded-lg">
                  <div className="flex items-center justify-between mb-6">
                    <div>
                      <h2 className="text-sm font-bold tracking-tight text-foreground">Language Model Analytics</h2>
                      <p className="text-sm text-muted-foreground mt-1">Detailed token distribution across your AI sessions.</p>
                    </div>
                    <div className="px-4 py-2 bg-foreground/5 rounded-xl border border-foreground/10 text-[10px] font-bold text-muted-foreground tracking-widest uppercase">
                      Conversion: 100 CR / 1M TN
                    </div>
                  </div>

                  {isLoadingTokenUsage ? (
                    <div className="flex flex-col items-center justify-center py-10 gap-4">
                      <div className="w-5 h-5 border-2 border-foreground/10 border-t-white rounded-full animate-spin" />
                    </div>
                  ) : tokenUsage ? (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      <UsageCard label="Day Cycle" input={tokenUsage.todayInputTokens} output={tokenUsage.todayOutputTokens} total={tokenUsage.todayTotalTokens} accent="primary" />
                      <UsageCard label="Monthly Cycle" input={tokenUsage.monthlyInputTokens} output={tokenUsage.monthlyOutputTokens} total={tokenUsage.monthlyTotalTokens} accent="blue" />
                      <UsageCard label="All-Time Cumulative" input={tokenUsage.allTimeInputTokens} output={tokenUsage.allTimeOutputTokens} total={tokenUsage.allTimeTotalTokens} accent="purple" />
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center py-10 opacity-40">
                      <Eye className="w-5 h-5 mb-4" />
                      <p className="font-bold uppercase tracking-widest text-xs">No analytics nodes recorded</p>
                    </div>
                  )}
                </div>
              </motion.div>
            )}

            {activeTab === "features" && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="p-6 space-y-12 max-w-6xl mx-auto"
              >
                <div className="text-center mb-8">
                  <h2 className="text-base font-bold tracking-tighter mb-4">System Capabilities</h2>
                  <p className="text-muted-foreground text-sm max-w-2xl mx-auto">Master the complete Koye orchestration workflow from concept to deployment.</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <FeatureSection
                    title="Asset Orchestration"
                    description="Unified hub for managing images, 3D models, videos, and acoustic signatures."
                    steps={[
                      "Visual asset generation and curation",
                      "Cinematic sequence management",
                      "3D mesh optimization pipeline",
                      "Acoustic signature synthesis"
                    ]}
                  />
                  <FeatureSection
                    title="Project Architecture"
                    description="Advanced workspace environments for deep project persistence and scaling."
                    steps={[
                      "Isolated deployment environments",
                      "Binary asset synchronization",
                      "Multi-user collaboration nodes",
                      "Versioned history snapshots"
                    ]}
                  />
                  <FeatureSection
                    title="AI Compute Scaling"
                    description="Dynamic credit allocation for heterogeneous high-performance generation tasks."
                    steps={[
                      "Priority compute scheduling",
                      "Language model token analytics",
                      "Credit-to-compute conversion nodes",
                      "Usage threshold Monitoring"
                    ]}
                  />
                  <FeatureSection
                    title="Full Workflow Pipeline"
                    description="End-to-end concept visualization and asset deployment logic."
                    steps={[
                      "Intent classification → Concept synthesis",
                      "Multi-modal asset generation",
                      "Automated rigging & texturing",
                      "Cloud-native export protocols"
                    ]}
                  />
                </div>
              </motion.div>
            )}

            {activeTab === "accounts" && (
              <motion.div
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                className="p-6 space-y-10 max-w-4xl mx-auto"
              >
                <div className="bg-foreground/5 border border-foreground/10 p-6 rounded-lg backdrop-blur-xl">
                  <h2 className="text-sm font-bold tracking-tight mb-6 flex items-center gap-4">
                    <Key className="w-5 h-5 text-foreground" />
                    Security Protocol
                  </h2>

                  <div className="space-y-10">
                    <div className="bg-foreground/5 p-6 rounded-xl border border-foreground/5">
                      <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-[0.2em] mb-2 block">Registered Terminal</label>
                      <div className="text-sm font-bold text-foreground">{user.email}</div>
                    </div>

                    <div className="bg-foreground/5 p-6 rounded-xl border border-foreground/5 relative overflow-hidden group">
                      <div className="absolute inset-0 bg-gradient-to-r from-foreground/5 to-transparent opacity-0 group-hover:opacity-100 transition-all duration-500" />
                      <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-[0.2em] mb-2 block relative z-10">Koye-CLI Access Token</label>
                      <p className="text-xs text-muted-foreground mb-4 max-w-xl relative z-10">
                        Use this token to authenticate your local Koye-CLI instance. Run <code className="bg-background/50 px-1.5 py-0.5 rounded text-foreground font-mono">koye-cli koye login</code> in your terminal and paste this token when prompted.
                      </p>
                      
                      <div className="flex items-center gap-3 relative z-10">
                        <div className="flex-1 relative">
                          <input 
                            type="password" 
                            readOnly 
                            value={session?.access_token || ""} 
                            className="w-full bg-background/50 border border-foreground/10 px-4 py-3 rounded-lg text-foreground font-mono text-xs focus:outline-none"
                            id="cliTokenInput"
                          />
                        </div>
                        <button
                          onClick={() => {
                            if (session?.access_token) {
                              navigator.clipboard.writeText(session.access_token)
                              setCopiedToken(true)
                              setTimeout(() => setCopiedToken(false), 2000)
                            }
                          }}
                          className="px-4 py-3 bg-foreground text-background hover:bg-foreground/90 rounded-lg flex items-center gap-2 font-bold text-xs transition-all shadow-sm"
                        >
                          {copiedToken ? <CheckCheck className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                          {copiedToken ? "COPIED" : "COPY TOKEN"}
                        </button>
                      </div>
                    </div>

                    <div className="space-y-6">
                      <h3 className="text-sm font-bold tracking-tight">Identity Synchronization</h3>

                      {passwordError && (
                        <div className="p-4 bg-red-500/10 border border-red-500/20 text-red-400 rounded-lg text-sm font-bold">
                          Protocol Error: {passwordError}
                        </div>
                      )}

                      {passwordSuccess && (
                        <div className="p-4 bg-green-500/10 border border-green-500/20 text-green-400 rounded-lg text-sm font-bold">
                          Authorization Successful: {passwordSuccess}
                        </div>
                      )}

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div className="space-y-2">
                          <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest px-1">Current Password</label>
                          <input
                            type="password"
                            value={passwordForm.current}
                            onChange={(e) => setPasswordForm({ ...passwordForm, current: e.target.value })}
                            className="w-full bg-foreground/5 border border-foreground/10 px-5 py-4 rounded-lg text-foreground focus:outline-none focus:border-foreground/30/50 transition-all"
                            placeholder="••••••••"
                          />
                        </div>
                        <div className="space-y-2">
                          <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest px-1">New Key Signature</label>
                          <input
                            type="password"
                            value={passwordForm.new}
                            onChange={(e) => setPasswordForm({ ...passwordForm, new: e.target.value })}
                            className="w-full bg-foreground/5 border border-foreground/10 px-5 py-4 rounded-lg text-foreground focus:outline-none focus:border-foreground/30/50 transition-all"
                            placeholder="••••••••"
                          />
                        </div>
                      </div>

                      <div className="space-y-2">
                        <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest px-1">Confirm Signature</label>
                        <input
                          type="password"
                          value={passwordForm.confirm}
                          onChange={(e) => setPasswordForm({ ...passwordForm, confirm: e.target.value })}
                          className="w-full bg-foreground/5 border border-foreground/10 px-5 py-4 rounded-lg text-foreground focus:outline-none focus:border-foreground/30/50 transition-all"
                          placeholder="••••••••"
                        />
                      </div>

                      <button
                        onClick={handleChangePassword}
                        className="px-4 py-2 text-sm bg-foreground text-background hover:bg-foreground/90 font-bold rounded-lg hover:scale-105 transition-all shadow-sm flex items-center gap-3"
                      >
                        <Key className="h-5 w-5" />
                        UPDATE SECURITY KEY
                      </button>
                    </div>

                    <div className="pt-10 border-t border-foreground/5">
                      <h3 className="text-sm font-bold text-red-500 mb-6 flex items-center gap-3">
                        <AlertTriangle className="w-4 h-4" />
                        Terminal Purge
                      </h3>

                      <div className="p-5 bg-red-400/5 border border-red-500/20 rounded-xl space-y-6">
                        <p className="text-sm text-red-300 leading-relaxed">
                          Account deactivation is permanent. All cinematic sequences, 3D meshes, and project nodes will be purged from the Koye core in accordance with data safety protocols.
                        </p>

                        {!showDeleteConfirm ? (
                          <button
                            onClick={() => setShowDeleteConfirm(true)}
                            className="px-3 py-1.5 text-xs bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-foreground rounded-xl transition-all font-bold text-xs"
                          >
                            INITIATE PURGE
                          </button>
                        ) : (
                          <div className="space-y-4">
                            <p className="text-xs text-red-400 font-bold uppercase tracking-widest">Type "DELETE" to authorize purge</p>
                            <div className="flex gap-4">
                              <input
                                type="text"
                                placeholder="Authorization Key"
                                className="flex-1 bg-foreground/5 border border-red-500/30 px-5 py-3 rounded-xl text-foreground focus:outline-none focus:border-red-500 transition-all"
                                id="deleteConfirm"
                              />
                              <button
                                onClick={() => {
                                  const input = document.getElementById("deleteConfirm") as HTMLInputElement
                                  if (input?.value === "DELETE") handleDeleteAccount()
                                  else alert("Authorization failed: Keys do not match.")
                                }}
                                className="px-3 py-1.5 text-xs bg-red-600 text-foreground rounded-xl font-bold text-xs hover:bg-red-700 transition-all"
                              >
                                CONFIRM PURGE
                              </button>
                              <button
                                onClick={() => setShowDeleteConfirm(false)}
                                className="px-3 py-1.5 text-xs bg-foreground/5 text-muted-foreground rounded-xl font-bold text-xs hover:bg-foreground/10 transition-all"
                              >
                                ABORT
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            {activeTab === "projects" && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="p-6 max-w-7xl mx-auto"
              >
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h2 className="text-base font-bold text-foreground tracking-tighter">Your Projects</h2>
                    <p className="text-muted-foreground text-sm mt-2">Scale your ideas with dedicated workspace environments.</p>
                  </div>
                  <button
                    onClick={() => setShowProjectDialog(true)}
                    className="px-4 py-2 text-sm bg-foreground text-background hover:bg-foreground/90 font-bold rounded-lg hover:scale-105 active:scale-95 transition-all shadow-sm flex items-center gap-3"
                  >
                    <Plus className="h-5 w-5" />
                    NEW DEPLOYMENT
                  </button>
                </div>

                {isLoadingProjects ? (
                  <div className="flex flex-col items-center justify-center py-32 gap-3">
                    <div className="w-5 h-5 border-4 border-foreground/30/10 border-t-white rounded-full animate-spin" />
                  </div>
                ) : projects.length === 0 ? (
                  <div className="bg-foreground/5 border-2 border-dashed border-foreground/10 rounded-lg p-24 text-center group hover:bg-foreground/10 transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]">
                    <div className="w-5 h-5 rounded-xl bg-foreground/5 text-foreground flex items-center justify-center mx-auto mb-8 group-hover:scale-110 transition-transform">
                      <Folder className="h-4 w-4 text-foreground" />
                    </div>
                    <h3 className="text-sm font-bold text-foreground mb-4">No Active Deployments</h3>
                    <p className="text-muted-foreground text-sm max-w-md mx-auto mb-6 leading-relaxed">Initiate your first project to enable file persistence, collaborative scaling, and AI orchestration.</p>
                    <button
                      onClick={() => setShowProjectDialog(true)}
                      className="px-4 py-2 text-sm bg-foreground text-background font-bold rounded-xl hover:scale-105 transition-all tracking-tighter"
                    >
                      CREATE YOUR FIRST WORKSPACE
                    </button>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4">
                    {projects.map((project) => (
                      <motion.div
                        key={project.id}
                        whileHover={{ y: -5 }}
                        onClick={() => handleOpenProject(project)}
                        className="bg-foreground/5 border border-foreground/10 p-4 rounded-xl cursor-pointer hover:bg-foreground/10 transition-all group relative overflow-hidden flex flex-col justify-between aspect-[2/1]"
                      >
                        <div className="absolute top-0 right-0 p-3 opacity-0 scale-95 group-hover:opacity-100 group-hover:scale-100 transition-all duration-300 z-10">
                          <button
                            onClick={(e) => handleDeleteProject(e, project.id)}
                            className="p-2 bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white rounded-lg transition-all"
                            title="Purge project"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>

                        <div>
                          <div className="flex items-center gap-3 mb-2">
                            <div className="p-2 rounded-lg bg-foreground/5 text-foreground flex items-center justify-center group-hover:bg-foreground group-hover:text-background transition-all duration-300">
                              <Folder className="h-4 w-4" />
                            </div>
                            <h3 className="text-sm font-bold text-foreground tracking-tight group-hover:text-foreground transition-colors truncate pr-8">{project.name}</h3>
                          </div>
                          {project.description && (
                            <p className="text-xs text-muted-foreground line-clamp-1 leading-relaxed">{project.description}</p>
                          )}
                        </div>

                        <div className="flex items-center justify-between pt-3 border-t border-foreground/5 mt-3">
                          <div className="flex items-center gap-2">
                            <Calendar className="h-3 w-3 text-muted-foreground/50" />
                            <span className="text-[10px] font-bold text-muted-foreground/60 uppercase tracking-widest">
                              {new Date(project.createdAt).toLocaleDateString()}
                            </span>
                          </div>
                          <div className="w-4 h-4 rounded-full border border-foreground/10 flex items-center justify-center group-hover:bg-foreground group-hover:text-background transition-all">
                            <ChevronRight className="h-3 w-3" />
                          </div>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                )}
              </motion.div>
            )}
          </div >
        </div >
      </div >

      {/* Image Modal */}
      {
        selectedImage && (
          <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4" onClick={() => setSelectedImage(null)}>
            <div className="relative max-w-6xl w-full max-h-full flex items-center justify-center gap-4" onClick={(e) => e.stopPropagation()}>

              {/* Previous Button */}
              {imageGroup && imageGroup.length > 1 && (
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    const newIndex = (currentImageIndex - 1 + imageGroup.length) % imageGroup.length
                    setCurrentImageIndex(newIndex)
                    setSelectedImage(imageGroup[newIndex])
                  }}
                  className="p-2 text-foreground hover:bg-foreground/10 rounded-full transition-colors shrink-0"
                >
                  <ChevronLeft className="h-5 w-5" />
                </button>
              )}

              <div className="relative max-w-4xl max-h-full">
                <button
                  onClick={() => setSelectedImage(null)}
                  className="absolute -top-6 right-0 text-foreground hover:text-foreground/70"
                >
                  <X className="h-4 w-4" />
                </button>
                <img
                  src={selectedImage}
                  alt="Full size"
                  className="max-w-full max-h-[90vh] object-contain"
                />
                {/* Counter */}
                {imageGroup && imageGroup.length > 1 && (
                  <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 bg-black/50 text-foreground px-3 py-1 rounded-full text-sm font-mono">
                    {currentImageIndex + 1} / {imageGroup.length}
                  </div>
                )}
              </div>

              {/* Next Button */}
              {imageGroup && imageGroup.length > 1 && (
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    const newIndex = (currentImageIndex + 1) % imageGroup.length
                    setCurrentImageIndex(newIndex)
                    setSelectedImage(imageGroup[newIndex])
                  }}
                  className="p-2 text-foreground hover:bg-foreground/10 rounded-full transition-colors shrink-0"
                >
                  <ChevronRight className="h-5 w-5" />
                </button>
              )}
            </div>
          </div>
        )
      }

      {/* 3D Model Viewer Modal */}
      {
        selectedModel && (
          <div className="fixed inset-0 z-50 bg-background">
            <div className="h-full flex flex-col">
              <div className="border-b border-border px-6 py-4 flex items-center justify-between shrink-0">
                <h2 className="text-sm font-bold text-foreground font-mono">$ 3d_model_viewer</h2>
                <button
                  onClick={() => setSelectedModel(null)}
                  className="p-2 hover:bg-muted rounded"
                >
                  <X className="h-5 w-5 text-foreground" />
                </button>
              </div>
              <div className="flex-1 overflow-hidden">
                <ModelViewer
                  model={selectedModel}
                  onClose={() => setSelectedModel(null)}
                />
              </div>
            </div>
          </div>
        )
      }

      {/* Video Viewer Modal */}
      {
        selectedVideo && (
          <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4" onClick={() => setSelectedVideo(null)}>
            <div className="relative max-w-4xl max-h-full w-full" onClick={(e) => e.stopPropagation()}>
              <button
                onClick={() => setSelectedVideo(null)}
                className="absolute -top-6 right-0 text-foreground hover:text-foreground/70"
              >
                <X className="h-4 w-4" />
              </button>
              <VideoPlayer
                videoUrl={selectedVideo}
                className="w-full"
              />
            </div>
          </div>
        )
      }

      {/* Delete Confirmation Dialog */}
      {showDeleteConfirm && itemToDelete && (
        <div 
          className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-md flex items-center justify-center p-4" 
          onClick={() => {
            setShowDeleteConfirm(false)
            setItemToDelete(null)
          }}
        >
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-background/80 backdrop-blur-2xl border border-foreground/10 w-full max-w-sm p-6 rounded-2xl shadow-xl space-y-6" 
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex flex-col items-center text-center space-y-4">
              <div className="w-12 h-12 rounded-full bg-red-500/10 flex items-center justify-center text-red-500">
                <Trash2 className="h-6 w-6" />
              </div>
              <div>
                <h2 className="text-base font-bold text-foreground mb-1 tracking-tight">Confirm Deletion</h2>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Are you sure you want to permanently delete this {itemToDelete.type}? This action cannot be reversed.
                </p>
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                onClick={() => {
                  setShowDeleteConfirm(false)
                  setItemToDelete(null)
                }}
                className="flex-1 px-4 py-2 text-xs font-bold bg-foreground/5 hover:bg-foreground/10 text-foreground rounded-lg transition-all border border-foreground/5"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteItem}
                disabled={isDeleting}
                className="flex-1 px-4 py-2 text-xs font-bold bg-red-500 text-white hover:bg-red-600 rounded-lg transition-all shadow-lg shadow-red-500/20 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isDeleting ? (
                  <div className="w-3 h-3 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                ) : (
                  <Trash2 className="h-3 w-3" />
                )}
                {isDeleting ? "Processing..." : "Purge Asset"}
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {/* Create Project Dialog */}
      {
        showProjectDialog && (
          <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4" onClick={() => setShowProjectDialog(false)}>
            <div className="bg-background border-2 border-border w-full max-w-md p-6" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-sm font-bold text-foreground font-mono">$ create_project</h2>
                <button
                  onClick={() => setShowProjectDialog(false)}
                  className="p-2 hover:bg-muted rounded"
                >
                  <X className="h-5 w-5 text-foreground" />
                </button>
              </div>



              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1 font-mono">
                    Project Name *
                  </label>
                  <input
                    type="text"
                    value={newProjectName}
                    onChange={(e) => setNewProjectName(e.target.value)}
                    placeholder="Enter project name"
                    className="w-full border border-border px-3 py-2 bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-foreground font-mono"
                    autoFocus
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1 font-mono">
                    Description (optional)
                  </label>
                  <textarea
                    value={newProjectDescription}
                    onChange={(e) => setNewProjectDescription(e.target.value)}
                    placeholder="Enter project description"
                    rows={3}
                    className="w-full border border-border px-3 py-2 bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-foreground font-mono resize-none"
                  />
                </div>
                <div className="flex gap-2">
                  <Button
                    onClick={handleCreateProject}
                    disabled={!newProjectName.trim()}
                    className="flex-1 bg-foreground text-background hover:bg-foreground/90 border border-foreground font-mono disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Create & Open
                  </Button>
                  <Button
                    onClick={() => setShowProjectDialog(false)}
                    variant="outline"
                    className="flex-1 border-border bg-background text-foreground hover:bg-muted font-mono"
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )
      }
      {/* Import to Project Dialog */}
      {
        showImportDialog && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-background border-2 border-border w-full max-w-md p-6 shadow-[8px_8px_0px_0px_hsl(var(--foreground)/0.2)]">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-sm font-bold text-foreground font-mono">Import to Project</h3>
                <button
                  onClick={() => setShowImportDialog(false)}
                  className="p-2 hover:bg-muted rounded"
                >
                  <X className="h-5 w-5 text-foreground" />
                </button>
              </div>

              <div className="mb-4">
                <p className="text-sm text-foreground font-mono mb-2">
                  Select a project to import <span className="font-bold text-foreground" title={assetToImport?.name}>{(() => {
                    let name = assetToImport?.name || ''
                    // Add extension based on type if name doesn't have one
                    const hasExtension = name.includes('.')
                    if (!hasExtension && assetToImport?.type) {
                      const extMap: Record<string, string> = { image: '.png', model: '.glb', video: '.mp4', audio: '.mp3' }
                      name = name + (extMap[assetToImport.type] || '')
                    }
                    if (name.length <= 15) return name
                    const lastDot = name.lastIndexOf('.')
                    if (lastDot === -1 || lastDot === 0) return name.slice(0, 10) + '..'
                    const ext = name.slice(lastDot)
                    const baseName = name.slice(0, lastDot)
                    if (baseName.length <= 10) return name
                    return baseName.slice(0, 10) + '..' + ext
                  })()}</span> to:
                </p>
              </div>

              <div className="space-y-2 max-h-60 overflow-y-auto border border-border p-2 mb-4">
                {isLoadingProjects ? (
                  <div className="text-center py-4 text-muted-foreground font-mono text-sm">
                    Loading projects...
                  </div>
                ) : projects.length === 0 ? (
                  <div className="text-center py-4 text-muted-foreground font-mono text-sm">
                    No projects found. Create one first.
                  </div>
                ) : (
                  projects.map((project) => (
                    <button
                      key={project.id}
                      onClick={() => handleImportToProject(project.id)}
                      disabled={isImporting}
                      className="w-full text-left px-3 py-2 hover:bg-muted flex items-center gap-2 font-mono text-sm transition-colors disabled:opacity-50 text-foreground"
                    >
                      <Folder className="h-4 w-4 text-foreground" />
                      <span className="truncate text-foreground">{project.name}</span>
                    </button>
                  ))
                )}
              </div>

              <div className="flex justify-end">
                <Button
                  onClick={() => setShowImportDialog(false)}
                  variant="outline"
                  className="border-border hover:bg-muted font-mono text-foreground"
                >
                  Cancel
                </Button>
              </div>
            </div>
          </div>
        )
      }



      {/* Project Creation Loading Overlay */}
      {isCreatingProject && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-background/80 backdrop-blur-md">
          <div className="flex flex-col items-center gap-4 p-5 bg-background border border-border shadow-2xl rounded-xl">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-foreground" />
            <p className="text-foreground font-mono font-bold tracking-tight">Creating your project...</p>
          </div>
        </div>
      )}
    </div >
  )
}

interface NavItemProps {
  icon?: React.ElementType
  label: string
  active?: boolean
  collapsed: boolean
  number?: string
  badge?: string
  onClick?: () => void
}

function NavItem({ icon: Icon, label, active, collapsed, number, badge, onClick }: NavItemProps) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-300 group relative overflow-hidden",
        active
          ? "bg-foreground/5 text-foreground text-foreground border border-foreground/10 shadow-[0_0_20px_rgba(var(--primary-rgb),0.1)]"
          : "text-muted-foreground hover:bg-foreground/5 hover:text-foreground border border-transparent",
        collapsed && "justify-center px-2"
      )}
    >
      {active && (
        <motion.div
          layoutId="activeTab"
          className="absolute left-0 w-1 h-6 bg-foreground text-background hover:bg-foreground/90 rounded-r-full"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
        />
      )}
      {Icon && <Icon className={cn("h-5 w-5 shrink-0 transition-transform group-hover:scale-110", active && "text-foreground")} />}
      {!collapsed && <span className={cn("flex-1 text-left font-medium tracking-tight", !Icon && "pl-2")}>{label}</span>}
      {!collapsed && (number || badge) && (
        <span className={cn(
          "text-[10px] font-bold px-2 py-0.5 rounded-full",
          active ? "bg-foreground/5 text-foreground text-foreground" : "bg-foreground/10 text-muted-foreground"
        )}>
          {number || badge}
        </span>
      )}
    </button>
  )
}

function UsageCard({ label, input, output, total, accent }: { label: string, input: number, output: number, total: number, accent: 'primary' | 'blue' | 'purple' }) {
  const textColor = accent === 'primary' ? 'text-foreground' : accent === 'blue' ? 'text-foreground' : 'text-purple-400';

  return (
    <div className="bg-foreground/5 border border-foreground/10 p-6 rounded-xl hover:bg-foreground/10 transition-all">
      <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-4">{label}</p>
      <div className="space-y-3">
        <div className="flex justify-between items-center">
          <span className="text-sm text-muted-foreground">Input Tokens</span>
          <span className="text-sm font-bold text-foreground">{formatTokenCount(input)}</span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-sm text-muted-foreground">Output Tokens</span>
          <span className="text-sm font-bold text-foreground">{formatTokenCount(output)}</span>
        </div>
        <div className="pt-3 border-t border-foreground/5 flex justify-between items-center">
          <span className="text-sm font-bold text-foreground">Total Usage</span>
          <span className={cn("text-sm font-bold", textColor)}>{formatTokenCount(total)}</span>
        </div>
      </div>
    </div>
  )
}

function FeatureSection({ title, description, steps }: FeatureSectionProps) {
  return (
    <div className="bg-foreground/5 border border-foreground/10 backdrop-blur-md p-6 rounded-xl hover:bg-foreground/10 transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] group">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-4 h-4 rounded-lg bg-foreground/5 text-foreground flex items-center justify-center group-hover:scale-110 transition-transform">
          <Layers className="w-5 h-5 text-foreground" />
        </div>
        <h3 className="text-sm font-bold text-foreground tracking-tight">{title}</h3>
      </div>
      <p className="text-sm text-muted-foreground mb-6 leading-relaxed">{description}</p>
      <ul className="space-y-3">
        {steps.map((step, index) => (
          <li key={index} className="text-xs text-muted-foreground flex items-center gap-3">
            <span className="w-1.5 h-1.5 rounded-full bg-primary/40 shrink-0" />
            {step}
          </li>
        ))}
      </ul>
    </div>
  )
}

