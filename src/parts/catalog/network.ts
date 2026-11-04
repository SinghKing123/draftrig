import type { DeviceModel, PartDef, Port, Solid, Vec3 } from '../kernel/types'
import { registerParts } from '../kernel/registry'
import { bool, num, str } from './_helpers'
import { ALU, DARK, REGION_PARAM, STEEL, amps, load, mainsPorts, volts } from './setup'
import { BLACK_PLASTIC, signalPorts } from './setup2'

/**
 * The network, as hardware that takes up space and draws power.
 *
 * `setup2.ts` has the router and `setup3.ts` has an eight-port switch, which
 * covers a house. What was missing is everything that appears the moment
 * somebody runs cable on purpose: a rack to put it in, a panel to terminate
 * it on, a NAS to fill it, an access point on the ceiling, and the injector
 * that feeds the access point because there is no socket up there.
 *
 * The question this file exists to answer is the power budget over the data
 * cable. Power over Ethernet is a negotiation with hard numbers — 15.4 W
 * leaves an 802.3af port and 12.95 W arrives, because the standard allows
 * 100 m of 24 AWG between them and that cable has resistance. A switch with
 * a 60 W budget does not run four 25 W cameras, and the sum that says so is
 * arithmetic nobody does until something reboots in a loop.
 *
 * ------------------------------------------------------------------
 * The rack convention
 * ------------------------------------------------------------------
 *
 * One rack unit is 44.45 mm and the mounting width is 482.6 mm, which is the
 * nineteen inches the whole industry is built on. Anything in here that is
 * rack mountable states its height in U and is drawn at the real width, so a
 * stack either fits the rack or does not.
 */

const U = 44.45
const RACK_W = 482.6
/** The panel width inside the ears, which is what a box is actually made to. */
const BOX_W = 440

const PCB_GREEN = { color: '#1B4332', rough: 0.6, density: 1.9 }
const DRIVE = { color: '#5A5F66', metal: 0.9, rough: 0.45, density: 7.2 }

/** An RJ45 jack, drawn as the shell and the tongue inside it. */
function rj45(at: Vec3, dir: 1 | -1 = 1): Solid[] {
  return [
    { kind: 'box', mat: { color: '#0A0B0D', rough: 0.55, density: 1.3 }, size: [15, 14, 10], at: [at[0], at[1], at[2]] },
    { kind: 'box', mat: { color: '#C9A227', metal: 1, rough: 0.4, density: 8.4 }, size: [10, 4, 3], at: [at[0], at[1] - 2, at[2] + dir * 4], noCollide: true },
  ]
}

/**
 * The two ends of a PoE pair.
 *
 * Power over Ethernet is DC on two of the four pairs, so it needs both a feed
 * and a return to be solvable at all: one terminal with a resistance hanging
 * off it is a floating node, and the first version of this file had exactly
 * that. `poe` is the 48 V side and `poen` is the return, on both the thing
 * that supplies it and the thing that eats it, so a run is two wires and the
 * drop over them is the drop the device really sees.
 */
function poePorts(at: Vec3, dir: Vec3, imax = 1.2): Port[] {
  return [
    { id: 'poe', label: 'PoE +48 V', kind: 'electrical', pos: [at[0] - 7, at[1], at[2]], dir, role: 'power', imax, solderable: false },
    { id: 'poen', label: 'PoE return', kind: 'electrical', pos: [at[0] + 7, at[1], at[2]], dir, role: 'gnd', imax, solderable: false },
  ]
}

/** Ethernet ports, which carry no current unless something is feeding them. */
function lanPorts(n: number, at: Vec3, dir: Vec3, pitch = 18, prefix = 'lan'): Port[] {
  const half = ((n - 1) * pitch) / 2
  return Array.from({ length: n }, (_, i) => ({
    id: `${prefix}${i + 1}`,
    label: `Port ${i + 1}`,
    kind: 'electrical' as const,
    pos: [at[0] - half + i * pitch, at[1], at[2]] as Vec3,
    dir,
    role: 'io' as const,
    imax: 0.6,
    solderable: false,
  }))
}

/* ================================================================== */
/* The rack                                                           */
/* ================================================================== */

const rack: PartDef = {
  id: 'rack-network',
  // A 42U rack with a pull-out console tray, brought down to whatever
  // height the part is set to through its middle, so the plinth and the
  // top cap keep their proportions.
  model: {
    url: 'models/server-rack.glb',
    fit: 'bbox',
    axes: { x: [0.1, 0.9], y: 'fill' },
    credit: { title: 'Server V2 +console', author: 'FlevasGR', license: 'CC-BY-4.0', source: 'https://sketchfab.com/3d-models/server-v2-console-f24594ece9634cec9c1210c041838371' },
  },
  name: 'Network rack',
  category: 'network',
  blurb: 'Nineteen inches wide, however many U tall',
  tags: ['rack', '19 inch', 'cabinet', 'network rack', 'wall rack', 'patch', 'u', 'server rack', 'enclosure'],
  doc: {
    price: 180,
    description:
      'The thing that decides what else can exist. Nineteen inches between the rails is fixed; what is yours to choose is the height in U and the depth, and the depth is where wall racks catch people out — a 300 mm deep wall box will not take a 400 mm deep switch, and the switch is always 400 mm deep because of the power supply in the back of it.\n\nLeave a U above anything that runs warm. The vented U is what that looks like in a plan.',
  },
  params: [
    {
      key: 'style', label: 'Style', type: 'enum', default: 'wall', group: 'Rack',
      options: [{ value: 'wall', label: 'Wall mounted box' }, { value: 'open', label: 'Open frame, floor' }, { value: 'desk', label: 'Desktop, stacked' }],
    },
    { key: 'height', label: 'Height', type: 'number', unit: 'U', default: 9, min: 2, max: 42, step: 1, group: 'Rack' },
    { key: 'depth', label: 'Depth', type: 'number', unit: 'mm', default: 450, min: 250, max: 1000, step: 50, group: 'Rack' },
    { key: 'used', label: 'U in use', type: 'number', unit: 'U', default: 4, min: 0, max: 42, step: 1, group: 'Load' },
    { key: 'door', label: 'Glazed door', type: 'bool', default: true, group: 'Rack', showIf: (p) => str(p, 'style', 'wall') === 'wall' },
  ],
  solids: (p) => {
    const h = Math.round(num(p, 'height', 9)) * U + 60
    const d = num(p, 'depth', 450)
    const w = RACK_W + 60
    const style = str(p, 'style', 'wall')
    const out: Solid[] = []
    if (style === 'open') {
      // Four posts and the rails between them.
      for (const sx of [-1, 1] as const) {
        for (const sz of [-1, 1] as const) {
          out.push({ kind: 'box', mat: STEEL, size: [20, h, 20], at: [(sx * RACK_W) / 2, h / 2, sz * (d / 2 - 20)] })
        }
        out.push({ kind: 'box', mat: STEEL, size: [14, 14, d - 20], at: [(sx * RACK_W) / 2, 14, 0] })
      }
      out.push({ kind: 'box', mat: STEEL, size: [w, 14, d], at: [0, 7, 0], bevel: 2 })
    } else {
      // A box: two sides, a back, a top and a bottom.
      out.push({ kind: 'box', mat: { color: '#1A1C20', rough: 0.6, density: 7.8 }, size: [w, h, 10], at: [0, h / 2, -d / 2] })
      for (const sx of [-1, 1] as const) out.push({ kind: 'box', mat: { color: '#1A1C20', rough: 0.6, density: 7.8 }, size: [10, h, d], at: [(sx * w) / 2, h / 2, 0] })
      out.push({ kind: 'box', mat: { color: '#1A1C20', rough: 0.6, density: 7.8 }, size: [w, 10, d], at: [0, 5, 0] })
      out.push({ kind: 'box', mat: { color: '#1A1C20', rough: 0.6, density: 7.8 }, size: [w, 10, d], at: [0, h - 5, 0] })
      if (bool(p, 'door', true) && style === 'wall') {
        out.push({ kind: 'box', mat: { color: '#14161A', rough: 0.15, clearcoat: 0.8, density: 2.5, opacity: 0.45, transmission: 0.5 }, size: [w - 20, h - 24, 5], at: [0, h / 2, d / 2 + 2] })
      }
    }
    // The U markings, as the strip of mounting holes each side.
    const n = Math.round(num(p, 'height', 9))
    for (let i = 0; i < n; i++) {
      for (const sx of [-1, 1] as const) {
        out.push({ kind: 'box', mat: ALU, size: [12, U - 6, 4], at: [sx * (RACK_W / 2 - 14), 30 + i * U + U / 2, d / 2 - 30], noCollide: true })
      }
    }
    return out
  },
  ports: (p) => {
    const n = Math.round(num(p, 'height', 9))
    const d = num(p, 'depth', 450)
    // One mounting face per U, so a box can be said to be in a given slot.
    return [
      ...Array.from({ length: n }, (_, i) => ({
        id: `u${i + 1}`,
        label: `U${i + 1}`,
        kind: 'mechanical' as const,
        pos: [0, 30 + i * U + U / 2, d / 2 - 36] as Vec3,
        dir: [0, 0, 1] as Vec3,
        mate: { type: 'rail' as const, size: RACK_W },
      })),
      { id: 'base', label: str(p, 'style', 'wall') === 'wall' ? 'Wall' : 'Floor', kind: 'mechanical', pos: [0, 0, 0], dir: [0, -1, 0], mate: { type: 'face' } },
    ]
  },
  mass: (p) => Math.round(num(p, 'height', 9)) * 1600 + num(p, 'depth', 450) * 6,
  price: (p) => 60 + Math.round(num(p, 'height', 9)) * 14 + num(p, 'depth', 450) * 0.1,
  readouts: (p) => {
    const n = Math.round(num(p, 'height', 9))
    const used = Math.min(n, Math.round(num(p, 'used', 4)))
    const d = num(p, 'depth', 450)
    return [
      { label: 'Opening', value: `482.6 mm between rails, ${(n * U).toFixed(0)} mm of height` },
      { label: 'Free', value: `${n - used}U of ${n}U` },
      { label: 'Usable depth', value: `${Math.round(d - 60)} mm, after the door and the cable bend` },
      { label: 'Takes a 400 mm switch', value: d >= 500 ? 'Yes, with room for the cables' : d >= 450 ? 'Tight, the leads will press on the door' : 'No' },
    ]
  },
}

const patchPanel: PartDef = {
  id: 'patch-panel',
  name: 'Patch panel',
  category: 'network',
  blurb: 'Where the cable in the walls stops being cable',
  tags: ['patch panel', 'keystone', 'punch down', 'rj45', 'rack', 'termination', 'cat6', 'network', '1u'],
  doc: {
    price: 55,
    description:
      'A rack strip of keystone jacks. Nothing electrical happens in it and that is the point: it turns solid-core cable, which breaks if you flex it, into a jack you can patch and repatch with stranded leads.\n\nIt is here because of its depth. A panel is 1U on the front and 120 mm of cable bend behind it, and a 24-port panel in a 300 mm box leaves nothing for the switch.',
  },
  params: [
    { key: 'ports', label: 'Ports', type: 'enum', default: '24', group: 'Panel', options: ['12', '16', '24', '48'].map((v) => ({ value: v, label: `${v} way` })) },
    { key: 'cat', label: 'Category', type: 'enum', default: '6', group: 'Panel', options: [{ value: '5e', label: 'Cat 5e, 1 Gb' }, { value: '6', label: 'Cat 6, 10 Gb to 55 m' }, { value: '6a', label: 'Cat 6a, 10 Gb to 100 m' }] },
    { key: 'used', label: 'Terminated', type: 'number', unit: '', default: 8, min: 0, max: 48, step: 1, group: 'Load' },
    { key: 'shielded', label: 'Shielded', type: 'bool', default: false, group: 'Panel', help: 'Needs the screen bonding to the rack at one end, and only one.' },
  ],
  solids: (p) => {
    const n = parseInt(str(p, 'ports', '24'), 10) || 24
    const rows = n > 24 ? 2 : 1
    const perRow = Math.ceil(n / rows)
    const h = rows * U
    const out: Solid[] = [
      { kind: 'box', mat: { color: '#1C1E22', rough: 0.55, density: 7.8 }, size: [RACK_W, h, 4], at: [0, h / 2, 0] },
    ]
    for (let r = 0; r < rows; r++) {
      for (let i = 0; i < Math.min(perRow, n - r * perRow); i++) {
        const x = (i - (perRow - 1) / 2) * ((BOX_W - 20) / perRow)
        out.push(...rj45([x, h - U / 2 - r * U, 5]))
      }
    }
    // The ears.
    for (const sx of [-1, 1] as const) out.push({ kind: 'box', mat: ALU, size: [20, h - 10, 4], at: [(sx * RACK_W) / 2 - sx * 10, h / 2, -1], noCollide: true })
    return out
  },
  ports: (p) => {
    const n = parseInt(str(p, 'ports', '24'), 10) || 24
    const rows = n > 24 ? 2 : 1
    const perRow = Math.ceil(n / rows)
    const h = rows * U
    const out: Port[] = []
    for (let r = 0; r < rows; r++) {
      for (let i = 0; i < Math.min(perRow, n - r * perRow); i++) {
        const x = (i - (perRow - 1) / 2) * ((BOX_W - 20) / perRow)
        const k = r * perRow + i + 1
        out.push({ id: `front${k}`, label: `Front ${k}`, kind: 'electrical', pos: [x, h - U / 2 - r * U, 10], dir: [0, 0, 1], role: 'io', imax: 0.6, solderable: false })
        out.push({ id: `rear${k}`, label: `Punched ${k}`, kind: 'electrical', pos: [x, h - U / 2 - r * U, -6], dir: [0, 0, -1], role: 'io', imax: 0.6, solderable: false })
      }
    }
    out.push({ id: 'rail', label: 'Rack rail', kind: 'mechanical', pos: [0, h / 2, -2], dir: [0, 0, -1], mate: { type: 'rail', size: RACK_W } })
    return out
  },
  /*
   * A jack is a jack: front to back is a wire with the contact resistance of
   * two IDC terminations in it, about 40 milliohms. Modelled because PoE
   * runs through here, and the panel is part of the loop that sets what
   * arrives at the far end.
   */
  electrical: {
    devices: (p) => {
      const n = parseInt(str(p, 'ports', '24'), 10) || 24
      return Array.from({ length: n }, (_, i) => ({ type: 'resistor' as const, a: `front${i + 1}`, b: `rear${i + 1}`, r: 0.04 }))
    },
    limits: { vmax: 60 },
  },
  mass: (p) => {
    const n = parseInt(str(p, 'ports', '24'), 10) || 24
    return 420 + n * 14
  },
  price: (p) => {
    const n = parseInt(str(p, 'ports', '24'), 10) || 24
    return 18 + n * (bool(p, 'shielded', false) ? 2.6 : 1.5)
  },
  readouts: (p) => {
    const n = parseInt(str(p, 'ports', '24'), 10) || 24
    const used = Math.min(n, Math.round(num(p, 'used', 8)))
    const cat = str(p, 'cat', '6')
    return [
      { label: 'Rack height', value: `${n > 24 ? 2 : 1}U` },
      { label: 'Free ways', value: `${n - used} of ${n}` },
      { label: 'Depth behind', value: `${n > 24 ? 160 : 120} mm for the bend radius` },
      { label: 'Good for', value: cat === '5e' ? '1 Gb, 100 m' : cat === '6' ? '10 Gb to 55 m, 1 Gb to 100 m' : '10 Gb to 100 m' },
    ]
  },
}

/* ================================================================== */
/* Power over Ethernet                                                 */
/* ================================================================== */

/** The three PoE standards, as the numbers that matter at each end. */
const POE: Record<string, { label: string; source: number; device: number }> = {
  af: { label: '802.3af, Type 1', source: 15.4, device: 12.95 },
  at: { label: '802.3at, Type 2', source: 30, device: 25.5 },
  bt: { label: '802.3bt, Type 3', source: 60, device: 51 },
}

const accessPoint: PartDef = {
  id: 'access-point',
  name: 'Wireless access point',
  category: 'network',
  blurb: 'A disc on the ceiling, fed up the data cable',
  tags: ['access point', 'wifi', 'ap', 'wireless', 'poe', 'ceiling', 'wifi 6', 'network', 'unifi'],
  doc: {
    price: 160,
    description:
      'The reason PoE exists in a house: there is no socket on a ceiling. It takes its power from the switch up the same cable the data comes down, which means the cable run is now a power run and has a budget.\n\nThe coverage figure is honest about being an estimate — it is free-space range derated for walls, and a single stud wall costs about 15% of it. It is useful for deciding between one AP and two, not for promising a signal in a specific corner.',
  },
  params: [
    {
      key: 'gen', label: 'Generation', type: 'enum', default: 'wifi6', group: 'Access point',
      options: [{ value: 'wifi5', label: 'Wi-Fi 5, 867 Mb' }, { value: 'wifi6', label: 'Wi-Fi 6, 1.2 Gb' }, { value: 'wifi6e', label: 'Wi-Fi 6E, 6 GHz' }, { value: 'wifi7', label: 'Wi-Fi 7, 5.8 Gb' }],
    },
    { key: 'poe', label: 'PoE class', type: 'enum', default: 'at', group: 'Power', options: Object.entries(POE).map(([value, v]) => ({ value, label: v.label })) },
    { key: 'runLength', label: 'Cable run', type: 'number', unit: 'm', default: 40, min: 1, max: 100, step: 1, group: 'Power', help: 'The standard allows 100 m. The volt drop over it is why the device allowance is lower than the source budget.' },
    { key: 'radius', label: 'Coverage radius', type: 'number', unit: 'mm', default: 12000, min: 3000, max: 40000, step: 500, group: 'Coverage' },
    { key: 'clients', label: 'Clients', type: 'number', unit: '', default: 18, min: 0, max: 200, step: 1, group: 'Coverage' },
  ],
  solids: (p) => {
    const gen = str(p, 'gen', 'wifi6')
    const r = gen === 'wifi7' ? 110 : 88
    return [
      { kind: 'cyl', mat: { color: '#E9E7E2', rough: 0.5, density: 1.4 }, r, h: 34, seg: 40, at: [0, -17, 0], chamfer: 6 },
      { kind: 'cyl', mat: { color: '#D7D5D0', rough: 0.55, density: 1.4 }, r: r * 0.46, h: 6, seg: 28, at: [0, -2, 0] },
      { kind: 'cyl', mat: { color: '#2B2E33', rough: 0.4, density: 1.2, emissive: '#4C8DFF', emissiveIntensity: 0.5 }, r: r * 0.2, h: 2, seg: 24, at: [0, -35, 0], noCollide: true },
      // The cable entry and the mounting bracket behind it.
      { kind: 'cyl', mat: BLACK_PLASTIC, r: 12, h: 18, seg: 16, at: [0, -9, -r * 0.6] },
      { kind: 'cyl', mat: ALU, r: r * 0.55, h: 4, seg: 28, at: [0, -1, 0], noCollide: true },
    ]
  },
  ports: (p) => {
    const r = str(p, 'gen', 'wifi6') === 'wifi7' ? 110 : 88
    return [
      ...lanPorts(1, [0, -9, -r * 0.6 - 10], [0, 0, -1], 18, 'data'),
      ...poePorts([0, -22, -r * 0.6 - 10], [0, 0, -1]),
      { id: 'ceiling', label: 'Ceiling', kind: 'mechanical', pos: [0, 0, 0], dir: [0, 1, 0], mate: { type: 'face' } },
    ]
  },
  electrical: {
    /*
     * A powered device, as the switch sees it: a resistance across the pair
     * sized for the watts it wants at 48 V. Modelled as a resistance rather
     * than a fixed current so the drop over a long run shows up as the
     * device being short of power, which is what actually happens — an AP at
     * the end of 90 metres of thin cable gets under its class allowance and
     * drops a radio to cope.
     */
    devices: (p) => {
      const gen = str(p, 'gen', 'wifi6')
      const w = gen === 'wifi7' ? 21 : gen === 'wifi6e' ? 17 : gen === 'wifi6' ? 13 : 9.5
      return [{ type: 'resistor', a: 'poe', b: 'poen', r: (48 * 48) / w } as DeviceModel]
    },
    limits: { vmax: 60, pmax: 60 },
  },
  mass: () => 480,
  price: (p) => {
    const gen = str(p, 'gen', 'wifi6')
    return gen === 'wifi7' ? 320 : gen === 'wifi6e' ? 220 : gen === 'wifi6' ? 150 : 95
  },
  readouts: (p) => {
    const gen = str(p, 'gen', 'wifi6')
    const w = gen === 'wifi7' ? 21 : gen === 'wifi6e' ? 17 : gen === 'wifi6' ? 13 : 9.5
    const cls = POE[str(p, 'poe', 'at')] ?? POE.at
    const run = num(p, 'runLength', 40)
    // 0.19 ohm a metre a conductor for 24 AWG, two conductors each way.
    const loss = ((w / 48) ** 2 * (run * 0.19 * 2)) / 1
    const r = num(p, 'radius', 12000)
    const clients = Math.round(num(p, 'clients', 18))
    const rate = gen === 'wifi7' ? 5800 : gen === 'wifi6e' ? 2400 : gen === 'wifi6' ? 1200 : 867
    return [
      { label: 'Wants', value: `${w.toFixed(1)} W at the device` },
      { label: 'Class allows', value: `${cls.device} W, from ${cls.source} W at the switch` },
      { label: `Over ${run} m`, value: `${loss.toFixed(2)} W lost in the cable` },
      { label: 'Fits the class', value: w + loss <= cls.device ? 'Yes' : `No, ${(w + loss - cls.device).toFixed(1)} W over` },
      { label: 'Covers', value: `${(Math.PI * (r / 1000) ** 2).toFixed(0)} m² clear, around ${((Math.PI * (r / 1000) ** 2) * 0.55).toFixed(0)} m² through walls` },
      { label: 'Per client', value: clients > 0 ? `${Math.round(rate / clients)} Mb of ${rate} Mb shared` : `${rate} Mb, nothing on it` },
    ]
  },
}

const poeInjector: PartDef = {
  id: 'poe-injector',
  name: 'PoE injector',
  category: 'network',
  blurb: 'Puts 48 V on a cable that was only carrying data',
  tags: ['poe', 'injector', 'power over ethernet', '48v', 'midspan', 'network', 'adapter', '802.3af', '802.3at'],
  doc: {
    price: 22,
    description:
      'A midspan. Data in one side, data and 48 V out the other, so one device can be fed without replacing the switch. It is the cheap answer to one access point and the wrong answer to four, which is what the budget readout is for.',
  },
  params: [
    REGION_PARAM,
    { key: 'poe', label: 'Class', type: 'enum', default: 'at', group: 'PoE', options: Object.entries(POE).map(([value, v]) => ({ value, label: v.label })) },
    { key: 'gigabit', label: 'Gigabit pass-through', type: 'bool', default: true, group: 'PoE', help: 'The cheap injectors are 100 Mb only, which caps the device behind them.' },
  ],
  solids: () => [
    { kind: 'box', mat: { color: '#E9E7E2', rough: 0.5, density: 1.4 }, size: [120, 34, 62], at: [0, 17, 0], bevel: 4 },
    ...rj45([-26, 17, 32]),
    ...rj45([26, 17, 32]),
    { kind: 'cyl', mat: DARK, r: 6, h: 10, seg: 14, rot: [90, 0, 0], at: [0, 17, -32] },
    { kind: 'cyl', mat: { color: '#2B2E33', rough: 0.4, density: 1.2, emissive: '#3DD68C', emissiveIntensity: 0.5 }, r: 2, h: 1.5, seg: 12, rot: [90, 0, 0], at: [50, 26, 31], noCollide: true },
  ],
  ports: () => [
    ...mainsPorts([0, 10, -34], [0, 0, -1], '', [10, 0, 0]),
    { id: 'datain', label: 'Data in', kind: 'electrical', pos: [-26, 17, 38], dir: [0, 0, 1], role: 'io', imax: 0.6, solderable: false },
    { id: 'dataout', label: 'Data out', kind: 'electrical', pos: [26, 24, 38], dir: [0, 0, 1], role: 'io', imax: 0.6, solderable: false },
    ...poePorts([26, 10, 38], [0, 0, 1]),
  ],
  electrical: {
    devices: (p) => {
      const cls = POE[str(p, 'poe', 'at')] ?? POE.at
      const v = volts(p)
      return [
        // The 48 V rail it puts on the pair, with the output impedance of a
        // small flyback supply behind it.
        { type: 'vsource', v: 48, a: 'poe', b: 'poen', rint: 1.2 },
        // Data goes straight through a midspan untouched, bar the two
        // terminations it passes.
        { type: 'resistor', a: 'datain', b: 'dataout', r: 0.08 },
        { type: 'resistor', a: 'l', b: 'n', r: (v * v) / (cls.source / 0.85) },
        { type: 'resistor', a: 'e', b: 'n', r: 2e6 },
      ]
    },
    supplies: ['poe'],
    limits: { vmax: 400 },
  },
  mass: () => 190,
  price: (p) => (str(p, 'poe', 'at') === 'bt' ? 46 : str(p, 'poe', 'at') === 'at' ? 24 : 15),
  readouts: (p) => {
    const cls = POE[str(p, 'poe', 'at')] ?? POE.at
    return [
      { label: 'Puts out', value: `${cls.source} W at 48 V` },
      { label: 'Arrives', value: `${cls.device} W after 100 m of cable` },
      { label: 'From the wall', value: amps(p, cls.source / 0.85) },
      { label: 'Data', value: bool(p, 'gigabit', true) ? 'Gigabit through' : '100 Mb only, it caps what is behind it' },
    ]
  },
}

/* ================================================================== */
/* Storage and the way in                                              */
/* ================================================================== */

const nas: PartDef = {
  id: 'nas-enclosure',
  name: 'NAS',
  category: 'network',
  blurb: 'Bays, parity, and a spin-up surge the supply has to carry',
  tags: ['nas', 'network storage', 'synology', 'raid', 'drives', 'server', 'backup', 'storage', 'hdd'],
  doc: {
    price: 480,
    description:
      'Two sums come out of this and both are the reason it is parametric.\n\nUsable capacity is not the sum of the drives. In a mirror it is half; in single parity it is all but one drive; in double parity all but two. People buy four 8 TB drives expecting 32 TB and get 24.\n\nThe surge is the one that bites. A spinning drive takes about 25 W for the two seconds it gets up to speed, against 6 W running, so four drives starting together want 100 W out of a 90 W supply. Staggered spin-up is the fix and the setting that turns it off is in the menu.',
  },
  params: [
    REGION_PARAM,
    { key: 'bays', label: 'Bays', type: 'number', unit: '', default: 4, min: 1, max: 12, step: 1, group: 'NAS' },
    { key: 'size', label: 'Drive size', type: 'enum', default: '8', group: 'NAS', options: ['4', '8', '12', '16', '20', '24'].map((v) => ({ value: v, label: `${v} TB` })) },
    {
      key: 'media', label: 'Drive type', type: 'enum', default: 'hdd', group: 'NAS',
      options: [{ value: 'hdd', label: 'Spinning, 7200 rpm' }, { value: 'ssd', label: 'SATA SSD' }],
    },
    {
      key: 'raid', label: 'Redundancy', type: 'enum', default: 'single', group: 'NAS',
      options: [
        { value: 'none', label: 'None, all of it' },
        { value: 'mirror', label: 'Mirror, half of it' },
        { value: 'single', label: 'Single parity, one drive back' },
        { value: 'double', label: 'Double parity, two drives back' },
      ],
    },
    {
      key: 'state', label: 'State', type: 'enum', default: 'idle', group: 'Control',
      options: [{ value: 'sleep', label: 'Drives spun down' }, { value: 'idle', label: 'Idle' }, { value: 'busy', label: 'Rebuilding' }, { value: 'spinup', label: 'Spinning up, all at once' }],
    },
  ],
  solids: (p) => {
    const bays = Math.round(num(p, 'bays', 4))
    const cols = bays <= 4 ? bays : Math.ceil(bays / 2)
    const rows = bays <= 4 ? 1 : 2
    const w = 30 + cols * 32
    const h = 60 + rows * 120
    const d = 230
    const out: Solid[] = [
      { kind: 'box', mat: { color: '#1A1C1F', rough: 0.6, density: 1.6 }, size: [w, h, d], at: [0, h / 2, 0], bevel: 5 },
    ]
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        if (r * cols + c >= bays) break
        const x = (c - (cols - 1) / 2) * 32
        const y = h - 40 - r * 120 - 55
        out.push({ kind: 'box', mat: { color: '#2A2D31', rough: 0.5, density: 1.4 }, size: [28, 110, 6], at: [x, y, d / 2 + 1], bevel: 1.5 })
        out.push({ kind: 'box', mat: DRIVE, size: [24, 100, 16], at: [x, y, d / 2 - 12], noCollide: true })
        out.push({
          kind: 'cyl',
          mat: { color: '#2B2E33', rough: 0.4, density: 1.2, emissive: str(p, 'state', 'idle') === 'sleep' ? '#1A2A1E' : '#3DD68C', emissiveIntensity: str(p, 'state', 'idle') === 'sleep' ? 0.1 : 0.6 },
          r: 1.6, h: 1.5, seg: 10, rot: [90, 0, 0], at: [x, y - 60, d / 2 + 4], noCollide: true,
        })
      }
    }
    // The fan on the back, which is the whole back.
    out.push({ kind: 'cyl', mat: DARK, r: Math.min(w, h) * 0.32, h: 24, seg: 26, rot: [90, 0, 0], at: [0, h * 0.5, -d / 2 + 14] })
    out.push({ kind: 'box', mat: PCB_GREEN, size: [w - 20, 4, 140], at: [0, 14, -20], noCollide: true })
    return out
  },
  ports: (p) => {
    const bays = Math.round(num(p, 'bays', 4))
    const cols = bays <= 4 ? bays : Math.ceil(bays / 2)
    const w = 30 + cols * 32
    const rows = bays <= 4 ? 1 : 2
    const h = 60 + rows * 120
    return [
      ...mainsPorts([-w / 4, 30, -118], [0, 0, -1], '', [10, 0, 0]),
      ...lanPorts(2, [w / 4, 30, -118], [0, 0, -1], 18),
      ...signalPorts([['usb', 'USB 3 back']], [0, h - 30, -118], [0, 0, -1], 18),
      { id: 'floor', label: 'Shelf', kind: 'mechanical', pos: [0, 0, 0], dir: [0, -1, 0], mate: { type: 'face' } },
    ]
  },
  electrical: load((p) => {
    const bays = Math.round(num(p, 'bays', 4))
    const ssd = str(p, 'media', 'hdd') === 'ssd'
    const idle = ssd ? 2 : 6
    const busy = ssd ? 3.5 : 9.5
    const base = 14
    switch (str(p, 'state', 'idle')) {
      case 'sleep': return base * 0.5 + bays * (ssd ? 0.6 : 0.8)
      case 'busy': return base + bays * busy
      case 'spinup': return base + bays * (ssd ? 4 : 25)
      default: return base + bays * idle
    }
  }),
  mass: (p) => {
    const bays = Math.round(num(p, 'bays', 4))
    return 1800 + bays * (str(p, 'media', 'hdd') === 'ssd' ? 90 : 640)
  },
  price: (p) => {
    const bays = Math.round(num(p, 'bays', 4))
    const tb = parseInt(str(p, 'size', '8'), 10) || 8
    const perDrive = str(p, 'media', 'hdd') === 'ssd' ? tb * 70 : 18 + tb * 18
    return 180 + bays * 70 + bays * perDrive
  },
  readouts: (p) => {
    const bays = Math.round(num(p, 'bays', 4))
    const tb = parseInt(str(p, 'size', '8'), 10) || 8
    const raid = str(p, 'raid', 'single')
    const back = raid === 'none' ? 0 : raid === 'mirror' ? Math.floor(bays / 2) : raid === 'single' ? 1 : 2
    const usable = Math.max(0, bays - back) * tb
    const ssd = str(p, 'media', 'hdd') === 'ssd'
    const surge = 14 + bays * (ssd ? 4 : 25)
    return [
      { label: 'Raw', value: `${bays * tb} TB in ${bays} bays` },
      { label: 'Usable', value: `${usable} TB, ${back} drive${back === 1 ? '' : 's'} given to parity` },
      { label: 'Survives', value: back === 0 ? 'No failures' : `${back} drive failure${back === 1 ? '' : 's'}` },
      { label: 'Spin-up surge', value: `${surge} W, ${amps(p, surge)}` },
      { label: 'Supply needs', value: `${Math.ceil((surge * 1.2) / 10) * 10} W to start them together` },
    ]
  },
}

const ont: PartDef = {
  id: 'ont-fibre',
  name: 'Fibre ONT',
  category: 'network',
  blurb: 'Where the fibre stops and the copper starts',
  tags: ['ont', 'fibre', 'fiber', 'modem', 'optical', 'gpon', 'xgs-pon', 'isp', 'network', 'broadband'],
  doc: {
    price: 0,
    description:
      'The box the fibre terminates in, which the provider installs and which decides where the router has to be: within a patch lead of a window or a wall penetration, on a socket that is never switched off. It is small, it is in the plan whether or not anyone wanted it there, and the router that follows it is not free to move.',
  },
  params: [
    REGION_PARAM,
    { key: 'pon', label: 'Standard', type: 'enum', default: 'xgs', group: 'ONT', options: [{ value: 'gpon', label: 'GPON, 2.5 Gb down' }, { value: 'xgs', label: 'XGS-PON, 10 Gb symmetric' }] },
    { key: 'service', label: 'Service', type: 'number', unit: '', default: 1000, min: 50, max: 10000, step: 50, group: 'ONT', help: 'The speed sold to you, in megabits, which is a fraction of what the standard carries.' },
    { key: 'battery', label: 'Battery backup', type: 'bool', default: false, group: 'ONT' },
  ],
  solids: (p) => {
    const out: Solid[] = [
      { kind: 'box', mat: { color: '#F0EEE9', rough: 0.5, density: 1.4 }, size: [130, 30, 100], at: [0, 15, 0], bevel: 4 },
      ...rj45([-20, 14, 52]),
      { kind: 'cyl', mat: { color: '#1F8A4C', rough: 0.4, density: 1.3 }, r: 5, h: 12, seg: 14, rot: [90, 0, 0], at: [30, 14, 52] },
      { kind: 'cyl', mat: DARK, r: 5, h: 10, seg: 14, rot: [90, 0, 0], at: [55, 12, -52] },
    ]
    for (let i = 0; i < 4; i++) {
      out.push({
        kind: 'cyl', mat: { color: '#2B2E33', rough: 0.4, density: 1.2, emissive: i === 3 ? '#FFB020' : '#3DD68C', emissiveIntensity: 0.5 },
        r: 1.6, h: 1.4, seg: 10, at: [-50 + i * 10, 30, 20], noCollide: true,
      })
    }
    if (bool(p, 'battery', false)) out.push({ kind: 'box', mat: { color: '#E4E2DD', rough: 0.55, density: 1.4 }, size: [130, 46, 100], at: [0, -23, 0], bevel: 4 })
    return out
  },
  ports: () => [
    ...mainsPorts([55, 12, -54], [0, 0, -1], '', [9, 0, 0]),
    { id: 'fibre', label: 'Fibre, SC/APC', kind: 'mechanical', pos: [30, 14, 58], dir: [0, 0, 1], mate: { type: 'hole', size: 2.5 } },
    ...lanPorts(1, [-20, 14, 58], [0, 0, 1], 18, 'lan'),
    { id: 'wall', label: 'Wall', kind: 'mechanical', pos: [0, 0, 0], dir: [0, -1, 0], mate: { type: 'face' } },
  ],
  electrical: load((p) => (str(p, 'pon', 'xgs') === 'xgs' ? 9 : 6) + (bool(p, 'battery', false) ? 1.5 : 0)),
  mass: (p) => (bool(p, 'battery', false) ? 1100 : 320),
  price: (p) => (bool(p, 'battery', false) ? 80 : 0),
  readouts: (p) => {
    const svc = num(p, 'service', 1000)
    const line = str(p, 'pon', 'xgs') === 'xgs' ? 10000 : 2488
    const w = (str(p, 'pon', 'xgs') === 'xgs' ? 9 : 6) + (bool(p, 'battery', false) ? 1.5 : 0)
    return [
      { label: 'Service', value: `${svc >= 1000 ? `${(svc / 1000).toFixed(svc % 1000 ? 1 : 0)} Gb` : `${svc} Mb`}` },
      { label: 'Of the line', value: `${Math.round((svc / line) * 100)}% of ${(line / 1000).toFixed(1)} Gb` },
      { label: 'Needs the router within', value: 'a patch lead of here' },
      { label: 'Drawing', value: `${w.toFixed(1)} W, ${amps(p, w)}` },
    ]
  },
}

registerParts([rack, patchPanel, accessPoint, poeInjector, nas, ont])
