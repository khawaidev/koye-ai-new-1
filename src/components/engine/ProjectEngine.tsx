import { ArcRotateCamera, Engine, HemisphericLight, MeshBuilder, Scene, SceneLoader, StandardMaterial, Texture, Vector3 } from "@babylonjs/core"
import "@babylonjs/loaders"
import { X } from "lucide-react"
import { useEffect, useRef, useState } from "react"
import { useAppStore } from "../../store/useAppStore"

interface ProjectEngineProps {
    projectId: string
    projectName: string
    onClose?: () => void
}

export function ProjectEngine({ projectId, projectName, onClose }: ProjectEngineProps) {
    const canvasRef = useRef<HTMLCanvasElement>(null)
    const engineRef = useRef<Engine | null>(null)
    const sceneRef = useRef<Scene | null>(null)
    const { generatedFiles } = useAppStore()
    const [isLoading, setIsLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)

    useEffect(() => {
        if (!canvasRef.current) return

        const initEngine = async () => {
            try {
                setIsLoading(true)
                setError(null)

                // Initialize Babylon.js engine
                const engine = new Engine(canvasRef.current!, true, {
                    preserveDrawingBuffer: true,
                    stencil: true,
                })
                engineRef.current = engine

                // Create scene
                const scene = new Scene(engine)
                scene.clearColor.set(0.95, 0.95, 0.95, 1) // Light gray background
                sceneRef.current = scene

                // Create camera
                const camera = new ArcRotateCamera(
                    "camera",
                    -Math.PI / 2,
                    Math.PI / 2.5,
                    10,
                    Vector3.Zero(),
                    scene
                )
                camera.attachControl(canvasRef.current!, true)
                camera.lowerRadiusLimit = 2
                camera.upperRadiusLimit = 50

                // Create light
                const light = new HemisphericLight("light", new Vector3(0, 1, 0), scene)
                light.intensity = 0.8

                // Create ground
                const ground = MeshBuilder.CreateGround("ground", { width: 20, height: 20 }, scene)
                const groundMaterial = new StandardMaterial("groundMat", scene)
                groundMaterial.diffuseColor.set(0.7, 0.7, 0.7)
                groundMaterial.specularColor.set(0, 0, 0)
                ground.material = groundMaterial

                // Load project assets
                await loadProjectAssets(scene)

                // Start render loop
                engine.runRenderLoop(() => {
                    scene.render()
                })

                // Handle window resize
                const handleResize = () => {
                    engine.resize()
                }
                window.addEventListener("resize", handleResize)

                setIsLoading(false)

                return () => {
                    window.removeEventListener("resize", handleResize)
                    engine.dispose()
                }
            } catch (err) {
                console.error("Error initializing engine:", err)
                setError(err instanceof Error ? err.message : "Failed to initialize engine")
                setIsLoading(false)
            }
        }

        initEngine()

        return () => {
            if (engineRef.current) {
                engineRef.current.dispose()
            }
        }
    }, [projectId])

    const loadProjectAssets = async (scene: Scene) => {
        // Load all project files and assets
        const files = generatedFiles

        // Process 3D models (.glb, .gltf, .obj)
        const modelFiles = Object.entries(files).filter(([path]) => {
            const ext = path.split('.').pop()?.toLowerCase()
            return ext === 'glb' || ext === 'gltf' || ext === 'obj'
        })

        let modelCount = 0
        for (const [path, content] of modelFiles) {
            try {
                // If content is a URL or data URL, load it
                if (content && (content.startsWith('http') || content.startsWith('data:') || content.startsWith('blob:'))) {
                    const result = await SceneLoader.ImportMeshAsync(
                        "",
                        "",
                        content,
                        scene
                    )

                    // Position models in a row
                    if (result.meshes.length > 0) {
                        const rootMesh = result.meshes[0]
                        rootMesh.position.x = modelCount * 3 - ((modelFiles.length - 1) * 1.5)
                        rootMesh.position.y = 1
                        modelCount++
                    }
                }
            } catch (err) {
                console.error(`Error loading model ${path}:`, err)
            }
        }

        // Process textures/images (.png, .jpg)
        const imageFiles = Object.entries(files).filter(([path]) => {
            const ext = path.split('.').pop()?.toLowerCase()
            return ext === 'png' || ext === 'jpg' || ext === 'jpeg'
        })

        // Create planes with textures
        let imageCount = 0
        for (const [path, content] of imageFiles) {
            try {
                if (content && (content.startsWith('http') || content.startsWith('data:') || content.startsWith('blob:'))) {
                    const plane = MeshBuilder.CreatePlane(
                        `image_${imageCount}`,
                        { width: 2, height: 2 },
                        scene
                    )

                    const material = new StandardMaterial(`imageMat_${imageCount}`, scene)
                    material.diffuseTexture = new Texture(content, scene)
                    material.emissiveTexture = material.diffuseTexture
                    material.specularColor.set(0, 0, 0)
                    plane.material = material

                    // Position in a separate row
                    plane.position.x = imageCount * 3 - ((imageFiles.length - 1) * 1.5)
                    plane.position.y = 3
                    plane.position.z = -5

                    imageCount++
                }
            } catch (err) {
                console.error(`Error loading image ${path}:`, err)
            }
        }

        // Process audio files (.mp3, .wav)
        const audioFiles = Object.entries(files).filter(([path]) => {
            const ext = path.split('.').pop()?.toLowerCase()
            return ext === 'mp3' || ext === 'wav' || ext === 'ogg'
        })

        // Add audio to scene (Babylon.js Sound API can be used here if needed)
        console.log(`Found ${audioFiles.length} audio files`)

        // If no assets were loaded, show a placeholder
        if (modelCount === 0 && imageCount === 0) {
            // Create a simple cube as placeholder
            const box = MeshBuilder.CreateBox("placeholderBox", { size: 2 }, scene)
            const material = new StandardMaterial("boxMat", scene)
            material.diffuseColor.set(0.4, 0.6, 0.9)
            box.material = material
            box.position.y = 1
        }
    }

    return (
        <div className="fixed inset-0 bg-black/90 z-50 flex flex-col">
            {/* Header */}
            <div className="bg-background border-b-2 border-border px-6 py-3 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-3">
                    <h1 className="text-lg font-bold text-foreground font-mono">
                        {projectName} - Engine Preview
                    </h1>
                    {isLoading && (
                        <span className="text-xs text-muted-foreground font-mono animate-pulse">
                            Loading assets...
                        </span>
                    )}
                </div>
                <button
                    onClick={onClose}
                    className="p-2 hover:bg-muted rounded transition-colors"
                    title="Close engine"
                >
                    <X className="h-5 w-5 text-foreground" />
                </button>
            </div>

            {/* Canvas */}
            <div className="flex-1 relative">
                <canvas
                    ref={canvasRef}
                    className="w-full h-full"
                    style={{ outline: "none", touchAction: "none" }}
                />

                {error && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/50">
                        <div className="bg-background border-2 border-red-600 p-6 max-w-md">
                            <h3 className="text-lg font-bold text-red-600 mb-2 font-mono">Error</h3>
                            <p className="text-sm text-foreground font-mono">{error}</p>
                        </div>
                    </div>
                )}

                {/* Controls Info */}
                <div className="absolute bottom-4 left-4 bg-background/90 border-2 border-border px-4 py-2 font-mono text-xs">
                    <p className="text-foreground font-bold mb-1">Controls:</p>
                    <p className="text-muted-foreground">• Left Mouse: Rotate camera</p>
                    <p className="text-muted-foreground">• Mouse Wheel: Zoom in/out</p>
                    <p className="text-muted-foreground">• Right Mouse: Pan camera</p>
                </div>
            </div>
        </div>
    )
}
