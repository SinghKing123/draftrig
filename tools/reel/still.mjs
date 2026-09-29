import { chromium } from 'playwright'
import { mkdirSync } from 'node:fs'
import { dirname } from 'node:path'
import { BUILD } from './display.mjs'

/**
 * A still of the finished LED display, whole and lit.
 *
 * The reel shows it arriving a part at a time and ends close enough that you
 * cannot see what was made. This is the other half: the same document, staged
 * complete rather than revealed, framed so the board, the matrix, the
 * resistors and the controller are all in one picture.
 *
 * Shot at twice the delivery size and scaled down on the way out, because a
 * render of thirty domed lenses is exactly the kind of picture that shows
 * every sampling artefact at 1:1.
 */

const BASE = process.env.BASE ?? 'http://localhost:5173'
const OUT = process.env.OUT ?? 'shots/reel/led-display.png'

/** 4:5 — the tallest a still can be in an Instagram feed without cropping. */
const W = 1080
const H = 1350

const BARE = `
  .app { grid-template-rows: 1fr !important; }
  .app-body { grid-template-columns: 1fr !important; }
  .panel, .console, .statusbar, .topbar, .ai-fab, .bom-tab,
  .vp-toolbar, .vp-hint, .vp-modes, .wire-colors, .vp-stats, .empty-hint { display: none !important; }
  .app-center { border: 0 !important; }
`

mkdirSync(dirname(OUT), { recursive: true })

const browser = await chromium.launch({ channel: 'msedge' })
const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 2 })
const problems = []
page.on('pageerror', (e) => problems.push(e.message))

await page.goto(BASE + '/app', { waitUntil: 'networkidle' })
await page.evaluate(() => {
  localStorage.setItem('tour.seen.v1', '1')
  localStorage.setItem('draftrig.nav.seen.v1', '1')
})
await page.reload({ waitUntil: 'networkidle' })
await page.waitForTimeout(7000)

await page.addStyleTag({ content: BARE })
await page.evaluate(() => {
  window.draftrig.doc.getState().setView({ gizmo: false })
  window.draftrig.doc.getState().pinQuality('high')
})
await page.waitForTimeout(600)

// The same build the reel assembles, put up all at once.
await page.addScriptTag({ content: BUILD })
await page.evaluate(() => {
  const D = window.draftrig.doc
  const p = window.__display.stage()
  const s = D.getState()
  const doc = { ...s.doc, instances: { ...s.doc.instances }, connections: {}, connectionOrder: [] }
  for (const id of doc.order) doc.instances[id] = { ...doc.instances[id], hidden: false }
  p.wires.forEach((w, i) => {
    const id = 'w' + i.toString(36)
    doc.connections[id] = { id, kind: 'wire', a: w.a, b: w.b, color: w.color, gauge: 0.2 }
    doc.connectionOrder.push(id)
  })
  D.setState({ doc })
  D.getState().select([])
})
await page.waitForTimeout(2500)

/*
 * Lit, and caught on a row worth looking at.
 *
 * The operating point settles without running, but the chase only picks a row
 * to light once time is moving — and the row it happens to be on when the
 * shutter falls matters, because the backmost one sits behind the wire bundle
 * where half of it is hidden. So the sketch is left running until a row
 * nearer the front is the bright one, and then the simulation is paused on it.
 */
await page.evaluate(() => {
  window.draftrig.engine.reset()
  window.draftrig.sim.getState().setRunning(true)
})

const caught = await page.waitForFunction(
  () => {
    const led = window.__display.plan().led
    const I = window.draftrig.sim.getState().instI || {}
    let best = -1
    let bestI = 0
    for (let r = 0; r < led.length; r++) {
      let sum = 0
      for (const id of led[r]) sum += Math.abs(I[id] ?? 0)
      if (sum > bestI) {
        bestI = sum
        best = r
      }
    }
    // Rows count from the back, so anything past the middle is the near half.
    if (bestI > 2e-3 && best >= led.length - 2) {
      window.draftrig.sim.getState().setRunning(false)
      return best
    }
    return false
  },
  null,
  { timeout: 60000, polling: 120 },
).then((h) => h.jsonValue()).catch(() => null)

console.log(caught === null ? 'chase never reached a near row; shooting as lit' : `paused on row ${caught}`)
await page.waitForTimeout(1200)

/*
 * Framed by hand rather than by Fit.
 *
 * Fit keeps whatever direction the camera is already pointing and leaves a
 * working margin, which put the build across the frame as a diagonal band
 * with a third of the picture empty above and below it. The pair is 68 mm
 * across and 115 mm front to back, so the long axis wants to run up the
 * frame, not across it.
 */
await page.evaluate(() => {
  const c = window.draftrig.camera.controls
  const cam = c.object
  const az = (58 * Math.PI) / 180
  const polar = (46 * Math.PI) / 180
  const dist = 262
  c.target.set(-5, 8, -34)
  cam.position.set(
    c.target.x + dist * Math.sin(polar) * Math.sin(az),
    c.target.y + dist * Math.cos(polar),
    c.target.z + dist * Math.sin(polar) * Math.cos(az),
  )
  cam.lookAt(c.target)
  // Fit sets the clip planes from the distance it chose; this is much nearer.
  cam.near = 0.5
  cam.far = 4000
  cam.updateProjectionMatrix()
  c.update()
})
// Nothing hovered, nothing outlined.
await page.mouse.move(2, 2)
await page.waitForTimeout(1800)

await page.locator('canvas').first().screenshot({ path: OUT })
console.log(`wrote ${OUT}${problems.length ? '  ERRORS: ' + problems.join('; ') : ''}`)
await browser.close()
