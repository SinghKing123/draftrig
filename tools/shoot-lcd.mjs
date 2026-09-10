import { chromium } from 'playwright'

/**
 * Loads the LCD starter, runs the simulation, and photographs the panel.
 * Verifies through the browser what the unit tests verify headlessly: that
 * the bus traffic ends up as pixels.
 */

const base = process.env.BASE ?? 'http://localhost:4173'
const b = await chromium.launch({ channel: 'msedge' })
const page = await b.newPage({ viewport: { width: 1600, height: 1000 }, deviceScaleFactor: 2 })

const errors = []
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()) })
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message))

await page.goto(base + '/app', { waitUntil: 'networkidle' })
await page.evaluate(() => localStorage.setItem('tour.seen.v1', '1'))
await page.reload({ waitUntil: 'networkidle' })
await page.waitForTimeout(2500)

// Load the starter directly, the same call the welcome dialog makes.
await page.evaluate(() => {
  const s = window.draftrig.starters.find((x) => x.id === 'lcd')
  window.draftrig.doc.getState().loadDoc(s.build())
  window.draftrig.engine.reset()
})
await page.waitForTimeout(600)

// Frame the board, then run.
await page.evaluate(() => {
  window.draftrig.doc.getState().setView({ quality: 'high' })
  window.draftrig.sim.getState().setRunning(true)
})

// Give the sketch enough simulated time to initialise the panel and draw it.
const deadline = Date.now() + 60000
let simTime = 0
while (Date.now() < deadline) {
  await page.waitForTimeout(500)
  simTime = await page.evaluate(() => window.draftrig.sim.getState().time)
  if (simTime > 0.35) break
}

const ratio = await page.evaluate(() => window.draftrig.sim.getState().realtimeRatio)
const issues = await page.evaluate(() =>
  window.draftrig.sim.getState().issues.map((i) => `${i.severity}: ${i.message}`))

console.log('sim time    :', simTime.toFixed(3), 's')
console.log('realtime    :', (ratio * 100).toFixed(1), '%')
console.log('issues      :', issues.length ? issues : 'none')
console.log('console err :', errors.length ? errors : 'none')

await page.screenshot({ path: 'lcd-shot.png' })
console.log('wrote lcd-shot.png')
await b.close()
