import { BUILD as DISPLAY_BUILD } from './display.mjs'

/**
 * Short silent clips for the front page.
 *
 * Landscape, a few seconds each, and every one is a single continuous take of
 * the editor doing something real — no pointer choreography, because a cursor
 * jerking around a screen recording is the thing that makes software look
 * amateur. The document and the camera move; that is all.
 *
 * They loop, so each one ends close to where it began.
 *
 *   npm run dev
 *   BASE=http://localhost:5173 node tools/reel/run.mjs record clip-
 *   node tools/reel/clips-build.mjs
 */

/** Everything except the bench. */
const BARE = `
  .app { grid-template-rows: 1fr !important; }
  .app-body { grid-template-columns: 1fr !important; }
  .panel, .console, .statusbar, .topbar, .bom-tab, .sketch-tab, .mbar,
  .vp-toolbar, .vp-hint, .vp-modes, .wire-colors, .vp-stats, .empty-hint,
  .inspector, .bom-panel, .sketch-panel { display: none !important; }
  .app-center { border: 0 !important; }
`

const base = {
  width: 1280,
  height: 720,
  dsf: 1,
  url: '/app',
  style: BARE,
  view: { gizmo: false, ports: false },
  fit: false,
}

/** Load a starter and park the camera, without the rig re-framing afterwards. */
const stage = (starter, target, az, pol, dist) => async (page) => {
  await page.evaluate(
    ([id, t, a, p, d]) => {
      const s = window.draftrig.starters.find((x) => x.id === id)
      const doc = window.draftrig.doc.getState()
      if (s) doc.loadDoc(s.build())
      doc.select([])
      window.draftrig.engine.reset()
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

/** A board assembling itself: parts landing, then the wiring drawn on. */
export const CLIP_ASSEMBLE = {
  ...base,
  id: 'clip-assemble',
  rate: 6,
  simSpeed: 1,
  camera: [30, 62, 150],
  async setup(page) {
    await page.addScriptTag({ content: DISPLAY_BUILD })
    await page.evaluate(() => {
      window.__display.stage()
      const c = window.draftrig.camera.controls
      c.target.set(0, 6, -20)
      c.update()
    })
  },
  async perform(page) {
    await page.evaluate(async (slow) => {
      const rig = window.__rig
      window.draftrig.engine.reset()
      window.draftrig.sim.getState().setRunning(true)
      await Promise.all([
        window.__display.play(slow),
        (async () => {
          await rig.fly(52, 58, 168, 5400)
          await rig.fly(6, 40, 120, 4200)
        })(),
      ])
      await rig.drift(5, 2600)
    }, 6)
  },
}

/** A finished board, running. The panel is lit because the solver lit it. */
export const CLIP_RUN = {
  ...base,
  id: 'clip-run',
  rate: 4,
  simSpeed: 1,
  camera: [26, 54, 230],
  setup: stage('scoreboard', [-6, 10, -10], 26, 54, 260),
  async perform(page) {
    await page.evaluate(async () => {
      const rig = window.__rig
      window.draftrig.engine.reset()
      window.draftrig.sim.getState().setRunning(true)
      await rig.fly(-6, 44, 150, 5200)
      await rig.fly(22, 56, 215, 5200)
    })
  },
}

/** A slow pass over a dense bench: the wiring, close enough to read. */
export const CLIP_WIRE = {
  ...base,
  id: 'clip-wire',
  rate: 4,
  simSpeed: 1,
  camera: [40, 48, 130],
  setup: stage('bench-clock', [-4, 10, 4], 40, 48, 130),
  async perform(page) {
    await page.evaluate(async () => {
      const rig = window.__rig
      window.draftrig.engine.reset()
      window.draftrig.sim.getState().setRunning(true)
      await rig.fly(-18, 42, 108, 5600)
      await rig.fly(38, 50, 134, 5000)
    })
  },
}

/**
 * Breadth: the sting, then four builds, each with the camera moving.
 *
 * It opens on the brand animation the editor opens on — the same markup and
 * the same stylesheet, injected into the page so the recorder picks it up as
 * part of the capture rather than as a segment glued on afterwards. The loop
 * then has a head, which is what stops four cuts of circuits from reading as
 * four unrelated photographs.
 *
 * Every beat moves. They used to be a slow orbit from a fixed distance, which
 * is the same shot four times with different objects in it; now each one
 * starts wide and flies somewhere, so the cut has somewhere to cut from.
 */
export const CLIP_BUILDS = {
  ...base,
  id: 'clip-builds',
  rate: 4,
  simSpeed: 1,
  camera: [10, 32, 470],
  /*
   * The sting goes up in setup, paused, not at the top of perform.
   * Recording starts the instant perform does, so raising it there put two
   * frames of bare bench on the front of the loop before the logo covered it.
   */
  async setup(page) {
    await stage('eight-bit', [0, 10, 0], 10, 32, 470)(page)
    await page.evaluate((vias) => {
      /*
       * The editor plays this animation itself on every open, so by the time
       * a shot is set up there is already a `.sting` in the page — hidden,
       * but still in the document. Removing "the" sting by class therefore
       * took React's and left this one on screen for the whole take: every
       * frame of a two-minute recording came out as the same frozen logo.
       * This one gets an id, and the app's is cleared out first.
       */
      document.querySelectorAll('.sting').forEach((n) => n.remove())
      const sting = document.createElement('div')
      sting.id = 'shot-sting'
      sting.className = 'sting'
      sting.innerHTML = `
        <div class="sting-art">
          <svg viewBox="0 0 620 120" width="620" height="120" class="sting-trace">
            <g fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
              <path class="t t-l" d="M0 60h72l26-26h60l26 26h46" />
              <path class="t t-r" d="M620 60h-72l-26 26h-60l-26-26h-46" />
            </g>
            <g class="vias" fill="currentColor">
              ${vias
                .map((x, i) => `<circle cx="${x}" cy="${i % 2 ? 86 : 34}" r="3" style="animation-delay:${180 + i * 52}ms" />`)
                .join('')}
            </g>
          </svg>
          <div class="sting-mark"><img src="/mark-dark-bg.png" height="54" alt="" /></div>
          <div class="sting-word"><img src="/logo-dark-bg.png" height="26" alt="" /></div>
        </div>`

      /*
       * Half the length it runs at in the editor. There it plays once when
       * somebody opens the tool; here it heads a loop that repeats for as
       * long as the page is open, and at full length it stops being an
       * opening and becomes an interruption.
       *
       * Held paused, so it begins on the first recorded frame rather than
       * partway through.
       */
      const fast = document.createElement('style')
      fast.id = 'sting-speed'
      fast.textContent = `
        .sting-trace .t { animation-duration: 440ms !important; }
        .sting-trace .vias circle { animation-duration: 320ms !important; }
        .sting-mark { animation-delay: 380ms !important; animation-duration: 360ms !important; }
        .sting-word { animation-delay: 560ms !important; animation-duration: 320ms !important; }
        .sting { transition-duration: 220ms !important; }`
      const hold = document.createElement('style')
      hold.id = 'sting-hold'
      hold.textContent = `
        .sting-trace .t, .sting-trace .vias circle, .sting-mark, .sting-word {
          animation-play-state: paused !important;
        }`
      document.head.appendChild(fast)
      document.head.appendChild(hold)
      document.body.appendChild(sting)
    }, [72, 158, 230, 390, 462, 548])
  },
  async perform(page) {
    await page.evaluate(async () => {
      const rig = window.__rig

      // Release the sting setup raised, let it run, then take it away.
      const hold = document.getElementById('sting-hold')
      const fast = document.getElementById('sting-speed')
      const sting = document.getElementById('shot-sting')
      hold.remove()
      await new Promise((r) => setTimeout(r, 1020))
      sting.setAttribute('data-gone', 'true')
      await new Promise((r) => setTimeout(r, 240))
      sting.remove()
      fast.remove()

      const show = (id, target) => {
        const s = window.draftrig.starters.find((x) => x.id === id)
        const doc = window.draftrig.doc.getState()
        if (s) doc.loadDoc(s.build())
        doc.select([])
        window.draftrig.engine.reset()
        window.draftrig.sim.getState().setRunning(true)
        const c = window.draftrig.camera.controls
        c.target.set(target[0], target[1], target[2])
        c.update()
      }

      /** Load, snap to the opening framing, then fly to the closing one. */
      const beat = async (id, target, from, to, ms = 2900) => {
        show(id, target)
        await rig.fly(from[0], from[1], from[2], 1)
        /*
         * Let the document land before moving the camera.
         *
         * Building a heavy one blocks the main thread while its geometry and
         * wire routing are made, and the fly's clock keeps running through
         * the stall — so the move was over before the first frame of it was
         * drawn. The eight-bit machine has two hundred and thirty-eight
         * wires and came out as four tenths of a second in a nine-second
         * clip; the others, being lighter, looked fine and hid it.
         */
        await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))
        await new Promise((r) => setTimeout(r, 450))
        await rig.fly(to[0], to[1], to[2], ms)
      }

      /*
       * Two machines and two circuits. The router and the rover were pulled
       * from here once, on the grounds that each is really a demonstration
       * of a motor and motion is not simulated. What they actually show is
       * layout — extrusion, rails, a deck, wheels on their axles — and
       * leaving them out made the clip argue that the editor only does
       * boards.
       *
       * The first beat runs five times as long as the others, and gets about
       * the same share of the clip for it. Frames are kept as they are drawn
       * rather than on a clock, so a scene's weight decides how many it
       * leaves behind: the eight-bit machine draws at roughly three a second
       * against fifteen for the rest, and at an equal number of seconds it
       * came out as half a second of a nine-second clip. Length here buys
       * frames, not screen time.
       */
      await beat('eight-bit', [0, 10, 0], [10, 32, 470], [44, 46, 365], 14000)
      await beat('cnc-router', [0, 160, 0], [8, 50, 1340], [40, 44, 1120], 9000)
      await beat('rover', [0, 26, 0], [-30, 60, 400], [16, 68, 320])
      await beat('esp-weather', [0, 8, 0], [-10, 36, 242], [30, 52, 180])
    })
  },
}

/**
 * The hero's background: one slow turn around a lit board, no cuts.
 *
 * It plays behind live text at low opacity, so it is built to be ignored.
 * A single continuous orbit, no cutting between builds and no brand
 * animation, because anything that changes sharply behind a headline pulls
 * the eye off the headline.
 *
 * The turn is a whole 360°, which is what lets the loop close on itself: the
 * last frame is the first frame from the other side, so the repeat has no
 * seam to notice.
 */
export const CLIP_BG = {
  ...base,
  id: 'clip-bg',
  rate: 4,
  simSpeed: 1,
  camera: [0, 52, 104],
  /*
   * Close enough that the board fills the frame.
   *
   * This plays faded behind a light page, and the bench is a near-black
   * mesh: with it in shot, fading the footage over white produces a flat
   * grey wash and no circuit anyone can make out. Framing it out is what
   * fixes that — at this distance the board is most of the picture, so what
   * comes through the fade is board and wires rather than bench.
   *
   * Repainting the bench instead does not work. The colour that reads as
   * the background is a ground mesh, not `scene.background`, so setting the
   * latter changes a value that nothing on screen is drawn from.
   */
  setup: stage('matrix', [0, 10, -20], 0, 52, 104),
  async perform(page) {
    await page.evaluate(async () => {
      const rig = window.__rig
      window.draftrig.engine.reset()
      window.draftrig.sim.getState().setRunning(true)

      await rig.drift(18, 20000)
    })
  },
}

export const CLIPS = [CLIP_ASSEMBLE, CLIP_RUN, CLIP_WIRE, CLIP_BUILDS, CLIP_BG]
