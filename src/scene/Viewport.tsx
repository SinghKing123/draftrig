import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import * as THREE from 'three'
import { Canvas, type ThreeEvent } from '@react-three/fiber'
import { GizmoHelper, GizmoViewport, Grid, OrbitControls, TransformControls } from '@react-three/drei'
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib'
import { PartObject } from './PartObject'
import { Ports, PendingWire } from './Ports'
import { Wires } from './Wires'
import { Solder } from './Solder'
import { PortIndexProvider } from './portIndex'
import { CameraRig } from './CameraRig'
import { Lights, PostFx, StudioEnvironment } from './Render'
import { useDoc, useInstanceList } from '@/state/doc'
import { installPointerTracker, wasClick } from './pointer'
import { SnapSession, type SnapHit } from './snap'
import { SnapIndicator, snapStore } from './SnapIndicator'
import type { Vec3 } from '@/parts/kernel/types'

/* ------------------------------------------------------------------ */
/* Lighting                                                            */
/* ------------------------------------------------------------------ */

/* ------------------------------------------------------------------ */
/* Ground / grid                                                       */
/* ------------------------------------------------------------------ */

/**
 * Extent of the ground plane and the grid, mm. Six metres is far larger than
 * anything anyone builds here, and the fade hides the edge long before it.
 *
 * Deliberately finite. The infinite mode of drei's grid scales the plane by
 * one plus the fade distance, which at a 2.6 metre fade made two triangles
 * fifteen million units across. Depth interpolation over a triangle that size
 * is meaningless, so the grid won and lost the depth test at random from pixel
 * to pixel: it speckled every solid in the scene and drew its own lines across
 * them, and the pattern crawled as the camera moved.
 */
const GROUND = 6000

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
        <planeGeometry args={[GROUND, GROUND]} />
        {/* Pushed back in depth so the grid sitting a fraction above it always
            wins, without needing a gap big enough to see. */}
        <meshStandardMaterial
          color="#0E1116"
          roughness={0.96}
          metalness={0}
          polygonOffset
          polygonOffsetFactor={2}
          polygonOffsetUnits={2}
        />
      </mesh>
      {showGrid && (
        <Grid
          args={[GROUND, GROUND]}
          position={[0, 0.02, 0]}
          cellSize={10}
          cellThickness={0.6}
          cellColor="#232C38"
          sectionSize={100}
          sectionThickness={1.1}
          sectionColor="#3A4C64"
          fadeDistance={GROUND * 0.42}
          fadeStrength={1.2}
          followCamera={false}
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

  // The gizmo needs a real object to attach to, and it must exist on the same
  // render that mounts TransformControls, a ref is populated too late.
  const [anchor, setAnchor] = useState<THREE.Group | null>(null)
  const start = useRef<{ pos: THREE.Vector3; rot: THREE.Euler; instances: { id: string; pos: Vec3; rot: Vec3 }[] } | null>(null)
  /** Built once per drag, so the per-frame cost is a hash lookup. */
  const session = useRef<SnapSession | null>(null)
  const lastHit = useRef<SnapHit | null>(null)

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
    session.current =
      snap.enabled && snap.ports && transformMode === 'move'
        ? new SnapSession(useDoc.getState().doc, selection)
        : null
    lastHit.current = null
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

      // Terminals win over the grid. A lead landing in the hole it is aimed at
      // matters more than it landing on a round number, and seeing the part
      // jump the last millimetre is how you know it took.
      const hit = session.current?.solve(delta) ?? null
      lastHit.current = hit
      snapStore.set(hit)
      if (hit) delta.add(hit.offset)

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

    // A mechanical snap is a joint, so record it. Two extrusions held by a
    // bracket stay held: the mate survives the drag rather than being a
    // coincidence of position that the next nudge undoes.
    const hit = lastHit.current
    if (hit && hit.kind === 'mechanical') {
      useDoc.getState().connect(
        { instanceId: hit.movingInstance, portId: hit.movingPort },
        { instanceId: hit.targetInstance, portId: hit.targetPort },
        { kind: 'mate' },
      )
    }

    session.current = null
    lastHit.current = null
    snapStore.set(null)
    start.current = null
    // Let the click-vs-drag guard settle before re-enabling deselection.
    requestAnimationFrame(() => {
      dragging.active = false
    })
  }, [controls])

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
      <Solder />
      <Ports />
      <PendingWire cursor={cursor} />

      <SelectionTransform controls={controls} />
      <SnapIndicator />
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
      // A near-to-far ratio of fifty thousand spends most of the depth buffer
      // on space nothing occupies. The camera cannot get closer than 8 mm or
      // further than 4 m, so this covers it with room to spare.
      camera={{ position: [300, 230, 340], fov: 36, near: 1, far: 12000 }}
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
