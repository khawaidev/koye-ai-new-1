/**
 * GitHub Project Sync Service
 * 
 * Handles syncing project code files to the user's connected GitHub repository.
 * This service manages:
 * - Creating GitHub repos/folders for projects
 * - Syncing code file changes (create, update, delete)
 * - Tracking sync status
 */

import {
    createOrUpdateFile,
    createRepository,
    type GitHubRepo
} from './github'
import { supabase } from './supabase'

const GITHUB_API_BASE = "https://api.github.com"

export interface GitHubConnectionDetails {
    accessToken: string
    repoOwner: string
    repoName: string
    branch: string
}

export interface ProjectGitHubInfo {
    githubRepoId: string
    githubRepoName: string
    githubRepoOwner: string
    githubBranch: string
    githubSyncEnabled: boolean
    githubLastSyncedAt: string | null
}

export interface SyncResult {
    success: boolean
    syncedFiles: string[]
    failedFiles: string[]
    errors: string[]
}

// Required GitHub OAuth scopes for project sync
export const REQUIRED_GITHUB_SCOPES = [
    'repo',           // Full control of private repositories
    'workflow',       // Update GitHub Action workflows
    'write:packages', // Write packages (optional, for future use)
]

/**
 * Check if user has GitHub connected with required permissions
 */
export async function checkGitHubConnection(userId: string): Promise<{
    isConnected: boolean
    hasRequiredScopes: boolean
    connection: GitHubConnectionDetails | null
    missingScopes: string[]
}> {
    // First check localStorage for connection
    const storageKey = `github_connection_${userId}`
    const storedConnection = localStorage.getItem(storageKey)

    if (!storedConnection) {
        return {
            isConnected: false,
            hasRequiredScopes: false,
            connection: null,
            missingScopes: REQUIRED_GITHUB_SCOPES
        }
    }

    try {
        const connection = JSON.parse(storedConnection)

        // If we have a placeholder token (oauth_code_*), user needs to exchange it
        if (connection.accessToken?.startsWith('oauth_code_')) {
            return {
                isConnected: true,
                hasRequiredScopes: false, // Can't verify scopes without real token
                connection: null,
                missingScopes: []
            }
        }

        // Verify token is still valid by making a simple API call
        const isValid = await verifyGitHubToken(connection.accessToken)

        if (!isValid) {
            return {
                isConnected: false,
                hasRequiredScopes: false,
                connection: null,
                missingScopes: REQUIRED_GITHUB_SCOPES
            }
        }

        return {
            isConnected: true,
            hasRequiredScopes: true, // Assume true if token is valid (scopes requested at OAuth)
            connection: connection as GitHubConnectionDetails,
            missingScopes: []
        }
    } catch (error) {
        console.error('Error checking GitHub connection:', error)
        return {
            isConnected: false,
            hasRequiredScopes: false,
            connection: null,
            missingScopes: REQUIRED_GITHUB_SCOPES
        }
    }
}

/**
 * Verify GitHub token is still valid
 */
async function verifyGitHubToken(accessToken: string): Promise<boolean> {
    try {
        const response = await fetch(`${GITHUB_API_BASE}/user`, {
            headers: {
                Authorization: `token ${accessToken}`,
                Accept: 'application/vnd.github.v3+json'
            }
        })
        return response.ok
    } catch {
        return false
    }
}

/**
 * Get authenticated GitHub user info
 */
export async function getGitHubUser(accessToken: string): Promise<{
    id: number
    login: string
    name: string
    avatarUrl: string
    type: string // "User" or "Organization"
} | null> {
    try {
        const response = await fetch(`${GITHUB_API_BASE}/user`, {
            headers: {
                Authorization: `token ${accessToken}`,
                Accept: 'application/vnd.github.v3+json'
            }
        })

        if (!response.ok) {
            return null
        }

        const data = await response.json()
        return {
            id: data.id,
            login: data.login,
            name: data.name || data.login,
            avatarUrl: data.avatar_url,
            type: data.type || 'User'
        }
    } catch (error) {
        console.error('Error fetching GitHub user:', error)
        return null
    }
}

/**
 * Create or get a repository for storing KOYE projects
 * Creates a private repository named "koye-projects" if it doesn't exist
 */
export async function ensureProjectRepository(
    accessToken: string,
    repoOwner: string
): Promise<GitHubRepo | null> {
    const KOYE_REPO_NAME = 'koye-projects'

    // Helper to check if repo exists
    const checkRepoExists = async (): Promise<GitHubRepo | null> => {
        const response = await fetch(
            `${GITHUB_API_BASE}/repos/${repoOwner}/${KOYE_REPO_NAME}`,
            {
                headers: {
                    Authorization: `token ${accessToken}`,
                    Accept: 'application/vnd.github.v3+json'
                }
            }
        )

        if (response.ok) {
            const repo = await response.json()
            return {
                id: repo.id,
                name: repo.name,
                full_name: repo.full_name,
                private: repo.private,
                html_url: repo.html_url,
                default_branch: repo.default_branch
            }
        }
        return null
    }

    try {
        // Check if repo already exists
        let repo = await checkRepoExists()
        if (repo) {
            console.log('✓ koye-projects repository found')
            return repo
        }

        // Repo doesn't exist, create it
        console.log('Creating koye-projects repository...')

        try {
            const newRepo = await createRepository(
                accessToken,
                KOYE_REPO_NAME,
                'KOYE AI Game Development Projects - Private repository for storing game project code and assets'
            )
            console.log('✓ koye-projects repository created')

            // Wait a moment for GitHub to fully initialize the repo
            await new Promise(resolve => setTimeout(resolve, 2000))

            // Re-fetch to get the latest repo info (including default_branch)
            const freshRepo = await checkRepoExists()
            return freshRepo || newRepo
        } catch (createError) {
            // If creation failed with 422, the repo might already exist (race condition)
            // or be in the process of being created - try checking again
            console.warn('Repository creation may have failed, checking if it exists...', createError)

            // Wait and retry
            await new Promise(resolve => setTimeout(resolve, 2000))

            repo = await checkRepoExists()
            if (repo) {
                console.log('✓ koye-projects repository exists after retry')
                return repo
            }

            // Still no repo - re-throw the original error
            throw createError
        }
    } catch (error) {
        console.error('Error ensuring project repository:', error)
        return null
    }
}

/**
 * Create a project folder in the GitHub repository
 */
export async function createProjectFolder(
    accessToken: string,
    repoOwner: string,
    repoName: string,
    branch: string,
    projectId: string,
    projectName: string
): Promise<boolean> {
    try {
        const projectPath = `projects/${projectId}`

        // Create project README
        await createOrUpdateFile(
            accessToken,
            repoOwner,
            repoName,
            `${projectPath}/README.md`,
            `# ${projectName}\n\nProject ID: \`${projectId}\`\nCreated: ${new Date().toISOString()}\n\n## Description\n\nThis project was created with KOYE AI Game Development Platform.\n\n## Files\n\nProject files are automatically synced from KOYE AI.\n`,
            branch,
            `Create project: ${projectName}`
        )

        // Create basic folder structure
        const folders = ['src', 'assets', 'assets/images', 'assets/models', 'assets/audio', 'assets/videos']
        for (const folder of folders) {
            await createOrUpdateFile(
                accessToken,
                repoOwner,
                repoName,
                `${projectPath}/${folder}/.gitkeep`,
                '',
                branch,
                `Initialize ${folder} folder`
            )
        }

        return true
    } catch (error) {
        console.error('Error creating project folder:', error)
        return false
    }
}

/**
 * Sync a single file to GitHub
 */
export async function syncFileToGitHub(
    accessToken: string,
    repoOwner: string,
    repoName: string,
    branch: string,
    projectId: string,
    filePath: string,
    content: string
): Promise<{ success: boolean; sha?: string; error?: string }> {
    try {
        const githubPath = `projects/${projectId}/${filePath}`

        const sha = await createOrUpdateFile(
            accessToken,
            repoOwner,
            repoName,
            githubPath,
            content,
            branch,
            `Update ${filePath}`
        )

        return { success: true, sha }
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error'
        console.error(`Error syncing file ${filePath}:`, error)
        return { success: false, error: errorMessage }
    }
}

/**
 * Delete a file from GitHub
 */
export async function deleteFileFromGitHub(
    accessToken: string,
    repoOwner: string,
    repoName: string,
    branch: string,
    projectId: string,
    filePath: string
): Promise<boolean> {
    try {
        const githubPath = `projects/${projectId}/${filePath}`

        // First get the file SHA
        const getResponse = await fetch(
            `${GITHUB_API_BASE}/repos/${repoOwner}/${repoName}/contents/${githubPath}?ref=${branch}`,
            {
                headers: {
                    Authorization: `token ${accessToken}`,
                    Accept: 'application/vnd.github.v3+json'
                }
            }
        )

        if (!getResponse.ok) {
            // File doesn't exist in GitHub, consider it deleted
            return true
        }

        const fileData = await getResponse.json()
        const sha = fileData.sha

        // Delete the file
        const deleteResponse = await fetch(
            `${GITHUB_API_BASE}/repos/${repoOwner}/${repoName}/contents/${githubPath}`,
            {
                method: 'DELETE',
                headers: {
                    Authorization: `token ${accessToken}`,
                    Accept: 'application/vnd.github.v3+json',
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    message: `Delete ${filePath}`,
                    sha,
                    branch
                })
            }
        )

        return deleteResponse.ok
    } catch (error) {
        console.error(`Error deleting file ${filePath}:`, error)
        return false
    }
}

/**
 * Sync all project files to GitHub
 */
export async function syncProjectToGitHub(
    connection: GitHubConnectionDetails,
    projectId: string,
    files: Record<string, string>
): Promise<SyncResult> {
    const result: SyncResult = {
        success: true,
        syncedFiles: [],
        failedFiles: [],
        errors: []
    }

    const { accessToken, repoOwner, repoName, branch } = connection

    for (const [filePath, content] of Object.entries(files)) {
        // Skip non-code files (assets are handled separately)
        if (isAssetFile(filePath)) {
            continue
        }

        const syncResult = await syncFileToGitHub(
            accessToken,
            repoOwner,
            repoName,
            branch,
            projectId,
            filePath,
            content
        )

        if (syncResult.success) {
            result.syncedFiles.push(filePath)
        } else {
            result.success = false
            result.failedFiles.push(filePath)
            if (syncResult.error) {
                result.errors.push(`${filePath}: ${syncResult.error}`)
            }
        }
    }

    // Update last synced timestamp in Supabase
    if (result.syncedFiles.length > 0) {
        try {
            await supabase
                .from('projects')
                .update({ githubLastSyncedAt: new Date().toISOString() })
                .eq('id', projectId)
        } catch (error) {
            console.warn('Failed to update sync timestamp:', error)
        }
    }

    return result
}

/**
 * Check if a file path is an asset (not code)
 */
function isAssetFile(filePath: string): boolean {
    const assetExtensions = ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg', '.glb', '.gltf', '.obj', '.fbx', '.mp3', '.wav', '.ogg', '.mp4', '.webm']
    const lowerPath = filePath.toLowerCase()
    return assetExtensions.some(ext => lowerPath.endsWith(ext))
}

/**
 * Check if a file is a code file that should be synced
 */
export function isCodeFile(filePath: string): boolean {
    const codeExtensions = [
        '.js', '.jsx', '.ts', '.tsx', '.mjs', '.cjs',
        '.html', '.css', '.scss', '.sass', '.less',
        '.json', '.yml', '.yaml', '.toml',
        '.md', '.txt', '.gitignore',
        '.py', '.lua', '.cs', '.cpp', '.c', '.h',
        '.sh', '.bat', '.ps1',
        '.env.example', '.config'
    ]
    const lowerPath = filePath.toLowerCase()

    // Check extension
    if (codeExtensions.some(ext => lowerPath.endsWith(ext))) {
        return true
    }

    // Check common code filenames without extensions
    const codeFileNames = ['Makefile', 'Dockerfile', 'Jenkinsfile', '.editorconfig', '.prettierrc', '.eslintrc']
    const fileName = filePath.split('/').pop() || ''
    return codeFileNames.includes(fileName)
}

/**
 * Calculate hash of file content for change detection
 */
export function calculateFileHash(content: string): string {
    // Simple hash for browser environment (not crypto-secure, but good for change detection)
    let hash = 0
    for (let i = 0; i < content.length; i++) {
        const char = content.charCodeAt(i)
        hash = ((hash << 5) - hash) + char
        hash = hash & hash // Convert to 32-bit integer
    }
    return hash.toString(16)
}

/**
 * Get project GitHub info from Supabase
 */
export async function getProjectGitHubInfo(projectId: string): Promise<ProjectGitHubInfo | null> {
    try {
        const { data, error } = await supabase
            .from('projects')
            .select('githubRepoId, githubRepoName, githubRepoOwner, githubBranch, githubSyncEnabled, githubLastSyncedAt')
            .eq('id', projectId)
            .single()

        if (error || !data) {
            return null
        }

        return data as ProjectGitHubInfo
    } catch (error) {
        console.error('Error getting project GitHub info:', error)
        return null
    }
}

/**
 * Update project GitHub info in Supabase
 */
export async function updateProjectGitHubInfo(
    projectId: string,
    info: Partial<ProjectGitHubInfo>
): Promise<boolean> {
    try {
        const { error } = await supabase
            .from('projects')
            .update(info)
            .eq('id', projectId)

        return !error
    } catch (error) {
        console.error('Error updating project GitHub info:', error)
        return false
    }
}

/**
 * Initialize a new project with GitHub sync
 * Creates the project folder in GitHub and updates the project record
 */
export async function initializeProjectGitHubSync(
    connection: GitHubConnectionDetails,
    projectId: string,
    projectName: string
): Promise<boolean> {
    const { accessToken, repoOwner, repoName, branch } = connection

    try {
        // Create project folder in GitHub
        const folderCreated = await createProjectFolder(
            accessToken,
            repoOwner,
            repoName,
            branch,
            projectId,
            projectName
        )

        if (!folderCreated) {
            console.error('Failed to create project folder in GitHub')
            return false
        }

        // Update project record with GitHub info
        const updated = await updateProjectGitHubInfo(projectId, {
            githubRepoName: repoName,
            githubRepoOwner: repoOwner,
            githubBranch: branch,
            githubSyncEnabled: true,
            githubLastSyncedAt: new Date().toISOString()
        })

        return updated
    } catch (error) {
        console.error('Error initializing project GitHub sync:', error)
        return false
    }
}
