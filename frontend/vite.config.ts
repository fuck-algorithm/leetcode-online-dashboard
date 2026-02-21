import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Simple SPA fallback middleware (works for both dev and preview)
const spaFallback = () => ({
  name: 'spa-fallback',
  configureServer(server: any) {
    server.middlewares.use((req: any, res: any, next: any) => {
      const url = req.url || ''
      // Skip API paths only - these should be proxied to backend
      if (url === '/api' || url.startsWith('/api/') || 
          url.startsWith('/ws') || 
          url.startsWith('/@') ||
          url.startsWith('/node_modules')) {
        return next()
      }
      // All other paths (including /api-docs) rewrite to root for SPA routing
      if (req.method === 'GET' && !url.match(/\.[^/]+$/)) {
        req.url = '/'
      }
      next()
    })
  },
  configurePreviewServer(server: any) {
    server.middlewares.use((req: any, res: any, next: any) => {
      const url = req.url || ''
      // Skip API paths only in preview mode
      if (url === '/api' || url.startsWith('/api/') || 
          url.startsWith('/ws')) {
        return next()
      }
      // All other paths rewrite to root for SPA routing
      if (req.method === 'GET' && !url.match(/\.[^/]+$/)) {
        req.url = '/'
      }
      next()
    })
  }
})

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react(), spaFallback()],
  server: {
    port: 52107,
    host: '0.0.0.0',
    proxy: {
      '/api': {
        target: 'http://localhost:52106',
        changeOrigin: true,
      },
      '/ws': {
        target: 'ws://localhost:52106',
        ws: true,
      },
    },
  },
  preview: {
    port: 52107,
    host: '0.0.0.0',
    proxy: {
      '/api': {
        target: 'http://localhost:52106',
        changeOrigin: true,
      },
      '/ws': {
        target: 'ws://localhost:52106',
        ws: true,
      },
    },
  },
})
