import { chromium } from 'playwright'
import { mkdirSync } from 'node:fs'

/**
 * The photographs the front page is built on.
 *
 * `shoot-presets.mjs` takes a card picture of every build: small, square-on,
 * the whole thing in frame with room around it, because a 250px card has to
 * be legible at a glance. Those are catalogue photographs and they are right
 * for a catalogue.
 *
 * They are wrong for a page. Shown at 1200px a fitted shot is a small object
 * in a large dark field, and a page of them reads as a contact sheet. This
 * tool takes the other kind: close, off-axis, lit from the side, the subject
 * running out of the frame where it should. Two changes do most of that work
 * — the fill factor comes down from the fitted distance, and the camera comes
 * down to near the height of the thing it is looking at, which is the
 * difference between a photograph of an object and a photograph from inside
 * the scene.
 *
 *   npm run dev
 *   BASE=http://localhost:5173 node tools/shoot-cine.mjs
 *   BASE=http://localhost:5173 node tools/shoot-cine.mjs arcade room
 *
 * Three of the frames keep the editor's own chrome, because a page that only
 * ever shows the render never shows the product. Which is which is the
 * `chrome` field, not a separate tool.
 */

const base = process.env.BASE ?? 'http://localhost:5173'
const only = process.argv.slice(2)

/**
 * az    azimuth, degrees. 0 puts the camera on +z looking back along it.
 * pol   polar, degrees down from straight up. 90 is level with the bench;
 *       the ground plane is opaque and front-facing, so past about 86 the
 *       camera is under it and the floor is culled.
 * fill  multiplier on the distance Fit chose. 1 is the fitted frame; 0.4
 *       crops hard. Below about 0.5 on a tall build the camera ends up
 *       inside it.
 * lift  raises the camera target as a fraction of the visible frame, so a
 *       tall build is framed on its top half rather than its middle. This is
 *       the off-centre composition: Fit always centres, and a perfectly
 *       centred subject is the look of a product photo taken by a robot.
 * dolly slides the target sideways, as a fraction of the frame width.
 */
const SHOTS = [
  /* ---- the showcase frames, clean render ---- */
  {
    id: 'arcade',
    name: 'cine-arcade',
    build: 'arcade',
    az: 212, pol: 76, fill: 0.62, lift: 0.08, dolly: 0.06,
    note: 'Low and round the side, so the cabinet stands over the camera.',
  },
  {
    id: 'room',
    name: 'cine-room',
    build: 'room-setup',
    az: 34, pol: 79, fill: 0.52, lift: 0.18, dolly: 0.06,
    wide: true,
    note: 'Near standing height inside the room, looking across the desk.',
  },
  {
    id: 'stand',
    name: 'cine-stand',
    build: 'ps5-stand',
    az: 158, pol: 70, fill: 0.78, lift: 0.1, dolly: -0.04,
    /* It was shot at 0.46, which put the camera between two rails and filled
       the frame with the console. Dramatic, and useless: the section it
       illustrates is about the frame and the gap either side of the console,
       and neither of them was in the picture. */
    note: 'The whole frame, with the console standing in it.',
  },
  {
    id: 'board',
    name: 'cine-board',
    build: 'message-board',
    az: 352, pol: 82, fill: 0.72, lift: 0.22, dolly: 0.1,
    wide: true,
    settle: 2800,
    note: 'Almost square to the face, from below the sign.',
  },
  {
    id: 'eightbit',
    name: 'cine-eightbit',
    build: 'eight-bit',
    az: 28, pol: 54, fill: 0.66, lift: 0, dolly: 0.08,
    settle: 1800,
    note: 'Down onto the four boards, close enough to read the wiring.',
  },
  {
    id: 'cabinet',
    name: 'cine-cabinet',
    build: 'control-cabinet',
    az: 6, pol: 74, fill: 0.64, lift: 0.1, dolly: -0.06,
    settle: 2600,
    note: 'Through the door at the rail.',
  },
  {
    id: 'quad',
    name: 'cine-quad',
    build: 'quadcopter',
    az: 44, pol: 80, fill: 0.52, lift: 0.08, dolly: 0.1,
    note: 'Level with the arms, so the props read as a plane.',
  },
  {
    id: 'rack',
    name: 'cine-rack',
    build: 'shop-rack',
    az: 226, pol: 74, fill: 0.72, lift: 0.12, dolly: -0.1,
    note: 'From the open corner, the posts running out of frame.',
  },
  {
    id: 'clock',
    name: 'cine-clock',
    build: 'bench-clock',
    az: 48, pol: 70, fill: 0.44, lift: 0.04, dolly: 0.06,
    settle: 2800,
    note: 'Macro on the perfboard, the lit digits off centre.',
  },
  {
    id: 'bench',
    name: 'cine-bench',
    build: 'logic-bench',
    az: 78, pol: 81, fill: 0.44, lift: 0.06, dolly: -0.1,
    note: 'Along the breadboard channel at jumper height.',
  },

  /* ---- the frames that keep the editor around them ---- */
  {
    id: 'ui-room',
    name: 'cine-ui-room',
    build: 'room-setup',
    az: 30, pol: 72, fill: 0.78, lift: 0.14, dolly: 0,
    chrome: 'plain',
    note: 'The whole editor, with a room in it.',
  },
  {
    /*
     * Not the sketch panel, though it was meant to be.
     *
     * That panel's tab only exists while exactly one controller is selected,
     * and pressing it signed out raises the sign-in wall rather than the
     * panel. A photograph of a sign-in wall is not a photograph of the
     * product. So this frame is the library, the inspector and a wired board
     * instead, which is what the editor looks like for most of the time
     * anybody spends in it.
     */
    id: 'ui-wire',
    name: 'cine-ui-wire',
    build: 'mcu',
    az: 150, pol: 66, fill: 0.62, lift: 0.04, dolly: 0,
    chrome: 'plain',
    note: 'The whole editor, around four parts and four wires.',
  },
  {
    id: 'ui-bom',
    name: 'cine-ui-bom',
    build: 'arcade',
    az: 206, pol: 70, fill: 0.82, lift: 0.08, dolly: 0,
    chrome: 'bom',
    note: 'The bill of materials beside the thing it costs.',
  },
].filter((s) => only.length === 0 || only.includes(s.id))

mkdirSync('public/shots', { recursive: true })

const b = await chromium.launch({ channel: 'msedge' })
const page = await b.newPage({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 2 })
const errors = []
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
  d.pinQuality('high')
  d.setView({ gizmo: false, grid: false, ports: false })
})

/*
 * Two stylesheets, because there are two kinds of frame here.
 *
 * The clean one strips the editor down to the canvas. The chrome one leaves
 * the editor alone and takes away only the things that are about this
 * session rather than about the product — the tour, the mobile bar, and the
 * hint that tells you to press a key.
 */
const STRIP_CLEAN = `
  .vp-toolbar, .vp-hint, .vp-stats, .vp-modes, .wire-colors, .bom-tab,
  .sketch-tab, .mbar, .vp-empty, .empty-hint { display: none !important; }
  .app { grid-template-rows: 1fr !important; }
  .app-body { grid-template-columns: 1fr !important; }
  .app-body > .panel, .app-body > .bom-panel, .app-body > .sketch-panel { display: none !important; }
  .app-center { border: 0 !important; }
  .app-center > .console, .topbar, .statusbar { display: none !important; }
`
const STRIP_CHROME = `
  .vp-hint, .mbar, .vp-empty, .empty-hint, .tour, .tour-bubble { display: none !important; }
`

let sheet = null
async function strip(which) {
  if (sheet === which) return
  sheet = which
  await page.evaluate(() => {
    for (const el of document.querySelectorAll('style[data-shot]')) el.remove()
  })
  await page.addStyleTag({ content: which === 'clean' ? STRIP_CLEAN : STRIP_CHROME })
  await page.evaluate(() => {
    const s = [...document.querySelectorAll('style')].at(-1)
    if (s) s.dataset.shot = '1'
  })
  /* The renderer only learns the canvas changed size on a resize event. */
  await page.waitForTimeout(400)
  const vp = page.viewportSize()
  await page.setViewportSize({ width: vp.width - 1, height: vp.height })
  await page.waitForTimeout(300)
  await page.setViewportSize({ width: vp.width, height: vp.height })
  await page.waitForTimeout(700)
}

for (const shot of SHOTS) {
  const clean = !shot.chrome
  await strip(clean ? 'clean' : 'chrome')

  if (shot.wide) await page.setViewportSize({ width: 1440, height: 700 })
  else if (clean) await page.setViewportSize({ width: 1280, height: 860 })
  else await page.setViewportSize({ width: 1440, height: 900 })
  await page.waitForTimeout(500)

  const ok = await page.evaluate((id) => {
    const s = window.draftrig.starters.find((x) => x.id === id)
    if (!s) return false
    const d = window.draftrig.doc.getState()
    d.loadDoc(s.build())
    window.draftrig.engine.reset()
    window.draftrig.sim.getState().setRunning(true)
    d.select([])
    return true
  }, shot.build)
  if (!ok) {
    console.log('no such build:', shot.build)
    continue
  }

  if (shot.chrome === 'bom') {
    const opened = await page.evaluate(() => {
      const b = document.querySelector('.bom-tab')
      if (!b) return false
      if (b.dataset.open !== 'true') b.click()
      return true
    })
    if (!opened) console.log('  (no BOM tab found — shooting without it)')
    await page.waitForTimeout(900)
  }

  await page.evaluate(() => window.draftrig.doc.getState().requestFrame('all'))
  await page.waitForTimeout(1700)

  /* Clear the selection before touching the camera, not after. The camera
     rig re-frames on a selection change, so clearing it afterwards throws
     the framing away and puts the camera back where Fit had it. */
  await page.mouse.move(2, 2)
  await page.evaluate(() => {
    const d = window.draftrig.doc.getState()
    d.clearSelection()
    d.setHovered(null)
  })
  await page.waitForTimeout(600)

  /*
   * Swing, then crop, then slide the frame off centre.
   *
   * The order matters. `camera.view` re-places the camera on the fitted
   * sphere, so anything done to the distance before it is thrown away, and
   * the target has to move last or the pull-in is computed against the old
   * one and the crop comes out at the wrong scale.
   */
  const framed = await page.evaluate(([az, pol, fill, lift, dolly]) => {
    window.draftrig.camera.view(az, pol)
    const c = window.draftrig.camera.controls
    const cam = c.object

    const v = cam.position.clone().sub(c.target).multiplyScalar(fill)
    cam.position.copy(c.target).add(v)

    /*
     * Lift and dolly are fractions of the frame, not of the build.
     *
     * Measuring them against the model needs the scene bounds, which are not
     * published, and the same number would frame a 5 mm LED and a 3 m rack
     * completely differently anyway. What a composition instruction actually
     * means is "a tenth of the way up the picture", so that is what these
     * are: the visible height at the target, from the distance and the field
     * of view, and the width from that and the aspect.
     */
    const dist = cam.position.distanceTo(c.target)
    const vh = 2 * dist * Math.tan((cam.fov * Math.PI) / 360)
    const vw = vh * cam.aspect

    /* Camera-right, so the same dolly slides the frame by the same amount on
       screen from any azimuth. Built out of the vectors already in hand
       rather than a THREE import, which this page does not expose. */
    const shift = cam.position
      .clone()
      .sub(c.target)
      .cross(c.target.clone().set(0, 1, 0))
      .normalize()
      .multiplyScalar(vw * dolly)
    shift.y += vh * lift

    c.target.add(shift)
    cam.position.add(shift)
    cam.lookAt(c.target)
    c.update()
    return { w: Math.round(vw), h: Math.round(vh) }
  }, [shot.az, shot.pol, shot.fill, shot.lift, shot.dolly])

  await page.waitForTimeout(shot.settle ?? 900)

  const target = clean ? page.locator('canvas').first() : page
  await target.screenshot({
    path: `public/shots/${shot.name}.jpg`,
    type: 'jpeg',
    quality: 88,
    timeout: 90_000,
  })

  /* How much of the frame is subject rather than backdrop. A clean frame
     that comes back under a few per cent is a camera pointing at nothing,
     which is the one failure this tool cannot see for itself. */
  const lit = clean
    ? await page.evaluate(() => {
        const c = document.querySelector('canvas')
        const s = document.createElement('canvas')
        s.width = 96
        s.height = 60
        const x = s.getContext('2d')
        x.drawImage(c, 0, 0, 96, 60)
        const d = x.getImageData(0, 0, 96, 60).data
        const at = (i) => [d[i * 4], d[i * 4 + 1], d[i * 4 + 2]]
        const [ar, ag, ab] = at(0)
        const [br, bg, bb] = at(95)
        const bg0 = [(ar + br) / 2, (ag + bg) / 2, (ab + bb) / 2]
        let subject = 0
        for (let i = 0; i < 96 * 60; i++) {
          const [r, g, b] = at(i)
          if (Math.abs(r - bg0[0]) + Math.abs(g - bg0[1]) + Math.abs(b - bg0[2]) > 26) subject++
        }
        return (100 * subject) / (96 * 60)
      })
    : 100

  console.log(
    `public/shots/${shot.name}.jpg`.padEnd(34),
    `${lit.toFixed(0)}%`.padStart(5),
    `${framed.w}x${framed.h}mm`.padStart(14),
    lit < 3 ? ' EMPTY FRAME' : lit < 14 ? ' loose' : lit > 62 ? ' very tight' : '',
  )
}

console.log('errors:', errors.length ? errors.slice(0, 4) : 'none')
await b.close()
