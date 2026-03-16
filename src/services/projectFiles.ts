/**
 * Project Files Service
 * 
 * Code files are stored ONLY in the user's connected GitHub repository
 * Non-code files (assets) are stored in Supabase
 */

import {
  deleteFileFromGitHub,
  getProjectGitHubInfo,
  isCodeFile,
  syncFileToGitHub
} from "./githubProjectSync"
import { deleteProjectFileDirectly, loadProjectFiles, loadProjectSettingsFile, saveProjectFile, saveProjectFiles } from "./supabase"

const GITHUB_API_BASE = "https://api.github.com"

// Type for GitHub connection - now properly typed
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
 * Get GitHub connection from localStorage for a user
 */
function getGitHubConnectionForUser(userId: string): GitHubConnectionInput | null {
  try {
    const storageKey = `github_connection_${userId}`
    const stored = localStorage.getItem(storageKey)
    if (!stored) return null

    const connection = JSON.parse(stored)

    // Validate connection has required fields
    if (!connection.accessToken || connection.accessToken.startsWith('oauth_code_')) {
      console.log('[getGitHubConnectionForUser] Invalid token:', connection.accessToken?.substring(0, 20))
      return null
    }

    if (!connection.repoOwner) {
      console.log('[getGitHubConnectionForUser] Missing repoOwner')
      return null
    }

    // Use koye-projects as default repo name if not set
    return {
      accessToken: connection.accessToken,
      repoOwner: connection.repoOwner,
      repoName: connection.repoName || 'koye-projects',
      branch: connection.branch || 'main'
    } as GitHubConnectionInput
  } catch (error) {
    console.error('[getGitHubConnectionForUser] Error:', error)
    return null
  }
}

/**
 * Fetch a file from GitHub
 */
async function fetchFileFromGitHub(
  accessToken: string,
  repoOwner: string,
  repoName: string,
  branch: string,
  filePath: string
): Promise<string | null> {
  try {
    const response = await fetch(
      `${GITHUB_API_BASE}/repos/${repoOwner}/${repoName}/contents/${filePath}?ref=${branch}`,
      {
        headers: {
          Authorization: `token ${accessToken}`,
          Accept: 'application/vnd.github.v3+json'
        }
      }
    )

    if (!response.ok) {
      return null
    }

    const data = await response.json()

    // GitHub returns content as base64 encoded
    if (data.content && data.encoding === 'base64') {
      return atob(data.content.replace(/\n/g, ''))
    }

    return null
  } catch (error) {
    console.warn(`Failed to fetch file ${filePath} from GitHub:`, error)
    return null
  }
}

/**
 * List all files in a project folder on GitHub
 */
async function listProjectFilesFromGitHub(
  accessToken: string,
  repoOwner: string,
  repoName: string,
  branch: string,
  projectId: string
): Promise<string[]> {
  const filePaths: string[] = []

  async function fetchDirectory(path: string): Promise<void> {
    try {
      const response = await fetch(
        `${GITHUB_API_BASE}/repos/${repoOwner}/${repoName}/contents/${path}?ref=${branch}`,
        {
          headers: {
            Authorization: `token ${accessToken}`,
            Accept: 'application/vnd.github.v3+json'
          }
        }
      )

      if (!response.ok) {
        return
      }

      const items = await response.json()

      if (!Array.isArray(items)) {
        return
      }

      for (const item of items) {
        if (item.type === 'file' && !item.name.startsWith('.')) {
          // Extract relative path (remove projects/{projectId}/ prefix)
          const relativePath = item.path.replace(`projects/${projectId}/`, '')
          filePaths.push(relativePath)
        } else if (item.type === 'dir' && !item.name.startsWith('.')) {
          await fetchDirectory(item.path)
        }
      }
    } catch (error) {
      console.warn(`Failed to list directory ${path}:`, error)
    }
  }

  await fetchDirectory(`projects/${projectId}`)
  return filePaths
}

/**
 * Load all project code files from GitHub
 */
async function loadCodeFilesFromGitHub(
  projectId: string,
  connection: GitHubConnectionInput
): Promise<Record<string, string>> {
  const { accessToken, repoOwner, repoName, branch } = connection
  const files: Record<string, string> = {}

  try {
    // List all files in the project folder
    const filePaths = await listProjectFilesFromGitHub(
      accessToken,
      repoOwner,
      repoName,
      branch,
      projectId
    )

    console.log(`Found ${filePaths.length} files in GitHub for project ${projectId}`)

    // Fetch each file's content
    const fetchPromises = filePaths.map(async (relativePath) => {
      const fullPath = `projects/${projectId}/${relativePath}`
      const content = await fetchFileFromGitHub(
        accessToken,
        repoOwner,
        repoName,
        branch,
        fullPath
      )

      if (content !== null) {
        files[relativePath] = content
      }
    })

    await Promise.allSettled(fetchPromises)
  } catch (error) {
    console.error('Error loading files from GitHub:', error)
  }

  return files
}

/**
 * Save project files:
 * - Code files go ONLY to GitHub
 * - Non-code files go to Supabase
 */
export async function saveProjectFilesToStorage(
  projectId: string,
  userId: string,
  _projectName: string,
  files: Record<string, string>,
  githubConnection?: GitHubConnectionInput | null
): Promise<void> {
  const connection = githubConnection || getGitHubConnectionForUser(userId)

  console.log(`[saveProjectFilesToStorage] Saving ${Object.keys(files).length} files for project ${projectId}`)
  console.log(`[saveProjectFilesToStorage] GitHub connection:`, connection ? {
    repoOwner: connection.repoOwner,
    repoName: connection.repoName,
    branch: connection.branch
  } : 'null')

  // Separate code files from non-code files
  const codeFiles: Record<string, string> = {}
  const nonCodeFiles: Record<string, string> = {}

  for (const [path, content] of Object.entries(files)) {
    if (isCodeFile(path)) {
      codeFiles[path] = content
    } else {
      nonCodeFiles[path] = content
    }
  }

  console.log(`[saveProjectFilesToStorage] Code files: ${Object.keys(codeFiles).length}, Non-code files: ${Object.keys(nonCodeFiles).length}`)
  console.log(`[saveProjectFilesToStorage] Code file paths:`, Object.keys(codeFiles))

  // Save non-code files to Supabase
  if (Object.keys(nonCodeFiles).length > 0) {
    await saveProjectFiles(projectId, userId, nonCodeFiles)
  }

  // Save code files to GitHub ONLY
  if (Object.keys(codeFiles).length > 0 && connection) {
    console.log(`[saveProjectFilesToStorage] Syncing ${Object.keys(codeFiles).length} code files to GitHub...`)
    await syncCodeFilesToGitHub(projectId, codeFiles, connection)
  } else if (Object.keys(codeFiles).length > 0) {
    console.warn('[saveProjectFilesToStorage] No GitHub connection - code files will not be saved!')
    // Fallback: save to Supabase if no GitHub connection (shouldn't happen if mandatory)
    await saveProjectFiles(projectId, userId, codeFiles)
  }
}

/**
 * Helper to sync code files to GitHub
 */
async function syncCodeFilesToGitHub(
  projectId: string,
  files: Record<string, string>,
  connection: GitHubConnectionInput
): Promise<void> {
  const { accessToken, repoOwner, repoName, branch } = connection

  // Get project GitHub info to check if sync is enabled
  const githubInfo = await getProjectGitHubInfo(projectId)
  if (githubInfo && !githubInfo.githubSyncEnabled) {
    console.log("GitHub sync disabled for project", projectId)
    return
  }

  const fileEntries = Object.entries(files)
  console.log(`Saving ${fileEntries.length} code files to GitHub for project ${projectId}`)

  // Sync files SEQUENTIALLY to avoid SHA conflicts
  // (parallel updates cause 409 errors because SHA changes after each commit)
  for (const [path, content] of fileEntries) {
    try {
      await syncFileToGitHub(
        accessToken,
        repoOwner,
        repoName,
        branch,
        projectId,
        path,
        content
      )
      console.log(`✓ Synced ${path} to GitHub`)
    } catch (error) {
      console.warn(`⚠ Failed to save file ${path} to GitHub:`, error)
      // Continue with next file instead of stopping
    }
  }
}

/**
 * Load project files:
 * - Code files from GitHub
 * - Non-code files from Supabase
 */
export async function loadProjectFilesFromStorage(
  projectId: string,
  userId: string,
  githubConnection?: GitHubConnectionInput | null
): Promise<Record<string, string>> {
  const connection = githubConnection || getGitHubConnectionForUser(userId)

  // Start with non-code files from Supabase
  const supabaseFiles = await loadProjectFiles(projectId, userId)

  // Filter to only non-code files from Supabase
  const nonCodeFiles: Record<string, string> = {}
  for (const [path, content] of Object.entries(supabaseFiles)) {
    if (!isCodeFile(path)) {
      nonCodeFiles[path] = content
    }
  }

  // Load code files from GitHub
  let codeFiles: Record<string, string> = {}
  if (connection) {
    codeFiles = await loadCodeFilesFromGitHub(projectId, connection)
    console.log(`Loaded ${Object.keys(codeFiles).length} code files from GitHub`)
  } else {
    // Fallback: load all files from Supabase if no GitHub connection
    console.log('No GitHub connection - loading code files from Supabase fallback')
    for (const [path, content] of Object.entries(supabaseFiles)) {
      if (isCodeFile(path)) {
        codeFiles[path] = content
      }
    }
  }

  // Merge: GitHub code files + Supabase non-code files
  return { ...nonCodeFiles, ...codeFiles }
}

/**
 * Save a single project file:
 * - Code files go ONLY to GitHub
 * - Non-code files go to Supabase
 */
export async function saveSingleProjectFile(
  projectId: string,
  userId: string,
  _projectName: string,
  path: string,
  content: string,
  githubConnection?: GitHubConnectionInput | null
): Promise<void> {
  console.log(`[saveSingleProjectFile] Saving ${path}, isCodeFile: ${isCodeFile(path)}`)

  if (isCodeFile(path)) {
    // Code files go to GitHub ONLY
    const connection = githubConnection || getGitHubConnectionForUser(userId)
    console.log(`[saveSingleProjectFile] GitHub connection:`, connection ? {
      repoOwner: connection.repoOwner,
      repoName: connection.repoName,
      branch: connection.branch
    } : 'null')

    if (connection) {
      // Check if sync is enabled for this project
      const githubInfo = await getProjectGitHubInfo(projectId)
      console.log(`[saveSingleProjectFile] GitHub info for project:`, githubInfo)

      if (!githubInfo || githubInfo.githubSyncEnabled !== false) {
        try {
          console.log(`[saveSingleProjectFile] Syncing to GitHub: ${connection.repoOwner}/${connection.repoName}/projects/${projectId}/${path}`)
          await syncFileToGitHub(
            connection.accessToken,
            connection.repoOwner,
            connection.repoName,
            connection.branch,
            projectId,
            path,
            content
          )
          console.log(`✓ Saved ${path} to GitHub`)
        } catch (error) {
          console.error(`✗ Failed to save ${path} to GitHub:`, error)
          throw error // Throw so caller knows save failed
        }
      } else {
        console.log(`[saveSingleProjectFile] GitHub sync disabled for project ${projectId}`)
      }
    } else {
      console.warn('[saveSingleProjectFile] No GitHub connection - cannot save code file!')
      // Fallback: save to Supabase if no GitHub connection
      await saveProjectFile(projectId, userId, path, content)
    }
  } else {
    // Non-code files go to Supabase
    await saveProjectFile(projectId, userId, path, content)
  }
}

/**
 * Delete a single project file:
 * - Code files deleted from GitHub
 * - Non-code files deleted from Supabase
 */
export async function deleteProjectFile(
  projectId: string,
  userId: string,
  path: string,
  githubConnection?: GitHubConnectionInput | null
): Promise<void> {
  if (isCodeFile(path)) {
    // Delete code files from GitHub
    const connection = githubConnection || getGitHubConnectionForUser(userId)
    if (connection) {
      try {
        await deleteFileFromGitHub(
          connection.accessToken,
          connection.repoOwner,
          connection.repoName,
          connection.branch,
          projectId,
          path
        )
        console.log(`Deleted ${path} from GitHub`)
      } catch (error) {
        console.warn(`Failed to delete ${path} from GitHub:`, error)
      }
    }
  } else {
    // Delete non-code files from Supabase
    await deleteProjectFileDirectly(projectId, userId, path)
  }
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
