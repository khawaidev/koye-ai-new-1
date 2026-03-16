import { AnimatePresence, motion } from 'framer-motion'
import { Box, Gamepad2, Image as ImageIcon, Music, Video } from 'lucide-react'
import { useGameDevStore } from '../../store/useGameDevStore'

export function GameDevFlowUI() {
    const { isActive, currentStep } = useGameDevStore()

    if (!isActive) return null

    return (
        <div className="fixed inset-0 pointer-events-none z-50 flex items-center justify-center">
            <AnimatePresence>
                {/* Overlay for specific steps that require blocking interaction */}
                {(currentStep === 38) && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="absolute inset-0 bg-background/80 backdrop-blur-sm pointer-events-auto flex flex-col items-center justify-center"
                    >
                        <BeamingLoadingState />
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    )
}

function BeamingLoadingState() {
    return (
        <div className="relative flex items-center justify-center">
            {/* Central App Icon */}
            <div className="w-24 h-24 rounded-full bg-primary flex items-center justify-center z-10 shadow-[0_0_30px_rgba(var(--primary),0.5)]">
                <Gamepad2 className="w-12 h-12 text-primary-foreground" />
            </div>

            {/* Orbiting Icons */}
            <OrbitingIcon icon={ImageIcon} angle={0} delay={0} />
            <OrbitingIcon icon={Box} angle={90} delay={0.5} />
            <OrbitingIcon icon={Music} angle={180} delay={1} />
            <OrbitingIcon icon={Video} angle={270} delay={1.5} />

            <div className="absolute mt-48 text-xl font-bold animate-pulse">
                Building the game...
            </div>
        </div>
    )
}

function OrbitingIcon({ icon: Icon, angle, delay }: { icon: any, angle: number, delay: number }) {
    return (
        <motion.div
            className="absolute"
            animate={{ rotate: 360 }}
            transition={{ duration: 4, repeat: Infinity, ease: "linear", delay: -delay }}
            style={{ width: '200px', height: '200px' }}
        >
            <div
                className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 w-12 h-12 rounded-full bg-secondary border flex items-center justify-center"
                style={{ transform: `rotate(-${angle}deg)` }} // Counter-rotate to keep icon upright if needed, but here we want them to orbit
            >
                <Icon className="w-6 h-6" />
            </div>
        </motion.div>
    )
}
