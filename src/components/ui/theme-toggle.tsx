import { Moon, Sun } from "lucide-react"
import { cn } from "../../lib/utils"
import { useTheme } from "../theme-provider"

export function ThemeToggle({ className }: { className?: string }) {
    const { theme, setTheme } = useTheme()

    return (
        <button
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            className={cn(
                "relative h-10 w-10 flex items-center justify-center border-2 border-primary bg-background text-primary hover:bg-primary hover:text-primary-foreground transition-all duration-200",
                // Terminal style: square corners, maybe a slight shadow
                "rounded-none shadow-[2px_2px_0px_0px_var(--primary)] active:translate-x-[1px] active:translate-y-[1px] active:shadow-none",
                className
            )}
            title="Toggle Theme"
            aria-label="Toggle Theme"
        >
            <Sun className="h-[1.2rem] w-[1.2rem] rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
            <Moon className="absolute h-[1.2rem] w-[1.2rem] rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
            <span className="sr-only">Toggle theme</span>
        </button>
    )
}
