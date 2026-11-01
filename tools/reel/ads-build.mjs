import { chromium } from 'playwright'
import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { ADS } from './ads.mjs'

/**
 * Cuts the ads.
 *
 * Nothing is recorded here. Every beat is trimmed out of a finished clip that
 * already sits in the reels folder, so changing the cut costs a minute of
 * ffmpeg rather than fifteen minutes of capture and a gigabyte of frames.
 *
 * The footage is left alone. An earlier version burned a caption over every
 * beat; they covered the bottom third of renders that took real work to make,
 * and the only words now are the name and the address on the closing card.
 * That card is still drawn in a browser rather than by ffmpeg's `drawtext`,
 * because the brand's type is four woff2 files and `drawtext` reads neither
 * woff2 nor a line of CSS.
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
   The closing card
   ================================================================== */

/**
 * The only words in either ad.
 *
 * The page's paper, the page's ruled ground, the mark at its real
 * proportions and the address under it. There was a line of sell beneath
 * this — "Free to try. No account." — and it is gone: the ad has just spent
 * twelve seconds showing the thing work, and a closing claim after that reads
 * as a sales pitch stapled to the end of something that did not need one.
 */
const cardHTML = (logo) => `
<!doctype html><html><head><meta charset="utf-8">
<style>
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
</style></head><body>
  <div class="mid">
    <img class="mark" src="${logo}" alt="">
    <div class="rule"></div>
    <div class="addr">draftrig.com</div>
  </div>
</body></html>`

console.log('drawing the card…')
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 })
// Loaded from the dev server so `/fonts/*.woff2` and `/logo.png` resolve: a
// card written to about:blank has no origin to fetch them from.
await page.goto(BASE + '/', { waitUntil: 'domcontentloaded' })
await page.setContent(cardHTML(BASE + '/logo.png'), { waitUntil: 'load' })
await page.evaluate(() => document.fonts.ready)
await page.waitForTimeout(300)
await page.screenshot({ path: `${WORK}/card.png` })
await browser.close()

/* ==================================================================
   The cut
   ================================================================== */

const wanted = process.argv.slice(2)
const ads = wanted.length ? ADS.filter((a) => wanted.some((w) => a.id.includes(w))) : ADS

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
  const last = ad.beats.length - 1

  for (const [i, b] of ad.beats.entries()) {
    const src = join(REELS, b.src)
    if (!existsSync(src)) throw new Error(`${ad.id}: missing source ${src}`)
    const out = `${WORK}/${ad.id}-${i}.mp4`

    /*
     * A slow push on every beat. Footage that is already moving does not
     * need it, but a beat held on a finished build does, and 3% over four
     * seconds is the difference between a shot and a photograph.
     */
    const filters = [
      `scale=${W}:${H}:flags=lanczos:force_original_aspect_ratio=increase`,
      `crop=${W}:${H}`,
      `zoompan=z='min(zoom+0.00030,1.055)':d=1:x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':s=${W}x${H}:fps=${FPS}`,
    ]
    // Up from black at the very start, down into the card at the very end, so
    // neither edge of the ad arrives as a slam.
    if (i === 0) filters.push('fade=t=in:st=0:d=0.45')
    if (i === last) filters.push(`fade=t=out:st=${Math.max(0, b.dur - 0.5).toFixed(2)}:d=0.5`)
    filters.push('format=yuv420p')

    ff([
      '-ss', String(b.at), '-t', String(b.dur), '-i', src,
      '-vf', filters.join(','),
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
  console.log(`  ${ad.id.padEnd(22)} ${secs.toFixed(1)}s  ${ad.beats.length} beats + card`)
}

console.log(`\nads are in ${OUT}`)
