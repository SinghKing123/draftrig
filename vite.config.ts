import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath, URL } from 'node:url'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  server: { port: 5173 },
  build: {
    rollupOptions: {
      output: {
        // Keep the heavy 3D stack in its own chunks so it caches independently
        // of application code, and never lands on the marketing page.
        manualChunks: {
          three: ['three'],
          postfx: ['postprocessing', '@react-three/postprocessing'],
          r3f: ['@react-three/fiber', '@react-three/drei'],
        },
      },
    },
    chunkSizeWarningLimit: 900,
  },
})
