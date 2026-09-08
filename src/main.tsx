import React from 'react'
import { createRoot } from 'react-dom/client'
import '@/styles/tokens.css'
import '@/styles/base.css'
import '@/styles/app.css'
import '@/parts' // registers the catalog
import { App } from '@/app/App'
import { useDoc } from '@/state/doc'
import { useSim } from '@/state/sim'
import { engine } from '@/sim/engine'

/**
 * Expose the stores for tooling. The screenshot and regression harness in
 * tools/ drives the app through this rather than through fragile UI clicks.
 */
declare global {
  interface Window {
    buildsim: { doc: typeof useDoc; sim: typeof useSim; engine: typeof engine }
  }
}
window.buildsim = { doc: useDoc, sim: useSim, engine }

const el = document.getElementById('root')
if (!el) throw new Error('#root is missing from index.html')

createRoot(el).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
