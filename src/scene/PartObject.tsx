import { memo, useMemo, useRef } from 'react'
import * as THREE from 'three'
import type { ThreeEvent } from '@react-three/fiber'
import { buildPart } from '@/parts/kernel/build'
import { getPart } from '@/parts/kernel/registry'
import type { Instance } from '@/parts/kernel/types'
import { threeMaterial } from './materials'
import { useDoc } from '@/state/doc'
import { useSim } from '@/state/sim'

const SELECT_COLOR = new THREE.Color('#4C8DFF')
const HOVER_COLOR = new THREE.Color('#9CC2FF')

interface Props {
  inst: Instance
  selected: boolean
  hovered: boolean
  onPointerDown: (e: ThreeEvent<PointerEvent>, id: string) => void
}

/**
 * One placed part. Geometry comes from the cached part builder, so several
 * instances of the same part with the same parameters share buffers.
 */
function PartObjectImpl({ inst, selected, hovered, onPointerDown }: Props) {
  const def = getPart(inst.defId)
  const setHovered = useDoc((s) => s.setHovered)
  const xray = useDoc((s) => s.view.xray)
  const glow = useSim((s) => s.glow[inst.id])
  const group = useRef<THREE.Group>(null)

  const built = useMemo(() => (def ? buildPart(def, inst.params) : null), [def, inst.params])

  const materials = useMemo(() => {
    if (!built) return []
    return built.meshes.map((m) => {
      const base = threeMaterial(m.material)
      const needsGlow = glow !== undefined && m.tags.includes('lens')
      const needsTint = selected || hovered || xray
      if (!needsGlow && !needsTint) return base

      const mat = base.clone()
      if (needsGlow) {
        mat.emissiveIntensity = glow
        // A driven LED washes toward its emission colour.
        if (m.material.emissive) mat.color = new THREE.Color(m.material.color).lerp(new THREE.Color(m.material.emissive), Math.min(0.6, glow * 0.5))
      }
      if (selected) {
        mat.emissive = new THREE.Color(mat.emissive).lerp(SELECT_COLOR, 0.55)
        mat.emissiveIntensity = Math.max(mat.emissiveIntensity, 0.16)
      } else if (hovered) {
        mat.emissive = new THREE.Color(mat.emissive).lerp(HOVER_COLOR, 0.4)
        mat.emissiveIntensity = Math.max(mat.emissiveIntensity, 0.07)
      }
      if (xray) {
        mat.transparent = true
        mat.opacity = Math.min(mat.opacity, 0.35)
        mat.depthWrite = false
      }
      return mat
    })
  }, [built, selected, hovered, glow, xray])

  // A lit LED should light what is around it, not just glow on its own surface.
  const emitter = useMemo(() => {
    if (!built || !glow || glow < 0.05) return null
    const lens = built.meshes.find((m) => m.tags.includes('lens'))
    if (!lens?.material.emissive) return null
    lens.geometry.computeBoundingBox()
    const c = lens.geometry.boundingBox?.getCenter(new THREE.Vector3()) ?? new THREE.Vector3()
    return { color: lens.material.emissive, at: c }
  }, [built, glow])

  if (!def || !built || inst.hidden) return null

  return (
    <group
      ref={group}
      position={inst.pos}
      rotation={[
        (inst.rot[0] * Math.PI) / 180,
        (inst.rot[1] * Math.PI) / 180,
        (inst.rot[2] * Math.PI) / 180,
      ]}
      onPointerDown={(e) => onPointerDown(e, inst.id)}
      onPointerOver={(e) => {
        e.stopPropagation()
        setHovered(inst.id)
      }}
      onPointerOut={() => setHovered(null)}
      userData={{ instanceId: inst.id }}
    >
      {built.meshes.map((m, i) => (
        <mesh key={m.key} geometry={m.geometry} material={materials[i]} castShadow receiveShadow />
      ))}
      {emitter && (
        <pointLight
          position={emitter.at}
          color={emitter.color}
          intensity={Math.min(glow ?? 0, 2.5) * 900}
          distance={90}
          decay={2}
        />
      )}
    </group>
  )
}

export const PartObject = memo(PartObjectImpl)
