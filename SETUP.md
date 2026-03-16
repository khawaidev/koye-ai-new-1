# Setup Guide for GameForge AI

## Prerequisites

- Node.js 18+ and npm
- API keys for:
  - Google Gemini 2.5 Flash
  - ClipDrop
  - Hitem3D
  - Supabase (optional, for full backend features)

## Installation Steps

1. **Install dependencies**:
   ```bash
   cd my-app
   npm install
   ```

2. **Set up environment variables**:
   Create a `.env` file in the `my-app` directory:
   ```env
   VITE_GEMINI_API_KEY=your_gemini_api_key
   VITE_CLIPDROP_API_KEY=your_clipdrop_api_key
   VITE_HITEM3D_API_KEY=your_hitem3d_api_key
   VITE_SUPABASE_URL=your_supabase_url
   VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
   VITE_BACKEND_URL=http://localhost:3001
   ```

3. **Set up Supabase** (optional):
   - Create a Supabase project
   - Run the SQL schema from `supabase-schema.sql` in the Supabase SQL editor
   - Create storage buckets: `assets`, `models`, `images`

4. **Start the development server**:
   ```bash
   npm run dev
   ```

5. **Start the backend server** (optional, for job queue):
   ```bash
   cd backend
   npm install
   npm run dev
   ```

## Getting API Keys

### Google Gemini
1. Go to [Google AI Studio](https://makersuite.google.com/app/apikey)
2. Create a new API key
3. Copy and paste into `.env`

### ClipDrop
1. Go to [ClipDrop API](https://clipdrop.co/api)
2. Sign up and get your API key
3. Copy and paste into `.env`

### Hitem3D
1. Go to [Hitem3D](https://hitem3d.com)
2. Sign up for API access
3. Get your API key
4. Copy and paste into `.env`

### Supabase
1. Go to [Supabase](https://supabase.com)
2. Create a new project
3. Go to Settings > API
4. Copy the URL and anon key
5. Paste into `.env`

## Project Structure

```
my-app/
├── src/
│   ├── components/
│   │   ├── chat/          # Chat interface
│   │   ├── image-viewer/   # Image review
│   │   ├── model-viewer/   # 3D viewer
│   │   ├── workflow/       # Workflow manager
│   │   └── ui/             # UI components
│   ├── services/           # API integrations
│   ├── store/              # State management
│   ├── types/              # TypeScript types
│   └── lib/                # Utilities
├── backend/                # Backend server (optional)
├── supabase-schema.sql     # Database schema
└── .env                    # Environment variables
```

## Usage

1. Start the app and navigate to the chat interface
2. Describe your game asset to the AI
3. When ready, the AI will generate a prompt for image generation
4. Review and approve the 4-view images
5. Generate the 3D model
6. View and export your model

## Troubleshooting

- **API errors**: Check that all API keys are correctly set in `.env`
- **Model loading issues**: Ensure the model URL is accessible (CORS)
- **Build errors**: Run `npm install` again to ensure all dependencies are installed

