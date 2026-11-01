import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'

/**
 * Prints a clip's timeline as one wide picture.
 *
 * For choosing the moment a beat starts at. The cinematic clips are assembly
 * animations — they open on an empty stage and converge — so a timestamp
 * picked by reading the clip's name is a timestamp picked blind, and the
 * first cut of the ads put "A control cabinet." over four bare posts because
 * of exactly that. Look at the strip, read off the second, write it down.
 *
 *   node tools/reel/strips.mjs cine-control-cabinet
 *   node tools/reel/strips.mjs _reel4-led-display-display-build 1.5
 *
 * The second argument is the gap between samples in seconds (default 1).
 * Strips land in shots/ads/strips/.
 */

const REELS = process.env.REELS || join(homedir(), 'Videos', 'Draftrig reels')
const OUT = 'shots/ads/strips'

const FF =
  process.env.FFMPEG ??
  [
    'C:/Users/aryan/Downloads/IO_Studios_Simulator-20260902T183815Z-1-001/IO_Studios_Simulator/ffmpeg.exe',
  ].find((p) => existsSync(p)) ??
  'ffmpeg'

const [, , name, gapArg] = process.argv
if (!name) {
  console.log('usage: strips.mjs <clip name, without .mp4> [seconds between samples]')
  process.exit(1)
}
const gap = Number(gapArg ?? 1)

/* The clip may be loose in the reels folder or in one of its subfolders. */
const candidates = [`${name}.mp4`, `cinematic/${name}.mp4`, `asmr/${name}.mp4`]
const rel = candidates.find((c) => existsSync(join(REELS, c)))
if (!rel) {
  console.error(`not found in ${REELS}:\n  ${candidates.join('\n  ')}`)
  process.exit(1)
}
const src = join(REELS, rel)

/**
 * Duration in seconds.
 *
 * There is no ffprobe beside this ffmpeg, so the figure comes from ffmpeg's
 * own report of the input. Asked to describe a file and given nowhere to
 * write, it prints what we want and exits non-zero, so the command is run
 * through a shell with the failure swallowed and stderr folded into stdout.
 */
let dur = 0
{
  const said = execFileSync(`"${FF}" -hide_banner -i "${src}" 2>&1 || true`, {
    shell: true,
    encoding: 'utf8',
  })
  const m = said.match(/Duration: (\d+):(\d+):([\d.]+)/)
  if (m) dur = Number(m[1]) * 3600 + Number(m[2]) * 60 + Number(m[3])
}
if (!dur) {
  console.error('could not read the duration')
  process.exit(1)
}

const n = Math.max(1, Math.floor(dur / gap))
mkdirSync(OUT, { recursive: true })
const out = `${OUT}/${name}.png`

execFileSync(
  FF,
  [
    '-hide_banner', '-loglevel', 'error', '-y',
    '-i', src,
    '-vf', `fps=1/${gap},scale=200:-1,tile=${n}x1`,
    '-frames:v', '1',
    out,
  ],
  { stdio: 'inherit' },
)

console.log(`${rel}  ${dur.toFixed(1)}s`)
console.log(`${n} samples, one every ${gap}s — t = ${Array.from({ length: Math.min(n, 12) }, (_, i) => (i * gap).toFixed(gap % 1 ? 1 : 0)).join(', ')}${n > 12 ? ', …' : ''}`)
console.log(out)
