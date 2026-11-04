import '@/parts'
import { allParts, defaultParams } from '@/parts/kernel/registry'
import { buildPart } from '@/parts/kernel/build'
import { planFit } from '@/parts/kernel/modelFit'
import type { ModelSpec, Params, Vec3 } from '@/parts/kernel/types'

/**
 * Finds the `axes` a model needs to fit a part, by trying them.
 *
 * Wiring a mesh to a part is arithmetic: `planFit` scales the mesh to the box
 * the part declares, and only draws it where the two agree. Doing that
 * arithmetic by hand, sixty-six times, is how the first round of models ended
 * up with a tower on its side at half height. This searches instead: every
 * combination of uniform, fill and a handful of stretch bands, reported best
 * first, with the fills the catalogue test will measure.
 *
 *   npx vite-node tools/probe-fit.ts
 *
 * The mesh sizes come from HANDOFF-MODELS.md rather than the files: the test
 * reads the real .glb, and a disagreement between the two is worth seeing.
 */

/**
 * part id -> [model file, mesh W, H, D, params the model is gated on].
 *
 * The sizes are the ones HANDOFF-MODELS.md measured, not the files: the
 * catalogue test reads the real .glb, and a disagreement between the sheet
 * and the file is worth finding here rather than there.
 */
const TRY: [string, string, Vec3, Params?][] = [
  ['receiver-av', 'av-receiver', [435, 235, 410]],
  ['projector', 'projector', [330, 90, 295]],
  ['screen-projection', 'projector-screen', [2440, 1270, 165], { kind: 'motor' }],
  ['speaker-surround', 'speaker-tower', [225, 1000, 415], { form: 'floor' }],
  ['speaker-surround', 'speaker-bookshelf', [170, 320, 210], { form: 'bookshelf' }],
  ['speaker-surround', 'speaker-centre', [460, 180, 190], { form: 'centre' }],
  ['speaker-surround', 'speaker-tower-white', [205, 1050, 515], { form: 'floor' }],
  ['speaker-ceiling', 'speaker-ceiling', [230, 55, 230]],
  ['subwoofer-desk', 'subwoofer', [360, 380, 410]],
  ['seating-cinema', 'cinema-seat', [560, 1000, 675], { seats: 1, style: 'fixed' }],
  ['seating-cinema', 'recliner', [850, 1030, 855], { seats: 1, style: 'recliner' }],
  ['seating-cinema', 'cinema-seat-pair', [1100, 970, 615], { seats: 2, style: 'fixed' }],
  ['plant-potted', 'plant-monstera', [860, 1200, 775]],
  ['panel-acoustic', 'acoustic-panel', [500, 500, 30]],
  ['panel-acoustic', 'acoustic-wall-board', [600, 670, 35]],
  ['panel-acoustic', 'acoustic-foam', [305, 305, 25]],
  ['shelf-wall', 'wall-shelf', [1000, 185, 250]],
  ['rug-floor', 'rug', [2400, 10, 2090]],
  ['rug-floor', 'rug-persian', [3000, 5, 2180]],
  ['rack-network', 'server-rack', [670, 2000, 1310]],
  ['printer-3d', 'printer-3d', [665, 590, 690]],
  ['oscilloscope', 'oscilloscope', [390, 260, 545]],
  ['multimeter-handheld', 'multimeter', [85, 35, 155]],
  ['station-solder', 'soldering-station', [210, 245, 195]],
  ['monitor-studio', 'studio-monitor', [170, 285, 220]],
  ['mic-condenser', 'mic-condenser', [60, 160, 60]],
  ['webcam-usb', 'webcam', [85, 65, 80]],
  ['console-game', 'xbox-series-x', [150, 300, 150], { kind: 'xbox' }],
  ['desk', 'standing-desk', [1600, 865, 805]],
  ['desk', 'standing-desk-corner', [1615, 630, 1615]],
]

const BANDS: [number, number][] = [
  [0.1, 0.9],
  [0.15, 0.85],
  [0.2, 0.8],
  [0.25, 0.75],
  [0.3, 0.7],
  [0.05, 0.95],
  [0.35, 0.65],
  [0.45, 0.85],
]

type Opt = undefined | 'fill' | [number, number]
const OPTS: Opt[] = [undefined, 'fill', ...BANDS]
const NAMES = ['x', 'y', 'z'] as const

const show = (o: Opt) => (o === undefined ? '-' : o === 'fill' ? 'fill' : `[${o[0]},${o[1]}]`)
/** Prefer a plain uniform fit, then one adjusted axis, then two. */
const cost = (o: Opt) => (o === undefined ? 0 : o === 'fill' ? 1 : 2)

const byId = new Map(allParts().map((d) => [d.id, d]))

for (const [id, file, src, over] of TRY) {
  const def = byId.get(id)
  if (!def) {
    console.log(`\n${id}  -- no such part`)
    continue
  }
  const b = buildPart(def, { ...defaultParams(def), ...over }).body
  const dst: Vec3 = [b.max.x - b.min.x, b.max.y - b.min.y, b.max.z - b.min.z]
  console.log(
    `\n${id}${over ? ` ${JSON.stringify(over)}` : ''}  <-  ${file}.glb` +
      `\n  part ${dst.map((v) => Math.round(v)).join(' x ')}   mesh ${src.join(' x ')}`,
  )

  const hits: { axes: ModelSpec['axes']; label: string; fills: number[]; c: number }[] = []
  for (const x of OPTS) {
    for (const y of OPTS) {
      for (const z of OPTS) {
        const axes: ModelSpec['axes'] = {}
        if (x !== undefined) axes.x = x
        if (y !== undefined) axes.y = y
        if (z !== undefined) axes.z = z
        const plan = planFit(src, dst, axes)
        if (!plan.ok) continue
        const fills = plan.axes.map((a) => a.fill)
        if (fills.some((f) => f < 0.9)) continue
        hits.push({ axes, label: [x, y, z].map(show).join(' '), fills, c: cost(x) + cost(y) + cost(z) })
      }
    }
  }
  if (!hits.length) {
    // Why the plainest attempt failed is the useful half of a failure.
    const plain = planFit(src, dst)
    console.log(`  NO FIT. uniform says: ${plain.reason ?? 'ok'}`)
    continue
  }
  hits.sort((a, b2) => a.c - b2.c || b2.fills.reduce((s, f) => s + f, 0) - a.fills.reduce((s, f) => s + f, 0))
  for (const h of hits.slice(0, 3)) {
    console.log(`  ${h.label.padEnd(26)} fill ${h.fills.map((f) => f.toFixed(2)).join(' ')}`)
  }
}

void NAMES
