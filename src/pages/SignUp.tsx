import { BackgroundPaths } from '@/components/ui/shadcn-io/background-paths'
import { useEffect, useRef, useState } from "react"
import { Link, useNavigate } from "react-router-dom"
import Tg from "../assets/bg.png"
import { ThemeToggle } from "../components/ui/theme-toggle"
import { supabase } from "../services/supabase"


import { useAuth } from "../hooks/useAuth"

export function SignUp() {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const navigate = useNavigate()
  const { user, loading: authLoading } = useAuth()

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const isPreview = params.get("preview") === "true";

    if (!authLoading && user && !isPreview) {
      navigate("/app");
    }
  }, [user, authLoading, navigate]);

  // Dragging state
  const [position, setPosition] = useState<{ x: number | null; y: number | null }>({ x: null, y: null })
  const [isDragging, setIsDragging] = useState(false)
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 })
  const windowRef = useRef<HTMLDivElement>(null)

  // Handle mouse down on title bar
  const handleMouseDown = (e: React.MouseEvent) => {
    if (windowRef.current) {
      const rect = windowRef.current.getBoundingClientRect()
      setDragOffset({
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
      })
      setIsDragging(true)
      // If this is the first drag, initialize position from current location
      if (position.x === null || position.y === null) {
        setPosition({
          x: rect.left,
          y: rect.top,
        })
      }
    }
  }

  // Handle mouse move with boundary constraints
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (isDragging && windowRef.current) {
        const rect = windowRef.current.getBoundingClientRect()
        const windowWidth = rect.width
        const windowHeight = rect.height
        const viewportWidth = window.innerWidth
        const viewportHeight = window.innerHeight

        // Calculate new position
        let newX = e.clientX - dragOffset.x
        let newY = e.clientY - dragOffset.y

        // Constrain to viewport boundaries (with padding)
        const padding = 16 // Minimum distance from edges
        const minX = padding
        const maxX = viewportWidth - windowWidth - padding
        const minY = padding
        const maxY = viewportHeight - windowHeight - padding

        // Apply constraints
        newX = Math.max(minX, Math.min(maxX, newX))
        newY = Math.max(minY, Math.min(maxY, newY))

        setPosition({
          x: newX,
          y: newY,
        })
      }
    }

    const handleMouseUp = () => {
      setIsDragging(false)
    }

    if (isDragging) {
      document.addEventListener("mousemove", handleMouseMove)
      document.addEventListener("mouseup", handleMouseUp)
    }

    return () => {
      document.removeEventListener("mousemove", handleMouseMove)
      document.removeEventListener("mouseup", handleMouseUp)
    }
  }, [isDragging, dragOffset])

  // Background image path - user will add this
  const bgImagePath = Tg

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setMessage(null)

    if (password !== confirmPassword) {
      setError("Passwords do not match")
      return
    }

    if (password.length < 6) {
      setError("Password must be at least 6 characters")
      return
    }

    setLoading(true)

    try {
      const { data, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
      })

      if (signUpError) throw signUpError

      if (data.user) {
        setMessage("Sign up successful! Please check your email to verify your account.")
        setTimeout(() => {
          navigate("/login")
        }, 2000)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred during sign up")
    } finally {
      setLoading(false)
    }
  }



  return (
    <div className="min-h-screen p-4 relative overflow-hidden bg-background">
      <div className="absolute top-4 right-4 z-10">
        <ThemeToggle />
      </div>
      <div className="absolute inset-0 z-0">
        <BackgroundPaths title="Background Paths" />
      </div>
      <div
        className="w-full max-w-md"
        style={{
          position: "absolute",
          left: position.x !== null ? `${position.x}px` : "50%",
          top: position.y !== null ? `${position.y}px` : "50%",
          transform: position.x !== null || position.y !== null ? "none" : "translate(-50%, -50%)",
          cursor: isDragging ? "grabbing" : "default",
        }}
        ref={windowRef}
      >
        {/* Terminal Window */}
        <div className="bg-background border-2 border-border shadow-2xl">
          {/* Title Bar - Draggable */}
          <div
            className="border-b border-border px-4 py-2 flex items-center gap-2 cursor-grab active:cursor-grabbing select-none bg-muted/20"
            onMouseDown={handleMouseDown}
          >
            <div className="flex-1 text-center">
              <span className="text-foreground font-mono text-sm font-bold uppercase tracking-wider">START BUILDING</span>
            </div>
          </div>

          {/* Content Area */}
          <div className="bg-background p-6 font-mono text-foreground">
            <div className="mb-4 text-sm text-muted-foreground">
              Last login: {new Date().toLocaleString()}
            </div>

            <form onSubmit={handleSignUp} className="space-y-4">
              <div>
                <label className="block text-sm mb-1 text-foreground">
                  $ email:
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="w-full bg-background border border-border px-3 py-2 text-foreground font-mono text-sm focus:outline-none focus:ring-1 focus:ring-border"
                  placeholder="user@example.com"
                />
              </div>

              <div>
                <label className="block text-sm mb-1 text-foreground">
                  $ password:
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="w-full bg-background border border-border px-3 py-2 text-foreground font-mono text-sm focus:outline-none focus:ring-1 focus:ring-border"
                  placeholder="••••••••"
                />
              </div>

              <div>
                <label className="block text-sm mb-1 text-foreground">
                  $ confirm_password:
                </label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  className="w-full bg-background border border-border px-3 py-2 text-foreground font-mono text-sm focus:outline-none focus:ring-1 focus:ring-border"
                  placeholder="••••••••"
                />
              </div>

              {error && (
                <div className="text-red-500 text-sm font-mono bg-red-500/10 border border-red-500/20 px-3 py-2">
                  Error: {error}
                </div>
              )}

              {message && (
                <div className="text-green-500 text-sm font-mono bg-green-500/10 border border-green-500/20 px-3 py-2">
                  {message}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-foreground text-background px-4 py-2 font-mono text-sm hover:bg-muted-foreground transition-colors disabled:opacity-50 disabled:cursor-not-allowed border border-foreground"
              >
                {loading ? "$ processing..." : "$ sign_up"}
              </button>
            </form>

            <div className="mt-4 pt-4 border-t border-border">
              <div className="text-sm text-muted-foreground">
                Already have an account?{" "}
                <Link
                  to="/login"
                  className="text-foreground underline hover:text-muted-foreground"
                >
                  $ login
                </Link>
              </div>
            </div>

          </div>
        </div>
      </div>
    </div>
  )
}

