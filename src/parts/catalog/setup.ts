import type { DeviceModel, ElectricalSpec, Material, Params, PartDef, Port, Solid, Vec3 } from '../kernel/types'
import { registerParts } from '../kernel/registry'
import { bool, num, str } from './_helpers'
import { WALL, connectorPorts } from './_mains'

/**
 * The things on a desk and in a room, and the mains that feeds them.
 *
 * The rest of the catalog is what you put on a bench. This is what the bench
 * is plugged into, and what else is in the room: sockets, extension leads, a
 * breaker, a tower, a monitor, a television, a projector, a console, a phone.
 * They are here because the question people actually arrive with is rarely
 * "what resistor" — it is "will all of this run off that one socket", "does
 * the desk fit the arm", "how long does that HDMI run have to be". Those are
 * answerable, and nothing else in the catalog could answer them.
 *
 * ------------------------------------------------------------------
 * The mains convention, which everything in this file obeys
 * ------------------------------------------------------------------
 *
 * Three ports: `l`, `n`, `e`. Live, neutral, earth, in that order, and every
 * appliance and every socket uses the same three names so a lead goes between
 * any two of them without thinking about it.
 *
 * A socket is a source. It is the one place a voltage comes from, and it
 * carries the supply's impedance with it — 0.35 ohm, which is a realistic
 * loop for a domestic final circuit and is why a kettle dims the lights.
 * Everything else is a load: watts in, resistance out, at the nominal voltage
 * of the region the part is set to.
 *
 * Earth is bonded to neutral inside the socket, as it is at the supply head.
 * That is not decoration: without it, every earth pin in the build is a
 * floating node and the solver has nothing to reference them to.
 *
 * The solver is DC and mains is not, which matters less than it sounds. What
 * these parts are asked is how much current a thing draws, what that does to
 * the volt drop, and whether the total trips something — and all three of
 * those are answered by the RMS numbers a DC solve gives. Power factor is not
 * modelled, so a motor load reads optimistically.
 *
 * Current ratings are real and they are enforced: `limits.imax` on a socket
 * is 13 A because a British socket is 13 A, and the engine says so when a
 * build goes past it rather than leaving it to be discovered.
 */

/* ------------------------------------------------------------------ */
/* Shared bits                                                         */
/* ------------------------------------------------------------------ */

/*
 * A region is a country, and a country is a plug.
 *
 * This used to be three hand-written rows carrying a voltage and a
 * current. It is now derived from the plug standards table, because
 * they were the same fact written twice: a socket in Japan is 100 V
 * because it is a NEMA 1-15 socket, and keeping the voltage next to
 * the connector is what stops the two drifting apart.
 */
const REGION_STANDARD: Record<string, string> = {
  uk: 'bs1363',
  eu: 'schuko',
  us: 'nema5-15',
  au: 'as3112',
  jp: 'nema1-15',
  cn: 'gb2099',
  in: 'bs546',
  ch: 'sev1011',
  it: 'cei23-50',
  br: 'nbr14136',
}

const REGIONS: Record<string, { v: number; label: string; amps: number; standard: string }> =
  Object.fromEntries(
    Object.entries(REGION_STANDARD).map(([code, standard]) => {
      const w = WALL[standard]
      return [code, { v: w.v ?? 230, label: w.label, amps: w.amps, standard }]
    }),
  )

const REGION_PARAM = {
  key: 'region', label: 'Region', type: 'enum' as const, default: 'uk', group: 'Mains',
  options: Object.entries(REGIONS).map(([value, r]) => ({ value, label: r.label })),
}

/** The wall standard a part's region implies. */
const regionStandard = (p: Params): string =>
  (REGIONS[str(p, 'region', 'uk')] ?? REGIONS.uk).standard

const volts = (p: Params): number => (REGIONS[str(p, 'region', 'uk')] ?? REGIONS.uk).v

const PLASTIC = { color: '#E8E6E1', rough: 0.55, density: 1.4 }
const DARK = { color: '#16181C', rough: 0.72, density: 1.2 }
const GLASS_OFF = { color: '#0B0D11', rough: 0.14, clearcoat: 0.9, density: 2.4 }
const ALU = { color: '#B9BEC6', metal: 1, rough: 0.38, density: 2.7 }
const STEEL = { color: '#8B9099', metal: 1, rough: 0.5, density: 7.8 }

/** A lit panel, dimmer the bigger it is, because that is how they read. */
const screen = (on: boolean, tint = '#3A5878'): Material =>
  on
    ? { color: '#1E2836', rough: 0.14, clearcoat: 0.8, density: 2.4, emissive: tint, emissiveIntensity: 0.55 }
    : GLASS_OFF

/**
 * Live, neutral and earth, leaving a face, as one connector.
 *
 * The default is an IEC C14 inlet, because that is what the back of a
 * monitor, a PC, an amplifier or a bench supply actually has: a male
 * three-pin inlet that a kettle lead goes into. Forty-odd parts call
 * this, so the default is what decides whether plugging something in
 * is one click or six, and an appliance inlet is the right guess for
 * nearly all of them. Sockets and plugs say otherwise explicitly.
 *
 * `imax` stays at 16 rather than taking the connector's own rating.
 * The port figure feeds the wire-gauge warning and the part's own
 * `limits.imax` is what enforces the rating, so lowering it here would
 * change what the existing builds report without telling anybody
 * anything new.
 */
function mainsPorts(
  at: Vec3,
  dir: Vec3,
  prefix = '',
  spread: Vec3 = [8, 0, 0],
  standard = 'iec-c14',
  end: 'plug' | 'socket' = 'plug',
): Port[] {
  return connectorPorts({ at, dir, standard, end, prefix, spread, imax: 16 })
}

/**
 * An appliance, electrically: a resistor across live and neutral sized to
 * draw the stated power, and an earth that goes nowhere.
 *
 * The earth really does go nowhere — it is bonded at the socket, and an
 * appliance that bonded it again would be a second path and a solver loop.
 * Modelling it as a very large resistance to live keeps the pin a real node
 * so a missing earth is visible as a missing wire rather than as nothing.
 */
function load(wattsOf: (p: Params) => number, extra: (p: Params) => DeviceModel[] = () => []): ElectricalSpec {
  return {
    devices: (p) => {
      const v = volts(p)
      const w = Math.max(0.1, wattsOf(p))
      return [
        { type: 'resistor', a: 'l', b: 'n', r: (v * v) / w },
        // Class I leakage, and the node earth needs to exist at all.
        { type: 'resistor', a: 'e', b: 'n', r: 2e6 },
        ...extra(p),
      ]
    },
    limits: { vmax: 400 },
  }
}

/** Watts drawn now, from an on/standby pair. */
const dutyWatts = (p: Params, run: number, idle: number): number => (bool(p, 'on', true) ? run : idle)

const amps = (p: Params, w: number): string => `${(w / volts(p)).toFixed(2)} A at ${volts(p)} V`

/* ================================================================== */
/* Mains                                                               */
/* ================================================================== */

const wallOutlet: PartDef = {
  id: 'outlet-mains',
  name: 'Wall socket',
  category: 'mains',
  blurb: 'A double socket on a ring, and the only source in the room',
  tags: ['socket', 'outlet', 'wall socket', 'mains', 'plug socket', 'power', '13a', 'ring main', 'gpo', 'receptacle'],
  doc: {
    price: 6,
    description:
      'A twin socket outlet. It is the source every mains build starts at: it supplies the region voltage through a realistic loop impedance, bonds earth to neutral the way the supply head does, and is rated at what the socket is actually rated at, so a build that asks for more says so.',
  },
  params: [
    REGION_PARAM,
    { key: 'ways', label: 'Sockets', type: 'enum', default: '2', group: 'Outlet', options: [{ value: '1', label: 'Single' }, { value: '2', label: 'Double' }] },
    { key: 'switched', label: 'Switched', type: 'bool', default: true, group: 'Outlet' },
    { key: 'loop', label: 'Loop impedance', type: 'number', unit: 'Ω', default: 0.35, min: 0.05, max: 2, step: 0.05, group: 'Mains', help: 'How much the supply sags under load. A short final circuit is about a third of an ohm; a long spur is more.' },
  ],
  solids: (p) => {
    const two = str(p, 'ways', '2') === '2'
    const W = two ? 146 : 86
    const out: Solid[] = [
      { kind: 'box', mat: PLASTIC, size: [W, 86, 10], at: [0, 0, 5], bevel: 2.5 },
      { kind: 'box', mat: { ...PLASTIC, color: '#D8D5CF' }, size: [W - 10, 76, 2], at: [0, 0, 11], bevel: 1 },
    ]
    const faces = two ? [-36, 36] : [0]
    for (const fx of faces) {
      // Earth above, live and neutral below: the British arrangement, and the
      // reason the earth pin is the one that opens the shutters.
      out.push({ kind: 'box', mat: DARK, size: [8, 4, 3], at: [fx, 14, 11.5] })
      out.push({ kind: 'box', mat: DARK, size: [4, 8, 3], at: [fx - 11, -2, 11.5] })
      out.push({ kind: 'box', mat: DARK, size: [4, 8, 3], at: [fx + 11, -2, 11.5] })
      if (bool(p, 'switched', true)) {
        out.push({ kind: 'box', mat: { ...PLASTIC, color: '#F2F0EC' }, size: [16, 9, 4], at: [fx, -28, 12], bevel: 1 })
      }
    }
    return out
  },
  ports: (p) => {
    const two = str(p, 'ways', '2') === '2'
    const faces: [number, string][] = two ? [[-36, 'a'], [36, 'b']] : [[0, '']]
    const std = regionStandard(p)
    return faces.flatMap(([fx, prefix]) =>
      mainsPorts([fx, -2, 14], [0, 0, 1], prefix, [11, 0, 0], std, 'socket'),
    )
  },
  electrical: {
    devices: (p) => {
      const v = volts(p)
      const z = num(p, 'loop', 0.35)
      const two = str(p, 'ways', '2') === '2'
      if (!two) {
        return [
          { type: 'vsource', v, a: 'l', b: 'n', rint: z },
          { type: 'short', a: 'e', b: 'n' },
        ]
      }
      /* Two faces of one socket, not two sockets. They are the same pair of
         terminals behind the same faceplate, which is exactly why plugging
         two three-kilowatt things into one double socket is a problem. */
      return [
        { type: 'vsource', v, a: 'al', b: 'an', rint: z },
        { type: 'short', a: 'ae', b: 'an' },
        { type: 'short', a: 'al', b: 'bl' },
        { type: 'short', a: 'an', b: 'bn' },
        { type: 'short', a: 'ae', b: 'be' },
      ]
    },
    supplies: ['l', 'al', 'bl'],
    limits: { imax: 13, vmax: 400 },
  },
  readouts: (p) => {
    const r = REGIONS[str(p, 'region', 'uk')] ?? REGIONS.uk
    return [
      { label: 'Supply', value: `${r.v} V, ${r.amps} A` },
      { label: 'Loop impedance', value: `${num(p, 'loop', 0.35).toFixed(2)} Ω` },
      {
        label: 'Both faces',
        value: str(p, 'ways', '2') === '2' ? 'One pair of terminals, shared' : 'Single',
      },
    ]
  },
}

/**
 * Where the plug on an extension lead ends up, relative to the body.
 *
 * One place, whatever the flex length. The plug is a port and a port has to
 * be somewhere a person can find it and a wire can reach it; putting it at
 * the far end of however much cable was specified means a two-metre lead
 * has its plug two metres away, which is true of the cable and useless as a
 * drawing.
 */
const PLUG_AT = (bodyLen: number): Vec3 => [-bodyLen / 2 - 170, 6, 120]

const extensionLead: PartDef = {
  id: 'extension-lead',
  /*
   * The scan is a four-way UK strip. Ask for two, six or eight ways, or
   * another region's sockets, and the solids draw that at the real pitch,
   * because a mesh showing four UK sockets under a part that says six Schuko
   * is worse than a plain box.
   *
   * The scan came with its own coiled flex, which has been taken out of the
   * file: it was one fixed length under a part whose length is a parameter,
   * and it was in the box the strip was fitted to, so the strip drew at a
   * fifth of its size with every socket's port in the air beside it. The
   * flex below is drawn with the model and follows the length.
   */
  model: (p) =>
    str(p, 'ways', '4') === '4' && str(p, 'region', 'uk') === 'uk'
      ? { url: 'models/extension-lead-uk.glb', fit: 'bbox', rot: [90, 90, 0], axes: { y: 'fill', z: 'fill' }, credit: { title: 'Power strip extension lead', author: 'Sousinho', license: 'CC-BY-4.0', source: 'https://sketchfab.com/3d-models/power-strip-extension-lead-2180b1f7b55b433285cbe08181a9e88a' } }
      : undefined,
  name: 'Extension lead',
  category: 'mains',
  blurb: 'Four or six ways behind one plug and one fuse',
  tags: ['extension', 'extension lead', 'power strip', 'surge', 'multi socket', 'trailing socket', 'gang', 'mains'],
  doc: {
    price: 14,
    description:
      'A trailing socket. Everything on it is behind one plug, one fuse and one flex, which is the whole point and the whole problem: six ways does not mean six times the current, and this part is rated at what the flex is rated at.',
  },
  params: [
    REGION_PARAM,
    { key: 'ways', label: 'Ways', type: 'enum', default: '4', group: 'Lead', options: ['2', '4', '6', '8'].map((v) => ({ value: v, label: `${v} way` })) },
    { key: 'length', label: 'Flex length', type: 'number', unit: 'mm', default: 2000, min: 500, max: 10000, step: 250, group: 'Lead' },
    { key: 'fuse', label: 'Plug fuse', type: 'enum', default: '13', group: 'Lead', options: ['3', '5', '10', '13'].map((v) => ({ value: v, label: `${v} A` })) },
    { key: 'switched', label: 'Individually switched', type: 'bool', default: false, group: 'Lead' },
  ],
  solids: (p) => {
    const n = parseInt(str(p, 'ways', '4'), 10) || 4
    // A BS 1363 face is wider than a Schuko one, and a UK strip is spaced to
    // suit: four ways is about 300 mm, not 250.
    const pitch = str(p, 'region', 'uk') === 'uk' ? 70 : 56
    const L = n * pitch + 26
    const out: Solid[] = [
      { kind: 'box', mat: DARK, size: [L, 52, 34], at: [0, 0, 17], bevel: 4 },
    ]
    for (let i = 0; i < n; i++) {
      const x = -L / 2 + 13 + pitch / 2 + i * pitch
      out.push({ kind: 'box', mat: { color: '#0A0B0D', rough: 0.6, density: 1.2 }, size: [34, 34, 2], at: [x, 2, 34], bevel: 2 })
      out.push({ kind: 'box', mat: { color: '#202228', rough: 0.8, density: 1.2 }, size: [7, 3.5, 3], at: [x, 13, 34] })
      out.push({ kind: 'box', mat: { color: '#202228', rough: 0.8, density: 1.2 }, size: [3.5, 7, 3], at: [x - 9, 0, 34] })
      out.push({ kind: 'box', mat: { color: '#202228', rough: 0.8, density: 1.2 }, size: [3.5, 7, 3], at: [x + 9, 0, 34] })
      if (bool(p, 'switched', false)) {
        out.push({
          kind: 'box',
          mat: { color: '#C0342B', rough: 0.4, density: 1.2, emissive: '#FF3A26', emissiveIntensity: 0.5 },
          size: [12, 7, 3], at: [x, -18, 34], bevel: 0.8,
        })
      }
    }
    /*
     * The flex, coiled on the floor rather than run out straight.
     *
     * Straight, it put the plug two metres from the body — and the plug is
     * a port, so the thing you wire to the socket ended up a room away from
     * the socket with a cable drawn across everything in between. Nobody
     * lays an extension lead out straight anyway; the slack goes in a coil
     * behind whatever it is feeding, which is both what it looks like and
     * what puts the plug somewhere predictable.
     *
     * The coil is drawn to roughly the length it is: a longer flex is more
     * turns and a wider coil. The readout gives the real figure.
     */
    const len = num(p, 'length', 2000)
    const turns = Math.max(0.55, Math.min(3, (len / 1000) * 0.72))
    const r0 = 54
    const r1 = r0 + turns * 30
    const cx = -L / 2 - r1 - 26
    const steps = Math.ceil(turns * 18)
    const path: Vec3[] = [[-L / 2, 14, 0]]
    for (let i = 0; i <= steps; i++) {
      const t = i / steps
      const ang = Math.PI * 0.35 + t * turns * Math.PI * 2
      const r = r0 + (r1 - r0) * t
      path.push([cx + Math.cos(ang) * r, 5, Math.sin(ang) * r])
    }
    path.push(PLUG_AT(L))
    out.push({
      // A cable, not a wall: it is drawn, it is weighed, and nothing routes
      // around it.
      noCollide: true,
      withModel: true,
      kind: 'tube', mat: { color: '#111318', rough: 0.85, density: 1.3 }, r: 4, seg: 10, path,
    })
    return out
  },
  ports: (p) => {
    const n = parseInt(str(p, 'ways', '4'), 10) || 4
    // A BS 1363 face is wider than a Schuko one, and a UK strip is spaced to
    // suit: four ways is about 300 mm, not 250.
    const pitch = str(p, 'region', 'uk') === 'uk' ? 70 : 56
    const L = n * pitch + 26
    const std = regionStandard(p)
    const out: Port[] = mainsPorts(PLUG_AT(L), [-1, 0, 0], '', [0, 7, 0], std, 'plug')
    for (let i = 0; i < n; i++) {
      const x = -L / 2 + 13 + pitch / 2 + i * pitch
      out.push(...mainsPorts([x, 0, 36], [0, 0, 1], String(i + 1), [9, 0, 0], std, 'socket'))
    }
    return out
  },
  electrical: {
    devices: (p) => {
      const n = parseInt(str(p, 'ways', '4'), 10) || 4
      const out: DeviceModel[] = []
      /* The flex has resistance and six ways of load all go through it, which
         is the thing a block diagram of an extension lead hides. 1.25 mm2 at
         0.014 ohm a metre, there and back. */
      const metres = num(p, 'length', 2000) / 1000
      out.push({ type: 'resistor', a: 'l', b: '#bus-l', r: Math.max(0.005, metres * 0.014) })
      out.push({ type: 'resistor', a: 'n', b: '#bus-n', r: Math.max(0.005, metres * 0.014) })
      out.push({ type: 'short', a: 'e', b: '#bus-e' })
      for (let i = 1; i <= n; i++) {
        out.push({ type: 'short', a: '#bus-l', b: `${i}l` })
        out.push({ type: 'short', a: '#bus-n', b: `${i}n` })
        out.push({ type: 'short', a: '#bus-e', b: `${i}e` })
      }
      return out
    },
    limits: { imax: 13, vmax: 400 },
  },
  price: (p) => 8 + (parseInt(str(p, 'ways', '4'), 10) || 4) * 1.4 + num(p, 'length', 2000) * 0.002,
  readouts: (p) => [
    { label: 'Total capacity', value: `${str(p, 'fuse', '13')} A, shared by every way` },
    { label: 'At 230 V', value: `${(parseInt(str(p, 'fuse', '13'), 10) || 13) * 230} W across the whole lead` },
    { label: 'Flex', value: `${(num(p, 'length', 2000) / 1000).toFixed(1)} m of 1.25 mm²` },
  ],
}

const breaker: PartDef = {
  id: 'breaker-mcb',
  name: 'Circuit breaker',
  category: 'mains',
  blurb: 'A DIN-rail MCB, rated and curved',
  tags: ['mcb', 'breaker', 'circuit breaker', 'consumer unit', 'trip', 'rcbo', 'din rail', 'protection'],
  doc: {
    price: 9,
    description:
      'A miniature circuit breaker on 35 mm rail. The rating is the current it will carry all day; the curve is how much more it tolerates briefly, which is why a motor circuit is on a C and a lighting circuit is on a B.',
  },
  params: [
    { key: 'rating', label: 'Rating', type: 'enum', default: '16', group: 'Breaker', options: ['6', '10', '16', '20', '32', '40'].map((v) => ({ value: v, label: `${v} A` })) },
    { key: 'curve', label: 'Curve', type: 'enum', default: 'B', group: 'Breaker', options: [{ value: 'B', label: 'B, 3-5x' }, { value: 'C', label: 'C, 5-10x' }, { value: 'D', label: 'D, 10-20x' }] },
    { key: 'on', label: 'Closed', type: 'bool', default: true, group: 'Breaker' },
  ],
  solids: (p) => {
    const on = bool(p, 'on', true)
    return [
      { kind: 'box', mat: { color: '#F0EDE6', rough: 0.6, density: 1.4 }, size: [17.5, 80, 68], at: [0, 0, 34], bevel: 1 },
      { kind: 'box', mat: DARK, size: [18, 18, 10], at: [0, 10, 73], bevel: 1.5 },
      {
        kind: 'box',
        mat: on ? { color: '#C62E22', rough: 0.4, density: 1.2 } : { color: '#2A2D33', rough: 0.6, density: 1.2 },
        size: [11, 22, 7], at: [0, on ? 18 : 2, 76], rot: [on ? -12 : 12, 0, 0], bevel: 1,
      },
      { kind: 'box', mat: STEEL, size: [14, 10, 4], at: [0, 34, 10] },
      { kind: 'box', mat: STEEL, size: [14, 10, 4], at: [0, -34, 10] },
    ]
  },
  ports: () => [
    { id: 'l', label: 'Line in', kind: 'electrical', pos: [0, 40, 10], dir: [0, 1, 0], role: 'passive', imax: 63 },
    { id: 'out', label: 'Load out', kind: 'electrical', pos: [0, -40, 10], dir: [0, -1, 0], role: 'passive', imax: 63 },
    { id: 'rail', label: 'DIN clip', kind: 'mechanical', pos: [0, 0, 0], dir: [0, 0, -1], mate: { type: 'face' } },
  ],
  electrical: {
    devices: (p) => [{ type: 'switch', a: 'l', b: 'out', closed: bool(p, 'on', true), ron: 0.004, roff: 1e9 }],
    limits: { imax: 40, vmax: 500 },
  },
  readouts: (p) => {
    const a = parseInt(str(p, 'rating', '16'), 10) || 16
    const mult = { B: 4, C: 7, D: 14 }[str(p, 'curve', 'B')] ?? 4
    return [
      { label: 'Holds', value: `${a} A continuously` },
      { label: 'Trips instantly at', value: `about ${a * mult} A` },
      { label: 'At 230 V', value: `${a * 230} W of load` },
    ]
  },
}

const usbCharger: PartDef = {
  id: 'charger-usb-mains',
  name: 'USB charger',
  category: 'mains',
  blurb: 'A mains plug with USB-C out, rated in watts',
  tags: ['charger', 'usb charger', 'usb-c', 'pd', 'power delivery', 'phone charger', 'plug', 'gan', 'adapter'],
  doc: {
    price: 20,
    description:
      'A plug-top supply. The rating is what the USB-C port will negotiate; what it draws from the wall is that plus the conversion loss, which at these sizes is six or seven per cent.',
  },
  params: [
    REGION_PARAM,
    { key: 'watts', label: 'Output', type: 'enum', default: '45', group: 'Charger', options: ['20', '30', '45', '65', '100'].map((v) => ({ value: v, label: `${v} W` })) },
    { key: 'ports', label: 'Ports', type: 'enum', default: '1', group: 'Charger', options: [{ value: '1', label: 'One USB-C' }, { value: '2', label: 'Two USB-C' }] },
    { key: 'load', label: 'Delivering', type: 'number', unit: '%', default: 60, min: 0, max: 100, step: 5, group: 'Control' },
  ],
  solids: (p) => {
    const w = parseInt(str(p, 'watts', '45'), 10) || 45
    const s = 30 + w * 0.16
    const two = str(p, 'ports', '1') === '2'
    const out: Solid[] = [
      { kind: 'box', mat: { color: '#F4F3F0', rough: 0.45, density: 1.4 }, size: [s, s, 30], at: [0, 0, 15], bevel: 5 },
    ]
    const slots = two ? [-8, 8] : [0]
    for (const sx of slots) out.push({ kind: 'box', mat: DARK, size: [9, 3, 3], at: [sx, -s / 2 + 9, 31] })
    // Pins, folded out.
    out.push({ kind: 'box', mat: { color: '#C8A227', metal: 1, rough: 0.45, density: 8 }, size: [7, 4, 18], at: [0, 11, -9] })
    out.push({ kind: 'box', mat: { color: '#C8A227', metal: 1, rough: 0.45, density: 8 }, size: [4, 7, 18], at: [-11, -5, -9] })
    out.push({ kind: 'box', mat: { color: '#C8A227', metal: 1, rough: 0.45, density: 8 }, size: [4, 7, 18], at: [11, -5, -9] })
    return out
  },
  ports: (p) => {
    const w = parseInt(str(p, 'watts', '45'), 10) || 45
    const s = 30 + w * 0.16
    const out = mainsPorts([0, 0, -18], [0, 0, -1], '', [11, 0, 0])
    const slots = str(p, 'ports', '1') === '2' ? [-8, 8] : [0]
    slots.forEach((sx, i) => {
      out.push({ id: `vbus${i + 1}`, label: `USB-C ${i + 1} +5 V`, kind: 'electrical', pos: [sx - 2, -s / 2 + 9, 33], dir: [0, 0, 1], role: 'power', imax: 5, solderable: false })
      out.push({ id: `gnd${i + 1}`, label: `USB-C ${i + 1} GND`, kind: 'electrical', pos: [sx + 2, -s / 2 + 9, 33], dir: [0, 0, 1], role: 'gnd', imax: 5, solderable: false })
    })
    return out
  },
  electrical: {
    devices: (p) => {
      const rated = parseInt(str(p, 'watts', '45'), 10) || 45
      const drawn = (rated * num(p, 'load', 60)) / 100 / 0.93
      const v = volts(p)
      const out: DeviceModel[] = [
        { type: 'resistor', a: 'l', b: 'n', r: (v * v) / Math.max(0.3, drawn) },
        { type: 'resistor', a: 'e', b: 'n', r: 2e6 },
      ]
      /* Power delivery negotiates up, it does not sit at five volts: a 20 W
         plug settles at 9, a 30 W at 15, anything bigger at 20. Modelling
         them all as 5 V makes every charger look like it is pushing four
         times the current it really is. */
      const pd = rated >= 45 ? 20 : rated >= 30 ? 15 : 9
      const slots = str(p, 'ports', '1') === '2' ? 2 : 1
      for (let i = 1; i <= slots; i++) {
        out.push({ type: 'vsource', v: pd, a: `vbus${i}`, b: `gnd${i}`, rint: 0.05 })
      }
      return out
    },
    supplies: ['vbus1', 'vbus2'],
    limits: { vmax: 400 },
  },
  readouts: (p) => {
    const rated = parseInt(str(p, 'watts', '45'), 10) || 45
    const drawn = (rated * num(p, 'load', 60)) / 100 / 0.93
    return [
      { label: 'Rated', value: `${rated} W over USB-C, at ${rated >= 45 ? 20 : rated >= 30 ? 15 : 9} V` },
      { label: 'Drawing now', value: `${drawn.toFixed(1)} W, ${amps(p, drawn)}` },
      { label: 'Conversion loss', value: `${(drawn - (rated * num(p, 'load', 60)) / 100).toFixed(1)} W as heat` },
    ]
  },
}

const smartPlug: PartDef = {
  id: 'plug-smart',
  name: 'Smart plug',
  category: 'mains',
  blurb: 'A relay and a meter between the socket and whatever is on it',
  tags: ['smart plug', 'plug', 'relay', 'energy monitor', 'home automation', 'wifi', 'switch', 'metering'],
  doc: {
    price: 12,
    description:
      'A switched, metered pass-through. It is the cheapest way to find out what something actually costs to leave on, and the cheapest way to make anything in a room controllable.',
  },
  params: [
    REGION_PARAM,
    { key: 'on', label: 'Switched on', type: 'bool', default: true, group: 'Plug' },
    { key: 'tariff', label: 'Tariff', type: 'number', unit: 'p/kWh', default: 25, min: 1, max: 100, step: 1, group: 'Metering' },
  ],
  solids: (p) => [
    { kind: 'box', mat: { color: '#F6F5F2', rough: 0.45, density: 1.4 }, size: [56, 56, 40], at: [0, 0, 20], bevel: 7 },
    { kind: 'box', mat: { color: '#0A0B0D', rough: 0.6, density: 1.2 }, size: [34, 34, 2], at: [0, 0, 40], bevel: 2 },
    { kind: 'box', mat: DARK, size: [7, 3.5, 3], at: [0, 11, 40] },
    { kind: 'box', mat: DARK, size: [3.5, 7, 3], at: [-9, -2, 40] },
    { kind: 'box', mat: DARK, size: [3.5, 7, 3], at: [9, -2, 40] },
    {
      kind: 'cyl', seg: 18, r: 3, h: 1.4, at: [0, -22, 41],
      mat: bool(p, 'on', true)
        ? { color: '#2BE07A', rough: 0.3, density: 1.2, emissive: '#2BE07A', emissiveIntensity: 1.6 }
        : { color: '#2A2D33', rough: 0.6, density: 1.2 },
    },
    { kind: 'box', mat: { color: '#C8A227', metal: 1, rough: 0.45, density: 8 }, size: [7, 4, 18], at: [0, 11, -9] },
    { kind: 'box', mat: { color: '#C8A227', metal: 1, rough: 0.45, density: 8 }, size: [4, 7, 18], at: [-11, -5, -9] },
    { kind: 'box', mat: { color: '#C8A227', metal: 1, rough: 0.45, density: 8 }, size: [4, 7, 18], at: [11, -5, -9] },
  ],
  ports: () => [
    ...mainsPorts([0, 0, -18], [0, 0, -1], '', [11, 0, 0]),
    ...mainsPorts([0, -2, 42], [0, 0, 1], 'out', [11, 0, 0]),
  ],
  electrical: {
    devices: (p) => [
      { type: 'switch', a: 'l', b: 'outl', closed: bool(p, 'on', true), ron: 0.02, roff: 1e9 },
      { type: 'short', a: 'n', b: 'outn' },
      { type: 'short', a: 'e', b: 'oute' },
      // The radio and the meter, which is what it costs when it is "off".
      { type: 'resistor', a: 'l', b: 'n', r: (volts(p) * volts(p)) / 0.7 },
    ],
    limits: { imax: 13, vmax: 400 },
  },
  readouts: (p) => [
    { label: 'Contact', value: bool(p, 'on', true) ? 'Closed' : 'Open' },
    { label: 'Its own draw', value: '0.7 W, always' },
    { label: 'That costs', value: `${((0.7 * 24 * 365 * num(p, 'tariff', 25)) / 100000).toFixed(2)} a year` },
  ],
}

const fanHeater: PartDef = {
  id: 'heater-fan',
  name: 'Fan heater',
  category: 'mains',
  blurb: 'Two kilowatts of resistance wire, and the reason leads melt',
  tags: ['heater', 'fan heater', 'electric heater', 'kettle', 'load', 'kilowatt', 'overload', 'mains', 'appliance'],
  doc: {
    price: 28,
    description:
      'A resistive heater. It is in the catalog because almost nothing else in a room draws real current, and because putting one on an extension lead with everything else is the commonest way a domestic circuit gets into trouble. A kettle, an iron and a toaster are the same part with a different shape.',
  },
  params: [
    REGION_PARAM,
    { key: 'watts', label: 'Setting', type: 'enum', default: '2000', group: 'Heater', options: ['1000', '2000', '3000'].map((v) => ({ value: v, label: `${v} W` })) },
    { key: 'on', label: 'On', type: 'bool', default: true, group: 'Control' },
  ],
  solids: (p) => {
    const hot = bool(p, 'on', true)
    return [
      { kind: 'box', mat: { color: '#EDEAE4', rough: 0.55, density: 1.4 }, size: [230, 250, 150], at: [0, 125, 0], bevel: 10 },
      {
        kind: 'box', size: [170, 150, 4], at: [0, 150, 76],
        mat: hot
          ? { color: '#2A1512', rough: 0.7, density: 1.2, emissive: '#FF5522', emissiveIntensity: 1.1 }
          : { color: '#201E1C', rough: 0.85, density: 1.2 },
      },
      { kind: 'box', mat: { color: '#1C1E22', rough: 0.8, density: 1.2 }, size: [190, 120, 3], at: [0, 150, -76] },
      { kind: 'cyl', mat: { color: '#3A3D44', rough: 0.5, density: 1.2 }, r: 16, h: 10, seg: 20, at: [80, 236, 0], rot: [90, 0, 0] },
    ]
  },
  ports: () => mainsPorts([-60, 20, -78], [0, 0, -1], '', [16, 0, 0]),
  electrical: load((p) => (bool(p, 'on', true) ? parseInt(str(p, 'watts', '2000'), 10) || 2000 : 0.2)),
  readouts: (p) => {
    const w = bool(p, 'on', true) ? parseInt(str(p, 'watts', '2000'), 10) || 2000 : 0.2
    return [
      { label: 'Drawing', value: `${w} W, ${amps(p, w)}` },
      { label: 'On a 13 A lead', value: `${((w / volts(p) / 13) * 100).toFixed(0)} % of it, by itself` },
      { label: 'Flex gets warm at', value: 'about 10 A through 1.25 mm²' },
    ]
  },
}

registerParts([wallOutlet, extensionLead, breaker, usbCharger, smartPlug, fanHeater])

export { REGIONS, REGION_PARAM, regionStandard, volts, load, dutyWatts, amps, mainsPorts, screen, PLASTIC, DARK, ALU, STEEL, GLASS_OFF }
