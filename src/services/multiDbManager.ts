import { createClient, SupabaseClient } from "@supabase/supabase-js"

/**
 * Multi-Database Manager
 * Manages multiple Supabase databases for storing user data (chats, images, models)
 * Automatically switches to the next database when one is full
 */

export interface DatabaseConfig {
  id: string // e.g., "db1", "db2", "db3"
  url: string
  anonKey: string
  serviceKey?: string // Optional service key for admin operations
}

export interface DatabaseStatus {
  id: string
  isActive: boolean
  isFull: boolean
  usagePercent: number
  totalRows: number
  maxRows?: number // Optional: set a max row limit
  lastChecked: Date
}

class MultiDbManager {
  private mainDb: SupabaseClient // For auth, profiles, subscriptions
  private dataDbs: Map<string, SupabaseClient> = new Map()
  private dbConfigs: DatabaseConfig[] = []
  private currentActiveDb: string | null = null
  private dbStatuses: Map<string, DatabaseStatus> = new Map()
  private maxRowsPerDb: number = 1000000 // Default: 1 million rows per database

  constructor(mainDbClient?: SupabaseClient) {
    // Use provided main database client or create a new one
    // This prevents creating duplicate clients when called from supabase.ts
    if (mainDbClient) {
      this.mainDb = mainDbClient
    } else {
      const mainUrl = import.meta.env.VITE_SUPABASE_URL || ""
      const mainKey = import.meta.env.VITE_SUPABASE_ANON_KEY || ""
      this.mainDb = createClient(mainUrl, mainKey)
    }

    // Load data database configurations
    this.loadDataDbConfigs()
  }

  /**
   * Load data database configurations from environment variables
   */
  private loadDataDbConfigs(): void {
    const configs: DatabaseConfig[] = []
    let dbIndex = 1

    // Load databases until we find one that doesn't exist
    while (true) {
      const url = import.meta.env[`VITE_SUPABASE_DB${dbIndex}_URL`]
      const anonKey = import.meta.env[`VITE_SUPABASE_DB${dbIndex}_ANON_KEY`]
      const serviceKey = import.meta.env[`VITE_SUPABASE_DB${dbIndex}_SERVICE_KEY`]

      if (!url || !anonKey) {
        break // No more databases configured
      }

      configs.push({
        id: `db${dbIndex}`,
        url,
        anonKey,
        serviceKey,
      })

      // Initialize Supabase client for this database
      const client = createClient(url, anonKey)
      this.dataDbs.set(`db${dbIndex}`, client)

      dbIndex++
    }

    this.dbConfigs = configs

    // Set max rows per database from env (optional)
    const maxRows = import.meta.env.VITE_MAX_ROWS_PER_DB
    if (maxRows) {
      this.maxRowsPerDb = parseInt(maxRows, 10)
    }

    // Initialize current active database (first one by default)
    if (configs.length > 0) {
      this.currentActiveDb = configs[0].id
      this.initializeDbStatus(configs[0].id)
    }
  }

  /**
   * Initialize database status
   */
  private async initializeDbStatus(dbId: string): Promise<void> {
    const status: DatabaseStatus = {
      id: dbId,
      isActive: dbId === this.currentActiveDb,
      isFull: false,
      usagePercent: 0,
      totalRows: 0,
      maxRows: this.maxRowsPerDb,
      lastChecked: new Date(),
    }

    // Check actual usage
    await this.checkDbUsage(dbId)
    this.dbStatuses.set(dbId, status)
  }

  /**
   * Check database usage by counting rows in key tables
   */
  private async checkDbUsage(dbId: string): Promise<void> {
    const client = this.dataDbs.get(dbId)
    if (!client) return

    try {
      // Count rows in main tables
      const [chatsCount, imagesCount, modelsCount] = await Promise.all([
        this.countRows(client, "chat_sessions"),
        this.countRows(client, "images"),
        this.countRows(client, "models"),
      ])

      const totalRows = chatsCount + imagesCount + modelsCount
      const status = this.dbStatuses.get(dbId)

      if (status) {
        status.totalRows = totalRows
        status.usagePercent = this.maxRowsPerDb > 0
          ? (totalRows / this.maxRowsPerDb) * 100
          : 0
        status.isFull = status.usagePercent >= 95 // Consider full at 95%
        status.lastChecked = new Date()
      }
    } catch (error) {
      console.error(`Error checking usage for ${dbId}:`, error)
    }
  }

  /**
   * Count rows in a table
   */
  private async countRows(client: SupabaseClient, table: string): Promise<number> {
    try {
      const { count, error } = await client
        .from(table)
        .select("*", { count: "exact", head: true })

      if (error) {
        // Table might not exist yet, return 0
        if (error.code === "PGRST116" || error.message?.includes("does not exist")) {
          return 0
        }
        console.warn(`Error counting rows in ${table}:`, error)
        return 0
      }

      return count || 0
    } catch (error) {
      console.warn(`Error counting rows in ${table}:`, error)
      return 0
    }
  }

  /**
   * Get the main database client (for auth, profiles, subscriptions)
   */
  getMainDb(): SupabaseClient {
    return this.mainDb
  }

  /**
   * Get the currently active data database client
   */
  getActiveDb(): SupabaseClient | null {
    if (!this.currentActiveDb) {
      return null
    }
    return this.dataDbs.get(this.currentActiveDb) || null
  }

  /**
   * Get a specific database client by ID
   */
  getDb(dbId: string): SupabaseClient | null {
    return this.dataDbs.get(dbId) || null
  }

  /**
   * Get all database clients
   */
  getAllDbs(): Map<string, SupabaseClient> {
    return this.dataDbs
  }

  /**
   * Get current active database ID
   */
  getCurrentActiveDbId(): string | null {
    return this.currentActiveDb
  }

  /**
   * Check if current database is full and switch if needed
   */
  async ensureActiveDbAvailable(): Promise<SupabaseClient> {
    if (!this.currentActiveDb) {
      throw new Error("No active database configured")
    }

    // Check current database status
    await this.checkDbUsage(this.currentActiveDb)
    const status = this.dbStatuses.get(this.currentActiveDb)

    if (status && status.isFull) {
      // Switch to next available database
      await this.switchToNextDb()
    }

    const activeDb = this.getActiveDb()
    if (!activeDb) {
      throw new Error("No available database found")
    }

    return activeDb
  }

  /**
   * Switch to the next available database
   */
  private async switchToNextDb(): Promise<void> {
    const currentIndex = this.dbConfigs.findIndex(
      (config) => config.id === this.currentActiveDb
    )

    if (currentIndex === -1 || currentIndex >= this.dbConfigs.length - 1) {
      throw new Error("No more databases available")
    }

    // Find next available database
    for (let i = currentIndex + 1; i < this.dbConfigs.length; i++) {
      const nextDbId = this.dbConfigs[i].id
      await this.checkDbUsage(nextDbId)

      const status = this.dbStatuses.get(nextDbId)
      if (!status || !status.isFull) {
        // Mark old database as inactive
        const oldStatus = this.dbStatuses.get(this.currentActiveDb!)
        if (oldStatus) {
          oldStatus.isActive = false
        }

        // Switch to new database
        this.currentActiveDb = nextDbId
        const newStatus = this.dbStatuses.get(nextDbId)
        if (newStatus) {
          newStatus.isActive = true
        } else {
          await this.initializeDbStatus(nextDbId)
          const initializedStatus = this.dbStatuses.get(nextDbId)
          if (initializedStatus) {
            initializedStatus.isActive = true
          }
        }

        // Store active database in main DB for persistence
        await this.saveActiveDbPreference(nextDbId)

        console.log(`Switched to database: ${nextDbId}`)
        return
      }
    }

    throw new Error("All databases are full")
  }

  /**
   * Save active database preference in main database
   */
  private async saveActiveDbPreference(dbId: string): Promise<void> {
    try {
      // This would be stored in a system settings table in the main DB
      // For now, we'll use localStorage as a fallback
      localStorage.setItem("koye_active_db", dbId)
    } catch (error) {
      console.warn("Failed to save active database preference:", error)
    }
  }

  /**
   * Get active database preference from storage
   */
  getActiveDbPreference(): string | null {
    try {
      return localStorage.getItem("koye_active_db")
    } catch {
      return null
    }
  }

  /**
   * Get status of all databases
   */
  async getAllDbStatuses(): Promise<DatabaseStatus[]> {
    // Check all databases
    for (const config of this.dbConfigs) {
      await this.checkDbUsage(config.id)
    }

    return Array.from(this.dbStatuses.values())
  }

  /**
   * Get status of a specific database
   */
  async getDbStatus(dbId: string): Promise<DatabaseStatus | null> {
    await this.checkDbUsage(dbId)
    return this.dbStatuses.get(dbId) || null
  }

  /**
   * Manually switch to a specific database (admin function)
   */
  async switchToDb(dbId: string): Promise<void> {
    if (!this.dataDbs.has(dbId)) {
      throw new Error(`Database ${dbId} not found`)
    }

    // Mark old database as inactive
    if (this.currentActiveDb) {
      const oldStatus = this.dbStatuses.get(this.currentActiveDb)
      if (oldStatus) {
        oldStatus.isActive = false
      }
    }

    // Switch to new database
    this.currentActiveDb = dbId
    await this.initializeDbStatus(dbId)
    const status = this.dbStatuses.get(dbId)
    if (status) {
      status.isActive = true
    }

    await this.saveActiveDbPreference(dbId)
  }

  /**
   * Get a service-role client for a specific database (bypasses RLS)
   * Only works if VITE_SUPABASE_DBx_SERVICE_KEY is set
   */
  getServiceDb(dbId: string): SupabaseClient | null {
    // Check if we already have a service client
    if (this.serviceDbs.has(dbId)) {
      return this.serviceDbs.get(dbId)!
    }

    // Find config
    const config = this.dbConfigs.find(c => c.id === dbId)
    if (!config || !config.serviceKey) {
      return null
    }

    // Create service client
    const client = createClient(config.url, config.serviceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    })

    this.serviceDbs.set(dbId, client)
    return client
  }

  private serviceDbs: Map<string, SupabaseClient> = new Map()
}

// Singleton instance
let dbManagerInstance: MultiDbManager | null = null

/**
 * Get the multi-database manager instance
 */
export function getMultiDbManager(mainDbClient?: SupabaseClient): MultiDbManager {
  if (!dbManagerInstance) {
    dbManagerInstance = new MultiDbManager(mainDbClient)
  }
  return dbManagerInstance
}

/**
 * Initialize the multi-database manager
 */
export function initMultiDbManager(mainDbClient?: SupabaseClient): MultiDbManager {
  return getMultiDbManager(mainDbClient)
}

