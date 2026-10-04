# Where these came from

Every clip here is a continuous capture of the running editor, recorded by
`tools/reel/` against a local dev server. No frame is composited, sped up
beyond its stated rate, or assembled from anything but the editor's own
output. There is no pointer choreography: the document and the camera move,
and that is all.

Each `.webm` has an `.mp4` beside it for browsers that need one, and a `.jpg`
first frame used as the poster so the plate is never an empty box.

To retake: `npm run dev`, then
`BASE=http://localhost:5173 node tools/reel/run.mjs record clip-`, then
`node tools/reel/clips-build.mjs` to encode. The encoder needs ffmpeg on PATH
or `FFMPEG=/path/to/ffmpeg` in the environment.
