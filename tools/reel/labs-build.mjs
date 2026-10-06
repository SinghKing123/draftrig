import { execFileSync } from 'node:child_process'
import { mkdirSync, readFileSync, existsSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'

/**
 * Encode the two lab captures as plain MP4s somebody can hand in.
 *
 * H.264 only, and no WebM: this leaves the project to be opened on whatever
 * a school runs, attached to an email, or dropped into a slide, and MP4 is
 * the one container all of those take without argument. The landing page's
 * clips are a different job and keep their own encoder.
 *
 *   FFMPEG=/path/to/ffmpeg node tools/reel/labs-build.mjs
 */

const FFMPEG = process.env.FFMPEG ?? 'ffmpeg'
const SHOT_DIR = 'shots/reel'
const OUT_DIR = process.env.LABS_DIR || join(homedir(), 'Videos', 'Draftrig labs')

const SHOTS = [
  { id: 'lab9', file: 'Lab 9 - blinking light 555.mp4' },
  { id: 'lab10', file: 'Lab 10 - what the buzz 555.mp4' },
]

mkdirSync(OUT_DIR, { recursive: true })

for (const { id, file } of SHOTS) {
  const dir = join(SHOT_DIR, id)
  const indexPath = join(dir, 'frames.json')
  if (!existsSync(indexPath)) {
    console.log(`${id}: no frames captured, skipping`)
    continue
  }
  // The recorder writes { shot, rate, crop, index: [{ file, t }] }, with the
  // timestamps already in seconds and the frames as JPEGs.
  const meta = JSON.parse(readFileSync(indexPath, 'utf8'))
  const frames = meta.index
  const seconds = frames[frames.length - 1].t - frames[0].t

  /*
   * The screencast delivers frames when it can rather than on a clock, so the
   * gaps between them are uneven. Encoding at the average rate and letting
   * ffmpeg resample to a constant 30 is what keeps the motion even; feeding
   * the timestamps through as-is produces a clip that hitches wherever the
   * capture did.
   */
  const fps = Math.max(1, frames.length / seconds)

  const out = join(OUT_DIR, file)
  execFileSync(
    FFMPEG,
    [
      '-y', '-loglevel', 'error',
      '-framerate', fps.toFixed(3),
      '-i', join(dir, 'f%05d.jpg'),
      '-vf', 'fps=30,format=yuv420p',
      '-c:v', 'libx264',
      '-preset', 'slow',
      '-crf', '20',
      // So it starts playing before it has finished downloading.
      '-movflags', '+faststart',
      out,
    ],
    { stdio: 'inherit' },
  )
  console.log(`${file}  ${frames.length} frames, ${seconds.toFixed(1)}s at ${fps.toFixed(1)} fps`)
}

console.log(`\nIn ${OUT_DIR}`)
