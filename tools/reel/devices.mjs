import { cineTake } from './cinematic.mjs'

/**
 * The two long ones: a device assembling itself, start to finish.
 *
 * `cinematic.mjs` shoots a build in eleven seconds, which is long enough for
 * a frame or a board and not long enough for a thing with a lid. These are
 * twice that, because the subject is the whole sequence — base, posts, the
 * gear that has to go in before the walls do, the loom, the walls, the cap —
 * and cutting any of it out leaves a box that was already a box.
 *
 * Wires are woven rather than saved for the end. On a bare board the loom
 * arriving all at once is the payoff; in a case it means the harness appears
 * after the lid has closed over it. Woven, every wire lands a moment after
 * the second of the two things it joins, so the inside is finished before
 * anything covers it.
 *
 *   npm run dev
 *   BASE=http://localhost:5173 node tools/reel/run.mjs record cine-desk-terminal
 *   node tools/reel/cinematic-build.mjs
 */

/*
 * Four legs and a drift, over about twenty-two seconds.
 *
 * Low and close while the base and the posts go down, up and back through
 * the middle of it where there is most to see, round to the other side as
 * the walls arrive, and in over the front for the last beat — which is where
 * the screen is, and the screen is the only thing still happening by then.
 *
 * Distance is the arithmetic from cinematic.mjs, and it is the thing worth
 * checking twice: in portrait the frame is only 0.366 of the camera distance
 * across. The terminal is 190 by 130, so 230 on its horizontal diagonal, and
 * that needs 630 to sit inside the frame however it is turned; the first cut
 * of this was shot at 430 and the base plate alone overflowed the picture.
 * The legs run at about 0.9 to 1.1 of that figure — a little inside it where
 * the camera is square to a face, a little outside on the corners.
 *
 * The legs add up to the assembly rather than to a round number: the camera
 * and the parts run together and the clip is as long as the slower of them,
 * so 21 seconds of moves against 21 seconds of building is the one pairing
 * where neither waits for the other and the length the encoder derives is
 * the length the shot actually is.
 *
 * Captured at a sixth speed. The screencast manages under seven frames a
 * second on a populated bench at 1080 by 1920 — a quarter speed left 27
 * effective frames a second against the 30 the clip is encoded at, so one
 * frame in ten was a duplicate and the camera moved in steps. A sixth gives
 * about 40, which is more than the format needs.
 */
const RATE = 6

export const DEVICE_SHOTS = [
  /*
   * The terminal. A hundred and sixty-five tall on a 150 by 130 footprint,
   * so the middle of it is about 85 up and the whole thing fits a portrait
   * frame without the dead band a flat build leaves.
   */
  cineTake(
    'desk-terminal',
    'desk-terminal',
    [0, 95, 0],
    [30, 74, 600],
    [
      [62, 64, 640, 5200],
      [10, 56, 700, 5200],
      [-40, 60, 660, 5200],
      [-6, 68, 580, 5400],
    ],
    { rise: 70, partWin: 17.4, hold: 2.6, weave: true, rate: RATE, drift: [4, 2400], simDt: 1e-4 },
  ),

  /*
   * The cabinet. Wider — 240 by 160, so 288 on the diagonal and 790 to
   * contain it — and the last leg comes in on the door rather than on the
   * whole box.
   */
  cineTake(
    'control-cabinet',
    'control-cabinet',
    [0, 100, 0],
    [26, 76, 780],
    [
      [55, 66, 820, 5200],
      [8, 58, 880, 5200],
      [-46, 62, 840, 5200],
      [-8, 70, 750, 5400],
    ],
    { rise: 95, partWin: 17.4, hold: 2.6, weave: true, rate: RATE, drift: [4, 2400], simDt: 1e-4 },
  ),
]
