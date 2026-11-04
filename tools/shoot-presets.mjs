import { chromium } from 'playwright'
import { mkdirSync, writeFileSync } from 'node:fs'

/**
 * A card photograph of every preset, for the dashboard.
 *
 * The dashboard shows your own builds with a picture — the editor photographs
 * the bench every time you save — and the presets with nothing, because
 * nobody has ever saved them. A text card beside a picture card reads as the
 * poor relation, and the presets are the thing a new person should reach for
 * first.
 *
 * Shot once and shipped, rather than rendered in the browser on demand:
 * eleven builds through a 3D pipeline is several seconds of work and a
 * megabyte of parts catalog, on a page whose whole job is to get out of the
 * way. They are identical for everybody, so they are assets.
 *
 *   npm run dev
 *   BASE=http://localhost:5173 node tools/shoot-presets.mjs
 *   BASE=http://localhost:5173 node tools/shoot-presets.mjs cnc rover
 *
 * The camera goes through the harness handle rather than a synthesised drag:
 * a drag is eaten by the part picking handlers before the orbit controls see
 * it, silently. See tools/shoot-builds.mjs, which learnt that the hard way.
 */

const base = process.env.BASE ?? 'http://localhost:5173'
const only = process.argv.slice(2)

/**
 * preset id, fill, azimuth, polar.
 *
 * The third column multiplies the distance the Fit animation chose. Fit frames the whole
 * build with room to spare, which on a card leaves it a stamp in a field of
 * black, so every shot pulls in from there — 0.55 means a little over half the
 * fitted distance. A factor rather than a count of wheel notches because a
 * notch is a fixed fraction of the current distance and the fitted distance is
 * different for every build, so the same count framed a resistor and a CNC
 * router completely differently.
 *
 * The rover's factor is far below the rest because its scene is far bigger:
 * Fit settles 806 units out for the rover against 262 for the LED matrix, so
 * the same factor frames one and loses the other.
 *
 * Azimuth 0 is the camera on +z looking back along it. Polar is measured
 * down from straight up, so it runs the opposite way to the way it reads:
 * 20 puts the camera high and looking down, 70 puts it nearly level with the
 * bench. Past about 72 the lit floor runs out and a black band appears
 * across the top of the frame.
 *
 * No two of these are framed alike, and that is the point of the table.
 * Every shot used to sit between 24 and 52 of azimuth and 48 and 66 of
 * polar, which is one camera position with a wobble: thirteen photographs
 * that read as the same photograph of thirteen subjects. So the set is now
 * deliberately mixed —
 *
 *   20 to 30 polar   along the bench, so tall parts stand against the dark
 *   70 to 82 polar   flat on, for things whose face is the whole subject
 *   around 55        the three-quarter, for boards with depth to show
 *
 * and azimuth swings right round, so a board lit from the left in one frame
 * is lit from the right in the next.
 */
/* Builds with a display that has to be clocked up before it reads. */
const SETTLE = {
  'desk-terminal': 2600,
  'control-cabinet': 2600,
  'plant-watering': 2200,
  scoreboard: 2600,
  lcd: 2600,
  'bench-clock': 2600,
  oled: 2200,
  matrix: 1400,
}

const SHOTS = [
  ['arcade', 0.62, 198, 62],
  /* The devices. Both have a display on the front, so both are shot nearly
     level with it rather than down onto the case. */
  ['desk-setup', 0.66, 22, 70],
  ['shop-rack', 0.80, 36, 64],
  ['message-board', 0.74, 4, 72],
  ['desk-terminal', 0.56, 14, 68],
  ['control-cabinet', 0.60, 10, 66],
  // The projects: a machine with an output on the end of it.
  ['quadcopter', 0.58, 34, 58],
  ['control-stack', 0.60, 36, 58],
  ['plant-watering', 0.58, 28, 54],
  // The assemblies. Visible height is 0.65·d at this fov, so each distance
  // is read off the build rather than guessed at.
  ['pi-case', 0.34, 34, 46],
  ['workbench', 0.52, 26, 56],
  ['drawer-unit', 0.62, 206, 54],
  // The machine, from high enough that all four boards are in one frame.
  ['eight-bit', 0.58, 24, 38],
  // High, down onto the grid: thirty lit LEDs read as a grid from here.
  ['matrix', 0.62, 14, 26],
  // Low, so the panel faces the camera instead of foreshortening away.
  ['scoreboard', 0.58, 8, 66],
  // Along the breadboard, so the jumpers arch over the channel.
  ['logic-bench', 0.34, 74, 70],
  // Round the back, lit from the other side.
  ['esp-weather', 0.6, 212, 48],
  // Round the back, where the keypad and the bolt are both in shot.
  ['rfid-lock', 0.36, 168, 56],
  // Low and across, facing the cone.
  ['sound-bench', 0.36, 122, 68],
  // Close and almost level: one LED, one resistor, one supply.
  ['led', 0.3, 58, 58],
  ['blink555', 0.55, 286, 44],
  ['mcu', 0.25, 150, 66],
  // Square to the display, which is what the build is for.
  ['lcd', 0.46, 2, 62],
  ['oled', 0.46, 330, 48],
  ['bench-clock', 0.52, 44, 62],
  // A vertical face, so the camera comes down to meet it.
  ['panel', 0.46, 352, 62],

  /* The two planning templates, which are what the catalogue is pointed at
     now. Both want a low, wide angle: a room read from above is a plan, and
     a plan is the thing these are photographed to prove you do not have to
     imagine. */
  /*
   * The theatre is shot with two of its four walls taken away.
   *
   * A four-walled room photographed from outside is a photograph of a
   * wall, which is what the first three attempts were. The template keeps
   * its four walls, because that is the room; the photograph is a section
   * through it, which is how every plan drawing of a room has ever been
   * made.
   */
  ['home-theatre', { at: [1100, 1800, 2200], to: [2600, 1400, 6450] }, 0, 0, { 'room-shell': { walls: 'corner' } }],
  ['studio-desk', 0.52, 34, 70],

  /* The motor builds are not here because they cannot be: this tool loads a
     build by asking the running app for the starter, and they are not
     offered any more. Their angles are kept in git, not in this list. */
].filter((s) => only.length === 0 || only.includes(s[0]))

mkdirSync('public/presets', { recursive: true })

const b = await chromium.launch({ channel: 'msedge' })
/* 16:10, at the size a card shows it, times 1.5 for a retina screen. Bigger
   is wasted: these are 250 pixels wide in the grid. */
const page = await b.newPage({ viewport: { width: 860, height: 538 }, deviceScaleFactor: 2 })
const errors = []
const empty = []
page.on('pageerror', (e) => errors.push(e.message))

await page.goto(base + '/app', { waitUntil: 'domcontentloaded' })
await page.evaluate(() => {
  localStorage.setItem('tour.seen.v1', '1')
  localStorage.setItem('draftrig.nav.seen.v1', '1')
})
await page.reload({ waitUntil: 'domcontentloaded' })
await page.waitForTimeout(9000)

await page.evaluate(() => {
  const d = window.draftrig.doc.getState()
  // The frame-rate monitor would otherwise step quality down partway through
  // and half of these would come out without ambient occlusion.
  d.pinQuality('high')
  // The axis widget is drawn inside the canvas, so a stylesheet cannot reach
  // it, and every photograph came out with it in the corner.
  d.setView({ gizmo: false, grid: false, ports: false })
})

await page.addStyleTag({
  content: `
    .vp-toolbar, .vp-hint, .vp-stats, .vp-modes, .wire-colors, .bom-tab,
    .sketch-tab, .mbar, .vp-empty, .empty-hint { display: none !important; }
    /*
     * The workspace bar has to go, not just the topbar and the status bar.
     * The app is a four-row grid and this collapses it to one track; with
     * the workspace bar still in the flow that single 1fr track went to
     * the bar and the viewport dropped into an implicit auto row. The
     * canvas came out 859 x 150 and every preset was photographed as a
     * letterbox strip of a room, for months.
     */
    .ws, .ai-fab, .app-notice { display: none !important; }
    .app { grid-template-rows: 1fr !important; }
    .app-body { grid-template-columns: 1fr !important; }
    .app-body > .panel, .app-body > .bom-panel, .app-body > .sketch-panel { display: none !important; }
    .app-center { border: 0 !important; }
    .app-center > .console, .topbar, .statusbar { display: none !important; }
  `,
})

/* Hiding the panels widens the canvas, and the renderer only finds out on a
   resize. Without this the frames come out with a black band down the side
   where the old drawing buffer ended. */
await page.waitForTimeout(400)
const vp = page.viewportSize()
await page.setViewportSize({ width: vp.width - 1, height: vp.height })
await page.waitForTimeout(700)

for (const [id, fill, az, pol, set] of SHOTS) {
  const ok = await page.evaluate(({ starter, set }) => {
    const s = window.draftrig.starters.find((x) => x.id === starter)
    if (!s) return false
    const d = window.draftrig.doc.getState()
    d.loadDoc(s.build())
    if (set) {
      const cur = window.draftrig.doc.getState()
      for (const instId of cur.doc.order) {
        const over = set[cur.doc.instances[instId].defId]
        if (!over) continue
        for (const [k, v] of Object.entries(over)) cur.setParam(instId, k, v)
      }
    }
    window.draftrig.engine.reset()
    /* Switch it on. Without this the solver never runs and every display in
       the set photographs as a blank panel — which is what the character LCD
       builds did, lit but with nothing written on them. */
    window.draftrig.sim.getState().setRunning(true)
    d.select([])
    return true
  }, { starter: id, set: set ?? null })
  if (!ok) {
    console.log('no such preset:', id)
    continue
  }

  /* Fit first, then swing round. The other order does not work: the rig's fit
     animation writes the camera position over the following frames, so a
     camera placed before it is put straight back. */
  await page.evaluate(() => window.draftrig.doc.getState().requestFrame('all'))
  await page.waitForTimeout(1600)

  /* Clear the selection before touching the camera, not after.
     CameraRig re-frames on a selection change, so a clearSelection() after the
     camera has been placed throws the framing away and puts the camera back
     where Fit had it — which is exactly what happened, silently, and the
     photographs came out at the fitted distance every time. Measured: set to
     187, read back 374 at the shutter. */
  await page.mouse.move(2, 2)
  await page.evaluate(() => {
    const d = window.draftrig.doc.getState()
    d.clearSelection()
    d.setHovered(null)
  })
  await page.waitForTimeout(700)

  /*
   * Either swing to an angle and pull in from the fitted distance, or —
   * for a room — place the camera outright.
   *
   * The orbit rig cannot photograph an interior. It puts the camera on a
   * sphere around the document's centre, and in a 4.8 x 6.6 m room every
   * radius short enough to be inside the room is short enough to be
   * inside a wall. Worse, from the back of the room the screen is behind
   * the seating and the riser, so the one lit surface in a cinema is
   * occluded and the photograph is of a dark box. A room is shot from a
   * position, looking at a thing.
   */
  if (typeof fill === 'object') {
    await page.evaluate(({ at, to }) => {
      const c = window.draftrig.camera.controls
      c.target.set(to[0], to[1], to[2])
      c.object.position.set(at[0], at[1], at[2])
      c.object.lookAt(c.target)
      c.update()
    }, fill)
  } else {
    await page.evaluate(([a, p, f]) => {
      window.draftrig.camera.view(a, p)
      const c = window.draftrig.camera.controls
      const v = c.object.position.clone().sub(c.target).multiplyScalar(f)
      c.object.position.copy(c.target).add(v)
      c.object.lookAt(c.target)
      c.update()
    }, [az, pol, fill])
  }

  /*
   * How long to let it run before the shutter, per build.
   *
   * Not one number for all of them. A character LCD has to be clocked through
   * its four-bit init before the first letter appears, and at 700 ms the
   * scoreboard photographed as a blank yellow panel — but the rover drives,
   * and giving it the same 2.6 s left it a stamp in the far corner of the
   * frame. Displays wait; anything that moves gets the shutter early.
   */
  await page.waitForTimeout(SETTLE[id] ?? 700)

  /*
   * A generous shutter timeout. The default eighteen seconds is plenty for a
   * breadboard with a dozen parts on it, and not enough for the eight-bit
   * machine: eighty-three parts and two hundred and thirty-eight wires draw
   * at about a frame a second, and the stability check ran out before the
   * page could answer it.
   */
  /*
   * Read the drawing buffer, rather than screenshotting the element.
   * Playwright composites the page, and for a live WebGL canvas what it
   * composites can be a frame or more stale — thirty identical frames
   * came back from a scene that was visibly moving. `toDataURL` asks the
   * context, which is only legal because the renderer is created with
   * preserveDrawingBuffer.
   */
  const shot = await page.evaluate(() => document.querySelector('canvas').toDataURL('image/jpeg', 0.9))
  writeFileSync(`public/presets/${id}.jpg`, Buffer.from(shot.split(',')[1], 'base64'))

  /* How much of the frame is the build, rather than the bench behind it.
     Measured against the background colour, not against black: the first
     version of this counted bright pixels, which reads a dark blue board
     filling the whole frame as an empty one — it flagged the Uno shot as
     empty while the camera was in fact inside the board. The bench is a
     flat colour, so anything that is not that colour is the subject. */
  const lit = await page.evaluate(() => {
    const c = document.querySelector('canvas')
    const s = document.createElement('canvas')
    s.width = 96
    s.height = 60
    const x = s.getContext('2d')
    x.drawImage(c, 0, 0, 96, 60)
    const d = x.getImageData(0, 0, 96, 60).data
    const at = (i) => [d[i * 4], d[i * 4 + 1], d[i * 4 + 2]]
    // The top two corners are bench in every sane framing.
    const [ar, ag, ab] = at(0)
    const [br, bg, bb] = at(95)
    const bg0 = [(ar + br) / 2, (ag + bg) / 2, (ab + bb) / 2]
    let subject = 0
    for (let i = 0; i < 96 * 60; i++) {
      const [r, g, b] = at(i)
      const dist = Math.abs(r - bg0[0]) + Math.abs(g - bg0[1]) + Math.abs(b - bg0[2])
      if (dist > 26) subject++
    }
    return (100 * subject) / (96 * 60)
  })

  console.log(
    'wrote public/presets/' + id + '.jpg',
    `${lit.toFixed(0)}%`.padStart(4),
    lit < 1.5 ? ' EMPTY FRAME' : lit < 12 ? ' loose' : lit > 42 ? ' tight' : '',
  )
}

console.log('errors:', errors.length ? errors.slice(0, 4) : 'none')
if (empty.length) {
  console.log('EMPTY:', empty.join(' '), '— check the angle, the camera is seeing nothing')
  process.exitCode = 1
}
await b.close()
