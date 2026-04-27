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
import { isBinaryAsset, isR2Configured, uploadAssetToR2, deleteAssetFromR2, parseR2Url } from "./r2Storage"

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

function isLocalDevHost(): boolean {
  return typeof window !== "undefined" && window.location.hostname === "localhost"
}

async function fetchCodeFileFromR2(
  originalUrl: string,
  parsed: { userId: string; r2Key: string }
): Promise<string | null> {
  const workerUrl = import.meta.env.VITE_R2_WORKER_URL
  const workerFetchUrl = workerUrl
    ? `${workerUrl.replace(/\/+$/, "")}/file/${parsed.userId}/${parsed.r2Key}`
    : null

  const candidateUrls = isLocalDevHost()
    ? [workerFetchUrl, originalUrl].filter(Boolean) as string[]
    : [originalUrl, workerFetchUrl].filter(Boolean) as string[]

  for (const candidate of candidateUrls) {
    try {
      const res = await fetch(candidate)
      if (res.ok) {
        return await res.text()
      }
      console.warn(`Failed to fetch code file via ${candidate}: ${res.status} ${res.statusText}`)
    } catch (error) {
      console.warn(`Error fetching code file via ${candidate}:`, error)
    }
  }

  return null
}

/**
 * Save project files:
 * - Binary assets & Code files → R2 (via Worker proxy), with R2 URL stored in Supabase
 */
export async function saveProjectFilesToStorage(
  projectId: string,
  userId: string,
  _projectName: string,
  files: Record<string, string>,
  _githubConnection?: GitHubConnectionInput | null
): Promise<void> {
  console.log(`[saveProjectFilesToStorage] Saving ${Object.keys(files).length} files for project ${projectId}`)

  const entriesToSave: Record<string, string> = {}
  
  const entries = Object.entries(files)
  const BATCH_SIZE = 10
  
  for (let i = 0; i < entries.length; i += BATCH_SIZE) {
    const chunk = entries.slice(i, i + BATCH_SIZE)
    await Promise.all(
      chunk.map(async ([path, content]) => {
        const binary = isBinaryAsset(path)
        const isAlreadyUrl = binary 
          ? (content.startsWith('http://') || content.startsWith('https://'))
          : (parseR2Url(content) !== null)

        if (isR2Configured() && !isAlreadyUrl) {
          try {
            let r2Path = path
            let uploadContent: string | Blob = content

            if (binary) {
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
                  }
                }
              }
            } else {
              // Upload text files as Blobs to proper R2 encoding
              uploadContent = new Blob([content], { type: 'text/plain; charset=utf-8' })
            }

            const folder = binary ? 'assets' : 'code'
            const r2Key = `projects/${projectId}/${folder}/${r2Path}`
            const publicUrl = await uploadAssetToR2(userId, r2Key, uploadContent)

            entriesToSave[path] = publicUrl
            return
          } catch (error) {
            console.error(`✗ R2 upload failed for ${path}, falling back to Supabase:`, error)
          }
        }
        
        // Fallback or already URL
        entriesToSave[path] = content
      })
    )
  }

  // Save all URLs/metadata to Supabase in one batch
  if (Object.keys(entriesToSave).length > 0) {
    try {
      await saveProjectFiles(projectId, userId, entriesToSave)
      console.log(`✓ Saved ${Object.keys(entriesToSave).length} files/references to Supabase`)
    } catch (error) {
      console.error(`✗ Batch save failed for project files:`, error)
    }
  }
}

/**
 * Load project files:
 * - Load references from Supabase
 * - For code files pointing to R2 URLs, fetch the text content
 */
export async function loadProjectFilesFromStorage(
  projectId: string,
  userId: string,
  _githubConnection?: GitHubConnectionInput | null
): Promise<Record<string, string>> {
  // Load ALL files from Supabase (references)
  const supabaseFiles = await loadProjectFiles(projectId, userId)
  
  // Fetch text contents from R2
  const fetchPromises = Object.entries(supabaseFiles).map(async ([path, content]) => {
    const r2Parsed = parseR2Url(content)
    if (!isBinaryAsset(path) && r2Parsed !== null) {
      try {
        const text = await fetchCodeFileFromR2(content, r2Parsed)
        if (text !== null) {
          supabaseFiles[path] = text
        }
      } catch (e) {
        console.error(`Error fetching code file ${path} from R2:`, e)
      }
    }
  })

  await Promise.all(fetchPromises)

  console.log(`Loaded ${Object.keys(supabaseFiles).length} files from storage`)
  return supabaseFiles
}

/**
 * Save a single project file:
 * - Assets & Code → R2 primary, R2 URL saved to Supabase as reference
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
  const isAlreadyUrl = binary 
    ? (content.startsWith('http://') || content.startsWith('https://'))
    : (parseR2Url(content) !== null)

  console.log(`[saveSingleProjectFile] Saving ${path}, binary: ${binary}, R2: ${isR2Configured()}, alreadyUrl: ${isAlreadyUrl}`)

  if (isR2Configured() && !isAlreadyUrl) {
    try {
      let r2Path = path
      let uploadContent: string | Blob = content

      if (binary) {
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
      } else {
        // Cloudflare Worker occasionally rejects completely empty bodies, so put a single space if empty
        const textContent = content === '' ? ' ' : content;
        uploadContent = new Blob([textContent], { type: 'text/plain; charset=utf-8' })
      }

      const folder = binary ? 'assets' : 'code'
      const r2Key = `projects/${projectId}/${folder}/${r2Path}`
      const publicUrl = await uploadAssetToR2(userId, r2Key, uploadContent)

      // Store the R2 public URL in Supabase as reference pointer
      await saveProjectFile(projectId, userId, path, publicUrl)
      console.log(`✓ Saved ${path} to R2 (${folder}), URL stored in Supabase`)
    } catch (error) {
      console.error(`✗ R2 upload failed for ${path}:`, error)
      throw error // Explicitly fail, DO NOT fallback to Supabase DB for file contents
    }
  } else {
    // If it's ALREADY a URL or if R2 is strangely not configured at all (unlikely)
    await saveProjectFile(projectId, userId, path, content)
    console.log(`✓ Saved ${path} to Supabase DB (Already a URL or R2 disconnected)`)
  }
}

/**
 * Delete a single project file:
 * - Binary & Code: delete from R2 + delete Supabase reference
 */
export async function deleteProjectFile(
  projectId: string,
  userId: string,
  path: string,
  _githubConnection?: GitHubConnectionInput | null
): Promise<void> {
  if (isR2Configured()) {
    try {
      const binary = isBinaryAsset(path)
      const folder = binary ? 'assets' : 'code'
      const r2Key = `projects/${projectId}/${folder}/${path}`
      await deleteAssetFromR2(userId, r2Key)
      console.log(`✓ Deleted ${path} from R2 (${folder})`)
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
