import { describe, expect, it } from 'vitest'
import { PortIndex } from '@/scene/portIndex'
import { listInstances } from '@/state/doc'
import { logicBench, soundBench, espWeather, thrustRig, rfidLock, servoArm } from './builds'
import '@/parts'

const MADE = {
  'logic-bench': logicBench,
  'sound-bench': soundBench,
  'esp-weather': espWeather,
  'thrust-rig': thrustRig,
  'rfid-lock': rfidLock,
  'servo-arm': servoArm,
}

describe('the new builds', () => {
  it('resolve every port they wire to', () => {
    const bad: string[] = []
    for (const [name, make] of Object.entries(MADE)) {
      const doc = make()
      const index = new PortIndex(listInstances(doc))
      for (const cid of doc.connectionOrder) {
        const c = doc.connections[cid]
        for (const end of [c.a, c.b]) {
          if (!index.get(end.instanceId, end.portId)) {
            const inst = doc.instances[end.instanceId]
            bad.push(`${name}: ${inst?.defId ?? end.instanceId}.${end.portId}`)
          }
        }
      }
    }
    expect(bad.slice(0, 20)).toEqual([])
  })

  it('are worth looking at', () => {
    for (const [name, make] of Object.entries(MADE)) {
      const doc = make()
      const parts = Object.keys(doc.instances).length
      const wires = doc.connectionOrder.length
      console.log(`${name.padEnd(13)} ${String(parts).padStart(3)} parts  ${String(wires).padStart(3)} wires`)
      expect(parts).toBeGreaterThan(4)
    }
  })
})
