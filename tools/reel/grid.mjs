import { BUILDUP } from './buildup.mjs'

/**
 * A wall of builds putting themselves together.
 *
 * One short loop per build, all the same length and all framed the same way,
 * because they are shown as a grid and a grid of clips that each do their
 * own thing is a mess rather than a wall. The camera drifts a few degrees
 * through each take — enough that the tile is alive, not so much that six of
 * them moving at once is seasick.
 *
 * These are deliberately not the four on the front page. Those are one
 * circuit each, shown close. These are picked for range: a machine across
 * four breadboards, a sensor node, a clock, a lock with a keypad, a
 * scoreboard, a matrix. Different boards, different colours, different
 * shapes, so the wall reads as a catalog rather than a set.
 *
 *   npm run dev
 *   BASE=http://localhost:5173 node tools/reel/run.mjs record grid-
 *   node tools/reel/grid-build.mjs
 */

/** Everything except the bench, same as the front-page clips. */
const BARE = `
  .app { grid-template-rows: 1fr !important; }
  .app-body { grid-template-columns: 1fr !important; }
  .panel, .console, .statusbar, .topbar, .bom-tab, .sketch-tab, .mbar,
  .vp-toolbar, .vp-hint, .vp-modes, .wire-colors, .vp-stats, .empty-hint,
  .inspector, .bom-panel, .sketch-panel { display: none !important; }
  .app-center { border: 0 !important; }
`

const base = {
  /* Tiles, not a hero. Recorded at twice the width they are drawn at and no
     more — six of these is six videos on one page. */
  width: 760,
  height: 570,
  dsf: 1,
  url: '/app',
  style: BARE,
  view: { gizmo: false, ports: false },
  fit: false,
  rate: 4,
  simSpeed: 1,
}

/**
 * One tile.
 *
 * `dist` is eyeballed per build from its finished size — the machine needs
 * four times the room a weather station does — and the camera starts a
 * little off the final angle so the drift has somewhere to go.
 */
const tile = (id, starter, target, dist, az) => ({
  ...base,
  id: `grid-${id}`,
  camera: [az, 46, dist],
  async setup(page) {
    await page.addScriptTag({ content: BUILDUP })
    await page.evaluate(
      ([s, t, a, d]) => {
        window.__buildup.stage(s)
        const c = window.draftrig.camera.controls
        c.target.set(t[0], t[1], t[2])
        c.update()
        return window.__rig.fly(a, 46, d, 1)
      },
      [starter, target, az, dist],
    )
  },
  async perform(page) {
    await page.evaluate(
      async ([a, d]) => {
        const rig = window.__rig
        await Promise.all([
          window.__buildup.play(34, 70),
          rig.fly(a + 26, 40, d * 0.88, 9000),
        ])
        await rig.drift(4, 1500)
      },
      [az, dist],
    )
  },
})

export const GRID_SHOTS = [
  tile('eight-bit', 'eight-bit', [0, 10, 0], 300, 16),
  tile('matrix', 'matrix', [0, 10, -20], 190, -20),
  tile('esp-weather', 'esp-weather', [0, 8, 0], 165, 28),
  tile('bench-clock', 'bench-clock', [0, 8, 0], 175, -12),
  tile('rfid-lock', 'rfid-lock', [0, 10, 0], 235, 40),
  tile('scoreboard', 'scoreboard', [-6, 10, -10], 195, 8),
]
