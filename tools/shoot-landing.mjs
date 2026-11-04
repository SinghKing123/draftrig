import { chromium } from 'playwright'
import { mkdirSync } from 'node:fs'

/**
 * Photographs the front page at both widths and reports what is wrong.
 *
 * Three things it checks that a screenshot alone does not: a page error at
 * any scroll position, horizontal overflow, and images that resolved to
 * nothing. The last one is the useful one — a card pointing at a preset
 * that was never shot looks like a dark tile in a dark row and is invisible
 * in a screenshot taken a second before it would have failed.
 *
 *   node tools/shoot-landing.mjs
 *
 * Writes shots/landing/f-<width>-<scroll>.png
 */

mkdirSync('shots/landing', { recursive: true })

const b = await chromium.launch({ channel: 'msedge' })
for (const [n, w, h] of [['d', 1440, 900], ['m', 390, 844]]) {
  const page = await b.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: n === 'm' ? 2 : 1 })
  const errs = []
  page.on('pageerror', (e) => errs.push(e.message.slice(0, 120)))
  await page.goto('http://localhost:5174/', { waitUntil: 'networkidle' })
  await page.evaluate(async () => {
    for (let y = 0; y < document.body.scrollHeight; y += 500) { window.scrollTo(0, y); await new Promise((r) => setTimeout(r, 55)) }
    window.scrollTo(0, 0)
  })
  await page.waitForTimeout(4000)
  const marks = n === 'd' ? [0, 1500, 2300, 3200, 5200, 7000] : [0, 1100, 2300, 3600, 5200]
  for (const y of marks) {
    await page.evaluate((v) => window.scrollTo(0, v), y)
    await page.waitForTimeout(800)
    await page.screenshot({ path: `shots/landing/f-${n}-${y}.png` })
  }
  const over = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1)
  const height = await page.evaluate(() => document.body.scrollHeight)
  const broken = await page.evaluate(() => [...document.images].filter((i) => i.complete && i.naturalWidth === 0).map((i) => i.src.split('/').pop()))
  console.log(n, 'h=' + height, 'overflow=' + over, 'brokenImages=' + JSON.stringify(broken), errs.length ? 'ERR ' + errs.join('|') : 'clean')
  await page.close()
}
await b.close()
