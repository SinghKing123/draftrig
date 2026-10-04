# Where these came from

Every `.jpg` in this directory is a screenshot of the running editor, taken by
`tools/shoot-presets.mjs` against a local dev server. None is a render made
elsewhere, a mock-up, or a photograph of real hardware.

The tool loads each build from `STARTERS`, switches the simulation on, waits
for anything with a display to clock up, places the camera from the table in
that file, and shoots the canvas. What is lit in these pictures is lit because
the solver lit it: the scoreboard reads its own text, the LED matrix is at the
current the sketch set, and the wires show current where current is flowing.

To retake them all: `npm run dev`, then `node tools/shoot-presets.mjs`. The
tool prints how much of each frame the subject fills and flags any shot that
came back empty, which is how a camera angle that ends up inside the geometry
gets caught instead of shipping as a valid black JPEG.
