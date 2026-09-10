import { chromium } from 'playwright'
const base = process.env.BASE ?? 'http://localhost:4173'
const ids = process.argv.slice(2)
const b = await chromium.launch({ channel: 'msedge' })
const page = await b.newPage({ viewport: { width: 1200, height: 800 } })
const errors = []
page.on('pageerror', (e) => errors.push(e.message))
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()) })
await page.goto(base + '/app', { waitUntil: 'networkidle' })
await page.evaluate(() => localStorage.setItem('tour.seen.v1', '1'))
await page.reload({ waitUntil: 'networkidle' })
await page.waitForTimeout(2200)

await page.evaluate((list) => {
  const doc = window.draftrig.doc.getState()
  let x = -160
  for (const id of list) {
    doc.addPart(id, [x, 0, 0])
    x += 110
  }
  doc.select([])
  doc.requestFrame('all')
}, ids)
await page.waitForTimeout(1800)
const placed = await page.evaluate(() => window.draftrig.doc.getState().doc.order.length)
console.log('placed:', placed, 'of', ids.length)
console.log('errors:', errors.length ? errors : 'none')
await page.locator('canvas').first().screenshot({ path: 'parts.png' })
console.log('wrote parts.png')
await b.close()
