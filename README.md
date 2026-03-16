# GameForge AI (Koye)

An AI-native game development workspace where developers and designers can create complete 3D game assets through natural conversation with AI.

## Features

- 🤖 **AI Chat Interface** - Powered by Gemini 2.5 Flash for game asset design conversations
- 🎨 **Text-to-Image Generation** - Generate 4-view orthographic images using ClipDrop API
- 🎯 **Image-to-3D Model** - Convert images to 3D models using Hitem3D API
- 👁️ **3D Viewer** - Interactive 3D model viewer with three.js
- 🎨 **Texture Generation** - AI-powered texture generation
- 🦴 **Auto-Rigging** - Automatic rigging for characters and props
- 📦 **Export** - Export models in GLB, FBX, and OBJ formats

## Tech Stack

- **Frontend**: React 18 + Vite + TypeScript
- **Styling**: Tailwind CSS + Shadcn UI
- **3D Rendering**: Three.js + React Three Fiber
- **State Management**: Zustand
- **APIs**: 
  - Google Gemini 2.5 Flash
  - ClipDrop API
  - Hitem3D API
- **Backend**: Supabase (Auth, Database, Storage)

## Setup

1. **Install dependencies**:
   ```bash
   npm install
   ```

2. **Configure environment variables**:
   Create a `.env` file in the root directory:
   ```env
   VITE_GEMINI_API_KEY=your_gemini_api_key_here
   VITE_CLIPDROP_API_KEY=your_clipdrop_api_key_here
   VITE_HITEM3D_API_KEY=your_hitem3d_api_key_here
   VITE_SUPABASE_URL=your_supabase_url_here
   VITE_SUPABASE_ANON_KEY=your_supabase_anon_key_here
   ```

3. **Run the development server**:
   ```bash
   npm run dev
   ```

4. **Build for production**:
   ```bash
   npm run build
   ```

## Project Structure

```
src/
├── components/
│   ├── chat/          # Chat interface components
│   ├── image-viewer/   # Image review viewer
│   ├── model-viewer/   # 3D model viewer
│   ├── workflow/       # Workflow management
│   └── ui/             # Reusable UI components
├── services/           # API service integrations
├── store/              # Zustand state management
├── types/              # TypeScript type definitions
└── lib/                # Utility functions
```

## Workflow

1. **Chat** - Describe your game asset to the AI
2. **Images** - Review and approve 4-view concept images
3. **3D Model** - Generate and view the 3D model
4. **Texture** - Apply textures to the model
5. **Rig** - Auto-rig the model for animation
6. **Export** - Download the final asset

## API Keys

You'll need API keys from:
- [Google AI Studio](https://makersuite.google.com/app/apikey) - For Gemini
- [ClipDrop](https://clipdrop.co/api) - For image generation
- [Hitem3D](https://hitem3d.com) - For 3D model generation
- [Supabase](https://supabase.com) - For backend services

## License

MIT
