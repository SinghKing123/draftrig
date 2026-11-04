import type { DeviceModel, PartDef, Port, Solid, Vec3 } from '../kernel/types'
import { registerParts } from '../kernel/registry'
import { bool, num, str } from './_helpers'
import { ALU, DARK, REGION_PARAM, STEEL, amps, load, mainsPorts, screen, volts } from './setup'
import { BLACK_PLASTIC } from './setup2'

/**
 * The tools that make the thing, as opposed to the thing.
 *
 * A workbench is a layout problem of its own and nothing in the catalogue
 * described it. These are the parts that take the space and the power: a
 * printer that runs for nine hours at 120 W, an iron that pulls 70 W for the
 * thirty seconds it is heating and 25 after, an extractor that has to be
 * within 150 mm of the joint to do anything at all.
 *
 * Two of them are electrically real in a way worth stating:
 *
 *   The ESD mat is a 1 megohm path to earth, and the value is not arbitrary.
 *   It has to be low enough to drain a charge in well under a second and
 *   high enough that touching a live conductor through you and the mat is
 *   survivable. A mat bonded straight to earth is a worse mat.
 *
 *   The soldering station's tip is earthed, which matters when the iron is
 *   touching a CMOS gate. A cheap unearthed iron floats, and its tip can sit
 *   tens of volts off ground.
 *
 * Conventions are `setup.ts`: mains as l/n/e, loads sized in watts at the
 * region voltage, everything standing on its own footprint at y = 0.
 */

const FRAME_BLACK = { color: '#1A1C20', rough: 0.62, density: 2.7 }
const BED_GLASS = { color: '#1C2A28', rough: 0.25, clearcoat: 0.7, density: 2.5 }
const TOOL_BLUE = { color: '#1E5A8C', rough: 0.5, density: 1.4 }

/* ================================================================== */
/* Fabrication                                                         */
/* ================================================================== */

const printer3d: PartDef = {
  id: 'printer-3d',
  model: {
    url: 'models/printer-3d.glb',
    fit: 'bbox',
    axes: { y: 'fill', z: 'fill' },
    credit: { title: 'Prusa 3D Printer', author: 'Alvaro A.', license: 'CC-BY-4.0', source: 'https://sketchfab.com/3d-models/prusa-3d-printer-2a15897d26c94941bc0132cf130169da' },
  },
  name: '3D printer',
  category: 'tooling',
  blurb: 'A build volume, a heated bed, and nine hours at 120 W',
  tags: ['3d printer', 'fdm', 'printer', 'bambu', 'prusa', 'ender', 'bed', 'nozzle', 'fabrication', 'tooling'],
  doc: {
    price: 420,
    description:
      'The machine most likely to be wrong about its own footprint. A 220 mm bed on a bed-slinger sweeps 220 mm forward and back, so the printer needs 1.6 times its own depth of clear bench — a figure that catches out every shelf it is put on.\n\nThe power figure is in two halves. Heating the bed is 120 to 350 W and takes two minutes; printing is 50 to 120 W for hours. A desk running a printer, a PC and a monitor off one 13 A socket is fine, and the same desk with a kettle on it is not.',
  },
  params: [
    REGION_PARAM,
    {
      key: 'style', label: 'Motion', type: 'enum', default: 'corexy', group: 'Printer',
      options: [{ value: 'slinger', label: 'Bed slinger, Y on the bed' }, { value: 'corexy', label: 'CoreXY, enclosed' }, { value: 'delta', label: 'Delta' }],
    },
    { key: 'bed', label: 'Bed', type: 'number', unit: 'mm', default: 256, min: 120, max: 400, step: 4, group: 'Printer' },
    { key: 'zHeight', label: 'Z height', type: 'number', unit: 'mm', default: 256, min: 100, max: 600, step: 10, group: 'Printer' },
    { key: 'nozzle', label: 'Nozzle', type: 'enum', default: '0.4', group: 'Printer', options: ['0.2', '0.4', '0.6', '0.8'].map((v) => ({ value: v, label: `${v} mm` })) },
    { key: 'bedTemp', label: 'Bed temperature', type: 'number', unit: '°C', default: 60, min: 0, max: 120, step: 5, group: 'Control' },
    {
      key: 'state', label: 'State', type: 'enum', default: 'print', group: 'Control',
      options: [{ value: 'idle', label: 'Idle' }, { value: 'heating', label: 'Heating the bed' }, { value: 'print', label: 'Printing' }],
    },
    { key: 'enclosed', label: 'Enclosed', type: 'bool', default: true, group: 'Printer', help: 'Needed for ABS and ASA; it also keeps most of the noise and all of the fine particles in.' },
  ],
  solids: (p) => {
    const bed = num(p, 'bed', 256)
    const z = num(p, 'zHeight', 256)
    const style = str(p, 'style', 'corexy')
    const frameW = bed + 110
    const frameD = style === 'slinger' ? bed + 160 : bed + 120
    const frameH = z + 180
    const hot = num(p, 'bedTemp', 60) > 40 && str(p, 'state', 'print') !== 'idle'
    const out: Solid[] = []
    if (bool(p, 'enclosed', true)) {
      // Four uprights and glazed panels, drawn as the panels.
      out.push({ kind: 'box', mat: FRAME_BLACK, size: [frameW, 60, frameD], at: [0, 30, 0], bevel: 4 })
      out.push({ kind: 'box', mat: FRAME_BLACK, size: [frameW, 70, frameD], at: [0, frameH - 35, 0], bevel: 4 })
      for (const sx of [-1, 1] as const) {
        out.push({ kind: 'box', mat: { color: '#14161A', rough: 0.12, clearcoat: 0.9, density: 2.5, opacity: 0.4, transmission: 0.55 }, size: [6, frameH - 110, frameD - 20], at: [(sx * frameW) / 2 - sx * 6, frameH / 2, 0] })
      }
      out.push({ kind: 'box', mat: { color: '#14161A', rough: 0.12, clearcoat: 0.9, density: 2.5, opacity: 0.4, transmission: 0.55 }, size: [frameW - 20, frameH - 110, 6], at: [0, frameH / 2, frameD / 2 - 6] })
      out.push({ kind: 'box', mat: FRAME_BLACK, size: [frameW - 20, frameH - 110, 5], at: [0, frameH / 2, -frameD / 2 + 6] })
    } else {
      for (const sx of [-1, 1] as const) {
        out.push({ kind: 'box', mat: FRAME_BLACK, size: [40, frameH, 40], at: [(sx * frameW) / 2 - sx * 20, frameH / 2, -frameD / 2 + 40] })
      }
      out.push({ kind: 'box', mat: FRAME_BLACK, size: [frameW, 80, frameD], at: [0, 40, 0], bevel: 4 })
      out.push({ kind: 'box', mat: FRAME_BLACK, size: [frameW, 44, 44], at: [0, frameH - 22, -frameD / 2 + 40] })
    }
    // The bed, and the gantry over it.
    out.push({ kind: 'box', mat: BED_GLASS, size: [bed, 6, bed], at: [0, 110, 0] })
    if (hot) out.push({ kind: 'box', mat: { color: '#2A1A16', rough: 0.6, density: 2, emissive: '#FF6B3C', emissiveIntensity: 0.25 }, size: [bed - 8, 2, bed - 8], at: [0, 106, 0], noCollide: true })
    out.push({ kind: 'box', mat: ALU, size: [frameW - 40, 44, 44], at: [0, 110 + z * 0.6, -20] })
    out.push({ kind: 'box', mat: BLACK_PLASTIC, size: [70, 90, 80], at: [bed * 0.1, 110 + z * 0.6 - 20, 10], bevel: 4 })
    out.push({ kind: 'cyl', mat: STEEL, r: 7, r2: 2, h: 22, seg: 14, at: [bed * 0.1, 110 + z * 0.6 - 72, 10] })
    // The spool, which is 200 mm of something nobody allows for.
    out.push({ kind: 'cyl', mat: { color: '#2E3136', rough: 0.7, density: 1.2 }, r: 100, h: 68, seg: 28, rot: [0, 0, 90], at: [-frameW / 2 - 40, frameH * 0.6, 0] })
    return out
  },
  ports: (p) => {
    const bed = num(p, 'bed', 256)
    const z = num(p, 'zHeight', 256)
    const style = str(p, 'style', 'corexy')
    const frameD = style === 'slinger' ? bed + 160 : bed + 120
    return [
      ...mainsPorts([0, 40, -frameD / 2 - 4], [0, 0, -1], '', [11, 0, 0]),
      { id: 'bed', label: 'Bed', kind: 'mechanical', pos: [0, 116, 0], dir: [0, 1, 0], mate: { type: 'face' } },
      { id: 'floor', label: 'Bench', kind: 'mechanical', pos: [0, 0, 0], dir: [0, -1, 0], mate: { type: 'face' } },
      { id: 'top', label: 'Top', kind: 'mechanical', pos: [0, z + 180, 0], dir: [0, 1, 0], mate: { type: 'face' } },
    ]
  },
  electrical: load((p) => {
    const bed = num(p, 'bed', 256)
    const temp = num(p, 'bedTemp', 60)
    // A bed is about 3.5 mW per square millimetre at full tilt; it then
    // cycles at roughly a third of that to hold temperature.
    const bedFull = ((bed * bed) / 1e4) * 5.4 * (temp / 60)
    switch (str(p, 'state', 'print')) {
      case 'idle': return 6
      case 'heating': return 18 + bedFull
      default: return 18 + bedFull * 0.33 + 32
    }
  }),
  mass: (p) => {
    const bed = num(p, 'bed', 256)
    return (bool(p, 'enclosed', true) ? 9000 : 6500) + bed * 22
  },
  price: (p) => {
    const bed = num(p, 'bed', 256)
    return Math.round(140 + bed * 1.1 + (bool(p, 'enclosed', true) ? 180 : 0))
  },
  readouts: (p) => {
    const bed = num(p, 'bed', 256)
    const z = num(p, 'zHeight', 256)
    const style = str(p, 'style', 'corexy')
    const nozzle = parseFloat(str(p, 'nozzle', '0.4')) || 0.4
    const temp = num(p, 'bedTemp', 60)
    const bedFull = ((bed * bed) / 1e4) * 5.4 * (temp / 60)
    const printing = 18 + bedFull * 0.33 + 32
    const footprint = style === 'slinger' ? `${bed + 110} × ${Math.round((bed + 160) * 1.6)} mm, the bed sweeps` : `${bed + 110} × ${bed + 120} mm`
    return [
      { label: 'Build volume', value: `${bed} × ${bed} × ${z} mm, ${((bed * bed * z) / 1e6).toFixed(1)} litres` },
      { label: 'Bench needed', value: footprint },
      { label: 'Height with the spool', value: `${z + 180} mm, plus 220 mm to change filament` },
      { label: 'Heating the bed', value: `${Math.round(18 + bedFull)} W, ${amps(p, 18 + bedFull)}` },
      { label: 'Printing', value: `${Math.round(printing)} W, ${amps(p, printing)}` },
      { label: 'A nine hour print', value: `${((printing * 9) / 1000).toFixed(2)} kWh` },
      { label: 'Line width', value: `${(nozzle * 1.125).toFixed(2)} mm typical, layers to ${(nozzle * 0.75).toFixed(2)} mm` },
    ]
  },
}

const solderStation: PartDef = {
  id: 'station-solder',
  // The iron, its holder and the sponge, with the cable looping back. The
  // cable is in the box, which is why the station is deeper than its case.
  model: {
    url: 'models/soldering-station.glb',
    fit: 'bbox',
    axes: { y: [0.1, 0.9], z: 'fill' },
    credit: { title: '[CC0] Generic Soldering Station', author: 'literallylara', license: 'CC-BY-4.0', source: 'https://sketchfab.com/3d-models/cc0-generic-soldering-station-87789d4f4c5b43069a5dd47819f4b4a8' },
  },
  name: 'Soldering station',
  category: 'tooling',
  blurb: 'An earthed tip, and the watts to hold it there',
  tags: ['soldering iron', 'solder station', 'iron', 'tip', 'temperature controlled', 'hakko', 'esd safe', 'tooling', 'bench'],
  doc: {
    price: 130,
    description:
      'Wattage is not temperature. A 60 W iron and a 25 W iron both reach 350 °C; the 60 W one holds 350 °C while it is sinking heat into a ground plane, which is the whole job. Thermal recovery is the specification that matters and wattage is the proxy for it.\n\nThe tip is earthed, and this part says so because the alternative is not neutral: an unearthed iron floats, and a floating tip at mains potential through leakage is how a MOSFET gate dies between one joint and the next.',
  },
  params: [
    REGION_PARAM,
    { key: 'watts', label: 'Element', type: 'enum', default: '70', group: 'Station', options: ['25', '50', '70', '120'].map((v) => ({ value: v, label: `${v} W` })) },
    { key: 'temp', label: 'Set temperature', type: 'number', unit: '°C', default: 350, min: 150, max: 480, step: 5, group: 'Control' },
    {
      key: 'tip', label: 'Tip', type: 'enum', default: 'chisel', group: 'Station',
      options: [{ value: 'conical', label: 'Conical, 0.5 mm' }, { value: 'chisel', label: 'Chisel, 2.4 mm' }, { value: 'knife', label: 'Knife' }, { value: 'spoon', label: 'Drag spoon' }],
    },
    { key: 'earthed', label: 'Tip earthed', type: 'bool', default: true, group: 'Station' },
    {
      key: 'state', label: 'State', type: 'enum', default: 'idle', group: 'Control',
      options: [{ value: 'off', label: 'Off' }, { value: 'sleep', label: 'In the stand, asleep' }, { value: 'idle', label: 'At temperature' }, { value: 'work', label: 'Working a joint' }],
    },
  ],
  solids: (p) => {
    const w = parseInt(str(p, 'watts', '70'), 10) || 70
    const on = str(p, 'state', 'idle') !== 'off'
    const hot = str(p, 'state', 'idle') === 'work' || str(p, 'state', 'idle') === 'idle'
    const out: Solid[] = [
      // The base unit.
      { kind: 'box', mat: { color: '#D8D5CE', rough: 0.55, density: 1.5 }, size: [130, 100, 160], at: [0, 50, 0], bevel: 5 },
      { kind: 'box', mat: DARK, size: [60, 32, 4], at: [-24, 68, 81] },
      { kind: 'box', mat: screen(on, '#C04A20'), size: [54, 26, 2], at: [-24, 68, 83] },
      { kind: 'cyl', mat: { color: '#2A2C30', rough: 0.5, density: 1.3 }, r: 18, h: 14, seg: 22, rot: [90, 0, 0], at: [40, 62, 80] },
      // The stand and the iron in it.
      { kind: 'cyl', mat: STEEL, r: 48, h: 12, seg: 26, at: [150, 6, 0] },
      { kind: 'cyl', mat: STEEL, r: 26, h: 90, seg: 20, rot: [0, 0, 24], at: [150, 55, 0], phi: [0, 300] },
      { kind: 'cyl', mat: { color: '#1E2024', rough: 0.6, density: 1.3 }, r: 11, h: 120, seg: 16, rot: [0, 0, 56], at: [168, 96, 0] },
      { kind: 'cyl', mat: ALU, r: 7, h: 46, seg: 14, rot: [0, 0, 56], at: [215, 128, 0] },
      {
        kind: 'cyl',
        mat: hot ? { color: '#C9A227', metal: 1, rough: 0.5, density: 8, emissive: '#FF7B3C', emissiveIntensity: 0.5 } : { color: '#8E8A82', metal: 1, rough: 0.6, density: 8 },
        r: 3.4, r2: 0.6, h: 26, seg: 12, rot: [0, 0, 56], at: [235, 142, 0],
      },
    ]
    if (w >= 120) out.push({ kind: 'cyl', mat: DARK, r: 26, h: 16, seg: 20, rot: [90, 0, 0], at: [0, 50, -82] })
    return out
  },
  ports: (p) => {
    const out: Port[] = [
      ...mainsPorts([0, 30, -82], [0, 0, -1], '', [11, 0, 0]),
    ]
    if (bool(p, 'earthed', true)) {
      out.push({ id: 'tip', label: 'Tip, earthed', kind: 'electrical', pos: [235, 142, 0], dir: [1, 0, 0], role: 'gnd', imax: 0.1, solderable: false })
    }
    out.push({ id: 'bench', label: 'Bench', kind: 'mechanical', pos: [0, 0, 0], dir: [0, -1, 0], mate: { type: 'face' } })
    return out
  },
  electrical: {
    devices: (p) => {
      const rated = parseInt(str(p, 'watts', '70'), 10) || 70
      const v = volts(p)
      const state = str(p, 'state', 'idle')
      // Holding temperature is a duty cycle, not a rating: about 15% of the
      // element idle, all of it while the tip is in a joint.
      const w = state === 'off' ? 0.2 : state === 'sleep' ? rated * 0.05 + 1 : state === 'work' ? rated : rated * 0.15 + 2
      const out: DeviceModel[] = [
        { type: 'resistor', a: 'l', b: 'n', r: (v * v) / Math.max(0.2, w) },
        { type: 'resistor', a: 'e', b: 'n', r: 2e6 },
      ]
      // The earthed tip really is bonded to the earth pin, through the few
      // ohms of the braid that does it.
      if (bool(p, 'earthed', true)) out.push({ type: 'resistor', a: 'tip', b: 'e', r: 4 })
      return out
    },
    limits: { vmax: 400 },
  },
  mass: (p) => 1400 + (parseInt(str(p, 'watts', '70'), 10) || 70) * 8,
  price: (p) => {
    const w = parseInt(str(p, 'watts', '70'), 10) || 70
    return Math.round(40 + w * 1.3)
  },
  readouts: (p) => {
    const rated = parseInt(str(p, 'watts', '70'), 10) || 70
    const state = str(p, 'state', 'idle')
    const w = state === 'off' ? 0.2 : state === 'sleep' ? rated * 0.05 + 1 : state === 'work' ? rated : rated * 0.15 + 2
    const temp = num(p, 'temp', 350)
    return [
      { label: 'Drawing', value: `${w.toFixed(0)} W, ${amps(p, w)}` },
      { label: 'Set to', value: `${temp} °C${temp < 300 ? ', cool for leaded solder' : temp > 400 ? ', hot enough to lift pads' : ''}` },
      { label: 'Recovery', value: rated >= 70 ? 'Holds temperature into a ground plane' : rated >= 50 ? 'Struggles on a plane, fine on a pad' : 'Will stall on anything with copper behind it' },
      { label: 'Tip', value: bool(p, 'earthed', true) ? 'Earthed, safe on CMOS' : 'Floating — do not touch a gate with it' },
      { label: 'Heat-up', value: `${Math.round(90 - rated * 0.45)} s to ${temp} °C` },
    ]
  },
}

const hotAir: PartDef = {
  id: 'station-hot-air',
  name: 'Hot air station',
  category: 'tooling',
  blurb: 'Air at a temperature, and a flow that blows parts away',
  tags: ['hot air', 'rework', 'smd', 'reflow', 'desolder', 'bga', 'station', 'tooling', 'bench', 'repair'],
  doc: {
    price: 150,
    description:
      'For removing what an iron cannot reach. The two settings fight each other: temperature has to be enough to melt the joint and flow has to be low enough not to move the part, and the usual mistake is to raise flow because the joint is slow when the answer is a bigger nozzle.\n\nIt is also 700 W at the element, which is a real socket load and the reason it is on this list and not treated as an accessory.',
  },
  params: [
    REGION_PARAM,
    { key: 'temp', label: 'Temperature', type: 'number', unit: '°C', default: 350, min: 100, max: 500, step: 10, group: 'Control' },
    { key: 'flow', label: 'Air flow', type: 'number', unit: '%', default: 40, min: 10, max: 100, step: 5, group: 'Control' },
    { key: 'nozzle', label: 'Nozzle', type: 'enum', default: '5', group: 'Station', options: ['2', '5', '8', '12'].map((v) => ({ value: v, label: `${v} mm` })) },
    { key: 'on', label: 'On', type: 'bool', default: false, group: 'Control' },
  ],
  solids: (p) => {
    const on = bool(p, 'on', false)
    return [
      { kind: 'box', mat: { color: '#D8D5CE', rough: 0.55, density: 1.5 }, size: [140, 110, 170], at: [0, 55, 0], bevel: 5 },
      { kind: 'box', mat: DARK, size: [70, 36, 4], at: [-26, 74, 86] },
      { kind: 'box', mat: screen(on, '#C04A20'), size: [64, 30, 2], at: [-26, 74, 88] },
      { kind: 'cyl', mat: { color: '#2A2C30', rough: 0.5, density: 1.3 }, r: 16, h: 14, seg: 20, rot: [90, 0, 0], at: [44, 82, 86] },
      { kind: 'cyl', mat: { color: '#2A2C30', rough: 0.5, density: 1.3 }, r: 16, h: 14, seg: 20, rot: [90, 0, 0], at: [44, 44, 86] },
      // The handpiece, resting in its cradle.
      { kind: 'cyl', mat: STEEL, r: 36, h: 10, seg: 24, at: [170, 5, 0] },
      { kind: 'cyl', mat: { color: '#1E2024', rough: 0.6, density: 1.3 }, r: 17, h: 150, seg: 18, rot: [0, 0, 70], at: [190, 70, 0] },
      { kind: 'cyl', mat: STEEL, r: 9, h: 40, seg: 14, rot: [0, 0, 70], at: [243, 140, 0] },
      {
        kind: 'cyl',
        mat: on ? { color: '#8E8A82', metal: 1, rough: 0.6, density: 8, emissive: '#FF5B2C', emissiveIntensity: 0.4 } : { color: '#8E8A82', metal: 1, rough: 0.6, density: 8 },
        r: (parseInt(str(p, 'nozzle', '5'), 10) || 5) / 2 + 2, h: 20, seg: 14, rot: [0, 0, 70], at: [259, 160, 0],
      },
    ]
  },
  ports: () => [
    ...mainsPorts([0, 34, -86], [0, 0, -1], '', [11, 0, 0]),
    { id: 'bench', label: 'Bench', kind: 'mechanical', pos: [0, 0, 0], dir: [0, -1, 0], mate: { type: 'face' } },
  ],
  electrical: load((p) => {
    if (!bool(p, 'on', false)) return 1
    // The element modulates with temperature; the fan is a constant 12 W.
    return 12 + 700 * Math.min(1, num(p, 'temp', 350) / 450) * 0.7
  }),
  mass: () => 2600,
  price: () => 150,
  readouts: (p) => {
    const temp = num(p, 'temp', 350)
    const flow = num(p, 'flow', 40)
    const nozzle = parseInt(str(p, 'nozzle', '5'), 10) || 5
    const w = bool(p, 'on', false) ? 12 + 700 * Math.min(1, temp / 450) * 0.7 : 1
    return [
      { label: 'Drawing', value: `${w.toFixed(0)} W, ${amps(p, w)}` },
      { label: 'Set to', value: `${temp} °C at ${flow}% flow` },
      {
        label: 'Suits',
        value: temp < 250 ? 'Shrink sleeve and drying, not solder' : temp < 320 ? 'Leaded solder' : temp < 400 ? 'Lead-free, most work' : 'Lead-free on heavy copper — watch the plastics',
      },
      { label: 'Nozzle', value: `${nozzle} mm — ${nozzle <= 2 ? 'single pins' : nozzle <= 5 ? 'passives and small SOICs' : nozzle <= 8 ? 'QFPs' : 'shields and BGAs'}` },
      { label: 'Watch', value: flow > 60 ? 'This much flow will blow 0402 parts off the board' : 'Flow is low enough to leave neighbours where they are' },
    ]
  },
}

const fumeExtractor: PartDef = {
  id: 'extractor-fume',
  name: 'Fume extractor',
  category: 'tooling',
  blurb: 'Only works within 150 mm of the joint',
  tags: ['fume extractor', 'extraction', 'solder fumes', 'filter', 'carbon', 'hepa', 'ventilation', 'tooling', 'bench', 'health'],
  doc: {
    price: 70,
    description:
      'The tool most often bought and then placed uselessly. Capture velocity falls with the square of distance, so an extractor 400 mm away is doing almost nothing — the air it moves at the joint is a tenth of what it moves at its own face. It has to be within about 150 mm, which means on an arm, pointing at the work.\n\nRosin fumes are the thing being removed and activated carbon is what removes them; a HEPA element alone catches particles and passes the flux smoke straight through.',
  },
  params: [
    REGION_PARAM,
    {
      key: 'kind', label: 'Type', type: 'enum', default: 'bench', group: 'Extractor',
      options: [{ value: 'bench', label: 'Bench box, carbon' }, { value: 'arm', label: 'On an arm, carbon and HEPA' }, { value: 'duct', label: 'Ducted outside' }],
    },
    { key: 'flow', label: 'Flow', type: 'number', unit: '', default: 100, min: 20, max: 600, step: 10, group: 'Extractor', help: 'Cubic metres an hour at the face.' },
    { key: 'distance', label: 'Distance to the joint', type: 'number', unit: 'mm', default: 180, min: 50, max: 800, step: 10, group: 'Placement' },
    { key: 'on', label: 'On', type: 'bool', default: true, group: 'Control' },
  ],
  solids: (p) => {
    const kind = str(p, 'kind', 'bench')
    const flow = num(p, 'flow', 100)
    const s = 140 + flow * 0.3
    const out: Solid[] = [
      { kind: 'box', mat: { color: '#2A2C30', rough: 0.6, density: 1.4 }, size: [s, s * 0.82, 90], at: [0, (s * 0.82) / 2, 0], bevel: 4 },
      { kind: 'cyl', mat: DARK, r: s * 0.32, h: 10, seg: 28, rot: [90, 0, 0], at: [0, (s * 0.82) / 2, 46] },
      { kind: 'box', mat: { color: '#1A1B1E', rough: 0.95, density: 0.3 }, size: [s - 24, s * 0.82 - 24, 14], at: [0, (s * 0.82) / 2, 38], noCollide: true },
    ]
    if (kind === 'arm') {
      out.push({ kind: 'cyl', mat: STEEL, r: 44, h: 12, seg: 24, at: [0, 6, -140] })
      out.push({ kind: 'tube', mat: { color: '#2E3136', rough: 0.8, density: 1.2 }, r: 26, seg: 14, path: [[0, 12, -140], [0, 300, -140], [0, 360, -60], [0, (s * 0.82) / 2, -46]] })
    } else if (kind === 'duct') {
      out.push({ kind: 'tube', mat: { color: '#B9BEC6', rough: 0.6, density: 1.4 }, r: 52, seg: 16, path: [[0, (s * 0.82) / 2, -46], [0, (s * 0.82) / 2, -200], [0, 400, -260]] })
    }
    return out
  },
  ports: (p) => {
    const flow = num(p, 'flow', 100)
    const s = 140 + flow * 0.3
    return [
      ...mainsPorts([0, 20, -46], [0, 0, -1], '', [10, 0, 0]),
      { id: 'face', label: 'Intake face', kind: 'mechanical', pos: [0, (s * 0.82) / 2, 50], dir: [0, 0, 1], mate: { type: 'face' } },
      { id: 'bench', label: 'Bench', kind: 'mechanical', pos: [0, 0, 0], dir: [0, -1, 0], mate: { type: 'face' } },
    ]
  },
  electrical: load((p) => (bool(p, 'on', true) ? 8 + num(p, 'flow', 100) * 0.22 : 0.2)),
  mass: (p) => 1200 + num(p, 'flow', 100) * 6,
  price: (p) => Math.round(30 + num(p, 'flow', 100) * 0.4 + (str(p, 'kind', 'bench') === 'arm' ? 40 : 0)),
  readouts: (p) => {
    const flow = num(p, 'flow', 100)
    const d = num(p, 'distance', 180)
    const s = 140 + flow * 0.3
    // Face velocity, then the inverse-square fall-off away from it.
    const faceArea = (Math.PI * (s * 0.32 / 1000) ** 2)
    const faceV = flow / 3600 / Math.max(0.001, faceArea)
    const atJoint = faceV * (100 / Math.max(50, d)) ** 2
    const w = bool(p, 'on', true) ? 8 + flow * 0.22 : 0.2
    return [
      { label: 'Flow', value: `${flow} m³/h, ${faceV.toFixed(2)} m/s at the face` },
      { label: `At ${d} mm`, value: `${atJoint.toFixed(2)} m/s` },
      { label: 'Needs', value: '0.5 m/s at the joint to capture the plume' },
      { label: 'Verdict', value: atJoint >= 0.5 ? 'Close enough to work' : `Move it to ${Math.round(100 * Math.sqrt(faceV / 0.5))} mm or nearer` },
      { label: 'Drawing', value: `${w.toFixed(0)} W, ${amps(p, w)}` },
      { label: 'Filter', value: str(p, 'kind', 'bench') === 'duct' ? 'None, it goes outside' : 'Activated carbon, for the rosin' },
    ]
  },
}

/* ================================================================== */
/* The bench itself                                                    */
/* ================================================================== */

const esdMat: PartDef = {
  id: 'mat-esd',
  name: 'ESD mat',
  category: 'tooling',
  blurb: 'A megohm to earth, which is the whole specification',
  tags: ['esd', 'anti static', 'mat', 'grounding', 'wrist strap', 'bench mat', 'static', 'tooling', 'bench', 'safety'],
  doc: {
    price: 42,
    description:
      'A dissipative surface bonded to earth through 1 megohm, and that resistor is the design. Bonded directly, the mat is a conductor and anything dropped on it short-circuits; bonded through a megohm, a charge drains in a few milliseconds and the mat cannot carry enough current to hurt you if a live conductor touches it.\n\nThis is in the catalogue as a real electrical part because that resistance is in the circuit on the bench, and you can wire to it here.',
  },
  params: [
    { key: 'width', label: 'Width', type: 'number', unit: 'mm', default: 900, min: 300, max: 1800, step: 50, group: 'Mat' },
    { key: 'depth', label: 'Depth', type: 'number', unit: 'mm', default: 600, min: 250, max: 900, step: 50, group: 'Mat' },
    /*
     * Not marked `eng`, deliberately. An engineering-notation parameter is
     * what the library's value search places a part by, and a mat with an
     * ohms field in it answered "10k" ahead of the resistor — which is the
     * one thing searching "10k" can only mean. The value is still editable
     * and still in ohms; it is simply not a thing you place by typing a
     * resistance.
     */
    { key: 'resistance', label: 'Earth path', type: 'number', unit: 'Ω', default: 1e6, min: 1e5, max: 1e7, step: 1e5, group: 'Bonding' },
    { key: 'strap', label: 'Wrist strap', type: 'bool', default: true, group: 'Bonding' },
    { key: 'layers', label: 'Build', type: 'enum', default: 'two', group: 'Mat', options: [{ value: 'one', label: 'Single layer rubber' }, { value: 'two', label: 'Two layer, dissipative over conductive' }] },
  ],
  solids: (p) => {
    const w = num(p, 'width', 900)
    const d = num(p, 'depth', 600)
    const two = str(p, 'layers', 'two') === 'two'
    const out: Solid[] = [
      { kind: 'box', mat: { color: '#1F3A44', rough: 0.9, density: 1.4 }, size: [w, two ? 1.2 : 2, d], at: [0, two ? 2.4 : 1, 0], bevel: 1 },
    ]
    if (two) out.push({ kind: 'box', mat: { color: '#14171A', rough: 0.92, density: 1.5 }, size: [w, 1.8, d], at: [0, 0.9, 0], bevel: 1 })
    // The stud and the banana socket the strap and the lead go to.
    out.push({ kind: 'cyl', mat: { color: '#C8A227', metal: 1, rough: 0.4, density: 8.4 }, r: 6, h: 6, seg: 16, at: [-w / 2 + 30, 5, -d / 2 + 30] })
    out.push({ kind: 'cyl', mat: { color: '#C8A227', metal: 1, rough: 0.4, density: 8.4 }, r: 6, h: 6, seg: 16, at: [-w / 2 + 60, 5, -d / 2 + 30] })
    if (bool(p, 'strap', true)) {
      out.push({ kind: 'torus', mat: { color: '#2A4650', rough: 0.85, density: 1.2 }, r: 32, tube: 5, seg: 24, at: [w / 2 - 80, 8, d / 2 - 80] })
      out.push({ kind: 'tube', mat: { color: '#2A4650', rough: 0.8, density: 1.1 }, r: 1.8, seg: 8, path: [[w / 2 - 80, 8, d / 2 - 112], [w / 2 - 200, 8, -d / 2 + 60], [-w / 2 + 60, 8, -d / 2 + 30]] })
    }
    return out
  },
  ports: (p) => {
    const w = num(p, 'width', 900)
    const d = num(p, 'depth', 600)
    const out: Port[] = [
      { id: 'earth', label: 'To earth', kind: 'electrical', pos: [-w / 2 + 30, 8, -d / 2 + 30], dir: [0, 1, 0], role: 'gnd', imax: 0.01, solderable: false },
      { id: 'surface', label: 'Mat surface', kind: 'electrical', pos: [-w / 2 + 60, 8, -d / 2 + 30], dir: [0, 1, 0], role: 'gnd', imax: 0.01, solderable: false },
      { id: 'bench', label: 'Bench', kind: 'mechanical', pos: [0, 0, 0], dir: [0, -1, 0], mate: { type: 'face' } },
      { id: 'top', label: 'Working surface', kind: 'mechanical', pos: [0, str(p, 'layers', 'two') === 'two' ? 3 : 2, 0], dir: [0, 1, 0], mate: { type: 'face' } },
    ]
    if (bool(p, 'strap', true)) {
      out.push({ id: 'strap', label: 'Wrist strap', kind: 'electrical', pos: [w / 2 - 80, 8, d / 2 - 80], dir: [0, 1, 0], role: 'gnd', imax: 0.01, solderable: false })
    }
    return out
  },
  electrical: {
    devices: (p) => {
      const r = Math.max(1e5, num(p, 'resistance', 1e6))
      const out: DeviceModel[] = [{ type: 'resistor', a: 'surface', b: 'earth', r }]
      // The strap has its own megohm, in its own lead, for the same reason.
      if (bool(p, 'strap', true)) out.push({ type: 'resistor', a: 'strap', b: 'earth', r: 1e6 })
      return out
    },
    limits: { vmax: 300 },
  },
  mass: (p) => ((num(p, 'width', 900) * num(p, 'depth', 600)) / 1e6) * (str(p, 'layers', 'two') === 'two' ? 4200 : 2800),
  price: (p) => Math.round(((num(p, 'width', 900) * num(p, 'depth', 600)) / 1e6) * 60 + (bool(p, 'strap', true) ? 9 : 0)),
  readouts: (p) => {
    const r = Math.max(1e5, num(p, 'resistance', 1e6))
    // Decay time of a charged body on the mat, through its own capacitance
    // of about 100 pF: five time constants to effectively nothing.
    const tau = r * 100e-12
    return [
      { label: 'Area', value: `${num(p, 'width', 900)} × ${num(p, 'depth', 600)} mm` },
      { label: 'Earth path', value: `${(r / 1e6).toFixed(2)} MΩ` },
      { label: 'Charge decay', value: `${(tau * 5 * 1000).toFixed(1)} ms to clear` },
      { label: 'Touch current at 230 V', value: `${((230 / r) * 1000).toFixed(2)} mA, which is why it is not bonded directly` },
      { label: 'Compliant', value: r >= 1e6 && r <= 1e9 ? 'Yes, 10⁶ to 10⁹ Ω is the dissipative band' : r < 1e6 ? 'Too low, this is a conductive mat' : 'Too high to drain reliably' },
    ]
  },
}

const partsBins: PartDef = {
  id: 'bins-parts',
  name: 'Parts bins',
  category: 'tooling',
  blurb: 'Drawers, and the wall or bench they take',
  tags: ['parts bins', 'drawers', 'storage', 'organiser', 'small parts', 'components', 'bench', 'tooling', 'wall'],
  doc: {
    price: 45,
    description:
      'A grid of drawers, and in a plan it is a rectangle of wall or bench with a depth you have to be able to open into. The useful figure is capacity in distinct lines: 44 small drawers is 44 values of resistor, which sounds like a lot until you lay out E12 from 10 ohms to a megohm, which is 60.',
  },
  params: [
    { key: 'cols', label: 'Columns', type: 'number', unit: '', default: 11, min: 2, max: 20, step: 1, group: 'Bins' },
    { key: 'rows', label: 'Rows', type: 'number', unit: '', default: 4, min: 1, max: 12, step: 1, group: 'Bins' },
    { key: 'drawer', label: 'Drawer width', type: 'number', unit: 'mm', default: 36, min: 20, max: 120, step: 2, group: 'Bins' },
    { key: 'depth', label: 'Drawer depth', type: 'number', unit: 'mm', default: 120, min: 60, max: 300, step: 10, group: 'Bins' },
    { key: 'mount', label: 'Mount', type: 'enum', default: 'bench', group: 'Mount', options: [{ value: 'bench', label: 'On the bench' }, { value: 'wall', label: 'On the wall' }] },
    { key: 'tint', label: 'Drawer colour', type: 'color', default: '#C9CDD3', group: 'Bins' },
  ],
  solids: (p) => {
    const cols = Math.round(num(p, 'cols', 11))
    const rows = Math.round(num(p, 'rows', 4))
    const dw = num(p, 'drawer', 36)
    const dh = dw * 0.72
    const d = num(p, 'depth', 120)
    const w = cols * dw + 8
    const h = rows * dh + 8
    const shell = { color: '#2A2C30', rough: 0.6, density: 1.2 }
    const out: Solid[] = [
      { kind: 'box', mat: shell, size: [w, h, d], at: [0, h / 2, 0], bevel: 2 },
    ]
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        out.push({
          kind: 'box', mat: { color: str(p, 'tint', '#C9CDD3'), rough: 0.6, density: 1.1 },
          size: [dw - 2, dh - 2, 3], at: [(c - (cols - 1) / 2) * dw, 4 + r * dh + dh / 2, d / 2 + 2] as Vec3, bevel: 1,
        })
        out.push({
          kind: 'box', mat: { color: '#1A1B1E', rough: 0.7, density: 1.1 },
          size: [dw * 0.4, 2.5, 4], at: [(c - (cols - 1) / 2) * dw, 4 + r * dh + dh * 0.28, d / 2 + 4] as Vec3, noCollide: true,
        })
      }
    }
    return out
  },
  ports: (p) => {
    const cols = Math.round(num(p, 'cols', 11))
    const rows = Math.round(num(p, 'rows', 4))
    const dw = num(p, 'drawer', 36)
    const h = rows * dw * 0.72 + 8
    const wall = str(p, 'mount', 'bench') === 'wall'
    return [
      { id: 'base', label: wall ? 'Wall' : 'Bench', kind: 'mechanical', pos: [0, wall ? h / 2 : 0, wall ? -num(p, 'depth', 120) / 2 : 0], dir: wall ? [0, 0, -1] : [0, -1, 0], mate: { type: 'face' } },
      { id: 'top', label: 'Top', kind: 'mechanical', pos: [0, h, 0], dir: [0, 1, 0], mate: { type: 'face' } },
      { id: 'front', label: 'Drawer swing', kind: 'mechanical', pos: [0, h / 2, num(p, 'depth', 120) / 2 + cols * 0], dir: [0, 0, 1], mate: { type: 'face' } },
    ]
  },
  mass: (p) => {
    const cols = Math.round(num(p, 'cols', 11))
    const rows = Math.round(num(p, 'rows', 4))
    return 400 + cols * rows * 22
  },
  price: (p) => {
    const cols = Math.round(num(p, 'cols', 11))
    const rows = Math.round(num(p, 'rows', 4))
    return Math.round(12 + cols * rows * 0.7)
  },
  readouts: (p) => {
    const cols = Math.round(num(p, 'cols', 11))
    const rows = Math.round(num(p, 'rows', 4))
    const dw = num(p, 'drawer', 36)
    const d = num(p, 'depth', 120)
    const n = cols * rows
    return [
      { label: 'Drawers', value: `${n}, ${cols} across and ${rows} up` },
      { label: 'Takes', value: `${Math.round(cols * dw + 8)} × ${Math.round(rows * dw * 0.72 + 8)} mm, ${d} mm deep` },
      { label: 'Clearance in front', value: `${Math.round(d * 0.85)} mm to open a drawer fully` },
      { label: 'Holds', value: `${n} distinct lines — E12 resistors alone are 60` },
    ]
  },
}

const benchVice: PartDef = {
  id: 'vice-bench',
  name: 'Bench vice',
  category: 'tooling',
  blurb: 'Jaw width, opening, and what it does to the bench',
  tags: ['vice', 'vise', 'clamp', 'jaws', 'bench', 'workholding', 'pcb holder', 'tooling', 'fixture'],
  doc: {
    price: 65,
    description:
      'Two numbers do the work: jaw width, which sets what you can hold, and opening, which sets what you can get between them. The third is the one that matters to the bench — a vice clamped to a 18 mm top with 50 N·m of torque on a work piece will lift the top off its frame, which is why a real one is bolted through.',
  },
  params: [
    {
      key: 'kind', label: 'Type', type: 'enum', default: 'pcb', group: 'Vice',
      options: [{ value: 'pcb', label: 'PCB holder, soft jaws' }, { value: 'hobby', label: 'Hobby vice, ball joint' }, { value: 'engineer', label: 'Engineer vice, cast' }],
    },
    { key: 'jaw', label: 'Jaw width', type: 'number', unit: 'mm', default: 100, min: 40, max: 200, step: 5, group: 'Vice' },
    { key: 'opening', label: 'Maximum opening', type: 'number', unit: 'mm', default: 90, min: 20, max: 250, step: 5, group: 'Vice' },
    { key: 'open', label: 'Open to', type: 'number', unit: 'mm', default: 40, min: 0, max: 250, step: 1, group: 'Control' },
    { key: 'mount', label: 'Mount', type: 'enum', default: 'clamp', group: 'Mount', options: [{ value: 'clamp', label: 'Clamped to the edge' }, { value: 'bolt', label: 'Bolted through' }, { value: 'weight', label: 'Weighted base' }] },
  ],
  solids: (p) => {
    const kind = str(p, 'kind', 'pcb')
    const jaw = num(p, 'jaw', 100)
    const open = Math.min(num(p, 'open', 40), num(p, 'opening', 90))
    const cast = kind === 'engineer'
    const body = cast ? { color: '#243A4A', rough: 0.72, density: 7.2 } : TOOL_BLUE
    const jawMat = kind === 'pcb' ? { color: '#2E3136', rough: 0.9, density: 1.2 } : STEEL
    const h = cast ? 110 : 70
    const out: Solid[] = [
      { kind: 'box', mat: body, size: [jaw + 50, h * 0.5, 120], at: [0, h * 0.25, 0], bevel: 4 },
      { kind: 'box', mat: jawMat, size: [jaw, h * 0.42, 22], at: [0, h * 0.6, -11 - open / 2] },
      { kind: 'box', mat: jawMat, size: [jaw, h * 0.42, 22], at: [0, h * 0.6, 11 + open / 2] },
      { kind: 'cyl', mat: STEEL, r: 9, h: 120 + open, seg: 14, rot: [90, 0, 0], at: [0, h * 0.55, 0] },
      { kind: 'cyl', mat: STEEL, r: 7, h: jaw * 0.9, seg: 12, rot: [0, 0, 90], at: [0, h * 0.55, 70 + open / 2] },
    ]
    if (kind === 'hobby') out.push({ kind: 'sphere', mat: STEEL, r: 24, seg: 18, at: [0, 14, 0] })
    if (str(p, 'mount', 'clamp') === 'clamp') {
      out.push({ kind: 'box', mat: body, size: [60, 50, 16], at: [0, -12, -70], bevel: 2 })
      out.push({ kind: 'cyl', mat: STEEL, r: 7, h: 46, seg: 12, at: [0, -38, -70] })
    } else if (str(p, 'mount', 'clamp') === 'weight') {
      out.push({ kind: 'cyl', mat: { color: '#1C1E22', rough: 0.7, density: 7.8 }, r: jaw * 0.7, h: 20, seg: 28, at: [0, 10, 0] })
    }
    return out
  },
  ports: (p) => {
    const jaw = num(p, 'jaw', 100)
    const open = Math.min(num(p, 'open', 40), num(p, 'opening', 90))
    const h = str(p, 'kind', 'pcb') === 'engineer' ? 110 : 70
    return [
      { id: 'bench', label: 'Bench', kind: 'mechanical', pos: [0, 0, 0], dir: [0, -1, 0], mate: { type: 'face' } },
      { id: 'held', label: 'Held between the jaws', kind: 'mechanical', pos: [0, h * 0.6, 0], dir: [0, 1, 0], mate: { type: 'face', size: Math.max(1, open) } },
      { id: 'jawL', label: 'Fixed jaw', kind: 'mechanical', pos: [0, h * 0.6, -11 - open / 2], dir: [0, 0, 1], mate: { type: 'face', size: jaw } },
    ]
  },
  mass: (p) => {
    const kind = str(p, 'kind', 'pcb')
    const jaw = num(p, 'jaw', 100)
    return kind === 'engineer' ? jaw * 90 : kind === 'hobby' ? jaw * 18 : jaw * 7 + (str(p, 'mount', 'clamp') === 'weight' ? 1400 : 0)
  },
  price: (p) => {
    const kind = str(p, 'kind', 'pcb')
    const jaw = num(p, 'jaw', 100)
    return Math.round((kind === 'engineer' ? 0.9 : kind === 'hobby' ? 0.5 : 0.45) * jaw + 18)
  },
  readouts: (p) => {
    const jaw = num(p, 'jaw', 100)
    const opening = num(p, 'opening', 90)
    const open = Math.min(num(p, 'open', 40), opening)
    const kind = str(p, 'kind', 'pcb')
    const mount = str(p, 'mount', 'clamp')
    return [
      { label: 'Jaws', value: `${jaw} mm wide, open to ${opening} mm` },
      { label: 'Open now', value: `${open} mm` },
      { label: 'Holds', value: kind === 'pcb' ? 'Boards and assemblies, soft jawed' : kind === 'hobby' ? 'Small work at any angle' : 'Metal, and it will mark it' },
      {
        label: 'Mount',
        value: mount === 'bolt' ? 'Bolted through, takes real force' : mount === 'clamp' ? 'Clamped — fine for hand work, not for filing' : 'Weighted, it will slide under load',
      },
      { label: 'Bench footprint', value: `${jaw + 50} × ${120 + opening} mm with the handle swinging` },
    ]
  },
}

const labelPrinter: PartDef = {
  id: 'printer-label',
  name: 'Label printer',
  category: 'tooling',
  blurb: 'Tape width, and the reason a patch panel is usable',
  tags: ['label printer', 'labeller', 'brother', 'dymo', 'tape', 'cable labels', 'identification', 'tooling', 'network', 'bench'],
  doc: {
    price: 70,
    description:
      'The tool that decides whether a rack can be worked on in two years. Its only real parameter is tape width: 12 mm is a cable label, 24 mm is a patch panel strip, 6 mm is what fits on a single keystone.\n\nFlexible-ID tape is the one worth knowing about. Standard laminated tape on a 4 mm cable peels off within a month; flexible tape is made to wrap and stay.',
  },
  params: [
    { key: 'tape', label: 'Tape width', type: 'enum', default: '12', group: 'Printer', options: ['6', '9', '12', '18', '24', '36'].map((v) => ({ value: v, label: `${v} mm` })) },
    {
      key: 'kind', label: 'Tape type', type: 'enum', default: 'laminated', group: 'Printer',
      options: [{ value: 'laminated', label: 'Laminated' }, { value: 'flexid', label: 'Flexible ID, for cables' }, { value: 'heatshrink', label: 'Heat shrink tube' }],
    },
    {
      key: 'power', label: 'Power', type: 'enum', default: 'usb', group: 'Power',
      options: [{ value: 'batteries', label: 'Six AA cells' }, { value: 'usb', label: 'USB-C' }, { value: 'mains', label: 'Mains adapter' }],
    },
    { key: 'labels', label: 'Labels to print', type: 'number', unit: '', default: 24, min: 0, max: 400, step: 1, group: 'Control' },
  ],
  solids: (p) => {
    const tape = parseInt(str(p, 'tape', '12'), 10) || 12
    const w = 110 + tape * 1.6
    const out: Solid[] = [
      { kind: 'box', mat: { color: '#2A2C30', rough: 0.6, density: 1.3 }, size: [w, 60, 180], at: [0, 30, 0], bevel: 8 },
      { kind: 'box', mat: DARK, size: [w * 0.66, 2, 50], at: [0, 61, 40] },
      { kind: 'box', mat: screen(true, '#3A5E4A'), size: [w * 0.62, 1, 44], at: [0, 62, 40] },
      // The keyboard, as a field of keys.
      ...Array.from({ length: 24 }, (_, i) => ({
        kind: 'box' as const, mat: { color: '#1A1B1E', rough: 0.7, density: 1.1 },
        size: [10, 4, 9] as Vec3, at: [-w / 2 + 18 + (i % 8) * 14, 62, -10 + Math.floor(i / 8) * 14] as Vec3,
      })),
      // The tape cassette and the slot it comes out of.
      { kind: 'cyl', mat: { color: '#1C1E22', rough: 0.5, density: 1.2 }, r: 30, h: tape + 6, seg: 24, rot: [0, 0, 90], at: [0, 26, -62] },
      { kind: 'box', mat: DARK, size: [tape + 4, 3, 8], at: [w / 2 - 10, 40, -40], noCollide: true },
    ]
    return out
  },
  ports: (p) => {
    const tape = parseInt(str(p, 'tape', '12'), 10) || 12
    const w = 110 + tape * 1.6
    const power = str(p, 'power', 'usb')
    const out: Port[] = [{ id: 'bench', label: 'Bench', kind: 'mechanical', pos: [0, 0, 0], dir: [0, -1, 0], mate: { type: 'face' } }]
    if (power === 'usb') {
      out.push({ id: 'vbus', label: 'USB +5 V', kind: 'electrical', pos: [-w / 2 + 14, 20, -92], dir: [0, 0, -1], role: 'power', imax: 2, solderable: false })
      out.push({ id: 'gnd', label: 'USB GND', kind: 'electrical', pos: [-w / 2 + 22, 20, -92], dir: [0, 0, -1], role: 'gnd', imax: 2, solderable: false })
    } else if (power === 'mains') {
      out.push({ id: 'dc', label: '9 V DC in', kind: 'electrical', pos: [-w / 2 + 14, 20, -92], dir: [0, 0, -1], role: 'power', imax: 2, solderable: false })
      out.push({ id: 'dcgnd', label: 'DC return', kind: 'electrical', pos: [-w / 2 + 22, 20, -92], dir: [0, 0, -1], role: 'gnd', imax: 2, solderable: false })
    }
    return out
  },
  electrical: {
    devices: (p) => {
      const power = str(p, 'power', 'usb')
      // A thermal head is a real pull while it is printing: 1.5 A at 5 V on
      // a 12 mm tape, which is why a bus port is marginal and batteries sag.
      if (power === 'usb') return [{ type: 'resistor', a: 'vbus', b: 'gnd', r: 25 / 7 } as DeviceModel]
      if (power === 'mains') return [{ type: 'resistor', a: 'dc', b: 'dcgnd', r: 81 / 9 } as DeviceModel]
      return []
    },
    limits: { vmax: 24 },
  },
  mass: (p) => 600 + (str(p, 'power', 'usb') === 'batteries' ? 140 : 0),
  price: (p) => {
    const tape = parseInt(str(p, 'tape', '12'), 10) || 12
    return Math.round(30 + tape * 2.6)
  },
  readouts: (p) => {
    const tape = parseInt(str(p, 'tape', '12'), 10) || 12
    const kind = str(p, 'kind', 'laminated')
    const n = Math.round(num(p, 'labels', 24))
    const power = str(p, 'power', 'usb')
    return [
      { label: 'Tape', value: `${tape} mm, ${kind === 'flexid' ? 'flexible ID' : kind === 'heatshrink' ? 'heat shrink' : 'laminated'}` },
      { label: 'Suits', value: tape <= 6 ? 'A single keystone' : tape <= 12 ? 'Cables and drawer fronts' : tape <= 18 ? 'Patch panel ports' : 'Panel strips and rack labels' },
      { label: 'On a 4 mm cable', value: kind === 'laminated' ? 'Laminated tape will peel; use flexible ID' : 'Will stay on' },
      { label: 'This run', value: `${n} labels, about ${Math.round(n * (tape + 8) / 10) / 100} m of tape` },
      { label: 'Printing draws', value: power === 'usb' ? '7 W, 1.4 A at 5 V' : power === 'mains' ? '9 W from the adapter' : 'Hard enough on six AA cells to sag them' },
    ]
  },
}

registerParts([printer3d, solderStation, hotAir, fumeExtractor, esdMat, partsBins, benchVice, labelPrinter])
