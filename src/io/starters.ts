import type { Doc } from '@/state/doc'
import { emptyDoc } from '@/state/doc'
import type { Instance, Params, Vec3 } from '@/parts/kernel/types'
import { defaultParams } from '@/parts/kernel/build'
import { requirePart } from '@/parts/kernel/registry'

/**
 * Starter builds. These are ordinary documents constructed in code, which
 * doubles as a readable specification of what a well-formed project looks like.
 */

class DocBuilder {
  readonly doc: Doc = emptyDoc()
  private n = 0

  constructor(name: string) {
    this.doc.name = name
  }

  add(defId: string, pos: Vec3, params: Params = {}, rot: Vec3 = [0, 0, 0], name?: string): string {
    const def = requirePart(defId)
    const id = `s${this.n++}`
    const inst: Instance = {
      id,
      defId,
      name: name ?? `${def.name} ${this.n}`,
      params: { ...defaultParams(def), ...params },
      pos,
      rot,
    }
    this.doc.instances[id] = inst
    this.doc.order.push(id)
    return id
  }

  wire(a: [string, string], b: [string, string], color = '#E34B4B'): void {
    const id = `w${this.n++}`
    this.doc.connections[id] = {
      id,
      kind: 'wire',
      a: { instanceId: a[0], portId: a[1] },
      b: { instanceId: b[0], portId: b[1] },
      color,
      gauge: 0.205,
    }
    this.doc.connectionOrder.push(id)
  }
}

/* ------------------------------------------------------------------ */

/** The first circuit anyone builds: supply, resistor, LED. */
function ledCircuit(): Doc {
  const b = new DocBuilder('Blinking start — LED and resistor')

  const bb = b.add('breadboard', [0, 0, 0], { size: '830' }, [0, 0, 0], 'Breadboard')
  const bat = b.add('battery-holder', [-190, 0, 90], { cell: 'aa', count: 3 }, [0, 0, 0], 'Battery pack')
  const res = b.add('resistor-axial', [-25.4, 9, 9.5], { value: 220, watt: '0.25', pitch: 10.16 }, [0, 90, 0], 'Series resistor')
  const led = b.add('led-5mm', [0, 9, 9.5], { color: 'red' }, [0, 0, 0], 'Indicator')
  const gnd = b.add('ground', [60, 9, 22.9], {}, [0, 0, 0], 'Ground')

  // Battery to the rails.
  b.wire([bat, 'p'], [bb, 'pos-near-4'], '#E34B4B')
  b.wire([bat, 'n'], [bb, 'neg-near-4'], '#1C1F24')
  // Rail to resistor, resistor to LED, LED back to the negative rail.
  b.wire([bb, 'pos-near-14'], [res, '1'], '#E34B4B')
  b.wire([res, '2'], [led, 'a'], '#E3A64B')
  b.wire([led, 'c'], [bb, 'neg-near-20'], '#1C1F24')
  b.wire([gnd, 'gnd'], [bb, 'neg-near-24'], '#3DD68C')

  return b.doc
}

/** A 2020 frame — the mechanical half of the tool, in one click. */
function frameCube(): Doc {
  const b = new DocBuilder('2020 frame — 300 mm cube')
  const L = 300
  const params = { size: '2020', length: L, finish: 'alu-anod-black' }

  // Base square.
  b.add('extrusion-tslot', [0, 0, -140], params, [0, 0, 0], 'Base front')
  b.add('extrusion-tslot', [0, 0, 140], params, [0, 0, 0], 'Base back')
  b.add('extrusion-tslot', [-140, 0, 0], params, [0, 90, 0], 'Base left')
  b.add('extrusion-tslot', [140, 0, 0], params, [0, 90, 0], 'Base right')

  // Uprights. A beam is authored lying down with its origin on the seating
  // face, so standing one up needs a half-profile offset in X and half its
  // length in Y.
  for (const [x, z] of [[-140, -140], [140, -140], [-140, 140], [140, 140]] as const) {
    b.add('extrusion-tslot', [x + 10, L / 2, z], params, [0, 0, 90], `Upright ${x},${z}`)
  }

  // Top square.
  b.add('extrusion-tslot', [0, 300, -140], params, [0, 0, 0], 'Top front')
  b.add('extrusion-tslot', [0, 300, 140], params, [0, 0, 0], 'Top back')
  b.add('extrusion-tslot', [-140, 300, 0], params, [0, 90, 0], 'Top left')
  b.add('extrusion-tslot', [140, 300, 0], params, [0, 90, 0], 'Top right')

  // Deck.
  b.add('panel-sheet', [0, 20, 0], { material: 'plywood', width: 260, depth: 260, thickness: 12, corner: 6 }, [0, 0, 0], 'Deck')

  for (const [x, z] of [[-140, -140], [140, -140], [-140, 140], [140, 140]] as const) {
    b.add('bracket-corner-2020', [x, 20, z], { size: '20' }, [0, 0, 0], 'Corner bracket')
  }

  return b.doc
}

/** Motor, switch and supply — the smallest thing that moves. */
function motorRig(): Doc {
  const b = new DocBuilder('Motor test rig')
  const psu = b.add('bench-supply', [-190, 0, 0], { voltage: 6, ilimit: 2 }, [0, 0, 0], 'Bench supply')
  const sw = b.add('switch-toggle', [-20, 12, 40], { poles: 'spst', on: false }, [0, 0, 0], 'Power switch')
  const motor = b.add('motor-dc', [90, 0, 0], { vnom: 6, rpm: 9000, rwind: 3.2 }, [0, 0, 0], 'Drive motor')
  const gnd = b.add('ground', [-20, 0, -50], {}, [0, 0, 0], 'Ground')

  b.wire([psu, 'p'], [sw, 'com'], '#E34B4B')
  b.wire([sw, 'no'], [motor, 'p'], '#E34B4B')
  b.wire([motor, 'n'], [psu, 'n'], '#1C1F24')
  b.wire([psu, 'n'], [gnd, 'gnd'], '#3DD68C')

  b.add('panel-sheet', [0, 0, 0], { material: 'plywood', width: 300, depth: 200, thickness: 12 }, [0, 0, 0], 'Base plate')
  return b.doc
}

export interface Starter {
  id: string
  title: string
  blurb: string
  build: () => Doc
}

export const STARTERS: Starter[] = [
  { id: 'led', title: 'LED on a breadboard', blurb: 'Supply, resistor and LED — see the current arrive', build: ledCircuit },
  { id: 'frame', title: '2020 frame cube', blurb: 'A 300 mm extrusion frame with a plywood deck', build: frameCube },
  { id: 'motor', title: 'Motor test rig', blurb: 'Bench supply through a switch into a DC motor', build: motorRig },
]
