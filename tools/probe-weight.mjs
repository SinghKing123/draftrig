import { chromium } from 'playwright'

/**
 * What the front page actually costs a visitor, by kind.
 *
 * The live room is 26 MB of mesh, so it is desktop-only: `Landing`
 * does not mount it below 900px and no .glb is asked for. Run this at
 * 390 and at 1440 to see both bills.
 *
 * Most of what lands in 'other' is blob: URLs, which are textures the
 * loader pulls out of the glb files in memory rather than anything
 * fetched over the wire.
 *
 *   node tools/probe-weight.mjs [url] [width]
 */

const URL = process.argv[2] ?? 'https://draftrig.com/'
const WIDTH = Number(process.argv[3] ?? 390)
const WINDOW = 20000

const browser = await chromium.launch({ channel: 'msedge' })
const page = await browser.newPage({ viewport: { width: WIDTH, height: 844 } })

const bytes = new Map()
page.on('response', async (res) => {
  try {
    const len = Number(res.headers()['content-length'] ?? 0)
    const url = res.url()
    const kind = /\.glb$/i.test(url)
      ? 'meshes (.glb)'
      : /\/shots\/parts\//.test(url)
        ? 'part thumbnails'
        : /\.(jpg|jpeg|png|webp|avif)$/i.test(url)
          ? 'other images'
          : /\.js$/i.test(url)
            ? 'script'
            : /\.css$/i.test(url)
              ? 'style'
              : /\.(woff2?|ttf)$/i.test(url)
                ? 'fonts'
                : 'other'
    bytes.set(kind, (bytes.get(kind) ?? 0) + len)
  } catch {
    /* a response that never completed is not a cost anybody paid */
  }
})

const t0 = Date.now()
await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 60000 })
await page.waitForTimeout(WINDOW)

const mb = (n) => (n / 1048576).toFixed(2).padStart(7) + ' MB'
const rows = [...bytes.entries()].sort((a, b) => b[1] - a[1])
const total = rows.reduce((s, [, n]) => s + n, 0)

console.log(`\n${URL}  at ${WIDTH}px, ${((Date.now() - t0) / 1000).toFixed(0)}s after navigation\n`)
for (const [kind, n] of rows) console.log(`  ${mb(n)}  ${kind}`)
console.log(`  ${'-'.repeat(10)}`)
console.log(`  ${mb(total)}  total`)

await browser.close()
