import { chromium } from 'playwright'
const base = process.env.BASE ?? 'http://localhost:4173'
const which = process.argv[2] ?? 'pc'
const b = await chromium.launch({ channel: 'msedge' })
const page = await b.newPage({ viewport: { width: 1500, height: 950 }, deviceScaleFactor: 2 })
const errors = []
page.on('pageerror', (e) => errors.push(e.message))
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()) })
await page.goto(base + '/app', { waitUntil: 'networkidle' })
await page.evaluate(() => localStorage.setItem('tour.seen.v1', '1'))
await page.reload({ waitUntil: 'networkidle' })
await page.waitForTimeout(2200)

await page.evaluate((id) => {
  const s = window.draftrig.starters.find((x) => x.id === id)
  window.draftrig.doc.getState().loadDoc(s.build())
  window.draftrig.engine.reset()
  window.draftrig.doc.getState().select([])
}, which)
await page.waitForTimeout(2000)

const issues = await page.evaluate(() =>
  window.draftrig.sim.getState().issues.map((i) => `${i.severity}: ${i.message}`))
const parts = await page.evaluate(() => window.draftrig.doc.getState().doc.order.length)
console.log('parts  :', parts)
console.log('checks :')
for (const i of issues) console.log('   ', i)
console.log('errors :', errors.length ? errors : 'none')
await page.screenshot({ path: `pc-${which}.png` })
console.log(`wrote pc-${which}.png`)
await b.close()
