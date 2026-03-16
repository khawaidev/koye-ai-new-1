// Helper functions for the new image generation flow
// ALL text-to-image generation uses HyperReal API exclusively

import { generateImageWithHyperreal, type Gpt4oImageSize, type HyperrealImageModel, type NanoBananaAspectRatio } from "./hyperreal"

export type ImageModel = "koye-2dv1" | "koye-2dv2" | "koye-2dv1.5" | "koye-2dv2.5" | "koye-2dv3"

/**
 * Generate a single image using HyperReal API
 * 
 * All model versions now route through HyperReal:
 * - koye-2dv1: HyperReal nano-banana-t2i (fast)
 * - koye-2dv1.5: HyperReal nano-banana-t2i
 * - koye-2dv2: HyperReal nano-banana-t2i
 * - koye-2dv2.5: HyperReal gpt-4o-image (high quality)
 * - koye-2dv3: HyperReal gpt-4o-image (high quality) - DEFAULT
 */
export async function generateImageWithModel(
  prompt: string,
  model: ImageModel
): Promise<string> {
  const modelConfig = getModelConfig(model)

  try {
    const result = await generateImageWithHyperreal(prompt, modelConfig.options)
    return result
  } catch (error) {
    console.error(`HyperReal generation failed for model ${model}:`, error)

    // Dispatch event for UI to show warning
    const event = new CustomEvent('model-fallback-error', {
      detail: {
        model,
        error: error instanceof Error ? error.message : String(error)
      }
    })
    window.dispatchEvent(event)

    throw error // generateImageWithHyperreal already handles model fallback internally
  }
}

/**
 * Get HyperReal model configuration based on internal model name
 * Returns model-specific options (size for gpt-4o-image, aspect_ratio for nano-banana-t2i)
 */
function getModelConfig(model: ImageModel): {
  hyperrealModel: HyperrealImageModel
  options: {
    model: HyperrealImageModel
    aspect_ratio?: NanoBananaAspectRatio
    size?: Gpt4oImageSize
  }
} {
  switch (model) {
    case "koye-2dv1":
    case "koye-2dv1.5":
    case "koye-2dv2":
      return {
        hyperrealModel: "gpt-4o-image",
        options: { model: "gpt-4o-image", size: "1024x1024" }
      }
    case "koye-2dv2.5":
      return {
        hyperrealModel: "gpt-4o-image",
        options: { model: "gpt-4o-image", size: "1024x1792" }
      }
    case "koye-2dv3":
    default:
      return {
        hyperrealModel: "gpt-4o-image",
        options: { model: "gpt-4o-image", size: "1024x1024" }
      }
  }
}

/**
 * Generate multiple images (2-5) with slightly different prompts for 2D sample selection
 */
export async function generateSampleImages(
  basePrompt: string,
  count: number, // 2-5
  model: ImageModel,
  signal?: AbortSignal
): Promise<Array<{ id: number; url: string; prompt: string }>> {
  const variations = [
    "",
    ", detailed, high quality",
    ", clean art style, professional",
    ", vibrant colors, polished",
    ", refined, studio quality"
  ]

  const results: Array<{ id: number; url: string; prompt: string }> = []

  for (let i = 0; i < count; i++) {
    // Check if cancelled before generating next image
    if (signal?.aborted) {
      throw new DOMException("Image generation cancelled by user", "AbortError")
    }
    const variation = variations[i] || ""
    const prompt = basePrompt + variation
    const url = await generateImageWithModel(prompt, model)
    results.push({
      id: i + 1,
      url,
      prompt
    })

    // Add delay between generations to avoid rate limits
    if (i < count - 1) {
      await new Promise(resolve => setTimeout(resolve, 2000))
    }
  }

  return results
}

/**
 * Generate sprites for animation (5, 11, 22, or 44 sprites)
 * Uses the selected sample image prompt and modifies it for each frame
 */
export async function generateSprites(
  basePrompt: string,
  animationDescription: string,
  spriteCount: number, // 5, 11, 22, or 44
  model: ImageModel,
  signal?: AbortSignal
): Promise<Array<{ id: number; url: string; prompt: string }>> {
  const results: Array<{ id: number; url: string; prompt: string }> = []

  for (let i = 0; i < spriteCount; i++) {
    // Check if cancelled
    if (signal?.aborted) {
      throw new DOMException("Sprite generation cancelled by user", "AbortError")
    }
    // Calculate progress through animation (0 to 1)
    const progress = i / (spriteCount - 1)

    // Modify prompt for this frame
    const framePrompt = `${basePrompt}, ${animationDescription}, frame ${i + 1} of ${spriteCount}, animation progress ${Math.round(progress * 100)}%`

    const url = await generateImageWithModel(framePrompt, model)
    results.push({
      id: i + 1,
      url,
      prompt: framePrompt
    })

    // Add delay between generations
    if (i < spriteCount - 1) {
      await new Promise(resolve => setTimeout(resolve, 2000))
    }
  }

  return results
}

/**
 * Generate 1-4 images for 3D game (orthographic views)
 * For 1 image: front view only
 * For 2 images: front and back
 * For 3 images: front, left, right
 * For 4 images: front, left, right, back
 * 
 * All views use HyperReal API with portrait aspect ratio for full-body framing
 */
export async function generate3DViews(
  prompt: string,
  count: number, // 1-4
  model: ImageModel,
  signal?: AbortSignal
): Promise<Record<string, string>> {
  const views: Array<{ view: string; prompt: string }> = []

  // Enhanced prompts to ensure full body is visible with proper framing
  const fullBodySuffix = ", full body visible from head to feet, entire body in frame, character centered with margin around edges, no cropping, complete figure shown, feet visible, legs fully visible, full-length portrait, wide shot showing complete character"

  if (count >= 1) {
    views.push({ view: "front", prompt: `${prompt}, front view, T-pose, strict T-pose, arms extended horizontally, legs straight, orthographic projection, character sheet, clean white background, technical drawing style${fullBodySuffix}` })
  }
  if (count >= 2) {
    views.push({ view: "back", prompt: `${prompt}, back view, orthographic, character sheet, clean white background${fullBodySuffix}` })
  }
  if (count >= 3) {
    views.push({ view: "left", prompt: `${prompt}, left side view, orthographic, character sheet, clean white background${fullBodySuffix}` })
  }
  if (count >= 4) {
    views.push({ view: "right", prompt: `${prompt}, right side view, orthographic, character sheet, clean white background${fullBodySuffix}` })
  }

  const results: Record<string, string> = {}
  const cfg = getModelConfig(model)

  for (let i = 0; i < views.length; i++) {
    // Check if cancelled before generating next view
    if (signal?.aborted) {
      throw new DOMException("3D view generation cancelled by user", "AbortError")
    }
    const { view, prompt: viewPrompt } = views[i]
    const validatedPrompt = viewPrompt.length > 5000 ? viewPrompt.substring(0, 5000).trim() : viewPrompt

    // Use portrait format for full-body character images
    // nano-banana-t2i uses aspect_ratio, gpt-4o-image uses size
    const isGpt4o = cfg.hyperrealModel === "gpt-4o-image"
    const portraitOptions = isGpt4o
      ? { model: "gpt-4o-image" as const, size: "1024x1792" as const }
      : { model: "nano-banana-t2i" as const, aspect_ratio: "2:3" as const }

    results[view] = await generateImageWithHyperreal(validatedPrompt, portraitOptions)

    // Add delay between generations
    if (i < views.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 2000))
    }
  }

  return results
}
