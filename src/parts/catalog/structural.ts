import type { PartDef, Port, Profile, Vec2, Vec3 } from '../kernel/types'
import { registerParts } from '../kernel/registry'
import { circle, num, str } from './_helpers'

/* ================================================================== */
/* T-slot aluminium extrusion                                          */
/* ================================================================== */

/** Slot cross-section, measured from the outer face inward. */
const SLOT = {
  mouth: 6.2, // opening width at the surface
  lead: 0.45, // 45 degree lead-in at the mouth, so a nut slides in
  d1: 1.9, // depth of the straight mouth
  d2: 2.9, // depth where the undercut has fully opened
  d3: 5.4, // channel floor
  inner: 10.6, // channel width
}

const BORE_R = 2.1
/** Outer corner radius. Extruded aluminium is never sharp-cornered. */
const CORNER_R = 1.4

/** Emit a quarter-round corner, angles in radians, counter-clockwise. */
function corner(pts: Vec2[], cx: number, cy: number, r: number, a0: number, a1: number, steps = 4): void {
  for (let i = 0; i <= steps; i++) {
    const a = a0 + ((a1 - a0) * i) / steps
    pts.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r])
  }
}

/**
 * Trace a T-slot profile for an extrusion `w` x `h` mm, where both are
 * multiples of the 20 mm module. Slots are centred on every module cell of
 * every face, which is exactly how the real stock is made.
 */
function tslotProfile(w: number, h: number, module: number): Profile {
  const pts: Vec2[] = []
  const half = SLOT.mouth / 2
  const halfIn = SLOT.inner / 2

  /** Emit one face, walking from `sx,sy` along (dx,dy) with inward normal (nx,ny). */
  const face = (sx: number, sy: number, dx: number, dy: number, nx: number, ny: number, len: number) => {
    const cells = Math.max(1, Math.round(len / module))
    const lead = SLOT.lead
    for (let i = 0; i < cells; i++) {
      const c = (i + 0.5) * module // slot centre along the face
      const at = (u: number, v: number): Vec2 => [sx + dx * (c + u) + nx * v, sy + dy * (c + u) + ny * v]
      // Mouth lead-in, straight mouth, undercut, channel, and back out.
      pts.push(at(-half - lead, 0), at(-half, lead))
      pts.push(at(-half, SLOT.d1), at(-halfIn, SLOT.d2), at(-halfIn, SLOT.d3))
      pts.push(at(halfIn, SLOT.d3), at(halfIn, SLOT.d2), at(half, SLOT.d1))
      pts.push(at(half, lead), at(half + lead, 0))
    }
  }

  const x0 = -w / 2
  const y0 = -h / 2
  const r = CORNER_R
  const HALF_PI = Math.PI / 2
  // Counter-clockwise from the bottom-left corner: corner, face, corner, face.
  corner(pts, x0 + r, y0 + r, r, Math.PI, 1.5 * Math.PI)
  face(x0, y0, 1, 0, 0, 1, w)
  corner(pts, x0 + w - r, y0 + r, r, 1.5 * Math.PI, 2 * Math.PI)
  face(x0 + w, y0, 0, 1, -1, 0, h)
  corner(pts, x0 + w - r, y0 + h - r, r, 0, HALF_PI)
  face(x0 + w, y0 + h, -1, 0, 0, -1, w)
  corner(pts, x0 + r, y0 + h - r, r, HALF_PI, Math.PI)
  face(x0, y0 + h, 0, -1, 1, 0, h)

  const holes: Vec2[][] = []
  for (let i = 0; i < Math.round(w / module); i++) {
    for (let j = 0; j < Math.round(h / module); j++) {
      holes.push(circle(BORE_R, x0 + (i + 0.5) * module, y0 + (j + 0.5) * module, 16))
    }
  }
  return { outline: pts, holes }
}

const EXTRUSION_SIZES: Record<string, { w: number; h: number; module: number; label: string }> = {
  '2020': { w: 20, h: 20, module: 20, label: '20 × 20' },
  '2040': { w: 20, h: 40, module: 20, label: '20 × 40' },
  '4040': { w: 40, h: 40, module: 20, label: '40 × 40' },
  '3030': { w: 30, h: 30, module: 30, label: '30 × 30' },
  '2060': { w: 20, h: 60, module: 20, label: '20 × 60' },
}

const extrusion: PartDef = {
  id: 'extrusion-tslot',
  name: 'T-slot extrusion',
  category: 'structural',
  blurb: 'Aluminium framing, cut to any length',
  tags: ['extrusion', '2020', '2040', '4040', 'aluminium', 'frame', 'tslot', 'v-slot', 'framing'],
  doc: {
    description:
      'Modular aluminium framing profile. Every face carries a T-slot, so brackets, nuts and panels attach anywhere along the length.',
    price: 0.012, // per mm — roughly $12/m
  },
  params: [
    {
      key: 'size', label: 'Profile', type: 'enum', default: '2020', group: 'Stock',
      options: Object.entries(EXTRUSION_SIZES).map(([value, v]) => ({ value, label: `${value} — ${v.label} mm` })),
    },
    { key: 'length', label: 'Length', type: 'number', unit: 'mm', default: 300, min: 10, max: 4000, step: 10, group: 'Stock' },
    {
      key: 'finish', label: 'Finish', type: 'enum', default: 'alu-6063', group: 'Stock',
      options: [
        { value: 'alu-6063', label: 'Clear anodised (silver)' },
        { value: 'alu-anod-black', label: 'Black anodised' },
      ],
    },
  ],
  solids: (p) => {
    const s = EXTRUSION_SIZES[str(p, 'size', '2020')] ?? EXTRUSION_SIZES['2020']
    const len = num(p, 'length', 300)
    return [
      {
        kind: 'extrude',
        mat: str(p, 'finish', 'alu-6063'),
        profile: tslotProfile(s.w, s.h, s.module),
        depth: len,
        // Extrusions are built along Z; rotate so the length runs along X and
        // the profile sits on the ground plane.
        rot: [0, 90, 0],
        at: [0, s.h / 2, 0],
      },
    ]
  },
  ports: (p) => {
    const s = EXTRUSION_SIZES[str(p, 'size', '2020')] ?? EXTRUSION_SIZES['2020']
    const len = num(p, 'length', 300)
    const ports: Port[] = []

    // End faces — where you tap for a butt joint.
    for (let i = 0; i < Math.round(s.w / s.module); i++) {
      for (let j = 0; j < Math.round(s.h / s.module); j++) {
        const y = (j + 0.5) * s.module
        const z = -s.w / 2 + (i + 0.5) * s.module
        ports.push({ id: `end-a-${i}${j}`, label: 'End A', kind: 'mechanical', pos: [-len / 2, y, z], dir: [-1, 0, 0], mate: { type: 'thread', size: 5, depth: 12 }, groupId: 'end-a' })
        ports.push({ id: `end-b-${i}${j}`, label: 'End B', kind: 'mechanical', pos: [len / 2, y, z], dir: [1, 0, 0], mate: { type: 'thread', size: 5, depth: 12 }, groupId: 'end-b' })
      }
    }

    // Slot anchor points every 20 mm along each face. Capped so a 4 m beam
    // does not produce thousands of snap targets.
    const step = Math.max(s.module, len / 60)
    const faces: { id: string; n: [number, number, number]; at: (x: number, c: number) => [number, number, number]; cells: number }[] = [
      { id: 'front', n: [0, 0, 1], cells: Math.round(s.w / s.module), at: (x, c) => [x, (c + 0.5) * s.module, s.w / 2] },
      { id: 'back', n: [0, 0, -1], cells: Math.round(s.w / s.module), at: (x, c) => [x, (c + 0.5) * s.module, -s.w / 2] },
      { id: 'top', n: [0, 1, 0], cells: Math.round(s.w / s.module), at: (x, c) => [x, s.h, -s.w / 2 + (c + 0.5) * s.module] },
      { id: 'bottom', n: [0, -1, 0], cells: Math.round(s.w / s.module), at: (x, c) => [x, 0, -s.w / 2 + (c + 0.5) * s.module] },
    ]
    for (const f of faces) {
      for (let x = -len / 2 + step / 2; x < len / 2; x += step) {
        for (let c = 0; c < f.cells; c++) {
          ports.push({
            id: `${f.id}-${Math.round(x + len / 2)}-${c}`,
            label: `${f.id} slot`,
            kind: 'mechanical',
            pos: f.at(Math.round(x * 10) / 10, c),
            dir: f.n,
            mate: { type: 'tslot', size: SLOT.mouth },
            groupId: `slot-${f.id}`,
          })
        }
      }
    }
    return ports
  },
  readouts: (p) => {
    const s = EXTRUSION_SIZES[str(p, 'size', '2020')] ?? EXTRUSION_SIZES['2020']
    const len = num(p, 'length', 300)
    const prof = tslotProfile(s.w, s.h, s.module)
    const shoelace = (pts: Vec2[]) => {
      let v = 0
      for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) v += pts[j][0] * pts[i][1] - pts[i][0] * pts[j][1]
      return Math.abs(v / 2)
    }
    const a = shoelace(prof.outline) - (prof.holes ?? []).reduce((s2, h) => s2 + shoelace(h), 0)
    return [
      { label: 'Cross-section', value: `${a.toFixed(0)} mm²` },
      { label: 'Mass per metre', value: `${((a * 1000 * 2.7) / 1000 / 1000).toFixed(3)} kg/m` },
      { label: 'Cut length', value: `${len} mm` },
    ]
  },
}

/* ================================================================== */
/* Sheet / panel stock                                                 */
/* ================================================================== */

/** Nominal ply thickness, mm. Real sheets are built from ~1.5 mm veneers. */
const PLY_LAYER = 1.6

const SHEET_MATS: Record<string, { mat: string; label: string; price: number; laminated?: boolean }> = {
  plywood: { mat: 'plywood', label: 'Birch plywood', price: 0.00004, laminated: true },
  mdf: { mat: 'mdf', label: 'MDF', price: 0.00003 },
  pine: { mat: 'pine', label: 'Pine', price: 0.00005 },
  oak: { mat: 'oak', label: 'White oak', price: 0.00018 },
  walnut: { mat: 'walnut', label: 'Walnut', price: 0.00025 },
  'alu-5052': { mat: 'alu-5052', label: 'Aluminium 5052', price: 0.00022 },
  'steel-zinc': { mat: 'steel-zinc', label: 'Zinc-plated steel', price: 0.00012 },
  'stainless-304': { mat: 'stainless-304', label: 'Stainless 304', price: 0.0004 },
  'acrylic-clear': { mat: 'acrylic-clear', label: 'Acrylic, clear', price: 0.0002 },
  'abs-black': { mat: 'abs-black', label: 'ABS, black', price: 0.00015 },
}

const panel: PartDef = {
  id: 'panel-sheet',
  name: 'Sheet panel',
  category: 'panel',
  blurb: 'Ply, MDF, acrylic, aluminium or steel — any size',
  tags: ['sheet', 'panel', 'plywood', 'mdf', 'acrylic', 'aluminium', 'steel', 'plate', 'board'],
  doc: { description: 'Flat stock cut to size. Use it for enclosure walls, table tops, mounting plates and gussets.' },
  params: [
    {
      key: 'material', label: 'Material', type: 'enum', default: 'plywood', group: 'Stock',
      options: Object.entries(SHEET_MATS).map(([value, v]) => ({ value, label: v.label })),
    },
    { key: 'width', label: 'Width', type: 'number', unit: 'mm', default: 300, min: 5, max: 2500, step: 5, group: 'Size' },
    { key: 'depth', label: 'Depth', type: 'number', unit: 'mm', default: 200, min: 5, max: 2500, step: 5, group: 'Size' },
    { key: 'thickness', label: 'Thickness', type: 'number', unit: 'mm', default: 12, min: 0.5, max: 60, step: 0.5, group: 'Size' },
    { key: 'corner', label: 'Corner radius', type: 'number', unit: 'mm', default: 0, min: 0, max: 100, step: 1, group: 'Size' },
    { key: 'holes', label: 'Corner mount holes', type: 'bool', default: false, group: 'Features' },
    { key: 'holeDia', label: 'Hole Ø', type: 'number', unit: 'mm', default: 5.2, min: 2, max: 20, step: 0.2, group: 'Features', showIf: (p) => p.holes === true },
    { key: 'inset', label: 'Hole inset', type: 'number', unit: 'mm', default: 10, min: 3, max: 100, step: 1, group: 'Features', showIf: (p) => p.holes === true },
  ],
  solids: (p) => {
    const w = num(p, 'width', 300)
    const d = num(p, 'depth', 200)
    const t = num(p, 'thickness', 12)
    const r = num(p, 'corner', 0)
    const mat = SHEET_MATS[str(p, 'material', 'plywood')]?.mat ?? 'plywood'
    const wantHoles = p.holes === true
    const laminated = SHEET_MATS[str(p, 'material', 'plywood')]?.laminated === true

    if (r <= 0 && !wantHoles) {
      // A sawn edge is never a perfect arris; a small break catches the light
      // and stops the panel reading as an untextured slab.
      const edge = Math.min(0.6, t * 0.16, w * 0.004, d * 0.004)
      if (laminated && t >= PLY_LAYER * 2.5) {
        // Plywood shows its veneers on every cut edge — build it as the stack
        // it actually is, with the grain direction alternating.
        const n = Math.max(3, Math.round(t / PLY_LAYER) | 1) // always odd, like real ply
        const lt = t / n
        return Array.from({ length: n }, (_, i) => ({
          kind: 'box' as const,
          mat: i % 2 === 0 ? mat : { color: '#B08A55', rough: 0.78, density: 0.6 },
          size: [w, lt, d] as Vec3,
          at: [0, lt / 2 + i * lt, 0] as Vec3,
        }))
      }
      return [{ kind: 'box', mat, size: [w, t, d], at: [0, t / 2, 0], bevel: edge > 0.05 ? edge : undefined }]
    }
    const outline: Vec2[] = r > 0 ? roundedOutline(w, d, r) : [[-w / 2, -d / 2], [w / 2, -d / 2], [w / 2, d / 2], [-w / 2, d / 2]]
    const holes: Vec2[][] = []
    if (wantHoles) {
      const hr = num(p, 'holeDia', 5.2) / 2
      const inset = num(p, 'inset', 10)
      for (const sx of [-1, 1]) for (const sy of [-1, 1]) {
        holes.push(circle(hr, (sx * (w / 2 - inset)), (sy * (d / 2 - inset)), 16))
      }
    }
    return [{ kind: 'extrude', mat, profile: { outline, holes }, depth: t, rot: [-90, 0, 0], at: [0, t / 2, 0] }]
  },
  ports: (p) => {
    const w = num(p, 'width', 300)
    const d = num(p, 'depth', 200)
    const t = num(p, 'thickness', 12)
    const ports: Port[] = [
      { id: 'top', label: 'Top face', kind: 'mechanical', pos: [0, t, 0], dir: [0, 1, 0], mate: { type: 'face' } },
      { id: 'bottom', label: 'Bottom face', kind: 'mechanical', pos: [0, 0, 0], dir: [0, -1, 0], mate: { type: 'face' } },
    ]
    const edges: [string, number, number, number, number][] = [
      ['edge-x-', -w / 2, 0, -1, 0], ['edge-x+', w / 2, 0, 1, 0],
      ['edge-z-', 0, -d / 2, 0, -1], ['edge-z+', 0, d / 2, 0, 1],
    ]
    for (const [id, x, z, nx, nz] of edges) {
      ports.push({ id, label: 'Edge', kind: 'mechanical', pos: [x, t / 2, z], dir: [nx, 0, nz], mate: { type: 'face' } })
    }
    if (p.holes === true) {
      const inset = num(p, 'inset', 10)
      let i = 0
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
        ports.push({
          id: `hole-${i++}`, label: 'Mount hole', kind: 'mechanical',
          pos: [sx * (w / 2 - inset), t, sz * (d / 2 - inset)], dir: [0, 1, 0],
          mate: { type: 'hole', size: num(p, 'holeDia', 5.2) }, groupId: 'holes',
        })
      }
    }
    return ports
  },
  readouts: (p) => {
    const w = num(p, 'width', 300)
    const d = num(p, 'depth', 200)
    const t = num(p, 'thickness', 12)
    const sm = SHEET_MATS[str(p, 'material', 'plywood')]
    return [
      { label: 'Face area', value: `${((w * d) / 1e6).toFixed(3)} m²` },
      { label: 'Volume', value: `${((w * d * t) / 1e3).toFixed(1)} cm³` },
      { label: 'Est. stock cost', value: '$' + (w * d * (sm?.price ?? 0.00005) * Math.max(1, t / 12)).toFixed(2) },
    ]
  },
}

function roundedOutline(w: number, h: number, r: number): Vec2[] {
  const rr = Math.min(r, w / 2, h / 2)
  const pts: Vec2[] = []
  const corners: [number, number, number][] = [
    [w / 2 - rr, h / 2 - rr, 0],
    [-w / 2 + rr, h / 2 - rr, Math.PI / 2],
    [-w / 2 + rr, -h / 2 + rr, Math.PI],
    [w / 2 - rr, -h / 2 + rr, (3 * Math.PI) / 2],
  ]
  for (const [cx, cy, a0] of corners) {
    for (let i = 0; i <= 6; i++) {
      const a = a0 + (i / 6) * (Math.PI / 2)
      pts.push([cx + Math.cos(a) * rr, cy + Math.sin(a) * rr])
    }
  }
  return pts
}

/* ================================================================== */
/* Dimensional lumber                                                  */
/* ================================================================== */

const LUMBER: Record<string, { w: number; h: number; label: string }> = {
  '1x2': { w: 19, h: 38, label: '1×2 (19 × 38)' },
  '1x4': { w: 19, h: 89, label: '1×4 (19 × 89)' },
  '2x2': { w: 38, h: 38, label: '2×2 (38 × 38)' },
  '2x4': { w: 38, h: 89, label: '2×4 (38 × 89)' },
  '2x6': { w: 38, h: 140, label: '2×6 (38 × 140)' },
  '4x4': { w: 89, h: 89, label: '4×4 (89 × 89)' },
}

const lumber: PartDef = {
  id: 'lumber',
  name: 'Dimensional lumber',
  category: 'structural',
  blurb: 'Stud stock in real (dressed) sizes',
  tags: ['wood', 'lumber', 'timber', '2x4', 'stud', 'framing', 'pine'],
  doc: { description: 'Softwood framing stock. Sizes are actual dressed dimensions, not nominal.', price: 0.0025 },
  params: [
    {
      key: 'size', label: 'Nominal size', type: 'enum', default: '2x4', group: 'Stock',
      options: Object.entries(LUMBER).map(([value, v]) => ({ value, label: v.label })),
    },
    { key: 'length', label: 'Length', type: 'number', unit: 'mm', default: 600, min: 20, max: 6000, step: 10, group: 'Stock' },
    {
      key: 'species', label: 'Species', type: 'enum', default: 'pine', group: 'Stock',
      options: [
        { value: 'pine', label: 'Pine / SPF' },
        { value: 'oak', label: 'White oak' },
        { value: 'walnut', label: 'Walnut' },
      ],
    },
  ],
  solids: (p) => {
    const s = LUMBER[str(p, 'size', '2x4')] ?? LUMBER['2x4']
    const len = num(p, 'length', 600)
    return [{ kind: 'box', mat: str(p, 'species', 'pine'), size: [len, s.h, s.w], at: [0, s.h / 2, 0], bevel: 1.2 }]
  },
  ports: (p) => {
    const s = LUMBER[str(p, 'size', '2x4')] ?? LUMBER['2x4']
    const len = num(p, 'length', 600)
    return [
      { id: 'end-a', label: 'End A', kind: 'mechanical', pos: [-len / 2, s.h / 2, 0], dir: [-1, 0, 0], mate: { type: 'face' } },
      { id: 'end-b', label: 'End B', kind: 'mechanical', pos: [len / 2, s.h / 2, 0], dir: [1, 0, 0], mate: { type: 'face' } },
      { id: 'top', label: 'Top face', kind: 'mechanical', pos: [0, s.h, 0], dir: [0, 1, 0], mate: { type: 'face' } },
      { id: 'bottom', label: 'Bottom face', kind: 'mechanical', pos: [0, 0, 0], dir: [0, -1, 0], mate: { type: 'face' } },
    ]
  },
  readouts: (p) => {
    const s = LUMBER[str(p, 'size', '2x4')] ?? LUMBER['2x4']
    return [{ label: 'Actual section', value: `${s.w} × ${s.h} mm` }]
  },
}

/* ================================================================== */
/* Aluminium extrusion hardware                                        */
/* ================================================================== */

const cornerBracket: PartDef = {
  id: 'bracket-corner-2020',
  name: 'Corner bracket',
  category: 'fastener',
  blurb: '90° gusset for T-slot framing',
  tags: ['bracket', 'corner', 'gusset', '2020', 'angle', 'joint'],
  doc: { description: 'Die-cast 90° corner bracket. Two M5 button heads and two T-nuts hold a right-angle joint.', price: 0.75 },
  params: [
    { key: 'size', label: 'For profile', type: 'enum', default: '20', group: 'Fit', options: [{ value: '20', label: '20 series' }, { value: '30', label: '30 series' }, { value: '40', label: '40 series' }] },
    { key: 'finish', label: 'Finish', type: 'enum', default: 'alu-anod-black', group: 'Fit', options: [{ value: 'alu-anod-black', label: 'Black' }, { value: 'alu-6063', label: 'Silver' }] },
  ],
  solids: (p) => {
    const s = num(p, 'size', 20) || 20
    const t = s * 0.2
    const mat = str(p, 'finish', 'alu-anod-black')
    const leg = s
    return [
      { kind: 'box', mat, size: [leg, t, s * 0.8], at: [leg / 2, t / 2, 0], bevel: 0.8 },
      { kind: 'box', mat, size: [t, leg, s * 0.8], at: [t / 2, leg / 2, 0], bevel: 0.8 },
      { kind: 'box', mat, size: [leg * 0.5, t * 0.6, s * 0.8], at: [leg * 0.28, leg * 0.28, 0], rot: [0, 0, 45], bevel: 0.6 },
    ]
  },
  ports: (p) => {
    const s = num(p, 'size', 20) || 20
    return [
      { id: 'a', label: 'Leg A', kind: 'mechanical', pos: [s * 0.6, 0, 0], dir: [0, -1, 0], mate: { type: 'hole', size: 5.5 } },
      { id: 'b', label: 'Leg B', kind: 'mechanical', pos: [0, s * 0.6, 0], dir: [-1, 0, 0], mate: { type: 'hole', size: 5.5 } },
    ]
  },
}

const tnut: PartDef = {
  id: 'tnut-2020',
  name: 'T-nut',
  category: 'fastener',
  blurb: 'Drop-in nut for extrusion slots',
  tags: ['tnut', 't-nut', 'nut', '2020', 'm5', 'slot'],
  doc: { description: 'Drop-in / slide-in T-nut. Sits in the slot so a bolt can clamp anything to the frame.', price: 0.18 },
  params: [
    { key: 'thread', label: 'Thread', type: 'enum', default: 'M5', group: 'Fit', options: [{ value: 'M3', label: 'M3' }, { value: 'M4', label: 'M4' }, { value: 'M5', label: 'M5' }, { value: 'M6', label: 'M6' }] },
  ],
  solids: () => [
    { kind: 'box', mat: 'steel-zinc', size: [10.4, 1.8, 5.9], at: [0, 0.9, 0], bevel: 0.3 },
    { kind: 'box', mat: 'steel-zinc', size: [5.9, 1.4, 5.9], at: [0, 2.5, 0] },
    { kind: 'cyl', mat: { color: '#3A3F45', rough: 0.6, density: 0.01 }, r: 2.5, h: 3.4, at: [0, 1.7, 0] },
  ],
  ports: (p) => [
    { id: 'thread', label: str(p, 'thread', 'M5') + ' thread', kind: 'mechanical', pos: [0, 3.2, 0], dir: [0, 1, 0], mate: { type: 'thread', size: parseInt(str(p, 'thread', 'M5').slice(1), 10) } },
    { id: 'slot', label: 'Slot seat', kind: 'mechanical', pos: [0, 0, 0], dir: [0, -1, 0], mate: { type: 'tslot', size: 6.2 } },
  ],
}

const screw: PartDef = {
  id: 'screw-bhcs',
  name: 'Button-head screw',
  category: 'fastener',
  blurb: 'Metric socket screw, any length',
  tags: ['screw', 'bolt', 'm3', 'm4', 'm5', 'm6', 'fastener', 'hex', 'socket'],
  doc: { description: 'Button-head cap screw with a hex socket drive.', price: 0.08 },
  params: [
    { key: 'thread', label: 'Thread', type: 'enum', default: 'M5', group: 'Fit', options: [{ value: 'M2', label: 'M2' }, { value: 'M2.5', label: 'M2.5' }, { value: 'M3', label: 'M3' }, { value: 'M4', label: 'M4' }, { value: 'M5', label: 'M5' }, { value: 'M6', label: 'M6' }, { value: 'M8', label: 'M8' }] },
    { key: 'length', label: 'Length', type: 'number', unit: 'mm', default: 10, min: 3, max: 120, step: 1, group: 'Fit' },
    { key: 'finish', label: 'Finish', type: 'enum', default: 'steel', group: 'Fit', options: [{ value: 'steel', label: 'Black oxide' }, { value: 'stainless-304', label: 'Stainless' }, { value: 'steel-zinc', label: 'Zinc plated' }] },
  ],
  solids: (p) => {
    const d = parseFloat(str(p, 'thread', 'M5').slice(1))
    const len = num(p, 'length', 10)
    const mat = str(p, 'finish', 'steel')
    const headD = d * 1.9
    const headH = d * 0.55
    return [
      { kind: 'lathe', mat, seg: 24, points: [
        [0, headH], [headD * 0.42, headH], [headD / 2, headH * 0.55], [headD / 2, 0], [d / 2, 0], [d / 2, -len], [d * 0.42, -len],  [0, -len],
      ] },
      { kind: 'cyl', mat: { color: '#0E1013', rough: 0.9, density: 0.01 }, r: d * 0.3, h: headH * 0.7, seg: 6, at: [0, headH * 0.7, 0], noCollide: true },
    ]
  },
  ports: (p) => {
    const len = num(p, 'length', 10)
    const d = parseFloat(str(p, 'thread', 'M5').slice(1))
    return [{ id: 'shank', label: 'Shank', kind: 'mechanical', pos: [0, -len / 2, 0], dir: [0, -1, 0], mate: { type: 'stud', size: d } }]
  },
}

registerParts([extrusion, panel, lumber, cornerBracket, tnut, screw])
