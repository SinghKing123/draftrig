import type { DeviceModel, PartDef, Port, Solid, Vec3 } from '../kernel/types'
import { registerParts } from '../kernel/registry'
import { bool, num, str } from './_helpers'
import { ALU, DARK, REGION_PARAM, STEEL, amps, load, mainsPorts, volts } from './setup'
import { BLACK_PLASTIC, signalPorts } from './setup2'

/**
 * A room you watch something in.
 *
 * This is the file the whole catalogue is pointed at now. Planning a home
 * theatre is the thing people do with a tape measure, a forum post and a
 * sketch on the back of an envelope, and every decision in it is geometry
 * with one right answer:
 *
 *   The screen size is set by how far back you sit, not by what is on offer.
 *   SMPTE says the image should subtend 30 degrees from the seat and THX
 *   says 36, which for a given screen width is a distance you can work out
 *   and nearly nobody does.
 *
 *   The projector's position is set by the screen. Throw ratio times image
 *   width is the distance, and a 0.8 lens and a 1.5 lens put the same screen
 *   in rooms of entirely different depth.
 *
 *   Brightness is set by both. Lumens spread over the image area gives
 *   foot-lamberts, and the standard for a dark room is 12 to 22. A 2,500
 *   lumen projector on a 120 inch screen is dim and the box it came in does
 *   not say so.
 *
 *   The back row sees the screen or it does not, and that is a line from an
 *   eye point over a headrest. A riser is how you fix it, and how high the
 *   riser needs to be is the same line solved for height.
 *
 * Every one of those is in here as a readout, because they are the reasons
 * somebody would open this instead of a drawing program.
 *
 * Conventions are `setup.ts`: mains as l/n/e, loads in watts at the region
 * voltage, everything authored standing on its own footprint at y = 0 and
 * facing +z. A screen faces +z, which means the seats are at positive z and
 * the projector is behind them.
 */

const SCREEN_WHITE = { color: '#D8D6D0', rough: 0.92, density: 0.6 }
const SCREEN_GREY = { color: '#8A8A88', rough: 0.86, density: 0.6 }
const VELVET = { color: '#121213', rough: 0.99, density: 0.5 }
const LEATHER = { color: '#2B2A2C', rough: 0.55, clearcoat: 0.2, density: 0.9 }
const CARPET_STEP = { color: '#43403C', rough: 0.98, density: 0.4 }

/** Diagonal inches to width and height, mm, at a given aspect. */
function panel(diagonalIn: number, aspect: number): [number, number] {
  const d = diagonalIn * 25.4
  const w = (d * aspect) / Math.hypot(aspect, 1)
  return [w, w / aspect]
}

const ASPECTS: Record<string, { label: string; r: number }> = {
  '16:9': { label: '16:9, television and most film', r: 16 / 9 },
  '2.35': { label: '2.35:1, scope', r: 2.35 },
  '4:3': { label: '4:3, older material', r: 4 / 3 },
  '1:1': { label: '1:1, square, for a projector on its side', r: 1 },
}

/* ================================================================== */
/* The screen, which everything else is measured from                  */
/* ================================================================== */

const projectionScreen: PartDef = {
  id: 'screen-projection',
  // Only the motorised screen: the file is a roller in its case, which is
  // what a motorised screen is and what the other three kinds are not. A
  // fixed frame is a flat rectangle and draws as one.
  model: (p) =>
    str(p, 'kind', 'fixed') === 'motor'
      ? {
          url: 'models/projector-screen.glb',
          fit: 'bbox',
          // The drop varies with the diagonal; the case and its end caps
          // keep their section while it does.
          axes: { y: 'fill', z: [0.1, 0.9] },
          credit: { title: 'Projector Screen_7MB', author: 'Mehdi Shahsavan', license: 'CC-BY-4.0', source: 'https://sketchfab.com/3d-models/projector-screen-7mb-cac0e255058348558715109b97697e07' },
        }
      : undefined,
  name: 'Projection screen',
  category: 'av',
  blurb: 'An image size, and the seat distance that follows from it',
  tags: ['projection screen', 'screen', 'cinema', 'projector', 'fixed frame', 'alr', 'gain', 'home theatre', 'av', '120 inch'],
  doc: {
    price: 420,
    description:
      'The part the rest of a theatre is laid out around. Pick the diagonal and three other numbers fall out of it: where the front row goes, where the back row stops being able to resolve the picture, and how bright the projector has to be to fill it.\n\nThe seating figures here are the published ones. SMPTE puts the nearest seat where the image subtends 30 degrees, THX puts it at 36, and the far limit is where you stop resolving the pixels at all. For a 120 inch 16:9 screen that is 3.3 m, 2.7 m and about 5 m.\n\nGain is the other half of brightness. A 1.0 screen reflects what hits it; a 1.3 screen returns more of it towards the seats and less to the sides, and an ambient-light-rejecting screen trades viewing angle for contrast in a room with a window in it.',
  },
  params: [
    REGION_PARAM,
    { key: 'diagonal', label: 'Diagonal', type: 'number', unit: '"', default: 120, min: 60, max: 200, step: 1, group: 'Screen' },
    { key: 'aspect', label: 'Aspect', type: 'enum', default: '16:9', group: 'Screen', options: Object.entries(ASPECTS).map(([value, a]) => ({ value, label: a.label })) },
    { key: 'gain', label: 'Gain', type: 'number', unit: '', default: 1.1, min: 0.6, max: 2.4, step: 0.05, group: 'Screen' },
    {
      key: 'kind', label: 'Type', type: 'enum', default: 'fixed', group: 'Screen',
      options: [
        { value: 'fixed', label: 'Fixed frame, velvet border' },
        { value: 'motor', label: 'Motorised, drops from a case' },
        { value: 'alr', label: 'ALR, ambient light rejecting' },
        { value: 'wall', label: 'Painted wall, no frame' },
      ],
    },
    { key: 'bottom', label: 'Bottom edge', type: 'number', unit: 'mm', default: 760, min: 0, max: 2000, step: 10, group: 'Mount', help: 'Height off the floor. Seated eye height is about 1100, so the bottom of the screen usually lands between 600 and 900.' },
    { key: 'lumens', label: 'Calibrated lumens', type: 'number', unit: 'lm', default: 1500, min: 150, max: 8000, step: 50, group: 'Image', help: 'What the projector really puts out in the mode you watch in, which the projector part reports. Not the number on the box — that is measured in a mode nobody uses and is about 1.7 times this.' },
    { key: 'dropped', label: 'Dropped', type: 'bool', default: true, group: 'Control', showIf: (p) => str(p, 'kind', 'fixed') === 'motor' },
  ],
  solids: (p) => {
    const [w, h] = panel(num(p, 'diagonal', 120), ASPECTS[str(p, 'aspect', '16:9')]?.r ?? 16 / 9)
    const bottom = num(p, 'bottom', 760)
    const kind = str(p, 'kind', 'fixed')
    /*
     * A screen with a picture on it is the brightest thing in a cinema,
     * and it was being drawn as a flat white board. In a room with the
     * lights off that is a black rectangle: the template photographed as
     * an empty room with some chairs in it, because the one light source
     * in the scene was not emitting anything.
     *
     * The glow is the foot-lambert figure the readouts already work out,
     * mapped onto emission. 16 fL — the middle of the 12 to 22 cinema
     * window — comes out at about 0.5, and a screen set too dim looks too
     * dim, which is the readout saying the same thing in the picture.
     */
    const areaFt2 = (w / 304.8) * (h / 304.8)
    const fl = (num(p, 'lumens', 1500) * num(p, 'gain', 1.1)) / Math.max(0.1, areaFt2)
    const lit = Math.min(1.15, fl / 32)
    const surface = {
      ...(kind === 'alr' ? SCREEN_GREY : SCREEN_WHITE),
      emissive: '#F2F6FF',
      emissiveIntensity: lit,
    }
    const out: Solid[] = []

    if (kind === 'motor') {
      // The case is always there; the fabric is only down when it is down.
      out.push({ kind: 'box', mat: ALU, size: [w + 160, 90, 90], at: [0, bottom + h + 45, 0], bevel: 6 })
      if (bool(p, 'dropped', true)) {
        out.push({ kind: 'box', mat: surface, size: [w, h, 3], at: [0, bottom + h / 2, 10] })
        out.push({ kind: 'box', mat: VELVET, size: [w + 20, 30, 10], at: [0, bottom - 15, 10] })
      }
      return out
    }

    out.push({ kind: 'box', mat: surface, size: [w, h, 6], at: [0, bottom + h / 2, 0] })
    if (kind !== 'wall') {
      /*
       * The velvet border is not decoration. It absorbs the overspill that
       * every projector puts outside the image, which is what makes the
       * edge of the picture look like an edge rather than a fade.
       */
      const b = 60
      out.push({ kind: 'box', mat: VELVET, size: [w + b * 2, b, 22], at: [0, bottom + h + b / 2, 2] })
      out.push({ kind: 'box', mat: VELVET, size: [w + b * 2, b, 22], at: [0, bottom - b / 2, 2] })
      out.push({ kind: 'box', mat: VELVET, size: [b, h, 22], at: [-w / 2 - b / 2, bottom + h / 2, 2] })
      out.push({ kind: 'box', mat: VELVET, size: [b, h, 22], at: [w / 2 + b / 2, bottom + h / 2, 2] })
    }
    return out
  },
  ports: (p) => {
    const [w, h] = panel(num(p, 'diagonal', 120), ASPECTS[str(p, 'aspect', '16:9')]?.r ?? 16 / 9)
    const bottom = num(p, 'bottom', 760)
    const out: Port[] = [
      { id: 'wall', label: 'Wall', kind: 'mechanical', pos: [0, bottom + h / 2, -10], dir: [0, 0, -1], mate: { type: 'face' } },
      /* The three points a projector, a centre speaker and the seats are all
         set from. Worth being ports rather than readouts: you can wire a
         dimension to them. */
      { id: 'centre', label: 'Image centre', kind: 'mechanical', pos: [0, bottom + h / 2, 6], dir: [0, 0, 1], mate: { type: 'face' } },
      { id: 'top', label: 'Image top', kind: 'mechanical', pos: [0, bottom + h, 6], dir: [0, 1, 0], mate: { type: 'face' } },
      { id: 'sill', label: 'Image bottom', kind: 'mechanical', pos: [0, bottom, 6], dir: [0, -1, 0], mate: { type: 'face' } },
    ]
    if (str(p, 'kind', 'fixed') === 'motor') out.push(...mainsPorts([w / 2, bottom + h + 45, -40], [0, 0, -1], '', [10, 0, 0]))
    return out
  },
  mass: (p) => {
    const [w, h] = panel(num(p, 'diagonal', 120), ASPECTS[str(p, 'aspect', '16:9')]?.r ?? 16 / 9)
    const area = (w * h) / 1e6
    return area * (str(p, 'kind', 'fixed') === 'motor' ? 5200 : str(p, 'kind', 'fixed') === 'wall' ? 0 : 3400) + (str(p, 'kind', 'fixed') === 'motor' ? 6000 : 0)
  },
  price: (p) => {
    const d = num(p, 'diagonal', 120)
    const kind = str(p, 'kind', 'fixed')
    const base = kind === 'wall' ? 0.4 : kind === 'motor' ? 5.2 : kind === 'alr' ? 9 : 3.4
    return Math.round(40 + d * base)
  },
  readouts: (p) => {
    const aspect = ASPECTS[str(p, 'aspect', '16:9')]?.r ?? 16 / 9
    const [w, h] = panel(num(p, 'diagonal', 120), aspect)
    const gain = num(p, 'gain', 1.1)
    const lm = num(p, 'lumens', 2500)
    const bottom = num(p, 'bottom', 760)

    /*
     * Foot-lamberts: lumens landing on the screen, over its area in square
     * feet, times gain. The standard for a dark room is 12 to 22 fL, and
     * the honest version subtracts the twenty per cent a lamp loses in its
     * first few hundred hours, which is why the figure here is not the one
     * on the box.
     */
    const areaFt2 = (w / 304.8) * (h / 304.8)
    const fl = (lm * gain) / Math.max(0.1, areaFt2)

    // Viewing angle: 2 * atan(width / 2d) = angle, solved for d.
    const at = (deg: number): number => w / 2 / Math.tan(((deg / 2) * Math.PI) / 180) / 1000

    return [
      { label: 'Image', value: `${(w / 1000).toFixed(2)} × ${(h / 1000).toFixed(2)} m, ${areaFt2.toFixed(1)} sq ft` },
      { label: 'Top edge at', value: `${Math.round(bottom + h)} mm` },
      { label: 'THX seat, 36°', value: `${at(36).toFixed(2)} m back` },
      { label: 'SMPTE seat, 30°', value: `${at(30).toFixed(2)} m back` },
      { label: 'Back row limit', value: `${at(20).toFixed(2)} m, past that it is a television` },
      { label: 'Brightness', value: `${fl.toFixed(1)} fL at ${lm} lm and ${gain.toFixed(2)} gain` },
      {
        /*
         * The bands, and where they come from. SMPTE's figure for a
         * commercial cinema is 14 fL and the window either side of it is
         * 12 to 22. Home projectors routinely run brighter than that and
         * look fine, so anything up to 40 is reported as bright rather
         * than wrong; past 40 in a blacked-out room is fatiguing.
         */
        label: 'Verdict',
        value:
          fl < 12 ? `Dim — wants ${Math.round((12 * areaFt2) / gain)} calibrated lumens`
          : fl <= 22 ? 'In the 12 to 22 fL cinema window'
          : fl <= 40 ? 'Brighter than cinema reference, which most people prefer'
          : 'Very bright for a dark room — close the iris or go bigger',
      },
    ]
  },
}

/* ================================================================== */
/* Seating, and the line of sight over it                              */
/* ================================================================== */

const cinemaSeating: PartDef = {
  id: 'seating-cinema',
  // A scan is one seat or one pair of seats, so it is drawn for one seat
  // or one pair and for nothing else. Stretching a two-seat mesh across a
  // row of five draws two very wide seats, which is the lie this whole
  // system exists to prevent: lay a row out as repeated pairs instead.
  model: (p) => {
    if (num(p, 'seats', 4) === 1) {
      return str(p, 'style', 'recliner') === 'recliner'
        ? {
            url: 'models/recliner.glb',
            fit: 'bbox',
            axes: { y: 'fill', z: 'fill' },
            credit: { title: 'Leather Recliner Couch', author: 'R-LAB', license: 'CC-BY-4.0', source: 'https://sketchfab.com/3d-models/leather-recliner-couch-284a1e2522404c72bcd28b2e92c4850e' },
          }
        : {
            url: 'models/cinema-seat.glb',
            fit: 'bbox',
            axes: { y: 'fill', z: 'fill' },
            credit: { title: 'Cinema Seat', author: 'Connor Wassall', license: 'CC-BY-4.0', source: 'https://sketchfab.com/3d-models/cinema-seat-6c44adbc299c4f8ab45e9913d58cfcba' },
          }
    }
    if (num(p, 'seats', 4) === 2 && str(p, 'style', 'recliner') !== 'sofa')
      return {
        url: 'models/cinema-seat-pair.glb',
        fit: 'bbox',
        axes: { y: 'fill', z: 'fill' },
        credit: { title: 'cinema/movie theater_[seat]', author: 'Comicaroid', license: 'CC-BY-4.0', source: 'https://sketchfab.com/3d-models/cinemamovie-theater-seat-b8bcabfa355d4137910ef2e45b56b9bc' },
      }
    return undefined
  },
  name: 'Cinema seating',
  category: 'cinema',
  blurb: 'A row of recliners, and the depth they need when reclined',
  tags: ['cinema seating', 'recliner', 'seats', 'row', 'home theatre', 'sofa', 'theatre seating', 'chair', 'lounger'],
  doc: {
    price: 1800,
    description:
      'Seats in a row, with the two dimensions people get wrong. A recliner is about 900 mm deep upright and 1,700 mm with the footrest out, so a row placed 1,000 mm off the back wall cannot recline. And eye height sitting is 1,100 to 1,150 mm, which is the number every sightline in the room is drawn from.\n\nThe row width is seats times seat width plus the arms between them, so a four-seat row of 600 mm seats is not 2,400 mm, it is about 2,800.',
  },
  params: [
    { key: 'seats', label: 'Seats', type: 'number', unit: '', default: 4, min: 1, max: 8, step: 1, group: 'Row' },
    { key: 'width', label: 'Seat width', type: 'number', unit: 'mm', default: 600, min: 450, max: 800, step: 10, group: 'Row', help: 'Between the arms. 600 is normal, 700 is generous, 520 is a cinema.' },
    {
      key: 'style', label: 'Style', type: 'enum', default: 'recliner', group: 'Row',
      options: [
        { value: 'recliner', label: 'Powered recliner' },
        { value: 'fixed', label: 'Fixed seat, tip-up' },
        { value: 'sofa', label: 'Sofa, no arms between' },
      ],
    },
    { key: 'reclined', label: 'Reclined', type: 'number', unit: '%', default: 0, min: 0, max: 100, step: 10, group: 'Control' },
    { key: 'eye', label: 'Eye height', type: 'number', unit: 'mm', default: 1120, min: 950, max: 1300, step: 10, group: 'Sightline' },
    { key: 'headrest', label: 'Headrest height', type: 'number', unit: 'mm', default: 1180, min: 900, max: 1400, step: 10, group: 'Sightline', help: 'What the row behind has to see over.' },
    { key: 'powered', label: 'Mains powered', type: 'bool', default: true, group: 'Power' },
  ],
  solids: (p) => {
    const n = Math.round(num(p, 'seats', 4))
    const sw = num(p, 'width', 600)
    const style = str(p, 'style', 'recliner')
    const arm = style === 'sofa' ? 0 : 110
    const pitch = sw + arm
    const rec = num(p, 'reclined', 0) / 100
    const back = num(p, 'headrest', 1180)
    const seatH = 440
    const out: Solid[] = []
    const rowW = n * sw + (style === 'sofa' ? 220 : (n + 1) * arm)

    // Plinth, so the whole row reads as one piece of furniture.
    out.push({ kind: 'box', mat: DARK, size: [rowW, 90, 900], at: [0, 45, 0], bevel: 6 })

    for (let i = 0; i < n; i++) {
      const x = (i - (n - 1) / 2) * pitch
      // Cushion, back, headrest. The back lies down as it reclines and the
      // footrest comes out, which is the whole reason the depth changes.
      out.push({ kind: 'box', mat: LEATHER, size: [sw, 140, 620], at: [x, seatH - 40, 40], bevel: 30 })
      out.push({
        kind: 'box', mat: LEATHER, size: [sw, back - seatH, 180],
        at: [x, seatH + (back - seatH) / 2 - rec * 180, -250 - rec * 240],
        rot: [-8 - rec * 42, 0, 0], bevel: 26,
      })
      if (rec > 0.05) {
        out.push({ kind: 'box', mat: LEATHER, size: [sw - 40, 90, 420 * rec], at: [x, 330, 350 + 210 * rec], rot: [6, 0, 0], bevel: 20 })
      }
      if (style !== 'sofa') {
        for (const s of [-1, 1] as const) {
          out.push({ kind: 'box', mat: LEATHER, size: [arm - 10, 180, 700], at: [x + s * (sw / 2 + arm / 2 - 5), seatH + 60, -20], bevel: 24 })
        }
      }
    }
    if (style === 'sofa') {
      for (const s of [-1, 1] as const) {
        out.push({ kind: 'box', mat: LEATHER, size: [110, 260, 760], at: [s * (rowW / 2 - 55), seatH + 80, -40], bevel: 28 })
      }
    }
    return out
  },
  ports: (p) => {
    const n = Math.round(num(p, 'seats', 4))
    const sw = num(p, 'width', 600)
    const arm = str(p, 'style', 'recliner') === 'sofa' ? 0 : 110
    const rowW = n * sw + (str(p, 'style', 'recliner') === 'sofa' ? 220 : (n + 1) * arm)
    const out: Port[] = [
      { id: 'floor', label: 'Floor', kind: 'mechanical', pos: [0, 0, 0], dir: [0, -1, 0], mate: { type: 'face' } },
      /* The eye point of the middle seat. Every sightline in the room is
         drawn from here, so it is a thing you can snap a dimension to. */
      { id: 'eye', label: 'Eye point', kind: 'mechanical', pos: [0, num(p, 'eye', 1120), -120], dir: [0, 0, 1], mate: { type: 'face' } },
      { id: 'headrest', label: 'Headrest top', kind: 'mechanical', pos: [0, num(p, 'headrest', 1180), -260], dir: [0, 1, 0], mate: { type: 'face' } },
    ]
    if (bool(p, 'powered', true)) out.push(...mainsPorts([-rowW / 2 + 60, 40, -440], [0, 0, -1], '', [10, 0, 0]))
    return out
  },
  electrical: load((p) => {
    if (!bool(p, 'powered', true)) return 0
    const n = Math.round(num(p, 'seats', 4))
    // A recliner motor is 60 W while it is moving and the transformer is
    // 1.5 W a seat the rest of the time, which is the figure that matters
    // because that is what it does all year.
    return num(p, 'reclined', 0) > 0 && num(p, 'reclined', 0) < 100 ? n * 60 : n * 1.5
  }),
  mass: (p) => Math.round(num(p, 'seats', 4)) * (str(p, 'style', 'recliner') === 'recliner' ? 48000 : 26000),
  price: (p) => {
    const n = Math.round(num(p, 'seats', 4))
    const style = str(p, 'style', 'recliner')
    return n * (style === 'recliner' ? 620 : style === 'fixed' ? 180 : 320)
  },
  readouts: (p) => {
    const n = Math.round(num(p, 'seats', 4))
    const sw = num(p, 'width', 600)
    const style = str(p, 'style', 'recliner')
    const arm = style === 'sofa' ? 0 : 110
    const rowW = n * sw + (style === 'sofa' ? 220 : (n + 1) * arm)
    const uprightD = 900
    const reclinedD = style === 'recliner' ? 1700 : 950
    return [
      { label: 'Row', value: `${(rowW / 1000).toFixed(2)} m wide, ${n} seat${n === 1 ? '' : 's'}` },
      { label: 'Depth upright', value: `${uprightD} mm` },
      { label: 'Depth reclined', value: `${reclinedD} mm${style === 'recliner' ? ', so leave 800 mm behind it' : ''}` },
      { label: 'Eye point', value: `${num(p, 'eye', 1120)} mm, ${Math.round(num(p, 'eye', 1120) - 120)} mm forward of the backrest` },
      { label: 'Row behind must clear', value: `${num(p, 'headrest', 1180)} mm` },
    ]
  },
}

const seatingRiser: PartDef = {
  id: 'riser-seating',
  name: 'Seating riser',
  category: 'cinema',
  blurb: 'A platform, sized by the sightline it has to buy',
  tags: ['riser', 'platform', 'stage', 'seating', 'tier', 'cinema', 'sightline', 'home theatre', 'step'],
  doc: {
    price: 380,
    description:
      'A box the back row stands on, and the thing that decides whether the back row can see. The sightline is a straight line from the eye point of the back seat, over the top of the headrest in front, to the bottom of the screen — if that line passes above the headrest, the row behind is watching the film and not the back of a chair.\n\nThe arithmetic is in the readouts, including the height this riser would have to be. A 300 mm riser is normal, 450 is a step people trip on in the dark, and the strip light under the nosing is not decoration.',
  },
  params: [
    { key: 'width', label: 'Width', type: 'number', unit: 'mm', default: 4000, min: 1000, max: 8000, step: 100, group: 'Riser' },
    { key: 'depth', label: 'Depth', type: 'number', unit: 'mm', default: 2200, min: 800, max: 5000, step: 100, group: 'Riser', help: 'Enough for the row plus its recline. A recliner wants 1,700 and 300 of walkway behind.' },
    { key: 'height', label: 'Height', type: 'number', unit: 'mm', default: 300, min: 100, max: 700, step: 10, group: 'Riser' },
    { key: 'step', label: 'Step up', type: 'bool', default: true, group: 'Riser', help: 'An intermediate tread. Over about 300 mm a single step is a trip hazard in the dark.' },
    { key: 'nosing', label: 'Strip light under the nosing', type: 'bool', default: true, group: 'Riser' },
    { key: 'frontEye', label: 'Front row eye height', type: 'number', unit: 'mm', default: 1120, min: 900, max: 1400, step: 10, group: 'Sightline' },
    { key: 'frontHead', label: 'Front row headrest', type: 'number', unit: 'mm', default: 1180, min: 900, max: 1400, step: 10, group: 'Sightline' },
    { key: 'rowGap', label: 'Row spacing', type: 'number', unit: 'mm', default: 1600, min: 800, max: 3000, step: 50, group: 'Sightline', help: 'Front headrest to back eye point, along the floor.' },
    { key: 'screenBottom', label: 'Screen bottom', type: 'number', unit: 'mm', default: 760, min: 0, max: 2000, step: 10, group: 'Sightline' },
    { key: 'toScreen', label: 'Front row to screen', type: 'number', unit: 'mm', default: 3300, min: 1000, max: 12000, step: 100, group: 'Sightline' },
  ],
  solids: (p) => {
    const w = num(p, 'width', 4000)
    const d = num(p, 'depth', 2200)
    const h = num(p, 'height', 300)
    const out: Solid[] = [
      { kind: 'box', mat: { color: '#2E2B28', rough: 0.9, density: 0.6 }, size: [w, h, d], at: [0, h / 2, 0], bevel: 3 },
      { kind: 'box', mat: CARPET_STEP, size: [w, 8, d], at: [0, h + 4, 0] },
    ]
    if (bool(p, 'step', true) && h > 180) {
      const sh = h / 2
      out.push({ kind: 'box', mat: { color: '#2E2B28', rough: 0.9, density: 0.6 }, size: [w * 0.4, sh, 300], at: [0, sh / 2, d / 2 + 150], bevel: 3 })
      out.push({ kind: 'box', mat: CARPET_STEP, size: [w * 0.4, 8, 300], at: [0, sh + 4, d / 2 + 150] })
    }
    if (bool(p, 'nosing', true)) {
      out.push({
        kind: 'box',
        mat: { color: '#E8C98A', rough: 0.8, density: 1.1, emissive: '#FFB860', emissiveIntensity: 0.7 },
        size: [w - 40, 12, 6], at: [0, h - 30, d / 2 + 2], noCollide: true,
      })
    }
    return out
  },
  ports: (p) => {
    const h = num(p, 'height', 300)
    return [
      { id: 'floor', label: 'Floor', kind: 'mechanical', pos: [0, 0, 0], dir: [0, -1, 0], mate: { type: 'face' } },
      { id: 'top', label: 'Deck', kind: 'mechanical', pos: [0, h + 8, 0], dir: [0, 1, 0], mate: { type: 'face' } },
    ]
  },
  mass: (p) => {
    // A timber frame at 400 centres with 18 mm ply over it, not a solid box.
    const w = num(p, 'width', 4000) / 1000
    const d = num(p, 'depth', 2200) / 1000
    const h = num(p, 'height', 300) / 1000
    return (w * d * 13 + (w + d) * 2 * h * 7) * 1000
  },
  price: (p) => Math.round(((num(p, 'width', 4000) * num(p, 'depth', 2200)) / 1e6) * 38 + 60),
  readouts: (p) => {
    const h = num(p, 'height', 300)
    const eye = num(p, 'frontEye', 1120)
    const head = num(p, 'frontHead', 1180)
    const gap = num(p, 'rowGap', 1600)
    const bottom = num(p, 'screenBottom', 760)
    const toScreen = num(p, 'toScreen', 3300)

    /*
     * The sightline, drawn properly.
     *
     * From the back row's eye point, raised by this riser, over the front
     * headrest, to the bottom of the screen. The question is whether the
     * line clears the headrest, and the equivalent question — the useful
     * one — is what riser height would make it clear by 50 mm.
     *
     * Horizontal distances: the back eye is `gap` behind the front headrest,
     * and the front headrest is `toScreen` from the screen, less the depth
     * the headrest sits behind the eye point, which is already in `gap`.
     */
    const backEyeY = eye + h
    const run = toScreen + gap
    // Height of the sightline above the floor as it passes the headrest.
    const atHeadrest = backEyeY + ((bottom - backEyeY) * gap) / Math.max(1, run)
    const clearance = atHeadrest - head
    // Solve the same line for the riser height that gives 50 mm clearance.
    const needed = ((head + 50 - bottom) * run) / Math.max(1, run - gap) + bottom - eye

    return [
      { label: 'Riser', value: `${h} mm, ${(num(p, 'width', 4000) / 1000).toFixed(1)} × ${(num(p, 'depth', 2200) / 1000).toFixed(1)} m` },
      { label: 'Sightline passes', value: `${clearance >= 0 ? `${Math.round(clearance)} mm over` : `${Math.round(-clearance)} mm into`} the headrest in front` },
      { label: 'Needs', value: `${Math.max(0, Math.round(needed / 10) * 10)} mm to clear by 50` },
      { label: 'Headroom lost', value: `${h} mm — a 2400 ceiling becomes ${2400 - h} over this row` },
      { label: 'Step', value: bool(p, 'step', true) ? `Two of ${Math.round(h / 2)} mm` : h > 300 ? `One of ${h} mm, which is a lot in the dark` : `One of ${h} mm` },
    ]
  },
}

/* ================================================================== */
/* Sound                                                               */
/* ================================================================== */

const SPEAKER_ROLES: Record<string, { label: string; angle: number; height: string }> = {
  centre: { label: 'Centre', angle: 0, height: 'Under or over the screen, aimed at ear height' },
  front: { label: 'Front left or right', angle: 30, height: 'Tweeter at seated ear height, 1100 to 1200' },
  wide: { label: 'Front wide', angle: 60, height: 'Ear height' },
  surround: { label: 'Surround', angle: 110, height: '600 mm above ear height, so 1700 to 1800' },
  rear: { label: 'Rear surround', angle: 150, height: '600 mm above ear height' },
  height: { label: 'Height or Atmos', angle: 45, height: 'Ceiling, or an up-firing module' },
}

const surroundSpeaker: PartDef = {
  id: 'speaker-surround',
  // One file per cabinet shape. An on-wall slim has no scan, and
  // stretching a bookshelf into one would draw a speaker that does not
  // exist, so that option keeps its solids.
  model: (p) => {
    const form = str(p, 'form', 'bookshelf')
    if (form === 'floor')
      return {
        url: 'models/speaker-tower.glb',
        fit: 'bbox',
        axes: { y: 'fill', z: 'fill' },
        credit: { title: 'Part 1 - Optimized Speakers Pack', author: 'NDnxST', license: 'CC-BY-4.0', source: 'https://sketchfab.com/3d-models/part-1-optimized-speakers-pack-1e0403a0e5044a0395e4b4fa9325a872' },
      }
    if (form === 'bookshelf')
      return {
        url: 'models/speaker-bookshelf.glb',
        fit: 'bbox',
        // The part's box includes the stand it sits on; the cabinet
        // stretches through its middle to reach the top of it.
        axes: { y: [0.1, 0.9], z: 'fill' },
        credit: { title: "Photon's optimized bookshelf speaker 2", author: 'photon (that one larry)', license: 'CC-BY-4.0', source: 'https://sketchfab.com/3d-models/photons-optimized-bookshelf-speaker-2-a8ab4ec1a49f430b95177a18343d0ac8' },
      }
    if (form === 'centre')
      return {
        url: 'models/speaker-centre.glb',
        fit: 'bbox',
        axes: { y: 'fill', z: 'fill' },
        credit: { title: "Photon's optimized Center speaker", author: 'photon (that one larry)', license: 'CC-BY-4.0', source: 'https://sketchfab.com/3d-models/photons-optimized-center-speaker-fb7c123ad76f459284c1af7839d47df6' },
      }
    return undefined
  },
  name: 'Surround speaker',
  category: 'audio',
  blurb: 'A passive box with an angle it is supposed to be at',
  tags: ['speaker', 'surround', 'centre', 'bookshelf', 'on-wall', 'atmos', 'home theatre', '5.1', '7.1', 'passive', 'cinema'],
  doc: {
    price: 220,
    description:
      'A passive speaker, which is to say a resistance on the end of an amplifier. Two things make it worth having as a part rather than a box on a plan: the angle it is supposed to sit at, which is published and specific — fronts at 30 degrees, surrounds at 110, rears at 150 — and what it will actually do at the seat, which is sensitivity plus ten log watts minus twenty log distance, and comes out quieter than people expect.\n\nIt is wired as an 8 or 4 ohm load between its terminals, so an amplifier driving four of them in a plan is driving a real load.',
  },
  params: [
    { key: 'role', label: 'Role', type: 'enum', default: 'front', group: 'Speaker', options: Object.entries(SPEAKER_ROLES).map(([value, r]) => ({ value, label: r.label })) },
    {
      key: 'form', label: 'Form', type: 'enum', default: 'bookshelf', group: 'Speaker',
      options: [
        { value: 'bookshelf', label: 'Bookshelf, on a stand' },
        { value: 'floor', label: 'Floorstanding' },
        { value: 'onwall', label: 'On-wall, slim' },
        { value: 'centre', label: 'Centre, lying down' },
      ],
    },
    { key: 'impedance', label: 'Impedance', type: 'enum', default: '8', group: 'Electrical', options: [{ value: '8', label: '8 Ω' }, { value: '6', label: '6 Ω' }, { value: '4', label: '4 Ω' }] },
    { key: 'sensitivity', label: 'Sensitivity', type: 'number', unit: 'dB', default: 88, min: 80, max: 98, step: 0.5, group: 'Electrical', help: 'dB at 1 watt, 1 metre. Two speakers three dB apart need twice the amplifier for the same level.' },
    { key: 'watts', label: 'Amplifier', type: 'number', unit: 'W', default: 100, min: 10, max: 400, step: 10, group: 'Electrical' },
    { key: 'distance', label: 'Distance to the seat', type: 'number', unit: 'mm', default: 3000, min: 500, max: 12000, step: 100, group: 'Placement' },
    { key: 'height', label: 'Mounting height', type: 'number', unit: 'mm', default: 1150, min: 0, max: 3000, step: 10, group: 'Placement' },
  ],
  solids: (p) => {
    const form = str(p, 'form', 'bookshelf')
    const h = num(p, 'height', 1150)
    const body = { color: '#1C1D20', rough: 0.72, density: 0.75 }
    const cone = { color: '#15171A', rough: 0.85, density: 0.6 }
    const out: Solid[] = []
    if (form === 'floor') {
      out.push({ kind: 'box', mat: body, size: [200, 1000, 280], at: [0, 500, 0], bevel: 6 })
      out.push({ kind: 'box', mat: STEEL, size: [280, 16, 340], at: [0, 8, 0], bevel: 3 })
      for (const y of [260, 520]) out.push({ kind: 'cyl', mat: cone, r: 65, h: 24, seg: 26, rot: [-90, 0, 0], at: [0, y, 128] })
      out.push({ kind: 'sphere', mat: { color: '#C9CDD3', metal: 0.8, rough: 0.35, density: 2.7 }, r: 14, seg: 16, at: [0, 760, 142] })
    } else if (form === 'centre') {
      out.push({ kind: 'box', mat: body, size: [520, 170, 230], at: [0, h + 85, 0], bevel: 5 })
      for (const x of [-150, 150]) out.push({ kind: 'cyl', mat: cone, r: 55, h: 20, seg: 24, rot: [-90, 0, 0], at: [x, h + 85, 105] })
      out.push({ kind: 'sphere', mat: { color: '#C9CDD3', metal: 0.8, rough: 0.35, density: 2.7 }, r: 13, seg: 16, at: [0, h + 85, 118] })
    } else if (form === 'onwall') {
      out.push({ kind: 'box', mat: body, size: [170, 420, 90], at: [0, h, 0], bevel: 4 })
      out.push({ kind: 'cyl', mat: cone, r: 58, h: 16, seg: 24, rot: [-90, 0, 0], at: [0, h - 70, 42] })
      out.push({ kind: 'sphere', mat: { color: '#C9CDD3', metal: 0.8, rough: 0.35, density: 2.7 }, r: 12, seg: 16, at: [0, h + 110, 48] })
    } else {
      // Bookshelf on a stand, because that is how one is actually installed.
      out.push({ kind: 'box', mat: body, size: [190, 320, 250], at: [0, h, 0], bevel: 5 })
      out.push({ kind: 'cyl', mat: cone, r: 58, h: 18, seg: 24, rot: [-90, 0, 0], at: [0, h - 55, 120] })
      out.push({ kind: 'sphere', mat: { color: '#C9CDD3', metal: 0.8, rough: 0.35, density: 2.7 }, r: 13, seg: 16, at: [0, h + 80, 130] })
      out.push({ kind: 'cyl', mat: STEEL, r: 26, h: h - 170, seg: 16, at: [0, (h - 170) / 2, 0] })
      out.push({ kind: 'box', mat: STEEL, size: [280, 14, 300], at: [0, 7, 0], bevel: 3 })
    }
    return out
  },
  ports: (p) => {
    const h = num(p, 'height', 1150)
    const form = str(p, 'form', 'bookshelf')
    const z = form === 'floor' ? -140 : form === 'centre' ? -115 : -45
    /*
     * The centre cabinet is drawn at h + 85, not at h: it lies down on a
     * shelf rather than standing with its middle at the mounting height.
     * Its terminals followed the other three forms to h - 60, which put
     * them 60 mm under the box, and its mount port sat on the floor
     * 1150 mm below a speaker that never touches the floor.
     */
    const y = form === 'floor' ? 120 : form === 'centre' ? h + 85 : h - 60
    const mountY = form === 'onwall' ? h : form === 'centre' ? h : 0
    return [
      { id: 'pos', label: 'Red, +', kind: 'electrical', pos: [-20, y, z], dir: [0, 0, -1], role: 'passive', imax: 8, solderable: false },
      { id: 'neg', label: 'Black, −', kind: 'electrical', pos: [20, y, z], dir: [0, 0, -1], role: 'passive', imax: 8, solderable: false },
      { id: 'mount', label: form === 'onwall' ? 'Wall' : form === 'centre' ? 'Shelf' : 'Floor', kind: 'mechanical', pos: [0, mountY, form === 'onwall' ? -45 : 0], dir: form === 'onwall' ? [0, 0, -1] : [0, -1, 0], mate: { type: 'face' } },
    ]
  },
  electrical: {
    /*
     * A passive speaker is its impedance. Nominal rather than real — a real
     * driver swings from 3 ohms to 30 across the band — but nominal is the
     * number an amplifier is specified against, and the question this
     * answers is whether the amplifier can drive what is hung off it.
     */
    devices: (p) => [{ type: 'resistor', a: 'pos', b: 'neg', r: parseInt(str(p, 'impedance', '8'), 10) || 8 } as DeviceModel],
    limits: { vmax: 100 },
  },
  mass: (p) => {
    const form = str(p, 'form', 'bookshelf')
    return form === 'floor' ? 18000 : form === 'centre' ? 8000 : form === 'onwall' ? 4000 : 11000
  },
  price: (p) => {
    const form = str(p, 'form', 'bookshelf')
    return form === 'floor' ? 480 : form === 'centre' ? 300 : form === 'onwall' ? 190 : 240
  },
  readouts: (p) => {
    const role = SPEAKER_ROLES[str(p, 'role', 'front')] ?? SPEAKER_ROLES.front
    const sens = num(p, 'sensitivity', 88)
    const w = num(p, 'watts', 100)
    const d = Math.max(0.5, num(p, 'distance', 3000) / 1000)
    // Sensitivity is at one metre; power adds 10 log, distance costs 20 log.
    const spl = sens + 10 * Math.log10(Math.max(0.1, w)) - 20 * Math.log10(d)
    const z = parseInt(str(p, 'impedance', '8'), 10) || 8
    return [
      { label: 'Place at', value: `${role.angle}° from the screen centre line` },
      { label: 'Height', value: role.height },
      { label: 'Peak at the seat', value: `${spl.toFixed(0)} dB at ${w} W, ${d.toFixed(1)} m` },
      { label: 'Reference level needs', value: `105 dB peaks — this is ${spl >= 105 ? 'there' : `${(105 - spl).toFixed(0)} dB short`}` },
      { label: 'Load', value: `${z} Ω nominal, ${(Math.sqrt(w * z)).toFixed(1)} V and ${(Math.sqrt(w / z)).toFixed(1)} A at full output` },
    ]
  },
}

const ceilingSpeaker: PartDef = {
  id: 'speaker-ceiling',
  // Only the trim and the top of the can are modelled, which is all of an
  // in-ceiling speaker anybody ever sees.
  model: {
    url: 'models/speaker-ceiling.glb',
    fit: 'bbox',
    axes: { y: [0.1, 0.9] },
    credit: { title: 'Ceiling Speaker', author: 'spy_dogg', license: 'CC-BY-4.0', source: 'https://sketchfab.com/3d-models/ceiling-speaker-58580cd22a144b64b2aa9873d429a0b5' },
  },
  name: 'In-ceiling speaker',
  category: 'audio',
  blurb: 'A cutout, a void depth, and a cone of cover below it',
  tags: ['in-ceiling', 'ceiling speaker', 'atmos', 'height', 'flush', 'recessed', 'cutout', 'speaker', 'home theatre'],
  doc: {
    price: 140,
    description:
      'The speaker whose constraints are all above the ceiling. It needs a cutout, and it needs depth behind that cutout — typically 90 to 140 mm — which has to exist between the plasterboard and whatever is up there. A joist 400 mm from where you wanted it is the usual reason an Atmos layout moves.\n\nBelow the ceiling it covers a cone. A 60 degree dispersion at 1,250 mm above ear height covers about 1.4 m across, which is one seat, not a row.',
  },
  params: [
    { key: 'driver', label: 'Driver', type: 'enum', default: '6.5', group: 'Speaker', options: ['4', '5.25', '6.5', '8'].map((v) => ({ value: v, label: `${v}"` })) },
    { key: 'dispersion', label: 'Dispersion', type: 'number', unit: '°', default: 60, min: 30, max: 120, step: 5, group: 'Speaker' },
    { key: 'aimable', label: 'Aimable', type: 'bool', default: true, group: 'Speaker', help: 'A gimballed driver can be pointed at the seats. A flat one fires straight down.' },
    { key: 'impedance', label: 'Impedance', type: 'enum', default: '8', group: 'Electrical', options: [{ value: '8', label: '8 Ω' }, { value: '6', label: '6 Ω' }, { value: '4', label: '4 Ω' }] },
    { key: 'sensitivity', label: 'Sensitivity', type: 'number', unit: 'dB', default: 89, min: 80, max: 96, step: 0.5, group: 'Electrical' },
    { key: 'ceiling', label: 'Ceiling height', type: 'number', unit: 'mm', default: 2400, min: 2000, max: 4500, step: 50, group: 'Placement' },
    { key: 'earHeight', label: 'Ear height', type: 'number', unit: 'mm', default: 1120, min: 800, max: 1600, step: 10, group: 'Placement' },
  ],
  solids: (p) => {
    const d = parseFloat(str(p, 'driver', '6.5')) || 6.5
    const r = (d * 25.4) / 2 + 30
    const aim = bool(p, 'aimable', true)
    return [
      // The trim ring sits on the ceiling line; the can goes up into the void.
      { kind: 'cyl', mat: { color: '#F0EEE9', rough: 0.6, density: 1.3 }, r: r + 14, h: 8, seg: 32, at: [0, -4, 0] },
      { kind: 'cyl', mat: { color: '#1A1B1E', rough: 0.85, density: 0.6 }, r, h: 6, seg: 32, at: [0, -9, 0], rot: aim ? [12, 0, 0] : [0, 0, 0] },
      { kind: 'cyl', mat: { color: '#D9D7D2', rough: 0.7, density: 1.2 }, r: r - 6, h: 92, seg: 28, at: [0, 46, 0] },
    ]
  },
  ports: (p) => {
    const d = parseFloat(str(p, 'driver', '6.5')) || 6.5
    const r = (d * 25.4) / 2 + 30
    return [
      { id: 'ceiling', label: 'Ceiling', kind: 'mechanical', pos: [0, 0, 0], dir: [0, 1, 0], mate: { type: 'hole', size: r * 2 } },
      { id: 'pos', label: 'Red, +', kind: 'electrical', pos: [-14, 90, 0], dir: [0, 1, 0], role: 'passive', imax: 6, solderable: false },
      { id: 'neg', label: 'Black, −', kind: 'electrical', pos: [14, 90, 0], dir: [0, 1, 0], role: 'passive', imax: 6, solderable: false },
    ]
  },
  electrical: {
    devices: (p) => [{ type: 'resistor', a: 'pos', b: 'neg', r: parseInt(str(p, 'impedance', '8'), 10) || 8 } as DeviceModel],
    limits: { vmax: 100 },
  },
  mass: (p) => 1200 + (parseFloat(str(p, 'driver', '6.5')) || 6.5) * 180,
  price: (p) => Math.round(60 + (parseFloat(str(p, 'driver', '6.5')) || 6.5) * 14 + (bool(p, 'aimable', true) ? 30 : 0)),
  readouts: (p) => {
    const d = parseFloat(str(p, 'driver', '6.5')) || 6.5
    const cut = Math.round(d * 25.4 + 26)
    const disp = num(p, 'dispersion', 60)
    const drop = num(p, 'ceiling', 2400) - num(p, 'earHeight', 1120)
    const cover = 2 * drop * Math.tan(((disp / 2) * Math.PI) / 180)
    return [
      { label: 'Cutout', value: `${cut} mm` },
      { label: 'Void needed', value: `${Math.round(100 + d * 6)} mm above the plasterboard` },
      { label: `Covers at ${(drop / 1000).toFixed(2)} m below`, value: `${Math.round(cover)} mm across` },
      { label: 'Seats covered', value: cover > 1600 ? 'Two, at 800 apart' : 'One' },
      { label: 'Joists', value: 'At 400 centres, a 6.5 inch can fits between. Check before cutting.' },
    ]
  },
}

const avReceiver: PartDef = {
  id: 'receiver-av',
  // The scan is a Denon AVR-X3400H with both aerials up, so it stands
  // 235 mm against the part's 170. Height fills on its own rather than
  // shrinking the whole receiver to the body it has without them.
  model: {
    url: 'models/av-receiver.glb',
    fit: 'bbox',
    axes: { y: 'fill' },
    credit: { title: 'Denon AVR-X3400H', author: 'James Preston Cardona', license: 'CC-BY-4.0', source: 'https://sketchfab.com/3d-models/denon-avr-x3400h-93c8fd6ec4794bc39dff457cd2a4268b' },
  },
  name: 'AV receiver',
  category: 'av',
  blurb: 'Channels, and what they draw when they are all working',
  tags: ['av receiver', 'avr', 'amplifier', 'surround', 'atmos', '7.2', '9.2', 'hdmi', 'home theatre', 'denon', 'rack'],
  doc: {
    price: 700,
    description:
      'The box everything plugs into, and the one that produces heat. Two numbers to be honest about.\n\nThe rated watts per channel are measured with two channels driven, which is why a receiver sold as 9 × 125 W cannot deliver 1,125 W — the supply inside it will not do it. What it really draws at reference level is nearer 450 W, and what it draws at normal listening is about 120.\n\nAnd it is a 3U box that wants 100 mm of air above it. Racked tight under a shelf it will shut itself down in the second act.',
  },
  params: [
    REGION_PARAM,
    {
      key: 'channels', label: 'Channels', type: 'enum', default: '7.2', group: 'Receiver',
      options: [{ value: '5.1', label: '5.1' }, { value: '7.2', label: '7.2' }, { value: '9.2', label: '9.2' }, { value: '11.2', label: '11.2' }],
    },
    { key: 'watts', label: 'Rated per channel', type: 'number', unit: 'W', default: 110, min: 40, max: 250, step: 10, group: 'Receiver', help: 'Two channels driven, which is how it is always quoted.' },
    { key: 'hdmi', label: 'HDMI inputs', type: 'number', unit: '', default: 6, min: 2, max: 10, step: 1, group: 'Receiver' },
    {
      key: 'state', label: 'State', type: 'enum', default: 'watch', group: 'Control',
      options: [
        { value: 'standby', label: 'Standby' },
        { value: 'idle', label: 'On, silent' },
        { value: 'watch', label: 'Normal listening' },
        { value: 'reference', label: 'Reference level' },
      ],
    },
  ],
  solids: (p) => {
    const ch = parseFloat(str(p, 'channels', '7.2')) || 7.2
    const w = 434
    const h = 170
    const d = 380
    const out: Solid[] = [
      { kind: 'box', mat: { color: '#1A1B1E', rough: 0.6, density: 2.4 }, size: [w, h, d], at: [0, h / 2, 0], bevel: 4 },
      { kind: 'box', mat: { color: '#232528', rough: 0.45, density: 2.4 }, size: [w, h * 0.5, 8], at: [0, h * 0.72, d / 2 + 2], bevel: 2 },
      { kind: 'box', mat: { color: '#0A0B0D', rough: 0.2, clearcoat: 0.6, density: 2.2, emissive: str(p, 'state', 'watch') === 'standby' ? '#000000' : '#2B4F8A', emissiveIntensity: str(p, 'state', 'watch') === 'standby' ? 0 : 0.5 }, size: [150, 34, 3], at: [-60, h * 0.72, d / 2 + 7] },
      { kind: 'cyl', mat: { color: '#2E3136', rough: 0.4, density: 2.6 }, r: 32, h: 16, seg: 28, rot: [90, 0, 0], at: [w / 2 - 60, h * 0.42, d / 2] },
      { kind: 'cyl', mat: { color: '#2E3136', rough: 0.4, density: 2.6 }, r: 18, h: 14, seg: 22, rot: [90, 0, 0], at: [-w / 2 + 50, h * 0.42, d / 2] },
    ]
    // The vents, which are most of the lid and the reason for the air gap.
    for (let i = 0; i < 9; i++) out.push({ kind: 'box', mat: DARK, size: [w - 120, 2, 10], at: [0, h - 1, -d / 2 + 60 + i * 28], noCollide: true })
    // Speaker terminals across the back, two rows.
    const n = Math.round(ch)
    for (let i = 0; i < n; i++) {
      const x = -w / 2 + 40 + (i % 6) * 62
      const y = 46 + Math.floor(i / 6) * 48
      out.push({ kind: 'cyl', mat: { color: '#B4342C', rough: 0.45, density: 1.4 }, r: 9, h: 14, seg: 14, rot: [90, 0, 0], at: [x, y, -d / 2] })
      out.push({ kind: 'cyl', mat: { color: '#1A1B1E', rough: 0.45, density: 1.4 }, r: 9, h: 14, seg: 14, rot: [90, 0, 0], at: [x + 24, y, -d / 2] })
    }
    return out
  },
  ports: (p) => {
    const ch = Math.round(parseFloat(str(p, 'channels', '7.2')) || 7.2)
    const w = 434
    const d = 380
    const out: Port[] = [...mainsPorts([w / 2 - 50, 40, -d / 2 - 6], [0, 0, -1], '', [11, 0, 0])]
    for (let i = 0; i < ch; i++) {
      const x = -w / 2 + 40 + (i % 6) * 62
      const y = 46 + Math.floor(i / 6) * 48
      out.push({ id: `ch${i + 1}p`, label: `Channel ${i + 1} +`, kind: 'electrical', pos: [x, y, -d / 2 - 8], dir: [0, 0, -1], role: 'power', imax: 8, solderable: false })
      out.push({ id: `ch${i + 1}n`, label: `Channel ${i + 1} −`, kind: 'electrical', pos: [x + 24, y, -d / 2 - 8], dir: [0, 0, -1], role: 'gnd', imax: 8, solderable: false })
    }
    out.push(...signalPorts([['hdmiout', 'HDMI out'], ['hdmi1', 'HDMI 1'], ['hdmi2', 'HDMI 2'], ['lan', 'Ethernet']], [-60, 130, -d / 2 - 6], [0, 0, -1], 26))
    out.push({ id: 'rail', label: 'Shelf or rack', kind: 'mechanical', pos: [0, 0, 0], dir: [0, -1, 0], mate: { type: 'face' } })
    return out
  },
  electrical: {
    devices: (p) => {
      const v = volts(p)
      const ch = Math.round(parseFloat(str(p, 'channels', '7.2')) || 7.2)
      const rated = num(p, 'watts', 110)
      /*
       * What it really pulls. Rated power times channels is a number the
       * supply inside cannot produce and nobody listens at: reference level
       * on film content averages a few watts a channel with brief peaks, so
       * the honest figures are measured ones — standby under a watt, idle
       * around 60, normal listening 120, and reference around 450 on a
       * seven-channel receiver.
       */
      const w =
        {
          standby: 0.5,
          idle: 55 + ch * 2,
          watch: 90 + ch * 5,
          reference: 150 + ch * rated * 0.38,
        }[str(p, 'state', 'watch')] ?? 120
      const out: DeviceModel[] = [
        { type: 'resistor', a: 'l', b: 'n', r: (v * v) / Math.max(0.3, w) },
        { type: 'resistor', a: 'e', b: 'n', r: 2e6 },
      ]
      /*
       * Each channel as a source behind its output impedance. A real
       * amplifier has a damping factor of a few hundred, which is to say
       * output impedance in the tens of milliohms; the voltage is the DC
       * equivalent of its rated output into 8 ohms, scaled by how hard it
       * is being driven.
       */
      const drive = { standby: 0, idle: 0, watch: 0.12, reference: 0.7 }[str(p, 'state', 'watch')] ?? 0.12
      const vOut = Math.sqrt(rated * 8) * drive
      for (let i = 1; i <= ch; i++) out.push({ type: 'vsource', v: vOut, a: `ch${i}p`, b: `ch${i}n`, rint: 0.04 })
      return out
    },
    supplies: Array.from({ length: 11 }, (_, i) => `ch${i + 1}p`),
    limits: { vmax: 400 },
  },
  mass: (p) => 9000 + (Math.round(parseFloat(str(p, 'channels', '7.2')) || 7.2)) * 900,
  price: (p) => {
    const ch = parseFloat(str(p, 'channels', '7.2')) || 7.2
    return Math.round(260 + ch * 70 + num(p, 'watts', 110) * 1.4)
  },
  readouts: (p) => {
    const ch = Math.round(parseFloat(str(p, 'channels', '7.2')) || 7.2)
    const rated = num(p, 'watts', 110)
    const w =
      {
        standby: 0.5,
        idle: 55 + ch * 2,
        watch: 90 + ch * 5,
        reference: 150 + ch * rated * 0.38,
      }[str(p, 'state', 'watch')] ?? 120
    return [
      { label: 'Channels', value: `${ch} amplified, rated ${rated} W with two driven` },
      { label: 'All channels at once', value: `${Math.round(ch * rated * 0.38)} W is what the supply will really give` },
      { label: 'Drawing now', value: `${w.toFixed(0)} W, ${amps(p, w)}` },
      { label: 'Heat', value: `${Math.round(w * 0.6)} W into the room, so 100 mm of air above it` },
      { label: 'Rack', value: '3U, 434 mm wide, 380 deep plus cables' },
    ]
  },
}

const projectorMount: PartDef = {
  id: 'mount-projector',
  name: 'Projector mount',
  category: 'av',
  blurb: 'A drop, and the lens height it puts the projector at',
  tags: ['projector mount', 'ceiling mount', 'drop', 'bracket', 'universal', 'home theatre', 'av', 'lens shift'],
  doc: {
    price: 55,
    description:
      'A plate, a pole and a spider. The only number in it is the drop, and the drop is set by where the lens has to be: level with the top of the image, or wherever the projector\'s lens shift can reach from.\n\nIt is here because people hang the projector first and discover the geometry second. Set the drop against a screen and the readout says where the lens lands.',
  },
  params: [
    { key: 'drop', label: 'Drop', type: 'number', unit: 'mm', default: 300, min: 60, max: 1500, step: 10, group: 'Mount' },
    { key: 'load', label: 'Projector mass', type: 'number', unit: 'g', default: 4500, min: 500, max: 25000, step: 500, group: 'Mount' },
    { key: 'ceiling', label: 'Ceiling height', type: 'number', unit: 'mm', default: 2400, min: 2000, max: 5000, step: 50, group: 'Placement' },
    { key: 'imageTop', label: 'Image top edge', type: 'number', unit: 'mm', default: 2250, min: 500, max: 4000, step: 10, group: 'Placement' },
    { key: 'tilt', label: 'Tilt', type: 'number', unit: '°', default: 0, min: -15, max: 15, step: 0.5, group: 'Mount', help: 'Keystone is a correction, not a fix — it throws away pixels. Aim to hang level and use lens shift.' },
  ],
  solids: (p) => {
    const drop = num(p, 'drop', 300)
    return [
      { kind: 'cyl', mat: ALU, r: 55, h: 10, seg: 28, at: [0, -5, 0] },
      { kind: 'cyl', mat: ALU, r: 19, h: drop, seg: 20, at: [0, -5 - drop / 2, 0] },
      { kind: 'cyl', mat: ALU, r: 46, h: 14, seg: 28, at: [0, -5 - drop, 0] },
      ...([0, 90, 180, 270] as const).map((a) => ({
        kind: 'box' as const, mat: BLACK_PLASTIC, size: [150, 8, 26] as Vec3,
        at: [Math.cos((a * Math.PI) / 180) * 75, -12 - drop, Math.sin((a * Math.PI) / 180) * 75] as Vec3,
        rot: [0, -a, 0] as Vec3,
      })),
    ]
  },
  ports: (p) => {
    const drop = num(p, 'drop', 300)
    return [
      { id: 'ceiling', label: 'Ceiling', kind: 'mechanical', pos: [0, 0, 0], dir: [0, 1, 0], mate: { type: 'face' } },
      { id: 'plate', label: 'Projector plate', kind: 'mechanical', pos: [0, -16 - drop, 0], dir: [0, -1, 0], mate: { type: 'face' } },
    ]
  },
  mass: (p) => 900 + num(p, 'drop', 300) * 1.6,
  price: (p) => Math.round(34 + num(p, 'drop', 300) * 0.06),
  readouts: (p) => {
    const drop = num(p, 'drop', 300)
    const ceiling = num(p, 'ceiling', 2400)
    const top = num(p, 'imageTop', 2250)
    const lens = ceiling - drop - 120
    const offset = lens - top
    const load = num(p, 'load', 4500)
    return [
      { label: 'Lens lands at', value: `${Math.round(lens)} mm off the floor` },
      {
        label: 'Against the image top',
        value: offset >= 0 ? `${Math.round(offset)} mm above it` : `${Math.round(-offset)} mm below it, which needs lens shift down`,
      },
      { label: 'Needs lens shift of', value: `${Math.abs(offset) < 30 ? 'none worth mentioning' : `${((Math.abs(offset) / 1000) * 100).toFixed(0)}% of image height`}` },
      { label: 'Load at the ceiling', value: `${(load / 1000).toFixed(1)} kg on four fixings, ${(load / 4000 * 9.81).toFixed(1)} N each` },
      { label: 'Fixing', value: load > 8000 ? 'Into a joist or a noggin, nothing less' : 'Plasterboard anchors rated 10 kg each, or a joist' },
    ]
  },
}

registerParts([projectionScreen, cinemaSeating, seatingRiser, surroundSpeaker, ceilingSpeaker, avReceiver, projectorMount])
