# AI Workflow Documentation

This document outlines the workflow for the KOYE AI web application, detailing how the AI gathers information, interacts with the user, and triggers specific features like image generation and game engine launches.

## 1. AI Persona & System Prompt

The core of the AI's behavior is defined in `src/services/gemini.ts`.

*   **Persona**: "KOYE AI", an expert in game design and asset creation.
*   **Role**: Helps users design game assets (2D/3D) through deep conversation and "brutal honesty".
*   **System Prompt**: The `SYSTEM_PROMPT` constant defines strict rules for interaction:
    *   **Game Type Detection**: Determines if the user wants a 2D or 3D game.
    *   **Information Gathering**: Mandates 2-3 exchanges to gather detailed requirements before acting.
    *   **Explicit Triggers**: Uses specific, pre-defined phrases to trigger actions on the frontend.

## 2. Workflow Stages

### Stage 1: Chat & Detection
*   **Logic**: The AI converses with the user to understand the game concept.
*   **Detection**:
    *   **3D**: Looks for keywords like "3D", "three dimensional", "model".
    *   **2D**: Looks for keywords like "2D", "sprite", "pixel".
*   **State**: Managed in `WorkflowManager.tsx` (`gameType` state).

### Stage 2: Image Generation
The system uses a **strict trigger mechanism** to prevent accidental generation.

*   **Trigger Phrases**: The AI must use one of these **EXACT** phrases in its response:
    *   "generating the images now"
    *   "generating images now"
    *   "starting image generation"
    *   "initiating image generation"
    *   "proceeding with image generation"
    *   "generating your images"
    *   "creating the images"
    *   "generating sample images now"
    *   "generating image variations now"
    *   "creating sample images now"

*   **Safety Checks (Frontend)**:
    Even if the AI uses a trigger phrase, `WorkflowManager.tsx` enforces additional checks:
    1.  **Input Length**: User's last message must be > 20 characters.
    2.  **Context**: Conversation must have at least 2 user messages.
    3.  **Details**:
        *   **3D**: Must contain visual details (appearance, color, style, etc.).
        *   **2D**: Must contain character/asset keywords.

*   **Execution**:
    *   **3D**: Generates 1-4 orthographic views (Front, Back, Left, Right) using `generate3DViews`.
    *   **2D**: Generates 2-5 sample variations using `generateSampleImages`.

### Stage 3: Video Generation (Cutscenes)
*   **Trigger Phrases**: "generating cutscene", "creating video", "generating video", etc.
*   **Logic**:
    *   Collects up to 3 recent images from the chat history.
    *   Uses the user's recent messages as the prompt.
    *   Calls `handleGenerateVideo` in `WorkflowManager.tsx`.

### Stage 4: Game Engine Launch
The application can open external game engines in a new tab.

*   **2D Engine**:
    *   **Triggers**: "opening 2d game engine", "launching phaser engine", etc.
    *   **Action**: Opens `/phaser-2d-engine`.
*   **3D Engine**:
    *   **Triggers**: "opening 3d game engine", "launching babylon engine", etc.
    *   **Action**: Opens `/game-engine`.
*   **Implementation**: Handled in `src/components/chat/ChatInterface.tsx`.

## 3. Technical Implementation

### Key Files
*   **`src/services/gemini.ts`**: Contains the `SYSTEM_PROMPT` and API interaction logic. Defines the "brain" of the AI.
*   **`src/components/workflow/WorkflowManager.tsx`**: The central nervous system. Listens to chat messages, parses trigger phrases, enforces safety checks, and manages the state of the generation workflow.
*   **`src/components/chat/ChatInterface.tsx`**: Handles the UI, message streaming, and specifically the **Game Engine** launch triggers.
*   **`src/services/imageGenerationHelpers.ts`**: Helper functions for calling the actual image generation APIs (ClipDrop, Banana) and formatting prompts for specific views (T-pose, etc.).

### Data Flow
1.  **User Input** -> `ChatInterface` -> `sendMessageToGemini`
2.  **AI Response** (Streamed) -> `ChatInterface` displays text.
3.  **WorkflowManager** monitors `messages`.
4.  **Trigger Detection**:
    *   If **Image Trigger** found -> `WorkflowManager` calls `handleGenerateImagesAuto`.
    *   If **Video Trigger** found -> `WorkflowManager` calls `handleGenerateVideo`.
    *   If **Engine Trigger** found -> `ChatInterface` opens new tab.
5.  **Generation**: Services generate assets -> Assets saved to Store/DB -> UI updates with new images/video.
