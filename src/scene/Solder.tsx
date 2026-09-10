import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { usePortIndex, type WorldPort } from './portIndex'
import { useConnectionList, useDoc } from '@/state/doc'
import { resolveMaterial } from '@/parts/kernel/materials'
import { threeMaterial } from './materials'

/**
 * Solder joints.
 *
 * Drawn wherever a plated hole has something in it: a lead seated in it, or a
 * wire soldered to it. A breadboard never gets one, because its holes grip
 * rather than get soldered, and that difference is the whole reason the two
 * boards exist.
 *
 * The joint is a lathed fillet rather than a blob: solder wets up the lead and
 * out onto the pad, which is what makes a good one recognisable.
 */

/** How close a lead has to be to a hole to count as sitting in it, mm. */
const SEATED = 1.4

/** Profile of one joint, revolved: pad edge, up the fillet, onto the lead. */
function filletGeometry(): THREE.LatheGeometry {
  const pts = [
    new THREE.Vector2(0.02, 0),
    new THREE.Vector2(0.95, 0),
    new THREE.Vector2(0.92, 0.16),
    new THREE.Vector2(0.72, 0.42),
    new THREE.Vector2(0.52, 0.66),
    new THREE.Vector2(0.4, 0.84),
    new THREE.Vector2(0.36, 1.0),
  ]
  const g = new THREE.LatheGeometry(pts, 14)
  g.computeVertexNormals()
  return g
}

export function Solder() {
  const index = usePortIndex()
  const connections = useConnectionList()
  const show = useDoc((s) => s.view.wires)
  const meshRef = useRef<THREE.InstancedMesh>(null)

  const geometry = useMemo(() => filletGeometry(), [])
  const material = useMemo(() => threeMaterial(resolveMaterial('solder')), [])

  useEffect(() => () => geometry.dispose(), [geometry])

  /** Every plated hole that has something in it. */
  const joints = useMemo(() => {
    const holes = index.list.filter((p) => p.port.kind === 'electrical' && p.port.solderable)
    if (!holes.length) return []

    // A hole is soldered if a lead sits in it, or if a wire ends at it.
    const wired = new Set<string>()
    for (const c of connections) {
      if (c.kind !== 'wire') continue
      wired.add(`${c.a.instanceId}:${c.a.portId}`)
      wired.add(`${c.b.instanceId}:${c.b.portId}`)
    }

    const out: { at: THREE.Vector3; dir: THREE.Vector3; size: number }[] = []
    for (const hole of holes) {
      const lead = index.nearest(
        hole.pos,
        SEATED,
        (q: WorldPort) => q.instanceId !== hole.instanceId && q.port.kind === 'electrical',
      )
      const isWired = wired.has(`${hole.instanceId}:${hole.portId}`)
      if (!lead && !isWired) continue
      out.push({
        at: hole.pos,
        dir: hole.dir.lengthSq() > 0 ? hole.dir : new THREE.Vector3(0, 1, 0),
        // A joint carrying a lead is a little fuller than a bare wire tack.
        size: lead ? 1 : 0.82,
      })
    }
    return out
  }, [index, connections])

  useEffect(() => {
    const mesh = meshRef.current
    if (!mesh) return
    const up = new THREE.Vector3(0, 1, 0)
    const q = new THREE.Quaternion()
    const m = new THREE.Matrix4()
    const scale = new THREE.Vector3()
    joints.forEach((j, i) => {
      q.setFromUnitVectors(up, j.dir)
      scale.set(j.size, j.size * 1.15, j.size)
      m.compose(j.at, q, scale)
      mesh.setMatrixAt(i, m)
    })
    mesh.count = joints.length
    mesh.instanceMatrix.needsUpdate = true
  }, [joints])

  if (!show || !joints.length) return null

  return (
    <instancedMesh
      ref={meshRef}
      args={[geometry, material, Math.max(joints.length, 1)]}
      frustumCulled={false}
      castShadow
      receiveShadow
      // Solder is scenery, not something to click through to.
      raycast={() => null}
    />
  )
}
