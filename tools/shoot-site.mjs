import { chromium } from 'playwright'
import { mkdirSync } from 'node:fs'

/**
 * Photographs the front page at the sizes it is actually read at.
 *
 * Full-page at each width, plus the console log and any horizontal overflow,
 * because those are the two faults a screenshot does not show: a page can
 * look right in a picture and still be throwing on load or scrolling
 * sideways on a phone.
 */

const BASE = process.env.BASE ?? 'http://localhost:5174'
const OUT = 'shots/site'

const SIZES = [
  { id: 'desk', width: 1512, height: 950 },
  { id: 'laptop', width: 1280, height: 800 },
  { id: 'tablet', width: 834, height: 1112 },
  { id: 'phone', width: 390, height: 844 },
  { id: 'narrow', width: 360, height: 780 },
]

mkdirSync(OUT, { recursive: true })

const browser = await chromium.launch()
let bad = 0

for (const s of SIZES) {
  // `viewport`, not `viewportSize`. The latter is the name of the page
  // method; as a creation option it is ignored silently, and every shot comes
  // out at the default 1280 wide — which looks like a page that does not
  // respond to width at all, because every capture was the same width.
  const page = await browser.newPage({ viewport: { width: s.width, height: s.height }, deviceScaleFactor: 2 })

  const errors = []
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()))
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`))

  await page.goto(BASE + '/', { waitUntil: 'networkidle' })
  // The entrance motion is scroll- and intersection-driven, so settle it.
  await page.waitForTimeout(1400)

  // Walk the page so every Reveal has fired before the full-page shot.
  await page.evaluate(async () => {
    const step = Math.round(window.innerHeight * 0.8)
    for (let y = 0; y < document.body.scrollHeight; y += step) {
      window.scrollTo(0, y)
      await new Promise((r) => setTimeout(r, 120))
    }
    window.scrollTo(0, 0)
  })
  await page.waitForTimeout(900)

  await page.screenshot({ path: `${OUT}/${s.id}-top.png` })
  await page.screenshot({ path: `${OUT}/${s.id}-full.png`, fullPage: true })

  const m = await page.evaluate(() => {
    const d = document.documentElement
    const over = [...document.querySelectorAll('.lp *')]
      .filter((e) => e.getBoundingClientRect().right > window.innerWidth + 1)
      .slice(0, 6)
      .map((e) => `${e.tagName.toLowerCase()}.${(e.className || '').toString().split(' ')[0]} → ${Math.round(e.getBoundingClientRect().right)}px`)
    return {
      scrollW: d.scrollWidth,
      clientW: d.clientWidth,
      height: d.scrollHeight,
      over,
      // Anything that reads as a layout fault without being one visually.
      empty: [...document.querySelectorAll('.lp h1, .lp h2, .lp h3')].filter((h) => !h.textContent.trim()).length,
    }
  })

  const sideways = m.scrollW > m.clientW + 1
  if (sideways || errors.length || m.empty) bad++

  console.log(
    `${s.id.padEnd(7)} ${String(s.width).padStart(4)}px  page ${String(m.height).padStart(5)}px  ` +
      `${sideways ? `SIDEWAYS ${m.scrollW}>${m.clientW}` : 'no h-scroll'}  ` +
      `${errors.length ? `${errors.length} console error(s)` : 'console clean'}` +
      `${m.empty ? `  ${m.empty} EMPTY HEADING(S)` : ''}`,
  )
  for (const o of m.over) console.log(`         overflow: ${o}`)
  for (const e of errors.slice(0, 4)) console.log(`         ${e}`)

  await page.close()
}

await browser.close()
console.log(`\n${bad ? `${bad} size(s) with faults` : 'all sizes clean'} — shots in ${OUT}/`)
