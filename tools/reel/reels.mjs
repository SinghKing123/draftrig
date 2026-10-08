import { click, moveTo, portAt } from './pointer.mjs'
import { REELS2 } from './reels2.mjs'
import { DISPLAY_REEL } from './display.mjs'
import { SCOREBOARD_REEL } from './scoreboard.mjs'
import { CLIPS } from './clips.mjs'
import { LAB_SHOTS } from './labs.mjs'
import { GRID_SHOTS } from './grid.mjs'

/**
 * The shots, and which reel each belongs to.
 *
 * Three beats each, in the same order every time: a hook shot that is all
 * texture and no interface, a middle shot of the tool being worked, and a
 * payoff. Twenty seconds is not long enough for more than three ideas, and
 * the cuts want to land on the beat rather than wherever a move happened to
 * finish, so every shot is timed rather than performed live.
 */

/** Chrome off, canvas full bleed. What the hook shots are shot through. */
const BARE = `
  .app { grid-template-rows: 1fr !important; }
  .app-body { grid-template-columns: 1fr !important; }
  .panel, .console, .statusbar, .topbar, .ai-fab, .bom-tab,
  .vp-toolbar, .vp-hint, .vp-modes, .wire-colors, .vp-stats { display: none !important; }
  .app-center { border: 0 !important; }
`

/** Enough interface to read as software, without the parts nobody needs. */
const WORKING = `
  .ai-fab, .bom-tab { display: none !important; }
`

/*
 * Portrait shots are captured at the delivery size and performed at a
 * quarter speed. At full quality the screencast manages seven or eight frames
 * a second on a macro shot, which is a third of what the format needs;
 * quartering the performance turns that into thirty.
 */
const PORTRAIT = { width: 1080, height: 1920, dsf: 1, rate: 4 }
/** The axis gizmo is drawn inside the canvas, so CSS cannot reach it. */
const NO_GIZMO = { gizmo: false }
/*
 * Interface shots are framed by punching a 9:16 window out of a landscape
 * frame, which is how software is shot for this format: the whole window
 * scaled down to phone width is unreadable. Captured at twice the delivery
 * size so the window is a downscale rather than a blow-up.
 */
const WIDE = { width: 1600, height: 900, dsf: 2, rate: 5 }

/** A 9:16 window out of a 3200x1800 frame, centred on x (in CSS pixels). */
const punch = (cx) => ({ w: 1012, h: 1800, x: Math.round(cx * 2 - 506), y: 0 })

/* ================================================================== */
/* Reel 1 — wire it up and switch it on                                */
/* ================================================================== */

const r1Hook = {
  id: 'r1-hook',
  ...PORTRAIT,
  url: '/app?start=bench-clock',
  style: BARE,
  view: NO_GIZMO,
  // Buried in the board, so the first frame is texture rather than a diagram:
  // components filling the frame, no horizon, no interface.
  camera: [24, 64, 62],
  async perform(page) {
    await page.evaluate(() => window.__rig.drift(12, 3600))
    await page.evaluate(() => window.__rig.fly(54, 44, 250, 3400))
  },
}

const r1Wire = {
  id: 'r1-wire',
  ...WIDE,
  url: '/app?start=blink555',
  style: WORKING,
  cursor: [1150, 760],
  crop: punch(800),
  camera: [18, 42, 112],
  async setup(page) {
    await page.evaluate(() => {
      const d = window.draftrig.doc.getState()
      // Keep the wiring this build came with, then take it out so it can be
      // put back on camera. Drawing real connections beats miming them: the
      // terminals light up because they are the terminals.
      const doc = d.doc
      window.__wires = doc.connectionOrder
        .map((id) => doc.connections[id])
        .filter((c) => c && c.kind === 'wire')
        .map((c) => ({ a: c.a, b: c.b, color: c.color }))
      d.disconnect(doc.connectionOrder)
      d.setMode('wire')
      d.select([])
    })
  },
  /** Where each connection's two ends are, measured before the tape rolls. */
  async prepare(page) {
    const wires = await page.evaluate(() => window.__wires)
    const runs = []
    for (const w of wires) {
      if (runs.length >= 3) break
      const a = await portAt(page, w.a.instanceId, w.a.portId)
      const b = await portAt(page, w.b.instanceId, w.b.portId)
      if (!a?.onScreen || !b?.onScreen) continue
      // Too short a run reads as one click, not as a connection being made.
      if (Math.hypot(a.x - b.x, a.y - b.y) < 110) continue
      runs.push({ a, b, color: w.color ?? '#E34B4B' })
    }
    return runs
  },
  async perform(page, runs) {
    for (const r of runs) {
      await page.evaluate((c) => window.draftrig.doc.getState().setWireColor(c), r.color)
      await click(page, r.a.x, r.a.y, { travel: 420, settle: 130 })
      await click(page, r.b.x, r.b.y, { travel: 500, settle: 240 })
    }
    await moveTo(page, 1180, 320, 500)
    await page.evaluate(() => window.__rig.hold(400))
  },
}

const r1Run = {
  id: 'r1-run',
  ...PORTRAIT,
  // The 555 rather than the clock: eight parts, no microcontroller, so the
  // solver keeps up and the LED actually blinks. A light that comes on is the
  // clearest thing a circuit can do on camera.
  url: '/app?start=blink555',
  style: BARE,
  view: NO_GIZMO,
  /*
   * Powered, but do not expect the lamp to blink on camera.
   *
   * The solver is budget-limited per frame and at the default 25 us timestep
   * a half-minute capture advances the circuit by about a tenth of a second,
   * which is less than one period of a one-hertz astable. Coarsening the
   * timestep to cover more ground does not work either: at 500 us a single
   * step of this circuit takes long enough that the page stops servicing
   * animation frames, the scripted camera move never finishes, and the shot
   * hangs. So this beat is the finished thing running, framed on the lamp,
   * rather than the lamp flashing.
   */
  simSpeed: 1,
  camera: [38, 50, 140],
  /*
   * Aimed at the LED, because the LED is the payoff.
   *
   * Pushing in on the middle of the document put the last second of the reel
   * on a bare patch of perfboard with the lamp just off the left of frame:
   * a perfboard's centre is not where its components are.
   */
  async prepare(page) {
    await page.evaluate(() => {
      const d = window.draftrig.doc.getState().doc
      const id = d.order.find((i) => d.instances[i].defId === 'led-5mm')
      if (id) window.__rig.lookAt(id)
    })
    return {}
  },
  async perform(page) {
    await page.evaluate(() => {
      // Running, but left in build mode on purpose. Switching the editor to
      // simulate turns on every terminal marker in the document, and a hook
      // shot wants a board, not a board covered in interface dots. The solver
      // does not care which mode the editor is in.
      window.draftrig.engine.reset()
      window.draftrig.sim.getState().setRunning(true)
    })
    await page.evaluate(() => window.__rig.fly(-12, 56, 46, 4200))
    await page.evaluate(() => window.__rig.drift(7, 2400))
  },
}

export const REELS = [
  { id: 'reel1-wire-and-run', shots: [r1Hook, r1Wire, r1Run] },
  ...REELS2,
  DISPLAY_REEL,
  SCOREBOARD_REEL,
]

export const SHOTS = [...REELS.flatMap((r) => r.shots), ...CLIPS, ...LAB_SHOTS, ...GRID_SHOTS]
