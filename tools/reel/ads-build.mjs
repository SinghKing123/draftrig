import { chromium } from 'playwright'
import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { ADS } from './ads.mjs'

/**
 * Cuts the ads.
 *
 * Two halves. The captions are drawn in a browser, because the type is the
 * brand's and the brand's type is four woff2 files — ffmpeg's `drawtext`
 * reads neither woff2 nor a line of CSS, and an ad set in Arial is an ad for
 * somebody else. Chromium renders each caption to a transparent PNG at the
 * delivery size with the real faces, the real tracking and the real scrim.
 *
 * Then ffmpeg does what ffmpeg is good at: trim each beat out of footage that
 * already exists, lay the caption over it with a fade at each end, and join
 * them. Nothing is re-recorded, so a change to a word costs about a minute.
 *
 *   node tools/reel/ads-build.mjs [adId...]
 *
 * BASE   dev server, for the fonts        (default http://localhost:5174)
 * FFMPEG path to ffmpeg                   (default: found, or `ffmpeg`)
 * REELS  where the source clips live      (default ~/Videos/Draftrig reels)
 */

const BASE = process.env.BASE ?? 'http://localhost:5174'
const REELS = process.env.REELS || join(homedir(), 'Videos', 'Draftrig reels')
const OUT = join(REELS, 'ads')
const WORK = 'shots/ads'
const W = 1080
const H = 1920
const FPS = 30
/** How long the closing card holds. Long enough to read an address, no more. */
const CARD = 2.3

/* ffmpeg is not on this machine's PATH; it came in with a download. Look
   where it actually is before falling back to the name. */
const FF =
  process.env.FFMPEG ??
  [
    'C:/Users/aryan/Downloads/IO_Studios_Simulator-20260902T183815Z-1-001/IO_Studios_Simulator/ffmpeg.exe',
  ].find((p) => existsSync(p)) ??
  'ffmpeg'

const ff = (args) =>
  execFileSync(FF, ['-hide_banner', '-loglevel', 'error', '-y', ...args], { stdio: 'inherit' })

mkdirSync(OUT, { recursive: true })
rmSync(WORK, { recursive: true, force: true })
mkdirSync(WORK, { recursive: true })

/* ==================================================================
   The captions, drawn in the browser
   ================================================================== */

/**
 * One caption, as a full-frame transparent PNG.
 *
 * Set in the page's own faces at the page's own sizes. Two things here are
 * about video rather than about the web:
 *
 * - **The scrim.** A caption has to be legible over footage it does not
 *   control — a shot that is near-black at the bottom in one second is a lit
 *   breadboard in the next. A gradient from nothing to almost-black across
 *   the lower half costs nothing on a dark frame and saves the light ones.
 * - **The safe area.** Instagram puts its own interface over the bottom of a
 *   reel, so nothing of ours goes below about 15% of the height.
 */
const captionHTML = (lead, spec) => `
<!doctype html><html><head><meta charset="utf-8">
<style>
  @font-face { font-family: 'Schibsted Grotesk'; src: url('/fonts/schibsted-grotesk.woff2') format('woff2'); font-weight: 400 700; font-display: block; }
  @font-face { font-family: 'JetBrains Mono'; src: url('/fonts/jetbrains-mono.woff2') format('woff2'); font-weight: 400 600; font-display: block; }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  html, body { width: ${W}px; height: ${H}px; background: transparent; }
  .scrim {
    position: absolute; inset: 0;
    background: linear-gradient(to bottom,
      rgba(8,7,5,0) 38%, rgba(8,7,5,0.42) 62%, rgba(8,7,5,0.82) 88%, rgba(8,7,5,0.88) 100%);
  }
  .cap {
    position: absolute; left: 72px; right: 72px; bottom: 290px;
    font-family: 'Schibsted Grotesk', sans-serif;
    color: #FFFDF9;
  }
  .lead {
    font-size: 86px; line-height: 1.04; font-weight: 700;
    letter-spacing: -0.035em;
    white-space: pre-line;
    text-shadow: 0 2px 28px rgba(0,0,0,0.5);
  }
  .spec {
    margin-top: 26px; padding-top: 22px;
    border-top: 2px solid rgba(255,253,249,0.28);
    font-family: 'JetBrains Mono', monospace;
    font-size: 33px; letter-spacing: 0.01em;
    color: #E6DFD3;
    font-variant-numeric: tabular-nums;
  }
</style></head><body>
  <div class="scrim"></div>
  <div class="cap">
    <div class="lead">${lead}</div>
    ${spec ? `<div class="spec">${spec}</div>` : ''}
  </div>
</body></html>`

/**
 * The closing card.
 *
 * The page's paper, the page's headline face, and the address. This is the
 * only frame of the whole ad that is not footage, and it is the only reason
 * the ad exists, so it is given the same care as the hero of the site: warm
 * ground, the ruled grid faint behind it, the mark at its real proportions.
 */
const cardHTML = (logo) => `
<!doctype html><html><head><meta charset="utf-8">
<style>
  @font-face { font-family: 'Schibsted Grotesk'; src: url('/fonts/schibsted-grotesk.woff2') format('woff2'); font-weight: 400 700; font-display: block; }
  @font-face { font-family: 'JetBrains Mono'; src: url('/fonts/jetbrains-mono.woff2') format('woff2'); font-weight: 400 600; font-display: block; }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  html, body { width: ${W}px; height: ${H}px; background: #FDFBF7; }
  /* The same ruled ground the front page stands on, at the same pitch. */
  body {
    background-image:
      linear-gradient(to right, rgba(23,21,15,0.045) 1px, transparent 1px),
      linear-gradient(to bottom, rgba(23,21,15,0.045) 1px, transparent 1px);
    background-size: 72px 72px;
  }
  .mid {
    position: absolute; inset: 0;
    display: flex; flex-direction: column;
    align-items: center; justify-content: center;
    gap: 54px;
  }
  .mark { width: 620px; height: auto; display: block; }
  .rule { width: 120px; height: 3px; background: #DBD2C3; }
  .addr {
    font-family: 'JetBrains Mono', monospace;
    font-size: 46px; letter-spacing: 0.02em; color: #17150F;
  }
  .line {
    position: absolute; left: 0; right: 0; bottom: 280px;
    text-align: center;
    font-family: 'Schibsted Grotesk', sans-serif;
    font-size: 40px; font-weight: 500; letter-spacing: -0.02em;
    color: #554F46;
  }
</style></head><body>
  <div class="mid">
    <img class="mark" src="${logo}" alt="">
    <div class="rule"></div>
    <div class="addr">draftrig.com</div>
  </div>
  <div class="line">Free to try. No account.</div>
</body></html>`

console.log('drawing captions…')
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 })
// Load from the dev server first so that `/fonts/*.woff2` and `/logo.png`
// resolve: a caption written to about:blank has no origin to fetch them from.
await page.goto(BASE + '/', { waitUntil: 'domcontentloaded' })

const wanted = process.argv.slice(2)
const ads = wanted.length ? ADS.filter((a) => wanted.some((w) => a.id.includes(w))) : ADS

/** Paint some HTML into the open page and photograph it. */
async function shoot(html, path, transparent) {
  await page.setContent(html, { waitUntil: 'load' })
  await page.evaluate(() => document.fonts.ready)
  await page.waitForTimeout(260)
  await page.screenshot({ path, omitBackground: transparent })
}

for (const ad of ads) {
  for (const [i, b] of ad.beats.entries()) {
    await shoot(captionHTML(b.lead, b.spec), `${WORK}/${ad.id}-${i}.png`, true)
  }
}
await shoot(cardHTML(BASE + '/logo.png'), `${WORK}/card.png`, false)
await browser.close()

/* ==================================================================
   The cut
   ================================================================== */

/** The closing card as a still clip, encoded once and reused by every ad. */
const cardClip = `${WORK}/card.mp4`
ff([
  '-loop', '1', '-t', String(CARD), '-i', `${WORK}/card.png`,
  '-vf', `scale=${W}:${H},fade=t=in:st=0:d=0.3,format=yuv420p`,
  '-r', String(FPS), '-c:v', 'libx264', '-preset', 'slow', '-crf', '18',
  cardClip,
])

for (const ad of ads) {
  const parts = []

  for (const [i, b] of ad.beats.entries()) {
    const src = join(REELS, b.src)
    if (!existsSync(src)) throw new Error(`${ad.id}: missing source ${src}`)
    const out = `${WORK}/${ad.id}-${i}.mp4`

    /*
     * The caption fades in just after the cut and out just before the next
     * one, so a word is never on screen at the moment the picture changes —
     * that is the thing that makes a caption look stuck on afterwards rather
     * than part of the shot.
     */
    const inD = 0.34
    const outAt = Math.max(0, b.dur - 0.46)
    const filter =
      `[1:v]format=rgba,fade=t=in:st=0:d=${inD}:alpha=1,` +
      `fade=t=out:st=${outAt.toFixed(2)}:d=0.4:alpha=1[cap];` +
      `[0:v]scale=${W}:${H}:flags=lanczos:force_original_aspect_ratio=increase,crop=${W}:${H},` +
      // A slow push on every beat. Still footage under a caption reads as a
      // slideshow; a 3% drift over three seconds reads as a camera.
      `zoompan=z='min(zoom+0.00035,1.06)':d=1:x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':s=${W}x${H}:fps=${FPS}[bg];` +
      `[bg][cap]overlay=0:0,format=yuv420p[v]`

    ff([
      '-ss', String(b.at), '-t', String(b.dur), '-i', src,
      /*
       * `-loop 1` matters. A PNG given as a plain input decodes to a single
       * frame, `fade` then drives that one frame's alpha to nearly nothing,
       * and `overlay` repeats it for the length of the beat — which looks
       * exactly like the caption never rendered at all. Looped at the
       * delivery rate it is a real stream, and the fade happens over time.
       */
      '-loop', '1', '-framerate', String(FPS), '-t', String(b.dur),
      '-i', `${WORK}/${ad.id}-${i}.png`,
      '-filter_complex', filter,
      '-map', '[v]',
      '-r', String(FPS), '-c:v', 'libx264', '-preset', 'slow', '-crf', '18',
      '-an', out,
    ])
    parts.push(out)
  }

  parts.push(cardClip)

  // The concat demuxer resolves entries against the list file's directory.
  const list = `${WORK}/${ad.id}.txt`
  writeFileSync(list, parts.map((p) => `file '${p.split('/').pop()}'`).join('\n'))

  const final = join(OUT, `${ad.id}.mp4`)
  ff([
    '-f', 'concat', '-safe', '0', '-i', list,
    // Re-encoded once on the way out so every cut is on a keyframe and the
    // whole thing carries one set of encode settings.
    '-r', String(FPS), '-c:v', 'libx264', '-preset', 'slow', '-crf', '19',
    '-pix_fmt', 'yuv420p', '-movflags', '+faststart', '-an',
    final,
  ])

  const secs = ad.beats.reduce((n, b) => n + b.dur, 0) + CARD
  console.log(`  ${ad.id.padEnd(24)} ${secs.toFixed(1)}s  ${ad.beats.length} beats + card`)
}

console.log(`\nads are in ${OUT}`)
