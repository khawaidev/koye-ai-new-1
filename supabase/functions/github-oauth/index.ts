// Supabase Edge Function for GitHub OAuth Token Exchange
// Deploy this to Supabase Edge Functions
//
// To deploy:
// 1. Install Supabase CLI: npm install -g supabase
// 2. Login: supabase login
// 3. Link project: supabase link --project-ref YOUR_PROJECT_REF
// 4. Deploy: supabase functions deploy github-oauth
//
// Then update your frontend to call this function

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const GITHUB_CLIENT_ID = Deno.env.get('GITHUB_CLIENT_ID') || ''
const GITHUB_CLIENT_SECRET = Deno.env.get('GITHUB_CLIENT_SECRET') || ''

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req: Request) => {
    // Handle CORS preflight request
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    try {
        const { code } = await req.json()

        if (!code) {
            return new Response(
                JSON.stringify({ error: 'Missing authorization code' }),
                { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }

        if (!GITHUB_CLIENT_ID || !GITHUB_CLIENT_SECRET) {
            console.error('Missing GitHub credentials in environment')
            return new Response(
                JSON.stringify({ error: 'GitHub OAuth not configured' }),
                { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }

        // Exchange code for access token
        const tokenResponse = await fetch('https://github.com/login/oauth/access_token', {
            method: 'POST',
            headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                client_id: GITHUB_CLIENT_ID,
                client_secret: GITHUB_CLIENT_SECRET,
                code: code,
            }),
        })

        const tokenData = await tokenResponse.json()

        if (tokenData.error) {
            console.error('GitHub OAuth error:', tokenData)
            return new Response(
                JSON.stringify({
                    error: tokenData.error_description || tokenData.error,
                    details: tokenData
                }),
                { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }

        // Get user info to validate token works
        const userResponse = await fetch('https://api.github.com/user', {
            headers: {
                'Authorization': `token ${tokenData.access_token}`,
                'Accept': 'application/vnd.github.v3+json',
            },
        })

        if (!userResponse.ok) {
            return new Response(
                JSON.stringify({ error: 'Failed to validate token with GitHub' }),
                { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }

        const userData = await userResponse.json()

        return new Response(
            JSON.stringify({
                access_token: tokenData.access_token,
                token_type: tokenData.token_type,
                scope: tokenData.scope,
                user: {
                    id: userData.id,
                    login: userData.login,
                    name: userData.name,
                    avatar_url: userData.avatar_url,
                }
            }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
    } catch (error) {
        console.error('Error in github-oauth function:', error)
        return new Response(
            JSON.stringify({ error: 'Internal server error' }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
    }
})
