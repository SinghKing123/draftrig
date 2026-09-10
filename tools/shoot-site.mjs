import { chromium } from 'playwright'
const base = process.env.BASE ?? 'http://localhost:4173'
const b = await chromium.launch({ channel: 'msedge' })
const page = await b.newPage({ viewport: { width: 1440, height: 950 }, deviceScaleFactor: 2 })
const errors = []
page.on('pageerror', (e) => errors.push(e.message))
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()) })

await page.goto(base + '/', { waitUntil: 'networkidle' })
await page.waitForTimeout(1400)
await page.screenshot({ path: 'site-hero.png' })
// Scroll through so the reveals fire, then take a full page shot.
for (let y = 0; y < 6; y++) {
  await page.mouse.wheel(0, 900)
  await page.waitForTimeout(320)
}
await page.waitForTimeout(700)
await page.screenshot({ path: 'site-full.png', fullPage: true })
console.log('title  :', await page.title())
console.log('errors :', errors.length ? errors : 'none')
await b.close()
