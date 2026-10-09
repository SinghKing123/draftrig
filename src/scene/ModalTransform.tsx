import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import { useThree } from '@react-three/fiber'
import { create } from 'zustand'
import type { Vec3 } from '@/parts/kernel/types'
import { useDoc } from '@/state/doc'

/**
 * Move and rotate without a handle to hit.
 *
 * Press G and the selection follows the pointer; press R and it turns. No
 * arrow to grab, which is the whole point: the gizmo's handles are a few
 * pixels wide, and on a trackpad hitting one is most of the work. This is
 * Blender's modal transform, and it is here for the same reason Blender has
 * it — a keystroke is a bigger target than an arrowhead.
 *
 * While it runs, X, Y or Z constrains the motion to that axis, digits type
 * an exact amount, Enter or a click confirms, and Escape puts everything
 * back where it was. The gizmo stays as the second way to do this.
 *
 * Deliberately no scale. These are catalog parts at their real dimensions,
 * and an M3 screw stretched to 1.4× would make both the bill of materials
 * and the clearance checks lie about a part that does not exist.
 */

type Kind = 'move' | 'rotate'
type Axis = 'x' | 'y' | 'z'

interface Session {
  kind: Kind
  axis: Axis | null
  /** Digits typed so far, as text, so "1", "1." and "1.5" all behave. */
  typed: string
  ids: string[]
  origin: { id: string; pos: Vec3; rot: Vec3 }[]
  centre: THREE.Vector3
  /** Where the pointer was when it began, in normalised device coords. */
  from: THREE.Vector2
  /** For move: the point on the working plane the gesture started at. */
  fromHit: THREE.Vector3 | null
}

export interface ModalHud {
  kind: Kind
  axis: Axis | null
  typed: string
  value: number
}

/**
 * What the readout shows, in a store of its own.
 *
 * The readout belongs with the rest of the viewport chrome, which is HTML
 * outside the canvas; this component lives inside it. A store crosses that
 * boundary without threading a callback through the renderer.
 */
export const useModalHud = create<{ hud: ModalHud | null; set: (h: ModalHud | null) => void }>()((set) => ({
  hud: null,
  set: (hud) => set({ hud }),
}))

const DEG = Math.PI / 180

/** The plane a move is solved against, given the axis it is locked to. */
function planeFor(axis: Axis | null, centre: THREE.Vector3, camera: THREE.Camera): THREE.Plane {
  if (axis === 'y') {
    // Vertical, facing the camera, so up and down reads as up and down.
    const n = new THREE.Vector3()
    camera.getWorldDirection(n)
    n.y = 0
    if (n.lengthSq() < 1e-6) n.set(0, 0, 1)
    n.normalize()
    return new THREE.Plane().setFromNormalAndCoplanarPoint(n, centre)
  }
  return new THREE.Plane().setFromNormalAndCoplanarPoint(new THREE.Vector3(0, 1, 0), centre)
}

export function ModalTransform() {
  const { camera, gl, raycaster } = useThree()
  const s = useRef<Session | null>(null)
  const ndc = useRef(new THREE.Vector2())
  // Read off the store, so the listeners below can be bound once.
  const hud = useRef(useModalHud.getState().set)

  useEffect(() => {
    const el = gl.domElement

    const screenCentre = (): THREE.Vector2 => {
      const p = s.current!.centre.clone().project(camera)
      return new THREE.Vector2(p.x, p.y)
    }

    /** Apply the session to the document, without committing to history. */
    const apply = () => {
      const c = s.current
      if (!c) return
      const doc = useDoc.getState()
      const snap = doc.snap
      const typedNum = c.typed === '' ? null : Number(c.typed)
      const exact = typedNum !== null && Number.isFinite(typedNum)

      if (c.kind === 'move') {
        const plane = planeFor(c.axis, c.centre, camera)
        const hit = new THREE.Vector3()
        raycaster.setFromCamera(ndc.current, camera)
        if (!raycaster.ray.intersectPlane(plane, hit) || !c.fromHit) return
        const d = hit.clone().sub(c.fromHit)
        if (c.axis === 'x') d.set(d.x, 0, 0)
        else if (c.axis === 'y') d.set(0, d.y, 0)
        else if (c.axis === 'z') d.set(0, 0, d.z)
        else d.y = 0

        if (exact && c.axis) {
          d.set(c.axis === 'x' ? typedNum! : 0, c.axis === 'y' ? typedNum! : 0, c.axis === 'z' ? typedNum! : 0)
        } else if (snap.enabled && snap.grid > 0) {
          d.set(
            Math.round(d.x / snap.grid) * snap.grid,
            Math.round(d.y / snap.grid) * snap.grid,
            Math.round(d.z / snap.grid) * snap.grid,
          )
        }

        doc.transformInstances(
          c.origin.map((o) => ({ id: o.id, pos: [o.pos[0] + d.x, o.pos[1] + d.y, o.pos[2] + d.z] as Vec3 })),
          false,
        )
        hud.current({ kind: 'move', axis: c.axis, typed: c.typed, value: c.axis === 'y' ? d.y : c.axis === 'x' ? d.x : c.axis === 'z' ? d.z : Math.hypot(d.x, d.z) })
        return
      }

      // Rotate: the angle the pointer has swept around the selection on screen.
      const mid = screenCentre()
      const a0 = Math.atan2(c.from.y - mid.y, c.from.x - mid.x)
      const a1 = Math.atan2(ndc.current.y - mid.y, ndc.current.x - mid.x)
      let deg = exact ? typedNum! : -((a1 - a0) / DEG)
      if (!exact && snap.enabled && snap.angle > 0) deg = Math.round(deg / snap.angle) * snap.angle
      const axis: Axis = c.axis ?? 'y'

      doc.transformInstances(
        c.origin.map((o) => ({
          id: o.id,
          rot: [
            o.rot[0] + (axis === 'x' ? deg : 0),
            o.rot[1] + (axis === 'y' ? deg : 0),
            o.rot[2] + (axis === 'z' ? deg : 0),
          ] as Vec3,
        })),
        false,
      )
      hud.current({ kind: 'rotate', axis, typed: c.typed, value: deg })
    }

    const stop = (commit: boolean) => {
      const c = s.current
      if (!c) return
      if (!commit) {
        useDoc.getState().transformInstances(
          c.origin.map((o) => ({ id: o.id, pos: o.pos, rot: o.rot })),
          false,
        )
      } else {
        // One history entry for the whole gesture.
        useDoc.getState().transformInstances([], true)
      }
      s.current = null
      hud.current(null)
    }

    const begin = (kind: Kind) => {
      const doc = useDoc.getState()
      if (doc.mode !== 'build') return
      const ids = doc.selection.filter((id) => doc.doc.instances[id] && !doc.doc.instances[id].locked)
      if (!ids.length) return

      const origin = ids.map((id) => {
        const i = doc.doc.instances[id]
        return { id, pos: [...i.pos] as Vec3, rot: [...i.rot] as Vec3 }
      })
      const centre = new THREE.Vector3()
      for (const o of origin) centre.add(new THREE.Vector3(...o.pos))
      centre.multiplyScalar(1 / origin.length)

      const plane = planeFor(null, centre, camera)
      const fromHit = new THREE.Vector3()
      raycaster.setFromCamera(ndc.current, camera)
      const ok = raycaster.ray.intersectPlane(plane, fromHit)

      doc.beginEdit()
      s.current = {
        kind, axis: null, typed: '', ids, origin, centre,
        from: ndc.current.clone(),
        fromHit: ok ? fromHit : null,
      }
      hud.current({ kind, axis: null, typed: '', value: 0 })
    }

    const onMove = (e: PointerEvent) => {
      const r = el.getBoundingClientRect()
      ndc.current.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1)
      if (s.current) apply()
    }

    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return
      const k = e.key.toLowerCase()

      if (!s.current) {
        if ((k === 'g' || k === 'r') && !e.ctrlKey && !e.metaKey && !e.altKey) {
          e.preventDefault()
          e.stopImmediatePropagation()
          begin(k === 'g' ? 'move' : 'rotate')
        }
        return
      }

      /*
       * Nothing else sees a key while this is running.
       *
       * The global map is on the same window, and typing an exact distance
       * went to both: "12" moved the part twelve millimetres and also hit
       * the 1 and 2 mode shortcuts, so the editor was in wire mode by the
       * time the transform finished and the next G did nothing at all.
       * Bound on the capture phase so this runs first whatever order the
       * listeners were added in.
       */
      e.preventDefault()
      e.stopImmediatePropagation()
      if (k === 'escape') return stop(false)
      if (k === 'enter') return stop(true)
      if (k === 'x' || k === 'y' || k === 'z') {
        // Pressing the same axis again frees it, as it does in Blender.
        s.current.axis = s.current.axis === k ? null : (k as Axis)
        s.current.typed = ''
        apply()
        return
      }
      if (k === '-' || /^[0-9.]$/.test(k)) {
        s.current.typed = k === '-' ? (s.current.typed.startsWith('-') ? s.current.typed.slice(1) : '-' + s.current.typed) : s.current.typed + k
        apply()
        return
      }
      if (k === 'backspace') {
        s.current.typed = s.current.typed.slice(0, -1)
        apply()
      }
    }

    // A click confirms; the right button cancels. Captured, so the press does
    // not also land on a part and start a selection.
    const onDown = (e: PointerEvent) => {
      if (!s.current) return
      e.preventDefault()
      e.stopPropagation()
      stop(e.button !== 2)
    }
    const onMenu = (e: Event) => {
      if (s.current) e.preventDefault()
    }

    window.addEventListener('pointermove', onMove)
    window.addEventListener('keydown', onKey, true)
    el.addEventListener('pointerdown', onDown, true)
    el.addEventListener('contextmenu', onMenu)
    return () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('keydown', onKey, true)
      el.removeEventListener('pointerdown', onDown, true)
      el.removeEventListener('contextmenu', onMenu)
    }
  }, [camera, gl, raycaster])

  // Nothing is drawn here; the readout is chrome, outside the canvas.
  return null
}
