import type { PartDef, Port, Solid, Vec3 } from '../kernel/types'
import { registerParts } from '../kernel/registry'
import { bool, num, str } from './_helpers'

/**
 * The space, and the things that cut into it.
 *
 * This used to be one part in the furniture category — two walls and a floor
 * to stand a desk against — and that had it the wrong way round. The room is
 * not an object you put in a plan. It is the plan. Everything else in the
 * catalogue is measured against a wall, a ceiling height or a doorway, and
 * when those are a backdrop rather than dimensions, nothing can be checked.
 *
 * So the room now carries the four things everything else asks it for:
 *
 *   Walls you can choose, because a cinema needs four and a desk against a
 *   wall needs two to see past.
 *
 *   A ceiling, with a mounting face, because a projector and an access
 *   point both hang from it and a riser eats into the height under it.
 *
 *   Mounting faces at the centre of every wall, so a screen or a television
 *   goes on a wall rather than near one.
 *
 *   Openings. A door is in here as a part of its own because the swing is
 *   750 mm of floor nothing else can occupy, and that is the single most
 *   common thing a plan gets wrong. A window is in because it is a hole in
 *   the wall you cannot hang a screen on, and because daylight is why a
 *   projector needs three times the lumens.
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
  /* For a room whose job is to not reflect anything at the screen. */
  black: { color: '#1A1A1C', rough: 0.97, density: 0.7 },
}

const FLOORING: Record<string, { color: string; rough: number; density: number }> = {
  oak: { color: '#C9A678', rough: 0.72, density: 0.7 },
  walnut: { color: '#7A563A', rough: 0.7, density: 0.75 },
  grey: { color: '#9A9894', rough: 0.8, density: 1.6 },
  carpet: { color: '#6E6A63', rough: 0.98, density: 0.3 },
  concrete: { color: '#A8A6A1', rough: 0.9, density: 2.3 },
}

const TRIM = { color: '#F2F0EC', rough: 0.72, density: 0.7 }
const GLAZING = { color: '#AFC4D6', rough: 0.06, clearcoat: 1, density: 2.5, opacity: 0.3, transmission: 0.85 }

const room: PartDef = {
  id: 'room-shell',
  name: 'Room',
  category: 'space',
  blurb: 'Walls, a floor and a ceiling, at the dimensions you measured',
  tags: ['room', 'wall', 'floor', 'ceiling', 'space', 'office', 'studio', 'bedroom', 'basement', 'shell', 'plan', 'layout', 'cinema'],
  doc: {
    price: 0,
    description:
      'The space the rest of it goes in, at the size you measured with a tape. The floor is at y = 0, so everything else stands on it at the height it really stands at.\n\nHow many walls is a choice because it depends what you are doing. Two is right for a desk against a corner — you can see past the open sides. Four is right for a room you are laying out properly, and the near walls are drawn low so you can still see in, which is the convention every plan drawing uses.\n\nIt costs nothing because you already have it.',
  },
  params: [
    { key: 'width', label: 'Width', type: 'number', unit: 'mm', default: 4200, min: 1500, max: 20000, step: 50, group: 'Room', help: 'Along the back wall, left to right.' },
    { key: 'depth', label: 'Depth', type: 'number', unit: 'mm', default: 3600, min: 1500, max: 20000, step: 50, group: 'Room' },
    { key: 'height', label: 'Ceiling', type: 'number', unit: 'mm', default: 2400, min: 1900, max: 6000, step: 10, group: 'Room', help: 'A UK new build is 2400. A Victorian room is nearer 3000. A basement is whatever it is.' },
    {
      key: 'walls', label: 'Walls', type: 'enum', default: 'corner', group: 'Room',
      options: [
        { value: 'corner', label: 'Two, a corner' },
        { value: 'three', label: 'Three, open at the front' },
        { value: 'four', label: 'Four, front wall cut down' },
      ],
    },
    { key: 'ceiling', label: 'Draw the ceiling', type: 'bool', default: false, group: 'Room', help: 'Off by default so you can see in from above. The ceiling mounting face is there either way.' },
    {
      key: 'paint', label: 'Walls', type: 'enum', default: 'white', group: 'Finish',
      options: [
        { value: 'white', label: 'White' },
        { value: 'warm', label: 'Warm white' },
        { value: 'grey', label: 'Grey' },
        { value: 'green', label: 'Sage' },
        { value: 'navy', label: 'Navy' },
        { value: 'black', label: 'Matt black, for a theatre' },
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
    { key: 'sockets', label: 'Socket positions', type: 'number', default: 3, min: 0, max: 12, step: 1, group: 'Finish', help: 'Mounting faces spaced along the back wall at 450 mm. Place an outlet on one to make it live.' },
  ],

  solids: (p) => {
    const W = num(p, 'width', 4200)
    const D = num(p, 'depth', 3600)
    const H = num(p, 'height', 2400)
    const walls = str(p, 'walls', 'corner')
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
      /* Back and left, always. */
      { kind: 'box', mat: paint, size: [W + T, H, T], at: [W / 2 - T / 2, H / 2, -T / 2], noCollide: true },
      { kind: 'box', mat: paint, size: [T, H, D], at: [-T / 2, H / 2, D / 2], noCollide: true },
    ]

    if (walls !== 'corner') {
      out.push({ kind: 'box', mat: paint, size: [T, H, D], at: [W + T / 2, H / 2, D / 2], noCollide: true })
    }
    if (walls === 'four') {
      /*
       * The front wall, cut down to a metre.
       *
       * Drawn in full it is a lid on the room: the camera is outside it and
       * the only thing a four-walled box shows you is its own back. Cut to
       * a metre it closes the plan — the floor area is bounded, a screen on
       * it has something to hang on — and you can still see over it. This
       * is the convention a sectioned plan drawing uses and it is the one
       * thing about this part that is a drawing rather than a measurement.
       */
      out.push({ kind: 'box', mat: paint, size: [W + T * 2, 1000, T], at: [W / 2, 500, D + T / 2], noCollide: true })
    }

    if (bool(p, 'ceiling', false)) {
      out.push({ kind: 'box', mat: { color: '#F4F2EE', rough: 0.95, density: 0.7 }, size: [W, 20, D], at: [W / 2, H + 10, D / 2], noCollide: true })
    }

    if (bool(p, 'skirting', true)) {
      out.push({ kind: 'box', mat: TRIM, size: [W, SKIRT_H, SKIRT_T], at: [W / 2, SKIRT_H / 2, SKIRT_T / 2], noCollide: true })
      out.push({ kind: 'box', mat: TRIM, size: [SKIRT_T, SKIRT_H, D], at: [SKIRT_T / 2, SKIRT_H / 2, D / 2], noCollide: true })
      if (walls !== 'corner') out.push({ kind: 'box', mat: TRIM, size: [SKIRT_T, SKIRT_H, D], at: [W - SKIRT_T / 2, SKIRT_H / 2, D / 2], noCollide: true })
      if (walls === 'four') out.push({ kind: 'box', mat: TRIM, size: [W, SKIRT_H, SKIRT_T], at: [W / 2, SKIRT_H / 2, D - SKIRT_T / 2], noCollide: true })
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
    const H = num(p, 'height', 2400)
    const walls = str(p, 'walls', 'corner')
    const n = Math.round(num(p, 'sockets', 3))

    /*
     * A mounting face at the centre of every wall and of the ceiling.
     *
     * These are what make "on the end wall" a thing you can do rather than
     * a thing you eyeball. The wall faces sit at 1400, which is where the
     * centre of a television or a screen usually lands; anything wanting a
     * different height moves from there.
     */
    const out: Port[] = [
      { id: 'floor', label: 'Floor', kind: 'mechanical', pos: [W / 2, 0, D / 2], dir: [0, 1, 0], mate: { type: 'face' } },
      { id: 'ceiling', label: 'Ceiling', kind: 'mechanical', pos: [W / 2, H, D / 2], dir: [0, -1, 0], mate: { type: 'face' } },
      { id: 'wall-back', label: 'Back wall', kind: 'mechanical', pos: [W / 2, 1400, 0], dir: [0, 0, 1], mate: { type: 'face' } },
      { id: 'wall-left', label: 'Left wall', kind: 'mechanical', pos: [0, 1400, D / 2], dir: [1, 0, 0], mate: { type: 'face' } },
    ]
    if (walls !== 'corner') out.push({ id: 'wall-right', label: 'Right wall', kind: 'mechanical', pos: [W, 1400, D / 2], dir: [-1, 0, 0], mate: { type: 'face' } })
    if (walls === 'four') out.push({ id: 'wall-front', label: 'Front wall', kind: 'mechanical', pos: [W / 2, 500, D], dir: [0, 0, -1], mate: { type: 'face' } })

    for (let i = 0; i < n; i++) {
      const x = ((i + 1) * W) / (n + 1)
      out.push({ id: `s${i + 1}`, label: `Socket ${i + 1}, back wall`, kind: 'mechanical', pos: [x, 450, 10], dir: [0, 0, 1], mate: { type: 'face' } })
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
    const vol = (W * D * H) / 1e9
    /*
     * Reverberation, by Sabine, with a plain room's absorption assumed.
     *
     * An empty plastered room with a hard floor averages about 0.1 sabins a
     * square metre; carpet and soft furniture take it towards 0.25. The
     * figure is rough and the point of it is the order of magnitude: a bare
     * 50 m³ room rings for about a second, which is why dialogue in it is
     * unintelligible and why the acoustic panels are a part.
     */
    const surface = 2 * ((W * D + W * H + D * H) / 1e6)
    const soft = str(p, 'floor', 'oak') === 'carpet' ? 0.18 : 0.1
    const rt60 = (0.161 * vol) / Math.max(0.5, surface * soft)
    return [
      { label: 'Floor area', value: `${((W * D) / 1e6).toFixed(1)} m²` },
      { label: 'Volume', value: `${vol.toFixed(1)} m³` },
      { label: 'Back wall', value: `${(W / 1000).toFixed(2)} m of usable run` },
      { label: 'Longest run', value: `${(Math.hypot(W, D) / 1000).toFixed(2)} m corner to corner` },
      { label: 'Reverberation', value: `about ${rt60.toFixed(2)} s empty — ${rt60 > 0.6 ? 'it will ring' : 'workable'}` },
      { label: 'Room modes', value: `${Math.round(343000 / (2 * W))}, ${Math.round(343000 / (2 * D))} and ${Math.round(343000 / (2 * H))} Hz` },
    ]
  },
}

/* ================================================================== */
/* Openings                                                            */
/* ================================================================== */

const door: PartDef = {
  id: 'door-interior',
  name: 'Door',
  category: 'space',
  blurb: 'An opening, and the floor its swing takes',
  tags: ['door', 'doorway', 'opening', 'swing', 'clearance', 'room', 'plan', 'access', 'threshold'],
  doc: {
    price: 90,
    description:
      'The commonest thing a layout gets wrong. A 762 mm door on a 90 degree swing sweeps a quarter circle 762 mm deep, and every square millimetre of it has to stay clear — of a chair, of a rack, of the corner of a riser. The swing is drawn here, so a plan either clears it or visibly does not.\n\nThe other number is what fits through it. A 762 mm leaf gives about 720 mm of clear opening, which a 600 mm rack passes and an 800 mm sofa does not.',
  },
  params: [
    { key: 'width', label: 'Leaf width', type: 'number', unit: 'mm', default: 762, min: 450, max: 1200, step: 1, group: 'Door', help: 'Standard UK internal is 762. A wheelchair wants 900.' },
    { key: 'height', label: 'Leaf height', type: 'number', unit: 'mm', default: 1981, min: 1700, max: 2400, step: 1, group: 'Door' },
    { key: 'hinge', label: 'Hinged', type: 'enum', default: 'left', group: 'Door', options: [{ value: 'left', label: 'On the left' }, { value: 'right', label: 'On the right' }] },
    {
      key: 'kind', label: 'Type', type: 'enum', default: 'swing', group: 'Door',
      options: [
        { value: 'swing', label: 'Swing' },
        { value: 'double', label: 'Double, a pair' },
        { value: 'sliding', label: 'Sliding, on a track' },
        { value: 'pocket', label: 'Pocket, into the wall' },
        { value: 'opening', label: 'No door, a cased opening' },
      ],
    },
    { key: 'open', label: 'Open to', type: 'number', unit: '°', default: 35, min: 0, max: 180, step: 5, group: 'Control' },
    { key: 'swingIn', label: 'Opens into the room', type: 'bool', default: true, group: 'Door' },
  ],
  solids: (p) => {
    const w = num(p, 'width', 762)
    const h = num(p, 'height', 1981)
    const kind = str(p, 'kind', 'swing')
    const leaves = kind === 'double' ? 2 : 1
    const leafW = w / leaves
    const open = (num(p, 'open', 35) * Math.PI) / 180
    const inward = bool(p, 'swingIn', true) ? 1 : -1
    const leftHung = str(p, 'hinge', 'left') === 'left'

    const out: Solid[] = [
      /* The lining and the architrave, which is the part that is really
         there whatever the door does. */
      { kind: 'box', mat: TRIM, size: [32, h + 32, 120], at: [-w / 2 - 16, (h + 32) / 2, 0], bevel: 2 },
      { kind: 'box', mat: TRIM, size: [32, h + 32, 120], at: [w / 2 + 16, (h + 32) / 2, 0], bevel: 2 },
      { kind: 'box', mat: TRIM, size: [w + 64, 32, 120], at: [0, h + 16, 0], bevel: 2 },
    ]
    if (kind === 'opening') return out

    const leafMat = { color: '#E8E4DC', rough: 0.78, density: 0.6 }
    for (let i = 0; i < leaves; i++) {
      const side = leaves === 2 ? (i === 0 ? -1 : 1) : leftHung ? -1 : 1
      const hingeX = (side * w) / 2
      if (kind === 'sliding' || kind === 'pocket') {
        // Slid along the wall rather than swung, so it takes none of the
        // floor and all of the wall beside it.
        const slide = (num(p, 'open', 35) / 180) * leafW
        out.push({ kind: 'box', mat: leafMat, size: [leafW, h, 40], at: [hingeX - side * leafW / 2 + side * slide, h / 2, kind === 'pocket' ? 0 : -70], bevel: 2 })
        if (kind === 'sliding') out.push({ kind: 'box', mat: { color: '#9A9EA5', metal: 1, rough: 0.4, density: 2.7 }, size: [w * 2, 40, 28], at: [0, h + 70, -70] })
        continue
      }
      /*
       * A swung leaf, positioned by rotating about its hinge rather than
       * about its own centre — which is the difference between a door and
       * a panel that pivots in the middle of the doorway.
       */
      const a = open * side * inward
      const cx = hingeX - side * (leafW / 2) * Math.cos(a)
      const cz = (leafW / 2) * Math.sin(a) * inward * -side * side
      out.push({
        kind: 'box', mat: leafMat, size: [leafW, h, 40],
        at: [cx, h / 2, cz] as Vec3,
        rot: [0, (-a * 180) / Math.PI, 0], bevel: 2,
      })
      out.push({
        kind: 'cyl', mat: { color: '#B9BEC6', metal: 1, rough: 0.35, density: 7.8 }, r: 14, h: 120, seg: 14, rot: [0, 0, 90],
        at: [cx - side * (leafW / 2 - 70) * Math.cos(a), 1050, cz - side * (leafW / 2 - 70) * Math.sin(a)] as Vec3,
      })
    }
    return out
  },
  ports: (p) => {
    const w = num(p, 'width', 762)
    const h = num(p, 'height', 1981)
    return [
      { id: 'wall', label: 'Wall', kind: 'mechanical', pos: [0, h / 2, 0], dir: [0, 0, -1], mate: { type: 'face' } },
      { id: 'threshold', label: 'Threshold', kind: 'mechanical', pos: [0, 0, 0], dir: [0, -1, 0], mate: { type: 'face' } },
      { id: 'clear', label: 'Clear opening', kind: 'mechanical', pos: [0, 1000, 0], dir: [0, 0, 1], mate: { type: 'face', size: w - 42 } },
    ]
  },
  mass: (p) => (str(p, 'kind', 'swing') === 'opening' ? 4000 : 4000 + (num(p, 'width', 762) * num(p, 'height', 1981)) / 1e6 * 17000),
  price: (p) => {
    const kind = str(p, 'kind', 'swing')
    return kind === 'opening' ? 40 : kind === 'pocket' ? 260 : kind === 'sliding' ? 180 : kind === 'double' ? 220 : 110
  },
  readouts: (p) => {
    const w = num(p, 'width', 762)
    const kind = str(p, 'kind', 'swing')
    const leaves = kind === 'double' ? 2 : 1
    const leafW = w / leaves
    const clear = w - (kind === 'opening' ? 0 : 42)
    // A quarter circle per leaf, which is the floor nothing else may use.
    const sweep = leaves * (Math.PI * (leafW / 1000) ** 2) / 4
    return [
      { label: 'Clear opening', value: `${Math.round(clear)} mm` },
      { label: 'Gets through', value: clear >= 900 ? 'A wheelchair, a sofa, a 19 inch rack' : clear >= 720 ? 'A rack, a fridge, most furniture on its side' : 'A person and a box' },
      {
        label: 'Floor taken by the swing',
        value: kind === 'sliding' || kind === 'pocket' || kind === 'opening' ? 'None' : `${sweep.toFixed(2)} m², ${Math.round(leafW)} mm deep`,
      },
      ...(kind === 'pocket' ? [{ label: 'Wall needed', value: `${Math.round(leafW + 60)} mm of stud with nothing in it — no sockets, no pipes` }] : []),
      ...(kind === 'sliding' ? [{ label: 'Wall needed', value: `${Math.round(leafW)} mm clear beside the opening for the leaf to sit on` }] : []),
    ]
  },
}

const window: PartDef = {
  id: 'window-casement',
  name: 'Window',
  category: 'space',
  blurb: 'A hole in a wall, and the daylight through it',
  tags: ['window', 'casement', 'glazing', 'opening', 'daylight', 'reveal', 'sill', 'blackout', 'room', 'plan'],
  doc: {
    price: 520,
    description:
      'A wall you cannot hang anything on, and a light source you did not choose. Both matter: the first is why a screen ends up on the wall it ends up on, and the second is why a projector in a room with a south-facing window needs three times the lumens or a blind.\n\nThe daylight figure is a rough one and says so — glazing area over floor area is the ratio building regulations use, and 20% is a bright room.',
  },
  params: [
    { key: 'width', label: 'Width', type: 'number', unit: 'mm', default: 1200, min: 300, max: 4000, step: 10, group: 'Window' },
    { key: 'height', label: 'Height', type: 'number', unit: 'mm', default: 1200, min: 300, max: 2600, step: 10, group: 'Window' },
    { key: 'sill', label: 'Sill height', type: 'number', unit: 'mm', default: 900, min: 0, max: 2000, step: 10, group: 'Window' },
    {
      key: 'kind', label: 'Type', type: 'enum', default: 'casement', group: 'Window',
      options: [
        { value: 'casement', label: 'Casement' },
        { value: 'sash', label: 'Sash' },
        { value: 'picture', label: 'Picture, fixed' },
        { value: 'rooflight', label: 'Rooflight' },
      ],
    },
    { key: 'glazing', label: 'Glazing', type: 'enum', default: 'double', group: 'Window', options: [{ value: 'single', label: 'Single' }, { value: 'double', label: 'Double' }, { value: 'triple', label: 'Triple' }] },
    { key: 'blind', label: 'Blackout blind', type: 'bool', default: false, group: 'Light' },
    { key: 'roomArea', label: 'Room floor area', type: 'number', unit: '', default: 15, min: 3, max: 120, step: 1, group: 'Light', help: 'Square metres, for the daylight ratio.' },
  ],
  solids: (p) => {
    const w = num(p, 'width', 1200)
    const h = num(p, 'height', 1200)
    const sill = num(p, 'sill', 900)
    const kind = str(p, 'kind', 'casement')
    const frame = { color: '#F0EEE9', rough: 0.6, density: 1.4 }
    const out: Solid[] = [
      // Reveal and frame.
      { kind: 'box', mat: frame, size: [w + 80, 60, 140], at: [0, sill + h + 30, 0], bevel: 2 },
      { kind: 'box', mat: frame, size: [60, h, 140], at: [-w / 2 - 30, sill + h / 2, 0], bevel: 2 },
      { kind: 'box', mat: frame, size: [60, h, 140], at: [w / 2 + 30, sill + h / 2, 0], bevel: 2 },
      // The board, which is the shelf people put things on.
      { kind: 'box', mat: TRIM, size: [w + 160, 30, 180], at: [0, sill - 15, 30], bevel: 3 },
      { kind: 'box', mat: GLAZING, size: [w, h, 18], at: [0, sill + h / 2, 0] },
    ]
    if (kind === 'casement' || kind === 'sash') {
      out.push({ kind: 'box', mat: frame, size: [40, h, 60], at: [0, sill + h / 2, 20] })
      if (kind === 'sash') out.push({ kind: 'box', mat: frame, size: [w, 40, 60], at: [0, sill + h / 2, 20] })
    }
    if (bool(p, 'blind', false)) {
      out.push({ kind: 'box', mat: { color: '#2A2C30', rough: 0.95, density: 0.4 }, size: [w + 120, 90, 70], at: [0, sill + h + 90, 60] })
    }
    return out
  },
  ports: (p) => {
    const h = num(p, 'height', 1200)
    const sill = num(p, 'sill', 900)
    return [
      { id: 'wall', label: 'Wall', kind: 'mechanical', pos: [0, sill + h / 2, 0], dir: [0, 0, -1], mate: { type: 'face' } },
      { id: 'board', label: 'Window board', kind: 'mechanical', pos: [0, sill, 40], dir: [0, 1, 0], mate: { type: 'face' } },
    ]
  },
  mass: (p) => ((num(p, 'width', 1200) * num(p, 'height', 1200)) / 1e6) * (str(p, 'glazing', 'double') === 'triple' ? 38000 : str(p, 'glazing', 'double') === 'double' ? 26000 : 14000),
  price: (p) => {
    const a = (num(p, 'width', 1200) * num(p, 'height', 1200)) / 1e6
    const g = str(p, 'glazing', 'double')
    return Math.round(a * (g === 'triple' ? 520 : g === 'double' ? 360 : 200) + (bool(p, 'blind', false) ? 110 : 0))
  },
  readouts: (p) => {
    const w = num(p, 'width', 1200)
    const h = num(p, 'height', 1200)
    const sill = num(p, 'sill', 900)
    const area = (w * h) / 1e6
    const ratio = area / Math.max(1, num(p, 'roomArea', 15))
    const g = str(p, 'glazing', 'double')
    // Centre-pane U values, which is what everyone quotes and what the
    // heat-loss figure below is based on.
    const u = g === 'triple' ? 0.8 : g === 'double' ? 1.4 : 5.6
    return [
      { label: 'Opening', value: `${w} × ${h} mm, sill at ${sill}` },
      { label: 'Glazing', value: `${area.toFixed(2)} m², ${Math.round(ratio * 100)}% of the floor area` },
      { label: 'Daylight', value: ratio >= 0.2 ? 'Bright' : ratio >= 0.1 ? 'Normal' : 'Dim, and regulations want 10% for a habitable room' },
      { label: 'Heat loss', value: `${Math.round(area * u * 20)} W at 20 degrees of difference, U ${u.toFixed(1)}` },
      {
        label: 'For a projector',
        value: bool(p, 'blind', false) ? 'Blacked out when the blind is down' : `Needs ${Math.round(area * 1400)} extra lumens, or a blind`,
      },
      { label: 'Wall lost', value: `${((w + 160) / 1000).toFixed(2)} m of run you cannot hang anything on` },
    ]
  },
}

const partition: PartDef = {
  id: 'wall-partition',
  name: 'Stud partition',
  category: 'space',
  blurb: 'A wall you are adding, with what it costs to add it',
  tags: ['partition', 'stud wall', 'wall', 'divider', 'plasterboard', 'drywall', 'build', 'room', 'split', 'acoustic'],
  doc: {
    price: 180,
    description:
      'For splitting a space, or boxing in the bit of it you do not want. A timber stud wall at 400 centres with 12.5 mm plasterboard both sides is 100 mm thick, and the readouts say what it takes to put up: studs, sheets, and the floor area it costs you, which on a 4 m run is 0.4 m² gone.\n\nAcoustically it is worth knowing it is nearly nothing — around 35 dB, which stops speech being intelligible and does not stop a subwoofer.',
  },
  params: [
    { key: 'length', label: 'Length', type: 'number', unit: 'mm', default: 3000, min: 300, max: 12000, step: 50, group: 'Partition' },
    { key: 'height', label: 'Height', type: 'number', unit: 'mm', default: 2400, min: 500, max: 4000, step: 10, group: 'Partition' },
    { key: 'thickness', label: 'Thickness', type: 'number', unit: 'mm', default: 100, min: 60, max: 250, step: 5, group: 'Partition' },
    { key: 'centres', label: 'Stud centres', type: 'enum', default: '400', group: 'Partition', options: ['300', '400', '600'].map((v) => ({ value: v, label: `${v} mm` })) },
    { key: 'insulated', label: 'Insulated', type: 'bool', default: true, group: 'Partition', help: 'Mineral wool in the cavity. Worth about 7 dB, and it is the cheapest 7 dB there is.' },
    { key: 'resilient', label: 'Resilient bars', type: 'bool', default: false, group: 'Partition', help: 'Decouples the board from the studs. Another 8 dB, and it makes hanging anything on the wall harder.' },
  ],
  solids: (p) => {
    const l = num(p, 'length', 3000)
    const h = num(p, 'height', 2400)
    const t = num(p, 'thickness', 100)
    return [
      { kind: 'box', mat: PAINT.white, size: [l, h, t], at: [l / 2, h / 2, 0], noCollide: true },
      { kind: 'box', mat: TRIM, size: [l, SKIRT_H, t + SKIRT_T * 2], at: [l / 2, SKIRT_H / 2, 0], noCollide: true },
    ]
  },
  ports: (p) => {
    const l = num(p, 'length', 3000)
    const h = num(p, 'height', 2400)
    const t = num(p, 'thickness', 100)
    return [
      { id: 'floor', label: 'Floor', kind: 'mechanical', pos: [0, 0, 0], dir: [0, -1, 0], mate: { type: 'face' } },
      { id: 'faceA', label: 'Face A', kind: 'mechanical', pos: [l / 2, 1400, t / 2], dir: [0, 0, 1], mate: { type: 'face' } },
      { id: 'faceB', label: 'Face B', kind: 'mechanical', pos: [l / 2, 1400, -t / 2], dir: [0, 0, -1], mate: { type: 'face' } },
      { id: 'end', label: 'End', kind: 'mechanical', pos: [l, h / 2, 0], dir: [1, 0, 0], mate: { type: 'face' } },
    ]
  },
  mass: (p) => {
    const a = (num(p, 'length', 3000) * num(p, 'height', 2400)) / 1e6
    // Plasterboard is 9.5 kg/m² a side at 12.5 mm; studs about 6 kg/m².
    return (a * 19 + a * 6 + (bool(p, 'insulated', true) ? a * 1.4 : 0)) * 1000
  },
  price: (p) => {
    const a = (num(p, 'length', 3000) * num(p, 'height', 2400)) / 1e6
    return Math.round(a * (34 + (bool(p, 'insulated', true) ? 9 : 0) + (bool(p, 'resilient', false) ? 12 : 0)))
  },
  readouts: (p) => {
    const l = num(p, 'length', 3000)
    const h = num(p, 'height', 2400)
    const t = num(p, 'thickness', 100)
    const c = parseInt(str(p, 'centres', '400'), 10) || 400
    const studs = Math.ceil(l / c) + 1
    const a = (l * h) / 1e6
    // 2400 × 1200 sheets, both sides, with a tenth for cuts.
    const sheets = Math.ceil((a * 2 * 1.1) / 2.88)
    let rw = 35
    if (bool(p, 'insulated', true)) rw += 7
    if (bool(p, 'resilient', false)) rw += 8
    return [
      { label: 'Wall', value: `${(l / 1000).toFixed(2)} × ${(h / 1000).toFixed(2)} m, ${t} mm thick` },
      { label: 'Floor it costs', value: `${((l * t) / 1e6).toFixed(2)} m²` },
      { label: 'Studs', value: `${studs} at ${c} centres, ${((studs * h) / 1000).toFixed(1)} m of timber` },
      { label: 'Plasterboard', value: `${sheets} sheets of 2400 × 1200, both sides` },
      { label: 'Sound', value: `about ${rw} dB Rw — ${rw >= 50 ? 'speech inaudible' : 'speech muffled, bass straight through'}` },
    ]
  },
}

registerParts([room, door, window, partition])
