import { chromium } from 'playwright'

/** The bill of materials for a real build, photographed from the real panel. */
const base = process.env.BASE ?? 'http://localhost:5173'
const b = await chromium.launch({ channel: 'msedge' })
const page = await b.newPage({ viewport: { width: 1040, height: 900 }, deviceScaleFactor: 2 })
await page.goto(base + '/app?start=bench-clock', { waitUntil: 'networkidle' })
await page.evaluate(() => {
  localStorage.setItem('tour.seen.v1', '1')
  localStorage.setItem('draftrig.nav.seen.v1', '1')
  localStorage.setItem('draftrig.console.open.v1', '1')
})
await page.reload({ waitUntil: 'networkidle' })
await page.waitForTimeout(6000)
// The drawer is 200px tall in use, which photographs as a letterbox with two
// rows in it. Taller for the photograph only, so the table reads as a table.
await page.addStyleTag({ content: '.console { height: 460px !important; }' })
await page.getByRole('button', { name: /Bill of materials/i }).click()
await page.waitForTimeout(1400)
await page.locator('.console').screenshot({ path: 'public/feature-bom.jpg', type: 'jpeg', quality: 88 })
console.log('wrote public/feature-bom.jpg')
await b.close()
