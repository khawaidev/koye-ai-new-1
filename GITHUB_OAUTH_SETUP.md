# GitHub OAuth Setup

## Required Environment Variables

Add these to your `.env` file:

```env
# GitHub OAuth App credentials
VITE_GITHUB_CLIENT_ID=your_github_client_id
VITE_GITHUB_CLIENT_SECRET=your_github_client_secret

# Optional: Custom OAuth API URL (defaults to local server)
# VITE_GITHUB_OAUTH_API_URL=http://localhost:3001/api/github-oauth
```

## Getting GitHub OAuth Credentials

1. Go to **GitHub → Settings → Developer settings → OAuth Apps**
2. Click **"New OAuth App"**
3. Fill in the details:
   - **Application name**: KOYE (or your app name)
   - **Homepage URL**: `http://localhost:5173`
   - **Authorization callback URL**: `http://localhost:5173/dashboard`
4. Click **"Register application"**
5. Copy the **Client ID**
6. Click **"Generate a new client secret"** and copy the **Client Secret**
7. Add both to your `.env` file

## Running the OAuth Server

The OAuth token exchange requires a backend server because GitHub needs your client secret, which cannot be exposed in the frontend.

### For Local Development

1. Install dependencies:
   ```bash
   npm install
   ```

2. Start the OAuth server (in one terminal):
   ```bash
   npm run oauth-server
   ```

3. Start the dev server (in another terminal):
   ```bash
   npm run dev
   ```

4. Now when you connect GitHub in the app, the OAuth code will be exchanged for a real access token.

### For Production

For production, you have several options:

1. **Supabase Edge Function**: Deploy the function in `supabase/functions/github-oauth/`
2. **Vercel/Netlify Serverless Function**: Create an API route
3. **Your own backend**: Add an endpoint that handles the token exchange

Set `VITE_GITHUB_OAUTH_API_URL` in your production environment to point to your token exchange endpoint.

## Testing the Setup

1. Click "Connect GitHub" in the dashboard
2. Authorize the app on GitHub
3. You should be redirected back and see the connection confirmed
4. Check the browser console for:
   ```
   ✓ OAuth token exchange successful: { user: 'your-github-username' }
   ✓ GitHub connection saved to localStorage
   ✓ GitHub connection set in store
   ```

## Troubleshooting

- **"Missing authorization code"**: The OAuth callback didn't include a code
- **"bad_verification_code"**: The OAuth code expired (they expire in 10 minutes)
- **CORS error**: Make sure the OAuth server is running on port 3001
- **Connection refused**: Start the OAuth server with `npm run oauth-server`
