import { useEffect, useMemo, useRef, useState } from 'react'
import * as THREE from 'three'
import { useFrame, type ThreeEvent } from '@react-three/fiber'
import { usePortIndex, type WorldPort } from './portIndex'
import { useDoc } from '@/state/doc'
import { useSim } from '@/state/sim'
import { portKey } from '@/sim/circuit/netlist'
import { wasClick } from './pointer'

const UP = new THREE.Vector3(0, 1, 0)

/** Terminal marker colours. */
const C_IDLE = new THREE.Color('#7C8797')
const C_POWER = new THREE.Color('#FF6B6B')
const C_GND = new THREE.Color('#3DD68C')
const C_HOVER = new THREE.Color('#9CC2FF')
const C_ACTIVE = new THREE.Color('#4C8DFF')

function baseColor(p: WorldPort): THREE.Color {
  if (p.port.role === 'power') return C_POWER
  if (p.port.role === 'gnd') return C_GND
  return C_IDLE
}

/**
 * Electrical terminals, drawn as one instanced mesh so a full breadboard costs
 * a single draw call. Doubles as the pick target for wiring.
 */
export function Ports() {
  const index = usePortIndex()
  const mode = useDoc((s) => s.mode)
  const showPorts = useDoc((s) => s.view.ports)
  const selection = useDoc((s) => s.selection)
  const pending = useDoc((s) => s.pendingWire)
  const setPendingWire = useDoc((s) => s.setPendingWire)
  const connect = useDoc((s) => s.connect)
  const addProbe = useSim((s) => s.addProbe)

  const [hover, setHover] = useState(-1)
  const meshRef = useRef<THREE.InstancedMesh>(null)

  const ports = useMemo(() => {
    const electrical = index.list.filter((p) => p.port.kind === 'electrical')
    if (mode === 'wire' || mode === 'sim') return electrical
    if (!showPorts) return []
    // In build mode only show the terminals of what is selected, otherwise a
    // breadboard drowns the scene in dots.
    const sel = new Set(selection)
    return electrical.filter((p) => sel.has(p.instanceId))
  }, [index, mode, showPorts, selection])

  const geometry = useMemo(() => new THREE.CylinderGeometry(0.72, 0.72, 0.5, 10), [])
  const material = useMemo(
    () => new THREE.MeshBasicMaterial({ toneMapped: false, transparent: true, opacity: 0.95 }),
    [],
  )

  // Lay out the instance matrices whenever the port set changes.
  useEffect(() => {
    const mesh = meshRef.current
    if (!mesh) return
    const q = new THREE.Quaternion()
    const m = new THREE.Matrix4()
    const scale = new THREE.Vector3(1, 1, 1)
    const seat = new THREE.Vector3()
    ports.forEach((p, i) => {
      const dir = p.dir.lengthSq() > 0 ? p.dir : UP
      q.setFromUnitVectors(UP, dir)
      // Lift the disc clear of the face it sits on, or it is half buried.
      seat.copy(p.pos).addScaledVector(dir, 0.35)
      m.compose(seat, q, scale)
      mesh.setMatrixAt(i, m)
      mesh.setColorAt(i, baseColor(p))
    })
    mesh.count = ports.length
    mesh.instanceMatrix.needsUpdate = true
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
  }, [ports])

  // Live colouring: hover, pending endpoint, and net voltage during simulation.
  useFrame(() => {
    const mesh = meshRef.current
    if (!mesh || !ports.length) return
    const sim = useSim.getState()
    const live = sim.running || Object.keys(sim.nodeV).length > 0
    const c = new THREE.Color()
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
    })
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
  })

  if (!ports.length) return null

  const onClick = (e: ThreeEvent<MouseEvent>) => {
    const i = e.instanceId
    if (i === undefined) return
    // A camera orbit that happens to end over a terminal is not a click on it.
    if (!wasClick()) return
    e.stopPropagation()
    const p = ports[i]
    if (!p) return

    if (mode === 'sim') {
      addProbe({ label: `${p.instanceId.slice(0, 4)}·${p.port.label}`, key: portKey(p.instanceId, p.portId), color: '', kind: 'voltage' })
      return
    }
    if (mode !== 'wire') return

    if (!pending) {
      setPendingWire({ instanceId: p.instanceId, portId: p.portId })
    } else {
      connect(pending, { instanceId: p.instanceId, portId: p.portId })
      setPendingWire(null)
    }
  }

  return (
    <instancedMesh
      ref={meshRef}
      args={[geometry, material, Math.max(ports.length, 1)]}
      frustumCulled={false}
      onPointerMove={(e) => {
        e.stopPropagation()
        setHover(e.instanceId ?? -1)
      }}
      onPointerOut={() => setHover(-1)}
      onClick={onClick}
    />
  )
}

/** The rubber-band wire that follows the cursor while a connection is pending. */
export function PendingWire({ cursor }: { cursor: THREE.Vector3 | null }) {
  const pending = useDoc((s) => s.pendingWire)
  const index = usePortIndex()
  const ref = useRef<THREE.Line>(null)

  const geometry = useMemo(() => new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]), [])

  useFrame(() => {
    const line = ref.current
    if (!pending || !cursor || !line) return
    const a = index.get(pending.instanceId, pending.portId)
    if (!a) return
    const pos = geometry.getAttribute('position') as THREE.BufferAttribute
    pos.setXYZ(0, a.pos.x, a.pos.y, a.pos.z)
    pos.setXYZ(1, cursor.x, cursor.y, cursor.z)
    pos.needsUpdate = true
    // LineDashedMaterial draws solid unless the distances are recomputed.
    line.computeLineDistances()
  })

  if (!pending) return null
  return (
    // @ts-expect-error - three's Line is available as a JSX intrinsic via r3f
    <line ref={ref} geometry={geometry}>
      <lineDashedMaterial color="#4C8DFF" dashSize={3} gapSize={2} toneMapped={false} />
    </line>
  )
}
