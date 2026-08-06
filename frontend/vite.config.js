import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const apiTarget = env.VITE_API_TARGET || 'http://localhost:3013'

  return {
    plugins: [react()],
    server: {
      port: Number(env.PORT) || 3012,
      // The API mounts its routes under /api, so forward the path as-is.
      // (The previous config stripped /api here, which meant every proxied
      // request 404'd at the backend.)
      proxy: {
        '/api': { target: apiTarget, changeOrigin: true },
        '/uploads': { target: apiTarget, changeOrigin: true },
        '/health': { target: apiTarget, changeOrigin: true },
      },
    },
    preview: {
      port: Number(env.PORT) || 3012,
      host: true,
    },
    build: {
      outDir: 'dist',
      sourcemap: false,
    },
  }
})
