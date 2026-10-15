import { BUILDUP } from './buildup.mjs'

/**
 * Four builds assembling themselves, from a camera that never moves.
 *
 * Different job from the wall tiles. Those are decoration on a page and the
 * camera drifts to keep them alive; these are meant to be watched, and the
 * thing being watched is the build. A camera that pans while parts arrive
 * splits the attention between two motions, and the one nobody came for
 * wins. So: parked, square on, whole object in frame, and the only thing
 * that changes is the object.
 *
 * Square. The builds are wider than they are tall and these are for feeds
 * that are taller than they are wide, and 1:1 is the format that does not
 * ruin either — a 520 mm router frame still fits across it.
 *
 * Framing is arithmetic, not taste: visible height is 2·d·tan(fov/2), which
 * at 36° is 0.65·d, so a build's largest dimension sets the distance and a
 * quarter is added for air.
 *
 *   npm run dev
 *   BASE=http://localhost:5173 node tools/reel/run.mjs record asmr-
 *   node tools/reel/asmr-build.mjs
 */

/** Everything except the bench. */
const BARE = `
  .app { grid-template-rows: 1fr !important; }
  .app-body { grid-template-columns: 1fr !important; }
  .panel, .console, .statusbar, .topbar, .bom-tab, .sketch-tab, .mbar,
  .vp-toolbar, .vp-hint, .vp-modes, .wire-colors, .vp-stats, .empty-hint,
  .inspector, .bom-panel, .sketch-panel, .nav-help, .acct { display: none !important; }
  .app-center { border: 0 !important; }
`

const base = {
  width: 1000,
  height: 1000,
  dsf: 1,
  url: '/app',
  style: BARE,
  view: { gizmo: false, ports: false },
  fit: false,
  rate: 4,
  simSpeed: 1,
}

/**
 * One take.
 *
 * `span` is the build's largest dimension in millimetres; the distance
 * follows from it. `steps` is how many times the document is handed back a
 * longer prefix of itself — more steps is a smoother assembly and a longer
 * recording, and a heavy build pays for each one twice because the whole
 * scene is rebuilt.
 */
const take = (id, starter, target, span, az, polar = 56, steps = 64) => ({
  ...base,
  id: `asmr-${id}`,
  camera: [az, polar, (span * 1.25) / 0.65],
  async setup(page) {
    await page.addScriptTag({ content: BUILDUP })
    await page.evaluate(
      ([s, t, a, p, d]) => {
        window.__buildup.stage(s)
        const c = window.draftrig.camera.controls
        c.target.set(t[0], t[1], t[2])
        c.update()
        return window.__rig.fly(a, p, d, 1)
      },
      [starter, target, az, polar, (span * 1.25) / 0.65],
    )
  },
  async perform(page) {
    /*
     * Nothing but the build: no fly, no drift — and the camera held there.
     *
     * It stays put because the assembler writes the document straight into
     * the store rather than through loadDoc, which bumps the token the
     * camera rig re-frames on. Held with a timer first, which fought the
     * rig every step and lost about a third of the time.
     *
     * It does not power up at the end either: that moved the view for the
     * last second of every take, and these end on the finished object.
     */
    await page.evaluate(async (n) => {
      await window.__buildup.play(n, 60, false)
      await new Promise((r) => setTimeout(r, 900))
    }, steps)
  },
})

export const ASMR_SHOTS = [
  // The complicated one: ply, a panel, a stick, a computer and a loom.
  /* Span is the cabinet's height plus its depth, not its width: it is the
     tallest thing here and a high angle makes a tall object taller. */
  take('arcade', 'arcade', [0, 260, 0], 820, 198, 50, 76),
  // Mechanics.
  take('cnc-router', 'cnc-router', [0, 200, 0], 1020, 24, 44),
  take('rover', 'rover', [0, 30, 0], 250, -18, 56),
  // Electronics.
  take('eight-bit', 'eight-bit', [0, 10, 0], 300, 16, 46),
]
