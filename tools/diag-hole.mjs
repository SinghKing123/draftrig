import { chromium } from 'playwright'
const browser = await chromium.launch({ channel: 'msedge', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] })
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
await page.goto('http://localhost:4173/app', { waitUntil: 'networkidle' })
await page.waitForTimeout(3000)
await page.getByRole('button', { name: 'Show me around', exact: true }).click()
await page.waitForTimeout(600)
await page.getByRole('button', { name: 'Next' }).click()
await page.waitForTimeout(900)
console.log(JSON.stringify(await page.evaluate(() => {
  const r = (sel) => {
    const el = document.querySelector(sel)
    if (!el) return null
    const b = el.getBoundingClientRect()
    return { t: Math.round(b.top), l: Math.round(b.left), w: Math.round(b.width), h: Math.round(b.height) }
  }
  const hole = document.querySelector('.tour-hole')
  return {
    holeRect: r('.tour-hole'),
    libRect: r('[data-tour="library"]'),
    holeShadow: hole ? getComputedStyle(hole).boxShadow : null,
    holeBorder: hole ? getComputedStyle(hole).border : null,
  }
}, null), null, 2))
await browser.close()
