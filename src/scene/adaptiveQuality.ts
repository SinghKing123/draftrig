import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { useDoc } from '@/state/doc'

/**
 * Keeping the viewport responsive on whatever machine it lands on.
 *
 * The render settings that make a CAD viewport look solid — ambient occlusion
 * in the crevices, antialiasing, soft shadows — are also the expensive ones,
 * and how expensive depends entirely on the GPU. On integrated graphics the
 * full-quality pipeline runs at under 30 fps, and at under 30 fps a viewport
 * does not read as pretty, it reads as broken: orbiting lags behind the mouse
 * and zooming arrives late. Pretty is worth nothing if the thing feels stuck.
 *
 * So the quality setting is treated as a ceiling rather than a promise. This
 * watches real frame times and steps down when the machine cannot keep up. It
 * only ever steps down, never back up: a monitor that reacts in both
 * directions oscillates, and a viewport that changes its own appearance every
 * few seconds is worse than one that is simply a bit plainer.
 */

/** Below this, the lag is perceptible on a mouse drag. */
const FLOOR_FPS = 42
/** Sampled over this many frames, so one stutter cannot trigger a drop. */
const WINDOW = 100
/** Ignore the first stretch: shaders compile and textures upload there. */
const WARMUP_MS = 2500

export function useAdaptiveQuality(): void {
  const frames = useRef(0)
  const elapsed = useRef(0)
  const started = useRef(0)

  useFrame((_, delta) => {
    // Chrome hands out one enormous delta after a background tab wakes, which
    // would read as a machine that has ground to a halt.
    if (delta > 0.5) return

    const now = performance.now()
    if (started.current === 0) started.current = now
    if (now - started.current < WARMUP_MS) return

    frames.current++
    elapsed.current += delta
    if (frames.current < WINDOW) return

    const fps = frames.current / elapsed.current
    frames.current = 0
    elapsed.current = 0
    if (fps >= FLOOR_FPS) return

    const { view, setView, qualityPinned } = useDoc.getState()
    // Somebody has chosen a setting. It is theirs, not ours.
    if (qualityPinned) {
      started.current = Number.POSITIVE_INFINITY
      return
    }
    if (view.quality === 'high') setView({ quality: 'balanced' })
    else if (view.quality === 'balanced') setView({ quality: 'off' })
    else if (view.shadows) setView({ shadows: false })
    // Nothing left to give up. Stop measuring rather than thrash.
    else started.current = Number.POSITIVE_INFINITY
  })
}
