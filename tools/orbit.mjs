import { chromium } from 'playwright'

/**
 * Drags an orbit across the viewport and grabs frames during the motion.
 * Z-fighting shows up as bands that move and invert between frames; a stable
 * render looks the same from the same angle.
 */
const base = process.env.BASE ?? 'http://localhost:4173'
const tag = process.argv[2] ?? 'before'
const b = await chromium.launch({ channel: 'msedge' })
const page = await b.newPage({ viewport: { width: 1200, height: 800 }, deviceScaleFactor: 1 })
const errors = []
page.on('pageerror', (e) => errors.push(e.message))

await page.goto(base + '/app', { waitUntil: 'networkidle' })
await page.evaluate(() => localStorage.setItem('tour.seen.v1', '1'))
await page.reload({ waitUntil: 'networkidle' })
await page.waitForTimeout(2200)

await page.evaluate(() => {
  const s = window.draftrig.starters.find((x) => x.id === 'frame')
  window.draftrig.doc.getState().loadDoc(s.build())
})
await page.waitForTimeout(1200)

const canvas = await page.locator('canvas').first().boundingBox()
const cx = canvas.x + canvas.width / 2
const cy = canvas.y + canvas.height / 2

await page.mouse.move(cx, cy)
await page.mouse.down()
for (let i = 0; i < 6; i++) {
  await page.mouse.move(cx + i * 26, cy - i * 5, { steps: 4 })
  await page.waitForTimeout(140)
  await page.locator('canvas').first().screenshot({ path: `orbit-${tag}-${i}.png` })
}
await page.mouse.up()
console.log('errors:', errors.length ? errors : 'none')
console.log(`wrote orbit-${tag}-0..5.png`)
await b.close()
