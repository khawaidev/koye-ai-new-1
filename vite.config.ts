import react from '@vitejs/plugin-react'
import path from 'path'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
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
      // Proxy HyperReal API requests to bypass CORS
      '/api/hyperreal': {
        target: 'https://api.hypereal.tech',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/hyperreal/, ''),
        secure: true,
      },
      // Proxy R2 asset requests to bypass CORS
      '/api/r2-proxy': {
        target: 'https://pub-d259d1d2737843cb8bcb2b1ff98fc9c6.r2.dev',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/r2-proxy/, ''),
        secure: true,
      }
    }
  }
})
