import type { Params, PartDef, Port, Solid } from '../kernel/types'
import { registerParts } from '../kernel/registry'
import { roundRect, str } from './_helpers'

/**
 * The ESP boards, as separate boards.
 *
 * "ESP32" is not a part. It is a chip family with two radios, four cores
 * between its variants and a dozen carriers, and the thing somebody actually
 * has on their desk is a *board* — a DevKitC, a NodeMCU, a D1 mini — each with
 * its own pins in its own order, its own footprint and its own idea of which
 * GPIO is safe to use at boot.
 *
 * So this is a table of boards rather than one part with a pin count. The
 * value of that is not cosmetic: a sketch that writes to pin 2 has to reach
 * the pin marked 2 on the board in front of you, and a lead that lands where
 * the silkscreen says GND has to actually be ground.
 *
 * ## On pinouts
 *
 * Every layout below is the manufacturer's own, in silkscreen order, read
 * with the USB socket toward you. Where a pin has two names — the ESP8266
 * boards label D0 to D8 and nobody writing for one uses the GPIO numbers —
 * both work in a sketch.
 *
 * Boards are added here when their pinout can be stated exactly. An ESP32-S3
 * or C3 devkit is a different physical order again, and a plausible guess at
 * one is worse than not offering it: a wrong pinout is a build that works in
 * here and does not work on the bench, which is the one failure this whole
 * program exists to prevent.
 */

/** 2.54 mm, and everything on these boards is a multiple of it. */
const P = 2.54

/** What a pin is for, which decides its colour, its role and its limits. */
type Kind = 'gnd' | 'v33' | 'v5' | 'vin' | 'en' | 'gpio' | 'adc' | 'nc'

interface Pin {
  /** The silkscreen name, as printed. */
  label: string
  kind: Kind
  /** GPIO number, where it has one. This is what a sketch addresses. */
  gpio?: number
  /** ADC channel, where it has one: A0 in a sketch. */
  adc?: number
  /** A second name the board prints, such as D4. Lower-cased when matched. */
  alias?: string
  /** A word of warning for the inspector, where the pin has a catch. */
  note?: string
}

interface BoardSpec {
  label: string
  /** Manufacturer part number, for the bill of materials. */
  mpn: string
  maker: string
  price: number
  /** Board outline, mm. */
  w: number
  d: number
  /** 3.3 V or 5 V logic. Every board here is 3.3 V; the field is the reminder. */
  logic: number
  /** Per-pin source/sink limit, amps. */
  imax: number
  /** Peak supply draw with the radio transmitting, amps. */
  wifiPeak: number
  cpu: string
  /** Left column, top to bottom with the USB socket nearest you. */
  left: Pin[]
  /** Right column, same direction. */
  right: Pin[]
  /** Radio can, [width, depth], or null for a board with the chip bare. */
  can: [number, number] | null
}

const gnd = (): Pin => ({ label: 'GND', kind: 'gnd' })
const nc = (label = 'NC'): Pin => ({ label, kind: 'nc' })

/**
 * ESP32-DevKitC V4, 38 pins. Espressif's own board and the one most guides
 * are written against.
 */
const DEVKITC38: BoardSpec = {
  label: 'ESP32-DevKitC V4 (38 pin)',
  mpn: 'ESP32-DevKitC-32E', maker: 'Espressif', price: 11,
  w: 25.4, d: 54.4, logic: 3.3, imax: 0.012, wifiPeak: 0.5,
  cpu: 'Xtensa LX6, dual core, 240 MHz',
  can: [18, 25.5],
  left: [
    { label: '3V3', kind: 'v33' },
    { label: 'EN', kind: 'en', note: 'Reset. Pulling this low resets the board.' },
    { label: 'VP', kind: 'adc', gpio: 36, adc: 0, note: 'Input only.' },
    { label: 'VN', kind: 'adc', gpio: 39, adc: 3, note: 'Input only.' },
    { label: '34', kind: 'adc', gpio: 34, adc: 6, note: 'Input only.' },
    { label: '35', kind: 'adc', gpio: 35, adc: 7, note: 'Input only.' },
    { label: '32', kind: 'adc', gpio: 32, adc: 4 },
    { label: '33', kind: 'adc', gpio: 33, adc: 5 },
    { label: '25', kind: 'adc', gpio: 25, adc: 8 },
    { label: '26', kind: 'adc', gpio: 26, adc: 9 },
    { label: '27', kind: 'adc', gpio: 27, adc: 17 },
    { label: '14', kind: 'adc', gpio: 14, adc: 16 },
    { label: '12', kind: 'adc', gpio: 12, adc: 15, note: 'Must be low at boot.' },
    gnd(),
    { label: '13', kind: 'adc', gpio: 13, adc: 14 },
    nc('SD2'), nc('SD3'), nc('CMD'),
  ],
  right: [
    gnd(),
    { label: '23', kind: 'gpio', gpio: 23 },
    { label: '22', kind: 'gpio', gpio: 22, note: 'I2C SCL by convention.' },
    { label: 'TX0', kind: 'gpio', gpio: 1, note: 'Serial to the USB bridge.' },
    { label: 'RX0', kind: 'gpio', gpio: 3, note: 'Serial from the USB bridge.' },
    { label: '21', kind: 'gpio', gpio: 21, note: 'I2C SDA by convention.' },
    gnd(),
    { label: '19', kind: 'gpio', gpio: 19 },
    { label: '18', kind: 'gpio', gpio: 18 },
    { label: '5', kind: 'gpio', gpio: 5, note: 'Outputs a pulse train at boot.' },
    { label: '17', kind: 'gpio', gpio: 17 },
    { label: '16', kind: 'gpio', gpio: 16 },
    { label: '4', kind: 'adc', gpio: 4, adc: 10 },
    { label: '0', kind: 'adc', gpio: 0, adc: 11, note: 'Must be high at boot.' },
    { label: '2', kind: 'adc', gpio: 2, adc: 12, note: 'On-board LED.' },
    { label: '15', kind: 'adc', gpio: 15, adc: 13, note: 'Must be high at boot.' },
    nc('SD1'), nc('SD0'), nc('CLK'),
  ],
}

/** DOIT ESP32 DEVKIT V1, 30 pins. The cheap one, and the one most people have. */
const DOIT30: BoardSpec = {
  label: 'DOIT ESP32 DevKit V1 (30 pin)',
  mpn: 'ESP32-DEVKIT-V1', maker: 'DOIT', price: 7,
  w: 25.4, d: 48.2, logic: 3.3, imax: 0.012, wifiPeak: 0.5,
  cpu: 'Xtensa LX6, dual core, 240 MHz',
  can: [18, 25.5],
  left: [
    { label: 'EN', kind: 'en', note: 'Reset. Pulling this low resets the board.' },
    { label: 'VP', kind: 'adc', gpio: 36, adc: 0, note: 'Input only.' },
    { label: 'VN', kind: 'adc', gpio: 39, adc: 3, note: 'Input only.' },
    { label: '34', kind: 'adc', gpio: 34, adc: 6, note: 'Input only.' },
    { label: '35', kind: 'adc', gpio: 35, adc: 7, note: 'Input only.' },
    { label: '32', kind: 'adc', gpio: 32, adc: 4 },
    { label: '33', kind: 'adc', gpio: 33, adc: 5 },
    { label: '25', kind: 'adc', gpio: 25, adc: 8 },
    { label: '26', kind: 'adc', gpio: 26, adc: 9 },
    { label: '27', kind: 'adc', gpio: 27, adc: 17 },
    { label: '14', kind: 'adc', gpio: 14, adc: 16 },
    { label: '12', kind: 'adc', gpio: 12, adc: 15, note: 'Must be low at boot.' },
    { label: '13', kind: 'adc', gpio: 13, adc: 14 },
    gnd(),
    { label: 'VIN', kind: 'vin', note: '5 V in, through the on-board regulator.' },
  ],
  right: [
    { label: '23', kind: 'gpio', gpio: 23 },
    { label: '22', kind: 'gpio', gpio: 22, note: 'I2C SCL by convention.' },
    { label: 'TX0', kind: 'gpio', gpio: 1, note: 'Serial to the USB bridge.' },
    { label: 'RX0', kind: 'gpio', gpio: 3, note: 'Serial from the USB bridge.' },
    { label: '21', kind: 'gpio', gpio: 21, note: 'I2C SDA by convention.' },
    { label: '19', kind: 'gpio', gpio: 19 },
    { label: '18', kind: 'gpio', gpio: 18 },
    { label: '5', kind: 'gpio', gpio: 5, note: 'Outputs a pulse train at boot.' },
    { label: '17', kind: 'gpio', gpio: 17 },
    { label: '16', kind: 'gpio', gpio: 16 },
    { label: '4', kind: 'adc', gpio: 4, adc: 10 },
    { label: '0', kind: 'adc', gpio: 0, adc: 11, note: 'Must be high at boot.' },
    { label: '2', kind: 'adc', gpio: 2, adc: 12, note: 'On-board LED.' },
    { label: '15', kind: 'adc', gpio: 15, adc: 13, note: 'Must be high at boot.' },
    { label: '3V3', kind: 'v33' },
  ],
}

/** NodeMCU v3 (LoLin), ESP8266. D-numbers on the silkscreen, GPIOs underneath. */
const NODEMCU: BoardSpec = {
  label: 'NodeMCU v3 (ESP8266)',
  mpn: 'NodeMCU-ESP12E', maker: 'LoLin', price: 4,
  w: 25.4, d: 58, logic: 3.3, imax: 0.012, wifiPeak: 0.35,
  cpu: 'Tensilica L106, single core, 80 MHz',
  can: [16, 24],
  left: [
    { label: 'A0', kind: 'adc', adc: 0, note: 'Input only, 0 to 3.3 V on this board.' },
    nc('RSV'), nc('RSV'),
    { label: 'SD3', kind: 'gpio', gpio: 10 },
    { label: 'SD2', kind: 'gpio', gpio: 9 },
    nc('SD1'), nc('CMD'), nc('SD0'), nc('CLK'),
    gnd(),
    { label: '3V3', kind: 'v33' },
    { label: 'EN', kind: 'en', note: 'Chip enable. Held high in normal use.' },
    { label: 'RST', kind: 'en', note: 'Reset. Pulling this low resets the board.' },
    gnd(),
    { label: 'VIN', kind: 'vin', note: '5 V in, through the on-board regulator.' },
  ],
  right: [
    { label: 'D0', kind: 'gpio', gpio: 16, alias: 'd0', note: 'No interrupt, no PWM. Wake pin.' },
    { label: 'D1', kind: 'gpio', gpio: 5, alias: 'd1', note: 'I2C SCL by convention.' },
    { label: 'D2', kind: 'gpio', gpio: 4, alias: 'd2', note: 'I2C SDA by convention.' },
    { label: 'D3', kind: 'gpio', gpio: 0, alias: 'd3', note: 'Must be high at boot.' },
    { label: 'D4', kind: 'gpio', gpio: 2, alias: 'd4', note: 'On-board LED. Must be high at boot.' },
    { label: '3V3', kind: 'v33' },
    gnd(),
    { label: 'D5', kind: 'gpio', gpio: 14, alias: 'd5' },
    { label: 'D6', kind: 'gpio', gpio: 12, alias: 'd6' },
    { label: 'D7', kind: 'gpio', gpio: 13, alias: 'd7' },
    { label: 'D8', kind: 'gpio', gpio: 15, alias: 'd8', note: 'Must be low at boot.' },
    { label: 'RX', kind: 'gpio', gpio: 3, note: 'Serial from the USB bridge.' },
    { label: 'TX', kind: 'gpio', gpio: 1, note: 'Serial to the USB bridge.' },
    gnd(),
    { label: '3V3', kind: 'v33' },
  ],
}

/** Wemos D1 mini. Sixteen pins and a footprint the size of a postage stamp. */
const D1MINI: BoardSpec = {
  label: 'Wemos D1 mini (ESP8266)',
  mpn: 'D1-mini-V3', maker: 'Wemos', price: 3,
  w: 25.6, d: 34.2, logic: 3.3, imax: 0.012, wifiPeak: 0.35,
  cpu: 'Tensilica L106, single core, 80 MHz',
  can: [16, 24],
  left: [
    { label: 'RST', kind: 'en', note: 'Reset. Pulling this low resets the board.' },
    { label: 'A0', kind: 'adc', adc: 0, note: 'Input only, 0 to 3.2 V on this board.' },
    { label: 'D0', kind: 'gpio', gpio: 16, alias: 'd0', note: 'No interrupt, no PWM. Wake pin.' },
    { label: 'D5', kind: 'gpio', gpio: 14, alias: 'd5' },
    { label: 'D6', kind: 'gpio', gpio: 12, alias: 'd6' },
    { label: 'D7', kind: 'gpio', gpio: 13, alias: 'd7' },
    { label: 'D8', kind: 'gpio', gpio: 15, alias: 'd8', note: 'Must be low at boot.' },
    { label: '3V3', kind: 'v33' },
  ],
  right: [
    { label: 'TX', kind: 'gpio', gpio: 1, note: 'Serial to the USB bridge.' },
    { label: 'RX', kind: 'gpio', gpio: 3, note: 'Serial from the USB bridge.' },
    { label: 'D1', kind: 'gpio', gpio: 5, alias: 'd1', note: 'I2C SCL by convention.' },
    { label: 'D2', kind: 'gpio', gpio: 4, alias: 'd2', note: 'I2C SDA by convention.' },
    { label: 'D3', kind: 'gpio', gpio: 0, alias: 'd3', note: 'Must be high at boot.' },
    { label: 'D4', kind: 'gpio', gpio: 2, alias: 'd4', note: 'On-board LED. Must be high at boot.' },
    gnd(),
    { label: '5V', kind: 'v5', note: '5 V in or out, straight from USB.' },
  ],
}

export const ESP_BOARDS: Record<string, BoardSpec> = {
  'devkitc-38': DEVKITC38,
  'doit-30': DOIT30,
  nodemcu: NODEMCU,
  d1mini: D1MINI,
}

const DEFAULT_BOARD = 'doit-30'

const board = (p: Params): BoardSpec =>
  ESP_BOARDS[str(p, 'board', DEFAULT_BOARD)] ?? ESP_BOARDS[DEFAULT_BOARD]

/** A stable port id. Silkscreen names repeat — GND four times — so index too. */
const portId = (side: 'l' | 'r', i: number, pin: Pin): string => {
  if (pin.kind === 'gnd') return `gnd${side}${i}`
  if (pin.kind === 'v33') return `v33${side}${i}`
  if (pin.kind === 'v5') return 'v5'
  if (pin.kind === 'vin') return 'vin'
  if (pin.kind === 'en') return pin.label.toLowerCase()
  if (pin.kind === 'nc') return `nc${side}${i}`
  return pin.gpio !== undefined ? `io${pin.gpio}` : `${side}${i}`
}

/** Where a row of pins sits along the board, given how many there are. */
const rowZ = (d: number, n: number, i: number): number => -d / 2 + (d - (n - 1) * P) / 2 + i * P

function espSolids(p: Params): Solid[] {
  const b = board(p)
  const t = 1.2
  const out: Solid[] = [
    {
      kind: 'extrude', mat: 'fr4-black',
      profile: { outline: roundRect(b.w, b.d, 1.5) },
      depth: t, rot: [-90, 0, 0], at: [0, t / 2, 0],
    },
  ]

  if (b.can) {
    const [cw, cd] = b.can
    // The shielded radio, and the PCB antenna poking out past the end of it.
    out.push({
      kind: 'box', mat: { color: '#C2C7CE', metal: 1, rough: 0.34, density: 7.8 },
      size: [cw, 3.1, cd], at: [0, t + 1.55, -b.d / 2 + cd / 2 + 4], bevel: 0.35,
    })
    out.push({ kind: 'box', mat: 'fr4-black', size: [cw - 2, 1.2, 6], at: [0, t + 0.6, -b.d / 2 + 2.2] })
    out.push({
      kind: 'box', mat: { color: '#C2C7CE', metal: 1, rough: 0.4, density: 7.8 },
      size: [cw - 7, 0.3, 4.5], at: [0, t + 1.3, -b.d / 2 + 2.2], noCollide: true,
    })
  }

  // USB socket at the near end: micro on everything here.
  out.push({
    kind: 'box', mat: { color: '#B8BDC4', metal: 1, rough: 0.36, density: 7.8 },
    size: [8, 3, 5.6], at: [0, t + 1.5, b.d / 2 - 2],
  })

  // Buttons, on the boards big enough to carry them.
  if (b.d > 40) {
    out.push({ kind: 'box', mat: 'abs-black', size: [4.5, 2.6, 4.5], at: [-9, t + 1.3, b.d / 2 - 10] })
    out.push({ kind: 'box', mat: 'abs-black', size: [4.5, 2.6, 4.5], at: [9, t + 1.3, b.d / 2 - 10] })
  }
  out.push({ kind: 'box', mat: 'epoxy-black', size: [3.2, 1.2, 2.6], at: [6, t + 0.6, b.d / 2 - 17 < -b.d / 2 ? 0 : b.d / 2 - 17] })

  // Headers down both long edges, one plastic block and one gold pin each.
  for (const [side, list] of [[-1, b.left], [1, b.right]] as const) {
    const x = side * (b.w / 2 - 1.5)
    list.forEach((_, i) => {
      const z = rowZ(b.d, list.length, i)
      out.push({ kind: 'box', mat: 'abs-black', size: [P - 0.1, 2.5, P - 0.1], at: [x, t + 1.25, z] })
      out.push({ kind: 'box', mat: 'gold', size: [0.64, 11, 0.64], at: [x, t + 2.9, z] })
    })
  }
  return out
}

function espPorts(p: Params): Port[] {
  const b = board(p)
  const ports: Port[] = []

  for (const [side, list] of [['l', b.left], ['r', b.right]] as const) {
    const x = (side === 'l' ? -1 : 1) * (b.w / 2 - 1.5)
    list.forEach((pin, i) => {
      if (pin.kind === 'nc') return
      const id = portId(side, i, pin)
      ports.push({
        id,
        label: pin.gpio !== undefined && pin.label !== String(pin.gpio)
          ? `${pin.label} (GPIO ${pin.gpio})`
          : pin.kind === 'gpio' || pin.kind === 'adc'
            ? `GPIO ${pin.gpio ?? pin.label}`
            : pin.label,
        kind: 'electrical',
        pos: [x, 8.2, rowZ(b.d, list.length, i)],
        dir: [0, 1, 0],
        role: pin.kind === 'gnd' ? 'gnd'
          : pin.kind === 'v33' || pin.kind === 'v5' || pin.kind === 'vin' ? 'power'
            : 'io',
        imax: pin.kind === 'gpio' || pin.kind === 'adc' ? b.imax : 1,
        // Every ground on the board is the same net, and so is every 3V3.
        groupId: pin.kind === 'gnd' ? 'gnd' : pin.kind === 'v33' ? 'v33' : undefined,
      })
    })
  }

  ports.push({
    id: 'base', label: 'Underside', kind: 'mechanical',
    pos: [0, 0, 0], dir: [0, -1, 0], mate: { type: 'face' },
  })
  return ports
}

/**
 * The supply and reset pins, by the ids this board actually uses.
 *
 * Every 3V3 pad on a board is the same net and shares a groupId, but they are
 * separate ports with separate ids — v33r14 on one board, v33l10 on another —
 * because the silkscreen prints the name more than once. A behaviour driving
 * a pin called "v33" would be driving a pin that does not exist, which is
 * silent: the pin is simply never stamped and the rail reads zero.
 */
export function espRailIds(p: Params): {
  v33: string[]
  vin: string[]
  reset: string[]
} {
  const b = board(p)
  const v33: string[] = []
  const vin: string[] = []
  const reset: string[] = []
  for (const [side, list] of [['l', b.left], ['r', b.right]] as const) {
    list.forEach((pin, i) => {
      const id = portId(side, i, pin)
      if (pin.kind === 'v33') v33.push(id)
      else if (pin.kind === 'vin' || pin.kind === 'v5') vin.push(id)
      else if (pin.kind === 'en') reset.push(id)
    })
  }
  return { v33, vin, reset }
}

/** Every port the behaviour has to be handed, in board order. */
export function espPinIds(p: Params): string[] {
  const b = board(p)
  const out: string[] = []
  for (const [side, list] of [['l', b.left], ['r', b.right]] as const) {
    list.forEach((pin, i) => {
      if (pin.kind === 'nc') return
      out.push(portId(side, i, pin))
    })
  }
  return out
}

/**
 * The pin the behaviour measures everything against.
 *
 * Every ground on the board shares a groupId, so any one of them is the same
 * node; this just has to name one that exists on the selected board.
 */
export function espGroundId(p: Params): string {
  const b = board(p)
  for (const [side, list] of [['l', b.left], ['r', b.right]] as const) {
    const i = list.findIndex((x) => x.kind === 'gnd')
    if (i >= 0) return portId(side, i, list[i])
  }
  return 'gnd'
}

/** The pin map a sketch sees: sparse by GPIO number, plus the D-names. */
export function espSketchPins(p: Params): {
  digital: string[]
  analog: string[]
  aliases: Record<string, string>
  gpioNumbers: boolean
} {
  const b = board(p)
  const digital: string[] = []
  const analog: string[] = []
  const aliases: Record<string, string> = {}
  for (const [side, list] of [['l', b.left], ['r', b.right]] as const) {
    list.forEach((pin, i) => {
      if (pin.kind !== 'gpio' && pin.kind !== 'adc') return
      const id = portId(side, i, pin)
      if (pin.gpio !== undefined) digital[pin.gpio] = id
      if (pin.adc !== undefined) analog[pin.adc] = id
      if (pin.alias) aliases[pin.alias] = id
    })
  }
  // A bare number in a sketch for one of these is a GPIO number, not an
  // Arduino pin number. Without this the runtime applies the Uno's rule that
  // 14 and up mean the analogue pins, and digitalWrite(25) lands elsewhere.
  return { digital, analog, aliases, gpioNumbers: true }
}

const espBoard: PartDef = {
  id: 'esp-board',
  name: 'ESP board',
  category: 'module',
  blurb: 'ESP32 and ESP8266 devkits, by the board',
  tags: [
    'esp', 'esp32', 'esp8266', 'wifi', 'bluetooth', 'devkit', 'nodemcu', 'wemos',
    'd1 mini', 'doit', 'devkitc', 'espressif', 'microcontroller', 'iot', 'module', 'board',
  ],
  doc: {
    manufacturer: 'Espressif',
    price: 7,
    datasheet: 'https://www.espressif.com/en/support/documents/technical-documents',
    description:
      'A family rather than a part. Pick the board you have and you get its pins, in its order, with its numbers: a sketch that writes to pin 2 reaches the pin marked 2. All of them are 3.3 V logic and none of them are 5 V tolerant, which is the single most common way to kill one.',
  },
  params: [
    {
      key: 'board', label: 'Board', type: 'enum', default: DEFAULT_BOARD, group: 'Board',
      options: Object.entries(ESP_BOARDS).map(([value, b]) => ({ value, label: b.label })),
    },
    {
      key: 'program', label: 'Sketch', type: 'enum', default: 'blink', group: 'Control',
      options: [
        { value: 'blink', label: 'Blink the on-board LED' },
        { value: 'custom', label: 'Your own sketch' },
        { value: 'off', label: 'No program, all pins input' },
      ],
    },
    {
      key: 'code', label: 'Program', type: 'code', language: 'javascript',
      default: `// 3.3 V logic. GPIO numbers, or the D-names where the board prints them.
function setup() {
  pinMode(2, OUTPUT)
}

function* loop() {
  digitalWrite(2, HIGH)
  yield delay(400)
  digitalWrite(2, LOW)
  yield delay(400)
}
`,
      group: 'Control',
      showIf: (p) => p.program === 'custom',
      help: 'setup() runs once, loop() runs over and over. Write loop as function* and use yield delay(ms) to wait.',
    },
    {
      key: 'interval', label: 'Blink interval', type: 'number', unit: 's',
      default: 0.5, min: 0.02, max: 10, step: 0.05, group: 'Control',
      showIf: (p) => p.program === 'blink',
    },
    {
      key: 'power', label: 'Powered from', type: 'enum', default: 'usb', group: 'Control',
      options: [{ value: 'usb', label: 'USB' }, { value: 'vin', label: 'VIN / 5 V pin' }],
    },
  ],
  solids: espSolids,
  ports: espPorts,
  mass: (p) => (board(p).d * board(p).w * 1.2 * 1.9e-3) + 2,
  electrical: {
    devices: (p) => [
      {
        type: 'behavioral',
        evalId: 'esp',
        ref: espGroundId(p),
        /* Every board here brings out more pins than any one build uses, and
           a DevKitC has thirty-four. See sparsePins in netlist.ts: without it
           each unused pin's pull-down is a node the solver has to carry. */
        sparsePins: true,
        pins: espPinIds(p),
      },
    ],
    limits: { vmax: 3.6, imax: 0.012 },
  },
  readouts: (p) => {
    const b = board(p)
    const io = [...b.left, ...b.right].filter((x) => x.kind === 'gpio' || x.kind === 'adc').length
    const adc = [...b.left, ...b.right].filter((x) => x.adc !== undefined).length
    return [
      { label: 'Board', value: b.label },
      { label: 'Processor', value: b.cpu },
      { label: 'Logic level', value: `${b.logic} V, not 5 V tolerant` },
      { label: 'Usable I/O', value: `${io} pins, ${adc} with an ADC` },
      { label: 'Per-pin current', value: `${Math.round(b.imax * 1000)} mA` },
      { label: 'Peak draw', value: `~${Math.round(b.wifiPeak * 1000)} mA with the radio on` },
      { label: 'Powered from', value: str(p, 'power', 'usb') === 'usb' ? 'USB (5 V)' : 'VIN / 5 V pin' },
    ]
  },
}

registerParts([espBoard])
