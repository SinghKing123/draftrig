# Brief: a Blender ad for Draftrig

Paste this whole file as the prompt. It is self-contained — you do not have
the conversation it came from.

---

You are making a cinematic product ad for **Draftrig** (https://draftrig.com)
in **Blender**, rendered in **EEVEE**, and encoding it to a posting-ready MP4.

Before you model anything, open https://draftrig.com and
https://draftrig.com/app and look at them. The ad has to look like it came
from the same studio as the site. Do not skip this.

## What Draftrig is, so the ad isn't generic

A browser 3D workbench for two things that normally need two different tools:

1. **Setups you bolt together.** A desk in a room. A console stand cut from
   2020 aluminium extrusion. A shop rack. Where the mains run, which socket
   carries what, whether one extension lead can take a monitor, a tower and a
   heater at once.
2. **Circuits you wire up.** A populated board. An LED matrix. A 555 running.
   A control cabinet on DIN rail. The schematic and the physical object are
   the same object, and it simulates.

**The one idea the ad has to land:** the thing you bolt together and the
thing you wire up are the same drawing. Nothing else. Do not try to also say
it is free, fast, in the browser, or AI-anything.

## Deliverable

| | |
|---|---|
| Master | `draftrig-ad.mp4` — 1080 × 1920, 30 fps, H.264, CRF 17, yuv420p, `+faststart` |
| Length | 20–23 s including the end card |
| Audio | none. A silent master is correct; do not add stock music |
| Also ship | the `.blend`, the Python build script, and the PNG sequence |
| Optional | a 2560 × 1440 16:9 recut, only after the vertical one is finished |

Bottom 15% of the vertical frame (the last ~288 px) is platform UI. Nothing
that matters lives there.

## Shot list

Seven beats. Times are the cut points. Hold each one long enough that the
viewer sees the thing happen — a beat under three seconds reads as a flicker.

| # | t | Shot |
|---|---|---|
| 1 | 0.0–3.2 | **Macro, extrusion.** A 2020 profile three-quarter end-on, filling the upper two-thirds. A T-nut slides into the slot and a cap screw turns down onto it. 100mm lens, f/2.8, focus on the nut, the profile falling off soft behind. This beat sells the material before it sells the software. |
| 2 | 3.2–7.2 | **The console stand assembles.** Pull back to a 2020 frame building itself around an upright console on a plywood shelf: uprights seat, corner brackets land, screws turn, the shelf drops in last. Parts arrive on arcs and *contact* — nothing hovers. |
| 3 | 7.2–11.0 | **The room, wide.** Slow dolly left across a desk against a wall: monitor, tower, laptop, a heater. Cables route off the desk, down the leg, along the skirting, to a wall socket. Camera inside the room, 28mm, f/5.6. Walls and floor present and lit — a room shot from outside is an unlit box. |
| 4 | 11.0–13.4 | **Insert, the socket.** The plug enters the wall socket. One small warm indicator comes up as it seats. 85mm, f/2.0, very shallow. This is the beat that says the ad is about load, not decoration. |
| 5 | 13.4–17.0 | **Cut to the bench, the board.** A bare PCB on a dark bench. Components place themselves — headers, caps, a regulator — and solder fillets form at the pads. 100mm macro, f/2.8, a 3cm push in. |
| 6 | 17.0–20.0 | **The matrix lights.** An 8×8 LED matrix on a stand, wired, and a wave runs across the dots. The amber emission is the only strong colour in the ad and it arrives here. Light it *for real* — emissive shaders plus actual lights, so it spills onto the bench and the wiring. |
| 7 | 20.0–22.3 | **Both, together, then the card.** Pull wide to the stand and the board on one warm paper ground in the same frame. Fade to the end card. |

Cut on motion, not on stillness. Every cut should land while something is
still moving.

## Modelling

No importer will help you — Draftrig has no 3D export. Model it in Blender,
and **model it with Python**, not by hand, because every subject here is
rectilinear hardware. A script that takes `(length, slot, holes)` and returns
a 2020 member is worth more than forty hand-placed cubes, and it is the only
way the second iteration is cheap.

Real dimensions, because wrong scale is the single fastest way to make a
render look fake:

- 2020 extrusion: 20 × 20 mm, 6 mm slots, 5 mm centre bore. Profile with an
  actual slot cross-section — not a cube with a groove texture. Bevel every
  edge 0.3 mm; a zero-bevel edge reads as CGI instantly.
- Console: generic, roughly 390 × 104 × 260 mm, upright.
- Desk: 1400 × 700 × 740 mm. Monitor 27", ~614 mm wide.
- Wall socket at 300 mm above the floor, plate ~86 × 86 mm.
- LED matrix module: 32 × 32 mm, 8 × 8 dots on 3.2 mm pitch.
- PCB: 1.6 mm thick. Pads and silkscreen as textures on a flat board, not
  geometry.
- Room: ~4.6 × 3.4 m, 2.4 m ceiling.

Materials — Principled BSDF throughout:

| Material | Settings |
|---|---|
| Anodised aluminium | base 0.60 grey, a touch cool · metallic 1.0 · roughness 0.35 · anisotropic 0.4 oriented along the extrusion axis |
| Black ABS / console | base 0.02 · roughness 0.42 · coat weight 0.3 |
| FR4 | matte black or dark green · roughness 0.62 · subtle woven normal |
| Copper pad / solder | metallic 1.0 · roughness 0.28 · pad (0.72, 0.45, 0.20), solder (0.70, 0.70, 0.72) |
| Plywood | warm diffuse, roughness 0.7, visible lamination stripes on cut edges |
| Paper ground | pure diffuse, roughness 0.9, specular 0.1 |
| LED, lit | emission `#FFB020` at strength 8–20, plus a real point light at the same place |

## Lighting

Soft, large, and motivated. One big area light as the key, 2–4× the subject's
own size, at about 35° off axis and 25° above; a second much dimmer area as
fill on the opposite side; a narrow strip behind and above for a rim that
separates anodised metal from the ground. Set a real `radius` on every light
so the shadows have a penumbra — hard-edged shadows are the other instant
tell.

Add the practicals: the monitor glows, the LEDs glow, the socket indicator
glows, and all of them cast.

A faint volumetric haze (density ~0.002) in the bench shots, so the rim light
has something to sit in. Not in the room shot, where it reads as smoke.

## Camera and composition

- 100mm for the macros, 85mm for the insert, 50mm for the mediums, 28mm only
  for the room wide. Sensor 36mm. Never a fisheye.
- Real depth of field: f/2.0–2.8 on inserts, f/5.6 on wides, focus on an
  empty object parented to the subject so it tracks.
- Moves are small and slow. A 3–8 cm dolly or a 4° orbit over four seconds.
  **Ease every move** — set F-curve interpolation to Sinusoidal or
  Bezier ease-in-out. Linear interpolation is what makes a camera move look
  like a screen recording. No handheld noise, no shake, no wobble.
- Keep the subject in the upper 60% of the vertical frame, off centre, on a
  third, with the negative space on the side it is travelling toward.
- Use the tall frame as depth: something out-of-focus in the near bottom,
  the subject in the middle, falloff at the top. A vertical frame with one
  object floating in the middle of it is a square ad with bars.
- Lock the horizon. No dutch tilt anywhere.

## Render settings

EEVEE, and specifically the modern one:

```python
scene.render.engine = 'BLENDER_EEVEE_NEXT'   # fall back to 'BLENDER_EEVEE' on <4.2
scene.eevee.use_raytracing = True            # reflections, refraction, fast GI
scene.eevee.ray_tracing_options.resolution_scale = '1'
scene.eevee.use_shadows = True
scene.eevee.taa_render_samples = 128
scene.render.use_motion_blur = True
scene.render.motion_blur_shutter = 0.4
scene.render.resolution_x, scene.render.resolution_y = 1080, 1920
scene.render.fps = 30
scene.render.film_transparent = False
```

- Raytracing replaces the old AO and screen-space reflection toggles. Turn it
  on; without it, anodised aluminium has nothing to reflect and goes flat grey.
- Bloom is no longer a render toggle. Do it in the compositor with a **Glare**
  node (Bloom, or Fog Glow on older builds), threshold ~1.0, mixed low — just
  enough that the lit LEDs bleed a little. If it is visible as an effect, it
  is too strong.
- View transform **AgX**, with a medium-high-contrast look. AgX desaturates
  and compresses highlights, so a material authored at the brand's paper
  value will not render at it. **Sample the rendered pixel and correct the
  material until the render lands on the right colour** — do not trust the
  material value.
- Output 16-bit PNG sequence, then encode with ffmpeg. Do not use Blender's
  own H.264 muxer.

## The end card

The only words in the entire ad. Flat 2D, 2.3 seconds, fade in over 0.3s.

- Ground `#FDFBF7`, with a 72 px grid of `rgba(23,21,15,0.045)` lines.
- The Draftrig wordmark, centred, 620 px wide.
- A 120 × 3 px rule in `#DBD2C3` under it.
- `draftrig.com` in JetBrains Mono, 46 px, `#17150F`.

Nothing else. No tagline, no claim, no button, no QR code.

## Brand reference

```
paper   #FDFBF7      ink      #17150F      rule     #DBD2C3
ink-2   #554F46      accent   #1E6FFF      amber    #FFB020
dark    #15130F      line     #E9E2D7
```

Headings are Schibsted Grotesk; anything monospaced is JetBrains Mono. The
blue is intent and selection. The amber is energised — current, a lit dot, a
hot tip. **One accent per frame.** A third colour is how this kind of ad
starts to look cheap.

## Pipeline

```bash
blender --background --factory-startup --python build_ad.py   # build + render
```

Have the script build the scene from scratch every time, so the `.blend` is
an output and not a thing you have to maintain by hand. Then:

```bash
ffmpeg -y -framerate 30 -i render/f%05d.png \
  -c:v libx264 -preset slow -crf 17 -pix_fmt yuv420p -movflags +faststart \
  draftrig-ad.mp4
```

## Verify before you commit to a full render

660 frames is a long time to spend on a composition you have not looked at.

1. Render **three frames per beat** (start, middle, end) at 25% scale and 16
   samples. 21 stills, a couple of minutes.
2. Tile them into one contact sheet and **actually look at it.** Check:
   does every beat read as its subject at a glance? Is anything important in
   the bottom 288 px? Is anything floating without contact? Any blown
   highlight, any crushed black, any frame that is 90% empty ground?
3. Fix everything that sheet shows, in one pass.
4. One more sheet to confirm.
5. Then the full render. Run it in the background and check partials.

Stop polishing after that. Two verification rounds, not a loop.

## Bans

- **No text, caption, label, lower third or callout over any footage.** The
  only words in the ad are the end card. This is not negotiable; an earlier
  version of this ad had captions and they were the worst thing about it.
- No claims anywhere — no "free", no "no account", no feature list.
- No dark void with teal rim lights. The ad stands on warm paper and lit rooms.
- No real brand marks: no PlayStation, Apple, Dell, Arduino or anyone else's
  logo, name or distinctive silhouette. The console is a generic console.
- No lens flare, no anamorphic streaks, no chromatic aberration, no heavy
  vignette, no film grain overlay, no light leaks.
- No part that floats without seating. Everything lands and contacts.
- No un-bevelled edges and no 90° corners on metal.
- No linear camera interpolation.
- No "X, not Y" phrasing if you write anything at all.

## Done means

`draftrig-ad.mp4` exists at 1080 × 1920 / 30 fps, is 20–23 s long, plays from
black, shows a setup assembling and a circuit working, has no words in it
until the card, and the script that built it runs clean from
`--factory-startup`. Report the render time, the frame count and the file
size, and say plainly anything you could not get working.
