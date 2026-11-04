import type { PartDef, Solid, Vec3 } from '../kernel/types'
import { registerParts } from '../kernel/registry'
import { bool, num, str } from './_helpers'
import { ALU, REGION_PARAM, STEEL, amps, dutyWatts, load, mainsPorts, screen, volts } from './setup'
import { SOFT, signalPorts } from './setup2'

/**
 * The rest of the room.
 *
 * `setup.ts` is the mains and `setup2.ts` is the screens and the computers.
 * What was left out is everything that is neither a circuit nor a screen and
 * is nevertheless in every photograph of a desk: the chair, the keyboard, the
 * lamp, the speakers, the controller, the switch the ethernet goes into, and
 * the bracket a television hangs off.
 *
 * The test each one had to pass to be in here is that it changes an answer.
 * A chair is in because its seat height against the desk height is the
 * commonest thing wrong with a setup, and because its base sweeps a circle
 * that either fits between the desk and the wall or does not. A lamp is in
 * because an LED one draws 9 W and a filament one draws 60 W and that is a
 * seventh of a socket. A network switch is in because eight ports is eight
 * cable runs that have to reach. Nothing is in here to make the library look
 * fuller.
 *
 * Conventions are the two files above: three mains ports named l, n and e,
 * loads sized in watts, signal ports that carry no current and exist for
 * reach and for the bill of materials, and everything authored standing on
 * its own footprint at y = 0 facing +z.
 */

const FABRIC = { color: '#30343B', rough: 0.92, density: 0.4 }
const FOAM = { color: '#3A3F47', rough: 0.95, density: 0.08 }
const KEYCAP = { color: '#23262B', rough: 0.72, density: 1.1 }

/* ================================================================== */
/* The chair                                                           */
/* ================================================================== */

const taskChair: PartDef = {
  id: 'chair-task',
  /*
   * Two scans, one part, because they are the same object answering the same
   * question in two shapes. Both are photoscans of a real chair, so the base
   * sweep and the back height are the ones you would measure.
   */
  model: (p) =>
    str(p, 'style', 'mesh') === 'mesh'
      ? {
          url: 'models/office-chair-mesh.glb',
          fit: 'bbox',
          credit: { title: 'Office Chair', author: 'j.a.m', license: 'CC-BY-4.0', source: 'https://sketchfab.com/3d-models/office-chair-41973aa1808d4a13b84c24497fc77c63' },
        }
      : {
          url: 'models/gaming-chair.glb',
          fit: 'bbox',
          credit: { title: 'Gaming Chair', author: 'Karlos', license: 'CC-BY-4.0', source: 'https://sketchfab.com/3d-models/gaming-chair-free-download-bcb13eb7ef9e4c3c9499aacff6c79757' },
        },
  name: 'Task chair',
  category: 'furniture',
  blurb: 'A seat at a height, on a base that sweeps a circle',
  tags: ['chair', 'office chair', 'gaming chair', 'seat', 'task chair', 'desk', 'furniture', 'room', 'setup', 'ergonomic'],
  doc: {
    price: 240,
    description:
      'The part of a setup that decides whether the rest of it is usable. Two numbers do the work: the seat height, which has to leave your forearms level with the desk top, and the diameter the five-star base sweeps, which has to fit between the desk and whatever is behind you.\n\nA chair is also the one thing here that is sized to a person rather than to a room, so the seat height is a range and not a figure.',
  },
  params: [
    {
      key: 'style', label: 'Style', type: 'enum', default: 'mesh', group: 'Chair',
      options: [{ value: 'mesh', label: 'Mesh task chair' }, { value: 'gaming', label: 'Bucket, high back' }],
    },
    { key: 'seat', label: 'Seat height', type: 'number', unit: 'mm', default: 470, min: 380, max: 560, step: 10, group: 'Chair', help: 'Forearms level with the desk top. For a 740 mm desk that is 440 to 490 for most people.' },
    { key: 'base', label: 'Base diameter', type: 'number', unit: 'mm', default: 680, min: 550, max: 800, step: 10, group: 'Chair' },
    { key: 'arms', label: 'Armrests', type: 'bool', default: true, group: 'Chair', help: 'Armrests decide whether the chair goes under the desk or stops at it.' },
    { key: 'armHeight', label: 'Armrest height', type: 'number', unit: 'mm', default: 650, min: 550, max: 780, step: 10, group: 'Chair' },
  ],
  solids: (p) => {
    const seat = num(p, 'seat', 470)
    const base = num(p, 'base', 680)
    const gaming = str(p, 'style', 'mesh') === 'gaming'
    const backH = gaming ? 760 : 560
    const seatW = gaming ? 540 : 500
    const seatD = 480
    const out: Solid[] = [
      // Five arms of the base, drawn as one disc because what matters is the
      // circle it sweeps, not the five spokes inside it.
      { kind: 'cyl', mat: { color: '#1C1F24', rough: 0.7, density: 1.3 }, r: base / 2, h: 26, seg: 40, at: [0, 13, 0] },
      { kind: 'cyl', mat: STEEL, r: 30, h: seat - 90, seg: 24, at: [0, (seat - 90) / 2 + 26, 0] },
      { kind: 'box', mat: FOAM, size: [seatW, 90, seatD], at: [0, seat - 45, 0], bevel: 24 },
      { kind: 'box', mat: FABRIC, size: [gaming ? 520 : 460, backH, 80], at: [0, seat + backH / 2, -seatD / 2 + 40], bevel: gaming ? 40 : 20 },
    ]
    if (bool(p, 'arms', true)) {
      const ah = num(p, 'armHeight', 650)
      for (const sx of [-1, 1] as const) {
        out.push({ kind: 'box', mat: SOFT, size: [60, 24, 240], at: [sx * (seatW / 2 + 20), ah, -20], bevel: 8 })
        out.push({ kind: 'box', mat: { color: '#22252A', rough: 0.6, density: 1.3 }, size: [26, ah - seat, 40], at: [sx * (seatW / 2 + 20), (ah + seat) / 2 - 10, -40] })
      }
    }
    if (gaming) {
      // The headrest, which is the half of the shape people picture.
      out.push({ kind: 'box', mat: SOFT, size: [280, 150, 90], at: [0, seat + backH - 40, -seatD / 2 + 70], bevel: 30 })
    }
    return out
  },
  ports: (p) => {
    const seat = num(p, 'seat', 470)
    return [
      { id: 'seat', label: 'Seat top', kind: 'mechanical', pos: [0, seat, 0], dir: [0, 1, 0], mate: { type: 'face' } },
      { id: 'floor', label: 'Floor', kind: 'mechanical', pos: [0, 0, 0], dir: [0, -1, 0], mate: { type: 'face' } },
    ]
  },
  /* The solids are five boxes and two cylinders; a real chair is a steel
     base, a gas strut, a frame and upholstery, and weighs what it weighs. */
  mass: (p) => (str(p, 'style', 'mesh') === 'gaming' ? 23000 : 15000),
  price: (p) => (str(p, 'style', 'mesh') === 'gaming' ? 320 : 210) + (bool(p, 'arms', true) ? 0 : -25),
  readouts: (p) => {
    const seat = num(p, 'seat', 470)
    const base = num(p, 'base', 680)
    const ah = num(p, 'armHeight', 650)
    return [
      { label: 'Seat height', value: `${seat} mm, ${seat + 180}–${seat + 220} mm elbow` },
      { label: 'Base sweeps', value: `${base} mm circle, so ${(base / 2 + 50).toFixed(0)} mm clear behind the desk` },
      {
        label: 'Under a 740 mm desk',
        value: bool(p, 'arms', true)
          ? ah > 700 ? `No — armrests at ${ah} mm foul the top` : `Yes, ${(715 - ah).toFixed(0)} mm over the armrests`
          : 'Yes, nothing to foul',
      },
    ]
  },
}

/* ================================================================== */
/* The desk                                                            */
/* ================================================================== */

const keyboard: PartDef = {
  id: 'keyboard-desk',
  /*
   * The scan is a compact board with no numpad, so it stands in for the two
   * layouts that have none. Asked for a full-size, the solids draw the
   * numpad the mesh does not have.
   */
  model: (p) =>
    str(p, 'layout', 'tkl') !== 'full'
      ? {
          url: 'models/keyboard-mechanical.glb',
          fit: 'bbox',
          axes: { y: 'fill' },
          credit: { title: 'Mechanical Keyboard - Aesthetic', author: 'M.Reslan', license: 'CC-BY-4.0', source: 'https://sketchfab.com/3d-models/mechanical-keyboard-aesthetic-44bb12d306864e2cb4256a61d4168942' },
        }
      : undefined,
  name: 'Keyboard',
  category: 'computer',
  blurb: 'A layout, and the desk width it costs',
  tags: ['keyboard', 'mechanical', 'tkl', 'sixty percent', 'full size', 'numpad', 'usb', 'desk', 'setup', 'typing'],
  doc: {
    price: 90,
    description:
      'Chosen by layout, and the layout is a decision about desk width. A full-size board is 440 mm and a 60% is 293 mm, and that 147 mm is the difference between a mouse that has room to move and one that does not.',
  },
  params: [
    {
      key: 'layout', label: 'Layout', type: 'enum', default: 'tkl', group: 'Keyboard',
      options: [
        { value: '60', label: '60%, no arrows' },
        { value: '75', label: '75%, arrows' },
        { value: 'tkl', label: 'Tenkeyless' },
        { value: 'full', label: 'Full size' },
      ],
    },
    { key: 'wireless', label: 'Wireless', type: 'bool', default: false, group: 'Keyboard' },
    { key: 'wrist', label: 'Wrist rest', type: 'bool', default: false, group: 'Keyboard' },
    { key: 'backlit', label: 'Backlit', type: 'bool', default: true, group: 'Control' },
  ],
  solids: (p) => {
    const L = str(p, 'layout', 'tkl')
    const W = { '60': 293, '75': 322, tkl: 360, full: 440 }[L] ?? 360
    const D = L === '60' ? 102 : 135
    const lit = bool(p, 'backlit', true)
    const out: Solid[] = [
      { kind: 'box', mat: { color: '#1A1C21', rough: 0.55, density: 1.3 }, size: [W, 22, D], at: [0, 11, 0], bevel: 3 },
      // The keycap field, as one slab: 87 separate caps is 87 solids and the
      // answer to every question here is the same without them.
      {
        kind: 'box',
        mat: lit ? { ...KEYCAP, emissive: '#7FA8E8', emissiveIntensity: 0.3 } : KEYCAP,
        size: [W - 16, 9, D - 20], at: [0, 26, 0], bevel: 1.2,
      },
    ]
    if (bool(p, 'wrist', false)) {
      // Beside the model, not inside it: the scan has no rest, and fitting
      // the board into a box that included one shrank the board.
      out.push({ kind: 'box', mat: FOAM, size: [W, 18, 75], at: [0, 9, D / 2 + 40], bevel: 8, withModel: true })
    }
    return out
  },
  ports: (p) => {
    const L = str(p, 'layout', 'tkl')
    const W = { '60': 293, '75': 322, tkl: 360, full: 440 }[L] ?? 360
    const D = L === '60' ? 102 : 135
    return signalPorts(
      bool(p, 'wireless', false) ? [['usb', 'USB-C charge']] : [['usb', 'USB-C']],
      [-W / 2 + 40, 16, -D / 2 - 2], [0, 0, -1], 18,
    )
  },
  mass: (p) => ({ '60': 580, '75': 700, tkl: 850, full: 1050 }[str(p, 'layout', 'tkl')] ?? 850),
  price: (p) =>
    ({ '60': 70, '75': 85, tkl: 95, full: 110 }[str(p, 'layout', 'tkl')] ?? 95) +
    (bool(p, 'wireless', false) ? 35 : 0) +
    (bool(p, 'wrist', false) ? 20 : 0),
  readouts: (p) => {
    const L = str(p, 'layout', 'tkl')
    const W = { '60': 293, '75': 322, tkl: 360, full: 440 }[L] ?? 360
    const D = L === '60' ? 102 : 135
    return [
      { label: 'Footprint', value: `${W} x ${D}${bool(p, 'wrist', false) ? ' + 75 mm rest' : ''} mm` },
      { label: 'Mouse room on a 1400 desk', value: `${(1400 - W - 60).toFixed(0)} mm to the right` },
      { label: 'Draw', value: bool(p, 'backlit', true) ? '1.8 W over USB' : '0.2 W over USB' },
    ]
  },
}

const deskLamp: PartDef = {
  id: 'desk-lamp',
  /*
   * The scan is a weighted-base lamp with its arm at one reach. It was
   * modelled reaching along +x, so unturned it fitted at a fifth of the
   * part's depth. Its reach is fitted on its own near the modelled one; much
   * shorter or longer and the solids draw the arm where the parameter puts
   * it. A clamp lamp is another object.
   */
  model: (p) =>
    str(p, 'mount', 'base') !== 'base'
      ? undefined
      : {
    url: 'models/desk-lamp.glb',
    fit: 'bbox',
    rot: [0, -90, 0],
    axes: { z: 'fill' },
    // The bulb lights when the lamp is on, as the solids' does.
    paint: bool(p, 'on', true) ? [{ match: '05_-_default', emissive: '#FFD9A0', emissiveIntensity: 2.4 }] : [],
    credit: { title: 'Desk lamp', author: 'KaramellGlass', license: 'CC-BY-4.0', source: 'https://sketchfab.com/3d-models/desk-lamp-7377ec591df04445a1aae370017aaa13' },
        },
  name: 'Desk lamp',
  category: 'furniture',
  blurb: 'Nine watts or sixty, for the same light',
  tags: ['lamp', 'desk lamp', 'light', 'led', 'task light', 'anglepoise', 'desk', 'room', 'setup', 'mains'],
  doc: {
    price: 35,
    description:
      'The cheapest part in the room and the clearest illustration of what this section is for. An LED lamp and a filament lamp put out the same light; one draws 9 W and the other 60 W, and on a socket already carrying a tower and two monitors that difference is the thing that decides whether the lead trips.',
  },
  params: [
    REGION_PARAM,
    {
      key: 'bulb', label: 'Lamp', type: 'enum', default: 'led', group: 'Lamp',
      options: [
        { value: 'led', label: 'LED, 9 W' },
        { value: 'cfl', label: 'Compact fluorescent, 15 W' },
        { value: 'halogen', label: 'Halogen, 35 W' },
        { value: 'incandescent', label: 'Filament, 60 W' },
      ],
    },
    { key: 'mount', label: 'Mount', type: 'enum', default: 'base', group: 'Lamp', options: [{ value: 'base', label: 'Weighted base' }, { value: 'clamp', label: 'Desk clamp' }] },
    { key: 'reach', label: 'Arm reach', type: 'number', unit: 'mm', default: 420, min: 250, max: 700, step: 10, group: 'Lamp' },
    { key: 'on', label: 'On', type: 'bool', default: true, group: 'Control' },
  ],
  solids: (p) => {
    const reach = num(p, 'reach', 420)
    const on = bool(p, 'on', true)
    const out: Solid[] = [
      str(p, 'mount', 'base') === 'base'
        ? { kind: 'cyl', mat: { color: '#23262B', rough: 0.5, density: 3 }, r: 85, h: 22, seg: 36, at: [0, 11, 0] }
        : { kind: 'box', mat: { color: '#23262B', rough: 0.5, density: 3 }, size: [60, 70, 50], at: [0, 35, 0], bevel: 4 },
      { kind: 'cyl', mat: ALU, r: 11, h: reach, seg: 20, at: [0, reach / 2 + 22, 0] },
      { kind: 'cyl', mat: ALU, r: 9, h: reach * 0.62, seg: 20, at: [0, reach + 22, reach * 0.3], rot: [90, 0, 0] },
      // The shade, as a truncated cone, which is the shape a shade is.
      { kind: 'cyl', mat: { color: '#2A2D33', rough: 0.45, density: 2.6 }, r: 60, r2: 34, h: 90, seg: 32, at: [0, reach - 23, reach * 0.6] },
      {
        kind: 'cyl',
        mat: on
          ? { color: '#FFF4DC', rough: 0.2, density: 1, emissive: '#FFD9A0', emissiveIntensity: 2.4 }
          : { color: '#CFCABD', rough: 0.5, density: 1 },
        r: 48, h: 6, seg: 32, at: [0, reach - 66, reach * 0.6],
      },
    ]
    return out
  },
  ports: (p) => mainsPorts([0, 8, str(p, 'mount', 'base') === 'base' ? -80 : -24], [0, 0, -1], '', [10, 0, 0]),
  electrical: load((p) => {
    const w = { led: 9, cfl: 15, halogen: 35, incandescent: 60 }[str(p, 'bulb', 'led')] ?? 9
    return dutyWatts(p, w, 0.2)
  }),
  price: (p) => 24 + (str(p, 'mount', 'base') === 'clamp' ? 8 : 0) + num(p, 'reach', 420) / 60,
  readouts: (p) => {
    const bulb = str(p, 'bulb', 'led')
    const w = { led: 9, cfl: 15, halogen: 35, incandescent: 60 }[bulb] ?? 9
    const lumens = { led: 800, cfl: 800, halogen: 500, incandescent: 800 }[bulb] ?? 800
    const run = dutyWatts(p, w, 0.2)
    return [
      { label: 'Light', value: `${lumens} lm` },
      { label: 'Drawing', value: `${run.toFixed(1)} W, ${amps(p, run)}` },
      { label: 'On one 13 A socket', value: `${Math.floor((13 * volts(p)) / Math.max(w, 1))} of these` },
    ]
  },
}

/* ================================================================== */
/* Sound                                                               */
/* ================================================================== */

const deskSpeakers: PartDef = {
  id: 'speakers-desktop',
  model: () => ({
    url: 'models/speakers-studio.glb',
    fit: 'bbox',
    // A shallower cabinet than a real near-field; its sides stretch to the
    // depth the part declares, which is the number this part is about.
    axes: { z: [0.25, 0.75] },
    credit: { title: 'Studio Monitors', author: 'Kyler Michaelson', license: 'CC-BY-4.0', source: 'https://sketchfab.com/3d-models/studio-monitors-12b3ce23f32a4aa99cd5ba07330bf086' },
  }),
  name: 'Desktop speakers',
  category: 'av',
  blurb: 'A pair, powered, and the desk depth they need behind the screen',
  tags: ['speakers', 'monitors', 'studio monitors', 'audio', 'sound', 'desk', 'av', 'xlr', 'trs', 'powered'],
  doc: {
    price: 260,
    description:
      'A pair of powered near-fields. The part people get wrong is the depth: a 5 inch monitor is about 230 mm front to back, and behind a screen on a 700 mm desk that is most of what is left.\n\nPowered means each cabinet is an appliance with its own flex, so a pair is two more plugs, not one.',
  },
  params: [
    REGION_PARAM,
    {
      key: 'driver', label: 'Driver', type: 'enum', default: '5', group: 'Speakers',
      options: ['3', '5', '6.5', '8'].map((v) => ({ value: v, label: `${v}"` })),
    },
    { key: 'input', label: 'Input', type: 'enum', default: 'trs', group: 'Speakers', options: [{ value: 'trs', label: 'Balanced TRS' }, { value: 'xlr', label: 'XLR' }, { value: 'rca', label: 'RCA' }] },
    { key: 'volume', label: 'Volume', type: 'number', unit: '%', default: 30, min: 0, max: 100, step: 5, group: 'Control' },
    { key: 'on', label: 'On', type: 'bool', default: true, group: 'Control' },
  ],
  solids: (p) => {
    const d = parseFloat(str(p, 'driver', '5')) || 5
    const W = 60 + d * 26
    const H = 120 + d * 36
    const D = 90 + d * 28
    const on = bool(p, 'on', true)
    return [
      { kind: 'box', mat: { color: '#191B1F', rough: 0.68, density: 0.7 }, size: [W, H, D], at: [0, H / 2, 0], bevel: 6 },
      { kind: 'cyl', mat: { color: '#0C0D10', rough: 0.85, density: 1.1 }, r: (d * 25.4) / 2, h: 14, seg: 32, at: [0, H * 0.34, D / 2 + 2], rot: [90, 0, 0] },
      { kind: 'cyl', mat: { color: '#0C0D10', rough: 0.85, density: 1.1 }, r: 14, h: 10, seg: 24, at: [0, H * 0.74, D / 2 + 2], rot: [90, 0, 0] },
      {
        kind: 'box',
        mat: on
          ? { color: '#2B4A2E', rough: 0.4, density: 1.2, emissive: '#53D468', emissiveIntensity: 1.1 }
          : { color: '#24272C', rough: 0.6, density: 1.2 },
        size: [10, 3, 2], at: [0, H * 0.12, D / 2 + 1],
      },
    ]
  },
  ports: (p) => {
    const d = parseFloat(str(p, 'driver', '5')) || 5
    const H = 120 + d * 36
    const D = 90 + d * 28
    return [
      ...mainsPorts([-30, H * 0.18, -D / 2 - 4], [0, 0, -1], '', [12, 0, 0]),
      ...signalPorts([['in', str(p, 'input', 'trs').toUpperCase() + ' in']], [34, H * 0.18, -D / 2 - 4], [0, 0, -1], 18),
    ]
  },
  electrical: load((p) => {
    const d = parseFloat(str(p, 'driver', '5')) || 5
    // Amplifier idle plus what the volume actually asks of it, per cabinet.
    const rated = 12 + d * 9
    return dutyWatts(p, 6 + rated * (num(p, 'volume', 30) / 100), 0.5)
  }),
  price: (p) => {
    const d = parseFloat(str(p, 'driver', '5')) || 5
    return 90 + d * 34 + (str(p, 'input', 'trs') === 'xlr' ? 30 : 0)
  },
  readouts: (p) => {
    const d = parseFloat(str(p, 'driver', '5')) || 5
    const D = 90 + d * 28
    const rated = 12 + d * 9
    const run = dutyWatts(p, 6 + rated * (num(p, 'volume', 30) / 100), 0.5)
    return [
      { label: 'Cabinet', value: `${(60 + d * 26).toFixed(0)} x ${(120 + d * 36).toFixed(0)} x ${D.toFixed(0)} mm` },
      { label: 'Behind a screen on a 700 desk', value: `${(700 - D - 180).toFixed(0)} mm left` },
      { label: 'Drawing, each', value: `${run.toFixed(0)} W, ${amps(p, run)}` },
    ]
  },
}

const headset: PartDef = {
  id: 'headset',
  /* An over-ear scan with no boom: on-ear draws itself, and the boom is
     drawn beside the model when it is fitted. */
  model: (p) =>
    str(p, 'cups', 'over') !== 'over'
      ? undefined
      : {
    url: 'models/headset.glb',
    fit: 'bbox',
    credit: { title: 'Wireless Gaming Headset', author: 'DatSketch', license: 'CC-BY-4.0', source: 'https://sketchfab.com/3d-models/wireless-gaming-headset-3075896c0ab84e23a6f085c300c33805' },
        },
  name: 'Headset',
  category: 'av',
  blurb: 'Grams on your head, and where it lives when it is not',
  tags: ['headset', 'headphones', 'gaming headset', 'audio', 'mic', 'wireless', 'usb', 'desk', 'av'],
  doc: {
    price: 120,
    description:
      'The only part in this section specified in grams, because that is the number you feel. Over 400 g and an hour is a long time.\n\nIt is here mainly because it takes up desk or wall space when it is off your head, and because wireless means a dongle in a USB port that something else wanted.',
  },
  params: [
    { key: 'wireless', label: 'Wireless', type: 'bool', default: true, group: 'Headset' },
    { key: 'cups', label: 'Cup size', type: 'enum', default: 'over', group: 'Headset', options: [{ value: 'on', label: 'On-ear' }, { value: 'over', label: 'Over-ear' }] },
    { key: 'mic', label: 'Boom mic', type: 'bool', default: true, group: 'Headset' },
  ],
  solids: (p) => {
    /*
     * The outline of a real headset, taken from the scan: 177 across the
     * cups, 200 tall, 103 front to back for over-ear. These used to be a
     * guess 216 wide and 157 tall, and the scan, fitted into that, drew at
     * two thirds of its size inside a box it did not fill.
     */
    const over = str(p, 'cups', 'over') === 'over'
    const W = over ? 177 : 158
    const H = over ? 200 : 178
    const cup = over ? 103 : 84
    const out: Solid[] = [
      { kind: 'box', mat: SOFT, size: [W * 0.6, 22, 44], at: [0, H - 11, 0], bevel: 10 },
      { kind: 'box', mat: FOAM, size: [W * 0.48, 16, 34], at: [0, H - 28, 0], bevel: 8 },
    ]
    for (const sx of [-1, 1] as const) {
      out.push({ kind: 'box', mat: SOFT, size: [20, H - cup / 2, 36], at: [sx * (W / 2 - 12), (H + cup / 2) / 2, 0], bevel: 8 })
      out.push({ kind: 'cyl', mat: { color: '#1C1F24', rough: 0.6, density: 1.2 }, r: cup / 2, h: 42, seg: 32, at: [sx * (W / 2 - 21), cup / 2, 0], rot: [0, 0, 90] })
      out.push({ kind: 'cyl', mat: FOAM, r: (cup - 14) / 2, h: 20, seg: 28, at: [sx * (W / 2 - 50), cup / 2, 0], rot: [0, 0, 90] })
    }
    if (bool(p, 'mic', true)) {
      // The boom, off the left cup. The scan has none, so it is drawn with
      // the model rather than left as a setting that changes nothing. A tube
      // from a pivot on the cup's face, so it reads as attached to it.
      const m = { color: '#16181C', rough: 0.7, density: 1.1 }
      const x = -W / 2 + 3
      const tip: Vec3 = [x + 16, cup * 0.2, cup / 2 + 92]
      out.push({ kind: 'cyl', mat: m, r: 9, h: 8, seg: 20, at: [x, cup * 0.42, cup * 0.18], rot: [0, 0, 90], withModel: true })
      out.push({ kind: 'tube', mat: m, r: 3.5, seg: 10, path: [[x - 2, cup * 0.42, cup * 0.18], [x - 2, cup * 0.3, cup / 2 + 20], tip], withModel: true })
      out.push({ kind: 'cyl', mat: { color: '#1F2227', rough: 0.6, density: 1.1 }, r: 8, h: 20, seg: 20, at: [tip[0], tip[1], tip[2] + 8], rot: [90, 0, 0], withModel: true })
    }
    return out
  },
  // On the bottom of the left cup, where the sockets on a headset are.
  ports: (p) => {
    const over = str(p, 'cups', 'over') === 'over'
    const W = over ? 177 : 158
    return signalPorts(
      bool(p, 'wireless', true) ? [['usb', 'USB-C charge'], ['dongle', '2.4 GHz dongle']] : [['jack', '3.5 mm'], ['usb', 'USB-C']],
      [-W / 2 + 21, 2, 0], [0, -1, 0], 14,
    )
  },
  mass: (p) => (str(p, 'cups', 'over') === 'over' ? 320 : 240) + (bool(p, 'wireless', true) ? 70 : 0) + (bool(p, 'mic', true) ? 18 : 0),
  price: (p) => 70 + (bool(p, 'wireless', true) ? 50 : 0) + (str(p, 'cups', 'over') === 'over' ? 20 : 0),
  readouts: (p) => {
    const m = (str(p, 'cups', 'over') === 'over' ? 320 : 240) + (bool(p, 'wireless', true) ? 70 : 0) + (bool(p, 'mic', true) ? 18 : 0)
    return [
      { label: 'On your head', value: `${m} g${m > 400 ? ', which you will feel' : ''}` },
      { label: 'Charge draw', value: bool(p, 'wireless', true) ? '2.5 W over USB, 20 h on a charge' : 'None, it is passive' },
      { label: 'Ports used', value: bool(p, 'wireless', true) ? 'One USB A, for the dongle' : 'One 3.5 mm' },
    ]
  },
}

/* ================================================================== */
/* Computers, the small ones                                           */
/* ================================================================== */

const handheld: PartDef = {
  id: 'console-handheld',
  /*
   * The scan is the console out of its dock, with the controllers on. Docked
   * is a different silhouette — screen hidden, dock in front — so that
   * configuration draws itself.
   */
  model: (p) =>
    !bool(p, 'docked', false)
      ? {
          url: 'models/nintendo-switch.glb',
          fit: 'bbox',
          // Modelled standing on its kickstand and turned 9.3 degrees. The
          // stand is cut from the file and the turn baked out of it; this
          // lays it flat, screen up.
          rot: [-90, 0, 0],
          axes: { y: 'fill' },
          credit: { title: 'Nintendo Switch', author: 'gabriel juan', license: 'CC-BY-4.0', source: 'https://sketchfab.com/3d-models/nintendo-switch-b94e6a6a8c564fee81c2d794da6c5712' },
        }
      : undefined,
  name: 'Handheld console',
  category: 'computer',
  blurb: '239 mm of console that is also a television source',
  tags: ['switch', 'nintendo', 'handheld', 'console', 'dock', 'portable', 'gaming', 'usb-c', 'hdmi', 'tv'],
  doc: {
    price: 300,
    description:
      'A handheld with a dock, which makes it two parts in one: a 239 by 102 mm object on the desk, and an HDMI source at the television when it is in the dock.\n\nThe dock is where the power goes — 39 W over USB-C, which is more than most phone chargers will give it. Undocked it draws nothing from the room at all.',
  },
  params: [
    REGION_PARAM,
    { key: 'docked', label: 'In the dock', type: 'bool', default: false, group: 'Console' },
    { key: 'on', label: 'On', type: 'bool', default: true, group: 'Control' },
    { key: 'load', label: 'Load', type: 'number', unit: '%', default: 60, min: 0, max: 100, step: 5, group: 'Control' },
  ],
  solids: (p) => {
    const docked = bool(p, 'docked', false)
    const on = bool(p, 'on', true)
    // 239 x 102 x 13.9 with the controllers attached; the dock is 173 x 104 x 54.
    const out: Solid[] = []
    if (docked) {
      out.push({ kind: 'box', mat: { color: '#1A1C20', rough: 0.6, density: 1.2 }, size: [173, 104, 54], at: [0, 52, 0], bevel: 5 })
      out.push({ kind: 'box', mat: { color: '#111318', rough: 0.7, density: 1.2 }, size: [120, 14, 20], at: [0, 97, 0] })
      out.push({ kind: 'box', mat: { color: '#1A1C20', rough: 0.6, density: 1.2 }, size: [102, 150, 14], at: [0, 175, 0], bevel: 3 })
      out.push({ kind: 'box', mat: screen(on, '#3E6EA8'), size: [92, 130, 2], at: [0, 175, 8] })
    } else {
      out.push({ kind: 'box', mat: { color: '#1A1C20', rough: 0.6, density: 1.2 }, size: [239, 102, 14], at: [0, 7, 0], bevel: 3, rot: [90, 0, 0] })
      out.push({ kind: 'box', mat: screen(on, '#3E6EA8'), size: [137, 77, 2], at: [0, 15, 0], rot: [90, 0, 0] })
    }
    return out
  },
  ports: (p) =>
    bool(p, 'docked', false)
      ? [
          ...mainsPorts([-30, 18, -30], [0, 0, -1], '', [12, 0, 0]),
          ...signalPorts([['hdmi', 'HDMI out'], ['usb', 'USB']], [36, 18, -30], [0, 0, -1], 20),
        ]
      : signalPorts([['usbc', 'USB-C']], [0, 6, -54], [0, 0, -1], 18),
  mass: (p) => (bool(p, 'docked', false) ? 727 : 398),
  /*
   * Written out rather than borrowed from `load()`.
   *
   * Out of the dock this is not an appliance: no flex, no plug, no mains
   * pins on the part at all. `load()` always puts a resistor across l and n,
   * and a device referencing a terminal the part does not have is a dangling
   * node the solver cannot place. Undocked, the honest device list is empty.
   */
  electrical: {
    devices: (p) => {
      if (!bool(p, 'docked', false)) return []
      const v = volts(p)
      const w = bool(p, 'on', true) ? 7 + 25 * (num(p, 'load', 60) / 100) : 0.3
      return [
        { type: 'resistor', a: 'l', b: 'n', r: (v * v) / w },
        { type: 'resistor', a: 'e', b: 'n', r: 2e6 },
      ]
    },
    limits: { vmax: 400 },
  },
  readouts: (p) => {
    const docked = bool(p, 'docked', false)
    const now = docked ? (bool(p, 'on', true) ? 7 + 25 * (num(p, 'load', 60) / 100) : 0.3) : 0
    return [
      { label: 'Footprint', value: docked ? '173 x 104 mm dock' : '239 x 102 mm on the desk' },
      { label: 'Drawing', value: docked ? `${now.toFixed(0)} W, ${amps(p, now)}` : 'Nothing, it is on its battery' },
      { label: 'Dock supply', value: '39 W USB-C, so not off a phone charger' },
    ]
  },
}

const gamepad: PartDef = {
  id: 'gamepad',
  model: () => ({
    url: 'models/dualsense-controller.glb',
    fit: 'bbox',
    credit: { title: 'DualSense', author: 'johnwilliam', license: 'CC-BY-4.0', source: 'https://sketchfab.com/3d-models/dualsense-42a8cf0910324e93a7e3debeb19ce293' },
  }),
  name: 'Controller',
  category: 'computer',
  blurb: 'A pad, and the USB port it charges from',
  tags: ['controller', 'gamepad', 'pad', 'dualsense', 'console', 'usb-c', 'charging', 'gaming', 'desk'],
  doc: {
    price: 65,
    description:
      'Here for two unglamorous reasons: it occupies 160 by 106 mm of desk or shelf, and it wants a USB-C port that is switched on while the console is off, which is a question about where the charger goes.',
  },
  params: [
    { key: 'charging', label: 'Charging', type: 'bool', default: false, group: 'Controller' },
    { key: 'lit', label: 'Light bar', type: 'bool', default: true, group: 'Control' },
  ],
  solids: (p) => {
    /*
     * 160 wide, 66 to the top of the sticks and 106 front to back with the
     * grips, which is the pad the readout below describes. The old body was
     * 81 deep, and the scan of the real pad fitted into it at four fifths.
     */
    const lit = bool(p, 'lit', true)
    const out: Solid[] = [
      { kind: 'box', mat: { color: '#E9EAEE', rough: 0.5, density: 1.2 }, size: [160, 50, 84], at: [0, 25, -10], bevel: 16 },
    ]
    for (const sx of [-1, 1] as const) {
      out.push({ kind: 'cyl', mat: { color: '#1C1F24', rough: 0.7, density: 1.2 }, r: 17, h: 16, seg: 24, at: [sx * 34, 58, -2] })
      out.push({ kind: 'box', mat: { color: '#E9EAEE', rough: 0.5, density: 1.2 }, size: [42, 44, 74], at: [sx * 54, 22, 16], bevel: 18 })
    }
    out.push({
      kind: 'box',
      mat: lit
        ? { color: '#2C4D7A', rough: 0.3, density: 1.2, emissive: '#5AA0FF', emissiveIntensity: 1.3 }
        : { color: '#2A2D33', rough: 0.6, density: 1.2 },
      size: [84, 3, 2.4], at: [0, 40, 33],
    })
    return out
  },
  ports: () => signalPorts([['usbc', 'USB-C']], [0, 30, -54], [0, 0, -1], 18),
  mass: () => 280,
  readouts: (p) => [
    { label: 'Footprint', value: '160 x 106 mm with the sticks' },
    { label: 'Charge draw', value: bool(p, 'charging', false) ? '7.5 W over USB-C, 3 h from flat' : 'Nothing, it is charged' },
    { label: 'Battery', value: '1560 mAh, about 9 hours' },
  ],
}

const networkSwitch: PartDef = {
  id: 'network-switch',
  /*
   * No mesh, and it does not want one. A desktop switch is a steel box with
   * a row of ports and a row of LEDs, which is exactly what the solids draw,
   * at the width the port count gives it. A photoscan would add a brand and
   * nothing else.
   */
  name: 'Network switch',
  category: 'computer',
  blurb: 'Ports, and the cable runs that have to reach them',
  tags: ['switch', 'network', 'ethernet', 'lan', 'gigabit', 'poe', 'router', 'rack', 'patch', 'rj45'],
  doc: {
    price: 45,
    description:
      'The part that turns one ethernet drop into eight, and the reason to lay a setup out before buying cable: every port on it is a run that has to physically reach, and the sum of those lengths is the only honest cable order.\n\nPoE matters more than the port count. A switch with a 65 W budget runs four cameras or one access point and a phone, and the budget is per switch, not per port.',
  },
  params: [
    REGION_PARAM,
    { key: 'ports', label: 'Ports', type: 'enum', default: '8', group: 'Switch', options: ['5', '8', '16', '24'].map((v) => ({ value: v, label: `${v} port` })) },
    { key: 'speed', label: 'Speed', type: 'enum', default: '1g', group: 'Switch', options: [{ value: '100m', label: '100 Mbit' }, { value: '1g', label: 'Gigabit' }, { value: '2.5g', label: '2.5 Gbit' }, { value: '10g', label: '10 Gbit' }] },
    { key: 'poe', label: 'PoE', type: 'bool', default: false, group: 'Switch' },
    { key: 'poeUsed', label: 'PoE drawn', type: 'number', unit: 'W', default: 0, min: 0, max: 240, step: 5, group: 'Switch' },
    { key: 'rack', label: 'Rack mount', type: 'bool', default: false, group: 'Switch', help: 'A 19 inch ear each side, which makes it 483 mm wide whatever the port count.' },
  ],
  solids: (p) => {
    const n = parseInt(str(p, 'ports', '8'), 10) || 8
    const rack = bool(p, 'rack', false)
    const rows = n > 8 ? 2 : 1
    const perRow = Math.ceil(n / rows)
    const W = rack ? 483 : Math.max(120, perRow * 18 + 36)
    const D = n > 8 ? 160 : 90
    const H = 26
    const out: Solid[] = [
      { kind: 'box', mat: { color: '#2E3238', metal: 0.8, rough: 0.45, density: 7.8 }, size: [W, H, D], at: [0, H / 2, 0], bevel: 2 },
    ]
    const body = rack ? 483 - 90 : W
    for (let r = 0; r < rows; r++) {
      for (let i = 0; i < perRow && r * perRow + i < n; i++) {
        const x = -body / 2 + 22 + i * ((body - 44) / Math.max(1, perRow - 1))
        out.push({ kind: 'box', mat: { color: '#0B0C0F', rough: 0.6, density: 1.2 }, size: [14, 13, 4], at: [x, 11 + r * 0, D / 2 + 1] })
        out.push({
          kind: 'box',
          mat: { color: '#1E3A24', rough: 0.4, density: 1.2, emissive: '#4ADE80', emissiveIntensity: 0.8 },
          size: [3, 2, 1.5], at: [x, 21, D / 2 + 1],
        })
      }
    }
    if (rack) {
      for (const sx of [-1, 1] as const) {
        out.push({ kind: 'box', mat: STEEL, size: [44, H, 3], at: [sx * (483 / 2 - 22), H / 2, -D / 2 + 2] })
      }
    }
    return out
  },
  ports: (p) => {
    const n = parseInt(str(p, 'ports', '8'), 10) || 8
    const rack = bool(p, 'rack', false)
    const rows = n > 8 ? 2 : 1
    const perRow = Math.ceil(n / rows)
    const W = rack ? 483 : Math.max(120, perRow * 18 + 36)
    const D = n > 8 ? 160 : 90
    const body = rack ? 483 - 90 : W
    const out = Array.from({ length: n }, (_, i) => {
      const col = i % perRow
      const x = -body / 2 + 22 + col * ((body - 44) / Math.max(1, perRow - 1))
      return {
        id: `p${i + 1}`,
        label: `Port ${i + 1}`,
        kind: 'electrical' as const,
        pos: [x, 11, D / 2 + 3] as Vec3,
        dir: [0, 0, 1] as Vec3,
        role: 'io' as const,
        imax: 0.5,
        solderable: false,
      }
    })
    return [...mainsPorts([0, 10, -D / 2 - 4], [0, 0, -1], '', [12, 0, 0]), ...out]
  },
  electrical: load((p) => {
    const n = parseInt(str(p, 'ports', '8'), 10) || 8
    const perPort = { '100m': 0.2, '1g': 0.45, '2.5g': 0.9, '10g': 2.2 }[str(p, 'speed', '1g')] ?? 0.45
    // The switch itself, plus whatever it is passing out over PoE, plus the
    // 15% the PoE supply loses on the way.
    const poe = bool(p, 'poe', false) ? num(p, 'poeUsed', 0) * 1.15 : 0
    return 3 + n * perPort + poe
  }),
  price: (p) => {
    const n = parseInt(str(p, 'ports', '8'), 10) || 8
    const mult = { '100m': 1, '1g': 2.2, '2.5g': 6, '10g': 18 }[str(p, 'speed', '1g')] ?? 2.2
    return 12 + n * mult * (bool(p, 'poe', false) ? 3.2 : 1) + (bool(p, 'rack', false) ? 20 : 0)
  },
  readouts: (p) => {
    const n = parseInt(str(p, 'ports', '8'), 10) || 8
    const perPort = { '100m': 0.2, '1g': 0.45, '2.5g': 0.9, '10g': 2.2 }[str(p, 'speed', '1g')] ?? 0.45
    const budget = bool(p, 'poe', false) ? (n <= 8 ? 65 : 180) : 0
    const used = bool(p, 'poe', false) ? num(p, 'poeUsed', 0) : 0
    const draw = 3 + n * perPort + used * 1.15
    return [
      { label: 'Drawing', value: `${draw.toFixed(1)} W, ${amps(p, draw)}` },
      {
        label: 'PoE budget',
        value: bool(p, 'poe', false) ? `${used} of ${budget} W used${used > budget ? ' — over' : ''}` : 'None, this one does not do PoE',
      },
      { label: 'Cable runs', value: `${n} to find a route for` },
    ]
  },
}

/* ================================================================== */
/* Hanging things on walls                                             */
/* ================================================================== */

const tvMount: PartDef = {
  id: 'mount-tv-wall',
  model: (p) =>
    str(p, 'motion', 'tilt') !== 'full'
      ? {
          url: 'models/tv-wall-mount.glb',
          fit: 'bbox',
          // The arms are straight bars, so a taller VESA pattern lengthens
          // them between the hooks rather than scaling the whole bracket.
          axes: { y: [0.1, 0.9], z: 'fill' },
          credit: { title: 'Tv mount d70t', author: 'Kacper Obcowski', license: 'CC-BY-4.0', source: 'https://sketchfab.com/3d-models/tv-mount-d70t-4e8169e3869f4016aabe232ca7ce6a00' },
        }
      : undefined,
  name: 'TV wall mount',
  category: 'furniture',
  blurb: 'A VESA pattern, a load rating, and two studs to find',
  tags: ['mount', 'bracket', 'vesa', 'wall mount', 'tv', 'monitor', 'tilt', 'full motion', 'stud', 'room'],
  doc: {
    price: 55,
    description:
      'Three numbers decide whether a mount works and none of them is on the front of the box: the VESA pattern, which has to match the holes in the back of the screen; the rated load, which has to beat the mass of the screen and not the mass printed on the mount; and the stud spacing, which is 400 or 600 mm and is not negotiable.\n\nA full-motion arm multiplies the load it puts on the wall by how far out it is extended, which is why its rating is lower than a flat bracket of the same steel.',
  },
  params: [
    {
      key: 'vesa', label: 'VESA pattern', type: 'enum', default: '400', group: 'Mount',
      options: ['75', '100', '200', '300', '400', '600'].map((v) => ({ value: v, label: `${v} x ${v} mm` })),
    },
    {
      key: 'motion', label: 'Motion', type: 'enum', default: 'tilt', group: 'Mount',
      options: [{ value: 'flat', label: 'Fixed, flat to the wall' }, { value: 'tilt', label: 'Tilt' }, { value: 'full', label: 'Full motion arm' }],
    },
    { key: 'extend', label: 'Arm extension', type: 'number', unit: 'mm', default: 400, min: 60, max: 800, step: 20, group: 'Mount' },
    { key: 'studs', label: 'Stud spacing', type: 'enum', default: '400', group: 'Mount', options: [{ value: '400', label: '400 mm' }, { value: '600', label: '600 mm' }, { value: 'solid', label: 'Masonry' }] },
    { key: 'screenMass', label: 'Screen mass', type: 'number', unit: 'g', default: 18000, min: 2000, max: 70000, step: 1000, group: 'Mount' },
  ],
  solids: (p) => {
    const v = parseInt(str(p, 'vesa', '400'), 10) || 400
    const motion = str(p, 'motion', 'tilt')
    const ext = motion === 'full' ? num(p, 'extend', 400) : motion === 'tilt' ? 60 : 28
    const plateW = str(p, 'studs', '400') === '600' ? 660 : 460
    const out: Solid[] = [
      // The wall plate, which spans the studs rather than the screen.
      { kind: 'box', mat: { color: '#23262B', metal: 0.7, rough: 0.55, density: 7.8 }, size: [plateW, 120, 10], at: [0, v / 2 + 60, -ext], bevel: 2 },
    ]
    if (motion === 'full') {
      out.push({ kind: 'box', mat: STEEL, size: [ext * 0.9, 50, 46], at: [0, v / 2 + 60, -ext / 2], bevel: 6 })
    }
    // The screen-side arms, on the VESA pattern.
    for (const sx of [-1, 1] as const) {
      out.push({ kind: 'box', mat: { color: '#23262B', metal: 0.7, rough: 0.55, density: 7.8 }, size: [40, v + 40, 10], at: [sx * (v / 2), v / 2 + 60, 0], bevel: 2 })
    }
    out.push({ kind: 'box', mat: { color: '#23262B', metal: 0.7, rough: 0.55, density: 7.8 }, size: [v + 40, 40, 10], at: [0, v / 2 + 60, 0], bevel: 2 })
    return out
  },
  ports: (p) => {
    const v = parseInt(str(p, 'vesa', '400'), 10) || 400
    const motion = str(p, 'motion', 'tilt')
    const ext = motion === 'full' ? num(p, 'extend', 400) : motion === 'tilt' ? 60 : 28
    return [
      { id: 'vesa', label: `VESA ${v}`, kind: 'mechanical', pos: [0, v / 2 + 60, 2], dir: [0, 0, 1], mate: { type: 'face' } },
      { id: 'wall', label: 'Wall face', kind: 'mechanical', pos: [0, v / 2 + 60, -ext - 5], dir: [0, 0, -1], mate: { type: 'face' } },
    ]
  },
  price: (p) => {
    const motion = str(p, 'motion', 'tilt')
    const v = parseInt(str(p, 'vesa', '400'), 10) || 400
    return 18 + v * 0.05 + { flat: 0, tilt: 14, full: 55 }[motion]! + (motion === 'full' ? num(p, 'extend', 400) * 0.03 : 0)
  },
  readouts: (p) => {
    const motion = str(p, 'motion', 'tilt')
    const ext = motion === 'full' ? num(p, 'extend', 400) : motion === 'tilt' ? 60 : 28
    const mass = num(p, 'screenMass', 18000) / 1000
    /*
     * A flat bracket is rated on the steel. An arm is rated on the moment,
     * and the moment is the mass times how far out it is held — which is why
     * the same arm is honest at 300 mm and not at 700.
     */
    const rated = motion === 'full' ? Math.max(8, 45 - ext * 0.045) : motion === 'tilt' ? 50 : 60
    const studs = str(p, 'studs', '400')
    return [
      { label: 'Rated', value: `${rated.toFixed(0)} kg at ${ext} mm out` },
      { label: 'Screen', value: `${mass.toFixed(1)} kg — ${mass <= rated ? 'inside the rating' : 'over the rating'}` },
      {
        label: 'Fixing',
        value: studs === 'solid' ? '4 x M8 into masonry' : `2 studs at ${studs} mm, 4 x M8 coach screws`,
      },
    ]
  },
}

registerParts([taskChair, keyboard, deskLamp, deskSpeakers, headset, handheld, gamepad, networkSwitch, tvMount])
