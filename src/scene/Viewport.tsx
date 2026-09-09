import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import * as THREE from 'three'
import { Canvas, type ThreeEvent } from '@react-three/fiber'
import { GizmoHelper, GizmoViewport, Grid, OrbitControls, TransformControls } from '@react-three/drei'
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib'
import { PartObject } from './PartObject'
import { Ports, PendingWire } from './Ports'
import { Wires } from './Wires'
import { PortIndexProvider, usePortIndex } from './portIndex'
import { CameraRig } from './CameraRig'
import { Lights, PostFx, StudioEnvironment } from './Render'
import { useDoc, useInstanceList } from '@/state/doc'
import { installPointerTracker, wasClick } from './pointer'
import type { Vec3 } from '@/parts/kernel/types'

/* ------------------------------------------------------------------ */
/* Lighting                                                            */
/* ------------------------------------------------------------------ */

/* ------------------------------------------------------------------ */
/* Ground / grid                                                       */
/* ------------------------------------------------------------------ */

function Ground({ onPointerUp }: { onPointerUp: (e: ThreeEvent<PointerEvent>) => void }) {
  const showGrid = useDoc((s) => s.view.grid)
  return (
    <>
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, -0.05, 0]}
        receiveShadow
        onPointerUp={onPointerUp}
        name="ground"
      >
        <planeGeometry args={[6000, 6000]} />
        <meshStandardMaterial color="#0E1116" roughness={0.96} metalness={0} />
      </mesh>
      {showGrid && (
        <Grid
          args={[6000, 6000]}
          position={[0, 0.02, 0]}
          cellSize={10}
          cellThickness={0.6}
          cellColor="#1E2530"
          sectionSize={100}
          sectionThickness={1.1}
          sectionColor="#2C3A4D"
          fadeDistance={2600}
          fadeStrength={1.2}
          followCamera={false}
          infiniteGrid
        />
      )}
    </>
  )
}

/* ------------------------------------------------------------------ */
/* Selection transform                                                 */
/* ------------------------------------------------------------------ */

/** True while a gizmo drag is in progress, read by the deselect handlers. */
export const dragging = { active: false }

function SelectionTransform({ controls }: { controls: React.MutableRefObject<OrbitControlsImpl | null> }) {
  const selection = useDoc((s) => s.selection)
  const instances = useDoc((s) => s.doc.instances)
  const mode = useDoc((s) => s.mode)
  const transformMode = useDoc((s) => s.transformMode)
  const snap = useDoc((s) => s.snap)
  const transformInstances = useDoc((s) => s.transformInstances)
  const beginEdit = useDoc((s) => s.beginEdit)
  const index = usePortIndex()

  // The gizmo needs a real object to attach to, and it must exist on the same
  // render that mounts TransformControls, a ref is populated too late.
  const [anchor, setAnchor] = useState<THREE.Group | null>(null)
  const start = useRef<{ pos: THREE.Vector3; rot: THREE.Euler; instances: { id: string; pos: Vec3; rot: Vec3 }[] } | null>(null)

  const active = mode === 'build' && selection.length > 0

  // Park the gizmo at the centroid of the selection, but never mid-drag, or
  // it fights the pointer as the parts it is measuring move under it.
  useEffect(() => {
    if (!anchor || !selection.length || start.current) return
    const c = new THREE.Vector3()
    let n = 0
    for (const id of selection) {
      const inst = instances[id]
      if (!inst) continue
      c.add(new THREE.Vector3(...inst.pos))
      n++
    }
    if (n) c.divideScalar(n)
    anchor.position.copy(c)
    anchor.rotation.set(0, 0, 0)
  }, [anchor, selection, instances])

  const onMouseDown = useCallback(() => {
    if (!anchor) return
    if (controls.current) controls.current.enabled = false
    dragging.active = true
    beginEdit()
    start.current = {
      pos: anchor.position.clone(),
      rot: anchor.rotation.clone(),
      instances: selection
        .map((id) => instances[id])
        .filter(Boolean)
        .map((i) => ({ id: i.id, pos: [...i.pos] as Vec3, rot: [...i.rot] as Vec3 })),
    }
  }, [anchor, selection, instances, beginEdit, controls])

  const onChange = useCallback(() => {
    const s = start.current
    if (!anchor || !s) return

    if (transformMode === 'move') {
      const delta = anchor.position.clone().sub(s.pos)
      if (snap.enabled && snap.grid > 0) {
        delta.set(
          Math.round(delta.x / snap.grid) * snap.grid,
          Math.round(delta.y / snap.grid) * snap.grid,
          Math.round(delta.z / snap.grid) * snap.grid,
        )
      }
      transformInstances(
        s.instances.map((it) => ({ id: it.id, pos: [it.pos[0] + delta.x, it.pos[1] + delta.y, it.pos[2] + delta.z] as Vec3 })),
        false,
      )
    } else {
      const step = snap.enabled ? snap.angle : 0
      const deg = (r: number) => {
        const d = (r * 180) / Math.PI
        return step > 0 ? Math.round(d / step) * step : d
      }
      const dr: Vec3 = [
        deg(anchor.rotation.x - s.rot.x),
        deg(anchor.rotation.y - s.rot.y),
        deg(anchor.rotation.z - s.rot.z),
      ]
      transformInstances(
        s.instances.map((it) => ({ id: it.id, rot: [it.rot[0] + dr[0], it.rot[1] + dr[1], it.rot[2] + dr[2]] as Vec3 })),
        false,
      )
    }
  }, [anchor, transformMode, snap, transformInstances])

  const onMouseUp = useCallback(() => {
    if (controls.current) controls.current.enabled = true
    // Port snapping: pull a single dragged part onto the nearest matching
    // terminal, so parts seat into breadboards and slots instead of near them.
    if (snap.enabled && snap.ports && selection.length === 1 && transformMode === 'move') {
      const id = selection[0]
      const mine = index.ofInstance(id)
      let best: { d: number; offset: THREE.Vector3 } | null = null
      for (const p of mine) {
        const target = index.nearest(p.pos, 7, (q) => q.instanceId !== id && q.port.kind === p.port.kind)
        if (!target) continue
        const d = target.pos.distanceTo(p.pos)
        if (!best || d < best.d) best = { d, offset: target.pos.clone().sub(p.pos) }
      }
      if (best && best.d > 1e-4) {
        const inst = useDoc.getState().doc.instances[id]
        if (inst) {
          transformInstances(
            [{ id, pos: [inst.pos[0] + best.offset.x, inst.pos[1] + best.offset.y, inst.pos[2] + best.offset.z] }],
            false,
          )
        }
      }
    }
    start.current = null
    // Let the click-vs-drag guard settle before re-enabling deselection.
    requestAnimationFrame(() => {
      dragging.active = false
    })
  }, [controls, snap.enabled, snap.ports, selection, transformMode, index, transformInstances])

  return (
    <>
      <group ref={setAnchor} />
      {active && anchor && (
        <TransformControls
          object={anchor}
          mode={transformMode === 'move' ? 'translate' : 'rotate'}
          size={0.8}
          onMouseDown={onMouseDown}
          onMouseUp={onMouseUp}
          onObjectChange={onChange}
        />
      )}
    </>
  )
}

/* ------------------------------------------------------------------ */
/* Scene contents                                                      */
/* ------------------------------------------------------------------ */

function SceneContents() {
  const instances = useInstanceList()
  const selection = useDoc((s) => s.selection)
  const hovered = useDoc((s) => s.hovered)
  const mode = useDoc((s) => s.mode)
  const select = useDoc((s) => s.select)
  const toggleSelect = useDoc((s) => s.toggleSelect)
  const clearSelection = useDoc((s) => s.clearSelection)
  const setPendingWire = useDoc((s) => s.setPendingWire)
  const controls = useRef<OrbitControlsImpl | null>(null)
  const [cursor, setCursor] = useState<THREE.Vector3 | null>(null)

  const selectionSet = useMemo(() => new Set(selection), [selection])

  const onPartDown = useCallback(
    (e: ThreeEvent<PointerEvent>, id: string) => {
      if (mode === 'wire') return
      e.stopPropagation()
      if (e.shiftKey || e.ctrlKey) toggleSelect(id)
      else if (!selectionSet.has(id)) select([id])
    },
    [mode, select, toggleSelect, selectionSet],
  )

  // Only a genuine click clears the selection. Without this every camera orbit
  // that starts over empty space throws away what you had selected.
  const onMiss = useCallback(() => {
    if (dragging.active || !wasClick()) return
    clearSelection()
    setPendingWire(null)
  }, [clearSelection, setPendingWire])

  return (
    <>
      <color attach="background" args={['#0A0C0F']} />
      <fog attach="fog" args={['#0A0C0F', 2200, 6000]} />
      <StudioEnvironment />
      <Lights />
      <Ground onPointerUp={onMiss} />

      <group onPointerMove={(e) => setCursor(e.point.clone())}>
        {instances.map((inst) => (
          <PartObject
            key={inst.id}
            inst={inst}
            selected={selectionSet.has(inst.id)}
            hovered={hovered === inst.id}
            onPointerDown={onPartDown}
          />
        ))}
      </group>

      <Wires />
      <Ports />
      <PendingWire cursor={cursor} />

      <SelectionTransform controls={controls} />
      <CameraRig controls={controls} />

      <OrbitControls
        ref={controls}
        makeDefault
        enableDamping
        dampingFactor={0.12}
        rotateSpeed={0.75}
        panSpeed={0.9}
        zoomSpeed={0.9}
        minDistance={8}
        maxDistance={4000}
        maxPolarAngle={Math.PI * 0.495}
        mouseButtons={{
          LEFT: THREE.MOUSE.ROTATE,
          MIDDLE: THREE.MOUSE.DOLLY,
          RIGHT: THREE.MOUSE.PAN,
        }}
      />

      <GizmoHelper alignment="bottom-right" margin={[76, 76]}>
        <GizmoViewport axisColors={['#FF6B6B', '#3DD68C', '#4C8DFF']} labelColor="#0B0D10" />
      </GizmoHelper>

      <PostFx />
    </>
  )
}

/* ------------------------------------------------------------------ */
/* Canvas                                                              */
/* ------------------------------------------------------------------ */

export function Viewport() {
  const clearSelection = useDoc((s) => s.clearSelection)
  useEffect(() => installPointerTracker(), [])
  return (
    <Canvas
      shadows
      dpr={[1, 2]}
      gl={{ antialias: true, alpha: false, powerPreference: 'high-performance' }}
      camera={{ position: [300, 230, 340], fov: 36, near: 0.4, far: 20000 }}
      onCreated={({ gl }) => {
        gl.toneMapping = THREE.NoToneMapping
        gl.shadowMap.type = THREE.PCFSoftShadowMap
      }}
      onPointerMissed={() => {
        if (dragging.active || !wasClick()) return
        clearSelection()
      }}
    >
      <PortIndexProvider>
        <SceneContents />
      </PortIndexProvider>
    </Canvas>
  )
}
