import { chromium } from 'playwright'
import { mkdirSync } from 'node:fs'

/**
 * The front page, section by section, at two widths.
 *
 * Full-page screenshots are safe here because the viewport runs with
 * `preserveDrawingBuffer`, so the live scene appears in them rather
 * than coming back as a cleared canvas.
 *
 *   node tools/shoot-lp2.mjs
 */

const BASE = process.env.BASE ?? 'http://localhost:5174'
const OUT = 'shots/lp2'
mkdirSync(OUT, { recursive: true })

const browser = await chromium.launch({ channel: 'msedge' })

for (const [tag, width, height] of [
  ['wide', 1440, 980],
  ['phone', 390, 844],
]) {
  const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: 1 })
  const problems = []
  page.on('console', (m) => {
    if (m.type() === 'error') problems.push(m.text().slice(0, 180))
  })
  page.on('pageerror', (e) => problems.push('pageerror: ' + e.message.slice(0, 180)))

  await page.goto(BASE + '/', { waitUntil: 'networkidle' })
  await page.waitForTimeout(6500)

  const shots = [
    ['hero', '.dr-hero'],
    ['two', '#screens'],
    ['solvers', '#asked'],
    ['viewport', '#built'],
    ['close', '.dr-end'],
    ['foot', '.dr-foot'],
  ]
  for (const [name, sel] of shots) {
    const el = await page.$(sel)
    if (!el) {
      problems.push(`no element for ${sel}`)
      continue
    }
    await el.scrollIntoViewIfNeeded()
    await page.waitForTimeout(700)
    await page.screenshot({ path: `${OUT}/${tag}-${name}.jpg`, type: 'jpeg', quality: 80 })
  }

  /* Anything wider than the window is a horizontal scrollbar somebody
     will find on a phone. */
  const over = await page.evaluate(() => {
    const bad = []
    for (const el of document.querySelectorAll('.dr *')) {
      const r = el.getBoundingClientRect()
      if (r.width > 0 && (r.right > window.innerWidth + 1 || r.left < -1)) {
        bad.push(`${el.tagName.toLowerCase()}.${(el.className || '').toString().split(' ')[0]} ${Math.round(r.left)}..${Math.round(r.right)}`)
      }
    }
    return { scroll: document.documentElement.scrollWidth, win: window.innerWidth, bad: bad.slice(0, 8) }
  })

  console.log(`\n${tag} ${width}x${height}`)
  console.log('  scrollWidth', over.scroll, 'window', over.win)
  for (const b of over.bad) console.log('  overflow:', b)
  for (const p of problems.slice(0, 8)) console.log('  console:', p)
  await page.close()
}

await browser.close()
console.log(`\nshots in ${OUT}/`)
