import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import * as THREE from 'three'
import { Canvas, useThree, type ThreeEvent } from '@react-three/fiber'
import { GizmoHelper, GizmoViewport, Grid, OrbitControls, TransformControls } from '@react-three/drei'
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib'
import { PartObject } from './PartObject'
import { Ports, PendingWire } from './Ports'
import { Wires } from './Wires'
import { Solder } from './Solder'
import { PortIndexProvider } from './portIndex'
import { CameraRig } from './CameraRig'
import { publishControls, publishRenderer } from './debugCamera'
import { Lights, PostFx, StudioEnvironment } from './Render'
import { useDoc, useInstanceList } from '@/state/doc'
import { installPointerTracker, wasClick } from './pointer'
import { registerCanvas } from './capture'
import { SnapSession, type SnapHit } from './snap'
import { SnapIndicator, snapStore } from './SnapIndicator'
import { ModalTransform } from './ModalTransform'
import { SelectionCage } from './SelectionOutline'
import { DiagnosticsProbe } from './DiagnosticsProbe'
import { countGlErrors } from './diagnostics'
import { useAdaptiveQuality } from './adaptiveQuality'
import { beginDrag, endDrag, updateDrag, type DragState } from './dragMove'
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
      {/*
        * Opaque, and still not in the way from underneath.
        *
        * A shadow-only floor was tried, so that a lead poking below the deck
        * would not be swallowed. It swallowed the whole scene instead: with
        * nothing on the ground plane there is no surface for the ambient
        * occlusion to darken against and nothing for the key light to fall
        * on, and the bench became a black void with a few grid lines in it.
        *
        * The problem it was solving was already solved by the material's own
        * default: a standard material is FrontSide, so the plane is culled
        * when the camera is under it, and now that the camera can go under it
        * — see maxPolarAngle below — looking up at a joint works without the
        * floor having to stop being a floor.
        */}
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
          /* Not followCamera, and not a short fade.
             Following the camera slides the lines under the model as you
             orbit, which reads as the scene glitching rather than as an
             infinite plane. And at a 0.16 fade the 10 mm cells were gone a
             few centimetres out, leaving four section lines on black. */
          fadeDistance={GROUND * 0.42}
          fadeStrength={1.2}
          followCamera={false}
          /* Visible from underneath as well.
             drei's grid faces up, so dropping the camera below it left the
             window with nothing in it but the backdrop and whatever part you
             were looking at — no horizon, no scale, no way to tell which way
             you were facing. The grid is the only spatial reference down
             there, so it has to be drawn on both faces. */
          side={THREE.DoubleSide}
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

function SelectionTransform({
  controls,
  suppressed,
}: {
  controls: React.MutableRefObject<OrbitControlsImpl | null>
  /** True while the part is being dragged by hand, which owns the gesture. */
  suppressed: boolean
}) {
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

  /*
   * Hidden while a part is being dragged directly, by turning its handles off
   * rather than by unmounting it.
   *
   * It has to be hidden at all because TransformControls caches the position
   * and scale of the object it is attached to and refreshes them on its own
   * cycle. Dragging a part by hand moves that object from the outside, several
   * times a frame, and the gizmo drew itself from half-stale state: skewed
   * arrows, plane handles adrift, the whole thing scrambled.
   *
   * It has to be hidden this way because unmounting it leaks. Three's gizmo
   * builds something like a dozen small geometries and does not release them
   * all when it goes away, so a mount and unmount on every drag cost about
   * eleven geometries a time — measured at 58 climbing to 150 over eight
   * drags, against 8 for the same drags with it left mounted. On a laptop
   * sharing its memory with the GPU that ends as a stalled viewport.
   */
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
          showX={!suppressed}
          showY={!suppressed}
          showZ={!suppressed}
          enabled={!suppressed}
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

  const { camera, gl, raycaster, scene } = useThree()
  useEffect(() => {
    publishRenderer(gl, scene)
    countGlErrors(gl.getContext())
  }, [gl, scene])
  const drag = useRef<DragState | null>(null)
  /** Set when a press lands on one of several selected parts; see below. */
  const collapseTo = useRef<string | null>(null)

  // Steps the render quality down if this machine cannot hold a usable frame
  // rate. Only ever downward, and only after a warm-up.
  useAdaptiveQuality()
  const showGizmo = useDoc((s) => s.view.gizmo)
  const quality = useDoc((s) => s.view.quality)
  const [grabbing, setGrabbing] = useState(false)
  // Distinct from `grabbing`, which starts on press: this waits for the drag
  // to pass the click threshold, so clicking a part does not blink its gizmo.
  const [moving, setMoving] = useState(false)

  /*
   * What the pointer looks like.
   *
   * Set on the canvas element directly rather than in the stylesheet, because
   * it depends on what is under the cursor in the 3D scene, which no CSS
   * selector can see. Without it the cursor is a plain arrow everywhere and
   * nothing distinguishes a part you can pick up from empty space you can
   * orbit, which is most of what makes a viewport feel unpredictable.
   */
  useEffect(() => {
    const el = gl.domElement
    el.style.cursor = grabbing
      ? 'grabbing'
      : mode === 'wire'
        ? 'crosshair'
        : hovered
          ? 'grab'
          : 'default'
  }, [gl, mode, hovered, grabbing])

  const selectionSet = useMemo(() => new Set(selection), [selection])

  const onPartDown = useCallback(
    (e: ThreeEvent<PointerEvent>, id: string) => {
      if (mode === 'wire') return
      e.stopPropagation()

      // Work out what the gesture applies to before the store has caught up:
      // select() lands on the next render, and the drag starts on this one.
      let ids: string[]
      if (e.shiftKey || e.ctrlKey) {
        toggleSelect(id)
        ids = selectionSet.has(id) ? selection.filter((x) => x !== id) : [...selection, id]
      } else if (selectionSet.has(id)) {
        /*
         * Grabbing one of several selected parts drags the whole set — but
         * only if it turns into a drag. A plain click on one of them means
         * "just this one", and without that the selection never got smaller:
         * you would select three things, click one, drag it, and watch all
         * three move. The release below collapses it.
         */
        ids = selection
        collapseTo.current = selection.length > 1 ? id : null
      } else {
        select([id])
        ids = [id]
      }

      if (mode !== 'build' || e.button !== 0) return
      if (!(e.shiftKey || e.ctrlKey) && !selectionSet.has(id)) collapseTo.current = null
      /*
       * Take the gesture away from the orbit controls immediately, not once it
       * turns into a drag. They have no click threshold of their own, so a
       * plain click on a part used to rotate the camera by however far the
       * mouse happened to travel between press and release.
       */
      if (controls.current) controls.current.enabled = false
      drag.current = beginDrag(ids, e.point)
      if (drag.current) setGrabbing(true)
    },
    [mode, select, toggleSelect, selectionSet, selection],
  )

  /*
   * The move and release halves of a part drag. Bound to the window rather
   * than to the part, so the gesture survives the pointer leaving the part it
   * started on, which it does immediately in any drag worth making.
   */
  useEffect(() => {
    const ndc = new THREE.Vector2()

    const onMove = (e: PointerEvent) => {
      const d = drag.current
      if (!d) return
      const r = gl.domElement.getBoundingClientRect()
      ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1)
      raycaster.setFromCamera(ndc, camera)
      if (updateDrag(d, raycaster, controls.current)) {
        dragging.active = true
        setMoving(true)
      }
    }

    const onUp = () => {
      const d = drag.current
      if (!d) return
      drag.current = null
      setGrabbing(false)
      setMoving(false)
      endDrag(d, controls.current)
      // A press on one of several selected parts that never became a drag
      // meant that part, not the set. Read off the store, because this
      // listener is bound once and would otherwise close over a stale one.
      if (!d.live && collapseTo.current) useDoc.getState().select([collapseTo.current])
      collapseTo.current = null
      // Let the click-versus-drag guard settle before deselection is live
      // again, or the release that ends a drag also clears the selection.
      if (d.live) requestAnimationFrame(() => { dragging.active = false })
    }

    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    window.addEventListener('pointercancel', onUp)
    return () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('pointercancel', onUp)
    }
  }, [camera, gl, raycaster])

  // Only a genuine click clears the selection. Without this every camera orbit
  // that starts over empty space throws away what you had selected.
  const onMiss = useCallback(() => {
    if (dragging.active || !wasClick()) return
    clearSelection()
    setPendingWire(null)
  }, [clearSelection, setPendingWire])

  return (
    <>
      {/* The backdrop paints every direction, so a clear colour would only
          ever be seen for the one frame before it draws. Kept as the colour
          the fog fades into, which has to match the horizon band. */}
      <color attach="background" args={['#0D1117']} />
      <fog attach="fog" args={['#0D1117', 2200, 6000]} />
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

      <DiagnosticsProbe />
      <SelectionCage />
      <SelectionTransform controls={controls} suppressed={moving} />
      <SnapIndicator />
      <ModalTransform />
      <CameraRig controls={controls} />

      <OrbitControls
        ref={(c) => {
          controls.current = c
          // The screenshot harness in tools/ needs a way to place the camera
          // that does not depend on synthesising a drag; a drag has to get
          // past the picking handlers first, and silently does not.
          publishControls(c)
        }}
        makeDefault
        /*
         * Damping high enough to smooth a jittery mouse and no higher. At 0.12
         * the camera kept coasting after the pointer stopped, which reads as
         * lag rather than as polish; the rest of the sluggishness was frame
         * rate, handled by useAdaptiveQuality above.
         */
        enableDamping
        dampingFactor={0.22}
        rotateSpeed={0.95}
        panSpeed={1.1}
        zoomSpeed={1.15}
        minDistance={8}
        maxDistance={4000}
        /*
         * Zoom toward the pointer rather than the orbit centre. Without it,
         * getting a close look at a corner of a large build means zoom, pan
         * back to what you were looking at, zoom, pan, over and over, because
         * every zoom pulls toward the middle of the scene instead of toward
         * the thing under your cursor.
         */
        zoomToCursor
        /*
         * Far enough under to look up at a board, and no further.
         *
         * This used to stop at 0.495 pi — nine tenths of a degree above dead
         * level — so the camera could never get beneath anything. Every
         * through-hole terminal is on the underside of the board it is seated
         * in, which made the one view you actually need to check a joint the
         * one view you could not have.
         *
         * It still stops short of the pole. At exactly pi the azimuth is
         * undefined and orbit controls resolve it by snapping the scene round,
         * so the last few degrees cost nothing and save a flip.
         */
        maxPolarAngle={Math.PI * 0.94}
        mouseButtons={{
          LEFT: THREE.MOUSE.ROTATE,
          MIDDLE: THREE.MOUSE.DOLLY,
          RIGHT: THREE.MOUSE.PAN,
        }}
      />

      {/*
        * The render priority here decides whether the scene gets drawn at all.
        *
        * drei renders this widget through a Hud, and a Hud at priority 1 draws
        * the main scene first and then the widget on top of it. At any other
        * priority it draws only the widget, and assumes something else has
        * already drawn the scene.
        *
        * Which is true when the effect composer is running, at priority 1 —
        * and false when it is not. With post-processing on Fastest there is no
        * composer, so nothing drew the scene: the canvas froze on its last
        * good frame while the widget went on painting over itself, and the
        * result was a stuck picture with a gizmo smeared across it. Measured
        * at nine draw calls and forty-eight triangles for a build that needs
        * five hundred and nine hundred thousand.
        *
        * So: priority 1 when the Hud has to do the whole job, priority 2 when
        * it only has to sit on top of the composer's output. Two was needed at
        * all because at equal priority r3f runs them in mount order, and PostFx
        * mounts last — which is why this widget had never been seen by anybody
        * until it was moved out of the composer's way.
        */}
      {showGizmo && (
        <GizmoHelper
          alignment="bottom-right"
          margin={[80, 80]}
          renderPriority={quality === 'off' ? 1 : 2}
        >
          <GizmoViewport
            axisColors={['#FF6B6B', '#3DD68C', '#4C8DFF']}
            labelColor="#0B0D10"
            axisHeadScale={1.05}
          />
        </GizmoHelper>
      )}

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
      /*
       * preserveDrawingBuffer is what lets the project list photograph the
       * viewport. Without it the buffer may be cleared as soon as the frame is
       * presented, and reading it back gives a blank image on some drivers and
       * not others.
       */
      gl={{ antialias: true, alpha: false, powerPreference: 'high-performance', preserveDrawingBuffer: true }}
      // A near-to-far ratio of fifty thousand spends most of the depth buffer
      // on space nothing occupies. The camera cannot get closer than 8 mm or
      // further than 4 m, so this covers it with room to spare.
      camera={{ position: [300, 230, 340], fov: 36, near: 1, far: 12000 }}
      onCreated={({ gl }) => {
        registerCanvas(gl.domElement)
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
