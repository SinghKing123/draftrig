import { useEffect, useMemo, useRef, useState } from 'react'
import * as THREE from 'three'
import { useFrame, useThree, type ThreeEvent } from '@react-three/fiber'
import { usePortIndex, type WorldPort } from './portIndex'
import { useDoc } from '@/state/doc'
import { useSim } from '@/state/sim'
import { portKey } from '@/sim/circuit/netlist'
import { wasClick } from './pointer'
import { usePortHover } from './portHover'

const UP = new THREE.Vector3(0, 1, 0)

/** Terminal marker colours. */
const C_IDLE = new THREE.Color('#7C8797')
const C_POWER = new THREE.Color('#FF6B6B')
const C_GND = new THREE.Color('#3DD68C')
const C_HOVER = new THREE.Color('#9CC2FF')
const C_ACTIVE = new THREE.Color('#4C8DFF')

/**
 * Sizes in screen pixels, not millimetres.
 *
 * A terminal is a millimetre and a half across. Left at its real size it is two
 * or three pixels on screen at any sensible zoom, and wiring becomes a game of
 * hunting for a dot. Markers and their pick targets are therefore held at a
 * constant size on screen, and the target is much larger than the mark.
 */
const MARK_PX = 4.6
const MARK_PX_WIRE = 6.2
const PICK_PX = 13

/** World-size clamps, so a marker is never absurd very close up or far away. */
const MIN_R = 0.35
const MAX_R = 3.4

/**
 * A terminal is marked at both ends of its pin.
 *
 * A pin is not a point on a surface, it is a pin, and which end of it you can
 * see depends on which side of the work you are on. Nearly every through-hole
 * part puts its terminal at the tip of the lead, facing down, so once the part
 * was seated in a board every terminal it had was under 1.6 mm of FR-4 with no
 * way to orbit beneath and look at it: wiring a chip meant clicking dots that
 * were not on screen.
 *
 * So each terminal draws twice — at the terminal itself, and at the far end of
 * its pin, which portIndex works out from the part's own extent. Both marks
 * are the same terminal and both are clickable, so it no longer matters which
 * side of the work you are looking from.
 */
const FRONT_MM = 0.3

function baseColor(p: WorldPort): THREE.Color {
  if (p.port.role === 'power') return C_POWER
  if (p.port.role === 'gnd') return C_GND
  return C_IDLE
}

/** Where the terminal the pointer is over sits, for the rubber-band wire. */
class HoverStore {
  private at: THREE.Vector3 | null = null
  set(v: THREE.Vector3 | null): void {
    this.at = v ? v.clone() : null
    // Read by the wiring test in tools/, which measures how forgiving picking
    // is by sweeping the pointer and watching this flip.
    ;(globalThis as { __portHover?: boolean }).__portHover = v !== null
  }
  get(): THREE.Vector3 | null {
    return this.at
  }
}
export const hoverStore = new HoverStore()

/**
 * Electrical terminals.
 *
 * Two instanced meshes over the same set: one that is drawn, and a much larger
 * invisible one that is what the pointer actually hits. Each carries two
 * instances per terminal, one either side of the pin — see FRONT_MM. When several pick
 * volumes overlap, which they do on a breadboard, the winner is the terminal
 * whose centre is nearest the cursor on screen rather than whichever happens to
 * be closest to the camera.
 */
export function Ports() {
  const index = usePortIndex()
  const mode = useDoc((s) => s.mode)
  const showPorts = useDoc((s) => s.view.ports)
  const selection = useDoc((s) => s.selection)
  const pending = useDoc((s) => s.pendingWire)
  const setPendingWire = useDoc((s) => s.setPendingWire)
  const connect = useDoc((s) => s.connect)
  const wireColor = useDoc((s) => s.wireColor)
  const addProbe = useSim((s) => s.addProbe)
  const { size } = useThree()

  const [hover, setHover] = useState(-1)
  const markRef = useRef<THREE.InstancedMesh>(null)
  const pickRef = useRef<THREE.InstancedMesh>(null)

  const ports = useMemo(() => {
    const electrical = index.list.filter((p) => p.port.kind === 'electrical')
    if (mode === 'wire' || mode === 'sim') return electrical
    if (!showPorts) return []
    // In build mode only show the terminals of what is selected, otherwise a
    // breadboard drowns the scene in dots.
    const sel = new Set(selection)
    return electrical.filter((p) => sel.has(p.instanceId))
  }, [index, mode, showPorts, selection])

  const markGeo = useMemo(() => new THREE.SphereGeometry(1, 12, 8), [])
  const pickGeo = useMemo(() => new THREE.SphereGeometry(1, 8, 6), [])
  const markMat = useMemo(
    () => new THREE.MeshBasicMaterial({ toneMapped: false, transparent: true, opacity: 0.96, depthWrite: false }),
    [],
  )
  // Drawn but fully transparent: three skips raycasting anything with
  // visible === false, so the target has to be rendered to be hittable.
  const pickMat = useMemo(
    () => new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false, depthTest: false }),
    [],
  )

  useEffect(() => {
    return () => {
      markGeo.dispose()
      pickGeo.dispose()
      markMat.dispose()
      pickMat.dispose()
    }
  }, [markGeo, pickGeo, markMat, pickMat])

  // Sizes follow the camera, so this has to run per frame rather than when the
  // port set changes.
  useFrame(({ camera }) => {
    const mark = markRef.current
    const pick = pickRef.current
    if (!mark || !pick || !ports.length) return

    const cam = camera as THREE.PerspectiveCamera
    // World units per screen pixel, per unit of distance from the camera.
    const k = (2 * Math.tan(((cam.fov ?? 36) * Math.PI) / 360)) / Math.max(size.height, 1)

    const q = new THREE.Quaternion()
    const m = new THREE.Matrix4()
    const scale = new THREE.Vector3()
    const seat = new THREE.Vector3()
    const markPx = mode === 'wire' ? MARK_PX_WIRE : MARK_PX
    const n = ports.length

    for (let i = 0; i < n; i++) {
      const p = ports[i]
      const dir = p.dir.lengthSq() > 0 ? p.dir : UP
      q.setFromUnitVectors(UP, dir)

      const unit = k * cam.position.distanceTo(p.pos)
      const grown = i === hover ? 1.45 : 1
      const r = Math.min(Math.max(unit * markPx * grown, MIN_R), MAX_R)
      const pr = Math.min(Math.max(unit * PICK_PX, MIN_R * 2), MAX_R * 3)

      // Instance i is the front mark, i + n the one behind it. Both belong to
      // ports[i], which is what makes doubling the pick volumes harmless:
      // whichever of the pair wins a contested click names the same terminal.
      for (let side = 0; side < 2; side++) {
        // Lift clear of the face it sits on, or it is half buried. The far
        // mark is already outside the part, so it is placed as it comes.
        if (side === 0) seat.copy(p.pos).addScaledVector(dir, FRONT_MM)
        else seat.copy(p.back)
        const at = side * n + i
        scale.setScalar(r)
        m.compose(seat, q, scale)
        mark.setMatrixAt(at, m)
        scale.setScalar(pr)
        m.compose(seat, q, scale)
        pick.setMatrixAt(at, m)
      }
    }
    mark.count = n * 2
    pick.count = n * 2
    mark.instanceMatrix.needsUpdate = true
    pick.instanceMatrix.needsUpdate = true
  })

  /*
   * Publish what is under the pointer, so the overlay can name it.
   *
   * Recomputed per frame rather than on the hover event, because the label has
   * to stay pinned to the terminal while the camera moves, and the camera can
   * move without the pointer moving at all.
   */
  useFrame(({ camera, size: view }) => {
    const set = usePortHover.getState().set
    const p = ports[hover]
    if (!p || mode === 'build') {
      set(null)
      return
    }
    const v = p.pos.clone().project(camera)
    // Behind the camera: there is nothing to point at on screen.
    if (v.z > 1) {
      set(null)
      return
    }
    const inst = useDoc.getState().doc.instances[p.instanceId]
    set({
      label: p.port.label,
      owner: inst?.name ?? '',
      role: p.port.role,
      x: ((v.x + 1) / 2) * view.width,
      y: ((1 - v.y) / 2) * view.height,
    })
  })

  // Colour: hover, the pending endpoint, and net voltage while running.
  useFrame(() => {
    const mesh = markRef.current
    if (!mesh || !ports.length) return
    const sim = useSim.getState()
    const live = sim.running || Object.keys(sim.nodeV).length > 0
    const c = new THREE.Color()
    const n = ports.length
    ports.forEach((p, i) => {
      if (i === hover) c.copy(C_HOVER)
      else if (pending && pending.instanceId === p.instanceId && pending.portId === p.portId) c.copy(C_ACTIVE)
      else if (live && mode === 'sim') {
        const v = sim.nodeV[portKey(p.instanceId, p.portId)]
        if (v === undefined) c.copy(baseColor(p))
        else {
          // 0 V green through to hot red at 12 V and above.
          const t = Math.min(Math.abs(v) / 12, 1)
          c.setRGB(0.24 + t * 0.76, 0.84 - t * 0.5, 0.55 - t * 0.4)
        }
      } else c.copy(baseColor(p))
      mesh.setColorAt(i, c)
      mesh.setColorAt(n + i, c)
    })
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
  })

  /**
   * Of everything the ray passed through, the terminal nearest the cursor on
   * screen. Depth order is the wrong answer here: on a breadboard the pick
   * volumes overlap several deep, and the one in front is rarely the one being
   * aimed at.
   */
  const nearest = (e: ThreeEvent<PointerEvent | MouseEvent>): number => {
    const cam = e.camera as THREE.PerspectiveCamera
    const v = new THREE.Vector3()
    let best = -1
    let bestPx = Infinity
    for (const hit of e.intersections) {
      if (hit.object !== pickRef.current) continue
      // Either half of a pair is the same terminal, so fold it back.
      const i = hit.instanceId === undefined ? undefined : hit.instanceId % ports.length
      if (i === undefined || !ports[i]) continue
      v.copy(ports[i].pos).project(cam)
      const dx = ((v.x - e.pointer.x) * size.width) / 2
      const dy = ((v.y - e.pointer.y) * size.height) / 2
      const px = Math.hypot(dx, dy)
      if (px < bestPx) {
        bestPx = px
        best = i
      }
    }
    return best
  }

  if (!ports.length) {
    hoverStore.set(null)
    usePortHover.getState().set(null)
    return null
  }

  const act = (i: number) => {
    const p = ports[i]
    if (!p) return
    if (mode === 'sim') {
      addProbe({
        label: `${p.instanceId.slice(0, 4)}·${p.port.label}`,
        key: portKey(p.instanceId, p.portId),
        color: '',
        kind: 'voltage',
      })
      return
    }
    if (mode !== 'wire') return

    if (!pending) {
      setPendingWire({ instanceId: p.instanceId, portId: p.portId })
    } else if (pending.instanceId === p.instanceId && pending.portId === p.portId) {
      // Clicking the terminal you started from is how you back out.
      setPendingWire(null)
    } else {
      connect(pending, { instanceId: p.instanceId, portId: p.portId }, { color: wireColor })
      setPendingWire(null)
    }
  }

  return (
    <>
      <instancedMesh
        ref={markRef}
        args={[markGeo, markMat, Math.max(ports.length * 2, 1)]}
        frustumCulled={false}
        renderOrder={4}
      />
      <instancedMesh
        ref={pickRef}
        args={[pickGeo, pickMat, Math.max(ports.length * 2, 1)]}
        frustumCulled={false}
        renderOrder={5}
        onPointerMove={(e) => {
          const i = nearest(e)
          if (i < 0) return
          e.stopPropagation()
          setHover(i)
          hoverStore.set(ports[i].pos)
        }}
        onPointerOut={() => {
          setHover(-1)
          hoverStore.set(null)
          usePortHover.getState().set(null)
        }}
        /* Right-click abandons a half-drawn wire, the same as Esc. Reaching for
           the keyboard to cancel a gesture made with the mouse is the kind of
           small friction that makes a mode feel fiddly. */
        onContextMenu={(e) => {
          if (!pending) return
          e.nativeEvent.preventDefault()
          e.stopPropagation()
          setPendingWire(null)
        }}
        onClick={(e) => {
          // A camera orbit that ends over a terminal is not a click on it.
          if (!wasClick()) return
          const i = nearest(e)
          if (i < 0) return
          e.stopPropagation()
          act(i)
        }}
      />
    </>
  )
}

/** The rubber-band wire that follows the cursor while a connection is pending. */
export function PendingWire({ cursor }: { cursor: THREE.Vector3 | null }) {
  const pending = useDoc((s) => s.pendingWire)
  // Draw the band in the colour the wire will be, so the choice is visible
  // before it is committed rather than after.
  const wireColor = useDoc((s) => s.wireColor)
  const index = usePortIndex()
  const ref = useRef<THREE.Line>(null)

  const geometry = useMemo(
    () => new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]),
    [],
  )

  useFrame(() => {
    const line = ref.current
    if (!pending || !line) return
    const a = index.get(pending.instanceId, pending.portId)
    if (!a) return
    // Land on the terminal under the pointer when there is one, so the wire
    // shows where it will actually end rather than where the mouse happens to be.
    const b = hoverStore.get() ?? cursor
    if (!b) return
    const pos = geometry.getAttribute('position') as THREE.BufferAttribute
    pos.setXYZ(0, a.pos.x, a.pos.y, a.pos.z)
    pos.setXYZ(1, b.x, b.y, b.z)
    pos.needsUpdate = true
    // LineDashedMaterial draws solid unless the distances are recomputed.
    line.computeLineDistances()
  })

  if (!pending) return null
  return (
    // @ts-expect-error - three's Line is available as a JSX intrinsic via r3f
    <line ref={ref} geometry={geometry} renderOrder={6}>
      <lineDashedMaterial color={wireColor} dashSize={3} gapSize={2} toneMapped={false} depthTest={false} />
    </line>
  )
}
