import { createClient } from "@supabase/supabase-js"
import type { Asset, Image, Model, Project } from "../types"
import { createProjectBucket, deleteProjectBucket } from "./assetService"
import { cachedQuery, CacheKeys, CacheTTL, invalidateCacheByPrefix } from "./cache"

// Main Supabase client (for auth, profiles, subscriptions)
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || ""
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || ""

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

// Re-export for use in hooks
export { supabase as supabaseClient }

// Initialize multi-database manager for data operations
// Pass the main client to avoid creating duplicate GoTrueClient instances
import { getMultiDbManager, initMultiDbManager } from "./multiDbManager"
initMultiDbManager(supabase)

// Authentication operations
export async function signUp(email: string, password: string) {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
  })
  if (error) throw error
  return data
}

export async function signIn(email: string, password: string) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  })
  if (error) throw error
  return data
}

export async function signOut() {
  const { error } = await supabase.auth.signOut()
  if (error) throw error
}

export async function getCurrentUser() {
  const { data: { user } } = await supabase.auth.getUser()
  return user
}

export async function getSession() {
  const { data: { session } } = await supabase.auth.getSession()
  return session
}

// Project operations
export async function createProject(project: Omit<Project, "id" | "createdAt">): Promise<Project> {
  const { data, error } = await supabase
    .from("projects")
    .insert(project)
    .select()
    .single()

  if (error) throw error

  // Create storage bucket for the project
  try {
    // Use assetService to create the bucket (handles naming and existence check)
    await createProjectBucket(data.id)
  } catch (e) {
    console.warn("Exception creating bucket:", e)
  }

  // Invalidate projects cache
  invalidateCacheByPrefix(`projects:${project.userId}`)

  return data
}

export async function getProjects(userId: string): Promise<Project[]> {
  return cachedQuery(
    CacheKeys.projects(userId),
    async () => {
      const { data, error } = await supabase
        .from("projects")
        .select("*")
        .eq("userId", userId)
        .order("createdAt", { ascending: false })

      if (error) throw error
      return data || []
    },
    { ttl: CacheTTL.PROJECTS }
  )
}

export async function deleteProject(projectId: string): Promise<void> {
  // Delete project bucket and assets first
  try {
    await deleteProjectBucket(projectId)
  } catch (e) {
    console.warn("Failed to delete project bucket:", e)
  }

  const { error } = await supabase
    .from("projects")
    .delete()
    .eq("id", projectId)

  if (error) throw error

  // Invalidate projects cache (we don't know userId here, so invalidate all)
  invalidateCacheByPrefix("projects:")
}

// Asset operations
export async function createAsset(asset: Omit<Asset, "id" | "createdAt">): Promise<Asset> {
  const { data, error } = await supabase
    .from("assets")
    .insert(asset)
    .select()
    .single()

  if (error) throw error
  return data
}

export async function updateAsset(assetId: string, updates: Partial<Asset>): Promise<Asset> {
  const { data, error } = await supabase
    .from("assets")
    .update(updates)
    .eq("id", assetId)
    .select()
    .single()

  if (error) throw error
  return data
}

export async function getAssets(projectId: string): Promise<Asset[]> {
  const { data, error } = await supabase
    .from("assets")
    .select("*")
    .eq("projectId", projectId)
    .order("createdAt", { ascending: false })

  if (error) throw error
  return data || []
}

// Image operations
export async function saveImage(image: Omit<Image, "id" | "createdAt">): Promise<Image> {
  const { data, error } = await supabase
    .from("images")
    .insert(image)
    .select()
    .single()

  if (error) throw error
  return data
}

export async function getImages(assetId: string): Promise<Image[]> {
  const { data, error } = await supabase
    .from("images")
    .select("*")
    .eq("assetId", assetId)

  if (error) throw error
  return data || []
}

// Model operations
export async function saveModel(model: Omit<Model, "id" | "createdAt">): Promise<Model> {
  const { data, error } = await supabase
    .from("models")
    .insert(model)
    .select()
    .single()

  if (error) throw error
  return data
}

// Storage operations
// Upload to main database storage (for assets, projects, etc.)
export async function uploadFile(
  bucket: string,
  path: string,
  file: File | Blob
): Promise<string> {
  const { error } = await supabase.storage
    .from(bucket)
    .upload(path, file, {
      cacheControl: "3600",
      upsert: false,
    })

  if (error) throw error

  const { data: urlData } = supabase.storage
    .from(bucket)
    .getPublicUrl(path)

  return urlData.publicUrl
}

// Upload to active data database storage (for user-generated images, models, etc.)
export async function uploadFileToDataDb(
  bucket: string,
  path: string,
  file: File | Blob
): Promise<string> {
  const { getMultiDbManager } = await import("./multiDbManager")
  const dbManager = getMultiDbManager()
  const activeDb = dbManager.getActiveDb()

  if (!activeDb) {
    throw new Error("No active data database available")
  }

  const { error } = await activeDb.storage
    .from(bucket)
    .upload(path, file, {
      cacheControl: "3600",
      upsert: false,
    })

  if (error) throw error

  const { data: urlData } = activeDb.storage
    .from(bucket)
    .getPublicUrl(path)

  return urlData.publicUrl
}

export async function getSignedUrl(bucket: string, path: string): Promise<string> {
  const { data, error } = await supabase.storage
    .from(bucket)
    .createSignedUrl(path, 3600)

  if (error) throw error
  return data.signedUrl
}

// Project Files operations (for data databases)

export interface ProjectFile {
  id?: string
  projectId: string
  userId: string
  path: string
  content: string
  fileType?: string
  createdAt?: string
  updatedAt?: string
}

/**
 * Delete a project file directly from the database using service role key
 * This bypasses RLS and handles the FK constraint with project_file_metadata
 * 
 * @param projectId - The project ID
 * @param userId - The user ID
 * @param path - The file path to delete
 * @returns true if deletion was successful, false otherwise
 */
export async function deleteProjectFileDirectly(
  projectId: string,
  userId: string,
  path: string
): Promise<boolean> {
  if (!projectId || !userId || !path) {
    console.warn('deleteProjectFileDirectly: Missing required parameters')
    return false
  }

  // Invalidate cache immediately so reloads get fresh data
  invalidateCacheByPrefix(`projectFiles:${projectId}`)

  const manager = getMultiDbManager()
  const activeDbId = manager.getCurrentActiveDbId()

  // Try to get service role client first (bypasses RLS)
  let db = activeDbId ? manager.getServiceDb(activeDbId) : null

  if (!db) {
    db = await manager.ensureActiveDbAvailable()
  }

  try {
    // 1. Manually delete metadata first to avoid ON DELETE constraint issues
    // Note: The below delete often fails with 400 if metadata table doesn't have path column.
    // Instead, we bypass the DB trigger crash (caused by NEW.projectId being null on DELETE)
    // by using an UPDATE query to softly delete the file.
    
    // Instead of DELETE, we UPDATE the path so it's hidden and filtered out by loadProjectFiles,
    // avoiding the broken DB trigger entirely while achieving the exact same result.
    const deletedPath = `.koye/deleted/${Date.now()}_${path.replace(/\//g, '_')}`
    
    const { error } = await db
      .from("project_files")
      .update({ path: deletedPath, content: null })
      .eq("projectId", projectId)
      .eq("path", path)

    if (error) {
      console.error("Failed to delete project file from DB:", error)
      return false
    }

    console.log(`Successfully deleted file from DB: ${path} (soft delete)`)
    return true
  } catch (error) {
    console.error("Exception while deleting file:", error)
    return false
  }
}
/**
 * Save project files to data database
 * Only upserts current files - does not delete missing files from DB
 * This treats the local generatedFiles as the source of truth for the session
 */
export async function saveProjectFiles(
  projectId: string,
  userId: string,
  files: Record<string, string>
): Promise<void> {
  if (!projectId || !userId) {
    console.warn('saveProjectFiles: Missing projectId or userId, skipping save')
    return
  }

  // Guard against null/undefined files
  if (!files || typeof files !== 'object') {
    console.warn('saveProjectFiles: No files to save')
    return
  }

  // Invalidate cache immediately so downstream queries don't get stale data
  invalidateCacheByPrefix(`projectFiles:${projectId}`)

  const manager = getMultiDbManager()
  const db = await manager.ensureActiveDbAvailable()

  // Only upsert files that currently exist in the project
  // We don't delete from DB - the local generatedFiles state is the session truth
  const fileEntries = Object.entries(files || {})
    .filter(([path, content]) => path && content !== undefined)
    .map(([path, content]) => ({
      projectId,
      userId,
      path,
      content: content || '',
      fileType: path.split('.').pop()?.toLowerCase() || 'code',
      updatedAt: new Date().toISOString()
    }))

  if (fileEntries.length > 0) {
    try {
      // Batch upsert in chunks to avoid timeout
      const chunkSize = 50
      for (let i = 0; i < fileEntries.length; i += chunkSize) {
        const chunk = fileEntries.slice(i, i + chunkSize)
        const { error } = await db
          .from("project_files")
          .upsert(chunk, {
            onConflict: 'projectId,path',
            ignoreDuplicates: false
          })

        if (error) {
          console.error('Error upserting project files chunk:', error)
          // Continue with other chunks even if one fails
        }
      }
    } catch (error) {
      console.error('Error in saveProjectFiles:', error)
      // Don't throw - auto-save failures shouldn't break the UI
    }
  }

  // Note: File deletions are now handled directly via deleteProjectFileDirectly()
  // called from BuilderSidebar when user deletes a file. No need to process
  // .settings.koye here anymore.
}

/**
 * Load project files from data database
 */
export async function loadProjectFiles(
  projectId: string,
  userId: string
): Promise<Record<string, string>> {
  return cachedQuery(
    `projectFiles:${projectId}:${userId}`,
    async () => {
      const manager = getMultiDbManager()
      const db = await manager.ensureActiveDbAvailable()

      const { data, error } = await db
        .from("project_files")
        .select("path, content")
        .eq("projectId", projectId)
        .eq("userId", userId)

      if (error) throw error

      // Convert array to Record
      const files: Record<string, string> = {}
      if (data) {
        data.forEach(file => {
          if (file.path && !file.path.startsWith('.koye/deleted/')) {
            files[file.path] = file.content
          }
        })
      }

      return files
    },
    { ttl: CacheTTL.DEFAULT }
  )
}

/**
 * Save a single project file to data database
 */
export async function saveProjectFile(
  projectId: string,
  userId: string,
  path: string,
  content: string
): Promise<void> {
  // Invalidate cache immediately
  invalidateCacheByPrefix(`projectFiles:${projectId}`)

  const manager = getMultiDbManager()
  const db = await manager.ensureActiveDbAvailable()

  const { error } = await db
    .from("project_files")
    .upsert({
      projectId,
      userId,
      path,
      content,
      fileType: path.split('.').pop()?.toLowerCase() || 'code'
    }, {
      onConflict: 'projectId,path'
    })

  if (error) throw error
}


/**
 * Load only the settings file from data database
 */
export async function loadProjectSettingsFile(
  projectId: string,
  userId: string
): Promise<string | null> {
  const manager = getMultiDbManager()
  const db = await manager.ensureActiveDbAvailable()

  const { data, error } = await db
    .from("project_files")
    .select("content")
    .eq("projectId", projectId)
    .eq("userId", userId)
    .eq("path", ".settings.koye")
    .single()

  if (error) {
    if (error.code === 'PGRST116') { // No rows found
      return null
    }
    console.warn("Error loading settings file:", error)
    return null
  }

  return data?.content || null
}
