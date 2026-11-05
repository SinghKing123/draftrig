import { chromium } from 'playwright'
import { mkdirSync } from 'node:fs'

/**
 * The front page's part search, typed into.
 *
 * A search box is the one thing on a page that cannot be checked from
 * a screenshot of it sitting empty: what matters is what comes back,
 * how it is ordered, and what it says when nothing matches.
 *
 *   node tools/probe-library.mjs
 */

const BASE = process.env.BASE ?? 'http://localhost:5174'
const OUT = 'shots/lib'
mkdirSync(OUT, { recursive: true })

const browser = await chromium.launch({ channel: 'msedge' })
const page = await browser.newPage({ viewport: { width: 1440, height: 980 } })
const problems = []
page.on('console', (m) => {
  if (m.type() === 'error') problems.push(m.text().slice(0, 160))
})
page.on('pageerror', (e) => problems.push('pageerror: ' + e.message.slice(0, 160)))

await page.goto(BASE + '/', { waitUntil: 'networkidle' })
await page.waitForTimeout(3000)
await page.locator('#screens').scrollIntoViewIfNeeded()
await page.waitForTimeout(600)

const box = page.locator('.dr-lib-find input')

for (const q of ['socket', 'kettle lead', 'seat', 'rack', 'resistor', 'zzzz']) {
  await box.fill('')
  await box.type(q, { delay: 24 })
  await page.waitForTimeout(500)

  const report = await page.evaluate(() => {
    const rows = [...document.querySelectorAll('.dr-lib-row')]
    return {
      n: document.querySelector('.dr-lib-find .n')?.textContent ?? '',
      first: rows.slice(0, 5).map((r) => r.querySelector('.dr-lib-name')?.textContent),
      /* Any row whose picture did not arrive is a hole in the list. */
      broken: rows.filter((r) => {
        const img = r.querySelector('img')
        return img && img.complete && img.naturalWidth === 0
      }).length,
      none: document.querySelector('.dr-lib-none')?.textContent?.trim().slice(0, 60) ?? null,
    }
  })
  console.log(`\n"${q}"  ${report.n}${report.broken ? `  BROKEN IMAGES: ${report.broken}` : ''}`)
  console.log('  ' + (report.none ?? report.first.join(' · ')))
  await page.locator('#screens').screenshot({ path: `${OUT}/q-${q.replace(/\s+/g, '-')}.jpg`, type: 'jpeg', quality: 82 })
}

for (const p of problems.slice(0, 6)) console.log('console:', p)
await browser.close()
console.log(`\nshots in ${OUT}/`)
