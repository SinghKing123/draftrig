# Handoff: 105 models for rooms, home cinema, furniture and tech

For the Claude doing dev work on Draftrig. Written 2026-11-03 by the Claude
that fetches models. **I did not touch anything under `src/`** — the catalogue
and kernel are yours. What I added:

- 66 new `.glb` files in `public/models/` (about 37 MB in all, none over 1.4 MB).
- Later the same day, 39 more: studio gear, appliances, workshop machines,
  garage and network kit (about 26 MB, none over 1.6 MB). They are in
  [Second batch](#second-batch-39-more-studio-appliances-workshop-garage).
- Two sections at the end of `public/models/LICENSES.md` crediting every one.
- This file.

None of them is wired to a part yet. That is the job: make a part for each one
you want (or skin an existing part), using the dimensions and `axes` below.

## What every file has in common

- **y is up, the front faces +z, and the base sits at the lowest y.** The
  "front" is the side a person uses: the screen of a projector screen, the
  baffle of a speaker, the lens of a projector. For every seat (sofas,
  recliners, cinema seats, beanbag chair, sim rig) the person sitting faces +z.
  Wall-mounted things (lamps, shelf, curtains, blinds) have the wall at -z.
  **You should not need `rot` on any of them**; every rotation is already baked
  into the vertices, and so are all node transforms (one flat level of meshes).
- Units inside the files vary (metres, centimetres, inches). It does not
  matter: `fit: 'bbox'` scales to the part's solids. Use the millimetre sizes
  in the tables.
- All of them pass the budgets in `src/parts/catalog/models.test.ts`: ≤ 1.6 MB,
  ≤ 40k triangles, no Draco/Meshopt/BasisU/spec-gloss/transmission. Most draw in
  1–3 draw calls (untextured materials were merged into a palette texture).
- I loaded all 66 with three's `GLTFLoader` on the dev server: no errors.
- **All are CC-BY-4.0.** `credit` needs `title`, `author`, `license:
  'CC-BY-4.0'` and `source`. Copy them exactly from `LICENSES.md`.

## How to wire one so it works properly

These are the fit-system rules from the last round. They are why the 20
earlier models stopped drawing at the wrong size.

1. **Make the part's default solids the size in the table.** That size was
   worked out from the model's own proportions, so the default configuration
   fills its box exactly (the test needs ≥ 0.9 on every axis).
2. **Use `axes` for anything parametric.**
   - `'fill'` scales that axis on its own (allowed range 0.55–1.7× against the
     others).
   - A band `[a, b]` stretches only that slice of the mesh, and keeps what is
     outside it rigid (allowed range 0.25–4×). A sofa or bed gets wider through
     its middle while the arms keep their shape.
   - The "`axes` to start from" column is my suggestion. Check it in the editor.
3. **When a setting changes the shape so the mesh no longer tells the truth,
   return `undefined` from `model(p)`.** The part then draws its solids. Do the
   same if `planFit` can't fit honestly; it already falls back on its own and
   logs why.
4. **Lamps:** `paint: [{ match: '<bulb material>', emissive: '#FFD9A0',
   emissiveIntensity: 2.4 }]` when on. The bulb material names are in the notes
   column; I kept those materials separate on purpose.
5. **Anything the mesh doesn't have** (a cable of any length, a mount arm, a
   clearance zone) goes in a solid with `withModel: true`. It is drawn beside the
   model and is not counted in the box the model fits to.
6. **Ports must sit on the drawn shape** (within 15 mm), or on a `withModel`
   solid.

Example, a three-seat sofa whose width is a parameter:

```ts
model: (p) => ({
  url: 'models/sofa-chesterfield.glb',
  fit: 'bbox',
  axes: { x: [0.15, 0.85] },
  credit: { title: 'Couch', author: 'victorberdugo1', license: 'CC-BY-4.0',
    source: 'https://sketchfab.com/3d-models/couch-20865e74c69a4a77b0fa81bc8d852906' },
}),
// default solids: 2200 x 885 x 885; width param 1500–3000 stays inside the 0.25–4x band
```

(Every file's exact `title`, `author` and `source` is in `LICENSES.md`.)

## The models

### AV & cinema

| File | Default W x H x D (mm) | `axes` to start from | Notes |
| --- | --- | --- | --- |
| `av-receiver.glb` | 435 x 235 x 410 | `{}` | Denon AVR-X3400H. Both wifi aerials are up and count in the height. Real body without aerials: 434 x 167 x 389. HDMI/speaker terminals on the back (-z). (17k tris, 1357 kB) |
| `projector.glb` | 330 x 90 x 295 | `{ z: 'fill' }` | Box projector, lens front-centre (+z face, about 0.47 of the width from the left). The light-beam cone in the original was removed. (494 tris, 151 kB) |
| `projector-screen.glb` | 2440 x 1270 x 165 | `{ x: [0.03, 0.97], y: 'fill', z: 'fill' }` | Pull-down screen in its case. Slice x keeps the end caps; y fill lets the drop vary. Viewing surface faces +z. (4k tris, 348 kB) |
| `subwoofer.glb` | 360 x 380 x 410 | `{}` | Sealed sub, driver on +z, amp panel on the back. (16k tris, 1313 kB) |
| `speaker-centre.glb` | 460 x 180 x 190 | `{}` | Two woofers + tweeter, grille-less. (11k tris, 1045 kB) |
| `speaker-bookshelf.glb` | 170 x 320 x 210 | `{}` | Same family as speaker-centre (horn tweeter). Use for front L/R or surrounds. (14k tris, 1353 kB) |
| `speaker-bookshelf-2.glb` | 190 x 300 x 225 | `{}` | Walnut-sided bookshelf speaker, binding posts on the back. (13k tris, 1388 kB) |
| `speaker-tower.glb` | 225 x 1000 x 415 | `{ y: [0.1, 0.9] }` | Floor-standing tower (two woofers + tweeter), cut out of a four-speaker pack and squared to the axes (it was yawed 16 deg). (2k tris, 532 kB) |
| `speaker-tower-white.glb` | 205 x 1050 x 515 | `{ z: 'fill' }` | White tower with black baffle. The mesh is deep for its width; z fill brings it to a real depth. (4k tris, 158 kB) |
| `speaker-ceiling.glb` | 230 x 55 x 230 | `{}` | In-ceiling speaker, round trim. Grille on -y: place it on the ceiling with y down. Only the visible trim and can top are modelled. (10k tris, 294 kB) |
| `cinema-seat.glb` | 560 x 1000 x 675 | `{}` | Single theatre seat with one armrest and cupholder (left). Occupant faces +z. (1k tris, 397 kB) |
| `cinema-seat-pair.glb` | 1100 x 970 x 615 | `{ x: [0.05, 0.95] }` | Two joined theatre seats, red. For a row, repeat the pair; 550 mm per seat. (5k tris, 275 kB) |
| `recliner.glb` | 850 x 1030 x 855 | `{}` | Leather recliner, upright position. Occupant faces +z. Reclined depth is about 1.7x; draw that as a clearance zone, not by stretching. (20k tris, 909 kB) |
| `tv-stand.glb` | 1800 x 365 x 460 | `{ x: [0.3, 0.7] }` | Low black media unit. (5k tris, 207 kB) |
| `tv-stand-2.glb` | 1600 x 450 x 460 | `{ x: [0.35, 0.65] }` | Grey unit with an open centre shelf. (368 tris, 258 kB) |
| `tv-stand-3.glb` | 1530 x 780 x 530 | `{ x: [0.3, 0.7], y: [0.25, 0.9] }` | Sideboard on a metal frame: taller than a TV bench (779 mm at default). (9k tris, 617 kB) |
| `tv-floor-stand.glb` | 670 x 1580 x 600 | `{ y: [0.2, 0.75] }` | Freestanding TV stand with VESA bracket and a mid shelf (for a 50-70" panel). Bracket faces +z. (12k tris, 219 kB) |
| `acoustic-foam.glb` | 305 x 305 x 25 | `{ x: 'fill', y: 'fill' }` | Flat foam tile (wedge texture), faces +z. (1k tris, 110 kB) |
| `acoustic-panel.glb` | 500 x 500 x 30 | `{}` | Pyramid foam panel, real pyramids in the geometry. Faces +z. (6k tris, 887 kB) |
| `acoustic-wall-board.glb` | 600 x 670 x 35 | `{ x: 'fill', y: 'fill' }` | Faceted decorative acoustic board, faces +z. (20k tris, 355 kB) |
| `bass-trap.glb` | 600 x 600 x 600 | `{ y: 'fill' }` | Corner bass trap. Right angle at back-left (-x, -z): it sits in a back-left corner. `rot: [0, -90, 0]` puts it in a back-right corner. (172 tris, 6 kB) |

### Rooms & furniture

| File | Default W x H x D (mm) | `axes` to start from | Notes |
| --- | --- | --- | --- |
| `sofa-chesterfield.glb` | 2200 x 885 x 885 | `{ x: [0.15, 0.85] }` | Three-seat chesterfield. Slice x through the seat cushions for 2/3/4-seat widths. (2k tris, 253 kB) |
| `sofa-l.glb` | 2240 x 840 x 1520 | `{ x: [0.45, 0.85] }` | Grey L-shaped sofa, chaise at front-left. Slice x through the two right-hand seats. Chaise is on the left only (see below). (24k tris, 933 kB) |
| `sofa-modern.glb` | 2400 x 720 x 940 | `{ x: [0.12, 0.88] }` | Low modern sofa with loose cushions. (19k tris, 1081 kB) |
| `armchair-lounger.glb` | 755 x 1050 x 895 | `{}` | Wing lounger on a four-star swivel base. (20k tris, 828 kB) |
| `armchair-patricia.glb` | 845 x 1000 x 845 | `{}` | Ornate tufted armchair. (13k tris, 573 kB) |
| `coffee-table-noguchi.glb` | 1280 x 390 x 920 | `{}` | Noguchi-style glass-top coffee table; the model is at the real 1280 x 400 x 930. (19k tris, 354 kB) |
| `coffee-table-victorian.glb` | 1200 x 540 x 545 | `{ x: [0.2, 0.8] }` | Turned-leg Victorian coffee table. (3k tris, 674 kB) |
| `side-table-round.glb` | 500 x 420 x 500 | `{ y: [0.15, 0.85] }` | Round marble-top pedestal table, gold base. (15k tris, 572 kB) |
| `bedside-table.glb` | 365 x 750 x 405 | `{}` | Victorian pot-cupboard bedside: drawer over a door, front +z. (596 tris, 320 kB) |
| `beanbag.glb` | 900 x 295 x 895 | `{ y: 'fill' }` | Round floor pouf / beanbag (low). (20k tris, 353 kB) |
| `beanbag-chair.glb` | 1000 x 575 x 970 | `{}` | Beanbag chair with a raised back, occupant faces +z. (20k tris, 353 kB) |
| `bookcase.glb` | 1110 x 1800 x 270 | `{ x: [0.1, 0.9], y: [0.1, 0.9] }` | Open bookcase filled with books. (20k tris, 358 kB) |
| `bookcase-corner.glb` | 915 x 610 x 915 | `{}` | L-shaped corner unit with a cupboard; the outer corner is back-right (+x, -z), shelves face into the room. (11k tris, 425 kB) |
| `wall-shelf.glb` | 1000 x 185 x 250 | `{ x: [0.1, 0.9] }` | Floating wooden shelf on brackets, wall at -z. (724 tris, 366 kB) |
| `bed.glb` | 1510 x 1225 x 2130 | `{ x: [0.12, 0.88], z: [0.15, 0.85] }` | Victorian double bed, headboard at -z. Slice x for single/double/king widths. (19k tris, 1257 kB) |
| `wardrobe.glb` | 1350 x 1970 x 820 | `{ z: 'fill' }` | Two-door antique wardrobe. The mesh is 820 deep at this height; z fill takes it to 600. (2k tris, 538 kB) |
| `dining-table.glb` | 1500 x 675 x 800 | `{ x: [0.12, 0.88], y: 'fill' }` | Industrial wood-top table on black frames. The mesh stands 675; y fill takes it to 750. (1k tris, 438 kB) |
| `dining-set.glb` | 2400 x 760 x 1610 | `{}` | Glass dining table with six cantilever chairs, as one piece: the footprint with chairs pulled in. (10k tris, 1141 kB) |
| `standing-desk.glb` | 1600 x 865 x 805 | `{ x: [0.2, 0.8], y: [0.15, 0.85] }` | White-top sit-stand desk, controller at the front-right. Same slice treatment as the existing desk. (13k tris, 599 kB) |
| `standing-desk-corner.glb` | 1615 x 630 x 1615 | `{ y: [0.15, 0.85] }` | L-shaped sit-stand desk (white). The user stands in the notch at front-left. (20k tris, 833 kB) |
| `plant-monstera.glb` | 860 x 1200 x 775 | `{}` | Monstera in a white pot. (19k tris, 593 kB) |
| `rug.glb` | 2400 x 10 x 2090 | `{ x: 'fill', z: 'fill' }` | Kuuma rug, 8 mm thick. Make the part thickness scale with its width (width x 0.0033) so y stays the uniform axis. (1k tris, 466 kB) |
| `rug-persian.glb` | 3000 x 5 x 2180 | `{ x: 'fill', z: 'fill' }` | Persian pictorial carpet. Same thickness rule as rug. (2k tris, 384 kB) |

### Lighting, windows & decor

| File | Default W x H x D (mm) | `axes` to start from | Notes |
| --- | --- | --- | --- |
| `floor-lamp-arc.glb` | 700 x 1920 x 405 | `{}` | Black reading lamp with an angled head. Bulb material: "02_-_defaultsaf" (paint it emissive when on). (3k tris, 87 kB) |
| `floor-lamp-uplight.glb` | 270 x 1815 x 270 | `{}` | Torchiere uplight. Material "StandingLampOff"; paint emissive when on. (6k tris, 370 kB) |
| `wall-lamp.glb` | 160 x 295 x 280 | `{}` | Fabric-shade wall sconce, wall at -z. Bulb material "WallLampLightBulb_MTL". (14k tris, 1088 kB) |
| `wall-lamp-twin.glb` | 720 x 330 x 360 | `{}` | Twin spot bar, wall plate at -z. LED material "LED_-_SMD_3528". (9k tris, 190 kB) |
| `wall-light-spot.glb` | 90 x 120 x 135 | `{}` | Cylindrical wall up/down light (LIGHTSTAR Paro). LED material "Yelow_LED_ceramika". Has a maker logo in the product name only. (10k tris, 204 kB) |
| `curtain.glb` | 2480 x 2540 x 220 | `{ x: 'fill', y: 'fill' }` | One red curtain panel hanging straight. Split from a two-panel file. (11k tris, 216 kB) |
| `curtain-tied.glb` | 1735 x 2535 x 485 | `{ y: 'fill' }` | The same curtain tied back. Same source file as curtain. (11k tris, 220 kB) |
| `curtains.glb` | 2150 x 2025 x 420 | `{ x: [0.1, 0.9], y: 'fill' }` | Pair of drapes plus sheers on a rod with brackets; wall at -z. Was Z-up, stood upright. (16k tris, 1193 kB) |
| `blinds.glb` | 1200 x 1140 x 60 | `{ x: 'fill', y: 'fill' }` | Venetian blind, faces +z. (772 tris, 272 kB) |

### Workstation & gaming

| File | Default W x H x D (mm) | `axes` to start from | Notes |
| --- | --- | --- | --- |
| `xbox-series-x.glb` | 150 x 300 x 150 | `{}` | Upright, green vent top. Xbox logo on the front. (18k tris, 652 kB) |
| `racing-pedals.glb` | 410 x 230 x 285 | `{}` | Three-pedal set, no cover. Pedal faces toward +z (the driver). (19k tris, 753 kB) |
| `racing-wheel.glb` | 330 x 330 x 140 | `{}` | Three-spoke wheel with quick-release hub: rim faces +z (driver), hub toward -z. Was flat, stood up. (14k tris, 1183 kB) |
| `racing-wheel-2.glb` | 350 x 355 x 80 | `{}` | Deep-dish Momo-style wheel, no hub. Same orientation. (19k tris, 628 kB) |
| `sim-rig.glb` | 775 x 915 x 1560 | `{}` | Wooden cockpit with seat, wheel and pedals. Turned 180 deg so the occupant faces +z, like every chair here. (13k tris, 390 kB) |
| `server-rack.glb` | 670 x 2000 x 1310 | `{ y: [0.05, 0.95] }` | 42U-style rack with a pull-out console tray at +z. (1k tris, 267 kB) |
| `studio-monitor.glb` | 170 x 285 x 220 | `{}` | Yamaha HS5 nearfield monitor (real 170 x 285 x 222). Yamaha logo on the front. (15k tris, 802 kB) |
| `mic-condenser.glb` | 60 x 160 x 60 | `{}` | Audio-Technica AT2020, upright, XLR at the bottom. Was lying along x. (4k tris, 437 kB) |
| `webcam.glb` | 85 x 65 x 80 | `{}` | Logitech webcam, lens +z, clip folded back over -z. "logi" logo on the front. (19k tris, 753 kB) |

### Lab

| File | Default W x H x D (mm) | `axes` to start from | Notes |
| --- | --- | --- | --- |
| `printer-3d.glb` | 665 x 590 x 690 | `{}` | Prusa i3-style printer, LCD at +z. 1 draw call. (1k tris, 108 kB) |
| `oscilloscope.glb` | 390 x 260 x 545 | `{}` | Benchtop scope, screen +z. The trailing mains cable was removed (it doubled the footprint). (15k tris, 673 kB) |
| `multimeter.glb` | 85 x 35 x 155 | `{}` | Handheld meter lying flat, display up, jacks toward +z. (2k tris, 191 kB) |
| `soldering-station.glb` | 210 x 245 x 195 | `{}` | Station with iron in its holder and sponge. The iron cable loops up and back and counts in the box. (14k tris, 746 kB) |

## Second batch: 39 more (studio, appliances, workshop, garage)

Added later on 2026-11-03, for "all kinds of tech" in a room. Everything in
[What every file has in common](#what-every-file-has-in-common) and
[How to wire one](#how-to-wire-one-so-it-works-properly) applies unchanged:
y up, front +z, transforms baked, CC-BY-4.0, inside the test budgets
(39 files, 26.2 MB in all, the largest 1502 kB).

What is different about this batch:

- **Sizes come from one real dimension.** For each file I picked one
  measurement (a fridge's height, a rack unit's 440 mm width) and the other two
  follow from the model's own proportions. Check the ones you care about.
- **Some were made opaque on purpose:** `microwave`, `vr-headset`,
  `arcade-cabinet`, `space-heater` and `washing-machine` had a whole-model
  blended material that only existed to show a window or a tint. Blended
  meshes sort badly, so these are now opaque. Real glass was kept: the
  `cnc-mill` door, the `pc-case-rgb` side panel, the `security-camera` lens,
  the `ups-rack` decals and two small palette swatches.
- **Two were turned upright** after the orientation check: `solar-panel` came
  tilted 48° and `ceiling-fan` came upside down.
- I placed 37 of them (all but `drawing-tablet` and `ceiling-fan`) in a
  seven-room scene in three.js, for the Draftrig ad page. They load with no
  errors and sit on the floor or wall at the sizes below.

### Studio & creator

| File | Default W x H x D (mm) | `axes` to start from | Notes |
| --- | --- | --- | --- |
| `camera-tripod.glb` | 815 x 1600 x 735 | `{}` | Camera on a tripod, lens toward +z. Legs spread; the box is the leg footprint. (22k tris, 2 draw calls, 1065 kB) |
| `ring-light.glb` | 385 x 1750 x 420 | `{}` | Ring light on its stand, ring faces +z. (20k tris, 3 draw calls, 530 kB) |
| `softbox.glb` | 760 x 1900 x 875 | `{}` | Softbox on a stand, diffuser faces +z. (13k tris, 1 draw call, 634 kB) |
| `audio-mixer.glb` | 320 x 135 x 325 | `{}` | 8-channel desk mixer, faders toward +z, inputs at the back. (20k tris, 1 draw call, 643 kB) |
| `synth.glb` | 750 x 250 x 445 | `{}` | Analogue synth with keys, keys toward +z. (11k tris, 1 draw call, 773 kB) |
| `midi-keyboard.glb` | 800 x 75 x 290 | `{}` | 49-key controller, keys toward +z. (16k tris, 7 draw calls, 1126 kB) |
| `dj-controller.glb` | 600 x 45 x 400 | `{}` | Two-deck DJ controller, mixer section toward +z. (13k tris, 3 draw calls, 811 kB) |
| `turntable.glb` | 450 x 160 x 345 | `{}` | Direct-drive turntable, front edge +z. Carries a 1210-style badge. (6k tris, 4 draw calls, 384 kB) |
| `guitar-amp.glb` | 400 x 420 x 265 | `{}` | Combo amp, grille +z. (10k tris, 4 draw calls, 416 kB) |
| `drawing-tablet.glb` | 340 x 45 x 195 | `{}` | Pen tablet lying flat, active area up, pen beside it. (8k tris, 1 draw call, 366 kB) |

### Home & appliances

| File | Default W x H x D (mm) | `axes` to start from | Notes |
| --- | --- | --- | --- |
| `fridge.glb` | 965 x 1800 x 750 | `{}` | Fridge-freezer, doors +z. Low-poly. (1k tris, 1 draw call, 58 kB) |
| `washing-machine.glb` | 580 x 850 x 855 | `{}` | Front loader with its door modelled **open**: the box depth includes the door (the body alone is about 600 deep). (20k tris, 1 draw call, 1328 kB) |
| `microwave.glb` | 500 x 310 x 445 | `{}` | Door +z. Made opaque: the original blended the whole oven to show the window, which sorts badly. (2k tris, 1 draw call, 245 kB) |
| `air-conditioner.glb` | 900 x 255 x 265 | `{}` | Wall split unit, wall at -z. (348 tris, 1 draw call, 154 kB) |
| `air-purifier.glb` | 335 x 600 x 300 | `{}` | Floor-standing purifier, front +z. (20k tris, 1 draw call, 1085 kB) |
| `desk-fan.glb` | 405 x 420 x 290 | `{}` | Retro desk fan, blades face +z. (20k tris, 1 draw call, 1233 kB) |
| `ceiling-fan.glb` | 1300 x 450 x 1300 | `{}` | Hangs from the ceiling plate at the **top** of the box; blades below. Place it by its top face. (1k tris, 1 draw call, 550 kB) |
| `space-heater.glb` | 430 x 500 x 320 | `{}` | Fan heater, grille +z. Made opaque. (6k tris, 1 draw call, 643 kB) |
| `robot-vacuum.glb` | 350 x 80 x 350 | `{}` | Robot vacuum, bumper toward +z. (5k tris, 1 draw call, 220 kB) |
| `smart-speaker.glb` | 195 x 200 x 190 | `{}` | Fabric smart speaker. (17k tris, 1 draw call, 747 kB) |
| `thermostat.glb` | 120 x 120 x 50 | `{}` | Wall thermostat, wall at -z. The thermostat on its own, cut from a thermostat-and-smoke-alarm set. (68 tris, 1 draw call, 23 kB) |
| `security-camera.glb` | 260 x 240 x 280 | `{}` | Bracket mounts to a wall at -z; the lens points **+x**, along the wall. Turn it with `rot` y to look into the room. (20k tris, 3 draw calls, 473 kB) |

### Workshop & making

| File | Default W x H x D (mm) | `axes` to start from | Notes |
| --- | --- | --- | --- |
| `workbench.glb` | 2615 x 1230 x 510 | `{}` | Long timber workbench, front +z. The worktop is at 0.73 of the box height (about 900 mm); something at the back rises above it. Sized so the worktop is at 900. (15k tris, 1 draw call, 1129 kB) |
| `tool-chest.glb` | 1320 x 1000 x 475 | `{}` | Rolling tool chest, drawers +z. (16k tris, 1 draw call, 1068 kB) |
| `drill-press.glb` | 540 x 1600 x 970 | `{}` | Floor drill press, table and chuck toward +z. (5k tris, 1 draw call, 228 kB) |
| `cnc-mill.glb` | 1700 x 1325 x 1870 | `{}` | Enclosed milling machine, door +z. The door glass is transparent (32 tris blended). A loose part was removed. (24k tris, 2 draw calls, 1048 kB) |
| `laser-engraver.glb` | 450 x 370 x 415 | `{}` | Open-frame diode laser engraver. (20k tris, 2 draw calls, 403 kB) |
| `robot-arm.glb` | 620 x 1100 x 855 | `{}` | 6-axis arm on its base, in a working pose. Its reach is wider than the box. (8k tris, 1 draw call, 643 kB) |
| `bench-psu.glb` | 340 x 145 x 325 | `{}` | Bench power supply, panel +z. (6k tris, 7 draw calls, 489 kB) |

### Gaming, network & power

| File | Default W x H x D (mm) | `axes` to start from | Notes |
| --- | --- | --- | --- |
| `pc-case-rgb.glb` | 330 x 470 x 410 | `{}` | Mid tower, front +z, glass side panel (blended). **Close to the 1.6 MB limit.** Renders dark under low light. (20k tris, 2 draw calls, 1502 kB) |
| `vr-headset.glb` | 190 x 170 x 290 | `{}` | Headset with strap, visor +z. Made opaque. (6k tris, 1 draw call, 539 kB) |
| `arcade-cabinet.glb` | 610 x 1750 x 700 | `{}` | Upright arcade cabinet, screen +z. Made opaque. (2k tris, 3 draw calls, 262 kB) |
| `drone.glb` | 380 x 125 x 400 | `{}` | Quadcopter, nose +z. (7k tris, 1 draw call, 566 kB) |
| `telescope.glb` | 540 x 1450 x 840 | `{}` | Refractor on a tripod; the tube points up and back. (20k tris, 1 draw call, 1256 kB) |
| `e-scooter.glb` | 490 x 1200 x 1115 | `{}` | E-scooter, direction of travel +z. (2k tris, 1 draw call, 493 kB) |
| `ev-charger.glb` | 245 x 460 x 155 | `{}` | Wall charger with its cable holstered, wall at -z. Carries the V2C logo (V2C uploaded the model). (20k tris, 2 draw calls, 692 kB) |
| `solar-panel.glb` | 1000 x 2000 x 45 | `{}` | Panel **upright**, cells facing +z, about 45 mm thick. For a roof, lay it down with `rot: [-90, 0, 0]`. The original came tilted 48° and was straightened. (4k tris, 1 draw call, 290 kB) |
| `network-switch.glb` | 440 x 55 x 175 | `{}` | 19-inch 24-port switch, ports +z. The texture is noisy close up. (12k tris, 2 draw calls, 613 kB) |
| `ups-rack.glb` | 440 x 90 x 660 | `{}` | 19-inch rack UPS, front +z. Decals use alpha. Carries the Vertiv name. (10k tris, 2 draw calls, 837 kB) |

## Things to know

- **Visible credit is still not shown in the app.** That was true before and
  is now true of 125 files. CC-BY needs the author named wherever the model is
  shown. `ModelSpec.credit` holds the data, but nothing renders it yet. This
  must be done before a public launch.
- **Brand logos** are on `xbox-series-x`, `webcam` ("logi"), `studio-monitor`
  (Yamaha), `av-receiver` (Denon), `mic-condenser` (Audio-Technica),
  `speaker-bookshelf-2` (a "Photon" badge), `ev-charger` (V2C), `ups-rack`
  (Vertiv) and `turntable` (a 1210-style badge). The models are licensed.
  Whether to show trademarks is a product call.
- **Mirroring:**
  - `sofa-l` has its chaise on the left. A right-hand version needs a mirrored
    file, or support for a negative scale in `ModelSpec`. Neither exists yet.
  - `bass-trap` can turn instead of mirroring: `rot: [0, -90, 0]` moves it
    from the back-left corner to the back-right.
- **Projector:** there is still no good CC-BY model of a modern home-cinema
  projector. `projector.glb` is a clean, simple box with a lens (494 tris). It
  is fine for placement and throw-distance work. The throw ratio and lens
  offset belong in the part's parameters, not the mesh.
- **Rugs** are 5–10 mm thick. If the rug part has a fixed thickness and a
  variable width, y can no longer be the uniform axis and the fit fails. Scale
  the thickness with the width, as the notes say.
- Things I looked for and did not take:
  - No usable CC-BY Blu-ray/streaming box: the search results are spam.
  - No AV receiver other than the Denon.
  - The bigger steel sim rig had a person merged into its mesh.
  - A "house plant pot" turned out to be a cartoon creature.
  - One projector had no lens.
  - One steering wheel came tilted at an arbitrary angle.

## If a file needs re-preparing

The tools are in the fetching Claude's scratchpad:
`C:\Users\aryan\AppData\Local\Temp\claude\86a6f29862cc08de\9b5be097-4a68-4c70-90bc-3d38db29d846\scratchpad`

- **The original downloads are gone.** The C: drive filled up during the
  second batch, and I deleted the originals to make room. To re-prepare a
  file, download it again from its `LICENSES.md` source link.
- Per-model settings: `prep2.json` (first batch), `prep3.json` (second).
- Pipeline: `tools\prep.mjs`, with `tools\batch.mjs` and `tools\batch3.mjs`.
- Orientation sheets (front, right, top and iso views): `all-views-1.jpg` to
  `all-views-3.jpg` for the first 66, and `all-views-4.jpg` and
  `all-views-5.jpg` for the 39.

It is a temp directory, so copy anything you want to keep.
