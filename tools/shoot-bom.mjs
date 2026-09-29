import { chromium } from 'playwright'

/** The bill of materials for a real build, photographed from the real panel. */
const base = process.env.BASE ?? 'http://localhost:5173'
const b = await chromium.launch({ channel: 'msedge' })
const page = await b.newPage({ viewport: { width: 1500, height: 940 }, deviceScaleFactor: 2 })
await page.goto(base + '/app?start=bench-clock', { waitUntil: 'networkidle' })
await page.evaluate(() => {
  localStorage.setItem('tour.seen.v1', '1')
  localStorage.setItem('draftrig.nav.seen.v1', '1')
  localStorage.setItem('draftrig.bom.open.v1', '1')
})
await page.reload({ waitUntil: 'networkidle' })
await page.waitForTimeout(6000)
await page.locator('.bom-panel').screenshot({ path: 'public/feature-bom.jpg', type: 'jpeg', quality: 90 })
console.log('wrote public/feature-bom.jpg')
await b.close()
