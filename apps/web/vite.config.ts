import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath, URL } from 'node:url'

// The parameter contract lives at the repo root because three runtimes read the
// same file — this app, the start-training edge function, and the Python
// pipeline. An alias rather than a copy: a copy is what drifts.
const contracts = fileURLToPath(new URL('../../contracts', import.meta.url))

export default defineConfig({
  plugins: [react()],
  resolve: { alias: { '@contracts': contracts } },
  server: {
    host: '127.0.0.1',
    port: 5173,
    fs: { allow: ['..', contracts] },
    // Lab tab inference backend (apps/api/lab_server.py on :8077)
    proxy: {
      '/api/lab': {
        target: 'http://127.0.0.1:8077',
        changeOrigin: true,
      },
    },
  },
})
