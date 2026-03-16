import { ArcRotateCamera, Engine, HemisphericLight, Scene, Vector3 } from "@babylonjs/core"
import "@babylonjs/loaders"
import {
  ArrowLeft,
  Box,
  ChevronDown,
  Eye,
  EyeOff,
  Folder,
  Grid3x3,
  Layers,
  Lightbulb,
  Pause,
  Play,
  Square
} from "lucide-react"
import { useEffect, useRef, useState } from "react"
import { useNavigate, useSearchParams } from "react-router-dom"
import { Button } from "../components/ui/button"
import { useAuth } from "../hooks/useAuth"
import { cn } from "../lib/utils"

interface SceneNode {
  id: string
  name: string
  type: string
  icon: React.ReactNode
  children?: SceneNode[]
  visible?: boolean
}

export function GameEngine() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const engineRef = useRef<Engine | null>(null)
  const sceneRef = useRef<Scene | null>(null)
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { user } = useAuth()
  const projectId = searchParams.get("projectId")
  const projectName = searchParams.get("name") || "New Project"

  // UI State
  const [activeMode, setActiveMode] = useState<"2D" | "3D" | "Script" | "AssetLib">("3D")
  const [isPlaying, setIsPlaying] = useState(false)
  const [leftPanelTab, setLeftPanelTab] = useState<"Scene" | "FileSystem">("Scene")
  const [bottomPanelTab, setBottomPanelTab] = useState<"Output" | "Debugger" | "Audio" | "Animation" | "Shader Editor">("Animation")
  const [rightPanelTab, setRightPanelTab] = useState<"Inspector" | "Node" | "History">("Inspector")
  const [selectedNode, setSelectedNode] = useState<string | null>(null)
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set(["root"]))
  const [userModels, setUserModels] = useState<Array<{ id: string; url: string; format: string }>>([])
  const [loadedModels, setLoadedModels] = useState<Set<string>>(new Set())

  // Mock scene hierarchy (similar to Godot)
  const [sceneNodes, setSceneNodes] = useState<SceneNode[]>([
    {
      id: "root",
      name: "root",
      type: "Node3D",
      icon: <Box className="h-4 w-4" />,
      visible: true,
      children: [],
    },
  ])

  useEffect(() => {
    if (!canvasRef.current) return

    // Initialize Babylon.js engine
    const engine = new Engine(canvasRef.current, true, {
      preserveDrawingBuffer: true,
      stencil: true,
    })
    engineRef.current = engine

    // Create scene
    const scene = new Scene(engine)
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

    scene.activeCamera = camera
    camera.setTarget(Vector3.Zero())

    // Attach camera controls
    if (canvasRef.current && camera.inputs) {
      const inputs = camera.inputs as any
      try {
        if (inputs.attachElement) {
          inputs.attachElement(canvasRef.current)
        }
      } catch (e) {
        console.log("Camera inputs will work automatically")
      }
    }

    // Create light
    const light = new HemisphericLight("light", new Vector3(0, 1, 0), scene)
    light.intensity = 0.7

    // Empty scene - no default objects or models

    // Render loop
    engine.runRenderLoop(() => {
      scene.render()
    })

    // Handle window resize
    const handleResize = () => {
      engine.resize()
    }
    window.addEventListener("resize", handleResize)

    return () => {
      window.removeEventListener("resize", handleResize)
      scene.dispose()
      engine.dispose()
    }
  }, [])

  const toggleNodeVisibility = (nodeId: string) => {
    // Toggle visibility logic would go here
    console.log("Toggle visibility for node:", nodeId)
  }

  const toggleNodeExpansion = (nodeId: string) => {
    setExpandedNodes(prev => {
      const newSet = new Set(prev)
      if (newSet.has(nodeId)) {
        newSet.delete(nodeId)
      } else {
        newSet.add(nodeId)
      }
      return newSet
    })
  }

  const renderSceneNode = (node: SceneNode, level: number = 0) => {
    const isExpanded = expandedNodes.has(node.id)
    const hasChildren = node.children && node.children.length > 0

    return (
      <div key={node.id}>
        <div
          className={cn(
            "flex items-center gap-1 px-2 py-1 hover:bg-gray-700 cursor-pointer text-sm",
            selectedNode === node.id && "bg-blue-600"
          )}
          style={{ paddingLeft: `${level * 16 + 8}px` }}
          onClick={() => setSelectedNode(node.id)}
        >
          {hasChildren && (
            <button
              onClick={(e) => {
                e.stopPropagation()
                toggleNodeExpansion(node.id)
              }}
              className="p-0.5 hover:bg-gray-600 rounded"
            >
              <ChevronDown
                className={cn("h-3 w-3 transition-transform", !isExpanded && "-rotate-90")}
              />
            </button>
          )}
          {!hasChildren && <div className="w-4" />}
          <div className="text-gray-300">{node.icon}</div>
          <span className="text-gray-200 flex-1">{node.name}</span>
          <button
            onClick={(e) => {
              e.stopPropagation()
              toggleNodeVisibility(node.id)
            }}
            className="p-0.5 hover:bg-gray-600 rounded opacity-0 group-hover:opacity-100"
          >
            {node.visible ? (
              <Eye className="h-3 w-3 text-gray-400" />
            ) : (
              <EyeOff className="h-3 w-3 text-gray-600" />
            )}
          </button>
        </div>
        {hasChildren && isExpanded && (
          <div>
            {node.children!.map(child => renderSceneNode(child, level + 1))}
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="flex h-screen flex-col bg-gray-800 overflow-hidden">
      {/* Top Menu Bar */}
      <div className="shrink-0 bg-gray-900 border-b border-gray-700 px-4 py-2 flex items-center justify-between">
        <div className="flex items-center gap-6">
          {/* Menu Items */}
          <div className="flex items-center gap-4 text-sm text-gray-300">
            <button className="hover:text-white">Scene</button>
            <button className="hover:text-white">Project</button>
            <button className="hover:text-white">Debug</button>
            <button className="hover:text-white">Editor</button>
            <button className="hover:text-white">Help</button>
          </div>

          {/* Mode Selection */}
          <div className="flex items-center gap-1 bg-gray-800 rounded border border-gray-700 p-1">
            {(["2D", "3D", "Script", "AssetLib"] as const).map((mode) => (
              <button
                key={mode}
                onClick={() => setActiveMode(mode)}
                className={cn(
                  "px-3 py-1 text-xs font-medium rounded transition-colors",
                  activeMode === mode
                    ? "bg-blue-600 text-white"
                    : "text-gray-400 hover:text-white"
                )}
              >
                {mode}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-4">
          {/* Playback Controls */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsPlaying(!isPlaying)}
              className="p-2 hover:bg-gray-700 rounded text-gray-300 hover:text-white"
            >
              {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
            </button>
            <button className="p-2 hover:bg-gray-700 rounded text-gray-300 hover:text-white">
              <Square className="h-4 w-4" />
            </button>
          </div>

          {/* Platform Selector */}
          <select className="bg-gray-800 border border-gray-700 text-gray-300 text-xs px-2 py-1 rounded">
            <option>Mobile</option>
            <option>Desktop</option>
            <option>Web</option>
          </select>

          {/* Back Button */}
          <Button
            onClick={() => navigate("/dashboard?tab=projects")}
            variant="outline"
            className="border-gray-600 text-white hover:bg-gray-700 text-xs"
          >
            <ArrowLeft className="h-4 w-4 mr-1" />
            Back
          </Button>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex min-h-0 overflow-hidden">
        {/* Left Panel */}
        <div className="w-64 shrink-0 bg-gray-900 border-r border-gray-700 flex flex-col">
          {/* Tabs */}
          <div className="flex border-b border-gray-700">
            <button
              onClick={() => setLeftPanelTab("Scene")}
              className={cn(
                "px-4 py-2 text-xs font-medium border-b-2 transition-colors",
                leftPanelTab === "Scene"
                  ? "border-blue-500 text-white"
                  : "border-transparent text-gray-400 hover:text-white"
              )}
            >
              Scene
            </button>
            <button
              onClick={() => setLeftPanelTab("FileSystem")}
              className={cn(
                "px-4 py-2 text-xs font-medium border-b-2 transition-colors",
                leftPanelTab === "FileSystem"
                  ? "border-blue-500 text-white"
                  : "border-transparent text-gray-400 hover:text-white"
              )}
            >
              FileSystem
            </button>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto">
            {leftPanelTab === "Scene" ? (
              <div className="p-2">
                {sceneNodes.map(node => renderSceneNode(node))}
              </div>
            ) : (
              <div className="p-2">
                <div className="text-xs text-gray-400 mb-2">res://</div>
                <div className="space-y-1">
                  <div className="flex items-center gap-2 px-2 py-1 hover:bg-gray-800 cursor-pointer text-sm text-gray-300">
                    <Folder className="h-4 w-4" />
                    <span>arms</span>
                  </div>
                  <div className="flex items-center gap-2 px-2 py-1 hover:bg-gray-800 cursor-pointer text-sm text-gray-300">
                    <Folder className="h-4 w-4" />
                    <span>knife</span>
                  </div>
                  <div className="flex items-center gap-2 px-2 py-1 hover:bg-gray-800 cursor-pointer text-sm text-gray-300">
                    <Folder className="h-4 w-4" />
                    <span>pistol</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Center Viewport */}
        <div className="flex-1 flex flex-col min-w-0 bg-gray-950">
          {/* Viewport Header */}
          <div className="shrink-0 bg-gray-900 border-b border-gray-700 px-4 py-2 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-300">{projectName}</span>
                <button className="text-gray-500 hover:text-gray-300">
                  <ChevronDown className="h-4 w-4" />
                </button>
              </div>
              <div className="flex items-center gap-1">
                <button className="p-1.5 hover:bg-gray-800 rounded text-gray-400 hover:text-white">
                  <Grid3x3 className="h-4 w-4" />
                </button>
                <button className="p-1.5 hover:bg-gray-800 rounded text-gray-400 hover:text-white">
                  <Layers className="h-4 w-4" />
                </button>
                <button className="p-1.5 hover:bg-gray-800 rounded text-gray-400 hover:text-white">
                  <Lightbulb className="h-4 w-4" />
                </button>
              </div>
            </div>
            <div className="flex items-center gap-2 text-xs text-gray-400">
              <select className="bg-gray-800 border border-gray-700 text-gray-300 px-2 py-1 rounded">
                <option>Transform</option>
                <option>View</option>
              </select>
            </div>
          </div>

          {/* 3D Canvas */}
          <div className="flex-1 relative overflow-hidden bg-gray-950">
            <canvas
              ref={canvasRef}
              className="w-full h-full"
              style={{ outline: "none" }}
            />
            {/* Viewport Label */}
            <div className="absolute top-2 left-2 text-xs text-gray-500 font-mono">
              Perspective
            </div>
          </div>
        </div>

        {/* Right Panel - Inspector */}
        <div className="w-64 shrink-0 bg-gray-900 border-l border-gray-700 flex flex-col">
          {/* Tabs */}
          <div className="flex border-b border-gray-700">
            {(["Inspector", "Node", "History"] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setRightPanelTab(tab)}
                className={cn(
                  "px-3 py-2 text-xs font-medium border-b-2 transition-colors",
                  rightPanelTab === tab
                    ? "border-blue-500 text-white"
                    : "border-transparent text-gray-400 hover:text-white"
                )}
              >
                {tab}
              </button>
            ))}
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-4">
            {rightPanelTab === "Inspector" && (
              <div className="space-y-4">
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Filter Properties</label>
                  <input
                    type="text"
                    placeholder="Search..."
                    className="w-full bg-gray-800 border border-gray-700 text-gray-300 text-xs px-2 py-1 rounded"
                  />
                </div>
                {selectedNode ? (
                  <div className="text-xs text-gray-300">
                    <div className="text-gray-400 mb-2">Node Properties</div>
                    <div className="space-y-2">
                      <div>
                        <div className="text-gray-500">Name:</div>
                        <div className="text-gray-300">{selectedNode}</div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="text-xs text-gray-500 text-center py-8">
                    Select a node to view properties
                  </div>
                )}
              </div>
            )}
            {rightPanelTab === "Node" && (
              <div className="text-xs text-gray-400 text-center py-8">
                Node tab content
              </div>
            )}
            {rightPanelTab === "History" && (
              <div className="text-xs text-gray-400 text-center py-8">
                History tab content
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Bottom Panel */}
      <div className="shrink-0 h-48 bg-gray-900 border-t border-gray-700 flex flex-col">
        {/* Animation Controls */}
        <div className="shrink-0 bg-gray-950 border-b border-gray-700 px-4 py-2 flex items-center gap-4">
          <div className="flex items-center gap-2">
            <button className="p-1.5 hover:bg-gray-800 rounded text-gray-400 hover:text-white">
              <Square className="h-4 w-4 rotate-180" />
            </button>
            <button className="p-1.5 hover:bg-gray-800 rounded text-gray-400 hover:text-white">
              <Play className="h-4 w-4" />
            </button>
            <button className="p-1.5 hover:bg-gray-800 rounded text-gray-400 hover:text-white">
              <Pause className="h-4 w-4" />
            </button>
            <button className="p-1.5 hover:bg-gray-800 rounded text-gray-400 hover:text-white">
              <Square className="h-4 w-4" />
            </button>
          </div>
          <input
            type="number"
            value="0"
            className="w-16 bg-gray-800 border border-gray-700 text-gray-300 text-xs px-2 py-1 rounded"
          />
          <select className="bg-gray-800 border border-gray-700 text-gray-300 text-xs px-2 py-1 rounded">
            <option>Animation</option>
          </select>
          <button className="px-3 py-1 bg-gray-800 border border-gray-700 text-gray-300 text-xs rounded hover:bg-gray-700">
            Edit
          </button>
          <div className="flex-1 text-xs text-gray-500">
            Select an AnimationPlayer node to create and edit animations.
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-700">
          {(["Output", "Debugger", "Audio", "Animation", "Shader Editor"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setBottomPanelTab(tab)}
              className={cn(
                "px-4 py-2 text-xs font-medium border-b-2 transition-colors",
                bottomPanelTab === tab
                  ? "border-blue-500 text-white"
                  : "border-transparent text-gray-400 hover:text-white"
              )}
            >
              {tab}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        <div className="flex-1 overflow-y-auto p-4">
          {bottomPanelTab === "Animation" && (
            <div className="text-xs text-gray-400 text-center py-8">
              Animation editor content
            </div>
          )}
          {bottomPanelTab === "Output" && (
            <div className="text-xs text-gray-400 font-mono space-y-1">
              <div className="text-gray-500">Output:</div>
              <div className="text-gray-300">Engine initialized</div>
            </div>
          )}
          {bottomPanelTab === "Debugger" && (
            <div className="text-xs text-gray-400 text-center py-8">
              Debugger content
            </div>
          )}
          {bottomPanelTab === "Audio" && (
            <div className="text-xs text-gray-400 text-center py-8">
              Audio editor content
            </div>
          )}
          {bottomPanelTab === "Shader Editor" && (
            <div className="text-xs text-gray-400 text-center py-8">
              Shader editor content
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
