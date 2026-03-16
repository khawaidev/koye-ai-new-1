import { useEffect, useState } from "react"
import { getMultiDbManager, type DatabaseStatus } from "../services/multiDbManager"

/**
 * React hook for accessing multi-database manager
 */
export function useMultiDb() {
  const [dbManager] = useState(() => getMultiDbManager())
  const [activeDbId, setActiveDbId] = useState<string | null>(null)
  const [dbStatuses, setDbStatuses] = useState<DatabaseStatus[]>([])

  useEffect(() => {
    // Get initial active database
    const currentDbId = dbManager.getCurrentActiveDbId()
    setActiveDbId(currentDbId)

    // Load database statuses
    loadStatuses()

    // Refresh statuses every 5 minutes
    const interval = setInterval(loadStatuses, 5 * 60 * 1000)

    return () => clearInterval(interval)
  }, [])

  const loadStatuses = async () => {
    try {
      const statuses = await dbManager.getAllDbStatuses()
      setDbStatuses(statuses)
      
      // Update active database ID
      const currentDbId = dbManager.getCurrentActiveDbId()
      setActiveDbId(currentDbId)
    } catch (error) {
      console.error("Error loading database statuses:", error)
    }
  }

  return {
    dbManager,
    activeDbId,
    dbStatuses,
    refreshStatuses: loadStatuses,
  }
}

