import { chromium } from 'playwright'

/** Full-page and section shots of the front page, for reviewing it. */
const base = process.env.BASE ?? 'http://localhost:5173'
const b = await chromium.launch({ channel: 'msedge' })
const page = await b.newPage({ viewport: { width: 1440, height: 960 }, deviceScaleFactor: 1.5 })
const errors = []
page.on('pageerror', (e) => errors.push(e.message))
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()) })

await page.goto(base + '/', { waitUntil: 'networkidle' })
await page.waitForTimeout(2500)
await page.screenshot({ path: 'site-hero2.jpg', type: 'jpeg', quality: 80 })
console.log('hero')

for (const [sel, name] of [['#builds', 'builds'], ['#parts', 'parts'], ['#solver', 'solver']]) {
  await page.locator(sel).scrollIntoViewIfNeeded()
  await page.waitForTimeout(900)
  await page.screenshot({ path: `site-${name}.jpg`, type: 'jpeg', quality: 80 })
  console.log(name)
}
console.log('errors:', errors.length ? errors.slice(0, 5) : 'none')
await b.close()
