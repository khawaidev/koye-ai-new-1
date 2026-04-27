import react from '@vitejs/plugin-react'
import path from 'path'
import { defineConfig } from 'vite'
import https from 'https'
import http from 'http'

// Simple vite plugin to proxy external images (bypasses CORS)
const imageProxyPlugin = () => ({
  name: 'image-proxy',
  configureServer(server: any) {
    server.middlewares.use('/api/image-proxy', (req: any, res: any) => {
      const urlObj = new URL(req.url!, `http://${req.headers.host}`)
      const targetUrl = urlObj.searchParams.get('url')
      
      if (!targetUrl) {
        res.statusCode = 400
        res.end('Missing ?url= parameter')
        return
      }

      const mod = targetUrl.startsWith('https') ? https : http
      
      const imgReq = mod.get(targetUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Accept': 'image/*,*/*',
          'Referer': new URL(targetUrl).origin,
        }
      }, (imgRes: any) => {
        // Handle redirects
        if (imgRes.statusCode >= 300 && imgRes.statusCode < 400 && imgRes.headers.location) {
          const redirectUrl = imgRes.headers.location
          const redirectMod = redirectUrl.startsWith('https') ? https : http
          
          redirectMod.get(redirectUrl, {
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
              'Accept': 'image/*,*/*',
            }
          }, (redirectRes: any) => {
            res.writeHead(redirectRes.statusCode || 200, {
              'Content-Type': redirectRes.headers['content-type'] || 'image/png',
              'Access-Control-Allow-Origin': '*',
              'Cache-Control': 'public, max-age=3600',
            })
            redirectRes.pipe(res)
          }).on('error', (err: any) => {
            res.statusCode = 502
            res.end('Redirect fetch failed: ' + err.message)
          })
          return
        }

        // Return image
        res.writeHead(imgRes.statusCode || 200, {
          'Content-Type': imgRes.headers['content-type'] || 'image/png',
          'Access-Control-Allow-Origin': '*',
          'Cache-Control': 'public, max-age=3600',
        })
        imgRes.pipe(res)
      })
      
      imgReq.on('error', (err: any) => {
        res.statusCode = 502
        res.end('Image fetch failed: ' + err.message)
      })
    })
  }
})

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), imageProxyPlugin()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  optimizeDeps: {
    exclude: ['three']
  },
  server: {
    proxy: {
      // Proxy LightX API requests to bypass CORS
      '/api/lightx': {
        target: 'https://api.lightxeditor.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/lightx/, ''),
        secure: true,
      },
      // Proxy HyperReal Cloud API requests (Chat + 3D Generation) to bypass CORS
      // IMPORTANT: This MUST come BEFORE /api/hyperreal to avoid prefix collision!
      '/api/hyperreal-cloud': {
        target: 'https://api.hypereal.cloud',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/hyperreal-cloud/, ''),
        secure: true,
      },
      // Proxy HyperReal API requests (Image generation) to bypass CORS
      '/api/hyperreal': {
        target: 'https://api.hypereal.tech',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/hyperreal/, ''),
        secure: true,
      },
      // Proxy R2 asset requests to bypass CORS
      '/api/r2-proxy': {
        target: 'https://8ec3d9b289a9176a49da1c0706446665.r2.cloudflarestorage.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/r2-proxy/, ''),
        secure: true,
      }
    }
  }
})