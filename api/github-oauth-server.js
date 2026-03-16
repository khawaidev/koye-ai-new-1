/**
 * Local GitHub OAuth Token Exchange Server
 * 
 * Run this alongside your Vite dev server for local development:
 *   npm run oauth-server
 * 
 * This exchanges the GitHub OAuth code for an access token.
 */

import { config } from 'dotenv';
import http from 'http';
import https from 'https';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

// Load environment variables from .env file
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
config({ path: join(__dirname, '..', '.env') });

const PORT = 3001;

// GitHub OAuth credentials from environment
const GITHUB_CLIENT_ID = process.env.VITE_GITHUB_CLIENT_ID;
const GITHUB_CLIENT_SECRET = process.env.VITE_GITHUB_CLIENT_SECRET;

if (!GITHUB_CLIENT_ID || !GITHUB_CLIENT_SECRET) {
    console.error('❌ Missing GitHub OAuth credentials!');
    console.error('Please set VITE_GITHUB_CLIENT_ID and VITE_GITHUB_CLIENT_SECRET in your .env file');
    process.exit(1);
}

function parseBody(req) {
    return new Promise((resolve, reject) => {
        let body = '';
        req.on('data', chunk => body += chunk);
        req.on('end', () => {
            try {
                resolve(JSON.parse(body));
            } catch (e) {
                reject(e);
            }
        });
        req.on('error', reject);
    });
}

function httpsRequest(options, postData) {
    return new Promise((resolve, reject) => {
        const req = https.request(options, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    resolve({ status: res.statusCode, data: JSON.parse(data) });
                } catch (e) {
                    resolve({ status: res.statusCode, data });
                }
            });
        });
        req.on('error', reject);
        if (postData) req.write(postData);
        req.end();
    });
}

const server = http.createServer(async (req, res) => {
    // CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    // Handle preflight
    if (req.method === 'OPTIONS') {
        res.writeHead(204);
        res.end();
        return;
    }

    // Handle POST to /api/github-oauth
    if (req.method === 'POST' && req.url === '/api/github-oauth') {
        try {
            const body = await parseBody(req);
            const { code } = body;

            if (!code) {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'Missing authorization code' }));
                return;
            }

            console.log('Exchanging OAuth code for token...');

            // Exchange code for access token
            const tokenData = JSON.stringify({
                client_id: GITHUB_CLIENT_ID,
                client_secret: GITHUB_CLIENT_SECRET,
                code: code
            });

            const tokenResult = await httpsRequest({
                hostname: 'github.com',
                path: '/login/oauth/access_token',
                method: 'POST',
                headers: {
                    'Accept': 'application/json',
                    'Content-Type': 'application/json',
                    'Content-Length': tokenData.length
                }
            }, tokenData);

            if (tokenResult.data.error) {
                console.error('GitHub OAuth error:', tokenResult.data);
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({
                    error: tokenResult.data.error_description || tokenResult.data.error
                }));
                return;
            }

            const accessToken = tokenResult.data.access_token;
            console.log('✓ Got access token');

            // Get user info
            const userResult = await httpsRequest({
                hostname: 'api.github.com',
                path: '/user',
                method: 'GET',
                headers: {
                    'Authorization': `token ${accessToken}`,
                    'Accept': 'application/vnd.github.v3+json',
                    'User-Agent': 'KOYE-OAuth-Server'
                }
            });

            if (userResult.status !== 200) {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'Failed to validate token' }));
                return;
            }

            console.log('✓ Token validated, user:', userResult.data.login);

            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                access_token: accessToken,
                token_type: tokenResult.data.token_type,
                scope: tokenResult.data.scope,
                user: {
                    id: userResult.data.id,
                    login: userResult.data.login,
                    name: userResult.data.name,
                    avatar_url: userResult.data.avatar_url
                }
            }));

        } catch (error) {
            console.error('Error:', error);
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Internal server error' }));
        }
        return;
    }

    // Handle GET to /api/proxy-image
    if (req.method === 'GET' && req.url.startsWith('/api/proxy-image')) {
        try {
            const parsedUrl = new URL(req.url, `http://${req.headers.host}`);
            const imageUrl = parsedUrl.searchParams.get('url');

            if (!imageUrl) {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'Missing url parameter' }));
                return;
            }

            console.log('Proxying image request for:', imageUrl);

            const targetUrl = new URL(imageUrl);
            const client = targetUrl.protocol === 'https:' ? https : http;

            client.get(imageUrl, (imageRes) => {
                const contentType = imageRes.headers['content-type'];
                res.writeHead(imageRes.statusCode || 200, {
                    'Content-Type': contentType || 'image/png',
                    'Access-Control-Allow-Origin': '*'
                });
                imageRes.pipe(res);
            }).on('error', (err) => {
                console.error('Proxy request error:', err);
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'Failed to proxy image' }));
            });

        } catch (error) {
            console.error('Proxy Error:', error);
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Internal proxy server error' }));
        }
        return;
    }

    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Not found' }));
});

server.listen(PORT, () => {
    console.log(`
╔════════════════════════════════════════════════════════╗
║   GitHub OAuth Token Exchange Server                    ║
║   Running on http://localhost:${PORT}                      ║
║                                                         ║
║   Endpoint: POST http://localhost:${PORT}/api/github-oauth ║
║   Endpoint: GET  http://localhost:${PORT}/api/proxy-image?url= ║
╚════════════════════════════════════════════════════════╝
`);
});
