import { chromium } from 'playwright'
import { mkdirSync } from 'node:fs'

/**
 * A card photograph of every preset, for the dashboard.
 *
 * The dashboard shows your own builds with a picture — the editor photographs
 * the bench every time you save — and the presets with nothing, because
 * nobody has ever saved them. A text card beside a picture card reads as the
 * poor relation, and the presets are the thing a new person should reach for
 * first.
 *
 * Shot once and shipped, rather than rendered in the browser on demand:
 * eleven builds through a 3D pipeline is several seconds of work and a
 * megabyte of parts catalog, on a page whose whole job is to get out of the
 * way. They are identical for everybody, so they are assets.
 *
 *   npm run dev
 *   BASE=http://localhost:5173 node tools/shoot-presets.mjs
 *   BASE=http://localhost:5173 node tools/shoot-presets.mjs cnc rover
 *
 * The camera goes through the harness handle rather than a synthesised drag:
 * a drag is eaten by the part picking handlers before the orbit controls see
 * it, silently. See tools/shoot-builds.mjs, which learnt that the hard way.
 */

const base = process.env.BASE ?? 'http://localhost:5173'
const only = process.argv.slice(2)

/**
 * preset id, fill, azimuth, polar.
 *
 * The third column multiplies the distance the Fit animation chose. Fit frames the whole
 * build with room to spare, which on a card leaves it a stamp in a field of
 * black, so every shot pulls in from there — 0.55 means a little over half the
 * fitted distance. A factor rather than a count of wheel notches because a
 * notch is a fixed fraction of the current distance and the fitted distance is
 * different for every build, so the same count framed a resistor and a CNC
 * router completely differently.
 *
 * The rover's factor is far below the rest because its scene is far bigger:
 * Fit settles 806 units out for the rover against 262 for the LED matrix, so
 * the same factor frames one and loses the other.
 *
 * Azimuth 0 is the camera on +z looking back along it, so 30-ish is the usual
 * three-quarter. The flat things — the control panel, the frame — are shot
 * from higher up, because at 56 degrees they are a line.
 */
/* Builds with a display that has to be clocked up before it reads. */
const SETTLE = {
  scoreboard: 2600,
  lcd: 2600,
  'bench-clock': 2600,
  oled: 2200,
  matrix: 1400,
}

const SHOTS = [
  ['matrix', 0.70, 32, 54],
  ['scoreboard', 0.64, 26, 52],
  ['logic-bench', 0.52, 34, 52],
  ['esp-weather', 0.62, 32, 56],
  ['thrust-rig', 0.62, 38, 54],
  ['rfid-lock', 0.5, 30, 56],
  ['sound-bench', 0.54, 36, 54],
  ['servo-arm', 0.44, 34, 48],
  ['led', 0.5, 52, 48],
  ['blink555', 0.5, 28, 56],
  ['mcu', 0.42, 40, 52],
  ['lcd', 0.5, 30, 58],
  ['oled', 0.5, 26, 56],
  ['bench-clock', 0.5, 24, 54],
  ['frame', 0.58, 36, 62],
  ['motor', 0.52, 34, 58],
  ['cnc', 0.6, 34, 64],
  ['rover', 0.27, 46, 58],
  ['panel', 0.46, 30, 66],
].filter((s) => only.length === 0 || only.includes(s[0]))

mkdirSync('public/presets', { recursive: true })

const b = await chromium.launch({ channel: 'msedge' })
/* 16:10, at the size a card shows it, times 1.5 for a retina screen. Bigger
   is wasted: these are 250 pixels wide in the grid. */
const page = await b.newPage({ viewport: { width: 860, height: 538 }, deviceScaleFactor: 2 })
const errors = []
page.on('pageerror', (e) => errors.push(e.message))

await page.goto(base + '/app', { waitUntil: 'domcontentloaded' })
await page.evaluate(() => {
  localStorage.setItem('tour.seen.v1', '1')
  localStorage.setItem('draftrig.nav.seen.v1', '1')
})
await page.reload({ waitUntil: 'domcontentloaded' })
await page.waitForTimeout(9000)

await page.evaluate(() => {
  const d = window.draftrig.doc.getState()
  // The frame-rate monitor would otherwise step quality down partway through
  // and half of these would come out without ambient occlusion.
  d.pinQuality('high')
  // The axis widget is drawn inside the canvas, so a stylesheet cannot reach
  // it, and every photograph came out with it in the corner.
  d.setView({ gizmo: false, grid: false, ports: false })
})

await page.addStyleTag({
  content: `
    .vp-toolbar, .vp-hint, .vp-stats, .vp-modes, .wire-colors, .bom-tab,
    .sketch-tab, .mbar, .vp-empty, .empty-hint { display: none !important; }
    .app { grid-template-rows: 1fr !important; }
    .app-body { grid-template-columns: 1fr !important; }
    .app-body > .panel, .app-body > .bom-panel, .app-body > .sketch-panel { display: none !important; }
    .app-center { border: 0 !important; }
    .app-center > .console, .topbar, .statusbar { display: none !important; }
  `,
})

/* Hiding the panels widens the canvas, and the renderer only finds out on a
   resize. Without this the frames come out with a black band down the side
   where the old drawing buffer ended. */
await page.waitForTimeout(400)
const vp = page.viewportSize()
await page.setViewportSize({ width: vp.width - 1, height: vp.height })
await page.waitForTimeout(700)

for (const [id, fill, az, pol] of SHOTS) {
  const ok = await page.evaluate((starter) => {
    const s = window.draftrig.starters.find((x) => x.id === starter)
    if (!s) return false
    const d = window.draftrig.doc.getState()
    d.loadDoc(s.build())
    window.draftrig.engine.reset()
    /* Switch it on. Without this the solver never runs and every display in
       the set photographs as a blank panel — which is what the character LCD
       builds did, lit but with nothing written on them. */
    window.draftrig.sim.getState().setRunning(true)
    d.select([])
    return true
  }, id)
  if (!ok) {
    console.log('no such preset:', id)
    continue
  }

  /* Fit first, then swing round. The other order does not work: the rig's fit
     animation writes the camera position over the following frames, so a
     camera placed before it is put straight back. */
  await page.evaluate(() => window.draftrig.doc.getState().requestFrame('all'))
  await page.waitForTimeout(1600)

  /* Clear the selection before touching the camera, not after.
     CameraRig re-frames on a selection change, so a clearSelection() after the
     camera has been placed throws the framing away and puts the camera back
     where Fit had it — which is exactly what happened, silently, and the
     photographs came out at the fitted distance every time. Measured: set to
     187, read back 374 at the shutter. */
  await page.mouse.move(2, 2)
  await page.evaluate(() => {
    const d = window.draftrig.doc.getState()
    d.clearSelection()
    d.setHovered(null)
  })
  await page.waitForTimeout(700)

  // Swing to the angle, then pull in from whatever distance Fit settled on.
  await page.evaluate(([a, p, f]) => {
    window.draftrig.camera.view(a, p)
    const c = window.draftrig.camera.controls
    const v = c.object.position.clone().sub(c.target).multiplyScalar(f)
    c.object.position.copy(c.target).add(v)
    c.object.lookAt(c.target)
    c.update()
  }, [az, pol, fill])

  /*
   * How long to let it run before the shutter, per build.
   *
   * Not one number for all of them. A character LCD has to be clocked through
   * its four-bit init before the first letter appears, and at 700 ms the
   * scoreboard photographed as a blank yellow panel — but the rover drives,
   * and giving it the same 2.6 s left it a stamp in the far corner of the
   * frame. Displays wait; anything that moves gets the shutter early.
   */
  await page.waitForTimeout(SETTLE[id] ?? 700)

  await page.locator('canvas').first().screenshot({
    path: `public/presets/${id}.jpg`, type: 'jpeg', quality: 90,
  })
  console.log('wrote public/presets/' + id + '.jpg')
}

console.log('errors:', errors.length ? errors.slice(0, 4) : 'none')
await b.close()
