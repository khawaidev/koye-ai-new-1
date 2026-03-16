# Environment Variables Setup Guide

This document explains how to set up all the required environment variables for GameForge AI.

## Quick Start

1. Copy `.env.example` to `.env`:
   ```bash
   cp .env.example .env
   ```

2. Fill in your API keys in the `.env` file

3. Restart your dev server

## Required API Keys

### 1. Google Gemini API Key (Required)

**Purpose**: Powers the chat interface and generates image prompts

**How to get it**:
1. Go to [Google AI Studio](https://makersuite.google.com/app/apikey)
2. Sign in with your Google account
3. Click "Create API Key"
4. Copy the key and paste it into `.env` as `VITE_GEMINI_API_KEY`

**Note**: The app uses Gemini 2.5 Flash model

---

### 2. ClipDrop API Key (Required)

**Purpose**: Generates 4-view concept art images from text prompts

**How to get it**:
1. Go to [ClipDrop API](https://clipdrop.co/api)
2. Sign up for an account
3. Navigate to API section
4. Generate an API key
5. Copy the key and paste it into `.env` as `VITE_CLIPDROP_API_KEY`

**Pricing**: Check ClipDrop's pricing page for current rates

---

### 3. Hitem3D API Credentials (Required)

**Purpose**: Converts 4-view images into 3D models

**How to get it**:
1. Go to [Hitem3D Developer Platform](https://platform.hitem3d.ai)
2. Sign up or log in with your email
3. Purchase a resource package (trial packages available for testing)
4. Go to [API Key page](https://platform.hitem3d.ai/console/apiKey)
5. Click "Create Key" and enter a name
6. Copy both the **AccessKey** and **SecretKey** (they're only shown once!)
7. Paste them into `.env` as:
   - `VITE_HITEM3D_ACCESS_KEY`
   - `VITE_HITEM3D_SECRET_KEY`

**Important Notes**:
- API endpoint: `https://api.hitem3d.ai`
- You need BOTH AccessKey and SecretKey (not just one)
- Keys are only displayed once when created - save them immediately
- Maximum of 10 keys per account
- Keys can be enabled/disabled in the console

**Documentation**: [Hitem3D API Docs](https://docs.hitem3d.ai/en/api/getting-started/quickstart)

---

## Optional Configuration

### 4. Supabase (Optional - for database/storage)

**Purpose**: Stores projects, assets, images, and models. Also provides authentication.

**How to set it up**:
1. Go to [Supabase](https://supabase.com)
2. Create a new project
3. Go to Settings > API
4. Copy your:
   - **Project URL** → `VITE_SUPABASE_URL`
   - **anon/public key** → `VITE_SUPABASE_ANON_KEY`
5. Run the SQL schema from `supabase-schema.sql` in the SQL Editor

**Note**: The app will work without Supabase, but you won't be able to save projects or assets.

---

### 5. Backend Server URL (Optional)

**Purpose**: For job queue management and WebSocket updates

**Default**: `http://localhost:3001`

**When to change**: Only if you're running the backend server on a different port or URL

---

## Example .env File

```env
# Required
VITE_GEMINI_API_KEY=AIzaSyAbc123xyz...
VITE_CLIPDROP_API_KEY=sk-abc123xyz...
VITE_HITEM3D_ACCESS_KEY=your_access_key_here
VITE_HITEM3D_SECRET_KEY=your_secret_key_here

# Optional
VITE_SUPABASE_URL=https://abcdefgh.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
VITE_BACKEND_URL=http://localhost:3001
```

## Security Notes

⚠️ **Important**:
- Never commit your `.env` file to version control
- The `.env` file is already in `.gitignore`
- API keys starting with `VITE_` are exposed to the browser (this is normal for Vite)
- For production, use environment variables on your hosting platform (Vercel, Render, etc.)
- Hitem3D keys should be kept secure - rotate them regularly

## Testing Without All Keys

You can test the app with just the Gemini API key to see the chat interface. Other features will show errors until you add the respective API keys.

## Troubleshooting

**"API key not found" errors**:
- Make sure your `.env` file is in the `my-app` directory (not the root)
- Restart your dev server after adding/changing environment variables
- Check that variable names start with `VITE_`
- Verify there are no extra spaces or quotes around the values

**"Failed to load" errors**:
- Check your API keys are valid and active
- Verify you have sufficient API credits/quota
- Check the browser console for detailed error messages
- For Hitem3D: Make sure both AccessKey AND SecretKey are set

**Hitem3D specific issues**:
- Verify your resource package has available credits
- Check that your API key is in "Enabled" status in the console
- Ensure you're using the correct endpoint: `https://api.hitem3d.ai`
- Check the [official documentation](https://docs.hitem3d.ai) for API endpoint paths
