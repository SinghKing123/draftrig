import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, readdirSync, statSync } from 'node:fs'
import { motion, trimStill, usable, writeList } from './frames.mjs'
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
 * How long each clip runs, with the whole take inside it.
 *
 * Every one of these used to be the first six seconds of a recording that
 * went on for fifty — the shots are captured in slow motion on purpose, so
 * six seconds of them was the opening of an action and never the end of it.
 * Whatever each clip was doing when it stopped, it was still doing.
 *
 * Now the frames are fed in fast enough that the entire recording lands
 * inside the span. The clip plays complete and quick instead of whole and
 * cut short, and the number is a ceiling on weight as much as on time.
 */
const WHOLE = {
  'clip-assemble': 7,
  'clip-run': 6,
  'clip-wire': 7,
  'clip-builds': 9,
  'clip-bg': 12,
}

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

/**
 * The hero is shown full width; the cards never exceed about 420 CSS pixels.
 *
 * Both came down when the clips started playing their whole take instead of
 * the first six seconds. A complete take is far more distinct content than a
 * slow opening, and at the old size and quantiser the five of them came to
 * four megabytes — on a page whose entire argument is that it loads. These
 * are still comfortably over the pixels they are drawn into.
 */
const SIZE = { hero: 1100, card: 820 }
const CRF = { webm: 46, mp4: 34 }
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

  const whole1 = usable(dir, frames)
  const lost = frames.length - whole1.length

  const soft = SOFT[id]
  const width = soft?.width ?? (id === HERO ? SIZE.hero : SIZE.card)
  const run = (args) => execFileSync(FFMPEG, ['-y', '-loglevel', 'error', ...args], { stdio: 'inherit' })

  const kept = trimStill(whole1, motion(dir, whole1, run))
  const still = whole1.length - kept.length

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
  const dur = (1 / inRate).toFixed(6)
  writeList(list, dir, kept, dur)

  const webm = join(OUT, `${id}.webm`)
  const mp4 = join(OUT, `${id}.mp4`)
  const jpg = join(OUT, `${id}.jpg`)

  run(['-f', 'concat', '-safe', '0', '-i', list, '-t', String(span), '-r', '30',
    '-vf', scale, '-c:v', 'libvpx-vp9', '-crf', String(soft?.crf ?? CRF.webm), '-b:v', '0',
    '-row-mt', '1', '-deadline', 'good', '-cpu-used', '2', '-an',
    '-pix_fmt', 'yuv420p', webm])

  run(['-f', 'concat', '-safe', '0', '-i', list, '-t', String(span), '-r', '30',
    '-vf', scale, '-c:v', 'libx264', '-crf', String(soft ? soft.crf - 8 : CRF.mp4), '-preset', 'slow', '-an',
    '-pix_fmt', 'yuv420p', '-movflags', '+faststart', mp4])

  /* A real frame from well into the take, so the poster is a build rather
     than the empty bench the clip opens on — or, for the breadth clip, the
     brand animation it now opens on, which as a still is a black rectangle. */
  run(['-i', join(dir, kept[Math.min(kept.length - 1, Math.round(kept.length * 0.6))]),
    '-vf', scale, '-q:v', '6', jpg])

  if (lost) console.log(`  ${id}: dropped ${lost} blank frame${lost === 1 ? '' : 's'}`)
  if (still) console.log(`  ${id}: cut ${still} still frames of ${whole1.length}`)
  total += kb(webm) + kb(jpg)
  console.log(`${id.padEnd(14)} ${span.toFixed(1)}s  webm ${kb(webm)}K  mp4 ${kb(mp4)}K  poster ${kb(jpg)}K`)
}

console.log(`\nwebm + posters: ${total}K`)
