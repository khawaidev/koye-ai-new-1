// GitHub Integration Service
// Handles OAuth connection, repository creation, commits, and pushes

const GITHUB_CLIENT_ID = import.meta.env.VITE_GITHUB_CLIENT_ID || ""
const GITHUB_REDIRECT_URI = `${window.location.origin}/dashboard?tab=projects`
const GITHUB_API_BASE = "https://api.github.com"

export interface GitHubRepo {
  id: number
  name: string
  full_name: string
  private: boolean
  html_url: string
  default_branch: string
}

export interface GitHubFile {
  path: string
  content: string
  encoding?: "base64" | "utf-8"
}

/**
 * Initiate GitHub OAuth flow
 * @returns OAuth URL
 * @throws Error if GitHub Client ID is not configured
 */
export function getGitHubOAuthUrl(): string {
  if (!GITHUB_CLIENT_ID || GITHUB_CLIENT_ID.trim() === "") {
    throw new Error(
      "GitHub Client ID is not configured. Please set VITE_GITHUB_CLIENT_ID in your .env file. " +
      "You can create a GitHub OAuth App at https://github.com/settings/developers"
    )
  }

  // Required scopes for KOYE project sync:
  // - repo: Full control of private repositories (create, read, write, delete)
  // - workflow: Update GitHub Actions workflows
  // - read:user: Read user profile (for username/avatar)
  const scopes = ["repo", "workflow", "read:user"]
  const state = crypto.randomUUID() // CSRF protection

  // Store state in sessionStorage for verification on callback
  sessionStorage.setItem("github_oauth_state", state)

  const params = new URLSearchParams({
    client_id: GITHUB_CLIENT_ID,
    redirect_uri: GITHUB_REDIRECT_URI,
    scope: scopes.join(" "),
    state: state,
  })

  return `https://github.com/login/oauth/authorize?${params.toString()}`
}

/**
 * Exchange OAuth code for access token (should be done on backend)
 * For now, we'll use a placeholder that expects the token to be passed
 */
export async function exchangeGitHubCode(code: string): Promise<string> {
  // This should be done on your backend for security
  // For now, we'll assume the backend endpoint exists
  const response = await fetch("/api/github/oauth", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ code }),
  })

  if (!response.ok) {
    throw new Error("Failed to exchange GitHub OAuth code")
  }

  const data = await response.json()
  return data.access_token
}

/**
 * Get authenticated user's repositories
 * @param accessToken - GitHub access token
 * @returns List of repositories
 */
export async function getUserRepos(accessToken: string): Promise<GitHubRepo[]> {
  const response = await fetch(`${GITHUB_API_BASE}/user/repos?type=all&per_page=100`, {
    headers: {
      Authorization: `token ${accessToken}`,
      Accept: "application/vnd.github.v3+json",
    },
  })

  if (!response.ok) {
    throw new Error(`Failed to fetch repositories: ${response.statusText}`)
  }

  return response.json()
}

/**
 * Create a new private repository
 * @param accessToken - GitHub access token
 * @param name - Repository name
 * @param description - Repository description
 * @returns Created repository
 */
export async function createRepository(
  accessToken: string,
  name: string,
  description: string = ""
): Promise<GitHubRepo> {
  const response = await fetch(`${GITHUB_API_BASE}/user/repos`, {
    method: "POST",
    headers: {
      Authorization: `token ${accessToken}`,
      Accept: "application/vnd.github.v3+json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      name,
      description,
      private: true,
      auto_init: true, // Initialize with a README so the repo is immediately usable
    }),
  })

  if (!response.ok) {
    const error = await response.json()
    console.error("GitHub create repo error:", response.status, JSON.stringify(error, null, 2))

    // 422 usually means repo already exists or validation error
    if (response.status === 422) {
      // Check if it's "name already exists" - if so, repo exists but we couldn't access it
      const nameExists = error.errors?.some((e: { field?: string; message?: string }) =>
        e.message?.includes("already exists") || e.field === "name"
      )
      if (nameExists) {
        throw new Error(`Repository "${name}" already exists on your account. Please check your GitHub repositories.`)
      }
      const errorMessage = error.errors?.[0]?.message || error.message || "Repository creation failed"
      throw new Error(`Failed to create repository: ${errorMessage}`)
    }

    throw new Error(`Failed to create repository: ${error.message || response.statusText}`)
  }

  return response.json()
}

/**
 * Create or update a file in a repository
 * @param accessToken - GitHub access token
 * @param owner - Repository owner
 * @param repo - Repository name
 * @param path - File path
 * @param content - File content
 * @param branch - Branch name (default: game-dev-ai)
 * @param message - Commit message
 * @returns Commit SHA
 */
export async function createOrUpdateFile(
  accessToken: string,
  owner: string,
  repo: string,
  path: string,
  content: string,
  branch: string = "game-dev-ai",
  message: string = `Add/Update ${path}`
): Promise<string> {
  const maxRetries = 3
  let lastError: Error | null = null

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    // Fresh SHA fetch on each attempt
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
      // File doesn't exist, that's fine - we'll create it
    }

    // Encode content as base64
    const encodedContent = btoa(unescape(encodeURIComponent(content)))

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
          content: encodedContent,
          branch,
          ...(sha && { sha }), // Include SHA if updating existing file
        }),
      }
    )

    if (response.ok) {
      const data = await response.json()
      return data.commit.sha
    }

    // Handle 409 Conflict - SHA mismatch, retry with fresh SHA
    if (response.status === 409) {
      console.warn(`[createOrUpdateFile] 409 Conflict for ${path}, retrying (attempt ${attempt + 1}/${maxRetries})...`)
      lastError = new Error(`SHA conflict on ${path}, attempt ${attempt + 1}`)
      // Small delay before retry to let GitHub stabilize
      await new Promise(resolve => setTimeout(resolve, 500 * (attempt + 1)))
      continue
    }

    // Other errors - fail immediately
    const error = await response.json()
    throw new Error(`Failed to create/update file: ${error.message || response.statusText}`)
  }

  // All retries exhausted
  throw lastError || new Error(`Failed to update ${path} after ${maxRetries} attempts`)
}

/**
 * Create multiple files in a repository (batch operation)
 * @param accessToken - GitHub access token
 * @param owner - Repository owner
 * @param repo - Repository name
 * @param files - Array of files to create/update
 * @param branch - Branch name (default: game-dev-ai)
 * @param message - Commit message
 * @returns Array of commit SHAs
 */
export async function createOrUpdateFiles(
  accessToken: string,
  owner: string,
  repo: string,
  files: GitHubFile[],
  branch: string = "game-dev-ai",
  message: string = "Add game assets and code"
): Promise<string[]> {
  // For batch operations, we'll use the create-tree API for better performance
  // But for simplicity, we'll do sequential commits for now

  const shas: string[] = []

  for (const file of files) {
    try {
      const sha = await createOrUpdateFile(
        accessToken,
        owner,
        repo,
        file.path,
        file.content,
        branch,
        `Add ${file.path}`
      )
      shas.push(sha)
    } catch (error) {
      console.error(`Failed to create/update ${file.path}:`, error)
      throw error
    }
  }

  return shas
}

/**
 * Get file contents from repository
 * @param accessToken - GitHub access token
 * @param owner - Repository owner
 * @param repo - Repository name
 * @param path - File path
 * @param branch - Branch name
 * @returns File content
 */
export async function getFileContent(
  accessToken: string,
  owner: string,
  repo: string,
  path: string,
  branch: string = "game-dev-ai"
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

  // Decode base64 content
  if (data.encoding === "base64") {
    return decodeURIComponent(escape(atob(data.content)))
  }

  return data.content
}

/**
 * Get repository tree (file structure)
 * @param accessToken - GitHub access token
 * @param owner - Repository owner
 * @param repo - Repository name
 * @param branch - Branch name
 * @returns Tree structure
 */
export async function getRepositoryTree(
  accessToken: string,
  owner: string,
  repo: string,
  branch: string = "game-dev-ai"
): Promise<any> {
  // First get the branch SHA
  const branchResponse = await fetch(
    `${GITHUB_API_BASE}/repos/${owner}/${repo}/git/ref/heads/${branch}`,
    {
      headers: {
        Authorization: `token ${accessToken}`,
        Accept: "application/vnd.github.v3+json",
      },
    }
  )

  if (!branchResponse.ok) {
    // Branch doesn't exist, return empty tree
    return { tree: [] }
  }

  const branchData = await branchResponse.json()
  const commitSha = branchData.object.sha

  // Get the commit
  const commitResponse = await fetch(
    `${GITHUB_API_BASE}/repos/${owner}/${repo}/git/commits/${commitSha}`,
    {
      headers: {
        Authorization: `token ${accessToken}`,
        Accept: "application/vnd.github.v3+json",
      },
    }
  )

  if (!commitResponse.ok) {
    return { tree: [] }
  }

  const commitData = await commitResponse.json()
  const treeSha = commitData.tree.sha

  // Get the tree recursively
  const treeResponse = await fetch(
    `${GITHUB_API_BASE}/repos/${owner}/${repo}/git/trees/${treeSha}?recursive=1`,
    {
      headers: {
        Authorization: `token ${accessToken}`,
        Accept: "application/vnd.github.v3+json",
      },
    }
  )

  if (!treeResponse.ok) {
    return { tree: [] }
  }

  return treeResponse.json()
}

