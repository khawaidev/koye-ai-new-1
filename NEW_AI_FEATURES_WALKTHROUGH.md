# New AI Features Walkthrough (Meshy Integration)

This document outlines the new AI generation features added to the application using the Meshy API.

## 1. Text-to-3D Generation

**Location:** 3D Model Generation Page

We have added a new "Text-to-3D" mode alongside the existing Image-to-3D functionality.

**How to use:**
1. Navigate to the **3D Model Generation** page.
2. At the top of the sidebar, use the toggle buttons to switch between **Image to 3D** (default) and **Text to 3D**.
3. In **Text to 3D** mode:
   - Enter a detailed text description of the model you want to create.
   - select an AI Model (Meshy-6 is recommended for high quality).
   - Select a Pose (A-Pose or T-Pose are best for rigging characters).
   - Adjust the target polycount if needed.
   - Click "Generate".
4. The model will be generated and displayed in the viewer.

## 2. Default Text-to-Image (koye-2dv3)

**Location:** Chat Interface

The default AI image generation model has been upgraded to `koye-2dv3`, which uses the Meshy Text-to-Image API (nano-banana model).

**How to use:**
1. In the chat, ask the AI to generate an image (e.g., "Generate a character for my game").
2. The system will automatically use the high-quality Meshy model (`koye-2dv3`).
3. If generation fails, it will gracefully fallback to other models (LightX -> Pixazo -> ClipDrop).

## 3. Image-to-Image Editing

**Location:** Builder Page -> Inspector

You can now use Meshy AI for editing existing images in the Builder.

**How to use:**
1. Go to the **Builder** page.
2. Select an image file from the file tree.
3. In the Inspector panel (right side), click "Edit Image".
4. A new toggle allows you to choose between **Meshy AI** (Default) and **Pixazo**.
5. Enter your edit prompt and click the send button.

## Setup Requirements

**Crucial Step:** Ensure your `.env` file contains your Meshy API key.

```env
VITE_MESHY_API_KEY=your_meshy_api_key_here
```

If you haven't added this key, the new features will fail (though fallback mechanisms are in place for some).
