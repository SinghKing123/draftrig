import { memo, useEffect, useMemo, useRef, useState } from 'react'
import * as THREE from 'three'
import type { ThreeEvent } from '@react-three/fiber'
import { buildPart } from '@/parts/kernel/build'
import { getPart } from '@/parts/kernel/registry'
import type { Instance } from '@/parts/kernel/types'
import { threeMaterial } from './materials'
import { Surfaces } from './Surfaces'
import { useDoc } from '@/state/doc'
import { useSim } from '@/state/sim'
import { instantiate, loadModel, peekModel, release } from './modelCache'

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

  /*
   * The external model, if this part has one and it has arrived.
   *
   * Starts as whatever the cache already holds, so the second instance of a
   * part appears with its model already on rather than flashing the built-in
   * shape first. Failure is silent by design: `model` stays null and the
   * solids below are drawn, which is a part that looks plainer, not a part
   * that is missing.
   */
  // A part may offer its model unconditionally or decide per configuration;
  // resolve to one spec here so the rest of this is identical either way.
  // Memoised on the params so a static model keeps a stable identity and the
  // load effect below does not re-fire on every unrelated render.
  const spec = useMemo(() => {
    const m = def?.model
    return typeof m === 'function' ? m(inst.params) : m
  }, [def, inst.params])
  const [model, setModel] = useState<THREE.Object3D | null>(null)
  useEffect(() => {
    if (!spec || !built || built.body.isEmpty()) {
      setModel(null)
      return
    }
    let live = true
    let made: THREE.Object3D | null = null
    const use = (proto: THREE.Object3D) => {
      if (!live) return
      // Fitted to the body, not the whole box: a flex or an accessory drawn
      // beside the model must not shrink the model to make room for itself.
      made = instantiate(proto, built.body, spec)
      setModel(made)
    }
    const ready = peekModel(spec)
    if (ready) use(ready)
    else loadModel(spec).then(use).catch(() => {})
    return () => {
      live = false
      release(made)
    }
  }, [spec, built])

  /*
   * X-ray and the selection tint, on the model as on the solids.
   *
   * X-ray exists so the wires behind and inside a part can be followed. A
   * model that ignored it stayed opaque and hid exactly the thing the button
   * was pressed to show. The model's own materials are shared by every
   * instance of the part, so the see-through and tinted ones are copies made
   * here and dropped when the state goes back.
   */
  useEffect(() => {
    if (!model || !(xray || selected || hovered)) return
    const swapped: [THREE.Mesh, THREE.Material | THREE.Material[]][] = []
    const made: THREE.Material[] = []
    model.traverse((o) => {
      const mesh = o as THREE.Mesh
      if (!mesh.isMesh) return
      const tint = (base: THREE.Material) => {
        const m = base.clone() as THREE.MeshStandardMaterial
        made.push(m)
        if (m.emissive) {
          if (selected) {
            m.emissive = m.emissive.clone().lerp(SELECT_COLOR, 0.3)
            m.emissiveIntensity = Math.max(m.emissiveIntensity, 0.07)
          } else if (hovered) {
            m.emissive = m.emissive.clone().lerp(HOVER_COLOR, 0.22)
            m.emissiveIntensity = Math.max(m.emissiveIntensity, 0.04)
          }
        }
        if (xray) {
          m.transparent = true
          m.opacity = Math.min(m.opacity, 0.35)
          m.depthWrite = false
        }
        return m
      }
      swapped.push([mesh, mesh.material])
      mesh.material = Array.isArray(mesh.material) ? mesh.material.map(tint) : tint(mesh.material)
    })
    return () => {
      for (const [mesh, mat] of swapped) mesh.material = mat
      for (const m of made) m.dispose()
    }
  }, [model, xray, selected, hovered])

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
      /*
       * A light touch, now that the outline and the corner cage carry the
       * message. This tint used to be the only cue there was, so it had to be
       * strong enough to see on a black anodised part — which meant that on
       * anything pale it washed the part blue and hid the colour you had
       * picked. It is back to being a hint that the outline agrees with.
       */
      if (selected) {
        mat.emissive = new THREE.Color(mat.emissive).lerp(SELECT_COLOR, 0.3)
        mat.emissiveIntensity = Math.max(mat.emissiveIntensity, 0.07)
      } else if (hovered) {
        mat.emissive = new THREE.Color(mat.emissive).lerp(HOVER_COLOR, 0.22)
        mat.emissiveIntensity = Math.max(mat.emissiveIntensity, 0.04)
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
      /*
       * Selection is taken on pointer down, but the release has to be claimed
       * too. Events in three are raycast per event type, not per gesture: the
       * ray that hits this part on the way down also reaches the ground plane
       * behind it on the way up, and the ground clears the selection. So
       * pressing a part selected it and letting go deselected it, which read as
       * having to hold the mouse button to keep anything selected.
       */
      onPointerUp={(e) => e.stopPropagation()}
      onPointerOver={(e) => {
        e.stopPropagation()
        setHovered(inst.id)
      }}
      onPointerOut={() => setHovered(null)}
      userData={{ instanceId: inst.id }}
    >
      {/* The model is the picture; the solids underneath still own the
          ports, the mass and the bounding box, so nothing else changes with
          it. The solids marked withModel are the parametric pieces the mesh
          cannot show, and are drawn either way. */}
      {model && <primitive object={model} />}
      {built.meshes.map((m, i) =>
        model && !m.withModel ? null : (
          <mesh key={m.key} geometry={m.geometry} material={materials[i]} castShadow receiveShadow />
        ),
      )}
      {!model && built.surfaces.length > 0 && <Surfaces surfaces={built.surfaces} instanceId={inst.id} />}
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
