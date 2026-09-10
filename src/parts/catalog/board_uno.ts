import type { SilkItem, Solid, Vec2, Vec3 } from '../kernel/types'
import { circle } from './_helpers'

/**
 * The physical detail and the silkscreen for the Uno-style board.
 *
 * Kept out of modules.ts because it is mostly a long list of coordinates, and
 * because the markings are the part of a board people actually read. Every
 * legend here is one a real board carries, in the place it carries it.
 *
 * A note on the wordmark: this deliberately reads UNO R3 rather than carrying
 * the Arduino name or logo. The board this models is the open hardware design,
 * and clone boards genuinely print it this way; the name and the infinity mark
 * are trademarks, and putting them on a part in a product that will be sold is
 * not the same thing as citing the design.
 */

export const UNO = { W: 68.6, D: 53.4, T: 1.6 }
const P = 2.54

/** Header x-origins, measured to pin 1 of each strip. */
export const UNO_HEADERS = {
  /** SCL, SDA, AREF, GND, D13 down to D8. */
  digitalHi: -19,
  /** D7 down to D0. */
  digitalLo: 11,
  /** NC, IOREF, RESET, 3V3, 5V, GND, GND, VIN. */
  power: -24,
  /** A0 to A5. */
  analog: 6,
}

export const UNO_Z = {
  far: -UNO.D / 2 + 3.2,
  near: UNO.D / 2 - 3.2,
}

/**
 * Silkscreen y from world z. The layer is a plane laid flat by a -90 degree
 * rotation about X, which sends the texture's +y to the scene's -z.
 */
const sy = (z: number): number => -z

/* ------------------------------------------------------------------ */
/* Silkscreen                                                          */
/* ------------------------------------------------------------------ */

/** Pin legends for one header strip, printed inboard of the sockets. */
function headerLegend(x0: number, z: number, labels: string[], inboard: number): SilkItem[] {
  const items: SilkItem[] = []
  labels.forEach((text, i) => {
    if (!text) return
    items.push({
      t: 'text',
      at: [x0 + i * P, sy(z) + inboard],
      text,
      size: 1.55,
      rot: 90,
      align: 'center',
    })
  })
  return items
}

export function unoSilk(): SilkItem[] {
  const { W, D } = UNO
  const items: SilkItem[] = []

  // Board outline, printed just inside the edge as boards are.
  items.push({ t: 'rect', at: [0, 0], size: [W - 1.2, D - 1.2], r: 2.4, w: 0.2 })

  /* --- headers --- */
  items.push(
    ...headerLegend(UNO_HEADERS.digitalHi, UNO_Z.far,
      ['SCL', 'SDA', 'AREF', 'GND', '13', '12', '~11', '~10', '~9', '8'].reverse(), -4.6),
    ...headerLegend(UNO_HEADERS.digitalLo, UNO_Z.far,
      ['7', '~6', '~5', '4', '~3', '2', 'TX 1', 'RX 0'].reverse(), -4.6),
    ...headerLegend(UNO_HEADERS.power, UNO_Z.near,
      ['NC', 'IOREF', 'RESET', '3V3', '5V', 'GND', 'GND', 'VIN'], 4.6),
    ...headerLegend(UNO_HEADERS.analog, UNO_Z.near,
      ['A0', 'A1', 'A2', 'A3', 'A4', 'A5'], 4.6),
  )

  // Header group names and their underlines.
  items.push(
    { t: 'text', at: [-6, sy(UNO_Z.far) - 8.4], text: 'DIGITAL (PWM ~)', size: 2, bold: true },
    { t: 'line', from: [-24, sy(UNO_Z.far) - 6.6], to: [11.5, sy(UNO_Z.far) - 6.6], w: 0.3 },
    { t: 'text', at: [-15.6, sy(UNO_Z.near) + 7.4], text: 'POWER', size: 2, bold: true },
    { t: 'line', from: [-25.5, sy(UNO_Z.near) + 6], to: [-6, sy(UNO_Z.near) + 6], w: 0.3 },
    { t: 'text', at: [12.5, sy(UNO_Z.near) + 7.4], text: 'ANALOG IN', size: 2, bold: true },
    { t: 'line', from: [4.5, sy(UNO_Z.near) + 6], to: [20.5, sy(UNO_Z.near) + 6], w: 0.3 },
  )

  // Pad rings under each socket, which is what a header footprint looks like.
  items.push(
    { t: 'pads', at: [UNO_HEADERS.digitalHi, sy(UNO_Z.far)], n: 10, pitch: P, r: 1.1 },
    { t: 'pads', at: [UNO_HEADERS.digitalLo, sy(UNO_Z.far)], n: 8, pitch: P, r: 1.1 },
    { t: 'pads', at: [UNO_HEADERS.power, sy(UNO_Z.near)], n: 8, pitch: P, r: 1.1 },
    { t: 'pads', at: [UNO_HEADERS.analog, sy(UNO_Z.near)], n: 6, pitch: P, r: 1.1 },
  )

  /* --- board identity --- */
  // Placed in the clear strip between the DIP and the LED row. The obvious
  // spot in the middle of the board is underneath the microcontroller.
  items.push(
    { t: 'text', at: [1, 9.5], text: 'UNO', size: 5.6, bold: true, align: 'left' },
    { t: 'text', at: [16.5, 9.5], text: 'R3', size: 3.4, align: 'left' },
    { t: 'text', at: [1, 4.6], text: 'OPEN HARDWARE', size: 1.6, align: 'left' },
  )

  /* --- component designators and labels --- */
  items.push(
    { t: 'text', at: [6, sy(UNO.D / 2 - 16) - 7.4], text: 'U1  ATMEGA328P', size: 1.5 },
    { t: 'text', at: [22, sy(UNO.D / 2 - 22) - 3.6], text: 'X1', size: 1.4 },
    { t: 'text', at: [-14, sy(UNO.D / 2 - 26) - 3.2], text: 'U3', size: 1.4 },
    { t: 'text', at: [-24, sy(UNO.D / 2 - 24) - 4.2], text: 'C1', size: 1.4 },
    { t: 'text', at: [-24, sy(UNO.D / 2 - 33) - 4.2], text: 'C2', size: 1.4 },
    { t: 'text', at: [-W / 2 + 12, sy(-UNO.D / 2 + 5) + 4.6], text: 'RESET', size: 1.6, bold: true },
    { t: 'text', at: [-W / 2 + 25, sy(-UNO.D / 2 + 13) - 3.4], text: 'U2  16U2', size: 1.4 },
    { t: 'text', at: [-W / 2 + 8, sy(UNO.D / 2 - 10) + 6.4], text: '7-12V', size: 1.5 },
  )

  // Status LEDs, each named as the board names it.
  const ledZ = sy(-UNO.D / 2 + 7)
  ;['ON', 'L', 'TX', 'RX'].forEach((name, i) => {
    items.push({ t: 'text', at: [10 + i * 3, ledZ - 2.4], text: name, size: 1.3 })
  })

  /* --- ICSP footprints --- */
  for (const [cx, cz, label] of [[W / 2 - 7, 0, 'ICSP'], [-W / 2 + 9.5, -UNO.D / 2 + 20, 'ICSP2']] as const) {
    items.push({ t: 'text', at: [cx, sy(cz) - 4.4], text: label, size: 1.4 })
    items.push({ t: 'rect', at: [cx, sy(cz)], size: [P * 3 + 1.4, P * 2 + 1.4], w: 0.2 })
    // Pin 1 is square on every ICSP header ever printed.
    items.push({ t: 'rect', at: [cx - P, sy(cz) - P / 2], size: [1.8, 1.8], w: 0.25 })
  }

  /* --- mounting holes --- */
  // Already in profile coordinates, which are the same coordinates the silk
  // layer uses: both are the extrude plane, laid flat by the same rotation.
  for (const hole of UNO_HOLES) {
    items.push({ t: 'circle', at: hole, r: 3.1, w: 0.25 })
  }

  return items
}

/**
 * The four M3 holes, in the positions the design actually puts them.
 *
 * These are profile coordinates, not world ones: the PCB is an extrusion laid
 * flat, so a profile y of +n sits at a world z of -n. The silkscreen layer is
 * laid flat by the same rotation and shares the convention.
 */
export const UNO_HOLES: Vec2[] = [
  [-UNO.W / 2 + 14, -UNO.D / 2 + 2.6],
  [UNO.W / 2 - 2.6, -UNO.D / 2 + 15.3],
  [UNO.W / 2 - 2.6, UNO.D / 2 - 20],
  [-UNO.W / 2 + 15.3, UNO.D / 2 - 2.6],
]

/* ------------------------------------------------------------------ */
/* Physical detail                                                     */
/* ------------------------------------------------------------------ */

const STEEL = { color: '#C2C7CE', metal: 1, rough: 0.3, density: 7.85 }
const TIN = { color: '#A9AEB6', metal: 1, rough: 0.42, density: 7.31 }

/** USB-B socket: a drawn steel shell with the tongue visible inside it. */
function usbB(x: number, z: number, y0: number): Solid[] {
  const h = 11.1
  const w = 12.2
  const len = 16.4
  return [
    { kind: 'group', mat: 'abs-black', at: [x, y0 + h / 2, z], children: [
      // Shell, as four walls so the mouth is genuinely open.
      { kind: 'box', mat: STEEL, size: [len, 0.5, w], at: [0, h / 2 - 0.25, 0] },
      { kind: 'box', mat: STEEL, size: [len, 0.5, w], at: [0, -h / 2 + 0.25, 0] },
      { kind: 'box', mat: STEEL, size: [len, h, 0.5], at: [0, 0, w / 2 - 0.25] },
      { kind: 'box', mat: STEEL, size: [len, h, 0.5], at: [0, 0, -w / 2 + 0.25] },
      // Back wall, so you are not looking through the connector.
      { kind: 'box', mat: STEEL, size: [0.5, h, w], at: [len / 2 - 0.25, 0, 0] },
      // The white insulator and its four contacts.
      { kind: 'box', mat: 'abs-white', size: [7, 4.6, 8.4], at: [2.4, -1.4, 0], noCollide: true },
      ...[-1.2, 1.2].map((dz): Solid => ({
        kind: 'box', mat: 'gold', size: [5.6, 0.4, 0.9], at: [1.6, 0.6, dz * 1.6], noCollide: true,
      })),
      // Solder tabs at the corners.
      ...([-1, 1] as const).map((s): Solid => ({
        kind: 'box', mat: TIN, size: [1.6, 3, 0.8], at: [-len / 2 + 2, -h / 2 - 1, (s * w) / 2], noCollide: true,
      })),
    ] },
  ]
}

/** Barrel jack: moulded body, metal barrel, and the centre pin inside it. */
function barrelJack(x: number, z: number, y0: number): Solid[] {
  const h = 11
  return [
    { kind: 'group', mat: 'abs-black', at: [x, y0 + h / 2, z], children: [
      { kind: 'box', mat: 'abs-black', size: [13.6, h, 9.2], at: [1.2, 0, 0], bevel: 0.5 },
      { kind: 'cyl', mat: 'abs-black', r: 4.5, h: 3.4, rot: [0, 0, 90], at: [-6.6, 0, 0], chamfer: 0.4 },
      // The bore, and the pin the plug slides over.
      { kind: 'cyl', mat: { color: '#0A0B0D', rough: 0.95, density: 0.01 }, r: 3.3, h: 7, rot: [0, 0, 90], at: [-5.4, 0, 0], noCollide: true },
      { kind: 'cyl', mat: TIN, r: 1.05, h: 8, rot: [0, 0, 90], at: [-4.4, 0, 0], noCollide: true },
    ] },
  ]
}

/** DIP-28 in a socket, with the end notch and the pin 1 dot. */
function dip28(x: number, z: number, y0: number): Solid[] {
  const len = 35
  const wid = 10
  const children: Solid[] = [
    { kind: 'box', mat: 'epoxy-black', size: [len, 3.6, wid], at: [0, 1.8, 0], bevel: 0.35 },
    // Notch at the pin 1 end.
    { kind: 'cyl', mat: { color: '#0B0C0E', rough: 0.9, density: 0.01 }, r: 1.5, h: 3.8, at: [-len / 2, 1.9, 0], noCollide: true },
    { kind: 'cyl', mat: { color: '#0B0C0E', rough: 0.9, density: 0.01 }, r: 0.9, h: 0.5, at: [-len / 2 + 3.4, 3.6, -wid / 2 + 2.2], noCollide: true },
  ]
  // Fourteen leads a side, gull-wing, as a DIP sits in a socket.
  for (let i = 0; i < 14; i++) {
    const px = -len / 2 + 2.2 + i * 2.54
    for (const s of [-1, 1]) {
      children.push({
        kind: 'box', mat: TIN, size: [0.55, 1.6, 2.2],
        at: [px, 0.8, (s * wid) / 2 + s * 0.8], noCollide: true,
      })
    }
  }
  return [{ kind: 'group', mat: 'epoxy-black', at: [x, y0, z], children }]
}

/** Everything on the board that is not the PCB itself. */
export function unoFurniture(y0: number): Solid[] {
  const { W, D } = UNO
  const out: Solid[] = []

  out.push(...usbB(-W / 2 + 3.4, -D / 2 + 13, y0))
  out.push(...barrelJack(-W / 2 + 4, D / 2 - 10, y0))
  out.push(...dip28(6, D / 2 - 16, y0))

  // 16 MHz crystal in its HC-49 can, lying down as it does on the board.
  out.push({
    kind: 'group', mat: STEEL, at: [22, y0, D / 2 - 22], children: [
      { kind: 'box', mat: { color: '#9AA1A9', metal: 1, rough: 0.32, density: 6 }, size: [11, 4.2, 4.6], at: [0, 2.1, 0], bevel: 0.9 },
      ...([-1, 1] as const).map((s): Solid => ({
        kind: 'cyl', mat: TIN, r: 0.3, h: 2, at: [s * 4.9, 1, 0], noCollide: true,
      })),
    ],
  })

  // Regulator in a SOT-223 with its tab, and the USB interface chip.
  out.push({ kind: 'box', mat: 'epoxy-black', size: [6.5, 1.8, 3.5], at: [-14, y0 + 0.9, D / 2 - 26], bevel: 0.15 })
  out.push({ kind: 'box', mat: TIN, size: [3.4, 0.3, 2.2], at: [-14, y0 + 0.15, D / 2 - 28.4], noCollide: true })
  out.push({ kind: 'box', mat: 'epoxy-black', size: [7, 1, 7], at: [-W / 2 + 25, y0 + 0.5, -D / 2 + 13], bevel: 0.2 })

  // Electrolytics, with the polarity stripe every one of them carries.
  for (const cz of [D / 2 - 24, D / 2 - 33]) {
    out.push({
      kind: 'group', mat: 'elcap-sleeve', at: [-24, y0, cz], children: [
        { kind: 'cyl', mat: 'elcap-sleeve', r: 3.2, h: 6.2, at: [0, 3.1, 0], chamfer: 0.4 },
        { kind: 'cyl', mat: { color: '#D8DCE2', rough: 0.5, density: 1.4 }, r: 3.23, h: 5.4, at: [0, 3.1, 0], phi: [160, 40], noCollide: true },
        { kind: 'cyl', mat: { color: '#2A3550', rough: 0.4, density: 1.4 }, r: 3.24, h: 0.5, at: [0, 6, 0], noCollide: true },
      ],
    })
  }

  // Reset button with its metal dome cover.
  out.push({ kind: 'box', mat: 'abs-black', size: [6, 3.2, 6], at: [-W / 2 + 12, y0 + 1.6, -D / 2 + 5], bevel: 0.3 })
  out.push({ kind: 'cyl', mat: STEEL, r: 2.6, h: 0.4, at: [-W / 2 + 12, y0 + 3.3, -D / 2 + 5], noCollide: true })
  out.push({ kind: 'cyl', mat: { color: '#C0272D', rough: 0.35, density: 1.1 }, r: 1.75, h: 1.5, at: [-W / 2 + 12, y0 + 4.1, -D / 2 + 5], chamfer: 0.25 })

  // Status LEDs. Only the one wired to D13 is driven, so only it is tagged.
  const ledSpec: [string, string, number][] = [
    ['#1E9B4B', '#3DFF88', 0.55],
    ['#C9791E', '#FFB020', 0.1],
    ['#C9791E', '#FFB020', 0.1],
    ['#C9791E', '#FFB020', 0.1],
  ]
  ledSpec.forEach(([color, emissive, intensity], i) => {
    out.push({
      kind: 'box',
      mat: { color, rough: 0.32, emissive, emissiveIntensity: intensity, density: 2 },
      size: [1.6, 0.85, 0.8],
      at: [10 + i * 3, y0 + 0.42, -D / 2 + 7] as Vec3,
      tag: i === 1 ? 'lens' : undefined,
      noCollide: true,
    })
  })

  // ICSP headers, six pins each on a 2 x 3 grid.
  for (const [cx, cz] of [[W / 2 - 7, 0], [-W / 2 + 9.5, -D / 2 + 20]] as const) {
    for (let col = 0; col < 3; col++) {
      for (const s of [-1, 1]) {
        out.push({
          kind: 'box', mat: TIN, size: [0.64, 6, 0.64],
          at: [cx + (col - 1) * P, y0 + 2, cz + (s * P) / 2], noCollide: true,
        })
      }
    }
    out.push({ kind: 'box', mat: 'nylon-black', size: [3 * P, 2.4, 2 * P], at: [cx, y0 + 1.2, cz], bevel: 0.15 })
  }

  // Polyfuse, the small green block next to the USB socket.
  out.push({ kind: 'box', mat: { color: '#1F6B3A', rough: 0.5, density: 2 }, size: [3.4, 1.6, 2.6], at: [-W / 2 + 14, y0 + 0.8, -D / 2 + 20], bevel: 0.2 })

  return out
}

/**
 * PCB outline: a rounded rectangle with the angled corner the design has by
 * the analogue header.
 *
 * Built explicitly rather than by deleting points out of a rounded rectangle.
 * Filtering the corner away left the two neighbouring points joined by a
 * straight line right across the board, which turned the notch into an enormous
 * chamfer and made the whole thing read as a pentagon.
 */
export function unoOutline(): Vec2[] {
  const { W, D } = UNO
  const r = 3
  const cut = 6.4
  const x1 = W / 2
  const y1 = D / 2
  const pts: Vec2[] = []

  const arc = (cx: number, cy: number, a0: number, seg = 4): void => {
    for (let i = 0; i <= seg; i++) {
      const a = a0 + (i / seg) * (Math.PI / 2)
      pts.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r])
    }
  }

  // Anticlockwise from the top right, leaving the bottom right corner angled.
  arc(x1 - r, y1 - r, 0)
  arc(-x1 + r, y1 - r, Math.PI / 2)
  arc(-x1 + r, -y1 + r, Math.PI)
  pts.push([x1 - cut, -y1])
  pts.push([x1, -y1 + cut])
  return pts
}

export function unoHoleProfiles(): Vec2[][] {
  return UNO_HOLES.map(([x, z]) => circle(1.6, x, z, 12))
}
