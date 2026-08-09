import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    host: '127.0.0.1',
    port: 5173,
    // Lab tab inference backend (apps/api/lab_server.py on :8077)
    proxy: {
      '/api/lab': {
        target: 'http://127.0.0.1:8077',
        changeOrigin: true,
      },
    },
  },
})
