/**
 * The ads. Two of them, and no words until the last card.
 *
 * An earlier cut carried a burned-in caption over every beat on the theory
 * that a muted viewer needs telling what they are looking at. They do not,
 * when the footage is this literal: a desk with a monitor on it and a cable
 * running to a socket does not need a line of type explaining that it is a
 * desk. The captions covered the bottom third of a render that took real work
 * to make, and the one that tried hardest — a figure quoted over a panel
 * showing a different figure — was simply wrong. So the footage is left
 * alone, and the only words in either ad are the name and the address at the
 * end.
 *
 * That raises the bar on the footage rather than lowering it. A beat with no
 * caption has to be legible on its own, which is why the beats here are
 * longer than the captioned ones were — four to five seconds, enough for a
 * build to visibly assemble rather than merely appear.
 *
 * ## Picking a beat
 *
 * Every `at` is read off the footage, never guessed. The `cine-*` clips are
 * assembly animations: they open on an empty stage and converge, so a
 * timestamp chosen by reading the clip's name lands on bare posts. The
 * eleven-second clips finish assembling around t=7 and the longer ones around
 * t=16. `strips.mjs` prints any clip's timeline as one picture.
 */

/* ---- the room, the desk, the console. Recorded for these ads. ---- */
/* 13.4s: walls, floor, a desk against one of them, a television on another,
   and the mains running back to two sockets. */
const ROOM = 'cinematic/cine-room-setup.mp4'
/* 13.4s: one desk, and whether one socket can carry what is plugged into it.
   The extension lead and its cables land last. */
const DESK = 'cinematic/cine-desk-setup.mp4'
/* 13.4s: 45 parts and not one a circuit — extrusion, brackets, T-nuts,
   screws, a plywood shelf, and a console at its real size. */
const STAND = 'cinematic/cine-ps5-stand.mp4'

/* ---- electronics. Already in the folder. ---- */
/* 7.3s: a macro of a populated board, close enough to read as texture. */
const BOARD = '_reel1-wire-and-run-r1-hook.mp4'
/* 16.8s: an LED matrix placing itself — LEDs to t≈9, wiring to t≈13, lit
   from t≈10.5. The best footage in the folder. */
const MATRIX = '_reel4-led-display-display-build.mp4'
/* 6.7s: the 555 running, framed on the lamp. */
const LIT = '_reel1-wire-and-run-r1-run.mp4'
/* 23.4s, assembled from t≈16: a DIN rail, an LCD and a red switch behind a
   clear door. */
const CABINET = 'cinematic/cine-control-cabinet.mp4'

export const ADS = [
  {
    id: 'ad-the-setup',
    note: 'The room one: a desk, a television, the sockets, and a frame bolted round a console.',
    beats: [
      // The room builds itself around the viewer before anything is explained.
      // Not from the top: the first two seconds are an empty floor, because
      // the camera is already inside the shell when the reveal starts.
      { src: ROOM, at: 2.4, dur: 5.0 },
      // Then in to the desk, where the cable reaching the socket is the point.
      { src: DESK, at: 4.0, dur: 4.6 },
      // Then the extrusion, which is the part nobody expects a circuit tool
      // to do at all.
      { src: STAND, at: 3.6, dur: 4.4 },
      // Finished, lit, held.
      { src: STAND, at: 10.4, dur: 3.0 },
    ],
  },
  {
    id: 'ad-the-electronics',
    note: 'The electronics one: a board, a matrix laying itself out, wiring, and light.',
    beats: [
      { src: BOARD, at: 0.4, dur: 3.4 },
      { src: MATRIX, at: 2.0, dur: 4.6 },
      { src: MATRIX, at: 9.2, dur: 4.0 },
      { src: LIT, at: 1.6, dur: 3.4 },
      { src: CABINET, at: 17.4, dur: 3.2 },
    ],
  },
]
