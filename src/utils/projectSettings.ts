/**
 * Project Settings Manager
 * Manages the hidden settings.koye file that tracks deleted files
 * This file is invisible to users and cannot be edited/deleted through the UI
 */

export const SETTINGS_FILE_NAME = '.settings.koye'

export interface ProjectSettings {
    deletedFiles: string[]  // List of file paths that have been deleted
    renamedFiles: Record<string, string>  // Map of oldPath -> newPath
    version: number
}

const DEFAULT_SETTINGS: ProjectSettings = {
    deletedFiles: [],
    renamedFiles: {},
    version: 1
}

/**
 * Check if a path is the settings file (should be hidden)
 */
export function isSettingsFile(path: string): boolean {
    return path === SETTINGS_FILE_NAME || path.endsWith(`/${SETTINGS_FILE_NAME}`)
}

/**
 * Get settings from generatedFiles
 */
export function getProjectSettings(generatedFiles: Record<string, string>): ProjectSettings {
    const settingsContent = generatedFiles[SETTINGS_FILE_NAME]
    if (!settingsContent) {
        return { ...DEFAULT_SETTINGS }
    }

    try {
        const parsed = JSON.parse(settingsContent)
        return {
            deletedFiles: parsed.deletedFiles || [],
            renamedFiles: parsed.renamedFiles || {},
            version: parsed.version || 1
        }
    } catch {
        return { ...DEFAULT_SETTINGS }
    }
}

/**
 * Save settings to generatedFiles
 */
export function saveProjectSettings(
    generatedFiles: Record<string, string>,
    settings: ProjectSettings
): Record<string, string> {
    return {
        ...generatedFiles,
        [SETTINGS_FILE_NAME]: JSON.stringify(settings, null, 2)
    }
}

/**
 * Add a deleted file to settings
 */
export function addDeletedFile(
    generatedFiles: Record<string, string>,
    filePath: string
): Record<string, string> {
    const settings = getProjectSettings(generatedFiles)

    // Add to deleted files if not already there
    if (!settings.deletedFiles.includes(filePath)) {
        settings.deletedFiles.push(filePath)
    }

    return saveProjectSettings(generatedFiles, settings)
}

/**
 * Add a renamed file to settings
 */
export function addRenamedFile(
    generatedFiles: Record<string, string>,
    oldPath: string,
    newPath: string
): Record<string, string> {
    const settings = getProjectSettings(generatedFiles)

    // Track the rename
    settings.renamedFiles[oldPath] = newPath

    // Also add old path to deleted list
    if (!settings.deletedFiles.includes(oldPath)) {
        settings.deletedFiles.push(oldPath)
    }

    return saveProjectSettings(generatedFiles, settings)
}

/**
 * Filter out deleted files from a file list
 */
export function filterDeletedFiles(
    files: Record<string, string>,
    settings: ProjectSettings
): Record<string, string> {
    const filtered: Record<string, string> = {}

    for (const [path, content] of Object.entries(files)) {
        // Skip if file is in deleted list
        if (settings.deletedFiles.includes(path)) {
            continue
        }

        // Skip the settings file itself (handled separately)
        if (isSettingsFile(path)) {
            continue
        }

        filtered[path] = content
    }

    return filtered
}

/**
 * Apply settings to loaded files from DB
 * - Filters out deleted files
 * - Preserves renamed files under new names
 */
export function applySettingsToLoadedFiles(
    dbFiles: Record<string, string>,
    localSettings: ProjectSettings
): Record<string, string> {
    const result: Record<string, string> = {}

    for (const [path, content] of Object.entries(dbFiles)) {
        // Skip settings file
        if (isSettingsFile(path)) {
            continue
        }

        // Skip deleted files
        if (localSettings.deletedFiles.includes(path)) {
            continue
        }

        // Check if this file was renamed
        const newPath = localSettings.renamedFiles[path]
        if (newPath) {
            // Use the new path instead
            result[newPath] = content
        } else {
            result[path] = content
        }
    }

    return result
}

/**
 * Clear all deleted/renamed tracking for a project
 */
export function clearProjectSettings(
    generatedFiles: Record<string, string>
): Record<string, string> {
    return saveProjectSettings(generatedFiles, { ...DEFAULT_SETTINGS })
}

/**
 * Remove a file from the deleted list (restore it)
 */
export function restoreDeletedFile(
    generatedFiles: Record<string, string>,
    filePath: string
): Record<string, string> {
    const settings = getProjectSettings(generatedFiles)

    settings.deletedFiles = settings.deletedFiles.filter(p => p !== filePath)
    delete settings.renamedFiles[filePath]

    return saveProjectSettings(generatedFiles, settings)
}
