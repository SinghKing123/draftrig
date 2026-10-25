import type { PartDef, Port, Solid } from '../kernel/types'
import { registerParts } from '../kernel/registry'
import { bool, num, str } from './_helpers'

/**
 * The room a setup goes in.
 *
 * Everything else in the Setup section is an object you put somewhere. This
 * is the somewhere. Two walls and a floor, authored as a corner at the
 * origin looking in, which is the view you want when you are laying a desk
 * against a wall: you can see both surfaces and neither is in the way.
 *
 * It is a shell, not a box. A room drawn with four walls is a room you
 * cannot look into, and the first thing anybody would do with it is hide
 * two of them. So there are two, and the corner between them is where the
 * sockets go.
 *
 * Why it is a part at all, rather than a setting: because a room has a size,
 * and the size is the constraint. Whether a 1600 desk and a 600 rack both
 * fit along a 3.2 m wall is the question somebody planning a setup actually
 * has, and it is a question about geometry, so it belongs to a thing with
 * geometry. It also carries the sockets, which is what makes the mains in a
 * room run start somewhere real.
 *
 * Nothing here is electrical. The sockets are cut-outs and mounting faces;
 * put an `outlet-mains` on one and that is the live thing.
 */

const T = 110 /* wall thickness, a stud wall with plasterboard both sides */
const SKIRT_H = 120
const SKIRT_T = 18

const PAINT: Record<string, { color: string; rough: number; density: number }> = {
  white: { color: '#EDEAE4', rough: 0.94, density: 0.7 },
  warm: { color: '#E4DBCB', rough: 0.94, density: 0.7 },
  grey: { color: '#CDCCC9', rough: 0.94, density: 0.7 },
  green: { color: '#C6CFC2', rough: 0.94, density: 0.7 },
  navy: { color: '#2E3A4C', rough: 0.94, density: 0.7 },
}

const FLOORING: Record<string, { color: string; rough: number; density: number }> = {
  oak: { color: '#C9A678', rough: 0.72, density: 0.7 },
  walnut: { color: '#7A563A', rough: 0.7, density: 0.75 },
  grey: { color: '#9A9894', rough: 0.8, density: 1.6 },
  carpet: { color: '#6E6A63', rough: 0.98, density: 0.3 },
  concrete: { color: '#A8A6A1', rough: 0.9, density: 2.3 },
}

const room: PartDef = {
  id: 'room-shell',
  name: 'Room',
  category: 'furniture',
  blurb: 'Two walls and a floor, to put a setup in',
  tags: ['room', 'wall', 'floor', 'space', 'office', 'studio', 'bedroom', 'shell', 'plan', 'layout'],
  doc: {
    price: 0,
    description:
      'The space the rest of it goes in. A corner of a room, open to the camera, with the floor at y = 0 so everything else stands on it at the height it really stands at. Sockets can be placed along either wall at 450 mm, which is where a new build puts them.\n\nIt costs nothing because you already have it.',
  },
  params: [
    { key: 'width', label: 'Width', type: 'number', unit: 'mm', default: 4200, min: 1500, max: 12000, step: 100, group: 'Room', help: 'Along the back wall, left to right.' },
    { key: 'depth', label: 'Depth', type: 'number', unit: 'mm', default: 3600, min: 1500, max: 12000, step: 100, group: 'Room' },
    { key: 'height', label: 'Ceiling', type: 'number', unit: 'mm', default: 2400, min: 1900, max: 4500, step: 50, group: 'Room', help: 'A UK new build is 2400. A Victorian room is nearer 3000.' },
    {
      key: 'paint', label: 'Walls', type: 'enum', default: 'white', group: 'Finish',
      options: [
        { value: 'white', label: 'White' },
        { value: 'warm', label: 'Warm white' },
        { value: 'grey', label: 'Grey' },
        { value: 'green', label: 'Sage' },
        { value: 'navy', label: 'Navy' },
      ],
    },
    {
      key: 'floor', label: 'Floor', type: 'enum', default: 'oak', group: 'Finish',
      options: [
        { value: 'oak', label: 'Oak board' },
        { value: 'walnut', label: 'Walnut board' },
        { value: 'grey', label: 'Grey vinyl' },
        { value: 'carpet', label: 'Carpet' },
        { value: 'concrete', label: 'Concrete' },
      ],
    },
    { key: 'skirting', label: 'Skirting', type: 'bool', default: true, group: 'Finish' },
    { key: 'sockets', label: 'Socket positions', type: 'number', default: 3, min: 0, max: 8, step: 1, group: 'Finish', help: 'Mounting faces spaced along the back wall at 450 mm. Place an outlet on one to make it live.' },
  ],

  solids: (p) => {
    const W = num(p, 'width', 4200)
    const D = num(p, 'depth', 3600)
    const H = num(p, 'height', 2400)
    const paint = PAINT[str(p, 'paint', 'white')] ?? PAINT.white
    const floor = FLOORING[str(p, 'floor', 'oak')] ?? FLOORING.oak

    /*
     * The corner sits at the origin and the room runs +x and +z from it, so
     * the back wall is behind z = 0 and the left wall is left of x = 0.
     * Everything else in the catalogue is authored standing at y = 0, which
     * means a desk dropped in a room is already on the floor.
     */
    const out: Solid[] = [
      /* The floor, inset under the walls rather than butted to them, so the
         join does not z-fight along a 4 m edge. */
      { kind: 'box', mat: floor, size: [W, 20, D], at: [W / 2, -10, D / 2], noCollide: true },

      /* Back wall and left wall. Drawn to the outside of the corner so the
         inside faces land exactly on x = 0 and z = 0. */
      { kind: 'box', mat: paint, size: [W + T, H, T], at: [W / 2 - T / 2, H / 2, -T / 2], noCollide: true },
      { kind: 'box', mat: paint, size: [T, H, D], at: [-T / 2, H / 2, D / 2], noCollide: true },
    ]

    if (bool(p, 'skirting', true)) {
      const skirt = { color: '#F2F0EC', rough: 0.72, density: 0.7 }
      out.push({ kind: 'box', mat: skirt, size: [W, SKIRT_H, SKIRT_T], at: [W / 2, SKIRT_H / 2, SKIRT_T / 2], noCollide: true })
      out.push({ kind: 'box', mat: skirt, size: [SKIRT_T, SKIRT_H, D], at: [SKIRT_T / 2, SKIRT_H / 2, D / 2], noCollide: true })
    }

    /* Socket back-boxes, sunk into the back wall at 450 mm. They are holes
       with a plate behind them, not outlets: an outlet is a part. */
    const n = Math.round(num(p, 'sockets', 3))
    for (let i = 0; i < n; i++) {
      const x = ((i + 1) * W) / (n + 1)
      out.push({ kind: 'box', mat: { color: '#D9D5CD', rough: 0.9, density: 1.4 }, size: [146, 86, 8], at: [x, 450, 4], noCollide: true })
    }

    return out
  },

  ports: (p) => {
    const W = num(p, 'width', 4200)
    const D = num(p, 'depth', 3600)
    const n = Math.round(num(p, 'sockets', 3))
    const out: Port[] = [
      { id: 'floor', label: 'Floor', kind: 'mechanical', pos: [W / 2, 0, D / 2], dir: [0, 1, 0], mate: { type: 'face' } },
    ]
    for (let i = 0; i < n; i++) {
      const x = ((i + 1) * W) / (n + 1)
      out.push({
        id: `s${i + 1}`,
        label: `Socket ${i + 1}, back wall`,
        kind: 'mechanical',
        pos: [x, 450, 10],
        dir: [0, 0, 1],
        mate: { type: 'face' },
      })
    }
    return out
  },

  /* It is a room. You are not buying it and you are not carrying it. */
  price: () => 0,
  mass: () => 0,

  readouts: (p) => {
    const W = num(p, 'width', 4200)
    const D = num(p, 'depth', 3600)
    const H = num(p, 'height', 2400)
    return [
      { label: 'Floor area', value: `${((W * D) / 1e6).toFixed(1)} m²` },
      { label: 'Back wall', value: `${(W / 1000).toFixed(1)} m of usable run` },
      { label: 'Volume', value: `${((W * D * H) / 1e9).toFixed(1)} m³` },
    ]
  },
}

registerParts([room])
