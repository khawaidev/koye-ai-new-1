# Image Model API Correction - koye-2dv1.5

## Issue
The image generation in the chatting interface was incorrectly using the Banana API for `koye-2dv1.5`, when it should have been using the Pixazo API.

## Correct Model Mapping

After reviewing `ImageGeneration.tsx`, the correct mapping is:

| UI Model Name | API Service | Model/Config |
|--------------|-------------|--------------|
| **koye-2dv1** | ClipDrop | `generateImage()` |
| **koye-2dv2** | Banana | `generateImageWithBanana()` with model "koye2dv2" |
| **koye-2dv1.5** | **Pixazo** | `generateImageWithPixazo()` with model "seedream-3-0-t2i-250415" |

## Fix Applied

Updated `src/services/imageGenerationHelpers.ts`:

### Before
```typescript
} else if (model === "koye-2dv2" || model === "koye-2dv1.5") {
  // Both used Banana API
  const modelName = model === "koye-2dv1.5" ? "koye2dv1.5" : "koye2dv2"
  const result = await generateImageWithBanana({ 
    prompt, 
    numImages: 1,
    model: modelName
  })
  ...
}
```

### After
```typescript
} else if (model === "koye-2dv2") {
  // koye-2dv2 uses Banana API
  const result = await generateImageWithBanana({ 
    prompt, 
    numImages: 1,
    model: "koye2dv2"
  })
  ...
} else if (model === "koye-2dv1.5") {
  // koye-2dv1.5 uses Pixazo API
  return await generateImageWithPixazo(prompt, {
    model: "seedream-3-0-t2i-250415",
    size: "1024x1024",
    guidance_scale: 2.5,
    watermark: true,
  })
  ...
}
```

## Pixazo API Configuration

The Pixazo API is called with these parameters for `koye-2dv1.5`:
- **Model**: `"seedream-3-0-t2i-250415"` (2D character design model)
- **Size**: `"1024x1024"`
- **Guidance Scale**: `2.5`
- **Watermark**: `true`

## Files Modified
- `src/services/imageGenerationHelpers.ts`
  - Added import for `generateImageWithPixazo`
  - Separated koye-2dv2 and koye-2dv1.5 into distinct branches
  - koye-2dv1.5 now correctly uses Pixazo API

## Testing
- ✅ koye-2dv1 → ClipDrop API
- ✅ koye-2dv2 → Banana API
- ✅ koye-2dv1.5 → Pixazo API (seedream model)
- ✅ Fallback to koye-2dv1 if any model fails
- ✅ Error events dispatched for UI notifications

## Result
The chatting interface now uses the **correct API (Pixazo)** when generating images with the `koye-2dv1.5` model, matching the behavior in `ImageGeneration.tsx`.
