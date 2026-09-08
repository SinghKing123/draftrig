import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import * as THREE from 'three'
import { Canvas, useThree, type ThreeEvent } from '@react-three/fiber'
import { GizmoHelper, GizmoViewport, Grid, OrbitControls, TransformControls } from '@react-three/drei'
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js'
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib'
import { PartObject } from './PartObject'
import { Ports, PendingWire } from './Ports'
import { Wires } from './Wires'
import { PortIndexProvider, usePortIndex } from './portIndex'
import { CameraRig } from './CameraRig'
import { useDoc, useInstanceList } from '@/state/doc'
import type { Vec3 } from '@/parts/kernel/types'

/* ------------------------------------------------------------------ */
/* Lighting                                                            */
/* ------------------------------------------------------------------ */

/**
 * A neutral studio environment generated on the GPU — no network fetch, and
 * it gives metals and glossy plastics something to reflect.
 */
function StudioEnvironment() {
  const { gl, scene } = useThree()
  useEffect(() => {
    const pmrem = new THREE.PMREMGenerator(gl)
    const env = pmrem.fromScene(new RoomEnvironment(), 0.04)
    scene.environment = env.texture
    return () => {
      env.texture.dispose()
      pmrem.dispose()
      scene.environment = null
    }
  }, [gl, scene])
  return null
}

function Lights() {
  const shadows = useDoc((s) => s.view.shadows)
  return (
    <>
      <hemisphereLight args={['#9FB4CC', '#20242A', 1.1]} />
      <directionalLight
        position={[420, 640, 380]}
        intensity={2.1}
        castShadow={shadows}
        shadow-mapSize={[2048, 2048]}
        shadow-bias={-0.0006}
        shadow-normalBias={0.6}
      >
        <orthographicCamera attach="shadow-camera" args={[-500, 500, 500, -500, 10, 2200]} />
      </directionalLight>
      <directionalLight position={[-380, 280, -320]} intensity={0.55} color="#8FB6FF" />
      <directionalLight position={[120, -220, 420]} intensity={0.25} color="#FFD9A8" />
    </>
  )
}

/* ------------------------------------------------------------------ */
/* Ground / grid                                                       */
/* ------------------------------------------------------------------ */

function Ground({ onPointerMissed }: { onPointerMissed: (e: ThreeEvent<PointerEvent>) => void }) {
  const showGrid = useDoc((s) => s.view.grid)
  return (
    <>
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, -0.05, 0]}
        receiveShadow
        onPointerDown={onPointerMissed}
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

function SelectionTransform({ controls }: { controls: React.MutableRefObject<OrbitControlsImpl | null> }) {
  const selection = useDoc((s) => s.selection)
  const instances = useDoc((s) => s.doc.instances)
  const mode = useDoc((s) => s.mode)
  const transformMode = useDoc((s) => s.transformMode)
  const snap = useDoc((s) => s.snap)
  const moveInstance = useDoc((s) => s.moveInstance)
  const rotateInstance = useDoc((s) => s.rotateInstance)
  const beginEdit = useDoc((s) => s.beginEdit)
  const index = usePortIndex()

  const anchor = useRef<THREE.Group>(null)
  const start = useRef<{ pos: THREE.Vector3; rot: THREE.Euler; instances: { id: string; pos: Vec3; rot: Vec3 }[] } | null>(null)

  const active = mode === 'build' && selection.length > 0

  // Park the gizmo at the centroid of the selection.
  useEffect(() => {
    if (!anchor.current || !selection.length) return
    const c = new THREE.Vector3()
    let n = 0
    for (const id of selection) {
      const inst = instances[id]
      if (!inst) continue
      c.add(new THREE.Vector3(...inst.pos))
      n++
    }
    if (n) c.divideScalar(n)
    anchor.current.position.copy(c)
    anchor.current.rotation.set(0, 0, 0)
  }, [selection, instances])

  const onMouseDown = useCallback(() => {
    if (!anchor.current) return
    if (controls.current) controls.current.enabled = false
    beginEdit()
    start.current = {
      pos: anchor.current.position.clone(),
      rot: anchor.current.rotation.clone(),
      instances: selection
        .map((id) => instances[id])
        .filter(Boolean)
        .map((i) => ({ id: i.id, pos: [...i.pos] as Vec3, rot: [...i.rot] as Vec3 })),
    }
  }, [selection, instances, beginEdit, controls])

  const onChange = useCallback(() => {
    const a = anchor.current
    const s = start.current
    if (!a || !s) return

    if (transformMode === 'move') {
      const delta = a.position.clone().sub(s.pos)
      if (snap.enabled && snap.grid > 0) {
        delta.set(
          Math.round(delta.x / snap.grid) * snap.grid,
          Math.round(delta.y / snap.grid) * snap.grid,
          Math.round(delta.z / snap.grid) * snap.grid,
        )
      }
      for (const it of s.instances) {
        moveInstance(it.id, [it.pos[0] + delta.x, it.pos[1] + delta.y, it.pos[2] + delta.z], false)
      }
    } else {
      const step = snap.enabled ? snap.angle : 0
      const deg = (r: number) => {
        const d = (r * 180) / Math.PI
        return step > 0 ? Math.round(d / step) * step : d
      }
      const dr: Vec3 = [deg(a.rotation.x - s.rot.x), deg(a.rotation.y - s.rot.y), deg(a.rotation.z - s.rot.z)]
      for (const it of s.instances) {
        rotateInstance(it.id, [it.rot[0] + dr[0], it.rot[1] + dr[1], it.rot[2] + dr[2]], false)
      }
    }
  }, [transformMode, snap, moveInstance, rotateInstance])

  const onMouseUp = useCallback(() => {
    if (controls.current) controls.current.enabled = true
    // Port snapping: pull a single dragged part onto the nearest matching terminal.
    if (snap.ports && selection.length === 1 && transformMode === 'move') {
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
          moveInstance(id, [inst.pos[0] + best.offset.x, inst.pos[1] + best.offset.y, inst.pos[2] + best.offset.z], false)
        }
      }
    }
    start.current = null
  }, [controls, snap.ports, selection, transformMode, index, moveInstance])

  return (
    <>
      <group ref={anchor} />
      {active && anchor.current && (
        <TransformControls
          object={anchor.current}
          mode={transformMode === 'move' ? 'translate' : 'rotate'}
          size={0.85}
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

  const onMiss = useCallback(() => {
    clearSelection()
    setPendingWire(null)
  }, [clearSelection, setPendingWire])

  return (
    <>
      <color attach="background" args={['#0A0C0F']} />
      <fog attach="fog" args={['#0A0C0F', 1400, 4200]} />
      <StudioEnvironment />
      <Lights />
      <Ground onPointerMissed={onMiss} />

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
    </>
  )
}

/* ------------------------------------------------------------------ */
/* Canvas                                                              */
/* ------------------------------------------------------------------ */

export function Viewport() {
  const clearSelection = useDoc((s) => s.clearSelection)
  return (
    <Canvas
      shadows
      dpr={[1, 2]}
      gl={{ antialias: true, alpha: false, powerPreference: 'high-performance' }}
      camera={{ position: [260, 200, 300], fov: 38, near: 1, far: 12000 }}
      onCreated={({ gl }) => {
        gl.toneMapping = THREE.ACESFilmicToneMapping
        gl.toneMappingExposure = 1.05
      }}
      onPointerMissed={() => clearSelection()}
    >
      <PortIndexProvider>
        <SceneContents />
      </PortIndexProvider>
    </Canvas>
  )
}
