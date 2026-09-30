import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { Lights, StudioEnvironment } from '@/scene/Render'
import { PartObject } from '@/scene/PartObject'
import { Wires } from '@/scene/Wires'
import { Solder } from '@/scene/Solder'
import { PortIndexProvider } from '@/scene/portIndex'
import { listInstances, useDoc } from '@/state/doc'
import { useSim } from '@/state/sim'
import { engine } from '@/sim/engine'
// Registers the part catalog. Safe here and nowhere near the landing page's
// first load: everything in this file arrives in a chunk that is only fetched
// once the section it belongs to is on screen.
import '@/parts'
import { STARTERS } from '@/io/starters'

/**
 * A real board, turning, on the front page.
 *
 * Not a picture of one and not a diagram: the same renderer the editor uses,
 * the same parts at the same millimetre sizes, and the same solver running
 * behind it — which is why the lamp on it is lit. A screenshot could show the
 * first two. Only this can show the third.
 *
 * Everything about how it is loaded is in Simulate() at the bottom of
 * Landing.tsx: this module pulls in three.js, the part catalog and the
 * simulation engine, and it must not be part of what someone downloads to read
 * the front page. It is imported lazily and mounted only once it has scrolled
 * into view.
 */

/** Slow, continuous, and never quite repeating from where you picked it up. */
function Turntable({ at, speed = 0.16 }: { at: [number, number, number]; speed?: number }) {
  const { camera } = useThree()
  const target = useRef(new THREE.Vector3(...at))

  useFrame((_, delta) => {
    const v = camera.position.clone().sub(target.current)
    const az = Math.atan2(v.x, v.z) + delta * speed
    const r = Math.hypot(v.x, v.z)
    camera.position.set(
      target.current.x + r * Math.sin(az),
      camera.position.y,
      target.current.z + r * Math.cos(az),
    )
    camera.lookAt(target.current)
  })
  return null
}

function Board() {
  const instances = listInstances(useDoc((s) => s.doc))

  /*
   * Framed on the circuit, not on the board it sits on.
   *
   * A full-size breadboard is 165 mm long and the parts occupy a couple of
   * centimetres at one end of it. Pointed at the middle of everything, the
   * shot is mostly empty plastic with the interesting part small and off to
   * one corner. The lamp is what this section is about, so that is what the
   * camera looks at.
   */
  const lamp = instances.find((i) => i.defId === 'led-5mm')
  const at: [number, number, number] = lamp ? [lamp.pos[0], lamp.pos[1] + 4, lamp.pos[2]] : [0, 6, 0]

  return (
    <>
      <color attach="background" args={['#0A0C0F']} />
      <StudioEnvironment />
      <Lights />
      {instances.map((inst) => (
        <PartObject
          key={inst.id}
          inst={inst}
          selected={false}
          hovered={false}
          // Nothing here is selectable. The prop is required because in the
          // editor a part is the thing you grab, and it costs less to hand it
          // a no-op than to make the contract optional for one caller.
          onPointerDown={() => {}}
        />
      ))}
      <Wires />
      <Solder />
      <Turntable at={at} />
    </>
  )
}

export default function LiveBoard() {
  useEffect(() => {
    /*
     * Loaded straight into the editor's own document store.
     *
     * It is a singleton and the editor is not mounted on this page, so there
     * is nothing to collide with — and it means the parts, the wires and the
     * solver all see exactly what they see in the app, rather than a second
     * cut-down path that could drift away from the real one.
     */
    /*
     * The one that lights.
     *
     * The 555 blinker is the better looking board and it was the first
     * choice, but measured on this page its lamp never comes on: the solver
     * advances happily, the circuit stays dark, and the same is true of the
     * microcontroller starter. This section's whole claim is that the light
     * is lit because current is flowing, so it has to be a circuit where that
     * visibly happens.
     */
    const starter = STARTERS.find((s) => s.id === 'led')
    if (!starter) return
    useDoc.getState().loadDoc(starter.build())
    useDoc.getState().select([])
    // No terminal markers and no axis widget; this is a picture, not a tool.
    useDoc.getState().setView({ ports: false, grid: false, gizmo: false })
    engine.start()
    engine.reset()
    useSim.getState().setRunning(true)
    return () => {
      useSim.getState().setRunning(false)
      engine.stop()
    }
  }, [])

  return (
    <div className="live-board">
      <Canvas
        shadows
        dpr={[1, 2]}
        gl={{ antialias: true, alpha: false, powerPreference: 'high-performance' }}
        camera={{ position: [64, 47, 72], fov: 34, near: 1, far: 4000 }}
        onCreated={({ gl }) => {
          gl.toneMapping = THREE.NoToneMapping
          gl.shadowMap.type = THREE.PCFSoftShadowMap
        }}
      >
        {/* Wires and solder joints find their endpoints through this, not
            through the document: without it every connection resolves to
            nothing and the board renders as loose components on a bare
            board, which is exactly how it looked the first time. */}
        <PortIndexProvider>
          <Board />
        </PortIndexProvider>
      </Canvas>
      <figcaption className="figure-tag">
        <b>LED and a series resistor</b> · running now
      </figcaption>
    </div>
  )
}
