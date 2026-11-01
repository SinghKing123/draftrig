import { chromium } from 'playwright'
import { mkdirSync } from 'node:fs'

/**
 * Photographs a build at candidate framings, so a take can be aimed by eye.
 *
 * `measure.mjs` was supposed to do this arithmetically by letting the editor
 * frame the build and reading the camera back, and it does not work headless:
 * the re-frame is asked for but never lands, so every build reports the
 * camera's default 4000mm, including a stand half a metre tall. Rather than
 * fight that, this takes the candidates as arguments and returns pictures.
 *
 * One picture per candidate, at the delivery size, with the interface hidden
 * so the frame is the frame the reel will have.
 *
 *   node tools/reel/aim.mjs ps5-stand 0,300,0  30,62,900  30,62,1300  60,58,1100
 *
 * The first argument is the starter, the second the look-at point, and the
 * rest are azimuth,polar,distance candidates. Shots land in shots/ads/aim/.
 */

const BASE = process.env.BASE ?? 'http://localhost:5174'
const OUT = 'shots/ads/aim'

const [, , starter, targetArg, ...cands] = process.argv
if (!starter || !targetArg || !cands.length) {
  console.log('usage: aim.mjs <starter> <tx,ty,tz> <az,polar,dist> [more…]')
  process.exit(1)
}
const target = targetArg.split(',').map(Number)
const shots = cands.map((c) => c.split(',').map(Number))

/** Chrome off, canvas full bleed — the same stripping the hook shots use. */
const BARE = `
  .app { grid-template-rows: 1fr !important; }
  .app-body { grid-template-columns: 1fr !important; }
  .panel, .console, .statusbar, .topbar, .ai-fab, .bom-tab,
  .vp-toolbar, .vp-hint, .vp-modes, .wire-colors, .vp-stats { display: none !important; }
  .app-center { border: 0 !important; }
`

mkdirSync(OUT, { recursive: true })

/*
 * Edge, and a long shutter.
 *
 * The bundled headless shell reports its fonts loaded and then never returns
 * a frame of a live WebGL canvas this size — `shoot-cine.mjs` hit the same
 * wall and settled on the installed browser with a 90-second timeout, so
 * this follows it rather than rediscovering it.
 */
const browser = await chromium.launch({ channel: 'msedge' })
const page = await browser.newPage({ viewport: { width: 1080, height: 1920 }, deviceScaleFactor: 1 })
await page.addInitScript(() => {
  localStorage.setItem('tour.seen.v1', '1')
  localStorage.setItem('draftrig.nav.seen.v1', '1')
  localStorage.setItem('draftrig.console.open.v1', '0')
  localStorage.setItem('draftrig.bom.open.v1', '0')
})
await page.goto(BASE + '/app', { waitUntil: 'networkidle' })
await page.waitForFunction(() => window.draftrig?.starters?.length > 0, { timeout: 30000 })
await page.addStyleTag({ content: BARE })

await page.evaluate((id) => {
  const s = window.draftrig.starters.find((x) => x.id === id)
  if (!s) throw new Error('no starter ' + id)
  window.draftrig.doc.getState().loadDoc(s.build())
  window.draftrig.doc.getState().select([])
  window.draftrig.engine.reset()
  window.draftrig.sim.getState().setRunning(true)
}, starter)
await page.waitForTimeout(2500)

for (const [az, polar, dist] of shots) {
  await page.evaluate(
    ([t, a, p, d]) => {
      const c = window.draftrig.camera.controls
      const ar = (a * Math.PI) / 180
      const pr = (p * Math.PI) / 180
      c.target.set(t[0], t[1], t[2])
      c.object.position.set(
        t[0] + d * Math.sin(pr) * Math.sin(ar),
        t[1] + d * Math.cos(pr),
        t[2] + d * Math.sin(pr) * Math.cos(ar),
      )
      c.object.lookAt(c.target)
      c.update()
    },
    [target, az, polar, dist],
  )
  await page.waitForTimeout(900)
  const name = `${starter}-${az}_${polar}_${dist}.png`
  await page.locator('canvas').first().screenshot({ path: `${OUT}/${name}`, timeout: 90_000 })
  console.log(`  ${name}`)
}

await browser.close()
console.log(`\n${shots.length} framings in ${OUT}/`)
