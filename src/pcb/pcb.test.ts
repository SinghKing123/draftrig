import { describe, expect, it } from 'vitest'
import '@/parts'
import { emptyDoc, type Doc } from '@/state/doc'
import { defaultParams, getPart } from '@/parts/kernel/registry'
import type { Instance } from '@/parts/kernel/types'
import { boardable, footprintBounds, footprintOf, leadDrill, padAt } from './footprint'
import { buildNets } from './nets'
import { Connectivity, flatten, ratsnest } from './copper'
import { checkBoard, errorsIn } from './drc'
import { arrange, boardParts } from './arrange'
import { corner45, distToRect, rectsOverlap, run45, segmentGap } from './geom'
import { crc32, makeZip } from './zip'
import { gerberFiles } from './gerber'
import { emptyPcb, padKey, type Pcb } from './types'

/* ------------------------------------------------------------------ */
/* A document to work on                                               */
/* ------------------------------------------------------------------ */

let seq = 0
function add(doc: Doc, defId: string, params: Record<string, string | number | boolean> = {}): string {
  const def = getPart(defId)
  if (!def) throw new Error(`no such part: ${defId}`)
  const id = `i${++seq}`
  const inst: Instance = {
    id,
    defId,
    name: def.name,
    pos: [0, 0, 0],
    rot: [0, 0, 0],
    params: { ...defaultParams(def), ...params },
  }
  doc.instances[id] = inst
  doc.order.push(id)
  return id
}

function wire(doc: Doc, a: [string, string], b: [string, string]): void {
  const id = `c${++seq}`
  doc.connections[id] = {
    id,
    kind: 'wire',
    a: { instanceId: a[0], portId: a[1] },
    b: { instanceId: b[0], portId: b[1] },
    color: '#E34B4B',
    gauge: 0.2,
  }
  doc.connectionOrder.push(id)
}

/** A 555 blinker: the smallest circuit that is a real board. */
function blinker(): { doc: Doc; ic: string; r1: string; c1: string } {
  const doc = emptyDoc()
  const ic = add(doc, 'ne555')
  const r1 = add(doc, 'resistor-axial')
  const c1 = add(doc, 'capacitor-ceramic')
  wire(doc, [ic, 'disch'], [r1, '1'])
  wire(doc, [r1, '2'], [ic, 'thresh'])
  wire(doc, [ic, 'thresh'], [c1, '1'])
  wire(doc, [c1, '2'], [ic, 'gnd'])
  return { doc, ic, r1, c1 }
}

/* ------------------------------------------------------------------ */
/* Geometry                                                            */
/* ------------------------------------------------------------------ */

describe('geometry', () => {
  it('puts the corner so one leg is orthogonal and one is 45 degrees', () => {
    const c = corner45([0, 0], [10, 3])!
    expect(c).toEqual([7, 0])
    // The second leg is a true diagonal: equal run in both axes.
    expect(Math.abs(10 - c[0])).toBeCloseTo(Math.abs(3 - c[1]), 9)
  })

  it('takes the orthogonal leg on the longer axis', () => {
    expect(corner45([0, 0], [3, 10])).toEqual([0, 7])
  })

  it('leaves a straight or already-diagonal run alone', () => {
    expect(corner45([0, 0], [10, 0])).toBeNull()
    expect(corner45([0, 0], [0, 10])).toBeNull()
    expect(corner45([0, 0], [5, 5])).toBeNull()
    expect(run45([0, 0], [5, -5])).toEqual([[0, 0], [5, -5]])
  })

  it('measures crossing segments as touching', () => {
    expect(segmentGap([-1, 0], [1, 0], [0, -1], [0, 1])).toBe(0)
  })

  it('measures parallel segments as their separation', () => {
    expect(segmentGap([0, 0], [10, 0], [0, 2], [10, 2])).toBeCloseTo(2, 9)
  })

  it('measures to a rotated rectangle, and zero inside it', () => {
    const r = { at: [0, 0] as [number, number], size: [4, 2] as [number, number], rot: 0 }
    expect(distToRect([0, 0], r)).toBe(0)
    expect(distToRect([3, 0], r)).toBeCloseTo(1, 9)
    // Turned a quarter turn, the long axis is now y.
    expect(distToRect([3, 0], { ...r, rot: 90 })).toBeCloseTo(2, 9)
  })

  it('separates rectangles that only look close', () => {
    const a = { at: [0, 0] as [number, number], size: [2, 2] as [number, number], rot: 0 }
    expect(rectsOverlap(a, { ...a, at: [1.5, 0] })).toBe(true)
    expect(rectsOverlap(a, { ...a, at: [2.5, 0] })).toBe(false)
    // Turned 45 degrees its corner reaches further along x.
    expect(rectsOverlap(a, { at: [2.3, 0], size: [2, 2], rot: 45 })).toBe(true)
  })
})

/* ------------------------------------------------------------------ */
/* Footprints                                                          */
/* ------------------------------------------------------------------ */

describe('footprints, derived from the part', () => {
  it('gives a DIP-8 eight pads on a tenth of an inch, rows 7.62 apart', () => {
    const { doc, ic } = blinker()
    const fp = footprintOf(doc.instances[ic])!
    expect(fp.pads).toHaveLength(8)

    const ys = [...new Set(fp.pads.map((p) => +p.at[1].toFixed(3)))].sort((a, b) => a - b)
    expect(ys).toHaveLength(2)
    expect(ys[1] - ys[0]).toBeCloseTo(7.62, 2)

    const row = fp.pads.filter((p) => p.at[1] === ys[0]).map((p) => p.at[0]).sort((a, b) => a - b)
    expect(row).toHaveLength(4)
    for (let i = 1; i < row.length; i++) expect(row[i] - row[i - 1]).toBeCloseTo(2.54, 2)
  })

  it('gives a resistor two pads at its lead span', () => {
    const { doc, r1 } = blinker()
    const fp = footprintOf(doc.instances[r1])!
    expect(fp.pads).toHaveLength(2)
    const span = Math.abs(fp.pads[0].at[0] - fp.pads[1].at[0])
    expect(span).toBeCloseTo(10.16, 2)
  })

  it('marks pin one square so the part goes in the right way round', () => {
    const { doc, ic } = blinker()
    const fp = footprintOf(doc.instances[ic])!
    expect(fp.pads[0].shape).toBe('rect')
    expect(fp.pads.slice(1).every((p) => p.shape === 'round')).toBe(true)
  })

  it('drills a bigger hole for a terminal that carries more current', () => {
    expect(leadDrill(0.05)).toBeLessThan(leadDrill(1))
    expect(leadDrill(1)).toBeLessThan(leadDrill(6))
    expect(leadDrill(undefined)).toBeGreaterThan(0)
  })

  it('keeps the board to the electronics', () => {
    const doc = emptyDoc()
    const r = add(doc, 'resistor-axial')
    const desk = add(doc, 'desk-lamp')
    expect(boardable(doc.instances[r])).toBe(true)
    expect(boardable(doc.instances[desk])).toBe(false)
    expect(boardParts(doc)).toEqual([r])
  })

  it('mirrors a part mounted on the bottom, and leaves the hole where it is', () => {
    const pad = { portId: '1', label: '1', at: [3, 1] as [number, number], size: [1.6, 1.6] as [number, number], shape: 'round' as const, drill: 0.8 }
    expect(padAt(pad, { x: 0, y: 0, rot: 0, side: 'top' })).toEqual([3, 1])
    expect(padAt(pad, { x: 0, y: 0, rot: 0, side: 'bottom' })).toEqual([-3, 1])
  })

  it('rotates a pad about the placement', () => {
    const pad = { portId: '1', label: '1', at: [2, 0] as [number, number], size: [1.6, 1.6] as [number, number], shape: 'round' as const, drill: 0.8 }
    const at = padAt(pad, { x: 10, y: 5, rot: 90, side: 'top' })
    expect(at[0]).toBeCloseTo(10, 9)
    expect(at[1]).toBeCloseTo(7, 9)
  })
})

/* ------------------------------------------------------------------ */
/* Nets                                                                */
/* ------------------------------------------------------------------ */

describe('nets, read off the wiring', () => {
  it('makes one net per group of wired terminals', () => {
    const { doc, ic, r1, c1 } = blinker()
    const nets = buildNets(doc)

    const discharge = nets.netOf.get(padKey(ic, 'disch'))
    expect(discharge).toBeDefined()
    expect(nets.netOf.get(padKey(r1, '1'))).toBe(discharge)

    // Threshold, the other end of R1 and one side of C1 are one net.
    const thresh = nets.netOf.get(padKey(ic, 'thresh'))
    expect(nets.netOf.get(padKey(r1, '2'))).toBe(thresh)
    expect(nets.netOf.get(padKey(c1, '1'))).toBe(thresh)
    expect(thresh).not.toBe(discharge)
  })

  it('names the ground net after what it is', () => {
    const { doc } = blinker()
    const nets = buildNets(doc)
    expect(nets.list.some((n) => n.name === 'GND')).toBe(true)
  })

  it('counts a net once however many wires make it', () => {
    const { doc, ic, c1 } = blinker()
    // A second wire between two terminals already on one net.
    wire(doc, [ic, 'gnd'], [c1, '2'])
    const nets = buildNets(doc)
    const gnd = nets.list.find((n) => n.name === 'GND')!
    expect(gnd.pads).toHaveLength(2)
  })

  it('leaves an unwired terminal on no net', () => {
    const { doc, ic } = blinker()
    const nets = buildNets(doc)
    expect(nets.netOf.has(padKey(ic, 'out'))).toBe(false)
  })

  it('numbers nets the same way every time it reads the same document', () => {
    const { doc } = blinker()
    expect(buildNets(doc).list.map((n) => n.name)).toEqual(buildNets(doc).list.map((n) => n.name))
  })
})

/* ------------------------------------------------------------------ */
/* Placement and copper                                                */
/* ------------------------------------------------------------------ */

function laidOut(): { doc: Doc; pcb: Pcb } {
  const { doc } = blinker()
  const pcb = emptyPcb()
  const a = arrange(doc, pcb)
  pcb.placements = a.placements
  pcb.w = a.w
  pcb.h = a.h
  return { doc, pcb }
}

describe('arranging', () => {
  it('puts every board part on the board', () => {
    const { doc, pcb } = laidOut()
    expect(Object.keys(pcb.placements).sort()).toEqual(boardParts(doc).sort())
  })

  it('starts with nothing overlapping and nothing off the edge', () => {
    const { doc, pcb } = laidOut()
    const nets = buildNets(doc)
    const v = checkBoard(pcb, flatten(doc, pcb, nets), nets)
    expect(v.filter((x) => x.title.includes('overlaps'))).toHaveLength(0)
    expect(v.filter((x) => x.title.includes('over the edge'))).toHaveLength(0)
  })

  it('keeps a part whose body is not centred on its pads inside the board', () => {
    /*
     * A DC barrel jack is three solder tags at one end of a body that
     * reaches 15 mm the other way, so its origin is nowhere near the
     * middle of the space it needs. Packing it by size alone and then
     * placing its origin in the middle of that space left it hanging
     * over the edge by everything the origin was offset by.
     */
    const doc = emptyDoc()
    add(doc, 'jack-barrel-dc')
    add(doc, 'ne555')
    add(doc, 'resistor-axial')

    const pcb = emptyPcb()
    const a = arrange(doc, pcb)
    Object.assign(pcb, { placements: a.placements, w: a.w, h: a.h })

    for (const id of boardParts(doc)) {
      const fp = footprintOf(doc.instances[id])!
      const pl = pcb.placements[id]
      expect(pl).toBeDefined()
      const b = footprintBounds(fp)
      expect(pl.x + b.min[0]).toBeGreaterThanOrEqual(-pcb.w / 2)
      expect(pl.x + b.max[0]).toBeLessThanOrEqual(pcb.w / 2)
      expect(pl.y + b.min[1]).toBeGreaterThanOrEqual(-pcb.h / 2)
      expect(pl.y + b.max[1]).toBeLessThanOrEqual(pcb.h / 2)
    }
  })

  it('leaves the bench instruments off the board', () => {
    /*
     * A bench supply is category `power` and has electrical terminals,
     * and it is a shoebox on the desk that the board plugs into. Taking
     * it for a component sized a 555 blinker's board at 170 mm across.
     */
    const doc = emptyDoc()
    const r = add(doc, 'resistor-axial')
    const psu = add(doc, 'bench-supply')
    expect(boardable(doc.instances[r])).toBe(true)
    expect(boardable(doc.instances[psu])).toBe(false)
  })

  it('leaves the room the rule asks for at the edge', () => {
    const { doc, pcb } = laidOut()
    const flat = flatten(doc, pcb, buildNets(doc))
    for (const p of flat.pads) {
      expect(Math.abs(p.at[0]) + p.size[0] / 2).toBeLessThanOrEqual(pcb.w / 2 - pcb.rules.edge + 1e-6)
      expect(Math.abs(p.at[1]) + p.size[1] / 2).toBeLessThanOrEqual(pcb.h / 2 - pcb.rules.edge + 1e-6)
    }
  })
})

describe('copper and connectivity', () => {
  it('starts with every net unrouted', () => {
    const { doc, pcb } = laidOut()
    const nets = buildNets(doc)
    const flat = flatten(doc, pcb, nets)
    const conn = Connectivity.of(flat)
    const rats = ratsnest(flat, nets, conn)
    const routable = nets.list.filter((n) => n.pads.length >= 2)
    // One line per join still needed: a net of n pads needs n-1.
    const want = routable.reduce((s, n) => s + n.pads.length - 1, 0)
    expect(rats).toHaveLength(want)
  })

  it('counts a net routed once a track lands on both its pads', () => {
    const { doc, pcb } = laidOut()
    const nets = buildNets(doc)
    const net = nets.list.find((n) => n.pads.length === 2)!
    const flat0 = flatten(doc, pcb, nets)
    const a = flat0.padByKey.get(padKey(net.pads[0].instanceId, net.pads[0].portId))!
    const b = flat0.padByKey.get(padKey(net.pads[1].instanceId, net.pads[1].portId))!

    pcb.tracks.t1 = { id: 't1', net: net.id, layer: 'top', width: 0.4, pts: [a.at, b.at] }
    pcb.trackOrder.push('t1')

    const flat = flatten(doc, pcb, nets)
    expect(Connectivity.of(flat).joined(a.key, b.key)).toBe(true)
    expect(ratsnest(flat, nets, Connectivity.of(flat)).filter((r) => r.net === net.id)).toHaveLength(0)
  })

  it('does not join two pads with a track that stops short of one', () => {
    const { doc, pcb } = laidOut()
    const nets = buildNets(doc)
    const net = nets.list.find((n) => n.pads.length === 2)!
    const flat0 = flatten(doc, pcb, nets)
    const a = flat0.padByKey.get(padKey(net.pads[0].instanceId, net.pads[0].portId))!
    const b = flat0.padByKey.get(padKey(net.pads[1].instanceId, net.pads[1].portId))!
    const short: [number, number] = [(a.at[0] + b.at[0]) / 2, (a.at[1] + b.at[1]) / 2]

    pcb.tracks.t1 = { id: 't1', net: net.id, layer: 'top', width: 0.4, pts: [a.at, short] }
    pcb.trackOrder.push('t1')

    const flat = flatten(doc, pcb, nets)
    expect(Connectivity.of(flat).joined(a.key, b.key)).toBe(false)
  })

  it('carries a net to the other layer through a via', () => {
    const { doc, pcb } = laidOut()
    const nets = buildNets(doc)
    const net = nets.list.find((n) => n.pads.length === 2)!
    const flat0 = flatten(doc, pcb, nets)
    const a = flat0.padByKey.get(padKey(net.pads[0].instanceId, net.pads[0].portId))!
    const b = flat0.padByKey.get(padKey(net.pads[1].instanceId, net.pads[1].portId))!
    const v: [number, number] = [(a.at[0] + b.at[0]) / 2, (a.at[1] + b.at[1]) / 2]

    pcb.vias.v1 = { id: 'v1', net: net.id, at: v, drill: 0.4, pad: 0.8 }
    pcb.viaOrder.push('v1')
    pcb.tracks.t1 = { id: 't1', net: net.id, layer: 'top', width: 0.4, pts: [a.at, v] }
    pcb.tracks.t2 = { id: 't2', net: net.id, layer: 'bottom', width: 0.4, pts: [v, b.at] }
    pcb.trackOrder.push('t1', 't2')

    const flat = flatten(doc, pcb, nets)
    expect(Connectivity.of(flat).joined(a.key, b.key)).toBe(true)
  })

  it('does not join two layers without one', () => {
    const { doc, pcb } = laidOut()
    const nets = buildNets(doc)
    const net = nets.list.find((n) => n.pads.length === 2)!
    const flat0 = flatten(doc, pcb, nets)
    const a = flat0.padByKey.get(padKey(net.pads[0].instanceId, net.pads[0].portId))!
    const b = flat0.padByKey.get(padKey(net.pads[1].instanceId, net.pads[1].portId))!
    const m: [number, number] = [(a.at[0] + b.at[0]) / 2, (a.at[1] + b.at[1]) / 2]

    pcb.tracks.t1 = { id: 't1', net: net.id, layer: 'top', width: 0.4, pts: [a.at, m] }
    pcb.tracks.t2 = { id: 't2', net: net.id, layer: 'bottom', width: 0.4, pts: [m, b.at] }
    pcb.trackOrder.push('t1', 't2')

    // Through-plated pads reach both layers, so the two runs must not be
    // joined by the bare fact of meeting in mid-air.
    const flat = flatten(doc, pcb, nets)
    expect(Connectivity.of(flat).joined('seg:t1', 'seg:t2')).toBe(false)
  })
})

/* ------------------------------------------------------------------ */
/* The rule check                                                      */
/* ------------------------------------------------------------------ */

describe('the rule check', () => {
  it('reports an empty board as nothing placed', () => {
    const doc = emptyDoc()
    const pcb = emptyPcb()
    const nets = buildNets(doc)
    const v = checkBoard(pcb, flatten(doc, pcb, nets), nets)
    expect(v).toHaveLength(1)
    expect(v[0].title).toBe('Nothing on the board')
  })

  it('reports an unrouted net as an error', () => {
    const { doc, pcb } = laidOut()
    const nets = buildNets(doc)
    const v = checkBoard(pcb, flatten(doc, pcb, nets), nets)
    expect(v.some((x) => x.severity === 'error' && x.title.includes('not routed'))).toBe(true)
  })

  it('reports copper of two nets that touches as a short', () => {
    const { doc, pcb } = laidOut()
    const nets = buildNets(doc)
    const flat0 = flatten(doc, pcb, nets)
    const [n1, n2] = nets.list.filter((n) => n.pads.length >= 2)
    const a = flat0.padByKey.get(padKey(n1.pads[0].instanceId, n1.pads[0].portId))!
    const b = flat0.padByKey.get(padKey(n2.pads[0].instanceId, n2.pads[0].portId))!

    pcb.tracks.t1 = { id: 't1', net: n1.id, layer: 'top', width: 0.4, pts: [a.at, b.at] }
    pcb.trackOrder.push('t1')

    const v = checkBoard(pcb, flatten(doc, pcb, nets), nets)
    expect(v.some((x) => x.severity === 'error' && x.title.includes('shorts to'))).toBe(true)
  })

  it('reports copper that is merely close as a warning, not a short', () => {
    const doc = emptyDoc()
    const pcb = emptyPcb(40, 40)
    const r1 = add(doc, 'resistor-axial')
    const r2 = add(doc, 'resistor-axial')
    const c1 = add(doc, 'capacitor-ceramic')
    wire(doc, [r1, '1'], [c1, '1'])
    wire(doc, [r2, '1'], [c1, '2'])
    // Two parts a hair apart: closer than the rule, not touching.
    pcb.placements[r1] = { x: 0, y: 0, rot: 90, side: 'top' }
    pcb.placements[r2] = { x: 1.9, y: 0, rot: 90, side: 'top' }
    pcb.placements[c1] = { x: 15, y: 15, rot: 0, side: 'top' }

    const nets = buildNets(doc)
    const v = checkBoard(pcb, flatten(doc, pcb, nets), nets)
    const close = v.filter((x) => x.title === 'Too close')
    expect(close.length).toBeGreaterThan(0)
    expect(close.every((x) => x.severity === 'warning')).toBe(true)
  })

  it('reports a part hanging over the edge', () => {
    const { doc, pcb } = laidOut()
    const id = boardParts(doc)[0]
    pcb.placements[id] = { ...pcb.placements[id], x: pcb.w / 2 }
    const nets = buildNets(doc)
    const v = checkBoard(pcb, flatten(doc, pcb, nets), nets)
    expect(v.some((x) => x.title.includes('over the edge'))).toBe(true)
  })

  it('reports two parts in the same place', () => {
    const { doc, pcb } = laidOut()
    const [a, b] = boardParts(doc)
    pcb.placements[b] = { ...pcb.placements[a] }
    const nets = buildNets(doc)
    const v = checkBoard(pcb, flatten(doc, pcb, nets), nets)
    expect(v.some((x) => x.severity === 'error' && x.title.includes('overlaps'))).toBe(true)
  })

  it('passes a board whose every net is routed', () => {
    /* Two resistors in series, three nets, hand-routed end to end. */
    const doc = emptyDoc()
    const r1 = add(doc, 'resistor-axial')
    const r2 = add(doc, 'resistor-axial')
    wire(doc, [r1, '2'], [r2, '1'])

    const pcb = emptyPcb(60, 40)
    pcb.placements[r1] = { x: -12, y: 0, rot: 0, side: 'top' }
    pcb.placements[r2] = { x: 12, y: 0, rot: 0, side: 'top' }

    const nets = buildNets(doc)
    const flat0 = flatten(doc, pcb, nets)
    const joined = nets.list.find((n) => n.pads.length === 2)!
    const a = flat0.padByKey.get(padKey(joined.pads[0].instanceId, joined.pads[0].portId))!
    const b = flat0.padByKey.get(padKey(joined.pads[1].instanceId, joined.pads[1].portId))!
    pcb.tracks.t1 = { id: 't1', net: joined.id, layer: 'top', width: 0.4, pts: [a.at, b.at] }
    pcb.trackOrder.push('t1')

    const v = checkBoard(pcb, flatten(doc, pcb, nets), nets)
    expect(errorsIn(v)).toBe(0)
  })
})

/* ------------------------------------------------------------------ */
/* Export                                                              */
/* ------------------------------------------------------------------ */

describe('zip', () => {
  it('computes the CRC the format asks for', () => {
    // The check value every CRC-32 implementation is tested against.
    expect(crc32(new TextEncoder().encode('123456789'))).toBe(0xcbf43926)
    expect(crc32(new Uint8Array(0))).toBe(0)
  })

  it('writes an archive with the headers a reader looks for', async () => {
    const blob = makeZip([{ name: 'a.txt', text: 'hello' }])
    const b = new Uint8Array(await blob.arrayBuffer())
    const dv = new DataView(b.buffer)
    expect(dv.getUint32(0, true)).toBe(0x04034b50)
    // End of central directory, last 22 bytes, naming one entry.
    const end = b.length - 22
    expect(dv.getUint32(end, true)).toBe(0x06054b50)
    expect(dv.getUint16(end + 10, true)).toBe(1)
  })
})

describe('gerber', () => {
  function job() {
    const { doc, pcb } = laidOut()
    const nets = buildNets(doc)
    return gerberFiles(pcb, flatten(doc, pcb, nets), 'Blinker')
  }

  it('writes the layers a board house expects, under the names it reads', () => {
    const names = job().map((f) => f.name)
    for (const suffix of ['-F_Cu.gbr', '-B_Cu.gbr', '-F_Mask.gbr', '-B_Mask.gbr', '-Edge_Cuts.gbr', '.drl']) {
      expect(names.some((n) => n.endsWith(suffix))).toBe(true)
    }
    expect(names.every((n) => !/\s/.test(n))).toBe(true)
  })

  it('declares millimetres and 4.6 format, and ends the file', () => {
    const cu = job().find((f) => f.name.endsWith('-F_Cu.gbr'))!.text
    expect(cu).toContain('%FSLAX46Y46*%')
    expect(cu).toContain('%MOMM*%')
    expect(cu.trim().endsWith('M02*')).toBe(true)
  })

  it('declares every aperture it then selects', () => {
    const cu = job().find((f) => f.name.endsWith('-F_Cu.gbr'))!.text
    const declared = new Set([...cu.matchAll(/%ADD(\d+)/g)].map((m) => m[1]))
    const used = new Set([...cu.matchAll(/^D(\d+)\*$/gm)].map((m) => m[1]))
    expect(used.size).toBeGreaterThan(0)
    for (const d of used) expect(declared.has(d)).toBe(true)
  })

  it('flashes a pad for every through-hole pad on the board', () => {
    const { doc, pcb } = laidOut()
    const nets = buildNets(doc)
    const flat = flatten(doc, pcb, nets)
    const cu = gerberFiles(pcb, flat, 'b').find((f) => f.name.endsWith('-F_Cu.gbr'))!.text
    expect([...cu.matchAll(/D03\*/g)]).toHaveLength(flat.pads.length)
  })

  it('drills one tool per hole size, and every hole', () => {
    const { doc, pcb } = laidOut()
    const nets = buildNets(doc)
    const flat = flatten(doc, pcb, nets)
    const drl = gerberFiles(pcb, flat, 'b').find((f) => f.name.endsWith('.drl'))!.text

    expect(drl.startsWith('M48')).toBe(true)
    expect(drl).toContain('METRIC,TZ')
    expect(drl.trim().endsWith('M30')).toBe(true)

    const sizes = new Set(flat.pads.filter((p) => p.drill > 0).map((p) => p.drill.toFixed(3)))
    expect([...drl.matchAll(/^T\d+C/gm)]).toHaveLength(sizes.size)
    const coords = [...drl.matchAll(/^X[-\d.]+Y[-\d.]+$/gm)]
    expect(coords).toHaveLength(flat.pads.filter((p) => p.drill > 0).length)
  })

  it('draws the outline at the board size', () => {
    const { doc, pcb } = laidOut()
    const nets = buildNets(doc)
    const edge = gerberFiles(pcb, flatten(doc, pcb, nets), 'b').find((f) => f.name.endsWith('-Edge_Cuts.gbr'))!.text
    const xs = [...edge.matchAll(/X(-?\d+)Y/g)].map((m) => Number(m[1]) / 1e6)
    expect(Math.max(...xs)).toBeCloseTo(pcb.w / 2, 6)
    expect(Math.min(...xs)).toBeCloseTo(-pcb.w / 2, 6)
  })

  it('opens the mask over every pad, a touch larger than the copper', () => {
    const { doc, pcb } = laidOut()
    const nets = buildNets(doc)
    const flat = flatten(doc, pcb, nets)
    const files = gerberFiles(pcb, flat, 'b')
    const cu = files.find((f) => f.name.endsWith('-F_Cu.gbr'))!.text
    const mask = files.find((f) => f.name.endsWith('-F_Mask.gbr'))!.text
    expect([...mask.matchAll(/D03\*/g)]).toHaveLength(flat.pads.length)

    const biggest = (t: string) => Math.max(...[...t.matchAll(/%ADD\d+C,([\d.]+)/g)].map((m) => Number(m[1])))
    expect(biggest(mask)).toBeGreaterThan(biggest(cu))
  })
})
