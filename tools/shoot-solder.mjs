import { chromium } from 'playwright'
const base = process.env.BASE ?? 'http://localhost:4173'
const b = await chromium.launch({ channel: 'msedge' })
const page = await b.newPage({ viewport: { width: 1100, height: 780 }, deviceScaleFactor: 2 })
const errors = []
page.on('pageerror', (e) => errors.push(e.message))
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()) })
await page.goto(base + '/app', { waitUntil: 'networkidle' })
await page.evaluate(() => localStorage.setItem('tour.seen.v1', '1'))
await page.reload({ waitUntil: 'networkidle' })
await page.waitForTimeout(2200)

// Seat two parts into a perfboard and wire a couple of holes.
await page.evaluate(() => {
  const d = window.draftrig.doc.getState()
  d.addPart('perfboard', [0, 0, 0], { cols: 12, rows: 9 })
  d.addPart('resistor-axial', [-5.08, 0, -2.54])
  d.addPart('led-5mm', [7.62, 0, 2.54])
  d.select([])
  d.requestFrame('all')
})
await page.waitForTimeout(1400)
const joints = await page.evaluate(() => {
  // Count what the solder layer decided to draw.
  return document.querySelectorAll('canvas').length
})
console.log('errors:', errors.length ? errors : 'none', 'canvases', joints)
await page.locator('canvas').first().screenshot({ path: 'solder.png' })
console.log('wrote solder.png')
await b.close()
