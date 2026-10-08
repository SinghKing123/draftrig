import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { motion, trimStill, usable, writeList } from './frames.mjs'

/**
 * Encode the build wall.
 *
 * Six tiles, each a build putting itself together. They run at once on one
 * page, so every decision here is about weight: small, short, coarsely
 * quantised, and no audio track. A tile is drawn at about 380 CSS pixels and
 * is one of six things moving, so detail is spent on nobody.
 *
 * Same frame selection as the front-page clips — dropouts out, still frames
 * out, whole take inside the span. See frames.mjs.
 *
 *   FFMPEG=/path/to/ffmpeg node tools/reel/grid-build.mjs
 */

const FFMPEG = process.env.FFMPEG ?? 'ffmpeg'
const SRC = 'shots/reel'
const OUT = 'public/grid'

/** Short, because six of them loop forever next to each other. */
const SECONDS = 5
const WIDTH = 440
const CRF = { webm: 48, mp4: 36 }

mkdirSync(OUT, { recursive: true })

const shots = readdirSync(SRC).filter((d) => d.startsWith('grid-') && existsSync(join(SRC, d)))
if (!shots.length) {
  console.log(`no grid- frame folders in ${SRC}`)
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
  const whole = usable(dir, frames)
  const kept = trimStill(whole, motion(dir, whole, run))

  const list = join(dir, 'grid.ffconcat')
  const inRate = Math.max(12, kept.length / SECONDS)
  writeList(list, dir, kept, (1 / inRate).toFixed(6))

  const scale = `scale=${WIDTH}:-2:flags=lanczos`
  const webm = join(OUT, `${id}.webm`)
  const mp4 = join(OUT, `${id}.mp4`)
  const jpg = join(OUT, `${id}.jpg`)

  run(['-f', 'concat', '-safe', '0', '-i', list, '-t', String(SECONDS), '-r', '24',
    '-vf', scale, '-c:v', 'libvpx-vp9', '-crf', String(CRF.webm), '-b:v', '0',
    '-row-mt', '1', '-deadline', 'good', '-cpu-used', '3', '-an',
    '-pix_fmt', 'yuv420p', webm])

  run(['-f', 'concat', '-safe', '0', '-i', list, '-t', String(SECONDS), '-r', '24',
    '-vf', scale, '-c:v', 'libx264', '-crf', String(CRF.mp4), '-preset', 'slow', '-an',
    '-pix_fmt', 'yuv420p', '-movflags', '+faststart', mp4])

  /* The poster is the finished build, not the empty bench the take opens on,
     so a tile that has not started playing still shows something. */
  run(['-i', join(dir, kept[kept.length - 1]), '-vf', scale, '-q:v', '6', jpg])

  const cut = whole.length - kept.length
  console.log(
    `${id.padEnd(18)} ${String(kept.length).padStart(4)} frames` +
      `${cut ? ` (${cut} still cut)` : ''}  webm ${kb(webm)}K  mp4 ${kb(mp4)}K  poster ${kb(jpg)}K`,
  )
  total += kb(webm) + kb(jpg)
}

console.log(`\nwebm + posters: ${total}K`)
