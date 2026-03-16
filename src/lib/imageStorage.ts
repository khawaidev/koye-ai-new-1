// Utility functions for saving generated images to localStorage (user-specific)

export interface SavedImage {
  id: string
  url: string
  prompt: string
  method: string
  timestamp: string
  view?: string // For four-view images
}

const getStorageKey = (userId: string | null): string => {
  const userSuffix = userId ? `_${userId}` : "_guest"
  return `koye_generated_images${userSuffix}`
}

/**
 * Save a generated image to localStorage (user-specific)
 */
export function saveImageToStorage(image: Omit<SavedImage, "id" | "timestamp">, userId: string | null = null): SavedImage {
  const savedImage: SavedImage = {
    ...image,
    id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    timestamp: new Date().toISOString(),
  }

  try {
    const storageKey = getStorageKey(userId)
    const existing = getSavedImages(userId)
    const updated = [savedImage, ...existing].slice(0, 100) // Keep last 100 images
    localStorage.setItem(storageKey, JSON.stringify(updated))
    return savedImage
  } catch (error) {
    console.error("Failed to save image to localStorage:", error)
    // If storage is full, try to clear old images
    try {
      const storageKey = getStorageKey(userId)
      const existing = getSavedImages(userId)
      const recent = existing.slice(0, 50) // Keep only 50 most recent
      localStorage.setItem(storageKey, JSON.stringify([savedImage, ...recent]))
    } catch (e) {
      console.error("Failed to save image even after cleanup:", e)
    }
    return savedImage
  }
}

/**
 * Get all saved images from localStorage (user-specific)
 */
export function getSavedImages(userId: string | null = null): SavedImage[] {
  try {
    const storageKey = getStorageKey(userId)
    const stored = localStorage.getItem(storageKey)
    if (!stored) return []
    return JSON.parse(stored)
  } catch (error) {
    console.error("Failed to load images from localStorage:", error)
    return []
  }
}

/**
 * Delete a saved image from localStorage (user-specific)
 */
export function deleteSavedImage(imageId: string, userId: string | null = null): void {
  try {
    const storageKey = getStorageKey(userId)
    const existing = getSavedImages(userId)
    const updated = existing.filter((img) => img.id !== imageId)
    localStorage.setItem(storageKey, JSON.stringify(updated))
  } catch (error) {
    console.error("Failed to delete image from localStorage:", error)
  }
}

/**
 * Clear all saved images for a user
 */
export function clearSavedImages(userId: string | null = null): void {
  try {
    const storageKey = getStorageKey(userId)
    localStorage.removeItem(storageKey)
  } catch (error) {
    console.error("Failed to clear images from localStorage:", error)
  }
}

