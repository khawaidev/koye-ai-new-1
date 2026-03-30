/**
 * Project Files Service
 *
 * STORAGE STRATEGY:
 *   - Code files (.ts, .js, .json, .html, .css, etc.) → Supabase DB (primary)
 *   - Binary assets (.png, .glb, .mp4, .mp3, etc.)   → Cloudflare R2 (primary)
 *   - GitHub                                          → NOT USED (removed)
 *
 * R2 uploads go through a secure Cloudflare Worker proxy — no secrets in browser.
 * Binary files stored in R2 get their public URL saved in Supabase project_files
 * as a reference pointer so loadProjectFilesFromStorage can return R2 URLs.
 */

import { deleteProjectFileDirectly, loadProjectFiles, loadProjectSettingsFile, saveProjectFile, saveProjectFiles } from "./supabase"
import { isBinaryAsset, isR2Configured, uploadAssetToR2, deleteAssetFromR2 } from "./r2Storage"

// Keep the type export for backward compatibility (Dashboard still imports it)
export interface GitHubConnectionInput {
  accessToken: string
  repoOwner: string
  repoName: string
  branch: string
}

export interface ProjectFilesData {
  files: Record<string, string>
  timestamp: number
  projectName: string
}

/**
 * Save project files:
 * - Binary assets → R2 (via Worker proxy), with R2 URL stored in Supabase
 * - Code/text files → Supabase DB
 */
export async function saveProjectFilesToStorage(
  projectId: string,
  userId: string,
  _projectName: string,
  files: Record<string, string>,
  _githubConnection?: GitHubConnectionInput | null
): Promise<void> {
  console.log(`[saveProjectFilesToStorage] Saving ${Object.keys(files).length} files for project ${projectId}`)

  const textFiles: Record<string, string> = {}
  const binaryEntries: [string, string][] = []

  // Categorize files
  for (const [path, content] of Object.entries(files)) {
    if (isBinaryAsset(path)) {
      binaryEntries.push([path, content])
    } else {
      textFiles[path] = content
    }
  }

  // 1. Save binary assets one-by-one (R2 involves separate uploads)
  for (const [path, content] of binaryEntries) {
    try {
      await saveSingleProjectFile(projectId, userId, _projectName, path, content)
    } catch (error) {
      console.warn(`[saveProjectFilesToStorage] Error saving binary file ${path}:`, error)
    }
  }

  // 2. Save all text files in one batch (Supabase upsert)
  if (Object.keys(textFiles).length > 0) {
    try {
      await saveProjectFiles(projectId, userId, textFiles)
      console.log(`✓ Saved ${Object.keys(textFiles).length} text files to Supabase in batch`)
    } catch (error) {
      console.error(`✗ Batch save failed for text files:`, error)
    }
  }
}

/**
 * Load project files:
 * - ALL files from Supabase DB (code files + R2 URL pointers for assets)
 */
export async function loadProjectFilesFromStorage(
  projectId: string,
  userId: string,
  _githubConnection?: GitHubConnectionInput | null
): Promise<Record<string, string>> {
  // Load ALL files from Supabase (code files + R2 URL references for assets)
  const supabaseFiles = await loadProjectFiles(projectId, userId)
  console.log(`Loaded ${Object.keys(supabaseFiles).length} files from storage`)

  return supabaseFiles
}

/**
 * Save a single project file:
 * - Binary assets → R2 primary, R2 URL saved to Supabase as reference
 * - Code/text files → Supabase DB
 */
export async function saveSingleProjectFile(
  projectId: string,
  userId: string,
  _projectName: string,
  path: string,
  content: string,
  _githubConnection?: GitHubConnectionInput | null
): Promise<void> {
  const binary = isBinaryAsset(path)

  // If the content is already an HTTP(S) URL (e.g. an R2 public URL loaded
  // from Supabase after a page reload), there is no need to re-upload to R2.
  // Just persist the URL pointer in Supabase as-is.
  const isAlreadyUrl = content.startsWith('http://') || content.startsWith('https://')

  console.log(`[saveSingleProjectFile] Saving ${path}, binary: ${binary}, R2: ${isR2Configured()}, alreadyUrl: ${isAlreadyUrl}`)

  if (binary && isR2Configured() && !isAlreadyUrl) {
    // ── BINARY ASSET → R2 (new upload: data URL or base64) ──
    try {
      // Ensure the R2 key has a file extension so the public URL is type-detectable.
      // If the path already has one (e.g. uploads/photo.png) this is a no-op.
      // If not, infer the extension from the data URL MIME type.
      let r2Path = path
      const lastSegment = path.split('/').pop() || ''
      const hasExtension = lastSegment.includes('.') && lastSegment.split('.').pop()!.length <= 5
      if (!hasExtension && content.startsWith('data:')) {
        const mimeMatch = content.match(/^data:([^;,]+)/)
        if (mimeMatch) {
          const mime = mimeMatch[1]
          const extMap: Record<string, string> = {
            'image/png': '.png', 'image/jpeg': '.jpg', 'image/gif': '.gif',
            'image/webp': '.webp', 'image/svg+xml': '.svg', 'image/bmp': '.bmp',
            'video/mp4': '.mp4', 'video/webm': '.webm', 'video/quicktime': '.mov',
            'audio/mpeg': '.mp3', 'audio/wav': '.wav', 'audio/ogg': '.ogg',
            'audio/flac': '.flac', 'audio/mp4': '.m4a', 'audio/aac': '.aac',
            'model/gltf-binary': '.glb', 'model/gltf+json': '.gltf',
            'application/pdf': '.pdf', 'application/zip': '.zip',
            'application/octet-stream': '.bin',
          }
          const ext = extMap[mime] || ''
          if (ext) {
            r2Path = `${path}${ext}`
            console.log(`[saveSingleProjectFile] Appended extension: ${path} → ${r2Path}`)
          }
        }
      }

      const r2Key = `projects/${projectId}/assets/${r2Path}`
      const publicUrl = await uploadAssetToR2(userId, r2Key, content)

      // Store the R2 public URL in Supabase as reference pointer
      await saveProjectFile(projectId, userId, path, publicUrl)
      console.log(`✓ Saved ${path} to R2, URL stored in Supabase`)
    } catch (error) {
      console.error(`✗ R2 upload failed for ${path}, falling back to Supabase:`, error)
      // Fallback: save binary data directly to Supabase
      await saveProjectFile(projectId, userId, path, content)
      console.log(`✓ Saved ${path} to Supabase (R2 fallback)`)
    }
  } else {
    // ── CODE / TEXT FILE or already-uploaded asset URL → SUPABASE DB ──
    await saveProjectFile(projectId, userId, path, content)
    console.log(`✓ Saved ${path} to Supabase DB`)
  }
}

/**
 * Delete a single project file:
 * - Binary assets: delete from R2 + Supabase reference
 * - Code files: delete from Supabase
 */
export async function deleteProjectFile(
  projectId: string,
  userId: string,
  path: string,
  _githubConnection?: GitHubConnectionInput | null
): Promise<void> {
  const binary = isBinaryAsset(path)

  if (binary && isR2Configured()) {
    // Delete from R2
    try {
      const r2Key = `projects/${projectId}/assets/${path}`
      await deleteAssetFromR2(userId, r2Key)
      console.log(`✓ Deleted ${path} from R2`)
    } catch (error) {
      console.warn(`⚠ Failed to delete ${path} from R2:`, error)
    }
  }

  // Always delete the Supabase reference/content
  await deleteProjectFileDirectly(projectId, userId, path)
}

/**
 * Load project settings file from Supabase
 */
export async function loadProjectSettingsFromStorage(
  projectId: string,
  userId: string,
  _githubConnection?: GitHubConnectionInput | null
): Promise<string | null> {
  return await loadProjectSettingsFile(projectId, userId)
}

export { deleteProjectFileDirectly }
