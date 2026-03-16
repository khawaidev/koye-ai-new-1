import { AnimatePresence, motion } from "framer-motion"
import { Folder, Link2, X } from "lucide-react"
import { useEffect, useRef, useState } from "react"
import appIconLight from "../../assets/icon.jpg"
import appIconDark from "../../assets/icon.png"
import { useAuth } from "../../hooks/useAuth"
import { uuidv4 } from "../../lib/uuid"
import { generateChatTitle } from "../../services/chatTitleGenerator"
import { getGameDevSystemPrompt } from "../../services/gameDevPrompt"
import { sendMessageToGemini, sendMessageToGeminiStream, sendMessageToGeminiWithThinking } from "../../services/gemini"
import { webSearch, formatSearchResultsForContext } from "../../services/searchapi"
import { getGitHubOAuthUrl } from "../../services/github"
import {
  ensureProjectRepository,
  getGitHubUser,
  initializeProjectGitHubSync,
  type GitHubConnectionDetails
} from "../../services/githubProjectSync"
import { buildProjectHistoryPrompt, recordSessionToProjectContext } from "../../services/projectContext"
import { loadProjectFilesFromStorage, saveSingleProjectFile } from "../../services/projectFiles"
import { createProject, getProjects } from "../../services/supabase"
import type { Message } from "../../store/useAppStore"
import { useAppStore } from "../../store/useAppStore"
import { useGameDevStore } from "../../store/useGameDevStore"
import { getTaskDisplayName, useTaskStore, type TaskConfig, type TaskType } from "../../store/useTaskStore"
import type { Project } from "../../types"
import { GameDevFlowUI } from "../game-flow/GameDevFlowUI"
import { GitHubConnectionPrompt } from "../github/GitHubConnectionPrompt"
import { TaskProposalCard } from "../tasks/TaskProposalCard"
import { useTheme } from "../theme-provider"
import { Button } from "../ui/button"
import { ChatInput } from "./ChatInput"
import { MessageBubble } from "./MessageBubble"
import { ResponseMessage } from "./ResponseMessage"
import { VoiceChatLayout } from "./VoiceChatLayout"

export function ChatInterface() {
  const { theme } = useTheme()
  const { user } = useAuth()
  const {
    messages,
    addMessage,
    setIsGenerating,
    isGenerating,
    generatingText,
    currentSessionId,
    updateSessionTitle,
    currentProject,
    setCurrentProject,
    githubConnection,
    setGeneratedFiles,
    addGeneratedFile
  } = useAppStore()

  const {
    isActive: isGameDevActive,
    currentStep: gameDevStep,
    gameType,
    startFlow: startGameDevFlow,
    setStep: setGameDevStep,
    setGameType,
    saveProjectState,
    loadProjectState
  } = useGameDevStore()

  // Get generatedFiles from store when needed for file references
  const getGeneratedFiles = () => useAppStore.getState().generatedFiles

  const [showConnectDialog, setShowConnectDialog] = useState(false)
  const [showCreateProjectDialog, setShowCreateProjectDialog] = useState(false)
  const [projects, setProjects] = useState<Project[]>([])
  const [isLoadingProjects, setIsLoadingProjects] = useState(false)
  const [newProjectName, setNewProjectName] = useState("")
  const [newProjectDescription, setNewProjectDescription] = useState("")
  const [showGitHubPrompt, setShowGitHubPrompt] = useState(false)
  const [isCreatingProject, setIsCreatingProject] = useState(false)
  const [showKoyeText, setShowKoyeText] = useState(true)
  const [isChatLoading, setIsChatLoading] = useState(false)

  // Trigger loading state briefly whenever session changes
  useEffect(() => {
    setIsChatLoading(true)
    const timeout = setTimeout(() => {
      setIsChatLoading(false)
    }, 600) // 600ms fake loading
    return () => clearTimeout(timeout)
  }, [currentSessionId])

  useEffect(() => {
    const interval = setInterval(() => {
      setShowKoyeText(prev => !prev)
    }, 5000)
    return () => clearInterval(interval)
  }, [])

  const { setGitHubConnection } = useAppStore()

  // Load projects when dialog opens
  useEffect(() => {
    if (showConnectDialog && user) {
      const loadProjects = async () => {
        setIsLoadingProjects(true)
        try {
          const userProjects = await getProjects(user.id)
          setProjects(userProjects)
        } catch (error) {
          console.error("Error loading projects:", error)
        } finally {
          setIsLoadingProjects(false)
        }
      }
      loadProjects()
    }
  }, [showConnectDialog, user])

  const handleConnectProject = async (project: Project) => {
    // If there was a previous project, save its state first
    if (currentProject) {
      saveProjectState(currentProject.id)
    }

    setCurrentProject(project)
    setShowConnectDialog(false)

    // Load game dev state for the new project
    loadProjectState(project.id)

    // Load project files immediately
    if (user) {
      try {
        console.log('Loading files for connected project:', project.name)
        const files = await loadProjectFilesFromStorage(
          project.id,
          user.id,
          githubConnection
        )

        if (Object.keys(files).length > 0) {
          console.log('Loaded project files:', Object.keys(files))
          setGeneratedFiles(files)
        } else {
          console.log('No files found in project, checking localStorage...')
          // Fallback to localStorage
          const storageKey = `project_${project.id}_files`
          const savedData = localStorage.getItem(storageKey)
          if (savedData) {
            try {
              const parsed = JSON.parse(savedData)
              if (parsed.files && Object.keys(parsed.files).length > 0) {
                console.log('Loaded files from localStorage:', Object.keys(parsed.files))
                setGeneratedFiles(parsed.files)
              }
            } catch (error) {
              console.error('Error loading from localStorage:', error)
            }
          }
        }
      } catch (error) {
        console.error('Error loading project files:', error)
      }
    }

    // Persist project connection to localStorage
    if (currentSessionId) {
      localStorage.setItem(`project_${currentSessionId}`, JSON.stringify(project))
    }

    // Auto-open builder in new tab
    const builderUrl = `/builder/${project.id}?name=${encodeURIComponent(project.name)}&fromChat=true`
    window.open(builderUrl, `builder_${project.id}`)

    // Mark this session as connected to project for sync
    localStorage.setItem(`chat_project_sync_${currentSessionId}`, project.id)
  }


  // Check for pending project connection from Dashboard
  useEffect(() => {
    const pendingProject = localStorage.getItem('pending_project_connection')
    if (pendingProject && currentSessionId) {
      try {
        const project = JSON.parse(pendingProject) as Project

        // Disconnect any previous project
        if (currentProject) {
          saveProjectState(currentProject.id)
          localStorage.removeItem(`project_${currentSessionId}`)
          localStorage.removeItem(`chat_project_sync_${currentSessionId}`)
        }

        // Connect the new project
        setCurrentProject(project)
        loadProjectState(project.id)

        // Persist project connection
        localStorage.setItem(`project_${currentSessionId}`, JSON.stringify(project))
        localStorage.setItem(`chat_project_sync_${currentSessionId}`, project.id)

        // Clear the pending connection
        localStorage.removeItem('pending_project_connection')

        // Auto-open builder with the project
        const builderUrl = `/builder/${project.id}?name=${encodeURIComponent(project.name)}&fromChat=true`
        window.open(builderUrl, `builder_${project.id}`)
      } catch (error) {
        console.error("Error connecting pending project:", error)
        localStorage.removeItem('pending_project_connection')
      }
    }
  }, [currentSessionId, currentProject, setCurrentProject, saveProjectState, loadProjectState])


  // Load project connection on mount AND restore on focus (prevent auto-disconnect)
  useEffect(() => {
    const restoreProjectConnection = () => {
      if (currentSessionId) {
        const savedProject = localStorage.getItem(`project_${currentSessionId}`)
        if (savedProject) {
          try {
            const project = JSON.parse(savedProject)
            // Only restore if store doesn't have a project but localStorage does
            const currentStoreProject = useAppStore.getState().currentProject
            if (!currentStoreProject) {
              console.log("Restoring project connection from localStorage:", project.name)
              setCurrentProject(project)
            }
          } catch (error) {
            console.error("Error loading saved project:", error)
          }
        }
      }
    }

    // Restore on mount if no project is set
    if (!currentProject) {
      restoreProjectConnection()
    }

    // Also restore when window regains focus (handles tab switching, navigation, etc.)
    window.addEventListener("focus", restoreProjectConnection)

    // Also listen for visibility changes (handles browser minimizing/maximizing)
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        restoreProjectConnection()
      }
    }
    document.addEventListener("visibilitychange", handleVisibilityChange)

    return () => {
      window.removeEventListener("focus", restoreProjectConnection)
      document.removeEventListener("visibilitychange", handleVisibilityChange)
    }
  }, [currentSessionId, currentProject, setCurrentProject])

  // Load project files when project is connected and FILE mode is active
  useEffect(() => {
    if (currentProject && user) {
      const loadFiles = async () => {
        try {
          const files = await loadProjectFilesFromStorage(
            currentProject.id,
            user.id,
            githubConnection
          )

          if (Object.keys(files).length > 0) {
            // Merge with existing files, prioritizing loaded project files
            const currentFiles = useAppStore.getState().generatedFiles
            setGeneratedFiles({ ...currentFiles, ...files })
          } else {
            // Fallback to localStorage
            const storageKey = `project_${currentProject.id}_files`
            const savedData = localStorage.getItem(storageKey)
            if (savedData) {
              try {
                const parsed = JSON.parse(savedData)
                if (parsed.files && Object.keys(parsed.files).length > 0) {
                  const currentFiles = useAppStore.getState().generatedFiles
                  setGeneratedFiles({ ...currentFiles, ...parsed.files })
                }
              } catch (error) {
                console.error('Error loading from localStorage:', error)
              }
            }
          }
        } catch (error) {
          console.error('Error loading project files:', error)
        }
      }

      loadFiles()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentProject?.id, user?.id])


  const handleCreateProject = async () => {
    if (!user || !newProjectName.trim()) return

    // Check if GitHub is connected with valid token
    if (!githubConnection || !githubConnection.accessToken) {
      setShowCreateProjectDialog(false)
      setShowGitHubPrompt(true)
      return
    }

    // Don't allow creation with placeholder OAuth code
    if (githubConnection.accessToken.startsWith('oauth_code_')) {
      alert("GitHub connection pending. Please complete the OAuth flow or reconnect.")
      setShowCreateProjectDialog(false)
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
      setCurrentProject(newProject)
      setNewProjectName("")
      setNewProjectDescription("")
      setShowCreateProjectDialog(false)

      // Persist project connection to localStorage
      if (currentSessionId) {
        localStorage.setItem(`project_${currentSessionId}`, JSON.stringify(newProject))
        localStorage.setItem(`chat_project_sync_${currentSessionId}`, newProject.id)
      }

      // Auto-open builder with the new project
      const builderUrl = `/builder/${newProject.id}?name=${encodeURIComponent(newProject.name)}&fromChat=true`
      window.open(builderUrl, `builder_${newProject.id}`)
    } catch (error) {
      console.error("Error creating project:", error)
      alert(error instanceof Error ? error.message : "Failed to create project. Please try again.")
    } finally {
      setIsCreatingProject(false)
    }
  }

  const handleConnectGitHub = () => {
    try {
      const oauthUrl = getGitHubOAuthUrl()
      window.location.href = oauthUrl
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Failed to connect to GitHub"
      alert(errorMessage)
      console.error("GitHub OAuth error:", error)
    }
  }



  const messagesEndRef = useRef<HTMLDivElement>(null)
  const [streamingMessageId, setStreamingMessageId] = useState<string | null>(null)
  const [streamingContent, setStreamingContent] = useState<string>("")
  const [thinkingText, setThinkingText] = useState<string>("")
  const [isThinking, setIsThinking] = useState<boolean>(false)
  const [isImageGenerating, setIsImageGenerating] = useState<boolean>(false)
  const [isSwitchingModel, setIsSwitchingModel] = useState<boolean>(false)
  const [switchingMessage, setSwitchingMessage] = useState<string>("")
  const shouldStopRef = useRef<boolean>(false)
  const titleGeneratedRef = useRef<boolean>(false)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }

  // Detect image generation state
  useEffect(() => {
    const lastMessage = messages[messages.length - 1]
    if (lastMessage?.role === "assistant") {
      if (lastMessage.isGeneratingImage) {
        setIsImageGenerating(true)
      } else if (lastMessage.generatedImages) {
        const hasLoadingImages = lastMessage.generatedImages.some(img => !img.url || img.url === "")
        setIsImageGenerating(hasLoadingImages)
      } else {
        setIsImageGenerating(false)
      }
    } else {
      setIsImageGenerating(false)
    }
  }, [messages])

  // Detect game engine trigger phrases (2D and 3D)
  useEffect(() => {
    const lastMessage = messages[messages.length - 1]
    if (!lastMessage || lastMessage.role !== "assistant") return

    const content = lastMessage.content.toLowerCase()

    // Check for 2D game engine trigger phrases
    const engine2DTriggers = [
      "opening 2d game engine",
      "launching 2d game engine",
      "opening phaser game engine",
      "launching phaser engine",
      "opening the 2d game engine now",
      "launching the 2d game engine now",
      "let's test your game in the 2d engine",
      "opening game engine to test your assets"
    ]

    // Check for 3D game engine trigger phrases
    const engine3DTriggers = [
      "opening 3d game engine",
      "launching 3d game engine",
      "opening babylon game engine",
      "launching babylon engine",
      "opening the 3d game engine now",
      "launching the 3d game engine now",
      "let's test your game in the 3d engine",
      "opening game engine to view your 3d models",
      "let's preview your 3d models in the game engine"
    ]

    const shouldOpen2DEngine = engine2DTriggers.some(trigger => content.includes(trigger))
    const shouldOpen3DEngine = engine3DTriggers.some(trigger => content.includes(trigger))

    if (shouldOpen2DEngine) {
      // Open 2D game engine in new tab
      const engineUrl = `${window.location.origin}/phaser-2d-engine`
      window.open(engineUrl, '_blank', 'noopener,noreferrer')
    } else if (shouldOpen3DEngine) {
      // Open 3D game engine in new tab
      const engineUrl = `${window.location.origin}/game-engine`
      window.open(engineUrl, '_blank', 'noopener,noreferrer')
    }
  }, [messages])

  useEffect(() => {
    scrollToBottom()
  }, [messages, isGenerating, streamingContent, thinkingText, isThinking, isImageGenerating])

  const handleStop = () => {
    shouldStopRef.current = true
    setIsGenerating(false)
    setIsThinking(false)

    // Abort any in-flight API calls (3D model generation, image generation, etc.)
    const controller = (window as any).__generationAbortController
    if (controller) {
      controller.abort()
      delete (window as any).__generationAbortController
    }

    // Save current streaming content if any
    if (streamingContent && streamingMessageId) {
      const assistantMessage: Message = {
        id: streamingMessageId,
        role: "assistant",
        content: streamingContent,
        timestamp: new Date(),
      }
      addMessage(assistantMessage)
    }

    // Clean up
    setStreamingMessageId(null)
    setStreamingContent("")
    setThinkingText("")

    // Note: The streaming loop will check shouldStopRef and break naturally
  }

  const handleSend = async (content: string, images: File[], mentionedFiles: string[] = []) => {
    // Reset title generation flag for new conversations
    const state = useAppStore.getState()
    const currentSession = state.sessions.find(s => s.id === state.currentSessionId)
    if (currentSession && currentSession.messages.length === 0) {
      titleGeneratedRef.current = false
    }

    // Check for Game Dev Flow command
    if (content.trim().toLowerCase() === "/gamedev") {
      startGameDevFlow()
      const userMessage: Message = {
        id: uuidv4(),
        role: "user",
        content: "Start Game Dev Flow",
        timestamp: new Date(),
      }
      addMessage(userMessage)

      // Trigger AI to start the flow
      handleSend("Let's start the 3D game development flow. Please ask me about my game description.", [])
      return
    }

    // Add user message
    const userMessage: Message = {
      id: uuidv4(),
      role: "user",
      content,
      images: images.length > 0 ? images.map((img) => URL.createObjectURL(img)) : undefined,
      timestamp: new Date(),
    }
    addMessage(userMessage)

    // Check if this is a confirmation message at an asset generation step
    // If so, show a task proposal card instead of triggering immediately
    const confirmationWords = ["proceed", "yes", "confirm", "go ahead", "sure", "do it", "let's go", "generate", "start", "ok", "okay", "yep", "yeah", "affirmative", "approved", "let's do it", "go for it"]
    const contentLower = content.trim().toLowerCase()
    const isConfirmation = confirmationWords.some(word => contentLower === word || contentLower.startsWith(word + " ") || contentLower.startsWith(word + ",") || contentLower.startsWith(word + ".") || contentLower.startsWith(word + "!"))

    if (isConfirmation && isGameDevActive) {
      // Determine what type of asset generation should be triggered based on the game dev step
      const { gameType: storeGameType } = useGameDevStore.getState()
      const currentGameType = storeGameType || gameType

      let assetGenType: TaskType | null = null
      const defaultConfig: TaskConfig = {}

      if (currentGameType === "3d") {
        // 3D flow steps (updated):
        // 7/8 = image confirmation, 11/12 = 3D model confirmation, 20 = animation, 28 = audio
        if (gameDevStep >= 6 && gameDevStep <= 9) {
          assetGenType = "image-generation"
          defaultConfig.imageCount = 4
          defaultConfig.imageResolution = "1024"
        }
        else if (gameDevStep >= 10 && gameDevStep <= 13) {
          assetGenType = "3d-model"
          defaultConfig.modelResolution = "1024"
          defaultConfig.includeTexture = true
          // Try to find the source image from recent messages
          const recentMsgs = useAppStore.getState().messages
          const lastImgMsg = recentMsgs.slice().reverse().find(m => m.generatedImages && m.generatedImages.length > 0)
          if (lastImgMsg?.generatedImages?.[0]?.url) {
            defaultConfig.sourceImage = lastImgMsg.generatedImages[0].url.includes('/')
              ? lastImgMsg.generatedImages[0].url.split('/').pop() || "generated image"
              : "generated image"
          }
        }
        else if (gameDevStep >= 19 && gameDevStep <= 21) assetGenType = "animation-generation"
        else if (gameDevStep >= 27 && gameDevStep <= 29) assetGenType = "audio-generation"
      } else if (currentGameType === "2d") {
        // 2D flow steps (updated):
        // 7/8/9 = image confirmation, 12/13 = sprite, 17/18 = audio
        if (gameDevStep >= 6 && gameDevStep <= 9) {
          assetGenType = "image-generation"
          defaultConfig.imageCount = 4
          defaultConfig.imageResolution = "1024"
        }
        else if (gameDevStep >= 11 && gameDevStep <= 13) assetGenType = "sprite-generation"
        else if (gameDevStep >= 17 && gameDevStep <= 18) assetGenType = "audio-generation"
      }

      if (assetGenType) {
        // Show a task proposal card instead of directly calling API
        useTaskStore.getState().proposeTask(assetGenType, defaultConfig)
        return
      }
    }

    setIsGenerating(true)
    setStreamingContent("")
    setThinkingText("")

    try {
      // Convert images to base64 for Gemini
      const imageParts = await Promise.all(
        images.map(async (file) => {
          const base64 = await new Promise<string>((resolve) => {
            const reader = new FileReader()
            reader.onloadend = () => {
              const base64String = reader.result as string
              resolve(base64String.split(",")[1])
            }
            reader.readAsDataURL(file)
          })
          return {
            inlineData: {
              mimeType: file.type,
              data: base64,
            },
          }
        })
      )

      // Handle file references when project is connected (@filename)
      let processedContent = content
      let projectContext = ""

      if (currentProject) {
        const files = getGeneratedFiles() || {}
        const fileList = Object.keys(files)

        // Build a list of existing project files for context
        const existingFilesContext = fileList.length > 0
          ? `\n\nEXISTING PROJECT FILES:\n${fileList.map(f => `- ${f}`).join('\n')}`
          : '\n\n(No files in project yet)'

        // Build project history from previous chat sessions
        const projectHistory = buildProjectHistoryPrompt(currentProject.id)

        // Add project context to inform AI about file operation capabilities
        projectContext = `\n\n[PROJECT CONTEXT]
Connected Project: "${currentProject.name}" (ID: ${currentProject.id})

${projectHistory}IMPORTANT: You have FULL PERMISSION to create, edit, and delete files in this project.
When the user asks you to add code, modify files, or create new files - DO IT automatically using the markers below.
Do NOT just show code snippets - actually save them to the project files.
If there is a PROJECT HISTORY section above, use it to understand what has been done in previous chat sessions.
Continue from where the previous sessions left off. Do NOT repeat or re-create work that was already done.

FILE OPERATION MARKERS (use these to automatically save files):
- CREATE_FILE: [CREATE_FILE: path/to/file.ext, file content here]
- EDIT_FILE: [EDIT_FILE: path/to/file.ext, complete new file content here]
- DELETE_FILE: [DELETE_FILE: path/to/file.ext]
- EDIT_IMAGE: [EDIT_IMAGE: path_to_image, instructions_for_edit, preferred_model] (Models: nano-banana-edit, nano-banana-pro-edit. Example: [EDIT_IMAGE: images/hero.png, replace background with sunset, nano-banana-edit])

RULES:
1. When user says "add code to main.js" or similar - use EDIT_FILE with the COMPLETE updated content
2. When user says "create a new file" - use CREATE_FILE
3. Always include the FULL file content in EDIT_FILE, not just the changes
4. If a file was recently discussed, you can continue editing it without the user using @mention
5. Remember which files you've created/edited in this conversation
6. When editing images, if the user doesn't specify a model, ask them or use the default (nano-banana-edit). Always provide the full file path.
${existingFilesContext}`

        const fileContents: string[] = []
        const deduplicatedMentions = new Set<string>()

        const attachReferencedFile = async (filePath: string) => {
          if (deduplicatedMentions.has(filePath)) return
          deduplicatedMentions.add(filePath)

          const fileContent = files[filePath] || files[`assets/${filePath}`] || files[`src/${filePath}`] || files[`assets/images/${filePath}`] || files[`assets/models/${filePath}`]
          if (!fileContent) return

          const isImage = /\.(png|jpg|jpeg|webp|gif)$/i.test(filePath)

          if (isImage) {
            let url = fileContent
            if (!url.startsWith("http") && !url.startsWith("data:") && !url.startsWith("blob:")) {
              const urlMatch = url.match(/\**URL:\**\s*(https?:\/\/[^\s\n*)]+)/i) || url.match(/# URL:\s*(https?:\/\/[^\s\n]+)/i)
              if (urlMatch) {
                url = urlMatch[1]
              }
            }

            if (url && (url.startsWith('http') || url.startsWith('data:') || url.startsWith('blob:'))) {
              try {
                let fetchUrl = url
                const R2_DOMAIN = "pub-d259d1d2737843cb8bcb2b1ff98fc9c6.r2.dev"
                if (fetchUrl.includes(R2_DOMAIN)) {
                  const urlObj = new URL(fetchUrl)
                  fetchUrl = `/api/r2-proxy${urlObj.pathname}`
                }

                if (fetchUrl.startsWith('data:')) {
                  const parts = fetchUrl.split(',')
                  const mime = parts[0].split(':')[1].split(';')[0]
                  const base64 = parts[1]
                  imageParts.push({ inlineData: { mimeType: mime, data: base64 } })
                } else {
                  const response = await fetch(fetchUrl)
                  if (response.ok) {
                    const blob = await response.blob()
                    const base64 = await new Promise<string>((resolve) => {
                      const reader = new FileReader()
                      reader.onloadend = () => {
                        const b64 = reader.result as string
                        resolve(b64.split(",")[1])
                      }
                      reader.readAsDataURL(blob)
                    })
                    imageParts.push({ inlineData: { mimeType: blob.type, data: base64 } })
                  }
                }
                fileContents.push(`[Attached Image File]: ${filePath}`)
                return
              } catch (e) {
                console.error("Failed to fetch image for mention:", e)
              }
            }
          }

          // Fallback to text if not an image or if attach failed
          fileContents.push(`File: ${filePath}\n\`\`\`\n${fileContent}\n\`\`\``)
        }

        // Process explicitly mentioned files
        if (mentionedFiles.length > 0) {
          for (const filePath of mentionedFiles) {
            await attachReferencedFile(filePath)
          }
        }

        // Also check for regex matches in the text (legacy/fallback)
        if (content.includes("@")) {
          const fileRefRegex = /@([^\s]+)/g
          const fileRefs = Array.from(content.matchAll(fileRefRegex))

          for (const match of fileRefs) {
            await attachReferencedFile(match[1])
          }
        }

        // Append file contents to the message
        if (fileContents.length > 0) {
          processedContent = `${content}\n\nReferenced files:\n${fileContents.join("\n\n")}`
        }
      }

      // Append project context
      if (projectContext) {
        processedContent = processedContent + projectContext
      }

      // Inject Game Dev System Prompt if active or detecting type
      let systemPrompt = ""
      if (isGameDevActive || gameType === null) {
        systemPrompt = getGameDevSystemPrompt(gameDevStep, gameType, !!currentProject)
      }

      const geminiMessages: Array<{
        role: "user" | "model"
        parts: Array<{ text?: string; inlineData?: { mimeType: string; data: string } }>
      }> = [
          ...(systemPrompt ? [{
            role: "user" as const,
            parts: [{ text: "SYSTEM INSTRUCTION: " + systemPrompt }]
          }] : []),
          ...(Array.isArray(messages) ? messages : []).map((msg) => ({
            role: (msg.role === "user" ? "user" : "model") as "user" | "model",
            parts: [{ text: msg.content }],
          })),
          {
            role: "user" as const,
            parts: [
              ...(processedContent ? [{ text: processedContent }] : []),
              ...imageParts,
            ],
          },
        ]

      const assistantMessageId = uuidv4()
      setStreamingMessageId(assistantMessageId)
      shouldStopRef.current = false

      // Show thinking state initially
      setIsThinking(true)

      // Streaming mode: Streaming with typing animation (3 words at a time)
      let accumulatedText = ""
      let displayedWordCount = 0

      try {
        for await (const chunk of sendMessageToGeminiStream(geminiMessages)) {
          // Check if stop was requested
          if (shouldStopRef.current) {
            break
          }

          // Once we start receiving chunks, hide thinking and show streaming
          if (accumulatedText === "" && chunk) {
            setIsThinking(false)
            setThinkingText("")
            setIsSwitchingModel(false)
            setSwitchingMessage("")
          }

          accumulatedText += chunk

          // Split into words (preserving spaces)
          const allWords = accumulatedText.match(/\S+\s*/g) || []

          // Display 3 words at a time
          while (allWords.length > displayedWordCount && !shouldStopRef.current) {
            const wordsToDisplay = allWords.slice(0, Math.min(displayedWordCount + 3, allWords.length))
            const displayText = wordsToDisplay.join("")
            setStreamingContent(displayText)
            displayedWordCount = wordsToDisplay.length

            // Small delay for typing effect
            await new Promise(resolve => setTimeout(resolve, 100))
          }

          // Check again after processing chunk
          if (shouldStopRef.current) {
            break
          }
        }

        // Final update with complete text (only if not stopped)
        if (!shouldStopRef.current && accumulatedText) {
          setStreamingContent(accumulatedText)

          // ─── Web Search Detection & Round-Trip ───
          const webSearchMatch = accumulatedText.match(/\[WEB_SEARCH:\s*(.+?)\]/)
          if (webSearchMatch) {
            const searchQuery = webSearchMatch[1].trim()
            console.log(`[WebSearch] AI triggered search for: "${searchQuery}"`)

            // Strip the [WEB_SEARCH: ...] marker and any text after it from displayed content
            const contentBeforeSearch = accumulatedText.substring(0, webSearchMatch.index).trim()

            // Show a "searching" message
            setStreamingContent(contentBeforeSearch || "Let me search the web for that...")
            setIsThinking(true)
            setThinkingText("🔍 Searching the web...")

            try {
              const searchResults = await webSearch(searchQuery)
              console.log(`[WebSearch] Got ${searchResults.organic.length} organic, ${searchResults.images.length} images, ${searchResults.videos.length} videos`)

              // Inject search results into context and re-ask Gemini
              const searchContext = formatSearchResultsForContext(searchResults)

              const enrichedMessages = [
                ...geminiMessages,
                { role: "model" as const, parts: [{ text: accumulatedText }] },
                { role: "user" as const, parts: [{ text: searchContext }] },
              ]

              // Re-stream with search results context
              setIsThinking(false)
              setThinkingText("")

              let enrichedText = ""
              let enrichedWordCount = 0

              for await (const chunk of sendMessageToGeminiStream(enrichedMessages)) {
                if (shouldStopRef.current) break
                enrichedText += chunk
                const allWords = enrichedText.match(/\S+\s*/g) || []
                while (allWords.length > enrichedWordCount && !shouldStopRef.current) {
                  const wordsToDisplay = allWords.slice(0, Math.min(enrichedWordCount + 3, allWords.length))
                  setStreamingContent(wordsToDisplay.join(""))
                  enrichedWordCount = wordsToDisplay.length
                  await new Promise(resolve => setTimeout(resolve, 100))
                }
                if (shouldStopRef.current) break
              }

              // Save the enriched response with search results attached
              const finalContent = enrichedText || contentBeforeSearch || accumulatedText
              setStreamingContent(finalContent)

              const assistantMessage: Message = {
                id: assistantMessageId,
                role: "assistant",
                content: finalContent.replace(/\[WEB_SEARCH:[^\]]*\]/g, "").trim(),
                webSearchResults: searchResults,
                timestamp: new Date(),
              }
              addStreamingMessage(assistantMessage)

              if (currentProject && user) {
                parseAndExecuteFileOperations(finalContent)
              }
              parseAndExecuteGameDevSteps(finalContent)
              if (!titleGeneratedRef.current && currentSessionId) {
                titleGeneratedRef.current = true
                generateTitleForSession()
              }
              if (currentProject && currentSessionId) {
                const freshState = useAppStore.getState()
                const session = freshState.sessions.find(s => s.id === currentSessionId)
                if (session) {
                  recordSessionToProjectContext(
                    currentProject.id,
                    currentProject.name,
                    currentSessionId,
                    session.title,
                    session.messages.map(m => ({ role: m.role, content: m.content }))
                  )
                }
              }
            } catch (searchError) {
              console.error("[WebSearch] Search failed:", searchError)
              setIsThinking(false)
              setThinkingText("")

              // Fall back to the original response without search
              const assistantMessage: Message = {
                id: assistantMessageId,
                role: "assistant",
                content: (contentBeforeSearch || accumulatedText).replace(/\[WEB_SEARCH:[^\]]*\]/g, "").trim() +
                  "\n\n*I tried to search the web but encountered an error. Please try again.*",
                timestamp: new Date(),
              }
              addStreamingMessage(assistantMessage)
            }
          } else {
            // ─── Normal (non-search) response ───
            const assistantMessage: Message = {
              id: assistantMessageId,
              role: "assistant",
              content: accumulatedText,
              timestamp: new Date(),
            }
            addStreamingMessage(assistantMessage)

            // Parse and execute file operations if project is connected
            if (currentProject && user) {
              parseAndExecuteFileOperations(accumulatedText)
            }

            // Parse and execute game dev steps (always check for game type detection)
            parseAndExecuteGameDevSteps(accumulatedText)

            // Generate title after first AI response
            if (!titleGeneratedRef.current && currentSessionId) {
              titleGeneratedRef.current = true
              generateTitleForSession()
            }

            // Record project context after each AI response
            if (currentProject && currentSessionId) {
              const freshState = useAppStore.getState()
              const session = freshState.sessions.find(s => s.id === currentSessionId)
              if (session) {
                recordSessionToProjectContext(
                  currentProject.id,
                  currentProject.name,
                  currentSessionId,
                  session.title,
                  session.messages.map(m => ({ role: m.role, content: m.content }))
                )
              }
            }
          }
        } else if (shouldStopRef.current && accumulatedText) {
          // Save partial content if stopped
          const assistantMessage: Message = {
            id: assistantMessageId,
            role: "assistant",
            content: accumulatedText,
            timestamp: new Date(),
          }
          addStreamingMessage(assistantMessage)

          // Parse and execute file operations if project is connected
          if (currentProject && user) {
            parseAndExecuteFileOperations(accumulatedText)
          }

          // Parse and execute game dev steps (always check for game type detection)
          parseAndExecuteGameDevSteps(accumulatedText)

          // Generate title after first AI response
          if (!titleGeneratedRef.current && currentSessionId) {
            titleGeneratedRef.current = true
            generateTitleForSession()
          }

          // Record project context after stopped AI response
          if (currentProject && currentSessionId) {
            const freshState = useAppStore.getState()
            const session = freshState.sessions.find(s => s.id === currentSessionId)
            if (session) {
              recordSessionToProjectContext(
                currentProject.id,
                currentProject.name,
                currentSessionId,
                session.title,
                session.messages.map(m => ({ role: m.role, content: m.content }))
              )
            }
          }
        }
      } catch (streamError) {
        // Check error type and handle accordingly
        const errorMsg = streamError instanceof Error ? streamError.message : String(streamError)

        // Check if it's a quota error (429) - might be switching to base model
        const isQuotaError = errorMsg.includes("429") || errorMsg.includes("quota") || errorMsg.includes("Quota exceeded")
        const isImageModelQuota = isQuotaError && errorMsg.includes("image") || errorMsg.includes("gemini-2.5-flash-image")

        // If it's an image model quota error, the streaming function will automatically fallback to base model
        // We need to show a smooth transition
        if (isImageModelQuota) {
          // Show switching animation
          setIsSwitchingModel(true)
          setSwitchingMessage("Switching to base model...")
          setIsThinking(true)
          setThinkingText("Model limit reached. Switching to base model for better availability...")

          // Fade out streaming content
          setStreamingContent("")
          await new Promise(resolve => setTimeout(resolve, 800))

          // The streaming function will automatically retry with base model
          // We'll catch it in the next iteration, but for now show thinking
          setIsSwitchingModel(false)
          setSwitchingMessage("")
          setIsThinking(false)
          setThinkingText("")

          // Try to continue with base model streaming
          try {
            // Re-attempt streaming (the function will use base model now)
            let fallbackAccumulatedText = ""
            let fallbackDisplayedWordCount = 0

            for await (const chunk of sendMessageToGeminiStream(geminiMessages)) {
              if (shouldStopRef.current) break

              fallbackAccumulatedText += chunk
              const allWords = fallbackAccumulatedText.match(/\S+\s*/g) || []

              while (allWords.length > fallbackDisplayedWordCount && !shouldStopRef.current) {
                const wordsToDisplay = allWords.slice(0, Math.min(fallbackDisplayedWordCount + 3, allWords.length))
                const displayText = wordsToDisplay.join("")
                setStreamingContent(displayText)
                fallbackDisplayedWordCount = wordsToDisplay.length
                await new Promise(resolve => setTimeout(resolve, 100))
              }

              if (shouldStopRef.current) break
            }

            if (!shouldStopRef.current && fallbackAccumulatedText) {
              setStreamingContent(fallbackAccumulatedText)
              const assistantMessage: Message = {
                id: assistantMessageId,
                role: "assistant",
                content: fallbackAccumulatedText,
                timestamp: new Date(),
              }
              addStreamingMessage(assistantMessage)

              // Generate title after first AI response
              if (!titleGeneratedRef.current && currentSessionId) {
                titleGeneratedRef.current = true
                generateTitleForSession()
              }

              // Record project context after fallback AI response
              if (currentProject && currentSessionId) {
                const freshState = useAppStore.getState()
                const session = freshState.sessions.find(s => s.id === currentSessionId)
                if (session) {
                  recordSessionToProjectContext(
                    currentProject.id,
                    currentProject.name,
                    currentSessionId,
                    session.title,
                    session.messages.map(m => ({ role: m.role, content: m.content }))
                  )
                }
              }
            }
            return
          } catch (fallbackStreamError) {
            // If fallback streaming also fails, continue to error handling below
            console.error("Fallback streaming failed:", fallbackStreamError)
          }
        }

        // Check if it's a quota error - if so, show helpful message
        if (isQuotaError && !isImageModelQuota) {
          setIsThinking(false)
          setIsSwitchingModel(false)
          setSwitchingMessage("")
          const quotaErrorMessage: Message = {
            id: assistantMessageId,
            role: "assistant",
            content: "I'm currently experiencing high demand. Please check your API quota or try again in a moment. If you're using the free tier, you may have reached the daily limit.",
            timestamp: new Date(),
          }
          addMessage(quotaErrorMessage)
          return
        }

        // Check if it's a 503 error (model overloaded) - fall back to non-streaming mode
        if (errorMsg.includes("503") || errorMsg.includes("overloaded") || errorMsg.includes("UNAVAILABLE")) {
          // Show switching animation
          setIsSwitchingModel(true)
          setSwitchingMessage("Switching to standard mode...")
          setIsThinking(true)
          setThinkingText("Service overloaded. Switching to standard response mode...")

          // Fade out streaming content
          setStreamingContent("")
          await new Promise(resolve => setTimeout(resolve, 800))

          setIsSwitchingModel(false)
          setSwitchingMessage("")
          setIsThinking(false)
          setThinkingText("")

          try {
            // Fall back to non-streaming mode
            const response = await sendMessageToGemini(geminiMessages)

            const assistantMessage: Message = {
              id: assistantMessageId,
              role: "assistant",
              content: response,
              timestamp: new Date(),
            }
            addMessage(assistantMessage)

            // Generate title after first AI response
            if (!titleGeneratedRef.current && currentSessionId) {
              titleGeneratedRef.current = true
              generateTitleForSession()
            }

            // Record project context after fallback non-streaming response
            if (currentProject && currentSessionId) {
              const freshState = useAppStore.getState()
              const session = freshState.sessions.find(s => s.id === currentSessionId)
              if (session) {
                recordSessionToProjectContext(
                  currentProject.id,
                  currentProject.name,
                  currentSessionId,
                  session.title,
                  session.messages.map(m => ({ role: m.role, content: m.content }))
                )
              }
            }
            return
          } catch (fallbackError) {
            // If fallback also fails, show error
            const fallbackErrorMsg = fallbackError instanceof Error ? fallbackError.message : String(fallbackError)
            const errorMessage: Message = {
              id: assistantMessageId,
              role: "assistant",
              content: fallbackErrorMsg.includes("503") || fallbackErrorMsg.includes("overloaded")
                ? "The service is currently overloaded. Please try again in a few moments."
                : "Sorry, I encountered an error processing your request. Please try again.",
              timestamp: new Date(),
            }
            addMessage(errorMessage)
            return
          }
        }

        // For other errors, try thinking mode as fallback
        setIsSwitchingModel(true)
        setSwitchingMessage("Switching to thinking mode...")
        setIsThinking(true)
        setThinkingText("Analyzing your request...")

        // Fade out streaming content
        setStreamingContent("")
        await new Promise(resolve => setTimeout(resolve, 600))

        setIsSwitchingModel(false)
        setSwitchingMessage("")

        try {
          const { response, thinking } = await sendMessageToGeminiWithThinking(geminiMessages)

          setThinkingText(thinking || "Processing complete.")

          // Show thinking text briefly, then show response
          await new Promise(resolve => setTimeout(resolve, 1000))

          setIsThinking(false)
          setThinkingText("")

          const assistantMessage: Message = {
            id: assistantMessageId,
            role: "assistant",
            content: response,
            timestamp: new Date(),
          }
          addMessage(assistantMessage)

          // Generate title after first AI response
          if (!titleGeneratedRef.current && currentSessionId) {
            titleGeneratedRef.current = true
            generateTitleForSession()
          }

          // Record project context after thinking mode response
          if (currentProject && currentSessionId) {
            const freshState = useAppStore.getState()
            const session = freshState.sessions.find(s => s.id === currentSessionId)
            if (session) {
              recordSessionToProjectContext(
                currentProject.id,
                currentProject.name,
                currentSessionId,
                session.title,
                session.messages.map(m => ({ role: m.role, content: m.content }))
              )
            }
          }
        } catch (thinkingError) {
          // If thinking mode also fails, show error
          setIsThinking(false)
          setIsSwitchingModel(false)
          setSwitchingMessage("")
          const thinkingErrorMessage = thinkingError instanceof Error ? thinkingError.message : String(thinkingError)
          const errorMessage: Message = {
            id: assistantMessageId,
            role: "assistant",
            content: thinkingErrorMessage.includes("quota") || thinkingErrorMessage.includes("429")
              ? "API quota exceeded. Please check your billing or try again later."
              : thinkingErrorMessage.includes("503") || thinkingErrorMessage.includes("overloaded")
                ? "The service is currently overloaded. Please try again in a few moments."
                : "Sorry, I encountered an error processing your request. Please try again.",
            timestamp: new Date(),
          }
          addMessage(errorMessage)
        }
      }
    } catch (error) {
      console.error("Error sending message:", error)
      const errorMessage: Message = {
        id: uuidv4(),
        role: "assistant",
        content: "Sorry, I encountered an error. Please try again.",
        timestamp: new Date(),
      }
      addMessage(errorMessage)
    } finally {
      setIsGenerating(false)
      setStreamingMessageId(null)
      setStreamingContent("")
      setThinkingText("")
      setIsThinking(false)
      setIsSwitchingModel(false)
      setSwitchingMessage("")
    }
  }

  // Parse and execute file operations from AI response
  const parseAndExecuteFileOperations = async (content: string) => {
    if (!currentProject || !user) return

    // Parse CREATE_FILE operations: [CREATE_FILE: path, content]
    const createFileRegex = /\[CREATE_FILE:\s*([^\]]+?),\s*([^\]]+?)\]/gs
    let match
    const createMatches: Array<{ path: string; content: string }> = []
    while ((match = createFileRegex.exec(content)) !== null) {
      createMatches.push({
        path: match[1].trim(),
        content: match[2].trim()
      })
    }

    // Parse EDIT_FILE operations: [EDIT_FILE: path, new content]
    const editFileRegex = /\[EDIT_FILE:\s*([^\]]+?),\s*([^\]]+?)\]/gs
    const editMatches: Array<{ path: string; content: string }> = []
    while ((match = editFileRegex.exec(content)) !== null) {
      editMatches.push({
        path: match[1].trim(),
        content: match[2].trim()
      })
    }

    // Parse DELETE_FILE operations: [DELETE_FILE: path]
    const deleteFileRegex = /\[DELETE_FILE:\s*([^\]]+?)\]/g
    const deleteMatches: string[] = []
    while ((match = deleteFileRegex.exec(content)) !== null) {
      deleteMatches.push(match[1].trim())
    }

    // Parse EDIT_IMAGE operations: [EDIT_IMAGE: path, prompt, model]
    const editImageRegex = /\[EDIT_IMAGE:\s*([^\]\,]+?),\s*([^\]\,]+?)(?:,\s*([^\]]+?))?\]/g
    const editImageMatches: Array<{ path: string; prompt: string; model: string }> = []
    while ((match = editImageRegex.exec(content)) !== null) {
      editImageMatches.push({
        path: match[1].trim(),
        prompt: match[2].trim(),
        model: match[3] ? match[3].trim() : "nano-banana-edit"
      })
    }

    // Execute CREATE_FILE operations
    for (const { path, content: fileContent } of createMatches) {
      try {
        addGeneratedFile(path, fileContent)
        await saveSingleProjectFile(
          currentProject.id,
          user.id,
          currentProject.name,
          path,
          fileContent,
          githubConnection
        )
        console.log(`AI created file: ${path}`)
      } catch (error) {
        console.error(`Error creating file ${path}:`, error)
      }
    }

    // Execute EDIT_FILE operations
    for (const { path, content: fileContent } of editMatches) {
      try {
        addGeneratedFile(path, fileContent)
        await saveSingleProjectFile(
          currentProject.id,
          user.id,
          currentProject.name,
          path,
          fileContent,
          githubConnection
        )
        console.log(`AI edited file: ${path}`)
      } catch (error) {
        console.error(`Error editing file ${path}:`, error)
      }
    }

    // Execute DELETE_FILE operations
    for (const path of deleteMatches) {
      try {
        const currentFiles = getGeneratedFiles()
        const updatedFiles = { ...currentFiles }
        delete updatedFiles[path]
        setGeneratedFiles(updatedFiles)
        console.log(`AI deleted file: ${path}`)
      } catch (error) {
        console.error(`Error deleting file ${path}:`, error)
      }
    }

    // Execute EDIT_IMAGE operations
    for (const { path, prompt, model } of editImageMatches) {
      try {
        const files = getGeneratedFiles() || {}
        let imageUrl = path
        if (files[path]) {
          const fileContent = files[path]
          if (fileContent.startsWith('http') || fileContent.startsWith('data:')) {
            imageUrl = fileContent
          } else {
            const urlMatch = fileContent.match(/# URL: (http[^\n]+)/)
            if (urlMatch) imageUrl = urlMatch[1]
          }
        }

        if (!imageUrl.startsWith('http') && !imageUrl.startsWith('data:')) {
          console.warn("Invalid image URL for editing:", imageUrl)
          continue
        }

        const { editImageWithHyperreal } = await import("../../services/hyperreal")
        let editedUrl = await editImageWithHyperreal(prompt, imageUrl, { model: model as any })

        // Persist to Supabase so it doesn't expire
        if (editedUrl.startsWith("http") && user) {
          try {
            const { createAssetFromUrl } = await import("../../services/assetService")
            const timestamp = Date.now()
            const truncId = String(timestamp).slice(-7)
            const editedName = `ed_${truncId}.png`
            const assetMetadata = await createAssetFromUrl(
              user.id,
              currentProject?.id || null,
              "image",
              editedName,
              editedUrl
            )
            editedUrl = assetMetadata.url
          } catch (saveErr) {
            console.warn("Failed to persist edited image, ignoring:", saveErr)
          }
        }

        const timestamp = Date.now()
        const truncId = String(timestamp).slice(-7)
        const editedName = `images/ed_${truncId}.png`
        const newContent = `# Image Asset\n# URL: ${editedUrl}\n# Prompt: ${prompt}`

        addGeneratedFile(editedName, editedUrl)
        await saveSingleProjectFile(
          currentProject.id,
          user.id,
          currentProject.name,
          editedName,
          newContent,
          githubConnection
        )

        // Add a message updating the user with the generated image
        addMessage({
          id: uuidv4(),
          role: "assistant",
          content: `✅ Successfully edited image \`${path}\` and saved as \`${editedName}\`.`,
          timestamp: new Date(),
          images: [editedUrl]
        })
        console.log(`AI edited image: ${path} -> ${editedName}`)

      } catch (error) {
        console.error("Error editing image via AI:", error)
        addMessage({
          id: uuidv4(),
          role: "assistant",
          content: `❌ Error editing image \`${path}\`: ${error instanceof Error ? error.message : "Unknown error"}`,
          timestamp: new Date()
        })
      }
    }
  }

  // Parse and execute game dev steps from AI response
  const parseAndExecuteGameDevSteps = (content: string) => {
    // Parse [RESET_FLOW]
    if (content.includes('[RESET_FLOW]')) {
      const { resetFlow } = useGameDevStore.getState()
      resetFlow()
      console.log('Game dev flow has been reset.')
      return
    }

    // Parse [GAME_TYPE: 2D] or [GAME_TYPE: 3D]
    const gameTypeRegex = /\[GAME_TYPE:\s*(2D|3D)\]/i
    const gameTypeMatch = content.match(gameTypeRegex)

    if (gameTypeMatch) {
      const detectedType = gameTypeMatch[1].toLowerCase() as "2d" | "3d"
      if (!isGameDevActive) {
        setGameType(detectedType)
        console.log(`Game type detected: ${detectedType}. Starting game dev flow.`)
      }
    }

    // Parse [STEP: <number>]
    const stepRegex = /\[STEP:\s*(\d+)\]/g
    let match
    let lastStep = -1

    while ((match = stepRegex.exec(content)) !== null) {
      const step = parseInt(match[1], 10)
      if (!isNaN(step)) {
        lastStep = step
      }
    }

    if (lastStep !== -1 && lastStep !== gameDevStep) {
      setGameDevStep(lastStep)
      console.log(`Game Dev Flow advanced to step: ${lastStep}`)
    }
  }

  // Helper to add streaming message
  const addStreamingMessage = (message: Message) => {
    // Add the final assistant message - this will append to existing messages including user messages
    // addMessage already saves to localStorage, so we just use it
    addMessage(message)
  }

  // Sync generatedFiles to builder when connected to project
  useEffect(() => {
    if (currentProject && currentSessionId) {
      // Update sync timestamp to notify builder of changes
      const syncKey = `project_${currentProject.id}_sync`
      const currentFiles = getGeneratedFiles()
      localStorage.setItem(syncKey, JSON.stringify({
        timestamp: Date.now(),
        sessionId: currentSessionId,
        files: currentFiles
      }))
    }
  }, [currentProject, currentSessionId, getGeneratedFiles])

  // Listen for file changes from builder (bidirectional sync)
  useEffect(() => {
    if (!currentProject || !currentSessionId) return

    const syncKey = `project_${currentProject.id}_sync`

    // Check for updates from builder every 2 seconds
    const syncInterval = setInterval(() => {
      const syncData = localStorage.getItem(syncKey)
      if (syncData) {
        try {
          const parsed = JSON.parse(syncData)
          const currentFiles = getGeneratedFiles()

          // Only update if the change came from builder (different sessionId) and files are different
          const lastCheck = localStorage.getItem(`${syncKey}_chat_lastCheck`)
          const lastCheckTime = lastCheck ? parseInt(lastCheck) : 0

          if (parsed.sessionId !== currentSessionId && parsed.timestamp > lastCheckTime && JSON.stringify(currentFiles) !== JSON.stringify(parsed.files)) {
            console.log('Chat: Syncing files from builder...')
            setGeneratedFiles(parsed.files)
            localStorage.setItem(`${syncKey}_chat_lastCheck`, parsed.timestamp.toString())
          }
        } catch (error) {
          console.error('Error syncing from builder:', error)
        }
      }
    }, 2000)

    return () => clearInterval(syncInterval)
  }, [currentProject, currentSessionId, getGeneratedFiles, setGeneratedFiles])

  // Generate title for the current session after first AI response
  const generateTitleForSession = async () => {
    if (!currentSessionId) return

    // Get fresh state to ensure we have the latest messages
    const state = useAppStore.getState()
    const currentSession = state.sessions.find(s => s.id === currentSessionId)
    if (!currentSession) return

    // Only generate if title is still "New Chat" or was generated from first user message
    const currentTitle = currentSession.title
    if (currentTitle !== "New Chat" && !currentTitle.includes("...") && currentTitle.length > 20) {
      // Title already seems to be set, skip
      return
    }

    try {
      // Get all messages including the new assistant message
      const allMessages = state.messages.length > 0 ? state.messages : currentSession.messages
      const assistantMessages = allMessages.filter(m => m.role === "assistant")

      // Only generate if we have at least one assistant message
      if (assistantMessages.length > 0) {
        const generatedTitle = await generateChatTitle(allMessages)
        updateSessionTitle(currentSessionId, generatedTitle)
      }
    } catch (error) {
      console.error("Error generating chat title:", error)
      // Don't throw - title generation failure shouldn't break the app
    }
  }

  // Handle task approval from TaskProposalCard
  const handleTaskApproval = (type: TaskType, config: TaskConfig) => {
    const taskStore = useTaskStore.getState()
    const taskId = uuidv4()

    // Map TaskType to the old assetType format for WorkflowManager compatibility
    let legacyAssetType: string = type
    if (type === "image-generation") legacyAssetType = "images"
    else if (type === "sprite-generation") legacyAssetType = "sprites"
    else if (type === "animation-generation") legacyAssetType = "animations"
    else if (type === "audio-generation") legacyAssetType = "audio"

    // Create the task in the store
    taskStore.addTask({
      id: taskId,
      type,
      status: "running",
      config,
      createdAt: Date.now(),
      startedAt: Date.now(),
    })

    // Clear the proposal
    taskStore.clearProposal()

    // DON'T set isGenerating — let the LLM stay free to chat while the task runs in background
    // The task progress is shown only in the TaskBar above the input

    // Add a brief AI message acknowledging the background task
    const taskDisplayName = getTaskDisplayName(type)
    const bgMsg: Message = {
      id: uuidv4(),
      role: "assistant",
      content: `Got it! I've started **${taskDisplayName}** in the background — you can track its progress in the task bar above. While that's running, tell me more about your idea or ask me anything else! 🚀`,
      timestamp: new Date(),
    }
    addMessage(bgMsg)

    // Dispatch custom event so WorkflowManager can handle the generation
    const event = new CustomEvent('user-confirmed-asset-generation', {
      detail: { assetType: legacyAssetType, userMessage: "", taskId, config }
    })
    window.dispatchEvent(event)
  }

  const handleTaskCancel = () => {
    const state = useTaskStore.getState()
    const proposal = state.pendingProposal

    if (proposal) {
      const taskName = getTaskDisplayName(proposal.type)
      const cancelMsg: Message = {
        id: uuidv4(),
        role: "assistant",
        content: `Task creation **${taskName}** cancelled by user. Please provide further details or changes needed.`,
        timestamp: new Date()
      }
      addMessage(cancelMsg)
    }

    state.clearProposal()
  }

  // Get the pending proposal from task store
  const pendingProposal = useTaskStore((s) => s.pendingProposal)

  return (
    <VoiceChatLayout>
      <div className="flex h-full w-full items-center justify-center bg-background">
        <div className="w-full max-w-[80%] h-full flex flex-col min-h-0">
          {/* Terminal Window */}
          <div className="flex-1 flex flex-col bg-background min-h-0 dark:shadow-2xl">
            {/* Title Bar */}
            <div className="px-4 py-2 flex items-center justify-between shrink-0 bg-background relative">
              <div className="flex items-center gap-2">
              </div>
            </div>

            {/* Content Container - Chat */}
            {isChatLoading ? (
              /* Skeletal Loading State for Chat Interface */
              <div className="flex-1 overflow-x-hidden overflow-y-auto px-6 py-8 bg-background min-h-0 flex flex-col gap-10 w-full max-w-4xl mx-auto pointer-events-none">
                {/* Skeleton AI Bubble */}
                <div className="flex items-start gap-4 w-full">
                  <div className="h-10 w-10 rounded-full bg-muted/60 dark:bg-muted/40 animate-pulse shrink-0" />
                  <div className="flex flex-col gap-2 w-full max-w-[80%]">
                    <div className="h-4 w-24 bg-muted/60 dark:bg-muted/40 rounded animate-pulse" />
                    <div className="h-24 w-full bg-muted/60 dark:bg-muted/40 rounded-xl animate-pulse" />
                  </div>
                </div>
                {/* Skeleton User Bubble */}
                <div className="flex items-start gap-4 justify-end w-full">
                  <div className="flex flex-col items-end gap-2 w-full max-w-[80%]">
                    <div className="h-4 w-16 bg-muted/60 dark:bg-muted/40 rounded animate-pulse" />
                    <div className="h-16 w-80 bg-muted/60 dark:bg-muted/40 rounded-xl animate-pulse" />
                  </div>
                  <div className="h-10 w-10 rounded-full bg-muted/60 dark:bg-muted/40 animate-pulse shrink-0" />
                </div>
                {/* Skeleton AI Bubble 2 */}
                <div className="flex items-start gap-4 w-full">
                  <div className="h-10 w-10 rounded-full bg-muted/60 dark:bg-muted/40 animate-pulse shrink-0" />
                  <div className="flex flex-col gap-2 w-full max-w-[80%]">
                    <div className="h-4 w-28 bg-muted/60 dark:bg-muted/40 rounded animate-pulse" />
                    <div className="h-32 w-full max-w-2xl bg-muted/60 dark:bg-muted/40 rounded-xl animate-pulse" />
                  </div>
                </div>
              </div>
            ) : messages.length === 0 ? (
              /* Empty state - logo with input below, positioned higher */
              <div className="flex-1 flex flex-col items-center pt-[25vh] px-6 bg-background min-h-0 overflow-x-hidden w-full max-w-full">
                <div className="w-full max-w-4xl flex flex-col items-center gap-6">
                  {/* Logo + Text (horizontal) */}
                  <div className="flex items-center gap-3">
                    <img
                      src={theme === "dark" ? appIconDark : appIconLight}
                      alt="KOYE"
                      className="h-12 w-12 rounded-full"
                    />
                    <div className="relative h-10 w-32 flex items-center">
                      <AnimatePresence mode="wait">
                        {showKoyeText ? (
                          <motion.h1
                            key="koye"
                            initial={{ opacity: 0, filter: "blur(4px)", scale: 0.95 }}
                            animate={{ opacity: 1, filter: "blur(0px)", scale: 1 }}
                            exit={{ opacity: 0, filter: "blur(4px)", scale: 1.05 }}
                            transition={{ duration: 0.5 }}
                            className="absolute text-4xl font-bold tracking-tight text-foreground italic"
                          >
                            KOYE
                          </motion.h1>
                        ) : (
                          <motion.h1
                            key="kanji"
                            initial={{ opacity: 0, filter: "blur(4px)", scale: 0.95 }}
                            animate={{ opacity: 1, filter: "blur(0px)", scale: 1 }}
                            exit={{ opacity: 0, filter: "blur(4px)", scale: 1.05 }}
                            transition={{ duration: 0.5 }}
                            className="absolute text-4xl font-bold tracking-tight text-foreground italic"
                          >
                            ズのﾘ乇
                          </motion.h1>
                        )}
                      </AnimatePresence>
                    </div>
                  </div>

                  <p className="text-sm text-center text-muted-foreground max-w-2xl px-4 font-medium -mt-4">
                    From ideas → asset design images → 3D asset generation → auto-rigging → animations → to a full 3D demo game right in the web, or export it to any other engine.
                  </p>

                  {/* Connect/Create Project Buttons */}
                  {!currentProject && (
                    <div className="flex gap-3">
                      <button
                        onClick={() => setShowConnectDialog(true)}
                        className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground px-4 py-2 rounded-lg border border-black/40 dark:border-border/50 hover:border-black/60 dark:hover:border-border hover:bg-muted/30 transition-all"
                      >
                        <Folder className="h-4 w-4" />
                        Connect Project
                      </button>
                      <button
                        onClick={() => setShowCreateProjectDialog(true)}
                        className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground px-4 py-2 rounded-lg border border-black/40 dark:border-border/50 hover:border-black/60 dark:hover:border-border hover:bg-muted/30 transition-all"
                      >
                        <Link2 className="h-4 w-4" />
                        Create Project
                      </button>
                    </div>
                  )}

                  {/* Input - close to logo */}
                  <div className="w-full">
                    <ChatInput
                      onSend={handleSend}
                      onStop={handleStop}
                      disabled={isGenerating}
                      isGenerating={isGenerating}
                    />
                  </div>
                </div>
              </div>
            ) : (
              /* Messages state - normal layout */
              <>
                {/* Messages Container */}
                <div className="flex-1 overflow-x-hidden overflow-y-auto scrollbar-thin px-6 py-8 bg-background min-h-0 w-full max-w-full">
                  <div className="space-y-6 max-w-4xl mx-auto w-full">
                    {Array.isArray(messages) && messages.map((message) => {
                      const needsProjectConnection = message.role === "assistant" && message.content.includes('[CONNECT_PROJECT_REQUIRED]')

                      if (message.role === "assistant") {
                        return (
                          <ResponseMessage
                            key={message.id}
                            content={message.content}
                            images={message.images}
                            generatedImages={message.generatedImages}
                            sampleImages={message.sampleImages}
                            videos={message.videos}
                            model3dUrl={message.model3dUrl}
                            isGeneratingImage={message.isGeneratingImage}
                            webSearchResults={message.webSearchResults}
                            isWebSearching={message.isWebSearching}
                            showConnectPrompt={needsProjectConnection && !currentProject}
                            onConnectProject={() => setShowConnectDialog(true)}
                            onCreateProject={() => setShowCreateProjectDialog(true)}
                          />
                        )
                      } else {
                        return (
                          <MessageBubble
                            key={message.id}
                            role={message.role}
                            content={message.content}
                            images={message.images}
                          />
                        )
                      }
                    })}

                    {/* Model switching indicator */}
                    {isGenerating && isSwitchingModel && (
                      <ResponseMessage
                        content=""
                        thinking={switchingMessage || "Switching models..."}
                        isThinking={true}
                        isSwitching={true}
                      />
                    )}

                    {/* Thinking state */}
                    {isGenerating && isThinking && !isSwitchingModel && (
                      <ResponseMessage
                        content=""
                        thinking={thinkingText}
                        isThinking={true}
                      />
                    )}

                    {/* Streaming message */}
                    {isGenerating && streamingMessageId && streamingContent && !isThinking && !isSwitchingModel && (
                      <ResponseMessage
                        key={streamingMessageId}
                        content={streamingContent}
                        isStreaming={true}
                      />
                    )}

                    {/* Fallback thinking state */}
                    {isGenerating && !streamingMessageId && !isThinking && !streamingContent && !isSwitchingModel && !generatingText && !isImageGenerating && (
                      <MessageBubble
                        role="assistant"
                        content=""
                        isThinking={true}
                      />
                    )}

                    {/* Asset generation loading indicator */}
                    {generatingText && (
                      <ResponseMessage
                        content=""
                        thinking={generatingText}
                        isThinking={true}
                      />
                    )}

                    {/* Task Proposal Card */}
                    {pendingProposal && (
                      <div className="py-4">
                        <TaskProposalCard
                          type={pendingProposal.type}
                          config={pendingProposal.config}
                          onApprove={handleTaskApproval}
                          onCancel={handleTaskCancel}
                        />
                      </div>
                    )}
                  </div>

                  <div ref={messagesEndRef} />
                </div>

                {/* Input Container - at bottom when messages exist */}
                <div className="shrink-0 bg-background px-6 py-4 max-w-4xl mx-auto w-full">
                  <ChatInput
                    onSend={handleSend}
                    onStop={handleStop}
                    disabled={isGenerating}
                    isGenerating={isGenerating}
                  />
                </div>
              </>
            )}
          </div>
        </div>
      </div>
      {/* Connect Project Dialog */}
      {showConnectDialog && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-background border-2 border-border w-full max-w-md p-6 shadow-2xl font-mono">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-bold text-foreground font-mono">Connect Project</h3>
              <button
                onClick={() => setShowConnectDialog(false)}
                className="p-2 hover:bg-muted rounded"
              >
                <X className="h-5 w-5 text-foreground" />
              </button>
            </div>

            <div className="mb-4">
              <p className="text-sm text-muted-foreground font-mono mb-2">
                Select a project to connect to this chat session. All generated files will be saved to this project.
              </p>
            </div>

            <div className="space-y-2 max-h-60 overflow-y-auto border border-border p-2 mb-4">
              {isLoadingProjects ? (
                <div className="text-center py-4 text-muted-foreground font-mono text-sm">
                  Loading projects...
                </div>
              ) : projects.length === 0 ? (
                <div className="text-center py-4 text-muted-foreground font-mono text-sm">
                  No projects found.
                </div>
              ) : (
                projects.map((project) => (
                  <button
                    key={project.id}
                    onClick={() => handleConnectProject(project)}
                    className={`w-full text-left px-3 py-2 hover:bg-muted flex items-center gap-2 font-mono text-sm transition-colors text-foreground ${currentProject?.id === project.id ? 'bg-muted font-bold' : ''}`}
                  >
                    <Folder className="h-4 w-4 text-muted-foreground" />
                    <span className="truncate">{project.name}</span>
                    {currentProject?.id === project.id && <span className="ml-auto text-xs text-muted-foreground">(Connected)</span>}
                  </button>
                ))
              )}
            </div>

            <div className="flex justify-end">
              <Button
                onClick={() => setShowConnectDialog(false)}
                variant="outline"
                className="border-2 border-foreground bg-background text-foreground hover:bg-muted font-mono text-xs font-bold shadow-[2px_2px_0px_0px_currentColor] hover:shadow-[1px_1px_0px_0px_currentColor]"
              >
                Cancel
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Create Project Dialog */}
      {showCreateProjectDialog && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-background border-2 border-border w-full max-w-md p-6 shadow-2xl font-mono">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-bold text-foreground font-mono">Create Project</h3>
              <button
                onClick={() => {
                  setShowCreateProjectDialog(false)
                  setNewProjectName("")
                  setNewProjectDescription("")
                }}
                className="p-2 hover:bg-muted rounded"
              >
                <X className="h-5 w-5 text-foreground" />
              </button>
            </div>

            {/* GitHub Connection Check */}
            {(!githubConnection || !githubConnection.accessToken) && (
              <div className="mb-4 p-4 bg-yellow-50 border-2 border-yellow-600 rounded">
                <div className="flex flex-col gap-3">
                  <p className="text-yellow-800 text-sm font-mono font-bold">
                    GitHub Connection Required
                  </p>
                  <p className="text-yellow-700 text-xs font-mono">
                    You need to connect your GitHub account to create projects.
                  </p>
                  <Button
                    onClick={() => {
                      setShowCreateProjectDialog(false)
                      handleConnectGitHub()
                    }}
                    className="bg-yellow-600 text-white hover:bg-yellow-700 border-2 border-yellow-600 font-mono text-xs font-bold shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:shadow-[1px_1px_0px_0px_rgba(0,0,0,1)]"
                  >
                    Connect GitHub
                  </Button>
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
                  className="w-full border-2 border-border px-3 py-2 bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-foreground font-mono"
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && newProjectName.trim()) {
                      handleCreateProject()
                    } else if (e.key === 'Escape') {
                      setShowCreateProjectDialog(false)
                    }
                  }}
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
                  className="w-full border-2 border-border px-3 py-2 bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-foreground font-mono resize-none"
                />
              </div>
              <div className="flex gap-2">
                <Button
                  onClick={handleCreateProject}
                  disabled={!newProjectName.trim() || !githubConnection || !githubConnection.accessToken || isCreatingProject}
                  className="flex-1 bg-foreground text-background hover:bg-muted-foreground border-2 border-foreground font-mono text-xs font-bold shadow-[2px_2px_0px_0px_currentColor] hover:shadow-[1px_1px_0px_0px_currentColor] disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isCreatingProject ? "Creating..." : "Create & Connect"}
                </Button>
                <Button
                  onClick={() => {
                    setShowCreateProjectDialog(false)
                    setNewProjectName("")
                    setNewProjectDescription("")
                  }}
                  variant="outline"
                  className="flex-1 border-2 border-border bg-background text-foreground hover:bg-muted font-mono text-xs font-bold shadow-[2px_2px_0px_0px_currentColor] hover:shadow-[1px_1px_0px_0px_currentColor]"
                >
                  Cancel
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* GitHub Connection Prompt Modal */}
      {showGitHubPrompt && (
        <GitHubConnectionPrompt
          onClose={() => setShowGitHubPrompt(false)}
          onConnected={() => {
            setShowGitHubPrompt(false)
            setShowCreateProjectDialog(true)
          }}
        />
      )}

      <GameDevFlowUI />
    </VoiceChatLayout>
  )
}
