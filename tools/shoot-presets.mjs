import { chromium } from 'playwright'
import { mkdirSync } from 'node:fs'

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
  scoreboard: 2600,
  lcd: 2600,
  'bench-clock': 2600,
  oled: 2200,
  matrix: 1400,
}

const SHOTS = [
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

for (const [id, fill, az, pol] of SHOTS) {
  const ok = await page.evaluate((starter) => {
    const s = window.draftrig.starters.find((x) => x.id === starter)
    if (!s) return false
    const d = window.draftrig.doc.getState()
    d.loadDoc(s.build())
    window.draftrig.engine.reset()
    /* Switch it on. Without this the solver never runs and every display in
       the set photographs as a blank panel — which is what the character LCD
       builds did, lit but with nothing written on them. */
    window.draftrig.sim.getState().setRunning(true)
    d.select([])
    return true
  }, id)
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

  // Swing to the angle, then pull in from whatever distance Fit settled on.
  await page.evaluate(([a, p, f]) => {
    window.draftrig.camera.view(a, p)
    const c = window.draftrig.camera.controls
    const v = c.object.position.clone().sub(c.target).multiplyScalar(f)
    c.object.position.copy(c.target).add(v)
    c.object.lookAt(c.target)
    c.update()
  }, [az, pol, fill])

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
  await page.locator('canvas').first().screenshot({
    path: `public/presets/${id}.jpg`, type: 'jpeg', quality: 90, timeout: 90_000,
  })

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
