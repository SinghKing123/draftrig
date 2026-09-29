import { chromium } from 'playwright'
import { mkdirSync } from 'node:fs'

/**
 * Terminals in wire mode, close enough to see where they are.
 *
 * The thing to look for is marks on the components, not just on the board.
 * Nearly every through-hole part puts its terminal at the tip of the lead,
 * facing down, so before terminals were marked at both ends of their pin
 * every one of these was under the board and the camera cannot go below the
 * horizon to find it.
 */
const base = process.env.BASE ?? 'http://localhost:5173'
const OUT = process.env.SHOT_DIR || 'shots'
mkdirSync(OUT, { recursive: true })
const b = await chromium.launch({ channel: 'msedge' })
const page = await b.newPage({ viewport: { width: 1200, height: 820 }, deviceScaleFactor: 2 })
await page.goto(base + '/app?start=blink555', { waitUntil: 'networkidle' })
await page.evaluate(() => {
  localStorage.setItem('tour.seen.v1', '1')
  localStorage.setItem('draftrig.nav.seen.v1', '1')
  localStorage.setItem('draftrig.bom.open.v1', '0')
})
await page.reload({ waitUntil: 'networkidle' })
await page.waitForTimeout(5000)
await page.evaluate(() => window.draftrig.doc.getState().setMode('wire'))
await page.waitForTimeout(400)
// Frame the 555 and the resistors beside it, close.
await page.evaluate(() => {
  const d = window.draftrig.doc.getState().doc
  const ids = d.order.filter((i) => /555|resistor/i.test(d.instances[i].defId + d.instances[i].name))
  window.draftrig.doc.getState().select(ids.slice(0, 2))
})
await page.waitForTimeout(200)
await page.keyboard.press('f')
await page.waitForTimeout(1400)
await page.evaluate(() => window.draftrig.camera?.view(30, 42))
await page.evaluate(() => window.draftrig.camera?.controls && (window.draftrig.camera.controls.object.position.lerp(window.draftrig.camera.controls.target, 0.62), window.draftrig.camera.controls.update()))
await page.waitForTimeout(1400)
await page.mouse.move(2, 2)
await page.evaluate(() => window.draftrig.doc.getState().select([]))
await page.waitForTimeout(500)
await page.locator('.viewport-wrap').screenshot({ path: `${OUT}/wire-closeup.png` })
console.log('ok')
await b.close()
