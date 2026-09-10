import { chromium } from 'playwright'
const base = process.env.BASE ?? 'http://localhost:4173'
const b = await chromium.launch({ channel: 'msedge' })
const page = await b.newPage({ viewport: { width: 1000, height: 700 }, deviceScaleFactor: 1 })
await page.goto(base + '/app', { waitUntil: 'networkidle' })
await page.evaluate(() => localStorage.setItem('tour.seen.v1', '1'))
await page.reload({ waitUntil: 'networkidle' })
await page.waitForTimeout(2200)
await page.evaluate(() => {
  const s = window.draftrig.starters.find((x) => x.id === 'frame')
  window.draftrig.doc.getState().loadDoc(s.build())
  window.draftrig.doc.getState().select([])
})
await page.waitForTimeout(1000)

const cases = [
  ['all-on', { quality: 'high', shadows: true, grid: true }],
  ['no-shadow', { quality: 'high', shadows: false, grid: true }],
  ['no-postfx', { quality: 'off', shadows: true, grid: true }],
  ['neither', { quality: 'off', shadows: false, grid: true }],
  ['no-grid', { quality: 'high', shadows: true, grid: false }],
]
for (const [name, view] of cases) {
  await page.evaluate((v) => window.draftrig.doc.getState().setView(v), view)
  await page.waitForTimeout(900)
  await page.locator('canvas').first().screenshot({ path: `iso-${name}.png` })
  console.log('wrote iso-' + name + '.png')
}
await b.close()
