import { OrbitControls, PerspectiveCamera, useGLTF } from "@react-three/drei"
import { Canvas } from "@react-three/fiber"
import { Bone, Box, ChevronLeft, ChevronRight, Download, MessageSquare, Upload } from "lucide-react"
import { Suspense, useEffect, useRef, useState } from "react"
import { useAuth } from "../../hooks/useAuth"
import { usePricing } from "../../hooks/usePricing"
import { cn } from "../../lib/utils"
import { uuidv4 } from "../../lib/uuid"
import { create3DModelTask, queryTaskStatus, type GenerationMode, type GenerationType, type ModelFormat, type ModelResolution } from "../../services/hitem3d"
import { createTextTo3DPreview, getTextTo3DTask, type RiggingTask, type TextTo3DAiModel, type TextTo3DPoseMode, type TextTo3DTask } from "../../services/meshy"
import { saveModel } from "../../services/multiDbDataService"
import { saveSingleProjectFile } from "../../services/projectFiles"
import { createRiggingTask, getRiggingTask } from "../../services/tripo"
import { useAppStore } from "../../store/useAppStore"
import { Button } from "../ui/button"
import { Select } from "../ui/select"

type SourceMode = "image" | "text"

interface GeneratedModel {
  id: string
  taskId: string
  format: ModelFormat
  url: string
  status: "pending" | "processing" | "completed" | "failed"
  progress?: number
  riggingTaskId?: string
  riggingStatus?: RiggingTask["status"]
  riggingProgress?: number
  riggedModelUrl?: string
  riggedModelBlobUrl?: string // Blob URL for CORS-restricted models
}

function GLTFModelLoader({ url }: { url: string }) {
  const { scene } = useGLTF(url)
  return <primitive object={scene} />
}

function ModelScene({ modelUrl, format }: { modelUrl: string; format: ModelFormat }) {
  // Only GLB/GLTF files can be previewed with useGLTF
  // Other formats (OBJ, STL, FBX) need different loaders which are more complex
  // For now, we'll only preview GLB files and show a message for others
  if (format !== "glb") {
    return (
      <>
        <PerspectiveCamera makeDefault position={[0, 0, 5]} />
        <ambientLight intensity={0.5} />
        <directionalLight position={[10, 10, 5]} intensity={1} />
        <OrbitControls
          enablePan={true}
          enableZoom={true}
          enableRotate={true}
          minDistance={1}
          maxDistance={20}
        />
      </>
    )
  }

  return (
    <>
      <PerspectiveCamera makeDefault position={[0, 0, 5]} />
      <ambientLight intensity={0.5} />
      <directionalLight position={[10, 10, 5]} intensity={1} />
      <Suspense fallback={null}>
        <GLTFModelLoader url={modelUrl} />
      </Suspense>
      <OrbitControls
        enablePan={true}
        enableZoom={true}
        enableRotate={true}
        minDistance={1}
        maxDistance={20}
      />
    </>
  )
}

export function Model3DGeneration() {
  const { user, isAuthenticated } = useAuth()
  const { checkLimit, incrementUsage } = usePricing()

  // Source mode (image or text)
  const [sourceMode, setSourceMode] = useState<SourceMode>("image")

  // Image-to-3D state
  const [model, setModel] = useState<"koye-3dv1">("koye-3dv1")
  const [generationMode, setGenerationMode] = useState<GenerationMode>("single")
  const [generationType, setGenerationType] = useState<GenerationType>("both")
  const [resolution, setResolution] = useState<ModelResolution>("1024")
  const [format, setFormat] = useState<ModelFormat>("glb")
  const [singleImage, setSingleImage] = useState<File | null>(null)
  const [fourImages, setFourImages] = useState<{
    front: File | null
    back: File | null
    left: File | null
    right: File | null
  }>({
    front: null,
    back: null,
    left: null,
    right: null,
  })

  // Text-to-3D state (Meshy)
  const [textPrompt, setTextPrompt] = useState("")
  const [textTo3DAiModel, setTextTo3DAiModel] = useState<TextTo3DAiModel>("latest")
  const [textTo3DPoseMode, setTextTo3DPoseMode] = useState<TextTo3DPoseMode>("")
  const [textTo3DPolygons, setTextTo3DPolygons] = useState<number>(30000)

  // Common state
  const [isGenerating, setIsGenerating] = useState(false)
  const [generatedModels, setGeneratedModels] = useState<GeneratedModel[]>([])
  const [selectedModelIndex, setSelectedModelIndex] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)
  const [isRigging, setIsRigging] = useState(false)
  const fileInputRefs = useRef<{ [key: string]: HTMLInputElement | null }>({})

  // Text-to-3D task polling
  const [textTo3DTasks, setTextTo3DTasks] = useState<Map<string, { modelId: string; status: TextTo3DTask["status"]; progress: number }>>(new Map())

  // Cache for placeholder asset ID (reuse same asset for all standalone models)
  const placeholderAssetIdRef = useRef<string | null>(null)

  // Listen for 'load-3d-model' event from chat interface to load a pre-generated model
  useEffect(() => {
    const handleLoad3DModel = (event: CustomEvent) => {
      const modelUrl = event.detail?.modelUrl
      if (!modelUrl) return

      console.log("📦 Loading pre-generated 3D model:", modelUrl)

      // Add as a completed model to the list
      const newModel: GeneratedModel = {
        id: `loaded-${Date.now()}`,
        taskId: "",
        format: "glb",
        url: modelUrl,
        status: "completed",
      }

      setGeneratedModels(prev => {
        // Avoid duplicates
        if (prev.some(m => m.url === modelUrl)) return prev
        return [newModel, ...prev]
      })
      setSelectedModelIndex(0)
    }
    window.addEventListener('load-3d-model', handleLoad3DModel as EventListener)
    return () => window.removeEventListener('load-3d-model', handleLoad3DModel as EventListener)
  }, [])

  // Poll task status
  useEffect(() => {
    const pendingTasks = generatedModels.filter(m => m.status === "pending" || m.status === "processing")
    if (pendingTasks.length === 0) return

    const pollInterval = setInterval(async () => {
      for (const model of pendingTasks) {
        try {
          const status = await queryTaskStatus(model.taskId)
          setGeneratedModels(prev => prev.map(m =>
            m.id === model.id
              ? { ...m, status: status.status, progress: status.progress, url: status.result?.modelUrl || m.url }
              : m
          ))

          if (status.status === "completed" && status.result) {
            setIsGenerating(false)
            // Save model to database
            const modelUrl = status.result.modelUrl || model.url
            const modelFormat = status.result.format || model.format
            if (isAuthenticated && user && modelUrl) {
              // Save model to database with updated info
              const updatedModel = {
                ...model,
                status: "completed" as const,
                url: modelUrl,
                format: modelFormat,
              }
              saveModelToDatabase(updatedModel, modelUrl, modelFormat)
            }
          } else if (status.status === "failed") {
            setIsGenerating(false)
            setError(status.error || "Model generation failed")
          }
        } catch (err) {
          console.error("Error polling task status:", err)
        }
      }
    }, 3000) // Poll every 3 seconds

    return () => clearInterval(pollInterval)
  }, [generatedModels])

  // Poll rigging task status
  useEffect(() => {
    const riggingTasks = generatedModels.filter(m =>
      m.riggingTaskId &&
      m.riggingStatus &&
      (m.riggingStatus === "PENDING" || m.riggingStatus === "IN_PROGRESS")
    )
    if (riggingTasks.length === 0) return

    const pollInterval = setInterval(async () => {
      for (const model of riggingTasks) {
        if (!model.riggingTaskId) continue
        try {
          const riggingTask = await getRiggingTask(model.riggingTaskId)
          const riggedUrl = riggingTask.result?.rigged_character_glb_url

          // If rigging succeeded, try to fetch the model as blob to create a blob URL (bypasses CORS for preview)
          // Note: This may fail due to CORS restrictions, in which case we'll show a message
          let blobUrl: string | undefined
          if (riggingTask.status === "SUCCEEDED" && riggedUrl) {
            try {
              // Try to fetch the model and create a blob URL for preview
              // Use no-cors mode won't work for reading the response, so we try cors first
              const response = await fetch(riggedUrl, {
                mode: 'cors',
                credentials: 'omit',
                headers: {
                  'Accept': 'application/octet-stream,model/gltf-binary,*/*'
                }
              })
              if (response.ok) {
                const blob = await response.blob()
                blobUrl = URL.createObjectURL(blob)
              } else {
                console.warn("Failed to fetch rigged model for preview:", response.status, response.statusText)
              }
            } catch (blobError) {
              // CORS error - we can't fetch it directly
              console.warn("Could not create blob URL for rigged model (CORS restriction). Preview may not work, but download will still be available.", blobError)
            }
          }

          setGeneratedModels(prev => prev.map(m =>
            m.id === model.id
              ? {
                ...m,
                riggingStatus: riggingTask.status,
                riggingProgress: riggingTask.progress,
                riggedModelUrl: riggedUrl || m.riggedModelUrl,
                riggedModelBlobUrl: blobUrl || m.riggedModelBlobUrl
              }
              : m
          ))

          if (riggingTask.status === "SUCCEEDED") {
            setIsRigging(false)
          } else if (riggingTask.status === "FAILED") {
            setIsRigging(false)
            setError(`Rigging failed: ${riggingTask.task_error?.message || "Unknown error"}`)
          }
        } catch (err) {
          console.error("Error polling rigging task status:", err)
        }
      }
    }, 3000) // Poll every 3 seconds

    return () => clearInterval(pollInterval)
  }, [generatedModels])

  // Cleanup blob URLs when component unmounts or models change
  useEffect(() => {
    return () => {
      generatedModels.forEach(model => {
        if (model.riggedModelBlobUrl) {
          URL.revokeObjectURL(model.riggedModelBlobUrl)
        }
      })
    }
  }, [])

  // Poll Text-to-3D task status (Meshy)
  useEffect(() => {
    if (textTo3DTasks.size === 0) return

    const activeTasks = Array.from(textTo3DTasks.entries()).filter(
      ([_, task]) => task.status === "PENDING" || task.status === "IN_PROGRESS"
    )
    if (activeTasks.length === 0) return

    const pollInterval = setInterval(async () => {
      for (const [taskId, taskInfo] of activeTasks) {
        try {
          const task = await getTextTo3DTask(taskId)

          // Update task tracking
          setTextTo3DTasks(prev => {
            const newMap = new Map(prev)
            newMap.set(taskId, { ...taskInfo, status: task.status, progress: task.progress })
            return newMap
          })

          // Update model with status and URL
          setGeneratedModels(prev => prev.map(m =>
            m.id === taskInfo.modelId
              ? {
                ...m,
                status: task.status === "SUCCEEDED" ? "completed" as const
                  : task.status === "FAILED" ? "failed" as const
                    : "processing" as const,
                progress: task.progress,
                url: task.model_urls?.glb || m.url
              }
              : m
          ))

          if (task.status === "SUCCEEDED") {
            setIsGenerating(false)
            // Save model to database
            const modelUrl = task.model_urls?.glb
            if (isAuthenticated && user && modelUrl) {
              const model = generatedModels.find(m => m.id === taskInfo.modelId)
              if (model) {
                const updatedModel = {
                  ...model,
                  status: "completed" as const,
                  url: modelUrl,
                  format: "glb" as const,
                }
                saveModelToDatabase(updatedModel, modelUrl, "glb")
              }
            }
          } else if (task.status === "FAILED") {
            setIsGenerating(false)
            setError(`Text to 3D failed: ${task.task_error?.message || "Unknown error"}`)
          }
        } catch (err) {
          console.error("Error polling Text to 3D task:", err)
        }
      }
    }, 3000)

    return () => clearInterval(pollInterval)
  }, [textTo3DTasks, generatedModels, isAuthenticated, user])

  // Helper function to get or create placeholder asset for standalone models
  // Returns null if assets table doesn't exist or creation fails (assetId is optional)
  const getOrCreatePlaceholderAsset = async (userId: string): Promise<string | null> => {
    if (placeholderAssetIdRef.current) {
      return placeholderAssetIdRef.current
    }

    try {
      // Import from supabase.ts
      const { createProject, createAsset, getProjects, getAssets } = await import("../../services/supabase")

      // Try to find existing "Standalone Models" project
      const projects = await getProjects(userId)
      let standaloneProject = projects.find(p => p.name === "Standalone Models")

      // Create project if it doesn't exist
      if (!standaloneProject) {
        try {
          standaloneProject = await createProject({
            userId,
            name: "Standalone Models",
            description: "3D models generated from the model generation page",
          })
        } catch (projectError) {
          console.warn("Failed to create project (assets table may not exist):", projectError)
          return null // Return null if project creation fails
        }
      }

      // Get assets for this project to find existing placeholder asset
      try {
        const assets = await getAssets(standaloneProject.id)
        let placeholderAsset = assets.find(a => a.type === "character" && a.status === "concept")

        // Create placeholder asset if it doesn't exist
        if (!placeholderAsset) {
          try {
            placeholderAsset = await createAsset({
              projectId: standaloneProject.id,
              type: "character" as const,
              status: "concept" as const,
              metadata: {},
            })
          } catch (assetError) {
            console.warn("Failed to create placeholder asset (assets table may not exist):", assetError)
            return null // Return null if asset creation fails
          }
        }

        placeholderAssetIdRef.current = placeholderAsset.id
        return placeholderAsset.id
      } catch (assetsError) {
        console.warn("Failed to get assets (assets table may not exist):", assetsError)
        return null // Return null if assets table doesn't exist
      }
    } catch (error) {
      console.warn("Error getting placeholder asset (assets table may not exist):", error)
      return null // Return null instead of throwing - assetId is optional
    }
  }

  // Helper function to upload model file to Supabase storage
  const uploadModelToStorage = async (modelUrl: string, userId: string, modelId: string, format: ModelFormat): Promise<string> => {
    try {
      // Check if it's already a Supabase URL (not a blob URL or external URL)
      if (modelUrl.startsWith("http") && !modelUrl.startsWith("blob:") && modelUrl.includes("supabase")) {
        return modelUrl
      }

      // Fetch the model file
      const response = await fetch(modelUrl, {
        mode: 'cors',
        credentials: 'omit',
      })
      if (!response.ok) {
        throw new Error(`Failed to fetch model: ${response.statusText}`)
      }
      const blob = await response.blob()

      // Determine file extension based on format
      const extension = format === "glb" ? "glb" : format === "obj" ? "obj" : format === "fbx" ? "fbx" : "stl"

      // Create a File from the blob
      const file = new File([blob], `${modelId}.${extension}`, {
        type: blob.type || `model/${format}`
      })

      // Upload to Supabase storage (data database)
      const { uploadFileToDataDb } = await import("../../services/supabase")
      const storagePath = `models/${userId}/${modelId}.${extension}`
      const publicUrl = await uploadFileToDataDb("models", storagePath, file)

      return publicUrl
    } catch (error) {
      console.error("Error uploading model to storage:", error)
      // Return original URL if upload fails
      return modelUrl
    }
  }

  const saveModelToDatabase = async (model: GeneratedModel, modelUrl: string, format: ModelFormat) => {
    if (!isAuthenticated || !user) return

    try {
      const assetId = await getOrCreatePlaceholderAsset(user.id)

      // Generate model ID
      const modelId = model.id || uuidv4()

      // Upload model to storage if it's not already a Supabase URL
      const finalUrl = await uploadModelToStorage(modelUrl, user.id, modelId, format)

      // Use rigged model URL if available, otherwise use the regular model URL
      const urlToSave = model.riggedModelUrl
        ? await uploadModelToStorage(model.riggedModelUrl, user.id, `${modelId}-rigged`, format)
        : finalUrl

      await saveModel(user.id, {
        assetId: assetId || undefined,
        url: urlToSave,
        format,
        status: model.riggedModelUrl ? "rigged" : "raw",
      } as any)
      console.log("Model saved to database with storage URL:", urlToSave)

      // Also save to GitHub project if connected
      const { currentProject, githubConnection, addGeneratedFile } = useAppStore.getState()
      if (currentProject) {
        try {
          const timestamp = Date.now()
          const truncId = String(timestamp).slice(-7)
          const modelFileName = `assets/models/model_${truncId}.${format}`
          const metadataFileName = `assets/models/model_${truncId}.md`

          const modelContent = `# 3D Model\n\n- **URL:** ${urlToSave}\n- **Format:** ${format}\n- **Generated:** ${new Date().toISOString()}\n`

          // Add to Builder sidebar
          addGeneratedFile(modelFileName, urlToSave)

          // Save metadata .md to GitHub
          await saveSingleProjectFile(
            currentProject.id,
            user.id,
            currentProject.name,
            metadataFileName,
            modelContent,
            githubConnection
          )
          console.log(`✅ Saved model metadata to GitHub: ${metadataFileName}`)

          // Save model reference to Supabase
          await saveSingleProjectFile(
            currentProject.id,
            user.id,
            currentProject.name,
            modelFileName,
            modelContent,
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

  const handleImageUpload = (view: "single" | "front" | "back" | "left" | "right", file: File | null) => {
    if (view === "single") {
      setSingleImage(file)
    } else {
      setFourImages(prev => ({ ...prev, [view]: file }))
    }
  }

  const handleGenerate = async () => {
    setError(null)

    // Check usage limit
    if (isAuthenticated && user) {
      const limitCheck = await checkLimit("image_to_3d")
      if (!limitCheck.allowed) {
        setError(`Daily limit reached: ${limitCheck.currentUsage}/${limitCheck.limit} conversions. Please upgrade your plan.`)
        return
      }
    }

    // Text-to-3D mode (Meshy)
    if (sourceMode === "text") {
      if (!textPrompt.trim()) {
        setError("Please enter a text description")
        return
      }

      setIsGenerating(true)

      try {
        // Create Text-to-3D Preview task
        const taskId = await createTextTo3DPreview({
          prompt: textPrompt,
          ai_model: textTo3DAiModel,
          pose_mode: textTo3DPoseMode,
          target_polycount: textTo3DPolygons,
          should_remesh: true,
        })

        const modelId = `text3d-${Date.now()}`

        const newModel: GeneratedModel = {
          id: modelId,
          taskId,
          format: "glb",
          url: "",
          status: "pending",
        }

        setGeneratedModels(prev => [newModel, ...prev])
        setSelectedModelIndex(0)

        // Add to text-to-3D tasks for polling
        setTextTo3DTasks(prev => {
          const newMap = new Map(prev)
          newMap.set(taskId, { modelId, status: "PENDING", progress: 0 })
          return newMap
        })

        // Increment usage
        if (isAuthenticated && user) {
          await incrementUsage("image_to_3d")
        }
      } catch (err) {
        console.error("Error generating Text to 3D:", err)
        const errorMessage = err instanceof Error ? err.message : "Failed to generate 3D model from text"
        setError(errorMessage)
        setIsGenerating(false)
      }
      return
    }

    // Image-to-3D mode (original)
    // Validate inputs
    if (generationMode === "single") {
      if (!singleImage) {
        setError("Please upload an image")
        return
      }
    } else {
      if (!fourImages.front || !fourImages.back || !fourImages.left || !fourImages.right) {
        setError("Please upload all four view images")
        return
      }
    }

    setIsGenerating(true)

    try {
      const images: File[] = generationMode === "single"
        ? [singleImage!]
        : [fourImages.front!, fourImages.back!, fourImages.left!, fourImages.right!]

      // Create task for selected format
      const taskId = await create3DModelTask({
        mode: generationMode,
        type: generationType,
        resolution,
        format,
        images,
      })

      const newModel: GeneratedModel = {
        id: `${Date.now()}-${format}`,
        taskId,
        format,
        url: "",
        status: "pending",
      }

      setGeneratedModels(prev => [newModel, ...prev])
      setSelectedModelIndex(0) // Select the newly created model

      // Increment usage
      if (isAuthenticated && user) {
        await incrementUsage("image_to_3d")
      }
    } catch (err) {
      console.error("Error generating 3D model:", err)
      let errorMessage = err instanceof Error ? err.message : "Failed to generate 3D model"

      // Provide user-friendly error messages for common errors
      if (errorMessage.includes("model face exceeds limit") || errorMessage.includes("10031002")) {
        errorMessage = "Face count error. The system automatically sets face count based on resolution:\n• 512³: 500k faces\n• 1024³: 1M faces\n• 1536³: 2M faces\n\nIf this error persists, try:\n• Lower resolution (512³ or 1024³)\n• Simpler/smaller input images\n• Reduce image file size"
      } else if (errorMessage.includes("quota") || errorMessage.includes("limit")) {
        errorMessage = "API quota or limit reached. Please try again later or upgrade your plan."
      } else if (errorMessage.includes("10031005")) {
        errorMessage = "Image format not supported. Please use PNG, JPEG, JPG, or WEBP formats."
      } else if (errorMessage.includes("10031006")) {
        errorMessage = "Invalid model version. Please contact support."
      } else if (errorMessage.includes("10031008")) {
        errorMessage = "No images provided. Please upload at least one image."
      } else if (errorMessage.includes("10031009")) {
        errorMessage = "Too many images. Multi-image mode supports up to 4 images."
      } else if (errorMessage.includes("10031000") || errorMessage.includes("balance is not enough")) {
        errorMessage = "Insufficient API balance. Please contact support to add credits."
      }

      setError(errorMessage)
      setIsGenerating(false)
    }
  }

  const handleDownload = async (model: GeneratedModel) => {
    try {
      const response = await fetch(model.url)
      const blob = await response.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `model.${model.format}`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch (error) {
      console.error("Error downloading model:", error)
    }
  }

  const handleAutoRig = async (model: GeneratedModel) => {
    if (!model.url || model.status !== "completed") {
      setError("Model must be completed before rigging")
      return
    }

    // Only GLB format is supported for rigging
    if (model.format !== "glb") {
      setError("Auto-rigging currently only supports GLB format. Please generate a GLB model first.")
      return
    }

    setIsRigging(true)
    setError(null)

    try {
      // Verify the model URL is accessible
      try {
        const testResponse = await fetch(model.url, { method: "HEAD" })
        if (!testResponse.ok) {
          throw new Error("Model URL is not accessible. The model may have expired or been deleted.")
        }
      } catch (urlError) {
        throw new Error("Cannot access model URL. Please ensure the model is still available.")
      }

      // Create rigging task using the model taskId directly (Tripo expects original_model_task_id)
      if (!model.taskId) {
        throw new Error("Cannot rig this model because it is missing a task ID required by Tripo.")
      }

      const riggingTaskId = await createRiggingTask({
        input_task_id: model.taskId,
      })

      // Update model with rigging task ID
      setGeneratedModels(prev => prev.map(m =>
        m.id === model.id
          ? {
            ...m,
            riggingTaskId,
            riggingStatus: "PENDING" as const,
            riggingProgress: 0
          }
          : m
      ))
    } catch (err) {
      console.error("Error creating rigging task:", err)
      let errorMessage = err instanceof Error ? err.message : "Failed to create rigging task"

      // Preserve multi-line error messages from the API
      if (errorMessage.includes("\n")) {
        // Keep the formatted error message as-is
      } else if (errorMessage.includes("API key")) {
        errorMessage = "Meshy API key not configured. Please set VITE_MESHY_API_KEY in your .env file."
      } else if (errorMessage.includes("pose estimation") || errorMessage.includes("pose_estimation")) {
        errorMessage =
          "Model is not suitable for auto-rigging.\n\n" +
          "Auto-rigging works best with:\n" +
          "• Textured humanoid (bipedal) models\n" +
          "• Models with clearly defined limbs and body structure\n" +
          "• GLB format with textures\n\n" +
          "Not suitable for:\n" +
          "• Non-humanoid assets\n" +
          "• Untextured meshes\n" +
          "• Models with unclear body structure"
      }

      setError(errorMessage)
      setIsRigging(false)
    }
  }

  const handleDownloadRigged = async (model: GeneratedModel) => {
    if (!model.riggedModelUrl) {
      setError("Rigged model URL not available")
      return
    }

    // If we have a blob URL (from successful fetch), use that for download
    if (model.riggedModelBlobUrl) {
      try {
        const a = document.createElement("a")
        a.href = model.riggedModelBlobUrl
        a.download = `rigged_model.glb`
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        return
      } catch (error) {
        console.error("Error downloading from blob URL:", error)
      }
    }

    // Otherwise, try to fetch the model directly
    try {
      const response = await fetch(model.riggedModelUrl, {
        mode: 'cors',
        credentials: 'omit',
        headers: {
          'Accept': 'application/octet-stream,model/gltf-binary,*/*'
        }
      })

      if (!response.ok) {
        throw new Error(`Failed to fetch model: ${response.status} ${response.statusText}`)
      }

      const blob = await response.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `rigged_model.glb`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch (error) {
      console.error("Error downloading rigged model:", error)
      // If CORS fails, open in new tab as fallback
      const isCorsError = error instanceof TypeError && error.message.includes("Failed to fetch")
      if (isCorsError) {
        // Open in new tab - user can right-click and save
        window.open(model.riggedModelUrl, '_blank')
        setError("CORS restriction: Cannot download directly. Opened model URL in new tab. Right-click the model and select 'Save As' to download.")
      } else {
        setError(`Failed to download rigged model: ${error instanceof Error ? error.message : "Unknown error"}`)
      }
    }
  }

  const selectedModel = selectedModelIndex !== null ? generatedModels[selectedModelIndex] : null

  return (
    <div className="flex h-full bg-background font-mono overflow-hidden relative">
      {/* Left Sidebar - Controls */}
      <div className={cn(
        "shrink-0 border-r border-border bg-background flex flex-col h-full transition-all duration-300 ease-in-out",
        isSidebarOpen ? "w-80" : "w-0 overflow-hidden"
      )}>
        <div className={cn(
          "border-b border-border p-4 flex items-center justify-between shrink-0 transition-opacity duration-300",
          isSidebarOpen ? "opacity-100" : "opacity-0 pointer-events-none"
        )}>
          <h2 className="text-sm font-bold text-foreground">3D Model Generation</h2>
          <button
            onClick={() => setIsSidebarOpen(false)}
            className="p-1 hover:bg-muted rounded transition-colors"
            aria-label="Close sidebar"
          >
            <ChevronLeft className="h-5 w-5 text-foreground" />
          </button>
        </div>

        <div className={cn(
          "flex-1 overflow-y-auto overflow-x-hidden p-4 space-y-6 transition-opacity duration-300",
          isSidebarOpen ? "opacity-100" : "opacity-0 pointer-events-none"
        )}>
          {/* Source Mode Toggle */}
          <div className="grid grid-cols-2 gap-2 mb-4">
            <button
              onClick={() => setSourceMode("image")}
              className={cn(
                "flex items-center justify-center gap-2 px-3 py-2 text-xs font-bold border-2 border-border transition-all font-mono",
                sourceMode === "image"
                  ? "bg-foreground text-background"
                  : "bg-background text-foreground hover:bg-muted"
              )}
            >
              <Upload className="h-3 w-3" />
              Image to 3D
            </button>
            <button
              onClick={() => setSourceMode("text")}
              className={cn(
                "flex items-center justify-center gap-2 px-3 py-2 text-xs font-bold border-2 border-border transition-all font-mono",
                sourceMode === "text"
                  ? "bg-foreground text-background"
                  : "bg-background text-foreground hover:bg-muted"
              )}
            >
              <MessageSquare className="h-3 w-3" />
              Text to 3D
            </button>
          </div>

          {sourceMode === "image" ? (
            <>
              {/* Model Selection */}
              <div className="space-y-2">
                <Select
                  value={model}
                  onValueChange={(value) => setModel(value as "koye-3dv1")}
                  options={[
                    { value: "koye-3dv1", label: "koye-3dv1" }
                  ]}
                />
              </div>

              {/* Generation Mode */}
              <div className="space-y-2">
                <label className="text-xs font-medium text-muted-foreground">Generation Mode</label>
                <Select
                  value={generationMode}
                  onValueChange={(value) => setGenerationMode(value as GenerationMode)}
                  options={[
                    { value: "single", label: "From Single Image" },
                    { value: "four", label: "From Four Images" }
                  ]}
                />
              </div>

              {/* Generation Type */}
              <div className="space-y-2">
                <label className="text-xs font-medium text-muted-foreground">Generation Type</label>
                <Select
                  value={generationType}
                  onValueChange={(value) => setGenerationType(value as GenerationType)}
                  options={[
                    { value: "both", label: "With Texture" },
                    { value: "mesh", label: "No Texture" },
                    { value: "texture", label: "Only Texture" }
                  ]}
                />
              </div>
            </>
          ) : (
            <>
              {/* Text Prompt */}
              <div className="space-y-2">
                <label className="text-xs font-medium text-muted-foreground">Text Description</label>
                <textarea
                  value={textPrompt}
                  onChange={(e) => setTextPrompt(e.target.value)}
                  placeholder="Describe the 3D model you want to generate (e.g., 'a futuristic robot with sleek armor')"
                  className="w-full h-32 p-3 text-xs bg-background border border-border rounded focus:outline-none focus:ring-1 focus:ring-foreground resize-none"
                />
              </div>

              {/* AI Model */}
              <div className="space-y-2">
                <label className="text-xs font-medium text-muted-foreground">AI Model</label>
                <Select
                  value={textTo3DAiModel}
                  onValueChange={(value) => setTextTo3DAiModel(value as TextTo3DAiModel)}
                  options={[
                    { value: "latest", label: "Latest (Meshy-4)" },
                    { value: "meshy-5", label: "Meshy-5" },
                    { value: "meshy-6", label: "Meshy-6 (High Quality)" }
                  ]}
                />
                {textTo3DAiModel === "meshy-6" && (
                  <p className="text-[10px] text-muted-foreground">Costs 20 credits (others cost 5)</p>
                )}
              </div>

              {/* Pose Mode */}
              <div className="space-y-2">
                <label className="text-xs font-medium text-muted-foreground">Pose</label>
                <Select
                  value={textTo3DPoseMode}
                  onValueChange={(value) => setTextTo3DPoseMode(value as TextTo3DPoseMode)}
                  options={[
                    { value: "", label: "Default" },
                    { value: "a-pose", label: "A-Pose (Best for rigging)" },
                    { value: "t-pose", label: "T-Pose (Best for rigging)" }
                  ]}
                />
              </div>

              {/* Polycount */}
              <div className="space-y-2">
                <label className="text-xs font-medium text-muted-foreground">Target Polycount: {textTo3DPolygons.toLocaleString()}</label>
                <input
                  type="range"
                  min="5000"
                  max="100000"
                  step="5000"
                  value={textTo3DPolygons}
                  onChange={(e) => setTextTo3DPolygons(parseInt(e.target.value))}
                  className="w-full"
                />
              </div>
            </>
          )}

          {sourceMode === "image" && (
            <>
              {/* Resolution - Only for Image to 3D*/}
              <div className="space-y-2">
                <label className="text-xs font-medium text-muted-foreground">Model Resolution</label>
                <Select
                  value={resolution}
                  onValueChange={(value) => setResolution(value as ModelResolution)}
                  options={[
                    { value: "512", label: "512³ (Recommended)" },
                    { value: "1024", label: "1024³" },
                    { value: "1536", label: "1536³ (May exceed limits)" },
                    { value: "1536Pro", label: "1536³ Pro (May exceed limits)" }
                  ]}
                />
                {(resolution === "1536" || resolution === "1536Pro") && (
                  <p className="text-xs text-yellow-600 dark:text-yellow-400 mt-1">
                    ⚠️ High resolution may exceed face count limits (10k-200k faces)
                  </p>
                )}
              </div>

              {/* Format */}
              <div className="space-y-2">
                <label className="text-xs font-medium text-muted-foreground">Model Format</label>
                <Select
                  value={format}
                  onValueChange={(value) => setFormat(value as ModelFormat)}
                  options={[
                    { value: "obj", label: ".obj" },
                    { value: "glb", label: ".glb" },
                    { value: "stl", label: ".stl" },
                    { value: "fbx", label: ".fbx" }
                  ]}
                />
              </div>

              {/* Image Upload - Only for Image to 3D */}
              <div className="space-y-3">
                <label className="text-xs font-medium text-muted-foreground">Images</label>

                {generationMode === "single" ? (
                  <div>
                    <input
                      ref={(el) => fileInputRefs.current["single"] = el}
                      type="file"
                      accept="image/*"
                      onChange={(e) => handleImageUpload("single", e.target.files?.[0] || null)}
                      className="hidden"
                      disabled={!isAuthenticated}
                    />
                    <button
                      onClick={() => fileInputRefs.current["single"]?.click()}
                      className={`w-full border-2 border-dashed border-border p-4 text-center hover:bg-muted transition-colors ${!isAuthenticated ? 'opacity-50 cursor-not-allowed' : ''}`}
                      disabled={!isAuthenticated}
                    >
                      {singleImage ? (
                        <div className="space-y-2">
                          <img src={URL.createObjectURL(singleImage)} alt="Preview" className="w-full h-32 object-contain bg-muted" />
                          <p className="text-xs text-muted-foreground truncate">{singleImage.name}</p>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          <Upload className="h-8 w-8 mx-auto text-muted-foreground" />
                          <p className="text-xs text-muted-foreground">{isAuthenticated ? "Click to upload image" : "Login to upload image"}</p>
                        </div>
                      )}
                    </button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {(["front", "back", "left", "right"] as const).map((view) => (
                      <div key={view}>
                        <label className="text-xs text-muted-foreground mb-1 block">{view} View</label>
                        <input
                          ref={(el) => fileInputRefs.current[view] = el}
                          type="file"
                          accept="image/*"
                          onChange={(e) => handleImageUpload(view, e.target.files?.[0] || null)}
                          className="hidden"
                          disabled={!isAuthenticated}
                        />
                        <button
                          onClick={() => fileInputRefs.current[view]?.click()}
                          className={`w-full border-2 border-dashed border-border p-3 text-center hover:bg-muted transition-colors ${!isAuthenticated ? 'opacity-50 cursor-not-allowed' : ''}`}
                          disabled={!isAuthenticated}
                        >
                          {fourImages[view] ? (
                            <div className="space-y-1">
                              <img src={URL.createObjectURL(fourImages[view]!)} alt={view} className="w-full h-24 object-contain bg-muted" />
                              <p className="text-xs text-muted-foreground truncate">{fourImages[view]!.name}</p>
                            </div>
                          ) : (
                            <div className="space-y-1">
                              <Upload className="h-6 w-6 mx-auto text-muted-foreground" />
                              <p className="text-xs text-muted-foreground">{isAuthenticated ? `Upload ${view}` : "Login required"}</p>
                            </div>
                          )}
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}


          {/* Generate Button */}
          <Button
            onClick={handleGenerate}
            disabled={isGenerating || !isAuthenticated}
            className="w-full bg-foreground text-background hover:bg-muted-foreground border border-foreground font-mono text-sm disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isGenerating ? "$ generating..." : isAuthenticated ? "$ generate" : "$ login_required"}
          </Button>

          {/* Error Display */}
          {error && (
            <div className="p-3 border border-red-500 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 text-xs font-mono">
              $ error: {error}
            </div>
          )}
        </div>
      </div>

      {/* Sidebar Toggle Button (when closed) */}
      {!isSidebarOpen && (
        <button
          onClick={() => setIsSidebarOpen(true)}
          className="absolute left-0 top-1/2 -translate-y-1/2 z-10 bg-background border-r border-b border-t border-border p-2 hover:bg-muted transition-all duration-300 rounded-r-lg animate-in slide-in-from-left"
          aria-label="Open sidebar"
        >
          <ChevronRight className="h-5 w-5 text-foreground" />
        </button>
      )}

      {/* Main Content - 3D Viewer */}
      <div className="flex-1 flex flex-col min-w-0 bg-background h-full overflow-hidden">
        {selectedModel && selectedModel.status === "completed" && selectedModel.url ? (
          <div className="flex-1 relative overflow-hidden">
            {/* Show rigged model if available, otherwise show original */}
            {selectedModel.riggedModelUrl && selectedModel.riggingStatus === "SUCCEEDED" ? (
              selectedModel.riggedModelBlobUrl ? (
                <Canvas className="w-full h-full">
                  <ModelScene modelUrl={selectedModel.riggedModelBlobUrl} format="glb" />
                </Canvas>
              ) : (
                <div className="flex-1 flex items-center justify-center bg-muted">
                  <div className="text-center space-y-4 p-8 border-2 border-border bg-background max-w-md">
                    <Box className="h-16 w-16 mx-auto text-muted-foreground" />
                    <div className="space-y-2">
                      <p className="text-foreground font-mono text-sm font-bold">
                        $ rigged_model_ready
                      </p>
                      <p className="text-muted-foreground font-mono text-xs">
                        Rigged model is ready! However, preview is not available due to CORS restrictions.
                        You can download the rigged model using the button below.
                      </p>
                      <Button
                        onClick={() => handleDownloadRigged(selectedModel)}
                        className="mt-4 bg-green-600 text-white hover:bg-green-700 border border-green-700 font-mono text-sm"
                      >
                        <Download className="h-4 w-4 mr-2" />
                        Download Rigged GLB
                      </Button>
                    </div>
                  </div>
                </div>
              )
            ) : selectedModel.format === "glb" ? (
              <Canvas className="w-full h-full">
                <ModelScene modelUrl={selectedModel.url} format={selectedModel.format} />
              </Canvas>
            ) : (
              <div className="flex-1 flex items-center justify-center bg-muted">
                <div className="text-center space-y-4 p-8 border-2 border-border bg-background">
                  <Box className="h-16 w-16 mx-auto text-muted-foreground" />
                  <div className="space-y-2">
                    <p className="text-foreground font-mono text-sm font-bold">
                      $ preview_not_available
                    </p>
                    <p className="text-muted-foreground font-mono text-xs max-w-md">
                      Preview is only available for GLB format. Your {selectedModel.format.toUpperCase()} model has been generated successfully and can be downloaded.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Viewer Controls - Only show for GLB */}
            {(selectedModel.format === "glb" || selectedModel.riggedModelUrl) && (
              <div className="absolute top-4 right-4 z-10 bg-background border-2 border-border p-2 space-y-2">
                <div className="text-xs font-bold text-foreground mb-2">$ controls</div>
                <div className="text-xs text-muted-foreground space-y-1">
                  <div>• Left Click + Drag: Rotate</div>
                  <div>• Right Click + Drag: Pan</div>
                  <div>• Scroll: Zoom</div>
                  {selectedModel.riggedModelUrl && (
                    <div className="mt-2 pt-2 border-t border-border">
                      <div className="text-xs font-bold text-green-600">✓ Rigged Model</div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Download and Auto Rig Buttons */}
            <div className="absolute bottom-4 right-4 z-10 flex gap-2">
              {selectedModel.riggedModelUrl && selectedModel.riggingStatus === "SUCCEEDED" ? (
                <Button
                  onClick={() => handleDownloadRigged(selectedModel)}
                  className="bg-green-600 text-white hover:bg-green-700 border border-green-700 font-mono text-sm"
                >
                  <Download className="h-4 w-4 mr-2" />
                  Download Rigged GLB
                </Button>
              ) : (
                <>
                  {selectedModel.format === "glb" && (
                    <Button
                      onClick={() => handleAutoRig(selectedModel)}
                      disabled={isRigging || !!selectedModel.riggingTaskId}
                      className="bg-blue-600 text-white hover:bg-blue-700 border border-blue-700 font-mono text-sm disabled:opacity-50"
                    >
                      <Bone className="h-4 w-4 mr-2" />
                      {selectedModel.riggingStatus === "IN_PROGRESS"
                        ? `Rigging... ${selectedModel.riggingProgress || 0}%`
                        : selectedModel.riggingStatus === "PENDING"
                          ? "Rigging Pending..."
                          : "Auto Rig"}
                    </Button>
                  )}
                  <Button
                    onClick={() => handleDownload(selectedModel)}
                    className="bg-foreground text-background hover:bg-muted-foreground border border-foreground font-mono text-sm"
                  >
                    <Download className="h-4 w-4 mr-2" />
                    Download {selectedModel.format.toUpperCase()}
                  </Button>
                </>
              )}
            </div>
          </div>
        ) : (
          <div className="flex-1 flex items-center justify-center overflow-hidden">
            <div className="text-center">
              {isGenerating ? (
                <div className="space-y-4">
                  <div className="inline-block animate-spin rounded-full h-12 w-12 border-2 border-foreground border-t-transparent"></div>
                  <p className="text-muted-foreground font-mono text-sm">$ generating_3d_model...</p>
                  {selectedModel && selectedModel.progress && (
                    <p className="text-muted-foreground font-mono text-xs">Progress: {selectedModel.progress}%</p>
                  )}
                </div>
              ) : (
                <div className="space-y-2">
                  <Box className="h-16 w-16 mx-auto text-muted-foreground" />
                  <p className="text-muted-foreground font-mono text-sm">$ no_model_generated_yet</p>
                  <p className="text-muted-foreground font-mono text-xs">Upload images and click Generate</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Generated Models List */}
        {generatedModels.length > 0 && (
          <div className="border-t border-border p-4 bg-background shrink-0 overflow-x-auto">
            <div className="text-xs font-bold text-foreground mb-2">Generated Models</div>
            <div className="flex gap-2 overflow-x-auto">
              {generatedModels.map((model, index) => (
                <button
                  key={model.id}
                  onClick={() => setSelectedModelIndex(index)}
                  className={`
                    shrink-0 border-2 p-3 text-center transition-all font-mono text-xs
                    ${selectedModelIndex === index
                      ? "bg-foreground text-background border-foreground"
                      : "bg-background text-foreground border-border hover:bg-muted"
                    }
                    ${model.status === "completed" ? "" : "opacity-60"}
                  `}
                >
                  <div className="font-bold">{model.format.toUpperCase()}</div>
                  <div className="text-xs mt-1">
                    {model.status === "completed" ? "Ready" :
                      model.status === "processing" ? `${model.progress || 0}%` :
                        model.status === "pending" ? "Pending" : "Failed"}
                  </div>
                  {model.riggingTaskId && (
                    <div className="text-xs mt-1 flex items-center justify-center gap-1">
                      <Bone className="h-3 w-3" />
                      {model.riggingStatus === "SUCCEEDED" ? (
                        <span className="text-green-600">Rigged</span>
                      ) : model.riggingStatus === "IN_PROGRESS" ? (
                        <span className="text-blue-600">{model.riggingProgress || 0}%</span>
                      ) : model.riggingStatus === "FAILED" ? (
                        <span className="text-red-600">Failed</span>
                      ) : (
                        <span className="text-muted-foreground">Rigging...</span>
                      )}
                    </div>
                  )}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

