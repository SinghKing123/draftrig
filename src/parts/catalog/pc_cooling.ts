import type { PartDef, Port, Solid, Vec3 } from '../kernel/types'
import { registerParts } from '../kernel/registry'
import { circle, num, roundRect, str } from './_helpers'

/**
 * Liquid cooling.
 *
 * The number that matters on an all-in-one is the radiator length, because
 * that is what has to find a wall of the case to bolt to. Everything else
 * follows from it: how many fans, how much heat it can move, what it costs.
 */

const ALU = { color: '#9BA2AA', metal: 1, rough: 0.42, density: 2.7 }
const BLOCK = { color: '#1C2027', rough: 0.42, clearcoat: 0.3, density: 3 }
const TUBE = { color: '#232830', rough: 0.72, density: 1.3 }
const FAN_BODY = { color: '#15181C', rough: 0.6, density: 1.3 }

/** Radiator sizes, by the fans they take. */
const RAD: Record<string, { fans: number; fanSize: number; len: number; watts: number; price: number }> = {
  '120': { fans: 1, fanSize: 120, len: 157, watts: 150, price: 70 },
  '240': { fans: 2, fanSize: 120, len: 277, watts: 250, price: 100 },
  '280': { fans: 2, fanSize: 140, len: 317, watts: 280, price: 120 },
  '360': { fans: 3, fanSize: 120, len: 397, watts: 350, price: 150 },
  '420': { fans: 3, fanSize: 140, len: 457, watts: 400, price: 190 },
}

const aio: PartDef = {
  id: 'cooler-aio',
  name: 'Liquid cooler',
  category: 'pc-component',
  blurb: 'Pump block, tubes and a radiator that has to fit a wall',
  tags: ['aio', 'liquid', 'water', 'cooler', 'radiator', 'pump', '240', '360', 'cooling', 'gaming', 'pc'],
  doc: {
    price: 150,
    description:
      'An all-in-one liquid cooler. The radiator length is what decides whether it goes in a case, and it is the parameter everything else follows from.',
  },
  params: [
    { key: 'size', label: 'Radiator', type: 'enum', default: '360', group: 'Cooler', options: [
      { value: '120', label: '120 mm, one fan' }, { value: '240', label: '240 mm, two fans' },
      { value: '280', label: '280 mm, two 140s' }, { value: '360', label: '360 mm, three fans' },
      { value: '420', label: '420 mm, three 140s' },
    ] },
    { key: 'lit', label: 'Lit pump head', type: 'bool', default: true, group: 'Cooler' },
    { key: 'tubeLength', label: 'Tube length', type: 'number', unit: 'mm', default: 400, min: 250, max: 500, step: 10, group: 'Cooler' },
  ],
  solids: (p) => {
    const r = RAD[str(p, 'size', '360')] ?? RAD['360']
    const fs = r.fanSize
    const radW = fs + 37
    const radT = 27
    const tube = num(p, 'tubeLength', 400)

    const out: Solid[] = [
      // Radiator core with its end tanks.
      { kind: 'box', mat: ALU, size: [r.len, radT, radW], at: [0, radT / 2, 0], bevel: 0.6 },
      ...[-1, 1].map((s): Solid => ({
        kind: 'box', mat: { color: '#3A4048', metal: 0.9, rough: 0.5, density: 2.7 },
        size: [18, radT + 1, radW], at: [(s * (r.len - 18)) / 2, radT / 2, 0], bevel: 0.5,
      })),
      // The fins you can see down the side.
      ...Array.from({ length: Math.round(r.len / 3) }, (_, i): Solid => ({
        kind: 'box', mat: { color: '#6E757E', metal: 1, rough: 0.6, density: 2.7 },
        size: [0.6, radT - 6, radW - 8], at: [-r.len / 2 + 22 + i * 3, radT / 2, 0], noCollide: true,
      })),
      // Fans bolted to the face.
      ...Array.from({ length: r.fans }, (_, i): Solid => ({
        kind: 'group', mat: FAN_BODY,
        at: [-r.len / 2 + fs / 2 + 12 + i * fs, radT + 13, 0],
        children: [
          {
            kind: 'extrude', mat: FAN_BODY,
            profile: { outline: roundRect(fs, fs, 5, 0, 0, 4), holes: [circle(fs * 0.46, 0, 0, 32)] },
            depth: 25, rot: [-90, 0, 0], at: [0, 0, 0],
          },
          { kind: 'cyl', mat: { color: '#2A2E35', rough: 0.6, density: 1.2 }, r: fs * 0.17, h: 20, at: [0, 0, 0] },
          ...Array.from({ length: 9 }, (_, b): Solid => ({
            kind: 'box', mat: { color: '#343A43', rough: 0.55, density: 1.2 },
            size: [fs * 0.4, 1.4, fs * 0.17], at: [0, 0, 0],
            rot: [0, (b / 9) * 360, 16], noCollide: true,
          })),
        ],
      })),
      // Pump head, out in front of the radiator on its tubes.
      {
        kind: 'group', mat: BLOCK, at: [0, 0, radW / 2 + tube * 0.42],
        children: [
          { kind: 'box', mat: BLOCK, size: [72, 46, 72], at: [0, 23, 0], bevel: 3 },
          { kind: 'cyl', mat: { color: '#C9CED4', metal: 1, rough: 0.25, density: 8.9 }, r: 28, h: 3, at: [0, 1.5, 0] },
          ...(p.lit !== false
            ? [{
                kind: 'cyl' as const,
                mat: { color: '#C6D4EA', rough: 0.25, emissive: '#3C7BDC', emissiveIntensity: 0.7, density: 1.2 },
                r: 24, h: 1.6, at: [0, 46.4, 0] as Vec3, noCollide: true,
              }]
            : []),
        ],
      },
      // The two tubes, sleeved, looping from the radiator to the head.
      ...[-1, 1].map((s): Solid => ({
        kind: 'tube', mat: TUBE, r: 6, seg: 10,
        path: [
          [s * 22, radT / 2, radW / 2],
          [s * 30, radT / 2 + 18, radW / 2 + tube * 0.18],
          [s * 26, 26, radW / 2 + tube * 0.34],
          [s * 20, 20, radW / 2 + tube * 0.42 - 34],
        ],
      })),
    ]
    return out
  },
  ports: (p) => {
    const r = RAD[str(p, 'size', '360')] ?? RAD['360']
    const fs = r.fanSize
    const radW = fs + 37
    const tube = num(p, 'tubeLength', 400)
    const headZ = radW / 2 + tube * 0.42

    const out: Port[] = [
      { id: 'base', label: 'Contact plate', kind: 'mechanical', pos: [0, 0, headZ], dir: [0, -1, 0], mate: { type: 'face' } },
      { id: 'pump', label: 'Pump 12 V', kind: 'electrical', pos: [30, 46, headZ], dir: [0, 1, 0], role: 'power', imax: 1 },
      { id: 'gnd', label: 'Ground', kind: 'electrical', pos: [38, 46, headZ], dir: [0, 1, 0], role: 'gnd', imax: 1 },
    ]
    // Radiator screw holes, so it can be bolted to a case wall.
    for (let i = 0; i < r.fans; i++) {
      const cx = -r.len / 2 + fs / 2 + 12 + i * fs
      const pitch = fs === 140 ? 124.5 : 105
      let n = 0
      for (const sx of [-1, 1]) {
        for (const sz of [-1, 1]) {
          out.push({
            id: `rad${i}_${n++}`, label: 'Radiator screw', kind: 'mechanical',
            pos: [cx + (sx * pitch) / 2, 27, (sz * pitch) / 2], dir: [0, 1, 0],
            mate: { type: 'hole', size: 4.4 }, groupId: 'radiator',
          })
        }
      }
    }
    return out
  },
  electrical: {
    devices: (p) => {
      const r = RAD[str(p, 'size', '360')] ?? RAD['360']
      // Pump plus its fans, about four watts each.
      const w = 6 + r.fans * 2.4
      return [{ type: 'resistor', r: (12 * 12) / w, a: 'pump', b: 'gnd' }]
    },
  },
  price: (p) => (RAD[str(p, 'size', '360')] ?? RAD['360']).price,
  mass: (p) => {
    const r = RAD[str(p, 'size', '360')] ?? RAD['360']
    return 600 + r.fans * 380
  },
  readouts: (p) => {
    const r = RAD[str(p, 'size', '360')] ?? RAD['360']
    return [
      { label: 'Radiator', value: `${str(p, 'size', '360')} mm, ${r.len} mm long` },
      { label: 'Fans', value: `${r.fans} x ${r.fanSize} mm` },
      { label: 'Handles', value: `about ${r.watts} W` },
      { label: 'Needs a wall of', value: `${r.len} mm` },
    ]
  },
}

registerParts([aio])

export const AIO_RAD = RAD
export const PC_COOLING_PARTS = [aio]
