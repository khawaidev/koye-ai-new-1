import { useMemo, useState } from "react"
import { useNavigate } from "react-router-dom"
import animationsSource from "../../animations.md?raw"
import { Button } from "../components/ui/button"
import { Input } from "../components/ui/input"
import { Select } from "../components/ui/select"
import { ThemeToggle } from "../components/ui/theme-toggle"

type AnimationInfo = {
  id: number
  name: string
  category: string
  subCategory: string
  preview: string
  gif?: string
}

const parseAnimations = (): AnimationInfo[] => {
  const lines = animationsSource.split(/\r?\n/)
  const animations: AnimationInfo[] = []
  let headerSeen = false

  for (const rawLine of lines) {
    const line = rawLine.trim()
    if (!line) continue
    if (line.startsWith("Usage Example")) break
    if (!headerSeen) {
      if (line.startsWith("ID")) {
        headerSeen = true
      }
      continue
    }

    const parts = line.split(/\s+/)
    if (parts.length < 5) continue

    const [idStr, name, category, subCategory, ...previewParts] = parts
    const id = Number(idStr)
    if (Number.isNaN(id)) continue

    animations.push({
      id,
      name,
      category,
      subCategory,
      preview: previewParts.join(" "),
    })
  }

  return animations
}

const gifModules = import.meta.glob("../assets/gifs/gifs/*.gif", {
  eager: true,
  import: "default",
}) as Record<string, string>

const gifMap = Object.entries(gifModules).reduce<Record<number, string>>((acc, [path, src]) => {
  const match = path.match(/(\d+)\.gif$/)
  if (match) {
    acc[Number(match[1])] = src
  }
  return acc
}, {})

const animationsData = parseAnimations().map((animation) => ({
  ...animation,
  gif: gifMap[animation.id],
}))

export function AnimationsLibrary() {
  const navigate = useNavigate()
  const [searchTerm, setSearchTerm] = useState("")
  const [categoryFilter, setCategoryFilter] = useState("all")

  const categories = useMemo(() => {
    const unique = new Set(animationsData.map((a) => a.category))
    return ["all", ...Array.from(unique).sort()]
  }, [])

  const filteredAnimations = useMemo(() => {
    return animationsData.filter((animation) => {
      const matchesCategory = categoryFilter === "all" || animation.category === categoryFilter
      const matchesSearch =
        animation.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        animation.preview.toLowerCase().includes(searchTerm.toLowerCase())
      return matchesCategory && matchesSearch
    })
  }, [categoryFilter, searchTerm])

  return (
    <div className="flex h-screen flex-col bg-background overflow-hidden font-mono">
      {/* Terminal Header */}
      <header className="shrink-0 border-b border-border bg-background">
        <div className="mx-auto max-w-6xl px-6 py-4 flex items-center justify-between">
          <div>
            <p className="text-xs text-muted-foreground">$ koye_ai / libraries</p>
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">Animations Library</h1>
          </div>
          <div className="flex items-center gap-3">
            <ThemeToggle />
            <Button
              onClick={() => navigate(-1)}
              className="bg-background text-foreground border-2 border-foreground shadow-[4px_4px_0px_0px_currentColor] hover:shadow-[2px_2px_0px_0px_currentColor] hover:translate-x-[2px] hover:translate-y-[2px] transition-all rounded-none font-bold"
            >
              $ back
            </Button>
          </div>
        </div>
      </header>

      <main className="flex-1 overflow-hidden bg-background">
        <div
          className="mx-auto max-w-6xl h-full overflow-y-auto px-6 py-6 space-y-6"
        >
          {/* Filters */}
          <div className="border-2 border-border bg-background p-4 shadow-lg space-y-4">
            <div className="flex flex-col gap-3 md:flex-row md:items-center">
              <div className="flex-1">
                <label className="text-xs uppercase tracking-wide text-muted-foreground block mb-1">
                  $ search_animation
                </label>
                <Input
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Type to search by name or preview..."
                  className="border-border focus-visible:ring-0 rounded-none text-foreground placeholder:text-muted-foreground"
                />
              </div>
              <div className="md:w-64">
                <label className="text-xs uppercase tracking-wide text-muted-foreground block mb-1">
                  $ filter_category
                </label>
                <Select
                  options={categories.map((category) => ({
                    label: category === "all" ? "All Categories" : category,
                    value: category,
                  }))}
                  value={categoryFilter}
                  onValueChange={setCategoryFilter}
                  className="border-border rounded-none"
                />
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              Showing <span className="font-semibold text-foreground">{filteredAnimations.length}</span> animations
              (total {animationsData.length})
            </p>
          </div>

          {/* Grid */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filteredAnimations.map((animation) => (
              <div key={animation.id} className="border-2 border-border bg-background shadow-xl flex flex-col">
                <div className="border-b border-border bg-foreground text-background px-4 py-2 flex items-center justify-between text-xs uppercase">
                  <span>ID: {animation.id.toString().padStart(3, "0")}</span>
                  <span>{animation.category}</span>
                </div>
                <div className="p-4 space-y-3 flex-1 flex flex-col">
                  <div>
                    <p className="text-sm font-semibold text-foreground">{animation.name}</p>
                    <p className="text-xs text-muted-foreground">{animation.subCategory}</p>
                  </div>
                  <div className="flex-1">
                    {animation.gif ? (
                      <div className="border border-border bg-muted/20 flex items-center justify-center overflow-hidden h-48">
                        <img
                          src={animation.gif}
                          alt={animation.name}
                          className="w-full h-full object-contain"
                          style={{ objectFit: "contain" }}
                          loading="lazy"
                        />
                      </div>
                    ) : (
                      <div className="border border-dashed border-border h-48 flex items-center justify-center text-xs text-muted-foreground">
                        $ preview_unavailable
                      </div>
                    )}
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Preview key</p>
                    <p className="text-sm text-foreground font-semibold">{animation.preview || "N/A"}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {filteredAnimations.length === 0 && (
            <div className="border-2 border-border bg-muted/20 p-6 text-center text-sm text-muted-foreground">
              $ no_matching_animations_found
            </div>
          )}
        </div>
      </main>
    </div>
  )
}

