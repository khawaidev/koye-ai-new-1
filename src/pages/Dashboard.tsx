import {
  AlertTriangle,
  Box,
  Calendar,
  ChevronLeft,
  ChevronRight,
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
import { useCallback, useEffect, useState } from "react"
import { useNavigate, useSearchParams } from "react-router-dom"
import appIconLight from "../assets/icon.jpg"
import appIconDark from "../assets/icon.png"
import { VideoPlayer } from "../components/chat/VideoPlayer"
import { GitHubConnectionPrompt } from "../components/github/GitHubConnectionPrompt"
import { ModelViewer } from "../components/model-viewer/ModelViewer"
import { useTheme } from "../components/theme-provider"
import { Button } from "../components/ui/button"
import { ThemeToggle } from "../components/ui/theme-toggle"
import { useAuth } from "../hooks/useAuth"
import { usePricing } from "../hooks/usePricing"
import { cn } from "../lib/utils"
import { getGitHubOAuthUrl } from "../services/github"
import {
  ensureProjectRepository,
  getGitHubUser,
  initializeProjectGitHubSync,
  type GitHubConnectionDetails
} from "../services/githubProjectSync"
import { deleteAudio, deleteImage, deleteModel, deleteVideo, getUserAudio, getUserImages, getUserModels, getUserVideos, type AudioWithDb, type ImageWithDb, type ModelWithDb, type VideoWithDb } from "../services/multiDbDataService"
import { getPricingPlans, subscribeToPlan } from "../services/pricingService"
import { saveSingleProjectFile, type GitHubConnectionInput } from "../services/projectFiles"
import { createProject, deleteProject, getProjects, signOut, supabase } from "../services/supabase"
import { calculateTokenCredits, formatTokenCount, getUserTokenSummary, type UserTokenSummary } from "../services/tokenUsageService"
import { useAppStore } from "../store/useAppStore"
import type { Model, Project } from "../types"

type TabType = "explore" | "profile" | "usage" | "projects" | "features" | "accounts"

export function Dashboard() {
  const { theme } = useTheme()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { user, loading } = useAuth()
  const { subscription, usage, refresh: refreshPricing } = usePricing()
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false)
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
  const [itemToDelete, setItemToDelete] = useState<{ type: "image" | "model" | "video" | "audio"; id: string; dbId: string } | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)
  const [passwordForm, setPasswordForm] = useState({ current: "", new: "", confirm: "" })
  const [passwordError, setPasswordError] = useState<string | null>(null)
  const [passwordSuccess, setPasswordSuccess] = useState<string | null>(null)
  const [projects, setProjects] = useState<Project[]>([])
  const [isLoadingProjects, setIsLoadingProjects] = useState(false)
  const [showProjectDialog, setShowProjectDialog] = useState(false)
  const [newProjectName, setNewProjectName] = useState("")
  const [newProjectDescription, setNewProjectDescription] = useState("")
  const { githubConnection, setGitHubConnection, addGeneratedFile, setCurrentProject } = useAppStore()

  // Import to Project State
  const [showImportDialog, setShowImportDialog] = useState(false)
  const [assetToImport, setAssetToImport] = useState<{ type: "image" | "model" | "video" | "audio"; url: string; name: string } | null>(null)
  const [isImporting, setIsImporting] = useState(false)

  // GitHub Connection Prompt State
  const [showGitHubPrompt, setShowGitHubPrompt] = useState(false)
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

  const loadUserAssets = async () => {
    if (!user) return
    setIsLoadingAssets(true)
    try {
      const [images, models, videos, audio] = await Promise.all([
        getUserImages(user.id),
        getUserModels(user.id),
        getUserVideos(user.id),
        getUserAudio(user.id),
      ])
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
        console.log("Dashboard visible - refreshing assets")
        loadUserAssets()
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

    // Check if GitHub is connected with valid token
    if (!githubConnection || !githubConnection.accessToken) {
      setShowProjectDialog(false)
      setShowGitHubPrompt(true)
      return
    }

    // Don't allow creation with placeholder OAuth code
    if (githubConnection.accessToken.startsWith('oauth_code_')) {
      alert("GitHub connection pending. Please complete the OAuth flow or reconnect.")
      setShowProjectDialog(false)
      setShowGitHubPrompt(true)
      return
    }

    setIsCreatingProject(true)

    try {
      // Get GitHub user info to determine repo owner
      const githubUser = await getGitHubUser(githubConnection.accessToken)
      if (!githubUser) {
        throw new Error("Could not fetch GitHub user info. Please reconnect your GitHub account.")
      }

      // Ensure the koye-projects repository exists
      const repo = await ensureProjectRepository(
        githubConnection.accessToken,
        githubUser.login
      )
      if (!repo) {
        throw new Error("Failed to create or access the koye-projects repository.")
      }

      // Update connection with repo info if needed
      if (!githubConnection.repoOwner || !githubConnection.repoName) {
        const updatedConnection = {
          ...githubConnection,
          repoOwner: repo.full_name.split('/')[0],
          repoName: repo.name,
          branch: repo.default_branch || 'main'
        }
        setGitHubConnection(updatedConnection)

        // Persist to localStorage
        const storageKey = `github_connection_${user.id}`
        localStorage.setItem(storageKey, JSON.stringify(updatedConnection))
      }

      // Create project in Supabase
      const newProject = await createProject({
        userId: user.id,
        name: newProjectName.trim(),
        description: newProjectDescription.trim() || "",
      })

      // Initialize GitHub sync for the project (create folder in repo)
      const connection: GitHubConnectionDetails = {
        accessToken: githubConnection.accessToken,
        repoOwner: repo.full_name.split('/')[0],
        repoName: repo.name,
        branch: repo.default_branch || 'main'
      }

      const syncInitialized = await initializeProjectGitHubSync(
        connection,
        newProject.id,
        newProject.name
      )

      if (!syncInitialized) {
        console.warn("Failed to initialize GitHub sync for project, but project was created.")
      }

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
    const builderUrl =
      "/builder/" + project.id + "?name=" + encodeURIComponent(project.name)
    window.open(builderUrl, "_blank")
  }

  const handleDeleteProject = async (e: React.MouseEvent, projectId: string) => {
    e.stopPropagation()
    if (confirm("Are you sure you want to delete this project? This action cannot be undone.")) {
      try {
        await deleteProject(projectId)
        setProjects(projects.filter(p => p.id !== projectId))
      } catch (error) {
        console.error("Error deleting project:", error)
        alert("Failed to delete project. Please try again.")
      }
    }
  }

  const handleConnectGitHub = () => {
    try {
      // Redirect to GitHub OAuth
      const oauthUrl = getGitHubOAuthUrl()
      window.location.href = oauthUrl
    } catch (error) {
      // Show error message if GitHub Client ID is not configured
      const errorMessage = error instanceof Error ? error.message : "Failed to connect to GitHub"
      alert(errorMessage)
      console.error("GitHub OAuth error:", error)
    }
  }

  // Load GitHub connection from localStorage on mount and when user changes
  useEffect(() => {
    if (user) {
      const storageKey = "github_connection_" + user.id
      const storedConnection = localStorage.getItem(storageKey)
      console.log("Loading GitHub connection for user:", user.id, "Found:", !!storedConnection)

      if (storedConnection) {
        try {
          const connection = JSON.parse(storedConnection)
          console.log("Parsed GitHub connection:", connection)

          // Set connection regardless of whether it's a placeholder or real token
          // This allows the UI to show "Connected" status
          if (connection && connection.accessToken) {
            setGitHubConnection(connection)
            console.log("GitHub connection loaded and set in store")
          }
        } catch (error) {
          console.error("Failed to load GitHub connection:", error)
        }
      } else {
        // No stored connection, ensure store is cleared
        setGitHubConnection(null)
      }
    } else {
      // Clear connection if user logs out
      setGitHubConnection(null)
    }
  }, [user, setGitHubConnection])

  // Check for GitHub OAuth callback
  useEffect(() => {
    // Wait for user to be loaded before processing OAuth callback
    if (loading) {
      console.log("Waiting for user to load before processing OAuth callback...")
      return
    }

    const urlParams = new URLSearchParams(window.location.search)
    const code = urlParams.get("code")
    const state = urlParams.get("state")
    const error = urlParams.get("error")
    const errorDescription = urlParams.get("error_description")

    // Check if we've already processed this callback (to prevent duplicate processing)
    const processedKey = code ? "github_oauth_processed_" + code : null
    if (processedKey && sessionStorage.getItem(processedKey)) {
      // Already processed this callback, just clean up URL if needed
      if (code || state) {
        const newUrl = window.location.pathname + "?tab=projects"
        window.history.replaceState({}, "", newUrl)
      }
      return
    }

    if (error) {
      // Handle OAuth error
      console.error("GitHub OAuth error:", error, errorDescription)
      alert("GitHub OAuth error: " + (errorDescription || error))
      // Clean up URL
      const newUrl = window.location.pathname + "?tab=projects"
      window.history.replaceState({}, "", newUrl)
      return
    }

    if (code && state) {
      // Verify state matches what we stored
      const storedState = sessionStorage.getItem("github_oauth_state")
      if (!storedState) {
        // State was already processed and cleaned up, or this is a duplicate callback
        // Just clean up URL and return
        const newUrl = window.location.pathname + "?tab=projects"
        window.history.replaceState({}, "", newUrl)
        return
      }

      if (state !== storedState) {
        console.error("GitHub OAuth state mismatch. Expected:", storedState, "Got:", state)
        alert("GitHub OAuth verification failed. Please try again.")
        sessionStorage.removeItem("github_oauth_state")
        // Clean up URL
        const newUrl = window.location.pathname + "?tab=projects"
        window.history.replaceState({}, "", newUrl)
        return
      }

      // Handle OAuth callback - wait for user to be available
      console.log("GitHub OAuth callback received:", { code, state, userId: user?.id, loading })

      if (!user) {
        console.warn("User not loaded yet, will retry when user is available")
        // User not loaded yet, will retry when user is available (this useEffect will run again)
        return
      }

      // Mark this callback as processed to prevent duplicate processing
      if (processedKey) {
        sessionStorage.setItem(processedKey, "true")
      }

      // Exchange the OAuth code for an access token via local API server
      const exchangeToken = async () => {
        try {
          console.log("Exchanging OAuth code for access token...")

          // Use local API server for development
          // For production, use Supabase Edge Function or your own backend
          const apiUrl = import.meta.env.VITE_GITHUB_OAUTH_API_URL || "http://localhost:3001/api/github-oauth"

          const response = await fetch(apiUrl, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ code }),
          })

          if (!response.ok) {
            const errorData = await response.json()
            throw new Error(errorData.error || "Failed to exchange OAuth code")
          }

          const data = await response.json()
          console.log("✓ OAuth token exchange successful:", { user: data.user?.login })

          const connection = {
            accessToken: data.access_token,
            repoOwner: data.user?.login || "",
            repoName: "", // Will be set when user creates first project
            branch: "main"
          }

          // Persist to localStorage first
          const storageKey = "github_connection_" + user.id
          localStorage.setItem(storageKey, JSON.stringify(connection))
          console.log("✓ GitHub connection saved to localStorage with key:", storageKey)

          // Then set in store (this will trigger UI update)
          setGitHubConnection(connection)
          console.log("✓ GitHub connection set in store")

          // Clean up state
          sessionStorage.removeItem("github_oauth_state")

          // Clean up URL
          const newUrl = window.location.pathname + "?tab=projects"
          window.history.replaceState({}, "", newUrl)
          console.log("✓ URL cleaned up, redirected to projects tab")

        } catch (error) {
          console.error("Failed to exchange OAuth code:", error)
          alert("Failed to connect GitHub: " + (error instanceof Error ? error.message : "Unknown error"))
          sessionStorage.removeItem("github_oauth_state")

          // Clean up URL even on error
          const newUrl = window.location.pathname + "?tab=projects"
          window.history.replaceState({}, "", newUrl)
        }
      }

      exchangeToken()
    }
  }, [user, loading, setGitHubConnection])

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
        githubConnection as GitHubConnectionInput | null
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
          await deleteImage(itemToDelete.id, itemToDelete.dbId)
          setUserImages(userImages.filter(img => img.id !== itemToDelete.id))
          break
        case "model":
          await deleteModel(itemToDelete.id, itemToDelete.dbId)
          setUserModels(userModels.filter(model => model.id !== itemToDelete.id))
          break
        case "video":
          await deleteVideo(itemToDelete.id, itemToDelete.dbId)
          setUserVideos(userVideos.filter(video => video.id !== itemToDelete.id))
          break
        case "audio":
          await deleteAudio(itemToDelete.id, itemToDelete.dbId)
          setUserAudio(userAudio.filter(audio => audio.id !== itemToDelete.id))
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
    <div className="flex flex-col h-screen bg-background overflow-hidden font-mono">
      {/* Top Header with Logo and Builder Button */}
      <div className="border-b border-border px-6 py-4 flex items-center justify-between shrink-0 bg-background text-foreground">
        <div className="flex items-center gap-3 relative">
          <img
            src={theme === "dark" ? appIconDark : appIconLight}
            alt="KOYE AI"
            className="h-12 w-12 object-contain"
          />
          <div>
            <h1 className="text-xl font-semibold tracking-tight text-foreground font-mono">
              KOYE<span className="font-extrabold">_</span>AI
            </h1>
            <p className="text-xs text-muted-foreground mt-0.5 font-mono">
              AI game builder
            </p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <ThemeToggle />
          <button
            onClick={handleBuilder}
            className="px-4 py-2 bg-background text-foreground hover:bg-muted font-mono text-xs font-bold border-2 border-foreground shadow-[2px_2px_0px_0px_currentColor] hover:shadow-[1px_1px_0px_0px_currentColor] transition-all"
          >
            $ builder
          </button>
        </div>
      </div>

      {/* Main Content Area with Sidebar */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left Sidebar */}
        <div
          className={cn(
            "bg-background border-r border-border transition-all duration-300 flex flex-col",
            isSidebarCollapsed ? "w-20" : "w-64"
          )}
        >
          {/* Sidebar Toggle Button */}
          <div className="p-4 border-b border-border flex items-center justify-between">
            {!isSidebarCollapsed && (
              <span className="text-sm font-bold text-foreground">Dashboard</span>
            )}
            <button
              onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
              className="p-1 hover:bg-muted rounded border border-border"
            >
              <ChevronLeft
                className={cn(
                  "h-4 w-4 text-foreground transition-transform",
                  isSidebarCollapsed && "rotate-180"
                )}
              />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-4 bg-background">
            <div className="space-y-1 mb-6">
              <NavItem
                icon={Eye}
                label="Explore"
                active={activeTab === "explore"}
                onClick={() => setActiveTab("explore")}
                collapsed={isSidebarCollapsed}
                number="1"
              />
              <NavItem
                icon={UserIcon}
                label="Profile"
                active={activeTab === "profile"}
                onClick={() => setActiveTab("profile")}
                collapsed={isSidebarCollapsed}
                number="2"
              />
              <NavItem
                icon={TrendingUp}
                label="Usage"
                active={activeTab === "usage"}
                onClick={() => setActiveTab("usage")}
                collapsed={isSidebarCollapsed}
                number="3"
              />
              <NavItem
                icon={Home}
                label="Projects"
                active={activeTab === "projects"}
                onClick={() => setActiveTab("projects")}
                collapsed={isSidebarCollapsed}
                number="4"
              />
              <NavItem
                icon={Settings}
                label="Features"
                active={activeTab === "features"}
                onClick={() => setActiveTab("features")}
                collapsed={isSidebarCollapsed}
                number="5"
              />
              <NavItem
                icon={HelpCircle}
                label="Accounts"
                active={activeTab === "accounts"}
                onClick={() => setActiveTab("accounts")}
                collapsed={isSidebarCollapsed}
                number="6"
              />
            </div>

            {/* Resources */}
            <div className="space-y-1 mb-6">
              <div className="text-xs text-muted-foreground mb-2 px-2">RESOURCES</div>
              <NavItem
                icon={Grid3x3}
                label="Feed"
                collapsed={isSidebarCollapsed}
                number="7"
              />
              <NavItem
                icon={MessageSquare}
                label="Thoughts"
                collapsed={isSidebarCollapsed}
                number="8"
              />
              <NavItem
                icon={Layers}
                label="Stack"
                collapsed={isSidebarCollapsed}
                number="9"
              />
            </div>

            {/* Connect */}
            <div className="space-y-1 mb-6">
              <div className="text-xs text-muted-foreground mb-2 px-2">CONNECT</div>
              <NavItem
                icon={Mail}
                label="Contact"
                collapsed={isSidebarCollapsed}
                badge="AC"
              />
              <NavItem
                icon={MessageSquare}
                label="Twitter"
                collapsed={isSidebarCollapsed}
                badge="→"
              />
              <NavItem
                icon={MessageSquare}
                label="LinkedIn"
                collapsed={isSidebarCollapsed}
                badge="→"
              />
              <NavItem
                icon={MessageSquare}
                label="YouTube"
                collapsed={isSidebarCollapsed}
                badge="→"
              />
            </div>
          </div>

          {/* Bottom Section */}
          <div className="p-4 border-t border-border space-y-2">
            <button
              onClick={handleLogout}
              className="w-full flex items-center gap-3 px-3 py-2 text-foreground hover:bg-muted rounded border border-border transition-colors"
            >
              <LogOut className="h-4 w-4" />
              {!isSidebarCollapsed && <span className="text-sm">Logout</span>}
              {!isSidebarCollapsed && <span className="ml-auto text-xs">X</span>}
            </button>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input
                type="text"
                placeholder={isSidebarCollapsed ? "Q" : "Q Search..."}
                className="w-full pl-10 pr-3 py-2 bg-background border border-border rounded text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-0"
              />
              {!isSidebarCollapsed && (
                <span className="absolute right-3 top-1/2 transform -translate-y-1/2 text-xs text-muted-foreground">
                  S
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Main Content Area */}
        <div className="flex-1 flex flex-col bg-background overflow-hidden">
          {/* Tab Content */}
          <div className="flex-1 overflow-y-auto">
            {activeTab === "explore" && (
              <div className="p-12">
                <h1 className="text-4xl font-bold text-foreground mb-4">
                  Your Ultimate Personal Online Business Hub.
                </h1>
                <p className="text-base text-foreground/70 mb-6 max-w-2xl">
                  The Original Dashboard-Styled Personal Website Template for Framer just got even better – with Dashfolio+
                </p>
                <div className="flex gap-4">
                  <button className="px-6 py-2 bg-foreground text-background border border-foreground hover:bg-muted-foreground transition-colors text-sm">
                    $ about
                  </button>
                  <button className="px-6 py-2 bg-background text-foreground border border-foreground hover:bg-muted transition-colors text-sm flex items-center gap-2">
                    <Mail className="h-4 w-4" />
                    $ e_mail
                  </button>
                </div>
              </div>
            )}

            {activeTab === "profile" && (
              <div className="p-12 space-y-8">
                {/* User Profile Section */}
                <div className="border-2 border-border p-6 space-y-4">
                  <div className="flex items-center justify-between">
                    <h2 className="text-2xl font-bold text-foreground">$ user_profile</h2>
                    <button
                      onClick={handleLogout}
                      className="flex items-center gap-2 px-3 py-1 bg-background text-foreground border border-border hover:bg-muted transition-colors text-xs font-bold"
                    >
                      <LogOut className="h-3 w-3" />
                      LOGOUT
                    </button>
                  </div>

                  <div className="space-y-3">
                    <div>
                      <label className="text-xs text-muted-foreground">Email</label>
                      <div className="text-sm font-mono text-foreground mt-1">{user.email}</div>
                    </div>

                    <div>
                      <label className="text-xs text-muted-foreground">Plan</label>
                      <div className="flex items-center gap-2 mt-1">
                        <Crown className="h-4 w-4 text-foreground" />
                        <span className="text-sm font-mono text-foreground">
                          {subscription?.planDisplayName || "FREE"}
                        </span>
                      </div>
                    </div>

                    <div>
                      <label className="text-xs text-muted-foreground">Expires On</label>
                      <div className="flex items-center gap-2 mt-1">
                        <Calendar className="h-4 w-4 text-foreground" />
                        <span className="text-sm font-mono text-foreground">
                          {subscription?.expiresAt
                            ? formatExpirationDate(subscription.expiresAt)
                            : subscription?.planName === "FREE"
                              ? "Unlimited"
                              : "No expiration"}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Pro Trial Claim Button */}
                  {(!subscription || subscription.planName === "FREE") && (
                    <div className="pt-4 border-t border-border">
                      <Button
                        onClick={handleClaimProTrial}
                        className="w-full bg-foreground text-background hover:bg-muted-foreground border border-foreground font-mono text-sm"
                      >
                        <Crown className="h-4 w-4 mr-2" />
                        $ claim_pro_trial_for_free
                      </Button>
                    </div>
                  )}
                </div>

                {/* User Assets Section */}
                <div className="border-2 border-border">
                  <div className="border-b border-border p-4 flex gap-2 flex-wrap">
                    <button
                      onClick={() => setAssetsTab("images")}
                      className={cn(
                        "px-4 py-2 text-sm font-mono border border-border transition-colors",
                        assetsTab === "images"
                          ? "bg-foreground text-background"
                          : "bg-background text-foreground hover:bg-muted"
                      )}
                    >
                      $ images ({userImages.length})
                    </button>
                    <button
                      onClick={() => setAssetsTab("models")}
                      className={cn(
                        "px-4 py-2 text-sm font-mono border border-border transition-colors",
                        assetsTab === "models"
                          ? "bg-foreground text-background"
                          : "bg-background text-foreground hover:bg-muted"
                      )}
                    >
                      $ 3d_models ({userModels.length})
                    </button>
                    <button
                      onClick={() => setAssetsTab("videos")}
                      className={cn(
                        "px-4 py-2 text-sm font-mono border border-border transition-colors",
                        assetsTab === "videos"
                          ? "bg-foreground text-background"
                          : "bg-background text-foreground hover:bg-muted"
                      )}
                    >
                      $ videos ({userVideos.length})
                    </button>
                    <button
                      onClick={() => setAssetsTab("audio")}
                      className={cn(
                        "px-4 py-2 text-sm font-mono border border-border transition-colors",
                        assetsTab === "audio"
                          ? "bg-foreground text-background"
                          : "bg-background text-foreground hover:bg-muted"
                      )}
                    >
                      $ audio ({userAudio.length})
                    </button>
                  </div>

                  {/* Scrollable Assets Container */}
                  <div className="p-6 h-[600px] overflow-y-auto border-t border-border">
                    {isLoadingAssets ? (
                      <div className="text-center py-12 text-muted-foreground font-mono">
                        $ loading_assets...
                      </div>
                    ) : assetsTab === "images" ? (
                      userImages.length === 0 ? (
                        <div className="text-center py-12 text-muted-foreground font-mono">
                          $ no_images_generated_yet
                        </div>
                      ) : (
                        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                          {userImages.map((image, index) => {
                            // Get image title: use prompt if available, otherwise "Image 1", "Image 2", etc.
                            const imageTitle = image.prompt?.trim() || "Image " + (index + 1)

                            return (
                              <div
                                key={image.id}
                                className="border-2 border-border relative group cursor-pointer"
                                onClick={() => {
                                  setSelectedImage(image.url)
                                  setImageGroup([image.url])
                                  setCurrentImageIndex(0)
                                }}
                              >
                                <img
                                  src={image.url}
                                  alt={imageTitle}
                                  className="w-full h-48 object-cover bg-muted"
                                />
                                <div className="absolute inset-0 bg-transparent group-hover:bg-black/10 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100">
                                  <Maximize2 className="h-6 w-6 text-foreground" />
                                </div>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    setAssetToImport({ type: "image", url: image.url, name: imageTitle })
                                    setShowImportDialog(true)
                                  }}
                                  className="absolute top-2 right-10 p-1.5 bg-foreground hover:bg-muted-foreground text-background rounded opacity-0 group-hover:opacity-100 transition-opacity"
                                  title="Import to Project"
                                >
                                  <FolderInput className="h-4 w-4" />
                                </button>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    confirmDelete("image", image.id, image.dbId)
                                  }}
                                  className="absolute top-2 right-2 p-1.5 bg-red-600 hover:bg-red-700 text-white rounded opacity-0 group-hover:opacity-100 transition-opacity"
                                  title="Delete image"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </button>
                                <div className="p-2 bg-background border-t border-border">
                                  <p className="text-xs text-muted-foreground truncate">{imageTitle}</p>
                                  <p className="text-xs text-muted-foreground/50 truncate">
                                    {new Date(image.createdAt).toLocaleString("en-US", {
                                      year: "numeric",
                                      month: "short",
                                      day: "numeric",
                                      hour: "2-digit",
                                      minute: "2-digit"
                                    })}
                                  </p>
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      )
                    ) : assetsTab === "models" ? (
                      userModels.length === 0 ? (
                        <div className="text-center py-12 text-muted-foreground font-mono">
                          $ no_3d_models_generated_yet
                        </div>
                      ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {userModels.map((model) => (
                            <div
                              key={model.id}
                              className="border-2 border-border p-4 cursor-pointer hover:bg-muted transition-colors relative group"
                              onClick={() => setSelectedModel({
                                id: model.id,
                                assetId: model.assetId || "",
                                url: model.url,
                                format: model.format as "glb" | "obj" | "fbx",
                                status: model.status as "raw" | "textured" | "rigged",
                                createdAt: model.createdAt,
                              })}
                            >
                              <button
                                onClick={(e) => {
                                  e.stopPropagation()
                                  setAssetToImport({ type: "model", url: model.url, name: model.format })
                                  setShowImportDialog(true)
                                }}
                                className="absolute top-2 right-10 p-1.5 bg-black hover:bg-gray-800 text-white rounded opacity-0 group-hover:opacity-100 transition-opacity"
                                title="Import to Project"
                              >
                                <FolderInput className="h-4 w-4" />
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation()
                                  confirmDelete("model", model.id, model.dbId)
                                }}
                                className="absolute top-2 right-2 p-1.5 bg-red-600 hover:bg-red-700 text-white rounded opacity-0 group-hover:opacity-100 transition-opacity"
                                title="Delete model"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                              <div className="flex items-center gap-3 mb-2">
                                <Box className="h-6 w-6 text-foreground" />
                                <div className="flex-1">
                                  <div className="text-sm font-bold text-foreground font-mono">
                                    {model.format.toUpperCase()}
                                  </div>
                                  <div className="text-xs text-muted-foreground">
                                    {new Date(model.createdAt).toLocaleString("en-US", {
                                      year: "numeric",
                                      month: "short",
                                      day: "numeric",
                                      hour: "2-digit",
                                      minute: "2-digit"
                                    })}
                                  </div>
                                </div>
                                <Download className="h-4 w-4 text-muted-foreground" />
                              </div>
                            </div>
                          ))}
                        </div>
                      )
                    ) : assetsTab === "videos" ? (
                      userVideos.length === 0 ? (
                        <div className="text-center py-12 text-muted-foreground font-mono">
                          $ no_videos_generated_yet
                        </div>
                      ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                          {userVideos.map((video) => (
                            <div
                              key={video.id}
                              className="border-2 border-border relative group cursor-pointer"
                              onClick={() => setSelectedVideo(video.url)}
                            >
                              <video
                                src={video.url}
                                className="w-full h-48 object-contain bg-black"
                                muted
                                loop
                                playsInline
                              />
                              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100">
                                <Maximize2 className="h-6 w-6 text-white" />
                              </div>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation()
                                  setAssetToImport({ type: "video", url: video.url, name: video.prompt || "Video" })
                                  setShowImportDialog(true)
                                }}
                                className="absolute top-2 right-10 p-1.5 bg-black hover:bg-gray-800 text-white rounded opacity-0 group-hover:opacity-100 transition-opacity"
                                title="Import to Project"
                              >
                                <FolderInput className="h-4 w-4" />
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation()
                                  confirmDelete("video", video.id, video.dbId)
                                }}
                                className="absolute top-2 right-2 p-1.5 bg-red-600 hover:bg-red-700 text-white rounded opacity-0 group-hover:opacity-100 transition-opacity"
                                title="Delete video"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                              <div className="p-2 bg-background border-t border-border">
                                <p className="text-xs text-foreground/70 truncate">
                                  {video.prompt || "Video"}
                                </p>
                                <p className="text-xs text-muted-foreground truncate">
                                  {new Date(video.createdAt).toLocaleString("en-US", {
                                    year: "numeric",
                                    month: "short",
                                    day: "numeric",
                                    hour: "2-digit",
                                    minute: "2-digit"
                                  })}
                                </p>
                              </div>
                            </div>
                          ))}
                        </div>
                      )
                    ) : (
                      userAudio.length === 0 ? (
                        <div className="text-center py-12 text-muted-foreground font-mono">
                          $ no_audio_generated_yet
                        </div>
                      ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                          {userAudio.map((audio) => (
                            <div
                              key={audio.id}
                              className="border-2 border-border p-4 cursor-pointer hover:bg-muted transition-colors relative group"
                            >
                              <button
                                onClick={(e) => {
                                  e.stopPropagation()
                                  setAssetToImport({ type: "audio", url: audio.url, name: audio.prompt || "Audio" })
                                  setShowImportDialog(true)
                                }}
                                className="absolute top-2 right-10 p-1.5 bg-black hover:bg-gray-800 text-white rounded opacity-0 group-hover:opacity-100 transition-opacity"
                                title="Import to Project"
                              >
                                <FolderInput className="h-4 w-4" />
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation()
                                  confirmDelete("audio", audio.id, audio.dbId)
                                }}
                                className="absolute top-2 right-2 p-1.5 bg-red-600 hover:bg-red-700 text-white rounded opacity-0 group-hover:opacity-100 transition-opacity"
                                title="Delete audio"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                              <div className="flex items-center gap-3 mb-2">
                                <MessageSquare className="h-6 w-6 text-foreground shrink-0" />
                                <div className="flex-1 min-w-0">
                                  <div className="text-sm font-bold text-foreground font-mono truncate">
                                    {audio.prompt || "Audio File"}
                                  </div>
                                  <div className="text-xs text-muted-foreground truncate">
                                    {new Date(audio.createdAt).toLocaleString("en-US", {
                                      year: "numeric",
                                      month: "short",
                                      day: "numeric",
                                      hour: "2-digit",
                                      minute: "2-digit"
                                    })}
                                  </div>
                                </div>
                                <Download className="h-4 w-4 text-muted-foreground shrink-0" />
                              </div>
                              <audio
                                src={audio.url}
                                controls
                                className="w-full mt-2"
                              />
                            </div>
                          ))}
                        </div>
                      )
                    )}
                  </div>
                </div>
              </div>
            )}

            {activeTab === "usage" && (
              <div className="p-12 space-y-8">
                {/* Credit Balance Card */}
                <div className="border-2 border-border p-6 bg-gradient-to-r from-muted to-transparent">
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-2xl font-bold text-foreground">$ credits</h2>
                    <div className="flex items-center gap-2">
                      <Crown className="h-5 w-5 text-foreground" />
                      <span className="text-sm font-bold text-foreground font-mono">
                        {subscription?.planDisplayName || "FREE"}
                      </span>
                    </div>
                  </div>

                  {/* Credit Balance Display */}
                  <div className="mb-6">
                    <div className="flex items-end justify-between mb-2">
                      <div>
                        <span className="text-4xl font-bold text-foreground">
                          {subscription?.creditsBalance?.toLocaleString() || 0}
                        </span>
                        <span className="text-lg text-muted-foreground ml-2">
                          / {subscription?.planName === 'CUSTOM' ? '∞' : (
                            subscription?.planName === 'FREE' ? '200' :
                              subscription?.planName === 'PRO' ? '500' :
                                subscription?.planName === 'PRO_PLUS' ? '3,000' :
                                  subscription?.planName === 'ULTRA' ? '8,000' : '200'
                          )} credits
                        </span>
                      </div>
                      <span className="text-xs text-muted-foreground/50 font-mono">
                        {subscription?.expiresAt ? `Resets ${new Date(subscription.expiresAt).toLocaleDateString()}` : 'Monthly'}
                      </span>
                    </div>
                    {subscription?.planName !== 'CUSTOM' && (
                      <div className="w-full bg-muted h-3 border border-border">
                        <div
                          className="bg-foreground h-full transition-all"
                          style={{
                            width: `${Math.min(100, ((subscription?.creditsBalance || 0) / (
                              subscription?.planName === 'FREE' ? 200 :
                                subscription?.planName === 'PRO' ? 500 :
                                  subscription?.planName === 'PRO_PLUS' ? 3000 :
                                    subscription?.planName === 'ULTRA' ? 8000 : 200
                            )) * 100)}%`,
                          }}
                        />
                      </div>
                    )}
                  </div>

                  {/* Plan Features Quick View */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
                    <div className="border border-border p-3">
                      <div className="text-xs text-muted-foreground font-mono mb-1">Plan</div>
                      <div className="text-sm font-bold text-foreground">{subscription?.planDisplayName || 'Free'}</div>
                    </div>
                    <div className="border border-border p-3">
                      <div className="text-xs text-muted-foreground font-mono mb-1">Priority</div>
                      <div className="text-sm font-bold text-foreground capitalize">
                        {subscription?.limits?.priorityQueue || 'Standard'}
                      </div>
                    </div>
                    <div className="border border-border p-3">
                      <div className="text-xs text-muted-foreground font-mono mb-1">Storage</div>
                      <div className="text-sm font-bold text-foreground">
                        {subscription?.limits?.storageGb === -1 ? 'Unlimited' : `${subscription?.limits?.storageGb || 2}GB`}
                      </div>
                    </div>
                    <div className="border border-border p-3">
                      <div className="text-xs text-muted-foreground font-mono mb-1">License</div>
                      <div className="text-sm font-bold text-foreground">
                        {subscription?.limits?.commercialLicense ? 'Commercial' : 'Personal'}
                      </div>
                    </div>
                  </div>
                </div>

                {/* AI Token Usage Section */}
                <div className="border-2 border-border p-6">
                  <div className="flex items-center justify-between mb-6">
                    <h2 className="text-xl font-bold text-foreground">$ ai_token_usage</h2>
                    <span className="text-xs text-muted-foreground font-mono">💬 100 credits/M tokens</span>
                  </div>

                  {isLoadingTokenUsage ? (
                    <div className="text-center py-8 text-muted-foreground font-mono">
                      $ loading_token_usage...
                    </div>
                  ) : tokenUsage ? (
                    <div className="space-y-6">
                      {/* Token Stats Grid */}
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        {/* Today's Usage */}
                        <div className="border border-border p-4">
                          <div className="text-xs text-muted-foreground font-mono mb-2">TODAY</div>
                          <div className="space-y-2">
                            <div className="flex justify-between">
                              <span className="text-sm text-foreground/70">Input</span>
                              <span className="font-mono font-bold text-foreground">{formatTokenCount(tokenUsage.todayInputTokens)}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-sm text-foreground/70">Output</span>
                              <span className="font-mono font-bold text-foreground">{formatTokenCount(tokenUsage.todayOutputTokens)}</span>
                            </div>
                            <div className="flex justify-between border-t border-border/20 pt-2">
                              <span className="text-sm font-bold text-foreground">Total</span>
                              <span className="font-mono font-bold text-foreground">{formatTokenCount(tokenUsage.todayTotalTokens)}</span>
                            </div>
                            <div className="text-xs text-muted-foreground/50 font-mono text-right">
                              ≈ {calculateTokenCredits(tokenUsage.todayTotalTokens)} credits
                            </div>
                          </div>
                        </div>

                        {/* Monthly Usage */}
                        <div className="border border-border p-4 bg-muted/5">
                          <div className="text-xs text-muted-foreground font-mono mb-2">THIS MONTH</div>
                          <div className="space-y-2">
                            <div className="flex justify-between">
                              <span className="text-sm text-foreground/70">Input</span>
                              <span className="font-mono font-bold text-foreground">{formatTokenCount(tokenUsage.monthlyInputTokens)}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-sm text-foreground/70">Output</span>
                              <span className="font-mono font-bold text-foreground">{formatTokenCount(tokenUsage.monthlyOutputTokens)}</span>
                            </div>
                            <div className="flex justify-between border-t border-border/20 pt-2">
                              <span className="text-sm font-bold text-foreground">Total</span>
                              <span className="font-mono font-bold text-foreground">{formatTokenCount(tokenUsage.monthlyTotalTokens)}</span>
                            </div>
                            <div className="text-xs text-muted-foreground/50 font-mono text-right">
                              ≈ {calculateTokenCredits(tokenUsage.monthlyTotalTokens)} credits
                            </div>
                          </div>
                        </div>

                        {/* All-Time Usage */}
                        <div className="border border-border p-4">
                          <div className="text-xs text-muted-foreground font-mono mb-2">ALL TIME</div>
                          <div className="space-y-2">
                            <div className="flex justify-between">
                              <span className="text-sm text-foreground/70">Input</span>
                              <span className="font-mono font-bold text-foreground">{formatTokenCount(tokenUsage.allTimeInputTokens)}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-sm text-foreground/70">Output</span>
                              <span className="font-mono font-bold text-foreground">{formatTokenCount(tokenUsage.allTimeOutputTokens)}</span>
                            </div>
                            <div className="flex justify-between border-t border-border/20 pt-2">
                              <span className="text-sm font-bold text-foreground">Total</span>
                              <span className="font-mono font-bold text-foreground">{formatTokenCount(tokenUsage.allTimeTotalTokens)}</span>
                            </div>
                            <div className="text-xs text-muted-foreground/50 font-mono text-right">
                              ≈ {calculateTokenCredits(tokenUsage.allTimeTotalTokens)} credits
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Token Usage Bar - Monthly */}
                      <div className="space-y-2">
                        <div className="flex justify-between text-xs font-mono">
                          <span className="text-muted-foreground">Monthly Token Distribution</span>
                          <span className="text-foreground">
                            Input: {Math.round((tokenUsage.monthlyInputTokens / Math.max(tokenUsage.monthlyTotalTokens, 1)) * 100)}% |
                            Output: {Math.round((tokenUsage.monthlyOutputTokens / Math.max(tokenUsage.monthlyTotalTokens, 1)) * 100)}%
                          </span>
                        </div>
                        <div className="w-full h-4 border border-border flex overflow-hidden">
                          <div
                            className="bg-foreground h-full transition-all"
                            style={{ width: `${(tokenUsage.monthlyInputTokens / Math.max(tokenUsage.monthlyTotalTokens, 1)) * 100}%` }}
                            title="Input Tokens"
                          />
                          <div
                            className="bg-foreground/40 h-full transition-all"
                            style={{ width: `${(tokenUsage.monthlyOutputTokens / Math.max(tokenUsage.monthlyTotalTokens, 1)) * 100}%` }}
                            title="Output Tokens"
                          />
                        </div>
                        <div className="flex gap-4 text-xs font-mono">
                          <span className="flex items-center gap-1">
                            <span className="w-3 h-3 bg-foreground"></span> Input Tokens
                          </span>
                          <span className="flex items-center gap-1">
                            <span className="w-3 h-3 bg-foreground/40"></span> Output Tokens
                          </span>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-8 text-muted-foreground font-mono">
                      $ no_token_usage_data_yet
                      <p className="text-xs mt-2">Start chatting with AI to see your token usage here</p>
                    </div>
                  )}
                </div>

                {/* Credit Costs Section */}
                <div className="border-2 border-border p-6">
                  <h2 className="text-xl font-bold text-foreground mb-6">$ credit_costs</h2>

                  <div className="space-y-6">
                    {/* AI Chat */}
                    <div className="border border-border p-4">
                      <div className="flex items-center gap-2 mb-3">
                        <MessageSquare className="h-5 w-5 text-foreground" />
                        <span className="font-bold text-foreground">AI Chat</span>
                      </div>
                      <div className="grid grid-cols-1 gap-2 text-sm">
                        <div className="flex justify-between py-1 border-b border-border/30">
                          <span className="text-foreground/70">Chat Messages</span>
                          <span className="font-mono font-bold text-foreground">100 credits/M tokens</span>
                        </div>
                      </div>
                    </div>

                    {/* Image Generation */}
                    <div className="border border-border p-4">
                      <div className="flex items-center gap-2 mb-3">
                        <Layers className="h-5 w-5 text-foreground" />
                        <span className="font-bold text-foreground">🎨 Image Generation</span>
                      </div>
                      <div className="grid grid-cols-1 gap-2 text-sm">
                        <div className="flex justify-between py-1 border-b border-border/10">
                          <span className="text-muted-foreground">Standard (koye2dv1)</span>
                          <span className="font-mono font-bold text-foreground">5 credits</span>
                        </div>
                        <div className="flex justify-between py-1 border-b border-border/10">
                          <span className="text-muted-foreground">HQ (koye2dv1.5)</span>
                          <span className="font-mono font-bold text-foreground">10 credits</span>
                        </div>
                        <div className="flex justify-between py-1">
                          <span className="text-muted-foreground">Ultra (koye2dv2)</span>
                          <span className="font-mono font-bold text-foreground">15 credits</span>
                        </div>
                      </div>
                    </div>

                    {/* 3D Models */}
                    <div className="border border-border p-4">
                      <div className="flex items-center gap-2 mb-3">
                        <Box className="h-5 w-5 text-foreground" />
                        <span className="font-bold text-foreground">🧱 3D Models (koye 3d v1)</span>
                      </div>
                      <div className="grid grid-cols-1 gap-2 text-sm">
                        <div className="flex justify-between py-1 border-b border-border/10">
                          <span className="text-muted-foreground">Basic (512)</span>
                          <span className="font-mono font-bold text-foreground">20 credits (+5 texture)</span>
                        </div>
                        <div className="flex justify-between py-1 border-b border-border/10">
                          <span className="text-muted-foreground">Standard (1024)</span>
                          <span className="font-mono font-bold text-foreground">50 credits (+10 texture)</span>
                        </div>
                        <div className="flex justify-between py-1">
                          <span className="text-muted-foreground">High-Res (1536)</span>
                          <span className="font-mono font-bold text-foreground">70 credits (+20 texture)</span>
                        </div>
                      </div>
                    </div>

                    {/* Rigging & Animation */}
                    <div className="border border-border p-4">
                      <div className="flex items-center gap-2 mb-3">
                        <span className="text-lg">🧍</span>
                        <span className="font-bold text-foreground">Rigging & Animation</span>
                      </div>
                      <div className="grid grid-cols-1 gap-2 text-sm">
                        <div className="flex justify-between py-1 border-b border-border/10">
                          <span className="text-muted-foreground">Auto-Rig</span>
                          <span className="font-mono font-bold text-foreground">10 credits</span>
                        </div>
                        <div className="flex justify-between py-1">
                          <span className="text-muted-foreground">Animation (per clip)</span>
                          <span className="font-mono font-bold text-foreground">30 credits</span>
                        </div>
                      </div>
                    </div>

                    {/* Audio & Video */}
                    <div className="border border-border p-4">
                      <div className="flex items-center gap-2 mb-3">
                        <span className="text-lg">🎵</span>
                        <span className="font-bold text-foreground">Audio & Video</span>
                      </div>
                      <div className="grid grid-cols-1 gap-2 text-sm">
                        <div className="flex justify-between py-1 border-b border-border/10">
                          <span className="text-muted-foreground">Audio (per second)</span>
                          <span className="font-mono font-bold text-foreground">5 credits</span>
                        </div>
                        <div className="flex justify-between py-1 border-b border-border/10">
                          <span className="text-muted-foreground">Video 720p (per second)</span>
                          <span className="font-mono font-bold text-foreground">10 credits</span>
                        </div>
                        <div className="flex justify-between py-1">
                          <span className="text-muted-foreground">Video 1080p (per second)</span>
                          <span className="font-mono font-bold text-foreground">25 credits</span>
                        </div>
                      </div>
                    </div>

                    {/* Game Generation */}
                    <div className="border border-border p-4">
                      <div className="flex items-center gap-2 mb-3">
                        <span className="text-lg">🎮</span>
                        <span className="font-bold text-foreground">Game Generation (AI Builder)</span>
                      </div>
                      <div className="grid grid-cols-1 gap-2 text-sm">
                        <div className="flex justify-between py-1 border-b border-border/10">
                          <span className="text-muted-foreground">2D Prototype</span>
                          <span className="font-mono font-bold text-foreground">100 credits</span>
                        </div>
                        <div className="flex justify-between py-1 border-b border-border/10">
                          <span className="text-muted-foreground">3D Prototype</span>
                          <span className="font-mono font-bold text-foreground">250 credits</span>
                        </div>
                        <div className="flex justify-between py-1">
                          <span className="text-muted-foreground">Full Small Game</span>
                          <span className="font-mono font-bold text-foreground">500 credits</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Plan Comparison */}
                <div className="border-2 border-border p-6">
                  <h3 className="text-xl font-bold text-foreground mb-4">$ plans</h3>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b-2 border-border">
                          <th className="text-left py-2 px-3 font-mono text-foreground">Plan</th>
                          <th className="text-center py-2 px-3 font-mono text-foreground">Credits/Month</th>
                          <th className="text-center py-2 px-3 font-mono text-foreground">Price</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr className={`border-b border-border/20 ${subscription?.planName === 'FREE' ? 'bg-muted/50' : ''}`}>
                          <td className="py-2 px-3 font-bold text-foreground">Free</td>
                          <td className="text-center py-2 px-3 font-mono text-foreground">200</td>
                          <td className="text-center py-2 px-3 font-mono text-foreground">$0</td>
                        </tr>
                        <tr className={`border-b border-border/20 ${subscription?.planName === 'PRO' ? 'bg-muted/50' : ''}`}>
                          <td className="py-2 px-3 font-bold text-foreground">Pro</td>
                          <td className="text-center py-2 px-3 font-mono text-foreground">500</td>
                          <td className="text-center py-2 px-3 font-mono text-foreground">$5.99/mo</td>
                        </tr>
                        <tr className={`border-b border-border/20 ${subscription?.planName === 'PRO_PLUS' ? 'bg-muted/50' : ''}`}>
                          <td className="py-2 px-3 font-bold text-foreground">Pro Plus</td>
                          <td className="text-center py-2 px-3 font-mono text-foreground">3,000</td>
                          <td className="text-center py-2 px-3 font-mono text-foreground">$19.99/mo</td>
                        </tr>
                        <tr className={`border-b border-border/20 ${subscription?.planName === 'ULTRA' ? 'bg-muted/50' : ''}`}>
                          <td className="py-2 px-3 font-bold text-foreground">Ultra</td>
                          <td className="text-center py-2 px-3 font-mono text-foreground">8,000</td>
                          <td className="text-center py-2 px-3 font-mono text-foreground">$49.99/mo</td>
                        </tr>
                        <tr className={`${subscription?.planName === 'CUSTOM' ? 'bg-muted/50' : ''}`}>
                          <td className="py-2 px-3 font-bold text-foreground">Custom</td>
                          <td className="text-center py-2 px-3 font-mono text-foreground">Unlimited*</td>
                          <td className="text-center py-2 px-3 font-mono text-foreground">Contact Us</td>
                        </tr>
                      </tbody>
                    </table>
                    <p className="text-xs text-muted-foreground mt-2 font-mono">* Fair Use Policy (FUP) applied</p>
                  </div>
                </div>

                {/* Upgrade Section */}
                <div className="border-2 border-border p-6">
                  <h3 className="text-xl font-bold text-foreground mb-4">$ upgrade</h3>
                  <p className="text-sm text-foreground/70 mb-4">
                    Need more credits? Upgrade to {getNextPlanName() || "a higher plan"} for more features and monthly credits.
                  </p>
                  <Button
                    onClick={handleUpgrade}
                    className="bg-foreground text-background hover:bg-muted-foreground border border-foreground font-mono"
                  >
                    <TrendingUp className="h-4 w-4 mr-2" />
                    $ upgrade_to_{getNextPlanName() || "pro"}
                  </Button>
                </div>
              </div>
            )}

            {
              activeTab === "features" && (
                <div className="p-12 space-y-8">
                  <div className="border-2 border-border p-6">
                    <h2 className="text-2xl font-bold text-foreground mb-6">$ features</h2>

                    <div className="space-y-6">
                      <FeatureSection
                        title="AI Chat Interface"
                        description="Chat with AI to describe your game assets. The AI will ask clarifying questions and help you design your assets."
                        steps={[
                          "1. Start a conversation in the chat interface",
                          "2. Describe your game asset idea",
                          "3. Answer AI's clarifying questions",
                          "4. Review and confirm the generated prompt"
                        ]}
                      />

                      <FeatureSection
                        title="Image Generation"
                        description="Generate concept art images from text prompts using advanced AI models."
                        steps={[
                          "1. Enter a text prompt describing your image",
                          "2. Select generation method (default or banana)",
                          "3. Choose single or four-view generation",
                          "4. Click Generate and wait for results"
                        ]}
                      />

                      <FeatureSection
                        title="3D Model Generation"
                        description="Convert 2D images to 3D models using Hitem3D API."
                        steps={[
                          "1. Upload single image or four view images",
                          "2. Select generation mode and type",
                          "3. Choose resolution and format",
                          "4. Generate and view your 3D model"
                        ]}
                      />

                      <FeatureSection
                        title="Workflow Pipeline"
                        description="Complete workflow from concept to final asset."
                        steps={[
                          "1. Chat → Generate concept",
                          "2. Images → Review and approve",
                          "3. 3D Model → Generate from images",
                          "4. Texture → Apply textures",
                          "5. Rig → Auto-rigging",
                          "6. Export → Download in various formats"
                        ]}
                      />
                    </div>
                  </div>
                </div>
              )
            }

            {
              activeTab === "accounts" && (
                <div className="p-12 space-y-8">
                  <div className="border-2 border-border p-6">
                    <h2 className="text-2xl font-bold text-foreground mb-6">$ account_settings</h2>

                    <div className="space-y-6">
                      <div>
                        <label className="text-xs text-muted-foreground mb-1 block">Email</label>
                        <div className="text-sm font-mono text-foreground">{user.email}</div>
                      </div>

                      {/* Change Password */}
                      <div className="border-t border-border pt-6 space-y-4">
                        <h3 className="text-lg font-bold text-foreground">$ change_password</h3>

                        {passwordError && (
                          <div className="p-3 border border-red-500 bg-red-50 text-red-700 text-xs font-mono">
                            $ error: {passwordError}
                          </div>
                        )}

                        {passwordSuccess && (
                          <div className="p-3 border border-green-500 bg-green-50 text-green-700 text-xs font-mono">
                            $ success: {passwordSuccess}
                          </div>
                        )}

                        <div className="space-y-3">
                          <div>
                            <label className="text-xs text-muted-foreground mb-1 block">Current Password</label>
                            <input
                              type="password"
                              value={passwordForm.current}
                              onChange={(e) => setPasswordForm({ ...passwordForm, current: e.target.value })}
                              className="w-full bg-background border border-border px-3 py-2 text-foreground font-mono text-sm focus:outline-none focus:ring-0"
                              placeholder="••••••••"
                            />
                          </div>

                          <div>
                            <label className="text-xs text-muted-foreground mb-1 block">New Password</label>
                            <input
                              type="password"
                              value={passwordForm.new}
                              onChange={(e) => setPasswordForm({ ...passwordForm, new: e.target.value })}
                              className="w-full bg-background border border-border px-3 py-2 text-foreground font-mono text-sm focus:outline-none focus:ring-0"
                              placeholder="••••••••"
                            />
                          </div>

                          <div>
                            <label className="text-xs text-muted-foreground mb-1 block">Confirm New Password</label>
                            <input
                              type="password"
                              value={passwordForm.confirm}
                              onChange={(e) => setPasswordForm({ ...passwordForm, confirm: e.target.value })}
                              className="w-full bg-background border border-border px-3 py-2 text-foreground font-mono text-sm focus:outline-none focus:ring-0"
                              placeholder="••••••••"
                            />
                          </div>

                          <Button
                            onClick={handleChangePassword}
                            className="bg-foreground text-background hover:bg-muted-foreground border border-foreground font-mono text-sm"
                          >
                            <Key className="h-4 w-4 mr-2" />
                            $ change_password
                          </Button>
                        </div>
                      </div>

                      {/* Delete Account */}
                      <div className="border-t border-border pt-6">
                        <h3 className="text-lg font-bold text-red-600 mb-4">$ danger_zone</h3>

                        <div className="p-4 border-2 border-red-500 bg-red-50 space-y-4">
                          <div className="flex items-start gap-2">
                            <AlertTriangle className="h-5 w-5 text-red-600 shrink-0 mt-0.5" />
                            <div>
                              <p className="text-sm font-bold text-red-600 mb-1">Delete Account</p>
                              <p className="text-xs text-red-700">
                                This action cannot be undone. All your data will be permanently deleted.
                              </p>
                            </div>
                          </div>

                          {!showDeleteConfirm ? (
                            <Button
                              onClick={() => setShowDeleteConfirm(true)}
                              className="bg-red-600 text-white hover:bg-red-700 border border-red-600 font-mono text-sm"
                            >
                              <Trash2 className="h-4 w-4 mr-2" />
                              $ delete_account
                            </Button>
                          ) : (
                            <div className="space-y-2">
                              <p className="text-xs text-red-700 font-bold">
                                Are you sure? Type DELETE to confirm
                              </p>
                              <div className="flex gap-2">
                                <input
                                  type="text"
                                  placeholder="Type DELETE"
                                  className="flex-1 bg-background border border-red-500 px-3 py-2 text-foreground font-mono text-sm focus:outline-none focus:ring-0"
                                  id="deleteConfirm"
                                />
                                <Button
                                  onClick={() => {
                                    const input = document.getElementById("deleteConfirm") as HTMLInputElement
                                    if (input?.value === "DELETE") {
                                      handleDeleteAccount()
                                    } else {
                                      alert("Please type DELETE to confirm")
                                    }
                                  }}
                                  className="bg-red-600 text-white hover:bg-red-700 border border-red-600 font-mono text-sm"
                                >
                                  <Trash2 className="h-4 w-4 mr-2" />
                                  $ confirm_delete
                                </Button>
                                <Button
                                  onClick={() => setShowDeleteConfirm(false)}
                                  className="bg-background text-foreground hover:bg-muted border border-border font-mono text-sm"
                                >
                                  $ cancel
                                </Button>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )
            }

            {
              activeTab === "projects" && (
                <div className="p-12">
                  <div className="flex items-center justify-between mb-6">
                    <h2 className="text-2xl font-bold text-foreground font-mono">$ projects</h2>
                    <div className="flex items-center gap-2">
                      {githubConnection && githubConnection.accessToken ? (
                        <div className="flex items-center gap-2 px-3 py-1 bg-green-100 dark:bg-green-900 border border-green-600 rounded text-green-800 dark:text-green-100 text-sm font-mono">
                          <Github className="h-4 w-4" />
                          <span>Connected</span>
                        </div>
                      ) : (
                        <Button
                          onClick={handleConnectGitHub}
                          className="bg-foreground text-background hover:bg-muted-foreground border border-foreground font-mono"
                        >
                          <Github className="h-4 w-4 mr-2" />
                          Connect GitHub
                        </Button>
                      )}
                      <Button
                        onClick={() => {
                          if (!githubConnection || !githubConnection.accessToken) {
                            alert("Please connect your GitHub account first to create projects.")
                            handleConnectGitHub()
                            return
                          }
                          setShowProjectDialog(true)
                        }}
                        className={cn(
                          "border-2 border-foreground font-mono text-xs font-bold transition-all shadow-[2px_2px_0px_0px_currentColor] hover:shadow-[1px_1px_0px_0px_currentColor]",
                          githubConnection && githubConnection.accessToken
                            ? "bg-foreground text-background hover:bg-muted-foreground"
                            : "bg-muted text-muted-foreground cursor-not-allowed"
                        )}
                        disabled={!githubConnection || !githubConnection.accessToken}
                      >
                        <Plus className="h-4 w-4 mr-2" />
                        ADD PROJECT
                      </Button>
                    </div>
                  </div>

                  {isLoadingProjects ? (
                    <div className="flex items-center justify-center py-12">
                      <div className="text-muted-foreground font-mono">Loading projects...</div>
                    </div>
                  ) : projects.length === 0 ? (
                    <div className="border-2 border-dashed border-border p-12 text-center">
                      <p className="text-foreground/70 font-mono mb-4">No projects yet</p>
                      <p className="text-muted-foreground text-sm font-mono mb-6">Create your first project to start building</p>
                      {!githubConnection || !githubConnection.accessToken ? (
                        <div className="flex flex-col items-center gap-4">
                          <p className="text-foreground/70 text-sm font-mono text-center">
                            Connect your GitHub account to create projects
                          </p>
                          <Button
                            onClick={handleConnectGitHub}
                            className="bg-foreground text-background hover:bg-muted-foreground border border-foreground font-mono"
                          >
                            <Github className="h-4 w-4 mr-2" />
                            Connect GitHub
                          </Button>
                        </div>
                      ) : (
                        <Button
                          onClick={() => setShowProjectDialog(true)}
                          className="bg-foreground text-background hover:bg-muted-foreground border-2 border-foreground font-mono text-xs font-bold transition-all shadow-[2px_2px_0px_0px_currentColor] hover:shadow-[1px_1px_0px_0px_currentColor]"
                        >
                          <Plus className="h-4 w-4 mr-2" />
                          CREATE PROJECT
                        </Button>
                      )}
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {projects.map((project) => (
                        <div
                          key={project.id}
                          onClick={() => handleOpenProject(project)}
                          className="border-2 border-border p-6 cursor-pointer hover:bg-muted transition-colors bg-background relative group"
                        >
                          <button
                            onClick={(e) => handleDeleteProject(e, project.id)}
                            className="absolute top-2 right-2 p-1.5 bg-red-600 hover:bg-red-700 text-white rounded opacity-0 group-hover:opacity-100 transition-opacity"
                            title="Delete project"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                          <h3 className="text-lg font-bold text-foreground mb-2 font-mono">{project.name}</h3>
                          {project.description && (
                            <p className="text-sm text-foreground/70 mb-4 font-mono line-clamp-2">{project.description}</p>
                          )}
                          <div className="text-xs text-muted-foreground font-mono">
                            Created: {new Date(project.createdAt).toLocaleDateString()}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )
            }
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
                  className="p-2 text-white hover:bg-white/10 rounded-full transition-colors shrink-0"
                >
                  <ChevronLeft className="h-8 w-8" />
                </button>
              )}

              <div className="relative max-w-4xl max-h-full">
                <button
                  onClick={() => setSelectedImage(null)}
                  className="absolute -top-10 right-0 text-white hover:text-white/70"
                >
                  <X className="h-6 w-6" />
                </button>
                <img
                  src={selectedImage}
                  alt="Full size"
                  className="max-w-full max-h-[90vh] object-contain"
                />
                {/* Counter */}
                {imageGroup && imageGroup.length > 1 && (
                  <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 bg-black/50 text-white px-3 py-1 rounded-full text-sm font-mono">
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
                  className="p-2 text-white hover:bg-white/10 rounded-full transition-colors shrink-0"
                >
                  <ChevronRight className="h-8 w-8" />
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
                <h2 className="text-lg font-bold text-foreground font-mono">$ 3d_model_viewer</h2>
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
                className="absolute -top-10 right-0 text-white hover:text-white/70"
              >
                <X className="h-6 w-6" />
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
      {
        showDeleteConfirm && itemToDelete && (
          <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4" onClick={() => {
            setShowDeleteConfirm(false)
            setItemToDelete(null)
          }}>
            <div className="bg-background border-2 border-border w-full max-w-md p-6" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold text-foreground font-mono">$ delete_{itemToDelete.type}</h2>
                <button
                  onClick={() => {
                    setShowDeleteConfirm(false)
                    setItemToDelete(null)
                  }}
                  className="p-2 hover:bg-muted rounded"
                >
                  <X className="h-5 w-5 text-foreground" />
                </button>
              </div>

              <div className="mb-6">
                <p className="text-sm text-muted-foreground font-mono mb-2">
                  Are you sure you want to delete this {itemToDelete.type}?
                </p>
                <p className="text-xs text-muted-foreground font-mono">
                  This action cannot be undone.
                </p>
              </div>

              <div className="flex gap-2">
                <Button
                  onClick={handleDeleteItem}
                  disabled={isDeleting}
                  className="flex-1 bg-red-600 text-white hover:bg-red-700 border border-red-600 font-mono disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  {isDeleting ? "Deleting..." : "Delete"}
                </Button>
                <Button
                  onClick={() => {
                    setShowDeleteConfirm(false)
                    setItemToDelete(null)
                  }}
                  variant="outline"
                  className="flex-1 border-border bg-background text-foreground hover:bg-muted font-mono"
                >
                  Cancel
                </Button>
              </div>
            </div>
          </div>
        )
      }

      {/* Create Project Dialog */}
      {
        showProjectDialog && (
          <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4" onClick={() => setShowProjectDialog(false)}>
            <div className="bg-background border-2 border-border w-full max-w-md p-6" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold text-foreground font-mono">$ create_project</h2>
                <button
                  onClick={() => setShowProjectDialog(false)}
                  className="p-2 hover:bg-muted rounded"
                >
                  <X className="h-5 w-5 text-foreground" />
                </button>
              </div>

              {/* GitHub Connection Check */}
              {(!githubConnection || !githubConnection.accessToken) && (
                <div className="mb-4 p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-600 rounded">
                  <div className="flex items-start gap-3">
                    <AlertTriangle className="h-5 w-5 text-yellow-600 shrink-0 mt-0.5" />
                    <div className="flex-1">
                      <p className="text-yellow-800 dark:text-yellow-200 text-sm font-mono font-bold mb-1">
                        GitHub Connection Required
                      </p>
                      <p className="text-yellow-700 dark:text-yellow-300 text-xs font-mono mb-3">
                        You need to connect your GitHub account to create projects.
                      </p>
                      <Button
                        onClick={() => {
                          setShowProjectDialog(false)
                          handleConnectGitHub()
                        }}
                        className="bg-yellow-600 text-white hover:bg-yellow-700 border border-yellow-600 font-mono text-xs"
                      >
                        <Github className="h-3 w-3 mr-2" />
                        Connect GitHub
                      </Button>
                    </div>
                  </div>
                </div>
              )}

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
                    disabled={!newProjectName.trim() || !githubConnection || !githubConnection.accessToken}
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
                <h3 className="text-xl font-bold text-foreground font-mono">Import to Project</h3>
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

      {/* GitHub Connection Prompt Modal */}
      {showGitHubPrompt && (
        <GitHubConnectionPrompt
          onClose={() => setShowGitHubPrompt(false)}
          onConnected={() => {
            setShowGitHubPrompt(false)
            setShowProjectDialog(true)
          }}
        />
      )}

      {/* Project Creation Loading Overlay */}
      {isCreatingProject && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-background/80 backdrop-blur-md">
          <div className="flex flex-col items-center gap-4 p-8 bg-background border border-border shadow-2xl rounded-xl">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-foreground" />
            <p className="text-foreground font-mono font-bold tracking-tight">Creating your project...</p>
          </div>
        </div>
      )}
    </div >
  )
}

interface NavItemProps {
  icon: React.ElementType
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
        "w-full flex items-center gap-3 px-3 py-2 rounded border transition-colors text-sm",
        active
          ? "bg-foreground text-background border-foreground"
          : "bg-background text-foreground border-border hover:bg-muted",
        collapsed && "justify-center"
      )}
    >
      <Icon className="h-4 w-4 shrink-0" />
      {!collapsed && <span className="flex-1 text-left">{label}</span>}
      {!collapsed && (number || badge) && (
        <span className="text-xs">{number || badge}</span>
      )}
    </button>
  )
}

interface FeatureSectionProps {
  title: string
  description: string
  steps: string[]
}

function FeatureSection({ title, description, steps }: FeatureSectionProps) {
  return (
    <div className="border border-border p-4">
      <h3 className="text-lg font-bold text-foreground mb-2">{title}</h3>
      <p className="text-sm text-muted-foreground mb-3">{description}</p>
      <ul className="space-y-1">
        {steps.map((step, index) => (
          <li key={index} className="text-xs text-muted-foreground font-mono">
            {step}
          </li>
        ))}
      </ul>
    </div>
  )
}

