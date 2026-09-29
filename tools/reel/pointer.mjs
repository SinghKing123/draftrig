/**
 * A cursor you can see, and terminals you can aim at.
 *
 * Chrome's screencast does not draw the mouse pointer, so a UI shot recorded
 * straight looks like the software is operating itself — menus opening, wires
 * appearing, nothing there to have done it. This draws a pointer into the page
 * and keeps it on top of the real one, which is how software demos are shot.
 *
 * The real mouse still has to travel, or nothing highlights on the way: the
 * two are stepped together from here rather than tweened in the page, so the
 * hover under the drawn pointer is the hover the user would get.
 */

export const CURSOR = `
(() => {
  const el = document.createElement('div')
  el.id = '__cursor'
  el.innerHTML = \`<svg width="30" height="30" viewBox="0 0 24 24" fill="none">
    <path d="M5 2.5 L5 19 L9.2 15.2 L11.8 21.2 L14.7 20 L12.1 14.1 L17.6 13.9 Z"
          fill="#fff" stroke="rgba(8,10,14,.85)" stroke-width="1.1" stroke-linejoin="round"/>
  </svg>\`
  Object.assign(el.style, {
    position: 'fixed', left: '0', top: '0', zIndex: '2147483647',
    pointerEvents: 'none', filter: 'drop-shadow(0 3px 7px rgba(0,0,0,.6))',
    transform: 'translate(-50vw,-50vh)', willChange: 'transform',
  })
  document.body.appendChild(el)
  window.__cursor = {
    at(x, y) { el.style.transform = \`translate(\${x}px, \${y}px)\` },
    /**
     * Travel between two points under the page's own animation frame.
     *
     * Stepping this from the test runner meant a round trip per step, and on
     * a shot where the page is painting five frames a second those cost more
     * than the move itself: a three-wire sequence took over a minute of
     * capture, nearly all of it the pointer waiting to be told where to go.
     */
    glide(fx, fy, tx, ty, ms) {
      const ease = (k) => (k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2)
      const t0 = performance.now()
      return new Promise((done) => {
        const step = () => {
          const k = Math.min(1, (performance.now() - t0) / ms)
          const e = ease(k)
          this.at(fx + (tx - fx) * e, fy + (ty - fy) * e)
          if (k < 1) requestAnimationFrame(step)
          else done()
        }
        requestAnimationFrame(step)
      })
    },
    hide() { el.style.opacity = '0' },
    show() { el.style.opacity = '1' },
    /** A ring that expands and fades, so a click reads as a click. */
    tap(x, y) {
      const r = document.createElement('div')
      Object.assign(r.style, {
        position: 'fixed', left: (x - 3) + 'px', top: (y - 3) + 'px',
        width: '6px', height: '6px', borderRadius: '50%',
        border: '2px solid rgba(120,175,255,.95)', zIndex: '2147483646',
        pointerEvents: 'none', transition: 'all 460ms cubic-bezier(.2,.7,.3,1)',
      })
      document.body.appendChild(r)
      requestAnimationFrame(() => {
        r.style.width = '46px'; r.style.height = '46px'
        r.style.left = (x - 25) + 'px'; r.style.top = (y - 25) + 'px'
        r.style.opacity = '0'
      })
      setTimeout(() => r.remove(), 520)
    },
  }
})()
`

let last = { x: 0, y: 0 }

/**
 * How far everything here is stretched.
 *
 * A shot is performed slowly and sped back up on the way out, so a pointer
 * that travels at its natural speed during the capture arrives in the finished
 * clip moving several times too fast — the one thing in frame that gives away
 * that the video has been retimed. Set from the shot's rate before it runs.
 */
let slow = 1
export const setSlow = (n) => {
  slow = n || 1
}

/**
 * Walk the drawn pointer and the real one to a point together.
 *
 * The drawn one is tweened inside the page; the real one is nudged along it a
 * few times on the way, which is enough for things to light up under it as it
 * passes without paying a round trip per frame.
 */
export async function moveTo(page, x, y, ms = 700) {
  const from = { ...last }
  const dur = ms * slow
  const tween = page.evaluate(
    ([fx, fy, tx, ty, d]) => window.__cursor.glide(fx, fy, tx, ty, d),
    [from.x, from.y, x, y, dur],
  )
  const steps = 6
  for (let i = 1; i <= steps; i++) {
    await page.waitForTimeout(dur / steps)
    const e = i / steps
    await page.mouse.move(from.x + (x - from.x) * e, from.y + (y - from.y) * e)
  }
  await tween
  last = { x, y }
}

export async function click(page, x, y, { travel = 700, settle = 220 } = {}) {
  await moveTo(page, x, y, travel)
  await page.evaluate(([a, b]) => window.__cursor.tap(a, b), [x, y])
  await page.mouse.click(x, y)
  await page.waitForTimeout(settle * slow)
}

/** Put the pointer somewhere without it appearing to fly in from nowhere. */
export async function placeAt(page, x, y) {
  last = { x, y }
  await page.evaluate(([a, b]) => window.__cursor.at(a, b), [x, y])
  await page.mouse.move(x, y)
}

/**
 * Where a terminal is on screen.
 *
 * Recomputed from the document and the camera rather than read from the port
 * index, which the app does not publish. Needs the dev server, since it
 * imports the kernel directly.
 */
export async function portAt(page, instanceId, portId) {
  return page.evaluate(
    async ([id, pid]) => {
      // Resolved once and kept. Re-importing the kernel for every terminal
      // added seconds of dead air to a shot that is only seconds long.
      window.__kernel ??= Promise.all([
        import('/node_modules/three/build/three.module.js'),
        import('/src/parts/kernel/build.ts'),
        import('/src/parts/kernel/registry.ts'),
      ])
      const [THREE, { buildPart, instanceMatrix }, { getPart }] = await window.__kernel
      const d = window.draftrig.doc.getState().doc
      const inst = d.instances[id]
      if (!inst) return null
      const def = getPart(inst.defId)
      const port = buildPart(def, inst.params).ports.find((p) => p.id === pid)
      if (!port) return null
      const cam = window.draftrig.camera.controls.object
      const el = window.draftrig.camera.controls.domElement
      const box = el.getBoundingClientRect()
      const v = new THREE.Vector3(...port.pos)
        .applyMatrix4(instanceMatrix(inst.pos, inst.rot))
        .project(cam)
      return {
        x: box.left + ((v.x + 1) / 2) * box.width,
        y: box.top + ((1 - v.y) / 2) * box.height,
        onScreen: v.z < 1 && Math.abs(v.x) < 0.98 && Math.abs(v.y) < 0.98,
      }
    },
    [instanceId, portId],
  )
}
