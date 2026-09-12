import { chromium } from 'playwright'
import { mkdirSync } from 'node:fs'

/**
 * A turntable: one build photographed all the way round.
 *
 * The front page spins these under the pointer. It is a sequence of frames
 * rather than a live scene because a live one costs three.js, the part kernel
 * and the whole catalog, which is most of a megabyte on a page people mostly
 * scroll past, to show something a few hundred kilobytes of frames already
 * shows at higher quality.
 *
 *   node tools/shoot-turntable.mjs cnc spin-cnc
 */

const base = process.env.BASE ?? 'http://localhost:5173'
const starter = process.argv[2] ?? 'cnc'
const out = process.argv[3] ?? `spin-${starter}`
const FRAMES = Number(process.env.FRAMES ?? 24)
const POL = Number(process.env.POL ?? 66)
const ZOOM = Number(process.env.ZOOM ?? 5)

mkdirSync('public/spin', { recursive: true })

const b = await chromium.launch({ channel: 'msedge' })
// Smaller than the stills: twenty four of these ship together, so each one has
// to be worth its bytes.
const page = await b.newPage({ viewport: { width: 1000, height: 700 }, deviceScaleFactor: 1.4 })
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

// Hiding the side panels makes the canvas wider, and the renderer only finds
// out on a resize. Without this the frames come out with a black band down
// the side where the old drawing buffer ended.
await page.waitForTimeout(300)
await page.setViewportSize({ width: page.viewportSize().width - 1, height: page.viewportSize().height })
await page.waitForTimeout(500)


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
  console.error('no such starter:', starter)
  await b.close()
  process.exit(1)
}

// Fit once, from a fixed angle, so the distance is the same for every frame.
await page.evaluate(() => window.draftrig.doc.getState().requestFrame('all'))
await page.waitForTimeout(1800)
{
  const box = await page.locator('canvas').first().boundingBox()
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
  for (let i = 0; i < ZOOM; i++) {
    await page.mouse.wheel(0, -200)
    await page.waitForTimeout(120)
  }
}
await page.waitForTimeout(500)

// The canvas element ends up a little wider than the drawing buffer inside
// it, which leaves a hard black strip down one edge. Photograph the middle of
// it rather than the element.
const canvasBox = await page.locator('canvas').first().boundingBox()
// More off the top than the bottom: above the horizon the scene fades to
// black, and a band of that across the top of a turntable reads as
// letterboxing rather than as sky.
const inset = 0.035
const topInset = 0.17
const clip = {
  x: canvasBox.x + canvasBox.width * inset,
  y: canvasBox.y + canvasBox.height * topInset,
  width: canvasBox.width * (1 - inset * 2),
  height: canvasBox.height * (1 - topInset - inset),
}
console.log('frame', Math.round(clip.width), 'x', Math.round(clip.height))

for (let i = 0; i < FRAMES; i++) {
  const az = (i / FRAMES) * 360
  await page.evaluate(([a, p]) => window.draftrig.camera?.view(a, p), [az, POL])
  await page.waitForTimeout(220)
  const n = String(i).padStart(2, '0')
  await page.screenshot({ path: `public/spin/${out}-${n}.jpg`, type: 'jpeg', quality: 72, clip })
}
console.log(`wrote ${FRAMES} frames to public/spin/${out}-NN.jpg`)
console.log('errors:', errors.length ? errors.slice(0, 4) : 'none')
await b.close()
