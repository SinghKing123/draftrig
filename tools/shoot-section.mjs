import { chromium } from 'playwright'
import { mkdirSync } from 'node:fs'

/**
 * Photographs one anchored section of the front page, once it has settled.
 *
 * The whole-page shooter walks six viewports down from the top, which is
 * fine for a page of text and useless for a section that is three
 * screens down and only starts working when it is reached: the live
 * floor downloads twenty-six megabytes of mesh on an intersection
 * observer, so a shot taken before the scroll is a shot of a poster.
 *
 *   node tools/shoot-section.mjs floor out/dir [settleMs]
 *
 * BASE  dev server (default http://localhost:5174)
 */

const BASE = process.env.BASE ?? 'http://localhost:5174'
const [id, out = 'shots/section', settle = '18000'] = process.argv.slice(2)

mkdirSync(out, { recursive: true })
const browser = await chromium.launch({ channel: 'msedge' })

for (const [tag, w, h] of [
  ['d', 1440, 900],
  ['m', 390, 844],
]) {
  const page = await browser.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: 1 })
  const problems = []
  page.on('pageerror', (e) => problems.push(e.message.slice(0, 160)))
  page.on('console', (m) => m.type() === 'error' && problems.push(m.text().slice(0, 160)))
  /* Count the mesh actually pulled, so the figure on the page can be
     checked against the figure on the wire rather than trusted. */
  let bytes = 0
  let files = 0
  page.on('response', (r) => {
    if (!r.url().includes('/models/')) return
    files++
    const n = Number(r.headers()['content-length'] ?? 0)
    bytes += n
  })

  await page.goto(BASE + '/', { waitUntil: 'domcontentloaded' })
  await page.evaluate((anchor) => document.getElementById(anchor)?.scrollIntoView(), id)
  await page.waitForTimeout(Number(settle))
  await page.evaluate((anchor) => document.getElementById(anchor)?.scrollIntoView(), id)
  await page.waitForTimeout(1200)

  await page.screenshot({ path: `${out}/${tag}.jpg`, type: 'jpeg', quality: 78 })
  console.log(
    `${tag} models=${files} ${(bytes / 1048576).toFixed(1)}MB ${problems.length ? problems.join(' | ') : 'clean'}`,
  )
  await page.close()
}

await browser.close()
