import { click, moveTo, portAt } from './pointer.mjs'

/**
 * Reels two and three.
 *
 * Same three-beat shape as the first — a hook with no interface in it, the
 * tool being worked, then a payoff — but pointed at different features and cut
 * from different builds and angles, so three reels posted in a week do not
 * look like three crops of one video.
 */

const BARE = `
  .app { grid-template-rows: 1fr !important; }
  .app-body { grid-template-columns: 1fr !important; }
  .panel, .console, .statusbar, .topbar, .ai-fab, .bom-tab,
  .vp-toolbar, .vp-hint, .vp-modes, .wire-colors, .vp-stats { display: none !important; }
  .app-center { border: 0 !important; }
`
const WORKING = `.ai-fab { display: none !important; }`

const PORTRAIT = { width: 1080, height: 1920, dsf: 1, rate: 4 }
const WIDE = { width: 1600, height: 900, dsf: 2, rate: 5 }
const NO_GIZMO = { gizmo: false }

/** A 9:16 window out of a 3200x1800 frame, centred on a CSS x. */
const punch = (cx) => ({ w: 1012, h: 1800, x: Math.round(cx * 2 - 506), y: 0 })

/* ================================================================== */
/* Reel 2 — one resistor, every value                                  */
/* ================================================================== */

const r2Hook = {
  id: 'r2-hook',
  ...PORTRAIT,
  url: '/app?start=blink555',
  style: BARE,
  view: NO_GIZMO,
  rate: 6,
  // Down among the leads of the 555, looking along the board rather than at it.
  camera: [-58, 58, 42],
  /*
   * Aimed at the chip, not at the middle of the document.
   *
   * A perfboard is mostly empty board, and the centre of this one is a bare
   * patch: framed on it, the opening was a single LED on a field of pads,
   * which is tidy and says nothing. The components are all at one end.
   */
  async prepare(page) {
    await page.evaluate(() => {
      const d = window.draftrig.doc.getState().doc
      const id = d.order.find((i) => d.instances[i].defId === 'ne555')
      if (id) window.__rig.lookAt(id)
    })
    return {}
  },
  async perform(page) {
    await page.evaluate(() => window.__rig.drift(-14, 3800))
    await page.evaluate(() => window.__rig.fly(28, 40, 210, 3400))
  },
}

const r2Search = {
  id: 'r2-search',
  ...WIDE,
  /*
   * On a build rather than an empty bench.
   *
   * Empty, three quarters of the crop was bare grid with "Pick a part" in it,
   * and dropping a resistor onto a circuit with no supply in it opened the
   * console over the shot to say so — correct of it, and not what this is
   * about.
   */
  url: '/app?start=blink555',
  style: `${WORKING}
.console { display: none !important; }`,
  cursor: [700, 500],
  // The library, plus a slice of bench for the part to land on.
  crop: punch(262),
  camera: [30, 52, 150],
  /** Measured, not guessed: panel widths and row heights are not constants. */
  async prepare(page) {
    // The crop sits over the library, which means it shows the left edge of
    // the bench rather than its middle. Slide the view so a part dropped at
    // the origin lands inside the picture instead of off the right of it.
    await page.evaluate(() => window.__rig.pan(46))
    return { search: await page.locator('.search input').boundingBox() }
  },
  async perform(page, { search }) {
    await click(page, search.x + 90, search.y + search.height / 2, { travel: 500, settle: 200 })
    // Typed rather than set, because the list narrowing keystroke by keystroke
    // is the whole point: a value is a search term here, not a part number.
    for (const ch of '10k') {
      await page.keyboard.type(ch, { delay: 0 })
      await page.evaluate(() => window.__rig.hold(200))
    }
    await page.evaluate(() => window.__rig.hold(700))
    const hit = await page.locator('.part-item').first().boundingBox().catch(() => null)
    if (hit) await click(page, hit.x + 110, hit.y + hit.height / 2, { travel: 620, settle: 400 })

    /*
     * Placing a part selects it, and selecting re-frames the document, which
     * throws away the sideways slide this shot depends on — the bench went
     * black the moment the resistor landed on it. Put the view back, as a
     * move rather than a jump, so it reads as settling on what was dropped.
     */
    await page.evaluate(async () => {
      await window.__rig.fly(30, 52, 150, 800)
      window.__rig.pan(46)
    })
    await page.evaluate(() => window.__rig.hold(900))
  },
}

const r2Value = {
  id: 'r2-value',
  ...WIDE,
  url: '/app?start=blink555',
  style: WORKING,
  cursor: [1300, 500],
  /*
   * The inspector and the part it describes, in one frame, so the bands
   * changing on the resistor read as a consequence of the field changing.
   *
   * The window has to hold the whole inspector, which puts its left edge at
   * 1094 and leaves only a couple of hundred pixels of bench — and the bench
   * centres on the middle of the viewport, which is nowhere near that. So the
   * view is aimed at the resistor and then slid right until the resistor is
   * sitting in the strip of bench the crop can actually see.
   */
  crop: punch(1347),
  camera: [16, 40, 92],
  view: NO_GIZMO,
  rate: 7,
  async setup(page) {
    await page.evaluate(() => {
      const d = window.draftrig.doc.getState()
      const id = d.doc.order.find((i) => d.doc.instances[i].defId === 'resistor-axial')
      if (id) d.select([id])
    })
  },
  async prepare(page) {
    await page.evaluate(() => {
      const d = window.draftrig.doc.getState()
      const id = d.doc.order.find((i) => d.doc.instances[i].defId === 'resistor-axial')
      if (id) window.__rig.lookAt(id)
      window.__rig.pan(-30)
    })
    return {}
  },
  async perform(page) {
    await page.evaluate(() => window.__rig.hold(600))
    // By its label, not by position: the first input in the inspector is the
    // instance's name, and typing 47k into that renames the part instead.
    const field = await page
      .locator('.panel.inspector .field')
      .filter({ hasText: /^Resistance/ })
      .locator('input')
      .first()
      .boundingBox()
      .catch(() => null)
    if (field) {
      const x = field.x + field.width - 18
      const y = field.y + field.height / 2
      for (const v of ['1k', '47k', '220']) {
        await click(page, x, y, { travel: 420, settle: 120 })
        await page.keyboard.press('Control+a')
        await page.keyboard.type(v, { delay: 60 })
        await page.keyboard.press('Enter')
        await page.evaluate(() => window.__rig.hold(900))
      }
    }
    await page.evaluate(() => window.__rig.hold(400))
  },
}

/* ================================================================== */
/* Reel 3 — it knows what it costs                                     */
/* ================================================================== */

const r3Hook = {
  id: 'r3-hook',
  ...PORTRAIT,
  url: '/app?start=bench-clock',
  style: BARE,
  view: NO_GIZMO,
  rate: 5,
  // Along the face of the LCD, so the hook opens on something lit.
  camera: [124, 70, 52],
  async perform(page) {
    await page.evaluate(() => {
      // Running, but left in build mode on purpose. Switching the editor to
      // simulate turns on every terminal marker in the document, and a hook
      // shot wants a board, not a board covered in interface dots. The solver
      // does not care which mode the editor is in.
      window.draftrig.engine.reset()
      window.draftrig.sim.getState().setRunning(true)
    })
    await page.evaluate(() => window.__rig.drift(10, 3600))
    await page.evaluate(() => window.__rig.fly(56, 42, 260, 3400))
  },
}

const r3Bom = {
  id: 'r3-bom',
  ...WIDE,
  url: '/app?start=bench-clock',
  cursor: [1300, 860],
  /*
   * The panel, plus enough bench on its left to show what is being totalled.
   * The inspector sits between the two and has nothing to say here, so it goes
   * — and the grid has to be told, or the bill reflows into the track the
   * inspector left behind and gets cut in half by the crop.
   */
  style: `${WORKING}
    .panel.inspector { display: none !important; }
    .app-body[data-bom='true'] { grid-template-columns: 268px 1fr 396px !important; }`,
  crop: punch(1347),
  camera: [34, 48, 190],
  view: NO_GIZMO,
  async prepare(page) {
    return { tab: await page.locator('.bom-tab').boundingBox() }
  },
  async perform(page, { tab }) {
    if (tab) await click(page, tab.x + tab.width / 2, tab.y + tab.height / 2, { travel: 600, settle: 900 })
    await page.evaluate(() => window.__rig.hold(700))

    // Walk the list, so it reads as a bill rather than as a panel. The pointer
    // has to be over the list itself, or the wheel goes to whatever is under
    // the tab it was just pressing.
    const list = await page.locator('.bom-list').boundingBox().catch(() => null)
    if (list) {
      await moveTo(page, list.x + list.width / 2, list.y + list.height * 0.45, 600)
      for (let i = 0; i < 4; i++) {
        await page.mouse.wheel(0, 150)
        await page.evaluate(() => window.__rig.hold(240))
      }
    }
    await page.evaluate(() => window.__rig.hold(700))
    const dl = await page.getByRole('button', { name: /Download CSV/i }).boundingBox().catch(() => null)
    if (dl) await click(page, dl.x + dl.width / 2, dl.y + dl.height / 2, { travel: 600, settle: 800 })
    await page.evaluate(() => window.__rig.hold(500))
  },
}

const r3Hero = {
  id: 'r3-hero',
  ...PORTRAIT,
  url: '/app?start=bench-clock',
  style: BARE,
  view: NO_GIZMO,
  camera: [-30, 36, 230],
  async perform(page) {
    await page.evaluate(() => {
      // Running, but left in build mode on purpose. Switching the editor to
      // simulate turns on every terminal marker in the document, and a hook
      // shot wants a board, not a board covered in interface dots. The solver
      // does not care which mode the editor is in.
      window.draftrig.engine.reset()
      window.draftrig.sim.getState().setRunning(true)
    })
    await page.evaluate(() => window.__rig.fly(36, 58, 150, 4200))
    await page.evaluate(() => window.__rig.drift(8, 2200))
  },
}

export const REELS2 = [
  { id: 'reel2-parts-and-values', shots: [r2Hook, r2Search, r2Value] },
  { id: 'reel3-bill-of-materials', shots: [r3Hook, r3Bom, r3Hero] },
]
