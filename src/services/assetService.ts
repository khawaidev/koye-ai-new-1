/**
 * Asset Service
 * Handles asset management with proper separation between:
 * 1. General Assets - Not connected to any project (user's general storage)
 * 2. Project-Specific Assets - Connected to a specific project
 * 
 * Uses Supabase main DB for metadata (user_id, project_id, asset_id)
 * Uses db1/db2 buckets for actual asset files with project_id and asset_id references
 */

import { getMultiDbManager } from "./multiDbManager"
import { isR2Configured, uploadAssetToR2, deleteAssetFromR2 } from "./r2Storage"

// ==================== Types ====================

export type AssetType = "image" | "audio" | "video" | "model" | "file"

export interface AssetMetadata {
    id: string
    userId: string
    projectId: string | null  // null for general assets
    assetType: AssetType
    name: string
    originalName?: string
    mimeType?: string
    size?: number
    url: string
    bucketPath: string  // Path in storage bucket
    dbId: string        // Which db (db1, db2, etc.) stores this asset
    createdAt: string
    updatedAt: string
}

export interface CreateAssetInput {
    userId: string
    projectId?: string | null
    assetType: AssetType
    name: string
    file: File | Blob
    mimeType?: string
}

export interface ImportAssetInput {
    assetId: string          // ID of general asset to import
    targetProjectId: string  // Project to import into
}

// ==================== Constants ====================

// Use a single shared bucket for ALL assets (general and project-specific)
// Supabase doesn't allow dynamic bucket creation from client due to RLS policies
// The bucket must be pre-created in Supabase dashboard with name "assets"
const SHARED_ASSETS_BUCKET = "assets"

// Legacy constants - kept for reference but not used
// const GENERAL_ASSETS_BUCKET = "general-assets"
// const PROJECT_ASSETS_BUCKET_PREFIX = "project-"

// ==================== Helper Functions ====================

/**
 * Get the bucket name - always returns the shared bucket
 * Assets are separated by path structure: {userId}/{projectId|general}/{assetType}s/{assetId}.{ext}
 */
function getBucketName(): string {
    return SHARED_ASSETS_BUCKET
}

/**
 * Generate asset file path within bucket
 * Path structure ensures separation: userId/projectId/assetTypes/assetId.ext
 * For general assets (no project): userId/general/assetTypes/assetId.ext
 */
function generateAssetPath(userId: string, projectId: string | null, assetType: AssetType, assetId: string, fileName: string): string {
    const extension = fileName.split('.').pop() || ''
    const projectFolder = projectId || 'general'
    return `${userId}/${projectFolder}/${assetType}s/${assetId}${extension ? '.' + extension : ''}`
}

/**
 * Ensure bucket exists - with better error handling
 * Note: If bucket doesn't exist, we try to create it using service role client if available
 * This avoids the 400 Bad Request for client-side creation under RLS
 */
async function ensureBucketExists(bucketName: string, dbClient: any, dbId: string): Promise<boolean> {
    try {
        const dbManager = getMultiDbManager()
        
        // Find DB URL for clearer messaging
        const allConfigs = (dbManager as any).dbConfigs || []
        const config = allConfigs.find((c: any) => c.id === dbId)
        const dbInfo = config ? `(URL: ${config.url})` : ''

        // Check if bucket exists
        const { data: buckets, error: listError } = await dbClient.storage.listBuckets()

        if (listError) {
            console.warn(`[${dbId}] Could not list buckets: ${listError.message} ${dbInfo}`)
            // Try to upload anyway - bucket might exist but listing failed
            return true
        }

        const exists = buckets?.some((b: any) => b.name === bucketName)

        if (!exists) {
            console.log(`[${dbId}] Bucket "${bucketName}" not found. Attempting to create...`)
            
            // Try service role client first (higher success rate for bucket creation)
            const adminDb = dbManager.getServiceDb(dbId)
            const creationDb = adminDb || dbClient

            const { error: createError } = await creationDb.storage.createBucket(bucketName, {
                public: true,
            })
            
            if (createError) {
                if (createError.message?.includes('already exists')) {
                    return true
                }
                
                console.error(`[${dbId}] [CRITICAL] Bucket "${bucketName}" NOT found in DB: ${dbId}.`)
                console.error(`To fix this:`)
                console.error(`1. Go to Supabase Dashboard for project ${dbId}: ${config?.url || 'URL not found'}`)
                console.error(`2. Navigate to Storage > Buckets`)
                console.error(`3. Create a NEW bucket named exactly "${bucketName}"`)
                console.error(`4. MAKE SURE you set the bucket to "Public"`)
                return false
            } else {
                console.log(`[${dbId}] Successfully created "${bucketName}" bucket automatically.`)
            }
        }
        return true
    } catch (error) {
        console.error(`Error ensuring bucket ${bucketName} exists on ${dbId}:`, error)
        return true
    }
}

// ==================== Asset Creation ====================

/**
 * Create a new asset (either general or project-specific)
 */
export async function createAsset(input: CreateAssetInput): Promise<AssetMetadata> {
    const { userId, projectId, assetType, name, file, mimeType } = input

    const dbManager = getMultiDbManager()
    const db = await dbManager.ensureActiveDbAvailable()
    const dbId = dbManager.getCurrentActiveDbId()!

    const assetId = crypto.randomUUID()
    const bucketName = getBucketName() // Use shared bucket
    const bucketPath = generateAssetPath(userId, projectId || null, assetType, assetId, name)

    // Track if we successfully used R2
    let publicUrl = ""
    let isR2 = false

    // Check if it's a binary asset to upload to R2
    const binaryTypes = ["image", "video", "audio", "model"]
    const isBinaryAsset = binaryTypes.includes(assetType)

    if (isBinaryAsset && isR2Configured()) {
        try {
            // Strip the userId prefix because uploadAssetToR2 prepends it
            const r2Key = bucketPath.substring(userId.length + 1)
            publicUrl = await uploadAssetToR2(userId, r2Key, file, mimeType || file.type)
            isR2 = true
            console.log(`✓ Saved general asset to R2: ${bucketPath}`)
        } catch (error) {
            console.warn(`✗ R2 upload failed for general asset, falling back to Supabase:`, error)
        }
    }

    if (!isR2) {
        // Ensure bucket exists
        await ensureBucketExists(bucketName, db, dbId)

        // Upload file to Supabase bucket
        const { data: _uploadData, error: uploadError } = await db.storage
            .from(bucketName)
            .upload(bucketPath, file, {
                cacheControl: "3600",
                upsert: false,
                contentType: mimeType || file.type,
            })

        if (uploadError) {
            throw new Error(`Failed to upload asset: ${uploadError.message}`)
        }

        // Get public URL
        const { data: urlData } = db.storage
            .from(bucketName)
            .getPublicUrl(bucketPath)

        publicUrl = urlData.publicUrl
    }

    // Save metadata to database
    const now = new Date().toISOString()
    const assetMetadata: AssetMetadata = {
        id: assetId,
        userId,
        projectId: projectId || null,
        assetType,
        name,
        originalName: name,
        mimeType: mimeType || file.type,
        size: file.size,
        url: publicUrl,
        bucketPath,
        dbId,
        createdAt: now,
        updatedAt: now,
    }

    const { error: insertError } = await db
        .from("assets_metadata")
        .insert(assetMetadata)

    if (insertError) {
        // Cleanup: delete uploaded file if metadata save fails
        await db.storage.from(bucketName).remove([bucketPath])
        throw new Error(`Failed to save asset metadata: ${insertError.message}`)
    }

    return assetMetadata
}

/**
 * Create asset from URL (for generated assets)
 */
export async function createAssetFromUrl(
    userId: string,
    projectId: string | null,
    assetType: AssetType,
    name: string,
    sourceUrl: string
): Promise<AssetMetadata> {
    // Helper function to fetch with CORS proxy fallback
    const fetchWithProxy = async (url: string) => {
        // Known CORS-friendly domains (Supabase, R2, etc.)
        const isCorsFriendly = url.includes('.supabase.co') || 
                               url.includes('.r2.dev') || 
                               url.includes('r2.cloudflarestorage.com') ||
                               url.includes('.workers.dev') ||
                               url.startsWith('blob:') ||
                               url.startsWith('data:') ||
                               url.includes('localhost');

        if (isCorsFriendly) {
            try {
                const res = await fetch(url);
                if (!res.ok) throw new Error(`HTTP ${res.status}`);
                return res;
            } catch (err: any) {
                console.warn(`Direct fetch failed for ${url}, trying public proxy...`);
                const proxyUrl = `https://corsproxy.io/?${encodeURIComponent(url)}`;
                const proxyRes = await fetch(proxyUrl);
                if (!proxyRes.ok) throw new Error(`Proxy HTTP ${proxyRes.status}`);
                return proxyRes;
            }
        } else {
            // Immediate proxy for external URLs to avoid red console errors
            console.log(`Using proxy directly for cross-origin URL: ${url}`);
            const proxyUrl = `https://corsproxy.io/?${encodeURIComponent(url)}`;
            const proxyRes = await fetch(proxyUrl);
            if (!proxyRes.ok) throw new Error(`Proxy HTTP ${proxyRes.status}`);
            return proxyRes;
        }
    };

    // Fetch the file from URL
    const response = await fetchWithProxy(sourceUrl)
    if (!response.ok) {
        throw new Error(`Failed to fetch asset from URL: ${response.statusText}`)
    }

    const blob = await response.blob()
    const mimeType = response.headers.get('content-type') || blob.type

    return createAsset({
        userId,
        projectId,
        assetType,
        name,
        file: blob,
        mimeType,
    })
}

// ==================== Asset Retrieval ====================

/**
 * Get all general assets for a user
 */
export async function getGeneralAssets(userId: string): Promise<AssetMetadata[]> {
    const dbManager = getMultiDbManager()
    const allDbs = dbManager.getAllDbs()
    const assets: AssetMetadata[] = []

    for (const [dbId, db] of allDbs.entries()) {
        try {
            const { data, error } = await db
                .from("assets_metadata")
                .select("*")
                .eq("userId", userId)
                .is("projectId", null)
                .order("createdAt", { ascending: false })

            if (error) {
                console.warn(`Error fetching general assets from ${dbId}:`, error)
                continue
            }

            if (data) {
                assets.push(...data.map(a => ({ ...a, dbId })))
            }
        } catch (error) {
            console.warn(`Error querying ${dbId}:`, error)
        }
    }

    return assets.sort((a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    )
}

/**
 * Get all assets for a specific project
 */
export async function getProjectAssets(projectId: string): Promise<AssetMetadata[]> {
    const dbManager = getMultiDbManager()
    const allDbs = dbManager.getAllDbs()
    const assets: AssetMetadata[] = []

    for (const [dbId, db] of allDbs.entries()) {
        try {
            const { data, error } = await db
                .from("assets_metadata")
                .select("*")
                .eq("projectId", projectId)
                .order("createdAt", { ascending: false })

            if (error) {
                console.warn(`Error fetching project assets from ${dbId}:`, error)
                continue
            }

            if (data) {
                assets.push(...data.map(a => ({ ...a, dbId })))
            }
        } catch (error) {
            console.warn(`Error querying ${dbId}:`, error)
        }
    }

    return assets.sort((a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    )
}

/**
 * Get ALL assets for a user (both general and project-specific)
 * Used for the universal assets tab in profile page
 */
export async function getAllUserAssets(userId: string): Promise<AssetMetadata[]> {
    const dbManager = getMultiDbManager()
    const allDbs = dbManager.getAllDbs()
    const assets: AssetMetadata[] = []

    for (const [dbId, db] of allDbs.entries()) {
        try {
            const { data, error } = await db
                .from("assets_metadata")
                .select("*")
                .eq("userId", userId)
                .order("createdAt", { ascending: false })

            if (error) {
                console.warn(`Error fetching user assets from ${dbId}:`, error)
                continue
            }

            if (data) {
                assets.push(...data.map(a => ({ ...a, dbId })))
            }
        } catch (error) {
            console.warn(`Error querying ${dbId}:`, error)
        }
    }

    return assets.sort((a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    )
}

/**
 * Get a single asset by ID
 */
export async function getAssetById(assetId: string): Promise<AssetMetadata | null> {
    const dbManager = getMultiDbManager()
    const allDbs = dbManager.getAllDbs()

    for (const [dbId, db] of allDbs.entries()) {
        try {
            const { data, error } = await db
                .from("assets_metadata")
                .select("*")
                .eq("id", assetId)
                .single()

            if (error) continue

            if (data) {
                return { ...data, dbId }
            }
        } catch {
            continue
        }
    }

    return null
}

// ==================== Asset Import (General -> Project) ====================

/**
 * Import a general asset into a project
 * Creates a new copy with new unique ID in the project's bucket
 */
export async function importAssetToProject(input: ImportAssetInput): Promise<AssetMetadata> {
    const { assetId, targetProjectId } = input

    // Get the source asset
    const sourceAsset = await getAssetById(assetId)
    if (!sourceAsset) {
        throw new Error(`Asset ${assetId} not found`)
    }

    if (sourceAsset.projectId !== null) {
        throw new Error("Can only import general assets into projects")
    }

    // Known CORS-friendly domains
    const isCorsFriendly = sourceAsset.url.includes('.supabase.co') || 
                           sourceAsset.url.includes('.r2.dev') || 
                           sourceAsset.url.includes('r2.cloudflarestorage.com') ||
                           sourceAsset.url.includes('.workers.dev') ||
                           sourceAsset.url.startsWith('blob:') ||
                           sourceAsset.url.startsWith('data:') ||
                           sourceAsset.url.includes('localhost');

    // Fetch the file from source URL
    let response;
    if (isCorsFriendly) {
        try {
            response = await fetch(sourceAsset.url)
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
        } catch (err: any) {
            console.warn(`Direct fetch failed for ${sourceAsset.url}, trying proxy...`);
            const proxyUrl = `https://corsproxy.io/?${encodeURIComponent(sourceAsset.url)}`;
            response = await fetch(proxyUrl);
        }
    } else {
        console.log(`Using proxy directly for cross-origin URL: ${sourceAsset.url}`);
        const proxyUrl = `https://corsproxy.io/?${encodeURIComponent(sourceAsset.url)}`;
        response = await fetch(proxyUrl);
    }

    if (!response?.ok) {
        throw new Error(`Failed to fetch source asset: ${response?.statusText || 'Unknown error'}`)
    }

    const blob = await response.blob()

    // Create new asset in target project
    const newAsset = await createAsset({
        userId: sourceAsset.userId,
        projectId: targetProjectId,
        assetType: sourceAsset.assetType,
        name: sourceAsset.name,
        file: blob,
        mimeType: sourceAsset.mimeType,
    })

    return newAsset
}

// ==================== Asset Deletion ====================

/**
 * Delete an asset by ID
 * Permanently removes from both database and storage
 */
export async function deleteAsset(assetId: string): Promise<boolean> {
    const asset = await getAssetById(assetId)
    if (!asset) {
        console.warn(`Asset ${assetId} not found`)
        return false
    }

    const dbManager = getMultiDbManager()
    const db = dbManager.getDb(asset.dbId)

    if (!db) {
        throw new Error(`Database ${asset.dbId} not found`)
    }

    // Use shared bucket (assets are separated by path structure)
    const bucketName = getBucketName()

    try {
        // Check if the URL is an R2 URL
        const isR2Url = asset.url.includes('.r2.dev') || asset.url.includes('.workers.dev')

        if (isR2Url && isR2Configured()) {
            try {
                // Determine r2Key from bucketPath (which is "userId/...")
                const r2Key = asset.bucketPath.substring(asset.userId.length + 1)
                await deleteAssetFromR2(asset.userId, r2Key)
                console.log(`✓ Deleted general asset from R2: ${asset.bucketPath}`)
            } catch (r2Error) {
                console.warn(`Failed to delete asset from R2:`, r2Error)
                // Continue to DB delete even if R2 delete fails
            }
        } else {
            // Delete from storage
            const { error: storageError } = await db.storage
                .from(bucketName)
                .remove([asset.bucketPath])

            if (storageError) {
                console.warn(`Failed to delete asset from storage:`, storageError)
                // Continue to delete metadata anyway
            }
        }

        // Delete from database
        const { error: dbError } = await db
            .from("assets_metadata")
            .delete()
            .eq("id", assetId)

        if (dbError) {
            throw new Error(`Failed to delete asset metadata: ${dbError.message}`)
        }

        return true
    } catch (error) {
        console.error(`Error deleting asset ${assetId}:`, error)
        throw error
    }
}

// ==================== Asset Rename ====================

/**
 * Rename an asset by ID
 * Updates the name in the database (storage path remains the same)
 */
export async function renameAsset(assetId: string, newName: string): Promise<AssetMetadata> {
    const asset = await getAssetById(assetId)
    if (!asset) {
        throw new Error(`Asset ${assetId} not found`)
    }

    const dbManager = getMultiDbManager()
    const db = dbManager.getDb(asset.dbId)

    if (!db) {
        throw new Error(`Database ${asset.dbId} not found`)
    }

    const now = new Date().toISOString()

    const { data, error } = await db
        .from("assets_metadata")
        .update({ name: newName, updatedAt: now })
        .eq("id", assetId)
        .select()
        .single()

    if (error) {
        throw new Error(`Failed to rename asset: ${error.message}`)
    }

    return { ...data, dbId: asset.dbId }
}

// ==================== Get Asset Public URL ====================

/**
 * Get the public URL for an asset by ID
 * Used when sending asset to external APIs
 */
export async function getAssetPublicUrl(assetId: string): Promise<string> {
    const asset = await getAssetById(assetId)
    if (!asset) {
        throw new Error(`Asset ${assetId} not found`)
    }

    return asset.url
}

/**
 * Get asset public URL within a project context
 * Validates that the asset belongs to the specified project
 */
export async function getProjectAssetPublicUrl(projectId: string, assetId: string): Promise<string> {
    const asset = await getAssetById(assetId)
    if (!asset) {
        throw new Error(`Asset ${assetId} not found`)
    }

    if (asset.projectId !== projectId) {
        throw new Error(`Asset ${assetId} does not belong to project ${projectId}`)
    }

    return asset.url
}

// ==================== Project Bucket Management ====================

/**
 * Create a bucket for a new project
 * Note: With shared bucket approach, this just ensures the shared bucket exists
 * @deprecated - Project-specific buckets no longer used, assets use path-based separation
 */
export async function createProjectBucket(_projectId: string): Promise<boolean> {
    const dbManager = getMultiDbManager()
    const db = await dbManager.ensureActiveDbAvailable()
    const dbId = dbManager.getCurrentActiveDbId()!

    const bucketName = getBucketName() // Use shared bucket
    return ensureBucketExists(bucketName, db, dbId)
}

/**
 * Delete a project's bucket and all its contents
 * Called when a project is deleted
 */
/**
 * @deprecated - Project-specific buckets no longer used
 * This function now does nothing as we use a shared bucket with path-based separation
 */
export async function deleteProjectBucket(_projectId: string): Promise<boolean> {
    // With shared bucket approach, we don't delete the bucket
    // Individual assets are deleted via deleteAsset()
    console.log("deleteProjectBucket is deprecated - assets use shared bucket with path-based separation")
    return true
}

// ==================== Asset Migration Helpers ====================

/**
 * Migrate assets when db1 becomes full
 * Assets stay in their original db, new assets go to db2
 */
export async function getAssetsByFilter(
    userId: string,
    filter: {
        assetType?: AssetType
        projectId?: string | null
    }
): Promise<AssetMetadata[]> {
    const dbManager = getMultiDbManager()
    const allDbs = dbManager.getAllDbs()
    const assets: AssetMetadata[] = []

    for (const [dbId, db] of allDbs.entries()) {
        try {
            let query = db
                .from("assets_metadata")
                .select("*")
                .eq("userId", userId)

            if (filter.assetType) {
                query = query.eq("assetType", filter.assetType)
            }

            if (filter.projectId !== undefined) {
                if (filter.projectId === null) {
                    query = query.is("projectId", null)
                } else {
                    query = query.eq("projectId", filter.projectId)
                }
            }

            const { data, error } = await query.order("createdAt", { ascending: false })

            if (error) {
                console.warn(`Error fetching assets from ${dbId}:`, error)
                continue
            }

            if (data) {
                assets.push(...data.map(a => ({ ...a, dbId })))
            }
        } catch (error) {
            console.warn(`Error querying ${dbId}:`, error)
        }
    }

    return assets.sort((a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    )
}
