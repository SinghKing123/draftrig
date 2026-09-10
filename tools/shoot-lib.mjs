import { chromium } from 'playwright'
const base = process.env.BASE ?? 'http://localhost:4173'
const b = await chromium.launch({ channel: 'msedge' })
const page = await b.newPage({ viewport: { width: 460, height: 1000 }, deviceScaleFactor: 2 })
const errors = []
page.on('pageerror', (e) => errors.push(e.message))
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()) })
await page.goto(base + '/app', { waitUntil: 'networkidle' })
await page.evaluate(() => localStorage.setItem('tour.seen.v1', '1'))
await page.reload({ waitUntil: 'networkidle' })
await page.waitForTimeout(2000)
// Open every category so the whole set of glyphs is visible at once.
const groups = page.locator('.lib-group[data-open="false"]')
for (let i = await groups.count(); i > 0; i--) {
  await page.locator('.lib-group[data-open="false"]').first().click()
  await page.waitForTimeout(60)
}
await page.waitForTimeout(300)
console.log('errors:', errors.length ? errors : 'none')
await page.locator('.panel').first().screenshot({ path: 'lib.png' })
console.log('wrote lib.png')
await b.close()
