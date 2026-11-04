import { chromium } from 'playwright'
import { mkdirSync } from 'node:fs'

/**
 * Photographs the front page, desktop and phone, in viewport slices.
 *
 * A full-page screenshot captures every scroll-triggered section in its
 * pre-animation state, so the result is a column of empty boxes and tells
 * you nothing. This scrolls, waits for the entrance to finish, and shoots
 * what a reader actually sees.
 *
 *   node tools/shoot-lp.mjs [outDir]
 *
 * BASE  dev server (default http://localhost:5175)
 */

const BASE = process.env.BASE ?? 'http://localhost:5175'
const OUT = process.argv[2] ?? 'shots/lp'
const SIZES = [
  ['d', 1440, 900, 6],
  ['m', 390, 844, 7],
]

mkdirSync(OUT, { recursive: true })
const browser = await chromium.launch({ channel: 'msedge' })

for (const [tag, w, h, slices] of SIZES) {
  const page = await browser.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: 1 })
  const problems = []
  page.on('pageerror', (e) => problems.push(e.message.slice(0, 140)))
  page.on('console', (m) => m.type() === 'error' && problems.push(m.text().slice(0, 140)))

  await page.goto(BASE + '/', { waitUntil: 'networkidle' })
  await page.waitForTimeout(1400)

  for (let i = 0; i < slices; i++) {
    if (i) {
      await page.evaluate((px) => window.scrollBy(0, px * 0.94), h)
      await page.waitForTimeout(1100)
    }
    await page.screenshot({ path: `${OUT}/${tag}-${i}.jpg`, type: 'jpeg', quality: 74 })
  }

  const check = await page.evaluate(() => ({
    height: Math.round(document.documentElement.scrollHeight),
    overflow: document.documentElement.scrollWidth > window.innerWidth + 1,
    broken: [...document.images].filter((im) => im.complete && !im.naturalWidth).map((im) => im.getAttribute('src')),
  }))
  console.log(`${tag} h=${check.height} overflow=${check.overflow} broken=${JSON.stringify(check.broken)} ${problems.length ? problems.join(' | ') : 'clean'}`)
  await page.close()
}

await browser.close()
