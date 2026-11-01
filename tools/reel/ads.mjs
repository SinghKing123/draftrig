/**
 * The ads.
 *
 * An ad is not the same thing as the reels beside it. A reel is footage of
 * the tool being worked and it can afford to be admired in silence; an ad has
 * to say what the thing is to somebody who has never heard of it, who is
 * scrolling, and whose phone is muted. So three things are true here that are
 * not true of `reels.mjs`:
 *
 * - **It is cut from footage that already exists.** Every source below is a
 *   finished clip in the reels folder, so making an ad costs a minute of
 *   ffmpeg rather than fifteen of recording and a few gigabytes of frames.
 * - **It carries words.** Burned in, because captions on the platform are
 *   optional, late and ugly, and because nobody has the sound on.
 * - **It ends on the address.** An ad that does not say where to go is a
 *   showreel.
 *
 * Beats are short on purpose. Three and a half seconds is long enough to read
 * six words and see one thing happen, and a beat that outstays that is where
 * the thumb moves on.
 *
 * ## Two rules that cost a rebuild to learn
 *
 * **Every `at` is read off the footage, not guessed.** The `cine-*` clips are
 * assembly animations: they open on an empty stage and converge. The first
 * cut of these took the captions at face value and put "A control cabinet."
 * over four bare posts, because at 3.4 seconds the cabinet is still four bare
 * posts. The eleven-second clips finish assembling around t=7 and the
 * twenty-three-second ones around t=16, so anything that claims to show a
 * finished object starts after that. `tools/reel/strips.mjs` prints the
 * timeline of any clip if a new one needs placing.
 *
 * **Every `spec` is readable off the frame it sits on.** The same first cut
 * put "34 items · 11.18 kg · $214.74" over a bill of materials panel that
 * plainly read 22 items, 165.6 g and $37.89 — the arcade cabinet's figures
 * over the bench clock's panel. In an ad whose whole claim is that the costing
 * is real, a number that disagrees with the picture behind it is the worst
 * sentence on the screen. If the figure is not in the frame or not true of the
 * thing in the frame, the beat has no `spec`.
 */

/** The clips these are cut from, relative to the reels folder. */
const R1_HOOK = '_reel1-wire-and-run-r1-hook.mp4'
const R1_WIRE = '_reel1-wire-and-run-r1-wire.mp4'
const R1_RUN = '_reel1-wire-and-run-r1-run.mp4'
const R3_HOOK = '_reel3-bill-of-materials-r3-hook.mp4'
const R3_BOM = '_reel3-bill-of-materials-r3-bom.mp4'
const R4_DISPLAY = '_reel4-led-display-display-build.mp4'
/* 23.4s, assembled from t≈16: a DIN rail, an LCD and a red switch behind a
   clear door. */
const CABINET = 'cinematic/cine-control-cabinet.mp4'
/* 11s, assembled from t≈7: two white decks on standoffs over a row of cells. */
const STACK = 'cinematic/cine-control-stack.mp4'
/* 11s, assembled from t≈7: a black 2020 frame carrying a motor and a board. */
const THRUST = 'cinematic/cine-thrust-rig.mp4'
/* 11s, assembled from t≈7: a 2020 gantry over a ply bed. */
const ROUTER = 'cinematic/cine-cnc-router.mp4'

/**
 * Copy is the page's register, shortened.
 *
 * Specification where there is a number to give, plain statement where there
 * is not, and never a sentence that argues with the reader. `lead` is read in
 * about a second at this size; `spec` is the line under it and is the one
 * that carries the fact.
 */
export const ADS = [
  {
    id: 'ad-run-it',
    note: 'The promise: wire it, switch it on, watch it work.',
    beats: [
      { src: R1_HOOK, at: 0.2, dur: 3.1, lead: 'Run it before\nyou build it.' },
      { src: R1_WIRE, at: 1.1, dur: 3.5, lead: 'Wire it pin to pin.', spec: 'In 3D · length in mm' },
      { src: R1_RUN, at: 1.4, dur: 3.6, lead: 'It actually runs.', spec: 'Modified nodal analysis' },
    ],
  },
  {
    id: 'ad-what-it-costs',
    note: 'The bill of materials: the thing no other 3D tool gives you.',
    beats: [
      { src: R3_HOOK, at: 0.6, dur: 3.0, lead: 'Every part.\nEvery screw.' },
      // The figures the panel in this very frame is showing.
      { src: R3_BOM, at: 1.2, dur: 3.6, lead: 'Priced and weighed.', spec: '22 items · 165.6 g · $37.89' },
      { src: CABINET, at: 17.2, dur: 3.4, lead: 'Know the cost\nbefore you order.' },
    ],
  },
  {
    id: 'ad-the-whole-build',
    note: 'Structure, not just circuits. Frames, enclosures and the parts inside.',
    beats: [
      { src: THRUST, at: 6.8, dur: 3.3, lead: 'Not just\nthe circuit.', spec: '2020 extrusion · brackets' },
      { src: CABINET, at: 16.6, dur: 3.3, lead: 'The enclosure too.', spec: 'DIN rail · clear door' },
      { src: STACK, at: 7.2, dur: 3.3, lead: 'And everything\ninside it.', spec: 'Panels · standoffs · cells' },
    ],
  },
  {
    id: 'ad-watch-it-build',
    note: 'The hypnotic one. A matrix placing itself, wired, then lit. No interface.',
    beats: [
      { src: R4_DISPLAY, at: 1.6, dur: 4.0, lead: 'An LED matrix,\none at a time.' },
      { src: R4_DISPLAY, at: 9.0, dur: 3.6, lead: 'Then the wiring.' },
      { src: R4_DISPLAY, at: 12.8, dur: 3.8, lead: 'Then switch it on.', spec: 'Panels decode the real bus' },
    ],
  },
  {
    id: 'ad-what-you-can-make',
    note: 'Range. Four very different builds, so nobody thinks it does one thing.',
    beats: [
      { src: ROUTER, at: 6.8, dur: 2.7, lead: 'A router.' },
      { src: CABINET, at: 17.6, dur: 2.7, lead: 'A control cabinet.' },
      { src: THRUST, at: 7.2, dur: 2.7, lead: 'A thrust rig.' },
      /*
       * The payoff is the lit matrix rather than the desk terminal it used to
       * be. The terminal is a grey box with an LCD in it and so is the
       * cabinet two beats earlier — in an ad whose whole argument is range,
       * closing on something that looks like a shot already shown is the one
       * mistake it cannot afford. This is red, lit and unlike anything above.
       */
      { src: R4_DISPLAY, at: 14.2, dur: 3.4, lead: 'All of it\nin one tool.', spec: '194 parts · 34 builds' },
    ],
  },
]
