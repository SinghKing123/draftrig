import { chromium } from 'playwright'

/** Produces public/hero.png: the editor, running, framed for the landing page. */
const base = process.env.BASE ?? 'http://localhost:4173'
const b = await chromium.launch({ channel: 'msedge' })
const page = await b.newPage({ viewport: { width: 1600, height: 1000 }, deviceScaleFactor: 2 })
const errors = []
page.on('pageerror', (e) => errors.push(e.message))

await page.goto(base + '/app', { waitUntil: 'networkidle' })
await page.evaluate(() => localStorage.setItem('tour.seen.v1', '1'))
await page.reload({ waitUntil: 'networkidle' })
await page.waitForTimeout(2400)

await page.evaluate(() => {
  const s = window.draftrig.starters.find((x) => x.id === 'lcd')
  window.draftrig.doc.getState().loadDoc(s.build())
  window.draftrig.engine.reset()
  window.draftrig.doc.getState().setView({ quality: 'high', grid: true, shadows: true })
  window.draftrig.sim.getState().setRunning(true)
})

// Let the sketch initialise the panel and put text on it.
const deadline = Date.now() + 90000
while (Date.now() < deadline) {
  await page.waitForTimeout(500)
  if ((await page.evaluate(() => window.draftrig.sim.getState().time)) > 0.45) break
}
await page.evaluate(() => {
  window.draftrig.doc.getState().select([])
  window.draftrig.doc.getState().requestFrame('all')
})
await page.waitForTimeout(1400)
// Fitting the whole document leaves the build small in a large viewport, so
// close in a little. The hero wants the thing, not the empty bench around it.
const box = await page.locator('canvas').first().boundingBox()
await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
for (let i = 0; i < 4; i++) {
  await page.mouse.wheel(0, -220)
  await page.waitForTimeout(140)
}
await page.waitForTimeout(700)

console.log('errors:', errors.length ? errors : 'none')
await page.screenshot({ path: 'public/hero-raw.png' })
console.log('wrote public/hero-raw.png')
await b.close()
