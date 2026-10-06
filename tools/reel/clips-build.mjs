import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, readdirSync, statSync, writeFileSync } from 'node:fs'
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

/**
 * Clips that get the whole take rather than the first six seconds of it.
 *
 * Cutting at a fixed length suits a clip that shows one action: whatever it
 * was doing at six seconds, it was still doing. It does not suit the breadth
 * clip, which is four different builds one after another — truncating that
 * one threw away three of the four and left a long look at the first.
 *
 * For these the frames are fed in fast enough that the entire recording lands
 * inside the given span, so the take plays complete and quick instead of
 * whole and cut short. The number is a ceiling on weight as much as on time.
 */
const WHOLE = { 'clip-builds': 9, 'clip-bg': 12 }

/**
 * Clips that are never looked at directly.
 *
 * The hero background plays blurred, at about a sixth opacity, behind the
 * headline. Detail it will never show is bytes on a page whose whole point
 * is that it loads, so it goes out small and coarsely compressed — the blur
 * hides what the quantiser does, and the file lands a fraction of the size a
 * clip meant to be watched would.
 */
const SOFT = { 'clip-bg': { width: 540, crf: 52 } }

/** The hero is shown full width; the cards never exceed about 420 CSS pixels. */
const SIZE = { hero: 1280, card: 960 }
const HERO = 'clip-assemble'

mkdirSync(OUT, { recursive: true })

const clips = readdirSync(SRC).filter((d) => d.startsWith('clip-') && existsSync(join(SRC, d)))
if (!clips.length) {
  console.log(`no clip- frame folders in ${SRC}`)
  process.exit(0)
}

const NL = String.fromCharCode(10)
const SEP = String.fromCharCode(92)
const kb = (f) => Math.round(statSync(f).size / 1024)

/**
 * Frames the capture dropped on the floor.
 *
 * The screencast occasionally hands back a blank frame under load — always
 * byte-identical, always a single frame with ordinary ones either side. Left
 * in, each one is a black flash in the middle of a shot.
 *
 * Size alone cannot find them, because the brand animation at the head of the
 * breadth clip is legitimately small and dark for a second at a time. What
 * separates a dropout from a dark shot is that a dropout is isolated: far
 * smaller than the frame before it and the frame after it, both. A run of
 * dark frames is content; one dark frame between two bright ones is not.
 */
const isDropout = (sz, i) =>
  i > 0 && i < sz.length - 1 && sz[i] < 0.3 * Math.min(sz[i - 1], sz[i + 1])
let total = 0

for (const id of clips) {
  const dir = join(SRC, id)
  const frames = readdirSync(dir).filter((f) => f.startsWith('f') && f.endsWith('.jpg')).sort()
  if (!frames.length) {
    console.log(`${id}: no frames`)
    continue
  }

  const sizes = frames.map((f) => statSync(join(dir, f)).size)
  const kept = frames.filter((_, i) => !isDropout(sizes, i))
  const lost = frames.length - kept.length

  const soft = SOFT[id]
  const width = soft?.width ?? (id === HERO ? SIZE.hero : SIZE.card)
  const run = (args) => execFileSync(FFMPEG, ['-y', '-loglevel', 'error', ...args], { stdio: 'inherit' })

  /*
   * Read the frames at the rate they will play and stop after six seconds.
   * The source was captured slowly on purpose — see the note on rate in the
   * shot definitions — so playing every frame would be a very long clip of
   * a very slow camera.
   */
  const whole = WHOLE[id]
  const span = whole ?? Math.min(SECONDS, kept.length / FPS)
  // Fast enough that the whole take lands inside the span; otherwise the rate
  // the shot was captured at.
  const inRate = whole ? Math.max(FPS, kept.length / whole) : FPS
  const scale = `scale=${width}:-2:flags=lanczos`

  /* A concat list rather than a numbered pattern, because dropping a frame
     leaves a hole in the numbering and ffmpeg stops at the first gap. It is
     written beside the frames, which are already ignored by git, rather than
     into the output folder, which ships. The captures are left alone. */
  const list = join(dir, 'frames.ffconcat')
  /* Windows hands back backslashes; the concat demuxer wants forward. */
  const abs = (f) => join(process.cwd(), dir, f).split(SEP).join('/')
  const dur = (1 / inRate).toFixed(6)
  writeFileSync(
    list,
    ['ffconcat version 1.0']
      .concat(kept.map((f) => `file '${abs(f)}'` + NL + `duration ${dur}`))
      .concat(`file '${abs(kept[kept.length - 1])}'`)
      .join(NL),
  )

  const webm = join(OUT, `${id}.webm`)
  const mp4 = join(OUT, `${id}.mp4`)
  const jpg = join(OUT, `${id}.jpg`)

  run(['-f', 'concat', '-safe', '0', '-i', list, '-t', String(span), '-r', '30',
    '-vf', scale, '-c:v', 'libvpx-vp9', '-crf', String(soft?.crf ?? 42), '-b:v', '0',
    '-row-mt', '1', '-deadline', 'good', '-cpu-used', '2', '-an',
    '-pix_fmt', 'yuv420p', webm])

  run(['-f', 'concat', '-safe', '0', '-i', list, '-t', String(span), '-r', '30',
    '-vf', scale, '-c:v', 'libx264', '-crf', String(soft ? soft.crf - 8 : 31), '-preset', 'slow', '-an',
    '-pix_fmt', 'yuv420p', '-movflags', '+faststart', mp4])

  /* A real frame from well into the take, so the poster is a build rather
     than the empty bench the clip opens on — or, for the breadth clip, the
     brand animation it now opens on, which as a still is a black rectangle. */
  run(['-i', join(dir, kept[Math.min(kept.length - 1, Math.round(kept.length * 0.6))]),
    '-vf', scale, '-q:v', '6', jpg])

  if (lost) console.log(`  ${id}: dropped ${lost} blank frame${lost === 1 ? '' : 's'}`)
  total += kb(webm) + kb(jpg)
  console.log(`${id.padEnd(14)} ${span.toFixed(1)}s  webm ${kb(webm)}K  mp4 ${kb(mp4)}K  poster ${kb(jpg)}K`)
}

console.log(`\nwebm + posters: ${total}K`)
