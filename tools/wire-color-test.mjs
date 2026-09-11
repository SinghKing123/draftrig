import { chromium } from 'playwright'
const base = process.env.BASE ?? 'http://localhost:4173'
const b = await chromium.launch({ channel: 'msedge' })
const page = await b.newPage({ viewport: { width: 1300, height: 880 }, deviceScaleFactor: 2 })
const errors = []
page.on('pageerror', (e) => errors.push(e.message))
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()) })

await page.goto(base + '/app', { waitUntil: 'networkidle' })
await page.evaluate(() => localStorage.setItem('tour.seen.v1', '1'))
await page.reload({ waitUntil: 'networkidle' })
await page.waitForTimeout(2200)

await page.evaluate(() => {
  const d = window.draftrig.doc.getState()
  d.addPart('breadboard', [0, 0, 0])
  d.select([])
  d.setMode('wire')
  d.requestFrame('all')
})
await page.waitForTimeout(1500)

console.log('palette shown :', await page.locator('.wire-palette').count() === 1)
console.log('swatches      :', await page.locator('.wp-dot').count())

// Pick green, then wire two terminals and check the wire came out green.
const green = '#3DD68C'
await page.evaluate((c) => window.draftrig.doc.getState().setWireColor(c), green)
await page.waitForTimeout(200)

const box = await page.locator('canvas').first().boundingBox()
const hovering = () => page.evaluate(() => window.__portHover === true)
async function find(skip) {
  let seen = 0
  for (let y = box.y + 150; y < box.y + box.height - 120; y += 16) {
    for (let x = box.x + 220; x < box.x + box.width - 220; x += 16) {
      await page.mouse.move(x, y)
      await page.waitForTimeout(16)
      if (await hovering()) { if (seen++ < skip) continue; return { x, y } }
    }
  }
  return null
}
const a = await find(0)
const c = await find(26)
if (a && c) {
  await page.mouse.click(a.x, a.y)
  await page.waitForTimeout(150)
  await page.mouse.click(c.x, c.y)
  await page.waitForTimeout(300)
  const colors = await page.evaluate(() => {
    const d = window.draftrig.doc.getState().doc
    return d.connectionOrder.map((id) => d.connections[id].color)
  })
  console.log('wire colours  :', colors, colors[0] === '#3DD68C' ? 'OK' : 'FAIL')
} else {
  console.log('could not find two terminals')
}
console.log('errors        :', errors.length ? errors : 'none')
await page.locator('canvas').first().screenshot({ path: 'wire-palette.png' })
await b.close()
