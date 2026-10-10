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
 * Picked for range, and half of them are not circuits at all: a router
 * frame in extrusion, a four-wheel rover, a servo linkage, a machine across
 * four breadboards, a sensor node and a finished clock. A wall of six boards
 * says the editor does boards; this says what it actually does.
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
const tile = (id, starter, target, dist, az, polar = 46) => ({
  ...base,
  id: `grid-${id}`,
  camera: [az, polar, dist],
  async setup(page) {
    await page.addScriptTag({ content: BUILDUP })
    await page.evaluate(
      ([s, t, a, d, p]) => {
        window.__buildup.stage(s)
        const c = window.draftrig.camera.controls
        c.target.set(t[0], t[1], t[2])
        c.update()
        return window.__rig.fly(a, p, d, 1)
      },
      [starter, target, az, dist, polar],
    )
  },
  async perform(page) {
    await page.evaluate(
      async ([a, d, polarEnd]) => {
        const rig = window.__rig
        await Promise.all([
          window.__buildup.play(34, 70),
          rig.fly(a + 26, polarEnd, d * 0.9, 9000),
        ])
        await rig.drift(4, 1500)
      },
      [az, dist, Math.max(28, polar - 6)],
    )
  },
})

export const GRID_SHOTS = [
  // Machines.
  /* Distances are the frame's own size, not a guess: visible height is
     2·d·tan(fov/2), and at 36° that is 0.65·d. The router is 520 wide and
     420 tall, so 880 showed a corner of it. */
  tile('cnc-router', 'cnc-router', [0, 160, 0], 1280, 24, 54),
  tile('rover', 'rover', [0, 26, 0], 360, -18, 64),
  tile('servo-arm', 'servo-arm', [0, 26, 0], 520, 34, 54),
  // Circuits.
  tile('eight-bit', 'eight-bit', [0, 10, 0], 300, 16),
  tile('esp-weather', 'esp-weather', [0, 8, 0], 165, 28),
  tile('bench-clock', 'bench-clock', [0, 8, 0], 175, -12),
  // Kept for the catalog page even though the wall shows six.
  tile('matrix', 'matrix', [0, 10, -20], 190, -20),
  tile('rfid-lock', 'rfid-lock', [0, 10, 0], 235, 40),
  tile('scoreboard', 'scoreboard', [-6, 10, -10], 195, 8),
]
