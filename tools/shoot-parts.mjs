import { chromium } from 'playwright'

/**
 * Contact sheet for reviewing part models.
 *
 * Lays a list of parts out on a grid in the editor and photographs the lot in
 * one frame, so a batch of new geometry can be looked at without opening the
 * app twenty times. Spacing is per part because a resistor and a two-metre
 * cable do not share a sensible cell size.
 *
 *   node tools/shoot-parts.mjs out.png 'wire-hookup@260' 'led-5mm@40'
 *
 * The number after @ is the cell size in millimetres. Default 90.
 */

const base = process.env.BASE ?? 'http://localhost:5173'
const [outFile, ...specs] = process.argv.slice(2)
if (!outFile || specs.length === 0) {
  console.error('usage: node tools/shoot-parts.mjs <out.png> <partId[@cell]> ...')
  process.exit(1)
}

const items = specs.map((s) => {
  const [id, cell] = s.split('@')
  const [defId, ...pairs] = id.split(':')
  const params = {}
  for (const kv of pairs) {
    const [k, v] = kv.split('=')
    params[k] = /^-?\d+(\.\d+)?$/.test(v) ? Number(v) : v === 'true' ? true : v === 'false' ? false : v
  }
  return { defId, params, cell: cell ? Number(cell) : 90 }
})

const b = await chromium.launch({ channel: 'msedge' })
const page = await b.newPage({ viewport: { width: 1500, height: 950 }, deviceScaleFactor: 2 })
const errors = []
page.on('pageerror', (e) => errors.push(e.message))
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()) })

await page.goto(base + '/app', { waitUntil: 'networkidle' })
await page.evaluate(() => localStorage.setItem('tour.seen.v1', '1'))
await page.reload({ waitUntil: 'networkidle' })
await page.waitForTimeout(2400)
await page.addStyleTag({
  content: `
    .vp-toolbar, .vp-hint, .vp-stats, .ai-fab, .wire-palette, .vp-empty { display: none !important; }
    .app-body { grid-template-columns: 1fr !important; }
    .app-body > aside, .app-body > .panel, .app-body > :last-child { display: none !important; }
    .app-body > .app-center { display: flex !important; flex-direction: column; }
    .app-center > :last-child { display: none !important; }
  `,
})

const missing = await page.evaluate((list) => {
  const d = window.draftrig.doc.getState()
  d.loadDoc({ name: 'Sheet', instances: {}, order: [], connections: {}, connectionOrder: [] })

  // Square-ish grid, laid out left to right then front to back.
  const cols = Math.ceil(Math.sqrt(list.length))
  const cell = Math.max(...list.map((i) => i.cell))
  const bad = []
  list.forEach((item, i) => {
    const cx = (i % cols) - (cols - 1) / 2
    const cz = Math.floor(i / cols) - (Math.ceil(list.length / cols) - 1) / 2
    const id = d.addPart(item.defId, [cx * cell, 0, cz * cell], item.params)
    if (!id) bad.push(item.defId)
    // Keep the height the editor seated it at. Forcing y = 0 buried every
    // part whose origin is not on its underside, screws first.
    else d.moveInstance(id, [cx * cell, window.draftrig.doc.getState().doc.instances[id].pos[1], cz * cell], true)
  })
  d.select([])
  d.requestFrame('all')
  return bad
}, items)

await page.waitForTimeout(2000)

// Framing the whole document leaves a generous margin, which on a sheet of
// small parts means they are photographed as specks. Close in afterwards.
{
  const zoom = Number(process.env.ZOOM ?? 3)
  const box = await page.locator('canvas').first().boundingBox()
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
  for (let i = 0; i < zoom; i++) {
    await page.mouse.wheel(0, -220)
    await page.waitForTimeout(140)
  }
  await page.waitForTimeout(700)
}

await page.locator('canvas').first().screenshot({ path: outFile })
console.log('wrote', outFile)
if (missing.length) console.log('unknown part ids:', missing)
console.log('errors:', errors.length ? errors.slice(0, 5) : 'none')
await b.close()
