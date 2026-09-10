import { chromium } from 'playwright'

const base = process.env.BASE ?? 'http://localhost:4173'
const b = await chromium.launch({ channel: 'msedge' })
const page = await b.newPage({ viewport: { width: 1500, height: 950 }, deviceScaleFactor: 2 })
const errors = []
page.on('pageerror', (e) => errors.push(e.message))
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()) })

await page.goto(base + '/app', { waitUntil: 'networkidle' })
await page.evaluate(() => localStorage.setItem('tour.seen.v1', '1'))
await page.reload({ waitUntil: 'networkidle' })
await page.waitForTimeout(2500)

await page.evaluate(() => {
  const s = window.draftrig.starters.find((x) => x.id === 'lcd')
  window.draftrig.doc.getState().loadDoc(s.build())
  window.draftrig.engine.reset()
  window.draftrig.sim.getState().setRunning(true)
})

const target = process.argv[2] ?? 'lcd'
const deadline = Date.now() + 90000
while (Date.now() < deadline) {
  await page.waitForTimeout(500)
  if ((await page.evaluate(() => window.draftrig.sim.getState().time)) > 0.4) break
}

// Select the part of interest and fit the view to just that.
await page.evaluate((want) => {
  const doc = window.draftrig.doc.getState()
  const id = doc.doc.order.find((i) =>
    want === 'lcd' ? doc.doc.instances[i].defId.includes('lcd') : doc.doc.instances[i].defId.includes('mcu'))
  doc.select([id])
  doc.requestFrame('selection')
}, target)
await page.waitForTimeout(1400)
// Drop the selection so the gizmo and the highlight are not in the picture.
await page.evaluate(() => window.draftrig.doc.getState().select([]))
await page.waitForTimeout(400)

console.log('errors:', errors.length ? errors : 'none')
await page.locator('canvas').screenshot({ path: `close-${target}.png` })
console.log('wrote close-' + target + '.png')
await b.close()
