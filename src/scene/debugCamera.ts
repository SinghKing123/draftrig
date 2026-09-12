import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib'

/**
 * A camera handle for the screenshot harness in tools/.
 *
 * The photographs on the marketing site have to be taken from the same place
 * every time, and the obvious way to get there, synthesising a drag across the
 * canvas, does not work: the drag is consumed by the part picking handlers
 * before the orbit controls ever see it, and fails silently, which is worse
 * than failing loudly. This publishes the controls so a tool can put the
 * camera where it wants in one call.
 *
 * Nothing in the app reads this. It costs one property on an object that
 * already exists for exactly this purpose.
 */

interface DebugCamera {
  /** Place the camera on a sphere about the current target. */
  view: (azimuthDeg: number, polarDeg: number) => void
  controls: OrbitControlsImpl | null
}

/** The shape App.tsx puts on the window, with this one extra property. */
type Harness = { camera?: DebugCamera }

export function publishControls(c: OrbitControlsImpl | null): void {
  if (typeof window === 'undefined') return
  const harness = (window as unknown as { draftrig?: Harness }).draftrig
  if (!harness) return
  harness.camera = {
    controls: c,
    view: (azimuthDeg: number, polarDeg: number) => {
      if (!c) return
      const cam = c.object
      const t = c.target
      const r = cam.position.distanceTo(t) || 600
      const az = (azimuthDeg * Math.PI) / 180
      const pol = (polarDeg * Math.PI) / 180
      cam.position.set(
        t.x + r * Math.sin(pol) * Math.sin(az),
        t.y + r * Math.cos(pol),
        t.z + r * Math.sin(pol) * Math.cos(az),
      )
      cam.lookAt(t)
      c.update()
    },
  }
}
