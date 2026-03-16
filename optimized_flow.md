# Optimized AI Workflow for KOYE AI

This document outlines a new, optimized workflow for the KOYE AI web application. The core philosophy is **Chat-Driven Development**, where the AI (Gemini) acts as the lead developer and orchestrator, triggering specialized tools (Image Gen, 3D Gen, Audio, Video, Build System) based on the user's intent.

## 1. Core Architecture

*   **Orchestrator**: Gemini 2.5 Flash (The "Brain").
*   **Interface**: Chat-based Terminal/UI.
*   **Trigger System**: The AI uses **explicit, unique phrases** in its responses to trigger frontend actions.
*   **State Management**: The frontend (`WorkflowManager`) tracks the current "Stage" (Concept, Asset Gen, Rigging, Build, etc.) and "Game Type" (2D vs 3D).

---

## 2. The Workflow Paths

The workflow splits early based on the user's intent: **2D Game Dev** or **3D Game Dev**.

### Phase 1: Discovery & Concept (Common)
1.  **User**: Describes game idea (e.g., "I want to make a space shooter").
2.  **AI**: Analyzes intent.
    *   *Action*: Asks clarifying questions (Genre, Art Style, 2D vs 3D).
3.  **User**: Clarifies (e.g., "3D, low poly style").
4.  **AI**: Detects Game Type.
    *   *Trigger*: `[SET_GAME_TYPE: 3D]` (Internal state update).
    *   *Response*: "Great! Let's start by designing the main character. Describe them for me."

---

### Phase 2A: 3D Game Development Flow

#### Step 1: Concept Art (Image Gen)
1.  **IA**: Asks user type of asset to generate (character, items, icons, ui, enviroment(tiles, background, etc for 2d))
2.  **User**: Describes the asset.
3.  **AI**: Refines description into a prompt.
    
  
    *   *conditions*: IF 2d:
    *   *Trigger*: `[GENERATE_IMAGE: <prompt>]`  
        *   *confirm*:  generates an image using the above confirmed prompt.
        *   *AI*     : asks user if satisfied or not, if yes proceed to the next flow for 2d, if not :then asks user to describe the asset again in more detail or upload an reference image for it.

    *   *conditions*: IF 3d:
        *conditions*: asks user if to generate a single image or four images from different view angles.
        *if single image*:
        *Trigger*: `[GENERATE_sample_IMAGES: <prompt>]`(here user can edit the prompt in the interface)
        *confirm*: if confirm then proced to the next flow for 3d. if not then asks user to generate new sample image
        *if multi*: 
        *trigger*: `[GENERATE_sample_IMAGE: <prompt>]` 
        *confirm*: asks user if satisfied with the sample and to proceed to the multi image gen.if yes proceed if not then asks user to describe the asset in more detail or upload an reference image for it and generate trigger again after prompt confirmation.
        *Trigger*: `[GENERATE_4_IMAGE: <prompt>]`
        *confirm*: if confirm then proceed to the next flow for 3d , else: asks user if he wants to generate new sample image?if yes then go back to sample generation.
    *   *System*: Generates 4 orthographic views (Front, Back, Left, Right) using  or **ClipDrop**.
4.  **User**: Selects the best view.

#### Step 2: 3D Model Generation (Meshy)
1.  **AI**: "Shall we turn this concept into a 3D model?"
2.  **User**: "Yes".
3.  **AI**: Initiates 3D generation.
    *   *Trigger*: `[GENERATE_3D_MODEL: <image_url>]`
    *   *System*: Calls Meshy API (Image-to-3D).
    *   *UI*: Shows progress bar/preview of the model generating.

#### Step 3: Auto-Rigging (Meshy)
1.  **System**: Displays the generated 3D model (GLB).
2.  **AI**: "The model looks good. Should we rig it for animation?"
3.  **User**: "Yes, rig it."
4.  **AI**: Initiates rigging.
    *   *Trigger*: `[RIG_3D_MODEL: <model_id>]`
    *   *System*: Calls Meshy `POST /openapi/v1/rigging`.
    *   *Result*: Returns a rigged FBX/GLB.

#### Step 4: Animation (Meshy)
1.  **AI**: "Model is rigged! What animations do you need? (e.g., Run, Jump, Attack)"
2.  **User**: "Make it run and jump."
3.  **AI**: Triggers animation generation.
    *   *Trigger*: `[ANIMATE_3D_MODEL: <rig_id>, <animation_names>]`
    *   *System*: Calls Meshy `POST /openapi/v1/animations` for each requested animation.
    *   *UI*: Shows preview of animations on the character.

#### Step 5: Audio/Video (Optional)
*   **Audio**: `[GENERATE_AUDIO: <prompt>]` (Sound effects, background music).
*   **Video**: `[GENERATE_CUTSCENE: <prompt>]` (For intro/cutscenes).

#### Step 6: The Build (Project Creation)
1.  **User**: "I'm ready to build the game."
2.  **AI**: "Generating your project structure..."
    *   *Trigger*: `[BUILD_PROJECT: 3D]`
    *   *System Action*:
        1.  **Scaffold**: Creates a standard **Babylon.js** or **Three.js** project structure.
        2.  **Assets**: Downloads all generated assets (Models, Textures, Audio) into an `/assets` folder.
        3.  **Code**: AI generates `index.html`, `game.js`, and `scene.js` code to load the assets and implement basic movement/logic.
        4.  **Storage**:
            *   *If GitHub Connected*: Pushes code to a new repo `user/koye-game-name`.
            *   *If No GitHub*: Zips folder and uploads to Supabase Storage / User Dashboard.

#### Step 7: Launch Engine
1.  **AI**: "Project built! Opening the 3D Engine."
    *   *Trigger*: `[LAUNCH_ENGINE: 3D]`
    *   *System*: Opens `/game-engine` (Babylon.js Viewer) with the *live project code* loaded.

---

### Phase 2B: 2D Game Development Flow

#### Step 1: Asset Generation (Sprites/Backgrounds)
1.  **User**: Describes assets.
2.  **AI**: Generates assets.
    *   *Trigger*: `[GENERATE_SPRITE: <prompt>, <count>]` (for characters) or `[GENERATE_IMAGE: <prompt>]` (for backgrounds).
    *   *System*: Uses **ClipDrop** or **Banana** (Flux/SDXL).

#### Step 2: Sprite Animation (Optional)
*   If the user wants animated sprites, the system generates sprite sheets.

#### Step 3: Audio/Video (Optional)
*   Same as 3D flow.

#### Step 4: The Build (Project Creation)
1.  **User**: "Build it."
2.  **AI**: "Assembling your 2D game..."
    *   *Trigger*: `[BUILD_PROJECT: 2D]`
    *   *System Action*:
        1.  **Scaffold**: Creates a **Phaser.js** project structure.
        2.  **Assets**: Organizes sprites and audio into folders.
        3.  **Code**: AI generates `main.js`, `preload.js`, `level1.js`.
        4.  **Storage**: GitHub or Supabase.

#### Step 5: Launch Engine
1.  **AI**: "Launching 2D Engine."
    *   *Trigger*: `[LAUNCH_ENGINE: 2D]`
    *   *System*: Opens `/phaser-2d-engine` with the generated code.

---

## 3. Technical Implementation Details

### Trigger Phrase Protocol
To ensure reliability, we will move from natural language triggers (which can be flaky) to **Structured Command Tokens** hidden in the AI response or appended to the end.

**Format**: `[COMMAND: param1, param2]`

| Command | Parameters | Description |
| :--- | :--- | :--- |
| `[SET_GAME_TYPE]` | `2D` \| `3D` | Sets the global context. |
| `[GENERATE_IMAGE]` | `prompt` | Generates concept art/backgrounds. |
| `[GENERATE_3D]` | `image_url` | Triggers Meshy Image-to-3D. |
| `[RIG_MODEL]` | `model_id` | Triggers Meshy Auto-Rigging. |
| `[ANIMATE_MODEL]` | `rig_id`, `action` | Triggers Meshy Animation. |
| `[GENERATE_AUDIO]` | `prompt`, `type` | Generates SFX or Music. |
| `[BUILD_PROJECT]` | `type` | Triggers the folder creation & code generation logic. |
| `[LAUNCH_ENGINE]` | `type` | Opens the game engine tab. |

### The "Build" Feature Logic
The `[BUILD_PROJECT]` command is the most complex. It requires a backend service (or a robust client-side `JSZip` implementation) to:
1.  **Fetch** all assets created in the session (stored in Supabase/Local State).
2.  **Generate** boilerplate code based on the assets (e.g., "Load `hero.glb` at position 0,0,0").
3.  **Package** it into a standard web format (`index.html`, `js/`, `assets/`).
4.  **Deploy/Save**:
    *   **GitHub**: Use GitHub API to create a repo and commit files.
    *   **Supabase**: Upload zip file to user's bucket.

### User Interface Changes
*   **Chat**: Remains the center.
*   **Asset Sidebar**: Dynamic list of generated assets (Images, Models, Audio).
*   **Preview Window**: Context-aware (shows Image, 3D Viewer, or Code based on current activity).
