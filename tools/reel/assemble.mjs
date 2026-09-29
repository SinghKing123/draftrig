import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { basename, join } from 'node:path'

/**
 * Turns recorded frame folders into a finished reel.
 *
 * Every shot arrives as loose jpegs plus the timestamp each one was painted
 * at. That is deliberately not a video: the capture runs at whatever rate it
 * manages, and the shots are performed slowly so that rate stops mattering.
 * Here the frames are laid back onto a constant grid at their real speed, cut
 * to 9:16, and joined.
 */

const FF = process.env.FFMPEG ?? 'ffmpeg'
const W = 1080
const H = 1920
const FPS = 30

const run = (args) => execFileSync(FF, ['-hide_banner', '-loglevel', 'error', '-y', ...args], { stdio: 'inherit' })

/**
 * A shot, retimed and framed.
 *
 * The concat demuxer takes a duration per frame, so retiming is a division
 * rather than a filter: a shot performed at quarter speed has every gap
 * quartered on the way in and comes out at life speed.
 */
function clip(dir, out, { fade = 0 } = {}) {
  const meta = JSON.parse(readFileSync(join(dir, 'frames.json'), 'utf8'))
  const { index, rate, crop } = meta
  if (index.length < 2) throw new Error(`${dir}: too few frames`)

  const lines = ['ffconcat version 1.0']
  for (let i = 0; i < index.length - 1; i++) {
    lines.push(`file '${index[i].file}'`)
    lines.push(`duration ${((index[i + 1].t - index[i].t) / rate).toFixed(6)}`)
  }
  // The concat demuxer ignores the final entry's duration, so it is repeated.
  lines.push(`file '${index[index.length - 1].file}'`)
  lines.push(`duration 0.04`)
  lines.push(`file '${index[index.length - 1].file}'`)
  writeFileSync(join(dir, 'list.txt'), lines.join('\n'))

  const span = (index[index.length - 1].t - index[0].t) / rate

  /*
   * Framing. A portrait shot is already 9:16 and only needs a scale; a
   * landscape one is punched in on the part of the screen the action is in,
   * which is how software is shot for this format — the whole window scaled
   * into a phone frame is unreadable and looks like a screenshot of a desktop.
   */
  const filters = []
  if (crop) filters.push(`crop=${crop.w}:${crop.h}:${crop.x}:${crop.y}`)
  filters.push(`scale=${W}:${H}:flags=lanczos:force_original_aspect_ratio=increase`)
  filters.push(`crop=${W}:${H}`)
  if (fade) {
    filters.push(`fade=t=in:st=0:d=${fade}`)
    filters.push(`fade=t=out:st=${Math.max(0, span - fade).toFixed(3)}:d=${fade}`)
  }
  filters.push(`format=yuv420p`)

  run([
    '-f', 'concat', '-safe', '0', '-i', join(dir, 'list.txt'),
    '-vf', filters.join(','),
    '-r', String(FPS),
    '-c:v', 'libx264', '-preset', 'slow', '-crf', '17', '-pix_fmt', 'yuv420p',
    '-an',
    out,
  ])
  return span
}

/** Join finished clips end to end, re-encoding once so the cuts are clean. */
function join_(clips, out) {
  // The concat demuxer resolves each entry against the list file's own
  // directory, so the entries are bare names rather than the paths handed in.
  const list = clips.map((c) => `file '${basename(c)}'`).join('\n')
  const listPath = out + '.txt'
  writeFileSync(listPath, list)
  run([
    '-f', 'concat', '-safe', '0', '-i', listPath,
    '-c:v', 'libx264', '-preset', 'slow', '-crf', '18', '-pix_fmt', 'yuv420p',
    '-r', String(FPS),
    '-an',
    '-movflags', '+faststart',
    out,
  ])
}

/**
 * Footage of the real thing, if any has been dropped in.
 *
 * The opening of each reel is a slot rather than a fixed shot. Filled from
 * broll/<reel id>/, in filename order, with each clip cut to an equal share of
 * the opening and scaled to fill the frame; left empty, the macro shot that
 * was recorded for it plays instead. Whatever is put there has to be licensed
 * for commercial use — a phone on your own bench is the best answer, and the
 * safest.
 */
function broll(reelId, seconds, outDir) {
  const dir = join('broll', reelId)
  if (!existsSync(dir)) return []
  const files = readdirSync(dir).filter((f) => /\.(mp4|mov|m4v|webm)$/i.test(f)).sort()
  if (!files.length) return []

  const each = seconds / files.length
  return files.map((f, i) => {
    const out = join(outDir, `_${reelId}-broll${i}.mp4`)
    run([
      '-i', join(dir, f),
      '-t', String(each),
      '-vf', [
        `scale=${W}:${H}:flags=lanczos:force_original_aspect_ratio=increase`,
        `crop=${W}:${H}`,
        `fps=${FPS}`,
        'format=yuv420p',
      ].join(','),
      '-c:v', 'libx264', '-preset', 'slow', '-crf', '18', '-pix_fmt', 'yuv420p', '-an',
      out,
    ])
    console.log(`  broll ${f}: ${each.toFixed(2)}s`)
    return out
  })
}

export function assemble(reel, shotsDir, outDir) {
  mkdirSync(outDir, { recursive: true })
  const parts = []
  let total = 0

  // Real footage, where there is any, stands in for the opening shot.
  const opening = broll(reel.id, reel.openSeconds ?? 8, outDir)
  const shots = opening.length ? reel.shots.slice(1) : reel.shots
  parts.push(...opening)

  for (const s of shots) {
    const dir = join(shotsDir, s.id)
    if (!existsSync(join(dir, 'frames.json'))) throw new Error(`not recorded: ${s.id}`)
    const out = join(outDir, `_${reel.id}-${s.id}.mp4`)
    const span = clip(dir, out, { fade: s.fade ?? 0 })
    parts.push(out)
    total += span
    console.log(`  ${s.id}: ${span.toFixed(2)}s`)
  }
  const final = join(outDir, `${reel.id}.mp4`)
  join_(parts, final)
  console.log(`${reel.id}: ${total.toFixed(1)}s -> ${final}`)
  return final
}
