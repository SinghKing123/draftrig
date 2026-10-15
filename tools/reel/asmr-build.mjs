import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { homedir } from 'node:os'
import { usable, writeList } from './frames.mjs'

/**
 * Encode the assembly takes.
 *
 * These are meant to be watched rather than looped behind something, so
 * they are not quantised into the ground the way the page's decoration is:
 * a build is mostly fine detail — pin headers, screw heads, a wire landing
 * in a hole — and that detail is the whole appeal.
 *
 * MP4 first here, because the places these go want H.264 and many of them
 * will not take WebM at all.
 *
 *   FFMPEG=/path/to/ffmpeg node tools/reel/asmr-build.mjs
 */

const FFMPEG = process.env.FFMPEG ?? 'ffmpeg'
const SRC = 'shots/reel'

/*
 * These do not ship with the site.
 *
 * They are for posting, not for the page, and seven megabytes of video
 * nothing links to is seven megabytes in every deploy. They go where the
 * reels go, which is the folder the operating system already keeps videos
 * in; REELS_DIR overrides it.
 */
const OUT = join(process.env.REELS_DIR || join(homedir(), 'Videos', 'Draftrig reels'), 'asmr')

/** Seconds per take, and the size they go out at. */
const SECONDS = 8
const SIZE = 1000
const FPS = 30

mkdirSync(OUT, { recursive: true })

const shots = readdirSync(SRC).filter((d) => d.startsWith('asmr-') && existsSync(join(SRC, d)))
if (!shots.length) {
  console.log(`no asmr- frame folders in ${SRC}`)
  process.exit(0)
}

const kb = (f) => Math.round(statSync(f).size / 1024)
let total = 0

for (const id of shots) {
  const dir = join(SRC, id)
  const frames = readdirSync(dir).filter((f) => f.startsWith('f') && f.endsWith('.jpg')).sort()
  if (!frames.length) {
    console.log(`${id}: no frames`)
    continue
  }

  const run = (args) => execFileSync(FFMPEG, ['-y', '-loglevel', 'error', ...args], { stdio: 'inherit' })
  /*
   * Dropouts out, still frames kept.
   *
   * The page's clips drop frames where nothing is happening, because a
   * drifting camera makes a pause look like a stall. Here the camera is
   * parked and the pauses between parts landing are the rhythm of the
   * thing — cutting them took a hundred and fifty frames down to sixty and
   * turned a build into a slideshow.
   */
  const kept = usable(dir, frames)

  const list = join(dir, 'asmr.ffconcat')
  /* Spread whatever was captured across the whole span. `max(FPS, …)` was
     backwards: with fewer frames than FPS·SECONDS it fed them at thirty a
     second and the take ended a third of the way in. */
  const inRate = kept.length / SECONDS
  writeList(list, dir, kept, (1 / inRate).toFixed(6))

  const scale = `scale=${SIZE}:${SIZE}:force_original_aspect_ratio=increase,crop=${SIZE}:${SIZE}`
  const mp4 = join(OUT, `${id}.mp4`)
  const jpg = join(OUT, `${id}.jpg`)

  run(['-f', 'concat', '-safe', '0', '-i', list, '-t', String(SECONDS), '-r', String(FPS),
    '-vf', scale, '-c:v', 'libx264', '-crf', '21', '-preset', 'slow', '-an',
    '-pix_fmt', 'yuv420p', '-movflags', '+faststart', mp4])

  // The finished build, for a thumbnail.
  run(['-i', join(dir, kept[kept.length - 1]), '-vf', scale, '-q:v', '4', jpg])

  const lost = frames.length - kept.length
  console.log(
    `${id.padEnd(18)} ${String(kept.length).padStart(4)} frames` +
      `${lost ? ` (${lost} blank dropped)` : ''}  mp4 ${kb(mp4)}K  poster ${kb(jpg)}K`,
  )
  total += kb(mp4)
}

console.log(`\n${shots.length} takes, ${total}K of video, in ${OUT}`)
