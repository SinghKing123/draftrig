import { chromium } from 'playwright'
const base = process.env.BASE ?? 'http://localhost:4173'
const b = await chromium.launch({ channel: 'msedge' })
const page = await b.newPage({ viewport: { width: 900, height: 600 } })
await page.goto(base + '/app', { waitUntil: 'networkidle' })
await page.evaluate(() => localStorage.setItem('tour.seen.v1', '1'))
await page.reload({ waitUntil: 'networkidle' })
await page.waitForTimeout(2200)
await page.evaluate(() => {
  const s = window.draftrig.starters.find((x) => x.id === 'frame')
  window.draftrig.doc.getState().loadDoc(s.build())
})
await page.waitForTimeout(1200)

const info = await page.evaluate(() => {
  // Reach the scene through the r3f root attached to the canvas element.
  const canvas = document.querySelector('canvas')
  const key = Object.keys(canvas).find((k) => k.startsWith('__r3f'))
  const root = canvas[key]?.root ?? canvas[key]
  const store = root?.getState ? root : root?.store
  const scene = store?.getState?.().scene
  if (!scene) return { error: 'no scene', keys: Object.keys(canvas).slice(0, 8) }
  const out = []
  scene.traverse((o) => {
    if (!o.isMesh) return
    const m = o.material
    const isGrid = m && (m.type === 'ShaderMaterial' || m.type === 'RawShaderMaterial') && !o.name
    if (isGrid || o.name === 'ground') {
      out.push({
        name: o.name || m?.type,
        y: o.position.y,
        renderOrder: o.renderOrder,
        transparent: !!m?.transparent,
        depthTest: m?.depthTest,
        depthWrite: m?.depthWrite,
        side: m?.side,
      })
    }
  })
  // Also record the plywood so its height is known.
  scene.traverse((o) => {
    if (o.userData?.instanceId) out.push({ name: 'inst ' + o.userData.instanceId, y: o.position.y })
  })
  return out
})
console.log(JSON.stringify(info, null, 2))
await b.close()
