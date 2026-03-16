import { Bone, Box, Check, Download, Image, Layers, Lock, MessageSquare, Music, Palette, Play, Wrench } from "lucide-react"
import React, { useRef } from "react"
import { cn } from "../../lib/utils"

export type WorkflowStage = "chat" | "images" | "model" | "texture" | "rig" | "animate" | "audio" | "export" | "build" | "sprites"

interface WorkflowStep {
  key: WorkflowStage
  label: string
  icon: React.ReactNode
  requiresAuth?: boolean
}

const steps3D: WorkflowStep[] = [
  { key: "chat", label: "Chat", icon: <MessageSquare className="h-5 w-5" />, requiresAuth: false },
  { key: "images", label: "Images", icon: <Image className="h-5 w-5" />, requiresAuth: true },
  { key: "model", label: "3D Model", icon: <Box className="h-5 w-5" />, requiresAuth: true },
  { key: "texture", label: "Texture", icon: <Palette className="h-5 w-5" />, requiresAuth: true },
  { key: "rig", label: "Rig", icon: <Bone className="h-5 w-5" />, requiresAuth: true },
  { key: "animate", label: "Animate", icon: <Play className="h-5 w-5" />, requiresAuth: true },
  { key: "audio", label: "Audio", icon: <Music className="h-5 w-5" />, requiresAuth: true },
  { key: "export", label: "Export", icon: <Download className="h-5 w-5" />, requiresAuth: true },
  { key: "build", label: "Build", icon: <Wrench className="h-5 w-5" />, requiresAuth: true },
]

const steps2D: WorkflowStep[] = [
  { key: "chat", label: "Chat", icon: <MessageSquare className="h-5 w-5" />, requiresAuth: false },
  { key: "images", label: "Images", icon: <Image className="h-5 w-5" />, requiresAuth: true },
  { key: "sprites", label: "Sprites", icon: <Layers className="h-5 w-5" />, requiresAuth: true },
  { key: "animate", label: "Animate", icon: <Play className="h-5 w-5" />, requiresAuth: true },
  { key: "audio", label: "Audio", icon: <Music className="h-5 w-5" />, requiresAuth: true },
  { key: "export", label: "Export", icon: <Download className="h-5 w-5" />, requiresAuth: true },
  { key: "build", label: "Build", icon: <Wrench className="h-5 w-5" />, requiresAuth: true },
]

interface WorkflowStepIndicatorProps {
  currentStage: WorkflowStage
  completedStages: Set<WorkflowStage>
  isAuthenticated: boolean
  isGameDevActive?: boolean
  gameDevStep?: number
  gameType?: "2d" | "3d" | null
  isGeneratingImages?: boolean  // NEW: True when images are being generated
  hasGeneratedImages?: boolean  // NEW: True when images have been successfully generated and displayed
}

function getStageForGameDevStep(step: number, gameType: "2d" | "3d" | null): WorkflowStage {
  if (gameType === "2d") {
    if (step <= 3) return "chat"
    if (step <= 8) return "images"
    if (step <= 13) return "sprites"
    if (step <= 13) return "animate" // Sprites cover animation in 2D
    if (step <= 18) return "audio"
    if (step <= 19) return "export"
    return "build"
  } else {
    if (step <= 3) return "chat"
    if (step <= 13) return "images"
    if (step <= 17) return "model"
    if (step <= 20) return "rig"
    if (step <= 26) return "animate"
    if (step <= 34) return "audio"
    if (step <= 37) return "export"
    return "build"
  }
}

export function WorkflowStepIndicator({
  currentStage,
  completedStages,
  isAuthenticated,
  isGameDevActive,
  gameDevStep = 0,
  gameType = "3d", // Default to 3D if not specified
  isGeneratingImages = false,
  hasGeneratedImages = false
}: WorkflowStepIndicatorProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const stepRefs = useRef<Map<WorkflowStage, React.RefObject<HTMLDivElement>>>(new Map())

  // Select steps based on game type
  const activeSteps = gameType === "2d" ? steps2D : steps3D

  // Initialize refs for each step
  activeSteps.forEach((step) => {
    if (!stepRefs.current.has(step.key)) {
      stepRefs.current.set(step.key, React.createRef<HTMLDivElement>())
    }
  })

  // Override currentStage if game dev flow is active
  // BUT: If generating images, stay on images stage regardless of step number
  const activeStage = isGameDevActive
    ? (isGeneratingImages && !hasGeneratedImages ? "images" : getStageForGameDevStep(gameDevStep, gameType))
    : currentStage

  return (
    <div className="bg-background h-full overflow-y-auto scrollbar-thin">
      <div ref={containerRef} className="relative flex flex-col items-center gap-2 pt-4 pb-8 bg-background">
        {activeSteps.map((step, index) => {
          const stepRef = stepRefs.current.get(step.key)!
          const isActive = step.key === activeStage

          // For game dev flow, stages before the active one are completed
          // SPECIAL CASE: "images" stage is only completed when hasGeneratedImages is true
          let isCompleted: boolean
          if (isGameDevActive) {
            const activeIndex = activeSteps.findIndex(s => s.key === activeStage)
            if (step.key === "images") {
              // Images stage only completed when images are actually generated
              isCompleted = hasGeneratedImages && activeIndex > index
            } else {
              isCompleted = activeIndex > index
            }
          } else {
            isCompleted = completedStages.has(step.key)
          }

          const shouldShowBeam = (isCompleted || isActive) && index < activeSteps.length - 1
          const isLocked = step.requiresAuth && !isAuthenticated

          return (
            <React.Fragment key={step.key}>
              <div
                ref={stepRef}
                className="relative flex flex-col items-center"
              >
                {/* Step Circle */}
                <div
                  className={cn(
                    "relative z-10 flex h-12 w-12 items-center justify-center rounded-full border-2 border-foreground transition-all font-mono",
                    isActive
                      ? "bg-foreground text-white dark:text-black scale-110 shadow-lg"
                      : isCompleted
                        ? "bg-foreground text-white dark:text-black"
                        : "bg-background text-foreground opacity-50",
                    isLocked && "opacity-60"
                  )}
                >
                  {isCompleted ? (
                    <Check className="h-6 w-6 text-white dark:text-black" />
                  ) : (
                    <div className={cn(
                      isActive ? "text-white dark:text-black" : "text-foreground"
                    )}>
                      {step.icon}
                    </div>
                  )}

                  {/* Lock Icon */}
                  {isLocked && (
                    <div className="absolute -top-1 -right-1 bg-foreground rounded-full p-0.5 border border-foreground">
                      <Lock className="h-3 w-3 text-background" />
                    </div>
                  )}
                </div>

                {/* Step Label */}
                <div
                  className={cn(
                    "mt-2 text-xs font-medium transition-all whitespace-nowrap font-mono",
                    isActive
                      ? "text-foreground"
                      : isCompleted
                        ? "text-foreground/70"
                        : "text-foreground/40"
                  )}
                >
                  {step.label}
                </div>
              </div>

              {/* Granular Step Indicator for Game Dev Flow removed as per user request */}

              {/* Vertical Line between steps with animated beam */}
              {index < activeSteps.length - 1 && (
                <div className="relative h-12 w-0.5">
                  <div
                    className={cn(
                      "absolute inset-0 transition-all border-l border-foreground",
                      shouldShowBeam
                        ? "border-foreground"
                        : "border-foreground/30"
                    )}
                  />
                  {shouldShowBeam && (
                    <div
                      className="absolute inset-0 bg-gradient-to-b from-foreground/60 via-foreground/40 to-transparent animate-pulse"
                      style={{
                        animation: "shimmer 2s ease-in-out infinite",
                      }}
                    />
                  )}
                </div>
              )}
            </React.Fragment>
          )
        })}
      </div>
    </div>
  )
}
