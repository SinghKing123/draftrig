/**
 * An LED display, assembling itself.
 *
 * One shot, no interface in it at all: a perfboard, a microcontroller and
 * thirty LEDs arriving in order and wiring themselves together while the
 * camera moves around them. Not a screen recording of somebody working — the
 * editor is doing the building, and the camera is treating it as a subject.
 *
 * The build is real. Every part is a catalog part at its real size, the LEDs
 * are 5 mm through-hole on a 2.54 mm grid, and the wiring is the wiring a
 * matrix like this actually needs: each row's anodes chained together and
 * taken through a resistor to a pin the chase sketch drives, each row's
 * cathodes chained and returned to ground. It is laid out by the script below
 * rather than by hand because sixty-five wires is not something to place with
 * a mouse.
 */

/** Perfboard pitch, and everything on the board is a multiple of it. */
const P = 2.54

export const BUILD = `
window.__display = (() => {
  const D = window.draftrig.doc
  const P = ${P}
  /* Six by five, three holes apart each way. Five rows because the chase
     sketch drives D2 to D7; three holes because a 5 mm LED is 5.8 mm across
     its flange, so two holes apart they interpenetrate. */
  const COLS = 6
  const ROWS = 5
  const DX = P * 3
  const DZ = P * 3
  /* Parts sit at the same deck height the hand-built starters use, so the
     leads poke through the board rather than floating on it. */
  const DECK = 1.75
  const RED = '#E34B4B'
  const BLACK = '#111418'
  const BLUE = '#2F6FE0'

  let plan = null

  function make() {
    const parts = []
    const wires = []
    const add = (defId, pos, params, rot) => {
      const id = 'i' + parts.length.toString(36) + 'x'
      parts.push({ id, defId, pos, rot: rot ?? [0, 0, 0], params: params ?? {} })
      return id
    }
    const join = (a, ap, b, bp, color) =>
      wires.push({ a: { instanceId: a, portId: ap }, b: { instanceId: b, portId: bp }, color })

    const board = add('perfboard', [0, 0, 0], { cols: 24, rows: 18, mask: 'fr4-blue', layout: 'pads' })
    /*
     * The controller sits behind the display, not beside it.
     *
     * An Uno is as big as the board, so side by side the pair is 150 mm wide
     * and a 9:16 frame has to back off until neither reads. Stacked front to
     * back the composition is tall, which is the shape of the picture. Turned
     * around so the digital header faces the board, or every wire has to go
     * the long way round the outside.
     */
    const mcu = add(
      'mcu-board',
      [0, 0, -64],
      { program: 'chase', interval: 0.05, mask: 'fr4-blue' },
      [0, 180, 0],
    )

    const led = []
    const x0 = -((COLS - 1) / 2) * DX
    const z0 = -((ROWS - 1) / 2) * DZ
    for (let r = 0; r < ROWS; r++) {
      led[r] = []
      for (let c = 0; c < COLS; c++) {
        /* Turned a quarter so the leads run across the strips rather than
           along one: an LED dropped in unturned puts both of its legs in the
           same row of holes. */
        led[r][c] = add(
          'led-5mm',
          [x0 + c * DX, DECK, z0 + r * DZ],
          { color: 'red', diffused: true },
          [0, 90, 0],
        )
      }
    }

    // One resistor per row, in line with its row, inboard of the edge — a
    // 10.16 mm lead pitch needs 5 mm of board either side of where it sits.
    const res = []
    for (let r = 0; r < ROWS; r++) {
      res[r] = add('resistor-axial', [26, DECK, z0 + r * DZ], { value: 150, watt: '0.25' })
    }

    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS - 1; c++) {
        join(led[r][c], 'a', led[r][c + 1], 'a', RED)
        join(led[r][c], 'c', led[r][c + 1], 'c', BLACK)
      }
      join(led[r][COLS - 1], 'a', res[r], '1', RED)
      join(res[r], '2', mcu, 'd' + (r + 2), BLUE)
      join(led[r][0], 'c', mcu, 'gnd', BLACK)
    }

    plan = { parts, wires, board, mcu, led, res }
    return plan
  }

  /** Load the finished document with every part hidden and nothing wired. */
  function stage() {
    const p = make()
    const instances = {}
    const order = []
    for (const part of p.parts) {
      instances[part.id] = {
        id: part.id,
        defId: part.defId,
        name: part.defId,
        params: part.params,
        pos: [...part.pos],
        rot: [...part.rot],
        hidden: true,
      }
      order.push(part.id)
    }
    D.getState().loadDoc({
      name: 'LED display',
      instances,
      order,
      connections: {},
      connectionOrder: [],
    })
    D.getState().select([])
    return p
  }

  /**
   * Write straight to the store rather than through the editing actions.
   *
   * addPart selects what it adds, and a selection change is something the
   * camera rig reacts to; thirty parts arriving would have been thirty
   * re-framings fighting the shot. This also keeps the whole reveal out of the
   * undo history, which nobody is going to want to step back through.
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
   * Parts do not pop into place, they fall the last centimetre: each one is
   * revealed a short way above where it belongs and eased down. Only the few
   * still falling are touched on any given frame, so the cost per frame stays
   * flat however many parts have already landed.
   */
  function play(slow) {
    slow = slow || 1
    const p = plan || stage()
    const cue = []
    let t = 0

    const drop = (id, at, dur) => cue.push({ id, at, dur, to: [...p.parts.find((q) => q.id === id).pos] })

    drop(p.board, (t = 0.15), 0.55)
    drop(p.mcu, 0.45, 0.55)

    // The grid fills row by row, which reads as somebody populating a board.
    t = 1.15
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        drop(p.led[r][c], t, 0.42)
        t += 0.16
      }
      t += 0.1
    }

    t += 0.15
    for (let r = 0; r < ROWS; r++) {
      drop(p.res[r], t, 0.42)
      t += 0.16
    }

    // Wires arrive quickly and in order, so the harness looks drawn rather
    // than dumped: a row's anodes, then its cathodes, then its return.
    const wireAt = []
    t += 0.4
    for (let i = 0; i < p.wires.length; i++) {
      wireAt.push(t)
      t += 0.035
    }
    const total = t + 0.5

    const t0 = performance.now()
    const landed = new Set()
    const strung = new Set()

    return new Promise((done) => {
      const step = () => {
        const now = (performance.now() - t0) / 1000 / slow
        const moving = []
        let shown = 0

        for (const q of cue) {
          if (now < q.at) continue
          const k = Math.min(1, (now - q.at) / q.dur)
          if (k >= 1) {
            if (landed.has(q.id)) continue
            landed.add(q.id)
            moving.push({ id: q.id, pos: q.to, show: true })
          } else {
            shown++
            moving.push({
              id: q.id,
              pos: [q.to[0], q.to[1] + 16 * (1 - ease(k)), q.to[2]],
              show: true,
            })
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
              const w = p.wires[i]
              const id = 'w' + i.toString(36)
              doc.connections[id] = { id, kind: 'wire', a: w.a, b: w.b, color: w.color, gauge: 0.2 }
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

  return { stage, play, plan: () => plan }
})()
`

const BARE = `
  .app { grid-template-rows: 1fr !important; }
  .app-body { grid-template-columns: 1fr !important; }
  .panel, .console, .statusbar, .topbar, .ai-fab, .bom-tab,
  .vp-toolbar, .vp-hint, .vp-modes, .wire-colors, .vp-stats, .empty-hint { display: none !important; }
  .app-center { border: 0 !important; }
`

export const DISPLAY_SHOT = {
  id: 'display-build',
  width: 1080,
  height: 1920,
  dsf: 1,
  /*
   * Eight, not four. There is a great deal on screen by the end — thirty
   * lit-able LEDs, a populated Uno and sixty-five wires — and the capture
   * falls to about four frames a second under it. Performing at an eighth
   * speed brings that back above thirty.
   */
  rate: 8,
  /*
   * The circuit runs at its own speed, not at an eighth of it.
   *
   * The display lights the moment it is wired — the solver settles an
   * operating point without being asked to run — but the chase only steps
   * while the simulation is advancing, and it advances slowly. Dividing its
   * speed by the capture rate as every other shot does would leave the
   * pattern frozen on one row for the whole take.
   */
  simSpeed: 1,
  url: '/app',
  style: BARE,
  view: { gizmo: false },
  // Nothing to fit: the bench is empty when this starts, and pressing Fit
  // would arm the rig that re-frames on every change the assembly makes.
  fit: false,
  camera: [26, 70, 120],
  async setup(page) {
    await page.addScriptTag({ content: BUILD })
    await page.evaluate(() => {
      window.__display.stage()
      /* Aim between the board and the controller rather than at the world
         origin: the pair sits well behind it, and every camera move here is
         relative to wherever the target happens to be. */
      const c = window.draftrig.camera.controls
      c.target.set(0, 6, -20)
      c.update()
    })
  },
  async perform(page) {
    await page.evaluate(async (slow) => {
      const rig = window.__rig
      // Running from the first frame, so the pattern is stepping by the time
      // there is a display to step across.
      window.draftrig.engine.reset()
      window.draftrig.sim.getState().setRunning(true)
      await Promise.all([
        window.__display.play(slow),
        (async () => {
          // Low and close while the board and the first rows arrive, then up
          // and back as the grid fills, then in over the finished matrix.
          await rig.fly(64, 58, 150, 6200)
          await rig.fly(-26, 42, 112, 4200)
          /* Down onto the matrix rather than across it: at a low angle the
             run of ground wire between the board and the controller passes
             within a few millimetres of the lens and blacks out a third of
             the frame. */
          await rig.fly(18, 27, 98, 3600)
        })(),
      ])
      await rig.drift(7, 2600)
    }, 8)
  },
}

export const DISPLAY_REEL = {
  id: 'reel4-led-display',
  shots: [DISPLAY_SHOT],
}
