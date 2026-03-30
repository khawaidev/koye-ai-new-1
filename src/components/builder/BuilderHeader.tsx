import { Play, Redo, Undo } from "lucide-react"
import { cn } from "../../lib/utils"
import { Button } from "../ui/button"


interface BuilderHeaderProps {
    projectName: string
    onUndo: () => void
    onRedo: () => void
    onPlay: () => void
    canUndo: boolean
    canRedo: boolean
}

export function BuilderHeader({ projectName, onUndo, onRedo, onPlay, canUndo, canRedo }: BuilderHeaderProps) {


    return (
        <div className="h-14 border-b-2 border-border bg-background flex items-center justify-between px-6 shrink-0 font-mono text-foreground">
            <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-base tracking-tight text-foreground">KOYE<span className="font-extrabold">_</span>AI</span>
                    <span className="text-muted-foreground font-bold">/</span>
                    <span className="font-mono text-sm font-semibold text-foreground">{projectName}</span>
                </div>

                <div className="h-6 w-px bg-border mx-2" />

                <div className="flex items-center gap-1 border border-border rounded-md p-0.5 bg-muted/50">
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={onUndo}
                        disabled={!canUndo}
                        className={cn(
                            "h-7 w-7 hover:bg-muted border border-transparent hover:border-border",
                            !canUndo && "opacity-40 cursor-not-allowed"
                        )}
                        title="Undo"
                    >
                        <Undo className="h-3.5 w-3.5 text-foreground" />
                    </Button>
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={onRedo}
                        disabled={!canRedo}
                        className={cn(
                            "h-7 w-7 hover:bg-muted border border-transparent hover:border-border",
                            !canRedo && "opacity-40 cursor-not-allowed"
                        )}
                        title="Redo"
                    >
                        <Redo className="h-3.5 w-3.5 text-foreground" />
                    </Button>
                </div>
            </div>

            <div className="flex items-center gap-4">

                <Button
                    onClick={onPlay}
                    className="bg-background text-foreground hover:bg-muted font-mono text-xs font-bold flex items-center gap-2 px-4 py-2 border-2 border-foreground shadow-[4px_4px_0px_0px_currentColor] hover:shadow-[2px_2px_0px_0px_currentColor] hover:translate-x-[2px] hover:translate-y-[2px] transition-all rounded-none"
                >
                    <Play className="h-3.5 w-3.5 fill-foreground" />
                    PLAY
                </Button>
            </div>
        </div>
    )
}
