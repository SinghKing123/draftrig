/**
 * A scoreboard, building itself.
 *
 * An Uno, a 16x2 character module and a contrast pot arriving on a perfboard
 * and wiring themselves up, then the panel coming on and running through a
 * round of Nations League results. One continuous take, no interface in it.
 *
 * Two things in here are simulated rather than drawn, and both are the reason
 * the shot is worth taking:
 *
 * The text arrives over the bus. The module is an HD44780 and the sketch talks
 * to it in four-bit mode on the wiring the LiquidCrystal example uses — RS on
 * D12, E on D11, DB4..DB7 on D5..D2. Changing the two lines of text really
 * does clock sixty-odd nibbles across those six pins, which is why the screen
 * settles rather than cuts.
 *
 * And the contrast is the pot. V0 comes off the wiper of a 10k across the 5 V
 * rail, the module reads that pin, and the panel is blank until the pot is
 * turned down to where a real one has to be turned. That is the reveal in the
 * middle of the shot: nothing fades it in, the resistance changes.
 */

/** Perfboard pitch. */
const P = 2.54

/**
 * Where the wiper starts and where it ends, in percent of travel.
 *
 * The module works out contrast as (1.15 - V0) / 1.15, so anything above about
 * 1.15 V is a blank screen. A linear pot across 5 V puts the wiper at 5 * pos,
 * so 55% is 2.75 V — properly blank, the way an unadjusted module is — and 8%
 * is 0.4 V, which lands at about two thirds contrast.
 */
const POT_BLANK = 55
const POT_SET = 8

/**
 * A matchday. Sixteen columns, so three-letter codes and spaces around the
 * dash; anything longer is silently cut by the panel, not wrapped.
 */
const SCREENS = [
  ['NATIONS LEAGUE', 'Matchday 4'],
  ['LEAGUE A GRP 4', 'ESP 2 - 1 NED'],
  ['LEAGUE A GRP 4', 'SUI 0 - 3 SRB'],
  ['LEAGUE A GRP 2', 'FRA 1 - 1 ITA'],
  ['LEAGUE A GRP 1', 'GER 2 - 0 BIH'],
  ['LEAGUE A GRP 1', 'NED 4 - 0 HUN'],
  ['NATIONS LEAGUE', 'FINALS  JUN 26'],
]

export const BUILD = `
window.__score = (() => {
  const D = window.draftrig.doc
  const DECK = 1.75
  const RED = '#E34B4B'
  const BLACK = '#111418'
  const GREEN = '#3DBE6B'
  const BLUE = '#2F6FE0'
  const AMBER = '#E8A33D'
  const SCREENS = ${JSON.stringify(SCREENS)}
  const POT_BLANK = ${POT_BLANK}
  const POT_SET = ${POT_SET}

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

    /* Wide enough to take an 80 mm module and the pot beside it. */
    const board = add('perfboard', [0, 0, 0], { cols: 40, rows: 26, mask: 'fr4-blue', layout: 'pads' })

    /* The panel at the front of the frame, the controller behind it and turned
       to face it, exactly as in the LED reel and for the same reason: a 9:16
       frame has depth to spend and no width. */
    const lcd = add('display-lcd-character', [-6, DECK, 8], {
      format: '1602',
      mask: 'fr4-blue',
      // The pot is wired to V0 and has to actually do something.
      contrastSource: 'pin',
    })
    /* Beside pins 1 to 3, not across the glass.
       The header is at the back-left of the module, so a pot on the right
       has to run its three wires over the face of the panel to reach it —
       which is exactly what it looks like, and what somebody building this
       would never do. Short leads to the pins they belong to. */
    const pot = add('potentiometer', [-56, DECK, -6], {
      value: 10000, taper: 'lin', pos: POT_BLANK, knob: true,
    })
    const mcu = add('mcu-board', [0, 0, -56], {
      program: 'lcd-text',
      text1: SCREENS[0][0],
      text2: SCREENS[0][1],
      mask: 'fr4-blue',
    }, [0, 180, 0])

    // Power and the backlight.
    join(mcu, 'v5', lcd, 'vdd', RED)
    join(mcu, 'gnd', lcd, 'vss', BLACK)
    join(mcu, 'v5', lcd, 'a', RED)
    join(mcu, 'gnd2', lcd, 'k', BLACK)
    // R/W to ground: this module is only ever written to.
    join(mcu, 'gnd3', lcd, 'rw', BLACK)

    // The contrast divider, taken off the module's own supply pins.
    join(lcd, 'vdd', pot, 'b', RED)
    join(lcd, 'vss', pot, 'a', BLACK)
    join(pot, 'w', lcd, 'v0', AMBER)

    // The four-bit bus.
    join(mcu, 'd12', lcd, 'rs', GREEN)
    join(mcu, 'd11', lcd, 'e', GREEN)
    join(mcu, 'd5', lcd, 'd4', BLUE)
    join(mcu, 'd4', lcd, 'd5', BLUE)
    join(mcu, 'd3', lcd, 'd6', BLUE)
    join(mcu, 'd2', lcd, 'd7', BLUE)

    plan = { parts, wires, board, lcd, pot, mcu }
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
      name: 'Nations League scoreboard',
      instances, order, connections: {}, connectionOrder: [],
    })
    D.getState().select([])
    return p
  }

  /* Straight to the store, not through the editing actions: addPart selects
     what it adds and the camera rig re-frames on a selection change. */
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

  /* The editor's own action, not a hand-rolled patch.
     It is what the inspector calls, so it goes through the recompile that a
     baked-in value like a pot's resistance needs, and through the state drop
     that keeps the panel's bus in step with its driver across that recompile.
     A patch written here would skip both. */
  const setParam = (id, key, value) => D.getState().setParam(id, key, value, true)

  const ease = (k) => 1 - Math.pow(1 - k, 3)
  const wait = (ms) => new Promise((r) => setTimeout(r, ms))

  /** Turn the pot, in real steps, so the panel comes up as it is turned. */
  async function adjust(slow, ms) {
    const p = plan
    const t0 = performance.now()
    for (;;) {
      const k = Math.min(1, (performance.now() - t0) / (ms * slow))
      setParam(p.pot, 'pos', Math.round(POT_BLANK + (POT_SET - POT_BLANK) * ease(k)))
      if (k >= 1) return
      await wait(40)
    }
  }

  /** Run the results, one screen at a time. */
  async function results(slow, each) {
    const p = plan
    for (let i = 1; i < SCREENS.length; i++) {
      await wait(each * slow)
      setParam(p.mcu, 'text1', SCREENS[i][0])
      setParam(p.mcu, 'text2', SCREENS[i][1])
    }
  }

  /**
   * Play the assembly. Parts are revealed a centimetre above where they belong
   * and eased down, so they land rather than appear.
   */
  function play(slow) {
    slow = slow || 1
    const p = plan || stage()
    const cue = []
    const drop = (id, at, dur) =>
      cue.push({ id, at, dur, to: [...p.parts.find((q) => q.id === id).pos] })

    drop(p.board, 0.15, 0.6)
    drop(p.mcu, 0.55, 0.6)
    drop(p.lcd, 1.05, 0.6)
    drop(p.pot, 1.55, 0.5)

    // Power first, then the contrast divider, then the bus: the order somebody
    // wiring this up would actually go in.
    const wireAt = []
    let t = 2.2
    for (let i = 0; i < p.wires.length; i++) {
      wireAt.push(t)
      t += 0.16
    }
    const total = t + 0.4

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
            moving.push({ id: q.id, pos: q.to, show: true })
          } else {
            moving.push({ id: q.id, pos: [q.to[0], q.to[1] + 14 * (1 - ease(k)), q.to[2]], show: true })
          }
        }
        const fresh = []
        for (let i = 0; i < wireAt.length; i++) {
          if (now >= wireAt[i] && !strung.has(i)) { strung.add(i); fresh.push(i) }
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

  return { stage, play, adjust, results, plan: () => plan }
})()
`

const BARE = `
  .app { grid-template-rows: 1fr !important; }
  .app-body { grid-template-columns: 1fr !important; }
  .panel, .console, .statusbar, .topbar, .ai-fab, .bom-tab,
  .vp-toolbar, .vp-hint, .vp-modes, .wire-colors, .vp-stats, .empty-hint { display: none !important; }
  .app-center { border: 0 !important; }
`

export const SCOREBOARD_SHOT = {
  id: 'scoreboard-build',
  width: 1080,
  height: 1920,
  dsf: 1,
  /*
   * Six. Lighter on screen than the LED matrix — one panel, one board, fourteen
   * wires — but the character module redraws through a framebuffer every time
   * the text changes, and at a lower rate the capture drops below thirty while
   * a screen is being clocked out.
   */
  rate: 6,
  /*
   * The circuit runs at its own speed.
   *
   * The bus is the point of the shot and it is slow in simulated time: a full
   * sixteen-character line is sixty-odd nibbles, each of them three solver
   * phases. Dividing sim speed by the capture rate would leave the panel
   * halfway through its first word when the take ended.
   */
  simSpeed: 1,
  url: '/app',
  style: BARE,
  view: { gizmo: false },
  fit: false,
  camera: [30, 68, 150],
  async setup(page) {
    await page.addScriptTag({ content: BUILD })
    await page.evaluate(() => {
      window.__score.stage()
      // Between the panel and the controller, not the world origin: every
      // camera move is relative to wherever the target is.
      const c = window.draftrig.camera.controls
      c.target.set(0, 8, -18)
      c.update()
    })
  },
  async perform(page) {
    await page.evaluate(async (slow) => {
      const rig = window.__rig
      window.draftrig.engine.reset()
      window.draftrig.sim.getState().setRunning(true)

      // Assembly, with the camera coming round from low and wide.
      await Promise.all([
        window.__score.play(slow),
        (async () => {
          await rig.fly(66, 62, 168, 5200)
          await rig.fly(-18, 46, 128, 4200)
        })(),
      ])

      // The panel is lit and blank. Move in on it, then turn the pot.
      await Promise.all([
        rig.fly(8, 34, 92, 3200),
        (async () => {
          await new Promise((r) => setTimeout(r, 900 * slow))
          await window.__score.adjust(slow, 1500)
        })(),
      ])

      // The results, with the camera barely moving: the screen is the subject
      // now and a moving camera makes text harder to read, not easier.
      await Promise.all([
        window.__score.results(slow, 1150),
        rig.drift(4, 8200 * slow),
      ])
    }, 6)
  },
}

export const SCOREBOARD_REEL = {
  id: 'reel5-nations-league',
  shots: [SCOREBOARD_SHOT],
}
