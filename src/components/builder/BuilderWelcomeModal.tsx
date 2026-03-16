import { useEffect, useState } from "react"
import { cn } from "../../lib/utils"
import { Button } from "../ui/button"

interface BuilderWelcomeModalProps {
    isOpen: boolean
    onClose: () => void
}

export function BuilderWelcomeModal({ isOpen, onClose }: BuilderWelcomeModalProps) {
    const [countdown, setCountdown] = useState(3)
    const [canClose, setCanClose] = useState(false)

    useEffect(() => {
        if (isOpen) {
            setCountdown(3)
            setCanClose(false)

            const timer = setInterval(() => {
                setCountdown((prev) => {
                    if (prev <= 1) {
                        setCanClose(true)
                        clearInterval(timer)
                        return 0
                    }
                    return prev - 1
                })
            }, 1000)

            return () => clearInterval(timer)
        }
    }, [isOpen])

    if (!isOpen) return null

    return (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-300">
            <div className="w-full max-w-md bg-white border-4 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] animate-in zoom-in-95 duration-300">
                {/* Header */}
                <div className="border-b-4 border-black px-6 py-4 bg-black text-white">
                    <h2 className="text-xl font-bold font-mono tracking-wider">
                        🚀 BUILDER MODE
                    </h2>
                </div>

                {/* Content */}
                <div className="p-6 space-y-5">
                    <div className="space-y-3">
                        <p className="text-base font-mono font-bold text-black">
                            Welcome to the Builder!
                        </p>
                        <p className="text-sm font-mono text-black/80 leading-relaxed">
                            This is where you can <span className="font-bold text-black">view and interact</span> with your project files and folders.
                        </p>
                        <div className="bg-black/5 border-2 border-black/10 rounded p-3 space-y-2">
                            <p className="text-xs font-mono text-black/70">
                                ✨ <span className="font-bold">Real-time Sync:</span> This page is connected to your AI chat session
                            </p>
                            <p className="text-xs font-mono text-black/70">
                                🎮 <span className="font-bold">Run Projects:</span> Test and play your game directly here
                            </p>
                            <p className="text-xs font-mono text-black/70">
                                📁 <span className="font-bold">File Management:</span> Create, edit, and organize your assets
                            </p>
                        </div>
                    </div>

                    <div className="flex flex-col gap-2">
                        <Button
                            onClick={onClose}
                            disabled={!canClose}
                            className={cn(
                                "w-full font-mono font-bold text-sm py-3 border-2 border-black transition-all",
                                canClose
                                    ? "bg-black text-white hover:bg-gray-800 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[2px] hover:translate-y-[2px]"
                                    : "bg-gray-300 text-gray-500 cursor-not-allowed shadow-[4px_4px_0px_0px_rgba(0,0,0,0.2)]"
                            )}
                        >
                            {canClose ? "Got it!" : `Got it! (${countdown}s)`}
                        </Button>
                        {!canClose && (
                            <p className="text-xs font-mono text-center text-black/50">
                                Please wait {countdown} second{countdown !== 1 ? 's' : ''}...
                            </p>
                        )}
                    </div>
                </div>
            </div>
        </div>
    )
}
