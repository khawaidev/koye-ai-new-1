// Image Analysis Utilities for Background Checking
// Used to validate images before 3D model generation

/**
 * Analyze an image to check if it has a valid background for 3D model generation
 * - Check 1: Is the background uniform (not gradient)?
 * - Check 2: Is there enough contrast between object and background?
 */
export interface BackgroundAnalysisResult {
    isValid: boolean
    isUniform: boolean
    hasEnoughContrast: boolean
    dominantBackgroundColor: { r: number; g: number; b: number }
    averageObjectColor: { r: number; g: number; b: number }
    contrastRatio: number
    issues: string[]
}

/**
 * Load an image from URL and return its ImageData
 */
async function getImageData(imageUrl: string): Promise<ImageData> {
    return new Promise((resolve, reject) => {
        const img = new Image()
        img.crossOrigin = 'anonymous'

        img.onload = () => {
            const canvas = document.createElement('canvas')
            canvas.width = img.width
            canvas.height = img.height

            const ctx = canvas.getContext('2d')
            if (!ctx) {
                reject(new Error('Could not get canvas context'))
                return
            }

            ctx.drawImage(img, 0, 0)
            const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
            resolve(imageData)
        }

        img.onerror = () => reject(new Error('Failed to load image'))
        img.src = imageUrl
    })
}

/**
 * Calculate the average color of edge pixels (background)
 */
function getEdgeColors(imageData: ImageData): { colors: Array<{ r: number; g: number; b: number }>; avgColor: { r: number; g: number; b: number } } {
    const { data, width, height } = imageData
    const edgeColors: Array<{ r: number; g: number; b: number }> = []

    // Sample from edges (top, bottom, left, right)
    const sampleSize = 10 // pixels from edge

    for (let x = 0; x < width; x++) {
        // Top edge
        for (let y = 0; y < sampleSize && y < height; y++) {
            const idx = (y * width + x) * 4
            edgeColors.push({ r: data[idx], g: data[idx + 1], b: data[idx + 2] })
        }
        // Bottom edge
        for (let y = height - sampleSize; y < height && y >= 0; y++) {
            const idx = (y * width + x) * 4
            edgeColors.push({ r: data[idx], g: data[idx + 1], b: data[idx + 2] })
        }
    }

    for (let y = sampleSize; y < height - sampleSize; y++) {
        // Left edge
        for (let x = 0; x < sampleSize && x < width; x++) {
            const idx = (y * width + x) * 4
            edgeColors.push({ r: data[idx], g: data[idx + 1], b: data[idx + 2] })
        }
        // Right edge
        for (let x = width - sampleSize; x < width && x >= 0; x++) {
            const idx = (y * width + x) * 4
            edgeColors.push({ r: data[idx], g: data[idx + 1], b: data[idx + 2] })
        }
    }

    // Calculate average
    const avgColor = {
        r: Math.round(edgeColors.reduce((sum, c) => sum + c.r, 0) / edgeColors.length),
        g: Math.round(edgeColors.reduce((sum, c) => sum + c.g, 0) / edgeColors.length),
        b: Math.round(edgeColors.reduce((sum, c) => sum + c.b, 0) / edgeColors.length),
    }

    return { colors: edgeColors, avgColor }
}

/**
 * Check if background colors are uniform (low variance)
 */
function isBackgroundUniform(edgeColors: Array<{ r: number; g: number; b: number }>, avgColor: { r: number; g: number; b: number }): boolean {
    // Calculate variance
    let variance = 0
    for (const color of edgeColors) {
        variance += Math.pow(color.r - avgColor.r, 2)
        variance += Math.pow(color.g - avgColor.g, 2)
        variance += Math.pow(color.b - avgColor.b, 2)
    }
    variance /= (edgeColors.length * 3)

    // Standard deviation threshold for uniformity
    const stdDev = Math.sqrt(variance)

    // A threshold of 30 means background colors should be within ~30 units of average
    return stdDev < 30
}

/**
 * Get average color of center region (object area)
 */
function getCenterColor(imageData: ImageData): { r: number; g: number; b: number } {
    const { data, width, height } = imageData
    const centerColors: Array<{ r: number; g: number; b: number }> = []

    // Sample from center 50% of image
    const startX = Math.floor(width * 0.25)
    const endX = Math.floor(width * 0.75)
    const startY = Math.floor(height * 0.25)
    const endY = Math.floor(height * 0.75)

    for (let y = startY; y < endY; y += 5) { // Sample every 5 pixels for performance
        for (let x = startX; x < endX; x += 5) {
            const idx = (y * width + x) * 4
            centerColors.push({ r: data[idx], g: data[idx + 1], b: data[idx + 2] })
        }
    }

    return {
        r: Math.round(centerColors.reduce((sum, c) => sum + c.r, 0) / centerColors.length),
        g: Math.round(centerColors.reduce((sum, c) => sum + c.g, 0) / centerColors.length),
        b: Math.round(centerColors.reduce((sum, c) => sum + c.b, 0) / centerColors.length),
    }
}

/**
 * Calculate luminance for WCAG contrast ratio
 */
function getLuminance(r: number, g: number, b: number): number {
    const [rs, gs, bs] = [r, g, b].map(c => {
        c = c / 255
        return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)
    })
    return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs
}

/**
 * Calculate contrast ratio between two colors
 */
function getContrastRatio(color1: { r: number; g: number; b: number }, color2: { r: number; g: number; b: number }): number {
    const l1 = getLuminance(color1.r, color1.g, color1.b)
    const l2 = getLuminance(color2.r, color2.g, color2.b)
    const lighter = Math.max(l1, l2)
    const darker = Math.min(l1, l2)
    return (lighter + 0.05) / (darker + 0.05)
}

/**
 * Determine if image object is light or dark
 */
export function isObjectLight(avgObjectColor: { r: number; g: number; b: number }): boolean {
    const luminance = getLuminance(avgObjectColor.r, avgObjectColor.g, avgObjectColor.b)
    return luminance > 0.5
}

/**
 * Analyze image background for 3D model generation suitability
 */
export async function analyzeImageBackground(imageUrl: string): Promise<BackgroundAnalysisResult> {
    try {
        const imageData = await getImageData(imageUrl)

        // Get edge (background) colors
        const { colors: edgeColors, avgColor: dominantBackgroundColor } = getEdgeColors(imageData)

        // Check uniformity
        const isUniform = isBackgroundUniform(edgeColors, dominantBackgroundColor)

        // Get center (object) color
        const averageObjectColor = getCenterColor(imageData)

        // Calculate contrast
        const contrastRatio = getContrastRatio(dominantBackgroundColor, averageObjectColor)

        // Minimum contrast ratio of 3:1 for adequate separation
        const hasEnoughContrast = contrastRatio >= 3

        // Build issues list
        const issues: string[] = []
        if (!isUniform) {
            issues.push("Background appears to have a gradient or is not uniform")
        }
        if (!hasEnoughContrast) {
            issues.push(`Low contrast between object and background (ratio: ${contrastRatio.toFixed(2)}:1)`)
        }

        return {
            isValid: isUniform && hasEnoughContrast,
            isUniform,
            hasEnoughContrast,
            dominantBackgroundColor,
            averageObjectColor,
            contrastRatio,
            issues,
        }
    } catch (error) {
        return {
            isValid: false,
            isUniform: false,
            hasEnoughContrast: false,
            dominantBackgroundColor: { r: 0, g: 0, b: 0 },
            averageObjectColor: { r: 0, g: 0, b: 0 },
            contrastRatio: 0,
            issues: [`Failed to analyze image: ${error}`],
        }
    }
}
