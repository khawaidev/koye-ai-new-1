# KOYE AI - Application Features & Flow Documentation

## 📋 Table of Contents
1. [Overview](#overview)
2. [Core Features](#core-features)
3. [Pages & Routes](#pages--routes)
4. [Services & APIs](#services--apis)
5. [Data Architecture](#data-architecture)
6. [Feature Connections & Flow](#feature-connections--flow)
7. [Disconnected Features](#disconnected-features)
8. [Future/Planned Features](#futureplanned-features)

---

## Overview

**KOYE AI** is an AI-powered game asset creation platform that enables users to generate 2D/3D game assets through conversational AI interactions. The platform uses Gemini 2.5 Flash as the primary LLM and integrates multiple APIs for image generation, 3D model creation, video generation, and audio generation.

### Key Technologies
- **Frontend**: React + TypeScript + Vite
- **State Management**: Zustand (`useAppStore`)
- **Database**: Supabase (Multi-database architecture)
- **LLM**: Google Gemini 2.5 Flash
- **Styling**: Tailwind CSS + Shadcn UI

---

## Core Features

### 1. **Chat Interface** (`ChatInterface.tsx`)
- **Purpose**: Main conversational interface with Gemini AI
- **Features**:
  - Text-based chat with streaming responses
  - Image upload support (for reference images)
  - Message history with session management
  - Auto-triggered image/video generation based on conversation
  - Code view for generated code snippets
  - Voice chat layout (UI component exists)
- **State**: Connected ✅
- **Storage**: Chat sessions stored in data databases via `multiDbDataService`

### 2. **Image Generation** (`ImageGeneration.tsx`)
- **Purpose**: Standalone image generation page
- **Features**:
  - Multiple model options:
    - `koye-2dv1` (ClipDrop API) - FREE/PRO_TRIAL plans
    - `koye-2dv1.5` (Pixazo API) - Available for all plans
    - `koye-2dv2` (Banana API) - Higher tier plans
  - Single image or 4-view generation
  - Prompt input and editing
  - Image preview with zoom/maximize
  - Sidebar with generation history
- **State**: Connected ✅
- **Storage**: Images saved to data databases

### 3. **3D Model Generation** (`Model3DGeneration.tsx`)
- **Purpose**: Generate 3D models from images
- **Features**:
  - Image upload (4 views: front, left, right, back)
  - 3D model generation via Hitem3D API
  - Model preview and download
- **State**: Connected ✅
- **Storage**: Models saved to data databases

### 4. **Video Generation** (`VideoGeneration.tsx`)
- **Purpose**: Generate videos/cutscenes from images
- **Features**:
  - Text prompt input
  - Aspect ratio selection
  - Duration selection
  - Resolution selection
  - Audio toggle
  - Negative prompt
  - First frame and last frame image uploads
  - Video preview, maximize, and download
  - Generation history
- **API**: Veo 3.1 via Pixazo API
- **State**: Connected ✅
- **Storage**: Videos saved to data databases

### 5. **Audio Generation** (`AudioGeneration.tsx`)
- **Purpose**: Generate audio/sound effects from text
- **Features**:
  - Text prompt input
  - Prompt influence slider
  - Duration selection
  - Audio player and download
  - Generation history
- **API**: RapidAPI ElevenLabs Sound Effects
- **State**: Connected ✅
- **Storage**: Audio saved to data databases

### 6. **Dashboard** (`Dashboard.tsx`)
- **Purpose**: User profile and asset management
- **Features**:
  - Profile information display
  - Asset tabs:
    - **Images**: View all generated images (grouped by batches, single images)
    - **3D Models**: View all generated models
    - **Videos**: View all generated videos
    - **Audio**: View all generated audio
  - Delete functionality for all asset types
  - Usage statistics
  - Projects management
  - GitHub integration (OAuth setup)
  - Social links (Twitter, LinkedIn, YouTube - UI only)
- **State**: Connected ✅
- **Storage**: Reads from data databases via `multiDbDataService`

### 7. **Pricing Page** (`Pricing.tsx`)
- **Purpose**: Display subscription plans
- **Features**:
  - Plan comparison
  - Subscription management
  - Payment integration (Razorpay)
- **State**: Connected ✅

### 8. **Game Engine** (`GameEngine.tsx`)
- **Purpose**: 3D game engine/viewer
- **Features**:
  - Babylon.js integration
  - Scene management
  - File system view
  - Inspector panel
  - Animation panel
  - Shader editor (UI only)
- **State**: Partially Connected ⚠️
- **Note**: UI exists but full integration with generated assets is incomplete

### 9. **Workflow Manager** (`WorkflowManager.tsx`)
- **Purpose**: Main orchestrator for the workflow
- **Features**:
  - Stage management (chat, images, model, texture, rig, animate, export, build)
  - Navigation between different generation stages
  - Auto-progression logic:
    - Chat → Image generation (triggered by AI)
    - Images → 3D Model (auto when 4 views approved)
    - Model → Texture (auto-advance)
  - Integration with all generation components
- **State**: Connected ✅

---

## Pages & Routes

### Active Routes (`App.tsx`)
1. `/` → `WorkflowManager` (default)
2. `/builder` → `WorkflowManager`
3. `/dashboard` → `Dashboard`
4. `/pricing` → `Pricing`
5. `/login` → `Login`
6. `/signup` → `SignUp`
7. `/game-engine` → `GameEngine`

---

## Services & APIs

### Image Generation APIs
1. **ClipDrop** (`clipdrop.ts`)
   - Text-to-image
   - 4-view generation
   - Image-to-image
   - Used for: `koye-2dv1` model

2. **Pixazo** (`pixazo.ts`)
   - Text-to-image (Seedream 3.0)
   - Used for: `koye-2dv1.5` model
   - API fallback support

3. **Banana** (`banana.ts`)
   - Text-to-image
   - Used for: `koye-2dv2` model
   - API fallback support

4. **KIE** (`kie.ts`)
   - Text-to-image
   - API fallback support

5. **DeAPI** (`deapi.ts`)
   - Text-to-image
   - API fallback support

### 3D Model APIs
1. **Hitem3D** (`hitem3d.ts`)
   - Image-to-3D model generation
   - Job status polling
   - Model download
   - **Status**: Connected ✅

2. **Meshy** (`meshy.ts`)
   - Rigging tasks
   - Task status polling
   - **Status**: Partially Connected ⚠️ (Service exists, UI integration incomplete)

### Video Generation APIs
1. **Veo 3.1** (`veo3.ts`)
   - Video generation from text + images
   - Status polling
   - **Status**: Connected ✅

2. **Video Generation Service** (`videoGeneration.ts`)
   - Alternative video generation API
   - Prediction-based generation
   - **Status**: Connected ✅ (Used in WorkflowManager for cutscenes)

### Audio Generation APIs
1. **RapidAPI ElevenLabs** (`rapidElevenLabs.ts`)
   - Sound effects generation
   - **Status**: Connected ✅

### LLM Services
1. **Gemini** (`gemini.ts`)
   - `sendMessageToGemini`: Standard chat
   - `sendMessageToGeminiStream`: Streaming responses
   - `sendMessageToGeminiWithThinking`: Thinking mode
   - `generateImagePrompt`: Prompt enhancement
   - `generateImageFromImage`: Image-to-image
   - **Status**: Connected ✅

### Data Services
1. **Multi-Database Manager** (`multiDbManager.ts`)
   - Manages multiple Supabase databases (db1, db2, etc.)
   - Automatic database switching
   - Active database tracking
   - **Status**: Connected ✅

2. **Multi-Database Data Service** (`multiDbDataService.ts`)
   - `saveChatSession` / `getUserChatSessions` / `updateChatSession` / `deleteChatSession`
   - `saveImage` / `getUserImages` / `deleteImage`
   - `saveModel` / `getUserModels` / `deleteModel`
   - `saveVideo` / `getUserVideos` / `deleteVideo`
   - `saveAudio` / `getUserAudio` / `deleteAudio`
   - `saveJob` / `getUserJobs` / `updateJob`
   - **Status**: Connected ✅

3. **Supabase Service** (`supabase.ts`)
   - Authentication (signUp, signIn, signOut)
   - Project management (createProject, getProjects)
   - Asset management (createAsset, updateAsset, getAssets)
   - File uploads (main DB and data DB)
   - **Status**: Connected ✅

### Payment Services
1. **Razorpay** (`razorpay.ts`)
   - Order creation
   - Payment checkout
   - Signature verification
   - **Status**: Connected ✅

2. **Pricing Service** (`pricingService.ts`)
   - Plan management
   - Subscription management
   - Usage tracking
   - Limit checking
   - **Status**: Connected ✅

### GitHub Integration
1. **GitHub Service** (`github.ts`)
   - OAuth flow
   - Repository management
   - File operations (create, update, read)
   - **Status**: Partially Connected ⚠️ (OAuth setup exists, full integration incomplete)

### Other Services
1. **Chat Title Generator** (`chatTitleGenerator.ts`)
   - Auto-generates chat session titles
   - **Status**: Connected ✅

2. **Image Generation Helpers** (`imageGenerationHelpers.ts`)
   - `generateImageWithModel`: Unified image generation
   - `generateSampleImages`: 2D sample generation
   - `generateSprites`: Sprite sheet generation
   - `generate3DViews`: 3D view generation
   - **Status**: Connected ✅

---

## Data Architecture

### Database Structure

#### Main Database (Supabase)
- **Purpose**: Authentication, user profiles, subscriptions, projects, assets
- **Tables**:
  - `auth.users` (Supabase built-in)
  - `profiles`
  - `subscriptions`
  - `projects`
  - `assets`
- **Storage Buckets**: None (moved to data databases)

#### Data Databases (db1, db2, db3, ...)
- **Purpose**: User-generated content (scalable, sharded)
- **Tables**:
  - `chat_sessions`
  - `images`
  - `models`
  - `videos`
  - `audio`
  - `jobs`
- **Storage Buckets**:
  - `images` (for image files)
  - `models` (for 3D model files)
  - `videos` (for video files)
  - `audio` (for audio files)

### Data Flow
1. **User Authentication** → Main DB
2. **User Content Creation** → Active Data DB (db1, db2, etc.)
3. **File Uploads** → Active Data DB Storage Buckets
4. **Content Retrieval** → Queries across all data DBs via `MultiDbManager`

---

## Feature Connections & Flow

### ✅ Connected Features

#### 1. Chat → Image Generation Flow
```
User Chat (Gemini)
  ↓
AI detects game type (2D/3D)
  ↓
AI asks clarifying questions
  ↓
AI triggers image generation (explicit phrases)
  ↓
WorkflowManager.handleGenerate3DImages() OR handleGenerate2DSamples()
  ↓
Image Generation API (ClipDrop/Pixazo/Banana)
  ↓
Images displayed in chat
  ↓
Images saved to data database
  ↓
Images appear in Dashboard
```

#### 2. Image → 3D Model Flow
```
4-view images generated
  ↓
User approves all 4 views
  ↓
WorkflowManager.handleGenerateModel()
  ↓
Hitem3D API call
  ↓
Job polling for completion
  ↓
3D Model generated
  ↓
Model saved to data database
  ↓
Model appears in Dashboard
```

#### 3. Image → Video (Cutscene) Flow
```
Images generated in chat
  ↓
AI detects cutscene request
  ↓
WorkflowManager.handleGenerateVideo()
  ↓
Video Generation API (Veo 3.1 or videoGeneration service)
  ↓
Video displayed in chat
  ↓
Video saved to data database
  ↓
Video appears in Dashboard
```

#### 4. Standalone Generation Flows
```
Image Generation Page
  ↓
User selects model & enters prompt
  ↓
Image generated
  ↓
Image saved to data database
  ↓
Image appears in Dashboard

Video Generation Page
  ↓
User configures settings & enters prompt
  ↓
Video generated
  ↓
Video saved to data database
  ↓
Video appears in Dashboard

Audio Generation Page
  ↓
User enters prompt & configures settings
  ↓
Audio generated
  ↓
Audio saved to data database
  ↓
Audio appears in Dashboard
```

#### 5. 2D Game Sprite Flow
```
Chat detects 2D game
  ↓
AI asks: static or animated?
  ↓
If animated:
  ↓
Sample images generated (2-5)
  ↓
User selects image (types number)
  ↓
AI asks for animation description
  ↓
User describes animation
  ↓
Sprite count options shown (5, 11, 22, 44)
  ↓
User selects count
  ↓
Sprites generated
  ↓
SpritesPlayer displays animation
```

#### 6. Dashboard → Asset Management
```
Dashboard loads
  ↓
Queries all data databases for user assets
  ↓
Displays images, models, videos, audio
  ↓
User can delete assets
  ↓
Deletion updates data database
```

#### 7. Authentication & Subscription Flow
```
User signs up/logs in
  ↓
Authentication via Supabase
  ↓
User subscription checked
  ↓
Plan limits applied
  ↓
Usage tracked per feature
```

---

## Disconnected Features

### ⚠️ Partially Connected

1. **Game Engine** (`GameEngine.tsx`)
   - **Status**: UI exists, Babylon.js integrated
   - **Missing**: 
     - Connection to generated assets from Dashboard
     - Project loading from database
     - Asset import functionality
   - **Action Needed**: Connect to `multiDbDataService` to load user assets

2. **Meshy Rigging Service** (`meshy.ts`)
   - **Status**: Service implemented
   - **Missing**: 
     - UI integration in WorkflowManager
     - Rigging stage implementation
     - Connection to 3D model workflow
   - **Action Needed**: Add rigging stage to workflow

3. **GitHub Integration** (`github.ts`)
   - **Status**: OAuth and API functions exist
   - **Missing**: 
     - UI for connecting GitHub account
     - Export to GitHub functionality
     - Repository creation from projects
   - **Action Needed**: Add GitHub connection UI and export features

4. **Texture Generation**
   - **Status**: Stage exists in workflow
   - **Missing**: 
     - Actual texture generation implementation
     - API integration
     - UI for texture editing
   - **Action Needed**: Implement texture generation API and UI

5. **Animation Generation**
   - **Status**: Stage exists in workflow
   - **Missing**: 
     - Animation generation implementation
     - API integration
     - Animation preview
   - **Action Needed**: Implement animation generation

6. **Export Functionality**
   - **Status**: Basic export exists for 3D models
   - **Missing**: 
     - Export to GitHub
     - Export to project
     - Batch export
   - **Action Needed**: Enhance export features

7. **Voice Chat** (`VoiceChatLayout.tsx`)
   - **Status**: UI component exists
   - **Missing**: 
     - Voice input/output integration
     - Speech-to-text
     - Text-to-speech
   - **Action Needed**: Integrate voice APIs

8. **Social Links** (Dashboard)
   - **Status**: UI exists (Twitter, LinkedIn, YouTube)
   - **Missing**: 
     - Actual links/functionality
     - Social sharing features
   - **Action Needed**: Add actual links or remove UI

---

## Future/Planned Features

### Not Yet Implemented

1. **Texture Generation**
   - Full implementation needed
   - API integration required
   - Texture editing UI

2. **Rigging Pipeline**
   - Meshy integration in workflow
   - Rigging UI
   - Bone structure visualization

3. **Animation System**
   - Animation generation
   - Animation preview
   - Animation export

4. **Build/Export System**
   - Complete game export
   - Project packaging
   - Asset bundling

5. **GitHub Export**
   - Connect GitHub account
   - Export projects to repositories
   - Version control integration

6. **Team Collaboration**
   - Team member management
   - Shared projects
   - Permissions system

7. **API Access**
   - API key generation
   - API documentation
   - Rate limiting

8. **Advanced Features**
   - Private endpoints
   - SLA guarantees
   - Commercial licensing management

---

## Feature Dependency Map

```
Authentication
  ├── Dashboard (requires auth)
  ├── WorkflowManager (optional auth)
  ├── Pricing (public)
  └── Game Engine (requires auth)

Chat Interface
  ├── Image Generation (auto-triggered)
  ├── Video Generation (auto-triggered)
  ├── 3D Model Generation (manual)
  └── Audio Generation (manual)

Image Generation
  ├── 3D Model Generation (uses 4-view images)
  ├── Video Generation (uses images as frames)
  └── Dashboard (displays all images)

3D Model Generation
  ├── Texture Generation (planned)
  ├── Rigging (planned)
  ├── Animation (planned)
  └── Export (partial)

Video Generation
  ├── Dashboard (displays videos)
  └── Chat (displays in messages)

Audio Generation
  ├── Dashboard (displays audio)
  └── Game Engine (planned integration)

Dashboard
  ├── Asset Management (all asset types)
  ├── Projects (main DB)
  └── GitHub (planned)

Multi-Database System
  ├── All user content storage
  ├── Automatic scaling
  └── Cross-database queries
```

---

## API Fallback System

The application implements a robust API fallback system for critical services:

### Supported Services
- **Gemini API**: `VITE_GEMINI_API_KEY`, `VITE_GEMINI_API_KEY1`, etc.
- **Pixazo API**: `VITE_PIXAZO_API_KEY`, `VITE_PIXAZO_API_KEY1`, etc.
- **RapidAPI**: `VITE_RAPIDAPI_KEY`, `VITE_RAPIDAPI_KEY1`, etc.

### Implementation
- `lib/apiFallback.ts`: Provides `getApiKeys()` and `withApiFallback()` utilities
- Automatically retries with next key on failure
- Logs failures for monitoring

---

## Summary

### ✅ Fully Connected & Working
- Chat Interface with Gemini
- Image Generation (multiple APIs)
- 3D Model Generation
- Video Generation
- Audio Generation
- Dashboard (asset management)
- Authentication & Subscriptions
- Multi-database data storage
- Pricing & Payments

### ⚠️ Partially Connected
- Game Engine (UI exists, needs asset integration)
- Meshy Rigging (service exists, needs UI)
- GitHub Integration (OAuth exists, needs export features)
- Texture Generation (stage exists, needs implementation)
- Animation Generation (stage exists, needs implementation)

### ❌ Not Yet Implemented
- Complete texture generation pipeline
- Full rigging workflow
- Animation system
- Build/export system
- Team collaboration
- API access for users
- Voice chat functionality

---

**Last Updated**: Based on current codebase analysis
**Version**: 1.0

