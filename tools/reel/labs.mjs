/**
 * Screen recordings of the two 555 breadboard labs.
 *
 * Plain captures, not films. The camera is set once and never moves: no fly,
 * no drift, no push-in. This is evidence that the circuit runs, and a camera
 * wandering around it is the thing that makes somebody wonder what they are
 * being distracted from. The editor's own chrome stays on screen for the same
 * reason — it is proof the circuit is running inside Draftrig.
 *
 *   npm run dev
 *   BASE=http://localhost:5173 node tools/reel/run.mjs record lab
 *   node tools/reel/labs-build.mjs
 */

/** Enough interface to read as software, without the parts nobody needs. */
const WORKING = `
  .ai-fab, .bom-tab, .sketch-tab, .vp-hint, .empty-hint { display: none !important; }
`

const base = {
  width: 1280,
  height: 720,
  dsf: 1,
  url: '/app',
  style: WORKING,
  view: { gizmo: false, ports: false },
  fit: false,
}

/** Load a starter, switch it on, and park the camera where the shot starts. */
const stage = (starter, target, az, pol, dist) => async (page) => {
  await page.evaluate(
    ([id, t, a, p, d]) => {
      const s = window.draftrig.starters.find((x) => x.id === id)
      const doc = window.draftrig.doc.getState()
      if (s) doc.loadDoc(s.build())
      doc.select([])
      window.draftrig.engine.reset()
      window.draftrig.sim.getState().setRunning(true)
      const c = window.draftrig.camera.controls
      c.target.set(t[0], t[1], t[2])
      const rad = (v) => (v * Math.PI) / 180
      c.object.position.set(
        t[0] + d * Math.sin(rad(p)) * Math.sin(rad(a)),
        t[1] + d * Math.cos(rad(p)),
        t[2] + d * Math.sin(rad(p)) * Math.cos(rad(a)),
      )
      c.object.lookAt(c.target)
      c.update()
    },
    [starter, target, az, pol, dist],
  )
}

/* ------------------------------------------------------------------ */

/**
 * Lab 9 — the lamp blinking, from one fixed angle.
 *
 * Real time, because the whole claim is the rate: 1.44 / (21 kOhm x 100 uF)
 * is about 0.69 Hz, and a clip played at anything other than 1x would be
 * showing a different circuit. Twenty seconds is a dozen or so blinks, which
 * is enough to see that it is regular rather than a flicker.
 */
export const LAB9 = {
  ...base,
  id: 'lab9',
  rate: 1,
  simSpeed: 1,
  /* A coarser timestep, because this circuit does not need a fine one.
     The default 25 us is sized for fast edges; here the slowest thing is a
     100 uF cap charging through 21 k, a time constant of two seconds. At
     25 us the solver spends the whole capture advancing the clock by a
     fraction of a second and the lamp never changes state on camera. At
     1 ms it runs at about 85% of real time and the rate is unchanged. */
  simDt: 1e-3,
  seconds: 20,
  camera: [30, 54, 205],
  setup: stage('lab9-blinker', [12, 10, 8], 30, 54, 205),
  async perform(page) {
    await page.evaluate(async () => {
      // Nothing happens here on purpose. The circuit is what moves.
      await window.__rig.hold(19000)
    })
  },
}

/**
 * Lab 10 — the tone, with the pitch swept, from one fixed angle.
 *
 * The knob turns and the camera does not. Nothing here makes a sound and a
 * 4 kHz square wave is far too fast to see, so the wiper is the only visible
 * evidence the circuit is doing anything — and turning it is step one of the
 * sheet anyway. It is driven through the document rather than dragged with
 * the pointer, so there is no cursor skating across the recording.
 */
export const LAB10 = {
  ...base,
  id: 'lab10',
  rate: 1,
  simSpeed: 1,
  seconds: 20,
  camera: [30, 54, 245],
  setup: stage('lab10-buzzer', [16, 10, 6], 30, 54, 245),
  async perform(page) {
    await page.evaluate(async () => {
      const rig = window.__rig
      const doc = window.draftrig.doc.getState()
      const pot = Object.values(doc.doc.instances).find((i) => i.defId === 'potentiometer')

      const sweep = (from, to, ms) =>
        new Promise((done) => {
          const t0 = performance.now()
          const step = () => {
            const k = Math.min(1, (performance.now() - t0) / ms)
            const ease = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2
            window.draftrig.doc.getState().setParam(pot.id, 'pos', Math.round(from + (to - from) * ease), false)
            if (k < 1) requestAnimationFrame(step)
            else done()
          }
          requestAnimationFrame(step)
        })

      await rig.hold(2500)
      await sweep(50, 2, 4500)
      await rig.hold(1200)
      await sweep(2, 98, 5500)
      await rig.hold(1200)
      await sweep(98, 50, 2000)
      await rig.hold(1800)
    })
  },
}

export const LAB_SHOTS = [LAB9, LAB10]
