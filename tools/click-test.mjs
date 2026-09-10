import { chromium } from 'playwright'
const base = process.env.BASE ?? 'http://localhost:4173'
const b = await chromium.launch({ channel: 'msedge' })
const page = await b.newPage({ viewport: { width: 1200, height: 800 } })
await page.goto(base + '/app', { waitUntil: 'networkidle' })
await page.evaluate(() => localStorage.setItem('tour.seen.v1', '1'))
await page.reload({ waitUntil: 'networkidle' })
await page.waitForTimeout(2200)
await page.evaluate(() => {
  const s = window.draftrig.starters.find((x) => x.id === 'frame')
  window.draftrig.doc.getState().loadDoc(s.build())
})
await page.waitForTimeout(1200)

const box = await page.locator('canvas').first().boundingBox()
const cx = box.x + box.width / 2
const cy = box.y + box.height / 2

const sel = () => page.evaluate(() => window.draftrig.doc.getState().selection.length)
const hovered = () => page.evaluate(() => window.draftrig.doc.getState().hovered)

// Find a pixel that is actually over a part, rather than guessing at one.
let hit = null
outer: for (let dy = -160; dy <= 160 && !hit; dy += 40) {
  for (let dx = -200; dx <= 200; dx += 40) {
    await page.mouse.move(cx + dx, cy + dy)
    await page.waitForTimeout(60)
    if (await hovered()) { hit = { x: cx + dx, y: cy + dy }; break outer }
  }
}
if (!hit) { console.log('could not find a part under the cursor'); await b.close(); process.exit(1) }
console.log('part found at offset', hit.x - cx, hit.y - cy)

// Press on a part, hold, release: the selection must survive the release.
await page.mouse.move(hit.x, hit.y)
await page.mouse.down()
await page.waitForTimeout(120)
const whileHeld = await sel()
await page.mouse.up()
await page.waitForTimeout(250)
const afterRelease = await sel()

// Clicking empty space should still clear it.
await page.mouse.click(box.x + box.width - 60, box.y + 110)
await page.waitForTimeout(250)
const afterMiss = await sel()

// Orbiting from empty space must not clear a selection.
await page.mouse.move(hit.x, hit.y)
await page.mouse.down()
await page.mouse.up()
await page.waitForTimeout(200)
const reselected = await sel()
await page.mouse.move(box.x + 60, box.y + 300)
await page.mouse.down()
await page.mouse.move(box.x + 200, box.y + 260, { steps: 8 })
await page.mouse.up()
await page.waitForTimeout(250)
const afterOrbit = await sel()

console.log('selected while held  :', whileHeld)
console.log('after release        :', afterRelease, afterRelease > 0 ? 'OK' : 'FAIL, deselected on release')
console.log('after clicking empty :', afterMiss, afterMiss === 0 ? 'OK' : 'FAIL, should clear')
console.log('reselected           :', reselected)
console.log('after orbit drag     :', afterOrbit, afterOrbit > 0 ? 'OK' : 'FAIL, orbit cleared it')
await b.close()
