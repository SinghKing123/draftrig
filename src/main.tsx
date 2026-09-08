import React from 'react'
import { createRoot } from 'react-dom/client'
import '@/styles/tokens.css'
import '@/styles/base.css'
import '@/styles/app.css'
import '@/parts' // registers the catalog
import { App } from '@/app/App'

const el = document.getElementById('root')
if (!el) throw new Error('#root is missing from index.html')

createRoot(el).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
