import type { Vec2 } from '@/parts/kernel/types'
import type { Flat, PlacedPad } from './copper'
import { rectCorners } from './geom'
import type { Pcb, Side } from './types'
import { makeZip, type ZipEntry } from './zip'

/**
 * Gerber RS-274X and Excellon, which is what a board house reads.
 *
 * This is the point of the whole workspace. A layout that cannot leave
 * the application is a drawing; these eight files are a board, and every
 * fab on earth takes them in this form. The extensions are the ones KiCad
 * writes, which is what the automatic file recognisers on the upload
 * pages are all tuned for.
 *
 * Format is 4.6 absolute millimetres — four integer digits and six
 * decimal, so coordinates are nanometres as integers and nothing is ever
 * rounded on the way out. Dark polarity throughout; there are no
 * negative objects on a board this editor can draw.
 */

/** Nanometre integer for a millimetre coordinate. */
const n = (mm: number): string => String(Math.round(mm * 1e6))
const xy = (p: Vec2): string => `X${n(p[0])}Y${n(p[1])}`

/**
 * The aperture table for one file.
 *
 * Gerber draws with a named tool: every width and every pad shape has to
 * be declared once at the top and then selected by number. Collecting
 * them by their definition means a board with forty identical pads
 * declares one aperture and flashes it forty times, which is both
 * smaller and what a fab's viewer expects to see.
 */
class Apertures {
  private byDef = new Map<string, number>()
  private defs: string[] = []

  /** Returns the D-code for a definition such as `C,0.400`. */
  get(def: string): number {
    const hit = this.byDef.get(def)
    if (hit !== undefined) return hit
    const code = 10 + this.defs.length
    this.byDef.set(def, code)
    this.defs.push(def)
    return code
  }

  circle = (d: number): number => this.get(`C,${d.toFixed(4)}`)
  rect = (w: number, h: number): number => this.get(`R,${w.toFixed(4)}X${h.toFixed(4)}`)

  header(): string[] {
    return this.defs.map((d, i) => `%ADD${10 + i}${d}*%`)
  }
}

interface Draw {
  /** Lines to emit once the aperture table is known. */
  body: string[]
  ap: Apertures
}

function newDraw(): Draw {
  return { body: [], ap: new Apertures() }
}

const select = (d: Draw, code: number) => d.body.push(`D${code}*`)
const flash = (d: Draw, p: Vec2) => d.body.push(`${xy(p)}D03*`)
const moveTo = (d: Draw, p: Vec2) => d.body.push(`${xy(p)}D02*`)
const lineTo = (d: Draw, p: Vec2) => d.body.push(`${xy(p)}D01*`)

function polyline(d: Draw, pts: Vec2[], width: number): void {
  if (pts.length < 2) return
  select(d, d.ap.circle(width))
  moveTo(d, pts[0])
  for (let i = 1; i < pts.length; i++) lineTo(d, pts[i])
}

function finish(d: Draw, title: string): string {
  return [
    `G04 ${title}*`,
    '%FSLAX46Y46*%',
    '%MOMM*%',
    '%LPD*%',
    ...d.ap.header(),
    'G01*',
    ...d.body,
    'M02*',
    '',
  ].join('\n')
}

/* ------------------------------------------------------------------ */
/* Layers                                                              */
/* ------------------------------------------------------------------ */

/** A pad is on this copper layer if it is through-plated or mounted on it. */
const padOn = (p: PlacedPad, side: Side): boolean => p.through || p.side === side

function padShape(d: Draw, p: PlacedPad, grow = 0): void {
  if (p.shape === 'rect') select(d, d.ap.rect(p.size[0] + 2 * grow, p.size[1] + 2 * grow))
  else select(d, d.ap.circle(Math.max(p.size[0], p.size[1]) + 2 * grow))
  flash(d, p.at)
}

function copper(pcb: Pcb, flat: Flat, side: Side, title: string): string {
  const d = newDraw()
  for (const p of flat.pads) if (padOn(p, side)) padShape(d, p)
  for (const v of flat.vias) {
    select(d, d.ap.circle(v.pad))
    flash(d, v.at)
  }
  for (const id of pcb.trackOrder) {
    const t = pcb.tracks[id]
    if (t && t.layer === side) polyline(d, t.pts, t.width)
  }
  return finish(d, title)
}

/**
 * Solder mask, as the openings in it.
 *
 * A mask layer is drawn the other way round from how it is made: what is
 * in the file is where the lacquer is *absent*, which is every pad. The
 * expansion is the industry's usual 0.05 mm each side, so a slightly
 * misregistered mask still clears the copper rather than creeping onto
 * it and leaving a pad you cannot wet.
 */
function mask(flat: Flat, side: Side, title: string): string {
  const d = newDraw()
  for (const p of flat.pads) if (padOn(p, side)) padShape(d, p, 0.05)
  for (const v of flat.vias) {
    select(d, d.ap.circle(v.pad + 0.1))
    flash(d, v.at)
  }
  return finish(d, title)
}

/**
 * Silkscreen: the outline of each part's body.
 *
 * Outlines only. A reference designator would want a stroke font, and a
 * half-finished one that renders `R1` as four wobbly lines is worse on a
 * real board than clean outlines and no text — you can still see what
 * goes where and which way round it goes.
 */
function silk(flat: Flat, side: Side, title: string): string {
  const d = newDraw()
  for (const b of flat.bodies) {
    if (b.side !== side) continue
    const c = rectCorners(b.rect)
    polyline(d, [...c, c[0]], 0.15)
  }
  return finish(d, title)
}

function edge(pcb: Pcb, title: string): string {
  const d = newDraw()
  const hx = pcb.w / 2
  const hy = pcb.h / 2
  const c: Vec2[] = [[-hx, -hy], [hx, -hy], [hx, hy], [-hx, hy], [-hx, -hy]]
  polyline(d, c, 0.1)
  return finish(d, title)
}

/**
 * Excellon drill, metric, trailing zeros suppressed.
 *
 * One tool per distinct finished hole size. Through-plated holes and
 * vias go in one file, which is what a two-layer board with no blind
 * holes means by a drill file.
 */
function drill(flat: Flat): string {
  const holes = new Map<string, Vec2[]>()
  const add = (dia: number, at: Vec2) => {
    const k = dia.toFixed(3)
    const g = holes.get(k)
    if (g) g.push(at)
    else holes.set(k, [at])
  }
  for (const p of flat.pads) if (p.drill > 0) add(p.drill, p.at)
  for (const v of flat.vias) add(v.drill, v.at)

  const sizes = [...holes.keys()].sort((a, b) => parseFloat(a) - parseFloat(b))
  const out: string[] = ['M48', ';DRILL file for Draftrig', 'FMAT,2', 'METRIC,TZ']
  sizes.forEach((s, i) => out.push(`T${i + 1}C${parseFloat(s).toFixed(3)}`))
  out.push('%')
  sizes.forEach((s, i) => {
    out.push(`T${i + 1}`)
    for (const at of holes.get(s)!) out.push(`X${at[0].toFixed(3)}Y${at[1].toFixed(3)}`)
  })
  out.push('T0', 'M30', '')
  return out.join('\n')
}

/* ------------------------------------------------------------------ */
/* The job                                                             */
/* ------------------------------------------------------------------ */

export function gerberFiles(pcb: Pcb, flat: Flat, name: string): ZipEntry[] {
  const base = safeName(name)
  return [
    { name: `${base}-F_Cu.gbr`, text: copper(pcb, flat, 'top', 'Layer: top copper') },
    { name: `${base}-B_Cu.gbr`, text: copper(pcb, flat, 'bottom', 'Layer: bottom copper') },
    { name: `${base}-F_Mask.gbr`, text: mask(flat, 'top', 'Layer: top solder mask') },
    { name: `${base}-B_Mask.gbr`, text: mask(flat, 'bottom', 'Layer: bottom solder mask') },
    { name: `${base}-F_Silkscreen.gbr`, text: silk(flat, 'top', 'Layer: top silkscreen') },
    { name: `${base}-B_Silkscreen.gbr`, text: silk(flat, 'bottom', 'Layer: bottom silkscreen') },
    { name: `${base}-Edge_Cuts.gbr`, text: edge(pcb, 'Layer: board outline') },
    { name: `${base}.drl`, text: drill(flat) },
    { name: 'README.txt', text: readme(pcb, flat, name) },
  ]
}

export function gerberZip(pcb: Pcb, flat: Flat, name: string): Blob {
  return makeZip(gerberFiles(pcb, flat, name))
}

function readme(pcb: Pcb, flat: Flat, name: string): string {
  const holes = new Set(flat.pads.filter((p) => p.drill > 0).map((p) => p.drill.toFixed(2)))
  for (const v of flat.vias) holes.add(v.drill.toFixed(2))
  return [
    `${name}`,
    '',
    `Board            ${pcb.w} x ${pcb.h} mm`,
    'Layers           2 (top and bottom copper)',
    `Minimum track    ${pcb.rules.track.toFixed(2)} mm`,
    `Minimum gap      ${pcb.rules.clearance.toFixed(2)} mm`,
    `Drill sizes      ${[...holes].sort().join(', ') || 'none'} mm`,
    `Pads             ${flat.pads.length}`,
    `Vias             ${flat.vias.length}`,
    '',
    'Units are millimetres. Gerbers are RS-274X, format 4.6 absolute.',
    'The drill file is Excellon, metric, trailing zeros suppressed.',
    '',
    'File names follow the KiCad convention, which every board house',
    'recognises automatically:',
    '',
    '  -F_Cu          top copper',
    '  -B_Cu          bottom copper',
    '  -F_Mask        top solder mask (openings)',
    '  -B_Mask        bottom solder mask (openings)',
    '  -F_Silkscreen  top silkscreen',
    '  -B_Silkscreen  bottom silkscreen',
    '  -Edge_Cuts     board outline',
    '  .drl           plated through holes',
    '',
    'Check these in a Gerber viewer before you order. Nothing here has',
    'been through a board house, and the person who pays for the run is',
    'the person who should have looked at it.',
    '',
  ].join('\n')
}

const safeName = (s: string): string =>
  (s.trim() || 'board').replace(/[^\w.\- ]+/g, '').replace(/\s+/g, '-').toLowerCase() || 'board'
