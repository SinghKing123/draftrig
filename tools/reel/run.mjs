import { homedir } from 'node:os'
import { join } from 'node:path'
import { record } from './record.mjs'
import { assemble } from './assemble.mjs'
import { REELS, SHOTS } from './reels.mjs'

/**
 * node tools/reel/run.mjs record [shotId...]   capture frames
 * node tools/reel/run.mjs build  [reelId...]   assemble what has been captured
 * node tools/reel/run.mjs all                  both
 */
const [, , cmd, ...rest] = process.argv

/**
 * Frames stay in the project. They are working files — a few hundred PNGs per
 * shot, hundreds of megabytes a reel — and they are only ever read by the
 * assemble step that sits beside them.
 */
const SHOT_DIR = 'shots/reel'

/**
 * Finished reels do not.
 *
 * They are the one output of this whole directory that a person actually
 * opens, and burying them inside a source tree inside Downloads means going
 * looking for them every time. They go to the folder the operating system
 * already keeps videos in, and `REELS_DIR` overrides it for anyone who
 * disagrees.
 */
const OUT_DIR = process.env.REELS_DIR || join(homedir(), 'Videos', 'Draftrig reels')

const wanted = (list, ids, key = 'id') =>
  ids.length ? list.filter((x) => ids.some((i) => x[key].includes(i))) : list

if (cmd === 'record' || cmd === 'all') {
  for (const shot of wanted(SHOTS, rest)) {
    await record(shot, `${SHOT_DIR}/${shot.id}`)
  }
}
if (cmd === 'build' || cmd === 'all') {
  for (const reel of wanted(REELS, rest)) {
    assemble(reel, SHOT_DIR, OUT_DIR)
  }
  console.log(`\nreels are in ${OUT_DIR}`)
}
if (!cmd) console.log('usage: run.mjs record|build|all [ids...]')
