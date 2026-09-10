import { chromium } from 'playwright'
const base = process.env.BASE ?? 'http://localhost:4173'
const b = await chromium.launch({ channel: 'msedge' })
const page = await b.newPage({ viewport: { width: 1300, height: 900 }, deviceScaleFactor: 2 })
await page.goto(base + '/', { waitUntil: 'networkidle' })
await page.waitForTimeout(900)
// Scroll it into view so the reveal fires, otherwise the shot is a blank box.
await page.locator('.demo').scrollIntoViewIfNeeded()
await page.waitForTimeout(1100)
const info = await page.evaluate(() => {
  const r = document.querySelector('.demo .figures')
  const l = document.querySelector('.demo .figures .line')
  const cs = (el) => el ? getComputedStyle(el) : null
  return {
    figuresDisplay: cs(r)?.display,
    lineDisplay: cs(l)?.display,
    lineWidth: l?.getBoundingClientRect().width,
    stageCols: cs(document.querySelector('.demo .stage'))?.gridTemplateColumns,
  }
})
console.log(JSON.stringify(info, null, 2))
await page.locator('.demo').screenshot({ path: 'demo.png' })
console.log('wrote demo.png')
await b.close()
