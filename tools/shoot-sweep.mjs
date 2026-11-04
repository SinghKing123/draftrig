import { chromium } from 'playwright'
import { mkdirSync, writeFileSync } from 'node:fs'

/**
 * A contact sheet of one build from several cameras.
 *
 * Framing a room is not framing a board. A board is an object on a bench
 * and almost any three-quarter view of it reads; a room is a space you are
 * inside, and the difference between a photograph of it and a photograph
 * of a wall is twenty degrees. Guessing one angle at a time, at a minute a
 * guess, is how the theatre went unphotographed for a week.
 *
 *   node tools/shoot-sweep.mjs home-theatre out/dir "180,72,0.5" "200,68,0.45"
 *
 * Each extra argument is azimuth,polar,fill. Overrides for the room's
 * walls are applied as the preset tool applies them, so the sweep sees
 * what the preset will see.
 */

const base = process.env.BASE ?? 'http://localhost:5174'
const [id, out, ...angles] = process.argv.slice(2)
/*
 * Two kinds of argument:
 *   azimuth,polar,fill            the orbit rig, for an object on a bench
 *   at:x,y,z/to:x,y,z             an explicit camera, for the inside of a room
 */
const SHOTS = angles.map((a) => {
  if (!a.startsWith('at:')) return a.split(',').map(Number)
  const [at, to] = a.split('/')
  return { at: at.slice(3).split(',').map(Number), to: to.slice(3).split(',').map(Number) }
})
const SET = { 'room-shell': { walls: 'corner' } }

mkdirSync(out, { recursive: true })
const b = await chromium.launch({ channel: 'msedge' })
const page = await b.newPage({ viewport: { width: 860, height: 538 }, deviceScaleFactor: 2 })
await page.goto(base + '/app', { waitUntil: 'domcontentloaded' })
await page.evaluate(() => {
  localStorage.setItem('tour.seen.v1', '1')
  localStorage.setItem('draftrig.nav.seen.v1', '1')
})
await page.reload({ waitUntil: 'domcontentloaded' })
await page.waitForTimeout(9000)

await page.evaluate(() => {
  const d = window.draftrig.doc.getState()
  d.pinQuality('high')
  d.setView({ gizmo: false, grid: false, ports: false })
})
await page.addStyleTag({
  content: `
    .vp-toolbar, .vp-hint, .vp-stats, .vp-modes, .wire-colors, .bom-tab,
    .sketch-tab, .mbar, .vp-empty, .empty-hint { display: none !important; }
    .ws, .ai-fab, .app-notice { display: none !important; }
    .app { grid-template-rows: 1fr !important; }
    .app-body { grid-template-columns: 1fr !important; }
    .app-body > .panel, .app-body > .bom-panel, .app-body > .sketch-panel { display: none !important; }
    .app-center { border: 0 !important; }
    .app-center > .console, .topbar, .statusbar { display: none !important; }
  `,
})
await page.waitForTimeout(400)
const vp = page.viewportSize()
await page.setViewportSize({ width: vp.width - 1, height: vp.height })
await page.waitForTimeout(900)

await page.evaluate(({ starter, set }) => {
  const s = window.draftrig.starters.find((x) => x.id === starter)
  const d = window.draftrig.doc.getState()
  d.loadDoc(s.build())
  const cur = window.draftrig.doc.getState()
  for (const instId of cur.doc.order) {
    const over = set[cur.doc.instances[instId].defId]
    if (!over) continue
    for (const [k, v] of Object.entries(over)) cur.setParam(instId, k, v)
  }
  window.draftrig.engine.reset()
  window.draftrig.sim.getState().setRunning(true)
  d.select([])
}, { starter: id, set: SET })

await page.evaluate(() => window.draftrig.doc.getState().requestFrame('all'))
await page.waitForTimeout(1800)
await page.mouse.move(2, 2)
await page.evaluate(() => {
  const d = window.draftrig.doc.getState()
  d.clearSelection()
  d.setHovered(null)
})
await page.waitForTimeout(600)

/* The fitted distance, read once, so every frame pulls in from the same
   place rather than from wherever the last one left the camera. */
const fitted = await page.evaluate(() => {
  const c = window.draftrig.camera.controls
  return c.object.position.distanceTo(c.target)
})

let n = 0
for (const shotSpec of SHOTS) {
  if (shotSpec.at) {
    /*
     * An explicit camera, in millimetres.
     *
     * The orbit rig cannot photograph the inside of a room. It places the
     * camera on a sphere around the document's centre, and for a 4.8 x 6.6 m
     * room every radius that is short enough to be inside the walls is also
     * short enough to be inside one of them: four attempts came back as a
     * flat grey field, which was the back wall at point-blank range. An
     * interior shot is a position and a thing to look at, so it is given
     * as a position and a thing to look at.
     */
    await page.evaluate(([at, to]) => {
      const c = window.draftrig.camera.controls
      c.target.set(to[0], to[1], to[2])
      c.object.position.set(at[0], at[1], at[2])
      c.object.lookAt(c.target)
      c.update()
    }, [shotSpec.at, shotSpec.to])
  } else {
    const [az, pol, fill] = shotSpec
    await page.evaluate(([a, p, f, d0]) => {
      window.draftrig.camera.view(a, p)
      const c = window.draftrig.camera.controls
      const v = c.object.position.clone().sub(c.target).normalize().multiplyScalar(d0 * f)
      c.object.position.copy(c.target).add(v)
      c.object.lookAt(c.target)
      c.update()
    }, [az, pol, fill, fitted])
  }
  await page.waitForTimeout(900)
  const shot = await page.evaluate(() => document.querySelector('canvas').toDataURL('image/jpeg', 0.82))
  const name = shotSpec.at
    ? `${id}-at${shotSpec.at.join('_')}-to${shotSpec.to.join('_')}.jpg`
    : `${id}-a${shotSpec[0]}-p${shotSpec[1]}-f${String(shotSpec[2]).replace('.', '')}.jpg`
  writeFileSync(`${out}/${name}`, Buffer.from(shot.split(',')[1], 'base64'))
  console.log(`${++n}. ${name}`)
}

await b.close()
