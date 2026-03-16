const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');
const puppeteer = require('puppeteer');

const port = process.env.PORT || 3000;

async function serveIndex(res) {
    const filePath = path.join(__dirname, 'index.html');
    fs.readFile(filePath, (err, data) => {
        if (err) {
            res.writeHead(500, { 'Content-Type': 'text/plain' });
            res.end('Internal Server Error');
            return;
        }
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(data);
    });
}


async function generateImageFromIndex(model, prompt) {
    const browser = await puppeteer.launch({
        headless: false,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    const page = await browser.newPage();
    try {
        const targetUrl = `http://localhost:${port}/render?model=${encodeURIComponent(model)}&prompt=${encodeURIComponent(prompt)}`;

        await page.goto(targetUrl, { waitUntil: 'networkidle0', timeout: 120000 });

        await page.waitForFunction(
            () => {
                const text = document.body?.innerText?.trim() || '';
                return text.startsWith('{') && text.endsWith('}');
            },
            { timeout: 120000 }
        );

        const payloadText = await page.evaluate(() => document.body.innerText);
        const payload = JSON.parse(payloadText);

        if (!payload.success) {
            throw new Error(payload.error || 'Image generation failed');
        }

        return payload;
    } finally {
        await page.close();
        await browser.close();
    }
}

const server = http.createServer(async (req, res) => {
    // Parse the URL
    const parsedUrl = url.parse(req.url, true);
    const { pathname, query } = parsedUrl;
    
    // Set CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    
    // Handle preflight requests
    if (req.method === 'OPTIONS') {
        res.writeHead(200);
        res.end();
        return;
    }
    
    // Dedicated render route so Puppeteer can access index.html over HTTP
    if (req.method === 'GET' && pathname === '/render') {
        await serveIndex(res);
        return;
    }

    // Serve API requests
    if (req.method === 'GET' && query.model) {
        const prompt = query.prompt || 'A futuristic city with flying cars and neon lights';
        const model = query.model;

        try {
            const payload = await generateImageFromIndex(model, prompt);
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(payload));
        } catch (error) {
            console.error('Image generation failed:', error);
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                success: false,
                error: error.message || 'Failed to generate image',
                model,
                prompt
            }));
        }
    } else {
        // Serve regular HTML page for documentation
        await serveIndex(res);
    }
});

server.listen(port, () => {
    console.log(`AI Image Generator API running on port ${port}`);
    console.log(`Access via: http://localhost:${port}/?model=dall-e-3&prompt=your-prompt`);
});