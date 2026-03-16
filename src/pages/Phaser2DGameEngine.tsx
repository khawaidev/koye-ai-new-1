import { useEffect, useRef, useState } from "react"
import { useSearchParams, useNavigate } from "react-router-dom"
import Phaser from "phaser"
import { Button } from "../components/ui/button"
import { ArrowLeft, Play, Pause, Square, Settings } from "lucide-react"
import { cn } from "../lib/utils"
import { getUserImages } from "../services/multiDbDataService"
import { useAuth } from "../hooks/useAuth"

interface GameAsset {
  id: string
  url: string
  type: "sprite" | "image" | "background"
  x?: number
  y?: number
  width?: number
  height?: number
}

export function Phaser2DGameEngine() {
  const gameRef = useRef<Phaser.Game | null>(null)
  const canvasRef = useRef<HTMLDivElement>(null)
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { user } = useAuth()
  const [isPlaying, setIsPlaying] = useState(false)
  const [assets, setAssets] = useState<GameAsset[]>([])
  const [selectedAsset, setSelectedAsset] = useState<string | null>(null)

  // Load user's generated images/sprites
  useEffect(() => {
    const loadAssets = async () => {
      if (!user?.id) return

      try {
        // Load images from database
        const images = await getUserImages(user.id)
        const gameAssets: GameAsset[] = images.map((img) => ({
          id: img.id,
          url: img.url,
          type: "image" as const,
          x: 0,
          y: 0,
        }))
        setAssets(gameAssets)
      } catch (error) {
        console.error("Error loading assets:", error)
      }
    }

    loadAssets()
  }, [user?.id])

  // Initialize Phaser game
  useEffect(() => {
    if (!canvasRef.current || assets.length === 0) return

    // Destroy existing game if any
    if (gameRef.current) {
      gameRef.current.destroy(true)
      gameRef.current = null
    }

    class GameScene extends Phaser.Scene {
      private loadedAssets: Phaser.GameObjects.Image[] = []
      private selectedSprite: Phaser.GameObjects.Image | null = null

      constructor() {
        super({ key: "GameScene" })
      }

      preload() {
        // Preload all assets
        assets.forEach((asset) => {
          this.load.image(`asset_${asset.id}`, asset.url)
        })
      }

      create() {
        // Create a simple scene with loaded assets
        let x = 100
        let y = 150
        let assetIndex = 0

        assets.forEach((asset) => {
          const sprite = this.add.image(x, y, `asset_${asset.id}`)
          sprite.setInteractive({ useHandCursor: true })
          sprite.setScale(0.3)
          sprite.setData("assetId", asset.id)
          this.loadedAssets.push(sprite)

          // Add click handler
          sprite.on("pointerdown", () => {
            // Deselect previous
            if (this.selectedSprite) {
              this.selectedSprite.setTint(0xffffff)
            }
            // Select new
            sprite.setTint(0x00ff00)
            this.selectedSprite = sprite
            setSelectedAsset(asset.id)
          })

          // Add hover effect
          sprite.on("pointerover", () => {
            sprite.setScale(0.35)
          })
          sprite.on("pointerout", () => {
            if (sprite !== this.selectedSprite) {
              sprite.setScale(0.3)
            }
          })

          // Arrange assets in a grid
          x += 120
          assetIndex++
          if (assetIndex % 5 === 0) {
            x = 100
            y += 120
          }
        })

        // Add title
        this.add.text(400, 50, "2D Game Engine - Phaser", {
          fontSize: "28px",
          color: "#ffffff",
          fontFamily: "monospace",
        }).setOrigin(0.5)

        // Add instructions
        this.add.text(400, 550, "Click on assets to select them", {
          fontSize: "14px",
          color: "#aaaaaa",
          fontFamily: "monospace",
        }).setOrigin(0.5)

        // Add simple physics example - make sprites draggable
        this.input.on("dragstart", (pointer: Phaser.Input.Pointer, gameObject: Phaser.GameObjects.Image) => {
          gameObject.setTint(0xff00ff)
        })

        this.input.on("drag", (pointer: Phaser.Input.Pointer, gameObject: Phaser.GameObjects.Image, dragX: number, dragY: number) => {
          gameObject.x = dragX
          gameObject.y = dragY
        })

        this.input.on("dragend", (pointer: Phaser.Input.Pointer, gameObject: Phaser.GameObjects.Image) => {
          if (gameObject === this.selectedSprite) {
            gameObject.setTint(0x00ff00)
          } else {
            gameObject.setTint(0xffffff)
          }
        })

        // Make all sprites draggable
        this.loadedAssets.forEach((sprite) => {
          this.input.setDraggable(sprite)
        })
      }

      update() {
        // Game loop - can add animations here
        if (isPlaying) {
          // Add any game logic here when playing
        }
      }
    }

    const config: Phaser.Types.Core.GameConfig = {
      type: Phaser.AUTO,
      width: 800,
      height: 600,
      parent: canvasRef.current,
      backgroundColor: "#2c3e50",
      physics: {
        default: "arcade",
        arcade: {
          gravity: { y: 0 },
          debug: false,
        },
      },
      scene: GameScene,
    }

    gameRef.current = new Phaser.Game(config)

    return () => {
      if (gameRef.current) {
        gameRef.current.destroy(true)
        gameRef.current = null
      }
    }
  }, [assets, isPlaying])

  const handlePlay = () => {
    setIsPlaying(true)
    // Add play logic here
  }

  const handlePause = () => {
    setIsPlaying(false)
    // Add pause logic here
  }

  const handleStop = () => {
    setIsPlaying(false)
    // Add stop logic here
  }

  return (
    <div className="flex h-screen flex-col bg-gray-900 overflow-hidden">
      {/* Top Menu Bar */}
      <div className="shrink-0 bg-gray-800 border-b border-gray-700 px-4 py-2 flex items-center justify-between">
        <div className="flex items-center gap-6">
          <Button
            onClick={() => navigate("/dashboard?tab=projects")}
            variant="outline"
            className="border-gray-600 text-gray-300 hover:bg-gray-700"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>

          <div className="flex items-center gap-4 text-sm text-gray-300">
            <button className="hover:text-white">Scene</button>
            <button className="hover:text-white">Project</button>
            <button className="hover:text-white">Debug</button>
            <button className="hover:text-white">Editor</button>
          </div>
        </div>

        <div className="flex items-center gap-4">
          {/* Playback Controls */}
          <div className="flex items-center gap-2">
            {!isPlaying ? (
              <button
                onClick={handlePlay}
                className="p-2 hover:bg-gray-700 rounded text-gray-300 hover:text-white"
              >
                <Play className="h-4 w-4" />
              </button>
            ) : (
              <button
                onClick={handlePause}
                className="p-2 hover:bg-gray-700 rounded text-gray-300 hover:text-white"
              >
                <Pause className="h-4 w-4" />
              </button>
            )}
            <button
              onClick={handleStop}
              className="p-2 hover:bg-gray-700 rounded text-gray-300 hover:text-white"
            >
              <Square className="h-4 w-4" />
            </button>
          </div>

          <button className="p-2 hover:bg-gray-700 rounded text-gray-300 hover:text-white">
            <Settings className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex flex-1 min-h-0">
        {/* Left Sidebar - Assets */}
        <div className="w-64 bg-gray-800 border-r border-gray-700 overflow-y-auto">
          <div className="p-4">
            <h2 className="text-sm font-semibold text-gray-300 mb-3">Assets</h2>
            <div className="space-y-2">
              {assets.length === 0 ? (
                <p className="text-xs text-gray-500">No assets loaded</p>
              ) : (
                assets.map((asset) => (
                  <div
                    key={asset.id}
                    onClick={() => setSelectedAsset(asset.id)}
                    className={cn(
                      "p-2 rounded cursor-pointer transition-colors",
                      selectedAsset === asset.id
                        ? "bg-blue-600 text-white"
                        : "bg-gray-700 text-gray-300 hover:bg-gray-600"
                    )}
                  >
                    <div className="text-xs font-mono truncate">
                      {asset.type}: {asset.id.slice(0, 8)}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Center - Game Canvas */}
        <div className="flex-1 flex items-center justify-center bg-gray-900 p-4">
          <div ref={canvasRef} className="border-2 border-gray-700 rounded" />
        </div>

        {/* Right Sidebar - Inspector */}
        <div className="w-64 bg-gray-800 border-l border-gray-700 overflow-y-auto">
          <div className="p-4">
            <h2 className="text-sm font-semibold text-gray-300 mb-3">Inspector</h2>
            {selectedAsset ? (
              <div className="space-y-2 text-xs text-gray-400">
                <div>
                  <span className="text-gray-500">ID:</span>{" "}
                  <span className="font-mono">{selectedAsset}</span>
                </div>
                <div>
                  <span className="text-gray-500">Type:</span>{" "}
                  {assets.find((a) => a.id === selectedAsset)?.type}
                </div>
              </div>
            ) : (
              <p className="text-xs text-gray-500">Select an asset to inspect</p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

