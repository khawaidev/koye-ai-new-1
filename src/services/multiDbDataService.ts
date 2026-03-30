import type { Audio, ChatSession, Image, Job, Model, Video } from "../types"
import { cachedQuery, CacheKeys, CacheTTL, invalidateCacheByPrefix } from "./cache"
import { deleteAssetFromR2, parseR2Url } from "./r2Storage"
import { getMultiDbManager } from "./multiDbManager"

/**
 * Multi-Database Data Service
 * Handles all data operations (chats, images, models) across multiple databases
 * 
 * All read operations are cached to reduce Supabase egress.
 * Write operations invalidate relevant caches.
 */

// ==================== Chat Operations ====================

export interface ChatSessionWithDb extends ChatSession {
  dbId: string // Which database this session is stored in
}

/**
 * Save a chat session to the active database
 */
export async function saveChatSession(
  userId: string,
  session: Omit<ChatSession, "id" | "createdAt" | "updatedAt">
): Promise<ChatSessionWithDb> {
  const dbManager = getMultiDbManager()
  const db = await dbManager.ensureActiveDbAvailable()
  const dbId = dbManager.getCurrentActiveDbId()!

  const sessionData = {
    id: (session as any).id || crypto.randomUUID(),
    userId,
    title: session.title,
    messages: session.messages,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }

  const { data, error } = await db
    .from("chat_sessions")
    .insert(sessionData)
    .select()
    .single()

  if (error) throw error

  // Invalidate chat sessions cache
  invalidateCacheByPrefix(`chat:${userId}`)

  return {
    ...data,
    dbId,
  }
}

/**
 * Get all chat sessions for a user (across all databases)
 */
export async function getUserChatSessions(userId: string): Promise<ChatSessionWithDb[]> {
  return cachedQuery(
    CacheKeys.userChatSessions(userId),
    async () => {
      const dbManager = getMultiDbManager()
      const allDbs = dbManager.getAllDbs()
      const sessions: ChatSessionWithDb[] = []

      for (const [dbId, db] of allDbs.entries()) {
        try {
          const { data, error } = await db
            .from("chat_sessions")
            .select("*")
            .eq("userId", userId)
            .order("updatedAt", { ascending: false })

          if (error) {
            console.warn(`Error fetching sessions from ${dbId}:`, error)
            continue
          }

          if (data) {
            sessions.push(
              ...data.map((session) => ({
                ...session,
                dbId,
              }))
            )
          }
        } catch (error) {
          console.warn(`Error querying ${dbId}:`, error)
        }
      }

      return sessions.sort(
        (a, b) =>
          new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
      )
    },
    { ttl: CacheTTL.CHAT_SESSIONS }
  )
}

/**
 * Update a chat session
 */
export async function updateChatSession(
  sessionId: string,
  dbId: string,
  updates: Partial<ChatSession>
): Promise<ChatSessionWithDb> {
  const dbManager = getMultiDbManager()
  const db = dbManager.getDb(dbId)

  if (!db) {
    throw new Error(`Database ${dbId} not found`)
  }

  const updateData = {
    ...updates,
    updatedAt: new Date().toISOString(),
  }

  const { data, error } = await db
    .from("chat_sessions")
    .update(updateData)
    .eq("id", sessionId)
    .select()
    .single()

  if (error) throw error

  // Invalidate chat sessions cache
  invalidateCacheByPrefix(`chat:`)

  return {
    ...data,
    dbId,
  }
}

/**
 * Delete a chat session
 */
export async function deleteChatSession(sessionId: string, dbId: string): Promise<void> {
  const dbManager = getMultiDbManager()
  const db = dbManager.getDb(dbId)

  if (!db) {
    throw new Error(`Database ${dbId} not found`)
  }

  const { error } = await db.from("chat_sessions").delete().eq("id", sessionId)

  if (error) throw error

  // Invalidate chat sessions cache
  invalidateCacheByPrefix(`chat:`)
}

// ==================== Image Operations ====================

export interface ImageWithDb extends Image {
  dbId: string
}

/**
 * Save an image to the active database
 */
export async function saveImage(
  userId: string,
  image: Omit<Image, "id" | "createdAt">,
  projectId?: string
): Promise<ImageWithDb> {
  const dbManager = getMultiDbManager()
  const db = await dbManager.ensureActiveDbAvailable()
  const dbId = dbManager.getCurrentActiveDbId()!

  // Base image data (without projectId first - some schemas may not have this column)
  const baseImageData = {
    id: (image as any).id || crypto.randomUUID(),
    userId,
    assetId: image.assetId || null, // Allow null for standalone images
    view: image.view,
    url: image.url,
    prompt: image.prompt,
    createdAt: new Date().toISOString(),
  }

  // Try with projectId first
  const imageDataWithProject = {
    ...baseImageData,
    projectId: projectId || null,
  }

  let result = await db.from("images").insert(imageDataWithProject).select().single()

  // If projectId column doesn't exist, retry without it
  if (result.error && result.error.message?.includes("projectId")) {
    console.warn("projectId column not found in images table, saving without it")
    result = await db.from("images").insert(baseImageData).select().single()
  }

  if (result.error) throw result.error

  // Invalidate images cache for this user
  invalidateCacheByPrefix(`images:${userId}`)

  return {
    ...result.data,
    dbId,
  }
}

/**
 * Get images for a user (across all databases)
 */
export async function getUserImages(userId: string, assetId?: string): Promise<ImageWithDb[]> {
  return cachedQuery(
    CacheKeys.userImages(userId, assetId),
    async () => {
      const dbManager = getMultiDbManager()
      const allDbs = dbManager.getAllDbs()
      const images: ImageWithDb[] = []

      for (const [dbId, db] of allDbs.entries()) {
        try {
          let query = db.from("images").select("*").eq("userId", userId)

          if (assetId) {
            query = query.eq("assetId", assetId)
          }

          const { data, error } = await query.order("createdAt", { ascending: false })

          if (error) {
            console.warn(`Error fetching images from ${dbId}:`, error)
            continue
          }

          if (data) {
            images.push(
              ...data.map((image) => ({
                ...image,
                dbId,
              }))
            )
          }
        } catch (error) {
          console.warn(`Error querying ${dbId}:`, error)
        }
      }

      return images.sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      )
    },
    { ttl: CacheTTL.ASSETS }
  )
}

/**
 * Delete an image
 */
export async function deleteImage(imageId: string, dbId: string): Promise<void> {
  const dbManager = getMultiDbManager()
  const db = dbManager.getDb(dbId)

  if (!db) {
    throw new Error(`Database ${dbId} not found`)
  }

  // Fetch to get URL for storage deletion
  const { data: image } = await db.from("images").select("url").eq("id", imageId).single()

  if (image?.url) {
    try {
      // First check if it's an R2 URL
      const r2Match = parseR2Url(image.url)
      if (r2Match) {
        await deleteAssetFromR2(r2Match.userId, r2Match.r2Key)
      } else {
        // Fallback to traditional Supabase storage
        const match = image.url.match(/\/storage\/v1\/object\/public\/([^/]+)\/(.+)$/)
        if (match) {
          const bucket = match[1]
          const path = decodeURIComponent(match[2])
          await db.storage.from(bucket).remove([path])
        }
      }
    } catch (e) {
      console.warn("Failed to delete from storage:", e)
    }
  }

  const { error } = await db.from("images").delete().eq("id", imageId)

  if (error) throw error

  // Invalidate images cache
  invalidateCacheByPrefix("images:")
}

/**
 * Get an image by ID (across all databases)
 */
export async function getImageById(imageId: string): Promise<ImageWithDb | null> {
  const dbManager = getMultiDbManager()
  const allDbs = dbManager.getAllDbs()

  for (const [dbId, db] of allDbs.entries()) {
    try {
      const { data, error } = await db
        .from("images")
        .select("*")
        .eq("id", imageId)
        .single()

      if (error) {
        continue // Not found in this db, try next
      }

      if (data) {
        return { ...data, dbId }
      }
    } catch (error) {
      continue
    }
  }

  return null
}

/**
 * Rename an image (update prompt field which serves as name)
 */
export async function renameImage(imageId: string, dbId: string, newName: string): Promise<void> {
  const dbManager = getMultiDbManager()
  const db = dbManager.getDb(dbId)

  if (!db) {
    throw new Error(`Database ${dbId} not found`)
  }

  const { error } = await db
    .from("images")
    .update({ prompt: newName })
    .eq("id", imageId)

  if (error) throw error
}

// ==================== Model Operations ====================

export interface ModelWithDb extends Model {
  dbId: string
}

/**
 * Save a 3D model to the active database
 */
export async function saveModel(
  userId: string,
  model: Omit<Model, "id" | "createdAt">,
  projectId?: string
): Promise<ModelWithDb> {
  const dbManager = getMultiDbManager()
  const db = await dbManager.ensureActiveDbAvailable()
  const dbId = dbManager.getCurrentActiveDbId()!

  const modelData: Record<string, any> = {
    id: (model as any).id || crypto.randomUUID(),
    userId,
    assetId: model.assetId || null, // Allow null for standalone models
    url: model.url,
    format: model.format,
    status: model.status,
    createdAt: new Date().toISOString(),
  }

  // Try with projectId first, fall back without it if column doesn't exist
  if (projectId) {
    modelData.projectId = projectId
  }

  let data: any
  let error: any

    ; ({ data, error } = await db.from("models").insert(modelData).select().single())

  // If projectId column doesn't exist, retry without it
  if (error && error.code === "PGRST204" && modelData.projectId !== undefined) {
    console.warn("models table doesn't have projectId column, retrying without it...")
    delete modelData.projectId
      ; ({ data, error } = await db.from("models").insert(modelData).select().single())
  }

  if (error) throw error

  // Invalidate models cache
  invalidateCacheByPrefix(`models:${userId}`)

  return {
    ...data,
    dbId,
  }
}

/**
 * Get models for a user (across all databases)
 */
export async function getUserModels(userId: string, assetId?: string): Promise<ModelWithDb[]> {
  return cachedQuery(
    CacheKeys.userModels(userId, assetId),
    async () => {
      const dbManager = getMultiDbManager()
      const allDbs = dbManager.getAllDbs()
      const models: ModelWithDb[] = []

      for (const [dbId, db] of allDbs.entries()) {
        try {
          let query = db.from("models").select("*").eq("userId", userId)

          if (assetId) {
            query = query.eq("assetId", assetId)
          }

          const { data, error } = await query.order("createdAt", { ascending: false })

          if (error) {
            console.warn(`Error fetching models from ${dbId}:`, error)
            continue
          }

          if (data) {
            models.push(
              ...data.map((model) => ({
                ...model,
                dbId,
              }))
            )
          }
        } catch (error) {
          console.warn(`Error querying ${dbId}:`, error)
        }
      }

      return models.sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      )
    },
    { ttl: CacheTTL.ASSETS }
  )
}

/**
 * Delete a 3D model
 */
export async function deleteModel(modelId: string, dbId: string): Promise<void> {
  const dbManager = getMultiDbManager()
  const db = dbManager.getDb(dbId)

  if (!db) {
    throw new Error(`Database ${dbId} not found`)
  }

  // Fetch to get URL for storage deletion
  const { data: model } = await db.from("models").select("url").eq("id", modelId).single()

  if (model?.url) {
    try {
      const r2Match = parseR2Url(model.url)
      if (r2Match) {
        await deleteAssetFromR2(r2Match.userId, r2Match.r2Key)
      } else {
        const match = model.url.match(/\/storage\/v1\/object\/public\/([^/]+)\/(.+)$/)
        if (match) {
          const bucket = match[1]
          const path = decodeURIComponent(match[2])
          await db.storage.from(bucket).remove([path])
        }
      }
    } catch (e) {
      console.warn("Failed to delete from storage:", e)
    }
  }

  const { error } = await db.from("models").delete().eq("id", modelId)

  if (error) throw error

  // Invalidate models cache
  invalidateCacheByPrefix("models:")
}

/**
 * Get a model by ID (across all databases)
 */
export async function getModelById(modelId: string): Promise<ModelWithDb | null> {
  const dbManager = getMultiDbManager()
  const allDbs = dbManager.getAllDbs()

  for (const [dbId, db] of allDbs.entries()) {
    try {
      const { data, error } = await db
        .from("models")
        .select("*")
        .eq("id", modelId)
        .single()

      if (error) {
        continue
      }

      if (data) {
        return { ...data, dbId }
      }
    } catch (error) {
      continue
    }
  }

  return null
}

/**
 * Rename a model (models don't have a name field, but we can add a custom field or use assetId description)
 * For now, we'll update the format field to store a name suffix
 */
export async function renameModel(modelId: string, dbId: string, newName: string): Promise<void> {
  const dbManager = getMultiDbManager()
  const db = dbManager.getDb(dbId)

  if (!db) {
    throw new Error(`Database ${dbId} not found`)
  }

  // Models don't have a prompt/name field, so we'll add a metadata update if needed
  // For now, this is a placeholder - the UI should track names separately or we add a name column
  console.log(`Rename model ${modelId} to ${newName} - name stored in UI/local state`)
}

// ==================== Job Operations ====================

export interface JobWithDb extends Job {
  dbId: string
}

/**
 * Save a job to the active database
 */
export async function saveJob(
  userId: string,
  job: Omit<Job, "id" | "createdAt" | "updatedAt">
): Promise<JobWithDb> {
  const dbManager = getMultiDbManager()
  const db = await dbManager.ensureActiveDbAvailable()
  const dbId = dbManager.getCurrentActiveDbId()!

  const jobData = {
    id: (job as any).id || crypto.randomUUID(),
    userId,
    type: job.type,
    status: job.status,
    progress: job.progress || 0,
    result: job.result || null,
    error: job.error || null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }

  const { data, error } = await db.from("jobs").insert(jobData).select().single()

  if (error) throw error

  return {
    ...data,
    dbId,
  }
}

/**
 * Get jobs for a user (across all databases)
 */
export async function getUserJobs(userId: string): Promise<JobWithDb[]> {
  const dbManager = getMultiDbManager()
  const allDbs = dbManager.getAllDbs()
  const jobs: JobWithDb[] = []

  for (const [dbId, db] of allDbs.entries()) {
    try {
      const { data, error } = await db
        .from("jobs")
        .select("*")
        .eq("userId", userId)
        .order("createdAt", { ascending: false })

      if (error) {
        console.warn(`Error fetching jobs from ${dbId}:`, error)
        continue
      }

      if (data) {
        jobs.push(
          ...data.map((job) => ({
            ...job,
            dbId,
          }))
        )
      }
    } catch (error) {
      console.warn(`Error querying ${dbId}:`, error)
    }
  }

  return jobs.sort(
    (a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()
  )
}

/**
 * Update a job
 */
export async function updateJob(
  jobId: string,
  dbId: string,
  updates: Partial<Job>
): Promise<JobWithDb> {
  const dbManager = getMultiDbManager()
  const db = dbManager.getDb(dbId)

  if (!db) {
    throw new Error(`Database ${dbId} not found`)
  }

  const updateData = {
    ...updates,
    updatedAt: new Date().toISOString(),
  }

  const { data, error } = await db
    .from("jobs")
    .update(updateData)
    .eq("id", jobId)
    .select()
    .single()

  if (error) throw error

  return {
    ...data,
    dbId,
  }
}

// ==================== Video Operations ====================

export interface VideoWithDb extends Video {
  dbId: string
}

/**
 * Save a video to the active database
 */
export async function saveVideo(
  userId: string,
  video: Omit<Video, "id" | "createdAt">,
  projectId?: string
): Promise<VideoWithDb> {
  const dbManager = getMultiDbManager()
  const db = await dbManager.ensureActiveDbAvailable()
  const dbId = dbManager.getCurrentActiveDbId()!

  const videoData = {
    id: (video as any).id || crypto.randomUUID(),
    userId,
    assetId: video.assetId,
    url: video.url,
    prompt: video.prompt || null,
    createdAt: new Date().toISOString(),
    projectId: projectId || null,
  }

  const { data, error } = await db.from("videos").insert(videoData).select().single()

  if (error) throw error

  // Invalidate videos cache
  invalidateCacheByPrefix(`videos:${userId}`)

  return {
    ...data,
    dbId,
  }
}

/**
 * Get videos for a user (across all databases)
 */
export async function getUserVideos(userId: string, assetId?: string): Promise<VideoWithDb[]> {
  return cachedQuery(
    CacheKeys.userVideos(userId, assetId),
    async () => {
      const dbManager = getMultiDbManager()
      const allDbs = dbManager.getAllDbs()
      const videos: VideoWithDb[] = []

      for (const [dbId, db] of allDbs.entries()) {
        try {
          let query = db.from("videos").select("*").eq("userId", userId)

          if (assetId) {
            query = query.eq("assetId", assetId)
          }

          const { data, error } = await query.order("createdAt", { ascending: false })

          if (error) {
            console.warn(`Error fetching videos from ${dbId}:`, error)
            continue
          }

          if (data) {
            videos.push(
              ...data.map((video) => ({
                ...video,
                dbId,
              }))
            )
          }
        } catch (error) {
          console.warn(`Error querying ${dbId}:`, error)
        }
      }

      return videos.sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      )
    },
    { ttl: CacheTTL.ASSETS }
  )
}

/**
 * Delete a video
 */
export async function deleteVideo(videoId: string, dbId: string): Promise<void> {
  const dbManager = getMultiDbManager()
  const db = dbManager.getDb(dbId)

  if (!db) {
    throw new Error(`Database ${dbId} not found`)
  }

  // Fetch to get URL for storage deletion
  const { data: video } = await db.from("videos").select("url").eq("id", videoId).single()

  if (video?.url) {
    try {
      const r2Match = parseR2Url(video.url)
      if (r2Match) {
        await deleteAssetFromR2(r2Match.userId, r2Match.r2Key)
      } else {
        const match = video.url.match(/\/storage\/v1\/object\/public\/([^/]+)\/(.+)$/)
        if (match) {
          const bucket = match[1]
          const path = decodeURIComponent(match[2])
          await db.storage.from(bucket).remove([path])
        }
      }
    } catch (e) {
      console.warn("Failed to delete from storage:", e)
    }
  }

  const { error } = await db.from("videos").delete().eq("id", videoId)

  if (error) throw error

  // Invalidate videos cache
  invalidateCacheByPrefix("videos:")
}

/**
 * Get a video by ID (across all databases)
 */
export async function getVideoById(videoId: string): Promise<VideoWithDb | null> {
  const dbManager = getMultiDbManager()
  const allDbs = dbManager.getAllDbs()

  for (const [dbId, db] of allDbs.entries()) {
    try {
      const { data, error } = await db
        .from("videos")
        .select("*")
        .eq("id", videoId)
        .single()

      if (error) {
        continue
      }

      if (data) {
        return { ...data, dbId }
      }
    } catch (error) {
      continue
    }
  }

  return null
}

/**
 * Rename a video (update prompt field which serves as name)
 */
export async function renameVideo(videoId: string, dbId: string, newName: string): Promise<void> {
  const dbManager = getMultiDbManager()
  const db = dbManager.getDb(dbId)

  if (!db) {
    throw new Error(`Database ${dbId} not found`)
  }

  const { error } = await db
    .from("videos")
    .update({ prompt: newName })
    .eq("id", videoId)

  if (error) throw error
}

// ==================== Audio Operations ====================

export interface AudioWithDb extends Audio {
  dbId: string
}

/**
 * Save an audio file to the active database
 */
export async function saveAudio(
  userId: string,
  audio: Omit<Audio, "id" | "createdAt">,
  projectId?: string
): Promise<AudioWithDb> {
  const dbManager = getMultiDbManager()
  const db = await dbManager.ensureActiveDbAvailable()
  const dbId = dbManager.getCurrentActiveDbId()!

  const audioData = {
    id: (audio as any).id || crypto.randomUUID(),
    userId,
    assetId: audio.assetId,
    url: audio.url,
    prompt: audio.prompt || null,
    createdAt: new Date().toISOString(),
    projectId: projectId || null,
  }

  const { data, error } = await db.from("audio").insert(audioData).select().single()

  if (error) throw error

  // Invalidate audio cache
  invalidateCacheByPrefix(`audio:${userId}`)

  return {
    ...data,
    dbId,
  }
}

/**
 * Get audio files for a user (across all databases)
 */
export async function getUserAudio(userId: string, assetId?: string): Promise<AudioWithDb[]> {
  return cachedQuery(
    CacheKeys.userAudio(userId, assetId),
    async () => {
      const dbManager = getMultiDbManager()
      const allDbs = dbManager.getAllDbs()
      const audioFiles: AudioWithDb[] = []

      for (const [dbId, db] of allDbs.entries()) {
        try {
          let query = db.from("audio").select("*").eq("userId", userId)

          if (assetId) {
            query = query.eq("assetId", assetId)
          }

          const { data, error } = await query.order("createdAt", { ascending: false })

          if (error) {
            console.warn(`Error fetching audio from ${dbId}:`, error)
            continue
          }

          if (data) {
            audioFiles.push(
              ...data.map((audio) => ({
                ...audio,
                dbId,
              }))
            )
          }
        } catch (error) {
          console.warn(`Error querying ${dbId}:`, error)
        }
      }

      return audioFiles.sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      )
    },
    { ttl: CacheTTL.ASSETS }
  )
}

/**
 * Delete an audio file
 */
export async function deleteAudio(audioId: string, dbId: string): Promise<void> {
  const dbManager = getMultiDbManager()
  const db = dbManager.getDb(dbId)

  if (!db) {
    throw new Error(`Database ${dbId} not found`)
  }

  // Fetch to get URL for storage deletion
  const { data: audio } = await db.from("audio").select("url").eq("id", audioId).single()

  if (audio?.url) {
    try {
      const match = audio.url.match(/\/storage\/v1\/object\/public\/([^/]+)\/(.+)$/)
      if (match) {
        const bucket = match[1]
        const path = decodeURIComponent(match[2])
        await db.storage.from(bucket).remove([path])
      }
    } catch (e) {
      console.warn("Failed to delete from storage:", e)
    }
  }

  const { error } = await db.from("audio").delete().eq("id", audioId)

  if (error) throw error

  // Invalidate audio cache
  invalidateCacheByPrefix("audio:")
}

/**
 * Get an audio file by ID (across all databases)
 */
export async function getAudioById(audioId: string): Promise<AudioWithDb | null> {
  const dbManager = getMultiDbManager()
  const allDbs = dbManager.getAllDbs()

  for (const [dbId, db] of allDbs.entries()) {
    try {
      const { data, error } = await db
        .from("audio")
        .select("*")
        .eq("id", audioId)
        .single()

      if (error) {
        continue
      }

      if (data) {
        return { ...data, dbId }
      }
    } catch (error) {
      continue
    }
  }

  return null
}

/**
 * Rename an audio file (update prompt field which serves as name)
 */
export async function renameAudio(audioId: string, dbId: string, newName: string): Promise<void> {
  const dbManager = getMultiDbManager()
  const db = dbManager.getDb(dbId)

  if (!db) {
    throw new Error(`Database ${dbId} not found`)
  }

  const { error } = await db
    .from("audio")
    .update({ prompt: newName })
    .eq("id", audioId)

  if (error) throw error
}
