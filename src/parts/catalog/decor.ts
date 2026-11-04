import type { PartDef, Port, Solid, Vec3 } from '../kernel/types'
import { registerParts } from '../kernel/registry'
import { bool, num, str } from './_helpers'
import { ALU, STEEL } from './setup'

/**
 * The finish: the parts of a setup with no electrical content at all.
 *
 * This is the one file in the catalogue that is here because the owner asked
 * for cosmetic things, and it would be easy for it to become the junk drawer
 * the rest of the catalogue has been kept clear of. So the test is different
 * here, and it is still a test: **a cosmetic part has to be in the way of
 * something.**
 *
 * A shelf takes a span and puts a load on two fixings. A plant takes a pot
 * diameter of desk and grows into the space above it. An acoustic panel
 * covers a percentage of a wall and has a real absorption coefficient. A mat
 * sets the area the keyboard and mouse live in. A riser puts a screen at a
 * height and a laptop under it. A cable tray decides whether the leads are a
 * problem. Every one of them changes a dimension that the parts around it
 * have to fit, which is the only way a thing with no circuit in it earns a
 * place in a tool that solves circuits.
 *
 * What is deliberately not here: ornaments with no dimension anybody cares
 * about. If the answer to "what does this change" is "it looks nice", it
 * does not go in the library.
 */

const TIMBER = { color: '#6B4A2E', rough: 0.72, density: 0.68 }
const OAK = { color: '#9C7348', rough: 0.68, density: 0.72 }
const FELT = { color: '#2A2D33', rough: 0.96, density: 0.25 }
const SOIL = { color: '#2A2118', rough: 0.98, density: 1.3 }
const LEAF = { color: '#2E5B36', rough: 0.78, density: 0.6 }

/* ================================================================== */
/* On the desk                                                         */
/* ================================================================== */

const deskMat: PartDef = {
  id: 'mat-desk',
  name: 'Desk mat',
  category: 'decor',
  blurb: 'The area the keyboard and mouse are allowed',
  tags: ['desk mat', 'deskmat', 'mousepad', 'mouse mat', 'felt', 'leather', 'desk', 'surface', 'cosmetic'],
  doc: {
    price: 35,
    description:
      'A mat is a decision about layout wearing a decision about taste. The usual 900 by 400 takes the full width of a 1200 mm desk once the monitor stand is on it, and it sets where the keyboard can sit: the mouse needs 250 mm of swing to the right of it, and if the mat does not have that, the mouse spends its life half off the edge.',
  },
  params: [
    { key: 'width', label: 'Width', type: 'number', unit: 'mm', default: 900, min: 250, max: 1400, step: 10, group: 'Mat' },
    { key: 'depth', label: 'Depth', type: 'number', unit: 'mm', default: 400, min: 200, max: 700, step: 10, group: 'Mat' },
    {
      key: 'material', label: 'Material', type: 'enum', default: 'cloth', group: 'Mat',
      options: [
        { value: 'cloth', label: 'Stitched cloth, 4 mm' },
        { value: 'felt', label: 'Wool felt, 3 mm' },
        { value: 'leather', label: 'Leather, 2 mm' },
        { value: 'glass', label: 'Glass, 4 mm' },
      ],
    },
    { key: 'tint', label: 'Colour', type: 'color', default: '#2A2D33', group: 'Mat' },
  ],
  solids: (p) => {
    const w = num(p, 'width', 900)
    const d = num(p, 'depth', 400)
    const material = str(p, 'material', 'cloth')
    const t = material === 'leather' ? 2 : material === 'felt' ? 3 : 4
    const tint = str(p, 'tint', '#2A2D33')
    const mat =
      material === 'glass'
        ? { color: '#C6CBD2', rough: 0.08, clearcoat: 1, density: 2.5, opacity: 0.5, transmission: 0.6 }
        : material === 'leather'
          ? { color: tint, rough: 0.55, clearcoat: 0.3, density: 0.9 }
          : { color: tint, rough: 0.95, density: 0.3 }
    const out: Solid[] = [{ kind: 'box', mat, size: [w, t, d], at: [0, t / 2, 0], bevel: material === 'glass' ? 1 : 1.4 }]
    if (material === 'cloth') {
      // The stitched edge, which is the only thing that distinguishes it.
      out.push({ kind: 'box', mat: { color: tint, rough: 0.9, density: 0.3 }, size: [w - 6, t + 0.6, d - 6], at: [0, t / 2, 0], bevel: 2, noCollide: true })
    }
    return out
  },
  ports: (p) => {
    const w = num(p, 'width', 900)
    const t = str(p, 'material', 'cloth') === 'leather' ? 2 : str(p, 'material', 'cloth') === 'felt' ? 3 : 4
    return [
      { id: 'desk', label: 'Desk', kind: 'mechanical', pos: [0, 0, 0], dir: [0, -1, 0], mate: { type: 'face' } },
      { id: 'top', label: 'Working surface', kind: 'mechanical', pos: [0, t, 0], dir: [0, 1, 0], mate: { type: 'face' } },
      { id: 'left', label: 'Keyboard zone', kind: 'mechanical', pos: [-w / 4, t, 0], dir: [0, 1, 0], mate: { type: 'face' } },
      { id: 'right', label: 'Mouse zone', kind: 'mechanical', pos: [w / 3, t, 0], dir: [0, 1, 0], mate: { type: 'face' } },
    ]
  },
  mass: (p) => {
    const a = (num(p, 'width', 900) * num(p, 'depth', 400)) / 1e6
    const material = str(p, 'material', 'cloth')
    return a * (material === 'glass' ? 9800 : material === 'leather' ? 1100 : 900)
  },
  price: (p) => {
    const a = (num(p, 'width', 900) * num(p, 'depth', 400)) / 1e6
    const material = str(p, 'material', 'cloth')
    return Math.round(a * (material === 'glass' ? 160 : material === 'leather' ? 190 : material === 'felt' ? 90 : 75) + 8)
  },
  readouts: (p) => {
    const w = num(p, 'width', 900)
    const d = num(p, 'depth', 400)
    // A full-size keyboard is 440 mm; a tenkeyless is 360.
    const forMouse = w - 440
    return [
      { label: 'Area', value: `${w} × ${d} mm` },
      { label: 'Beside a full keyboard', value: forMouse > 0 ? `${forMouse} mm for the mouse` : 'Nothing, the keyboard fills it' },
      { label: 'Mouse swing', value: forMouse >= 250 ? 'Enough at low sensitivity' : forMouse >= 160 ? 'Enough at high sensitivity' : 'The mouse will run off the edge' },
    ]
  },
}

const monitorRiser: PartDef = {
  id: 'riser-monitor',
  name: 'Monitor riser',
  category: 'decor',
  blurb: 'Height for the screen, and a slot under it',
  tags: ['riser', 'monitor stand', 'shelf', 'laptop stand', 'desk shelf', 'ergonomic', 'storage', 'desk', 'wood'],
  doc: {
    price: 55,
    description:
      'Two useful dimensions. The top sets how high the screen sits, and the ergonomic target is the top of the panel level with your eyes, which for a 470 mm seat and a 740 mm desk is around 100 to 140 mm of lift for a 27 inch monitor. The clearance underneath sets what fits in the gap, and the usual answer is a keyboard at 35 mm or a laptop at 20.',
  },
  params: [
    { key: 'width', label: 'Width', type: 'number', unit: 'mm', default: 600, min: 300, max: 1200, step: 10, group: 'Riser' },
    { key: 'depth', label: 'Depth', type: 'number', unit: 'mm', default: 250, min: 180, max: 400, step: 10, group: 'Riser' },
    { key: 'height', label: 'Height', type: 'number', unit: 'mm', default: 120, min: 40, max: 250, step: 5, group: 'Riser' },
    {
      key: 'material', label: 'Material', type: 'enum', default: 'oak', group: 'Riser',
      options: [{ value: 'oak', label: 'Solid oak' }, { value: 'walnut', label: 'Walnut' }, { value: 'alu', label: 'Aluminium' }, { value: 'steel', label: 'Powder-coated steel' }],
    },
    { key: 'load', label: 'Load on top', type: 'number', unit: 'g', default: 6000, min: 0, max: 40000, step: 500, group: 'Load' },
  ],
  solids: (p) => {
    const w = num(p, 'width', 600)
    const d = num(p, 'depth', 250)
    const h = num(p, 'height', 120)
    const material = str(p, 'material', 'oak')
    const mat = material === 'alu' ? ALU : material === 'steel' ? { color: '#2A2C30', rough: 0.7, density: 7.8 } : material === 'walnut' ? TIMBER : OAK
    const t = material === 'oak' || material === 'walnut' ? 18 : 6
    return [
      { kind: 'box', mat, size: [w, t, d], at: [0, h - t / 2, 0], bevel: 2 },
      ...([-1, 1] as const).map((sx) => ({
        kind: 'box' as const, mat, size: [t, h - t, d - 20] as Vec3,
        at: [sx * (w / 2 - t / 2), (h - t) / 2, 0] as Vec3, bevel: 1.5,
      })),
    ]
  },
  ports: (p) => {
    const w = num(p, 'width', 600)
    const h = num(p, 'height', 120)
    const material = str(p, 'material', 'oak')
    const t = material === 'oak' || material === 'walnut' ? 18 : 6
    return [
      { id: 'desk', label: 'Desk', kind: 'mechanical', pos: [0, 0, 0], dir: [0, -1, 0], mate: { type: 'face' } },
      { id: 'top', label: 'Top', kind: 'mechanical', pos: [0, h, 0], dir: [0, 1, 0], mate: { type: 'face' } },
      { id: 'under', label: 'Underneath', kind: 'mechanical', pos: [0, 0, 0], dir: [0, 1, 0], mate: { type: 'face' } },
      { id: 'left', label: 'Left foot', kind: 'mechanical', pos: [-w / 2 + t / 2, 0, 0], dir: [0, -1, 0], mate: { type: 'face' } },
    ]
  },
  mass: (p) => {
    const w = num(p, 'width', 600)
    const d = num(p, 'depth', 250)
    const h = num(p, 'height', 120)
    const material = str(p, 'material', 'oak')
    const wood = material === 'oak' || material === 'walnut'
    const vol = wood ? (w * d * 18 + 2 * 18 * (h - 18) * d) / 1e3 : (w * d * 6 + 2 * 6 * (h - 6) * d) / 1e3
    return vol * (wood ? 0.7 : material === 'alu' ? 2.7 : 7.8)
  },
  price: (p) => {
    const a = (num(p, 'width', 600) * num(p, 'depth', 250)) / 1e6
    const material = str(p, 'material', 'oak')
    return Math.round(18 + a * (material === 'walnut' ? 320 : material === 'oak' ? 220 : material === 'alu' ? 260 : 140))
  },
  readouts: (p) => {
    const h = num(p, 'height', 120)
    const material = str(p, 'material', 'oak')
    const t = material === 'oak' || material === 'walnut' ? 18 : 6
    const load = num(p, 'load', 6000)
    const clear = h - t
    return [
      { label: 'Lift', value: `${h} mm to the top` },
      { label: 'Clearance under', value: `${clear} mm — ${clear >= 40 ? 'a full keyboard fits' : clear >= 22 ? 'a low-profile keyboard or a laptop' : 'papers only'}` },
      { label: 'Screen top ends up at', value: `${h + 420} mm above the desk, for a 27 inch panel on its own stand` },
      { label: 'Carrying', value: `${(load / 1000).toFixed(1)} kg${load > 25000 ? ', which is past a wooden riser' : ''}` },
    ]
  },
}

const plant: PartDef = {
  id: 'plant-potted',
  name: 'Potted plant',
  category: 'decor',
  blurb: 'A pot diameter of surface, and a canopy above it',
  tags: ['plant', 'pot', 'greenery', 'monstera', 'snake plant', 'decor', 'cosmetic', 'desk', 'floor', 'room'],
  doc: {
    price: 30,
    description:
      'In the catalogue as a volume. The pot takes a circle of desk or floor and the plant grows out of it into the space above and around, which is the part people leave out of a plan and then discover is where the monitor arm swings.\n\nThe species presets are the real proportions: a snake plant is narrow and tall, a monstera is as wide as it is high and gets wider, a pothos trails below the pot and needs the shelf it is on to be clear underneath.',
  },
  params: [
    {
      key: 'species', label: 'Plant', type: 'enum', default: 'monstera', group: 'Plant',
      options: [
        { value: 'snake', label: 'Snake plant, narrow' },
        { value: 'monstera', label: 'Monstera, wide' },
        { value: 'pothos', label: 'Pothos, trailing' },
        { value: 'cactus', label: 'Cactus, small' },
        { value: 'fig', label: 'Fiddle leaf fig, tall' },
      ],
    },
    { key: 'pot', label: 'Pot diameter', type: 'number', unit: 'mm', default: 180, min: 60, max: 500, step: 10, group: 'Pot' },
    { key: 'potStyle', label: 'Pot', type: 'enum', default: 'ceramic', group: 'Pot', options: [{ value: 'ceramic', label: 'Glazed ceramic' }, { value: 'terracotta', label: 'Terracotta' }, { value: 'concrete', label: 'Concrete' }, { value: 'plastic', label: 'Nursery plastic' }] },
    { key: 'tint', label: 'Pot colour', type: 'color', default: '#D8D3C8', group: 'Pot' },
    { key: 'height', label: 'Plant height', type: 'number', unit: 'mm', default: 520, min: 80, max: 2200, step: 20, group: 'Plant' },
  ],
  solids: (p) => {
    const d = num(p, 'pot', 180)
    const h = num(p, 'height', 520)
    const species = str(p, 'species', 'monstera')
    const style = str(p, 'potStyle', 'ceramic')
    const tint = str(p, 'tint', '#D8D3C8')
    const potMat =
      style === 'terracotta' ? { color: '#A8603C', rough: 0.85, density: 1.9 }
      : style === 'concrete' ? { color: '#8C8882', rough: 0.9, density: 2.3 }
      : style === 'plastic' ? { color: '#2C2E31', rough: 0.6, density: 1.2 }
      : { color: tint, rough: 0.3, clearcoat: 0.6, density: 2.2 }
    const potH = d * 0.85
    const out: Solid[] = [
      { kind: 'lathe', mat: potMat, seg: 32, points: [[1, 0], [d * 0.36, 0], [d * 0.5, potH], [d * 0.5 - 6, potH], [d * 0.36 - 6, 6], [1, 6]] },
      { kind: 'cyl', mat: SOIL, r: d * 0.47, h: 10, seg: 28, at: [0, potH - 12, 0] },
    ]
    const canopy = h - potH
    if (species === 'snake') {
      // Blades, straight up, from the middle of the pot.
      for (let i = 0; i < 7; i++) {
        const a = (i / 7) * Math.PI * 2
        out.push({ kind: 'box', mat: LEAF, size: [canopy * 0.14, canopy, 6], at: [Math.cos(a) * d * 0.14, potH + canopy / 2, Math.sin(a) * d * 0.14], rot: [Math.sin(a) * 8, (-a * 180) / Math.PI, Math.cos(a) * 8] })
      }
    } else if (species === 'cactus') {
      out.push({ kind: 'cyl', mat: LEAF, r: Math.min(d * 0.3, canopy * 0.28), h: canopy, seg: 14, at: [0, potH + canopy / 2, 0] })
      out.push({ kind: 'sphere', mat: LEAF, r: Math.min(d * 0.3, canopy * 0.28), seg: 14, at: [0, potH + canopy, 0] })
    } else {
      // A stem and a set of leaf discs, which is as much as a plant needs to
      // be in a layout: the spread is the number that matters.
      const spread = species === 'monstera' ? h * 0.9 : species === 'fig' ? h * 0.45 : h * 0.7
      out.push({ kind: 'cyl', mat: { color: '#3C5C38', rough: 0.8, density: 0.6 }, r: 8, h: canopy * 0.8, seg: 10, at: [0, potH + canopy * 0.4, 0] })
      const leaves = species === 'fig' ? 9 : 7
      for (let i = 0; i < leaves; i++) {
        const a = (i / leaves) * Math.PI * 2 + 0.4
        const t = 0.4 + (i / leaves) * 0.6
        const lx = Math.cos(a) * spread * 0.34 * t
        const lz = Math.sin(a) * spread * 0.34 * t
        const ly = species === 'pothos' ? potH + canopy * (0.9 - t * 0.9) : potH + canopy * (0.3 + t * 0.6)
        out.push({ kind: 'cyl', mat: LEAF, r: spread * 0.16, h: 4, seg: 16, rot: [18 * Math.cos(a), 0, 18 * Math.sin(a)], at: [lx, ly, lz] })
      }
    }
    return out
  },
  ports: (p) => {
    const d = num(p, 'pot', 180)
    return [
      { id: 'base', label: 'Surface', kind: 'mechanical', pos: [0, 0, 0], dir: [0, -1, 0], mate: { type: 'face' } },
      { id: 'rim', label: 'Pot rim', kind: 'mechanical', pos: [0, d * 0.85, 0], dir: [0, 1, 0], mate: { type: 'face' } },
    ]
  },
  mass: (p) => {
    const d = num(p, 'pot', 180)
    // Soil is the mass, not the plant: about 1.3 g/cm3, wet rather more.
    const soil = (Math.PI * (d * 0.42) ** 2 * d * 0.7) / 1000
    return soil * 1.3 + 300
  },
  price: (p) => {
    const h = num(p, 'height', 520)
    const style = str(p, 'potStyle', 'ceramic')
    return Math.round(h * 0.035 + (style === 'plastic' ? 2 : style === 'terracotta' ? 10 : 22))
  },
  readouts: (p) => {
    const d = num(p, 'pot', 180)
    const h = num(p, 'height', 520)
    const species = str(p, 'species', 'monstera')
    const spread = species === 'monstera' ? h * 0.9 : species === 'fig' ? h * 0.45 : species === 'snake' ? h * 0.3 : h * 0.7
    const wetMass = (Math.PI * (d * 0.42) ** 2 * d * 0.7) / 1000 * 1.55 + 300
    return [
      { label: 'Footprint', value: `${d} mm circle` },
      { label: 'Canopy', value: `${Math.round(spread)} mm across, at ${h} mm tall` },
      { label: 'Keep clear', value: `${Math.round(spread / 2 + 60)} mm around it` },
      { label: 'Mass watered', value: `${(wetMass / 1000).toFixed(1)} kg${wetMass > 9000 ? ', which is past a wall shelf' : ''}` },
    ]
  },
}

const figure: PartDef = {
  id: 'figure-display',
  name: 'Display figure',
  category: 'decor',
  blurb: 'A scale model on a base, taking a square of shelf',
  tags: ['figure', 'figurine', 'model', 'collectible', 'statue', 'scale model', 'decor', 'cosmetic', 'shelf'],
  doc: {
    price: 45,
    description:
      'The honest version of an ornament: a footprint, a height and a scale. It is in the library because a shelf of them is a real volume and a real load, and because a display case or a deep shelf is sized against the tallest one on it.',
  },
  params: [
    { key: 'height', label: 'Height', type: 'number', unit: 'mm', default: 220, min: 40, max: 900, step: 10, group: 'Figure' },
    { key: 'scale', label: 'Scale', type: 'enum', default: '1/7', group: 'Figure', options: ['1/4', '1/6', '1/7', '1/10', '1/12', '1/18'].map((v) => ({ value: v, label: v })) },
    { key: 'base', label: 'Base diameter', type: 'number', unit: 'mm', default: 120, min: 40, max: 400, step: 10, group: 'Figure' },
    { key: 'tint', label: 'Colour', type: 'color', default: '#B9BEC6', group: 'Figure' },
    { key: 'cased', label: 'Acrylic case', type: 'bool', default: false, group: 'Display' },
  ],
  solids: (p) => {
    const h = num(p, 'height', 220)
    const base = num(p, 'base', 120)
    const tint = str(p, 'tint', '#B9BEC6')
    const mat = { color: tint, rough: 0.45, clearcoat: 0.3, density: 1.3 }
    const out: Solid[] = [
      { kind: 'cyl', mat: { color: '#1A1B1E', rough: 0.4, clearcoat: 0.5, density: 1.4 }, r: base / 2, h: 12, seg: 28, at: [0, 6, 0], chamfer: 2 },
      // A figure, as a mass with a head and two limbs: enough to read as one
      // at the scale a plan is looked at, and no pretence of more.
      { kind: 'cyl', mat, r: base * 0.2, r2: base * 0.14, h: h * 0.52, seg: 16, at: [0, 12 + h * 0.26, 0] },
      { kind: 'sphere', mat, r: base * 0.15, seg: 16, at: [0, 12 + h * 0.62, 0] },
      { kind: 'box', mat, size: [base * 0.52, h * 0.1, base * 0.16], at: [0, 12 + h * 0.46, base * 0.04], rot: [0, 0, 14] },
      { kind: 'cyl', mat, r: base * 0.09, h: h * 0.3, seg: 12, at: [base * 0.1, 12 + h * 0.15, 0], rot: [0, 0, -6] },
    ]
    if (bool(p, 'cased', false)) {
      const cw = base + 40
      out.push({ kind: 'box', mat: { color: '#C8CCD2', rough: 0.08, clearcoat: 1, density: 1.2, opacity: 0.18, transmission: 0.85 }, size: [cw, h + 50, cw], at: [0, (h + 50) / 2, 0] })
    }
    return out
  },
  ports: (p) => [
    { id: 'base', label: 'Shelf', kind: 'mechanical', pos: [0, 0, 0], dir: [0, -1, 0], mate: { type: 'face' } },
    { id: 'top', label: 'Top', kind: 'mechanical', pos: [0, num(p, 'height', 220) + (bool(p, 'cased', false) ? 50 : 12), 0], dir: [0, 1, 0], mate: { type: 'face' } },
  ],
  mass: (p) => {
    const h = num(p, 'height', 220)
    const base = num(p, 'base', 120)
    return h * base * 0.018 + (bool(p, 'cased', false) ? (base + 40) * (h + 50) * 0.012 : 0)
  },
  price: (p) => Math.round(num(p, 'height', 220) * 0.22 + (bool(p, 'cased', false) ? 28 : 0)),
  readouts: (p) => {
    const h = num(p, 'height', 220)
    const base = num(p, 'base', 120)
    const cased = bool(p, 'cased', false)
    const scale = str(p, 'scale', '1/7')
    const denom = parseFloat(scale.split('/')[1]) || 7
    return [
      { label: 'Shelf taken', value: cased ? `${base + 40} mm square` : `${base} mm circle` },
      { label: 'Height needed', value: `${cased ? h + 50 : h} mm of clear shelf` },
      { label: 'Represents', value: `${((h * denom) / 1000).toFixed(2)} m at ${scale}` },
    ]
  },
}

/* ================================================================== */
/* On the wall                                                         */
/* ================================================================== */

const framedPrint: PartDef = {
  id: 'print-framed',
  name: 'Framed print',
  category: 'decor',
  blurb: 'Wall area, at a height, on one fixing',
  tags: ['print', 'poster', 'frame', 'picture', 'art', 'wall art', 'decor', 'cosmetic', 'wall', 'gallery'],
  doc: {
    price: 40,
    description:
      'A rectangle on a wall, and two conventions worth encoding. Hung art is centred at about 1450 mm, which is eye height standing — a print hung at the height it looks right on a plan is nearly always too high. And a frame on a plasterboard wall is one fixing carrying the whole mass at a lever arm, which is the reason an A1 frame needs a plug and an A4 one does not.',
  },
  params: [
    {
      key: 'size', label: 'Size', type: 'enum', default: 'a2', group: 'Print',
      options: [
        { value: 'a4', label: 'A4, 210 × 297' },
        { value: 'a3', label: 'A3, 297 × 420' },
        { value: 'a2', label: 'A2, 420 × 594' },
        { value: 'a1', label: 'A1, 594 × 841' },
        { value: 'a0', label: 'A0, 841 × 1189' },
      ],
    },
    { key: 'portrait', label: 'Portrait', type: 'bool', default: true, group: 'Print' },
    { key: 'mount', label: 'Mount border', type: 'number', unit: 'mm', default: 40, min: 0, max: 120, step: 5, group: 'Print' },
    {
      key: 'frame', label: 'Frame', type: 'enum', default: 'black', group: 'Print',
      options: [{ value: 'black', label: 'Black, 20 mm' }, { value: 'oak', label: 'Oak, 20 mm' }, { value: 'alu', label: 'Aluminium, 10 mm' }, { value: 'none', label: 'Unframed' }],
    },
    { key: 'centre', label: 'Centre height', type: 'number', unit: 'mm', default: 1450, min: 600, max: 2200, step: 10, group: 'Hanging' },
    { key: 'tint', label: 'Image', type: 'color', default: '#3E4A5C', group: 'Print' },
  ],
  solids: (p) => {
    const sizes: Record<string, [number, number]> = { a4: [210, 297], a3: [297, 420], a2: [420, 594], a1: [594, 841], a0: [841, 1189] }
    const [sw, sh] = sizes[str(p, 'size', 'a2')] ?? sizes.a2
    const portrait = bool(p, 'portrait', true)
    const w = portrait ? sw : sh
    const h = portrait ? sh : sw
    const frame = str(p, 'frame', 'black')
    const fw = frame === 'none' ? 0 : frame === 'alu' ? 10 : 20
    const mount = num(p, 'mount', 40)
    const frameMat = frame === 'oak' ? OAK : frame === 'alu' ? ALU : { color: '#15161A', rough: 0.55, density: 0.8 }
    const out: Solid[] = []
    if (fw > 0) {
      // Four rails, so the frame is a frame rather than a slab.
      out.push({ kind: 'box', mat: frameMat, size: [w + fw * 2, fw, 24], at: [0, h / 2 + fw / 2, 0] })
      out.push({ kind: 'box', mat: frameMat, size: [w + fw * 2, fw, 24], at: [0, -h / 2 - fw / 2, 0] })
      out.push({ kind: 'box', mat: frameMat, size: [fw, h, 24], at: [-w / 2 - fw / 2, 0, 0] })
      out.push({ kind: 'box', mat: frameMat, size: [fw, h, 24], at: [w / 2 + fw / 2, 0, 0] })
      out.push({ kind: 'box', mat: { color: '#F2EFE9', rough: 0.9, density: 0.8 }, size: [w, h, 3], at: [0, 0, -8] })
    }
    out.push({
      kind: 'box',
      mat: { color: str(p, 'tint', '#3E4A5C'), rough: 0.6, density: 0.8 },
      size: [Math.max(20, w - mount * 2), Math.max(20, h - mount * 2), 2],
      at: [0, 0, fw > 0 ? -6 : 0],
    })
    return out
  },
  ports: (p) => {
    const sizes: Record<string, [number, number]> = { a4: [210, 297], a3: [297, 420], a2: [420, 594], a1: [594, 841], a0: [841, 1189] }
    const [sw, sh] = sizes[str(p, 'size', 'a2')] ?? sizes.a2
    const h = bool(p, 'portrait', true) ? sh : sw
    return [
      { id: 'hook', label: 'Hanging point', kind: 'mechanical', pos: [0, h / 2 - 60, -14], dir: [0, 0, -1], mate: { type: 'hole', size: 6 } },
      { id: 'wall', label: 'Wall', kind: 'mechanical', pos: [0, 0, -12], dir: [0, 0, -1], mate: { type: 'face' } },
    ] as Port[]
  },
  mass: (p) => {
    const sizes: Record<string, [number, number]> = { a4: [210, 297], a3: [297, 420], a2: [420, 594], a1: [594, 841], a0: [841, 1189] }
    const [sw, sh] = sizes[str(p, 'size', 'a2')] ?? sizes.a2
    const a = (sw * sh) / 1e6
    const frame = str(p, 'frame', 'black')
    // Glass is the mass: 2 mm float is 5 kg a square metre.
    return a * (frame === 'none' ? 200 : 5600) + (frame === 'none' ? 0 : a * 2200)
  },
  price: (p) => {
    const sizes: Record<string, [number, number]> = { a4: 14, a3: 22, a2: 34, a1: 58, a0: 95 } as never
    const base = (sizes as unknown as Record<string, number>)[str(p, 'size', 'a2')] ?? 34
    const frame = str(p, 'frame', 'black')
    return Math.round(base * (frame === 'none' ? 1 : frame === 'alu' ? 2.4 : 2))
  },
  readouts: (p) => {
    const sizes: Record<string, [number, number]> = { a4: [210, 297], a3: [297, 420], a2: [420, 594], a1: [594, 841], a0: [841, 1189] }
    const [sw, sh] = sizes[str(p, 'size', 'a2')] ?? sizes.a2
    const portrait = bool(p, 'portrait', true)
    const w = portrait ? sw : sh
    const h = portrait ? sh : sw
    const frame = str(p, 'frame', 'black')
    const fw = frame === 'none' ? 0 : frame === 'alu' ? 10 : 20
    const a = (sw * sh) / 1e6
    const mass = a * (frame === 'none' ? 200 : 7800)
    const centre = num(p, 'centre', 1450)
    return [
      { label: 'Wall area', value: `${w + fw * 2} × ${h + fw * 2} mm` },
      { label: 'Hangs between', value: `${Math.round(centre - h / 2 - fw)} and ${Math.round(centre + h / 2 + fw)} mm` },
      { label: 'Mass', value: `${(mass / 1000).toFixed(2)} kg` },
      { label: 'Fixing', value: mass > 4000 ? 'Two fixings into plugs, or a stud' : mass > 1500 ? 'One plug, 6 mm' : 'A picture hook will do' },
    ]
  },
}

const acousticPanel: PartDef = {
  id: 'panel-acoustic',
  name: 'Acoustic panel',
  category: 'decor',
  blurb: 'Absorption, by coverage and by thickness',
  tags: ['acoustic panel', 'absorber', 'foam', 'treatment', 'sound', 'studio', 'wall', 'decor', 'nrc', 'echo'],
  doc: {
    price: 32,
    description:
      'The one in this file with physics in it. Absorption depends on thickness, because a panel absorbs well down to about a quarter of its own depth in wavelength: 50 mm of mineral wool works above roughly 500 Hz, 100 mm works above 250, and nothing thin does anything at all to a 100 Hz room mode. Foam tiles 25 mm thick, which is what most people buy, treat only the top two octaves and leave the problem untouched.\n\nCoverage is the other half. The useful target for a room used for calls or mixing is 20 to 30% of the wall area, placed first at the mirror points either side of the desk.',
  },
  params: [
    { key: 'width', label: 'Width', type: 'number', unit: 'mm', default: 600, min: 300, max: 1200, step: 50, group: 'Panel' },
    { key: 'height', label: 'Height', type: 'number', unit: 'mm', default: 600, min: 300, max: 2400, step: 50, group: 'Panel' },
    { key: 'thickness', label: 'Thickness', type: 'number', unit: 'mm', default: 50, min: 20, max: 200, step: 10, group: 'Panel' },
    {
      key: 'fill', label: 'Core', type: 'enum', default: 'wool', group: 'Panel',
      options: [{ value: 'wool', label: 'Mineral wool, 45 kg/m³' }, { value: 'foam', label: 'Open-cell foam' }, { value: 'felt', label: 'Pressed PET felt' }],
    },
    { key: 'gap', label: 'Air gap behind', type: 'number', unit: 'mm', default: 0, min: 0, max: 200, step: 10, group: 'Mount', help: 'An air gap behind a panel shifts its useful range down, which is free bass absorption.' },
    { key: 'tint', label: 'Fabric', type: 'color', default: '#2A2D33', group: 'Panel' },
    { key: 'count', label: 'In this run', type: 'number', unit: '', default: 4, min: 1, max: 24, step: 1, group: 'Coverage' },
    { key: 'wallArea', label: 'Room wall area', type: 'number', unit: '', default: 42, min: 10, max: 200, step: 1, group: 'Coverage', help: 'Square metres of wall and ceiling, for the coverage figure.' },
  ],
  solids: (p) => {
    const w = num(p, 'width', 600)
    const h = num(p, 'height', 600)
    const t = num(p, 'thickness', 50)
    const gap = num(p, 'gap', 0)
    const tint = str(p, 'tint', '#2A2D33')
    const out: Solid[] = [
      { kind: 'box', mat: { color: tint, rough: 0.97, density: 0.05 }, size: [w, h, t], at: [0, h / 2, t / 2 + gap], bevel: 4 },
    ]
    if (gap > 0) {
      for (const sx of [-1, 1] as const) {
        out.push({ kind: 'box', mat: STEEL, size: [20, h - 80, gap], at: [sx * (w / 2 - 40), h / 2, gap / 2] })
      }
    }
    return out
  },
  ports: (p) => {
    const h = num(p, 'height', 600)
    const t = num(p, 'thickness', 50)
    const gap = num(p, 'gap', 0)
    return [
      { id: 'wall', label: 'Wall', kind: 'mechanical', pos: [0, h / 2, 0], dir: [0, 0, -1], mate: { type: 'face' } },
      { id: 'face', label: 'Face', kind: 'mechanical', pos: [0, h / 2, t + gap], dir: [0, 0, 1], mate: { type: 'face' } },
    ]
  },
  mass: (p) => {
    const vol = (num(p, 'width', 600) * num(p, 'height', 600) * num(p, 'thickness', 50)) / 1e9
    const fill = str(p, 'fill', 'wool')
    return vol * (fill === 'wool' ? 45000 : fill === 'felt' ? 28000 : 12000) + 400
  },
  price: (p) => {
    const a = (num(p, 'width', 600) * num(p, 'height', 600)) / 1e6
    const t = num(p, 'thickness', 50)
    return Math.round(a * (18 + t * 0.42) + 6)
  },
  readouts: (p) => {
    const w = num(p, 'width', 600)
    const h = num(p, 'height', 600)
    const t = num(p, 'thickness', 50)
    const gap = num(p, 'gap', 0)
    const n = Math.round(num(p, 'count', 4))
    const wall = num(p, 'wallArea', 42)
    const fill = str(p, 'fill', 'wool')
    // A porous absorber works down to about a quarter wavelength of its
    // total depth, air gap included.
    const depth = (t + gap) / 1000
    const fLow = 343 / (4 * depth)
    const nrc = fill === 'wool' ? Math.min(0.95, 0.35 + t / 170) : fill === 'felt' ? Math.min(0.85, 0.25 + t / 210) : Math.min(0.7, 0.15 + t / 260)
    const area = ((w * h) / 1e6) * n
    return [
      { label: 'Each', value: `${w} × ${h} × ${t} mm` },
      { label: 'Coverage', value: `${area.toFixed(1)} m² over ${n} panel${n === 1 ? '' : 's'}, ${Math.round((area / wall) * 100)}% of the room` },
      { label: 'Target', value: `20 to 30% — this is ${area / wall < 0.2 ? 'under' : area / wall > 0.3 ? 'over, and will sound dead' : 'in range'}` },
      { label: 'Works above', value: `${Math.round(fLow)} Hz${gap > 0 ? `, helped by the ${gap} mm gap` : ''}` },
      { label: 'Absorption', value: `about ${nrc.toFixed(2)} NRC` },
      ...(t <= 30 ? [{ label: 'Warning', value: 'At this thickness it only touches the top two octaves' }] : []),
    ]
  },
}

const wallShelf: PartDef = {
  id: 'shelf-wall',
  name: 'Wall shelf',
  category: 'decor',
  blurb: 'A span, a load, and two fixings carrying it',
  tags: ['shelf', 'floating shelf', 'bracket', 'wall shelf', 'storage', 'display', 'wall', 'decor', 'timber'],
  doc: {
    price: 48,
    description:
      'The cosmetic part most likely to end up on the floor. A floating shelf puts its whole load on a cantilever, so the moment at the wall is the load times how far out it sits, and a 900 mm shelf with 15 kg on it at mid-depth is about 13 N·m per fixing. Plasterboard plugs are good for a fraction of that; a stud or a resin anchor is not.\n\nThe deflection figure is the other one people meet: pine over 900 mm with any real load on it visibly sags, and the fix is depth, not more brackets.',
  },
  params: [
    { key: 'span', label: 'Span', type: 'number', unit: 'mm', default: 900, min: 300, max: 2400, step: 50, group: 'Shelf' },
    { key: 'depth', label: 'Depth', type: 'number', unit: 'mm', default: 240, min: 100, max: 500, step: 10, group: 'Shelf' },
    { key: 'thickness', label: 'Thickness', type: 'number', unit: 'mm', default: 32, min: 15, max: 60, step: 1, group: 'Shelf' },
    {
      key: 'material', label: 'Material', type: 'enum', default: 'oak', group: 'Shelf',
      options: [{ value: 'pine', label: 'Pine' }, { value: 'oak', label: 'Oak' }, { value: 'ply', label: 'Birch ply' }, { value: 'steel', label: 'Folded steel' }],
    },
    {
      key: 'support', label: 'Support', type: 'enum', default: 'bracket', group: 'Mount',
      options: [{ value: 'bracket', label: 'Visible brackets' }, { value: 'float', label: 'Concealed, floating' }, { value: 'rail', label: 'On a wall rail' }],
    },
    { key: 'height', label: 'Height', type: 'number', unit: 'mm', default: 1300, min: 300, max: 2400, step: 10, group: 'Mount' },
    { key: 'load', label: 'Load', type: 'number', unit: 'g', default: 15000, min: 0, max: 80000, step: 500, group: 'Load' },
  ],
  solids: (p) => {
    const span = num(p, 'span', 900)
    const d = num(p, 'depth', 240)
    const t = num(p, 'thickness', 32)
    const material = str(p, 'material', 'oak')
    const mat =
      material === 'steel' ? { color: '#2A2C30', rough: 0.68, density: 7.8 }
      : material === 'pine' ? { color: '#C8A878', rough: 0.76, density: 0.5 }
      : material === 'ply' ? { color: '#D3B98C', rough: 0.72, density: 0.68 }
      : OAK
    const out: Solid[] = [{ kind: 'box', mat, size: [span, t, d], at: [0, t / 2, d / 2], bevel: 2 }]
    const support = str(p, 'support', 'bracket')
    if (support === 'bracket') {
      for (const sx of [-1, 1] as const) {
        const x = sx * (span / 2 - 80)
        out.push({ kind: 'box', mat: { color: '#1C1E22', rough: 0.6, density: 7.8 }, size: [8, 150, 10], at: [x, -75, 5] })
        out.push({ kind: 'box', mat: { color: '#1C1E22', rough: 0.6, density: 7.8 }, size: [8, 10, d - 40], at: [x, -5, d / 2 - 10] })
        out.push({ kind: 'box', mat: { color: '#1C1E22', rough: 0.6, density: 7.8 }, size: [8, 120, 8], at: [x, -60, 70], rot: [38, 0, 0] })
      }
    } else if (support === 'rail') {
      out.push({ kind: 'box', mat: ALU, size: [span + 40, 26, 14], at: [0, -16, 7] })
    }
    return out
  },
  ports: (p) => {
    const span = num(p, 'span', 900)
    const t = num(p, 'thickness', 32)
    const d = num(p, 'depth', 240)
    return [
      { id: 'wall', label: 'Wall', kind: 'mechanical', pos: [0, 0, 0], dir: [0, 0, -1], mate: { type: 'face' } },
      { id: 'top', label: 'Shelf top', kind: 'mechanical', pos: [0, t, d / 2], dir: [0, 1, 0], mate: { type: 'face' } },
      { id: 'fixL', label: 'Left fixing', kind: 'mechanical', pos: [-span / 2 + 80, t / 2, 0], dir: [0, 0, -1], mate: { type: 'hole', size: 8 } },
      { id: 'fixR', label: 'Right fixing', kind: 'mechanical', pos: [span / 2 - 80, t / 2, 0], dir: [0, 0, -1], mate: { type: 'hole', size: 8 } },
    ]
  },
  mass: (p) => {
    const material = str(p, 'material', 'oak')
    const density = material === 'steel' ? 7.8 : material === 'pine' ? 0.5 : material === 'ply' ? 0.68 : 0.72
    const vol = (num(p, 'span', 900) * num(p, 'depth', 240) * num(p, 'thickness', 32)) / 1e3
    return material === 'steel' ? vol * 0.18 * density : vol * density
  },
  price: (p) => {
    const a = (num(p, 'span', 900) * num(p, 'depth', 240)) / 1e6
    const material = str(p, 'material', 'oak')
    return Math.round(a * (material === 'oak' ? 190 : material === 'ply' ? 110 : material === 'steel' ? 240 : 70) + (str(p, 'support', 'bracket') === 'float' ? 22 : 12))
  },
  readouts: (p) => {
    const span = num(p, 'span', 900)
    const d = num(p, 'depth', 240)
    const t = num(p, 'thickness', 32)
    const load = num(p, 'load', 15000)
    const material = str(p, 'material', 'oak')
    const E = material === 'steel' ? 200000 : material === 'oak' ? 11000 : material === 'ply' ? 9000 : 8000
    // A shelf on two fixings, loaded centrally: the standard simply-supported
    // case, which is the right order of magnitude for a real one.
    const I = material === 'steel' ? (d * t ** 3 - (d - 4) * (t - 4) ** 3) / 12 : (d * t ** 3) / 12
    const F = (load / 1000) * 9.81
    const sag = (F * (span - 160) ** 3) / (48 * E * Math.max(1, I))
    // Each fixing sees half the load at the depth of its centre of mass.
    const moment = ((F / 2) * (d / 2)) / 1000
    return [
      { label: 'Shelf', value: `${span} × ${d} × ${t} mm` },
      { label: 'At', value: `${num(p, 'height', 1300)} mm, ${Math.round(num(p, 'height', 1300) - 740)} mm above a standard desk` },
      { label: 'Deflection', value: `${sag.toFixed(1)} mm at ${(load / 1000).toFixed(1)} kg${sag > span / 360 ? ', visible' : ''}` },
      { label: 'Per fixing', value: `${moment.toFixed(1)} N·m, ${(F / 2 / 9.81).toFixed(1)} kg` },
      {
        label: 'Needs',
        value: moment > 18 ? 'Resin anchors or a stud, nothing less' : moment > 7 ? 'Heavy plasterboard anchors, or a stud' : 'Ordinary plugs',
      },
    ]
  },
}

/* ================================================================== */
/* Floor and cable                                                     */
/* ================================================================== */

const rug: PartDef = {
  id: 'rug-floor',
  name: 'Rug',
  category: 'decor',
  blurb: 'Floor area, and whether a chair will roll on it',
  tags: ['rug', 'carpet', 'mat', 'floor', 'chair mat', 'decor', 'cosmetic', 'room', 'acoustic'],
  doc: {
    price: 95,
    description:
      'Two real consequences. A rug under a desk is the cheapest acoustic treatment there is, because a hard floor is the largest reflecting surface in the room and this covers it. And pile height decides whether a chair rolls: over about 10 mm, castors sink in and a chair becomes something you drag.',
  },
  params: [
    { key: 'width', label: 'Width', type: 'number', unit: 'mm', default: 2000, min: 600, max: 4000, step: 100, group: 'Rug' },
    { key: 'depth', label: 'Depth', type: 'number', unit: 'mm', default: 1400, min: 400, max: 3000, step: 100, group: 'Rug' },
    { key: 'pile', label: 'Pile height', type: 'number', unit: 'mm', default: 8, min: 1, max: 40, step: 1, group: 'Rug' },
    { key: 'tint', label: 'Colour', type: 'color', default: '#4A4640', group: 'Rug' },
    { key: 'shape', label: 'Shape', type: 'enum', default: 'rect', group: 'Rug', options: [{ value: 'rect', label: 'Rectangular' }, { value: 'round', label: 'Round' }] },
  ],
  solids: (p) => {
    const w = num(p, 'width', 2000)
    const d = num(p, 'depth', 1400)
    const pile = num(p, 'pile', 8)
    const mat = { color: str(p, 'tint', '#4A4640'), rough: 0.98, density: 0.4 }
    if (str(p, 'shape', 'rect') === 'round') {
      return [{ kind: 'cyl', mat, r: Math.min(w, d) / 2, h: pile, seg: 48, at: [0, pile / 2, 0] }]
    }
    return [
      { kind: 'box', mat, size: [w, pile, d], at: [0, pile / 2, 0], bevel: 1 },
      { kind: 'box', mat: { color: str(p, 'tint', '#4A4640'), rough: 0.9, density: 0.4 }, size: [w - 60, pile + 0.5, d - 60], at: [0, pile / 2, 0], noCollide: true },
    ]
  },
  ports: (p) => {
    const pile = num(p, 'pile', 8)
    return [
      { id: 'floor', label: 'Floor', kind: 'mechanical', pos: [0, 0, 0], dir: [0, -1, 0], mate: { type: 'face' } },
      { id: 'top', label: 'Top', kind: 'mechanical', pos: [0, pile, 0], dir: [0, 1, 0], mate: { type: 'face' } },
    ]
  },
  mass: (p) => ((num(p, 'width', 2000) * num(p, 'depth', 1400)) / 1e6) * (1800 + num(p, 'pile', 8) * 120),
  price: (p) => Math.round(((num(p, 'width', 2000) * num(p, 'depth', 1400)) / 1e6) * 34 + 20),
  readouts: (p) => {
    const w = num(p, 'width', 2000)
    const d = num(p, 'depth', 1400)
    const pile = num(p, 'pile', 8)
    const a = (w * d) / 1e6
    const round = str(p, 'shape', 'rect') === 'round'
    const area = round ? Math.PI * (Math.min(w, d) / 2000) ** 2 : a
    return [
      { label: 'Covers', value: `${area.toFixed(2)} m² of floor` },
      { label: 'Chair castors', value: pile <= 6 ? 'Roll freely' : pile <= 10 ? 'Roll, with effort' : 'Will not roll, the chair drags' },
      { label: 'Absorption', value: `about ${(area * (pile > 10 ? 0.35 : 0.2)).toFixed(1)} m² of absorption above 500 Hz` },
      { label: 'Desk and chair need', value: `${Math.round(1600)} × ${Math.round(1400)} mm of it` },
    ]
  },
}

const cableTray: PartDef = {
  id: 'tray-cable',
  name: 'Cable tray',
  category: 'decor',
  blurb: 'Under the desk, with a capacity in leads',
  tags: ['cable tray', 'cable management', 'under desk', 'basket', 'tidy', 'trunking', 'decor', 'desk', 'wires'],
  doc: {
    price: 38,
    description:
      'The part that decides whether a setup looks finished. It has a real capacity, which is the useful number: cross-section available against the cross-section of what goes in it. A mains flex is about 50 mm², an HDMI lead 60, a USB-C lead 20, and a 400 by 100 by 80 tray holds around forty of them before the lid stops closing — which sounds like plenty until a dock, two monitors, a PSU and three bricks are in there.',
  },
  params: [
    { key: 'length', label: 'Length', type: 'number', unit: 'mm', default: 600, min: 200, max: 1600, step: 50, group: 'Tray' },
    { key: 'width', label: 'Width', type: 'number', unit: 'mm', default: 130, min: 60, max: 300, step: 10, group: 'Tray' },
    { key: 'height', label: 'Depth', type: 'number', unit: 'mm', default: 100, min: 40, max: 200, step: 10, group: 'Tray' },
    {
      key: 'style', label: 'Style', type: 'enum', default: 'basket', group: 'Tray',
      options: [{ value: 'basket', label: 'Wire basket' }, { value: 'solid', label: 'Solid tray' }, { value: 'sleeve', label: 'Neoprene sleeve' }],
    },
    { key: 'cables', label: 'Cables in it', type: 'number', unit: '', default: 12, min: 0, max: 80, step: 1, group: 'Load' },
    { key: 'psus', label: 'Bricks in it', type: 'number', unit: '', default: 2, min: 0, max: 10, step: 1, group: 'Load', help: 'A plug-top supply eats the space of about eight cables and gets warm doing it.' },
  ],
  solids: (p) => {
    const l = num(p, 'length', 600)
    const w = num(p, 'width', 130)
    const h = num(p, 'height', 100)
    const style = str(p, 'style', 'basket')
    const wire = { color: '#3A3D42', metal: 0.8, rough: 0.5, density: 7.8 }
    if (style === 'sleeve') {
      return [{ kind: 'cyl', mat: FELT, r: w / 2, h: l, seg: 22, rot: [0, 0, 90], at: [0, -w / 2, 0] }]
    }
    if (style === 'solid') {
      return [
        { kind: 'box', mat: { color: '#2A2C30', rough: 0.65, density: 7.8 }, size: [l, 2, w], at: [0, -h, 0] },
        { kind: 'box', mat: { color: '#2A2C30', rough: 0.65, density: 7.8 }, size: [l, h, 2], at: [0, -h / 2, w / 2] },
        { kind: 'box', mat: { color: '#2A2C30', rough: 0.65, density: 7.8 }, size: [l, h, 2], at: [0, -h / 2, -w / 2] },
      ]
    }
    const out: Solid[] = []
    // A basket: longitudinal wires and a hoop every 60 mm.
    for (let i = 0; i < 5; i++) {
      out.push({ kind: 'cyl', mat: wire, r: 2.4, h: l, seg: 8, rot: [0, 0, 90], at: [0, -h + (i % 2) * 2, -w / 2 + (i * w) / 4] })
    }
    const hoops = Math.max(2, Math.round(l / 60))
    for (let i = 0; i < hoops; i++) {
      const x = -l / 2 + 20 + (i * (l - 40)) / Math.max(1, hoops - 1)
      out.push({ kind: 'tube', mat: wire, r: 2.4, seg: 8, path: [[x, -h + h, -w / 2], [x, -h, -w / 2], [x, -h, w / 2], [x, -h + h, w / 2]] })
    }
    return out
  },
  ports: (p) => {
    const l = num(p, 'length', 600)
    const h = num(p, 'height', 100)
    return [
      { id: 'desk', label: 'Desk underside', kind: 'mechanical', pos: [0, 0, 0], dir: [0, 1, 0], mate: { type: 'face' } },
      { id: 'inside', label: 'Inside', kind: 'mechanical', pos: [0, -h + 10, 0], dir: [0, 1, 0], mate: { type: 'face' } },
      { id: 'exit', label: 'Cable exit', kind: 'mechanical', pos: [l / 2, -h / 2, 0], dir: [1, 0, 0], mate: { type: 'face' } },
    ]
  },
  mass: (p) => {
    const l = num(p, 'length', 600)
    const style = str(p, 'style', 'basket')
    return style === 'sleeve' ? l * 0.35 : style === 'solid' ? l * 2.6 : l * 1.5
  },
  price: (p) => Math.round(num(p, 'length', 600) * (str(p, 'style', 'basket') === 'sleeve' ? 0.02 : 0.055) + 10),
  readouts: (p) => {
    const w = num(p, 'width', 130)
    const h = num(p, 'height', 100)
    const style = str(p, 'style', 'basket')
    const area = style === 'sleeve' ? Math.PI * (w / 2) ** 2 : w * h
    const cables = Math.round(num(p, 'cables', 12))
    const psus = Math.round(num(p, 'psus', 2))
    // 45 mm² a lead averaged across mains flex, HDMI and USB, and a plug-top
    // supply at about eight leads' worth.
    const used = cables * 45 + psus * 360
    // Nothing packs perfectly: 60% fill is the practical limit.
    const usable = area * 0.6
    return [
      { label: 'Cross-section', value: `${Math.round(area)} mm², ${Math.round(usable)} mm² usable at 60% fill` },
      { label: 'In it', value: `${cables} cables and ${psus} brick${psus === 1 ? '' : 's'}, ${Math.round(used)} mm²` },
      { label: 'Fill', value: `${Math.round((used / usable) * 100)}%${used > usable ? ', over the practical limit' : ''}` },
      { label: 'Room for', value: `${Math.max(0, Math.floor((usable - used) / 45))} more leads` },
      ...(psus > 0 && style === 'sleeve' ? [{ label: 'Warning', value: 'Supplies in a closed sleeve have nowhere to put their heat' }] : []),
    ]
  },
}

const raceway: PartDef = {
  id: 'raceway-wall',
  name: 'Wall raceway',
  category: 'decor',
  blurb: 'Trunking down a wall, with a bend radius in it',
  tags: ['raceway', 'trunking', 'cable cover', 'conduit', 'wall', 'cable management', 'tidy', 'decor', 'hdmi'],
  doc: {
    price: 18,
    description:
      'For the run from a wall-mounted screen down to the desk. Its capacity works the same way as a tray, with one extra constraint that catches people: the bend at each end has a minimum radius, and an HDMI lead forced round a tighter corner than about 40 mm is a lead that fails in a year.',
  },
  params: [
    { key: 'length', label: 'Length', type: 'number', unit: 'mm', default: 1000, min: 200, max: 3000, step: 100, group: 'Raceway' },
    { key: 'width', label: 'Width', type: 'number', unit: 'mm', default: 60, min: 16, max: 150, step: 2, group: 'Raceway' },
    { key: 'depth', label: 'Depth', type: 'number', unit: 'mm', default: 25, min: 10, max: 60, step: 1, group: 'Raceway' },
    { key: 'cables', label: 'Cables in it', type: 'number', unit: '', default: 4, min: 0, max: 30, step: 1, group: 'Load' },
    { key: 'tint', label: 'Colour', type: 'color', default: '#E8E6E1', group: 'Raceway' },
    { key: 'paintable', label: 'Paintable', type: 'bool', default: true, group: 'Raceway' },
  ],
  solids: (p) => {
    const l = num(p, 'length', 1000)
    const w = num(p, 'width', 60)
    const d = num(p, 'depth', 25)
    const mat = { color: str(p, 'tint', '#E8E6E1'), rough: bool(p, 'paintable', true) ? 0.85 : 0.5, density: 1.4 }
    return [
      { kind: 'box', mat, size: [w, l, 2], at: [0, l / 2, 1] },
      { kind: 'box', mat, size: [2, l, d], at: [-w / 2 + 1, l / 2, d / 2] },
      { kind: 'box', mat, size: [2, l, d], at: [w / 2 - 1, l / 2, d / 2] },
      { kind: 'box', mat, size: [w, l, 2], at: [0, l / 2, d - 1] },
    ]
  },
  ports: (p) => {
    const l = num(p, 'length', 1000)
    const d = num(p, 'depth', 25)
    return [
      { id: 'wall', label: 'Wall', kind: 'mechanical', pos: [0, l / 2, 0], dir: [0, 0, -1], mate: { type: 'face' } },
      { id: 'top', label: 'Top entry', kind: 'mechanical', pos: [0, l, d / 2], dir: [0, 1, 0], mate: { type: 'face' } },
      { id: 'bottom', label: 'Bottom exit', kind: 'mechanical', pos: [0, 0, d / 2], dir: [0, -1, 0], mate: { type: 'face' } },
    ]
  },
  mass: (p) => (num(p, 'length', 1000) / 1000) * (num(p, 'width', 60) + num(p, 'depth', 25)) * 4.2,
  price: (p) => Math.round((num(p, 'length', 1000) / 1000) * (6 + num(p, 'width', 60) * 0.18) + 4),
  readouts: (p) => {
    const w = num(p, 'width', 60)
    const d = num(p, 'depth', 25)
    const n = Math.round(num(p, 'cables', 4))
    const usable = w * d * 0.6
    const used = n * 45
    return [
      { label: 'Section', value: `${w} × ${d} mm, ${Math.round(usable)} mm² usable` },
      { label: 'In it', value: `${n} lead${n === 1 ? '' : 's'}, ${used} mm²` },
      { label: 'Room for', value: `${Math.max(0, Math.floor((usable - used) / 45))} more` },
      { label: 'Bend radius', value: `${Math.max(40, Math.round(d * 1.6))} mm at each end, for the leads inside` },
    ]
  },
}

registerParts([deskMat, monitorRiser, plant, figure, framedPrint, acousticPanel, wallShelf, rug, cableTray, raceway])
