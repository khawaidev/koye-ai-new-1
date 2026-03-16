/**
 * GitHub Connection Required Prompt
 * 
 * Shows when user tries to create a project without GitHub connected.
 * Explains the benefits and guides user through the connection process.
 */

import { Github, Lock, RefreshCw, Shield, X } from "lucide-react"
import { useState } from "react"
import { getGitHubOAuthUrl } from "../../services/github"
import { Button } from "../ui/button"

interface GitHubConnectionPromptProps {
    onClose: () => void
    onConnected?: () => void
    mode?: "modal" | "inline"
}

export function GitHubConnectionPrompt({
    onClose,
    onConnected: _onConnected, // Used by parent component after OAuth redirect callback
    mode = "modal"
}: GitHubConnectionPromptProps) {
    const [isConnecting, setIsConnecting] = useState(false)
    const [error, setError] = useState<string | null>(null)

    const handleConnect = () => {
        setIsConnecting(true)
        setError(null)

        try {
            const oauthUrl = getGitHubOAuthUrl()
            window.location.href = oauthUrl
        } catch (err) {
            setError(err instanceof Error ? err.message : "Failed to connect to GitHub")
            setIsConnecting(false)
        }
    }

    const benefits = [
        {
            icon: RefreshCw,
            title: "Automatic Code Sync",
            description: "Your project code is automatically synced to your private GitHub repository"
        },
        {
            icon: Shield,
            title: "Version Control",
            description: "Full git history, branches, and the ability to collaborate with your team"
        },
        {
            icon: Lock,
            title: "Secure & Private",
            description: "Your code stays in your own private repository under your control"
        }
    ]

    const permissions = [
        "Read and write access to repositories",
        "Create private repositories",
        "Push commits and manage files",
        "Read your GitHub profile"
    ]

    const content = (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-foreground rounded-lg flex items-center justify-center">
                    <Github className="w-6 h-6 text-background" />
                </div>
                <div>
                    <h2 className="text-xl font-bold text-foreground">Connect GitHub</h2>
                    <p className="text-sm text-muted-foreground">Required to create and sync projects</p>
                </div>
            </div>

            {/* Benefits */}
            <div className="space-y-4">
                <h3 className="text-sm font-semibold text-foreground uppercase tracking-wider">
                    Why Connect?
                </h3>
                <div className="space-y-3">
                    {benefits.map((benefit, index) => (
                        <div key={index} className="flex gap-3">
                            <div className="w-8 h-8 bg-muted rounded flex items-center justify-center flex-shrink-0">
                                <benefit.icon className="w-4 h-4 text-foreground" />
                            </div>
                            <div>
                                <div className="font-medium text-foreground text-sm">{benefit.title}</div>
                                <div className="text-xs text-muted-foreground">{benefit.description}</div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Permissions */}
            <div className="space-y-3">
                <h3 className="text-sm font-semibold text-foreground uppercase tracking-wider">
                    Permissions Required
                </h3>
                <ul className="space-y-1">
                    {permissions.map((permission, index) => (
                        <li key={index} className="text-xs text-muted-foreground flex items-center gap-2">
                            <span className="w-1 h-1 bg-foreground rounded-full" />
                            {permission}
                        </li>
                    ))}
                </ul>
                <p className="text-xs text-muted-foreground italic">
                    We will never access your other repositories without your permission.
                </p>
            </div>

            {/* Error Message */}
            {error && (
                <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-lg">
                    <p className="text-sm text-destructive">{error}</p>
                </div>
            )}

            {/* Action Buttons */}
            <div className="flex gap-3">
                <Button
                    onClick={handleConnect}
                    disabled={isConnecting}
                    className="flex-1 bg-foreground text-background hover:bg-foreground/90"
                >
                    {isConnecting ? (
                        <>
                            <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                            Connecting...
                        </>
                    ) : (
                        <>
                            <Github className="w-4 h-4 mr-2" />
                            Connect GitHub
                        </>
                    )}
                </Button>
                <Button
                    onClick={onClose}
                    variant="outline"
                    className="px-4"
                >
                    Cancel
                </Button>
            </div>

            {/* Footer */}
            <p className="text-xs text-center text-muted-foreground">
                By connecting, you agree to our Terms of Service and Privacy Policy
            </p>
        </div>
    )

    if (mode === "inline") {
        return (
            <div className="p-6 bg-card border border-border rounded-lg">
                {content}
            </div>
        )
    }

    // Modal mode
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-background/80 backdrop-blur-sm"
                onClick={onClose}
            />

            {/* Modal */}
            <div className="relative w-full max-w-md mx-4 bg-card border border-border rounded-lg shadow-xl p-6">
                {/* Close button */}
                <button
                    onClick={onClose}
                    className="absolute top-4 right-4 p-1 hover:bg-muted rounded"
                >
                    <X className="w-4 h-4 text-muted-foreground" />
                </button>

                {content}
            </div>
        </div>
    )
}

/**
 * Small banner when GitHub is not connected (for dashboard header)
 */
export function GitHubConnectionBanner({ onConnect }: { onConnect: () => void }) {
    return (
        <div className="bg-amber-500/10 border border-amber-500/20 px-4 py-2 flex items-center justify-between">
            <div className="flex items-center gap-2">
                <Github className="w-4 h-4 text-amber-600" />
                <span className="text-sm text-amber-700 dark:text-amber-400">
                    Connect GitHub to create and sync projects
                </span>
            </div>
            <Button
                onClick={onConnect}
                size="sm"
                variant="outline"
                className="border-amber-500/50 text-amber-700 dark:text-amber-400 hover:bg-amber-500/10"
            >
                Connect
            </Button>
        </div>
    )
}
