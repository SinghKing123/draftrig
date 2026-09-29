import { record } from './record.mjs'
import { assemble } from './assemble.mjs'
import { REELS, SHOTS } from './reels.mjs'

/**
 * node tools/reel/run.mjs record [shotId...]   capture frames
 * node tools/reel/run.mjs build  [reelId...]   assemble what has been captured
 * node tools/reel/run.mjs all                  both
 */
const [, , cmd, ...rest] = process.argv
const SHOT_DIR = 'shots/reel'
const OUT_DIR = 'reels'

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
}
if (!cmd) console.log('usage: run.mjs record|build|all [ids...]')
