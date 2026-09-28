import { useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { useDoc } from '@/state/doc'
import { glErrorCount, useDiagnostics } from './diagnostics'

/**
 * Samples the viewport once a second, but only while the panel is open.
 *
 * Walking the scene graph and reading renderer info is cheap, and doing it
 * every frame would still be a silly thing to spend a frame budget on when
 * nobody is looking at the result.
 */
export function DiagnosticsProbe() {
  const { gl, scene } = useThree()
  const open = useDiagnostics((s) => s.open)
  const publish = useDiagnostics((s) => s.set)

  const frames = useRef(0)
  const elapsed = useRef(0)
  const worst = useRef(0)

  useFrame((_, delta) => {
    if (!open) return
    frames.current++
    elapsed.current += delta
    // A freeze is one very long frame, which an average would hide entirely.
    if (delta > worst.current) worst.current = delta
    if (elapsed.current < 1) return

    let objects = 0
    let gizmos = 0
    scene.traverse((o) => {
      objects++
      if (o.constructor?.name === 'TransformControls') gizmos++
    })

    const mem = gl.info.memory
    const render = gl.info.render
    const perf = performance as Performance & { memory?: { usedJSHeapSize: number } }

    publish({
      fps: Math.round(frames.current / elapsed.current),
      worstFrame: Math.round(worst.current * 1000),
      geometries: mem.geometries,
      textures: mem.textures,
      programs: gl.info.programs?.length ?? 0,
      calls: render.calls,
      triangles: render.triangles,
      objects,
      gizmos,
      glErrors: glErrorCount(),
      contextLost: gl.getContext().isContextLost(),
      quality: useDoc.getState().view.quality,
      heapMb: perf.memory ? Math.round(perf.memory.usedJSHeapSize / 1048576) : 0,
    })

    frames.current = 0
    elapsed.current = 0
    worst.current = 0
  })

  // Nothing is drawn here: the readout is HTML over the canvas, so it stays
  // crisp and can be selected and copied.
  return null
}
