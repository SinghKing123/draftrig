import { BUILD as DISPLAY_BUILD } from './display.mjs'

/**
 * Short silent clips for the front page.
 *
 * Landscape, a few seconds each, and every one is a single continuous take of
 * the editor doing something real — no pointer choreography, because a cursor
 * jerking around a screen recording is the thing that makes software look
 * amateur. The document and the camera move; that is all.
 *
 * They loop, so each one ends close to where it began.
 *
 *   npm run dev
 *   BASE=http://localhost:5173 node tools/reel/run.mjs record clip-
 *   node tools/reel/clips-build.mjs
 */

/** Everything except the bench. */
const BARE = `
  .app { grid-template-rows: 1fr !important; }
  .app-body { grid-template-columns: 1fr !important; }
  .panel, .console, .statusbar, .topbar, .bom-tab, .sketch-tab, .mbar,
  .vp-toolbar, .vp-hint, .vp-modes, .wire-colors, .vp-stats, .empty-hint,
  .inspector, .bom-panel, .sketch-panel { display: none !important; }
  .app-center { border: 0 !important; }
`

const base = {
  width: 1280,
  height: 720,
  dsf: 1,
  url: '/app',
  style: BARE,
  view: { gizmo: false, ports: false },
  fit: false,
}

/** Load a starter and park the camera, without the rig re-framing afterwards. */
const stage = (starter, target, az, pol, dist) => async (page) => {
  await page.evaluate(
    ([id, t, a, p, d]) => {
      const s = window.draftrig.starters.find((x) => x.id === id)
      const doc = window.draftrig.doc.getState()
      if (s) doc.loadDoc(s.build())
      doc.select([])
      window.draftrig.engine.reset()
      const c = window.draftrig.camera.controls
      c.target.set(t[0], t[1], t[2])
      const rad = (v) => (v * Math.PI) / 180
      c.object.position.set(
        t[0] + d * Math.sin(rad(p)) * Math.sin(rad(a)),
        t[1] + d * Math.cos(rad(p)),
        t[2] + d * Math.sin(rad(p)) * Math.cos(rad(a)),
      )
      c.object.lookAt(c.target)
      c.update()
    },
    [starter, target, az, pol, dist],
  )
}

/* ------------------------------------------------------------------ */

/** A board assembling itself: parts landing, then the wiring drawn on. */
export const CLIP_ASSEMBLE = {
  ...base,
  id: 'clip-assemble',
  rate: 6,
  simSpeed: 1,
  camera: [30, 62, 150],
  async setup(page) {
    await page.addScriptTag({ content: DISPLAY_BUILD })
    await page.evaluate(() => {
      window.__display.stage()
      const c = window.draftrig.camera.controls
      c.target.set(0, 6, -20)
      c.update()
    })
  },
  async perform(page) {
    await page.evaluate(async (slow) => {
      const rig = window.__rig
      window.draftrig.engine.reset()
      window.draftrig.sim.getState().setRunning(true)
      await Promise.all([
        window.__display.play(slow),
        (async () => {
          await rig.fly(52, 58, 168, 5400)
          await rig.fly(6, 40, 120, 4200)
        })(),
      ])
      await rig.drift(5, 2600)
    }, 6)
  },
}

/** A finished board, running. The panel is lit because the solver lit it. */
export const CLIP_RUN = {
  ...base,
  id: 'clip-run',
  rate: 4,
  simSpeed: 1,
  camera: [26, 54, 230],
  setup: stage('scoreboard', [-6, 10, -10], 26, 54, 260),
  async perform(page) {
    await page.evaluate(async () => {
      const rig = window.__rig
      window.draftrig.engine.reset()
      window.draftrig.sim.getState().setRunning(true)
      await rig.fly(-6, 44, 150, 5200)
      await rig.fly(22, 56, 215, 5200)
    })
  },
}

/** A slow pass over a dense bench: the wiring, close enough to read. */
export const CLIP_WIRE = {
  ...base,
  id: 'clip-wire',
  rate: 4,
  simSpeed: 1,
  camera: [40, 48, 130],
  setup: stage('bench-clock', [-4, 10, 4], 40, 48, 130),
  async perform(page) {
    await page.evaluate(async () => {
      const rig = window.__rig
      window.draftrig.engine.reset()
      window.draftrig.sim.getState().setRunning(true)
      await rig.fly(-18, 42, 108, 5600)
      await rig.fly(38, 50, 134, 5000)
    })
  },
}

/** Breadth: four different builds, each turning, cut together. */
export const CLIP_BUILDS = {
  ...base,
  id: 'clip-builds',
  rate: 4,
  simSpeed: 1,
  camera: [30, 56, 300],
  setup: stage('rfid-lock', [0, 10, 0], 30, 56, 300),
  async perform(page) {
    await page.evaluate(async () => {
      const rig = window.__rig
      const show = (id, target, dist) => {
        const s = window.draftrig.starters.find((x) => x.id === id)
        const doc = window.draftrig.doc.getState()
        if (s) doc.loadDoc(s.build())
        doc.select([])
        window.draftrig.engine.reset()
        window.draftrig.sim.getState().setRunning(true)
        const c = window.draftrig.camera.controls
        c.target.set(target[0], target[1], target[2])
        c.object.position.set(target[0] + dist * 0.5, target[1] + dist * 0.6, target[2] + dist * 0.75)
        c.object.lookAt(c.target)
        c.update()
      }
      const beat = async (id, target, dist) => {
        show(id, target, dist)
        await rig.drift(9, 2600)
      }
      /* Four circuits, and no machines.
         The rover and the router were two of these until motion turned out
         to be the one thing the simulator does not do; a clip is an advert,
         and those two were advertising it. */
      await beat('matrix', [0, 10, -20], 230)
      await beat('logic-bench', [0, 10, 0], 230)
      await beat('rfid-lock', [0, 10, 0], 300)
      await beat('esp-weather', [0, 8, 0], 200)
    })
  },
}

export const CLIPS = [CLIP_ASSEMBLE, CLIP_RUN, CLIP_WIRE, CLIP_BUILDS]
