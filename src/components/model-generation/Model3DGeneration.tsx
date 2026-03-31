import { OrbitControls, PerspectiveCamera, useGLTF } from "@react-three/drei"
import { Canvas } from "@react-three/fiber"
import { Bone, Box, ChevronLeft, ChevronRight, Download, MessageSquare, Upload } from "lucide-react"
import { Suspense, useEffect, useRef, useState } from "react"
import { useAuth } from "../../hooks/useAuth"
import { usePricing } from "../../hooks/usePricing"
import { cn } from "../../lib/utils"
import { uuidv4 } from "../../lib/uuid"
import { create3DModelTask, queryTaskStatus, type GenerationMode, type GenerationType, type ModelFormat, type ModelResolution } from "../../services/hitem3d"
import { type RiggingTask } from "../../services/meshy"
import { generate3DModelWithHypereal } from "../../services/hyperreal"
import { saveModel } from "../../services/multiDbDataService"
import { saveSingleProjectFile } from "../../services/projectFiles"
import { createRiggingTask, getRiggingTask } from "../../services/tripo"
import { useAppStore } from "../../store/useAppStore"
import { Button } from "../ui/button"

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

  // Text-to-3D state (Hypereal)
  const [textPrompt, setTextPrompt] = useState("")
  const [artStyle, setArtStyle] = useState<"realistic" | "sculpture">("realistic")
  const [topology, setTopology] = useState<"quad" | "triangle">("triangle")
  const [textTo3DPolygons, setTextTo3DPolygons] = useState<number>(30000)
  const [enablePbr, setEnablePbr] = useState<boolean>(false)

  // Common state
  const [isGenerating, setIsGenerating] = useState(false)
  const [generatedModels, setGeneratedModels] = useState<GeneratedModel[]>([])
  const [selectedModelIndex, setSelectedModelIndex] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)
  const [isRigging, setIsRigging] = useState(false)
  const fileInputRefs = useRef<{ [key: string]: HTMLInputElement | null }>({})



  // Dropdown UI states
  const [showModeSelect, setShowModeSelect] = useState(false)
  const [showModelSelect, setShowModelSelect] = useState(false)
  const [showFormatSelect, setShowFormatSelect] = useState(false)
  const [showResolutionSelect, setShowResolutionSelect] = useState(false)
  const [showTextureSelect, setShowTextureSelect] = useState(false)
  const [showArtStyleSelect, setShowArtStyleSelect] = useState(false)
  const [showTopologySelect, setShowTopologySelect] = useState(false)

  // Close dropdowns on outside click
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement
      if (!target.closest('.media-dropdown-element')) {
        setShowModeSelect(false)
        setShowModelSelect(false)
        setShowFormatSelect(false)
        setShowResolutionSelect(false)
        setShowTextureSelect(false)
        setShowArtStyleSelect(false)
        setShowTopologySelect(false)
      }
    }
    document.addEventListener("mousedown", handleClick)
    return () => document.removeEventListener("mousedown", handleClick)
  }, [])

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

    // Text-to-3D mode (Hypereal)
    if (sourceMode === "text") {
      if (!textPrompt.trim()) {
        setError("Please enter a text description")
        return
      }

      setIsGenerating(true)
      
      const modelId = `text3d-${Date.now()}`
      
      const newModel: GeneratedModel = {
        id: modelId,
        taskId: modelId,
        format: "glb",
        url: "",
        status: "processing",
        progress: 10,
      }
      
      setGeneratedModels(prev => [newModel, ...prev])
      setSelectedModelIndex(0)

      try {
        const result = await generate3DModelWithHypereal(textPrompt, {
          art_style: artStyle,
          topology: topology,
          target_polycount: textTo3DPolygons,
          enable_pbr: enablePbr
        })

        const completedModel: GeneratedModel = {
          ...newModel,
          status: "completed",
          url: result.url,
        }
        
        setGeneratedModels(prev => prev.map(m => m.id === modelId ? completedModel : m))
        setSelectedModelIndex(0)
        
        if (isAuthenticated && user) {
          saveModelToDatabase(completedModel, result.url, "glb")
          await incrementUsage("image_to_3d")
        }
        
        setIsGenerating(false)
      } catch (err) {
        console.error("Error generating Text to 3D:", err)
        const errorMessage = err instanceof Error ? err.message : "Failed to generate 3D model from text"
        setError(errorMessage)
        setGeneratedModels(prev => prev.map(m => m.id === modelId ? { ...m, status: "failed" } : m))
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
    <div className="flex h-full bg-background overflow-hidden relative">
      {/* Left Sidebar - Recent Models */}
      <div className={cn(
        "shrink-0 border-r border-border bg-background flex flex-col h-full transition-all duration-300 ease-in-out",
        isSidebarOpen ? "w-72" : "w-0 overflow-hidden"
      )}>
        <div className={cn(
          "border-b border-border p-4 flex items-center justify-between shrink-0",
          isSidebarOpen ? "opacity-100" : "opacity-0 pointer-events-none"
        )}>
          <h2 className="text-sm font-semibold text-foreground">Recent Models</h2>
          <button onClick={() => setIsSidebarOpen(false)} className="p-1 hover:bg-muted rounded-lg transition-colors">
            <ChevronLeft className="h-4 w-4 text-muted-foreground" />
          </button>
        </div>
        <div className={cn(
          "flex-1 overflow-y-auto p-3 space-y-2",
          isSidebarOpen ? "opacity-100" : "opacity-0 pointer-events-none"
        )}>
          {generatedModels.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Box className="w-10 h-10 mx-auto mb-3 opacity-20" />
              <p className="text-xs">No models generated yet</p>
            </div>
          ) : (
            generatedModels.map((m, i) => (
              <button
                key={m.id}
                onClick={() => setSelectedModelIndex(i)}
                className={cn(
                  "w-full flex items-center gap-3 p-3 rounded-xl border transition-all text-left",
                  selectedModelIndex === i
                    ? "bg-foreground text-background border-foreground"
                    : "bg-muted/30 border-border hover:bg-muted/60"
                )}
              >
                <div className={cn("w-9 h-9 rounded-lg flex items-center justify-center shrink-0", selectedModelIndex === i ? "bg-background/20" : "bg-muted")}>
                  <Box className="w-4 h-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold truncate">{m.format.toUpperCase()}</p>
                  <p className="text-[10px] opacity-60 truncate">
                    {m.status === "completed" ? "Ready" : m.status === "processing" ? `${m.progress || 0}%` : m.status === "pending" ? "Queued" : "Failed"}
                  </p>
                </div>
                {m.riggingTaskId && (
                  <Bone className={cn("w-3 h-3 shrink-0", m.riggingStatus === "SUCCEEDED" ? "text-green-500" : "opacity-40")} />
                )}
              </button>
            ))
          )}
        </div>
      </div>

      {/* Sidebar Toggle */}
      {!isSidebarOpen && (
        <button
          onClick={() => setIsSidebarOpen(true)}
          className="absolute left-0 top-1/2 -translate-y-1/2 z-10 bg-background border-r border-b border-t border-border p-2 hover:bg-muted transition-all rounded-r-lg"
        >
          <ChevronRight className="h-4 w-4 text-foreground" />
        </button>
      )}

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0 bg-background h-full overflow-hidden relative">
        {/* 3D Viewport */}
        <div className="flex-1 relative min-h-0">
          {selectedModel && selectedModel.status === "completed" && selectedModel.url ? (
            <>
              {selectedModel.riggedModelUrl && selectedModel.riggingStatus === "SUCCEEDED" ? (
                selectedModel.riggedModelBlobUrl ? (
                  <Canvas className="w-full h-full">
                    <ModelScene modelUrl={selectedModel.riggedModelBlobUrl} format="glb" />
                  </Canvas>
                ) : (
                  <div className="flex items-center justify-center h-full">
                    <div className="text-center space-y-4 p-8 border border-border bg-background/80 backdrop-blur rounded-2xl max-w-sm">
                      <Box className="h-12 w-12 mx-auto text-muted-foreground" />
                      <p className="text-sm font-semibold">Rigged Model Ready</p>
                      <p className="text-xs text-muted-foreground">Preview unavailable due to CORS. Download below.</p>
                      <Button onClick={() => handleDownloadRigged(selectedModel)} className="mt-2 text-xs">
                        <Download className="h-3.5 w-3.5 mr-2" /> Download Rigged GLB
                      </Button>
                    </div>
                  </div>
                )
              ) : selectedModel.format === "glb" ? (
                <Canvas className="w-full h-full">
                  <ModelScene modelUrl={selectedModel.url} format={selectedModel.format} />
                </Canvas>
              ) : (
                <div className="flex items-center justify-center h-full">
                  <div className="text-center space-y-3 p-8 border border-border bg-background/80 backdrop-blur rounded-2xl">
                    <Box className="h-12 w-12 mx-auto text-muted-foreground" />
                    <p className="text-sm font-semibold">Preview Not Available</p>
                    <p className="text-xs text-muted-foreground">Only GLB format supports in-browser preview.</p>
                  </div>
                </div>
              )}

              {/* Viewer Controls HUD */}
              {(selectedModel.format === "glb" || selectedModel.riggedModelUrl) && (
                <div className="absolute top-4 right-4 z-10 bg-background/70 backdrop-blur-md border border-white/10 rounded-xl px-3 py-2.5 shadow-lg">
                  <div className="text-[10px] font-semibold text-muted-foreground mb-1.5 uppercase tracking-wider">Controls</div>
                  <div className="text-[11px] text-muted-foreground space-y-0.5">
                    <div>Left Drag: Rotate</div>
                    <div>Right Drag: Pan</div>
                    <div>Scroll: Zoom</div>
                  </div>
                  {selectedModel.riggedModelUrl && selectedModel.riggingStatus === "SUCCEEDED" && (
                    <div className="mt-2 pt-2 border-t border-white/10 text-[10px] font-bold text-green-500">✓ Rigged</div>
                  )}
                </div>
              )}

              {/* Action Buttons */}
              <div className="absolute bottom-4 left-4 z-10 flex gap-2">
                {selectedModel.riggedModelUrl && selectedModel.riggingStatus === "SUCCEEDED" ? (
                  <Button onClick={() => handleDownloadRigged(selectedModel)} className="bg-green-600 hover:bg-green-700 text-white border-0 text-xs rounded-xl shadow-lg h-8">
                    <Download className="h-3 w-3 mr-1.5" /> Rigged GLB
                  </Button>
                ) : (
                  <>
                    {selectedModel.format === "glb" && (
                      <Button
                        onClick={() => handleAutoRig(selectedModel)}
                        disabled={isRigging || !!selectedModel.riggingTaskId}
                        className="bg-blue-600 hover:bg-blue-700 text-white border-0 text-xs disabled:opacity-50 rounded-xl shadow-lg h-8"
                      >
                        <Bone className="h-3 w-3 mr-1.5" />
                        {selectedModel.riggingStatus === "IN_PROGRESS" ? `Rigging ${selectedModel.riggingProgress || 0}%` : selectedModel.riggingStatus === "PENDING" ? "Pending..." : "Auto Rig"}
                      </Button>
                    )}
                    <Button onClick={() => handleDownload(selectedModel)} className="bg-foreground text-background hover:bg-foreground/90 text-xs rounded-xl shadow-lg h-8">
                      <Download className="h-3 w-3 mr-1.5" /> {selectedModel.format.toUpperCase()}
                    </Button>
                  </>
                )}
              </div>
            </>
          ) : (
            <div className="flex items-center justify-center h-full">
              {isGenerating ? (
                <div className="space-y-4 text-center">
                  <div className="inline-block animate-spin rounded-full h-10 w-10 border-2 border-foreground border-t-transparent" />
                  <p className="text-muted-foreground text-xs">Generating 3D model...</p>
                  {selectedModel?.progress && <p className="text-[10px] text-muted-foreground">{selectedModel.progress}%</p>}
                </div>
              ) : (
                <div className="space-y-3 text-center opacity-30">
                  <Box className="h-16 w-16 mx-auto" />
                  <p className="text-xs">Upload images or describe your model below</p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* ── Bottom Input Bar ── */}
        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-background via-background to-transparent pt-8 pb-4 px-4 flex justify-center">
          <div className="w-full max-w-3xl relative">
            {/* Error */}
            {error && (
              <div className="mb-2 mx-2 p-2 bg-red-500/10 border border-red-500/30 rounded-lg text-red-500 text-xs">
                {error}
              </div>
            )}

            {/* Input container */}
            <div className="relative bg-muted/60 backdrop-blur-xl border border-border rounded-2xl focus-within:ring-1 focus-within:ring-border transition-all">
              {/* Input area */}
              <div className="pt-2 px-3 pb-1">
                {sourceMode === "image" ? (
                  generationMode === "single" ? (
                    /* Single image upload */
                    <div
                      className="h-[80px] w-full rounded-xl border border-dashed border-border bg-background/30 hover:bg-background/50 transition-colors cursor-pointer flex items-center justify-center overflow-hidden"
                      onClick={() => fileInputRefs.current["single"]?.click()}
                    >
                      {singleImage ? (
                        <img src={URL.createObjectURL(singleImage)} alt="Preview" className="h-full w-full object-contain" />
                      ) : (
                        <div className="flex flex-col items-center text-muted-foreground">
                          <Upload className="h-5 w-5 mb-1" />
                          <span className="text-[10px]">{isAuthenticated ? "Click to upload image" : "Login required"}</span>
                        </div>
                      )}
                      <input
                        ref={(el) => fileInputRefs.current["single"] = el}
                        type="file" accept="image/*"
                        onChange={(e) => handleImageUpload("single", e.target.files?.[0] || null)}
                        className="hidden" disabled={!isAuthenticated}
                      />
                    </div>
                  ) : (
                    /* Four image upload */
                    <div className="grid grid-cols-4 gap-2 h-[80px]">
                      {(["front", "back", "left", "right"] as const).map((view) => (
                        <div
                          key={view}
                          className="rounded-xl border border-dashed border-border bg-background/30 hover:bg-background/50 transition-colors cursor-pointer flex flex-col items-center justify-center overflow-hidden"
                          onClick={() => fileInputRefs.current[view]?.click()}
                        >
                          {fourImages[view] ? (
                            <img src={URL.createObjectURL(fourImages[view]!)} alt={view} className="h-full w-full object-contain" />
                          ) : (
                            <div className="flex flex-col items-center text-muted-foreground">
                              <Upload className="h-4 w-4 mb-0.5" />
                              <span className="text-[9px] capitalize">{view}</span>
                            </div>
                          )}
                          <input
                            ref={(el) => fileInputRefs.current[view] = el}
                            type="file" accept="image/*"
                            onChange={(e) => handleImageUpload(view, e.target.files?.[0] || null)}
                            className="hidden" disabled={!isAuthenticated}
                          />
                        </div>
                      ))}
                    </div>
                  )
                ) : (
                  /* Text prompt */
                  <textarea
                    value={textPrompt}
                    onChange={(e) => setTextPrompt(e.target.value)}
                    placeholder={isAuthenticated ? "Describe the 3D model you want to generate..." : "Please login to generate"}
                    className="flex-1 w-full bg-transparent text-foreground placeholder:text-muted-foreground p-2 text-sm resize-none focus:outline-none min-h-[80px] max-h-[120px]"
                    rows={3}
                    disabled={!isAuthenticated || isGenerating}
                    maxLength={600}
                  />
                )}
              </div>

              {/* Bottom toolbar */}
              <div className="flex items-center justify-between px-3 pb-2.5 pt-0.5 flex-wrap gap-y-1">
                {/* Left side controls */}
                <div className="flex items-center gap-2 flex-wrap">
                  {/* Source toggle: Image to 3D / Text to 3D */}
                  <div className="flex items-center bg-background border border-border rounded-full p-0.5">
                    <button
                      onClick={() => setSourceMode("image")}
                      className={cn("flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium transition-all",
                        sourceMode === "image" ? "bg-foreground text-background shadow-sm" : "text-muted-foreground hover:text-foreground"
                      )}
                    >
                      <Upload className="w-3 h-3" /> Image to 3D
                    </button>
                    <button
                      onClick={() => setSourceMode("text")}
                      className={cn("flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium transition-all",
                        sourceMode === "text" ? "bg-foreground text-background shadow-sm" : "text-muted-foreground hover:text-foreground"
                      )}
                    >
                      <MessageSquare className="w-3 h-3" /> Text to 3D
                    </button>
                  </div>

                  {sourceMode === "image" && (
                    <>
                      {/* Single / Multiple */}
                      <div className="relative media-dropdown-element">
                        <button
                          onClick={() => { setShowModeSelect(!showModeSelect); setShowModelSelect(false); setShowFormatSelect(false); setShowResolutionSelect(false); setShowTextureSelect(false) }}
                          className="flex items-center gap-2 bg-background border border-border text-foreground text-xs px-3 py-1 rounded-full hover:bg-muted transition-colors"
                        >
                          <span>{generationMode === "single" ? "From Single" : "From Multiple"}</span>
                          <ChevronRight className={cn("w-3 h-3 text-muted-foreground transition-transform", showModeSelect ? "-rotate-90" : "rotate-90")} />
                        </button>
                        {showModeSelect && (
                          <div className="absolute bottom-[calc(100%+8px)] left-0 min-w-[130px] bg-background border border-border rounded-xl shadow-xl overflow-hidden py-1 z-50 animate-in fade-in zoom-in-95 duration-100">
                            {[{v: "single", l: "From Single"}, {v: "four", l: "From Multiple"}].map(o => (
                              <button key={o.v} onClick={() => { setGenerationMode(o.v as GenerationMode); setShowModeSelect(false) }}
                                className={cn("w-full text-left px-3 py-2 text-xs transition-colors", generationMode === o.v ? "bg-muted text-foreground font-medium" : "text-muted-foreground hover:bg-muted hover:text-foreground")}
                              >{o.l}</button>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Model */}
                      <div className="relative media-dropdown-element">
                        <button
                          onClick={() => { setShowModelSelect(!showModelSelect); setShowModeSelect(false); setShowFormatSelect(false); setShowResolutionSelect(false); setShowTextureSelect(false) }}
                          className="flex items-center gap-2 bg-background border border-border text-foreground text-xs px-3 py-1 rounded-full hover:bg-muted transition-colors"
                        >
                          <span>{model}</span>
                          <ChevronRight className={cn("w-3 h-3 text-muted-foreground transition-transform", showModelSelect ? "-rotate-90" : "rotate-90")} />
                        </button>
                        {showModelSelect && (
                          <div className="absolute bottom-[calc(100%+8px)] left-0 min-w-[130px] bg-background border border-border rounded-xl shadow-xl overflow-hidden py-1 z-50 animate-in fade-in zoom-in-95 duration-100">
                            <button onClick={() => { setModel("koye-3dv1"); setShowModelSelect(false) }}
                              className={cn("w-full text-left px-3 py-2 text-xs transition-colors", model === "koye-3dv1" ? "bg-muted text-foreground font-medium" : "text-muted-foreground hover:bg-muted hover:text-foreground")}
                            >koye-3dv1</button>
                          </div>
                        )}
                      </div>

                      {/* Export Format */}
                      <div className="relative media-dropdown-element">
                        <button
                          onClick={() => { setShowFormatSelect(!showFormatSelect); setShowModeSelect(false); setShowModelSelect(false); setShowResolutionSelect(false); setShowTextureSelect(false) }}
                          className="flex items-center gap-2 bg-background border border-border text-foreground text-xs px-3 py-1 rounded-full hover:bg-muted transition-colors"
                        >
                          <span>.{format}</span>
                          <ChevronRight className={cn("w-3 h-3 text-muted-foreground transition-transform", showFormatSelect ? "-rotate-90" : "rotate-90")} />
                        </button>
                        {showFormatSelect && (
                          <div className="absolute bottom-[calc(100%+8px)] left-0 min-w-[90px] bg-background border border-border rounded-xl shadow-xl overflow-hidden py-1 z-50 animate-in fade-in zoom-in-95 duration-100">
                            {["glb","obj","stl","fbx"].map(f => (
                              <button key={f} onClick={() => { setFormat(f as ModelFormat); setShowFormatSelect(false) }}
                                className={cn("w-full text-left px-3 py-2 text-xs transition-colors", format === f ? "bg-muted text-foreground font-medium" : "text-muted-foreground hover:bg-muted hover:text-foreground")}
                              >.{f}</button>
                            ))}
                          </div>
                        )}
                      </div>
                    </>
                  )}

                  {sourceMode === "text" && (
                    <>
                      {/* Art Style */}
                      <div className="relative media-dropdown-element">
                        <button
                          onClick={() => { setShowArtStyleSelect(!showArtStyleSelect); setShowTopologySelect(false) }}
                          className="flex items-center gap-2 bg-background border border-border text-foreground text-xs px-3 py-1 rounded-full hover:bg-muted transition-colors"
                        >
                          <span className="capitalize">{artStyle}</span>
                          <ChevronRight className={cn("w-3 h-3 text-muted-foreground transition-transform", showArtStyleSelect ? "-rotate-90" : "rotate-90")} />
                        </button>
                        {showArtStyleSelect && (
                          <div className="absolute bottom-[calc(100%+8px)] left-0 min-w-[110px] bg-background border border-border rounded-xl shadow-xl overflow-hidden py-1 z-50 animate-in fade-in zoom-in-95 duration-100">
                            {[{v:"realistic",l:"Realistic"},{v:"sculpture",l:"Sculpture"}].map(o => (
                              <button key={o.v} onClick={() => { setArtStyle(o.v as any); setShowArtStyleSelect(false) }}
                                className={cn("w-full text-left px-3 py-2 text-xs transition-colors", artStyle === o.v ? "bg-muted text-foreground font-medium" : "text-muted-foreground hover:bg-muted hover:text-foreground")}
                              >{o.l}</button>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Topology */}
                      <div className="relative media-dropdown-element">
                        <button
                          onClick={() => { setShowTopologySelect(!showTopologySelect); setShowArtStyleSelect(false) }}
                          className="flex items-center gap-2 bg-background border border-border text-foreground text-xs px-3 py-1 rounded-full hover:bg-muted transition-colors"
                        >
                          <span className="capitalize">{topology}</span>
                          <ChevronRight className={cn("w-3 h-3 text-muted-foreground transition-transform", showTopologySelect ? "-rotate-90" : "rotate-90")} />
                        </button>
                        {showTopologySelect && (
                          <div className="absolute bottom-[calc(100%+8px)] left-0 min-w-[130px] bg-background border border-border rounded-xl shadow-xl overflow-hidden py-1 z-50 animate-in fade-in zoom-in-95 duration-100">
                            {[{v:"triangle",l:"Triangle"},{v:"quad",l:"Quad"}].map(o => (
                              <button key={o.v} onClick={() => { setTopology(o.v as any); setShowTopologySelect(false) }}
                                className={cn("w-full text-left px-3 py-2 text-xs transition-colors", topology === o.v ? "bg-muted text-foreground font-medium" : "text-muted-foreground hover:bg-muted hover:text-foreground")}
                              >{o.l}</button>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* PBR toggle */}
                      <button
                        onClick={() => setEnablePbr(!enablePbr)}
                        className={cn("px-3 py-1 rounded-full text-xs font-medium transition-all border",
                          enablePbr ? "bg-foreground text-background border-foreground" : "bg-background text-muted-foreground border-border hover:text-foreground"
                        )}
                      >PBR Maps</button>
                    </>
                  )}
                </div>

                {/* Right side controls */}
                <div className="flex items-center gap-2">
                  {sourceMode === "image" && (
                    <>
                      {/* Texture */}
                      <div className="relative media-dropdown-element">
                        <button
                          onClick={() => { setShowTextureSelect(!showTextureSelect); setShowModeSelect(false); setShowModelSelect(false); setShowFormatSelect(false); setShowResolutionSelect(false) }}
                          className="flex items-center gap-2 bg-background border border-border text-foreground text-xs px-3 py-1 rounded-full hover:bg-muted transition-colors"
                        >
                          <span>{generationType === "both" ? "With Texture" : generationType === "mesh" ? "No Texture" : "Texture Only"}</span>
                          <ChevronRight className={cn("w-3 h-3 text-muted-foreground transition-transform", showTextureSelect ? "-rotate-90" : "rotate-90")} />
                        </button>
                        {showTextureSelect && (
                          <div className="absolute bottom-[calc(100%+8px)] right-0 min-w-[130px] bg-background border border-border rounded-xl shadow-xl overflow-hidden py-1 z-50 animate-in fade-in zoom-in-95 duration-100">
                            {[{v:"both",l:"With Texture"},{v:"mesh",l:"No Texture"},{v:"texture",l:"Texture Only"}].map(o => (
                              <button key={o.v} onClick={() => { setGenerationType(o.v as GenerationType); setShowTextureSelect(false) }}
                                className={cn("w-full text-left px-3 py-2 text-xs transition-colors", generationType === o.v ? "bg-muted text-foreground font-medium" : "text-muted-foreground hover:bg-muted hover:text-foreground")}
                              >{o.l}</button>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Resolution */}
                      <div className="relative media-dropdown-element">
                        <button
                          onClick={() => { setShowResolutionSelect(!showResolutionSelect); setShowModeSelect(false); setShowModelSelect(false); setShowFormatSelect(false); setShowTextureSelect(false) }}
                          className="flex items-center gap-2 bg-background border border-border text-foreground text-xs px-3 py-1 rounded-full hover:bg-muted transition-colors"
                        >
                          <span>{resolution}³</span>
                          <ChevronRight className={cn("w-3 h-3 text-muted-foreground transition-transform", showResolutionSelect ? "-rotate-90" : "rotate-90")} />
                        </button>
                        {showResolutionSelect && (
                          <div className="absolute bottom-[calc(100%+8px)] right-0 min-w-[130px] bg-background border border-border rounded-xl shadow-xl overflow-hidden py-1 z-50 animate-in fade-in zoom-in-95 duration-100">
                            {[{v:"512",l:"512³"},{v:"1024",l:"1024³"},{v:"1536",l:"1536³"},{v:"1536Pro",l:"1536³ Pro"}].map(o => (
                              <button key={o.v} onClick={() => { setResolution(o.v as ModelResolution); setShowResolutionSelect(false) }}
                                className={cn("w-full text-left px-3 py-2 text-xs transition-colors", resolution === o.v ? "bg-muted text-foreground font-medium" : "text-muted-foreground hover:bg-muted hover:text-foreground")}
                              >{o.l}</button>
                            ))}
                          </div>
                        )}
                      </div>
                    </>
                  )}

                  {/* Generate Button */}
                  <button
                    onClick={handleGenerate}
                    disabled={isGenerating || !isAuthenticated}
                    className="bg-foreground text-background font-semibold text-xs px-5 py-1.5 rounded-full hover:bg-foreground/90 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                  >
                    {isGenerating && <div className="w-3 h-3 border-2 border-background border-t-transparent rounded-full animate-spin" />}
                    {isGenerating ? "Generating..." : isAuthenticated ? "Generate" : "Login"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

