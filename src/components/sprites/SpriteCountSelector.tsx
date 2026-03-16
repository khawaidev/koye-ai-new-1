// Component to display sprite count selection with video cards
// User will provide video paths - these are placeholders

interface SpriteCountOption {
  count: number
  label: string
  videoPath: string // User will provide these paths
}

const SPRITE_OPTIONS: SpriteCountOption[] = [
  { count: 5, label: "5 sprites", videoPath: "../../assets/11.mp4" }, // TODO: Replace with actual paths
  { count: 11, label: "11 sprites", videoPath: "../../assets/11.mp4" },
  { count: 22, label: "22 sprites", videoPath: "../../assets/22.mp4" },
  { count: 44, label: "44 sprites", videoPath: "../../assets/44.mp4" },
]

interface SpriteCountSelectorProps {
  onSelect: (count: number) => void
}

export function SpriteCountSelector({ onSelect }: SpriteCountSelectorProps) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4">
      {SPRITE_OPTIONS.map((option) => (
        <div
          key={option.count}
          className="border-2 border-black rounded-lg overflow-hidden shadow-md bg-white cursor-pointer hover:shadow-xl transition-shadow"
          onClick={() => onSelect(option.count)}
        >
          <div className="relative aspect-video bg-black">
            <video
              src={option.videoPath}
              className="w-full h-full object-cover"
              autoPlay
              loop
              muted
              playsInline
            />
          </div>
          <div className="p-3 text-center bg-black text-white font-mono text-sm font-bold">
            {option.label}
          </div>
        </div>
      ))}
    </div>
  )
}

