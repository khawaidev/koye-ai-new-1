import { useCallback, useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"
import { useAuth } from "../../hooks/useAuth"
import { saveImageToStorage } from "../../lib/imageStorage"
import { uuidv4 } from "../../lib/uuid"
import { createAssetFromUrl } from "../../services/assetService"
import { generateImagePrompt } from "../../services/gemini"
import { checkJobStatus, generate3DModel } from "../../services/hitem3d"
import { generate3DViews, generateSampleImages, generateSprites, type ImageModel } from "../../services/imageGenerationHelpers"
import { saveModel, saveVideo } from "../../services/multiDbDataService"
import { saveSingleProjectFile } from "../../services/projectFiles"
import { generateVideoWithRunway } from "../../services/runwayml"
import type { Image, ImageView, Message, ModelStatus } from "../../store/useAppStore"
import { useAppStore } from "../../store/useAppStore"
import { useGameDevStore } from "../../store/useGameDevStore"
import { useTaskStore, getTaskDisplayName } from "../../store/useTaskStore"
import { Builder } from "../../pages/Builder"
import { AudioGeneration } from "../audio-generation/AudioGeneration"
import { ChatInterface } from "../chat/ChatInterface"
import { MediaGeneration } from "../media-generation/MediaGeneration"
import { ImageViewer } from "../image-viewer/ImageViewer"
import { Model3DGeneration } from "../model-generation/Model3DGeneration"
import { ModelViewer } from "../model-viewer/ModelViewer"
import { LeftSidebar } from "../sidebar/LeftSidebar"
import { SpritesPlayer } from "../sprites/SpritesPlayer"
import { Button } from "../ui/button"
import { SignUpPopup } from "../ui/SignUpPopup"
import { useToast } from "../ui/toast"
import { VideoGenerationLoader } from "../ui/VideoGenerationLoader"

import { Dashboard } from "../../pages/Dashboard"
import { AnimationsLibrary } from "../../pages/AnimationsLibrary"
import { TasksPage } from "../tasks/TasksPage"
import { WorkflowStepIndicator, type WorkflowStage as IndicatorStage } from "./WorkflowStepIndicator"

type WorkflowStage = "chat" | "images" | "model" | "texture" | "rig" | "animate" | "audio" | "export" | "build" | "imageGeneration" | "videoGeneration" | "mediaGeneration" | "audioGeneration" | "model3DGeneration" | "sprites" | "dashboard" | "animations" | "tasks"
type GameType = "3d" | "2d" | null
type AssetType = "static" | "animated" | null

export function WorkflowManager() {
  const navigate = useNavigate()
  const { isAuthenticated, user } = useAuth()
  // const { subscription, loading: pricingLoading } = usePricing() // unused
  const {
    currentAsset,
    images,
    currentModel,
    messages,
    setImages,
    setCurrentModel,
    addJob,
    updateJob,
    setIsGenerating,
    setGeneratingText,
    setMessages,
    setCurrentUserId,
    currentProject,
    // generatedFiles, // unused
    addGeneratedFile,
    githubConnection,
    stage,
    setStage,
    isSidebarOpen,
    setIsSidebarOpen,
  } = useAppStore()
  // const isGenerating = useAppStore((state) => state.isGenerating) // unused
  const { addToast } = useToast()

  const {
    isActive: isGameDevActive,
    currentStep: gameDevStep,
    gameType: gameDevType
  } = useGameDevStore()

  // Listen for model fallback errors
  useEffect(() => {
    const handleFallbackError = (event: CustomEvent) => {
      const { model, error } = event.detail
      addToast({
        title: "Model Fallback",
        description: `Model ${model} failed, falling back to koye-2dv1. Error: ${error}`,
        variant: "warning",
      })
    }

    window.addEventListener('model-fallback-error', handleFallbackError as EventListener)
    return () => window.removeEventListener('model-fallback-error', handleFallbackError as EventListener)
  }, [addToast])

  const [completedStages, setCompletedStages] = useState<Set<WorkflowStage>>(new Set())
  const [approvedViews, setApprovedViews] = useState<Set<ImageView>>(new Set())
  const [imagePrompt, setImagePrompt] = useState<string>("")
  const [showPromptEditor, setShowPromptEditor] = useState(false)
  const [showSignUpPopup, setShowSignUpPopup] = useState(false)
  const [isGeneratingImages, setIsGeneratingImages] = useState(false) // Separate flag for image generation
  const [isGeneratingVideo, setIsGeneratingVideo] = useState(false) // Separate flag for video generation

  // New flow state
  const [gameType, setGameType] = useState<GameType>(null)
  const [assetType, setAssetType] = useState<AssetType>(null)
  const [imageCount, setImageCount] = useState<number | null>(null) // For 3D: 1-4, null means not yet determined
  const [selectedModel] = useState<ImageModel | null>(null)
  const [selectedSampleImage, setSelectedSampleImage] = useState<number | null>(null)
  const [spriteCount, setSpriteCount] = useState<number | null>(null)
  const [animationDescription, setAnimationDescription] = useState<string>("")
  const [generatedSprites, setGeneratedSprites] = useState<Array<{ id: number; url: string; prompt: string }>>([])

  // Reset store when user changes (login/logout)
  useEffect(() => {
    setCurrentUserId(user?.id || null)
  }, [user?.id, setCurrentUserId])

  // Determine which model to use based on user plan
  // UPDATE: Now using Meshy (koye-2dv3) for ALL users with optimized prompt structure
  const determineModel = useCallback(async (): Promise<ImageModel> => {
    try {
      // If a specific model was already selected by user, use that
      if (selectedModel) {
        return selectedModel
      }

      // Default to koye-2dv3 (Meshy) for all users
      // Using optimized prompt structure for full-body, A-pose, game-ready characters
      return "koye-2dv3"
    } catch (error) {
      console.error("Error determining model, defaulting to koye-2dv3:", error)
      return "koye-2dv3"
    }
  }, [selectedModel])

  // Extract image count from user message (for 3D games)
  const extractImageCount = useCallback((content: string): number | null => {
    const lowerContent = content.toLowerCase()
    // Check for single image indicators
    if (
      lowerContent.includes("single image") ||
      lowerContent.includes("single front") ||
      lowerContent.includes("one image") ||
      lowerContent.includes("1 image") ||
      lowerContent.includes("front facing") ||
      lowerContent.includes("front-facing") ||
      lowerContent.includes("just front") ||
      lowerContent.includes("only front")
    ) {
      return 1
    }
    // Check for four images indicators
    if (
      lowerContent.includes("four images") ||
      lowerContent.includes("4 images") ||
      lowerContent.includes("all angles") ||
      lowerContent.includes("four views") ||
      lowerContent.includes("4 views") ||
      lowerContent.includes("all four") ||
      (lowerContent.includes("front") && lowerContent.includes("left") && lowerContent.includes("right") && lowerContent.includes("back"))
    ) {
      return 4
    }

    const match = content.match(/\b([1-4])\s*(image|view)/i)
    if (match) {
      const num = parseInt(match[1], 10)
      if (num >= 1 && num <= 4) {
        return num
      }
    }
    return null
  }, [])



  const persistGeneratedImages = useCallback(async (imagesToPersist: Image[]) => {
    const validImages = imagesToPersist.filter((img) => img.url && img.url !== "error")
    if (validImages.length === 0) {
      return
    }

    if (isAuthenticated && user) {
      try {
        // Try to save images using assetService first, with fallback to legacy saveImage
        const savedAssets = await Promise.all(
          validImages.map(async (img) => {
            try {
              // First, try the new assetService (handles storage bucket + metadata)
              const assetMetadata = await createAssetFromUrl(
                user.id,
                currentProject?.id || null,
                "image",
                `${img.view}_${img.id}.png`,
                img.url
              )

              return {
                original: img,
                saved: assetMetadata,
                usedLegacy: false
              }
            } catch (assetError) {
              console.warn(`AssetService failed for image ${img.id}, trying legacy saveImage:`, assetError)

              // Fallback: Use legacy saveImage from multiDbDataService
              // This saves to the 'images' table which should have proper RLS policies
              try {
                const { saveImage: legacySaveImage } = await import("../../services/multiDbDataService")
                const savedImage = await legacySaveImage(
                  user.id,
                  {
                    assetId: img.assetId || "",
                    view: img.view,
                    url: img.url, // Keep the blob/remote URL as-is
                    prompt: img.prompt || ""
                  },
                  currentProject?.id
                )

                return {
                  original: img,
                  saved: {
                    id: savedImage.id,
                    url: img.url, // Keep original URL since we didn't upload to storage
                    name: `${img.view}_${img.id}.png`
                  },
                  usedLegacy: true
                }
              } catch (legacyError) {
                console.error(`All save methods failed for image ${img.id}:`, legacyError)
                return null
              }
            }
          })
        )

        const successfulAssets = savedAssets.filter(a => a !== null) as { original: Image, saved: any, usedLegacy: boolean }[]

        if (successfulAssets.length === 0) {
          console.warn("No images were saved successfully")
          // Fall through to localStorage save
          throw new Error("All image save attempts failed")
        }

        // Update messages with the new permanent URLs
        const currentMessages = useAppStore.getState().messages
        const updatedMessages = currentMessages.map((msg) => {
          if (msg.generatedImages) {
            const updatedImages = msg.generatedImages.map((img) => {
              const saved = successfulAssets.find(
                (a) => a.original.view === img.view && a.original.prompt === msg.content
              )
              return saved ? { ...img, url: saved.saved.url } : img
            })
            return { ...msg, generatedImages: updatedImages }
          }
          return msg
        })
        setMessages(updatedMessages)

        // Update images in store with permanent URLs
        const updatedImagesForStore = successfulAssets.map(({ original, saved }) => ({
          ...original,
          id: saved.id,
          url: saved.url,
          assetId: saved.id
        }))
        setImages(updatedImagesForStore)

        const legacyCount = successfulAssets.filter(a => a.usedLegacy).length
        console.log(`Saved ${successfulAssets.length} images (${legacyCount} via legacy method)`)

        // Also save to project if connected - ADD IMAGES TO GENERATED FILES FOR BUILDER SIDEBAR
        if (currentProject && user) {
          try {
            await Promise.all(
              successfulAssets.map(async ({ original, saved }) => {
                // Truncate name to max 10 chars (excluding extension)
                const rawName = saved.name.replace(/\.[^/.]+$/, '')
                const truncName = rawName.length > 10 ? rawName.substring(0, 10) : rawName
                const ext = saved.name.includes('.') ? saved.name.split('.').pop() : 'png'
                const fileName = `assets/images/${truncName}.${ext}`
                const metadataFileName = `assets/images/${truncName}.md`

                // Try to fetch the image and convert to data URL for proper display in Builder
                try {
                  const response = await fetch(saved.url)
                  if (response.ok) {
                    const blob = await response.blob()
                    const reader = new FileReader()
                    const dataUrl = await new Promise<string>((resolve) => {
                      reader.onloadend = () => resolve(reader.result as string)
                      reader.readAsDataURL(blob)
                    })

                    // Add to generatedFiles store so it appears in BuilderSidebar
                    addGeneratedFile(fileName, dataUrl)
                  } else {
                    // If fetch fails, store the URL reference
                    addGeneratedFile(fileName, saved.url)
                  }
                } catch (fetchError) {
                  // If fetch fails, store the URL reference
                  console.warn("Could not fetch image, storing URL reference:", fetchError)
                  addGeneratedFile(fileName, saved.url)
                }

                // Save metadata as .md (separate metadata file)
                const imageContent = `# Image Asset\n\n- **ID:** ${saved.id}\n- **URL:** ${saved.url}\n- **View:** ${original.view}\n- **Generated:** ${new Date().toISOString()}\n`
                await saveSingleProjectFile(
                  currentProject.id,
                  user.id,
                  currentProject.name,
                  metadataFileName,
                  imageContent,
                  githubConnection
                )

                // Save the actual image (URL or data URL) — this is what the Builder viewer loads
                const imageFileContent = (useAppStore.getState().generatedFiles || {})[fileName] || saved.url
                await saveSingleProjectFile(
                  currentProject.id,
                  user.id,
                  currentProject.name,
                  fileName,
                  imageFileContent,
                  githubConnection
                )
              })
            )
            console.log(`✅ Saved ${successfulAssets.length} images to project: ${currentProject.name}`)
          } catch (projectError) {
            console.error("Error saving images to project:", projectError)
          }
        }

        return
      } catch (error) {
        console.error("Error saving images to database:", error)
        // Fall through to localStorage save
      }
    }

    // For non-authenticated users or if database save failed, save to localStorage (blob URLs will be lost on reload)
    validImages.forEach((img) => {
      try {
        saveImageToStorage({
          url: img.url,
          prompt: img.prompt,
          method: "workflow_auto",
          view: img.view,
        }, user?.id || null)
      } catch (storageError) {
        console.error("Failed to persist image to localStorage:", storageError)
      }
    })
  }, [isAuthenticated, user, currentAsset?.id, setMessages, currentProject, githubConnection, addGeneratedFile, setImages])

  // Handle 3D game image generation
  const handleGenerate3DImages = useCallback(async (
    prompt: string,
    count: number,
    model: ImageModel,
    assistantMessageId: string
  ) => {
    try {
      setIsGenerating(true)
      setIsGeneratingImages(true) // Set image generation flag

      // Create placeholder images
      const placeholderImages = Array.from({ length: count }, (_, i) => {
        const views = ["front", "back", "left", "right"]
        return {
          view: views[i] as ImageView,
          url: "",
        }
      })

      // Update message with placeholders
      const lastMessage = messages.find((msg) => msg.id === assistantMessageId)
      if (lastMessage) {
        const updatedMessage: Message = {
          ...lastMessage,
          generatedImages: placeholderImages,
        }
        const updatedMessages = messages.map((msg) =>
          msg.id === assistantMessageId ? updatedMessage : msg
        )
        setMessages(updatedMessages)
      }

      // Generate images
      const abortController = new AbortController();
      (window as any).__generationAbortController = abortController
      const imageUrls = await generate3DViews(prompt, count, model, abortController.signal)

      if (!useAppStore.getState().isGenerating) {
        throw new Error("Cancelled by user")
      }

      // Create image objects with IDs
      const newImages: Image[] = Object.entries(imageUrls).map(([view, url]) => ({
        id: uuidv4(),
        assetId: currentAsset?.id || "",
        view: view as ImageView,
        url,
        prompt,
        createdAt: new Date().toISOString(),
      }))

      // Upload images to storage if authenticated, then update URLs
      // Note: We now rely on persistGeneratedImages to handle storage and updating URLs
      let finalImageUrls = imageUrls
      // Old upload logic removed to avoid double-upload and errors

      // Update message with final images (using storage URLs if uploaded)
      const finalImages = Object.entries(finalImageUrls).map(([view, url]) => ({
        view: view as ImageView,
        url,
      }))

      // Get fresh messages from state to avoid stale closure issue
      const currentMessages = useAppStore.getState().messages
      const finalMessage = currentMessages.find((msg) => msg.id === assistantMessageId)
      if (finalMessage) {
        const updatedMessage: Message = {
          ...finalMessage,
          generatedImages: finalImages,
          isGeneratingImage: false,
        }
        const updatedMessages = currentMessages.map((msg) =>
          msg.id === assistantMessageId ? updatedMessage : msg
        )
        setMessages(updatedMessages)
      }

      // Save to images store (with storage URLs if uploaded)
      setImages(newImages)
      await persistGeneratedImages(newImages)

      setCompletedStages((prev) => new Set([...prev, "chat"]))
    } catch (error) {
      console.error("Error generating 3D images:", error)
      // Clear the isGeneratingImage flag and show error on the message
      const currentMessages = useAppStore.getState().messages
      const errorMsg = currentMessages.find((msg) => msg.id === assistantMessageId)
      if (errorMsg) {
        const updatedMessage: Message = {
          ...errorMsg,
          isGeneratingImage: false,
          content: errorMsg.content || `❌ Image generation failed: ${error instanceof Error ? error.message : "Unknown error"}. Please try again.`,
        }
        const updatedMessages = currentMessages.map((msg) =>
          msg.id === assistantMessageId ? updatedMessage : msg
        )
        setMessages(updatedMessages)
      }
    } finally {
      setIsGenerating(false)
      setIsGeneratingImages(false) // Clear image generation flag
    }
  }, [currentAsset?.id, setImages, setMessages, persistGeneratedImages])

  // Handle 2D sample image generation
  const handleGenerate2DSamples = useCallback(async (
    prompt: string,
    model: ImageModel,
    assistantMessageId: string
  ) => {
    try {
      setIsGenerating(true)
      setIsGeneratingImages(true) // Set image generation flag

      // Generate 2-5 sample images (random between 2-5)
      const sampleCount = Math.floor(Math.random() * 4) + 2 // 2-5
      const samples = await generateSampleImages(prompt, sampleCount, model)

      if (!useAppStore.getState().isGenerating) {
        throw new Error("Cancelled by user")
      }

      // Get fresh messages from state to avoid stale closure issue
      const currentMessages = useAppStore.getState().messages
      const lastMessage = currentMessages.find((msg) => msg.id === assistantMessageId)
      if (lastMessage) {
        const updatedMessage: Message = {
          ...lastMessage,
          sampleImages: samples,
          isGeneratingImage: false,
        }
        const updatedMessages = currentMessages.map((msg) =>
          msg.id === assistantMessageId ? updatedMessage : msg
        )
        setMessages(updatedMessages)
      }
    } catch (error) {
      console.error("Error generating 2D samples:", error)
      // Clear the isGeneratingImage flag and show error on the message
      const currentMessages = useAppStore.getState().messages
      const errorMsg = currentMessages.find((msg) => msg.id === assistantMessageId)
      if (errorMsg) {
        const updatedMessage: Message = {
          ...errorMsg,
          isGeneratingImage: false,
          content: errorMsg.content || `❌ Image generation failed: ${error instanceof Error ? error.message : "Unknown error"}. Please try again.`,
        }
        const updatedMessages = currentMessages.map((msg) =>
          msg.id === assistantMessageId ? updatedMessage : msg
        )
        setMessages(updatedMessages)
      }
    } finally {
      setIsGenerating(false)
      setIsGeneratingImages(false) // Clear image generation flag
    }
  }, [setMessages])

  // Handle sprite generation - defined early to avoid initialization issues
  const handleGenerateSprites = useCallback(async (
    count: number,
    animDesc: string
  ) => {
    try {
      setIsGenerating(true)
      setIsGeneratingImages(true) // Set image generation flag

      // Get the selected sample image prompt
      const currentMessages = messages
      const lastMessageWithSamples = currentMessages
        .slice()
        .reverse()
        .find(msg => msg.sampleImages && msg.sampleImages.length > 0)

      if (!lastMessageWithSamples || !selectedSampleImage) {
        console.error("No sample image selected")
        return
      }

      const selectedSample = lastMessageWithSamples.sampleImages![selectedSampleImage - 1]
      const basePrompt = selectedSample.prompt

      // Determine model
      const model = await determineModel()

      // Generate sprites
      const sprites = await generateSprites(basePrompt, animDesc, count, model)

      if (!useAppStore.getState().isGenerating) {
        throw new Error("Cancelled by user")
      }

      // Save sprites to state
      setGeneratedSprites(sprites)

      // Navigate to sprites page
      setStage("sprites")

    } catch (error) {
      console.error("Error generating sprites:", error)
    } finally {
      setIsGenerating(false)
      setIsGeneratingImages(false) // Clear image generation flag
    }
  }, [messages, selectedSampleImage, determineModel])

  // Handle video generation (cutscenes)
  const handleGenerateVideo = useCallback(async (
    _imageUrls: string[],
    prompt: string,
    assistantMessageId: string,
    config?: TaskConfig
  ) => {
    try {
      setIsGenerating(true)
      setIsGeneratingVideo(true)

      // Set generating status on the specific message
      const currentMessages = useAppStore.getState().messages
      const targetMessage = currentMessages.find((msg) => msg.id === assistantMessageId)
      if (targetMessage) {
        const updatedMessage: Message = { ...targetMessage, isGeneratingVideo: true }
        setMessages(currentMessages.map(msg => msg.id === assistantMessageId ? updatedMessage : msg))
      }

      // Create video using Runway
      const videoUrl = await generateVideoWithRunway(config?.videoPrompt || prompt || "animated cutscene", {
        model: config?.aiModel || "veo3.1",
        ratio: "1280:720",
        duration: 8
      })

      if (videoUrl) {
        // Save video to database if user is authenticated
        if (isAuthenticated && user) {
          try {
            await saveVideo(user.id, {
              userId: user.id,
              url: videoUrl,
              prompt: prompt || "",
            }, currentProject?.id)
            console.log("Video saved to database")

            // Also save to project if connected
            if (currentProject) {
              try {
                const rawName = prompt ? prompt.replace(/[^a-zA-Z0-9]/g, '_') : `video_${Date.now()}`
                const truncName = rawName.length > 10 ? rawName.substring(0, 10) : rawName
                const fileName = `assets/videos/${truncName}.mp4`
                const metadataFileName = `assets/videos/${truncName}.md`

                const videoContent = `# Video\n\n- **URL:** ${videoUrl}\n- **Prompt:** ${prompt || ''}\n- **Generated:** ${new Date().toISOString()}\n`

                // Add to Builder sidebar
                addGeneratedFile(fileName, videoUrl)

                // Save metadata .md to project
                await saveSingleProjectFile(
                  currentProject.id,
                  user.id,
                  currentProject.name,
                  metadataFileName,
                  videoContent,
                  githubConnection
                )
                console.log(`✅ Saved video metadata to project: ${metadataFileName}`)

                // Save video URL to project (this is what the Builder viewer loads)
                await saveSingleProjectFile(
                  currentProject.id,
                  user.id,
                  currentProject.name,
                  fileName,
                  videoUrl,
                  githubConnection
                )
                console.log(`✅ Saved video to project: ${currentProject.name}`)
              } catch (projectError) {
                console.error("Error saving video to project:", projectError)
              }
            }
          } catch (error) {
            console.error("Error saving video to database:", error)
          }
        }

        // Update message with video - use fresh state
        const currentMessages = useAppStore.getState().messages
        const lastMessage = currentMessages.find((msg) => msg.id === assistantMessageId)
        if (lastMessage) {
          const updatedMessage: Message = {
            ...lastMessage,
            isGeneratingVideo: false,
            videos: [videoUrl],
          }
          const updatedMessages = currentMessages.map((msg) =>
            msg.id === assistantMessageId ? updatedMessage : msg
          )
          setMessages(updatedMessages)
        }
      } else {
        throw new Error("No video output in prediction result")
      }
    } catch (error) {
      console.error("Error generating video:", error)
      // Update message with error - use fresh state
      const currentMessages = useAppStore.getState().messages
      const lastMessage = currentMessages.find((msg) => msg.id === assistantMessageId)
      if (lastMessage) {
        const updatedMessage: Message = {
          ...lastMessage,
          isGeneratingVideo: false,
          generationError: error instanceof Error ? error.message : "Unknown error",
        }
        const updatedMessages = currentMessages.map((msg) =>
          msg.id === assistantMessageId ? updatedMessage : msg
        )
        setMessages(updatedMessages)
      }
    } finally {
      setIsGenerating(false)
      setIsGeneratingVideo(false)
    }
  }, [setMessages, isAuthenticated, user])

  // Extract detailed prompt from AI's message (looks for quoted text which is the prompt)
  const extractPromptFromAIMessage = useCallback((aiMessage: string): string | null => {
    // Pattern 1: Look for text between markdown code blocks
    const codeBlockMatch = aiMessage.match(/```(?:markdown|text|)\n([\s\S]*?)\n```/s)
    if (codeBlockMatch && codeBlockMatch[1] && codeBlockMatch[1].length > 100) {
      return codeBlockMatch[1].trim()
    }

    // Pattern 2: Look for text between quotes. The AI typically puts the prompt in quotes.
    // Use greedy matching from the first quote to the last quote in the text to avoid stopping early on internal quotes (like "wolf cut").
    const firstQuote = aiMessage.indexOf('"')
    const lastQuote = aiMessage.lastIndexOf('"')
    if (firstQuote !== -1 && lastQuote > firstQuote + 100) {
       return aiMessage.substring(firstQuote + 1, lastQuote).trim()
    }

    // Pattern 3: Look for "Here's the prompt:" or similar headers followed by text
    const promptHeaderMatch = aiMessage.match(/(?:here'?s? (?:the|your|a) prompt|prompt:)\s*[:\n]?\s*(.{100,}?)(?:\n\n(?:please confirm|do you|ready to|shall i|would you|let me know)|\Z)/is)
    if (promptHeaderMatch && promptHeaderMatch[1]) {
      return promptHeaderMatch[1].trim()
    }

    // Pattern 4: It starts right away with tags like [Subject] or uses multiple paragraphs
    if (aiMessage.includes("[Subject") || aiMessage.includes("[Pose]")) {
       let promptOnly = aiMessage
       const endMatch = aiMessage.match(/\n\n(?:please confirm|do you|ready to|shall i|would you|let me know|does this)/is)
       if (endMatch) {
          promptOnly = aiMessage.substring(0, endMatch.index)
       }
       return promptOnly.trim()
    }

    // Pattern 5: Look for the longest paragraph that's likely a prompt (over 200 chars, contains descriptive words)
    const paragraphs = aiMessage.split(/\n\n+/)
    const descriptiveParagraphs = paragraphs.filter(p =>
      p.length > 200 &&
      (p.includes('character') || p.includes('appearance') || p.includes('design') ||
        p.includes('style') || p.includes('detailed') || p.includes('wearing'))
    )
    if (descriptiveParagraphs.length > 0) {
      // Return the longest descriptive paragraph
      return descriptiveParagraphs.sort((a, b) => b.length - a.length)[0].trim()
    }

    return null
  }, [])

  // Auto-generate images and add to chat message (legacy - kept for backward compatibility)
  const handleGenerateImagesAuto = useCallback(async (userDescription: string, assistantMessageId: string, overrideCount?: number, preExtractedPrompt?: string, config?: TaskConfig) => {
    try {
      // Get all messages to search for the detailed prompt
      const currentMessages = useAppStore.getState().messages
      const generatedFiles = useAppStore.getState().generatedFiles

      let enhancedPrompt: string | null = preExtractedPrompt || null

      console.log("=== IMAGE GENERATION DEBUG ===")

      // 1. Check if user explicitly mentioned a prompt file (e.g., @prompts/character-image-prompt.txt)
      const explicitFileMatch = userDescription.match(/@(prompts\/[\w\-\.\/]+)/i)
      if (explicitFileMatch && explicitFileMatch[1]) {
        const path = explicitFileMatch[1]
        if (generatedFiles[path]) {
          enhancedPrompt = generatedFiles[path]
          console.log(`✅ Using EXPLICIT user-requested prompt file: ${path}`)
        }
      }

      // 2. If no explicit file and no pre-extracted prompt, try to use the most recently generated prompt file
      if (!enhancedPrompt) {
        const promptFilePaths = Object.keys(generatedFiles).filter(p => p.startsWith('prompts/'))
        if (promptFilePaths.length > 0) {
          // Object.keys usually preserves insertion order, so the last one is the most recent
          const mostRecentPath = promptFilePaths[promptFilePaths.length - 1]
          enhancedPrompt = generatedFiles[mostRecentPath]
          console.log(`✅ Using MOST RECENT prompt file: ${mostRecentPath}`)
        }
      }

      // 3. Fallback: Search through recent assistant messages (last 10) for the detailed prompt
      if (!enhancedPrompt) {
        const recentAssistantMessages = currentMessages
          .filter(m => m.role === "assistant")
          .slice(-10)
          .reverse() // Start from most recent

        console.log("Searching through", recentAssistantMessages.length, "recent AI messages for prompt...")

        for (const msg of recentAssistantMessages) {
          const extractedPrompt = extractPromptFromAIMessage(msg.content)
          if (extractedPrompt && extractedPrompt.length > 100) {
            console.log("✅ EXTRACTED PROMPT from AI message:")
            console.log("   First 200 chars:", extractedPrompt.substring(0, 200) + "...")
            console.log("   Prompt length:", extractedPrompt.length)
            enhancedPrompt = extractedPrompt
            break
          } else {
            console.log("❌ No valid prompt in message (length:", msg.content.length, ")")
          }
        }
      }

      // If no prompt found in AI messages, fallback to generating new one
      if (!enhancedPrompt) {
        console.log("⚠️ Could not extract prompt from AI messages, generating new one...")
        console.log("   User description:", userDescription.substring(0, 100) + "...")
        enhancedPrompt = await generateImagePrompt(userDescription)
        console.log("🔄 GENERATED NEW PROMPT:")
        console.log("   First 200 chars:", enhancedPrompt.substring(0, 200) + "...")
      }

      setImagePrompt(enhancedPrompt)

      // Determine model
      const defaultModel = await determineModel()
      const model = (config?.aiModel as ImageModel) || defaultModel
      console.log("📷 Model selected:", model)
      console.log("   (koye-2dv1=ClipDrop, koye-2dv1.5=Pixazo, koye-2dv2=Banana, koye-2dv2.5=LightX)")

      // Use gameDevType from store if available, otherwise use local gameType state
      const effectiveGameType = gameDevType || gameType
      console.log("🎮 Game type:", effectiveGameType)

      // Check if it's 3D or 2D based on gameType state or detect from context
      if (effectiveGameType === "3d" || (!effectiveGameType && userDescription.toLowerCase().includes("3d"))) {
        setGameType("3d")
        // Use overrideCount if provided, else imageCount if set, else default 4
        const count = overrideCount !== undefined ? overrideCount : (imageCount !== null ? imageCount : 4)
        console.log("🔷 Generating", count, "3D view(s) with model:", model)
        console.log("   Full prompt being sent:", enhancedPrompt)
        console.log("=== END DEBUG ===")
        await handleGenerate3DImages(enhancedPrompt, count, model, assistantMessageId)
      } else if (effectiveGameType === "2d" || (!effectiveGameType && userDescription.toLowerCase().includes("2d"))) {
        setGameType("2d")
        console.log("🔷 Generating 2D samples with model:", model)
        console.log("   Full prompt being sent:", enhancedPrompt)
        console.log("=== END DEBUG ===")
        await handleGenerate2DSamples(enhancedPrompt, model, assistantMessageId)
      } else {
        // Default to 3D flow with 4 images (legacy)
        console.log("🔷 Generating 4 3D views (default) with model:", model)
        console.log("   Full prompt being sent:", enhancedPrompt)
        console.log("=== END DEBUG ===")
        await handleGenerate3DImages(enhancedPrompt, 4, model, assistantMessageId)
      }
    } catch (error) {
      console.error("Error generating images:", error)
    }
  }, [gameType, gameDevType, imageCount, determineModel, handleGenerate3DImages, handleGenerate2DSamples, extractPromptFromAIMessage])

  // Auto-progress: Listen for messages that indicate we should generate images
  // Made stricter: requires explicit confirmation and sufficient information
  useEffect(() => {
    if (isGameDevActive) return

    const lastMessage = messages[messages.length - 1]
    const secondLastMessage = messages[messages.length - 2]

    if (
      lastMessage &&
      lastMessage.role === "assistant" &&
      stage === "chat" &&
      !lastMessage.generatedImages &&
      !lastMessage.sampleImages && // Only trigger if images haven't been generated yet
      !lastMessage.autoImageTriggerHandled
    ) {
      // If the AI is asking to connect to a project, do NOT generate assets yet
      if (lastMessage.content.includes('[CONNECT_PROJECT_REQUIRED]')) {
        return
      }

      const content = lastMessage.content.toLowerCase()

      // Detect game type from conversation
      if (!gameType) {
        if (content.includes("3d") || content.includes("three dimensional") || content.includes("3-d")) {
          setGameType("3d")
        } else if (content.includes("2d") || content.includes("two dimensional") || content.includes("2-d") || content.includes("sprite") || content.includes("pixel")) {
          setGameType("2d")
        }
      }

      // Detect asset type for 2D games
      if (gameType === "2d" && !assetType) {
        if (content.includes("static") || content.includes("icon") || content.includes("ui") || content.includes("item")) {
          setAssetType("static")
        } else if (content.includes("animated") || content.includes("animation") || content.includes("character") || content.includes("sprite")) {
          setAssetType("animated")
        }
      }

      // For 3D games: Extract image count from user's previous message
      if (gameType === "3d" && secondLastMessage && secondLastMessage.role === "user") {
        const count = extractImageCount(secondLastMessage.content)
        if (count) {
          setImageCount(count)
        }
      }

      // STRICTER: Only very explicit phrases that indicate image generation is actually starting
      // Separated triggers for single image vs multiple images
      const singleImageTriggers = [
        "generating your image now",
        "generating single image now",
        "creating your image now",
        "generating the front image now",
        "generating front view now"
      ]

      const multipleImageTriggers = [
        "generating the images now",
        "generating images now",
        "starting image generation",
        "initiating image generation",
        "proceeding with image generation",
        "generating your images",
        "creating the images",
        "generating sample images now",
        "generating image variations now",
        "creating sample images now"
      ]

      // Check for single image trigger first
      const hasSingleImageTrigger = singleImageTriggers.some(trigger => content.includes(trigger))
      const hasMultipleImageTrigger = multipleImageTriggers.some(trigger => content.includes(trigger))

      let countToUse: number | undefined = undefined

      // Set image count based on the trigger phrase in AI's response
      if (hasSingleImageTrigger && !hasMultipleImageTrigger) {
        setImageCount(1)
        countToUse = 1
      } else if (hasMultipleImageTrigger) {
        // Check if AI message contains view list to determine 4 images
        if (content.includes("front") && content.includes("left") && content.includes("right") && content.includes("back")) {
          setImageCount(4)
          countToUse = 4
        } else if (content.includes("four") || content.includes("4 images") || content.includes("4 views")) {
          setImageCount(4)
          countToUse = 4
        } else {
          // Also check user's message for image count
          const userCount = secondLastMessage?.role === "user"
            ? extractImageCount(secondLastMessage.content)
            : null
          if (userCount !== null) {
            setImageCount(userCount)
            countToUse = userCount
          }
          // If still not set, leave it as null and let handleGenerateImagesAuto use default of 4
        }
      }

      if (!hasSingleImageTrigger && !hasMultipleImageTrigger) {
        return // Exit early if no explicit trigger
      }

      // STRICTER: Check for sufficient information before generating
      const userMessages = messages
        .filter((m) => m.role === "user")
        .slice(-5) // Check last 5 messages for more context
        .map((m) => m.content)
        .join(" ")

      if (!userMessages || userMessages.trim().length < 5) {
        // Require at least 5 characters of user input
        console.log("Image generation skipped: insufficient user input")
        return
      }

      // IMPORTANT: Include the AI's detailed prompt/description from the current message
      // This ensures that when the AI refines the prompt, we use that refined version
      const fullContext = userMessages + " " + lastMessage.content

      // STRICTER: Check for character/game details
      const userContentLower = userMessages.toLowerCase()
      const hasCharacterDetails =
        userContentLower.includes("character") ||
        userContentLower.includes("protagonist") ||
        userContentLower.includes("hero") ||
        userContentLower.includes("enemy") ||
        userContentLower.includes("npc") ||
        userContentLower.includes("creature") ||
        userContentLower.includes("monster") ||
        userContentLower.includes("asset") ||
        userContentLower.includes("sprite") ||
        userContentLower.includes("model")

      // For 3D games, require more specific details
      if (gameType === "3d") {
        const hasVisualDetails =
          userContentLower.includes("appearance") ||
          userContentLower.includes("look") ||
          userContentLower.includes("design") ||
          userContentLower.includes("style") ||
          userContentLower.includes("color") ||
          userContentLower.includes("outfit") ||
          userContentLower.includes("weapon") ||
          userContentLower.includes("armor") ||
          userContentLower.includes("clothing") ||
          userContentLower.includes("hair") ||
          userContentLower.includes("face") ||
          userContentLower.includes("body") ||
          userContentLower.includes("size") ||
          userContentLower.includes("height")

        // Relaxed checks for 3D games - if explicit trigger is present, trust the user/AI intent
        if (!hasCharacterDetails && !hasVisualDetails) {
          // Just log but don't return - allow generation if explicit trigger exists
          console.log("Notice: generating 3D images with minimal details")
        }
      }

      // For 2D games, relax check if explicit trigger is present
      if (gameType === "2d" && !hasCharacterDetails) {
        console.log("Notice: generating 2D images with minimal details")
      }

      // Removed minimum message count check to allow faster testing
      // const userMessageCount = messages.filter((m) => m.role === "user").length
      // if (userMessageCount < 2) { ... }

      // All checks passed - proceed with image generation
      const updatedMessages = messages.map((msg) =>
        msg.id === lastMessage.id
          ? { ...msg, autoImageTriggerHandled: true }
          : msg
      )
      setMessages(updatedMessages)
      // Pass full context including AI's refined prompt instead of just user messages
      handleGenerateImagesAuto(fullContext, lastMessage.id, countToUse)
    }
  }, [messages, stage, gameType, assetType, extractImageCount, handleGenerateImagesAuto, setMessages])

  // Auto-progress: Listen for messages that indicate we should generate videos (cutscenes)
  useEffect(() => {
    if (isGameDevActive) return

    const lastMessage = messages[messages.length - 1]

    if (
      lastMessage &&
      lastMessage.role === "assistant" &&
      stage === "chat" &&
      !lastMessage.videos &&
      !lastMessage.autoVideoTriggerHandled
    ) {
      // If the AI is asking to connect to a project, do NOT generate assets yet
      if (lastMessage.content.includes('[CONNECT_PROJECT_REQUIRED]')) {
        return
      }

      const content = lastMessage.content.toLowerCase()

      // Detect phrases that indicate video/cutscene generation should start
      const videoGenerationTriggers = [
        "generating cutscene",
        "cutscene generation",
        "creating cutscene",
        "generating video",
        "video generation",
        "creating video",
        "proceed to generate cutscene",
        "ready to generate cutscene",
        "generating the cutscene",
        "cutscene generation initiated"
      ]

      const shouldGenerateVideo = videoGenerationTriggers.some(trigger => content.includes(trigger))

      if (shouldGenerateVideo) {
        // Collect images from recent messages (generated images or sample images)
        const imageUrls: string[] = []

        // Look for generated images in recent messages
        const recentMessages = messages.slice(-5).reverse()
        for (const msg of recentMessages) {
          if (msg.generatedImages && msg.generatedImages.length > 0) {
            // Use up to 3 images from generated images
            const images = msg.generatedImages.slice(0, 3).map(img => img.url).filter(url => url && url !== "")
            imageUrls.push(...images)
            if (imageUrls.length >= 3) break
          }
          if (msg.sampleImages && msg.sampleImages.length > 0) {
            // Use up to 3 images from sample images
            const images = msg.sampleImages.slice(0, 3).map(img => img.url).filter(url => url && url !== "")
            imageUrls.push(...images)
            if (imageUrls.length >= 3) break
          }
        }

        // If we have at least one image, generate video
        if (imageUrls.length > 0) {
          // Mark message as handled
          const updatedMessages = messages.map((msg) =>
            msg.id === lastMessage.id
              ? { ...msg, autoVideoTriggerHandled: true }
              : msg
          )
          setMessages(updatedMessages)

          // Get user's description for prompt
          const userMessages = messages
            .filter((m) => m.role === "user")
            .slice(-3)
            .map((m) => m.content)
            .join(" ")

          const videoPrompt = userMessages || "Game cutscene animation"

          // Use up to 3 images
          const imagesToUse = imageUrls.slice(0, 3)
          handleGenerateVideo(imagesToUse, videoPrompt, lastMessage.id)
        }
      }
    }
  }, [messages, stage, handleGenerateVideo, setMessages])

  // Handle user input for sample image selection and sprite count selection
  useEffect(() => {
    const lastMessage = messages[messages.length - 1]
    const secondLastMessage = messages[messages.length - 2]

    if (lastMessage && lastMessage.role === "user" && stage === "chat") {
      const content = lastMessage.content.trim()

      // Check if user is selecting a sample image (typing number 1-5)
      if (gameType === "2d" && secondLastMessage && secondLastMessage.sampleImages) {
        const num = parseInt(content, 10)
        if (!isNaN(num) && num >= 1 && num <= secondLastMessage.sampleImages.length) {
          setSelectedSampleImage(num)

          // If asset is static, we're done
          if (assetType === "static") {
            // Process complete for static assets
            return
          }

          // If animated, we need to wait for animation description
          if (assetType === "animated") {
            // The AI should ask for animation description next
            return
          }
        }
      }

      // Check if user is providing animation description
      if (gameType === "2d" && assetType === "animated" && selectedSampleImage && !animationDescription) {
        // Check if this looks like an animation description (not a number)
        const isNumber = !isNaN(parseInt(content, 10))
        if (!isNumber && content.length > 5) {
          setAnimationDescription(content)
          // The AI should show sprite count options next
        }
      }

      // Check if user is selecting sprite count (5, 11, 22, or 44)
      if (gameType === "2d" && assetType === "animated" && animationDescription && !spriteCount) {
        const num = parseInt(content, 10)
        if (num === 5 || num === 11 || num === 22 || num === 44) {
          setSpriteCount(num)
          // Trigger sprite generation
          handleGenerateSprites(num, animationDescription)
        }
      }
    }
  }, [messages, stage, gameType, assetType, selectedSampleImage, animationDescription, spriteCount, handleGenerateSprites])

  const handleGenerateModel = useCallback(async (assistantMessageId?: string, config?: TaskConfig) => {
    // When triggered from chat (assistantMessageId exists), skip the approvedViews check
    // and use whatever images are available from the store or from recent chat messages
    if (!assistantMessageId && approvedViews.size < 4) {
      return
    }

    setIsGenerating(true)
    setGeneratingText("Generating 3D model...")
    const jobId = uuidv4()

    addJob({
      id: jobId,
      type: "model_generation",
      status: "pending",
    })

    try {
      // Extract from config if available (the user explicitly selected these in the task proposal)
      let imageMap: any = {
        front: config?.sourceImage || images.find((img) => img.view === "front")?.url || "",
        left: config?.leftImage || images.find((img) => img.view === "left")?.url || "",
        right: config?.rightImage || images.find((img) => img.view === "right")?.url || "",
        back: config?.backImage || images.find((img) => img.view === "back")?.url || "",
      }

      // If triggered from chat and store images are empty, try multiple sources
      if (assistantMessageId && !imageMap.front) {
        const currentMessages = useAppStore.getState().messages
        const recentMessages = currentMessages.slice().reverse()

        // Source 1: Look for generatedImages on messages (with view labels)
        for (const msg of recentMessages) {
          if (msg.generatedImages && msg.generatedImages.length > 0) {
            for (const gi of msg.generatedImages) {
              if (gi.view === "front" && gi.url) imageMap.front = gi.url
              if (gi.view === "left" && gi.url) imageMap.left = gi.url
              if (gi.view === "right" && gi.url) imageMap.right = gi.url
              if (gi.view === "back" && gi.url) imageMap.back = gi.url
            }
            // If we found at least a front image from generatedImages, use it
            if (imageMap.front) break
            // If generatedImages exist but none matched "front", use the first one as front
            const firstWithUrl = msg.generatedImages.find(gi => gi.url && gi.url !== "")
            if (firstWithUrl) {
              imageMap.front = firstWithUrl.url
              break
            }
          }
        }

        // Source 2: Look for regular images attached to messages
        if (!imageMap.front) {
          for (const msg of recentMessages) {
            if (msg.images && msg.images.length > 0) {
              const validImages = msg.images.filter(url => url && url !== "" && !url.startsWith("blob:"))
              if (validImages.length > 0) {
                imageMap.front = validImages[0]
                if (validImages.length > 1) imageMap.left = validImages[1]
                if (validImages.length > 2) imageMap.right = validImages[2]
                if (validImages.length > 3) imageMap.back = validImages[3]
                break
              }
            }
          }
        }

        // Helper: generatedFiles values can be actual image URLs/data-URIs
        // OR metadata text like "# Image Asset\n# URL: https://...\n# View: front"
        // After a project reload from Supabase, the values are metadata text.
        // This helper extracts the actual URL from the metadata or returns the value as-is.
        const resolveImageUrl = (value: string): string | null => {
          if (!value) return null
          // If it's already a URL or data URI, return as-is
          if (value.startsWith("http://") || value.startsWith("https://") || value.startsWith("data:")) {
            return value
          }
          // Try to extract "# URL: ..." from metadata text
          const urlMatch = value.match(/^#\s*URL:\s*(.+)$/m)
          if (urlMatch && urlMatch[1]) {
            return urlMatch[1].trim()
          }
          return null
        }

        // Source 3: Look for image files in generatedFiles (project files like @images/front_xxxx.png)
        if (!imageMap.front) {
          const generatedFiles = useAppStore.getState().generatedFiles || {}
          const imageFileEntries = Object.entries(generatedFiles).filter(([path]) => {
            const lowerPath = path.toLowerCase()
            return lowerPath.endsWith(".png") || lowerPath.endsWith(".jpg") || lowerPath.endsWith(".jpeg") || lowerPath.endsWith(".webp")
          })

          if (imageFileEntries.length > 0) {
            // Try to match by view name in file path
            for (const [path, value] of imageFileEntries) {
              const resolvedUrl = resolveImageUrl(value)
              if (!resolvedUrl) continue
              const lowerPath = path.toLowerCase()
              if (lowerPath.includes("front") && !imageMap.front) imageMap.front = resolvedUrl
              else if (lowerPath.includes("left") && !imageMap.left) imageMap.left = resolvedUrl
              else if (lowerPath.includes("right") && !imageMap.right) imageMap.right = resolvedUrl
              else if (lowerPath.includes("back") && !imageMap.back) imageMap.back = resolvedUrl
            }
            // If no view matched by name, just use the first image file as front
            if (!imageMap.front && imageFileEntries.length > 0) {
              const resolvedUrl = resolveImageUrl(imageFileEntries[0][1])
              if (resolvedUrl) imageMap.front = resolvedUrl
            }
          }
        }

        // Source 4: Look for image URLs mentioned in recent message content (user @references)
        if (!imageMap.front) {
          for (const msg of recentMessages) {
            if (msg.role === "user" && msg.content.includes("@")) {
              // Extract @file references from user message
              const fileRefs = Array.from(msg.content.matchAll(/@([^\s,]+\.(png|jpg|jpeg|webp))/gi))
              if (fileRefs.length > 0) {
                const generatedFiles = useAppStore.getState().generatedFiles || {}
                for (const ref of fileRefs) {
                  const filePath = ref[1]
                  const rawValue = generatedFiles[filePath] || generatedFiles[`assets/images/${filePath}`] || generatedFiles[`images/${filePath}`]
                  if (rawValue) {
                    const resolvedUrl = resolveImageUrl(rawValue)
                    if (resolvedUrl && !imageMap.front) {
                      imageMap.front = resolvedUrl
                      break
                    }
                  }
                }
              }
            }
          }
        }

        // Source 5: Extract image file paths from ALL recent messages (AI & user)
        // and load from project files in Supabase if a project is connected
        if (!imageMap.front) {
          const currentProject = useAppStore.getState().currentProject
          if (currentProject && user) {
            // Find image file paths mentioned in messages (e.g., "images/front_e888.png")
            const imagePathPattern = /(?:(?:assets\/)?images\/[^\s,)]+\.(?:png|jpg|jpeg|webp))/gi
            const foundPaths: string[] = []
            for (const msg of recentMessages) {
              const matches = msg.content.match(imagePathPattern)
              if (matches) {
                foundPaths.push(...matches)
              }
              if (foundPaths.length > 0) break
            }

            if (foundPaths.length > 0) {
              console.log("🔍 Found image paths in messages:", foundPaths)
              try {
                // Load project files from Supabase to find the image URL
                const { loadProjectFilesFromStorage } = await import("../../services/projectFiles")
                const projectFiles = await loadProjectFilesFromStorage(
                  currentProject.id,
                  user.id,
                  useAppStore.getState().githubConnection
                )

                for (const imagePath of foundPaths) {
                  const rawValue = projectFiles[imagePath]
                  if (rawValue) {
                    const resolvedUrl = resolveImageUrl(rawValue)
                    if (resolvedUrl) {
                      imageMap.front = resolvedUrl
                      console.log("✅ Found image URL from project files:", resolvedUrl.substring(0, 60) + "...")
                      break
                    }
                  }
                }
              } catch (err) {
                console.warn("Could not load project files:", err)
              }
            }
          }
        }

        console.log("🔍 3D Model Image Map:", {
          front: imageMap.front ? imageMap.front.substring(0, 60) + "..." : "(empty)",
          left: imageMap.left ? "found" : "(empty)",
          right: imageMap.right ? "found" : "(empty)",
          back: imageMap.back ? "found" : "(empty)",
        })
      }

      // Validate we have at least a front image
      if (!imageMap.front) {
        console.error("No images found for 3D model generation")
        setIsGenerating(false)
        setGeneratingText(null)
        if (assistantMessageId) {
          const currentMessages = useAppStore.getState().messages
          const updatedMessages = currentMessages.map((msg) =>
            msg.id === assistantMessageId
              ? { ...msg, content: msg.content + "\n\n❌ No images found for 3D model generation. Please generate images first.", isGenerating3DModel: false }
              : msg
          )
          setMessages(updatedMessages)
        }
        return
      }

      // Set the generating flag on the message
      if (assistantMessageId) {
        const currentMessages = useAppStore.getState().messages
        setMessages(currentMessages.map((msg) =>
          msg.id === assistantMessageId ? { ...msg, isGenerating3DModel: true } : msg
        ))
      }

      // Determine if we have all 4 views or just a single image
      const hasAllViews = imageMap.front && imageMap.left && imageMap.right && imageMap.back
      // If text-to-3d using Tripo
      if (config?.aiModel === "v3.1" || config?.aiModel === "p1.0") {
        const { create3DModelTask, checkTaskStatus: checkTripoStatus } = await import("../../services/tripo")
        const abortController = new AbortController();
        (window as any).__generationAbortController = abortController
        
        const tripoJobId = await create3DModelTask({
          prompt: config.textPrompt || "A 3D character",
          model_version: config.aiModel,
          texture: config.includeTexture !== false,
          pbr: false
        })
        
        const pollTripoStatus = async () => {
          if (!useAppStore.getState().isGenerating) return; // user cancelled
          try {
            const status = await checkTripoStatus(tripoJobId)
            const isFinished = status.status === "success"
            
            updateJob(jobId, {
              status: isFinished ? "completed" : "processing",
              progress: status.progress,
            })
            
            if (isFinished && status.result?.model?.url) {
              const modelId = uuidv4()
              const modelUrl = status.result.model.url
              const model = {
                id: modelId,
                assetId: currentAsset?.id || "",
                url: modelUrl,
                format: "glb",
                status: "raw" as ModelStatus,
                createdAt: new Date().toISOString(),
              }
              setCurrentModel(model)
              // save logic here (skipped to keep chunk small, we can just resolve it)
              const modelTaskId = (window as any).__currentModelTaskId
              if (modelTaskId) {
                useTaskStore.getState().updateTask(modelTaskId, { 
                  status: "completed", 
                  completedAt: Date.now(),
                  resultUrl: modelUrl
                })
                delete (window as any).__currentModelTaskId
              }
              setIsGenerating(false)
              setGeneratingText(null)
              
              if (assistantMessageId) {
                const msgs = useAppStore.getState().messages
                setMessages(msgs.map(m => m.id === assistantMessageId ? { ...m, isGenerating3DModel: false, model3dUrl: modelUrl } : m))
              }
            } else if (status.status === "processing" || status.status === "queued" || status.status === "running") {
              setTimeout(pollTripoStatus, 2000)
            } else { // failed
              updateJob(jobId, { status: "failed", error: "Tripo task failed" })
              setIsGenerating(false)
              setGeneratingText(null)
              if (assistantMessageId) {
                const msgs = useAppStore.getState().messages
                setMessages(msgs.map(m => m.id === assistantMessageId ? { ...m, isGenerating3DModel: false, generationError: "Tripo task failed" } : m))
              }
            }
          } catch(e) {
            updateJob(jobId, { status: "failed", error: String(e) })
            setIsGenerating(false)
          }
        }
        pollTripoStatus()
        return
      }

      // Hitem3D Logic
      let hitemJobId: string
      if (hasAllViews && (!config?.aiModel || config.aiModel === "hitem3d")) {
        // Use legacy 4-view mode
        hitemJobId = await generate3DModel(imageMap)
      } else {
        // Use single-image mode — only need the front image
        console.log("📦 Using single-image mode for 3D model generation")

        // For R2 URLs, rewrite to use the Vite dev proxy to bypass CORS
        const R2_DOMAIN = "pub-d259d1d2737843cb8bcb2b1ff98fc9c6.r2.dev"
        let fetchUrl = imageMap.front
        if (fetchUrl.includes(R2_DOMAIN)) {
          // Rewrite: https://pub-xxx.r2.dev/path → /api/r2-proxy/path
          const urlObj = new URL(fetchUrl)
          fetchUrl = `/api/r2-proxy${urlObj.pathname}`
          console.log("🔄 Using Vite proxy for R2 URL:", fetchUrl)
        }

        const response = await fetch(fetchUrl)
        if (!response.ok) throw new Error(`HTTP ${response.status}`)
        const blob = await response.blob()

        const file = new File([blob], "front.png", { type: "image/png" })

        // Dynamic import to ensure module is resolved at runtime
        const { create3DModelTask: createTask } = await import("../../services/hitem3d")
        // Create AbortController for this generation so stop button can cancel
        const abortController = new AbortController();
        (window as any).__generationAbortController = abortController
        hitemJobId = await createTask({
          mode: "single",
          type: "both",
          resolution: "1024",
          format: "glb",
          images: [file],
        }, abortController.signal)
      }

      const pollStatus = async () => {
        try {
          if (!useAppStore.getState().isGenerating) {
            console.log("3D Model generation stopped by user")
            // Abort any in-flight API calls
            const controller = (window as any).__generationAbortController
            if (controller) {
              controller.abort()
              delete (window as any).__generationAbortController
            }
            updateJob(jobId, { status: "failed", error: "Cancelled by user" })
            // Also mark the task as cancelled
            const modelTaskId = (window as any).__currentModelTaskId
            if (modelTaskId) {
              useTaskStore.getState().updateTask(modelTaskId, { status: "cancelled", completedAt: Date.now() })
              delete (window as any).__currentModelTaskId
            }
            return
          }
          const status = await checkJobStatus(hitemJobId)
          updateJob(jobId, {
            status: status.status === "completed" ? "completed" : "processing",
            progress: status.progress,
            result: status.result,
          })

          if (status.status === "completed" && status.result) {
            const modelId = uuidv4()
            const model = {
              id: modelId,
              assetId: currentAsset?.id || "",
              url: status.result.modelUrl,
              format: status.result.format === "stl" ? "glb" : status.result.format, // Map stl to glb for compatibility
              status: "raw" as ModelStatus,
              createdAt: new Date().toISOString(),
            }
            setCurrentModel(model)

            // Save model to database if authenticated
            if (isAuthenticated && user) {
              try {
                await saveModel(user.id, {
                  assetId: currentAsset?.id || undefined,
                  url: status.result.modelUrl,
                  format: model.format as any,
                  status: "raw",
                } as any)
                console.log("Model saved to database")

                // Also save to project if connected
                if (currentProject) {
                  try {
                    const timestamp = Date.now()
                    const truncId = String(timestamp).slice(-7)
                    const modelFileName = `assets/models/model_${truncId}.${model.format}`
                    const metadataFileName = `assets/models/model_${truncId}.md`

                    const modelContent = `# 3D Model\n\n- **URL:** ${status.result.modelUrl}\n- **Format:** ${model.format}\n- **Generated:** ${new Date().toISOString()}\n`

                    // Add model to Builder sidebar
                    addGeneratedFile(modelFileName, status.result.modelUrl)

                    // Save metadata as .md file
                    await saveSingleProjectFile(
                      currentProject.id,
                      user.id,
                      currentProject.name,
                      metadataFileName,
                      modelContent,
                      githubConnection
                    )
                    console.log(`✅ Saved model metadata to project: ${metadataFileName}`)

                    // Save model URL to project (this is what the Builder viewer loads)
                    await saveSingleProjectFile(
                      currentProject.id,
                      user.id,
                      currentProject.name,
                      modelFileName,
                      status.result.modelUrl,
                      githubConnection
                    )
                    console.log(`✅ Saved model to project: ${currentProject.name}`)
                  } catch (projectError) {
                    console.error("Error saving model to project:", projectError)
                  }
                }
              } catch (error) {
                console.error("Error saving model to database:", error)
              }
            }

            // Set the model URL on the chat message if triggered via chat
            if (assistantMessageId) {
              const currentMessages = useAppStore.getState().messages
              const lastMessage = currentMessages.find((msg) => msg.id === assistantMessageId)
              if (lastMessage) {
                const updatedMessage: Message = {
                  ...lastMessage,
                  model3dUrl: status.result.modelUrl,
                }
                const updatedMessages = currentMessages.map((msg) =>
                  msg.id === assistantMessageId ? updatedMessage : msg
                )
                setMessages(updatedMessages)
              }
            } else {
              // Only redirect automatically if triggered manually outside chat
              setStage("model")
            }

            setCompletedStages((prev) => new Set([...prev, "images"]))
            setIsGenerating(false)
            setGeneratingText(null)

            // Mark the task as completed in the task store
            const modelTaskId = (window as any).__currentModelTaskId
            if (modelTaskId) {
              useTaskStore.getState().updateTask(modelTaskId, { 
                status: "completed", 
                completedAt: Date.now(),
                resultUrl: status.result.modelUrl
              })
              delete (window as any).__currentModelTaskId
            }
          } else if (status.status === "processing") {
            setTimeout(pollStatus, 2000)
          } else if (status.status === "failed") {
            updateJob(jobId, { status: "failed", error: status.error })
            setIsGenerating(false)
            setGeneratingText(null)

            // Mark the task as failed in the task store
            const modelTaskId = (window as any).__currentModelTaskId
            if (modelTaskId) {
              useTaskStore.getState().updateTask(modelTaskId, { status: "failed", completedAt: Date.now(), error: status.error })
              delete (window as any).__currentModelTaskId
            }

            if (assistantMessageId) {
              const currentMessages = useAppStore.getState().messages
              const lastMessage = currentMessages.find((msg) => msg.id === assistantMessageId)
              if (lastMessage) {
                const updatedMessages = currentMessages.map((msg) =>
                  msg.id === assistantMessageId ? { ...msg, content: msg.content + "\n\n❌ Failed to generate 3D model." } : msg
                )
                setMessages(updatedMessages)
              }
            }
          }
        } catch (error) {
          console.error("Error polling job status:", error)
          updateJob(jobId, { status: "failed", error: String(error) })
          setIsGenerating(false)
        }
      }

      pollStatus()
    } catch (error) {
      console.error("Error generating model:", error)
      updateJob(jobId, { status: "failed", error: String(error) })
      setIsGenerating(false)
      setGeneratingText(null)
    }
  }, [approvedViews.size, images, addJob, updateJob, setIsGenerating, setGeneratingText, setCurrentModel, currentAsset?.id, setStage, setCompletedStages, isAuthenticated, user, currentProject, githubConnection, setMessages])

  // Listen for direct user confirmation of asset generation (skipping AI response)
  useEffect(() => {
    const handleUserConfirmedGeneration = (event: CustomEvent) => {
      const { assetType, taskId, config } = event.detail as { assetType: string, taskId: string, config: TaskConfig }

      // Assistant message ID for tracking results (no placeholder shown in chat)
      const assistantMessageId = crypto.randomUUID ? crypto.randomUUID() : `gen-${Date.now()}`

      // Get the full user context for image generation
      const currentMessages = useAppStore.getState().messages
      const userMessages = currentMessages
        .filter((m) => m.role === "user")
        .slice(-5)
        .map((m) => m.content)
        .join(" ")

      // Also include the last AI message for context (often contains the prompt)
      const recentAIMessages = currentMessages
        .filter((m) => m.role === "assistant")
        .slice(-5)
        .map((m) => m.content)
        .join(" ")

      const fullContext = userMessages + " " + recentAIMessages

      // Extract only the actual image prompt from AI messages (NOT the full chat)
      const extractPromptOnly = (): string => {
        const recentAI = currentMessages
          .filter(m => m.role === "assistant")
          .slice(-10)
          .reverse()
        for (const msg of recentAI) {
          const extracted = extractPromptFromAIMessage(msg.content)
          if (extracted && extracted.length > 100) {
            return extracted
          }
        }
        // Fallback: use user messages only (not full context with AI)
        return currentMessages
          .filter(m => m.role === "user")
          .slice(-3)
          .map(m => m.content)
          .join(" ")
      }

      // Save the generated prompt to project (saves ONLY the extracted prompt, not the chat)
      const savePromptText = async (promptContent: string, type: string) => {
        if (!isAuthenticated || !user || !currentProject) return
        try {
          // Generate a filename based on the topic and time
          const topicMatch = fullContext.match(/(?:create|generate|make)\s+(?:a|an)?\s+([a-zA-Z0-9\s]+?)(?:\s+for|\s+with|\.|$)/i)
          let topic = topicMatch ? topicMatch[1].trim().replace(/\s+/g, '-').toLowerCase() : 'asset'
          if (topic.length > 20) topic = topic.substring(0, 20)

          const filename = `${topic}-${type}-prompt.txt`
          const path = `prompts/${filename}`

          await saveSingleProjectFile(currentProject.id, user.id, currentProject.name || "project", path, promptContent)

          // Show a combined confirmation in chat
          let backgroundMessage = ""
          if (taskId) {
            const task = useTaskStore.getState().tasks.find((t: any) => t.id === taskId)
            if (task) {
              const taskDisplayName = getTaskDisplayName(task.type)
              backgroundMessage = `\n\nGot it! I've started **${taskDisplayName}** in the background — you can track its progress in the task bar above. While that's running, tell me more about your idea or ask me anything else! 🚀`
            }
          }

          const sysMsg: Message = {
            id: uuidv4(),
            role: "assistant",
            content: `Saved generated prompt to \`${path}\`${backgroundMessage}`,
            timestamp: new Date()
          }
          setMessages([...useAppStore.getState().messages, sysMsg])

          // Also add to generatedFiles in store so UI knows about it
          useAppStore.getState().addGeneratedFile(path, promptContent)
        } catch (err) {
          console.error("Failed to save prompt as txt file:", err)
        }
      }

      // Helper to mark task complete/failed
      const markTaskComplete = (resultUrl?: string) => {
        if (taskId) {
          useTaskStore.getState().updateTask(taskId, { status: "completed", completedAt: Date.now(), resultUrl })
        }
      }
      const markTaskFailed = (error?: string) => {
        if (taskId) {
          useTaskStore.getState().updateTask(taskId, { status: "failed", completedAt: Date.now(), error })
        }
      }

      // Extract the actual prompt (not the full conversation)
      const actualPrompt = extractPromptOnly()

      if (assetType === "images") {
        // Don't add placeholder message or block LLM — task runs in background via TaskBar
        savePromptText(actualPrompt, "image")
        handleGenerateImagesAuto(fullContext, assistantMessageId, undefined, actualPrompt, config)
          .then(() => {
            const msg = useAppStore.getState().messages.find(m => m.id === assistantMessageId)
            let resultUrl: string | undefined
            if (msg?.generatedImages && msg.generatedImages.length > 0) {
              const urlInfo = msg.generatedImages.find(img => img.url && img.url !== "" && !img.url.startsWith("blob:"))
              if (urlInfo) resultUrl = urlInfo.url
              else resultUrl = msg.generatedImages[0].url
            } else if (msg?.sampleImages && msg.sampleImages.length > 0) {
              resultUrl = msg.sampleImages[0].url
            }
            markTaskComplete(resultUrl)
          })
          .catch((err: any) => markTaskFailed(err?.message))
      } else if (assetType === "3d-model") {
        savePromptText(actualPrompt, "3d")
        // handleGenerateModel is async but uses polling internally
        // We store taskId so we can update from the polling callback
        if (taskId) {
          // Store the taskId for this model generation job
          (window as any).__currentModelTaskId = taskId
        }
        handleGenerateModel(assistantMessageId, config)
      } else if (assetType === "audio") {
        savePromptText(actualPrompt, assetType)
        
        const audioPoll = async () => {
           try {
              if (config?.audioType === "voice") {
                const { generateSpeechToDb } = await import("../../services/ttsService")
                const resultUrl = await generateSpeechToDb(actualPrompt)
                markTaskComplete(resultUrl)
              } else {
                const { generateElevenLabsSfx } = await import("../../services/elevenLabsSfx")
                const resultUrl = await generateElevenLabsSfx(actualPrompt)
                markTaskComplete(resultUrl)
              }
           } catch(e: any) {
              markTaskFailed(e.message)
           }
        }
        audioPoll()
      } else if (assetType === "animations") {
        savePromptText(actualPrompt, assetType)
        
        // Use tripo rigging logic
        const rigPoll = async () => {
            try {
               const { createRiggingTask, checkTaskStatus } = await import("../../services/tripo")
               if (!config?.sourceImage) throw new Error("No source model provided for rigging")
               
               // Extract real model ID from sourceImage string if necessary. Assuming user chose a model from the autocomplete.
               const jobId = await createRiggingTask({
                   type: "animate_rig",
                   original_model_task_id: config.sourceImage,
                   out_format: "glb"
               })
               
               const poll = async () => {
                  const status = await checkTaskStatus(jobId)
                  if (status.status === "success") {
                      markTaskComplete(status.result?.model?.url)
                  } else if (status.status === "processing" || status.status === "queued" || status.status === "running") {
                      setTimeout(poll, 3000)
                  } else {
                      markTaskFailed("Rigging failed")
                  }
               }
               poll()
            } catch(e: any) {
               markTaskFailed(e.message)
            }
        }
        rigPoll()
      } else if (assetType === "sprites" || assetType === "video-generation") {
        savePromptText(actualPrompt, assetType)
        
        if (assetType === "video-generation") {
            handleGenerateVideo([], actualPrompt, assistantMessageId, config)
              .then(() => {
                // handleGenerateVideo doesn't return the URL directly, it saves to store. We just mark it completed.
                markTaskComplete()
              })
              .catch((err: any) => markTaskFailed(err?.message))
        } else {
            setIsGenerating(false)
            setGeneratingText(null)
            markTaskFailed("Sprites need additional context from AI")
        }
      }
    }

    // Listen for task cancellation
    const handleCancelTask = (event: CustomEvent) => {
      const { taskId } = event.detail
      console.log("Cancelling task:", taskId)
      // Abort any in-flight API calls
      const controller = (window as any).__generationAbortController
      if (controller) {
        controller.abort()
        delete (window as any).__generationAbortController
      }
      // Set isGenerating to false which will cause running poll loops to stop
      setIsGenerating(false)
      setGeneratingText(null)
    }

    window.addEventListener('user-confirmed-asset-generation', handleUserConfirmedGeneration as EventListener)
    window.addEventListener('cancel-task', handleCancelTask as EventListener)
    return () => {
      window.removeEventListener('user-confirmed-asset-generation', handleUserConfirmedGeneration as EventListener)
      window.removeEventListener('cancel-task', handleCancelTask as EventListener)
    }
  }, [handleGenerateImagesAuto, handleGenerateModel, setMessages, setIsGenerating, setGeneratingText, extractPromptFromAIMessage])

  // Auto-progress: When all 4 images are approved, return to chat so AI can continue
  useEffect(() => {
    if (stage === "images" && approvedViews.size === 4 && images.length === 4) {
      // Small delay for UX
      const timer = setTimeout(() => {
        setCompletedStages((prev) => new Set([...prev, "images"]))
        setStage("chat")
      }, 1000)
      return () => clearTimeout(timer)
    }
  }, [approvedViews, images, stage])

  // Listen for the 'view-3d-model' event fired from the chat message button
  useEffect(() => {
    const handleView3DModel = (event: CustomEvent) => {
      const modelUrl = event.detail?.modelUrl
      // Navigate to the 3D model generation page
      setStage("model3DGeneration")
      // Dispatch a follow-up event so Model3DGeneration can load the model
      if (modelUrl) {
        setTimeout(() => {
          window.dispatchEvent(new CustomEvent('load-3d-model', { detail: { modelUrl } }))
        }, 100)
      }
    }
    window.addEventListener('view-3d-model', handleView3DModel as EventListener)
    return () => window.removeEventListener('view-3d-model', handleView3DModel as EventListener)
  }, [])

  // Auto-progress: Listen for AI message to generate 3D model
  useEffect(() => {
    if (isGameDevActive) return

    const lastMessage = messages[messages.length - 1]

    if (
      lastMessage &&
      lastMessage.role === "assistant" &&
      stage === "chat" &&
      !lastMessage.model3dUrl &&
      !lastMessage.autoModelTriggerHandled
    ) {
      const content = lastMessage.content.toLowerCase()
      const triggers = [
        "generating 3d model now",
        "generating 3d model",
        "generating the 3d model",
        "creating 3d model",
        "creating the 3d model",
        "proceeding with 3d model generation",
        "proceed with the 3d model",
        "starting 3d model generation",
        "initiating 3d model generation",
        "generating your 3d model",
        "creating your 3d model"
      ]

      if (triggers.some(trigger => content.includes(trigger))) {
        // Mark message as handled
        const updatedMessages = messages.map((msg) =>
          msg.id === lastMessage.id
            ? { ...msg, autoModelTriggerHandled: true }
            : msg
        )
        setMessages(updatedMessages)

        handleGenerateModel(lastMessage.id)
      }
    }
  }, [messages, stage, handleGenerateModel, setMessages])

  // Auto-progress: When model is ready, move to texture stage
  useEffect(() => {
    if (stage === "model" && currentModel && currentModel.status === "raw") {
      setCompletedStages((prev) => new Set([...prev, "model"]))
      // Auto-advance to texture (you can add texture generation logic here)
      setTimeout(() => {
        setStage("texture")
      }, 1500)
    }
  }, [currentModel, stage])

  const handleConfirmPrompt = async () => {
    setIsGenerating(true)
    setShowPromptEditor(false)
    try {
      // Switch to images stage immediately to show loading cards
      setStage("images")
      setCompletedStages((prev) => new Set([...prev, "chat"]))

      // Create placeholder images with loading state
      const placeholderImages: Image[] = ["front", "left", "right", "back"].map((view) => ({
        id: uuidv4(),
        assetId: currentAsset?.id || "",
        view: view as ImageView,
        url: "" as string, // Empty URL indicates loading
        prompt: imagePrompt,
        createdAt: new Date().toISOString(),
      }))
      setImages(placeholderImages)

      const model = await determineModel() || "koye-2dv2.5"
      const imgAbortController = new AbortController();
      (window as any).__generationAbortController = imgAbortController
      const imageUrls = await generate3DViews(imagePrompt, 4, model, imgAbortController.signal)

      // Update images with actual URLs
      const newImages: Image[] = Object.entries(imageUrls).map(([view, url]) => {
        const existing = placeholderImages.find(img => img.view === view)
        return {
          id: existing?.id || uuidv4(),
          assetId: currentAsset?.id || "",
          view: view as ImageView,
          url: url as string,
          prompt: imagePrompt,
          createdAt: new Date().toISOString(),
        }
      })

      setImages(newImages)
      await persistGeneratedImages(newImages)
    } catch (error) {
      console.error("Error generating images:", error)
      // Show error state
      const errorImages: Image[] = ["front", "left", "right", "back"].map((view) => ({
        id: uuidv4(),
        assetId: currentAsset?.id || "",
        view: view as ImageView,
        url: "error" as string,
        prompt: imagePrompt,
        createdAt: new Date().toISOString(),
      }))
      setImages(errorImages)
    } finally {
      setIsGenerating(false)
    }
  }

  const handleApproveImage = (view: ImageView) => {
    setApprovedViews((prev) => {
      const newSet = new Set([...prev, view])
      if (newSet.size === 4) {
        setCompletedStages((prev) => new Set([...prev, "images"]))
      }
      return newSet
    })
  }

  const handleExport = async (format: "glb" | "fbx" | "obj" | "stl") => {
    if (!currentModel) return

    try {
      const response = await fetch(currentModel.url)
      const blob = await response.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `model.${format}`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)

      setCompletedStages((prev) => new Set([...prev, "export"]))
    } catch (error) {
      console.error("Error exporting model:", error)
    }
  }

  return (
    <div className="flex h-screen bg-background overflow-hidden text-foreground">
      {/* Left Sidebar - Always visible (Grok-style) */}
      <div className="shrink-0 transition-all duration-300 relative">
        <LeftSidebar isOpen={isSidebarOpen} stage={stage as any} setStage={setStage} onToggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)} />
      </div>

      {/* Main Content Area */}
      <div className="flex flex-1 flex-col min-h-0 overflow-hidden relative">
        {/* Main Content - Chat/Workflow */}
        <div className="flex-1 min-w-0 overflow-hidden flex">
          <div className="flex-1 min-w-0 overflow-hidden">
            {stage === "chat" && <ChatInterface />}

            {(stage === "imageGeneration" || stage === "videoGeneration" || stage === "mediaGeneration") && (
              <MediaGeneration />
            )}
            {stage === "audioGeneration" && (
              <AudioGeneration />
            )}

            {stage === "model3DGeneration" && <Model3DGeneration />}

            {stage === "sprites" && (
              <SpritesPlayer
                sprites={generatedSprites}
                animationName={animationDescription || "Animation"}
                onBack={() => setStage("chat")}
              />
            )}

            {stage === "dashboard" && <Dashboard />}

            {stage === "animations" && <AnimationsLibrary />}

            {stage === "tasks" && <TasksPage />}

            {stage === "images" && (
              <div className="flex h-full flex-col overflow-hidden">
                {!isAuthenticated ? (
                  <div className="flex h-full items-center justify-center">
                    <div className="text-center">
                      <p className="text-foreground font-mono text-lg mb-4">$ sign_up_for_free_to_use_this_feature</p>
                      <Button
                        onClick={() => navigate("/signup")}
                        className="bg-foreground text-background hover:bg-muted-foreground border border-foreground font-mono"
                      >
                        $ sign_up
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="flex-1 overflow-y-auto">
                    <ImageViewer
                      images={images}
                      onApprove={handleApproveImage}
                      approvedViews={approvedViews}
                    />
                  </div>
                )}
              </div>
            )}

            {stage === "model" && (
              !isAuthenticated ? (
                <div className="flex h-full items-center justify-center">
                  <div className="text-center">
                    <p className="text-foreground font-mono text-lg mb-4">$ sign_up_for_free_to_use_this_feature</p>
                    <Button
                      onClick={() => navigate("/signup")}
                      className="bg-foreground text-background hover:bg-muted-foreground border border-foreground font-mono"
                    >
                      $ sign_up
                    </Button>
                  </div>
                </div>
              ) : currentModel ? (
                <ModelViewer
                  model={currentModel}
                  onExport={handleExport}
                  onClose={() => setStage("images")}
                />
              ) : (
                <div className="flex h-full items-center justify-center">
                  <div className="text-center text-muted-foreground font-mono">
                    <p className="text-lg">No 3D model available yet...</p>
                  </div>
                </div>
              )
            )}

            {stage === "texture" && (
              !isAuthenticated ? (
                <div className="flex h-full items-center justify-center">
                  <div className="text-center">
                    <p className="text-foreground font-mono text-lg mb-4">$ sign_up_for_free_to_use_this_feature</p>
                    <Button
                      onClick={() => navigate("/signup")}
                      className="bg-foreground text-background hover:bg-muted-foreground border border-foreground font-mono"
                    >
                      $ sign_up
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="flex h-full items-center justify-center">
                  <div className="text-center text-muted-foreground font-mono">
                    <p className="text-lg">Texture generation coming soon...</p>
                  </div>
                </div>
              )
            )}

            {stage === "rig" && (
              !isAuthenticated ? (
                <div className="flex h-full items-center justify-center">
                  <div className="text-center">
                    <p className="text-foreground font-mono text-lg mb-4">$ sign_up_for_free_to_use_this_feature</p>
                    <Button
                      onClick={() => navigate("/signup")}
                      className="bg-foreground text-background hover:bg-muted-foreground border border-foreground font-mono"
                    >
                      $ sign_up
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="flex h-full items-center justify-center">
                  <div className="text-center text-muted-foreground font-mono">
                    <p className="text-lg">Rigging coming soon...</p>
                  </div>
                </div>
              )
            )}

            {stage === "animate" && (
              !isAuthenticated ? (
                <div className="flex h-full items-center justify-center">
                  <div className="text-center">
                    <p className="text-foreground font-mono text-lg mb-4">$ sign_up_for_free_to_use_this_feature</p>
                    <Button
                      onClick={() => navigate("/signup")}
                      className="bg-foreground text-background hover:bg-muted-foreground border border-foreground font-mono"
                    >
                      $ sign_up
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="flex h-full items-center justify-center">
                  <div className="text-center text-muted-foreground font-mono">
                    <p className="text-lg">Animation coming soon...</p>
                  </div>
                </div>
              )
            )}

            {stage === "export" && (
              !isAuthenticated ? (
                <div className="flex h-full items-center justify-center">
                  <div className="text-center">
                    <p className="text-foreground font-mono text-lg mb-4">$ sign_up_for_free_to_use_this_feature</p>
                    <Button
                      onClick={() => navigate("/signup")}
                      className="bg-foreground text-background hover:bg-muted-foreground border border-foreground font-mono"
                    >
                      $ sign_up
                    </Button>
                  </div>
                </div>
              ) : currentModel ? (
                <ModelViewer
                  model={currentModel}
                  onExport={handleExport}
                  onClose={() => setStage("model")}
                />
              ) : (
                <div className="flex h-full items-center justify-center">
                  <div className="text-center text-muted-foreground font-mono">
                    <p className="text-lg">No 3D model available yet...</p>
                  </div>
                </div>
              )
            )}

            {stage === "build" && (
              !isAuthenticated ? (
                <div className="flex h-full items-center justify-center">
                  <div className="text-center">
                    <p className="text-foreground font-mono text-lg mb-4">$ sign_up_for_free_to_use_this_feature</p>
                    <Button
                      onClick={() => navigate("/signup")}
                      className="bg-foreground text-background hover:bg-muted-foreground border border-foreground font-mono"
                    >
                      $ sign_up
                    </Button>
                  </div>
                </div>
              ) : currentProject ? (
                <Builder />
              ) : (
                <div className="flex h-full items-center justify-center">
                  <div className="text-center">
                    <p className="text-foreground font-mono text-lg mb-4">$ no_project_connected</p>
                    <Button
                      onClick={() => setStage("chat")}
                      className="bg-foreground text-background hover:bg-muted-foreground border border-foreground font-mono"
                    >
                      $ create_project
                    </Button>
                  </div>
                </div>
              )
            )}
          </div>

          {/* Right Sidebar - Step Indicator */}
          {stage !== "model3DGeneration" && stage !== "build" && stage !== "dashboard" && stage !== "mediaGeneration" && stage !== "audioGeneration" && stage !== "animations" && stage !== "tasks" && (
            <div className="shrink-0 w-32 mt-12 overflow-y-auto overflow-x-hidden scrollbar-thin">
              <WorkflowStepIndicator
                currentStage={stage === "imageGeneration" ? "chat" : (stage as IndicatorStage)}
                completedStages={new Set(Array.from(completedStages).filter(s => s !== "imageGeneration" && s !== "model3DGeneration" && s !== "animations") as Array<IndicatorStage>)}
                isAuthenticated={isAuthenticated}
                isGameDevActive={isGameDevActive}
                gameDevStep={gameDevStep}
                gameType={gameDevType}
                isGeneratingImages={isGeneratingImages}
                hasGeneratedImages={images.length > 0 && images.every(img => img.url && img.url !== "" && img.url !== "error")}
              />
            </div>
          )}
        </div>

        {/* Image Generation Loader - Removed as per user request */}
        {/* <ImageGenerationLoader isVisible={isGeneratingImages && stage === "chat"} /> */}

        {/* Video Generation Loader - Removed as per user request (now in-chat) */}


        {/* Sign Up Popup */}
        <SignUpPopup
          isOpen={showSignUpPopup}
          onClose={() => setShowSignUpPopup(false)}
        />

        {showPromptEditor && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
            <div className="w-full max-w-2xl bg-background border-2 border-foreground shadow-2xl">
              {/* Terminal Title Bar */}
              <div className="border-b border-border px-4 py-2 flex items-center gap-2">
                <div className="flex-1 text-center">
                  <span className="text-foreground font-mono text-sm font-bold">PROMPT EDITOR</span>
                </div>
              </div>
              <div className="p-6 space-y-4 font-mono">
                <div>
                  <label className="block text-sm mb-1 text-foreground font-mono">
                    $ image_prompt:
                  </label>
                  <textarea
                    value={imagePrompt}
                    onChange={(e) => setImagePrompt(e.target.value)}
                    className="w-full min-h-[200px] rounded-md border border-input bg-background p-4 text-foreground placeholder:text-muted-foreground focus:border-ring focus:ring-1 focus:ring-ring font-mono text-sm"
                    placeholder="Enter your image generation prompt..."
                  />
                </div>
                <div className="flex gap-2">
                  <Button
                    onClick={handleConfirmPrompt}
                    className="flex-1 bg-foreground text-background hover:bg-muted-foreground font-mono text-sm border border-foreground"
                  >
                    $ confirm_and_generate
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setShowPromptEditor(false)
                      setIsGenerating(false)
                    }}
                    className="flex-1 border-border bg-background text-foreground hover:bg-muted font-mono text-sm"
                  >
                    $ cancel
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
