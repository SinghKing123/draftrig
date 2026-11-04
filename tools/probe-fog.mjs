import { chromium } from 'playwright'

/**
 * Does the viewport go black when you pull back from a room?
 *
 * The reported glitch was that placing a room and zooming out faded the
 * whole window to black. A screenshot proves it happened; it cannot
 * prove it stopped, because "nearly black" and "black" look the same in
 * a thumbnail. This reads the drawing buffer and reports mean
 * brightness and the fraction of pixels within a hair of the fog
 * colour, at a spread of camera distances, for a room and for a bench
 * build.
 *
 *   node tools/probe-fog.mjs
 */

const BASE = process.env.BASE ?? 'http://localhost:5174'
const CASES = [
  ['home-theatre', [0.6, 1.0, 1.8, 3.0, 6.0]],
  ['blink555', [0.6, 1.0, 1.8, 3.0]],
]

const b = await chromium.launch({ channel: 'msedge' })
const page = await b.newPage({ viewport: { width: 900, height: 600 }, deviceScaleFactor: 1 })
page.on('pageerror', (e) => console.log('ERR', e.message.slice(0, 140)))
await page.goto(BASE + '/app', { waitUntil: 'domcontentloaded' })
await page.evaluate(() => {
  localStorage.setItem('tour.seen.v1', '1')
  localStorage.setItem('draftrig.nav.seen.v1', '1')
})
await page.reload({ waitUntil: 'domcontentloaded' })
await page.waitForTimeout(9000)

for (const [starter, mults] of CASES) {
  await page.evaluate((id) => {
    const s = window.draftrig.starters.find((x) => x.id === id)
    window.draftrig.doc.getState().loadDoc(s.build())
  }, starter)
  await page.waitForTimeout(2500)

  /* The fitted distance, read once, so every sample pulls back from the
     same place rather than from wherever the last one left the camera. */
  const fitted = await page.evaluate(() => {
    const c = window.draftrig.camera.controls
    return c.object.position.distanceTo(c.target)
  })
  console.log(`\n${starter}  fitted at ${Math.round(fitted)} mm`)

  for (const m of mults) {
    const out = await page.evaluate(
      ([d0, mul]) => {
        const c = window.draftrig.camera.controls
        const v = c.object.position.clone().sub(c.target).normalize().multiplyScalar(d0 * mul)
        c.object.position.copy(c.target).add(v)
        c.object.lookAt(c.target)
        c.update()
        return null
      },
      [fitted, m],
    )
    void out
    await page.waitForTimeout(700)
    const px = await page.evaluate(() => {
      const cv = document.querySelector('canvas')
      const tmp = document.createElement('canvas')
      tmp.width = 160
      tmp.height = 110
      const ctx = tmp.getContext('2d')
      ctx.drawImage(cv, 0, 0, tmp.width, tmp.height)
      const { data } = ctx.getImageData(0, 0, tmp.width, tmp.height)
      let sum = 0
      let dark = 0
      const n = data.length / 4
      for (let i = 0; i < data.length; i += 4) {
        const l = (data[i] + data[i + 1] + data[i + 2]) / 3
        sum += l
        /* #0D1117 is 13,17,23 — mean 17.7. Anything under 24 is the fog
           colour and nothing else. */
        if (l < 24) dark++
      }
      return { mean: +(sum / n).toFixed(1), fog: +((dark / n) * 100).toFixed(1) }
    })
    const dist = Math.round(fitted * m)
    const verdict = px.fog > 97 ? '  <-- BLACK' : ''
    console.log(`  ${String(dist).padStart(6)} mm   mean ${String(px.mean).padStart(5)}   fog-coloured ${String(px.fog).padStart(5)}%${verdict}`)
  }
}

await b.close()
