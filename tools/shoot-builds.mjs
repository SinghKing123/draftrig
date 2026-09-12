import { chromium } from 'playwright'

/**
 * Photographs of the showcase builds, for the front page.
 *
 * Every one is a starter anyone can open, so nothing here is a render of
 * something the software cannot do.
 *
 * The camera is placed through the harness handle rather than by synthesising
 * a drag. A drag has to get past the part picking handlers before the orbit
 * controls see it, and silently does not, which cost an hour to find out.
 *
 *   node tools/shoot-builds.mjs               all of them
 *   node tools/shoot-builds.mjs motion-sim    one
 */

const base = process.env.BASE ?? 'http://localhost:5173'
const only = process.argv.slice(2)

/**
 * starter id, output name, zoom notches, camera azimuth and polar angle.
 *
 * Azimuth 0 puts the camera on +z looking back along it; 40 or so is the
 * usual three-quarter. The motion rig is shot from behind the seat, because
 * the interesting side of a screen is the side the driver sees.
 */
const SHOTS = [
  ['motion-sim', 'build-motion', 6, 212, 62],
  ['cnc', 'build-cnc', 6, 34, 64],
  ['rover', 'build-rover', 7, 44, 68],
  ['panel', 'build-panel', 6, 14, 74],
  ['gaming-4k', 'build-pc', 5, 40, 66],
  ['frame', 'build-frame', 5, 40, 64],
  ['lcd', 'build-lcd', 7, 30, 62],
].filter((s) => only.length === 0 || only.includes(s[0]))

const b = await chromium.launch({ channel: 'msedge' })
// 1.5x of a 1500 wide frame is enough for a retina screen at the size these
// are shown, and a third of the bytes of a 2x PNG.
const page = await b.newPage({ viewport: { width: 1500, height: 940 }, deviceScaleFactor: 1.5 })
const errors = []
page.on('pageerror', (e) => errors.push(e.message))
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()) })

await page.goto(base + '/app', { waitUntil: 'networkidle' })
await page.evaluate(() => localStorage.setItem('tour.seen.v1', '1'))
await page.reload({ waitUntil: 'networkidle' })
await page.waitForTimeout(2600)
await page.addStyleTag({
  content: `
    .vp-toolbar, .vp-hint, .vp-stats, .ai-fab, .wire-palette, .vp-empty { display: none !important; }
    .app-body { grid-template-columns: 1fr !important; }
    .app-body > aside, .app-body > .panel, .app-body > :last-child { display: none !important; }
    .app-body > .app-center { display: flex !important; flex-direction: column; }
    .app-center > :last-child { display: none !important; }
  `,
})

for (const [starter, out, zoom, az, pol] of SHOTS) {
  const ok = await page.evaluate((id) => {
    const s = window.draftrig.starters.find((x) => x.id === id)
    if (!s) return false
    const d = window.draftrig.doc.getState()
    d.loadDoc(s.build())
    window.draftrig.engine.reset()
    d.select([])
    return true
  }, starter)
  if (!ok) {
    console.log('no such starter:', starter)
    continue
  }
  // Fit first, then swing the camera round to the angle we want.
  //
  // The other order does not work: the rig's fit animation writes the camera
  // position over the following frames, so a camera placed before it is put
  // straight back. Rotating afterwards keeps the distance the fit chose, so
  // the framing survives.
  await page.evaluate(() => window.draftrig.doc.getState().requestFrame('all'))
  await page.waitForTimeout(1700)

  const box = await page.locator('canvas').first().boundingBox()
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
  for (let i = 0; i < zoom; i++) {
    await page.mouse.wheel(0, -200)
    await page.waitForTimeout(130)
  }
  await page.waitForTimeout(400)

  await page.evaluate(([a, p]) => window.draftrig.camera?.view(a, p), [az, pol])
  await page.waitForTimeout(600)
  await page.locator('canvas').first().screenshot({ path: `public/${out}.jpg`, type: 'jpeg', quality: 82 })
  console.log('wrote public/' + out + '.jpg')
}

console.log('errors:', errors.length ? errors.slice(0, 5) : 'none')
await b.close()
