# Image Navigation Feature

## Features Implemented

### 1. ✅ Batch Image Navigation
Added the ability to navigate through images in a batch when maximized.

**Implementation**:
- Added state variables `imageGroup` and `currentImageIndex` to track the navigation context.
- Updated the **Batch Click Handler** to populate `imageGroup` with all 4 images of the batch.
- Updated the **Image Modal** to display Left/Right navigation arrows when `imageGroup` has multiple images.

**How it works**:
1. User clicks on a batch image (e.g., "Batch image+4").
2. The modal opens with the clicked image.
3. Left (`<`) and Right (`>`) arrows appear on the sides.
4. Clicking arrows cycles through the Front, Left, Right, Back views of that batch.
5. A counter (e.g., "1 / 4") appears at the bottom to show position.

### 2. ✅ Single Image Handling
Updated single image click handlers to work with the new system (sets a group of 1, so no arrows appear).

### 3. ✅ UI Improvements
- Added `ChevronRight` and `ChevronLeft` icons for navigation.
- Added a counter badge to show current image index.
- Ensure navigation loops (Next on last image goes to first).

## Files Modified
- `src/pages/Dashboard.tsx`:
  - Imports: Added `ChevronRight`.
  - State: Added `imageGroup`, `currentImageIndex`.
  - Logic: Updated `onClick` handlers for batches and single images.
  - UI: Updated Image Modal to include navigation controls.
