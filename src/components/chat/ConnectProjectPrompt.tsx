import { Folder, Plus } from "lucide-react"
import { Button } from "../ui/button"

interface ConnectProjectPromptProps {
    onConnectClick: () => void
    onCreateClick: () => void
}

export function ConnectProjectPrompt({ onConnectClick, onCreateClick }: ConnectProjectPromptProps) {
    return (
        <div className="flex flex-col gap-3 p-4 bg-muted/30 border-2 border-border rounded-lg">
            <p className="text-sm font-mono font-bold text-foreground">
                🔗 Project Connection Required
            </p>
            <p className="text-xs font-mono text-muted-foreground">
                To save and organize your game assets, please connect or create a project.
            </p>
            <div className="flex gap-2">
                <Button
                    onClick={onConnectClick}
                    className="flex items-center gap-2 text-xs font-mono bg-background text-foreground border-2 border-border hover:bg-foreground hover:text-background transition-colors shadow-[2px_2px_0px_0px_hsl(var(--border))] hover:shadow-[1px_1px_0px_0px_hsl(var(--border))]"
                >
                    <Folder className="h-3.5 w-3.5" />
                    Connect Project
                </Button>
                <Button
                    onClick={onCreateClick}
                    className="flex items-center gap-2 text-xs font-mono bg-background text-foreground border-2 border-border hover:bg-foreground hover:text-background transition-colors shadow-[2px_2px_0px_0px_hsl(var(--border))] hover:shadow-[1px_1px_0px_0px_hsl(var(--border))]"
                >
                    <Plus className="h-3.5 w-3.5" />
                    Create Project
                </Button>
            </div>
        </div>
    )
}
