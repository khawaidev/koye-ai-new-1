# Single Image Generation Fix

## Issue
When users requested a single front-facing image, the AI was incorrectly listing all four views (Front, Left, Right, Back) and then saying "generating your images now", even though only one image was requested.

**Example of the problem**:
```
User: "I want one front image"
AI: "Front
     Left
     Right
     Back
     
     Got it! Confirming the cost: This will be 10 credits for one HQ image.
     generating your images now"
```

## Root Cause
The AI prompts were ambiguous about when to list the four views. The AI was over-explaining and listing all four possible views even when the user only wanted a single image.

## Fix Applied

### 1. Updated `gameDevPrompt.ts` (3D Game Flow)

**Before**:
```
8. Ask: Single front-facing or 4-view (all angles)?
9. If single: go to 10. If 4-view: go to 11.
10. **INFORM CREDIT COST**, then generate single image.
11. **INFORM CREDIT COST**, then generate 4 images (separate prompts for angles).
```

**After**:
```
8. Ask: "Do you want a single front-facing image (1 image) or all four views/angles (4 images)?"
9. If user wants single/one/front-facing: go to 10. If user wants four/all views/all angles: go to 11.
10. **INFORM CREDIT COST for 1 image**, then say "generating your image now" (DO NOT list Front, Left, Right, Back).
11. **INFORM CREDIT COST for 4 images**, then say "generating images now" and list: Front, Left, Right, Back.
```

### 2. Updated `gemini.ts` (Main 3D Games Section)

**Added clear instructions**:
```
- Ask the user: "Do you want a single front-facing image (1 image) or all four views/angles for 3D modeling (4 images: Front, Left, Right, Back)?"
- IMPORTANT: If user says "single", "one", or "front", generate ONLY 1 image. DO NOT list all four views.
- IMPORTANT: If user says "four", "all views", or "all angles", then list: Front, Left, Right, Back and generate 4 images.
- Use different trigger phrases:
  * "generating your image now" (for single image)
  * "generating the images now" (for multiple images)
```

## Expected Behavior Now

### Single Image Request
```
User: "I want one front image" OR "single" OR "front-facing"
AI: "Got it! This will cost 10 credits for one HQ image.
     generating your image now"
```
✅ **NO listing of Front, Left, Right, Back**

### Four Images Request
```
User: "I want all four views" OR "four" OR "all angles"
AI: "Got it! I'll generate all four views:
     Front
     Left
     Right
     Back
     
     This will cost 40 credits (4 × 10).
     generating the images now"
```
✅ **Lists all four views only when generating 4 images**

## Files Modified
1. `src/services/gameDevPrompt.ts` - Steps 8-11 updated
2. `src/services/gemini.ts` - 3D games section updated with explicit instructions

## Result
The AI will now:
- ✅ Only list the four views when the user actually wants 4 images
- ✅ Use singular "image" and "generating your image now" for single images
- ✅ Use plural "images" and list views only for 4-image requests
- ✅ Be more explicit in asking the question to avoid ambiguity
