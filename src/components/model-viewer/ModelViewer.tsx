import { Environment, OrbitControls, PerspectiveCamera } from "@react-three/drei"
import { Canvas } from "@react-three/fiber"
import { X } from "lucide-react"
import { useEffect, useRef, useState } from "react"
import * as THREE from "three"
import { DRACOLoader, FBXLoader, GLTFLoader, OBJLoader } from "three-stdlib"
import type { Model } from "../../store/useAppStore"

interface ModelViewerProps {
  model: Model | null
  onExport?: (format: "glb" | "fbx" | "obj") => void
  onClose?: () => void
}

interface ModelGeometry {
  vertices: number
  faces: number
}

// ============ IndexedDB Model Cache ============

const DB_NAME = 'koye-model-cache'
const DB_VERSION = 1
const STORE_NAME = 'models'

function openCacheDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)
    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME)
      }
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

async function getCachedModel(url: string): Promise<ArrayBuffer | null> {
  try {
    const db = await openCacheDB()
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readonly')
      const store = tx.objectStore(STORE_NAME)
      const req = store.get(url)
      req.onsuccess = () => resolve(req.result || null)
      req.onerror = () => resolve(null)
    })
  } catch {
    return null
  }
}

async function cacheModel(url: string, data: ArrayBuffer): Promise<void> {
  try {
    const db = await openCacheDB()
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite')
      const store = tx.objectStore(STORE_NAME)
      const req = store.put(data, url)
      req.onsuccess = () => resolve()
      req.onerror = () => reject(req.error)
    })
  } catch {
    // Silently fail — cache is optional
  }
}

// ============ Three.js Helpers ============

let _dracoLoader: DRACOLoader | null = null
function getDracoLoader() {
  if (!_dracoLoader) {
    _dracoLoader = new DRACOLoader()
    _dracoLoader.setDecoderPath("https://www.gstatic.com/draco/v1/decoders/")
  }
  return _dracoLoader
}

function SceneContent({ scene }: { scene: THREE.Object3D }) {
  return <primitive object={scene} />
}

// ============ Load State ============

type LoadState =
  | { status: 'loading'; message: string }
  | { status: 'ready'; scene: THREE.Object3D; geometry: ModelGeometry }
  | { status: 'error'; message: string }

// ============ Main Component ============

export function ModelViewer({ model, onClose }: ModelViewerProps) {
  const [loadState, setLoadState] = useState<LoadState>({ status: 'loading', message: 'Initializing...' })
  const currentUrlRef = useRef<string | null>(null)

  useEffect(() => {
    if (!model?.url) return

    const url = model.url
    const format = model.format || 'glb'

    // If we already loaded this URL successfully, don't reload
    if (currentUrlRef.current === url && loadState.status === 'ready') return

    currentUrlRef.current = url
    let cancelled = false

    const controller = new AbortController()

    const loadModel = async () => {
      try {
        // Step 1: Check cache first
        setLoadState({ status: 'loading', message: 'Checking cache...' })
        let arrayBuffer = await getCachedModel(url)

        if (cancelled) return

        if (arrayBuffer) {
          console.log("[ModelViewer] Loaded from cache:", arrayBuffer.byteLength, "bytes")
          setLoadState({ status: 'loading', message: 'Parsing cached model...' })
        } else {
          // Step 2: Download from network
          setLoadState({ status: 'loading', message: 'Downloading model file...' })
          console.log("[ModelViewer] Fetching:", url)

          const resp = await fetch(url, { signal: controller.signal })
          if (!resp.ok) throw new Error(`Download failed: HTTP ${resp.status} ${resp.statusText}`)

          if (cancelled) return

          arrayBuffer = await resp.arrayBuffer()
          if (cancelled) return

          console.log("[ModelViewer] Downloaded:", arrayBuffer.byteLength, "bytes")

          // Cache for next time (fire-and-forget)
          cacheModel(url, arrayBuffer).catch(() => { })

          setLoadState({ status: 'loading', message: 'Parsing model data...' })
        }

        // Step 3: Parse with appropriate loader
        let loadedScene: THREE.Object3D

        if (format === 'fbx') {
          const loader = new FBXLoader()
          loadedScene = loader.parse(arrayBuffer, '')
        } else if (format === 'obj') {
          const loader = new OBJLoader()
          const text = new TextDecoder().decode(arrayBuffer)
          loadedScene = loader.parse(text)
        } else {
          const loader = new GLTFLoader()
          loader.setDRACOLoader(getDracoLoader())

          loadedScene = await new Promise<THREE.Object3D>((resolve, reject) => {
            loader.parse(
              arrayBuffer!,
              '',
              (gltf) => {
                console.log("[ModelViewer] GLTF parsed successfully")
                resolve(gltf.scene)
              },
              (err) => {
                console.error("[ModelViewer] GLTF parse error:", err)
                reject(new Error(typeof err === 'string' ? err : (err as any)?.message || 'Failed to parse GLB/GLTF'))
              }
            )
          })
        }

        if (cancelled) return

        // Step 4: Auto-center and scale
        const box = new THREE.Box3().setFromObject(loadedScene)
        const center = box.getCenter(new THREE.Vector3())
        const size = box.getSize(new THREE.Vector3())
        const maxDim = Math.max(size.x, size.y, size.z)

        if (maxDim > 0) {
          const scale = 3 / maxDim
          loadedScene.scale.setScalar(scale)
          loadedScene.position.set(
            -center.x * scale,
            -center.y * scale,
            -center.z * scale
          )
        }

        // Step 5: Count geometry
        let totalVertices = 0
        let totalFaces = 0
        loadedScene.traverse((child: any) => {
          if (child.isMesh && child.geometry) {
            const geom = child.geometry
            if (geom.attributes?.position) {
              totalVertices += geom.attributes.position.count
            }
            if (geom.index) {
              totalFaces += geom.index.count / 3
            } else if (geom.attributes?.position) {
              totalFaces += geom.attributes.position.count / 3
            }
          }
        })

        if (cancelled) return

        console.log("[ModelViewer] Ready. Vertices:", totalVertices, "Faces:", Math.floor(totalFaces))

        setLoadState({
          status: 'ready',
          scene: loadedScene,
          geometry: { vertices: totalVertices, faces: Math.floor(totalFaces) }
        })

      } catch (err: any) {
        if (cancelled || err.name === 'AbortError') return
        console.error("[ModelViewer] Load failed:", err)
        setLoadState({ status: 'error', message: err.message || 'Unknown error loading model' })
      }
    }

    loadModel()

    return () => {
      cancelled = true
      controller.abort()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [model?.url, model?.format])

  if (!model) {
    return (
      <div className="flex h-full items-center justify-center bg-muted/20 font-mono">
        <p className="text-muted-foreground/60 text-sm">No model loaded</p>
      </div>
    )
  }

  return (
    <div className="relative flex h-full w-full flex-col bg-background">
      {onClose && (
        <div className="absolute top-4 right-4 z-20">
          <button
            onClick={onClose}
            className="rounded-md bg-muted/50 p-2 text-foreground hover:bg-muted transition-colors border border-border"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      <div className="flex-1 w-full h-full relative">
        {/* Loading state */}
        {loadState.status === 'loading' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center z-10 bg-background font-mono gap-3">
            <div className="h-8 w-8 rounded-full border-t-2 border-r-2 border-foreground animate-spin"></div>
            <p className="text-muted-foreground text-xs">{loadState.message}</p>
          </div>
        )}

        {/* Error state */}
        {loadState.status === 'error' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center z-10 bg-background font-mono gap-4 p-8">
            <div className="bg-background p-6 rounded-lg border border-destructive/50 max-w-md flex flex-col items-center space-y-3 shadow-xl">
              <p className="text-destructive font-bold text-sm text-center">Failed to load the 3D model</p>
              <pre className="text-[10px] text-destructive/80 bg-destructive/10 p-2 rounded max-w-full overflow-auto break-all whitespace-pre-wrap">{loadState.message}</pre>
              <p className="text-muted-foreground text-[10px] text-center break-all">URL: {model.url}</p>
              <button
                onClick={() => {
                  currentUrlRef.current = null
                  setLoadState({ status: 'loading', message: 'Retrying...' })
                }}
                className="w-full px-3 py-2 text-xs font-bold bg-foreground text-background border-2 border-border rounded hover:opacity-90 transition-opacity"
              >
                Retry
              </button>
            </div>
          </div>
        )}

        {/* 3D Canvas - only when model is ready */}
        {loadState.status === 'ready' && (
          <>
            <Canvas className="w-full h-full z-0 cursor-move">
              <PerspectiveCamera makeDefault position={[0, 0, 5]} />
              <ambientLight intensity={0.6} />
              <directionalLight position={[10, 10, 5]} intensity={1} />
              <Environment preset="city" />
              <SceneContent scene={loadState.scene} />
              <OrbitControls enablePan enableZoom enableRotate makeDefault />
            </Canvas>

            {/* Geometry overlay */}
            <div className="absolute bottom-4 left-4 z-20 bg-background/80 backdrop-blur-sm border border-border rounded-md p-3 font-mono text-xs space-y-1">
              <div className="flex justify-between gap-6">
                <span className="text-muted-foreground">Vertices</span>
                <span className="text-foreground font-semibold">{loadState.geometry.vertices.toLocaleString()}</span>
              </div>
              <div className="flex justify-between gap-6">
                <span className="text-muted-foreground">Faces</span>
                <span className="text-foreground font-semibold">{loadState.geometry.faces.toLocaleString()}</span>
              </div>
              <div className="flex justify-between gap-6">
                <span className="text-muted-foreground">Format</span>
                <span className="text-foreground font-semibold uppercase">{model.format || 'glb'}</span>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
