import { chromium } from 'playwright'

/** Four angles on one starter, straight to PNGs, so a build can be looked at. */
const BASE = process.env.BASE ?? 'http://localhost:5173'
const id = process.argv[2]
const dist = Number(process.argv[3] ?? 0.5)
const ty = Number(process.argv[4] ?? 90)
const out = process.argv[5] ?? 'C:/Users/aryan/AppData/Local/Temp/claude/C--Users-aryan-Downloads-BUILDsim/db28cbbf-0297-4773-9e67-ec0dd1d35e99/scratchpad'

const BARE = `
  .app { grid-template-rows: 1fr !important; }
  .app-body { grid-template-columns: 1fr !important; }
  .panel, .console, .statusbar, .topbar, .bom-tab, .sketch-tab, .mbar,
  .vp-toolbar, .vp-hint, .vp-modes, .wire-colors, .vp-stats, .empty-hint,
  .inspector, .bom-panel, .sketch-panel, .nav-help, .acct { display: none !important; }
  .app-center { border: 0 !important; }
`

const browser = await chromium.launch({ channel: 'msedge' })
const page = await browser.newPage({ viewport: { width: 900, height: 1200 } })
await page.addInitScript(() => {
  localStorage.setItem('tour.seen.v1', '1')
  localStorage.setItem('draftrig.nav.seen.v1', '1')
  localStorage.setItem('draftrig.console.open.v1', '0')
  localStorage.setItem('draftrig.bom.open.v1', '0')
})
page.on('pageerror', (e) => console.log('ERR', e.message))
page.on('console', (m) => { if (m.type() === 'error') console.log('CONSOLE', m.text().slice(0, 160)) })
await page.goto(`${BASE}/app`, { waitUntil: 'networkidle' })
await page.waitForTimeout(7000)
await page.addStyleTag({ content: BARE })
await page.evaluate((v) => window.draftrig.doc.getState().setView(v), { gizmo: false, ports: false })
await page.evaluate((s) => {
  const starter = window.draftrig.starters.find((x) => x.id === s)
  window.draftrig.doc.getState().loadDoc(starter.build())
  window.draftrig.doc.getState().select([])
  window.draftrig.engine.reset()
  window.draftrig.sim.getState().setRunning(true)
  window.draftrig.sim.getState().setDt(1e-4)
}, id)
await page.evaluate(() => window.draftrig.doc.getState().requestFrame('all'))
await page.waitForTimeout(1800)
await page.evaluate(() => {
  const d = window.draftrig.doc.getState()
  d.clearSelection()
  d.setHovered(null)
  d.pinQuality('high')
})
await page.waitForTimeout(2600)
console.log('parts on bench:', await page.evaluate(() => Object.keys(window.draftrig.doc.getState().doc.instances).length))

/*
 * The camera goes through the editor's own handle, and the shutter is on the
 * canvas rather than the page.
 *
 * Both of those are load-bearing. Setting controls.object.position by hand
 * moves the camera and does not make the renderer draw, so four angles came
 * out as four byte-identical files; and page.screenshot caught the same
 * stale buffer. tools/shoot-presets.mjs already had this right.
 */
const look = async (az, polar, f, name) => {
  await page.evaluate(
    ([a, p, fill, t]) => {
      const c = window.draftrig.camera.controls
      c.target.set(0, t, 0)
      window.draftrig.camera.view(a, p)
      const v = c.object.position.clone().sub(c.target).multiplyScalar(fill)
      c.object.position.copy(c.target).add(v)
      c.object.lookAt(c.target)
      c.update()
    },
    [az, polar, f, ty],
  )
  await page.waitForTimeout(2200)
  await page.locator('canvas').first().screenshot({ path: `${out}/${id}-${name}.png`, timeout: 90_000 })
  console.log(`${out}/${id}-${name}.png`)
}

await look(6, 78, dist, 'face')
await look(10, 62, dist, 'front')
await look(52, 58, dist, 'quarter')
await look(176, 62, dist, 'back')
await browser.close()
