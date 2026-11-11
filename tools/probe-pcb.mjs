import { chromium } from 'playwright'

/**
 * The board workspace, driven the way a hand drives it.
 *
 * The arithmetic has unit tests. What they cannot cover is whether the
 * clicks land: whether pressing 3 opens the workspace, whether the
 * circuit arrives on the board arranged, whether a click on a pad
 * starts a run and a click on its partner finishes one, and whether the
 * net list then says that net is routed.
 *
 * It opens a starter that is a real circuit, routes one net end to end
 * by pointing at the two pads the net list says are unrouted, and
 * checks the count of routed nets went up by exactly one.
 *
 *   node tools/probe-pcb.mjs [baseUrl]
 */

const BASE = process.argv[2] ?? 'http://localhost:4179'
const SHOT = 'C:/Users/aryan/AppData/Local/Temp/claude/86a6f29862cc08de/db28cbbf-0297-4773-9e67-ec0dd1d35e99/scratchpad/'

const browser = await chromium.launch({ channel: 'msedge' })
const page = await browser.newPage({ viewport: { width: 1500, height: 920 } })

const errors = []
page.on('pageerror', (e) => errors.push(String(e)))
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()))

await page.goto(BASE + '/app?start=blink555', { waitUntil: 'networkidle' })
await page.waitForFunction(() => typeof window.draftrig?.doc?.getState === 'function', { timeout: 40000 })

const skip = page.getByRole('button', { name: 'Skip' })
if (await skip.count()) await skip.first().click()
await page.waitForTimeout(500)

const parts = await page.evaluate(() => window.draftrig.doc.getState().doc.order.length)
console.log(`starter loaded: ${parts} parts`)

/* ---- open the workspace ---- */
await page.getByRole('tab', { name: 'Board' }).click()
await page.waitForSelector('.pcb-canvas svg', { timeout: 10000 })
await page.waitForTimeout(900)

const board = await page.evaluate(() => {
  const b = window.draftrig.doc.getState().doc.pcb
  return b ? { w: b.w, h: b.h, placed: Object.keys(b.placements).length } : null
})
console.log(`board on open: ${board ? `${board.w}x${board.h} mm, ${board.placed} parts placed` : 'NONE'}`)

const drawn = await page.evaluate(() => ({
  pads: document.querySelectorAll('.pcb-pad').length,
  rats: document.querySelectorAll('.pcb-rats line').length,
  nets: document.querySelectorAll('.pcb-net').length,
}))
console.log(`drawn: ${drawn.pads} pads, ${drawn.rats} ratsnest lines, ${drawn.nets} nets`)

const routedBefore = await page.evaluate(() => document.querySelectorAll('.pcb-net[data-routed]').length)
console.log(`routed before: ${routedBefore} of ${drawn.nets}`)

await page.screenshot({ path: SHOT + 'pcb-open.png' })

/* ---- route one net by hand ---- */
/*
 * The two pads to click, worked out in board millimetres and turned
 * into page pixels with the same transform the canvas uses. Picking
 * them from the document rather than by hunting the screen is what
 * makes this a test of the interaction and not of my aim.
 */
const target = await page.evaluate(() => {
  const st = window.draftrig
  const doc = st.doc.getState().doc
  const pcb = doc.pcb
  const nets = st.pcb.buildNets(doc)
  const flat = st.pcb.flatten(doc, pcb, nets)
  const conn = st.pcb.Connectivity.of(flat)

  for (const net of nets.list) {
    const pads = net.pads.map((p) => flat.padByKey.get(`${p.instanceId}:${p.portId}`)).filter(Boolean)
    if (pads.length !== 2) continue
    if (conn.joined(pads[0].key, pads[1].key)) continue
    return { net: net.name, a: pads[0].at, b: pads[1].at }
  }
  return null
})

if (!target) throw new Error('no unrouted two-pad net to route')
console.log(`routing ${target.net}: ${target.a.map((v) => v.toFixed(1))} -> ${target.b.map((v) => v.toFixed(1))}`)

const view = await page.evaluate(() => {
  const s = window.draftrig.board.getState()
  const r = document.querySelector('.pcb-canvas').getBoundingClientRect()
  return { zoom: s.zoom, pan: s.pan, r: { x: r.x, y: r.y, w: r.width, h: r.height } }
})
const toPage = (p) => [
  view.r.x + view.r.w / 2 + (p[0] - view.pan[0]) * view.zoom,
  view.r.y + view.r.h / 2 - (p[1] - view.pan[1]) * view.zoom,
]

const pa = toPage(target.a)
const pb = toPage(target.b)

await page.mouse.move(pa[0], pa[1])
await page.waitForTimeout(150)
await page.mouse.click(pa[0], pa[1])
await page.waitForTimeout(200)
const started = await page.evaluate(() => !!window.draftrig.board.getState().pending)
console.log(`run started by clicking a pad: ${started}`)

await page.mouse.move(pb[0], pb[1], { steps: 12 })
await page.waitForTimeout(200)
await page.screenshot({ path: SHOT + 'pcb-routing.png' })
await page.mouse.click(pb[0], pb[1])
await page.waitForTimeout(350)

const after = await page.evaluate(() => {
  const b = window.draftrig.doc.getState().doc.pcb
  return {
    tracks: b.trackOrder.length,
    pending: !!window.draftrig.board.getState().pending,
    routed: document.querySelectorAll('.pcb-net[data-routed]').length,
    rats: document.querySelectorAll('.pcb-rats line').length,
  }
})
console.log(`after: ${after.tracks} track(s), pending=${after.pending}, routed=${after.routed}, rats=${after.rats}`)
console.log(`routed went ${routedBefore} -> ${after.routed} (want +1), rats ${drawn.rats} -> ${after.rats} (want -1)`)

/* ---- the rule checker noticed ---- */
const drc = await page.evaluate(() => ({
  items: document.querySelectorAll('.pcb-drc button').length,
  first: document.querySelector('.pcb-drc-title')?.textContent ?? null,
  count: document.querySelector('.pcb-count')?.textContent ?? null,
}))
console.log(`drc: ${drc.items} items, first "${drc.first}", toolbar says "${drc.count}"`)

/* ---- export ---- */
const zip = await page.evaluate(() => {
  const st = window.draftrig
  const doc = st.doc.getState().doc
  const nets = st.pcb.buildNets(doc)
  const flat = st.pcb.flatten(doc, doc.pcb, nets)
  const files = st.pcb.gerberFiles(doc.pcb, flat, doc.name)
  return files.map((f) => `${f.name} (${f.text.length}B)`)
})
console.log('gerber job:')
for (const f of zip) console.log('  ' + f)

/* ---- a via, dropped mid-run, carries the net to the other side ---- */
await page.getByRole('radio', { name: 'Route' }).click()
const second = await page.evaluate(() => {
  const st = window.draftrig
  const doc = st.doc.getState().doc
  const nets = st.pcb.buildNets(doc)
  const flat = st.pcb.flatten(doc, doc.pcb, nets)
  const conn = st.pcb.Connectivity.of(flat)
  for (const net of nets.list) {
    const pads = net.pads.map((p) => flat.padByKey.get(`${p.instanceId}:${p.portId}`)).filter(Boolean)
    if (pads.length !== 2 || conn.joined(pads[0].key, pads[1].key)) continue
    return { net: net.name, a: pads[0].at, b: pads[1].at }
  }
  return null
})
if (second) {
  const qa = toPage(second.a)
  const qb = toPage(second.b)
  const midPt = [(qa[0] + qb[0]) / 2, (qa[1] + qb[1]) / 2]
  await page.mouse.click(qa[0], qa[1])
  await page.mouse.move(midPt[0], midPt[1], { steps: 8 })
  await page.mouse.click(midPt[0], midPt[1])
  await page.keyboard.press('v')
  await page.waitForTimeout(150)
  const onBottom = await page.evaluate(() => window.draftrig.board.getState().layer)
  await page.mouse.move(qb[0], qb[1], { steps: 8 })
  await page.mouse.click(qb[0], qb[1])
  await page.waitForTimeout(250)
  const viaState = await page.evaluate(() => {
    const b = window.draftrig.doc.getState().doc.pcb
    return { vias: b.viaOrder.length, tracks: b.trackOrder.length, routed: document.querySelectorAll('.pcb-net[data-routed]').length }
  })
  console.log(`via run on ${second.net}: layer became ${onBottom}, ${viaState.vias} via(s), ${viaState.tracks} tracks, ${viaState.routed} nets routed`)
  await page.getByRole('radio', { name: 'Top' }).click()
}

/* ---- move a part, rotate it, and take it back ---- */
await page.getByRole('radio', { name: 'Move' }).click()
const movable = await page.evaluate(() => {
  const b = window.draftrig.doc.getState().doc.pcb
  const id = Object.keys(b.placements)[0]
  return { id, at: [b.placements[id].x, b.placements[id].y], rot: b.placements[id].rot }
})
const from = toPage(movable.at)
await page.mouse.move(from[0], from[1])
await page.mouse.down()
await page.mouse.move(from[0] + 40, from[1] - 30, { steps: 10 })
await page.mouse.up()
await page.waitForTimeout(200)
await page.keyboard.press('r')
await page.waitForTimeout(150)
const moved = await page.evaluate((id) => {
  const pl = window.draftrig.doc.getState().doc.pcb.placements[id]
  return { at: [pl.x, pl.y], rot: pl.rot }
}, movable.id)
console.log(`moved ${movable.at.map((v) => v.toFixed(1))} -> ${moved.at.map((v) => v.toFixed(1))}, rot ${movable.rot} -> ${moved.rot}`)

await page.keyboard.press('Control+z')
await page.keyboard.press('Control+z')
await page.waitForTimeout(250)
const undone = await page.evaluate((id) => {
  const pl = window.draftrig.doc.getState().doc.pcb.placements[id]
  return { at: [pl.x, pl.y], rot: pl.rot }
}, movable.id)
const back = Math.abs(undone.at[0] - movable.at[0]) < 0.01 && Math.abs(undone.at[1] - movable.at[1]) < 0.01
console.log(`undo put it back: ${back} (rot ${undone.rot})`)

/* ---- the board survives a save and an open ---- */
const round = await page.evaluate(() => {
  const doc = window.draftrig.doc.getState().doc
  const text = JSON.stringify({ format: 'draftrig', version: 1, savedAt: '', doc })
  const back = JSON.parse(text).doc
  return {
    tracks: [doc.pcb.trackOrder.length, back.pcb.trackOrder.length],
    placements: [Object.keys(doc.pcb.placements).length, Object.keys(back.pcb.placements).length],
    size: [`${doc.pcb.w}x${doc.pcb.h}`, `${back.pcb.w}x${back.pcb.h}`],
  }
})
console.log(`save round trip: tracks ${round.tracks.join(' -> ')}, placements ${round.placements.join(' -> ')}, size ${round.size.join(' -> ')}`)

const dl = page.waitForEvent('download', { timeout: 15000 })
await page.getByRole('button', { name: /Gerbers and drill/i }).click()
const file = await dl
console.log(`downloaded: ${file.suggestedFilename()}`)

await page.screenshot({ path: SHOT + 'pcb-done.png' })
console.log(`console errors: ${errors.length}${errors.length ? ' -> ' + errors[0].slice(0, 200) : ''}`)

await browser.close()
