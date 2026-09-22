import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import { useFrame, useThree } from '@react-three/fiber'
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib'
import { buildPart, instanceMatrix } from '@/parts/kernel/build'
import { getPart } from '@/parts/kernel/registry'
import { listInstances, useDoc, type ViewPreset } from '@/state/doc'

/** World-space bounds of the whole document, or of the current selection. */
export function documentBounds(only?: Set<string>): THREE.Box3 {
  const box = new THREE.Box3()
  box.makeEmpty()
  const doc = useDoc.getState().doc
  for (const inst of listInstances(doc)) {
    if (inst.hidden) continue
    if (only && !only.has(inst.id)) continue
    const def = getPart(inst.defId)
    if (!def) continue
    const local = buildPart(def, inst.params).bbox
    if (local.isEmpty()) continue
    box.union(local.clone().applyMatrix4(instanceMatrix(inst.pos, inst.rot)))
  }
  return box
}

/**
 * Where the camera sits for each standard view, as a direction from the target.
 *
 * Top is nudged off true vertical on purpose. Looking straight down the up
 * axis makes the azimuth undefined, and orbit controls answer that by snapping
 * to an arbitrary heading the moment you touch the mouse — the view spins
 * without being asked to.
 */
const VIEW_DIR: Record<ViewPreset, THREE.Vector3> = {
  top: new THREE.Vector3(0.0001, 1, 0.0012).normalize(),
  front: new THREE.Vector3(0, 0.08, 1).normalize(),
  back: new THREE.Vector3(0, 0.08, -1).normalize(),
  right: new THREE.Vector3(1, 0.08, 0).normalize(),
  left: new THREE.Vector3(-1, 0.08, 0).normalize(),
  iso: new THREE.Vector3(0.8, 0.62, 0.95).normalize(),
}

/**
 * Frames the model on request. Keeps the camera's current viewing direction,
 * because a fit that also swings the camera around is disorienting.
 */
export function CameraRig({ controls }: { controls: React.MutableRefObject<OrbitControlsImpl | null> }) {
  const { camera, size } = useThree()
  const token = useDoc((s) => s.frameToken)
  const target = useDoc((s) => s.frameTarget)
  const selection = useDoc((s) => s.selection)

  const viewToken = useDoc((s) => s.viewToken)
  const viewPreset = useDoc((s) => s.viewPreset)

  const anim = useRef<{ from: THREE.Vector3; to: THREE.Vector3; fromT: THREE.Vector3; toT: THREE.Vector3; t: number } | null>(null)

  useEffect(() => {
    if (token === 0) return
    const only = target === 'selection' && selection.length ? new Set(selection) : undefined
    let box = documentBounds(only)
    if (box.isEmpty()) box = new THREE.Box3(new THREE.Vector3(-60, 0, -60), new THREE.Vector3(60, 60, 60))

    const centre = box.getCenter(new THREE.Vector3())
    const radius = Math.max(box.getSize(new THREE.Vector3()).length() / 2, 20)

    const persp = camera as THREE.PerspectiveCamera
    const vFov = (persp.fov * Math.PI) / 180
    const aspect = size.width / Math.max(size.height, 1)
    const hFov = 2 * Math.atan(Math.tan(vFov / 2) * aspect)
    // Fit on whichever axis is tighter, with a margin so nothing kisses the edge.
    const dist = (radius / Math.sin(Math.min(vFov, hFov) / 2)) * 1.18

    const dir = camera.position.clone().sub(controls.current?.target ?? new THREE.Vector3())
    if (dir.lengthSq() < 1e-6) dir.set(0.8, 0.62, 0.95)
    dir.normalize()

    anim.current = {
      from: camera.position.clone(),
      to: centre.clone().addScaledVector(dir, dist),
      fromT: (controls.current?.target ?? new THREE.Vector3()).clone(),
      toT: centre,
      t: 0,
    }
    persp.near = Math.max(dist / 4000, 0.5)
    persp.far = dist * 12
    persp.updateProjectionMatrix()
  }, [token, target, selection, camera, size, controls])

  /*
   * Standard views.
   *
   * Always reframes as well as reorienting. "Top" that looks down from
   * wherever the camera happened to be is only half an answer: the point of a
   * standard view is to see the whole thing from a known angle, and having to
   * press Fit afterwards every time defeats it.
   */
  useEffect(() => {
    if (viewToken === 0) return
    /*
     * Always the whole build, never the selection.
     *
     * Framing the selection put the camera inside the rig whenever a small
     * part happened to be selected: ask for the three-quarter view of a motion
     * simulator with one steering wheel selected and you got the inside of a
     * panel. A standard view is a statement about the model as a whole. F
     * still frames the selection, which is the control for the other job.
     */
    let box = documentBounds()
    if (box.isEmpty()) box = new THREE.Box3(new THREE.Vector3(-60, 0, -60), new THREE.Vector3(60, 60, 60))

    const centre = box.getCenter(new THREE.Vector3())
    const radius = Math.max(box.getSize(new THREE.Vector3()).length() / 2, 20)

    const persp = camera as THREE.PerspectiveCamera
    const vFov = (persp.fov * Math.PI) / 180
    const aspect = size.width / Math.max(size.height, 1)
    const hFov = 2 * Math.atan(Math.tan(vFov / 2) * aspect)
    const dist = (radius / Math.sin(Math.min(vFov, hFov) / 2)) * 1.18

    anim.current = {
      from: camera.position.clone(),
      to: centre.clone().addScaledVector(VIEW_DIR[viewPreset], dist),
      fromT: (controls.current?.target ?? new THREE.Vector3()).clone(),
      toT: centre,
      t: 0,
    }
    persp.near = Math.max(dist / 4000, 0.5)
    persp.far = dist * 12
    persp.updateProjectionMatrix()
  }, [viewToken, viewPreset, camera, size, controls])

  useFrame((_, delta) => {
    const a = anim.current
    if (!a) return
    a.t = Math.min(1, a.t + delta * 3.4)
    // Ease-out cubic: fast commit, soft landing.
    const k = 1 - Math.pow(1 - a.t, 3)
    camera.position.lerpVectors(a.from, a.to, k)
    if (controls.current) {
      controls.current.target.lerpVectors(a.fromT, a.toT, k)
      controls.current.update()
    }
    if (a.t >= 1) anim.current = null
  })

  return null
}
