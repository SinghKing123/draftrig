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
await page.waitForTimeout(1600)

console.log('errors:', errors.length ? errors : 'none')
await page.screenshot({ path: 'public/hero.png' })
console.log('wrote public/hero.png')
await b.close()
