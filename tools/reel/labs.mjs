/**
 * Screen recordings of the two 555 breadboard labs.
 *
 * These are evidence rather than advertising, so the editor's own chrome
 * stays on screen: the point is that this is the circuit running inside
 * Draftrig, and a full-bleed canvas with the interface hidden would prove
 * less, not more.
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
 * Lab 9 — the lamp blinking.
 *
 * Real time, because the whole claim is the rate: 1.44 / (21 kΩ · 100 µF) is
 * about 0.69 Hz, and a clip played back at anything other than 1× would be
 * showing a different circuit. Twenty seconds is a dozen or so blinks, which
 * is long enough to see that it is regular rather than a flicker.
 */
export const LAB9 = {
  ...base,
  id: 'lab9',
  rate: 1,
  simSpeed: 1,
  /* A coarser timestep, because this circuit does not need a fine one.
     The default 25 us is sized for fast edges; here the slowest thing in the
     circuit is a 100 uF cap charging through 21 k, a time constant of two
     seconds. At 25 us the solver spends the whole capture advancing the
     clock by a fraction of a second and the lamp never changes state on
     camera. 200 us covers a hundred times more ground per solve and the
     measured blink rate is unchanged. */
  simDt: 1e-3,
  seconds: 20,
  camera: [30, 54, 205],
  setup: stage('lab9-blinker', [12, 10, 8], 30, 54, 205),
  async perform(page) {
    await page.evaluate(async () => {
      const rig = window.__rig
      await rig.hold(1500)
      /* The lamp stays in frame for the whole shot.
         An earlier cut pushed in to 108 mm and the LED — the only thing the
         clip exists to show — left the picture for several seconds. */
      await rig.fly(16, 48, 168, 4500)
      await rig.hold(2500)
      await rig.drift(-4, 7000)
      await rig.fly(42, 58, 210, 3800)
      await rig.hold(1200)
    })
  },
}

/**
 * Lab 10 — the tone, with the pitch swept.
 *
 * Nothing here makes a sound, so the knob has to carry it: the shot turns
 * the potentiometer from one end to the other and back while the output runs,
 * which is the sheet's own instruction ("slowly adjust the potentiometer from
 * one end to the other"). The wiper is moved through the document rather than
 * by dragging it, so the sweep is even and the solver sees every step.
 */
export const LAB10 = {
  ...base,
  id: 'lab10',
  rate: 1,
  simSpeed: 1,
  seconds: 24,
  camera: [34, 56, 250],
  setup: stage('lab10-buzzer', [20, 10, 6], 34, 56, 250),
  async perform(page) {
    await page.evaluate(async () => {
      const rig = window.__rig
      const doc = window.draftrig.doc.getState()
      const pot = Object.values(doc.doc.instances).find((i) => i.defId === 'potentiometer')

      /* Turn the wiper over `ms`, writing it straight into the document.
         Dragging the knob with the pointer would record a cursor skating
         across the screen, which is the thing that makes a screen recording
         look amateur; this way the knob turns on its own. */
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

      // Wide first, so the whole circuit and the speaker are established.
      const page_lookAtPot = () => {
        const c = window.draftrig.camera.controls
        const v = c.object.position.clone().sub(c.target)
        c.target.set(pot.pos[0], pot.pos[1] + 8, pot.pos[2])
        c.object.position.copy(c.target).add(v)
        c.update()
      }
      const page_lookAtBench = () => {
        const c = window.draftrig.camera.controls
        const v = c.object.position.clone().sub(c.target)
        c.target.set(20, 10, 6)
        c.object.position.copy(c.target).add(v)
        c.update()
      }

      await rig.hold(2200)

      /* Then onto the knob, and it stays there for the whole sweep.
         An earlier take drifted while sweeping and walked the potentiometer
         off the left edge — the one part the shot exists to show. */
      await page_lookAtPot()
      await rig.fly(18, 52, 118, 3200)
      await rig.hold(800)

      await sweep(50, 2, 4200)
      await rig.hold(900)
      await sweep(2, 98, 5200)
      await rig.hold(900)
      await sweep(98, 50, 1800)

      // Back out to the whole bench to finish.
      await rig.hold(600)
      await page_lookAtBench()
      await rig.fly(44, 58, 250, 3200)
      await rig.hold(1000)
    })
  },
}

export const LAB_SHOTS = [LAB9, LAB10]
