// GitHub Asset Storage Service
// Handles asset storage in GitHub following the new storage policy:
// - General assets (from Image Gen, 3D Model Gen, etc.) go to 'general' folder
// - Project assets go to 'projects/{projectId}' folder
// - All operations sync with app DB

import { v4 as uuidv4 } from 'uuid'
import { createOrUpdateFile, getFileContent, getRepositoryTree } from './github'

const GITHUB_API_BASE = "https://api.github.com"

export interface AssetRecord {
    id: string
    userId: string
    projectId?: string  // null for general assets
    fileName: string
    fileType: 'image' | 'model' | 'video' | 'audio' | 'code' | 'other'
    githubPath: string
    createdAt: string
    updatedAt: string
}

export interface GitHubConnection {
    accessToken: string
    repoOwner: string
    repoName: string
    branch: string
}

/**
 * Ensure the 'general' folder exists in the user's repository
 */
export async function ensureGeneralFolder(connection: GitHubConnection): Promise<void> {
    const { accessToken, repoOwner, repoName, branch } = connection

    // Create a .gitkeep file in the general folder if it doesn't exist
    try {
        await getFileContent(accessToken, repoOwner, repoName, 'general/.gitkeep', branch)
    } catch {
        // Folder doesn't exist, create it
        await createOrUpdateFile(
            accessToken,
            repoOwner,
            repoName,
            'general/.gitkeep',
            '# General assets folder\nThis folder contains assets generated outside of projects.',
            branch,
            'Initialize general assets folder'
        )
    }
}

/**
 * Ensure a project folder exists in the user's repository
 */
export async function ensureProjectFolder(
    connection: GitHubConnection,
    projectId: string,
    projectName: string
): Promise<void> {
    const { accessToken, repoOwner, repoName, branch } = connection

    const projectPath = `projects/${projectId}`

    // Create a README file in the project folder
    try {
        await getFileContent(accessToken, repoOwner, repoName, `${projectPath}/README.md`, branch)
    } catch {
        // Folder doesn't exist, create it
        await createOrUpdateFile(
            accessToken,
            repoOwner,
            repoName,
            `${projectPath}/README.md`,
            `# ${projectName}\n\nProject ID: ${projectId}\nCreated: ${new Date().toISOString()}`,
            branch,
            `Create project: ${projectName}`
        )
    }
}

/**
 * Upload a general asset (from Image Gen, 3D Model Gen, etc.)
 * @returns Asset ID for the uploaded file
 */
export async function uploadGeneralAsset(
    connection: GitHubConnection,
    content: string | Blob,
    fileName: string,
    fileType: 'image' | 'model' | 'video' | 'audio'
): Promise<{ assetId: string; githubPath: string }> {
    const { accessToken, repoOwner, repoName, branch } = connection

    // Generate unique asset ID
    const assetId = uuidv4()

    // Determine file extension
    const ext = fileName.includes('.') ? fileName.split('.').pop() : getDefaultExtension(fileType)
    const assetFileName = `${assetId}.${ext}`
    const githubPath = `general/${fileType}s/${assetFileName}`

    // Convert content to base64 if it's a Blob
    let base64Content: string
    if (content instanceof Blob) {
        base64Content = await blobToBase64(content)
    } else if (content.startsWith('data:')) {
        // Data URL - extract base64 part
        base64Content = content.split(',')[1]
    } else {
        // Already base64 or text
        base64Content = btoa(unescape(encodeURIComponent(content)))
    }

    // Upload to GitHub
    await uploadRawBase64(
        accessToken,
        repoOwner,
        repoName,
        githubPath,
        base64Content,
        branch,
        `Upload general asset: ${fileName}`
    )

    return { assetId, githubPath }
}

/**
 * Upload an asset to a project folder
 * @returns Asset ID for the uploaded file
 */
export async function uploadProjectAsset(
    connection: GitHubConnection,
    projectId: string,
    content: string | Blob,
    fileName: string,
    fileType: 'image' | 'model' | 'video' | 'audio' | 'code' | 'other'
): Promise<{ assetId: string; githubPath: string }> {
    const { accessToken, repoOwner, repoName, branch } = connection

    // Generate unique asset ID
    const assetId = uuidv4()

    // For code files, preserve the original name; for assets, use ID
    let assetFileName: string
    let githubPath: string

    if (fileType === 'code' || fileType === 'other') {
        // Keep original filename for code files
        assetFileName = fileName
        githubPath = `projects/${projectId}/${fileName}`
    } else {
        // Use asset ID for binary assets
        const ext = fileName.includes('.') ? fileName.split('.').pop() : getDefaultExtension(fileType)
        assetFileName = `${assetId}.${ext}`
        githubPath = `projects/${projectId}/assets/${fileType}s/${assetFileName}`
    }

    // Convert content to appropriate format
    let finalContent: string
    if (content instanceof Blob) {
        finalContent = await blobToBase64(content)
        await uploadRawBase64(
            accessToken, repoOwner, repoName, githubPath, finalContent, branch,
            `Upload project asset: ${fileName}`
        )
    } else if (content.startsWith('data:')) {
        finalContent = content.split(',')[1]
        await uploadRawBase64(
            accessToken, repoOwner, repoName, githubPath, finalContent, branch,
            `Upload project asset: ${fileName}`
        )
    } else {
        // Text content (code files)
        await createOrUpdateFile(
            accessToken, repoOwner, repoName, githubPath, content, branch,
            `Upload project file: ${fileName}`
        )
    }

    return { assetId, githubPath }
}

/**
 * Copy a general asset to a project
 * Creates a new asset with a new ID in the project folder
 */
export async function copyGeneralAssetToProject(
    connection: GitHubConnection,
    generalAssetPath: string,
    projectId: string,
    fileType: 'image' | 'model' | 'video' | 'audio'
): Promise<{ newAssetId: string; newGithubPath: string }> {
    const { accessToken, repoOwner, repoName, branch } = connection

    // Generate new asset ID for the project copy
    const newAssetId = uuidv4()

    // Get the file extension from the original path
    const ext = generalAssetPath.split('.').pop() || getDefaultExtension(fileType)
    const newFileName = `${newAssetId}.${ext}`
    const newGithubPath = `projects/${projectId}/assets/${fileType}s/${newFileName}`

    // Copy file in GitHub (get content and upload to new location)
    const content = await getFileContentRaw(
        accessToken, repoOwner, repoName, generalAssetPath, branch
    )

    await uploadRawBase64(
        accessToken, repoOwner, repoName, newGithubPath, content, branch,
        `Import asset to project ${projectId}`
    )

    return { newAssetId, newGithubPath }
}

/**
 * Delete an asset from GitHub
 */
export async function deleteGitHubAsset(
    connection: GitHubConnection,
    githubPath: string
): Promise<void> {
    const { accessToken, repoOwner, repoName, branch } = connection

    // Get file SHA first
    const response = await fetch(
        `${GITHUB_API_BASE}/repos/${repoOwner}/${repoName}/contents/${githubPath}?ref=${branch}`,
        {
            headers: {
                Authorization: `token ${accessToken}`,
                Accept: "application/vnd.github.v3+json",
            },
        }
    )

    if (!response.ok) {
        throw new Error(`File not found: ${githubPath}`)
    }

    const fileData = await response.json()
    const sha = fileData.sha

    // Delete the file
    const deleteResponse = await fetch(
        `${GITHUB_API_BASE}/repos/${repoOwner}/${repoName}/contents/${githubPath}`,
        {
            method: "DELETE",
            headers: {
                Authorization: `token ${accessToken}`,
                Accept: "application/vnd.github.v3+json",
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                message: `Delete asset: ${githubPath}`,
                sha,
                branch,
            }),
        }
    )

    if (!deleteResponse.ok) {
        const error = await deleteResponse.json()
        throw new Error(`Failed to delete file: ${error.message || deleteResponse.statusText}`)
    }
}

/**
 * Rename an asset in GitHub
 */
export async function renameGitHubAsset(
    connection: GitHubConnection,
    oldPath: string,
    newPath: string
): Promise<void> {
    const { accessToken, repoOwner, repoName, branch } = connection

    // Get file content
    const content = await getFileContentRaw(accessToken, repoOwner, repoName, oldPath, branch)

    // Create at new location
    await uploadRawBase64(
        accessToken, repoOwner, repoName, newPath, content, branch,
        `Rename: ${oldPath} -> ${newPath}`
    )

    // Delete old file
    await deleteGitHubAsset(connection, oldPath)
}

/**
 * List all assets in a project
 */
export async function listProjectAssets(
    connection: GitHubConnection,
    projectId: string
): Promise<string[]> {
    const { accessToken, repoOwner, repoName, branch } = connection

    const tree = await getRepositoryTree(accessToken, repoOwner, repoName, branch)
    const projectPath = `projects/${projectId}/`

    return tree.tree
        .filter((item: any) => item.path.startsWith(projectPath) && item.type === 'blob')
        .map((item: any) => item.path)
}

/**
 * List all general assets
 */
export async function listGeneralAssets(
    connection: GitHubConnection
): Promise<string[]> {
    const { accessToken, repoOwner, repoName, branch } = connection

    const tree = await getRepositoryTree(accessToken, repoOwner, repoName, branch)

    return tree.tree
        .filter((item: any) => item.path.startsWith('general/') && item.type === 'blob' && !item.path.endsWith('.gitkeep'))
        .map((item: any) => item.path)
}

// Helper functions

function getDefaultExtension(fileType: string): string {
    switch (fileType) {
        case 'image': return 'png'
        case 'model': return 'glb'
        case 'video': return 'mp4'
        case 'audio': return 'mp3'
        default: return 'bin'
    }
}

async function blobToBase64(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader()
        reader.onloadend = () => {
            const result = reader.result as string
            // Remove data URL prefix to get just base64
            const base64 = result.split(',')[1]
            resolve(base64)
        }
        reader.onerror = reject
        reader.readAsDataURL(blob)
    })
}

async function getFileContentRaw(
    accessToken: string,
    owner: string,
    repo: string,
    path: string,
    branch: string
): Promise<string> {
    const response = await fetch(
        `${GITHUB_API_BASE}/repos/${owner}/${repo}/contents/${path}?ref=${branch}`,
        {
            headers: {
                Authorization: `token ${accessToken}`,
                Accept: "application/vnd.github.v3+json",
            },
        }
    )

    if (!response.ok) {
        throw new Error(`Failed to fetch file: ${response.statusText}`)
    }

    const data = await response.json()
    return data.content.replace(/\n/g, '') // Remove newlines from base64
}

async function uploadRawBase64(
    accessToken: string,
    owner: string,
    repo: string,
    path: string,
    base64Content: string,
    branch: string,
    message: string
): Promise<void> {
    // First check if file exists to get SHA
    let sha: string | undefined

    try {
        const getResponse = await fetch(
            `${GITHUB_API_BASE}/repos/${owner}/${repo}/contents/${path}?ref=${branch}`,
            {
                headers: {
                    Authorization: `token ${accessToken}`,
                    Accept: "application/vnd.github.v3+json",
                },
            }
        )

        if (getResponse.ok) {
            const fileData = await getResponse.json()
            sha = fileData.sha
        }
    } catch {
        // File doesn't exist, that's fine
    }

    const response = await fetch(
        `${GITHUB_API_BASE}/repos/${owner}/${repo}/contents/${path}`,
        {
            method: "PUT",
            headers: {
                Authorization: `token ${accessToken}`,
                Accept: "application/vnd.github.v3+json",
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                message,
                content: base64Content,
                branch,
                ...(sha && { sha }),
            }),
        }
    )

    if (!response.ok) {
        const error = await response.json()
        throw new Error(`Failed to upload file: ${error.message || response.statusText}`)
    }
}
