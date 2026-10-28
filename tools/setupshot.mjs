import { chromium } from 'playwright'
const BASE = 'http://localhost:5173'
const out = 'C:/Users/aryan/AppData/Local/Temp/claude/C--Users-aryan-Downloads-BUILDsim/bb328fc4-9d6b-450b-a4d2-20f8203ae8f5/scratchpad'
const BARE = `
  .vp-toolbar,.vp-hint,.vp-stats,.vp-modes,.wire-colors,.bom-tab,.sketch-tab,.mbar,.vp-empty,.empty-hint{display:none!important}
  .app{grid-template-rows:1fr!important}
  .app-body{grid-template-columns:1fr!important}
  .app-body>.panel,.app-body>.bom-panel,.app-body>.sketch-panel{display:none!important}
  .app-center{border:0!important}
  .app-center>.console,.topbar,.statusbar{display:none!important}
`
const b = await chromium.launch({ channel: 'msedge' })
const p = await b.newPage({ viewport: { width: 900, height: 760 }, deviceScaleFactor: 2 })
const errs = []
p.on('pageerror', (e) => errs.push(e.message))
await p.addInitScript(() => { localStorage.setItem('tour.seen.v1','1'); localStorage.setItem('draftrig.nav.seen.v1','1') })
await p.goto(BASE + '/app', { waitUntil: 'domcontentloaded' })
await p.waitForTimeout(10000)
await p.evaluate(() => { const d = window.draftrig.doc.getState(); d.pinQuality('high'); d.setView({ gizmo:false, grid:false, ports:false }) })
await p.addStyleTag({ content: BARE })
await p.setViewportSize({ width: 899, height: 760 }); await p.waitForTimeout(500)
await p.setViewportSize({ width: 900, height: 760 }); await p.waitForTimeout(600)

for (const [id, az, pol, fill] of [['ps5-stand', 34, 68, 0.80]]) {
  const ok = await p.evaluate((s) => {
    const x = window.draftrig.starters.find((b) => b.id === s)
    if (!x) return false
    const d = window.draftrig.doc.getState()
    d.loadDoc(x.build()); window.draftrig.engine.reset(); window.draftrig.sim.getState().setRunning(true); d.select([])
    return true
  }, id)
  if (!ok) { console.log('missing', id); continue }
  await p.evaluate(() => window.draftrig.doc.getState().requestFrame('all'))
  await p.waitForTimeout(3500)
  await p.evaluate(([a, q, f]) => {
    window.draftrig.camera.view(a, q)
    const c = window.draftrig.camera.controls
    const v = c.object.position.clone().sub(c.target).multiplyScalar(f)
    c.object.position.copy(c.target).add(v); c.object.lookAt(c.target); c.update()
  }, [az, pol, fill])
  await p.waitForTimeout(3000)
  await p.locator('canvas').first().screenshot({ path: `public/slides/${id}.jpg`, type: 'jpeg', quality: 92 })
  console.log('shot', id)
}
console.log(errs.length ? 'ERR ' + errs.slice(0,3).join(' | ') : 'no page errors')
await b.close()
