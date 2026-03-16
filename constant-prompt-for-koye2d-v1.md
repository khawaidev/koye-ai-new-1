# Koye2D v1 Prompt Structure Template

This document defines the prompt structure for AI-triggered image generation using the koye-2dv1 model (ClipDrop).

## Prompt Structure

When generating image prompts for koye-2dv1, follow this exact structure:

### 1. Subject & Framing (Required)
```
A full-body, uncropped [gender] [theme/style] character, clearly and completely visible from the top of the head to the soles of the feet, centered perfectly inside the frame with extra margin above the head and below the feet so no body parts are cut off.
```

### 2. Camera Position (Required)
```
The camera is positioned at neutral eye-level, straight-on, with no tilt, no zoom, no crop, and no perspective distortion.
```

### 3. Pose Description (Required - Use A-pose for 3D-ready characters)
```
The character is standing in a strict, neutral A-pose: feet shoulder-width apart, legs straight and fully visible, arms extended downward and outward at approximately 30 degrees from the torso, elbows straight, wrists neutral, fingers relaxed and slightly separated, palms facing inward toward the thighs.
```

### 4. Character Details (Required)
```
[Gender] in [age range], [body type/build], realistic human proportions, [facial expression]. [Hair description including color, length, style].
```

### 5. Clothing & Equipment (Required)
```
Clothing consists of [detailed clothing description with textures and colors]. [Specify if no weapons/accessories: "No weapons, armor, belts, pouches, jewelry, cloaks, or accessories."]
```

### 6. Rendering Style & Background (Required)
```
Rendered in realistic game-ready style, evenly lit with soft frontal studio lighting. Plain solid gray background, sharp focus, clean silhouette, optimized for image-to-3D character reconstruction.
```

---

## Example Prompt

```
A full-body, uncropped male medieval fantasy character, clearly and completely visible from the top of the head to the soles of the feet, centered perfectly inside the frame with extra margin above the head and below the feet so no body parts are cut off. The camera is positioned at neutral eye-level, straight-on, with no tilt, no zoom, no crop, and no perspective distortion.

The character is standing in a strict, neutral A-pose: feet shoulder-width apart, legs straight and fully visible, arms extended downward and outward at approximately 30 degrees from the torso, elbows straight, wrists neutral, fingers relaxed and slightly separated, palms facing inward toward the thighs.

He is a male in his mid-20s, lean athletic build, realistic human proportions, neutral facial expression. He has mid-to-long white hair, slightly wavy, falling naturally past the shoulders.

Clothing consists of a rugged brown leather vest with worn texture over a simple off-white medieval linen tunic and dark cloth trousers. No weapons, armor, belts, pouches, jewelry, cloaks, or accessories.

Rendered in realistic game-ready style, evenly lit with soft frontal studio lighting. Plain solid gray background, sharp focus, clean silhouette, optimized for image-to-3D character reconstruction.
```

---

## Key Requirements

- **Full body visibility**: Head to feet, no cropping
- **Centered framing**: Extra margin around character
- **A-pose**: Arms at 30° from torso, legs straight
- **Neutral lighting**: Soft frontal studio lighting
- **Clean background**: Plain solid gray
- **Game-ready**: Optimized for 3D reconstruction
- **Detailed descriptions**: Specific textures, colors, materials