import type { PartDef, Port, SilkItem, Solid, Vec2 } from '../kernel/types'
import { registerParts } from '../kernel/registry'
import { circle, num, roundRect, str } from './_helpers'
import { CPU_OPTIONS, GPU_OPTIONS, cpuSpec, gpuSpec, recommendedPsu } from './pc_models'

/**
 * Computer hardware.
 *
 * A PC is the same problem this whole thing exists for: parts that either go
 * together or do not, and a power budget you find out about after you have
 * paid. So the sockets are keyed, the slots are keyed, and the supply is a real
 * multi-rail source that the components load. Whether the build boots is a
 * question the rule checker answers rather than one you take on trust.
 *
 * Dimensions are the standards: ATX is 305 by 244, its mounting holes are on
 * the grid every case is drilled for, and a DIMM is 133.35 long.
 */

const FR4 = { color: '#0D1B14', rough: 0.5, clearcoat: 0.15, density: 1.85 }
const FR4_BLUE = { color: '#12233F', rough: 0.5, clearcoat: 0.15, density: 1.85 }
const ALU = { color: '#B7BCC3', metal: 1, rough: 0.34, density: 2.7 }
const ALU_DARK = { color: '#3A4048', metal: 0.9, rough: 0.42, density: 2.7 }
const STEEL = { color: '#A8AEB6', metal: 1, rough: 0.3, density: 7.85 }
const PLASTIC = { color: '#15181C', rough: 0.6, density: 1.3 }
const GOLD = 'gold'

/* ================================================================== */
/* Motherboard                                                         */
/* ================================================================== */

interface FormFactor {
  w: number
  d: number
  label: string
  dimms: number
  pcie: number
  m2: number
}

const FORM: Record<string, FormFactor> = {
  atx: { w: 305, d: 244, label: 'ATX', dimms: 4, pcie: 3, m2: 3 },
  matx: { w: 244, d: 244, label: 'Micro ATX', dimms: 4, pcie: 2, m2: 2 },
  itx: { w: 170, d: 170, label: 'Mini ITX', dimms: 2, pcie: 1, m2: 1 },
}

const SOCKETS = [
  { value: 'AM5', label: 'AM5 (Ryzen 7000 and up)' },
  { value: 'AM4', label: 'AM4 (Ryzen 1000 to 5000)' },
  { value: 'LGA1700', label: 'LGA1700 (Intel 12th to 14th)' },
  { value: 'LGA1851', label: 'LGA1851 (Intel Core Ultra)' },
]

/** Memory standard that goes with a socket, since they are not free choices. */
const SOCKET_MEMORY: Record<string, string> = {
  AM5: 'DDR5',
  AM4: 'DDR4',
  LGA1700: 'DDR5',
  LGA1851: 'DDR5',
}

/**
 * The ATX mounting grid.
 *
 * Measured from the top-left of the board as the standard defines it, which is
 * why these are not symmetric. A case drilled to this pattern takes any board
 * that uses a subset of it, which is exactly why micro ATX drops into an ATX
 * case.
 */
const ATX_HOLES: Vec2[] = [
  [10.16, 10.16], [10.16, 106.68], [10.16, 233.68],
  [107.95, 10.16], [107.95, 106.68], [107.95, 233.68],
  [200.66, 10.16], [200.66, 106.68], [200.66, 233.68],
]

/** Only the holes that fall inside this board, in centred coordinates. */
function boardHoles(f: FormFactor): Vec2[] {
  return ATX_HOLES.filter(([x, z]) => x <= f.w - 8 && z <= f.d - 8).map(
    ([x, z]): Vec2 => [x - f.w / 2, z - f.d / 2],
  )
}

/** The rear panel stack: the ports people actually plug things into. */
const REAR_PORTS: { id: string; label: string; w: number; h: number; colour: string; row: 0 | 1 }[] = [
  { id: 'usb-c1', label: 'USB-C', w: 9.6, h: 3.6, colour: '#1B1E24', row: 1 },
  { id: 'usb-c2', label: 'USB-C', w: 9.6, h: 3.6, colour: '#1B1E24', row: 0 },
  { id: 'usb-a1', label: 'USB 3.2', w: 14.5, h: 7, colour: '#1F4FA8', row: 1 },
  { id: 'usb-a2', label: 'USB 3.2', w: 14.5, h: 7, colour: '#1F4FA8', row: 0 },
  { id: 'usb-a3', label: 'USB 2.0', w: 14.5, h: 7, colour: '#15181C', row: 1 },
  { id: 'usb-a4', label: 'USB 2.0', w: 14.5, h: 7, colour: '#15181C', row: 0 },
  { id: 'hdmi', label: 'HDMI', w: 15.6, h: 5.8, colour: '#1B1E24', row: 1 },
  { id: 'dp', label: 'DisplayPort', w: 17, h: 6.6, colour: '#1B1E24', row: 0 },
  { id: 'lan', label: 'Ethernet', w: 16, h: 13.6, colour: '#15181C', row: 1 },
  { id: 'audio1', label: 'Line out', w: 6.6, h: 6.6, colour: '#3DA35D', row: 1 },
  { id: 'audio2', label: 'Mic in', w: 6.6, h: 6.6, colour: '#E0679A', row: 0 },
]

const motherboard: PartDef = {
  id: 'motherboard',
  name: 'Motherboard',
  category: 'mainboard',
  blurb: 'ATX, micro ATX or mini ITX, with the full rear panel',
  tags: ['motherboard', 'mainboard', 'mobo', 'atx', 'matx', 'itx', 'am5', 'lga1700', 'pc', 'computer', 'socket'],
  doc: {
    price: 180,
    description:
      'A motherboard in the standard form factors. The socket, the memory slots and the expansion slots are keyed, so a part that would not physically fit will not go in here either. Mounting holes follow the ATX grid.',
  },
  params: [
    { key: 'form', label: 'Form factor', type: 'enum', default: 'atx', group: 'Board', options: [
      { value: 'atx', label: 'ATX, 305 x 244' }, { value: 'matx', label: 'Micro ATX, 244 x 244' }, { value: 'itx', label: 'Mini ITX, 170 x 170' },
    ] },
    { key: 'socket', label: 'CPU socket', type: 'enum', default: 'AM5', group: 'Board', options: SOCKETS },
    { key: 'mask', label: 'Board colour', type: 'enum', default: 'black', group: 'Board', options: [
      { value: 'black', label: 'Black' }, { value: 'blue', label: 'Blue' },
    ] },
  ],
  solids: (p) => {
    const f = FORM[str(p, 'form', 'atx')] ?? FORM.atx
    const mem = SOCKET_MEMORY[str(p, 'socket', 'AM5')] ?? 'DDR5'
    const T = 1.6
    const mask = str(p, 'mask', 'black') === 'blue' ? FR4_BLUE : FR4
    const holes = boardHoles(f).map(([x, z]) => circle(1.7, x, z, 12))

    const out: Solid[] = [
      {
        kind: 'extrude', mat: mask, profile: { outline: roundRect(f.w, f.d, 3, 0, 0, 4), holes },
        depth: T, rot: [-90, 0, 0], at: [0, T / 2, 0],
      },
    ]

    /* --- rear I/O stack --- */
    const rearZ = -f.d / 2 + 8
    let rx = -f.w / 2 + 16
    for (const port of REAR_PORTS) {
      const y = T + (port.row === 0 ? 3 : 3 + 9)
      out.push({
        kind: 'box', mat: { color: '#8E949C', metal: 1, rough: 0.36, density: 7.8 },
        size: [port.w + 1.4, port.h + 1.4, 12], at: [rx + port.w / 2, y + port.h / 2, rearZ],
        bevel: 0.2,
      })
      out.push({
        kind: 'box', mat: { color: port.colour, rough: 0.75, density: 1.2 },
        size: [port.w, port.h, 2], at: [rx + port.w / 2, y + port.h / 2, rearZ - 5.2], noCollide: true,
      })
      // Rows alternate, so only advance after the lower one.
      if (port.row === 0) rx += port.w + 3.4
    }
    // Shield wall behind the stack.
    out.push({ kind: 'box', mat: STEEL, size: [f.w - 24, 24, 1.2], at: [0, T + 12, -f.d / 2 + 2], noCollide: true })

    /* --- CPU socket --- */
    const sockX = -f.w / 2 + (f.w > 200 ? 86 : 62)
    const sockZ = -f.d / 2 + 62
    out.push(
      { kind: 'box', mat: PLASTIC, size: [45, 3.4, 45], at: [sockX, T + 1.7, sockZ], bevel: 0.5 },
      { kind: 'box', mat: { color: '#2A2E35', rough: 0.5, density: 1.3 }, size: [40, 1.2, 40], at: [sockX, T + 3.4, sockZ], noCollide: true },
      { kind: 'box', mat: STEEL, size: [50, 1.6, 8], at: [sockX, T + 4, sockZ - 24], noCollide: true },
      { kind: 'cyl', mat: STEEL, r: 1.4, h: 26, rot: [0, 0, 90], at: [sockX + 27, T + 4, sockZ - 24], noCollide: true },
    )

    /* --- DIMM slots --- */
    const dimmX = sockX + 62
    for (let i = 0; i < f.dimms; i++) {
      const z = -f.d / 2 + 34 + i * 9.2
      out.push(
        { kind: 'box', mat: { color: i % 2 ? '#2A2E35' : '#1B1E24', rough: 0.55, density: 1.3 }, size: [133.35, 7.4, 5.6], at: [dimmX, T + 3.7, z], bevel: 0.3 },
        { kind: 'box', mat: { color: '#0A0B0D', rough: 0.9, density: 0.01 }, size: [128, 1.6, 3], at: [dimmX, T + 7, z], noCollide: true },
      )
    }

    /* --- PCIe slots --- */
    for (let i = 0; i < f.pcie; i++) {
      const z = f.d / 2 - 60 + i * 20.32
      const long = i === 0
      out.push({
        kind: 'box', mat: { color: long ? '#1B2A4A' : '#1B1E24', rough: 0.55, density: 1.3 },
        size: [long ? 89 : 25, 8.4, 7.2], at: [-f.w / 2 + (long ? 92 : 60), T + 4.2, z], bevel: 0.3,
      })
    }

    /* --- M.2 slots --- */
    for (let i = 0; i < f.m2; i++) {
      const z = f.d / 2 - 44 - i * 22
      out.push({ kind: 'box', mat: ALU_DARK, size: [80, 3, 24], at: [f.w / 2 - 74, T + 1.5, z], bevel: 0.4 })
    }

    /* --- heatsinks, chipset, connectors --- */
    out.push(
      { kind: 'box', mat: ALU_DARK, size: [16, 22, 74], at: [sockX - 32, T + 11, sockZ + 2], bevel: 0.8 },
      { kind: 'box', mat: ALU_DARK, size: [70, 12, 16], at: [sockX + 4, T + 6, -f.d / 2 + 20], bevel: 0.8 },
      { kind: 'box', mat: ALU_DARK, size: [46, 7, 46], at: [f.w / 2 - 64, T + 3.5, f.d / 2 - 40], bevel: 1 },
      // 24-pin ATX and 8-pin EPS.
      { kind: 'box', mat: { color: '#E8E9EB', rough: 0.6, density: 1.3 }, size: [10, 11, 52], at: [f.w / 2 - 8, T + 5.5, -f.d / 2 + 70], bevel: 0.4 },
      { kind: 'box', mat: { color: '#E8E9EB', rough: 0.6, density: 1.3 }, size: [22, 11, 10], at: [sockX + 6, T + 5.5, -f.d / 2 + 6], bevel: 0.4 },
      // SATA ports.
      ...Array.from({ length: 4 }, (_, i): Solid => ({
        kind: 'box', mat: { color: '#1B1E24', rough: 0.6, density: 1.3 },
        size: [8, 6, 15], at: [f.w / 2 - 10, T + 3, f.d / 2 - 30 - i * 8], bevel: 0.2,
      })),
    )

    /* --- silkscreen --- */
    const silk: SilkItem[] = [
      { t: 'text', at: [sockX, -(sockZ - 27)], text: str(p, 'socket', 'AM5'), size: 4, bold: true },
      { t: 'rect', at: [sockX, -sockZ], size: [50, 50], w: 0.4 },
      { t: 'text', at: [dimmX - 56, -(-f.d / 2 + 30)], text: `${mem} DIMM`, size: 3, align: 'left' },
      ...Array.from({ length: f.dimms }, (_, i): SilkItem => ({
        t: 'text', at: [dimmX - 70, -(-f.d / 2 + 34 + i * 9.2)], text: `${String.fromCharCode(65 + Math.floor(i / 2))}${(i % 2) + 1}`, size: 2.6, align: 'right',
      })),
      { t: 'text', at: [-f.w / 2 + 40, -(f.d / 2 - 66)], text: 'PCIE X16', size: 3, align: 'left' },
      { t: 'text', at: [f.w / 2 - 74, -(f.d / 2 - 30)], text: 'M.2', size: 3 },
      { t: 'text', at: [f.w / 2 - 20, -(-f.d / 2 + 98)], text: 'ATX 24-PIN', size: 2.6, rot: 90 },
      { t: 'text', at: [f.w / 2 - 60, -(f.d / 2 - 8)], text: FORM[str(p, 'form', 'atx')]?.label ?? 'ATX', size: 4, bold: true, align: 'right' },
      ...boardHoles(f).map((h): SilkItem => ({ t: 'circle', at: [h[0], -h[1]], r: 3.4, w: 0.3 })),
    ]
    out.push({
      kind: 'silk', size: [f.w, f.d], items: silk, mat: 'silkscreen',
      rot: [-90, 0, 0], at: [0, T + 0.02, 0], px: 8, noCollide: true,
    })

    return out
  },
  ports: (p) => {
    const f = FORM[str(p, 'form', 'atx')] ?? FORM.atx
    const socket = str(p, 'socket', 'AM5')
    const mem = SOCKET_MEMORY[socket] ?? 'DDR5'
    const T = 1.6
    const sockX = -f.w / 2 + (f.w > 200 ? 86 : 62)
    const sockZ = -f.d / 2 + 62
    const dimmX = sockX + 62
    const out: Port[] = []

    out.push({
      id: 'socket', label: `${socket} socket`, kind: 'mechanical',
      pos: [sockX, T + 3.4, sockZ], dir: [0, 1, 0], mate: { type: 'socket', key: socket },
    })
    for (let i = 0; i < f.dimms; i++) {
      out.push({
        id: `dimm${i}`, label: `DIMM ${String.fromCharCode(65 + Math.floor(i / 2))}${(i % 2) + 1}`,
        kind: 'mechanical', pos: [dimmX, T + 7.4, -f.d / 2 + 34 + i * 9.2], dir: [0, 1, 0],
        mate: { type: 'dimm', key: mem }, groupId: 'dimm',
      })
    }
    for (let i = 0; i < f.pcie; i++) {
      const long = i === 0
      out.push({
        id: `pcie${i}`, label: long ? 'PCIe x16' : 'PCIe x1', kind: 'mechanical',
        pos: [-f.w / 2 + (long ? 92 : 60), T + 8.4, f.d / 2 - 60 + i * 20.32], dir: [0, 1, 0],
        mate: { type: 'pcie', key: long ? 'x16' : 'x1' },
      })
    }
    for (let i = 0; i < f.m2; i++) {
      out.push({
        id: `m2_${i}`, label: `M.2 slot ${i + 1}`, kind: 'mechanical',
        pos: [f.w / 2 - 74, T + 3, f.d / 2 - 44 - i * 22], dir: [0, 1, 0],
        mate: { type: 'm2', key: 'M' }, groupId: 'm2',
      })
    }
    boardHoles(f).forEach(([x, z], i) => {
      out.push({
        id: `mount${i}`, label: 'Standoff', kind: 'mechanical',
        pos: [x, 0, z], dir: [0, -1, 0], mate: { type: 'standoff', key: 'ATX' }, groupId: 'mounts',
      })
    })

    // Power inputs, which is where the wattage question is settled.
    out.push(
      { id: 'atx24', label: 'ATX 24-pin', kind: 'electrical', pos: [f.w / 2 - 8, T + 11, -f.d / 2 + 70], dir: [0, 1, 0], role: 'power', imax: 25 },
      { id: 'eps', label: 'EPS 8-pin', kind: 'electrical', pos: [sockX + 6, T + 11, -f.d / 2 + 6], dir: [0, 1, 0], role: 'power', imax: 25 },
      { id: 'gnd', label: 'Ground', kind: 'electrical', pos: [f.w / 2 - 8, T + 11, -f.d / 2 + 82], dir: [0, 1, 0], role: 'gnd', imax: 30 },
    )

    // The rear panel, so a build can show what it can be plugged into.
    let rx = -f.w / 2 + 16
    for (const port of REAR_PORTS) {
      const y = T + (port.row === 0 ? 3 : 12) + port.h / 2
      out.push({
        id: port.id, label: port.label, kind: 'mechanical',
        pos: [rx + port.w / 2, y, -f.d / 2 + 2], dir: [0, 0, -1], mate: { type: 'face' },
      })
      if (port.row === 0) rx += port.w + 3.4
    }
    return out
  },
  electrical: {
    devices: () => [
      // Chipset, VRM and everything that is not the CPU: about 30 W at idle.
      { type: 'resistor', r: 4.8, a: 'atx24', b: 'gnd' },
    ],
    limits: { vmax: 13 },
  },
  // A populated board is about a kilo; the solid tree here is a simplification.
  mass: (p) => {
    const f = FORM[str(p, 'form', 'atx')] ?? FORM.atx
    return 380 + (f.w * f.d) / 90
  },
  price: (p) => ({ atx: 200, matx: 150, itx: 190 })[str(p, 'form', 'atx')] ?? 180,
  readouts: (p) => {
    const f = FORM[str(p, 'form', 'atx')] ?? FORM.atx
    const socket = str(p, 'socket', 'AM5')
    return [
      { label: 'Form factor', value: `${f.label}, ${f.w} x ${f.d} mm` },
      { label: 'Socket', value: socket },
      { label: 'Memory', value: `${SOCKET_MEMORY[socket] ?? 'DDR5'}, ${f.dimms} slots` },
      { label: 'Expansion', value: `${f.pcie} PCIe, ${f.m2} M.2` },
      { label: 'Rear panel', value: `${REAR_PORTS.length} ports` },
    ]
  },
}

/* ================================================================== */
/* CPU                                                                 */
/* ================================================================== */

const cpu: PartDef = {
  id: 'cpu',
  name: 'Processor',
  category: 'pc-component',
  blurb: 'Drops into a matching socket, draws its TDP',
  tags: ['cpu', 'processor', 'ryzen', 'intel', 'core', 'am5', 'lga1700', 'chip', 'pc'],
  doc: {
    price: 320,
    description:
      'A desktop processor. It only goes in a socket of the same name, and it loads the supply by its power draw, so the power budget for a build is a real number rather than a guess.',
  },
  params: [
    { key: 'model', label: 'Model', type: 'enum', default: 'r7-7800x3d', group: 'Chip', options: CPU_OPTIONS },
    { key: 'socket', label: 'Socket', type: 'enum', default: 'AM5', group: 'Chip', options: SOCKETS, showIf: (q) => q.model === 'custom' },
    { key: 'cores', label: 'Cores', type: 'number', default: 8, min: 2, max: 64, step: 2, group: 'Chip', showIf: (q) => q.model === 'custom' },
    { key: 'tdp', label: 'Power draw', type: 'number', unit: 'W', default: 105, min: 15, max: 300, step: 5, group: 'Chip', showIf: (q) => q.model === 'custom' },
    { key: 'lid', label: 'Heat spreader', type: 'bool', default: true, group: 'Body' },
  ],
  solids: (p) => {
    const socket = cpuSpec(p).socket
    const amd = socket.startsWith('AM')
    const w = amd ? 40 : 37.5
    const d = amd ? 40 : 45
    const out: Solid[] = [
      { kind: 'box', mat: { color: '#0E1013', rough: 0.42, density: 2.3 }, size: [w, 1.6, d], at: [0, 0.8, 0], bevel: 0.3 },
    ]
    if (p.lid !== false) {
      out.push({
        kind: 'extrude', mat: { color: '#C9CED4', metal: 1, rough: 0.24, density: 8 },
        profile: { outline: roundRect(w - 5, d - 5, amd ? 3 : 1.5, 0, 0, 4) },
        depth: 1.9, rot: [-90, 0, 0], at: [0, 1.6 + 0.95, 0],
      })
      // The notched corners AMD lids have, and Intel's clamp cutouts.
      if (amd) {
        for (const sx of [-1, 1]) {
          for (const sz of [-1, 1]) {
            out.push({
              kind: 'box', mat: { color: '#0E1013', rough: 0.5, density: 2.3 }, size: [7, 2.4, 7],
              at: [(sx * (w - 5)) / 2, 1.6 + 0.95, (sz * (d - 5)) / 2], noCollide: true,
            })
          }
        }
      }
    }
    // Pins or pads on the underside.
    out.push({ kind: 'box', mat: GOLD, size: [w - 6, 0.4, d - 6], at: [0, -0.2, 0], noCollide: true })
    // Pin 1 triangle.
    out.push({ kind: 'cyl', mat: GOLD, r: 1.2, h: 0.3, at: [-w / 2 + 3, 1.75, -d / 2 + 3], seg: 3, noCollide: true })
    return out
  },
  ports: (p) => {
    const spec = cpuSpec(p)
    return [
      {
        id: 'pins', label: `${spec.socket} pins`, kind: 'mechanical',
        pos: [0, 0, 0], dir: [0, -1, 0], mate: { type: 'socket', key: spec.socket },
      },
      { id: 'lid', label: 'Heat spreader', kind: 'mechanical', pos: [0, 3.5, 0], dir: [0, 1, 0], mate: { type: 'face' } },
    ]
  },
  price: (p) => cpuSpec(p).price,
  mass: () => 75,
  readouts: (p) => {
    const spec = cpuSpec(p)
    return [
      { label: 'Socket', value: spec.socket },
      { label: 'Cores and threads', value: `${spec.cores} / ${spec.threads}` },
      { label: 'Power draw', value: `${Math.round(spec.tdp)} W` },
      { label: 'Memory', value: SOCKET_MEMORY[spec.socket] ?? 'DDR5' },
      { label: 'Class', value: spec.tier },
    ]
  },
}

/* ================================================================== */
/* Memory                                                              */
/* ================================================================== */

const ram: PartDef = {
  id: 'ram-dimm',
  name: 'Memory module',
  category: 'pc-component',
  blurb: 'DDR4 or DDR5 DIMM, keyed to its slot',
  tags: ['ram', 'memory', 'dimm', 'ddr4', 'ddr5', 'stick', 'pc', 'module'],
  doc: {
    price: 90,
    description:
      'A desktop DIMM. The notch position is what stops DDR4 going into a DDR5 board, and that is modelled here: the slot and the stick have to name the same standard.',
  },
  params: [
    { key: 'standard', label: 'Standard', type: 'enum', default: 'DDR5', group: 'Module', options: [
      { value: 'DDR4', label: 'DDR4' }, { value: 'DDR5', label: 'DDR5' },
    ] },
    { key: 'capacity', label: 'Capacity', type: 'enum', default: '16', group: 'Module', options: [
      { value: '8', label: '8 GB' }, { value: '16', label: '16 GB' }, { value: '32', label: '32 GB' }, { value: '48', label: '48 GB' },
    ] },
    { key: 'speed', label: 'Speed', type: 'number', unit: 'MT/s', default: 6000, min: 2133, max: 8400, step: 100, group: 'Module' },
    { key: 'heatspreader', label: 'Heat spreader', type: 'bool', default: true, group: 'Body' },
  ],
  solids: (p) => {
    const ddr5 = str(p, 'standard', 'DDR5') === 'DDR5'
    const len = 133.35
    const pcbH = 31.25
    const tall = p.heatspreader !== false
    const h = tall ? 40 : pcbH
    // The key notch: off-centre, and in a different place for each standard.
    const notchX = ddr5 ? -len / 2 + 62 : -len / 2 + 74
    const out: Solid[] = [
      { kind: 'box', mat: FR4, size: [len, pcbH, 1.2], at: [0, pcbH / 2, 0] },
      { kind: 'box', mat: { color: '#0A0B0D', rough: 0.9, density: 0.01 }, size: [1.4, 5, 1.4], at: [notchX, 2.5, 0], noCollide: true },
      // Contact fingers along the bottom edge.
      { kind: 'box', mat: GOLD, size: [len - 8, 3.2, 1.3], at: [0, 1.6, 0], noCollide: true },
    ]
    // Chips.
    for (let i = 0; i < 8; i++) {
      out.push({
        kind: 'box', mat: { color: '#16181C', rough: 0.5, density: 1.9 },
        size: [12, 9, 1], at: [-len / 2 + 12 + i * 15, 16, 1.2], noCollide: true,
      })
    }
    if (tall) {
      out.push({
        kind: 'box', mat: { color: '#232830', metal: 0.8, rough: 0.4, density: 2.7 },
        size: [len - 2, h - 3, 4.6], at: [0, h / 2 - 1, 0], bevel: 0.6,
      })
      // The light bar these all seem to have.
      out.push({
        kind: 'box', mat: { color: '#E8ECF2', rough: 0.3, opacity: 0.85, transmission: 0.4, density: 1.2 },
        size: [len - 20, 3, 4.8], at: [0, h - 3, 0], noCollide: true,
      })
    }
    return out
  },
  ports: (p) => [
    {
      id: 'edge', label: `${str(p, 'standard', 'DDR5')} edge`, kind: 'mechanical',
      pos: [0, 0, 0], dir: [0, -1, 0], mate: { type: 'dimm', key: str(p, 'standard', 'DDR5') },
    },
  ],
  mass: () => 45,
  price: (p) => ({ '8': 30, '16': 55, '32': 100, '48': 160 })[str(p, 'capacity', '16')] ?? 55,
  readouts: (p) => [
    { label: 'Standard', value: str(p, 'standard', 'DDR5') },
    { label: 'Capacity', value: `${str(p, 'capacity', '16')} GB` },
    { label: 'Speed', value: `${Math.round(num(p, 'speed', 6000))} MT/s` },
    { label: 'Power draw', value: str(p, 'standard', 'DDR5') === 'DDR5' ? '5 W' : '3 W' },
  ],
}

/* ================================================================== */
/* Graphics card                                                       */
/* ================================================================== */

const gpu: PartDef = {
  id: 'graphics-card',
  name: 'Graphics card',
  category: 'pc-component',
  blurb: 'PCIe x16, and the thing that decides your PSU',
  tags: ['gpu', 'graphics', 'video', 'card', 'pcie', 'nvidia', 'radeon', 'geforce', 'pc'],
  doc: {
    price: 600,
    description:
      'A PCIe graphics card. Length and slot height are what decide whether it fits a case, and its power draw is usually what decides the supply, so both are parameters here.',
  },
  params: [
    { key: 'model', label: 'Model', type: 'enum', default: 'rtx-4070s', group: 'Card', options: GPU_OPTIONS },
    { key: 'lit', label: 'Lit edge', type: 'bool', default: true, group: 'Card' },
    { key: 'length', label: 'Length', type: 'number', unit: 'mm', default: 304, min: 170, max: 400, step: 2, group: 'Card', showIf: (q) => q.model === 'custom' },
    { key: 'slots', label: 'Slots', type: 'number', default: 3, min: 1, max: 4, step: 1, group: 'Card', showIf: (q) => q.model === 'custom' },
    { key: 'tdp', label: 'Power draw', type: 'number', unit: 'W', default: 285, min: 30, max: 600, step: 5, group: 'Card', showIf: (q) => q.model === 'custom' },
    { key: 'connector', label: 'Power connector', type: 'enum', default: '2x8', group: 'Card', showIf: (q) => q.model === 'custom', options: [
      { value: 'none', label: 'Slot power only' }, { value: '1x8', label: 'One 8-pin' }, { value: '2x8', label: 'Two 8-pin' }, { value: '12vhpwr', label: '12VHPWR' },
    ] },
  ],
  solids: (p) => {
    const spec = gpuSpec(p)
    const len = spec.length
    const slots = spec.slots
    const thick = slots * 20.32 - 6
    // The card lies in the board's plane: length along x, the 112 mm dimension
    // across in z, and the slot thickness standing up in y. Built the other way
    // it looks right only in a tower and wrong on a bench.
    const across = 112
    const out: Solid[] = [
      { kind: 'box', mat: FR4, size: [len - 20, 1.6, across - 30], at: [10, 0.8, 0] },
      { kind: 'box', mat: { color: '#1C1F25', rough: 0.5, density: 1.4 }, size: [len - 24, thick - 4, across - 24], at: [8, 1.6 + (thick - 4) / 2, 0], bevel: 1.4 },
      // Fans, as many as the length has room for.
      ...(() => {
        const n = Math.max(2, Math.round(len / 130))
        const r = Math.min(42, (len - 40) / (n * 2.1))
        return Array.from({ length: n }, (_, i): Solid => ({
          kind: 'cyl', mat: { color: '#0E1013', rough: 0.65, density: 1.2 },
          r, h: 3,
          at: [-len / 2 + 40 + (i * (len - 70)) / Math.max(1, n - 1), thick - 1, 0],
        }))
      })(),
      // Edge connector, hanging below the card into the slot.
      { kind: 'box', mat: FR4, size: [89, 7, 6], at: [-len / 2 + 60, -3.5, 0] },
      { kind: 'box', mat: GOLD, size: [85, 5, 6.2], at: [-len / 2 + 60, -4.5, 0], noCollide: true },
      // Slot bracket at the rear end, standing across the card.
      { kind: 'box', mat: STEEL, size: [2, thick + 8, across], at: [-len / 2 + 4, thick / 2, 0], bevel: 0.4 },
      { kind: 'box', mat: STEEL, size: [16, 2, across], at: [-len / 2 - 3, thick + 3, 0], noCollide: true },
      // Display outputs on the bracket.
      ...Array.from({ length: 3 }, (_, i): Solid => ({
        kind: 'box', mat: { color: '#15181C', rough: 0.7, density: 1.2 },
        size: [3, 7, 17], at: [-len / 2 + 3, thick / 2, -across / 2 + 22 + i * 24], noCollide: true,
      })),
    ]
    const conn = spec.connector
    if (conn !== 'none') {
      const n = conn === '2x8' ? 2 : 1
      const w = conn === '12vhpwr' ? 22 : 20
      for (let i = 0; i < n; i++) {
        out.push({
          kind: 'box', mat: { color: '#1B1E24', rough: 0.6, density: 1.3 },
          size: [w, 8, 12], at: [len / 2 - 40 - i * 24, thick + 2, -across / 2 + 14], bevel: 0.3,
        })
      }
    }
    if (p.lit !== false) {
      // The lit strip along the top edge, which is most of what a gaming card
      // is doing when it is not rendering anything.
      out.push({
        kind: 'box',
        mat: { color: '#C6D4EA', rough: 0.25, emissive: '#3C7BDC', emissiveIntensity: 0.6, density: 1.2 },
        size: [len * 0.44, 2.4, 3], at: [len * 0.06, thick + 0.6, across / 2 - 6], noCollide: true,
      })
    }
    return out
  },
  ports: (p) => {
    const spec = gpuSpec(p)
    const len = spec.length
    const thick = spec.slots * 20.32 - 6
    const across = 112
    const conn = spec.connector
    const out: Port[] = [
      { id: 'edge', label: 'PCIe x16 edge', kind: 'mechanical', pos: [-len / 2 + 60, -7, 0], dir: [0, -1, 0], mate: { type: 'pcie', key: 'x16' } },
      { id: 'bracket', label: 'Slot bracket', kind: 'mechanical', pos: [-len / 2 + 4, thick + 4, 0], dir: [0, 1, 0], mate: { type: 'face' } },
    ]
    if (conn !== 'none') {
      const n = conn === '2x8' ? 2 : 1
      for (let i = 0; i < n; i++) {
        out.push({
          id: `pwr${i}`, label: conn === '12vhpwr' ? '12VHPWR' : 'PCIe 8-pin',
          kind: 'electrical', pos: [len / 2 - 40 - i * 24, thick + 6, -across / 2 + 14], dir: [0, 1, 0],
          role: 'power', imax: 25, groupId: 'gpu-power',
        })
      }
      out.push({ id: 'gnd', label: 'Ground', kind: 'electrical', pos: [len / 2 - 52 - (n - 1) * 24, thick + 6, -across / 2 + 14], dir: [0, 1, 0], role: 'gnd', imax: 30 })
    }
    return out
  },
  electrical: {
    devices: (p) => {
      const spec = gpuSpec(p)
      if (spec.connector === 'none') return []
      // Load the 12 V rail by the card's draw. 75 W of it comes from the slot
      // on a real board, so only the rest is asked of the cables.
      const watts = Math.max(0, spec.tdp - 75)
      const r = watts > 0 ? (12 * 12) / watts : 1e6
      return [{ type: 'resistor', r, a: 'pwr0', b: 'gnd' }]
    },
    limits: { vmax: 13 },
  },
  price: (p) => gpuSpec(p).price,
  // A card is mostly heatsink and air, not the solid slab the shroud implies.
  mass: (p) => 700 + gpuSpec(p).slots * 320,
  readouts: (p) => {
    const spec = gpuSpec(p)
    return [
      { label: 'Memory', value: `${spec.vram} GB` },
      { label: 'Good for', value: spec.target },
      { label: 'Length', value: `${Math.round(spec.length)} mm, ${spec.slots} slots` },
      { label: 'Power draw', value: `${Math.round(spec.tdp)} W` },
      { label: 'Recommended supply', value: `${recommendedPsu(spec.tdp, 120)} W` },
    ]
  },
}

registerParts([motherboard, cpu, ram, gpu])

export const PC_CORE_PARTS = [motherboard, cpu, ram, gpu]
export { FORM, SOCKETS, SOCKET_MEMORY, FR4, ALU, ALU_DARK, STEEL, PLASTIC, GOLD }
