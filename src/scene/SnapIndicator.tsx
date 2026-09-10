import { useEffect, useMemo, useRef, useState } from 'react'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'
import { Html } from '@react-three/drei'
import type { SnapHit } from './snap'

/**
 * What a snap looks like while it is happening.
 *
 * A ring on the terminal being joined and a label naming it. Without this the
 * part simply moves and you have to guess whether it took, which is the
 * difference between a snap that feels deliberate and one that feels like the
 * software fighting you.
 */

/** A one-value store outside React: this changes every frame of a drag. */
class SnapStore {
  private hit: SnapHit | null = null
  private listeners = new Set<(h: SnapHit | null) => void>()

  set(hit: SnapHit | null): void {
    // Only wake React when the join itself changes, not on every frame the
    // pointer moves while sitting on the same terminal.
    const same =
      hit === this.hit ||
      (hit !== null &&
        this.hit !== null &&
        hit.targetInstance === this.hit.targetInstance &&
        hit.targetPort === this.hit.targetPort &&
        hit.movingPort === this.hit.movingPort)
    this.hit = hit
    if (!same) for (const l of this.listeners) l(hit)
  }

  get(): SnapHit | null {
    return this.hit
  }

  subscribe(fn: (h: SnapHit | null) => void): () => void {
    this.listeners.add(fn)
    return () => this.listeners.delete(fn)
  }
}

export const snapStore = new SnapStore()

const RING_COLOR = { electrical: '#4C8DFF', mechanical: '#FFB020' } as const

export function SnapIndicator() {
  const [hit, setHit] = useState<SnapHit | null>(null)
  const ring = useRef<THREE.Group>(null)

  useEffect(() => snapStore.subscribe(setHit), [])

  // The join point can drift by a fraction while the pointer moves over the
  // same terminal, so follow it every frame rather than on state changes.
  useFrame(({ clock }) => {
    const g = ring.current
    const current = snapStore.get()
    if (!g || !current) return
    g.position.copy(current.at)
    const pulse = 1 + Math.sin(clock.elapsedTime * 9) * 0.1
    g.scale.setScalar(pulse)
  })

  const material = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        color: RING_COLOR.electrical,
        toneMapped: false,
        transparent: true,
        opacity: 0.95,
        depthTest: false,
      }),
    [],
  )

  useEffect(() => {
    if (hit) material.color.set(RING_COLOR[hit.kind])
  }, [hit, material])

  useEffect(() => () => material.dispose(), [material])

  if (!hit) return null

  return (
    <group ref={ring} renderOrder={999}>
      <mesh material={material} renderOrder={999}>
        <torusGeometry args={[2.6, 0.42, 8, 24]} />
      </mesh>
      <mesh material={material} rotation={[Math.PI / 2, 0, 0]} renderOrder={999}>
        <torusGeometry args={[2.6, 0.42, 8, 24]} />
      </mesh>
      <Html center distanceFactor={140} zIndexRange={[20, 0]} style={{ pointerEvents: 'none' }}>
        <div className="snap-tag" data-kind={hit.kind}>
          {hit.kind === 'mechanical' ? 'Joins to ' : 'Into '}
          <b>{hit.targetLabel}</b>
        </div>
      </Html>
    </group>
  )
}
