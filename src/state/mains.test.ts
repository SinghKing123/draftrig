import { beforeEach, describe, expect, it } from 'vitest'
import '@/parts'
import { useDoc } from '@/state/doc'
import { requirePart } from '@/parts/kernel/registry'
import { defaultParams } from '@/parts/kernel/build'

/**
 * Plugging something in.
 *
 * Mains used to be three loose terminals at each end, so putting a
 * monitor on a socket was six clicks of circuit wiring — and getting
 * five of them right left a build that looked finished and had no
 * earth. A lead is one object with a shape on each end; it either fits
 * or it does not, and it goes in all at once.
 *
 * These check the three things that makes true: that one click carries
 * every conductor, that pulling one pulls them all, and that a lead
 * whose ends are wrong is refused rather than quietly half-connected.
 */

const doc = () => useDoc.getState()

function put(defId: string, params: Record<string, unknown> = {}): string {
  const id = doc().addPart(defId, [0, 0, 0], {
    ...defaultParams(requirePart(defId)),
    ...params,
  } as never)
  if (!id) throw new Error(`could not place ${defId}`)
  return id
}

/** Every connection currently in the document. */
const wires = () => {
  const d = doc().doc
  return d.connectionOrder.map((id) => d.connections[id])
}

beforeEach(() => {
  useDoc.getState().newDoc()
})

describe('plugging a lead in', () => {
  it('carries live, neutral and earth on one click', () => {
    const socket = put('outlet-mains', { region: 'uk' })
    const cord = put('cable-power-cord', { plug: 'bs1363', end: 'iec-c14' })

    doc().connect(
      { instanceId: cord, portId: 'a_l' },
      { instanceId: socket, portId: 'al' },
    )

    const made = wires()
    expect(made).toHaveLength(3)
    expect(made.map((c) => c.a.portId).sort()).toEqual(['a_e', 'a_l', 'a_n'])
    expect(made.map((c) => c.b.portId).sort()).toEqual(['ae', 'al', 'an'])
    /* One plug action, one link, so it comes out as one thing. */
    expect(new Set(made.map((c) => c.link)).size).toBe(1)
    /* Mains flex, not a 300 V jumper. */
    expect(made.every((c) => c.gauge === 0.75 && c.insulationV === 500)).toBe(true)
  })

  it('unplugs as one, whichever conductor is pulled', () => {
    const socket = put('outlet-mains', { region: 'uk' })
    const cord = put('cable-power-cord', { plug: 'bs1363', end: 'iec-c14' })
    doc().connect({ instanceId: cord, portId: 'a_l' }, { instanceId: socket, portId: 'al' })

    const earth = wires().find((c) => c.a.portId === 'a_e')
    expect(earth).toBeDefined()
    doc().disconnect([earth!.id])

    expect(wires()).toHaveLength(0)
  })

  it('refuses a lead whose plug is not the socket in the wall', () => {
    const socket = put('outlet-mains', { region: 'uk' })
    const cord = put('cable-power-cord', { plug: 'nema5-15', end: 'iec-c14' })

    doc().connect({ instanceId: cord, portId: 'a_l' }, { instanceId: socket, portId: 'al' })

    /*
     * One wire, not three. The click is still honoured — two terminals
     * were named and joining terminals is always allowed — but it is
     * not a plug going into a socket, so nothing is assumed about the
     * other two conductors.
     */
    const made = wires()
    expect(made).toHaveLength(1)
    expect(made[0].link).toBeUndefined()
  })

  it('will not mate two ends of the same sex', () => {
    const a = put('cable-power-cord', { plug: 'bs1363', end: 'iec-c14' })
    const b = put('cable-power-cord', { plug: 'bs1363', end: 'iec-c14' })

    /* Both are plugs. Two leads joined pin to pin is a live lead lying
       on the floor, and it is not a connector mating. */
    doc().connect({ instanceId: a, portId: 'a_l' }, { instanceId: b, portId: 'a_l' })
    expect(wires()).toHaveLength(1)
    expect(wires()[0].link).toBeUndefined()
  })

  it('plugs the appliance end into a monitor', () => {
    const cord = put('cable-power-cord', { plug: 'bs1363', end: 'iec-c14' })
    const monitor = put('monitor-desk')

    doc().connect({ instanceId: cord, portId: 'b_l' }, { instanceId: monitor, portId: 'l' })

    const made = wires()
    expect(made).toHaveLength(3)
    expect(made.map((c) => c.b.portId).sort()).toEqual(['e', 'l', 'n'])
  })

  it('a two-core lead has no earth to carry', () => {
    const cord = put('cable-power-cord', { plug: 'bs1363', end: 'iec-c8' })
    const ports = requirePart('cable-power-cord').ports({
      ...defaultParams(requirePart('cable-power-cord')),
      plug: 'bs1363',
      end: 'iec-c8',
    })
    /* Three pins at the wall, two at the appliance: a figure-of-eight
       lead is two-core, and the earth stops at the plug. */
    expect(ports.filter((p) => p.id.startsWith('a_')).map((p) => p.id).sort()).toEqual(['a_e', 'a_l', 'a_n'])
    expect(ports.filter((p) => p.id.startsWith('b_')).map((p) => p.id).sort()).toEqual(['b_l', 'b_n'])
    expect(cord).toBeTruthy()
  })
})
