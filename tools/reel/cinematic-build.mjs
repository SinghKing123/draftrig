import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { homedir } from 'node:os'
import { usable, writeList } from './frames.mjs'

/**
 * Encode the cinematic assemblies.
 *
 * Portrait, H.264, and a lower CRF than the page's decoration gets: the
 * subject is fine hardware against a dark bench, which is where banding and
 * mosquito noise show up first.
 *
 * Still frames are kept. The camera is moving the whole way through these, so
 * there is no such thing as a frame where nothing is happening — the
 * dropped-frame pass is only there to catch the capture's own blanks.
 *
 *   FFMPEG=/path/to/ffmpeg node tools/reel/cinematic-build.mjs
 */

const FFMPEG = process.env.FFMPEG ?? 'ffmpeg'
const SRC = 'shots/reel'

/*
 * These do not ship with the site: they are for posting, and nothing on the
 * page links them. REELS_DIR overrides the folder.
 */
const OUT = join(process.env.REELS_DIR || join(homedir(), 'Videos', 'Draftrig reels'), 'cinematic')

const SECONDS = 11
const W = 1080
const H = 1920
const FPS = 30

mkdirSync(OUT, { recursive: true })

const shots = readdirSync(SRC).filter((d) => d.startsWith('cine-') && existsSync(join(SRC, d)))
if (!shots.length) {
  console.log(`no cine- frame folders in ${SRC}`)
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
  const kept = usable(dir, frames)

  const list = join(dir, 'cine.ffconcat')
  const inRate = kept.length / SECONDS
  writeList(list, dir, kept, (1 / inRate).toFixed(6))

  const scale = `scale=${W}:${H}:force_original_aspect_ratio=increase,crop=${W}:${H}`
  const mp4 = join(OUT, `${id}.mp4`)
  const jpg = join(OUT, `${id}.jpg`)

  run(['-f', 'concat', '-safe', '0', '-i', list, '-t', String(SECONDS), '-r', String(FPS),
    '-vf', scale, '-c:v', 'libx264', '-crf', '20', '-preset', 'slow', '-an',
    '-pix_fmt', 'yuv420p', '-movflags', '+faststart', mp4])

  // The finished build, for a thumbnail.
  run(['-i', join(dir, kept[kept.length - 1]), '-vf', scale, '-q:v', '3', jpg])

  const lost = frames.length - kept.length
  console.log(
    `${id.padEnd(18)} ${String(kept.length).padStart(4)} frames` +
      `${lost ? ` (${lost} blank dropped)` : ''}  mp4 ${kb(mp4)}K  poster ${kb(jpg)}K`,
  )
  total += kb(mp4)
}

console.log(`\n${shots.length} takes, ${total}K of video, in ${OUT}`)
