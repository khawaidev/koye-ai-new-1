# Bug Fixes - RESET_FLOW & Image Model

## Issues Fixed

### 1. ✅ RESET_FLOW Reference Error
**Error**: `gemini.ts:159 Uncaught ReferenceError: RESET_FLOW is not defined`

**Cause**: The backtick escaping in the template literal was incorrect, causing the template string to close prematurely at line 159.

**Fix**: Removed the stray backtick at the end of line 161 that was closing the SYSTEM_PROMPT template literal prematurely.

**Files Modified**:
- `src/services/gemini.ts` (line 161)

**Before**:
```typescript
- Only trigger this when the user explicitly requests to reset, restart, or start over\`
```

**After**:
```typescript
- Only trigger this when the user explicitly requests to reset, restart, or start over`
```

### 2. ✅ Image Model API Integration
**Issue**: Image generation was using Banana API without specifying the correct model name (koye2dv1.5).

**Fix**: Added model parameter support throughout the image generation pipeline:

1. **`banana.ts`**: 
   - Added `model?: string` to `BananaGenerateOptions` interface
   - Included `model` in the API request body (defaults to "koye2dv1.5")

2. **`imageGenerationHelpers.ts`**:
   - Updated `generateImageWithModel()` to pass the correct model name to Banana API
   - Maps "koye-2dv1.5" → "koye2dv1.5" and "koye-2dv2" → "koye2dv2" for the API

**Files Modified**:
- `src/services/banana.ts`
- `src/services/imageGenerationHelpers.ts`

**API Request Body** (before):
```json
{
  "prompt": "...",
  "numImages": 1,
  "type": "TEXTTOIAMGE",
  "image_size": "16:9",
  "callBackUrl": "..."
}
```

**API Request Body** (after):
```json
{
  "prompt": "...",
  "numImages": 1,
  "type": "TEXTTOIAMGE",
  "image_size": "16:9",
  "model": "koye2dv1.5",  ← NEW
  "callBackUrl": "..."
}
```

## Model Mapping

| UI Model Name | API Model Name |
|--------------|----------------|
| koye-2dv1 | (uses ClipDrop API) |
| koye-2dv1.5 | koye2dv1.5 (Banana API) |
| koye-2dv2 | koye2dv2 (Banana API) |

## Testing

- [x] RESET_FLOW feature should work without errors
- [x] Image generation should use the correct model name
- [x] koye-2dv1.5 should be the default model for HQ images
- [x] Fallback to koye-2dv1 (ClipDrop) should still work if Banana API fails

## Notes

The Banana API (NanoBanana) now receives the specific model name in the request, ensuring that the correct image generation model is used based on the user's plan and selection.
