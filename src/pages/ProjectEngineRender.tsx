import { ArcRotateCamera, Engine, HemisphericLight, Scene, SceneLoader, Vector3 } from "@babylonjs/core"
import "@babylonjs/loaders"
import { useEffect, useRef, useState } from "react"
import { useSearchParams } from "react-router-dom"
import { useAuth } from "../hooks/useAuth"
import { loadProjectFilesFromStorage } from "../services/projectFiles"
import { useAppStore } from "../store/useAppStore"

export function ProjectEngineRender() {
    const canvasRef = useRef<HTMLCanvasElement>(null)
    const engineRef = useRef<Engine | null>(null)
    const sceneRef = useRef<Scene | null>(null)
    const [searchParams] = useSearchParams()
    const { user } = useAuth()
    const { generatedFiles, setGeneratedFiles, githubConnection } = useAppStore()

    const projectId = searchParams.get("projectId")
    const projectName = searchParams.get("name") || "Project"
    const [isLoading, setIsLoading] = useState(true)

    // Load project files on mount
    useEffect(() => {
        if (projectId && user) {
            const loadFiles = async () => {
                try {
                    // Try to load from storage
                    const files = await loadProjectFilesFromStorage(
                        projectId,
                        user.id,
                        githubConnection
                    )

                    if (Object.keys(files).length > 0) {
                        setGeneratedFiles(files)
                    } else {
                        // Fallback to localStorage
                        const storageKey = `project_${projectId}_files`
                        const savedData = localStorage.getItem(storageKey)
                        if (savedData) {
                            try {
                                const parsed = JSON.parse(savedData)
                                if (parsed.files && Object.keys(parsed.files).length > 0) {
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

            loadFiles()
        }
    }, [projectId, user, githubConnection, setGeneratedFiles])

    useEffect(() => {
        if (!canvasRef.current) return

        const initEngine = async () => {
            try {
                setIsLoading(true)

                // Initialize Babylon.js engine
                const engine = new Engine(canvasRef.current!, true, {
                    preserveDrawingBuffer: true,
                    stencil: true,
                })
                engineRef.current = engine

                // Create scene
                const scene = new Scene(engine)
                scene.clearColor.set(0.1, 0.1, 0.1, 1) // Dark background
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
                camera.lowerRadiusLimit = 1
                camera.upperRadiusLimit = 100

                // Create light
                const light = new HemisphericLight("light", new Vector3(0, 1, 0), scene)
                light.intensity = 1.0

                // Load project assets (NO placeholders)
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
                setIsLoading(false)
            }
        }

        initEngine()

        return () => {
            if (engineRef.current) {
                engineRef.current.dispose()
            }
        }
    }, [generatedFiles])

    const loadProjectAssets = async (scene: Scene) => {
        const files = generatedFiles

        // Process 3D models (.glb, .gltf, .obj)
        const modelFiles = Object.entries(files).filter(([path]) => {
            const ext = path.split('.').pop()?.toLowerCase()
            return ext === 'glb' || ext === 'gltf' || ext === 'obj'
        })

        for (const [path, content] of modelFiles) {
            try {
                if (content && (content.startsWith('http') || content.startsWith('data:') || content.startsWith('blob:'))) {
                    await SceneLoader.ImportMeshAsync("", "", content, scene)
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

        // Process audio files (.mp3, .wav)
        const audioFiles = Object.entries(files).filter(([path]) => {
            const ext = path.split('.').pop()?.toLowerCase()
            return ext === 'mp3' || ext === 'wav' || ext === 'ogg'
        })

        console.log(`Loaded: ${modelFiles.length} models, ${imageFiles.length} images, ${audioFiles.length} audio files`)

        // NO PLACEHOLDERS - Scene stays empty if no assets
    }

    return (
        <div className="fixed inset-0 bg-black flex flex-col">
            {/* Minimal Header */}
            <div className="bg-gray-900 border-b border-gray-700 px-4 py-2 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-3">
                    <h1 className="text-sm font-mono text-white">
                        {projectName}
                    </h1>
                    {isLoading && (
                        <span className="text-xs text-gray-400 font-mono animate-pulse">
                            Loading...
                        </span>
                    )}
                </div>
            </div>

            {/* Canvas - Full screen, no controls overlay */}
            <div className="flex-1 relative">
                <canvas
                    ref={canvasRef}
                    className="w-full h-full"
                    style={{ outline: "none", touchAction: "none" }}
                />
            </div>
        </div>
    )
}
