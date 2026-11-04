import { chromium } from 'playwright'

/**
 * How long the live floor actually takes, cold.
 *
 * The section downloads tens of megabytes of mesh and parses all of
 * it, and a screenshot taken at an arbitrary moment cannot tell a slow
 * scene from a stuck one. This prints the placement curve — parts
 * placed against wall-clock — plus the bytes on the wire and anything
 * the page threw, including unhandled rejections, which do not reach
 * the usual error hook and are exactly how a scene stops halfway with
 * no message.
 *
 *   node tools/probe-floor-load.mjs [seconds]
 */

const BASE = process.env.BASE ?? 'http://localhost:5174'
const LIMIT = Number(process.argv[2] ?? 90) * 1000

const b = await chromium.launch({ channel: 'msedge' })
const page = await b.newPage({ viewport: { width: 1440, height: 900 } })
page.on('pageerror', (e) => console.log('PAGEERROR', e.message.slice(0, 200)))
page.on('console', (m) => m.type() === 'error' && console.log('CONSOLE', m.text().slice(0, 200)))
await page.addInitScript(() => {
  addEventListener('unhandledrejection', (e) => {
    console.error('UNHANDLED ' + (e.reason?.stack || e.reason?.message || String(e.reason)).slice(0, 300))
  })
})

let bytes = 0
let files = 0
page.on('response', (r) => {
  if (!r.url().includes('/models/')) return
  files++
  bytes += Number(r.headers()['content-length'] ?? 0)
})

await page.goto(BASE + '/', { waitUntil: 'domcontentloaded' })
await page.waitForSelector('#floor', { timeout: 30000 })
await page.evaluate(() => document.getElementById('floor').scrollIntoView())
const t0 = Date.now()

let last = ''
while (Date.now() - t0 < LIMIT) {
  const txt = await page.evaluate(() => document.querySelector('.fl-load')?.textContent?.trim() ?? 'DONE')
  if (txt !== last) {
    console.log(`${((Date.now() - t0) / 1000).toFixed(1)}s  ${txt}  (${files} files, ${(bytes / 1048576).toFixed(1)} MB)`)
    last = txt
  }
  if (txt === 'DONE' && files > 0) break
  await page.waitForTimeout(500)
}
console.log(`final: ${files} files, ${(bytes / 1048576).toFixed(1)} MB in ${((Date.now() - t0) / 1000).toFixed(1)}s`)
await b.close()
