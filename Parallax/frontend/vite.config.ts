import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  esbuild: {
    drop: ['console', 'debugger'],
  },
  build: {
    target: 'esnext',
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom', 'react-router-dom', 'framer-motion'],
          aws: ['aws-amplify'],
        },
      },
    },
  },
  server: {
    headers: {
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'require-corp',
    },
    proxy: {
      // Proxy transcript requests through Vite dev server to bypass CORS
      '/api/transcript-proxy/lemnoslife': {
        target: 'https://yt.lemnoslife.com',
        changeOrigin: true,
        rewrite: (path) => path.replace('/api/transcript-proxy/lemnoslife', ''),
        secure: true,
      },
      '/api/transcript-proxy/youtube': {
        target: 'https://www.youtube.com',
        changeOrigin: true,
        rewrite: (path) => path.replace('/api/transcript-proxy/youtube', ''),
        secure: true,
      },
      '/api/transcript-proxy/timedtext': {
        target: 'https://www.youtube.com',
        changeOrigin: true,
        rewrite: (path) => path.replace('/api/transcript-proxy/timedtext', ''),
        secure: true,
      },
    },
  },
})
