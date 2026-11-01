import { chromium } from 'playwright'
import { mkdirSync, rmSync } from 'node:fs'

/**
 * Scrolls the front page the way a visitor does and photographs each screen.
 *
 * This is the only capture that tells the truth about this page. `fullPage`
 * re-renders the document at its whole height, which strands every sticky
 * element at its start and leaves the scroll runway of the walkthrough as a
 * screen of blank paper; and it gives lazy images and videos no reason to
 * have loaded. Here each step is a real scroll position, settled.
 */

const BASE = process.env.BASE ?? 'http://localhost:5174'
const W = Number(process.env.W ?? 1440)
const H = Number(process.env.H ?? 900)
const OUT = process.env.OUT ?? 'shots/site/walk'

rmSync(OUT, { recursive: true, force: true })
mkdirSync(OUT, { recursive: true })

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 2 })

const errors = []
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()))
page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`))
const bad = new Set()
page.on('response', (r) => r.status() >= 400 && bad.add(`HTTP ${r.status()} ${new URL(r.url()).pathname}`))
page.on('requestfailed', (r) => bad.add(`${r.failure()?.errorText} ${new URL(r.url()).pathname}`))

await page.goto(BASE + '/', { waitUntil: 'networkidle' })
await page.waitForTimeout(1600)

const total = await page.evaluate(() => document.documentElement.scrollHeight)
const step = Math.round(H * 0.9)
const n = Math.ceil((total - H) / step) + 1
console.log(`page ${total}px at ${W}x${H} → ${n} screens`)

for (let i = 0; i < n; i++) {
  const y = Math.min(i * step, total - H)
  await page.evaluate((v) => window.scrollTo(0, v), y)
  // Long enough for a Reveal to finish and for a lazy image to arrive.
  await page.waitForTimeout(1100)
  await page.screenshot({ path: `${OUT}/${String(i).padStart(2, '0')}-y${y}.png` })
}

/* Now that every section has been scrolled through, lazy media has had its
   chance — so this is the point at which an unloaded asset is a real fault. */
const media = await page.evaluate(() => ({
  imgs: [...document.querySelectorAll('.lp img')]
    .filter((i) => !i.complete || i.naturalWidth === 0)
    .map((i) => i.getAttribute('src')),
  vids: [...document.querySelectorAll('.lp video')].map((v) => ({
    src: (v.currentSrc || v.getAttribute('src') || '').split('/').pop(),
    ready: v.readyState,
    w: v.videoWidth,
    err: v.error?.code ?? null,
  })),
  sections: [...document.querySelectorAll('.lp > section, .lp > div > section, .lp section')]
    .map((s) => s.className)
    .filter(Boolean)
    .slice(0, 20),
}))

console.log(`\nunloaded images: ${media.imgs.length}`)
media.imgs.forEach((s) => console.log('  ' + s))
const badVids = media.vids.filter((v) => v.ready < 3 || v.w === 0 || v.err)
console.log(`videos: ${media.vids.length}, not decoding: ${badVids.length}`)
badVids.slice(0, 12).forEach((v) => console.log(`  ${v.src} ready=${v.ready} ${v.w}px err=${v.err}`))
console.log(`\nsections: ${[...new Set(media.sections)].join(' | ')}`)
console.log(`\nconsole errors: ${errors.length}`)
errors.slice(0, 8).forEach((e) => console.log('  ' + e))
console.log(`failed requests: ${bad.size}`)
;[...bad].slice(0, 12).forEach((f) => console.log('  ' + f))

await browser.close()
