# Profile Assets Scrolling Fix - Update

## Issue
The user reported that `max-h-[70vh]` wasn't effectively enabling scrolling for the assets list, causing previous assets to be hidden/cut off.

## Fix Applied
Changed the container from a flexible max-height to a **fixed height** with explicit overflow handling.

**Before**:
```tsx
<div className="p-6 max-h-[70vh] overflow-y-auto">
```

**After**:
```tsx
<div className="p-6 h-[600px] overflow-y-auto border-t border-black">
```

## Why this works better
1. **Fixed Height (`h-[600px]`)**: Forces the container to take up exactly 600px of vertical space. If the content (images, videos, etc.) exceeds 600px, the browser *must* show a scrollbar.
2. **Explicit Overflow (`overflow-y-auto`)**: Ensures vertical scrolling is enabled when needed.
3. **Visual Separation (`border-t`)**: Added a top border to clearly distinguish the scrollable assets area from the tab controls above it.

## Verification
- Container now has a guaranteed height.
- Scrollbar will appear for any content list longer than ~2 rows of images.
- "Batch image+4" and other items will be accessible via this scrollbar.

## File Modified
`src/pages/Dashboard.tsx` (Line 892)
