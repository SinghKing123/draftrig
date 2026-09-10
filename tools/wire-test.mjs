import { chromium } from 'playwright'

/**
 * How forgiving is terminal picking?
 *
 * Measured two ways: the true radius, on a part sitting on its own so nothing
 * else can be nearer, and then a real wiring run on a breadboard, which is the
 * dense case. Before screen-space picking a terminal was a two pixel dot.
 */
const base = process.env.BASE ?? 'http://localhost:4173'
const b = await chromium.launch({ channel: 'msedge' })
const page = await b.newPage({ viewport: { width: 1280, height: 860 } })
const errors = []
page.on('pageerror', (e) => errors.push(e.message))
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()) })

const hovering = () => page.evaluate(() => window.__portHover === true)

async function reset(build) {
  await page.evaluate((fn) => {
    const d = window.draftrig.doc.getState()
    d.loadDoc({ name: 'test', instances: {}, order: [], connections: {}, connectionOrder: [] })
    new Function('d', fn)(d)
    d.select([])
    d.setMode('wire')
    d.requestFrame('all')
  }, build)
  await page.waitForTimeout(1500)
}

/** Scan the viewport for a point that hovers a terminal. */
async function findHover(box, step = 14, skip = 0) {
  let seen = 0
  for (let y = box.y + 120; y < box.y + box.height - 90; y += step) {
    for (let x = box.x + 200; x < box.x + box.width - 200; x += step) {
      await page.mouse.move(x, y)
      await page.waitForTimeout(18)
      if (await hovering()) {
        if (seen++ < skip) continue
        return { x, y }
      }
    }
  }
  return null
}

await page.goto(base + '/app', { waitUntil: 'networkidle' })
await page.evaluate(() => localStorage.setItem('tour.seen.v1', '1'))
await page.reload({ waitUntil: 'networkidle' })
await page.waitForTimeout(2200)
const box = await page.locator('canvas').first().boundingBox()

/* ---- 1. true radius, on a lone resistor ---- */
await reset("d.addPart('resistor-axial', [0, 0, 0])")
const lone = await findHover(box, 10)
let radius = 0
if (lone) {
  for (let dx = 1; dx <= 60; dx++) {
    await page.mouse.move(lone.x + dx, lone.y)
    await page.waitForTimeout(16)
    if (!(await hovering())) break
    radius = dx
  }
}
console.log('isolated terminal found  :', lone ? 'yes' : 'no')
console.log('pick radius, px          :', radius)

/* ---- 2. a real wiring run on a breadboard ---- */
await reset("d.addPart('breadboard', [0, 0, 0])")
const a = await findHover(box, 16, 0)
const c = await findHover(box, 16, 24)
if (!a || !c) {
  console.log('could not find two terminals to wire')
} else {
  await page.mouse.click(a.x, a.y)
  await page.waitForTimeout(180)
  const armed = !!(await page.evaluate(() => window.draftrig.doc.getState().pendingWire))
  await page.mouse.move(c.x, c.y)
  await page.waitForTimeout(120)
  await page.mouse.click(c.x, c.y)
  await page.waitForTimeout(280)
  const wires = await page.evaluate(() => window.draftrig.doc.getState().doc.connectionOrder.length)
  console.log('armed after first click  :', armed)
  console.log('wires made               :', wires, wires === 1 ? 'OK' : 'FAIL')
}

console.log('errors                   :', errors.length ? errors : 'none')
await b.close()
