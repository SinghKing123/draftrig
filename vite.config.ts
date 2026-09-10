import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath, URL } from 'node:url'

/**
 * Packages that pull three.js in behind them.
 *
 * Any one of these landing in the shared vendor chunk puts a static import of
 * three.js on the eager path, and Vite then preloads the whole 3D engine on
 * the marketing page. The list is everything in node_modules that declares
 * three as a dependency; `npm run check:weight` fails the build if a new one
 * appears and is missed.
 */
const THREE_ECOSYSTEM =
  /node_modules\/(@react-three\/|@react-spring\/three|@monogrid\/gainmap-js|camera-controls|detect-gpu|maath|meshline|n8ao|stats-gl|three-mesh-bvh|three-stdlib|troika-three)/

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  server: { port: 5173 },
  build: {
    rollupOptions: {
      output: {
        /*
         * Everything that is not the 3D stack goes in one shared vendor chunk.
         *
         * The rule that matters is the last one. Naming only the heavy chunks
         * and leaving the rest to Rollup let it fold shared dependencies into
         * them: React and zustand both ended up inside the react-three chunk,
         * because react-three-fiber uses them too. The entry then had to import
         * that chunk simply to get zustand, Vite wrote a modulepreload for it
         * and its dependencies into index.html, and every visitor to the
         * landing page downloaded three.js, about a megabyte of 3D engine, to
         * read a marketing page.
         *
         * Sending everything shared to `vendor` means the 3D chunks are
         * reachable only from the editor's dynamic import, which is the whole
         * point of splitting them out. If this ever regresses, the tell is a
         * modulepreload for three in dist/index.html.
         */
        manualChunks(id: string) {
          const path = id.replace(/\\/g, '/')
          // Vite's own dynamic-import helper. It is a virtual module, so it
          // matches none of the rules below and Rollup parked it in the
          // react-three chunk, which the entry then had to import to be able
          // to lazy-load anything at all.
          if (path.includes('vite/preload-helper')) return 'vendor'
          if (!path.includes('node_modules')) return undefined
          if (path.includes('node_modules/three/')) return 'three'
          if (path.includes('postprocessing')) return 'postfx'
          if (THREE_ECOSYSTEM.test(path)) return 'r3f'
          return 'vendor'
        },
      },
    },
    chunkSizeWarningLimit: 900,
  },
})
