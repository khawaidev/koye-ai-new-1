/**
 * File type detection utility
 * Determines file type based on file extension
 */

export type FileCategory = "image" | "model" | "video" | "audio" | "code" | "text" | "unknown"

export interface FileTypeInfo {
  category: FileCategory
  mimeType?: string
  isBinary: boolean
}

// Image extensions
const IMAGE_EXTENSIONS = [
  "png", "jpg", "jpeg", "gif", "webp", "svg", "bmp", "ico", "tiff", "tif"
]

// 3D Model extensions
const MODEL_EXTENSIONS = [
  "glb", "gltf", "obj", "fbx", "dae", "3ds", "blend", "ply", "stl"
]

// Video extensions
const VIDEO_EXTENSIONS = [
  "mp4", "webm", "mov", "avi", "mkv", "flv", "wmv", "m4v", "ogv"
]

// Audio extensions
const AUDIO_EXTENSIONS = [
  "mp3", "wav", "ogg", "flac", "aac", "m4a", "wma", "opus", "webm"
]

// Code extensions (text files that should be syntax highlighted)
const CODE_EXTENSIONS = [
  "js", "jsx", "ts", "tsx", "py", "java", "cpp", "c", "h", "hpp", "cs", "go", "rs", "rb", "php",
  "swift", "kt", "dart", "r", "m", "mm", "scala", "clj", "hs", "elm", "ex", "exs", "erl",
  "vue", "svelte", "html", "css", "scss", "sass", "less", "styl", "json", "xml", "yaml", "yml",
  "toml", "ini", "cfg", "conf", "sh", "bash", "zsh", "fish", "ps1", "bat", "cmd",
  "sql", "graphql", "gql", "prisma", "dockerfile", "makefile", "cmake", "gradle", "maven",
  "lua", "vim", "vimrc", "gitignore", "gitattributes", "editorconfig", "prettierrc", "eslintrc"
]

// Text extensions (plain text files)
const TEXT_EXTENSIONS = [
  "txt", "md", "markdown", "readme", "log", "text", "rtf"
]

/**
 * Get file extension from path
 */
export function getFileExtension(path: string): string {
  const parts = path.split(".")
  if (parts.length < 2) return ""
  return parts[parts.length - 1].toLowerCase()
}

/**
 * Detect file type from path
 */
export function detectFileType(path: string): FileTypeInfo {
  const ext = getFileExtension(path)
  
  if (!ext) {
    return { category: "unknown", isBinary: false }
  }

  // Check images
  if (IMAGE_EXTENSIONS.includes(ext)) {
    const mimeTypes: Record<string, string> = {
      png: "image/png",
      jpg: "image/jpeg",
      jpeg: "image/jpeg",
      gif: "image/gif",
      webp: "image/webp",
      svg: "image/svg+xml",
      bmp: "image/bmp",
      ico: "image/x-icon",
      tiff: "image/tiff",
      tif: "image/tiff"
    }
    return {
      category: "image",
      mimeType: mimeTypes[ext] || "image/png",
      isBinary: ext !== "svg"
    }
  }

  // Check models
  if (MODEL_EXTENSIONS.includes(ext)) {
    return {
      category: "model",
      mimeType: ext === "glb" ? "model/gltf-binary" : `model/${ext}`,
      isBinary: true
    }
  }

  // Check videos
  if (VIDEO_EXTENSIONS.includes(ext)) {
    const mimeTypes: Record<string, string> = {
      mp4: "video/mp4",
      webm: "video/webm",
      mov: "video/quicktime",
      avi: "video/x-msvideo",
      mkv: "video/x-matroska",
      flv: "video/x-flv",
      wmv: "video/x-ms-wmv",
      m4v: "video/mp4",
      ogv: "video/ogg"
    }
    return {
      category: "video",
      mimeType: mimeTypes[ext] || "video/mp4",
      isBinary: true
    }
  }

  // Check audio
  if (AUDIO_EXTENSIONS.includes(ext)) {
    const mimeTypes: Record<string, string> = {
      mp3: "audio/mpeg",
      wav: "audio/wav",
      ogg: "audio/ogg",
      flac: "audio/flac",
      aac: "audio/aac",
      m4a: "audio/mp4",
      wma: "audio/x-ms-wma",
      opus: "audio/opus",
      webm: "audio/webm"
    }
    return {
      category: "audio",
      mimeType: mimeTypes[ext] || "audio/mpeg",
      isBinary: true
    }
  }

  // Check code files
  if (CODE_EXTENSIONS.includes(ext)) {
    return {
      category: "code",
      isBinary: false
    }
  }

  // Check text files
  if (TEXT_EXTENSIONS.includes(ext)) {
    return {
      category: "text",
      isBinary: false
    }
  }

  // Default to unknown
  return {
    category: "unknown",
    isBinary: true
  }
}

/**
 * Get file type for FileNode (for tree display)
 */
export function getFileNodeType(path: string): "image" | "model" | "video" | "audio" | "code" | undefined {
  const fileType = detectFileType(path)
  
  switch (fileType.category) {
    case "image":
      return "image"
    case "model":
      return "model"
    case "video":
      return "video"
    case "audio":
      return "audio"
    case "code":
    case "text":
      return "code"
    default:
      return undefined
  }
}

