import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: 'dist',
    sourcemap: false
  },
  server: {
    port: 5173,
    proxy: {
      // In local dev: forward /api calls to our simple local server
      '/api': {
        target: 'http://localhost:9999',
        changeOrigin: true
      }
    }
  }
})
