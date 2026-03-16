/**
 * Project Context Service
 * 
 * Manages per-project conversation context so that when a user connects
 * a new chat session to an existing project, the AI retains knowledge 
 * of previous work done on that project (files created/edited, features
 * discussed, decisions made, etc.).
 * 
 * Storage format in localStorage:
 *   key:   `project_context_${projectId}`
 *   value: ProjectContext (JSON)
 */

export interface ProjectContextEntry {
    sessionId: string
    sessionTitle: string
    timestamp: string           // ISO string
    /** Condensed summary of the conversation from this session */
    summary: string
    /** File paths that were created/edited in this session */
    filesModified: string[]
}

export interface ProjectContext {
    projectId: string
    projectName: string
    /** Ordered list of session contributions, oldest-first */
    entries: ProjectContextEntry[]
    /** Last updated ISO timestamp */
    updatedAt: string
}

const CONTEXT_STORAGE_PREFIX = 'project_context_'

/**
 * Get the stored project context for a given project.
 */
export function getProjectContext(projectId: string): ProjectContext | null {
    try {
        const raw = localStorage.getItem(`${CONTEXT_STORAGE_PREFIX}${projectId}`)
        if (!raw) return null
        return JSON.parse(raw) as ProjectContext
    } catch (error) {
        console.error('Error loading project context:', error)
        return null
    }
}

/**
 * Save / update the project context.
 */
export function saveProjectContext(ctx: ProjectContext): void {
    try {
        ctx.updatedAt = new Date().toISOString()
        localStorage.setItem(
            `${CONTEXT_STORAGE_PREFIX}${ctx.projectId}`,
            JSON.stringify(ctx)
        )
    } catch (error) {
        console.error('Error saving project context:', error)
    }
}

/**
 * Build a concise conversation summary from messages.
 * We keep:
 *  - The user's messages (to capture intent/decisions)
 *  - Brief AI action notes (files created, etc.)
 * Truncated to avoid enormous context payloads.
 */
function summariseMessages(
    messages: Array<{ role: string; content: string }>,
    maxChars = 3000
): string {
    const lines: string[] = []

    for (const msg of messages) {
        if (msg.role === 'user') {
            // Keep user messages in full (truncated individually)
            const truncated = msg.content.length > 400
                ? msg.content.slice(0, 400) + '...'
                : msg.content
            lines.push(`USER: ${truncated}`)
        } else {
            // For AI messages, extract key action lines only
            const actionLines: string[] = []
            const content = msg.content

            // Detect file operations
            const createMatches = content.match(/\[CREATE_FILE:\s*([^\],]+)/g)
            const editMatches = content.match(/\[EDIT_FILE:\s*([^\],]+)/g)
            const deleteMatches = content.match(/\[DELETE_FILE:\s*([^\]]+)\]/g)

            if (createMatches) {
                createMatches.forEach(m => {
                    const path = m.replace('[CREATE_FILE:', '').trim()
                    actionLines.push(`  → Created file: ${path}`)
                })
            }
            if (editMatches) {
                editMatches.forEach(m => {
                    const path = m.replace('[EDIT_FILE:', '').trim()
                    actionLines.push(`  → Edited file: ${path}`)
                })
            }
            if (deleteMatches) {
                deleteMatches.forEach(m => {
                    const path = m.replace('[DELETE_FILE:', '').replace(']', '').trim()
                    actionLines.push(`  → Deleted file: ${path}`)
                })
            }

            // Also capture a brief first-line summary of the AI response (non-file-operation)
            const firstLine = content.split('\n').find(l => l.trim() && !l.startsWith('['))
            if (firstLine) {
                const truncatedLine = firstLine.length > 200
                    ? firstLine.slice(0, 200) + '...'
                    : firstLine
                actionLines.unshift(`AI: ${truncatedLine}`)
            }

            if (actionLines.length > 0) {
                lines.push(actionLines.join('\n'))
            }
        }
    }

    const full = lines.join('\n')
    if (full.length > maxChars) {
        return full.slice(full.length - maxChars) // keep the most recent content
    }
    return full
}

/**
 * Extract file paths that were modified (created/edited/deleted) by the AI.
 */
function extractModifiedFiles(
    messages: Array<{ role: string; content: string }>
): string[] {
    const files = new Set<string>()
    for (const msg of messages) {
        if (msg.role !== 'assistant') continue
        const content = msg.content

        const createMatches = content.matchAll(/\[CREATE_FILE:\s*([^\],]+)/g)
        for (const m of createMatches) files.add(m[1].trim())

        const editMatches = content.matchAll(/\[EDIT_FILE:\s*([^\],]+)/g)
        for (const m of editMatches) files.add(m[1].trim())

        const deleteMatches = content.matchAll(/\[DELETE_FILE:\s*([^\]]+)\]/g)
        for (const m of deleteMatches) files.add(m[1].trim())
    }
    return Array.from(files)
}

/**
 * Record a chat session's contributions to a project.
 * Should be called when:
 *  - A session is disconnected from a project
 *  - The user switches to a different session (while a project was connected)
 *  - Periodically after AI responses (so context is not lost on unexpected close)
 */
export function recordSessionToProjectContext(
    projectId: string,
    projectName: string,
    sessionId: string,
    sessionTitle: string,
    messages: Array<{ role: string; content: string }>
): void {
    if (!messages || messages.length === 0) return

    const ctx = getProjectContext(projectId) || {
        projectId,
        projectName,
        entries: [],
        updatedAt: new Date().toISOString()
    }

    // Update project name in case it changed
    ctx.projectName = projectName

    // Remove any existing entry for this session (we'll replace it)
    ctx.entries = ctx.entries.filter(e => e.sessionId !== sessionId)

    const summary = summariseMessages(messages)
    const filesModified = extractModifiedFiles(messages)

    // Only record if there's meaningful content
    if (summary.trim().length > 0) {
        ctx.entries.push({
            sessionId,
            sessionTitle,
            timestamp: new Date().toISOString(),
            summary,
            filesModified
        })
    }

    // Cap entries to the last 20 sessions to avoid localStorage bloat
    if (ctx.entries.length > 20) {
        ctx.entries = ctx.entries.slice(ctx.entries.length - 20)
    }

    saveProjectContext(ctx)
}

/**
 * Build a project history string to inject into the AI's context.
 * This tells the AI about previous sessions' work on the project.
 */
export function buildProjectHistoryPrompt(projectId: string): string {
    const ctx = getProjectContext(projectId)
    if (!ctx || ctx.entries.length === 0) return ''

    const lines: string[] = [
        `[PROJECT HISTORY — "${ctx.projectName}"]`,
        `This project has been worked on across ${ctx.entries.length} previous chat session(s).`,
        `Below is a summary of what was discussed and created in each session so you can continue seamlessly.\n`
    ]

    for (const entry of ctx.entries) {
        const date = new Date(entry.timestamp).toLocaleDateString('en-US', {
            month: 'short', day: 'numeric', year: 'numeric'
        })
        lines.push(`--- Session: "${entry.sessionTitle}" (${date}) ---`)
        lines.push(entry.summary)
        if (entry.filesModified.length > 0) {
            lines.push(`Files touched: ${entry.filesModified.join(', ')}`)
        }
        lines.push('')
    }

    lines.push('[END PROJECT HISTORY]\n')

    // Cap total characters to avoid context overflow
    const full = lines.join('\n')
    if (full.length > 8000) {
        return full.slice(full.length - 8000)
    }
    return full
}
