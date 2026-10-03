import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

/**
 * Encode the recorded clip frames for the front page.
 *
 * Two files each, because no single format plays everywhere: VP9 in WebM for
 * anything Chromium or Firefox, H.264 in MP4 for Safari. The browser takes
 * the first it understands, so the WebM is listed first and is the smaller of
 * the two.
 *
 * ## Weight
 *
 * These are decoration on a page whose whole point is that it loads. The first
 * encode came to eighteen megabytes across four clips, which is a page that
 * loads for nobody on a phone. What brings it down, in order of how much:
 *
 *   - six seconds, not twenty. A loop nobody is watching to the end does not
 *     need an end.
 *   - 24 frames a second. It is a slow camera move over a still object.
 *   - the cards at 960 wide. They are never shown bigger than about 420.
 *
 * Quality last, because a dark 3D scene bands in the gradients long before it
 * blocks in the details, and banding is the thing that looks cheap.
 *
 *   FFMPEG=/path/to/ffmpeg node tools/reel/clips-build.mjs
 */

const FFMPEG = process.env.FFMPEG ?? 'ffmpeg'
const SRC = 'shots/reel'
const OUT = 'public/clips'

/** Seconds of each clip to keep, and the rate to play them at. */
const SECONDS = 6
const FPS = 24

/** The hero is shown full width; the cards never exceed about 420 CSS pixels. */
const SIZE = { hero: 1280, card: 960 }
const HERO = 'clip-assemble'

mkdirSync(OUT, { recursive: true })

const clips = readdirSync(SRC).filter((d) => d.startsWith('clip-') && existsSync(join(SRC, d)))
if (!clips.length) {
  console.log(`no clip- frame folders in ${SRC}`)
  process.exit(0)
}

const kb = (f) => Math.round(statSync(f).size / 1024)
let total = 0

for (const id of clips) {
  const dir = join(SRC, id)
  const frames = readdirSync(dir).filter((f) => f.startsWith('f') && f.endsWith('.jpg')).sort()
  if (!frames.length) {
    console.log(`${id}: no frames`)
    continue
  }

  const width = id === HERO ? SIZE.hero : SIZE.card
  const pattern = join(dir, 'f%05d.jpg')
  const run = (args) => execFileSync(FFMPEG, ['-y', '-loglevel', 'error', ...args], { stdio: 'inherit' })

  /*
   * Read the frames at the rate they will play and stop after six seconds.
   * The source was captured slowly on purpose — see the note on rate in the
   * shot definitions — so playing every frame would be a very long clip of
   * a very slow camera.
   */
  const span = Math.min(SECONDS, frames.length / FPS)
  const scale = `scale=${width}:-2:flags=lanczos`

  const webm = join(OUT, `${id}.webm`)
  const mp4 = join(OUT, `${id}.mp4`)
  const jpg = join(OUT, `${id}.jpg`)

  run(['-framerate', String(FPS), '-i', pattern, '-t', String(span),
    '-vf', scale, '-c:v', 'libvpx-vp9', '-crf', '42', '-b:v', '0',
    '-row-mt', '1', '-deadline', 'good', '-cpu-used', '2', '-an',
    '-pix_fmt', 'yuv420p', webm])

  run(['-framerate', String(FPS), '-i', pattern, '-t', String(span),
    '-vf', scale, '-c:v', 'libx264', '-crf', '31', '-preset', 'slow', '-an',
    '-pix_fmt', 'yuv420p', '-movflags', '+faststart', mp4])

  // A real frame from a second in, so the poster is the build rather than the
  // empty bench the clip opens on.
  run(['-i', join(dir, frames[Math.min(frames.length - 1, Math.round(frames.length * 0.6))]),
    '-vf', scale, '-q:v', '6', jpg])

  total += kb(webm) + kb(jpg)
  console.log(`${id.padEnd(14)} ${span.toFixed(1)}s  webm ${kb(webm)}K  mp4 ${kb(mp4)}K  poster ${kb(jpg)}K`)
}

console.log(`\nwebm + posters: ${total}K`)
