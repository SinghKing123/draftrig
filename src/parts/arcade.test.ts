import { describe, expect, it } from 'vitest'
import * as THREE from 'three'
import '@/parts'
import { getPart, defaultParams } from '@/parts/kernel/registry'
import { buildPart } from '@/parts/kernel/build'

/**
 * The cabinet hardware.
 *
 * A new part can compile, register and still be wrong in the two ways that
 * matter: no geometry, or geometry the wrong size. A 19" monitor whose body
 * comes out 40 mm across is a part that will be laid out against the wrong
 * panel cutout, and nothing else in the pipeline will say so.
 */

const IDS = ['monitor-panel', 'arcade-button', 'arcade-joystick']

describe('arcade hardware', () => {
  it('is registered and builds', () => {
    for (const id of IDS) {
      const def = getPart(id)
      expect(def, id).toBeTruthy()
      const built = buildPart(def!, {})
      expect(built.ports.length, `${id} ports`).toBeGreaterThan(1)
      const size = built.bbox.getSize(new THREE.Vector3())
      expect(size.x * size.y * size.z, `${id} volume`).toBeGreaterThan(1)
    }
  })

  it('sizes the monitor from its diagonal', () => {
    const def = getPart('monitor-panel')!
    const at = (d: string) => {
      const b = buildPart(def, { ...defaultParams(def), diagonal: d })
      return b.bbox.getSize(new THREE.Vector3())
    }
    const small = at('15')
    const large = at('27')
    console.log(`monitor 15" ${small.x.toFixed(0)}x${small.y.toFixed(0)}  27" ${large.x.toFixed(0)}x${large.y.toFixed(0)} mm`)
    // A 27" 16:9 panel is 598 mm across its active area, plus the bezel.
    expect(large.x).toBeGreaterThan(590)
    expect(large.x).toBeLessThan(680)
    expect(large.x / large.y).toBeGreaterThan(1.4)
    expect(large.x).toBeGreaterThan(small.x * 1.6)
  })

  it('wires a stick as four contacts to one common', () => {
    const def = getPart('arcade-joystick')!
    const ports = def.ports(defaultParams(def)).map((p) => p.id)
    expect(ports).toContain('com')
    for (const d of ['up', 'down', 'left', 'right']) expect(ports).toContain(d)

    const devs = def.electrical!.devices({ ...defaultParams(def), lean: 'left' })
    expect(devs).toHaveLength(4)
    // Exactly the direction it is pushed is closed.
    const closed = devs.filter((d) => 'closed' in d && d.closed)
    expect(closed).toHaveLength(1)
    expect(closed[0]).toMatchObject({ b: 'left' })
  })

  it('closes a button only when it is pressed', () => {
    const def = getPart('arcade-button')!
    const open = def.electrical!.devices({ ...defaultParams(def), pressed: false })
    const shut = def.electrical!.devices({ ...defaultParams(def), pressed: true })
    expect(open[0]).toMatchObject({ closed: false })
    expect(shut[0]).toMatchObject({ closed: true })
  })

  it('draws more current on a bigger panel', () => {
    const def = getPart('monitor-panel')!
    const r = (d: string) => {
      const dev = def.electrical!.devices({ ...defaultParams(def), diagonal: d })[0]
      return 'r' in dev ? dev.r : 0
    }
    // Same supply, lower resistance, so more amps on the larger panel.
    expect(r('27')).toBeLessThan(r('15'))
  })
})
