# Reels

Vertical video for Instagram, cut from the editor itself. 1080 × 1920, 30 fps,
H.264, no sound and no captions.

| Reel | What it shows |
| --- | --- |
| `reel1-wire-and-run` | Terminal to terminal, then switch it on |
| `reel2-parts-and-values` | Search a value, get the part; change the value, the part changes |
| `reel3-bill-of-materials` | What the build costs, and the CSV to order from |
| `reel4-led-display` | An LED matrix building itself, and lighting up |

The first three are three beats each: an opening with no interface in it, the
tool being worked, and a payoff. Twenty seconds does not hold more than three
ideas.

`still.mjs` shoots the same build as a photograph — whole, lit, framed so the
board, the matrix, the resistors and the controller are all in one picture. It
is 4:5, the tallest a still can be in a feed without being cropped, and it
pauses the chase on a row near the front: left to run, the shutter usually
falls on the backmost row, which sits behind the wire bundle.

```bash
BASE=http://localhost:5173 node tools/reel/still.mjs
```

The fourth reel is a different thing — one continuous take, no interface at all,
and nothing in it is a recording of somebody working. See
`display.mjs`: the document is staged complete and hidden, then revealed part
by part on a schedule while the camera moves, so the build assembles itself.
Sixty-five wires is not something to place with a mouse, and a shot that is
meant to look composed should not depend on how steady a hand was on the day.

## Making them

```bash
npm run dev                                   # the shots import the part kernel
BASE=http://localhost:5173 node tools/reel/run.mjs record
FFMPEG=/path/to/ffmpeg node tools/reel/run.mjs build
```

`record` drives the editor and writes frames to `shots/reel/<shot>/`; `build`
retimes them and writes the finished reel. Either takes shot or reel ids to do
part of the job: `run.mjs record r1-` does the first reel's shots.

Finished reels go to **`~/Videos/Draftrig reels`**, not into the project. They
are the one thing here anybody opens, and hunting for them inside a source
tree inside Downloads got old. `REELS_DIR` overrides it:

```bash
REELS_DIR=/d/clips node tools/reel/run.mjs build
```

The frames stay in `shots/reel/` — hundreds of megabytes a reel of working
files that only `build` ever reads, and nothing outside this directory wants.

Recording all nine shots takes about fifteen minutes. Nothing is real time —
see below.

## Why the shots are performed slowly

Chrome's screencast returns the frames the page actually painted, and at full
render quality on a 1080 × 1920 canvas that is seven or eight a second. Far
too few.

So nothing is performed at its finished speed. Every shot carries a `rate`,
every camera move and every pointer move is stretched by it, and the assembler
divides the timestamps back down on the way out. At `rate: 4`, eight captured
frames a second become thirty-two. The simulation is slowed by the same factor
when the shot starts, so a circuit still runs at its own rate in the finished
clip.

Two consequences worth knowing:

- **The pointer has to be stretched too.** It was not at first, and it crossed
  the screen five times too fast in the finished clip — the one thing in frame
  that gave away that the video had been retimed.
- **Round trips are expensive.** The page is painting slowly, so anything that
  waits on it costs real time. Stepping the pointer from here took over a
  minute of capture for three wires; it is tweened inside the page now, and
  anything a shot needs to look up happens in `prepare`, before the recorder
  starts, so the finished clip never stands still with the pointer frozen.

## Why the camera is set last

`CameraRig` re-frames the document whenever the selection or the canvas size
changes, as an animation about a third of a second long. Hiding the panels
changes the canvas size; clearing the selection changes the selection. Both
happen while a shot is being set up, so a camera set inside `setup` was
quietly overwritten and every shot came out at the fitted distance no matter
where it was aimed. Shots declare `camera: [azimuth, polar, distance]` and the
recorder applies it after everything else has settled.

## Portrait or punched in

Shots with no interface in them are recorded at 1080 × 1920 with the panels
hidden, so the canvas is the frame.

Interface shots are recorded landscape at twice the delivery size and a 9:16
window is cut out of them, centred on whatever is being used. This is how
software is shot for this format: the whole window scaled to phone width is
unreadable, and it looks like a screenshot of a desktop. `punch(cssX)` builds
the window.

## The opening slot, and footage of real benches

The first beat of each reel is a macro shot of a board — close enough that it
reads as texture rather than as a diagram, which is what the opening of one of
these wants.

It is also a slot. Put clips in `broll/<reel id>/` and they play instead, cut
to an equal share of the opening and scaled to fill the frame:

```
broll/reel1-wire-and-run/01-iron.mp4
broll/reel1-wire-and-run/02-board.mp4
```

**Only put footage there that is licensed for commercial use.** Instagram
matches audio and video against rights-holder catalogues, and a strike lands
on the account, not on the clip. Free stock sites are not all equal: most of
what is on Wikimedia Commons is CC BY-SA, which wants attribution in the video
and arguably licenses the whole reel under the same terms — no good for a
brand account with no text in it. Pexels and Pixabay both permit commercial
use with no attribution, and both want you to sign in and download rather than
take the file off the page.

A phone on your own bench beats all of it. Eight seconds of a real iron and a
real board, shot vertically, is free, unambiguously yours, and more convincing
than stock.
