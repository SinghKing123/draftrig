/**
 * Builds assembling themselves, shot like a subject rather than a screen.
 *
 * `display.mjs` does this for one hand-laid LED matrix and it is the best
 * thing in the reel folder: parts fall the last centimetre into place while
 * the camera moves around them, and nothing about it reads as a screen
 * recording. This is that treatment for anything in the catalog of starters.
 *
 * Two things make it work, and the earlier assembly takes had neither.
 *
 * Parts are not handed over in prefixes. A prefix of a document is a document
 * with fewer parts in it, so each one appears already in place — it pops, and
 * a dozen pops in a row reads as a slideshow. Here the whole build is loaded
 * at the start and everything in it hidden; a part is revealed a short way
 * above where it belongs and eased down onto it. Only the few still falling
 * are touched on a given frame.
 *
 * And the camera moves. Three legs: low and close while the structure goes
 * up, up and back as it fills, then in over the finished thing. A parked
 * camera was the right answer for a loop playing behind a web page and the
 * wrong one for something a person is meant to watch.
 *
 * Portrait, because these are for feeds.
 *
 *   npm run dev
 *   BASE=http://localhost:5173 node tools/reel/run.mjs record cine-rover
 *   node tools/reel/cinematic-build.mjs
 */

export const CINEMA = `
window.__cinema = (() => {
  const D = window.draftrig.doc
  let full = null

  /**
   * Load the build and take it away again.
   *
   * Everything is hidden rather than absent, so the positions, the wiring and
   * the solver's view of the circuit are all settled before the first frame.
   * A display that is wired is a display that is lit, and it lights the
   * moment it is uncovered instead of a second after.
   */
  function stage(starterId) {
    const s = window.draftrig.starters.find((x) => x.id === starterId)
    if (!s) throw new Error('no starter ' + starterId)
    full = s.build()
    const instances = {}
    for (const id of full.order) instances[id] = { ...full.instances[id], hidden: true }
    D.getState().loadDoc({ ...full, instances, connections: {}, connectionOrder: [] })
    D.getState().select([])
    return { parts: full.order.length, wires: full.connectionOrder.length }
  }

  /*
   * Written straight into the store.
   *
   * loadDoc bumps the frame token the camera rig re-frames on, and a reveal
   * is a change to the document on nearly every frame — through loadDoc the
   * shot would be fighting a re-framing the whole way. This also keeps the
   * reveal out of the undo history.
   */
  function patch(fn) {
    const s = D.getState()
    const doc = {
      ...s.doc,
      instances: { ...s.doc.instances },
      connections: { ...s.doc.connections },
      connectionOrder: [...s.doc.connectionOrder],
    }
    fn(doc)
    D.setState({ doc })
  }

  const ease = (k) => 1 - Math.pow(1 - k, 3)

  /**
   * Play the assembly.
   *
   * Times are in finished seconds; slow is the capture rate the shot is
   * performed at. Parts are spread across the window rather than given a
   * fixed interval each, so a build of sixty takes as long as a build of
   * twelve and the pair can be cut together.
   *
   * Drops overlap. One part at a time, landing before the next appears, is
   * a metronome; two or three in the air at once is a pair of hands.
   */
  function play(opts) {
    const o = opts || {}
    const slow = o.slow || 1
    const rise = o.rise || 40
    const partWin = o.partWin || 6.4
    const wireWin = o.wireWin || 3.0
    const lead = 0.12

    const order = full.order
    const wires = full.connectionOrder
    const gap = partWin / Math.max(order.length, 1)
    const dur = Math.max(0.3, Math.min(0.9, gap * 3))

    const cue = order.map((id, i) => ({
      id,
      at: lead + i * gap,
      dur,
      to: full.instances[id].pos,
    }))

    /*
     * Wires either after the parts, or as soon as both ends exist.
     *
     * All of them at the end is the right shape for a bare board, where the
     * wiring is the subject and there is nothing in the way of it. It is the
     * wrong shape for anything with a lid: the loom appears after the case
     * has closed over it, which reads as the wires having been threaded
     * through a sealed box. Woven, each wire lands a moment after the later
     * of the two things it joins, so the harness grows with the build and is
     * finished before the walls go on.
     */
    const place = new Map(order.map((id, i) => [id, i]))
    const wireAt = []
    const wGap = wireWin / Math.max(wires.length, 1)
    for (let i = 0; i < wires.length; i++) {
      if (!o.weave) {
        wireAt.push(lead + partWin + 0.3 + i * wGap)
        continue
      }
      const c = full.connections[wires[i]]
      const later = Math.max(place.get(c.a.instanceId) ?? 0, place.get(c.b.instanceId) ?? 0)
      // Fanned a little, so eight wires onto one terminal are not one event.
      wireAt.push(lead + (later + 1) * gap + dur + (i % 6) * 0.05)
    }

    const total = o.weave
      ? lead + partWin + dur + (o.hold || 0.9)
      : lead + partWin + 0.3 + wireWin + (o.hold || 0.9)
    const t0 = performance.now()
    const landed = new Set()
    const strung = new Set()

    return new Promise((done) => {
      const step = () => {
        const now = (performance.now() - t0) / 1000 / slow
        const moving = []

        for (const q of cue) {
          if (now < q.at) continue
          const k = Math.min(1, (now - q.at) / q.dur)
          if (k >= 1) {
            if (landed.has(q.id)) continue
            landed.add(q.id)
            moving.push({ id: q.id, pos: q.to })
          } else {
            moving.push({ id: q.id, pos: [q.to[0], q.to[1] + rise * (1 - ease(k)), q.to[2]] })
          }
        }

        const fresh = []
        for (let i = 0; i < wireAt.length; i++) {
          if (now >= wireAt[i] && !strung.has(i)) {
            strung.add(i)
            fresh.push(i)
          }
        }

        if (moving.length || fresh.length) {
          patch((doc) => {
            for (const m of moving) {
              const inst = doc.instances[m.id]
              if (!inst) continue
              doc.instances[m.id] = { ...inst, pos: m.pos, hidden: false }
            }
            for (const i of fresh) {
              const id = wires[i]
              doc.connections[id] = full.connections[id]
              doc.connectionOrder.push(id)
            }
          })
        }

        if (now < total) requestAnimationFrame(step)
        else done()
      }
      requestAnimationFrame(step)
    })
  }

  return { stage, play }
})()
`

/** Everything except the bench. */
const BARE = `
  .app { grid-template-rows: 1fr !important; }
  .app-body { grid-template-columns: 1fr !important; }
  .panel, .console, .statusbar, .topbar, .bom-tab, .sketch-tab, .mbar,
  .vp-toolbar, .vp-hint, .vp-modes, .wire-colors, .vp-stats, .empty-hint,
  .inspector, .bom-panel, .sketch-panel, .nav-help, .acct { display: none !important; }
  .app-center { border: 0 !important; }
`

const base = {
  width: 1080,
  height: 1920,
  dsf: 1,
  url: '/app',
  style: BARE,
  view: { gizmo: false, ports: false },
  // Nothing to fit: the bench starts empty, and Fit arms the rig that would
  // reframe on every change the assembly makes.
  fit: false,
  /*
   * Performed at an eighth speed and multiplied back.
   *
   * The screencast manages about twenty frames a second at 1080x1920 with a
   * populated bench, which is not enough for a camera that is moving the
   * whole time. The simulation keeps its own rate so a lit display still
   * runs at the speed it really would.
   */
  rate: 8,
  simSpeed: 1,
}

/**
 * One take.
 *
 * `legs` is the camera: three [az, polar, dist, ms] moves, the first starting
 * from `camera`.
 *
 * Distances are arithmetic, and in portrait the axis that runs out first is
 * the width. Visible height is 2*d*tan(fov/2), which at 36 degrees is 0.65*d;
 * visible width is that times the aspect, and at 1080x1920 the aspect is
 * 0.5625, so the frame is only 0.366*d across. A build 360 mm on its
 * horizontal diagonal needs a full kilometre of distance to sit inside it,
 * and the first cut of these was shot at 430 — close enough to fill the
 * frame with two wires and a corner of the extrusion.
 *
 * So: horizontal diagonal over 0.366 is the distance that just contains the
 * build as it turns, and the legs are fractions of that — about 0.85 of it,
 * because a margin wide enough for every heading leaves the build small in a
 * frame this tall, and clipping a corner of the bench for a moment costs
 * nothing.
 *
 * Polar angles stay between about 50 and 75 — side-on, not down onto. A tall
 * frame wants a tall subject, and looking steeply down lays the build flat
 * across the middle of it with a third of the picture empty underneath.
 */
export const cineTake = (id, starter, target, camera, legs, opts = {}) => {
  const rate = opts.rate ?? base.rate
  const drift = opts.drift ?? [5, 1400]
  /*
   * How long the finished clip is.
   *
   * Taken from the legs rather than set, because it is the sum of them plus
   * the drift and nothing else — and a number typed separately from the moves
   * it is meant to describe is a number that goes stale the first time a leg
   * is retimed. The encoder reads it off the shot.
   */
  const secs = opts.secs ?? (legs.reduce((n, l) => n + l[3], 0) + drift[1]) / 1000
  return {
    ...base,
    rate,
    simDt: opts.simDt ?? base.simDt,
    id: `cine-${id}`,
    secs,
    camera,
    async setup(page) {
      await page.addScriptTag({ content: CINEMA })
      await page.evaluate(
        ([s, t, maxDist]) => {
          window.__cinema.stage(s)
          const c = window.draftrig.camera.controls
          /*
           * The orbit control clamps to 4 metres (`maxDistance` in
           * Viewport.tsx), which is the right limit for someone working and
           * the wrong one for photographing a room 4.6 metres across: the
           * first recording of `cine-room-setup` asked for 5600 and silently
           * got 4000, and every leg of it clamped to the same number, so the
           * camera orbited at one distance for the whole shot. Lifted here
           * for the capture only — nothing about the editor changes.
           */
          if (maxDist) c.maxDistance = maxDist
          c.target.set(t[0], t[1], t[2])
          c.update()
        },
        [starter, target, opts.maxDist ?? 0],
      )
    },
    async perform(page) {
      await page.evaluate(
        async ([legs, opts, rate, drift, target]) => {
          const rig = window.__rig
          /*
           * The target, again, and this time where nothing can overwrite it.
           *
           * Staging hides every part, and the rig frames what it can see — so
           * the framing that lands a moment after the document loads is a
           * framing of nothing, and it leaves the look-at point at the origin
           * however carefully setup aimed it. Everything then sits in the top
           * third of a portrait frame with the bench filling the rest, which
           * is exactly what a tall frame is supposed to avoid.
           */
          const c = window.draftrig.camera.controls
          c.target.set(target[0], target[1], target[2])
          c.object.lookAt(c.target)
          c.update()
          // Running from the first frame, so anything with a display on it is
          // lit by the time there is something to light.
          window.draftrig.engine.reset()
          window.draftrig.sim.getState().setRunning(true)
          await Promise.all([
            window.__cinema.play({ ...opts, slow: rate }),
            (async () => {
              /* A fifth number on a leg is where the look-at point should
                 have got to by the end of it, which is how the camera
                 cranes up a tall build instead of orbiting its middle. */
              for (const l of legs) {
                if (l.length > 4) await rig.crane(l[0], l[1], l[2], l[3], l[4])
                else await rig.fly(l[0], l[1], l[2], l[3])
              }
            })(),
          ])
          await rig.drift(drift[0], drift[1])
        },
        [legs, opts, rate, drift, target],
      )
    },
  }
}

const take = cineTake

export const CINE_SHOTS = [
  /*
   * A motor, a propeller and a load cell in an extrusion frame: the most
   * machine-like thing in the catalog that is still mostly electronics.
   * Starts low enough that the frame builds up past the lens.
   */
  take(
    'thrust-rig',
    'thrust-rig',
    [10, 130, 26],
    [34, 74, 715],
    [
      [70, 64, 820, 4600],
      [-26, 54, 1000, 4200],
      [14, 59, 780, 3200],
    ],
    { rise: 150, partWin: 6.2, wireWin: 3.0 },
  ),

  /*
   * Three decks of electronics on standoffs. The tallest thing here relative
   * to its footprint, which is why it was built: nearly everything else in
   * the catalog lies flat, and flat in a frame this tall is a band across
   * the middle with empty bench above and below it.
   */
  take(
    'control-stack',
    'control-stack',
    [0, 97, 0],
    [36, 74, 450],
    [
      [72, 64, 510, 4600],
      [-22, 54, 620, 4200],
      [16, 60, 480, 3200],
    ],
    { rise: 60, partWin: 6.4, wireWin: 3.0 },
  ),

  /*
   * Extrusion, rails, leadscrews and the steppers that drive them. The big
   * one, so the camera is a long way out and the parts fall a long way in.
   */
  take(
    'cnc-router',
    'cnc-router',
    [75, 170, -18],
    [24, 76, 1780],
    [
      [64, 70, 1980, 4600],
      [-30, 64, 2280, 4200],
      [10, 69, 1880, 3200],
    ],
    { rise: 320, partWin: 6.6, wireWin: 2.8 },
  ),

  /*
   * Everything a hand touches on one aluminium face: an LCD, a keypad,
   * switches, indicators. Wired behind, so the last leg comes round the front
   * where the panel reads as a panel.
   */
  take(
    'panel',
    'panel',
    [0, 120, -40],
    [-40, 70, 730],
    [
      [-76, 62, 840, 4600],
      [-14, 54, 1020, 4200],
      [-34, 58, 780, 3200],
    ],
    { rise: 160, partWin: 6.2, wireWin: 3.0 },
  ),

  /* ================================================================
     The room three
     ----------------------------------------------------------------
     Not electronics. These are for the ad that has to say the tool is
     for the space a build sits in as well as the build — a desk, the
     television on the other wall, the two sockets everything has to
     reach, and a frame bolted round a console.

     They are an order of magnitude bigger than anything above, so the
     distances are in metres rather than hundreds of millimetres and
     `rise` is scaled with them: a part that falls 150mm into a thrust
     rig has to fall most of a metre into a room or the drop does not
     read at this distance. Every framing here was chosen off a
     picture — see `aim.mjs` — because the arithmetic route does not
     work headless.
     ================================================================ */

  /*
   * A whole room: the walls, the floor, the desk against one of them,
   * the television on another, and the mains running back to two
   * sockets. The widest thing in the catalog by a long way.
   */
  /*
   * Shot from inside, and that is the whole trick.
   *
   * The first cut of this framed the room the way every other take here is
   * framed — stand well back and fit the subject — and at 5600mm, with legs
   * reaching 6600, the camera spent most of the take outside a room 4600 ×
   * 3400 × 2400. From out there a shell is an unlit box, so the clip opened
   * on two good seconds and then went to black for eleven.
   *
   * There is no distance that both fits a room and stays inside it. So this
   * does not fit it: the camera sits in the volume, about two and a half
   * metres off the desk, and shows a corner of the room the way a photograph
   * of a room does. Every leg is kept under 2600 for the same reason, which
   * is also why this one needs no `maxDist` — it never approaches the
   * editor's own 4000mm clamp.
   */
  take(
    'room-setup',
    'room-setup',
    [2000, 1000, 900],
    [40, 68, 2300],
    [
      [62, 70, 2500, 4600],
      [16, 64, 2600, 4200],
      [42, 68, 2200, 3200],
    ],
    { rise: 700, partWin: 6.4, wireWin: 3.2 },
  ),

  /*
   * One desk, and the question of whether one socket can carry what is
   * plugged into it. The extension lead and its cables land last, which
   * is the beat worth watching: the cable goes in and the reach of it
   * is suddenly a real measurement rather than a guess.
   */
  take(
    'desk-setup',
    'desk-setup',
    [0, 750, 0],
    [40, 60, 4000],
    [
      [70, 64, 4400, 4600],
      [6, 54, 4800, 4200],
      [40, 58, 3800, 3200],
    ],
    { rise: 500, partWin: 6.2, wireWin: 3.2 },
  ),

  /*
   * Forty-five parts and not one of them a circuit: extrusion, corner
   * brackets, T-nuts, button-head screws, a plywood shelf and a console
   * that is a scanned model at its real size. The frame assembles round
   * the console rather than the console landing in a finished frame,
   * which is the whole argument of the build.
   */
  take(
    'ps5-stand',
    'ps5-stand',
    [0, 380, 0],
    [55, 58, 1250],
    [
      [84, 64, 1380, 4600],
      [22, 54, 1500, 4200],
      [58, 58, 1180, 3200],
    ],
    { rise: 240, partWin: 6.6, wireWin: 2.6 },
  ),
]
