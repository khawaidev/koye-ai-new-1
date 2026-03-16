import { useEffect, useState } from "react"
import appIcon from "../../assets/icon.jpg"
import { cn } from "../../lib/utils"

interface Model3DGenerationLoaderProps {
    isVisible: boolean
    phase?: "preparing" | "generating" | "processing" | "finalizing"
}

export function Model3DGenerationLoader({ isVisible, phase = "preparing" }: Model3DGenerationLoaderProps) {
    const [animationProgress, setAnimationProgress] = useState(0)
    const [rotationAngle, setRotationAngle] = useState(0)

    // Phase-based progress ranges
    const phaseProgress = {
        preparing: 10,
        generating: 40,
        processing: 70,
        finalizing: 95
    }

    const phaseMessages = {
        preparing: "Preparing model generation...",
        generating: "Generating 3D mesh...",
        processing: "Processing geometry...",
        finalizing: "Finalizing textures..."
    }

    useEffect(() => {
        if (!isVisible) {
            setAnimationProgress(0)
            setRotationAngle(0)
            return
        }

        // Animate progress based on phase
        const targetProgress = phaseProgress[phase]
        const duration = 1500
        const startTime = Date.now()
        const startProgress = animationProgress

        const animate = () => {
            const elapsed = Date.now() - startTime
            const progress = Math.min(
                startProgress + ((targetProgress - startProgress) * elapsed / duration),
                targetProgress
            )
            setAnimationProgress(progress)

            if (progress < targetProgress) {
                requestAnimationFrame(animate)
            }
        }

        animate()
    }, [isVisible, phase])

    // Continuous rotation animation
    useEffect(() => {
        if (!isVisible) return

        const interval = setInterval(() => {
            setRotationAngle(prev => (prev + 2) % 360)
        }, 50)

        return () => clearInterval(interval)
    }, [isVisible])

    if (!isVisible) return null

    return (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 backdrop-blur-sm pointer-events-auto">
            {/* Blur overlay - blocks all interactions */}
            <div className="absolute inset-0 bg-black/20 backdrop-blur-md pointer-events-auto" />

            {/* Loading content */}
            <div className="relative z-10 flex flex-col items-center gap-8">
                {/* Icons and beam */}
                <div className="relative flex items-center gap-32">
                    {/* App Icon (source) */}
                    <div className="relative z-10">
                        <div className="relative w-16 h-16 rounded-lg bg-white border-2 border-black shadow-2xl p-2">
                            <img
                                src={appIcon}
                                alt="KOYE AI"
                                className="w-full h-full object-contain"
                            />
                            {/* Pulsing glow effect */}
                            <div className="absolute inset-0 rounded-lg bg-white animate-pulse opacity-50" />
                        </div>
                    </div>

                    {/* Beam animation */}
                    <div className="absolute left-16 right-16 h-1 bg-gradient-to-r from-orange-400 via-yellow-300 to-transparent opacity-0 transition-opacity duration-300"
                        style={{
                            opacity: animationProgress > 10 ? 1 : 0,
                            background: `linear-gradient(to right, 
                   rgba(251, 146, 60, ${Math.min(animationProgress / 50, 1)}), 
                   rgba(250, 204, 21, ${Math.max(0, (animationProgress - 50) / 50)}), 
                   transparent)`
                        }}
                    >
                        {/* Animated beam particle */}
                        <div
                            className="absolute top-1/2 -translate-y-1/2 w-3 h-3 bg-orange-400 rounded-full shadow-lg"
                            style={{
                                left: `${animationProgress}%`,
                                transform: 'translate(-50%, -50%)',
                                boxShadow: '0 0 20px rgba(251, 146, 60, 0.8)',
                                transition: 'left 0.1s linear'
                            }}
                        />
                    </div>

                    {/* 3D Model Icon (destination) - with rotation */}
                    <div className={cn(
                        "relative z-10 transition-all duration-500",
                        animationProgress > 80 ? "scale-110" : "scale-100"
                    )}>
                        <div className={cn(
                            "relative w-16 h-16 rounded-lg bg-white border-2 border-black shadow-2xl p-2 transition-all duration-500",
                            animationProgress > 80 ? "border-orange-400 shadow-[0_0_30px_rgba(251,146,60,0.8)]" : ""
                        )}>
                            {/* 3D Cube Icon with rotation */}
                            <div
                                className="w-full h-full flex items-center justify-center"
                                style={{ transform: `rotateY(${rotationAngle}deg)` }}
                            >
                                <svg
                                    className="w-10 h-10 text-foreground"
                                    fill="none"
                                    stroke="currentColor"
                                    viewBox="0 0 24 24"
                                >
                                    {/* 3D Cube */}
                                    <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        strokeWidth={2}
                                        d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"
                                    />
                                </svg>
                            </div>
                            {/* Pulsing glow effect when reached */}
                            {animationProgress > 80 && (
                                <div className="absolute inset-0 rounded-lg bg-orange-400 animate-pulse opacity-50" />
                            )}
                        </div>
                    </div>
                </div>

                {/* Progress bar */}
                <div className="w-64 h-2 bg-black/30 rounded-full overflow-hidden">
                    <div
                        className="h-full bg-gradient-to-r from-orange-400 to-yellow-400 transition-all duration-300"
                        style={{ width: `${animationProgress}%` }}
                    />
                </div>

                {/* Loading text */}
                <div className="text-center">
                    <p className="text-white font-mono text-lg font-bold mb-2">
                        $ {phaseMessages[phase]}
                    </p>
                    <div className="flex gap-1 justify-center">
                        <div className="w-2 h-2 bg-orange-400 rounded-full animate-bounce" style={{ animationDelay: '0s' }} />
                        <div className="w-2 h-2 bg-yellow-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }} />
                        <div className="w-2 h-2 bg-orange-400 rounded-full animate-bounce" style={{ animationDelay: '0.4s' }} />
                    </div>
                    <p className="text-white/60 font-mono text-sm mt-2">
                        {Math.round(animationProgress)}% complete
                    </p>
                </div>
            </div>
        </div>
    )
}
