import { chromium } from 'playwright'
const base = process.env.BASE ?? 'http://localhost:4173'
const b = await chromium.launch({ channel: 'msedge' })
const page = await b.newPage({ viewport: { width: 1300, height: 900 }, deviceScaleFactor: 2 })
const errors = []
page.on('pageerror', (e) => errors.push(e.message))
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()) })

// Make a few projects from starters so the list has something in it.
await page.goto(base + '/app', { waitUntil: 'networkidle' })
await page.evaluate(() => localStorage.setItem('tour.seen.v1', '1'))
for (const id of ['gaming-1440', 'lcd', 'frame']) {
  await page.goto(base + '/app', { waitUntil: 'networkidle' })
  await page.waitForTimeout(2200)
  await page.evaluate((s) => {
    const st = window.draftrig.starters.find((x) => x.id === s)
    window.draftrig.doc.getState().loadDoc(st.build())
  }, id)
  await page.waitForTimeout(3200)
}

await page.goto(base + '/projects', { waitUntil: 'networkidle' })
await page.waitForTimeout(1400)
const cards = await page.locator('.proj').count()
const withThumbs = await page.locator('.proj .thumb img').count()
console.log('cards          :', cards)
console.log('with thumbnails:', withThumbs)
console.log('errors         :', errors.length ? errors : 'none')
await page.screenshot({ path: 'projects.png' })
console.log('wrote projects.png')
await b.close()
