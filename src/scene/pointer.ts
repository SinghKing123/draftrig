/**
 * Click-versus-drag discrimination.
 *
 * Three.js pointer events fire on release regardless of how far the pointer
 * travelled, so orbiting the camera would otherwise register as a click on
 * whatever happens to be under the cursor — clearing the selection every time
 * you look around. Every interaction that should only happen on a *click* asks
 * this module first.
 */

const DRAG_SLOP_PX = 5

const state = {
  x: 0,
  y: 0,
  moved: false,
  down: false,
}

export function installPointerTracker(): () => void {
  const onDown = (e: PointerEvent) => {
    state.x = e.clientX
    state.y = e.clientY
    state.moved = false
    state.down = true
  }
  const onMove = (e: PointerEvent) => {
    if (!state.down || state.moved) return
    if (Math.abs(e.clientX - state.x) > DRAG_SLOP_PX || Math.abs(e.clientY - state.y) > DRAG_SLOP_PX) {
      state.moved = true
    }
  }
  const onUp = () => {
    state.down = false
  }

  window.addEventListener('pointerdown', onDown, true)
  window.addEventListener('pointermove', onMove, true)
  window.addEventListener('pointerup', onUp, true)
  window.addEventListener('pointercancel', onUp, true)
  return () => {
    window.removeEventListener('pointerdown', onDown, true)
    window.removeEventListener('pointermove', onMove, true)
    window.removeEventListener('pointerup', onUp, true)
    window.removeEventListener('pointercancel', onUp, true)
  }
}

/** True when the pointer has not travelled far enough to count as a drag. */
export function wasClick(): boolean {
  return !state.moved
}
