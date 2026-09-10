import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'
import type { BuiltSurface } from '@/parts/kernel/build'
import { fbKey, peekFramebuffer } from '@/sim/display/framebuffer'
import { createLiveTexture, silkTexture } from './textures'

/**
 * The flat, textured surfaces of a part: silkscreen and live displays.
 *
 * Both are quads sitting a hair proud of the solid underneath them, which is
 * how they avoid z-fighting with it. Silkscreen is baked once and shared by
 * every instance of the part. A display is per-instance, because two LCDs on
 * the same bench are not showing the same thing.
 */

/** Cursor blink, Hz. The HD44780 blinks at roughly this rate. */
const BLINK_HZ = 1.6

function Silk({ surface }: { surface: BuiltSurface }) {
  const texture = useMemo(() => silkTexture(surface), [surface])
  const material = useMemo(() => {
    if (!texture) return null
    return new THREE.MeshStandardMaterial({
      map: texture,
      transparent: true,
      roughness: 0.72,
      metalness: 0,
      // Ink sits on top of the board rather than replacing it, so it must not
      // write depth or it would punch a hole in whatever is behind the quad.
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -2,
      polygonOffsetUnits: -2,
      side: THREE.DoubleSide,
    })
  }, [texture])

  useEffect(() => () => material?.dispose(), [material])
  if (!material) return null

  return (
    <mesh matrixAutoUpdate={false} matrix={surface.matrix} renderOrder={1}>
      <planeGeometry args={[surface.size[0], surface.size[1]]} />
      <primitive object={material} attach="material" />
    </mesh>
  )
}

function Screen({ surface, instanceId }: { surface: BuiltSurface; instanceId: string }) {
  const live = useMemo(() => createLiveTexture(surface.size), [surface])
  const key = fbKey(instanceId, surface.screen ?? 'main')
  const material = useRef<THREE.MeshStandardMaterial>(null)

  const mat = useMemo(() => {
    if (!live) return null
    return new THREE.MeshStandardMaterial({
      map: live.texture,
      emissive: new THREE.Color('#FFFFFF'),
      emissiveMap: live.texture,
      // A panel that is off should still be visible as glass, so the emissive
      // contribution is modest and the diffuse map carries the rest.
      emissiveIntensity: 0.55,
      roughness: 0.28,
      metalness: 0,
    })
  }, [live])

  useEffect(
    () => () => {
      mat?.dispose()
      live?.dispose()
    },
    [mat, live],
  )

  useFrame(({ clock }) => {
    if (!live) return
    const blink = Math.floor(clock.elapsedTime * BLINK_HZ) % 2 === 0
    live.update(peekFramebuffer(key), blink)
  })

  if (!mat) return null

  return (
    <mesh matrixAutoUpdate={false} matrix={surface.matrix} renderOrder={1}>
      <planeGeometry args={[surface.size[0], surface.size[1]]} />
      <primitive object={mat} attach="material" ref={material} />
    </mesh>
  )
}

export function Surfaces({ surfaces, instanceId }: { surfaces: BuiltSurface[]; instanceId: string }) {
  return (
    <>
      {surfaces.map((s, i) =>
        s.kind === 'silk' ? (
          <Silk key={`${s.key}-${i}`} surface={s} />
        ) : (
          <Screen key={`${s.key}-${i}`} surface={s} instanceId={instanceId} />
        ),
      )}
    </>
  )
}
