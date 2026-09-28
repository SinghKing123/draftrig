import { useEffect, useRef } from 'react'
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

  /*
   * Count every render in the frame, not just the last one.
   *
   * three clears gl.info at the top of each render() call, and a frame here is
   * several: the composer's passes, then the Hud the axis widget draws
   * through. Reading the counters afterwards therefore reported the gizmo —
   * nine draw calls and forty-eight triangles — no matter what was on the
   * bench, at every quality setting, which is a reading that looks precise and
   * means nothing. Resetting once at the top of the frame and reading at the
   * bottom gives the whole frame.
   */
  useEffect(() => {
    gl.info.autoReset = !open
    return () => {
      gl.info.autoReset = true
    }
  }, [gl, open])

  // Priority 0.4: ahead of the autoClear guard at 0.5, the composer at 1 and
  // the Hud at 2, so the count starts clean each frame.
  useFrame(() => {
    if (open) gl.info.reset()
  }, 0.4)

  // Priority 3: after everything that draws.
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
  }, 3)

  // Nothing is drawn here: the readout is HTML over the canvas, so it stays
  // crisp and can be selected and copied.
  return null
}
