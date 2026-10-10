import { readFileSync, statSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

/**
 * Choosing which captured frames are worth encoding.
 *
 * Shared by the front-page clips and the build wall, which have the same two
 * problems: the screencast drops the occasional blank frame, and a shot
 * performed slowly spends real time doing nothing at all.
 */

const NL = String.fromCharCode(10)
const SEP = String.fromCharCode(92)

/** Windows hands back backslashes; the concat demuxer wants forward. */
export const abs = (dir, f) => join(process.cwd(), dir, f).split(SEP).join('/')

/**
 * A concat list, which is how ffmpeg is given an arbitrary set of frames.
 *
 * A numbered pattern cannot be used once anything is dropped: it stops at
 * the first gap in the numbering.
 */
export function writeList(path, dir, frames, dur) {
  writeFileSync(
    path,
    ['ffconcat version 1.0']
      .concat(frames.map((f) => `file '${abs(dir, f)}'` + NL + `duration ${dur}`))
      .concat(`file '${abs(dir, frames[frames.length - 1])}'`)
      .join(NL),
  )
}

/**
 * Frames the capture dropped on the floor.
 *
 * The screencast occasionally hands back a blank frame under load — always
 * byte-identical, always a single frame with ordinary ones either side.
 * Left in, each one is a black flash in the middle of a shot.
 *
 * Size alone cannot find them, because a brand animation or an unlit bench
 * is legitimately small and dark for a second at a time. What separates a
 * dropout from a dark shot is that a dropout is isolated: far smaller than
 * the frame before it and the frame after it, both.
 */
export const isDropout = (sz, i) =>
  i > 0 && i < sz.length - 1 && sz[i] < 0.3 * Math.min(sz[i - 1], sz[i + 1])

/** Everything in a shot folder, with the dropouts taken out. */
export function usable(dir, frames) {
  const sizes = frames.map((f) => statSync(join(dir, f)).size)
  return frames.filter((_, i) => !isDropout(sizes, i))
}

/**
 * How much each frame differs from the one before it.
 *
 * Decoded once at 32x18 in grey, which is enough to tell a camera that is
 * moving from one that is parked and costs a single pass over the take.
 */
export function motion(dir, frames, run) {
  const W = 32
  const H = 18
  const PX = W * H
  const list = join(dir, 'motion.ffconcat')
  const raw = join(dir, 'motion.gray')
  writeList(list, dir, frames, '0.04')
  run(['-f', 'concat', '-safe', '0', '-i', list, '-vf', `scale=${W}:${H},format=gray`, '-f', 'rawvideo', raw])

  const buf = readFileSync(raw)
  const n = Math.floor(buf.length / PX)
  const diff = [0]
  for (let i = 1; i < n; i++) {
    let d = 0
    for (let p = 0; p < PX; p++) d += Math.abs(buf[i * PX + p] - buf[(i - 1) * PX + p])
    diff.push(d / PX)
  }
  while (diff.length < frames.length) diff.push(0)
  return diff
}

/**
 * Drop the frames where nothing is happening.
 *
 * Judged against the shot's own motion rather than a fixed number. These are
 * slow-motion captures: a frame that is plainly moving differs from the one
 * before it by a fraction of a grey level, and one absolute threshold called
 * ninety-nine per cent of every clip still.
 *
 * Both ends go entirely — a clip that opens on a parked camera has already
 * lost the viewer — and a long pause in the middle comes down to a couple of
 * frames rather than vanishing, so a deliberate beat still reads as one
 * instead of becoming a jump cut.
 *
 * A shot that loses most of itself is handed back untouched. The threshold
 * is a fraction of the shot's own median, which assumes the median frame is
 * moving — true of a camera circling a board, false of one creeping around a
 * half-metre machine from a metre and a half away, where a real frame moves
 * less than a grey level at the size this samples. That shot came back as
 * twelve frames of eleven hundred and a three-kilobyte clip. Losing more
 * than two thirds means the measurement was wrong, not the footage.
 */
export function trimStill(frames, diff) {
  const sorted = [...diff].slice(1).sort((a, b) => a - b)
  const median = sorted[Math.floor(sorted.length / 2)] ?? 0
  const thr = Math.max(0.05, median * 0.4)

  let lead = 1
  while (lead < frames.length && diff[lead] < thr) lead++
  let end = frames.length - 1
  while (end > lead && diff[end] < thr) end--

  const out = []
  let run = 0
  for (let i = Math.max(0, lead - 1); i <= end; i++) {
    if (diff[i] < thr) {
      run++
      if (run > 2) continue
    } else {
      run = 0
    }
    out.push(frames[i])
  }
  return out.length > 8 && out.length > frames.length * 0.33 ? out : frames
}
