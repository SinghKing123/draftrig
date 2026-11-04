import { chromium } from 'playwright'
import { mkdirSync, rmSync, writeFileSync } from 'node:fs'

/**
 * Photographs a build assembling itself, one part at a time.
 *
 * The output is a numbered frame sequence the landing page scrubs with the
 * scroll wheel, which is the cheapest honest way to put the product in
 * motion on a page that must not load a 3D engine. The marketing routes
 * deliberately do not import three.js — a frame sequence keeps it that way
 * and still shows the thing being built.
 *
 * It is shot from the real editor with a real template, so what the page
 * shows is what the application does. Nothing here is a mock-up.
 *
 *   node tools/shoot-assembly.mjs home-theatre --orbit=22 --hold=8
 *
 *   starter   id from window.draftrig.starters
 *   --aim     mm to lower the orbit centre, to seat the subject in frame
 *   --seed    parts already placed before the first frame, so the loop
 *             opens on something rather than on an empty bench
 *   --orbit   degrees of azimuth swept across the whole sequence
 *   --hold    extra frames on the finished build at the end
 *   --w --h   frame size, default 1440 x 810
 *   --quality JPEG quality, default 72
 *
 * BASE  dev server (default http://localhost:5174)
 */

const BASE = process.env.BASE ?? 'http://localhost:5174'
const args = process.argv.slice(2)
const starter = args.find((a) => !a.startsWith('--')) ?? 'home-theatre'
const flag = (name, def) => {
  const hit = args.find((a) => a.startsWith(`--${name}=`))
  return hit ? Number(hit.split('=')[1]) : def
}

const ORBIT = flag('orbit', 22)
/*
 * Parts placed before the shutter opens.
 *
 * The sequence used to start on a black frame, which is correct — an empty
 * bench is empty — and wrong for a loop at the top of a page, where the
 * first second is a black rectangle and the restart is a hole. Three parts
 * in, there is a desk on the floor and the loop reads as a build growing
 * rather than as something failing to load.
 */
const SEED = flag('seed', 0)
/** Millimetres to drop the orbit centre by before shooting. */
const flagAim = flag('aim', 0)
const HOLD = flag('hold', 8)
const W = flag('w', 1440)
const H = flag('h', 810)
const QUALITY = flag('quality', 72)

const OUT = `public/reel/${starter}`

/** Chrome off, canvas full bleed — the same stripping the part shots use. */
const BARE = `
  .app { grid-template-rows: 1fr !important; }
  .app-body { grid-template-columns: 1fr !important; }
  .panel, .console, .statusbar, .topbar, .ws, .ai-fab, .bom-tab,
  .vp-toolbar, .vp-hint, .vp-modes, .wire-colors, .vp-stats,
  .app-notice, .sketch-panel { display: none !important; }
  .app-center { border: 0 !important; }
`

rmSync(OUT, { recursive: true, force: true })
mkdirSync(OUT, { recursive: true })

const browser = await chromium.launch({ channel: 'msedge' })
const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 })
await page.addInitScript(() => {
  localStorage.setItem('tour.seen.v1', '1')
  localStorage.setItem('draftrig.nav.seen.v1', '1')
  localStorage.setItem('draftrig.used.v1', '1')
  localStorage.setItem('draftrig.console.open.v1', '0')
  localStorage.setItem('draftrig.bom.open.v1', '0')
})

const problems = []
page.on('pageerror', (e) => problems.push(e.message.slice(0, 160)))

await page.goto(BASE + '/app', { waitUntil: 'networkidle' })
await page.waitForFunction(() => typeof window.draftrig?.doc?.getState === 'function', { timeout: 30000 })
await page.addStyleTag({ content: BARE })

/*
 * Frame the finished build first, then hide everything.
 *
 * The camera has to be the camera of the last frame from the first frame —
 * a sequence that reframes as parts arrive is a sequence that lurches, and
 * the whole effect depends on the viewpoint being still while the build
 * grows into it.
 */
const order = await page.evaluate((id) => {
  const s = window.draftrig.starters.find((x) => x.id === id)
  if (!s) throw new Error('no starter ' + id)
  const d = window.draftrig.doc.getState()
  d.loadDoc(s.build())
  d.select([])
  d.requestFrame('all')
  return window.draftrig.doc.getState().doc.order.slice()
}, starter)

await page.waitForTimeout(4000)

/*
 * The film's frame, which is not the editor's frame.
 *
 * Fit leaves air on every side because it has to work for any shape from
 * any angle. A film wants the subject large and the eye low — about 68
 * degrees off vertical, which is a person standing in the room rather than
 * a plan view of it. Both are applied once, here, and then the camera only
 * orbits.
 */
const start = await page.evaluate((aim) => {
  const c = window.draftrig.camera.controls
  /*
   * Drop the aim.
   *
   * Fit centres on the bounding box, and the box includes whatever is
   * highest — a ceiling speaker, a cable run to one — so the build itself
   * sits in the bottom of the frame with a third of the picture empty
   * above it. Lowering the orbit centre by a fraction of the build's own
   * height puts the subject where a photographer would put it.
   */
  c.target.y -= aim
  const t = c.target.clone()
  c.object.position.sub(t).multiplyScalar(0.70).add(t)
  c.update()
  const dir = c.object.position.clone().sub(t)
  return { az: (Math.atan2(dir.x, dir.z) * 180) / Math.PI, pol: 68 }
}, flagAim)

/* Grid off, and the axis widget with it. The page is showing a build, not
   an editor, and the viewport's own furniture reads as clutter at this
   size. */
await page.evaluate(() => window.draftrig.doc.getState().setView({ grid: false, gizmo: false, ports: false }))

await page.evaluate(() => {
  const d = window.draftrig.doc.getState()
  for (const id of d.doc.order) if (!d.doc.instances[id].hidden) d.toggleHidden(id)
})
await page.waitForTimeout(600)

const shown = order.slice(0, SEED)
if (shown.length) {
  await page.evaluate((ids) => {
    const d = window.draftrig.doc.getState()
    for (const id of ids) d.toggleHidden(id)
  }, shown)
  await page.waitForTimeout(500)
}
const reveal = order.slice(SEED)

const total = reveal.length + HOLD
let n = 0

/**
 * Read the frame off the canvas, rather than photographing the page.
 *
 * `page.screenshot` goes through the browser's compositor, and on a live
 * WebGL canvas it hands back whatever surface the compositor last cached —
 * which in a headless window it stops refreshing after a few seconds. The
 * symptom was a sequence where the build stopped growing at frame seven and
 * thirty identical frames followed, while the application underneath was
 * perfectly happy and had all thirty-six parts on screen.
 *
 * `toDataURL` reads the drawing buffer itself. The canvas is created with
 * preserveDrawingBuffer, which is what makes that legal, and it was already
 * on for the project thumbnails.
 */
const shoot = async () => {
  n += 1
  const data = await page.evaluate(async (q) => {
    // Two frames, so anything queued this tick has been drawn.
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))
    const canvas = document.querySelector('canvas')
    return canvas.toDataURL('image/jpeg', q)
  }, QUALITY / 100)
  writeFileSync(`${OUT}/${String(n).padStart(4, '0')}.jpg`, Buffer.from(data.split(',')[1], 'base64'))
}

for (let i = 0; i < reveal.length; i++) {
  await page.evaluate(
    ([id, az, pol]) => {
      window.draftrig.doc.getState().toggleHidden(id)
      window.draftrig.camera.view(az, pol)
    },
    [reveal[i], start.az + (ORBIT * i) / total, start.pol],
  )
  // Long enough for the geometry to compile and one frame to land.
  await page.waitForTimeout(260)
  await shoot()
  if (process.env.VERBOSE) {
    const shown = await page.evaluate(() => {
      const d = window.draftrig.doc.getState()
      return d.doc.order.filter((x) => !d.doc.instances[x].hidden).length
    })
    console.log(`  frame ${n}: ${shown} parts visible`)
  }
}

for (let i = 0; i < HOLD; i++) {
  await page.evaluate(
    ([az, pol]) => window.draftrig.camera.view(az, pol),
    [start.az + (ORBIT * (reveal.length + i)) / total, start.pol],
  )
  await page.waitForTimeout(180)
  await shoot()
}

/*
 * A manifest, so the page does not have to guess how many frames there are
 * or hard-code a number that goes stale the moment a part is added to the
 * template.
 */
writeFileSync(
  `${OUT}/frames.json`,
  JSON.stringify({ starter, frames: n, width: W, height: H, shot: new Date().toISOString().slice(0, 10) }, null, 2) + '\n',
)

console.log(`${n} frames -> ${OUT}`)
if (problems.length) console.log('errors:\n  ' + problems.join('\n  '))

await browser.close()
