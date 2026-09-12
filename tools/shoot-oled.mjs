import { chromium } from 'playwright'

const base = process.env.BASE ?? 'http://localhost:5173'
const b = await chromium.launch({ channel: 'msedge' })
const page = await b.newPage({ viewport: { width: 1400, height: 900 }, deviceScaleFactor: 2 })
const errors = []
page.on('pageerror', (e) => errors.push(e.message))
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()) })

await page.goto(base + '/app', { waitUntil: 'networkidle' })
await page.evaluate(() => localStorage.setItem('tour.seen.v1', '1'))
await page.reload({ waitUntil: 'networkidle' })
await page.waitForTimeout(2400)
await page.addStyleTag({ content: `
  .vp-toolbar, .vp-hint, .vp-stats, .ai-fab, .wire-palette, .vp-empty { display: none !important; }
  .app-body { grid-template-columns: 1fr !important; }
  .app-body > aside, .app-body > .panel, .app-body > :last-child { display: none !important; }
  .app-body > .app-center { display: flex !important; flex-direction: column; }
  .app-center > :last-child { display: none !important; }
` })

await page.evaluate(() => {
  const s = window.draftrig.starters.find((x) => x.id === 'oled')
  window.draftrig.doc.getState().loadDoc(s.build())
  window.draftrig.engine.reset()
  window.draftrig.doc.getState().select([])
  window.draftrig.sim.getState().setRunning(true)
})

// Wait for simulated time to pass the point where the first frame has landed.
const deadline = Date.now() + 180000
while (Date.now() < deadline) {
  await page.waitForTimeout(500)
  const t = await page.evaluate(() => window.draftrig.sim.getState().time)
  if (t > 3) break
}
await page.evaluate(() => {
  const d = window.draftrig.doc.getState()
  const id = d.doc.order.find((i) => d.doc.instances[i].defId === 'display-oled')
  d.select([id]); d.requestFrame('selection')
})
await page.waitForTimeout(1600)
await page.evaluate(() => window.draftrig.doc.getState().select([]))
{
  const box = await page.locator('canvas').first().boundingBox()
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
  for (let i = 0; i < 6; i++) { await page.mouse.wheel(0, -200); await page.waitForTimeout(120) }
}
await page.waitForTimeout(400)
await page.locator('canvas').first().screenshot({ path: 'oled-shot.png' })
console.log('simulated time', await page.evaluate(() => window.draftrig.sim.getState().time))
console.log('errors:', errors.length ? errors.slice(0, 4) : 'none')
await b.close()
