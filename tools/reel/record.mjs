import { chromium } from 'playwright'
import { CURSOR, placeAt, setSlow } from './pointer.mjs'
import { mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

/**
 * Records a shot of the editor as a sequence of frames.
 *
 * Not Playwright's own video recorder: that wants a bundled ffmpeg this
 * machine does not have, and it hands back a webm at whatever frame rate it
 * managed. This drives Chrome's screencast directly, which gives every frame
 * the page actually painted along with the timestamp it painted at, so the
 * assembler can lay them on a constant 30 fps grid instead of guessing.
 *
 * Shots are scripted rather than performed. Anything the camera does is a
 * tween running inside the page against requestAnimationFrame, so the motion
 * is smooth whatever the capture is managing, and the same shot comes out the
 * same way every time it is recorded.
 */

const BASE = process.env.BASE ?? 'http://localhost:4173'

/** Put in place before a shot: the tour, the nav hint and the BOM panel. */
async function settle(page, { bom = false } = {}) {
  await page.evaluate((openBom) => {
    localStorage.setItem('tour.seen.v1', '1')
    localStorage.setItem('draftrig.nav.seen.v1', '1')
    localStorage.setItem('draftrig.console.open.v1', '0')
    localStorage.setItem('draftrig.bom.open.v1', openBom ? '1' : '0')
  }, bom)
}

/**
 * The tween the shots drive the camera with.
 *
 * Installed into the page so the motion is generated at paint time. Handing
 * the camera a new position from outside once per captured frame produces
 * motion that stutters exactly as much as the capture does.
 */
const CAMERA_RIG = `
window.__rig = {
  /**
   * Everything is performed slowly and sped back up on the way out.
   *
   * The screencast manages about twenty frames a second at this resolution,
   * which is not enough for motion that has to look deliberate. Running every
   * move at a fraction of speed and multiplying the result back means the
   * capture rate stops mattering: at a quarter speed, twenty captured frames a
   * second become eighty. The simulation is slowed to match by the shot, so it
   * still runs at its real rate in the finished clip.
   */
  slow: 1,
  /** Orbit to an azimuth/polar/distance over ms, on an ease that has no corners. */
  fly(azDeg, polarDeg, dist, ms) {
    ms *= this.slow
    const c = window.draftrig.camera?.controls
    if (!c) return Promise.resolve()
    const t = c.target.clone()
    const from = c.object.position.clone().sub(t)
    const r0 = from.length()
    const az0 = Math.atan2(from.x, from.z)
    const po0 = Math.acos(Math.max(-1, Math.min(1, from.y / r0)))
    let az1 = (azDeg * Math.PI) / 180
    const po1 = (polarDeg * Math.PI) / 180
    const r1 = dist ?? r0
    // Always take the short way round, or a 10 degree move can spin 350.
    while (az1 - az0 > Math.PI) az1 -= Math.PI * 2
    while (az1 - az0 < -Math.PI) az1 += Math.PI * 2
    const ease = (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2)
    const t0 = performance.now()
    return new Promise((done) => {
      const step = () => {
        const k = Math.min(1, (performance.now() - t0) / ms)
        const e = ease(k)
        const az = az0 + (az1 - az0) * e
        const po = po0 + (po1 - po0) * e
        const r = r0 + (r1 - r0) * e
        c.object.position.set(
          t.x + r * Math.sin(po) * Math.sin(az),
          t.y + r * Math.cos(po),
          t.z + r * Math.sin(po) * Math.cos(az),
        )
        c.object.lookAt(t)
        c.update()
        if (k < 1) requestAnimationFrame(step)
        else done()
      }
      requestAnimationFrame(step)
    })
  },
  /** A slow continuous orbit, for a bed to lay other action over. */
  drift(degPerSec, ms) {
    degPerSec /= this.slow
    ms *= this.slow
    const c = window.draftrig.camera?.controls
    if (!c) return Promise.resolve()
    const t0 = performance.now()
    let last = t0
    return new Promise((done) => {
      const step = () => {
        const now = performance.now()
        const d = ((now - last) / 1000) * degPerSec * (Math.PI / 180)
        last = now
        const v = c.object.position.clone().sub(c.target)
        const az = Math.atan2(v.x, v.z) + d
        const r = Math.hypot(v.x, v.z)
        c.object.position.set(c.target.x + r * Math.sin(az), c.object.position.y, c.target.z + r * Math.cos(az))
        c.object.lookAt(c.target)
        c.update()
        if (now - t0 < ms) requestAnimationFrame(step)
        else done()
      }
      requestAnimationFrame(step)
    })
  },
  /** Push the camera in or out along the line it is already on. */
  dolly(factor, ms) {
    const c = window.draftrig.camera?.controls
    if (!c) return Promise.resolve()
    const v = c.object.position.clone().sub(c.target)
    return this.fly(
      (Math.atan2(v.x, v.z) * 180) / Math.PI,
      (Math.acos(Math.max(-1, Math.min(1, v.y / v.length()))) * 180) / Math.PI,
      v.length() * factor,
      ms,
    )
  },
  /**
   * Slide the whole view sideways, in millimetres.
   *
   * What the orbit controls call the target is what sits in the middle of the
   * viewport, and in a punched-in shot the middle of the viewport is usually
   * not the middle of the frame — a crop taken over the parts library shows
   * the left quarter of the bench, so anything dropped onto the bench centre
   * lands outside the picture. Moving the camera and its target together by
   * the same vector puts the subject where the crop is.
   */
  pan(dx, dy = 0) {
    const c = window.draftrig.camera?.controls
    if (!c) return
    const m = c.object.matrixWorld.elements
    const right = { x: m[0], y: m[1], z: m[2] }
    const up = { x: m[4], y: m[5], z: m[6] }
    for (const v of [c.object.position, c.target]) {
      v.x += right.x * dx + up.x * dy
      v.y += right.y * dx + up.y * dy
      v.z += right.z * dx + up.z * dy
    }
    c.update()
  },
  /** Put one instance in the middle of the view, keeping the angle. */
  lookAt(id) {
    const c = window.draftrig.camera?.controls
    const inst = window.draftrig.doc.getState().doc.instances[id]
    if (!c || !inst) return
    const v = c.object.position.clone().sub(c.target)
    c.target.set(inst.pos[0], inst.pos[1], inst.pos[2])
    c.object.position.copy(c.target).add(v)
    c.update()
  },
  /** Hold still for a beat, so a cut does not land mid-move. */
  hold(ms) {
    return new Promise((r) => setTimeout(r, ms * this.slow))
  },
}
`

export async function record(shot, outDir) {
  rmSync(outDir, { recursive: true, force: true })
  mkdirSync(outDir, { recursive: true })

  const browser = await chromium.launch({
    channel: 'msedge',
    args: ['--force-device-scale-factor=' + (shot.dsf ?? 1), '--hide-scrollbars'],
  })
  const page = await browser.newPage({
    viewport: { width: shot.width, height: shot.height },
    deviceScaleFactor: shot.dsf ?? 1,
  })
  const problems = []
  page.on('pageerror', (e) => problems.push(e.message))

  await page.goto(BASE + shot.url, { waitUntil: 'networkidle' })
  await settle(page, shot)
  await page.reload({ waitUntil: 'networkidle' })
  // The 3D stack, the catalog and the first solve all have to land.
  await page.waitForTimeout(shot.warmup ?? 7000)

  await page.addScriptTag({ content: CAMERA_RIG })
  if (shot.cursor) {
    await page.addScriptTag({ content: CURSOR })
    await placeAt(page, ...shot.cursor)
  }

  /*
   * Pin the render quality up.
   *
   * The adaptive system exists to protect the frame rate of somebody working,
   * and it steps down within a couple of seconds of a heavy scene. That is the
   * right call in use and the wrong one here: nothing is being interacted
   * with, and a recording wants the best pipeline the machine can draw even if
   * it draws it slowly. Motion is tweened and the assembler retimes it, so
   * slow is free.
   */
  await page.evaluate(() => window.draftrig.doc.getState().pinQuality('high'))
  setSlow(shot.rate ?? 1)
  /*
   * The simulation is slowed to match the performance, so a circuit still runs
   * at its own rate once the clip is sped back up.
   *
   * A shot can override it, and a shot with a heavy circuit in it has to. The
   * solver does not keep up with real time on a seventeen-part build with a
   * microcontroller and a display on it — a half-minute capture advanced the
   * simulated clock by a tenth of a second — so dividing its speed again
   * leaves the display frozen on the same reading for the whole shot. Where
   * the circuit is the subject, `simSpeed` is set by eye against the finished
   * clip instead.
   *
   * `simSpeed` alone cannot rescue it, because the engine caps how long it
   * will spend solving each tick: asking for more simulated time per second
   * just means more of the request is dropped. `simDt` is the lever that
   * works — a coarser timestep covers more simulated ground for the same
   * number of solves. The default 25 us is chosen for accuracy on fast edges;
   * a lamp blinking about once a second does not need it, and at 25 us a
   * half-minute capture advanced the circuit by a tenth of a second, so the
   * lamp never changed state on camera at all.
   */
  await page.evaluate(
    ([n, speed, dt]) => {
      window.__rig.slow = n
      window.draftrig.sim.getState().setSpeed(speed)
      if (dt) window.draftrig.sim.getState().setDt(dt)
    },
    [shot.rate ?? 1, shot.simSpeed ?? 1 / (shot.rate ?? 1), shot.simDt ?? 0],
  )
  await page.waitForTimeout(600)

  /*
   * Chrome first, then framing, then the shot's own camera. In that order.
   *
   * Hiding the panels resizes the canvas, and CameraRig re-frames whenever the
   * canvas size changes. Injecting the style after pressing Fit therefore
   * queued a second framing animation that ran on top of whatever camera the
   * shot had just set, and every shot silently came out at the fitted
   * distance no matter where it had been pointed.
   */
  if (shot.style) await page.addStyleTag({ content: shot.style })
  if (shot.view) await page.evaluate((v) => window.draftrig.doc.getState().setView(v), shot.view)
  await page.waitForTimeout(500)

  // Frame the bench with the editor's own Fit, so every shot starts from a
  // known place rather than from wherever the load happened to leave it.
  await page.getByRole('button', { name: /^Fit$/ }).click().catch(() => {})
  await page.waitForTimeout(1200)

  // Nothing should be hovered or selected when a shot starts.
  await page.mouse.move(1, 1)
  await page.evaluate(() => window.draftrig.doc.getState().select([]))
  if (shot.setup) await shot.setup(page)

  /*
   * The camera is placed last, and after everything else has settled.
   *
   * CameraRig re-frames the document whenever the selection or the canvas
   * size changes, and it does it as an animation a third of a second long.
   * Anything a shot does in setup — clearing a selection, stripping the wiring
   * out of a build — can therefore queue a framing that lands on top of the
   * camera the shot just set, which is how every shot came to be recorded from
   * the fitted distance regardless of where it had been aimed. Waiting for the
   * dust and then aiming is the only ordering that cannot lose.
   */
  await page.waitForTimeout(700)
  if (shot.camera) {
    await page.evaluate((c) => window.__rig.fly(c[0], c[1], c[2], 1), shot.camera)
  }
  await page.waitForTimeout(shot.lead ?? 500)

  /*
   * Anything expensive a shot needs to know happens here, with the camera
   * already where it will stay and the recorder not yet running. Looking up
   * where the terminals are on screen costs a round trip each, and doing it
   * between clicks left the finished clip standing still for seconds at a
   * time with the pointer frozen mid-air.
   */
  const prepared = shot.prepare ? await shot.prepare(page) : undefined

  const where = await page.evaluate(() => {
    const c = window.draftrig.camera.controls
    const v = c.object.position.clone().sub(c.target)
    return `dist ${v.length().toFixed(0)} polar ${((Math.acos(v.y / v.length()) * 180) / Math.PI).toFixed(0)} fov ${c.object.fov}`
  })
  console.log(`  ${shot.id} starts at ${where}`)

  /* ---- capture ---- */

  const client = await page.context().newCDPSession(page)
  const frames = []
  client.on('Page.screencastFrame', (f) => {
    frames.push({ data: f.data, t: f.metadata.timestamp })
    client.send('Page.screencastFrameAck', { sessionId: f.sessionId }).catch(() => {})
  })
  await client.send('Page.startScreencast', {
    format: 'jpeg',
    quality: 95,
    maxWidth: shot.width * (shot.dsf ?? 1),
    maxHeight: shot.height * (shot.dsf ?? 1),
    everyNthFrame: 1,
  })

  await shot.perform(page, prepared)

  await client.send('Page.stopScreencast')
  await page.waitForTimeout(200)

  /* ---- write ---- */

  const t0 = frames.length ? frames[0].t : 0
  const index = frames.map((f, i) => ({ file: `f${String(i).padStart(5, '0')}.jpg`, t: f.t - t0 }))
  for (let i = 0; i < frames.length; i++) {
    writeFileSync(join(outDir, index[i].file), Buffer.from(frames[i].data, 'base64'))
  }
  writeFileSync(
    join(outDir, 'frames.json'),
    JSON.stringify({ shot: shot.id, rate: shot.rate ?? 1, crop: shot.crop ?? null, index }, null, 0),
  )

  const span = index.length ? index[index.length - 1].t : 0
  console.log(
    `${shot.id}: ${frames.length} frames over ${span.toFixed(1)}s ` +
      `(${(frames.length / Math.max(span, 0.001)).toFixed(1)} fps captured, ` +
      `${((frames.length / Math.max(span, 0.001)) * (shot.rate ?? 1)).toFixed(0)} effective)` +
      (problems.length ? `  ERRORS: ${problems.join('; ')}` : ''),
  )
  await browser.close()
  return { frames: frames.length, span }
}
