import { chromium } from 'playwright'
import { mkdirSync } from 'node:fs'

/**
 * Selects a wire in a running build and photographs its panel.
 *
 * The numbers in that panel come from the solver, so this runs the
 * simulation before looking: a wire panel on a stopped bench reports
 * "not running" and proves nothing.
 *
 *   node tools/shoot-wire.mjs [starterId]
 */

const BASE = process.env.BASE ?? 'http://localhost:5174'
const OUT = 'shots/editor'
const starter = process.argv[2] ?? 'wire-and-run'

mkdirSync(OUT, { recursive: true })

const browser = await chromium.launch({ channel: 'msedge' })
const page = await browser.newPage({ viewport: { width: 1680, height: 1000 }, deviceScaleFactor: 1 })

const problems = []
page.on('pageerror', (e) => problems.push('pageerror: ' + e.message.slice(0, 200)))
page.on('console', (m) => { if (m.type() === 'error') problems.push(m.text().slice(0, 200)) })

await page.addInitScript(() => {
  localStorage.setItem('tour.seen.v1', '1')
  localStorage.setItem('draftrig.used.v1', '1')
})
await page.goto(BASE + '/app', { waitUntil: 'networkidle' })
await page.waitForFunction(() => typeof window.draftrig?.doc?.getState === 'function', { timeout: 30000 })

const loaded = await page.evaluate((id) => {
  const s = window.draftrig.starters.find((x) => x.id === id) ?? window.draftrig.starters[0]
  const d = window.draftrig.doc.getState()
  d.loadDoc(s.build())
  d.requestFrame('all')
  window.draftrig.engine.reset()
  window.draftrig.sim.getState().setRunning(true)
  return { name: s.id, wires: window.draftrig.doc.getState().doc.connectionOrder.length }
}, starter)
await page.waitForTimeout(3200)

// Pick the wire carrying the most current: the one with something to report.
const picked = await page.evaluate(() => {
  const d = window.draftrig.doc.getState()
  const wireI = window.draftrig.sim.getState().wireI
  const ids = d.doc.connectionOrder.filter((c) => d.doc.connections[c].kind === 'wire')
  if (!ids.length) return null
  ids.sort((a, b) => Math.abs(wireI[b] ?? 0) - Math.abs(wireI[a] ?? 0))
  d.selectWire(ids[0])
  return { id: ids[0], amps: wireI[ids[0]] ?? 0 }
})
await page.waitForTimeout(900)

await page.screenshot({ path: `${OUT}/wire-panel.png` })
console.log(`  ${loaded.name}: ${loaded.wires} connections, picked ${JSON.stringify(picked)}`)
if (problems.length) console.log('  errors: ' + problems.join('\n          '))

await browser.close()
