import { useEffect, useMemo, useRef, useState } from 'react'
import * as THREE from 'three'
import { useThree } from '@react-three/fiber'
import { Html } from '@react-three/drei'
import { nearestSnap, readLength, snapPoints, useRuler } from './rulerState'

/**
 * The ruler, drawn.
 *
 * A dot where the next point will land, a dot on each point taken, a
 * line between them and the figure at the middle. The dot is the whole
 * tool: it shows you it has found the corner before you commit to it,
 * so a measurement is never a guess about what the click caught.
 *
 * Pointer handling is on the window rather than on any object, because
 * the gesture has to work over the ground, over a part, and over the
 * gap between two parts where there is nothing to hang a handler on.
 */

const HOT = '#F2B01E'
const TAKEN = '#2F62B8'

/** Where the pointer is, in CSS pixels within the canvas. */
function canvasPointer(e: PointerEvent, el: HTMLCanvasElement): THREE.Vector2 {
  const r = el.getBoundingClientRect()
  return new THREE.Vector2(e.clientX - r.left, e.clientY - r.top)
}

export function Ruler() {
  const { on, from, to, place } = useRuler()
  const { camera, gl, raycaster, scene, size } = useThree()
  const [hover, setHover] = useState<THREE.Vector3 | null>(null)
  const [snapped, setSnapped] = useState(false)
  /* The live point, read by the pointerdown handler. State would be a
     frame behind on a click that lands in the same tick as the move. */
  const live = useRef<THREE.Vector3 | null>(null)

  useEffect(() => {
    if (!on) {
      setHover(null)
      live.current = null
    }
  }, [on])

  useEffect(() => {
    if (!on) return
    const el = gl.domElement
    const ndc = new THREE.Vector2()

    const solve = (e: PointerEvent): THREE.Vector3 | null => {
      const px = canvasPointer(e, el)
      ndc.set((px.x / size.width) * 2 - 1, -(px.y / size.height) * 2 + 1)
      raycaster.setFromCamera(ndc, camera)

      /*
       * The first hit that is a part or the floor.
       *
       * Everything else in the scene is scaffolding — the terminals'
       * invisible pick spheres, the snap ring, the gizmo — and all of
       * it is raycastable. Measuring to the inside of a pick sphere
       * would give a number that is about the editor rather than about
       * the build.
       */
      let point: THREE.Vector3 | null = null
      let onInstance: string | null = null
      for (const hit of raycaster.intersectObjects(scene.children, true)) {
        let node: THREE.Object3D | null = hit.object
        let id: string | null = null
        while (node) {
          const owner = node.userData?.instanceId
          if (typeof owner === 'string') {
            id = owner
            break
          }
          node = node.parent
        }
        if (id) {
          point = hit.point.clone()
          onInstance = id
          break
        }
        if (hit.object.name === 'ground') {
          point = hit.point.clone()
          break
        }
      }
      if (!point) return null

      if (onInstance) {
        const snap = nearestSnap(snapPoints(onInstance), px, camera, size)
        if (snap) {
          setSnapped(true)
          return snap
        }
      }
      setSnapped(false)
      return point
    }

    const onMove = (e: PointerEvent) => {
      const p = solve(e)
      live.current = p
      setHover(p)
    }

    const onDown = (e: PointerEvent) => {
      if (e.button !== 0) return
      const p = live.current ?? solve(e)
      if (!p) return
      // The ruler owns the click: no selecting, no dragging, no orbit.
      e.preventDefault()
      // Immediate, not plain stopPropagation: r3f's picking listener is on
      // this same element, and only this stops it running too.
      e.stopImmediatePropagation()
      place(p)
    }

    el.addEventListener('pointermove', onMove)
    el.addEventListener('pointerdown', onDown, { capture: true })
    return () => {
      el.removeEventListener('pointermove', onMove)
      el.removeEventListener('pointerdown', onDown, { capture: true } as EventListenerOptions)
    }
  }, [on, camera, gl, raycaster, scene, size, place])

  /* The measured span: both points taken, or the first and the pointer. */
  const span = useMemo(() => {
    const a = from
    const b = to ?? (from ? hover : null)
    return a && b ? { a, b } : null
  }, [from, to, hover])

  const line = useMemo(() => {
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(6), 3))
    const m = new THREE.LineBasicMaterial({ color: HOT, depthTest: false, transparent: true, opacity: 0.95 })
    const l = new THREE.Line(g, m)
    l.renderOrder = 6
    l.frustumCulled = false
    return l
  }, [])

  useEffect(() => {
    if (!span) return
    const pos = line.geometry.getAttribute('position') as THREE.BufferAttribute
    pos.setXYZ(0, span.a.x, span.a.y, span.a.z)
    pos.setXYZ(1, span.b.x, span.b.y, span.b.z)
    pos.needsUpdate = true
    line.geometry.computeBoundingSphere()
  }, [span, line])

  useEffect(() => () => {
    line.geometry.dispose()
    ;(line.material as THREE.Material).dispose()
  }, [line])

  if (!on) return null

  const dot = (p: THREE.Vector3, color: string, key: string) => (
    <mesh key={key} position={p} renderOrder={7}>
      <sphereGeometry args={[1, 14, 10]} />
      <meshBasicMaterial color={color} depthTest={false} toneMapped={false} />
    </mesh>
  )

  /* One size on screen at any distance, so the dot is a cursor rather
     than an object in the room. */
  const scaleAt = (p: THREE.Vector3) => camera.position.distanceTo(p) * 0.009

  return (
    <>
      {span && <primitive object={line} />}

      {hover && !to && (
        <group position={hover} scale={scaleAt(hover)}>
          {dot(new THREE.Vector3(), snapped ? HOT : '#8B9099', 'hover')}
          {snapped && (
            <mesh renderOrder={7}>
              <torusGeometry args={[2.1, 0.32, 8, 20]} />
              <meshBasicMaterial color={HOT} depthTest={false} toneMapped={false} />
            </mesh>
          )}
        </group>
      )}

      {from && (
        <group position={from} scale={scaleAt(from)}>{dot(new THREE.Vector3(), TAKEN, 'from')}</group>
      )}
      {to && <group position={to} scale={scaleAt(to)}>{dot(new THREE.Vector3(), TAKEN, 'to')}</group>}

      {span && (
        <Html
          position={span.a.clone().add(span.b).multiplyScalar(0.5)}
          center
          zIndexRange={[20, 0]}
          style={{ pointerEvents: 'none' }}
        >
          <div className="measure-tag">
            <strong>{readLength(span.a.distanceTo(span.b))}</strong>
            <span>
              {`X ${readLength(Math.abs(span.b.x - span.a.x))} · Y ${readLength(Math.abs(span.b.y - span.a.y))} · Z ${readLength(Math.abs(span.b.z - span.a.z))}`}
            </span>
          </div>
        </Html>
      )}
    </>
  )
}
